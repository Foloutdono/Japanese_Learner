"""
蔵 — the Storehouse.

Owns two tables and one rule worth stating up front: **an unlock is
permanent the moment it is first satisfied.** Predicates are evaluated
against live facts on every read, but the result is written down, so a
hundred-day streak that later breaks does not repossess the paper it
earned. Without that, half the catalogue would be a rental.

That also makes the read path the write path: GET /api/cosmetics
evaluates, persists anything newly true, and hands back the ids it
just wrote so the frontend can throw a ceremony for them. There's no
separate "check for unlocks" job, and nothing to schedule.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.db import db_conn
from core.auth import get_user_id
from core.srs_instance import srs
from srs import cosmetics
from srs.xp import level_progress

router = APIRouter()
logger = logging.getLogger(__name__)


def _init_db() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS user_cosmetics (
                    user_id TEXT NOT NULL,
                    cosmetic_id TEXT NOT NULL,
                    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    seen BOOLEAN NOT NULL DEFAULT FALSE,
                    PRIMARY KEY (user_id, cosmetic_id)
                )
            """)
            # One nullable column per slot. Built from cosmetics.SLOTS
            # rather than spelled out, so adding a slot to the
            # catalogue is a one-line edit there and not a schema
            # change here that someone has to remember to make.
            columns = ",\n                    ".join(f"{slot} TEXT" for slot in cosmetics.SLOTS)
            cur.execute(f"""
                CREATE TABLE IF NOT EXISTS user_loadout (
                    user_id TEXT PRIMARY KEY,
                    {columns}
                )
            """)
            # And the same list again as ALTERs, because the table
            # already exists for every current user: CREATE TABLE IF
            # NOT EXISTS is a no-op on them, so a new slot would
            # otherwise be a column that only new accounts have.
            for slot in cosmetics.SLOTS:
                cur.execute(f"ALTER TABLE user_loadout ADD COLUMN IF NOT EXISTS {slot} TEXT")
        conn.commit()
    finally:
        conn.close()


_init_db()


# ── Facts ─────────────────────────────────────────────────────
def _shelf_facts(user_id: str) -> dict:
    """Shelf composition, for the unlocks that care what kind of
    collector you've been rather than how big the pile is. Reads the
    daruma hall's own table (routes/daruma.py) — tolerated as a
    cross-module read because the alternative is duplicating the
    shelf, and a failure here must not take the storehouse down."""
    empty = {"shelf_count": 0, "shelf_colors": 0, "shelf_kiwami": 0}
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT goal_id FROM daruma_goals
                WHERE user_id = %s AND claimed_at IS NOT NULL
                """,
                (user_id,),
            )
            rows = [r[0] for r in cur.fetchall()]
    except Exception:
        logger.exception("shelf facts unavailable")
        return empty
    finally:
        conn.close()

    from srs import daruma
    goals = [daruma.ALL_GOALS[g] for g in rows if g in daruma.ALL_GOALS]
    return {
        "shelf_count": len(goals),
        "shelf_colors": len({g.color for g in goals}),
        "shelf_kiwami": sum(1 for g in goals if g.rarity == "kiwami"),
    }


def _facts(user_id: str, tz_offset: int = 0) -> dict:
    facts = srs.get_daruma_facts(user_id, tz_offset)
    facts["level"] = level_progress(srs.get_lifetime_xp(user_id))["level"]
    facts.update(_shelf_facts(user_id))
    facts["rank_index"] = cosmetics.rank_for(facts["mastered_total"])["index"]
    return facts


# ── Ownership ─────────────────────────────────────────────────
def _owned(user_id: str) -> set[str]:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT cosmetic_id FROM user_cosmetics WHERE user_id = %s", (user_id,))
            return {r[0] for r in cur.fetchall()}
    finally:
        conn.close()


def _grant(user_id: str, ids: list[str]) -> None:
    if not ids:
        return
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO user_cosmetics(user_id, cosmetic_id) VALUES (%s, %s)
                ON CONFLICT (user_id, cosmetic_id) DO NOTHING
                """,
                [(user_id, cid) for cid in ids],
            )
        conn.commit()
    finally:
        conn.close()


def _resolve_unlocks(user_id: str, facts: dict) -> set[str]:
    """Everything this user has earned, persisting whatever is newly
    true. Runs in two passes because `unlocked_count` (the 蔵守 title —
    "keeper of the storehouse") is a predicate about the other
    predicates, and evaluating it in the same pass would make the
    result depend on dict ordering."""
    owned = _owned(user_id)

    first = {
        c.id for c in cosmetics.ALL.values()
        if c.id not in cosmetics.SELF_REFERENTIAL and cosmetics.is_earned(c, facts)
    }
    owned |= first

    facts["unlocked_count"] = len(owned)
    second = {
        c.id for c in cosmetics.ALL.values()
        if c.id in cosmetics.SELF_REFERENTIAL and cosmetics.is_earned(c, facts)
    }
    owned |= second

    _grant(user_id, sorted((first | second) - _owned(user_id)))
    return owned


# ── Loadout ───────────────────────────────────────────────────
def _loadout(user_id: str, owned: set[str]) -> dict:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {', '.join(cosmetics.SLOTS)} FROM user_loadout WHERE user_id = %s",
                (user_id,),
            )
            row = cur.fetchone()
    finally:
        conn.close()

    stored = dict(zip(cosmetics.SLOTS, row)) if row else {}
    # Fall back to the slot's default for anything unset, unknown, or
    # not actually owned — the last case matters because a loadout row
    # outlives a catalogue edit.
    return {
        slot: (stored.get(slot) if stored.get(slot) in owned and stored.get(slot) in cosmetics.ALL
               else cosmetics.DEFAULTS[slot])
        for slot in cosmetics.SLOTS
    }


def _unseen(user_id: str) -> list[str]:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT cosmetic_id FROM user_cosmetics
                WHERE user_id = %s AND seen = FALSE
                ORDER BY unlocked_at ASC
                """,
                (user_id,),
            )
            return [r[0] for r in cur.fetchall()]
    finally:
        conn.close()


def _storehouse(user_id: str, tz_offset: int) -> dict:
    facts = _facts(user_id, tz_offset)
    owned = _resolve_unlocks(user_id, facts)
    loadout = _loadout(user_id, owned)

    # Locked items last, then by ascending rarity, so the shelf reads
    # as "what you have, then what's next" instead of a wall.
    order = {r: i for i, r in enumerate(cosmetics.RARITIES)}

    def key(c):
        return (c.id not in owned, order.get(c.rarity, 0), c.id)

    slots = {
        slot: [
            cosmetics.serialize(c, c.id in owned, facts, loadout[slot] == c.id)
            for c in sorted(cosmetics.BY_SLOT[slot], key=key)
        ]
        for slot in cosmetics.SLOTS
    }

    return {
        "rank": cosmetics.rank_for(facts["mastered_total"]),
        "slots": slots,
        "loadout": loadout,
        "ownedCount": len(owned),
        "totalCount": len(cosmetics.ALL),
        # Newly earned and not yet celebrated. Sent as whole items
        # rather than bare ids so the unlock ceremony doesn't need a
        # second copy of every item's Japanese name in the locale
        # files just to render one line.
        "unseen": [
            {"id": c.id, "slot": c.slot, "jp": c.jp, "rarity": c.rarity}
            for c in (cosmetics.ALL[i] for i in _unseen(user_id) if i in cosmetics.ALL)
        ],
    }


# ── Payloads ──────────────────────────────────────────────────
class EquipPayload(BaseModel):
    slot: str
    cosmetic_id: str


# ── Routes ────────────────────────────────────────────────────
@router.get("/api/cosmetics")
def get_storehouse(tz_offset: int = 0, user_id: str = Depends(get_user_id)):
    return _storehouse(user_id, tz_offset)


@router.post("/api/cosmetics/equip")
def equip(payload: EquipPayload, tz_offset: int = 0, user_id: str = Depends(get_user_id)):
    item = cosmetics.ALL.get(payload.cosmetic_id)
    if not item or item.slot != payload.slot:
        raise HTTPException(status_code=404, detail="No such cosmetic for that slot")

    facts = _facts(user_id, tz_offset)
    if payload.cosmetic_id not in _resolve_unlocks(user_id, facts):
        raise HTTPException(status_code=403, detail="Not unlocked")

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            # The column name is never user input — payload.slot has
            # already been checked against the item's own slot, which
            # comes from the catalogue.
            cur.execute(
                f"""
                INSERT INTO user_loadout(user_id, {payload.slot}) VALUES (%s, %s)
                ON CONFLICT (user_id) DO UPDATE SET {payload.slot} = EXCLUDED.{payload.slot}
                """,
                (user_id, payload.cosmetic_id),
            )
        conn.commit()
    finally:
        conn.close()

    return _storehouse(user_id, tz_offset)


@router.post("/api/cosmetics/seen")
def mark_seen(tz_offset: int = 0, user_id: str = Depends(get_user_id)):
    """Called once the unlock ceremony has actually played, so a
    refresh mid-animation doesn't swallow the celebration."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE user_cosmetics SET seen = TRUE WHERE user_id = %s AND seen = FALSE",
                (user_id,),
            )
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}


# ── Shared with /api/profile ──────────────────────────────────
def summary_for(user_id: str) -> dict:
    """The slice the profile endpoint embeds so that every screen in
    the app can apply the user's loadout (and show their rank) off the
    one profile fetch it already makes, instead of every card screen
    learning about cosmetics."""
    try:
        mastered = srs.get_mastered_count(user_id)
        owned = _owned(user_id)
        loadout = _loadout(user_id, owned)
        return {
            "loadout": loadout,
            # The equipped title's own Japanese name, resolved here so
            # the profile card can print it without the frontend
            # keeping a second copy of the catalogue.
            "titleJp": cosmetics.ALL[loadout["title"]].jp,
            "rank": cosmetics.rank_for(mastered),
            "ownedCount": len(owned),
            "totalCount": len(cosmetics.ALL),
            "unseen": len(_unseen(user_id)),
        }
    except Exception:
        # Cosmetics are decoration; the profile screen must not 500
        # because the storehouse tables aren't reachable.
        logger.exception("cosmetics summary failed")
        return {
            "loadout": dict(cosmetics.DEFAULTS),
            "titleJp": cosmetics.ALL[cosmetics.DEFAULTS["title"]].jp,
            "rank": cosmetics.rank_for(0),
            "ownedCount": 0,
            "totalCount": len(cosmetics.ALL),
            "unseen": 0,
        }
