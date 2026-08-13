"""
達磨堂 — the Daruma Hall.

Ritual state only. What a goal *is* lives in srs/daruma.py, and how far
along it is gets recomputed from live SRS facts on every request — the
only thing worth persisting is which eyes have been painted, because
that's the part the user did rather than the part the data says.

Three tables:
  daruma_goals  one row per (user, goal, period) that has been vowed
                and/or claimed. Nothing is written when a period rolls
                over; the day's goals are a pure function of user+date
                (see daruma.daily_goals), so an untouched daruma simply
                has no row.
  daruma_state  the 起 token purse.
  streak_mends  lives in srs.py instead, because get_streak has to read
                it — see the note there.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db import db_conn
from auth import get_user_id
from srs_instance import srs
from srs import daruma
from srs.xp import level_progress

router = APIRouter()
logger = logging.getLogger(__name__)


def _init_db() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS daruma_goals (
                    user_id TEXT NOT NULL,
                    goal_id TEXT NOT NULL,
                    period_key TEXT NOT NULL,
                    vowed_at TIMESTAMPTZ,
                    claimed_at TIMESTAMPTZ,
                    reward_xp INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (user_id, goal_id, period_key)
                )
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_daruma_goals_user
                ON daruma_goals(user_id, claimed_at)
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS daruma_state (
                    user_id TEXT PRIMARY KEY,
                    tokens INTEGER NOT NULL DEFAULT 0
                )
            """)
        conn.commit()
    finally:
        conn.close()


_init_db()


# ── Row helpers ───────────────────────────────────────────────
def _rows_for(user_id: str, keys: list[tuple[str, str]]) -> dict[tuple[str, str], dict]:
    """Existing ritual rows for the (goal_id, period_key) pairs in play,
    fetched in one go so serializing a screenful of darumas isn't a
    query per doll."""
    if not keys:
        return {}
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT goal_id, period_key, vowed_at, claimed_at
                FROM daruma_goals
                WHERE user_id = %s AND (goal_id, period_key) IN %s
                """,
                (user_id, tuple(keys)),
            )
            return {
                (goal_id, period): {"vowed_at": vowed, "claimed_at": claimed}
                for goal_id, period, vowed, claimed in cur.fetchall()
            }
    finally:
        conn.close()


def _tokens(user_id: str) -> int:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT tokens FROM daruma_state WHERE user_id = %s", (user_id,))
            row = cur.fetchone()
            return int(row[0]) if row else 0
    finally:
        conn.close()


def _add_tokens(user_id: str, delta: int) -> int:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO daruma_state(user_id, tokens) VALUES (%s, GREATEST(0, %s))
                ON CONFLICT (user_id) DO UPDATE
                SET tokens = GREATEST(0, daruma_state.tokens + EXCLUDED.tokens)
                RETURNING tokens
                """,
                (user_id, delta),
            )
            total = int(cur.fetchone()[0])
        conn.commit()
        return total
    finally:
        conn.close()


def _shelf(user_id: str) -> list[dict]:
    """Every daruma whose second eye has been painted, newest first.
    Goals that have since been removed from the catalogue are skipped
    rather than crashing the screen — the shelf outlives the pool."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT goal_id, period_key, claimed_at, reward_xp
                FROM daruma_goals
                WHERE user_id = %s AND claimed_at IS NOT NULL
                ORDER BY claimed_at DESC
                """,
                (user_id,),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    shelf = []
    for goal_id, period, claimed_at, reward_xp in rows:
        goal = daruma.ALL_GOALS.get(goal_id)
        if not goal:
            continue
        shelf.append({
            "id": goal_id,
            "kind": goal.kind,
            "glyph": goal.glyph,
            "color": goal.color,
            "rarity": goal.rarity,
            "period": period,
            "claimedAt": claimed_at.isoformat(),
            "rewardXp": reward_xp,
        })
    return shelf


def _active_vow_ids(user_id: str) -> set[str]:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT goal_id FROM daruma_goals
                WHERE user_id = %s AND period_key = 'vow'
                  AND vowed_at IS NOT NULL AND claimed_at IS NULL
                """,
                (user_id,),
            )
            return {row[0] for row in cur.fetchall()}
    finally:
        conn.close()


# ── Payload ───────────────────────────────────────────────────
class GoalPayload(BaseModel):
    goal_id: str


def _hall(user_id: str, tz_offset: int) -> dict:
    facts = srs.get_daruma_facts(user_id, tz_offset)
    today = datetime.now(timezone.utc).date()

    day_key = daruma.period_key("daily", today)
    week_key = daruma.period_key("weekly", today)

    dailies = daruma.daily_goals(user_id, today)
    weeklies = daruma.weekly_goals(user_id, today)

    keys = (
        [(g.id, day_key) for g in dailies]
        + [(g.id, week_key) for g in weeklies]
        + [(g.id, "vow") for g in daruma.VOW_POOL]
    )
    rows = _rows_for(user_id, keys)

    def ser(goal, key):
        return daruma.serialize(goal, facts, rows.get((goal.id, key)))

    vows = [ser(g, "vow") for g in daruma.VOW_POOL]
    taken = [v for v in vows if v["vowed"] and not v["claimed"]]

    # The unfulfilled ones burn at midnight (daruma kuyō), so an
    # unclaimed-but-complete daily is worth shouting about — this count
    # is what drives the badge on the home screen's hall card.
    #
    # 大願 only count once taken: an untaken vow whose target you happen
    # to have already passed is not claimable (see claim()'s "Vow was
    # never taken" guard), so counting it here would light a badge
    # pointing at a button that refuses. Must stay in step with
    # profile.py's _daruma_summary, which computes the same number.
    claimable = [
        *[ser(g, day_key) for g in dailies],
        *[ser(g, week_key) for g in weeklies],
        *[v for v in vows if v["vowed"]],
    ]
    ready = sum(1 for d in claimable if d["complete"] and not d["claimed"])

    mendable = srs.mendable_day(user_id)

    return {
        "daily": [ser(g, day_key) for g in dailies],
        "weekly": [ser(g, week_key) for g in weeklies],
        "vows": vows,
        "shelf": _shelf(user_id),
        "tokens": _tokens(user_id),
        "vowSlots": daruma.VOW_SLOTS,
        "vowsTaken": len(taken),
        "ready": ready,
        "streak": facts["streak_current"],
        "streakLongest": facts["streak_longest"],
        "rises": facts["rises_total"],
        "dueNow": facts["due_now"],
        # Present only when a token could actually buy a day back — the
        # frontend shows the 起 button off the existence of this field
        # rather than re-deriving the rule.
        "mendableDay": mendable.isoformat() if mendable else None,
        "dayKey": day_key,
        "weekKey": week_key,
    }


# ── Routes ────────────────────────────────────────────────────
@router.get("/api/daruma")
def get_hall(tz_offset: int = 0, user_id: str = Depends(get_user_id)):
    return _hall(user_id, tz_offset)


@router.post("/api/daruma/vow")
def take_vow(payload: GoalPayload, tz_offset: int = 0, user_id: str = Depends(get_user_id)):
    """Paint the first eye. Only 大願 need this — daily and weekly
    darumas come pre-vowed, because a rotating goal you have to accept
    every morning is a chore, while a long vow you have to accept is a
    decision."""
    goal = daruma.ALL_GOALS.get(payload.goal_id)
    if not goal or goal.kind != "vow":
        raise HTTPException(status_code=404, detail="No such vow")

    active = _active_vow_ids(user_id)
    if payload.goal_id in active:
        raise HTTPException(status_code=409, detail="Vow already taken")
    if len(active) >= daruma.VOW_SLOTS:
        raise HTTPException(status_code=409, detail="No free vow slot")

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO daruma_goals(user_id, goal_id, period_key, vowed_at)
                VALUES (%s, %s, 'vow', NOW())
                ON CONFLICT (user_id, goal_id, period_key) DO UPDATE SET vowed_at = NOW()
                """,
                (user_id, payload.goal_id),
            )
        conn.commit()
    finally:
        conn.close()

    return _hall(user_id, tz_offset)


@router.post("/api/daruma/release")
def release_vow(payload: GoalPayload, tz_offset: int = 0, user_id: str = Depends(get_user_id)):
    """Give the daruma back unfinished. Frees the slot, refunds nothing
    — which is the only thing that makes taking one a real choice."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM daruma_goals
                WHERE user_id = %s AND goal_id = %s AND period_key = 'vow'
                  AND claimed_at IS NULL
                """,
                (user_id, payload.goal_id),
            )
        conn.commit()
    finally:
        conn.close()

    return _hall(user_id, tz_offset)


@router.post("/api/daruma/claim")
def claim(payload: GoalPayload, tz_offset: int = 0, user_id: str = Depends(get_user_id)):
    """満願 — paint the second eye.

    Re-verifies completion server-side against live facts rather than
    trusting the button, awards the XP through the ledger (so it feeds
    the same level curve, level-up celebration and leaderboard a review
    does), banks any 起 tokens, and files the doll on the shelf.
    """
    goal = daruma.ALL_GOALS.get(payload.goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="No such daruma")

    today = datetime.now(timezone.utc).date()
    key = daruma.period_key(goal.kind, today)

    # A daily/weekly daruma is only claimable during the period it was
    # actually drawn for; asking for yesterday's is asking for a doll
    # that's already been burned.
    if goal.kind == "daily" and goal.id not in {g.id for g in daruma.daily_goals(user_id, today)}:
        raise HTTPException(status_code=409, detail="Not among today's darumas")
    if goal.kind == "weekly" and goal.id not in {g.id for g in daruma.weekly_goals(user_id, today)}:
        raise HTTPException(status_code=409, detail="Not among this week's darumas")

    existing = _rows_for(user_id, [(goal.id, key)]).get((goal.id, key), {})
    if existing.get("claimed_at"):
        raise HTTPException(status_code=409, detail="Already claimed")
    if goal.kind == "vow" and not existing.get("vowed_at"):
        raise HTTPException(status_code=409, detail="Vow was never taken")

    facts = srs.get_daruma_facts(user_id, tz_offset)
    if daruma.progress(goal, facts) < goal.target:
        raise HTTPException(status_code=409, detail="Not fulfilled yet")

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            # The WHERE claimed_at IS NULL is the actual guard against a
            # double-click awarding twice — the check above only narrows
            # the window, this closes it.
            cur.execute(
                """
                INSERT INTO daruma_goals(user_id, goal_id, period_key, vowed_at, claimed_at, reward_xp)
                VALUES (%s, %s, %s, COALESCE(%s, NOW()), NOW(), %s)
                ON CONFLICT (user_id, goal_id, period_key) DO UPDATE
                SET claimed_at = NOW(), reward_xp = EXCLUDED.reward_xp
                WHERE daruma_goals.claimed_at IS NULL
                RETURNING claimed_at
                """,
                (user_id, goal.id, key, existing.get("vowed_at"), goal.xp),
            )
            won = cur.fetchone() is not None
        conn.commit()
    finally:
        conn.close()

    if not won:
        raise HTTPException(status_code=409, detail="Already claimed")

    reward = srs.award_xp(user_id, "daruma", f"{goal.id}:{key}", goal.xp)
    if goal.tokens:
        _add_tokens(user_id, goal.tokens)

    hall = _hall(user_id, tz_offset)
    return {
        **hall,
        # Mirrors srs.review()'s reward keys so the frontend can hand
        # this straight to the existing XpToast without a translation
        # layer, level-up curtain and all.
        "reward": {
            "xpEarned": reward["xp_earned"],
            "tokensEarned": goal.tokens,
            "leveledUp": reward["leveled_up"],
            "newLevel": reward["new_level"],
            "goal": daruma.serialize(goal, facts, {"vowed_at": True, "claimed_at": True}),
            **level_progress(srs.get_lifetime_xp(user_id)),
        },
    }


@router.post("/api/daruma/rise")
def rise(tz_offset: int = 0, user_id: str = Depends(get_user_id)):
    """七転び八起き — spend one 起 token to buy back the day you missed
    and reconnect the streak. srs.mendable_day decides whether there's
    anything worth buying; there's no way to spend a token on a day it
    wouldn't actually save."""
    day = srs.mendable_day(user_id)
    if not day:
        raise HTTPException(status_code=409, detail="Nothing to mend")
    if _tokens(user_id) < 1:
        raise HTTPException(status_code=409, detail="No tokens")

    # Spend first: a token deducted for a mend that then fails is
    # recoverable by a support query, a mend granted for a token that
    # was never spent is free streaks forever.
    _add_tokens(user_id, -1)
    srs.mend_streak(user_id, day)

    return _hall(user_id, tz_offset)
