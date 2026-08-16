import hashlib
import json
import logging
from functools import partial

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.db import db_conn
from core.auth import get_user_id
from study.exam_schema import ensure_exam_schema
from study.exam_scoring import flatten_questions, score_attempt
from study.exam_stub import STUB_EXAM_ID, STUB_PAPER
from study.exam_vocab_gen import generate_vocabulary_paper, GenerationFailed

router = APIRouter()
logger = logging.getLogger(__name__)

# id -> (generator_version, callable(seed) -> paper). generator_version
# is stored per row in exam_papers — nothing reads it back yet, but a
# future migration can use it to find and regenerate papers made by an
# older version of a given generator instead of silently serving them
# forever.
_LEVELS = ["N5", "N4", "N3", "N2", "N1"]

EXAM_GENERATORS = {
    STUB_EXAM_ID: ("stub-1", lambda seed: STUB_PAPER),
    **{
        # "-vocab-01", not "-kanji-01": this generator now covers the
        # whole vocabulary section (漢字読み/表記/文脈規定/言い換え類義/
        # 用法 where each has a generator), not kanji items alone — see
        # exam_vocab_gen.py. Renamed rather than kept for continuity
        # since nothing has shipped to real users under the old id yet.
        f"{level.lower()}-vocab-01": ("vocab-gen-1", partial(generate_vocabulary_paper, level))
        for level in _LEVELS
    },
}

ensure_exam_schema()


def _seed_for(exam_id: str) -> int:
    # Deterministic from the id alone, so the id is the whole
    # reproducibility key — no seed needs to be passed around or
    # stored anywhere else to regenerate/verify a paper later.
    return int(hashlib.sha256(exam_id.encode()).hexdigest(), 16) % (2**63)


def _get_or_create_paper(exam_id: str) -> dict | None:
    entry = EXAM_GENERATORS.get(exam_id)
    if entry is None:
        return None
    generator_version, generate = entry

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT paper FROM exam_papers WHERE exam_id = %s", (exam_id,))
            row = cur.fetchone()
            if row:
                return row[0]

            seed = _seed_for(exam_id)
            try:
                paper = generate(seed)
            except GenerationFailed as e:
                logger.error("Exam generation failed for %s: %s", exam_id, e)
                raise HTTPException(status_code=503, detail=f"Could not generate exam: {exam_id}")

            # INSERT ... ON CONFLICT DO NOTHING + re-SELECT: two
            # concurrent requests for the same never-before-seen
            # exam_id (ExamSectionSelect and ExamRunner both fetch on
            # mount) can never materialize two different papers — the
            # loser of the race just reads back the winner's row.
            question_count = len(flatten_questions(paper))
            cur.execute(
                """
                INSERT INTO exam_papers
                    (exam_id, level, seed, generator_version, paper, section_count, question_count)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (exam_id) DO NOTHING
                """,
                (
                    exam_id, paper["level"], seed, generator_version,
                    json.dumps(paper), len(paper["sections"]), question_count,
                ),
            )
            cur.execute("SELECT paper FROM exam_papers WHERE exam_id = %s", (exam_id,))
            row = cur.fetchone()
        conn.commit()
        return row[0]
    finally:
        conn.close()


@router.get("/api/exams")
def list_exams(user_id: str = Depends(get_user_id)):
    out = []
    for exam_id in EXAM_GENERATORS:
        paper = _get_or_create_paper(exam_id)
        out.append({
            "id": exam_id,
            "level": paper["level"],
            "title": paper["title"],
            "titleJp": paper["titleJp"],
            "sectionCount": len(paper["sections"]),
            "questionCount": len(flatten_questions(paper)),
        })
    return out


@router.get("/api/exams/{exam_id}")
def get_exam(exam_id: str, user_id: str = Depends(get_user_id)):
    paper = _get_or_create_paper(exam_id)
    if paper is None:
        raise HTTPException(status_code=404, detail=f"Unknown exam id: {exam_id}")
    return paper


class SubmitAttemptPayload(BaseModel):
    section_id: str
    answers: dict[str, str]
    started_at: int   # epoch ms, matches Date.now() on the client
    finished_at: int


@router.post("/api/exams/{exam_id}/attempts")
def submit_attempt(exam_id: str, payload: SubmitAttemptPayload, user_id: str = Depends(get_user_id)):
    paper = _get_or_create_paper(exam_id)
    if paper is None:
        raise HTTPException(status_code=404, detail=f"Unknown exam id: {exam_id}")

    summary = score_attempt(paper, payload.answers)

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO exam_attempts
                    (user_id, exam_id, section_id, answers, review, per_section, correct, total, started_at, finished_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, to_timestamp(%s), to_timestamp(%s))
                RETURNING id
                """,
                (
                    user_id, exam_id, payload.section_id,
                    json.dumps(payload.answers), json.dumps(summary["review"]), json.dumps(summary["perSection"]),
                    summary["correct"], summary["total"],
                    payload.started_at / 1000, payload.finished_at / 1000,
                ),
            )
            attempt_id = cur.fetchone()[0]
        conn.commit()
    finally:
        conn.close()

    return {"attemptId": attempt_id, "examId": exam_id, **summary}


@router.get("/api/exams/{exam_id}/attempts/{attempt_id}")
def get_attempt(exam_id: str, attempt_id: int, user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT section_id, answers, review, per_section, correct, total
                FROM exam_attempts
                WHERE id = %s AND user_id = %s AND exam_id = %s
                """,
                (attempt_id, user_id, exam_id),
            )
            row = cur.fetchone()
    finally:
        conn.close()

    if row is None:
        raise HTTPException(status_code=404, detail="Unknown attempt")

    section_id, answers, review, per_section, correct, total = row
    return {
        "attemptId": attempt_id,
        "examId": exam_id,
        "sectionId": section_id,
        "answers": answers,
        "review": review,
        "perSection": per_section,
        "correct": correct,
        "total": total,
    }
