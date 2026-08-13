"""
蔵 — the Storehouse.

Two long-term systems that outlive any single goal:

**段位 (dan-i), the mastery ladder.** 十級 up to 一級, then 初段 up to
十段 — the ranking system go, shogi, and every martial art in Japan
actually uses. Deliberately keyed to *mastered cards* rather than XP,
because XP already measures effort and a second effort ladder would
say nothing new. Rank answers "how much Japanese do you know"; level
answers "how much have you shown up". They can and should disagree.

**Cosmetics.** Four slots, thirty-six items, all earned and none
purchasable:

    紙  paper  the surface your study cards are printed on
    輪  ring   the treatment on your profile's XP ring
    印  seal   the hanko struck into the corner of every card
    称号 title  what you're called under your own name

Everything here is authentic material vocabulary rather than invented
rarity tiers — unryū paper really does have visible cloud-like fibres,
suminagashi really is floated-ink marbling, seigaiha really is the
wave pattern, and a 篆刻 seal really is carved in seal script. The
point is that the reward for a year of study should be a thing with a
name, not a glow effect.

Unlocks are evaluated from live facts but **persisted on first
satisfaction** (see routes/cosmetics.py) — a 100-day streak that later
breaks does not repossess the paper it earned. This module is pure
data and predicates; nothing here touches the database.
"""
from dataclasses import dataclass

# ── 段位 — the mastery ladder ─────────────────────────────────
# (cumulative mastered (card, mode) pairs required, label). Kyū count
# down toward 1 and dan count up from 初段, which is why the list is
# one flat ordered ladder rather than two — rank_index is the only
# number anything else needs.
RANKS = [
    (0,     "十級"), (25,    "九級"), (60,    "八級"), (120,   "七級"),
    (200,   "六級"), (320,   "五級"), (480,   "四級"), (700,   "三級"),
    (1000,  "二級"), (1400,  "一級"),
    (1900,  "初段"), (2500,  "二段"), (3200,  "三段"), (4000,  "四段"),
    (5000,  "五段"), (6200,  "六段"), (7600,  "七段"), (9200,  "八段"),
    (11000, "九段"), (13000, "十段"),
]

# Index of 初段 — the kyū→dan crossing, which is the one threshold in
# the ladder worth marking differently in the UI.
SHODAN_INDEX = 10


def rank_for(mastered: int) -> dict:
    """Current rank plus what the next one costs, in the shape the
    profile plaque and the storehouse header both want."""
    index = 0
    for i, (need, _) in enumerate(RANKS):
        if mastered >= need:
            index = i
    need, label = RANKS[index]
    nxt = RANKS[index + 1] if index + 1 < len(RANKS) else None
    return {
        "index": index,
        "label": label,
        "isDan": index >= SHODAN_INDEX,
        "mastered": mastered,
        "from": need,
        "next": nxt[0] if nxt else None,
        "nextLabel": nxt[1] if nxt else None,
    }


# ── Cosmetics ─────────────────────────────────────────────────
SLOTS = ("paper", "ring", "seal", "title")

# Ordered worst → best, purely for presentation weight (the storehouse
# sorts by it and 極 items get the gold treatment). Same four-tier
# vocabulary the daruma shelf already uses.
RARITIES = ("nami", "jou", "toku", "kiwami")


@dataclass(frozen=True)
class Cosmetic:
    id: str
    slot: str
    jp: str            # the item's real name — not translated, like appTitle
    rarity: str
    metric: str        # key into the facts dict; "" for the defaults
    target: int


def _c(id, slot, jp, rarity, metric="", target=0):
    return Cosmetic(id, slot, jp, rarity, metric, target)


# 紙 — paper stocks. Real Japanese papers, roughly in order of how
# precious they'd actually be.
PAPERS = [
    _c("paper_washi",       "paper", "和紙",   "nami"),                                   # default
    _c("paper_torinoko",    "paper", "鳥の子", "nami",   "level", 8),
    _c("paper_kozo",        "paper", "楮紙",   "jou",    "perfect_run_lifetime", 50),
    _c("paper_unryu",       "paper", "雲龍紙", "jou",    "shelf_count", 25),
    _c("paper_aizome",      "paper", "藍染",   "jou",    "mastered_total", 500),
    _c("paper_momiji",      "paper", "紅葉紙", "toku",   "shelf_colors", 8),
    _c("paper_sabi",        "paper", "錆紙",   "toku",   "reviews_total", 5000),
    _c("paper_suminagashi", "paper", "墨流し", "toku",   "streak_longest", 100),
    _c("paper_yozora",      "paper", "夜空紙", "kiwami", "shelf_kiwami", 3),
    _c("paper_kinpaku",     "paper", "金箔",   "kiwami", "rank_index", SHODAN_INDEX),
]

# 輪 — the ring drawn around your avatar.
RINGS = [
    _c("ring_hosomichi", "ring", "細道",   "nami"),                              # default
    _c("ring_kumihimo",  "ring", "組紐",   "nami",   "level", 15),
    _c("ring_enso",      "ring", "円相",   "jou",    "streak_longest", 30),
    _c("ring_sakura",    "ring", "桜輪",   "jou",    "mastered_total", 100),
    _c("ring_seigaiha",  "ring", "青海波", "jou",    "reviews_total", 1000),
    _c("ring_raijin",    "ring", "雷紋",   "toku",   "rises_total", 7),
    _c("ring_kinrin",    "ring", "金輪",   "toku",   "level", 40),
    _c("ring_hinode",    "ring", "日輪",   "kiwami", "rank_index", 14),
]

# 印 — the hanko struck into every card's corner.
SEALS = [
    _c("seal_shu",     "seal", "朱印",   "nami"),                            # default
    _c("seal_sumi",    "seal", "墨印",   "nami",   "level", 20),
    _c("seal_hisui",   "seal", "翡翠印", "jou",    "mastered_total", 300),
    _c("seal_koban",   "seal", "小判印", "jou",    "reviews_total", 2000),
    _c("seal_kin",     "seal", "金印",   "toku",   "shelf_count", 50),
    _c("seal_tenkoku", "seal", "篆刻",   "kiwami", "rank_index", 12),
]

# 称号 — what you're called. Distinct from levelTitle.js's automatic
# level rank, which everybody gets; these are chosen and earned.
TITLES = [
    _c("title_minarai",    "title", "見習い",     "nami"),                                # default
    _c("title_kakehashi",  "title", "架け橋",     "nami",   "reviews_total", 500),
    _c("title_idaten",     "title", "韋駄天",     "jou",    "best_day_reviews", 150),
    _c("title_fudo",       "title", "不動",       "jou",    "perfect_run_lifetime", 50),
    _c("title_hyakume",    "title", "百目",       "jou",    "shelf_count", 100),
    _c("title_nanakorobi", "title", "八起",       "toku",   "rises_total", 7),
    _c("title_tetsujin",   "title", "鉄人",       "toku",   "reviews_total", 5000),
    _c("title_sennichi",   "title", "千日行者",   "toku",   "streak_longest", 100),
    _c("title_kuramori",   "title", "蔵守",       "toku",   "unlocked_count", 20),
    _c("title_shishou",    "title", "師匠",       "toku",   "rank_index", SHODAN_INDEX),
    _c("title_shosei",     "title", "書聖",       "kiwami", "mastered_total", 1000),
    _c("title_meijin",     "title", "名人",       "kiwami", "rank_index", 17),
]

ALL = {c.id: c for c in (*PAPERS, *RINGS, *SEALS, *TITLES)}
BY_SLOT = {slot: [c for c in ALL.values() if c.slot == slot] for slot in SLOTS}

# Everyone owns one item per slot from the start, so no slot can ever
# be empty and "unequipped" is never a state the UI has to render.
DEFAULTS = {
    "paper": "paper_washi",
    "ring":  "ring_hosomichi",
    "seal":  "seal_shu",
    "title": "title_minarai",
}

# `unlocked_count` is the one predicate that depends on the others, so
# it can't be evaluated in the same pass — see routes/cosmetics.py,
# which resolves the rest first and then runs these.
SELF_REFERENTIAL = {c.id for c in ALL.values() if c.metric == "unlocked_count"}


def is_earned(cosmetic: Cosmetic, facts: dict) -> bool:
    if not cosmetic.metric:
        return True
    return int(facts.get(cosmetic.metric, 0) or 0) >= cosmetic.target


def serialize(cosmetic: Cosmetic, owned: bool, facts: dict, equipped: bool) -> dict:
    """One item as the storehouse wants it. A locked item still ships
    its requirement and the user's live progress toward it — a locked
    case you can't see the price of is just a blank."""
    return {
        "id": cosmetic.id,
        "slot": cosmetic.slot,
        "jp": cosmetic.jp,
        "rarity": cosmetic.rarity,
        "owned": owned,
        "equipped": equipped,
        "req": None if not cosmetic.metric else {
            "metric": cosmetic.metric,
            "target": cosmetic.target,
            "current": min(int(facts.get(cosmetic.metric, 0) or 0), cosmetic.target),
        },
    }
