# ── The learner's JLPT level ─────────────────────────────────────
# The stored value lives in user_profiles.jlpt_level, written by the
# onboarding flow (routes/onboarding.py) and adjustable from Settings.
# `routes/profile.py`'s "level" is the XP/gamification level from
# srs/xp.py, which is a different concept entirely and must never be
# confused with this one.
#
# Every level-dependent decision routes through resolve_level() below,
# and no caller reads a level from anywhere else or hardcodes a default.
# Resolution order: an explicit request, then the stored learner level,
# then a conservative default.
#
# Precedence is deliberate: an explicit choice beats the stored level. A
# learner reading above their level on purpose should not be
# second-guessed by their own profile. Screens that ask per session
# (reading practice's TierPicker, the exam catalog, the deck browser)
# keep doing so; their choice lands here as `requested` and wins.
#
# See docs/adr/0005-learner-level-behind-a-resolver.md for the full
# reasoning, including the alternatives this rejected.
import logging
import time

from study.difficulty import LEVELS

DEFAULT_LEVEL = "N5"

# One entry per user: (level, expires_at). Only real levels are ever
# cached — a user with no stored level costs one PK SELECT per call,
# deliberately, so the moment onboarding completes the very next lookup
# sees the new level instead of a cached "nothing" (a fresh N2 graduate
# served N5 content for a cache lifetime would be the worst possible
# first impression). The TTL only bounds staleness across *other*
# uvicorn workers; the writing process is corrected instantly by
# note_stored_level() below.
_CACHE_TTL_S = 60.0
_cache: dict[str, tuple[str, float]] = {}


def _stored_level(user_id: str) -> str | None:
    cached = _cache.get(user_id)
    if cached is not None and cached[1] > time.monotonic():
        return cached[0]

    # Imported here rather than at module top: core/db.py opens its
    # connection pool at import time, and this module is imported by
    # study code that unit tests load without a DATABASE_URL.
    from core.db import db_conn

    try:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT jlpt_level FROM user_profiles WHERE user_id = %s",
                    (user_id,),
                )
                row = cur.fetchone()
        finally:
            conn.close()
    except Exception:
        # The docstring's contract: level resolution must never 500 a
        # study screen. A DB hiccup here degrades to DEFAULT_LEVEL for
        # one request; anything that actually needs the DB will report
        # the real failure itself.
        logging.getLogger(__name__).exception("stored-level lookup failed")
        return None

    level = row[0] if row else None
    if level in LEVELS:
        _cache[user_id] = (level, time.monotonic() + _CACHE_TTL_S)
        return level
    return None


def note_stored_level(user_id: str, level: str) -> None:
    """Write-through: called by the endpoints that just wrote
    user_profiles.jlpt_level, so this process answers with the new
    level immediately instead of after the TTL."""
    if level in LEVELS:
        _cache[user_id] = (level, time.monotonic() + _CACHE_TTL_S)


def resolve_level(user_id: str, requested: str | None = None) -> str:
    """The JLPT level to treat `user_id` as, for one request.

    `requested` is whatever a caller already has in hand (a session
    picker, a URL parameter). A value that isn't a real level is ignored
    rather than raised -- a bad query parameter must not 500 a study
    screen -- and resolution falls through to the next step exactly as if
    nothing had been requested. The same defence applies to the stored
    value: garbage in the column falls through to the default.
    """
    if requested in LEVELS:
        return requested

    stored = _stored_level(user_id)
    if stored in LEVELS:
        return stored

    return DEFAULT_LEVEL
