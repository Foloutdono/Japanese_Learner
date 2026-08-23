import hashlib
import json
import logging
import threading
from functools import partial

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from core.db import db_conn
from core.auth import get_user_id
from study.exam_schema import ensure_exam_schema
from study.exam_scoring import flatten_questions, score_attempt
from study.exam_blueprint import LEVEL_BLUEPRINT
from study.exam_gen_utils import GenerationFailed
from study.llm_shared import LLMUnavailable
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
#
# study/exam_stub.py's hand-written preview paper is deliberately NOT
# registered here anymore: it existed to prove the generation pipe end
# to end before any real generator existed ("once the real generator
# lands, this stops being registered" — its own module docstring), and
# with all four real generators shipped it was just a fifth, fake entry
# cluttering every learner's exam picker.
EXAM_GENERATORS = {
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
    None if it hasn't been generated yet. Never generates -- both
    list_exams() and submit_attempt() use this specifically so neither
    browsing the catalog nor scoring an attempt can trigger full LLM
    generation (up to 15 LLM-dependent papers, each several slow calls)
    inside one HTTP request. See list_exams()'s own comment for how the
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


# ── Background generation ────────────────────────────────────────
# Generating an LLM-backed paper takes minutes and dozens of model
# calls. It used to run synchronously inside the request handler, which
# meant the handler occupied one of the threadpool's limited worker
# slots AND held a Postgres connection open for the entire time, while
# the browser sat on a request that would very often time out before it
# finished. Now the request only ever claims (or reads) a job row and
# returns immediately; the generation runs on its own thread and writes
# the finished paper to exam_papers, which the client picks up by
# polling.
#
# A plain daemon thread rather than FastAPI's BackgroundTasks: those run
# after the response is sent but still inside the request's threadpool
# slot and lifecycle, so a client that disconnects mid-generation would
# take the generation with it -- exactly the case this needs to survive,
# since the whole point is that the work outlives the request.

# How long a failed generation is remembered before a retry is allowed
# to pay for another attempt.
_FAILED_COOLDOWN_SECONDS = 300
# Longer for a provider-level failure (no key, no reachable model, auth
# rejected): a content failure might genuinely come out differently on
# the next roll of the dice, but nothing about the account changes
# within five minutes, so retrying that quickly is pure waste.
_UNAVAILABLE_COOLDOWN_SECONDS = 900
# A 'running' row older than this is assumed abandoned -- the worker's
# process was restarted mid-generation. Without this, one restart at the
# wrong moment would wedge that exam id as permanently "generating".
_STALE_RUNNING_SECONDS = 900


def _mark_job_failed(exam_id: str, error: str, cooldown_seconds: int) -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE exam_generation_jobs
                   SET status = 'failed',
                       error = %s,
                       retry_after = NOW() + make_interval(secs => %s),
                       updated_at = NOW()
                 WHERE exam_id = %s
                """,
                (error[:2000], cooldown_seconds, exam_id),
            )
        conn.commit()
    finally:
        conn.close()


def _generation_worker(exam_id: str) -> None:
    """Runs off-request. Owns the job row from 'running' through to
    either deleted (success) or 'failed' (with a cooldown)."""
    generator_version, _kind, _level, generate = EXAM_GENERATORS[exam_id]
    seed = _seed_for(exam_id)
    try:
        # No DB connection is held across this call -- it is the slow
        # part, and an idle-in-transaction connection for its whole
        # duration was the other half of the old synchronous design's
        # cost.
        paper = generate(seed)
    except LLMUnavailable as e:
        logger.error("Exam generation for %s hit a provider failure: %s", exam_id, e)
        _mark_job_failed(exam_id, str(e), _UNAVAILABLE_COOLDOWN_SECONDS)
        return
    except GenerationFailed as e:
        logger.error("Exam generation failed for %s: %s", exam_id, e)
        _mark_job_failed(exam_id, str(e), _FAILED_COOLDOWN_SECONDS)
        return
    except Exception as e:  # pragma: no cover - defensive
        # Nothing else is going to catch this: an uncaught exception on
        # a worker thread would leave the job row 'running' until the
        # stale reaper picks it up, i.e. the screen spins for 15 minutes.
        logger.exception("Unexpected error generating %s", exam_id)
        _mark_job_failed(exam_id, f"unexpected error: {e}", _FAILED_COOLDOWN_SECONDS)
        return

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            # ON CONFLICT DO NOTHING preserves the invariant the old
            # synchronous path documented here: two workers can never
            # materialize two different papers for one id. The job-row
            # claim below should already make that impossible; this is
            # the cheap belt to that braces.
            cur.execute(
                """
                INSERT INTO exam_papers
                    (exam_id, level, seed, generator_version, paper, section_count, question_count)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (exam_id) DO NOTHING
                """,
                (
                    exam_id, paper["level"], seed, generator_version,
                    json.dumps(paper), len(paper["sections"]), len(flatten_questions(paper)),
                ),
            )
            # The paper row IS the success record, so the job row's work
            # is done -- see exam_schema.py's note on why there is no
            # 'done' status.
            cur.execute("DELETE FROM exam_generation_jobs WHERE exam_id = %s", (exam_id,))
        conn.commit()
        logger.info("Exam %s generated and materialized", exam_id)
    finally:
        conn.close()


def _claim_generation(exam_id: str) -> tuple[str, dict | None]:
    """Decides, in one transaction, what should happen for an exam id
    with no materialized paper. Returns (outcome, detail):

      'claimed'   -- this caller won the right to generate; spawn a worker
      'running'   -- someone else is already generating it
      'cooldown'  -- the last attempt failed recently; detail says why

    The INSERT ... ON CONFLICT DO NOTHING is the lock: whichever caller
    comes back with rowcount 1 is the only one that generates. This is
    what makes the retry button, a refresh, and a second tab cost
    nothing instead of each starting their own full cascade."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO exam_generation_jobs (exam_id, status)
                VALUES (%s, 'running')
                ON CONFLICT (exam_id) DO NOTHING
                """,
                (exam_id,),
            )
            if cur.rowcount == 1:
                conn.commit()
                return "claimed", None

            cur.execute(
                """
                SELECT status,
                       error,
                       GREATEST(0, EXTRACT(EPOCH FROM (retry_after - NOW())))::int,
                       updated_at < NOW() - make_interval(secs => %s)
                  FROM exam_generation_jobs
                 WHERE exam_id = %s
                 FOR UPDATE
                """,
                (_STALE_RUNNING_SECONDS, exam_id),
            )
            row = cur.fetchone()
            if row is None:
                # The row was deleted between the INSERT and this SELECT
                # -- a worker finished successfully just now. Report it
                # as running; the caller reads the real paper on its next
                # poll.
                conn.commit()
                return "running", None

            status, error, retry_after, is_stale = row
            reclaimable = (
                (status == "failed" and retry_after <= 0)
                or (status == "running" and is_stale)
            )
            if reclaimable:
                cur.execute(
                    """
                    UPDATE exam_generation_jobs
                       SET status = 'running', error = NULL, retry_after = NULL,
                           started_at = NOW(), updated_at = NOW()
                     WHERE exam_id = %s
                    """,
                    (exam_id,),
                )
                conn.commit()
                return "claimed", None

            conn.commit()
            if status == "failed":
                return "cooldown", {"error": error, "retryAfter": retry_after}
            return "running", None
    finally:
        conn.close()


def _start_generation(exam_id: str) -> None:
    threading.Thread(
        target=_generation_worker, args=(exam_id,),
        name=f"exam-gen:{exam_id}", daemon=True,
    ).start()


@router.get("/api/exams")
def list_exams(user_id: str = Depends(get_user_id)):
    # Static catalog, not a materialization trigger -- per the original
    # plan ("GET /api/exams -- static catalog, no materialization needed
    # to list"). This used to generate on demand for every registered
    # id, which meant the FIRST catalog request after a fresh
    # deploy synchronously generated all ~15 LLM-dependent papers (each
    # several slow model calls) before returning anything -- live-
    # diagnosed 2026-08 when a single GET /api/exams call hung for
    # minutes. Already-materialized papers still report their real,
    # exact counts; anything not yet generated reports the blueprint's
    # target counts instead, and generation only actually happens when a
    # user opens that specific exam (GET /api/exams/{exam_id} below).
    out = []
    for exam_id, (_generator_version, kind, level, _generate) in EXAM_GENERATORS.items():
        label, label_jp, _types = _KIND_META[kind]
        paper = _get_cached_paper(exam_id)
        if paper is not None:
            entry = {
                "level": paper["level"],
                "title": paper["title"],
                "titleJp": paper["titleJp"],
                "questionCount": len(flatten_questions(paper)),
                "generated": True,
            }
        else:
            entry = {
                "level": level,
                "title": f"{level} {label}",
                "titleJp": f"{level} {label_jp}",
                "questionCount": _expected_question_count(level, kind),
                # False means "opening this will generate it", which is
                # slow (minutes, for the LLM-backed kinds) -- the picker
                # screen warns before the learner commits to waiting
                # rather than dropping them on a silent spinner.
                "generated": False,
            }
        # `kind` travels explicitly so the client can group/label by it
        # without parsing exam_id -- the "{level}-{kind}-01" id scheme is
        # this module's business, not the frontend's.
        out.append({"id": exam_id, "kind": kind, **entry})
    return out


@router.get("/api/exams/{exam_id}")
def get_exam(exam_id: str, user_id: str = Depends(get_user_id)):
    """200 + the paper once it exists; 202 while it is being generated;
    503 for a short cooldown after a failed attempt. The client polls
    this (see frontend/src/screens/ExamRunner.jsx) rather than holding
    one request open for the minutes a generation takes."""
    if exam_id not in EXAM_GENERATORS:
        raise HTTPException(status_code=404, detail=f"Unknown exam id: {exam_id}")

    paper = _get_cached_paper(exam_id)
    if paper is not None:
        return paper

    outcome, detail = _claim_generation(exam_id)
    if outcome == "claimed":
        _start_generation(exam_id)
    if outcome == "cooldown":
        # The error text is the generator's own, safe to show: it names
        # what could not be produced, not anything about the account.
        return JSONResponse(
            status_code=503,
            content={
                "status": "failed",
                "examId": exam_id,
                "error": detail["error"],
                "retryAfter": detail["retryAfter"],
            },
            headers={"Retry-After": str(detail["retryAfter"])},
        )
    return JSONResponse(status_code=202, content={"status": "generating", "examId": exam_id})


class SubmitAttemptPayload(BaseModel):
    section_id: str
    answers: dict[str, str]
    started_at: int   # epoch ms, matches Date.now() on the client
    finished_at: int


@router.post("/api/exams/{exam_id}/attempts")
def submit_attempt(exam_id: str, payload: SubmitAttemptPayload, user_id: str = Depends(get_user_id)):
    if exam_id not in EXAM_GENERATORS:
        raise HTTPException(status_code=404, detail=f"Unknown exam id: {exam_id}")

    # Reads, never generates. A learner cannot have just taken a paper
    # that was never materialized, so arriving here with no row means the
    # paper was deleted (or this is a stray request) -- and triggering a
    # multi-minute generation to score answers that could not have come
    # from it would both block the submit and score against different
    # content than the learner saw.
    paper = _get_cached_paper(exam_id)
    if paper is None:
        raise HTTPException(
            status_code=409,
            detail=f"Exam {exam_id} has not been generated; cannot score an attempt against it.",
        )

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
