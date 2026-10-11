"""
XP and level curve.

Design (per product spec):
    xp_earned = base_xp(quality) * daily_multiplier(reviews_today)

- base_xp: bigger reward for a confident correct answer than a shaky one.
- daily_multiplier: starts high and decays across the day's reviews —
  the first review of the day is worth close to double, and it eases
  back down toward 1x as you do more, so showing up daily matters more
  than grinding one huge session. Never drops below 1x (grinding is
  never *penalized*, it just stops being extra-rewarded).

The streak is paid once a day, and no longer on a review (plan 191,
終着). A small bonus banked on the day's first good review used to ride
on compute_review_xp -- ten XP at most, on a card nobody noticed. It is
folded into the day's bonus below, paid when the day is CLEARED (the
queue empty, and the learner told so), where it is seen and grows with
the streak (day_clear_bonus), with a jackpot on the milestone days
(JACKPOTS). Long-term consistency and "did you show up today" are still
rewarded apart: the first by the day's bonus, the second by
daily_multiplier.

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
# The bonus decays exponentially across the day's reviews, its time
# constant DAILY_BONUS_DECAY (reviews, not minutes; not a half-life — the
# bonus falls to 1/e, not 1/2, over that many reviews) — e.g. with
# DAILY_BONUS_DECAY=15, the bonus is ~37% left by review 15, ~14% by
# review 30, asymptoting toward 0 (i.e. multiplier -> 1.0) but never
# going negative.
DAILY_BONUS_MAX = 1.0
DAILY_BONUS_DECAY = 15


def daily_multiplier(reviews_today: int) -> float:
    return 1.0 + DAILY_BONUS_MAX * math.exp(-reviews_today / DAILY_BONUS_DECAY)


def compute_review_xp(quality: int, reviews_today: int) -> int:
    """
    reviews_today: how many reviews this user already logged today,
        *before* this one (so the very first review of the day passes 0).
    """
    base = BASE_XP_BY_QUALITY.get(quality, 0)
    return round(base * daily_multiplier(reviews_today))


# ── 終着 — the day cleared (plan 191) ──────────────────────
# Paid once per UTC day, when the day's queue is empty and at least one
# card was reviewed: a bonus that grows with the streak, five XP a day
# up to DAY_CLEAR_CAP days, and on a milestone day a jackpot on top.
DAY_CLEAR_BASE = 25
DAY_CLEAR_PER_DAY = 5
DAY_CLEAR_CAP = 60

# The milestone days and what each pays. Past the year, every hundredth
# day is a milestone too (400, 500, ...), at JACKPOT_EVERY_PAYS.
JACKPOTS = {3: 100, 7: 250, 14: 500, 30: 1000, 50: 1500, 100: 3000, 200: 5000, 365: 10000}
JACKPOT_EVERY = 100
JACKPOT_EVERY_PAYS = 3000
_LAST_LISTED = max(JACKPOTS)

# 運休 — a rest day (plan 191). A ticket is earned on clearing a
# milestone day of REST_FROM or more, and at most REST_HELD_MAX are held
# at once: one earned past that is not kept.
REST_FROM = 7
REST_HELD_MAX = 2

# The first milestone the month's ceremony plays for (clear_tier).
MONTH_FROM = 30


def day_clear_bonus(streak: int) -> int:
    """The day's bonus for clearing it on day `streak` of the streak."""
    return DAY_CLEAR_BASE + DAY_CLEAR_PER_DAY * min(max(streak, 0), DAY_CLEAR_CAP)


def milestone_at(streak: int) -> int | None:
    """The milestone reached on day `streak`, or None on an ordinary day."""
    if streak in JACKPOTS:
        return streak
    if streak > _LAST_LISTED and streak % JACKPOT_EVERY == 0:
        return streak
    return None


def jackpot_for(milestone: int | None) -> int:
    """What a milestone pays on top of the day's bonus; 0 for none, and
    for a day that is no milestone."""
    if milestone is None or milestone_at(milestone) != milestone:
        return 0
    return JACKPOTS.get(milestone, JACKPOT_EVERY_PAYS)


def next_milestone(streak: int) -> int:
    """The first milestone strictly after day `streak`. There is always
    one: past the year, every hundredth day is."""
    for day in sorted(JACKPOTS):
        if day > streak:
            return day
    return (streak // JACKPOT_EVERY + 1) * JACKPOT_EVERY


def next_rest_at(after: int) -> int:
    """The first milestone strictly after day `after` that earns a rest
    day (REST_FROM or more)."""
    day = next_milestone(after)
    while day < REST_FROM:
        day = next_milestone(day)
    return day


def clear_tier(milestone: int | None) -> str:
    """Which ceremony a clear plays: "day" on an ordinary day, "ticket"
    on the first milestones (3, 7, 14), "month" from the thirtieth day."""
    if milestone is None:
        return "day"
    return "month" if milestone >= MONTH_FROM else "ticket"


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
