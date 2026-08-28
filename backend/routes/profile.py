import logging
import random
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from psycopg2 import errors as pg_errors
from pydantic import BaseModel, field_validator

from core.db import db_conn
from core.auth import get_user_id
from core.srs_instance import srs
from core.user_level import LEVELS, note_stored_level
from srs import daruma
from srs.xp import level_progress
from routes.cosmetics import summary_for as cosmetics_summary

router = APIRouter()
logger = logging.getLogger(__name__)

# ── user_profiles bootstrap ──────────────────────────────────
# Lightweight and separate from the SRS engine's own _init_db (this
# table isn't SRS data) — created once, here, using the same db_conn()
# stats.py already reaches for outside the SRS engine's connection pool.
def _init_db() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS user_profiles (
                    user_id TEXT PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    jlpt_level TEXT,
                    daily_new_target INTEGER,
                    onboarded_at TIMESTAMPTZ
                )
            """)
            # And the same columns again as ALTERs, because the table
            # already exists for every current user: CREATE TABLE IF
            # NOT EXISTS is a no-op on them, so onboarding's fields
            # would otherwise only exist for brand-new installs.
            # jlpt_level is the learner's own JLPT level (N5..N1) — a
            # different concept from the XP level this module also
            # serves; see core/user_level.py and docs/adr/0005. All
            # three stay NULL until the onboarding flow completes;
            # NULL onboarded_at is what makes the frontend show it.
            for col, typ in (
                ("jlpt_level", "TEXT"),
                ("daily_new_target", "INTEGER"),
                ("onboarded_at", "TIMESTAMPTZ"),
            ):
                cur.execute(
                    f"ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS {col} {typ}"
                )
        conn.commit()
    finally:
        conn.close()


_init_db()

# ── Username generation ──────────────────────────────────────
_ADJECTIVES = ["Swift", "Silent", "Lucky", "Bold", "Calm", "Bright", "Quiet", "Keen"]
_NOUNS = ["Ronin", "Kitsune", "Sensei", "Samurai", "Ninja", "Sakura", "Tsuki", "Hikari"]

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,20}$")


def _random_username() -> str:
    return f"{random.choice(_ADJECTIVES)}{random.choice(_NOUNS)}{random.randint(100, 9999)}"


def _get_or_create_username(user_id: str) -> str:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT username FROM user_profiles WHERE user_id = %s", (user_id,))
            row = cur.fetchone()
            if row:
                return row[0]

            # Lazily seed a profile the first time this user is seen —
            # retry on the (very unlikely) random-name collision rather
            # than failing the request.
            for _ in range(5):
                candidate = _random_username()
                try:
                    cur.execute(
                        "INSERT INTO user_profiles(user_id, username) VALUES (%s, %s)",
                        (user_id, candidate),
                    )
                    conn.commit()
                    return candidate
                except pg_errors.UniqueViolation:
                    conn.rollback()
            raise HTTPException(status_code=500, detail="Could not allocate a username")
    finally:
        conn.close()


def ensure_profile_row(user_id: str) -> str:
    """Public seam for other route modules (routes/onboarding.py): make
    sure a user_profiles row exists before UPDATEing it, and get the
    username back. Same lazy-seeding as GET /api/profile itself."""
    return _get_or_create_username(user_id)


def _profile_row(user_id: str) -> tuple:
    """(username, jlpt_level, daily_new_target, onboarded_at) — seeding
    the row lazily like _get_or_create_username, whose creation path it
    reuses. The three onboarding fields are NULL until the flow runs."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT username, jlpt_level, daily_new_target, onboarded_at
                FROM user_profiles WHERE user_id = %s
                """,
                (user_id,),
            )
            row = cur.fetchone()
            if row:
                return row
    finally:
        conn.close()
    return (_get_or_create_username(user_id), None, None, None)


def _usernames_for(user_ids: list[str]) -> dict[str, str]:
    if not user_ids:
        return {}
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT user_id, username FROM user_profiles WHERE user_id = ANY(%s)",
                (user_ids,),
            )
            return dict(cur.fetchall())
    finally:
        conn.close()


class UsernamePayload(BaseModel):
    username: str

    @field_validator("username")
    @classmethod
    def valid_username(cls, v: str) -> str:
        if not USERNAME_RE.match(v):
            raise ValueError("3-20 characters: letters, numbers, underscore only")
        return v


class LearningPayload(BaseModel):
    """Settings' partial update of the onboarding fields. Both optional;
    a PATCH sending neither is a caller bug and 422s. Deliberately never
    touches onboarded_at — changing your level later is not re-onboarding."""
    jlptLevel: str | None = None
    dailyNewTarget: int | None = None

    @field_validator("jlptLevel")
    @classmethod
    def valid_level(cls, v: str | None) -> str | None:
        if v is not None and v not in LEVELS:
            raise ValueError(f"must be one of {', '.join(LEVELS)}")
        return v

    @field_validator("dailyNewTarget")
    @classmethod
    def valid_target(cls, v: int | None) -> int | None:
        # The UI offers 5/10/20, but the column is a free integer knob;
        # the bound only keeps out nonsense, not future paces.
        if v is not None and not (1 <= v <= 100):
            raise ValueError("must be between 1 and 100")
        return v


# ── Goals ─────────────────────────────────────────────────────
# Goals themselves moved to the Daruma Hall (routes/daruma.py) — this
# is only the summary the profile card and the home screen's hall badge
# need: today's three darumas at a glance, plus how many darumas
# anywhere are sitting complete and unclaimed, which is the number that
# earns a dot on the nav card.
def _daruma_summary(user_id: str) -> dict:
    today = datetime.now(timezone.utc).date()
    facts = srs.get_daruma_facts(user_id)
    day_key = daruma.period_key("daily", today)
    week_key = daruma.period_key("weekly", today)

    dailies = daruma.daily_goals(user_id, today)
    weeklies = daruma.weekly_goals(user_id, today)
    vows = daruma.VOW_POOL

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT goal_id, period_key, vowed_at, claimed_at
                FROM daruma_goals
                WHERE user_id = %s AND period_key IN (%s, %s, 'vow')
                """,
                (user_id, day_key, week_key),
            )
            rows = {
                (gid, period): {"vowed_at": vowed, "claimed_at": claimed}
                for gid, period, vowed, claimed in cur.fetchall()
            }
    except Exception:
        # The hall's tables are created by routes/daruma.py's own
        # bootstrap; if that hasn't run (or the query fails for any
        # other reason) the profile screen shouldn't 500 over a
        # decorative summary.
        logger.exception("daruma summary failed")
        conn.rollback()
        rows = {}
    finally:
        conn.close()

    def ser(goal, key):
        return daruma.serialize(goal, facts, rows.get((goal.id, key)))

    today_dolls = [ser(g, day_key) for g in dailies]
    everything = (
        today_dolls
        + [ser(g, week_key) for g in weeklies]
        # An unvowed 大願 that happens to be satisfied isn't claimable,
        # so it must not light the badge either.
        + [d for d in (ser(g, "vow") for g in vows) if d["vowed"]]
    )

    return {
        "today": today_dolls,
        "ready": sum(1 for d in everything if d["complete"] and not d["claimed"]),
    }


# ── Badges ────────────────────────────────────────────────────
# (id, glyph, fact, target) — every badge is one fact reaching one
# number, so they are declared as data rather than as predicates.
#
# Two things fall out of that. A locked badge can now say how far off
# it is, which is the difference between a badge and a decoration: you
# cannot chase "10 sans-faute d'affilée" if the app will not tell you
# that you are on 7. And the labels are gone from here entirely —
# they were hardcoded French strings shipped to every client, so an
# English user's profile has always shown six French badge names. The
# id travels instead and the frontend names it (see t.badgeName).
_BADGE_DEFS = [
    ("first_steps",   "初", "total_reviews",       1),
    ("week_streak",   "週", "streak_longest",      7),
    ("month_streak",  "月", "streak_longest",     30),
    ("kanji_100",     "百", "mastered_count",    100),
    ("perfectionist", "極", "best_quality_streak", 10),
    ("dedicated",     "皆", "total_reviews",     500),
]


def _badge_facts(user_id: str, streak: dict) -> dict:
    """The numbers every badge predicate needs — and, as it turns out,
    the numbers the profile screen wants to show. Computed once."""
    return {
        "total_reviews": srs.get_total_reviews(user_id),
        "mastered_count": srs.get_mastered_count(user_id),
        "best_quality_streak": srs.get_best_quality_streak(user_id, min_quality=4),
        "streak_longest": streak["longest"],
    }


def _badges(facts: dict) -> list[dict]:
    out = []
    for bid, glyph, fact, target in _BADGE_DEFS:
        have = int(facts[fact])
        out.append({
            "id": bid,
            "glyph": glyph,
            "unlocked": have >= target,
            # Capped at the target so a badge earned long ago reads
            # "500 / 500" rather than "4 210 / 500".
            "progress": min(have, target),
            "target": target,
        })
    return out


# ── Routes ────────────────────────────────────────────────────
@router.get("/api/profile")
def get_profile(user_id: str = Depends(get_user_id)):
    username, jlpt_level, daily_new_target, onboarded_at = _profile_row(user_id)
    xp = srs.get_lifetime_xp(user_id)
    progress = level_progress(xp)
    streak = srs.get_streak(user_id)
    facts = _badge_facts(user_id, streak)

    return {
        "username": username,
        **progress,
        # The learner's own JLPT level — deliberately NOT "level", which
        # is the XP level spread in from `progress` above. NULL until
        # onboarding completes; null onboardedAt is what tells App.jsx
        # to show the flow. See core/user_level.py and docs/adr/0005.
        "jlptLevel": jlpt_level,
        "dailyNewTarget": daily_new_target,
        "onboardedAt": onboarded_at.isoformat() if onboarded_at else None,
        "streak": streak["current"],
        "streakLongest": streak["longest"],
        "totalReviews": facts["total_reviews"],
        # Longest unbroken run of "good or better" answers. Already
        # computed for the 極 badge's predicate and previously
        # discarded; the profile shows it as a personal best.
        "bestQualityStreak": facts["best_quality_streak"],
        # The last seven days of activity, for the 今週 strip. Same
        # helper the stats screen's practice calendar uses, asked for a
        # week instead of a year.
        "week": srs.get_daily_review_counts(user_id, days=7),
        "daruma": _daruma_summary(user_id),
        # Loadout + mastery rank ride along on the one profile fetch
        # every screen already makes, so applying a paper skin or a
        # ring never costs a second request (see components/
        # cosmetics.js, which stamps them onto <html>).
        "cosmetics": cosmetics_summary(user_id),
        "badges": _badges(facts),
    }


@router.patch("/api/profile")
def update_profile(payload: UsernamePayload, user_id: str = Depends(get_user_id)):
    _get_or_create_username(user_id)  # ensure a row exists to update
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    "UPDATE user_profiles SET username = %s WHERE user_id = %s",
                    (payload.username, user_id),
                )
                conn.commit()
            except pg_errors.UniqueViolation:
                conn.rollback()
                raise HTTPException(status_code=409, detail="Username already taken")
    finally:
        conn.close()
    return {"username": payload.username}


@router.patch("/api/profile/learning")
def update_learning(payload: LearningPayload, user_id: str = Depends(get_user_id)):
    if payload.jlptLevel is None and payload.dailyNewTarget is None:
        raise HTTPException(status_code=422, detail="Nothing to update")
    _get_or_create_username(user_id)  # ensure a row exists to update
    sets, args = [], []
    if payload.jlptLevel is not None:
        sets.append("jlpt_level = %s")
        args.append(payload.jlptLevel)
    if payload.dailyNewTarget is not None:
        sets.append("daily_new_target = %s")
        args.append(payload.dailyNewTarget)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE user_profiles SET {', '.join(sets)} WHERE user_id = %s",
                (*args, user_id),
            )
        conn.commit()
    finally:
        conn.close()
    if payload.jlptLevel is not None:
        # Write-through so this worker's resolver answers with the new
        # level immediately rather than after its TTL.
        note_stored_level(user_id, payload.jlptLevel)
    return {"jlptLevel": payload.jlptLevel, "dailyNewTarget": payload.dailyNewTarget}


@router.get("/api/leaderboard")
def get_leaderboard(limit: int = Query(20, ge=1, le=200), user_id: str = Depends(get_user_id)):
    top = srs.get_leaderboard(limit=limit)
    names = _usernames_for([e["user_id"] for e in top])

    entries = [
        {
            "rank": i + 1,
            "username": names.get(e["user_id"]) or _get_or_create_username(e["user_id"]),
            "xp": e["xp"],
            "level": level_progress(e["xp"])["level"],
        }
        for i, e in enumerate(top)
    ]

    # If the current user isn't already in the top N, tell the frontend
    # their real rank/XP separately so the screen can still say "you're
    # #47" instead of just omitting them.
    me = next((e for e in entries if e["username"] == names.get(user_id)), None)
    if me is None:
        mine = srs.get_user_rank(user_id)
        me = {
            "rank": mine["rank"],
            "username": _get_or_create_username(user_id),
            "xp": mine["xp"],
            "level": level_progress(mine["xp"])["level"],
        }

    return {"entries": entries, "me": me}