"""
書取 — the dictation platform's API.

Four endpoints and one rule between them: the learner never receives
the sentence before they have written theirs down.

    GET  /api/dictation/batch   the clips to play — audio, and nothing else
    POST /api/dictation/check   the sentence, revealed, with a measure of
                                how close the learner's own came
    POST /api/dictation/result  the grade the learner gave themselves
    GET  /api/dictation/history what this learner has transcribed

check and result are two calls rather than one because they answer to
two different people. The measurement is the server's and arrives with
the reveal; the GRADE is the learner's, and it does not exist until they
have read the sentence and pressed a segment on the rating bar. Folding
them together would mean either logging a row before the learner has
graded it, or holding the reveal back until they had — and the reveal is
the thing they are waiting for. Reading and translation practice split
the same way, for the same reason.

That split is the whole reason the batch response is so thin. Every
other sentence mode in this app ships the answer with the question and
lets the screen decide when to reveal it — reading practice ships the
romaji, translation ships the reference — because in those modes the
prompt IS the sentence and there is nothing to hide. Here the prompt is
audio, so the text is the answer: shipping it would put the whole
exercise one devtools panel away, and the mode would be a listening
mode only for learners who chose not to look.
"""
import logging
import random

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.auth import get_user_id
from core.credits import require_pass
from core.db import db_conn
from study import dictation

# A pass feature, like the other practice platforms (plan 069): every
# route here refuses a free learner with 402 pass_required once
# CREDITS_ENFORCE=1, and is a no-op until then.
router = APIRouter(dependencies=[Depends(require_pass)])
logger = logging.getLogger(__name__)

DEFAULT_BATCH = 5
MAX_BATCH = 20


# ── Table setup ──────────────────────────────────────────────────────
#
# Self-migrating at import, the pattern routes/translation.py established
# for a new mode's own table (no migration tooling exists here; see
# srs/srs.py's own schema management for the precedent). Declared in
# srs/data_structure.sql too, which tests/test_schema_declared.py
# enforces, and classified in routes/account.py's PLAN, which
# tests/test_account.py enforces.
#
# Shaped like the other practice logs (user/level/answer/correct/
# created_at) with the two columns this mode has that they do not:
#
#   accuracy  how close the transcription was, 0..100 — the server's
#             measurement, kept BESIDE the learner's own rating rather
#             than instead of it. The two are different facts and must
#             never be merged: one is measured, the other is an opinion,
#             and the interesting question over a month is where they
#             disagree. `quality` is the rating, 0..5 worst-to-best
#             exactly as RatingBar emits it, and `correct` is derived
#             from it (q > 2 is a pass) the way every other practice log
#             derives it.
#   plays     how many times the clip was heard, as the player reports
#             it. The mode's rule is two; a row saying 2 is a learner
#             who used their second listen, not a rule violation, and
#             the interesting figure over a month is how often they
#             needed it.
#
# clip_id is the content key of the audio (study/dictation.clip_id), so
# a row keeps pointing at the same line even if the bank is reordered,
# and stops resolving — rather than silently pointing at a DIFFERENT
# line — if that line is ever reworded. `phrase` is stored beside it
# anyway, so the history stays readable with no lookup at all.
def _init_db() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS dictation_log (
                    id BIGSERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    level TEXT NOT NULL DEFAULT '',
                    clip_id TEXT NOT NULL,
                    phrase TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    correct BOOLEAN NOT NULL,
                    accuracy SMALLINT NOT NULL,
                    quality SMALLINT,
                    plays SMALLINT NOT NULL DEFAULT 0,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            # For an install whose table predates the learner grading
            # their own answer: the create above only fires when the
            # table is absent, so it never revisits one that exists.
            # Same pattern as translation.py's own `quality`.
            #
            # NULLable on purpose. A row written while the server was
            # the grader genuinely has no rating, and a default would
            # invent one; a reader has to treat NULL as "graded by the
            # machine alone", not as a score of zero.
            cur.execute(
                "ALTER TABLE dictation_log ADD COLUMN IF NOT EXISTS quality SMALLINT"
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_dictation_log_user
                ON dictation_log(user_id, created_at)
                """
            )
        conn.commit()
    finally:
        conn.close()


_init_db()


# ── The clips ────────────────────────────────────────────────────────
@router.get("/api/dictation/batch")
def get_dictation_batch(
    level: str = Query(..., description="N5..N1"),
    count: int = Query(DEFAULT_BATCH, ge=1, le=MAX_BATCH),
    # Clip ids this session has already played, "|"-separated. The bank
    # is finite (18-20 lines a level), so without this a sitting hears
    # the same line three times; with it, the picker works through the
    # level before it repeats. Same arrangement, and the same separator,
    # as reading practice's `exclude`.
    exclude: str = "",
    user_id: str = Depends(get_user_id),
):
    if level not in dictation.LEVELS:
        raise HTTPException(status_code=400, detail="unknown level")

    heard = {part for part in exclude.split("|") if part}
    rows = dictation.pick(level, count, heard)

    clips = []
    for row in rows:
        # Synthesized here if the file is not on disk, which after
        # scripts/build_dictation_audio.py has run it always is. This is
        # the repair path, not the normal one -- see study/dictation's
        # ensure_clip -- and a line whose audio cannot be made is DROPPED
        # rather than served silent: a dictation with no clip is not a
        # harder exercise, it is an impossible one.
        url = dictation.ensure_clip(row["jp"])
        if not url:
            continue
        clips.append({"id": dictation.clip_id(row["jp"]), "level": level, "audioSrc": url})

    if not clips:
        # Every line in the level failed to synthesize: the service is
        # down or the audio directory is unwritable. 503 rather than an
        # empty list, because the screen's answer to the two is
        # different -- "try again later" versus "you have finished the
        # bank", and the second would be a lie.
        raise HTTPException(status_code=503, detail="listening audio unavailable")

    return {"level": level, "max_plays": dictation.MAX_PLAYS, "clips": clips}


# ── The reveal ───────────────────────────────────────────────────────
class CheckPayload(BaseModel):
    clip_id: str = Field(min_length=1, max_length=64)
    # Empty is a legitimate answer: it is a learner saying they caught
    # nothing, and it measures 0 rather than being rejected.
    answer: str = Field(default="", max_length=400)


@router.post("/api/dictation/check")
def check_dictation(payload: CheckPayload, user_id: str = Depends(get_user_id)):
    """The sentence, revealed, plus how close the learner's own came.

    Writes nothing: the row is written by /result, once the learner has
    read this and graded themselves. So a learner who abandons the run
    here leaves no half-graded attempt behind."""
    row = dictation.entry_for(payload.clip_id)
    if row is None:
        raise HTTPException(status_code=404, detail="unknown clip")

    return {
        "id": payload.clip_id,
        "level": row.get("level", ""),
        **dictation.reveal(row),
        **dictation.measure(payload.answer, row),
    }


# ── The grade, which is the learner's ────────────────────────────────
class ResultPayload(BaseModel):
    clip_id: str = Field(min_length=1, max_length=64)
    answer: str = Field(default="", max_length=400)
    # 0..5 worst-to-best, exactly as RatingBar emits it.
    quality: int = Field(ge=0, le=5)
    accuracy: int = Field(default=0, ge=0, le=100)
    plays: int = Field(default=0, ge=0, le=99)


@router.post("/api/dictation/result")
def post_dictation_result(payload: ResultPayload, user_id: str = Depends(get_user_id)):
    """One row per graded attempt.

    `accuracy` comes back from the client rather than being recomputed:
    it is the figure the learner was actually looking at when they
    rated, which is the only version of it worth keeping beside the
    rating. Recomputing would silently rewrite history the day the fold
    in study/romaji.py changes. It is bounded 0..100 by the model above,
    so a client cannot store anything a reader would have to defend
    against."""
    row = dictation.entry_for(payload.clip_id)
    if row is None:
        raise HTTPException(status_code=404, detail="unknown clip")

    # q > 2 is a pass — the same line RatingBar itself draws between
    # playCorrect and playWrong, and the same one reading and
    # translation practice record.
    correct = payload.quality > 2
    try:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO dictation_log
                        (user_id, level, clip_id, phrase, answer,
                         correct, accuracy, quality, plays)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        user_id, row.get("level", ""), payload.clip_id, row["jp"],
                        payload.answer.strip(), correct, payload.accuracy,
                        payload.quality, payload.plays,
                    ),
                )
            conn.commit()
        finally:
            conn.close()
    except Exception:
        # A history row is worth less than the run the learner is in the
        # middle of. Reported, never raised — the screen has already
        # moved on to the next clip.
        logger.exception("Could not log a dictation attempt for %s", payload.clip_id)

    return {"correct": correct}


# ── The history ──────────────────────────────────────────────────────
@router.get("/api/dictation/history")
def dictation_history(
    limit: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_user_id),
):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT level, phrase, answer, correct, accuracy, quality, plays, created_at
                FROM dictation_log
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (user_id, limit),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    return {
        "entries": [
            {
                "level": level, "phrase": phrase, "answer": answer,
                "correct": correct, "accuracy": accuracy, "quality": quality,
                "plays": plays, "created_at": created_at.isoformat(),
            }
            for level, phrase, answer, correct, accuracy, quality, plays, created_at in rows
        ]
    }
