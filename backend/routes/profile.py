import logging
import random
import re

from fastapi import APIRouter, Depends, HTTPException
from psycopg2 import errors as pg_errors
from pydantic import BaseModel, field_validator

from db import db_conn
from auth import get_user_id
from srs_instance import srs
from srs.xp import level_progress

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
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
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


# ── Goals ─────────────────────────────────────────────────────
# First-pass fixed targets — not personalized/adaptive yet, just real
# progress against real activity instead of static mock numbers.
DAILY_REVIEW_TARGET = 30
WEEKLY_REVIEW_TARGET = 150
STREAK_GOAL_TARGET = 30


def _goals(user_id: str, streak_current: int) -> list[dict]:
    reviews_today = srs.get_reviews_today(user_id)
    trend = srs.get_daily_review_counts(user_id, days=7)
    reviews_this_week = sum(d["count"] for d in trend)

    return [
        {
            "id": "daily",
            "label": "Révisions du jour",
            "current": min(reviews_today, DAILY_REVIEW_TARGET),
            "target": DAILY_REVIEW_TARGET,
            "rewardXp": 20,
        },
        {
            "id": "weekly",
            "label": "Révisions cette semaine",
            "current": min(reviews_this_week, WEEKLY_REVIEW_TARGET),
            "target": WEEKLY_REVIEW_TARGET,
            "rewardXp": 80,
        },
        {
            "id": "streak",
            "label": "Garder la série en vie",
            "current": min(streak_current, STREAK_GOAL_TARGET),
            "target": STREAK_GOAL_TARGET,
            "rewardXp": 150,
        },
    ]


# ── Badges ────────────────────────────────────────────────────
# (id, glyph, label, predicate) — predicate receives the same facts
# dict every badge check needs, computed once up front so adding a
# badge never means adding a new query.
def _badge_defs():
    return [
        ("first_steps", "初", "Premiers pas", lambda f: f["total_reviews"] >= 1),
        ("week_streak", "週", "7 jours de série", lambda f: f["streak_longest"] >= 7),
        ("month_streak", "月", "30 jours de série", lambda f: f["streak_longest"] >= 30),
        ("kanji_100", "百", "100 cartes maîtrisées", lambda f: f["mastered_count"] >= 100),
        ("perfectionist", "極", "10 sans-faute d'affilée", lambda f: f["best_quality_streak"] >= 10),
        ("dedicated", "皆", "500 révisions", lambda f: f["total_reviews"] >= 500),
    ]


def _badges(user_id: str, streak: dict) -> list[dict]:
    facts = {
        "total_reviews": srs.get_total_reviews(user_id),
        "mastered_count": srs.get_mastered_count(user_id),
        "best_quality_streak": srs.get_best_quality_streak(user_id, min_quality=4),
        "streak_longest": streak["longest"],
    }
    return [
        {"id": bid, "glyph": glyph, "label": label, "unlocked": bool(pred(facts))}
        for bid, glyph, label, pred in _badge_defs()
    ]


# ── Routes ────────────────────────────────────────────────────
@router.get("/api/profile")
def get_profile(user_id: str = Depends(get_user_id)):
    username = _get_or_create_username(user_id)
    xp = srs.get_lifetime_xp(user_id)
    progress = level_progress(xp)
    streak = srs.get_streak(user_id)
    total_reviews = srs.get_total_reviews(user_id)

    return {
        "username": username,
        **progress,
        "streak": streak["current"],
        "streakLongest": streak["longest"],
        "totalReviews": total_reviews,
        "goals": _goals(user_id, streak["current"]),
        "badges": _badges(user_id, streak),
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


@router.get("/api/leaderboard")
def get_leaderboard(limit: int = 20, user_id: str = Depends(get_user_id)):
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