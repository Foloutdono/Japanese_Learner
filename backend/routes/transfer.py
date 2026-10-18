"""乗換 — progress brought across from another app (plans 243, 243b).

Settings › Correspondance. The learner's device reads where they studied
before -- an Anki .apkg or .colpkg, or their WaniKani or Renshuu account
through its own API, with a key that never reaches this server -- and
posts what matching needs (study/transfer.py has the shape and the
reasons); these routes match it to the course and write it:

  POST   /api/transfer/preview   what an import would do, writing nothing
  POST   /api/transfer/import    the same notes, written
  GET    /api/transfer           the imported cards still waiting for a check
  DELETE /api/transfer           the import taken back
  POST   /api/transfer/offer     the sheet over Today answered (plan 243b)

The two POSTs take the same body, so the source is read once and the
preview needs nothing kept between the two requests. Every body is
bounded (plan 211): MAX_NOTES notes, MAX_TYPES note types, MAX_FIELDS
fields of a bounded length, an interval and a due day inside the
scheduler's hundred years, a source from a closed set. The handlers are
plain `def`: matching twenty thousand notes and writing their rows
block.

Nothing the learner sent is kept beyond the rows it writes: not the
fields, not the words the course lacks (named back in the preview's
`sample`, which is the learner's own data shown to them), not a deck's
name, which never leaves the device.

── The offer (plan 243b) ─────────────────────────────────────
Once, on Today, a new learner is asked whether they studied elsewhere
(the sheet frontend/src/components/station/TransferSheet.jsx draws).
`offer_open` decides who is asked: the first ride behind them, a first
answer given (a card or an exercise), nothing studied before the last
NEW_DAYS days, and never asked before
(user_profiles.transfer_offered_at, which an import stamps too, so a
learner who came through Settings is not asked after the fact).

Not before the first answer: asked straight after the ride, a learner
who had studied nowhere else read its first button, « Reprendre ma
progression », as the way on, landed on Settings › Correspondance with
nothing to bring and left without having answered one card (the trail
of 2026-10-18). Their first card is the day's gate; the question waits
until they come back from it.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, StringConstraints

from core import events
from core.auth import get_user_id, prefixed
from core.db import db_conn
from core.srs_instance import srs
from study import daily_queue, level_rule, transfer
from study.difficulty import LEVELS

router = APIRouter()
logger = logging.getLogger(__name__)

# Past the scheduler's cap, so a collection's longest intervals are
# accepted and clamped (transfer.rows) rather than refused.
_DAYS = 100_000

# Where the notes come from. Held equal to the page's sources by
# tests/test_transfer.py, and the events' values (core/events.VALUES).
SOURCES = ("anki", "wanikani", "renshuu")

# A learner is new for the offer while their first studied day is no
# older than this.
NEW_DAYS = 14


class TransferNote(BaseModel):
    """One note, in the device's short keys (a whole collection is
    thousands of these): its note type, its fields, and its strongest
    graduated card's interval, ease, FSRS difficulty and due day."""
    t: int = Field(ge=0, lt=transfer.MAX_TYPES)
    f: list[Annotated[str, StringConstraints(max_length=2 * transfer.MAX_FIELD)]] = Field(
        max_length=transfer.MAX_FIELDS)
    i: int = Field(ge=1, le=_DAYS)
    e: int = Field(0, ge=0, le=100_000)
    d: float | None = Field(None, ge=1, le=10)
    u: int = Field(0, ge=-_DAYS, le=_DAYS)


class TransferPayload(BaseModel):
    source: Literal[SOURCES] = "anki"
    notes: list[TransferNote] = Field(max_length=transfer.MAX_NOTES)


def _match(payload: TransferPayload) -> transfer.Match:
    return transfer.match([
        transfer.Note(type=n.t, fields=tuple(n.f), interval=n.i, ease=n.e, fsrs=n.d, due=n.u)
        for n in payload.notes
    ])


def _kept(user_id: str, m: transfer.Match) -> frozenset:
    """The (source, raw id) of the matched cards already studied here,
    which the import leaves as they are."""
    by_mode: dict[str, list[tuple[str, str]]] = {}
    for source, raw in m.hits:
        by_mode.setdefault(level_rule.primary_mode(source), []).append((source, raw))
    kept = set()
    for mode, keys in by_mode.items():
        studied = srs.with_history(prefixed([raw for _, raw in keys], user_id), mode)
        kept.update(key for key in keys if f"{user_id}:{key[1]}" in studied)
    return frozenset(kept)


def _profile(user_id: str) -> tuple[str | None, str | None, str | None]:
    """The stored level, kana answer and goal, all None before the
    boarding."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT jlpt_level, kana_known, goal_level FROM user_profiles WHERE user_id = %s", (user_id,))
            row = cur.fetchone()
    finally:
        conn.close()
    return (row[0], row[1], row[2]) if row else (None, None, None)


def _above(user_id: str, by_level: dict[str, int]) -> int:
    """How many matched cards stand past the learner's level and goal:
    Today holds their reviews until the level reaches them
    (daily_queue.hold_above), as it holds every row up there, and the
    preview says so rather than let them seem lost."""
    level, _kana, goal = _profile(user_id)
    if level not in LEVELS:
        return 0
    line = LEVELS.index(daily_queue.hold_line(level, goal))
    return sum(n for lvl, n in by_level.items() if LEVELS.index(lvl) > line)


def _summary(user_id: str, m: transfer.Match, kept: frozenset) -> dict:
    """What the import holds, in the shape the ticket prints: the cards
    matched (per line and per level), those already studied here and
    left as they are, those past the learner's level and goal, those it
    writes, how many of these were due at the source (their checks
    spread over the level rule's weeks), and the notes the course has no
    card for, a few of them named."""
    counted = transfer.counts(m)
    return {
        "notes": m.notes,
        "cards": len(m.hits),
        **counted,
        "kept": len(kept),
        "above": _above(user_id, counted["byLevel"]),
        "write": len(m.hits) - len(kept),
        "dueNow": transfer.overdue(m, kept),
        "spreadWeeks": level_rule.SPREAD_WEEKS,
        "unmatched": m.unmatched,
        "sample": m.sample,
        # Which field of each note type was read, as which kind: the
        # page names the field from the file it still holds.
        "types": [
            {"type": tm.type, "notes": tm.notes, "field": tm.field, "kind": tm.kind, "reading": tm.reading}
            for tm in m.types
        ],
    }


def _stamp_offer(user_id: str) -> None:
    """The offer is behind the learner: answered on Today, or made moot
    by an import. The first stamp stands."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE user_profiles SET transfer_offered_at = COALESCE(transfer_offered_at, NOW()) WHERE user_id = %s",
                (user_id,),
            )
        conn.commit()
    finally:
        conn.close()


def offer_open(user_id: str, tutorial_at) -> bool:
    """Whether Today asks this learner, once, if they studied elsewhere
    (see the module's note): GET /api/profile's `transferOffer`."""
    if tutorial_at is None:
        return False
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT transfer_offered_at FROM user_profiles WHERE user_id = %s", (user_id,))
            row = cur.fetchone()
    finally:
        conn.close()
    if row is None or row[0] is not None:
        return False
    first = srs.first_studied_day(user_id)
    return first is not None and first >= datetime.now(timezone.utc).date() - timedelta(days=NEW_DAYS)


@router.post("/api/transfer/preview")
def post_transfer_preview(payload: TransferPayload, user_id: str = Depends(get_user_id)):
    m = _match(payload)
    return _summary(user_id, m, _kept(user_id, m))


@router.post("/api/transfer/import")
def post_transfer_import(payload: TransferPayload, user_id: str = Depends(get_user_id)):
    m = _match(payload)
    kept = _kept(user_id, m)
    summary = _summary(user_id, m, kept)
    now = datetime.now(timezone.utc)
    written = srs.seed_imported([
        (f"{user_id}:{row.raw_id}", row.mode, row.difficulty, row.interval_days, row.next_review)
        for row in transfer.rows(m, now, kept)
    ])
    _stamp_offer(user_id)
    events.record(user_id, "transfer_import", {
        "source": payload.source, "notes": m.notes, "cards": len(m.hits),
        "written": written, "kept": summary["kept"],
    })
    logger.info("transfer import user_id=%s source=%s notes=%d cards=%d written=%d kept=%d",
                user_id, payload.source, m.notes, len(m.hits), written, summary["kept"])
    return {**summary, "written": written, "waiting": srs.count_imported(user_id)}


@router.get("/api/transfer")
def get_transfer(user_id: str = Depends(get_user_id)):
    return {"waiting": srs.count_imported(user_id)}


@router.delete("/api/transfer")
def delete_transfer(user_id: str = Depends(get_user_id)):
    """Take the import back: every imported card no answer has touched
    goes (SRSEngine.forget_imported), and the level rule's assumptions
    are seeded back over the holes it leaves behind the learner's level
    and in the scripts they read, exactly as their boarding wrote them
    -- an import had replaced them, and taken back it must not leave
    the stops behind the level to be dealt as new. A card answered
    since is history, and stays."""
    removed = srs.forget_imported(user_id)
    level, kana_known, _goal = _profile(user_id)
    if level in LEVELS:
        for _source, mode, ids in level_rule.known_batches(level_rule.stops_behind(level)):
            srs.seed_known(prefixed(ids, user_id), mode, spread_days=level_rule.SPREAD_DAYS)
    mode, ids = level_rule.kana_batch(kana_known)
    if ids:
        srs.seed_known(prefixed(ids, user_id), mode, spread_days=level_rule.SPREAD_DAYS)
    events.record(user_id, "transfer_undo", {"removed": removed})
    logger.info("transfer undone user_id=%s removed=%d", user_id, removed)
    return {"removed": removed, "waiting": srs.count_imported(user_id)}


class OfferPayload(BaseModel):
    """What the learner did with the sheet: went to bring their progress
    across, or began here."""
    choice: Literal["go", "later"]


@router.post("/api/transfer/offer")
def post_transfer_offer(payload: OfferPayload, user_id: str = Depends(get_user_id)):
    _stamp_offer(user_id)
    events.record(user_id, "transfer_offer", {"choice": payload.choice})
    return {"transferOffer": False}
