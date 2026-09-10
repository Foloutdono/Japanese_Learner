"""
書取 — the dictation platform's API.

Three endpoints and one rule between them: the learner never receives
the sentence before they have written theirs down.

    GET  /api/dictation/batch   the clips to play — audio, and nothing else
    POST /api/dictation/check   the answer, graded; the sentence comes back here
    GET  /api/dictation/history what this learner has transcribed

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
#   accuracy  how close the transcription was, 0..100. The other modes
#             self-assess with the rating bar and store a `quality`;
#             this one is machine-graded, so what is worth keeping is
#             the measurement rather than an opinion. `correct` is
#             derived from it (study/dictation.CLOSE) and kept because
#             every existing reader of a practice log understands that
#             column and nothing understands accuracy yet.
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
                    plays SMALLINT NOT NULL DEFAULT 0,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
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


# ── The answer ───────────────────────────────────────────────────────
class CheckPayload(BaseModel):
    clip_id: str = Field(min_length=1, max_length=64)
    # Empty is a legitimate answer: it is a learner saying they caught
    # nothing, and it scores 0 rather than being rejected.
    answer: str = Field(default="", max_length=400)
    plays: int = Field(default=0, ge=0, le=99)


@router.post("/api/dictation/check")
def check_dictation(payload: CheckPayload, user_id: str = Depends(get_user_id)):
    row = dictation.entry_for(payload.clip_id)
    if row is None:
        raise HTTPException(status_code=404, detail="unknown clip")

    result = dictation.grade(payload.answer, row)

    # Logged here rather than from a second call by the screen: the
    # grade is produced on this request and nowhere else, so a separate
    # /result endpoint would be the client handing the server back a
    # number the server just computed, and any failure of that second
    # call would drop the attempt silently.
    try:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO dictation_log
                        (user_id, level, clip_id, phrase, answer, correct, accuracy, plays)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        user_id, row.get("level", ""), payload.clip_id, row["jp"],
                        payload.answer.strip(), result["correct"], result["accuracy"],
                        payload.plays,
                    ),
                )
            conn.commit()
        finally:
            conn.close()
    except Exception:
        # A history row is worth less than the grade the learner is
        # waiting for. Reported, never raised.
        logger.exception("Could not log a dictation attempt for %s", payload.clip_id)

    return {
        "id": payload.clip_id,
        "level": row.get("level", ""),
        "jp": row["jp"],
        "kana": row["kana"],
        "translation": row["en"],
        # English regardless of the UI language, exactly as reading
        # practice reports its own: this app has no translation layer
        # for its sentence data, and the screen labels what it shows
        # rather than implying it is in the learner's language. See
        # routes/reading.py's get_reading_batch docstring.
        "translation_lang": "en",
        **result,
    }


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
                SELECT level, phrase, answer, correct, accuracy, plays, created_at
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
                "correct": correct, "accuracy": accuracy, "plays": plays,
                "created_at": created_at.isoformat(),
            }
            for level, phrase, answer, correct, accuracy, plays, created_at in rows
        ]
    }
