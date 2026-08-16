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
from study.exam_blueprint import LEVEL_BLUEPRINT
from study.exam_gen_utils import GenerationFailed
from study.exam_vocab_gen import generate_vocabulary_paper
from study.exam_reading_gen import generate_reading_paper
from study.exam_grammar_gen import generate_grammar_paper
from study.exam_listening_gen import generate_listening_paper

router = APIRouter()
logger = logging.getLogger(__name__)

_LEVELS = ["N5", "N4", "N3", "N2", "N1"]

# kind -> (title label, JP title label, blueprint mondai `type`s this
# generator builds). Single source of truth for both EXAM_GENERATORS
# below and list_exams()'s static estimate — must stay in sync with
# each generator's own title strings (exam_vocab_gen.py /
# exam_reading_gen.py / exam_grammar_gen.py's f"{level} ... Practice" /
# f"{level} ..." literals) since those are what actually gets served
# once a paper materializes; this is only the pre-materialization guess.
_KIND_META = {
    "vocab": (
        "Vocabulary Practice", "語彙",
        {"kanji-reading", "kanji-orthography", "vocab-context", "vocab-paraphrase", "vocab-usage"},
    ),
    "reading": ("Reading Practice", "読解", {"reading-passage"}),
    "grammar": ("Grammar Practice", "文法", {"grammar-fill", "sentence-order", "cloze-passage"}),
    # Only "listening-mcq" (課題理解/ポイント理解) is actually generated
    # today -- 発話表現/即時応答/概要理解/統合理解 are still skipped by
    # exam_listening_gen.py (see its own module docstring), so counting
    # them here would make the pre-materialization estimate promise more
    # items than a real generation attempt can currently deliver. Widen
    # this set as each of those ships its own generator.
    "listening": ("Listening Practice", "聴解", {"listening-mcq"}),
}

# id -> (generator_version, kind, level, callable(seed) -> paper).
# generator_version is stored per row in exam_papers — nothing reads it
# back yet, but a future migration can use it to find and regenerate
# papers made by an older version of a given generator instead of
# silently serving them forever. kind/level are needed by list_exams()
# to describe a not-yet-materialized exam without generating it.
EXAM_GENERATORS = {
    STUB_EXAM_ID: ("stub-1", "stub", "N5", lambda seed: STUB_PAPER),
    **{
        # "-vocab-01", not "-kanji-01": this generator now covers the
        # whole vocabulary section (漢字読み/表記/文脈規定/言い換え類義/
        # 用法 where each has a generator), not kanji items alone — see
        # exam_vocab_gen.py. Renamed rather than kept for continuity
        # since nothing has shipped to real users under the old id yet.
        f"{level.lower()}-vocab-01": ("vocab-gen-1", "vocab", level, partial(generate_vocabulary_paper, level))
        for level in _LEVELS
    },
    **{
        # A separate paper from "-vocab-01" at every level, including
        # N1/N2 where the real exam presents vocab/grammar/reading in
        # one booklet — accepted simplification, see
        # exam_reading_gen.py's module docstring.
        f"{level.lower()}-reading-01": ("reading-gen-1", "reading", level, partial(generate_reading_paper, level))
        for level in _LEVELS
    },
    **{
        # Same accepted simplification as "-reading-01": its own paper
        # at every level rather than merged into the real exam's
        # combined booklet at N1/N2.
        f"{level.lower()}-grammar-01": ("grammar-gen-1", "grammar", level, partial(generate_grammar_paper, level))
        for level in _LEVELS
    },
    **{
        # Same accepted simplification as "-reading-01"/"-grammar-01".
        # Needs OPENROUTER_API_KEY (dialogue text) -- audio synthesis
        # itself needs no credential at all, see exam_tts.py.
        f"{level.lower()}-listening-01": ("listening-gen-1", "listening", level, partial(generate_listening_paper, level))
        for level in _LEVELS
    },
}

ensure_exam_schema()


def _expected_question_count(level: str, kind: str) -> int:
    """Target item count for a not-yet-materialized paper, straight from
    the (static, free) blueprint -- an estimate, since a generator can
    end up shipping fewer items than the target if a mondai fails every
    retry (see each exam_*_gen.py's own skip-on-GenerationFailed logic),
    but close enough for a catalog listing and requires no LLM call."""
    types = _KIND_META[kind][2]
    return sum(
        m["count"]
        for section in LEVEL_BLUEPRINT[level]["sections"]
        for m in section["mondai"]
        if m["type"] in types
    )


def _get_cached_paper(exam_id: str) -> dict | None:
    """Read-only: returns the already-materialized paper for exam_id, or
    None if it hasn't been generated yet. Never generates -- list_exams()
    uses this instead of _get_or_create_paper() specifically so browsing
    the catalog can't trigger full LLM generation of every registered
    exam (up to 15 LLM-dependent papers, each several slow calls) inside
    one HTTP request. See list_exams()'s own comment for how the
    original plan already called this out: "static catalog, no
    materialization needed to list.\""""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT paper FROM exam_papers WHERE exam_id = %s", (exam_id,))
            row = cur.fetchone()
            return row[0] if row else None
    finally:
        conn.close()


def _seed_for(exam_id: str) -> int:
    # Deterministic from the id alone, so the id is the whole
    # reproducibility key — no seed needs to be passed around or
    # stored anywhere else to regenerate/verify a paper later.
    return int(hashlib.sha256(exam_id.encode()).hexdigest(), 16) % (2**63)


def _get_or_create_paper(exam_id: str) -> dict | None:
    """None means the id isn't registered at all (-> 404 upstream).
    Raises GenerationFailed if the id IS registered but generation
    currently can't produce a valid paper (e.g. an LLM-dependent
    generator with no API key configured) — deliberately NOT converted
    to an HTTPException here, since list_exams and get_exam need to
    react to that differently (see their own call sites): one missing
    exam shouldn't 503 the whole catalog listing."""
    entry = EXAM_GENERATORS.get(exam_id)
    if entry is None:
        return None
    generator_version, _kind, _level, generate = entry

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT paper FROM exam_papers WHERE exam_id = %s", (exam_id,))
            row = cur.fetchone()
            if row:
                return row[0]

            seed = _seed_for(exam_id)
            paper = generate(seed)  # GenerationFailed propagates to the caller

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
    # Static catalog, not a materialization trigger -- per the original
    # plan ("GET /api/exams -- static catalog, no materialization needed
    # to list"). This used to call _get_or_create_paper() for every
    # registered id, which meant the FIRST catalog request after a fresh
    # deploy synchronously generated all ~15 LLM-dependent papers (each
    # several slow model calls) before returning anything -- live-
    # diagnosed 2026-08 when a single GET /api/exams call hung for
    # minutes. Already-materialized papers still report their real,
    # exact counts; anything not yet generated reports the blueprint's
    # target counts instead, and generation only actually happens when a
    # user opens that specific exam (GET /api/exams/{exam_id} below).
    out = []
    for exam_id, (_generator_version, kind, level, generate) in EXAM_GENERATORS.items():
        if kind == "stub":
            # Free/instant/no LLM -- fine to materialize (and cache) at
            # list time same as before, no reason to special-case it away.
            paper = _get_or_create_paper(exam_id)
            out.append({
                "id": exam_id,
                "level": paper["level"],
                "title": paper["title"],
                "titleJp": paper["titleJp"],
                "sectionCount": len(paper["sections"]),
                "questionCount": len(flatten_questions(paper)),
            })
            continue

        paper = _get_cached_paper(exam_id)
        if paper is not None:
            out.append({
                "id": exam_id,
                "level": paper["level"],
                "title": paper["title"],
                "titleJp": paper["titleJp"],
                "sectionCount": len(paper["sections"]),
                "questionCount": len(flatten_questions(paper)),
            })
            continue

        label, label_jp, _types = _KIND_META[kind]
        out.append({
            "id": exam_id,
            "level": level,
            "title": f"{level} {label}",
            "titleJp": f"{level} {label_jp}",
            "sectionCount": 1,
            "questionCount": _expected_question_count(level, kind),
        })
    return out


@router.get("/api/exams/{exam_id}")
def get_exam(exam_id: str, user_id: str = Depends(get_user_id)):
    try:
        paper = _get_or_create_paper(exam_id)
    except GenerationFailed as e:
        logger.error("Exam generation failed for %s: %s", exam_id, e)
        raise HTTPException(status_code=503, detail=f"Could not generate exam: {exam_id}")
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
    try:
        paper = _get_or_create_paper(exam_id)
    except GenerationFailed as e:
        logger.error("Exam generation failed for %s: %s", exam_id, e)
        raise HTTPException(status_code=503, detail=f"Could not generate exam: {exam_id}")
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
