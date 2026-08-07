"""
Build script for thematic vocab decks ("fruits", "vegetables", "body
parts", ...) — the theme counterpart to frequency_data.py's tiers.

A theme is meant to hold actual INSTANCES of the category — "apple",
"banana", "strawberry" for fruits, not "fruit" itself, not "to bear
fruit", not "fruit juice". Two mechanisms enforce that:

1. Every theme's keyword list is split into "core" (specific named
   items — always included) and "broad" (the category word itself and
   related-but-not-a-member terms — only included at BROADNESS >= 2,
   see below). Getting this split right by hand, once, is what keeps
   "fruits" from pulling in "dried fruit" or "fruit juice" — no amount
   of automatic filtering fixes a keyword list that was too broad to
   begin with.

2. Independently of core/broad, every match is required to actually BE
   a noun/thing, not an action — a JMdict-pool match needs a noun POS
   tag in the entries table's own senses (see _is_noun_jmdict), and a
   curated-deck match is dropped if its meaning reads like a verb
   entry ("to bear fruit", "to pick (fruit)" — this deck's own
   convention for a verb gloss is a leading "to ", see
   _looks_like_verb). This runs at every broadness level: "broad"
   loosens which WORDS are eligible, it never loosens "must be a
   noun".

BROADNESS (module constant, default 1):
  1 = core keywords only — the tight, "actual members of the
      category" behaviour.
  2 = core + broad keywords — also pulls in the umbrella/category term
      itself and closely related nouns (e.g. "fruit", "berry" for
      fruits). Looser, bigger decks.
  Per-theme overrides go in THEME_BROADNESS (e.g. to loosen just
  "weather" without loosening everything). Can also be set from the
  command line: `python build_theme_db.py 2`.

Output is a small SQLite table (theme_words), NOT a big JSON blob and
NOT an in-memory structure loaded at import time (same reasoning as
vocab_jmdict_data.py's own migration) — theme_data.py at runtime
queries it exactly like vocab_jmdict_data.py queries entries, so
memory footprint stays flat regardless of how many themes exist.

Run offline: `python build_theme_db.py [broadness]`. Safe to re-run —
DROPs and rebuilds the theme_words table each time.
"""
import json
import os
import re
import sqlite3
import sys

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_VOCAB_DIR = os.path.join(_BASE_DIR, "datas", "vocab")
_JMDICT_DB = os.path.join(_VOCAB_DIR, "vocab_jmdict.sqlite3")
_DECK_JSON = os.path.join(_VOCAB_DIR, "vocab_deck.json")
_TAGS_JSON = os.path.join(_VOCAB_DIR, "vocab_tags.json")

DEFAULT_BROADNESS = 1

# Per-theme override of DEFAULT_BROADNESS — empty by default, meaning
# every theme uses DEFAULT_BROADNESS unless listed here.
THEME_BROADNESS: dict[str, int] = {}

# Cap on how many JMdict-pool words feed a single theme (beyond
# whatever the curated deck already contributes) — keeps each theme a
# tight, high-frequency selection instead of dumping in every obscure
# JMdict match, and keeps the output table small. Curated-deck matches
# are never capped: the app's own deck is already hand-picked and only
# a few thousand entries total.
MAX_JMDICT_PER_THEME = 220

with open(_TAGS_JSON, encoding="utf-8") as f:
    _TAG_INFO = json.load(f)

# JMdict entries tagged with a category="name" code (place, person,
# company, given, surname, myth, dei, fict, work, ...) are proper
# nouns — never useful in a themed vocab deck, and easy to mismatch
# (e.g. a person's name that happens to contain a food word).
_NAME_TAG_CODES = {code for code, info in _TAG_INFO.items() if info.get("category") == "name"}

# partOfSpeech codes that mark an entry as a genuine noun/thing rather
# than a verb, adjective, adverb, particle, etc. — n-pr (proper noun)
# is deliberately excluded here too: a proper noun belongs to the
# "name" exclusion above, not to a themed word list, even on the rare
# case it isn't already tagged with one of _NAME_TAG_CODES.
_NOUN_POS_CODES = {"n", "n-adv", "n-pref", "n-suf", "n-t"}

# theme_key -> [exclude phrases]. Whole-word matching (below) already
# rules out most false positives ("chairman" doesn't match "chair"),
# but a handful of set phrases still slip through because the keyword
# genuinely appears in an unrelated gloss ("head of a section" for
# "head", "Fig 1" for "fig", used as an abbreviation for "figure").
# Checked (and only removed) by hand against actual build output — add
# to this as you spot more false positives; it costs nothing at
# runtime, only at build time.
EXCLUDES: dict[str, list[str]] = {
    "body_parts": ["head of", "head office", "figurehead"],
    "fruits": ["fig 1", "e.g. fig", "fig."],
}

# theme_key -> {"core": [...], "broad": [...]}. "core" is specific,
# concrete, individually-nameable items — the actual members of the
# category. "broad" is the umbrella term itself plus closely related
# nouns that describe the category without being a member of it
# ("fruit", "berry" for a fruits deck) — only pulled in at
# BROADNESS >= 2 (see module docstring). Keywords are matched
# whole-word (\b...\b, case-insensitive) against the gloss text, so
# "chair" won't match "chairman" and "rain" won't match "brain".
THEMES: dict[str, dict[str, list[str]]] = {
    "fruits": {
        "core": ["apple", "banana", "strawberry", "peach", "pear", "melon", "watermelon",
                  "cherry", "cherries", "lemon", "lime", "pineapple", "mango", "kiwi", "fig",
                  "plum", "apricot", "persimmon", "coconut", "papaya", "raspberry",
                  "blueberry", "pomegranate", "tangerine", "chestnut", "grape", "grapes"],
        "broad": ["fruit", "berry", "citrus", "tropical fruit"],
    },
    "vegetables": {
        "core": ["carrot", "potato", "onion", "tomato", "cucumber", "cabbage", "lettuce",
                  "spinach", "eggplant", "pumpkin", "radish", "garlic", "ginger", "broccoli",
                  "corn", "mushroom", "turnip", "celery", "asparagus", "leek", "yam",
                  "scallion", "sweet potato", "bamboo shoot"],
        "broad": ["vegetable", "root vegetable", "sprout"],
    },
    "body_parts": {
        "core": ["head", "face", "eye", "ear", "nose", "mouth", "tooth", "teeth", "tongue",
                  "neck", "shoulder", "elbow", "wrist", "finger", "chest", "stomach", "waist",
                  "hip", "knee", "ankle", "toe", "skin", "bone", "muscle", "brain", "heart",
                  "lung", "liver", "throat", "eyebrow", "eyelash", "cheek", "chin", "forehead",
                  "fingernail", "eyelid", "spine", "rib", "artery", "vein", "nerve", "kidney",
                  "arm", "leg", "hand", "foot"],
        "broad": ["body", "organ", "limb"],
    },
    "rooms": {
        "core": ["bedroom", "kitchen", "bathroom", "living room", "dining room", "hallway",
                  "corridor", "closet", "attic", "basement", "garage", "balcony", "veranda",
                  "entrance hall", "restroom", "lavatory", "toilet"],
        "broad": ["room"],
    },
    "buildings": {
        "core": ["apartment", "hospital", "temple", "shrine", "church", "castle", "tower",
                  "factory", "library", "museum", "stadium", "skyscraper", "warehouse",
                  "cottage", "mansion", "palace", "dormitory", "embassy", "cathedral",
                  "school", "station", "hotel", "bridge"],
        "broad": ["building"],
    },
    "furniture": {
        "core": ["chair", "desk", "table", "bed", "sofa", "couch", "bookshelf", "cupboard",
                  "wardrobe", "drawer", "cabinet", "bench", "stool", "mirror", "curtain",
                  "carpet", "futon", "shelf", "nightstand", "rug", "lamp"],
        "broad": ["furniture"],
    },
    "school": {
        "core": ["classroom", "textbook", "blackboard", "chalk", "university", "professor",
                  "principal", "schoolbag", "semester", "kindergarten", "homework", "exam",
                  "notebook", "pencil", "backpack", "teacher", "student"],
        "broad": ["school", "education", "curriculum", "lecture", "tuition", "scholarship",
                   "diploma", "recess", "schoolwork"],
    },
    "travel": {
        "core": ["airport", "passport", "luggage", "suitcase", "ticket", "itinerary",
                  "souvenir", "visa", "train station", "boarding pass"],
        "broad": ["travel", "trip", "journey", "tourist", "sightseeing", "voyage",
                   "excursion", "layover", "customs", "immigration"],
    },
    "jobs": {
        "core": ["doctor", "teacher", "engineer", "lawyer", "nurse", "police officer",
                  "firefighter", "farmer", "cook", "chef", "waiter", "waitress", "driver",
                  "pilot", "artist", "musician", "actor", "actress", "singer", "writer",
                  "dentist", "salesperson", "businessman", "businesswoman", "carpenter",
                  "electrician", "plumber", "hairdresser", "barber", "photographer",
                  "president", "accountant", "librarian", "veterinarian", "journalist",
                  "architect", "translator", "interpreter", "clerk", "scientist"],
        "broad": ["occupation", "profession", "employee", "worker"],
    },
    "dishes": {
        "core": ["curry", "noodle", "ramen", "sushi", "tempura", "dumpling", "sandwich",
                  "porridge", "sukiyaki", "udon", "soba", "miso soup", "hot pot",
                  "rice ball", "pizza", "salad"],
        "broad": ["dish", "meal", "cuisine", "dessert", "pastry", "recipe", "stir-fry",
                   "casserole", "broth"],
    },
    "animals": {
        "core": ["dog", "cat", "horse", "cow", "pig", "sheep", "goat", "chicken", "duck",
                  "rabbit", "mouse", "rat", "elephant", "lion", "tiger", "bear", "monkey",
                  "fox", "wolf", "deer", "snake", "frog", "turtle", "giraffe", "zebra",
                  "camel", "kangaroo", "hedgehog", "raccoon", "squirrel"],
        "broad": ["animal", "mammal", "creature", "wildlife"],
    },
    "colors": {
        "core": ["red", "blue", "green", "yellow", "black", "white", "purple", "pink",
                  "brown", "gray", "grey", "crimson", "scarlet", "turquoise", "beige",
                  "indigo", "maroon", "pastel", "navy blue"],
        "broad": ["color", "colour", "hue", "shade"],
    },
    "clothing": {
        "core": ["shirt", "trousers", "skirt", "dress", "jacket", "coat", "sweater", "suit",
                  "necktie", "hat", "cap", "shoe", "shoes", "sock", "socks", "glove", "scarf",
                  "belt", "underwear", "kimono", "uniform", "raincoat", "swimsuit",
                  "pajamas", "mitten", "cardigan"],
        "broad": ["clothing", "clothes", "garment", "apparel"],
    },
    "weather": {
        "core": ["rain", "snow", "wind", "storm", "typhoon", "cloud", "fog", "thunder",
                  "lightning", "drizzle", "monsoon", "heatwave", "frost", "hail", "gale",
                  "blizzard", "downpour", "sunshine"],
        "broad": ["weather", "forecast", "climate", "humidity", "temperature"],
    },
    "family": {
        "core": ["father", "mother", "son", "daughter", "brother", "sister", "grandfather",
                  "grandmother", "uncle", "aunt", "cousin", "nephew", "niece", "husband",
                  "wife", "twin", "spouse", "stepfather", "stepmother"],
        "broad": ["family", "parent", "sibling", "relative", "in-law", "child", "children"],
    },
    "emotions": {
        "core": ["happy", "sad", "angry", "afraid", "joy", "sorrow", "surprise", "excited",
                  "nervous", "worried", "love", "hate", "lonely", "jealous", "proud",
                  "ashamed", "embarrassed", "loneliness", "grief", "delight", "resentment",
                  "affection", "gratitude", "regret", "envy", "despair", "relief",
                  "irritation", "nostalgia", "anxiety"],
        "broad": ["emotion", "feeling", "mood"],
    },
    "nature": {
        "core": ["mountain", "river", "sea", "ocean", "lake", "forest", "valley",
                  "waterfall", "volcano", "cliff", "cave", "meadow", "swamp", "canyon",
                  "glacier", "island", "desert", "sky", "sun", "moon", "star", "stone",
                  "rock", "wilderness", "horizon"],
        "broad": ["nature"],
    },
    "vehicles": {
        "core": ["car", "bus", "train", "bicycle", "bike", "motorcycle", "truck", "ship",
                  "boat", "airplane", "subway", "taxi", "tram", "helicopter", "ambulance",
                  "fire engine", "ferry", "yacht", "scooter", "spaceship", "submarine",
                  "carriage", "sled"],
        "broad": ["vehicle", "transportation"],
    },
    "technology": {
        "core": ["computer", "phone", "smartphone", "camera", "television", "radio",
                  "printer", "keyboard", "monitor", "robot", "battery", "laptop", "tablet",
                  "headphones", "charger"],
        "broad": ["technology", "device", "software", "hardware", "internet",
                   "application", "processor", "database", "server", "algorithm"],
    },
    "sports": {
        "core": ["soccer", "football", "baseball", "basketball", "tennis", "swimming",
                  "volleyball", "golf", "boxing", "judo", "karate", "sumo", "skiing",
                  "skating", "wrestling", "marathon", "gymnastics", "archery", "fencing",
                  "badminton", "running", "rugby", "cycling"],
        "broad": ["sport", "athlete", "game", "match", "team", "tournament", "referee"],
    },
    "music": {
        "core": ["piano", "guitar", "violin", "trumpet", "flute", "drum", "cello",
                  "saxophone", "harmonica", "song"],
        "broad": ["music", "instrument", "melody", "rhythm", "orchestra", "symphony",
                   "harmony", "chorus", "concert", "band"],
    },
    "kitchen_items": {
        "core": ["pot", "pan", "frying pan", "knife", "fork", "spoon", "chopsticks",
                  "plate", "bowl", "cup", "glass", "kettle", "oven", "refrigerator",
                  "fridge", "microwave", "cutting board", "colander", "ladle", "whisk",
                  "grater", "spatula", "rolling pin", "strainer"],
        "broad": ["kitchen", "cookware", "utensil"],
    },
    "office_supplies": {
        "core": ["pen", "pencil", "stapler", "scissors", "tape", "envelope", "folder",
                  "binder", "eraser", "ruler", "glue", "notebook", "calculator",
                  "paperclip", "highlighter", "clipboard", "whiteboard"],
        "broad": ["office", "stationery", "supplies"],
    },
    "shopping_money": {
        "core": ["coin", "bill", "shop", "store", "market", "supermarket", "cashier",
                  "receipt", "discount", "wallet", "bank", "currency", "banknote",
                  "coupon", "invoice", "refund", "installment", "warranty"],
        "broad": ["money", "price", "shopping", "cost", "purchase", "payment"],
    },
    "geography": {
        "core": ["country", "continent", "capital", "province", "prefecture", "city",
                  "town", "village", "border", "territory", "archipelago", "hemisphere",
                  "equator", "latitude", "longitude", "peninsula"],
        "broad": ["geography", "region", "map", "world"],
    },
    "insects_bugs": {
        "core": ["mosquito", "cricket", "cicada", "dragonfly", "cockroach", "ladybug",
                  "caterpillar", "centipede", "grasshopper", "beetle", "firefly", "moth",
                  "ant", "bee", "butterfly", "spider", "larva"],
        "broad": ["insect", "bug"],
    },
    "birds": {
        "core": ["sparrow", "pigeon", "eagle", "hawk", "owl", "swan", "parrot", "peacock",
                  "penguin", "seagull", "crane", "woodpecker", "falcon", "stork",
                  "nightingale", "crow"],
        "broad": ["bird"],
    },
    "seafood": {
        "core": ["shrimp", "crab", "squid", "octopus", "clam", "oyster", "salmon",
                  "seaweed", "lobster", "eel", "scallop", "sardine", "mackerel", "tuna"],
        "broad": ["seafood"],
    },
    "drinks": {
        "core": ["water", "tea", "coffee", "juice", "milk", "beer", "wine", "sake", "soda",
                  "cocktail", "lemonade", "smoothie", "espresso", "cola"],
        "broad": ["drink", "beverage"],
    },
    "shapes": {
        "core": ["circle", "square", "triangle", "rectangle", "sphere", "cube", "cylinder",
                  "oval", "hexagon"],
        "broad": ["shape"],
    },
    "materials": {
        "core": ["wood", "metal", "iron", "steel", "plastic", "glass", "cotton", "wool",
                  "silk", "leather", "rubber", "bronze", "aluminum", "cement", "concrete",
                  "marble", "ceramic", "velvet", "linen"],
        "broad": ["material", "fabric", "cloth"],
    },
    "tools": {
        "core": ["hammer", "screwdriver", "wrench", "chisel", "drill", "pliers", "shovel",
                  "crowbar", "sandpaper", "wheelbarrow", "saw", "axe", "nail", "screw",
                  "ladder"],
        "broad": ["tool"],
    },
    "medical": {
        "core": ["medicine", "injection", "surgery", "symptom", "clinic", "bandage",
                  "prescription", "vaccine", "diagnosis", "stethoscope", "anesthesia",
                  "stitches", "crutches", "wheelchair", "pill"],
        "broad": ["medical", "treatment", "illness", "disease", "patient", "injury"],
    },
    "plants_trees": {
        "core": ["tree", "blossom", "sapling", "bamboo", "moss", "fern", "vine", "petal",
                  "pollen", "orchid", "cherry blossom", "pine", "bush", "leaf", "flower",
                  "grass"],
        "broad": ["plant"],
    },
    "household_items": {
        "core": ["towel", "soap", "toothbrush", "broom", "bucket", "vacuum cleaner",
                  "washing machine", "clothespin", "detergent", "dustpan", "mop",
                  "flashlight", "candle", "thermos", "blanket", "pillow"],
        "broad": ["household"],
    },
    "holidays_events": {
        "core": ["festival", "ceremony", "anniversary", "parade", "fireworks",
                  "pilgrimage", "reunion", "banquet", "wedding", "birthday", "new year"],
        "broad": ["holiday", "celebration", "event", "party"],
    },
}


def _pattern(keyword: str) -> re.Pattern:
    return re.compile(rf"\b{re.escape(keyword)}\b", re.IGNORECASE)


def _load_deck():
    with open(_DECK_JSON, encoding="utf-8") as f:
        deck = json.load(f)
    for level, words in deck.items():
        for w in words:
            yield w.get("kanji", ""), w.get("kana", ""), w.get("meaning", "")


_VERB_LEAD = re.compile(r"^\s*to\s+\w", re.IGNORECASE)


def _looks_like_verb(meaning: str) -> bool:
    """This deck's own convention for a verb gloss is a leading "to "
    ("to bear fruit", "to pick (fruit)") — see the samples in
    vocab_data.py's own docstring examples. Cheap and, checked against
    the actual deck, reliable: nouns/adjectives here are bare
    ("cloudy weather", "fat"), never "to "-prefixed. Only the FIRST
    comma-separated gloss is checked, since some entries pack a noun
    and verb sense together ("talk,story" vs "to appear,to leave") —
    checking the whole string would misfire on a trailing verb sense
    tacked onto an otherwise-fine noun gloss."""
    first = meaning.split(",")[0]
    return bool(_VERB_LEAD.match(first))


def _is_noun_jmdict(blob: str | None) -> bool:
    """True if at least one sense carries a genuine noun POS tag (see
    _NOUN_POS_CODES) — drops verb/adjective/adverb/etc. glosses that
    happen to contain a theme keyword by coincidence ("to bear fruit"
    matching "fruit"). No senses row at all is treated as "can't
    verify, don't include" rather than assumed-fine."""
    if not blob:
        return False
    senses = json.loads(blob)
    tags = {t for s in senses for t in s.get("tags", [])}
    return bool(tags & _NOUN_POS_CODES)


def build(default_broadness: int = DEFAULT_BROADNESS):
    conn = sqlite3.connect(_JMDICT_DB)
    conn.execute("DROP TABLE IF EXISTS theme_words")
    conn.execute(
        "CREATE TABLE theme_words ("
        " theme TEXT NOT NULL,"
        " rank INTEGER NOT NULL,"
        " domain TEXT NOT NULL,"       # 'vocab' (curated deck) | 'vocab_jmdict'
        " kanji TEXT NOT NULL,"
        " kana TEXT NOT NULL,"
        " meaning TEXT NOT NULL"
        ")"
    )

    curated = list(_load_deck())  # small (~8k), fine to hold transiently during build

    def _patterns_for(theme: str) -> list[re.Pattern]:
        cfg = THEMES[theme]
        broadness = THEME_BROADNESS.get(theme, default_broadness)
        keywords = list(cfg["core"])
        if broadness >= 2:
            keywords += cfg["broad"]
        return [_pattern(k) for k in keywords]

    exclude_patterns = {
        theme: [_pattern(x) if " " not in x and "." not in x else re.compile(re.escape(x), re.IGNORECASE) for x in kws]
        for theme, kws in EXCLUDES.items()
    }

    def _excluded(theme: str, meaning: str) -> bool:
        return any(p.search(meaning) for p in exclude_patterns.get(theme, []))

    stats = {}
    for theme in THEMES:
        pats = _patterns_for(theme)
        rank = 0
        seen = set()

        # 1) curated deck first — always included, never capped.
        for kanji, kana, meaning in curated:
            key = (kanji, kana)
            if key in seen:
                continue
            if not any(p.search(meaning) for p in pats):
                continue
            if _excluded(theme, meaning) or _looks_like_verb(meaning):
                continue
            rank += 1
            seen.add(key)
            conn.execute(
                "INSERT INTO theme_words VALUES (?,?,?,?,?,?)",
                (theme, rank, "vocab", kanji, kana, meaning),
            )

        # 2) JMdict pool fills in the rest, ordered by freq_rank (most
        # common first), capped, noun-only, excluding proper nouns.
        jmdict_count = 0
        cur = conn.execute(
            "SELECT e.kanji, e.kana, e.meaning, e.freq_rank, s.blob "
            "FROM entries e LEFT JOIN senses s ON s.id = e.id "
            "ORDER BY e.freq_rank"
        )
        for kanji, kana, meaning, freq_rank, blob in cur:
            if jmdict_count >= MAX_JMDICT_PER_THEME:
                break
            key = (kanji, kana)
            if key in seen:
                continue
            if not any(p.search(meaning) for p in pats):
                continue
            if _excluded(theme, meaning):
                continue
            if not _is_noun_jmdict(blob):
                continue
            senses = json.loads(blob)
            tags = {t for s in senses for t in s.get("tags", [])}
            if tags & _NAME_TAG_CODES:
                continue
            rank += 1
            jmdict_count += 1
            seen.add(key)
            conn.execute(
                "INSERT INTO theme_words VALUES (?,?,?,?,?,?)",
                (theme, rank, "vocab_jmdict", kanji, kana, meaning),
            )

        stats[theme] = rank

    conn.execute("CREATE INDEX idx_theme_words_theme_rank ON theme_words(theme, rank)")
    conn.execute("CREATE UNIQUE INDEX idx_theme_words_key ON theme_words(theme, domain, kanji, kana)")
    conn.commit()
    conn.close()
    return stats


if __name__ == "__main__":
    broadness = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_BROADNESS
    stats = build(default_broadness=broadness)
    total = sum(stats.values())
    for theme, count in sorted(stats.items(), key=lambda kv: -kv[1]):
        print(f"{theme:20s} {count:5d}")
    print(f"\nTOTAL rows: {total}  (broadness={broadness})")