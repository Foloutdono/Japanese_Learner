"""
Build script for the thematic vocab decks ("fruits", "vegetables", "body
parts", ...) — the theme counterpart to frequency_data.py's tiers.

Output is `datas/vocab/theme_words.json`, read at import by
content/theme_data.py. It used to be a `theme_words` table inside the
76 MB datas/vocab/vocab_jmdict.sqlite3; at ~1.5k rows the whole thing is
a couple of hundred KB, and a JSON file is REVIEWABLE — a rebuild shows
up as a readable diff instead of a 28 MB opaque blob, which matters more
than the bytes because the failure mode here is plausible-looking bad
data, not a crash. (The old table is left in the sqlite file: nothing
reads it, and dropping it would cost a full rewrite of the binary. The
next JMdict rebuild removes it for free.)

A theme is a different GROUPING over words that already live in the app's
curated deck (vocab_data.py) or the JMdict pool (vocab_jmdict_data.py) —
never a second copy. Card ids come from frequency_data.to_id(), so a word
studied under "Fruits · 基本" and the same word studied under "N4" or
"Top 200" is the SAME SRS card.

Run offline: `python -m scripts.build_theme_db [--dump THEME]`.
Safe to re-run — rewrites the JSON from scratch each time.


WHAT THIS REPLACES, AND WHY IT MATTERED
---------------------------------------
The previous build matched an English keyword as a SUBSTRING of the
comma-joined gloss, then filled each theme up to a quota of 220 JMdict
words. Both halves were wrong, and together they made the feature
unusable:

  * The quota was a floor, not a ceiling. Every one of the 36 themes hit
    exactly 220, so each was ~30 real words padded with ~190 archaic ones
    (蒲桜, 波波迦, 樋殿). The last word accepted into `rooms` sat at
    frequency rank 175,210 of 212,460.
  * Substring-of-a-gloss picks the wrong words outright: 石灰 "lime" (the
    mineral) in fruits, 紅茶 "black tea" in colors, 分野 "field,sphere,
    realm" in shapes, 競馬 "horse racing" in animals.

Three rules replace it, and the first is doing most of the work.


1. ELIGIBILITY — a word with no JMdict priority tag is not a candidate.
   `entries.freq_rank` looks like the obvious frequency source and is
   NOT one: it is a real ranking only to about rank 23,000 (every ⭐ row
   is <= 22,964), after which it degenerates into kana-alphabetical dump
   order. And datas/vocab/vocab_frequency.json is a documented
   placeholder — plain JLPT deck order, see frequency_data.py's own
   docstring.

   What does work is the JMdict priority tags, which are already in the
   shipped sqlite for BOTH pools: `senses.blob` for the JMdict pool
   (24,556 entries carry one) and `curated_senses.blob` for the deck
   (7,488 of 8,066). `news1k`..`news24k` are the Mainichi Shimbun
   frequency bands in 1,000-word steps. See `_score`.

   Requiring one drops the candidate pool from 220,865 words to ~30,500
   and makes the archaic padding impossible rather than merely capped.

2. MATCHING — sense 1, gloss 1, exact after normalisation.
   Matching runs against the structured `glossary` array in the sense
   blob, never the flattened `meaning` string, and only against the
   FIRST gloss of the FIRST sense. That is what separates 円 "circle,
   money" (in) from 範囲 "extent, scope, sphere, range" (out).

   This is deliberately strict and MUST STAY STRICT. Measured: allowing
   senses 1-2 and glosses 1-2 takes `shapes` from 48 words to 115 and
   brings the disease straight back — 妻 "wife", 路線, 骨, 影, 趣旨, 欄,
   土俵, 内野, 折衷, 略, トン, コール — while `colors` regains 未熟
   "inexperience" and トルコ "turkey", and `fruits` regains ライム
   "rhyme". If a theme is too thin, widen its KEYWORDS; never loosen
   this.

   Note the normaliser does NOT strip a leading article. Stripping it is
   how 赤字 "(being in) the red" got into colors and 世界 "the world"
   into shapes.

3. DEDUPE — once by surface, once by head gloss.
   The old data had 鼠/ねずみ beside 鼠/ねず, and "kitchen" nine times over
   in `rooms` (台所/厨房/キッチン/厨/調理場/炊事場/庖厨). Duplicate glosses
   make MCQ distractors collapse (study/mcq.py dedupes by meaning) and
   the meaning->word direction unanswerable. Parentheticals are stripped
   BEFORE splitting on commas — splitting first breaks the parenthesis
   and defeats the key, which is why 苺 "strawberry (esp. the garden
   strawberry, Fragaria x ananassa)" and ストロベリー "strawberry" both
   survived.

Levels: each theme's survivors are sorted by score and cut into four
growing bands (LEVEL_SHARES). Growing on purpose — 基本 should be a
short, high-value starter set, not a quarter of a long list.
"""
import argparse
import json
import os
import re
import sqlite3
from collections import defaultdict

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_VOCAB_DIR = os.path.join(_BASE_DIR, "datas", "vocab")
_JMDICT_DB = os.path.join(_VOCAB_DIR, "vocab_jmdict.sqlite3")
_DECK_JSON = os.path.join(_VOCAB_DIR, "vocab_deck.json")
_TAGS_JSON = os.path.join(_VOCAB_DIR, "vocab_tags.json")
_OUT_JSON = os.path.join(_VOCAB_DIR, "theme_words.json")

LEVELS = ("basic", "medium", "advanced", "expert")
# Shares of a theme's words per band. Tuned against the real post-cleanup
# sizes (15-50 words per theme, not the old 220): a 10% basic band would
# be two words for half the themes.
LEVEL_SHARES = (0.20, 0.25, 0.27, 0.28)

with open(_TAGS_JSON, encoding="utf-8") as f:
    _TAG_INFO = json.load(f)

# JMdict entries tagged with a category="name" code (place, person,
# company, given, surname, myth, work, ...) are proper nouns — never
# useful in a themed vocab deck, and easy to mismatch (a person's name
# that happens to contain a food word).
_NAME_TAG_CODES = {code for code, info in _TAG_INFO.items() if info.get("category") == "name"}

# POS codes that make a sense a noun/thing rather than an action. n-pr
# (proper noun) is deliberately absent — see _NAME_TAG_CODES.
_NOUN_POS = {"n", "n-adv", "n-pref", "n-suf", "n-t"}
# Themes whose members are legitimately adjectives (a colour, a feeling).
_ADJ_POS = {"adj-i", "adj-na", "adj-no", "adj-t", "adj-f"}
_ADJ_THEMES = {"colors", "emotions"}

# Usage tags that disqualify a sense whatever it glosses: archaic, rare,
# obsolete, slang, idiom, proverb, four-character compound, and the
# register markers. These are what let 梓 "Japanese cherry birch" and
# 波波迦 into a beginner's fruit deck.
_BAD_USAGE = {
    "arch", "rare", "obs", "obsc", "derog", "vulg", "sl", "net-sl", "X",
    "joc", "poet", "dated", "hist", "male", "fem", "chn", "id", "proverb",
    "yoji",
}

# Per-theme field-tag rejections — JMdict's own subject labels doing the
# disambiguation English cannot. `chem` is why 石灰 "lime" is not a fruit;
# `finc` is why 赤字 "the red" is not a colour.
FIELD_DENY: dict[str, set[str]] = {
    "fruits":      {"chem", "geol", "physics", "math", "finc", "comp", "astron"},
    "vegetables":  {"chem", "comp", "finc"},
    "colors":      {"finc", "comp", "math", "physics"},
    "shapes":      {"geogr", "bus", "ling", "sports", "music", "finc"},
    "animals":     {"astron", "comp", "food", "sumo", "shogi", "mahj"},
    "birds":       {"astron", "comp", "shogi"},
    "insects_bugs": {"comp"},
    "body_parts":  {"comp", "archit", "bus", "math", "ling", "finc", "sumo"},
    "nature":      {"comp", "math", "finc", "Buddh"},
    "plants_trees": {"comp", "finc"},
    "materials":   {"finc", "comp"},
    "seafood":     {"comp"},
    "geography":   {"comp", "math"},
}

# Words a theme must never contain, checked by hand against the build's
# own --dump output. Whole-gloss matching already rules out the bulk of
# what the old substring matcher let through; these are the residue where
# the FIRST gloss genuinely is the keyword but the word is not a member
# of the category. Cheap to extend — it costs nothing at runtime.
DENY_SURFACE: dict[str, set[str]] = {
    "fruits":     {"石灰", "実", "産物", "所産", "桃色", "種子", "皮", "殻", "果皮",
                   "橙色", "オリーブ色",    # colour words, not fruit
                   "マロン"},               # a French loan; 栗 is the word
    "vegetables": {"芽", "芽生え", "リーク"},              # ネギ is the word
    "colors":     {"赤字", "黒字", "日陰", "陰", "カラー", "傘", "藍", "顔料", "濃淡", "陰影"},
    "shapes":     {"格好", "世界", "分野", "範囲", "区域", "方面", "畑", "広場", "象", "玉",
                   "形態", "妻", "額", "台詞", "楽隊", "楽団", "要旨", "土俵", "先", "前",
                   "ダイヤ", "面", "表", "筋", "路線", "骨", "影", "趣旨", "欄", "類",
                   "方式", "大筋", "フォーム"},
    "animals":    {"寅", "午", "申", "巳", "未", "子", "丑", "辰", "酉", "戌", "亥", "卯",
                   "動物性", "海馬", "馬頭", "ホース", "ズック", "剣山", "畜生",
                   "キャメル"},                          # ラクダ is the word (and has no priority tag)
    "birds":      {"羽根", "羽", "ウイング",           # a shuttlecock, a counter, a duplicate
                   "ナイチンゲール", "クレーン",           # 鶯 is the bird; クレーン is the machine
                   "啄木"},                             # 啄木鳥 is the woodpecker
    "insects_bugs": {"クリケット"},                    # the sport
    "body_parts": {"首脳", "主席", "先頭", "面", "左", "右", "筋", "肝心",
                   "所長", "麓", "節", "継ぎ目", "レバー", "主人",
                   "首長", "長", "腹痛",          # a chieftain, a chief; a symptom
                   "建前", "面目",                       # a public stance; saving face
                   "リブ"},                             # 肋骨 is the word,
    "emotions":   {"空気", "雰囲気", "緩和", "救援", "救済", "反省"},
    "nature":     {"一寸", "分野", "核", "天", "地味", "性"},
    "plants_trees": {"支部", "根本", "胴"},            # an organisation's branch, a torso
    "school":     {"入室", "元本", "白亜"},            # financial principal, the mineral
    "rooms":      {"勉強", "学問",                     # studying, not a study
                   "ラバトリー"},                       # トイレ is the word
    "drinks":     {"生", "ビア", "水分", "シュナップス",
                   "アルコール"},                       # 酒 is the word (the deck files it N4 vs N3)
    "dishes":     {"ランチ"},                          # gloss reads "launch, lunch"
    "geography":  {"国境", "州", "様子", "状態", "世", "世間", "アトラス", "ワールド"},
    "office_supplies": {"汗", "チョキ", "グルー"},        # チョキ is the hand sign; 糊 is the word
    "buildings":  {"工場", "詰め所",
                   "ステーション", "ファクトリー", "シネマ", "カテドラル"},  # 駅/工場/映画館/大聖堂
    "technology": {"ぶれ", "機関", "応募", "申し込み", "講師", "適用", "演目",
                   "願書", "番組", "鼠", "ネズミ",
                   "仕掛け"},                           # a gimmick, not a device
    "furniture":  {"内閣", "議長", "画面", "閣内",            # a cabinet of ministers, a chairman
                   "幕"},                               # a stage curtain, not カーテン
    "kitchen_items": {"盆", "分岐点", "分かれ目",             # a road fork
                   "窯", "ガラス"},                     # a kiln; window pane, not a tumbler
    "materials":  {"林", "核", "資料", "生地",
                   "コップ"},                           # a drinking vessel, not a material
    "medical":    {"試験", "運転", "扱い", "寒冷",     # an exam, machine operation
                   "害"},                               # bare "harm", not an injury
    "music":      {"調子", "器官", "車掌"},            # a bodily organ; a train conductor
    "shopping_money": {"変化", "法案", "異動", "交替", "札", "金", "蓄え",
                   "受領", "納入", "ショップ"},        # acceptance; a delivery; 店 already covers it
    "sports":     {"出馬", "走行", "研修", "中継", "馬車", "修行",
                   "賞牌", "洋弓", "記章"},              # メダル / アーチェリー are the words; 記章 is a badge
    "tools":      {"水準", "平準", "指針", "悪徳", "爪", "チョキ",
                   "連鎖"},                             # a chain of events, not 鎖
    "travel":     {"関税", "移民", "札", "着"},
    "vehicles":   {"熟し", "急先鋒"},                  # 急先鋒 is a vanguard
    "jobs":       {"長官", "ギャルソン"},                # an obscure French loan
    "clothing":   {"一律", "一様", "首輪", "毛並み", "口金"},
    "holidays_events": {"事件", "党"},                 # an incident, a political party
    "family":     {"シスター", "ツイン"},               # a nun; twin beds
    "weather":    {"シャワー"},                        # the bathroom kind; 夕立 is the rain
    "household_items": {"鉄", "鉄分", "世帯"},          # the metal; dietary iron; not an item
}

# theme_key -> the English glosses that name a member of the category.
#
# Under whole-gloss matching a keyword is only as good as it is
# unambiguous: it matches a word whose FIRST gloss is exactly it. That
# makes umbrella terms safe and welcome ("fruit" matches 果物 and nothing
# else), and makes a polysemous everyday noun poison. Measured: adding
# "star / line / edge / frame / corner / band / column / point / surface"
# to `shapes` immediately pulled in 妻 (a gable), 額 (a picture frame),
# 台詞 "line in a play" and 楽隊 "band". One careless keyword undoes the
# whole selection — run `--dump <theme>` and read every row after
# touching a list.
KEYWORDS: dict[str, list[str]] = {
    "fruits": [
        "fruit", "fruit tree", "berry", "citrus", "apple", "banana", "strawberry",
        "peach", "pear", "melon", "watermelon", "cherry", "lemon", "lime", "pineapple",
        "mango", "kiwi", "kiwifruit", "fig", "plum", "apricot", "persimmon", "coconut",
        "papaya", "raspberry", "blueberry", "cranberry", "pomegranate", "tangerine",
        "mandarin", "mandarin orange", "orange", "chestnut", "grape", "grapes",
        "loquat", "pomelo", "yuzu", "olive", "avocado", "lychee", "guava", "durian",
        "japanese chestnut",   # 栗's own gloss, which plain "chestnut" misses
        "nectarine", "quince", "grapefruit", "blackberry", "mulberry", "japanese apricot",
    ],
    "vegetables": [
        "vegetable", "root vegetable", "carrot", "potato", "sweet potato", "onion",
        "tomato", "cucumber", "cabbage", "lettuce", "spinach", "eggplant", "aubergine",
        "pumpkin", "radish", "garlic", "ginger", "broccoli", "cauliflower", "corn",
        "mushroom", "turnip", "celery", "asparagus", "leek", "yam", "scallion",
        "bamboo shoot", "bean sprouts", "soybean", "pea", "lotus root", "burdock",
        "taro", "okra", "chili pepper", "bell pepper", "watercress", "beet",
    ],
    "body_parts": [
        "body", "head", "face", "eye", "ear", "nose", "mouth", "tooth", "teeth",
        "tongue", "neck", "shoulder", "elbow", "wrist", "finger", "thumb", "chest",
        "breast", "stomach", "belly", "waist", "hip", "knee", "ankle", "toe", "skin",
        "bone", "muscle", "brain", "heart", "lung", "liver", "throat", "eyebrow",
        "eyelash", "cheek", "chin", "forehead", "fingernail", "eyelid", "spine", "rib",
        "artery", "vein", "nerve", "kidney", "arm", "leg", "hand", "foot", "hair",
        "blood", "skull", "jaw", "lip", "palm", "heel", "thigh", "intestines",
        "internal organs", "stomach ache", "pulse", "joint", "skeleton", "eyeball",
    ],
    "rooms": [
        "room", "bedroom", "kitchen", "bathroom", "living room", "dining room",
        "hallway", "corridor", "closet", "attic", "basement", "garage", "balcony",
        "veranda", "entrance hall", "restroom", "lavatory", "toilet", "study",
        "guest room", "japanese-style room", "storeroom", "porch", "terrace",
    ],
    "buildings": [
        "building", "house", "apartment", "hospital", "temple", "shrine", "church",
        "castle", "tower", "factory", "library", "museum", "stadium", "skyscraper",
        "warehouse", "cottage", "mansion", "palace", "dormitory", "embassy",
        "cathedral", "school", "station", "hotel", "bridge", "theatre", "theater",
        "post office", "city hall", "police station", "gymnasium", "inn", "cinema",
        "prison", "barn", "hut", "greenhouse", "lighthouse", "monastery",
    ],
    "furniture": [
        "furniture", "chair", "desk", "table", "bed", "sofa", "couch", "bookshelf",
        "cupboard", "wardrobe", "drawer", "cabinet", "bench", "stool", "mirror",
        "curtain", "carpet", "futon", "shelf", "nightstand", "rug", "lamp", "armchair",
        "chest of drawers", "coffee table", "dressing table", "blind",
    ],
    "school": [
        "school", "classroom", "textbook", "blackboard", "chalk", "university",
        "professor", "schoolbag", "semester", "kindergarten", "homework",
        "exam", "examination", "notebook", "pencil", "backpack", "teacher", "student",
        "education", "curriculum", "lecture", "tuition", "scholarship", "diploma",
        "recess", "pupil", "graduation", "entrance exam", "school trip", "club activity",
        "report card", "attendance", "elementary school", "junior high school",
        "high school", "college",
    ],
    "travel": [
        "travel", "trip", "journey", "airport", "passport", "luggage", "baggage",
        "suitcase", "ticket", "itinerary", "souvenir", "visa", "boarding pass",
        "tourist", "sightseeing", "voyage", "excursion", "layover", "customs",
        "immigration", "guidebook", "reservation", "departure", "arrival", "map",
        "backpacking", "tour", "traveller", "traveler", "hot spring", "camping",
    ],
    "jobs": [
        "occupation", "profession", "doctor", "teacher", "engineer", "lawyer", "nurse",
        "police officer", "firefighter", "farmer", "cook", "chef", "waiter", "waitress",
        "driver", "pilot", "artist", "musician", "actor", "actress", "singer", "writer",
        "dentist", "salesperson", "businessman", "businesswoman", "carpenter",
        "electrician", "plumber", "hairdresser", "barber", "photographer", "accountant",
        "librarian", "veterinarian", "journalist", "architect", "translator",
        "interpreter", "clerk", "scientist", "novelist", "reporter", "editor",
        "secretary", "banker", "soldier", "sailor", "fisherman", "miner", "baker",
        "butcher", "tailor", "mechanic", "pharmacist", "surgeon", "judge",
        "civil servant", "office worker", "part-time job",
    ],
    "dishes": [
        "dish", "meal", "cuisine", "dessert", "curry", "noodle", "noodles", "ramen",
        "sushi", "tempura", "dumpling", "sandwich", "porridge", "sukiyaki", "udon",
        "soba", "miso soup", "hot pot", "rice ball", "pizza", "salad", "pastry",
        "stew", "omelette", "pancake", "steak", "hamburger", "sausage", "bread",
        "cake", "pudding", "ice cream", "chocolate", "biscuit", "fried rice",
        "grilled meat", "boxed lunch", "breakfast", "lunch", "dinner", "snack",
    ],
    "animals": [
        "animal", "mammal", "dog", "cat", "horse", "cow", "cattle", "pig", "sheep",
        "goat", "chicken", "duck", "rabbit", "mouse", "rat", "elephant", "lion",
        "tiger", "bear", "monkey", "fox", "wolf", "deer", "snake", "frog", "turtle",
        "tortoise", "giraffe", "zebra", "camel", "kangaroo", "hedgehog", "raccoon",
        "squirrel", "hippopotamus", "rhinoceros", "leopard", "panda", "koala",
        "dolphin", "whale", "weasel", "otter", "boar", "donkey",
        "livestock", "pet", "puppy", "kitten", "calf", "lizard",
        # No "seal", "bat" or "mole": each is a commoner non-animal word in
        # English and pulled in 封 (an envelope seal), バット (a baseball
        # bat) and ほくろ (a skin mole). See the note above KEYWORDS.
    ],
    "colors": [
        "colour", "color", "red", "blue", "green", "yellow", "black", "white",
        "purple", "pink", "brown", "gray", "grey", "crimson", "scarlet", "turquoise",
        "beige", "indigo", "maroon", "pastel", "navy blue", "deep red", "deep blue",
        "orange", "violet", "emerald green",
        "light blue", "dark blue", "yellowish green", "vermilion",
        # No "gold", "silver", "ivory" or "amber": in Japanese those glosses
        # belong to the substance (黄金, 銀, 象牙, 琥珀), which is `materials`.
    ],
    "clothing": [
        "clothing", "clothes", "garment", "shirt", "trousers", "pants", "skirt",
        "dress", "jacket", "coat", "sweater", "suit", "necktie", "tie", "hat", "cap",
        "shoe", "shoes", "sock", "socks", "glove", "gloves", "scarf", "belt",
        "underwear", "kimono", "uniform", "raincoat", "swimsuit", "pajamas",
        "pyjamas", "mitten", "cardigan", "blouse", "jeans", "shorts", "vest",
        "apron", "sandals", "boots", "slippers", "sweatshirt", "sleeve", "pocket",
        "button", "collar", "hood",
    ],
    "weather": [
        "weather", "forecast", "climate", "rain", "snow", "wind", "storm", "typhoon",
        "cloud", "fog", "mist", "thunder", "lightning", "drizzle", "monsoon",
        "heatwave", "frost", "hail", "gale", "blizzard", "downpour", "sunshine",
        "humidity", "temperature", "rainbow", "shower", "breeze", "sleet", "dew",
        "rainy season", "clear weather", "cloudy weather", "weather forecast",
    ],
    "family": [
        "family", "father", "mother", "son", "daughter", "brother", "sister",
        "grandfather", "grandmother", "uncle", "aunt", "cousin", "nephew", "niece",
        "husband", "wife", "twin", "spouse", "stepfather", "stepmother", "parent",
        "parents", "sibling", "siblings", "relative", "relatives", "child", "children",
        "grandchild", "elder brother", "elder sister", "younger brother",
        "younger sister", "ancestor", "descendant", "household", "in-laws",
    ],
    "emotions": [
        "emotion", "feeling", "mood", "happy", "sad", "angry", "afraid", "joy",
        "sorrow", "surprise", "excited", "nervous", "worried", "love", "hate",
        "lonely", "jealous", "proud", "ashamed", "embarrassed", "loneliness", "grief",
        "delight", "resentment", "affection", "gratitude", "regret", "envy",
        "despair", "irritation", "nostalgia", "anxiety", "anger", "fear", "hope",
        "disappointment", "satisfaction", "sympathy", "pity", "shame", "pride",
        "courage", "patience", "happiness", "sadness", "loathing", "kindness",
    ],
    "nature": [
        "nature", "mountain", "river", "sea", "ocean", "lake", "forest", "woods",
        "valley", "waterfall", "volcano", "cliff", "cave", "meadow", "swamp",
        "canyon", "glacier", "island", "desert", "sky", "sun", "moon", "star",
        "stone", "rock", "wilderness", "horizon", "beach", "shore", "coast", "pond",
        "stream", "hill", "sand", "soil", "earth", "wave", "tide", "cape",
        "spring water", "marsh", "plain",
    ],
    "vehicles": [
        "vehicle", "transportation", "car", "bus", "train", "bicycle", "bike",
        "motorcycle", "truck", "ship", "boat", "airplane", "aeroplane", "aircraft",
        "subway", "taxi", "tram", "helicopter", "ambulance", "fire engine", "ferry",
        "yacht", "scooter", "spaceship", "submarine", "carriage", "sled", "sledge",
        "tractor", "rocket", "canoe", "raft", "wagon", "streetcar",
    ],
    "technology": [
        "technology", "device", "computer", "phone", "telephone", "smartphone",
        "camera", "television", "radio", "printer", "keyboard", "monitor", "robot",
        "battery", "laptop", "tablet", "headphones", "charger", "software",
        "hardware", "internet", "processor", "database", "server",
        "algorithm", "screen", "mouse", "speaker", "microphone", "cable", "network",
        "file", "password", "electricity", "machine", "engine", "circuit",
        "antenna", "satellite", "sensor",
    ],
    "sports": [
        "sport", "sports", "athlete", "soccer", "football", "baseball", "basketball",
        "tennis", "swimming", "volleyball", "golf", "boxing", "judo", "karate",
        "sumo", "skiing", "skating", "wrestling", "marathon", "gymnastics", "archery",
        "fencing", "badminton", "rugby", "cycling", "tournament",
        "referee", "stadium", "medal", "champion", "training", "practice",
        "table tennis", "ice hockey", "surfing", "climbing", "sprint", "relay",
    ],
    "music": [
        "music", "instrument", "musical instrument", "piano", "guitar", "violin",
        "trumpet", "flute", "drum", "cello", "saxophone", "harmonica", "song",
        "melody", "rhythm", "orchestra", "symphony", "harmony", "chorus", "concert",
        "singer", "composer", "conductor", "lyrics", "score", "opera", "jazz",
        "folk song", "national anthem", "recital", "tune", "musician",
        "harp", "accordion", "trombone", "clarinet",
    ],
    "kitchen_items": [
        "kitchen", "cookware", "utensil", "pot", "pan", "frying pan", "knife", "fork",
        "spoon", "chopsticks", "plate", "dish", "bowl", "cup", "glass", "kettle",
        "oven", "refrigerator", "fridge", "microwave", "cutting board", "colander",
        "ladle", "whisk", "grater", "spatula", "rolling pin", "strainer", "teapot",
        "saucepan", "tray", "lid", "apron", "sink", "stove", "dishcloth", "can opener",
    ],
    "office_supplies": [
        "office", "stationery", "pen", "pencil", "ballpoint pen", "fountain pen",
        "stapler", "scissors", "tape", "envelope", "folder", "binder", "eraser",
        "ruler", "glue", "notebook", "calculator", "paperclip", "highlighter",
        "clipboard", "whiteboard", "ink", "stamp", "paper", "file", "desk", "diary",
        "memo pad", "adhesive tape", "correction fluid", "pencil case",
    ],
    "shopping_money": [
        "money", "price", "shopping", "cost", "purchase", "payment", "coin",
        "banknote", "shop", "store", "market", "supermarket", "cashier",
        "receipt", "discount", "wallet", "purse", "bank", "currency", "coupon",
        "invoice", "refund", "warranty", "sale", "bargain", "customer",
        "salary", "wage", "tax", "budget", "savings", "debt", "loan", "credit card",
        "cash", "profit", "expense", "department store", "convenience store",
    ],
    "geography": [
        "geography", "region", "world", "country", "continent", "capital",
        "province", "prefecture", "city", "town", "village", "border", "territory",
        "archipelago", "hemisphere", "equator", "latitude", "longitude", "peninsula",
        "nation", "county", "district", "suburb", "population", "atlas",
        "globe", "north", "south", "east", "west", "colony", "frontier",
    ],
    "insects_bugs": [
        "insect", "bug", "mosquito", "cricket", "cicada", "dragonfly", "cockroach",
        "ladybug", "ladybird", "caterpillar", "centipede", "grasshopper", "beetle",
        "firefly", "moth", "ant", "bee", "butterfly", "spider", "larva", "wasp",
        "flea", "louse", "termite", "snail", "worm", "earthworm", "scorpion",
        "praying mantis", "silkworm", "honeybee", "hornet",
    ],
    "birds": [
        "bird", "sparrow", "pigeon", "dove", "eagle", "hawk", "owl", "swan",
        "parrot", "peacock", "penguin", "seagull", "crane", "woodpecker", "falcon",
        "stork", "nightingale", "crow", "raven", "duck", "goose", "chicken",
        "rooster", "swallow", "heron", "pheasant", "quail", "ostrich", "flamingo",
        "canary", "wing", "beak", "feather", "nest", "egg",
    ],
    "seafood": [
        "seafood", "shellfish", "shrimp", "prawn", "crab", "squid", "cuttlefish",
        "octopus", "clam", "oyster", "salmon", "seaweed", "lobster", "eel",
        "scallop", "sardine", "mackerel", "tuna", "fish", "cod", "trout", "carp",
        "sea bream", "flounder", "herring", "anchovy", "sea urchin", "jellyfish",
        "abalone", "bonito", "saury", "yellowtail", "pufferfish", "roe", "kelp",
        "raw fish", "dried fish", "grilled fish",
    ],
    "drinks": [
        "drink", "beverage", "water", "tea", "coffee", "juice", "milk", "beer",
        "wine", "sake", "soda", "cocktail", "lemonade", "smoothie", "espresso",
        "cola", "green tea", "black tea", "hot water", "mineral water", "whisky",
        "whiskey", "champagne", "cocoa", "soft drink", "alcohol", "liquor",
        "orange juice", "barley tea", "milk tea", "iced coffee",
    ],
    "shapes": [
        # No "form" or "outline" — 方式 "form, method, system", 大筋
        # "outline, summary" and フォーム "foam, form" are not shapes.
        "shape", "circle", "square", "triangle", "rectangle", "sphere",
        "cube", "cylinder", "oval", "ellipse", "hexagon", "pentagon", "octagon",
        "cone", "pyramid", "spiral", "arc", "diamond", "semicircle", "polygon",
        "rhombus", "prism", "trapezoid", "quadrilateral", "round shape",
        "cross shape", "star shape", "equilateral triangle", "right angle",
        "curved line", "straight line", "diagonal line", "parallel lines",
        "concentric circles", "symmetry", "contour", "silhouette",
    ],
    "materials": [
        "material", "fabric", "cloth", "wood", "metal", "iron", "steel", "plastic",
        "glass", "cotton", "wool", "silk", "leather", "rubber", "bronze", "aluminum",
        "aluminium", "cement", "concrete", "marble", "ceramic", "velvet", "linen",
        "copper", "brass", "tin", "lead", "zinc", "paper", "cardboard", "clay",
        "porcelain", "nylon", "polyester", "gold", "silver", "platinum", "stone",
        "brick", "plaster", "timber", "lumber",
    ],
    "tools": [
        "tool", "hammer", "screwdriver", "wrench", "spanner", "chisel", "drill",
        "pliers", "shovel", "spade", "crowbar", "sandpaper", "wheelbarrow", "saw",
        "axe", "nail", "screw", "ladder", "rope", "chain", "hook", "scissors",
        "file", "clamp", "bolt", "nut", "washer", "toolbox", "tape measure",
        "hoe", "sickle", "pickaxe", "needle", "thread",
    ],
    "medical": [
        "medicine", "medical treatment", "injection", "surgery", "symptom", "clinic",
        "bandage", "prescription", "vaccine", "diagnosis", "stethoscope",
        "anesthesia", "stitches", "crutches", "wheelchair", "pill", "tablet",
        "treatment", "illness", "disease", "patient", "injury", "wound", "fever",
        "cough", "headache", "therapy", "ointment", "syringe",
        "thermometer", "ambulance", "nurse", "surgeon", "infection", "allergy",
        "first aid", "hospital room", "cold", "influenza",
    ],
    "plants_trees": [
        "plant", "tree", "flower", "grass", "leaf", "blossom", "sapling", "bamboo",
        "moss", "fern", "vine", "petal", "pollen", "orchid", "cherry blossom",
        "pine", "pine tree", "bush", "shrub", "root", "stem", 
        "seed", "bud", "sprout", "weed", "maple", "willow", "oak", "cedar", "palm tree",
        "rose", "tulip", "sunflower", "lily", "chrysanthemum", "cactus", "ivy",
        "seedling", "bouquet", "forest tree",
    ],
    "household_items": [
        "household", "towel", "soap", "toothbrush", "toothpaste", "broom", "bucket",
        "vacuum cleaner", "washing machine", "clothespin", "detergent", "dustpan",
        "mop", "flashlight", "torch", "candle", "iron", "thermos", "blanket", "pillow",
        "sheet", "cushion", "shampoo", "comb", "brush", "razor", "hanger",
        "wastebasket", "clock", "key", "umbrella", "basket", "rubbish",
        "garbage", "trash", "dust", "sponge", "bathtub",
    ],
    "holidays_events": [
        "holiday", "celebration", "event", "party", "festival", "ceremony",
        "anniversary", "parade", "fireworks", "pilgrimage", "reunion", "banquet",
        "wedding", "birthday", "new year", "christmas", "funeral", "carnival",
        "vacation", "public holiday", "national holiday", "new year's day",
        "coming-of-age ceremony", "graduation ceremony", "opening ceremony",
        "closing ceremony", "summer festival", "memorial service", "feast",
    ],
}


# Innermost-first, applied until stable: JMdict nests them, and a single
# pass of r"\([^)]*\)" stops at the FIRST ")" -- which turned 犬's gloss
# "dog (Canis (lupus) familiaris)" into "dog familiaris)" and kept the
# commonest animal word in the language out of the animals theme.
_PAREN_INNER = re.compile(r"\([^()]*\)")


class _Paren:
    """Same .sub() surface as the compiled pattern it replaces."""
    @staticmethod
    def sub(repl: str, text: str) -> str:
        for _ in range(8):          # depth guard; real glosses nest twice at most
            stripped = _PAREN_INNER.sub(repl, text)
            if stripped == text:
                return text
            text = stripped
        return text


_PAREN = _Paren
_NEWS_BAND = re.compile(r"^news(\d+)k$")


def normalise(gloss: str) -> str:
    """Lowercase, drop parentheticals and Latin binomials, squeeze
    whitespace, trim trailing punctuation.

    Deliberately does NOT strip a leading article: "the red" must not
    become "red" (that is 赤字, a budget deficit) and "the world" must not
    become "world"."""
    return re.sub(r"\s+", " ", _PAREN.sub(" ", gloss).lower()).strip(" .,;:")


# Spelling variants that make one meaning look like two. Deliberately an
# explicit list, not a clever rule: every regex for these families does
# more harm than good on real glosses -- "our"->"or" turns tour into tor
# and hour into hor, "re"->"er" turns care into caer, "ium"->"um" turns
# stadium into stadum, and all four of those words are in these themes.
# Each pair below was found in the shipped data.
_SPELLING = {
    "theatre": "theater", "centre": "center", "metre": "meter",
    "fibre": "fiber", "litre": "liter", "colour": "color",
    "flavour": "flavor", "harbour": "harbor", "neighbour": "neighbor",
    "labour": "labor", "armour": "armor", "odour": "odor",
    "aluminium": "aluminum", "aeroplane": "airplane", "pyjamas": "pajamas",
    "grey": "gray", "plough": "plow", "mould": "mold", "storey": "story",
}
# A trailing plural, but never after "s" (glass, dress, grass) or "u"
# (bus, gas) -- stripping there invents a word.
_PLURAL = re.compile(r"(?<=[a-z]{3})(?<![su])s\b")


def dedupe_key(gloss: str) -> str:
    """One meaning, spelled one way.

    normalise() alone cannot tell two words apart by sense, because
    English gives the same meaning several spellings and both numbers.
    Folding them is what stops a theme carrying a word and its katakana
    twin: 劇場 "theatre" shipped beside シアター "theater", 靴 "shoe"
    beside シューズ "shoes", アルミ "aluminum" beside アルミニウム
    "aluminium".

    Used ONLY for deduping. Matching still runs on normalise(), and must
    -- loosening the matcher is exactly what the rebuild established
    never to do."""
    key = _PLURAL.sub("", normalise(gloss))
    return " ".join(_SPELLING.get(w, w) for w in key.split())


def gloss_keys(meaning: str) -> tuple[str, frozenset[str]]:
    """(head key, all keys) for a meaning.

    Parentheticals are stripped BEFORE the split on commas: splitting
    first leaves an unclosed parenthesis, the key keeps the whole tail,
    and 苺 "strawberry (esp. the garden strawberry, Fragaria x ananassa)"
    stops matching ストロベリー "strawberry" — which is how both survived
    the first pass."""
    parts = [k for k in (dedupe_key(p) for p in _PAREN.sub(" ", meaning).split(",")) if k]
    return (parts[0] if parts else ""), frozenset(parts)


def _is_duplicate(head: str, keys: frozenset[str],
                  seen_heads: set[str], seen_sets: set[frozenset[str]]) -> bool:
    """Two words are the same word to a learner when the gloss they will
    SEE is the same, or when their whole gloss sets agree.

    Only those two. A shared gloss anywhere is far too blunt: it merges
    手 "hand, arm" with 腕 "arm", 学生 "student" with 生徒 "pupil,
    student", 感じ "feeling, sense" with 感情 "emotion, feeling" and
    風邪 "cold, influenza" with インフルエンザ "influenza, flu" — all
    pairs a learner needs both halves of. Measured: that rule cost 64
    words and took `emotions` from 37 to 30.

    Head equality catches the katakana twins (靴 "shoe, shoes" vs
    シューズ "shoes", 劇場 "theatre" vs シアター "theater"); set equality
    catches the same glosses in the other order (店舗 "shop, store" vs
    店 "store, shop")."""
    return head in seen_heads or keys in seen_sets


def display_meaning(glosses: list[str], keep: int = 2) -> str:
    """The meaning as it is stored, and therefore as the card reads.

    Built from the glossary of the sense the word was MATCHED on, not
    from the deck's own gloss or `entries.meaning`. Those disagree often
    enough to matter (2.7% of the pool outright, and more on the deck
    side), and when they disagree the stored gloss is the one that does
    not explain why the word is in this theme: 羽根 entered `birds` on
    the gloss "feather" but the deck calls it "shuttlecock", 盆 entered
    `kitchen_items` on "tray" but the deck calls it "Lantern Festival".
    A card whose answer contradicts its own category is worse than a
    card with a slightly different wording elsewhere in the app.

    Parentheticals go — "peach (Prunus persica)" is the raw dictionary
    leaking onto the study screen — and only the first couple of glosses
    are kept so the answer stays a word rather than a paragraph."""
    parts = [p.strip() for p in _PAREN.sub(" ", ", ".join(glosses)).split(",")]
    parts = [re.sub(r"\s+", " ", p) for p in parts if p.strip()]
    seen, out = set(), []
    for p in parts:
        if p.lower() in seen:
            continue
        seen.add(p.lower())
        out.append(p)
        if len(out) >= keep:
            break
    return ", ".join(out) or meaning.strip()


def _score(term_tags: set[str]) -> float | None:
    """One frequency scale for both pools, from JMdict's own priority
    tags. Lower is commoner. None means "no priority signal at all" —
    the word is not a theme candidate, which is what keeps the archaic
    tail out. See the module docstring for why entries.freq_rank cannot
    be used for this."""
    bands = [int(m.group(1)) for m in map(_NEWS_BAND.match, term_tags) if m]
    if bands:
        return (min(bands) - 1) * 1000 + 500  # 500, 1500, ... 23500
    if "ichi" in term_tags:
        return 26000.0   # Ichimango Goi Bunruishuu, the 10k common-word list
    if "spec" in term_tags:
        return 30000.0   # flagged common by the JMdict editors
    if "gai" in term_tags:
        return 34000.0   # common loanword
    if "⭐" in term_tags:
        return 38000.0   # high-priority term, no finer signal
    return None


def _candidates(conn: sqlite3.Connection) -> list[dict]:
    """Every word eligible for any theme, from both pools, scored once.

    Built ONCE and matched against all 36 themes, rather than rescanning
    the 212k-row entries table per theme as the old build did."""
    out: list[dict] = []

    curated = {key: blob for key, blob in conn.execute("SELECT key, blob FROM curated_senses")}
    with open(_DECK_JSON, encoding="utf-8") as f:
        deck = json.load(f)
    seen_deck = set()
    for rank, level in enumerate(("N5", "N4", "N3", "N2", "N1")):
        for word in deck.get(level, []):
            kanji, kana = word.get("kanji", ""), word.get("kana", "")
            if (kanji, kana) in seen_deck:
                continue
            seen_deck.add((kanji, kana))
            blob = curated.get(f"{kanji}::{kana}")
            if not blob:
                continue
            out.append(_candidate("vocab", kanji, kana, word.get("meaning", ""), blob, rank))

    for kanji, kana, meaning, blob in conn.execute(
        "SELECT e.kanji, e.kana, e.meaning, s.blob FROM entries e JOIN senses s ON s.id = e.id"
    ):
        out.append(_candidate("vocab_jmdict", kanji, kana, meaning, blob, len("N5N4N3N2N1") // 2))

    return [c for c in out if c is not None]


def _candidate(domain: str, kanji: str, kana: str, meaning: str, blob: str,
               jlpt: int) -> dict | None:
    senses = json.loads(blob)          # parsed once per word, not once per theme
    if not senses:
        return None
    term_tags = {t for s in senses for t in s.get("term_tags", [])}
    score = _score(term_tags)
    if score is None:
        return None
    first = senses[0]
    tags = set(first.get("tags", []))
    if tags & _BAD_USAGE or tags & _NAME_TAG_CODES:
        return None
    glossary = first.get("glossary", [])
    if not glossary:
        return None
    return {
        "domain": domain, "kanji": kanji, "kana": kana,
        "meaning": display_meaning(glossary) or meaning.strip(),
        "score": score, "tags": tags, "gloss1": normalise(glossary[0]),
        "jlpt": jlpt,   # 0=N5 .. 4=N1; 5 for the pool, which has no level
    }


def _cut(n: int) -> list[int]:
    """Sizes of the four bands for a theme of n words: growing, and each
    at least one word wherever the theme has four to give."""
    if n <= 0:
        return [0, 0, 0, 0]
    if n < len(LEVELS):
        return [1] * n + [0] * (len(LEVELS) - n)
    sizes = [max(1, round(n * s)) for s in LEVEL_SHARES]
    while sum(sizes) > n:
        sizes[sizes.index(max(sizes))] -= 1
    while sum(sizes) < n:
        sizes[-1] += 1
    return sizes


def build() -> dict[str, list[dict]]:
    conn = sqlite3.connect(f"file:{_JMDICT_DB}?mode=ro", uri=True)
    try:
        candidates = _candidates(conn)
    finally:
        conn.close()

    themes: dict[str, list[dict]] = {}
    for theme in sorted(KEYWORDS):
        keys = {normalise(k) for k in KEYWORDS[theme]}
        field_deny = FIELD_DENY.get(theme, set())
        deny = DENY_SURFACE.get(theme, set())
        allow_adj = theme in _ADJ_THEMES

        hits = []
        for c in candidates:
            if c["gloss1"] not in keys:
                continue
            if (c["kanji"] or c["kana"]) in deny:
                continue
            if c["tags"] & field_deny:
                continue
            if not (c["tags"] & _NOUN_POS or (allow_adj and c["tags"] & _ADJ_POS)):
                continue
            hits.append(c)

        # Dedupe deck-first, then rank by frequency. Two passes, because
        # the two orders answer different questions.
        #
        # WHICH of two words meaning the same thing survives is a
        # curriculum question, and the app's own curated deck is the
        # curriculum -- deck first, and within it the level the deck
        # teaches the word at. Newspaper frequency answers neither: it
        # ranks 頭部 "head, cranium" over 頭 "head" and 頭脳 "brains"
        # over it again, so a score-ordered dedupe quietly drops the
        # word every beginner learns first for the one a broadsheet
        # prefers.
        hits.sort(key=lambda c: (c["domain"] != "vocab", c["jlpt"], c["score"],
                                 c["kanji"], c["kana"]))

        # `hits` is already commonest-first, so the survivor of any
        # collision is automatically the word a learner actually wants:
        # 劇場 over シアター, 靴 over シューズ, 店 over 店舗.
        rows = []
        seen_surface, seen_heads, seen_sets = set(), set(), set()
        for c in hits:
            surface = c["kanji"] or c["kana"]
            head, keys = gloss_keys(c["meaning"])
            if surface in seen_surface or _is_duplicate(head, keys, seen_heads, seen_sets):
                continue
            seen_surface.add(surface)
            seen_heads.add(head)
            seen_sets.add(keys)
            rows.append(c)

        # ...and WHAT ORDER a learner meets the survivors in is the
        # frequency question, which is the whole point of the bands.
        rows.sort(key=lambda c: (c["score"], c["domain"] != "vocab", c["kanji"], c["kana"]))

        sizes = _cut(len(rows))
        out, i = [], 0
        for level, size in zip(LEVELS, sizes):
            for c in rows[i:i + size]:
                out.append({
                    "rank": len(out) + 1,
                    "level": level,
                    "score": c["score"],
                    "domain": c["domain"],
                    "kanji": c["kanji"],
                    "kana": c["kana"],
                    "meaning": c["meaning"],   # already trimmed in _candidate
                })
            i += size
        themes[theme] = out

    return themes


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dump", metavar="THEME",
                    help="print every word of one theme (or 'all') and write nothing")
    args = ap.parse_args()

    themes = build()

    if args.dump:
        wanted = sorted(themes) if args.dump == "all" else [args.dump]
        for theme in wanted:
            rows = themes.get(theme)
            if rows is None:
                raise SystemExit(f"unknown theme: {theme}")
            print(f"\n=== {theme} ({len(rows)})")
            for r in rows:
                print(f"  {r['rank']:3d} {r['level']:9s} {int(r['score']):6d} "
                      f"{r['domain'][:5]:5s} {(r['kanji'] or r['kana']):12s} "
                      f"{r['kana']:16s} {r['meaning']}")
        return

    with open(_OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(themes, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")

    per_level: dict[str, int] = defaultdict(int)
    print(f"{'theme':20s}{'total':>6}   " + "".join(f"{l[:3]:>6}" for l in LEVELS) + "   deck")
    for theme in sorted(themes):
        rows = themes[theme]
        counts = {l: sum(1 for r in rows if r["level"] == l) for l in LEVELS}
        for l, n in counts.items():
            per_level[l] += n
        deck = sum(1 for r in rows if r["domain"] == "vocab")
        print(f"{theme:20s}{len(rows):6d}   " + "".join(f"{counts[l]:6d}" for l in LEVELS)
              + f"   {100 * deck // max(len(rows), 1):3d}%")
    total = sum(len(r) for r in themes.values())
    print(f"\n{len(themes)} themes, {total} words -> {_OUT_JSON} "
          f"({os.path.getsize(_OUT_JSON) // 1024} KB)")
    print("per level: " + ", ".join(f"{l} {per_level[l]}" for l in LEVELS))


if __name__ == "__main__":
    main()
