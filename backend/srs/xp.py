"""
XP and level curve.

Design (per product spec):
    xp_earned = base_xp(quality) * daily_multiplier(reviews_today) + streak_bonus

- base_xp: bigger reward for a confident correct answer than a shaky one.
- daily_multiplier: starts high and decays across the day's reviews —
  the first review of the day is worth close to double, and it eases
  back down toward 1x as you do more, so showing up daily matters more
  than grinding one huge session. Never drops below 1x (grinding is
  never *penalized*, it just stops being extra-rewarded).
- streak_bonus: a small, capped bonus banked once per day (on that
  first successful review), proportional to the current daily streak
  — a separate lever from daily_multiplier so long-term consistency
  and "did you show up today" are rewarded independently.

All constants below are first-pass placeholders — there's no usage
data yet to tune against, so treat these as a starting point, not
a final balance pass.
"""
import math

BASE_XP_BY_QUALITY = {
    0: 1,   # blackout — still worth a token amount for attempting
    1: 1,   # wrong, rated
    2: 2,   # wrong, but recognized
    3: 4,   # correct, hesitant
    4: 7,   # correct
    5: 10,  # perfect
}

# First review of the day is worth base * (1 + DAILY_BONUS_MAX).
# The bonus decays exponentially across the day's reviews, half-life
# controlled by DAILY_BONUS_DECAY (reviews, not minutes) — e.g. with
# DAILY_BONUS_DECAY=15, the bonus is ~37% left by review 15, ~14% by
# review 30, asymptoting toward 0 (i.e. multiplier -> 1.0) but never
# going negative.
DAILY_BONUS_MAX = 1.0
DAILY_BONUS_DECAY = 15

# Banked once per day, only on a successful (quality >= 3) first
# review of the day, capped so a very long streak doesn't dwarf the
# rest of the formula.
STREAK_BONUS_CAP = 10


def daily_multiplier(reviews_today: int) -> float:
    return 1.0 + DAILY_BONUS_MAX * math.exp(-reviews_today / DAILY_BONUS_DECAY)


def compute_review_xp(quality: int, reviews_today: int, streak_current: int) -> int:
    """
    reviews_today: how many reviews this user already logged today,
        *before* this one (so the very first review of the day passes 0).
    streak_current: the user's current daily streak *including* today,
        i.e. what get_streak() reports after today already has an entry.
        Only applied when this is the day's first review.
    """
    base = BASE_XP_BY_QUALITY.get(quality, 0)
    xp = base * daily_multiplier(reviews_today)

    if reviews_today == 0 and quality >= 3:
        xp += min(STREAK_BONUS_CAP, streak_current)

    return round(xp)


# ── Level curve ───────────────────────────────────────────
# Cumulative XP needed to REACH a level grows as level^1.5 rather than
# level^2 (quadratic) — still meaningfully harder at higher levels,
# but without the runaway wall a pure quadratic curve creates. Tune
# LEVEL_XP_BASE to shift the whole curve up/down without changing its
# shape.
LEVEL_XP_BASE = 60
LEVEL_XP_EXPONENT = 1.5


def xp_threshold(level: int) -> int:
    """Total cumulative XP required to *reach* `level` (level 1 = 0 XP)."""
    if level <= 1:
        return 0
    return round(LEVEL_XP_BASE * (level - 1) ** LEVEL_XP_EXPONENT)


def level_from_xp(xp: int) -> int:
    level = 1
    while xp_threshold(level + 1) <= xp:
        level += 1
    return level


def level_progress(xp: int) -> dict:
    """{ level, xp, xpPrevLevel, xpForNext } — the exact shape the
    Profile screen's XP ring/bar needs."""
    level = level_from_xp(xp)
    return {
        "level": level,
        "xp": xp,
        "xpPrevLevel": xp_threshold(level),
        "xpForNext": xp_threshold(level + 1),
    }