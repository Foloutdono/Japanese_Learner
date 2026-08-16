import hashlib
import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.db import db_conn
from core.auth import get_user_id
from study.exam_schema import ensure_exam_schema
from study.exam_scoring import flatten_questions, score_attempt
from study.exam_stub import STUB_EXAM_ID, STUB_PAPER

router = APIRouter()
logger = logging.getLogger(__name__)

# Bumped whenever a change to the generator (or, today, the stub
# paper) means an exam_id already in exam_papers should be treated as
# stale — nothing currently reads this, but it's stored per-row now so
# a future migration can find and regenerate outdated papers instead
# of silently serving them forever.
GENERATOR_VERSION = "stub-1"

# Static catalog. Keyed exactly like the old frontend LOCAL_EXAMS
# registry was, so examService.js's contract doesn't change shape.
# Phase 2 replaces this with real generated papers dispatched from
# backend/study/exam_blueprint.py's per-level spec — EXAM_SOURCES
# becomes a function of (level, variant) rather than a fixed dict.
EXAM_SOURCES = {
    STUB_EXAM_ID: STUB_PAPER,
}

ensure_exam_schema()


def _seed_for(exam_id: str) -> int:
    # Deterministic from the id alone, so the id is the whole
    # reproducibility key — no seed needs to be passed around or
    # stored anywhere else to regenerate/verify a paper later.
    return int(hashlib.sha256(exam_id.encode()).hexdigest(), 16) % (2**63)


def _get_or_create_paper(exam_id: str) -> dict | None:
    source = EXAM_SOURCES.get(exam_id)
    if source is None:
        return None

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT paper FROM exam_papers WHERE exam_id = %s", (exam_id,))
            row = cur.fetchone()
            if row:
                return row[0]

            # INSERT ... ON CONFLICT DO NOTHING + re-SELECT: two
            # concurrent requests for the same never-before-seen
            # exam_id (ExamSectionSelect and ExamRunner both fetch on
            # mount) can never materialize two different papers — the
            # loser of the race just reads back the winner's row.
            question_count = len(flatten_questions(source))
            cur.execute(
                """
                INSERT INTO exam_papers
                    (exam_id, level, seed, generator_version, paper, section_count, question_count)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (exam_id) DO NOTHING
                """,
                (
                    exam_id, source["level"], _seed_for(exam_id), GENERATOR_VERSION,
                    json.dumps(source), len(source["sections"]), question_count,
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
    return [
        {
            "id": exam_id,
            "level": source["level"],
            "title": source["title"],
            "titleJp": source["titleJp"],
            "sectionCount": len(source["sections"]),
            "questionCount": len(flatten_questions(source)),
        }
        for exam_id, source in EXAM_SOURCES.items()
    ]


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
