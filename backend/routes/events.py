# ── 記録 — the funnel's own log ────────────────────────────────────
# One write-only endpoint behind the onboarding and paywall funnels.
# Everything else in this app records a FACT the learner produced — a
# review, an exam, a deck. These are records of what the learner was
# SHOWN and what they did about it, which no other table can answer:
# a paywall that is never opened and a paywall that is opened and
# refused look identical from `credit_ledger`.
#
# The name is an allowlist, not free text. A client that can write any
# string into a shared table writes typos into it forever, and every
# funnel query then needs to know that `paywall_seen`, `paywallView`
# and `paywall_view` were the same event in three different weeks.
# Adding a funnel step means adding it here, on purpose.
#
# Deliberately NOT here: a session id, a device fingerprint, an IP, a
# user agent. The funnel needs to know that a step happened to a
# learner, not to follow them around — and a table this cheap to write
# to is exactly the one that quietly grows into a tracker. `props` is
# capped and shallow for the same reason.
import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from core.auth import get_user_id
from core.db import db_conn

router = APIRouter()
logger = logging.getLogger(__name__)

# The funnel, spelled once. Onboarding is a line the learner walks
# forward along; the paywall is a thing that is shown, taken or
# dismissed from one of five places (frontend/src/domain/paywall.js
# holds the same five, and its SOURCES must agree with _SOURCES here).
ONBOARDING_EVENTS = {
    "onboarding_start",      # the first question painted
    "onboarding_step",       # a question answered — props: { step, index, ms }
    "onboarding_back",       # a step walked back  — props: { step, index, ms }
    "onboarding_complete",   # the contract signed — props: { step, index, ms }
}
PAYWALL_EVENTS = {
    "paywall_view",          # the sheet opened      — props: { source }
    "paywall_intent",        # "prévenez-moi" tapped — props: { source, ms }
    "paywall_dismiss",       # closed without it     — props: { source, ms }
}
ALLOWED = ONBOARDING_EVENTS | PAYWALL_EVENTS

_SOURCES = {"onboarding", "balance", "profile", "settings", "runout"}

# `ms` is ENGAGED time, not wall-clock: the client stops counting while
# the tab is hidden (frontend/src/lib/dwell.js), so "spent four hours on
# the rhythm question" is not a shape this should ever see. Six hours is
# therefore far beyond anything real, and a value past it means a broken
# clock or a hand-made request — worth refusing loudly rather than
# quietly averaging into every median on the dashboard.
_MAX_MS = 6 * 60 * 60 * 1000

# A batch is a handful of steps flushed together, not an export.
_MAX_BATCH = 25
_MAX_PROPS_BYTES = 512


class Event(BaseModel):
    name: str
    props: dict = Field(default_factory=dict)

    @field_validator("name")
    @classmethod
    def known_name(cls, v: str) -> str:
        if v not in ALLOWED:
            raise ValueError(f"unknown event: {v}")
        return v

    @field_validator("props")
    @classmethod
    def small_and_shallow(cls, v: dict) -> dict:
        # Shallow: a nested object is a payload, and a payload in a
        # funnel table is how one becomes an analytics warehouse.
        for key, val in v.items():
            if isinstance(val, (dict, list)):
                raise ValueError(f"props.{key} must be a scalar")
        if len(json.dumps(v, ensure_ascii=False).encode()) > _MAX_PROPS_BYTES:
            raise ValueError("props too large")
        source = v.get("source")
        if source is not None and source not in _SOURCES:
            raise ValueError(f"unknown source: {source}")
        ms = v.get("ms")
        if ms is not None:
            # bool is an int in Python, and `ms: true` is a bug, not a duration.
            if isinstance(ms, bool) or not isinstance(ms, int):
                raise ValueError("ms must be an integer number of milliseconds")
            if ms < 0 or ms > _MAX_MS:
                raise ValueError(f"ms out of range: {ms}")
        return v


class EventBatch(BaseModel):
    events: list[Event] = Field(min_length=1, max_length=_MAX_BATCH)


def _ensure_event_schema() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS event_log (
                    id      BIGSERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    name    TEXT NOT NULL,
                    props   JSONB NOT NULL DEFAULT '{}'::jsonb,
                    at      TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """)
            # The funnel is always read as "this event, over this
            # window", and the retention pass always reads it by date.
            cur.execute("""
                CREATE INDEX IF NOT EXISTS event_log_name_at_idx
                    ON event_log (name, at)
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS event_log_user_at_idx
                    ON event_log (user_id, at)
            """)
        conn.commit()
    finally:
        conn.close()


try:
    _ensure_event_schema()
except Exception:  # pragma: no cover - a missing DB must not stop import
    logger.exception("event schema could not be initialised")


@router.post("/api/events")
def record_events(payload: EventBatch, user_id: str = Depends(get_user_id)):
    """Append a batch of funnel events. Write-only: nothing reads this
    back through the API — the dashboards query the table directly."""
    rows = [
        (user_id, e.name, json.dumps(e.props, ensure_ascii=False))
        for e in payload.events
    ]
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO event_log (user_id, name, props) VALUES (%s, %s, %s)",
                rows,
            )
        conn.commit()
    except Exception:
        conn.rollback()
        # A lost funnel event must never surface to the learner: the
        # caller is fire-and-forget and the UI it measures carried on
        # regardless. Logged loudly here because a silent 500 loop is
        # how a funnel goes quietly to zero and nobody notices.
        logger.exception("event batch rejected (%d events)", len(rows))
        raise HTTPException(status_code=503, detail="events_unavailable")
    finally:
        conn.close()
    return {"accepted": len(rows)}
