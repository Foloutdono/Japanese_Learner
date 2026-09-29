"""評価 — asking a learner what they think of the app (plan 167).

    GET  /api/rating/prompt?platform=  {"ask": bool, "how": "store"|"sheet"}
    POST /api/rating                   the answer to the web's sheet, or
                                       the note that the store's prompt
                                       was requested
    POST /api/feedback                 a message to us, from Settings

The client picks the calm moment -- back in the chrome after a run --
but WHETHER a learner is asked, and how, is decided here, so the rule
is the same on every device.

-- How: the stores' rules decide it ------------------------------
In the iOS and Android apps the question is the platform's own review
prompt (SKStoreReviewController, Play's In-App Review), requested with
nothing before it. Both stores require exactly that: Apple's App Review
Guideline 5.6.1 disallows custom review prompts, and Play's in-app
review guidelines forbid asking anything -- "do you like the app?", a
star rating -- before the card, which rules out sending only the happy
learners on to the store. The OS decides whether the prompt shows (Apple
three times a year at most, Play by its own quota) and never says what
was answered, so all this module records is that it was requested
(`store_prompt`), to space the requests out.

On the web there is no store and no rule of that kind: the app's own
sheet asks for one to five stars, and a rating under five asks what
would have made it five. Every answer stays here.

And anyone, on any platform, can write to us at any time from
Settings › Help (POST /api/feedback) -- the way an app learner reaches
us, since the store's prompt carries nothing back.

-- Who is asked -------------------------------------------------
Someone who has used the app enough to have an opinion of it:
MIN_REVIEWS reviews over the account's life on MIN_DAYS different days.

  store  never more than MAX_STORE_PROMPTS requests, STORE_EVERY_DAYS
         apart.
  sheet  never again once rated; "not now" puts it off SNOOZE_DAYS,
         and MAX_PUT_OFFS of those are a no.

-- What comes back to us ------------------------------------------
Rows of app_ratings, by `kind`: 'rating' (stars, and the comment a
rating under five asks for), 'put_off', 'store_prompt' and 'feedback'
(a comment). Read them with `python -m scripts.app_ratings`. A comment
is text the learner typed and sent to us on purpose, which is what this
table is for and why it is not event_log (ADR 0012 keeps typed text out
of the trail, not out of a message addressed to us). It is the
learner's, so DELETE /api/account erases it and scripts/purge_orphans.py
collects it (routes/account.py's PLAN); the privacy policy says so.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from core.auth import get_user_id
from core.db import db_conn
from core.srs_instance import srs

router = APIRouter()
logger = logging.getLogger(__name__)

MIN_REVIEWS = 100
MIN_DAYS = 3
# The web's sheet.
SNOOZE_DAYS = 30
MAX_PUT_OFFS = 3
# The stores' prompts. Apple shows at most three a year whatever is
# asked; asking less often than that keeps each request a real chance.
STORE_EVERY_DAYS = 120
MAX_STORE_PROMPTS = 3
# A comment is a paragraph, not an essay.
MAX_COMMENT = 2000
# One rating, three put-offs and three store prompts is seven rows; this
# is room for a double-send or two and no more.
MAX_ROWS = 10
# Feedback can be sent at any time; this many a day keeps one client in
# a loop from filling the table.
FEEDBACK_PER_DAY = 5

Platform = Literal["ios", "android", "web"]
NATIVE = ("ios", "android")


def _ensure_schema() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS app_ratings (
                    id       BIGSERIAL PRIMARY KEY,
                    user_id  TEXT NOT NULL,
                    kind     TEXT NOT NULL,
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

def used_enough(reviews: int, days: int) -> bool:
    return reviews >= MIN_REVIEWS and days >= MIN_DAYS


def should_ask_store(*, prompts: int, last_prompt: Optional[datetime], now: datetime) -> bool:
    """A store's own prompt may be requested again (usage aside)."""
    if prompts >= MAX_STORE_PROMPTS:
        return False
    return last_prompt is None or now - last_prompt >= timedelta(days=STORE_EVERY_DAYS)


def should_ask_sheet(*, rated: bool, put_offs: int, last_put_off: Optional[datetime],
                     now: datetime) -> bool:
    """The web's sheet may open (usage aside)."""
    if rated or put_offs >= MAX_PUT_OFFS:
        return False
    return last_put_off is None or now - last_put_off >= timedelta(days=SNOOZE_DAYS)


def _history(cur, user_id: str) -> dict:
    cur.execute(
        """
        SELECT kind, COUNT(*), MAX(at)
          FROM app_ratings WHERE user_id = %s
         GROUP BY kind
        """,
        (user_id,),
    )
    return {kind: (int(n), last) for kind, n, last in cur.fetchall()}


@router.get("/api/rating/prompt")
def rating_prompt(platform: Platform = Query("web"), user_id: str = Depends(get_user_id)):
    how = "store" if platform in NATIVE else "sheet"
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            seen = _history(cur, user_id)
    finally:
        conn.close()
    now = datetime.now(timezone.utc)
    if how == "store":
        prompts, last = seen.get("store_prompt", (0, None))
        open_ = should_ask_store(prompts=prompts, last_prompt=last, now=now)
    else:
        put_offs, last = seen.get("put_off", (0, None))
        open_ = should_ask_sheet(rated="rating" in seen, put_offs=put_offs,
                                 last_put_off=last, now=now)
    # The cheap refusals first: the usage figures are two queries over
    # the review history.
    ask = open_ and used_enough(srs.get_total_reviews(user_id), srs.count_studied_days(user_id))
    return {"ask": ask, "how": how}


def _clean(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v = v.strip()
    return v or None


class RatingIn(BaseModel):
    kind: Literal["rating", "put_off", "store_prompt"]
    stars: Optional[int] = Field(default=None, ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=MAX_COMMENT)
    platform: Platform
    lang: Optional[Literal["fr", "en"]] = None

    @field_validator("comment")
    @classmethod
    def _blank_is_none(cls, v):
        return _clean(v)


class FeedbackIn(BaseModel):
    comment: str = Field(max_length=MAX_COMMENT)
    platform: Platform
    lang: Optional[Literal["fr", "en"]] = None

    @field_validator("comment")
    @classmethod
    def _blank_is_none(cls, v):
        return _clean(v)


def _insert(user_id: str, kind: str, stars, comment, platform: str, lang, check) -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            # One learner's rows are written one at a time, so a check
            # below cannot pass for two requests sent together.
            cur.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (f"app_ratings:{user_id}",))
            check(cur)
            cur.execute(
                """
                INSERT INTO app_ratings (user_id, kind, stars, comment, platform, lang)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (user_id, kind, stars, comment, platform, lang),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@router.post("/api/rating")
def post_rating(body: RatingIn, user_id: str = Depends(get_user_id)):
    if body.kind == "rating" and body.stars is None:
        raise HTTPException(status_code=422, detail="a rating has stars")
    if body.kind != "rating" and (body.stars is not None or body.comment is not None):
        raise HTTPException(status_code=422, detail="only a rating carries stars or a comment")
    # The two ways of asking belong to their platforms: a store prompt
    # is the app's, the sheet the web's.
    if (body.kind == "store_prompt") != (body.platform in NATIVE):
        raise HTTPException(status_code=422, detail="not asked that way on this platform")

    def check(cur):
        cur.execute(
            """
            SELECT COUNT(*), COALESCE(BOOL_OR(kind = 'rating'), FALSE)
              FROM app_ratings WHERE user_id = %s AND kind <> 'feedback'
            """,
            (user_id,),
        )
        rows, rated = cur.fetchone()
        if rows >= MAX_ROWS:
            raise HTTPException(status_code=429, detail="too_many_answers")
        if body.kind == "rating" and rated:
            raise HTTPException(status_code=409, detail="already_rated")

    _insert(user_id, body.kind, body.stars, body.comment, body.platform, body.lang, check)
    logger.info("app rating user_id=%s kind=%s stars=%s platform=%s comment=%s",
                user_id, body.kind, body.stars, body.platform, body.comment is not None)
    return {"ok": True}


@router.post("/api/feedback")
def post_feedback(body: FeedbackIn, user_id: str = Depends(get_user_id)):
    if body.comment is None:
        raise HTTPException(status_code=422, detail="feedback has words")

    def check(cur):
        cur.execute(
            """
            SELECT COUNT(*) FROM app_ratings
             WHERE user_id = %s AND kind = 'feedback' AND at > NOW() - INTERVAL '1 day'
            """,
            (user_id,),
        )
        if cur.fetchone()[0] >= FEEDBACK_PER_DAY:
            raise HTTPException(status_code=429, detail="too_much_feedback")

    _insert(user_id, "feedback", None, body.comment, body.platform, body.lang, check)
    logger.info("app feedback user_id=%s platform=%s", user_id, body.platform)
    return {"ok": True}
