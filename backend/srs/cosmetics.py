"""
蔵 — the Storehouse.

Two long-term systems that outlive any single goal:

**段位 (dan-i), the mastery ladder.** 十級 up to 一級, then 初段 up to
十段 — the ranking system go, shogi, and every martial art in Japan
actually uses. Deliberately keyed to *mastered cards* rather than XP,
because XP already measures effort and a second effort ladder would
say nothing new. Rank answers "how much Japanese do you know"; level
answers "how much have you shown up". They can and should disagree.

**Cosmetics.** Seven slots, all earned and none purchasable:

    紙  paper    the surface your study cards are printed on
    輪  ring     the treatment on your profile's XP ring
    印  seal     the hanko struck into the corner of every card
    称号 title    what you're called under your own name
    背景 backdrop the room you're studying in — behind everything
    祝  flourish what a reward looks like when it fires
    筆  brush    the ink you write kanji with, in the drawing pad
    番線 mcq      the answer rows you actually spend the session reading

The last three are new, and they were chosen because between them they
cover the three moments the older four never touched: the space around
the card, the instant a review pays out, and the act of writing
itself. A cosmetic set that only dresses the card is a set you stop
noticing.

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
# Order matters: this is the order the storehouse lists its cases in,
# and it runs outward from the card you're looking at to the room
# you're sitting in.
SLOTS = ("paper", "ring", "seal", "title", "backdrop", "flourish", "brush", "mcq")

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


# ── A note on the unlock conditions ───────────────────────────
# Some of these are counters (review ten thousand cards) and some are
# *moments* (`dawn_today`, `night_today`, `due_cleared` — binary facts
# about a single day, see srs.get_daruma_facts). Moments work as unlock
# conditions precisely because ownership is permanent: study once
# before eight in the morning and the dawn paper is yours forever. That
# turns a handful of items into small dares rather than long grinds,
# and a catalogue made only of long grinds is a catalogue you check
# twice a year.

# 紙 — paper stocks. Real Japanese papers, roughly in order of how
# precious they'd actually be.
PAPERS = [
    _c("paper_washi",       "paper", "和紙",   "nami"),                                   # default
    _c("paper_torinoko",    "paper", "鳥の子", "nami",   "level", 8),
    _c("paper_sugihara",    "paper", "杉原紙", "nami",   "reviews_total", 250),
    _c("paper_kozo",        "paper", "楮紙",   "jou",    "perfect_run_lifetime", 50),
    _c("paper_unryu",       "paper", "雲龍紙", "jou",    "shelf_count", 25),
    _c("paper_aizome",      "paper", "藍染",   "jou",    "mastered_total", 500),
    _c("paper_ganpi",       "paper", "雁皮紙", "jou",    "perfect_run_lifetime", 120),
    _c("paper_chiyogami",   "paper", "千代紙", "jou",    "categories_today", 4),
    _c("paper_momiji",      "paper", "紅葉紙", "toku",   "shelf_colors", 8),
    _c("paper_sabi",        "paper", "錆紙",   "toku",   "reviews_total", 5000),
    _c("paper_suminagashi", "paper", "墨流し", "toku",   "streak_longest", 100),
    _c("paper_danshi",      "paper", "檀紙",   "toku",   "best_day_reviews", 300),
    _c("paper_sumizome",    "paper", "墨染",   "toku",   "night_today", 1),
    _c("paper_yozora",      "paper", "夜空紙", "kiwami", "shelf_kiwami", 3),
    _c("paper_kinpaku",     "paper", "金箔",   "kiwami", "rank_index", SHODAN_INDEX),
    _c("paper_rakusui",     "paper", "落水紙", "kiwami", "mastered_total", 2000),
    # The station's own stock — the card as a ticket rather than a sheet.
    _c("paper_kippu",       "paper", "切符",   "nami",   "reviews_total", 150),
    _c("paper_koken",       "paper", "硬券",   "jou",    "study_days_week", 5),
    _c("paper_teiki",       "paper", "定期券", "toku",   "streak_longest", 30),
]

# 輪 — the ring drawn around your avatar.
RINGS = [
    _c("ring_hosomichi", "ring", "細道",   "nami"),                              # default
    _c("ring_kumihimo",  "ring", "組紐",   "nami",   "level", 15),
    _c("ring_asanoha",   "ring", "麻の葉", "nami",   "reviews_total", 300),
    _c("ring_enso",      "ring", "円相",   "jou",    "streak_longest", 30),
    _c("ring_sakura",    "ring", "桜輪",   "jou",    "mastered_total", 100),
    _c("ring_seigaiha",  "ring", "青海波", "jou",    "reviews_total", 1000),
    _c("ring_shippou",   "ring", "七宝",   "jou",    "mastered_total", 250),
    _c("ring_kikko",     "ring", "亀甲",   "jou",    "study_days_week", 7),
    _c("ring_tomoe",     "ring", "三巴",   "toku",   "rises_total", 3),
    _c("ring_raijin",    "ring", "雷紋",   "toku",   "rises_total", 7),
    _c("ring_kinrin",    "ring", "金輪",   "toku",   "level", 40),
    _c("ring_gesshin",   "ring", "月輪",   "toku",   "night_today", 1),
    _c("ring_hinode",    "ring", "日輪",   "kiwami", "rank_index", 14),
    # 環状線 — a loop line is a ring, which is the joke and also the point.
    _c("ring_kanjosen",  "ring", "環状線", "jou",    "study_days_week", 6),
    _c("ring_rosenzu",   "ring", "路線図", "toku",   "categories_today", 5),
]

# 印 — the hanko struck into every card's corner.
SEALS = [
    _c("seal_shu",      "seal", "朱印",   "nami"),                            # default
    _c("seal_sumi",     "seal", "墨印",   "nami",   "level", 20),
    _c("seal_rakkan",   "seal", "落款",   "nami",   "reviews_total", 300),
    _c("seal_hisui",    "seal", "翡翠印", "jou",    "mastered_total", 300),
    _c("seal_koban",    "seal", "小判印", "jou",    "reviews_total", 2000),
    _c("seal_yuin",     "seal", "遊印",   "jou",    "new_cards_today", 25),
    _c("seal_hyotan",   "seal", "瓢箪印", "jou",    "shelf_count", 30),
    _c("seal_kin",      "seal", "金印",   "toku",   "shelf_count", 50),
    _c("seal_hakubun",  "seal", "白文",   "toku",   "perfect_run_lifetime", 100),
    _c("seal_tenkoku",  "seal", "篆刻",   "kiwami", "rank_index", 12),
    _c("seal_gyokuji",  "seal", "玉璽",   "kiwami", "rank_index", 15),
    # 駅スタンプ — the commemorative stamp every station in Japan keeps
    # at the gate, which is already exactly what this slot is.
    _c("seal_ekistamp", "seal", "駅印",   "nami",   "reviews_total", 400),
    _c("seal_kaisatsu", "seal", "改札印", "jou",    "study_days_week", 7),
]

# 称号 — what you're called. Distinct from levelTitle.js's automatic
# level rank, which everybody gets; these are chosen and earned.
TITLES = [
    _c("title_minarai",    "title", "見習い",     "nami"),                                # default
    _c("title_hajime",     "title", "初心",       "nami",   "reviews_total", 100),
    _c("title_kakehashi",  "title", "架け橋",     "nami",   "reviews_total", 500),
    _c("title_akatsuki",   "title", "暁",         "nami",   "dawn_today", 1),
    _c("title_yonaga",     "title", "夜長",       "nami",   "night_today", 1),
    _c("title_idaten",     "title", "韋駄天",     "jou",    "best_day_reviews", 150),
    _c("title_fudo",       "title", "不動",       "jou",    "perfect_run_lifetime", 50),
    _c("title_hyakume",    "title", "百目",       "jou",    "shelf_count", 100),
    _c("title_hayate",     "title", "疾風",       "jou",    "best_day_reviews", 300),
    _c("title_muketsu",    "title", "無欠",       "jou",    "perfect_run_lifetime", 100),
    _c("title_nanakorobi", "title", "八起",       "toku",   "rises_total", 7),
    _c("title_tetsujin",   "title", "鉄人",       "toku",   "reviews_total", 5000),
    _c("title_sennichi",   "title", "千日行者",   "toku",   "streak_longest", 100),
    _c("title_kuramori",   "title", "蔵守",       "toku",   "unlocked_count", 20),
    _c("title_shishou",    "title", "師匠",       "toku",   "rank_index", SHODAN_INDEX),
    _c("title_kaigen",     "title", "開眼",       "toku",   "shelf_count", 60),
    _c("title_tsuwamono",  "title", "兵",         "toku",   "reviews_total", 10000),
    _c("title_shosei",     "title", "書聖",       "kiwami", "mastered_total", 1000),
    _c("title_meijin",     "title", "名人",       "kiwami", "rank_index", 17),
    _c("title_musou",      "title", "無双",       "kiwami", "streak_longest", 200),
    _c("title_daruma",     "title", "達磨",       "kiwami", "shelf_kiwami", 8),
    _c("title_shashou",    "title", "車掌",       "nami",   "reviews_total", 250),
    _c("title_ekicho",     "title", "駅長",       "toku",   "unlocked_count", 30),
]

# 背景 — the room behind everything. Every one of these is a wash or a
# pattern laid *behind* the cards, never under the text: the cards
# themselves stay opaque, so no backdrop can cost a single point of
# reading contrast however loud it looks in the case.
BACKDROPS = [
    _c("backdrop_muji",      "backdrop", "無地",   "nami"),                                # default
    _c("backdrop_tatami",    "backdrop", "畳",     "nami",   "level", 5),
    _c("backdrop_shoji",     "backdrop", "障子",   "nami",   "reviews_total", 500),
    _c("backdrop_kanoko",    "backdrop", "鹿の子", "jou",    "mastered_total", 200),
    _c("backdrop_asagiri",   "backdrop", "朝霧",   "jou",    "dawn_today", 1),
    _c("backdrop_hoshizora", "backdrop", "星空",   "jou",    "night_today", 1),
    _c("backdrop_sumie",     "backdrop", "墨絵",   "toku",   "perfect_run_lifetime", 150),
    _c("backdrop_sakura",    "backdrop", "桜吹雪", "toku",   "streak_longest", 60),
    _c("backdrop_kasumi",    "backdrop", "霞",     "toku",   "shelf_count", 40),
    _c("backdrop_kinbyobu",  "backdrop", "金屏風", "kiwami", "rank_index", 14),
    _c("backdrop_amanogawa", "backdrop", "天の川", "kiwami", "reviews_total", 20000),
    # The rooms this app is actually set in.
    _c("backdrop_shanai",    "backdrop", "車内",   "nami",   "level", 12),
    _c("backdrop_rosenzu",   "backdrop", "路線図", "jou",    "categories_today", 4),
    _c("backdrop_koka",      "backdrop", "高架",   "toku",   "best_day_reviews", 220),
]

# 祝 — what a reward looks like when it lands. The app's celebration is
# staged as kabuki (see XpToast.jsx); these change the character of the
# performance, not its choreography.
FLOURISHES = [
    _c("flourish_tsuke",    "flourish", "ツケ",   "nami"),                              # default
    _c("flourish_hanabi",   "flourish", "花火",   "nami",   "level", 10),
    _c("flourish_koban",    "flourish", "小判",   "nami",   "reviews_total", 1000),
    _c("flourish_sakura",   "flourish", "桜",     "jou",    "mastered_total", 300),
    _c("flourish_kaminari", "flourish", "雷",     "jou",    "best_day_reviews", 200),
    _c("flourish_kitsune",  "flourish", "狐火",   "jou",    "night_today", 1),
    _c("flourish_matsuri",  "flourish", "祭",     "toku",   "shelf_count", 50),
    _c("flourish_ryu",      "flourish", "龍",     "toku",   "rank_index", 12),
    _c("flourish_hoo",      "flourish", "鳳凰",   "kiwami", "rank_index", 17),
]

# 筆 — the ink you actually write with, in the handwriting pad. Colour
# and stroke weight; the pad reads both off CSS custom properties (see
# DrawingCanvas.jsx) so a brush is defined in exactly one place like
# every other material here.
BRUSHES = [
    _c("brush_sumi",     "brush", "墨",     "nami"),                                # default
    _c("brush_shuboku",  "brush", "朱墨",   "nami",   "level", 12),
    _c("brush_aiboku",   "brush", "藍墨",   "nami",   "mastered_total", 150),
    _c("brush_futofude", "brush", "太筆",   "jou",    "perfect_run_lifetime", 75),
    _c("brush_chaboku",  "brush", "茶墨",   "jou",    "reviews_total", 3000),
    _c("brush_menso",    "brush", "面相筆", "toku",   "best_day_reviews", 250),
    _c("brush_kinboku",  "brush", "金墨",   "toku",   "rank_index", SHODAN_INDEX),
    _c("brush_nijimi",   "brush", "滲み",   "kiwami", "mastered_total", 1500),
]

# 番線 — the answer rows. The one surface a session is genuinely spent
# looking at: four rows, several hundred times a day. Every other slot
# dresses something you glance at.
#
# These are the station's own furniture rather than more paper and ink,
# because that is what the app is now — the home screen is a departure
# board and the rows below are, structurally, exactly the same object.
MCQS = [
    _c("mcq_hyoji",    "mcq", "表示",   "nami"),                                   # default
    _c("mcq_hassha",   "mcq", "発車標", "nami",   "reviews_total", 200),
    _c("mcq_kippu",    "mcq", "切符",   "nami",   "level", 10),
    _c("mcq_noriba",   "mcq", "のりば", "jou",    "mastered_total", 150),
    _c("mcq_kaisatsu", "mcq", "改札",   "jou",    "perfect_run_lifetime", 60),
    _c("mcq_koken",    "mcq", "硬券",   "jou",    "reviews_total", 2500),
    _c("mcq_horo",     "mcq", "幌",     "toku",   "streak_longest", 45),
    _c("mcq_tsurikawa", "mcq", "吊革",  "toku",   "best_day_reviews", 200),
    _c("mcq_shinkansen", "mcq", "新幹線", "kiwami", "rank_index", 14),
]

ALL = {c.id: c for c in (*PAPERS, *RINGS, *SEALS, *TITLES, *BACKDROPS, *FLOURISHES, *BRUSHES, *MCQS)}
BY_SLOT = {slot: [c for c in ALL.values() if c.slot == slot] for slot in SLOTS}

# Everyone owns one item per slot from the start, so no slot can ever
# be empty and "unequipped" is never a state the UI has to render.
DEFAULTS = {
    "paper":    "paper_washi",
    "ring":     "ring_hosomichi",
    "seal":     "seal_shu",
    "title":    "title_minarai",
    "backdrop": "backdrop_muji",
    "flourish": "flourish_tsuke",
    "brush":    "brush_sumi",
    "mcq":      "mcq_hyoji",
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
