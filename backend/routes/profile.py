import csv
import io
import logging
import random
import re
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from psycopg2 import errors as pg_errors
from pydantic import BaseModel, field_validator

from core.db import db_conn
from core.auth import get_user_id
from core.srs_instance import srs
from core.user_level import LEVELS, note_stored_level
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
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    jlpt_level TEXT,
                    daily_new_target INTEGER,
                    onboarded_at TIMESTAMPTZ,
                    goal_start_level TEXT,
                    goal_level TEXT,
                    goal_target_date DATE,
                    goal_set_at TIMESTAMPTZ,
                    daily_departure TEXT,
                    rating_scale TEXT
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
            #
            # The goal_* columns are the journey contract (plan 063):
            # goal_level + goal_target_date are the destination printed
            # on the pass (both NULL = "just ride"), goal_start_level
            # remembers where the line began — jlpt_level moves as the
            # learner levels up, and itemsTotal must not drift with it —
            # and goal_set_at anchors the itemsDone window. All written
            # only by routes/onboarding.py and routes/journey.py.
            # daily_departure is the optional habit hour ('am'|'noon'|
            # 'pm', NULL = flexible), validated in code like jlpt_level.
            #
            # rating_scale is which rating bar the learner grades with —
            # 'simple' (the four buttons they actually use), 'binary'
            # (just wrong and correct) or 'full' (all six). NULL means
            # "not chosen", which reads as the default; see
            # RATING_SCALES below and
            # frontend/src/domain/ratingScales.js, which owns the
            # buttons themselves. Deliberately NOT a change of scale:
            # both bars send the same 0..5 quality, so a learner can
            # switch without their own history changing meaning.
            for col, typ in (
                ("jlpt_level", "TEXT"),
                ("daily_new_target", "INTEGER"),
                ("onboarded_at", "TIMESTAMPTZ"),
                ("goal_start_level", "TEXT"),
                ("goal_level", "TEXT"),
                ("goal_target_date", "DATE"),
                ("goal_set_at", "TIMESTAMPTZ"),
                ("daily_departure", "TEXT"),
                ("rating_scale", "TEXT"),
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
    """(username, jlpt_level, daily_new_target, onboarded_at,
    rating_scale) — seeding the row lazily like _get_or_create_username,
    whose creation path it reuses. The onboarding fields are NULL until
    the flow runs, and rating_scale until the learner changes it."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT username, jlpt_level, daily_new_target, onboarded_at,
                       rating_scale
                FROM user_profiles WHERE user_id = %s
                """,
                (user_id,),
            )
            row = cur.fetchone()
            if row:
                return row
    finally:
        conn.close()
    return (_get_or_create_username(user_id), None, None, None, None)


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


# Which rating bar the learner grades with. The buttons live in
# frontend/src/domain/ratingScales.js; the backend only stores the
# choice, because both bars send the same canonical 0..5 quality (see
# srs/scheduler.py's PASS/FAIL tables) and nothing downstream needs to
# know which one was on screen.
RATING_SCALES = ("binary", "simple", "full")
DEFAULT_RATING_SCALE = "simple"


class LearningPayload(BaseModel):
    """Settings' partial update of the onboarding fields. All optional;
    a PATCH sending none of them is a caller bug and 422s. Deliberately
    never touches onboarded_at — changing your level later is not
    re-onboarding."""
    jlptLevel: str | None = None
    dailyNewTarget: int | None = None
    ratingScale: str | None = None

    @field_validator("ratingScale")
    @classmethod
    def valid_rating_scale(cls, v: str | None) -> str | None:
        if v is not None and v not in RATING_SCALES:
            raise ValueError(f"ratingScale must be one of {RATING_SCALES}")
        return v

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


# ── Records ───────────────────────────────────────────────────
# The three figures the pass holder prints beside the stamp book:
# reviews, retention and the best perfect run. Computed once, here,
# because they are the whole of what the profile counts.
def _records(user_id: str) -> dict:
    return {
        "total_reviews": srs.get_total_reviews(user_id),
        # Longest unbroken run of "good or better" answers — a personal
        # best, shown as such.
        "best_quality_streak": srs.get_best_quality_streak(user_id, min_quality=4),
        # Correct over all answers, 0..1 — None before the first review.
        "retention": srs.get_retention(user_id),
    }


# The stamp book on the profile draws five whole Monday-to-Sunday weeks
# ending on the current one: at most 28 days back to that week's Monday
# plus the six days before it, so 35 covers the sheet on any weekday.
CALENDAR_DAYS = 35


# ── Routes ────────────────────────────────────────────────────
@router.get("/api/profile")
def get_profile(user_id: str = Depends(get_user_id)):
    username, jlpt_level, daily_new_target, onboarded_at, rating_scale = _profile_row(user_id)
    xp = srs.get_lifetime_xp(user_id)
    progress = level_progress(xp)
    streak = srs.get_streak(user_id)
    records = _records(user_id)

    # One query for the sheet; the week the home hall's stamp rally and
    # every other consumer of `week` still read is sliced off it rather
    # than asked for again. Same helper the stats calendar uses.
    calendar = srs.get_daily_review_counts(user_id, days=CALENDAR_DAYS)
    week_from = (datetime.now(timezone.utc).date() - timedelta(days=6)).isoformat()

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
        # Which rating bar to draw. Resolved here rather than in the
        # client so a learner who has never opened settings still gets a
        # named scale instead of a null the bar has to guess at.
        "ratingScale": rating_scale or DEFAULT_RATING_SCALE,
        "streak": streak["current"],
        "streakLongest": streak["longest"],
        "totalReviews": records["total_reviews"],
        "bestQualityStreak": records["best_quality_streak"],
        "retention": records["retention"],
        # The last seven days of activity (the hall's stamp rally), and
        # the five weeks behind them (the profile's stamp book). Days
        # without a review are simply absent from both.
        "week": [d for d in calendar if d["date"] >= week_from],
        "calendar": calendar,
    }


@router.get("/api/profile/export")
def export_progress(user_id: str = Depends(get_user_id)):
    """
    The learner's whole SRS state as one CSV — the settings screen's
    データ counter serves it as a download.

    Raw card_modes columns rather than the stats screen's buckets: an
    export exists so the data can leave the app (a spreadsheet, Anki,
    a backup before a reset), and aggregates cannot be un-aggregated.
    One row per (card, mode), same granularity the scheduler itself
    keeps. The user prefix is stripped from card_id — it is an
    implementation detail of shared tables (see core/auth.prefixed),
    not part of the learner's data.
    """
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            # Same LIKE-prefix pattern reset_stats uses for the same rows.
            cur.execute(
                """
                SELECT card_id, mode, interval_days, next_review,
                       total_reviews, correct_reviews
                FROM card_modes
                WHERE card_id LIKE %s
                ORDER BY card_id, mode
                """,
                (f"{user_id}:%",),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    prefix_len = len(user_id) + 1
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow([
        "card_id", "mode", "interval_days", "next_review",
        "total_reviews", "correct_reviews",
    ])
    for card_id, mode, interval_days, next_review, total, correct in rows:
        writer.writerow([
            card_id[prefix_len:],
            mode,
            interval_days,
            next_review.isoformat() if next_review else "",
            total,
            correct,
        ])

    logger.info("progress export user_id=%s rows=%d", user_id, len(rows))
    return PlainTextResponse(
        buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="nihongo-progress.csv"'},
    )


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
    if not payload.model_fields_set:
        raise HTTPException(status_code=422, detail="Nothing to update")
    _get_or_create_username(user_id)  # ensure a row exists to update
    sets, args = [], []
    if payload.jlptLevel is not None:
        sets.append("jlpt_level = %s")
        args.append(payload.jlptLevel)
    if payload.dailyNewTarget is not None:
        sets.append("daily_new_target = %s")
        args.append(payload.dailyNewTarget)
    if payload.ratingScale is not None:
        sets.append("rating_scale = %s")
        args.append(payload.ratingScale)
    if not sets:
        raise HTTPException(status_code=422, detail="Nothing to update")
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
    return {
        "jlptLevel": payload.jlptLevel,
        "dailyNewTarget": payload.dailyNewTarget,
        "ratingScale": payload.ratingScale,
    }


@router.get("/api/leaderboard")
def get_leaderboard(
    limit: int = Query(20, ge=1, le=200),
    # 通算 or 今週 — the 番付's two sides of the same sums. A week is the
    # one span a learner can actually move tonight; anything finer is
    # noise and anything coarser is the lifetime board again.
    period: Literal["all", "week"] = Query("all"),
    user_id: str = Depends(get_user_id),
):
    days = 7 if period == "week" else None
    top = srs.get_leaderboard(limit=limit, days=days)
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
        mine = srs.get_user_rank(user_id, days=days)
        me = {
            "rank": mine["rank"],
            "username": _get_or_create_username(user_id),
            "xp": mine["xp"],
            "level": level_progress(mine["xp"])["level"],
        }

    return {"entries": entries, "me": me}