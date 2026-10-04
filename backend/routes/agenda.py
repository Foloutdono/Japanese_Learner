"""時間割 — the learner's weekly agenda (plan 181).

A timetable of study blocks: "kanji, Monday to Friday, 9:00 to 11:00",
"reading, Saturday 14:00 to 16:00". A block names a SUBJECT (a line of
the Learn gate, a platform of the Practice gate, or the day's queue), the
days of the week it repeats on, the minutes of the day it spans, and
whether and how early the phone should tell the learner it is starting.

It is the learner's own plan and nothing the scheduler reads: no card is
due because a block exists, and no block is missed because a card was
not studied. The only consumers are the Settings page that edits it and
the native shells' notification planner (frontend lib/agenda.js), which
turns each block into dated local notifications while the app is shut.
The server never sends one.

Stored as ROWS, one per block, replaced as a whole by PUT -- the page
edits a handful of blocks at a time, and a whole-list write is one
transaction that cannot leave a half-saved week. Days are a bit mask
(Monday is bit 0) and times are minutes after midnight on the learner's
own clock: an agenda is a wall-clock habit, so it has no time zone and
nothing here converts one.

Validated here rather than trusted from the page: blocks within a day
never overlap (touching is fine: 9-11 then 11-12), a block is a quarter
of an hour at least, and the list is bounded.

No cascade from auth (ADR 0010): `user_id` is a bare column, and
DELETE /api/account and scripts/purge_orphans.py clear it.
"""

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

from core.auth import get_user_id
from core.db import db_conn

router = APIRouter()
logger = logging.getLogger(__name__)

# What a block can be about: the day's queue, the Learn gate's four
# lines, the Practice gate's six platforms. Closed, because the client
# turns each into a place to open (frontend domain/agenda.js) and a
# value it does not know has nowhere to go. A deck is not a subject: it
# is a learner's own name for something (analytics never keeps those).
Subject = Literal[
    "review", "kana", "vocab", "kanji", "grammar",
    "reading", "translation", "dictation", "composition", "comprehension", "exam",
]
SUBJECTS = Subject.__args__

# How long before a block starts the phone tells the learner, in minutes.
LEADS = (0, 5, 10, 15, 30, 60)
MINUTES_A_DAY = 24 * 60
# A block is at least this long and its times fall on this grid, so the
# page's time pickers and the stored rows agree.
MIN_BLOCK = 15
STEP = 5
# A week of study, not a calendar: forty blocks is a block an hour for a
# working week's evenings and more than anyone keeps.
MAX_BLOCKS = 40
# Namespace half of the advisory lock a write takes (cf. favorites).
AGENDA_LOCK = 931_180


def _ensure_schema() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS agenda_blocks (
                    id         BIGSERIAL PRIMARY KEY,
                    user_id    TEXT NOT NULL,
                    subject    TEXT NOT NULL,
                    days_mask  INTEGER NOT NULL,
                    start_min  INTEGER NOT NULL,
                    end_min    INTEGER NOT NULL,
                    notify     BOOLEAN NOT NULL DEFAULT TRUE,
                    lead_min   INTEGER NOT NULL DEFAULT 10,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute(
                "CREATE INDEX IF NOT EXISTS agenda_blocks_user ON agenda_blocks (user_id)"
            )
        conn.commit()
    finally:
        conn.close()


try:
    _ensure_schema()
except Exception:  # pragma: no cover - a missing DB must not stop import
    logger.exception("agenda_blocks schema could not be initialised")


# ── The shape of a block ──────────────────────────────────────

class Block(BaseModel):
    subject: Subject
    # 0 = Monday … 6 = Sunday, each at most once.
    days: list[int] = Field(min_length=1, max_length=7)
    start: int = Field(ge=0, lt=MINUTES_A_DAY)
    end: int = Field(gt=0, le=MINUTES_A_DAY)
    notify: bool = True
    lead: int = 10

    @field_validator("days")
    @classmethod
    def _days(cls, days: list[int]) -> list[int]:
        if any(d < 0 or d > 6 for d in days) or len(set(days)) != len(days):
            raise ValueError("days are 0 (Monday) to 6 (Sunday), each once")
        return sorted(days)

    @field_validator("lead")
    @classmethod
    def _lead(cls, lead: int) -> int:
        if lead not in LEADS:
            raise ValueError(f"lead is one of {LEADS}")
        return lead

    @field_validator("start", "end")
    @classmethod
    def _grid(cls, minute: int) -> int:
        # The end of the day (24:00) is on the grid as well.
        if minute % STEP:
            raise ValueError(f"times fall on {STEP}-minute marks")
        return minute

    @model_validator(mode="after")
    def _long_enough(self):
        if self.end - self.start < MIN_BLOCK:
            raise ValueError(f"a block is at least {MIN_BLOCK} minutes")
        return self


class Agenda(BaseModel):
    blocks: list[Block] = Field(max_length=MAX_BLOCKS)


def mask_of(days: list[int]) -> int:
    return sum(1 << d for d in days)


def days_of(mask: int) -> list[int]:
    return [d for d in range(7) if mask & (1 << d)]


def find_overlap(blocks: list[Block]) -> tuple[int, int] | None:
    """The indexes of the first two blocks that share a day and a
    stretch of time, or None. Touching (one ends as the next starts)
    is not an overlap."""
    for i, a in enumerate(blocks):
        for j in range(i + 1, len(blocks)):
            b = blocks[j]
            if not set(a.days) & set(b.days):
                continue
            if a.start < b.end and b.start < a.end:
                return i, j
    return None


def _row_to_block(row) -> dict:
    block_id, subject, mask, start, end, notify, lead = row
    return {
        "id": block_id,
        "subject": subject,
        "days": days_of(mask),
        "start": start,
        "end": end,
        "notify": bool(notify),
        "lead": lead,
    }


def read_agenda(user_id: str) -> list[dict]:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, subject, days_mask, start_min, end_min, notify, lead_min "
                "FROM agenda_blocks WHERE user_id = %s ORDER BY start_min, id",
                (user_id,),
            )
            return [_row_to_block(r) for r in cur.fetchall()]
    finally:
        conn.close()


# ── Routes ────────────────────────────────────────────────────

@router.get("/api/agenda")
def get_agenda(user_id: str = Depends(get_user_id)):
    return {"blocks": read_agenda(user_id)}


@router.put("/api/agenda")
def put_agenda(body: Agenda, user_id: str = Depends(get_user_id)):
    """Replace the week. The answer is what is stored, ids included."""
    clash = find_overlap(body.blocks)
    if clash is not None:
        # The indexes name the two blocks in the order they were sent, so
        # the page can mark them without re-deriving the rule.
        raise HTTPException(status_code=422, detail={"code": "overlap", "blocks": list(clash)})
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT pg_advisory_xact_lock(%s, hashtext(%s))", (AGENDA_LOCK, user_id)
            )
            cur.execute("DELETE FROM agenda_blocks WHERE user_id = %s", (user_id,))
            for b in body.blocks:
                cur.execute(
                    "INSERT INTO agenda_blocks "
                    "(user_id, subject, days_mask, start_min, end_min, notify, lead_min) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                    (user_id, b.subject, mask_of(b.days), b.start, b.end, b.notify, b.lead),
                )
        conn.commit()
    finally:
        conn.close()
    return {"blocks": read_agenda(user_id)}
