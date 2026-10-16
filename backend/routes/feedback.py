"""
POST /api/feedback — a learner writes to the people who make the app
(plan 222, the owner's pick A + B + C of the canvas "Tsuji — the
feedback door, new directions").

Three doors open the one sheet (frontend/src/components/feedback/):
Settings' "Nous écrire" row, the flag on an answered card and the link
under a failure. What each sends:

  kind     problem | idea | fault, or card for the card's own sheet
  text     the learner's words, at most TEXT_MAX characters
  reasons  a card's: what is wrong with it, from CARD_REASONS
  card_id  a card's: the unprefixed id, the content key the audit reads
  route    the screen, as the pattern App.jsx declared (never a path)
  area     a failure's: the API area that failed (`/api/today`), and
  status   its HTTP status
  platform, vp, os, lang
           the visit's coarse classes, session_start's own
  reply    the learner asked to be answered by e-mail

This is NOT the 足跡 (core/events.py, ADR 0012). The trail never holds
a word a learner typed; a message is nothing but that, so it has a
table of its own and is posted to its own route. The dashboards and
the weekly digest count it and never read it; its words are read by a
person, with scripts/read_feedback.py. The context beside the words is held to the trail's
closed classes and shapes all the same (events.VALUES, events.SHAPES):
a value that does not fit is dropped, never stored, so nothing but the
text itself can carry what a learner typed. The learner sees every
class before sending and can untick them; the client then sends none.

The address a reply goes to is read from the account here, at the
moment the learner asks for one, never taken from the request: a body
naming an address would let anyone have the app's owner write to a
stranger. A guest has none, and the sheet offers no reply.

Nothing is answered automatically and nothing is hidden: the rows are
a queue for a person (scripts/read_feedback.py), counted in Metabase
(docs/analytics/metabase/10-messages.sql) and in the weekly digest.
Erased with the account (routes/account.py).
"""
import logging
import re

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, StringConstraints
from typing import Annotated

from core import auth, events
from core.auth import get_user_id
from core.db import db_conn

router = APIRouter()
logger = logging.getLogger(__name__)

KINDS = ("problem", "idea", "fault", "card")
# What can be wrong with a card. Closed, as a deck's report is
# (routes/decks.REPORT_REASONS): the words beside them are optional.
CARD_REASONS = ("reading", "meaning", "audio", "example", "other")
# A message, not an essay. The sheet counts down to it (maxLength).
TEXT_MAX = 1000
# A day's messages per learner, a rolling 24 hours. Five is far past
# what anyone writes in earnest and well short of a flood (plan 211).
DAILY_MAX = 5
# A card id: printable, no separator a prefixed id would carry. The id
# is read by a person, never joined on, so it is held to a shape only.
CARD_ID_RE = re.compile(r"^[^\s:\x00-\x1f\x7f]{1,160}$")

_Short = Annotated[str, StringConstraints(max_length=16)]


def _ensure_schema() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS feedback (
                    id         BIGSERIAL PRIMARY KEY,
                    user_id    TEXT NOT NULL,
                    kind       TEXT NOT NULL,
                    body       TEXT NOT NULL DEFAULT '',
                    reasons    TEXT[] NOT NULL DEFAULT '{}',
                    card_id    TEXT,
                    route      TEXT,
                    area       TEXT,
                    status     SMALLINT,
                    platform   TEXT,
                    vp         TEXT,
                    os         TEXT,
                    lang       TEXT,
                    reply      BOOLEAN NOT NULL DEFAULT FALSE,
                    reply_to   TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute(
                "CREATE INDEX IF NOT EXISTS feedback_user_at ON feedback (user_id, created_at)"
            )
        conn.commit()
    finally:
        conn.close()


try:
    _ensure_schema()
except Exception:  # pragma: no cover - a missing DB must not stop import
    logger.exception("feedback schema could not be initialised")


class FeedbackPayload(BaseModel):
    kind: str = Field(max_length=16)
    text: str = Field(default="", max_length=TEXT_MAX)
    reasons: list[_Short] = Field(default_factory=list, max_length=len(CARD_REASONS))
    card_id: str | None = Field(default=None, max_length=160)
    route: str | None = Field(default=None, max_length=64)
    area: str | None = Field(default=None, max_length=40)
    status: int | None = Field(default=None, ge=0, le=599)
    platform: _Short | None = None
    vp: _Short | None = None
    os: _Short | None = None
    lang: _Short | None = None
    reply: bool = False


def _refuse(status: int, code: str, message: str):
    # A code the sheet maps to its own words (lib/api.js, ApiError.code);
    # the message is for the logs.
    raise HTTPException(status_code=status, detail={"code": code, "message": message})


def _shape(key: str, value: str | None) -> str | None:
    return value if value and events.SHAPES[key].match(value) else None


def _visit(key: str, value: str | None) -> str | None:
    return value if value in events.VALUES["session_start"][key] else None


def _reply_address(user_id: str) -> str | None:
    """The account's own address, from Supabase, or None: a guest, the
    DEV_USER_ID bypass, or the auth service not answering. A message
    whose address could not be read is still kept, with `reply` set, so
    the owner can find it from the user id."""
    if auth.DEV_USER_ID or not (auth.SUPABASE_URL and auth.SUPABASE_SERVICE_KEY):
        return None
    try:
        r = httpx.get(
            f"{auth.SUPABASE_URL}/auth/v1/admin/users/{user_id}",
            headers={
                "Authorization": f"Bearer {auth.SUPABASE_SERVICE_KEY}",
                "apikey": auth.SUPABASE_SERVICE_KEY,
            },
            timeout=httpx.Timeout(5.0, connect=2.0),
        )
    except httpx.RequestError:
        logger.warning("feedback: the account's address could not be read", exc_info=True)
        return None
    if r.status_code != 200:
        logger.warning("feedback: the account's address answered %s", r.status_code)
        return None
    email = (r.json() or {}).get("email")
    return email[:320] if isinstance(email, str) and email else None


@router.post("/api/feedback")
def post_feedback(payload: FeedbackPayload, user_id: str = Depends(get_user_id)):
    if payload.kind not in KINDS:
        _refuse(400, "feedback_kind", "Unknown kind")
    text = payload.text.strip()
    reasons: list[str] = []
    card_id = None
    if payload.kind == "card":
        card_id = (payload.card_id or "").strip()
        if not CARD_ID_RE.match(card_id):
            _refuse(400, "feedback_card", "A card's report names its card")
        if any(r not in CARD_REASONS for r in payload.reasons):
            _refuse(400, "feedback_reason", "Unknown reason")
        reasons = [r for r in CARD_REASONS if r in payload.reasons]
        if not reasons and not text:
            _refuse(400, "feedback_empty", "Say what is wrong with the card")
    elif not text:
        _refuse(400, "feedback_empty", "The message is empty")

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM feedback "
                "WHERE user_id = %s AND created_at > NOW() - INTERVAL '1 day'",
                (user_id,),
            )
            (sent,) = cur.fetchone()
    finally:
        conn.close()
    if sent >= DAILY_MAX:
        _refuse(429, "feedback_limit", "Five messages a day")
    # Outside any connection: the round trip can take seconds, and a
    # pooled connection held through it is one another learner waits on.
    reply_to = _reply_address(user_id) if payload.reply else None

    area = _shape("path", payload.area)

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO feedback (user_id, kind, body, reasons, card_id, route, area, status,
                                      platform, vp, os, lang, reply, reply_to)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING created_at
                """,
                (
                    user_id, payload.kind, text, reasons, card_id,
                    _shape("route", payload.route),
                    area,
                    payload.status if area else None,
                    _visit("platform", payload.platform),
                    _visit("vp", payload.vp),
                    _visit("os", payload.os),
                    _visit("lang", payload.lang),
                    payload.reply, reply_to,
                ),
            )
            (at,) = cur.fetchone()
        conn.commit()
    finally:
        conn.close()
    logger.info("feedback kind=%s user=%s", payload.kind, user_id)
    return {"ok": True, "at": at.isoformat()}
