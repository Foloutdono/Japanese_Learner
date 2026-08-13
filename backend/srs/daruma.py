"""
達磨 — the Daruma goal system.

The ritual this is built on is a real one. You buy a daruma blank-eyed,
paint in its LEFT eye when you make the vow (願掛け kakegake), and paint
in the RIGHT eye only once the vow is fulfilled (満願 mangan). Until then
it sits there, half-blind, watching you not do the thing. At the year's
end the unfulfilled ones are burned at the temple and you buy another —
which is exactly what a rotating daily/weekly goal is, so the mechanic
and the metaphor are the same object rather than a theme painted onto
one.

Its motto — 七転び八起き, "fall seven times, rise eight" — is the other
half: a daruma is bottom-weighted and always rights itself. That's the
streak-mend token (see `rises` / `mend_streak`), and it's why a broken
streak here costs a resource instead of costing the streak.

This module is pure logic: the goal catalogue, the colour/rarity
vocabulary, deterministic per-period selection, and evaluation of a
goal against a facts dict. Nothing here touches the database — see
`SRSEngine.get_daruma_facts` for where the facts come from and
`routes/daruma.py` for the ritual state (vowed/completed/claimed).

Labels live in the frontend locale files, keyed by goal id — the
backend deliberately sends no display copy, because the last version
of this feature shipped French labels to English users.
"""
import random
from dataclasses import dataclass

# ── Colours ───────────────────────────────────────────────────
# Real daruma colours carry real meanings, and they line up almost
# suspiciously well with categories of study goal — blue is literally
# the "study and career" daruma. Each goal below picks the colour a
# shop would actually sell you for that wish, so the shelf ends up
# colour-coded by what kind of learner you've been without anyone
# having to invent a legend for it.
COLORS = {
    "aka":      "赤",   # luck, protection — the default daruma
    "kin":      "金",   # fortune, wealth
    "shiro":    "白",   # purity, harmony, a clean goal
    "murasaki": "紫",   # health, longevity
    "ao":       "青",   # study, career success
    "midori":   "緑",   # health, fitness
    "kuro":     "黒",   # warding off misfortune
    "momo":     "桃",   # love, affection
}

# 並 common · 上 fine · 特 special · 極 ultimate. Drives nothing but the
# shelf's presentation weight — a 極 daruma gets the gold-leaf ring, the
# same escalation CardStamp/StageBadge already use for 'mastered'.
RARITIES = ("nami", "jou", "toku", "kiwami")

# How many 大願 (great vows) can be held open at once. The cap is the
# whole point of the mechanic: a vow you can't abandon for free is a
# real choice, and three of them is enough to feel like a loadout
# without turning the screen into a checklist.
VOW_SLOTS = 3

# Accuracy goals need a floor, or one lucky review is a 100% day.
ACCURACY_MIN_REVIEWS = 20


@dataclass(frozen=True)
class Goal:
    id: str
    kind: str      # 'daily' | 'weekly' | 'vow'
    metric: str    # key into the facts dict
    target: int
    glyph: str     # the kanji painted on the daruma's belly
    color: str     # key into COLORS
    rarity: str
    xp: int
    tokens: int = 0


# ── Daily pool ────────────────────────────────────────────────
# Three are drawn per day. Everything here is reachable inside one
# sitting; nothing here needs yesterday to have gone well.
DAILY_POOL = [
    Goal("daily_reviews_30",  "daily", "reviews_today",     30,  "行", "aka",      "nami", 25),
    Goal("daily_reviews_60",  "daily", "reviews_today",     60,  "精", "aka",      "jou",  45),
    Goal("daily_reviews_120", "daily", "reviews_today",     120, "鍛", "kuro",     "toku", 80),
    Goal("daily_new_5",       "daily", "new_cards_today",   5,   "芽", "midori",   "nami", 30),
    Goal("daily_new_15",      "daily", "new_cards_today",   15,  "拓", "midori",   "jou",  55),
    Goal("daily_perfect_10",  "daily", "perfect_run_today", 10,  "一", "kin",      "jou",  40),
    Goal("daily_perfect_20",  "daily", "perfect_run_today", 20,  "無", "kin",      "toku", 75),
    Goal("daily_accuracy_85", "daily", "accuracy_today",    85,  "正", "shiro",    "jou",  40),
    Goal("daily_clear_due",   "daily", "due_cleared",       1,   "空", "ao",       "toku", 60),
    Goal("daily_breadth_3",   "daily", "categories_today",  3,   "方", "murasaki", "jou",  40),
    Goal("daily_dawn",        "daily", "dawn_today",        1,   "暁", "momo",     "jou",  35),
    Goal("daily_night",       "daily", "night_today",       1,   "宵", "murasaki", "nami", 30),
    Goal("daily_xp_150",      "daily", "xp_today",          150, "気", "kin",      "nami", 30),
]

# The day always draws one of these first, so there is never a morning
# where all three goals depend on something outside your control (a due
# queue that happens to be empty, an accuracy floor you can't reach with
# four cards left). Grinding is always an available answer.
DAILY_ANCHORS = {"daily_reviews_30", "daily_reviews_60", "daily_xp_150"}

DAILY_DRAW = 3

# ── Weekly pool ───────────────────────────────────────────────
# Two are drawn per ISO week. These are the token faucet — a week's
# work buys one 起 token, which buys back one broken streak.
WEEKLY_POOL = [
    Goal("weekly_reviews_300", "weekly", "reviews_week",     300, "錬", "aka",      "jou",  150, 1),
    Goal("weekly_reviews_700", "weekly", "reviews_week",     700, "猛", "kuro",     "toku", 300, 2),
    Goal("weekly_new_40",      "weekly", "new_cards_week",   40,  "拓", "midori",   "jou",  160, 1),
    Goal("weekly_days_5",      "weekly", "study_days_week",  5,   "五", "shiro",    "jou",  150, 1),
    Goal("weekly_days_7",      "weekly", "study_days_week",  7,   "全", "kin",      "toku", 280, 2),
    Goal("weekly_perfect_25",  "weekly", "perfect_run_week", 25,  "双", "kin",      "toku", 200, 1),
    Goal("weekly_xp_1200",     "weekly", "xp_week",          1200, "千", "murasaki", "jou",  170, 1),
    Goal("weekly_breadth_4",   "weekly", "categories_week",  4,   "遍", "ao",       "jou",  160, 1),
]

WEEKLY_DRAW = 2

# ── Great vows (大願) ─────────────────────────────────────────
# Never rotate, never expire, and — unlike the daily/weekly darumas —
# you have to walk up and paint the first eye yourself. Three slots
# (VOW_SLOTS), so taking one means not taking another; abandoning one
# refunds nothing. The whole catalogue is visible from the start, which
# is deliberate: a vow you can see and can't hold yet is the roadmap.
VOW_POOL = [
    Goal("vow_streak_7",      "vow", "streak_current",       7,    "七", "shiro",    "nami",   200, 1),
    Goal("vow_streak_30",     "vow", "streak_current",       30,   "月", "kin",      "toku",   600, 2),
    Goal("vow_streak_100",    "vow", "streak_current",       100,  "百", "kuro",     "kiwami", 1500, 3),
    Goal("vow_reviews_1000",  "vow", "reviews_total",        1000, "千", "ao",       "jou",    400, 1),
    Goal("vow_reviews_5000",  "vow", "reviews_total",        5000, "万", "kuro",     "kiwami", 1800, 3),
    Goal("vow_mastered_100",  "vow", "mastered_total",       100,  "極", "murasaki", "toku",   500, 2),
    Goal("vow_mastered_500",  "vow", "mastered_total",       500,  "聖", "kin",      "kiwami", 1600, 3),
    Goal("vow_perfect_50",    "vow", "perfect_run_lifetime", 50,   "不", "aka",      "toku",   550, 2),
    Goal("vow_nanakorobi",    "vow", "rises_total",          7,    "起", "aka",      "kiwami", 900,  2),
    Goal("vow_breadth_5",     "vow", "categories_today",     5,    "遍", "midori",   "toku",   450, 1),
]

ALL_GOALS = {g.id: g for g in (*DAILY_POOL, *WEEKLY_POOL, *VOW_POOL)}


# ── Period keys ───────────────────────────────────────────────
# A goal's identity in the database is (user, goal_id, period_key), so
# the same goal drawn again next Tuesday is a genuinely new daruma with
# its own eyes rather than a row that has to be reset. Vows use a fixed
# key because they never rotate.
def period_key(kind: str, today) -> str:
    if kind == "daily":
        return today.isoformat()
    if kind == "weekly":
        year, week, _ = today.isocalendar()
        return f"{year}-W{week:02d}"
    return "vow"


# ── Deterministic draw ────────────────────────────────────────
# Seeded on (user, period) rather than stored, so nothing has to be
# written at midnight for the day's goals to exist — they're a pure
# function of who you are and what day it is, and two requests on the
# same day always agree. Sorting the pool by id first keeps the draw
# stable even if someone reorders the lists above.
def _draw(pool: list[Goal], user_id: str, key: str, count: int, salt: str) -> list[Goal]:
    rng = random.Random(f"{user_id}|{key}|{salt}")
    return rng.sample(sorted(pool, key=lambda g: g.id), k=min(count, len(pool)))


def daily_goals(user_id: str, today) -> list[Goal]:
    key = period_key("daily", today)
    anchors = [g for g in DAILY_POOL if g.id in DAILY_ANCHORS]
    rest = [g for g in DAILY_POOL if g.id not in DAILY_ANCHORS]
    picked = _draw(anchors, user_id, key, 1, "anchor")
    picked += _draw(rest, user_id, key, DAILY_DRAW - 1, "rest")
    return picked


def weekly_goals(user_id: str, today) -> list[Goal]:
    # Shuffled whole rather than sampled, then filtered down to one goal
    # per metric: with only two weekly draws, landing "study 5 days" and
    # "study 7 days" in the same week is one goal wearing two hats.
    key = period_key("weekly", today)
    picked: list[Goal] = []
    seen: set[str] = set()
    for goal in _draw(WEEKLY_POOL, user_id, key, len(WEEKLY_POOL), "weekly"):
        if goal.metric in seen:
            continue
        seen.add(goal.metric)
        picked.append(goal)
        if len(picked) == WEEKLY_DRAW:
            break
    return picked


# ── Evaluation ────────────────────────────────────────────────
def progress(goal: Goal, facts: dict) -> int:
    """Raw current value for `goal`, clamped to its target so a runaway
    metric (5000 reviews against a target of 30) never renders as a
    1600%-full daruma."""
    raw = int(facts.get(goal.metric, 0) or 0)
    if goal.metric == "accuracy_today" and facts.get("reviews_today", 0) < ACCURACY_MIN_REVIEWS:
        raw = 0
    return max(0, min(raw, goal.target))


def serialize(goal: Goal, facts: dict, row: dict | None = None) -> dict:
    """One daruma, as the frontend wants it: the goal's fixed identity,
    live progress, and whichever eyes have been painted so far.

    `completed` is computed fresh from the facts every time rather than
    read off the row, because most metrics can move backwards (today's
    accuracy dips, a streak breaks) and a daruma that isn't claimed yet
    shouldn't stay claimable through a bad afternoon. Once `claimed` is
    set, none of that matters anymore — the doll is on the shelf."""
    row = row or {}
    current = progress(goal, facts)
    claimed = row.get("claimed_at") is not None
    # A rotating daruma paints its own first eye the moment you make any
    # progress on it — the vow ritual is reserved for 大願, where
    # choosing is the mechanic. So a daily doll is blank until you've
    # started, one-eyed while you're working, two-eyed once claimed:
    # the same three-state read as the real thing, for free.
    vowed = row.get("vowed_at") is not None or (goal.kind != "vow" and current > 0)
    return {
        "id": goal.id,
        "kind": goal.kind,
        "glyph": goal.glyph,
        "color": goal.color,
        "rarity": goal.rarity,
        "target": goal.target,
        "current": goal.target if claimed else current,
        "rewardXp": goal.xp,
        "rewardTokens": goal.tokens,
        "vowed": vowed,
        "claimed": claimed,
        "complete": claimed or current >= goal.target,
    }
