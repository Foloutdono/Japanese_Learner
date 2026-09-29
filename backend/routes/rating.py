"""評価 — the app asks, once, what the learner thinks of it (plan 167).

    GET  /api/rating/prompt   {"ask": bool} -- whether to open the sheet now
    POST /api/rating          the answer: stars 1-5 and a comment, or
                              stars null for "not now"

The sheet (frontend/src/components/rating/RatingSheet.jsx) is opened by
the client at a calm moment -- back in the chrome after a run -- but
WHETHER a learner is asked at all is decided here, so the rule is the
same on every device and a learner asked on the phone is not asked
again on the desk.

-- Who is asked --------------------------------------------------
Someone who has used the app enough to have an opinion of it, and
nobody twice:

  - MIN_REVIEWS reviews over the account's life and a review on
    MIN_DAYS different days -- a first evening's enthusiasm is not an
    opinion of an app you are meant to come back to;
  - never again once they have given a rating;
  - "not now" puts the question off for SNOOZE_DAYS, and after
    MAX_PUT_OFFS of them it is never asked again: a question refused
    three times has been answered.

-- What comes back to us ------------------------------------------
Every answer is a row of app_ratings: the stars, the comment the
learner chose to write (a rating under five asks what would have made
it five), the platform and the interface language. A five goes on to
the store's listing, which the client opens; the rest stay here, where
they can be acted on -- read them with `python -m scripts.app_ratings`.

The comment is text the learner typed, sent to us on purpose, which
is what this table is for and why it is not event_log (ADR 0012 keeps
typed text out of the trail, not out of a message addressed to us).
It is the learner's, so DELETE /api/account erases it and
scripts/purge_orphans.py collects it (routes/account.py's PLAN); the
privacy policy says it is kept.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from core.auth import get_user_id
from core.db import db_conn
from core.srs_instance import srs

router = APIRouter()
logger = logging.getLogger(__name__)

MIN_REVIEWS = 100
MIN_DAYS = 3
SNOOZE_DAYS = 30
MAX_PUT_OFFS = 3
# A comment is a paragraph, not an essay; the bound is what keeps one
# client in a loop from filling the table, like MAX_ROWS below.
MAX_COMMENT = 2000
# One rating and three put-offs is four rows; this is room for a
# double-send or two and no more.
MAX_ROWS = 10

PLATFORMS = ("ios", "android", "web")


def _ensure_schema() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS app_ratings (
                    id       BIGSERIAL PRIMARY KEY,
                    user_id  TEXT NOT NULL,
                    stars    SMALLINT,
                    comment  TEXT,
                    platform TEXT NOT NULL,
                    lang     TEXT,
                    at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_app_ratings_user ON app_ratings(user_id, at)"
            )
        conn.commit()
    finally:
        conn.close()


try:
    _ensure_schema()
except Exception:  # pragma: no cover - a missing DB must not stop import
    logger.exception("app_ratings schema could not be initialised")


# ── The rule, pure ────────────────────────────────────────────

def should_ask(*, rated: bool, put_offs: int, last_put_off: Optional[datetime],
               reviews: int, days: int, now: datetime) -> bool:
    """Whether this learner is asked now. The module docstring is the
    rule in words; this is the only place it is written in code."""
    if rated or put_offs >= MAX_PUT_OFFS:
        return False
    if reviews < MIN_REVIEWS or days < MIN_DAYS:
        return False
    if last_put_off is not None and now - last_put_off < timedelta(days=SNOOZE_DAYS):
        return False
    return True


def _history(cur, user_id: str) -> tuple[bool, int, Optional[datetime], int]:
    """(rated, put_offs, last_put_off, rows) for one learner."""
    cur.execute(
        """
        SELECT COALESCE(BOOL_OR(stars IS NOT NULL), FALSE),
               COUNT(*) FILTER (WHERE stars IS NULL),
               MAX(at) FILTER (WHERE stars IS NULL),
               COUNT(*)
        FROM app_ratings WHERE user_id = %s
        """,
        (user_id,),
    )
    rated, put_offs, last_put_off, rows = cur.fetchone()
    return bool(rated), int(put_offs), last_put_off, int(rows)


@router.get("/api/rating/prompt")
def rating_prompt(user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            rated, put_offs, last_put_off, _rows = _history(cur, user_id)
    finally:
        conn.close()
    # The cheap refusals first: most learners asking have answered.
    if rated or put_offs >= MAX_PUT_OFFS:
        return {"ask": False}
    ask = should_ask(
        rated=rated, put_offs=put_offs, last_put_off=last_put_off,
        reviews=srs.get_total_reviews(user_id),
        days=srs.count_studied_days(user_id),
        now=datetime.now(timezone.utc),
    )
    return {"ask": ask}


class RatingIn(BaseModel):
    # None is "not now": the sheet was closed before a star was given.
    stars: Optional[int] = Field(default=None, ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=MAX_COMMENT)
    platform: Literal["ios", "android", "web"]
    lang: Optional[Literal["fr", "en"]] = None

    @field_validator("comment")
    @classmethod
    def _blank_is_none(cls, v):
        if v is None:
            return None
        v = v.strip()
        return v or None


@router.post("/api/rating")
def post_rating(body: RatingIn, user_id: str = Depends(get_user_id)):
    if body.stars is None and body.comment is not None:
        raise HTTPException(status_code=422, detail="a comment comes with a rating")
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            # One learner's rows are written one at a time, so the checks
            # below cannot both pass for two requests sent together.
            cur.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (f"app_ratings:{user_id}",))
            rated, _put_offs, _last, rows = _history(cur, user_id)
            if rows >= MAX_ROWS:
                raise HTTPException(status_code=429, detail="too_many_answers")
            if rated:
                raise HTTPException(status_code=409, detail="already_rated")
            cur.execute(
                """
                INSERT INTO app_ratings (user_id, stars, comment, platform, lang)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (user_id, body.stars, body.comment, body.platform, body.lang),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    logger.info("app rating user_id=%s stars=%s platform=%s comment=%s",
                user_id, body.stars, body.platform, body.comment is not None)
    # A five goes on to the store; the client knows which one.
    return {"ok": True, "store": body.stars == 5}
