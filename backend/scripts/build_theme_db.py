"""
Prototype/build script for thematic vocab decks ("fruits", "vegetables",
"body parts", ...) — the theme counterpart to frequency_data.py's tiers.

Approach: classify every word in the app's own curated JLPT deck
(vocab_deck.json) AND the JMdict pool (vocab_jmdict.sqlite3) by matching
whole-word English keywords against each entry's gloss, per theme. No
new hand-built wordlists to maintain by hand — themes are keyword rules
run once, offline, against data that already exists.

Output is a small SQLite table (theme_words), NOT a big JSON blob and
NOT an in-memory structure loaded at import time (same reasoning as
vocab_jmdict_data.py's own migration) — themes.py/theme_data.py at
runtime query it exactly like vocab_jmdict_data.py queries entries, so
memory footprint stays flat regardless of how many themes exist.

Run offline: `python build_theme_db.py`. Safe to re-run — DROPs and
rebuilds the theme_words table each time.
"""
import json
import os
import re
import sqlite3

# This script lives in backend/scripts/ (alongside build_jmdict_db.py
# etc.), one level below backend/ itself — datas/ sits next to
# scripts/, not inside it, so this needs dirname() twice.
_BASE_DIR = os.path.dirname(os.path.dirname(__file__))
_VOCAB_DIR = os.path.join(_BASE_DIR, "datas", "vocab")
_JMDICT_DB = os.path.join(_VOCAB_DIR, "vocab_jmdict.sqlite3")
_DECK_JSON = os.path.join(_VOCAB_DIR, "vocab_deck.json")
_TAGS_JSON = os.path.join(_VOCAB_DIR, "vocab_tags.json")

# Cap on how many JMdict-pool words feed a single theme (beyond
# whatever the curated deck already contributes) — keeps each theme a
# tight, high-frequency selection instead of dumping in every obscure
# JMdict match, and keeps the output table small. Curated-deck matches
# are never capped: the app's own deck is already hand-picked and only
# a few thousand entries total.
MAX_JMDICT_PER_THEME = 220

# JMdict entries tagged with a category="name" code (place, person,
# company, given, surname, myth, dei, fict, work, ...) are proper
# nouns — never useful in a themed vocab deck, and easy to mismatch
# (e.g. a person's name that happens to contain a food word). Loaded
# from vocab_tags.json so this stays in sync with whatever categories
# actually exist there rather than a hardcoded code list.
with open(_TAGS_JSON, encoding="utf-8") as f:
    _TAG_INFO = json.load(f)
_NAME_TAG_CODES = {code for code, info in _TAG_INFO.items() if info.get("category") == "name"}

# theme_key -> [exclude phrases]. Whole-word matching (below) already
# rules out most false positives ("chairman" doesn't match "chair"),
# but a handful of set phrases still slip through because the keyword
# genuinely appears in an unrelated gloss ("head of a section" for
# "head", "Fig 1" for "fig", used as an abbreviation for "figure").
# Checked (and only removed) by hand against the actual build output —
# add to this as you spot more false positives; it costs nothing at
# runtime, only at build time.
EXCLUDES: dict[str, list[str]] = {
    "body_parts": ["head of", "head office", "figurehead"],
    "fruits": ["fig 1", "e.g. fig", "fig."],
}

# theme_key -> (translation-key stem, [keywords]). Keywords are matched
# whole-word (\b...\b, case-insensitive) against the gloss text, so
# "chair" won't match "chairman" and "rain" won't match "brain". Feel
# free to extend any list — this is data, not logic.
THEMES: dict[str, list[str]] = {
    "fruits": ["apple", "orange", "banana", "grape", "grapes", "strawberry", "peach",
               "pear", "melon", "watermelon", "cherry", "cherries", "lemon", "lime",
               "pineapple", "mango", "kiwi", "fig", "plum", "apricot", "persimmon",
               "fruit", "berry", "coconut", "papaya", "raspberry", "blueberry",
               "pomegranate", "tangerine", "citrus", "chestnut"],
    "vegetables": ["carrot", "potato", "onion", "tomato", "cucumber", "cabbage",
                   "lettuce", "spinach", "eggplant", "pumpkin", "radish", "garlic",
                   "ginger", "broccoli", "corn", "mushroom", "vegetable", "turnip",
                   "celery", "asparagus", "leek", "yam", "scallion", "sprout"],
    "body_parts": ["head", "face", "eye", "ear", "nose", "mouth", "tooth", "teeth",
                   "tongue", "neck", "shoulder", "elbow", "wrist", "finger", "chest",
                   "stomach", "waist", "hip", "knee", "ankle", "toe", "skin", "bone",
                   "muscle", "brain", "heart", "lung", "liver", "throat", "eyebrow",
                   "eyelash", "cheek", "chin", "forehead", "fingernail", "eyelid",
                   "spine", "rib", "artery", "vein", "nerve", "kidney"],
    "rooms": ["bedroom", "kitchen", "bathroom", "hallway", "corridor", "closet",
              "attic", "basement", "garage", "balcony", "veranda", "study room",
              "living room", "dining room", "entrance hall", "restroom", "lavatory"],
    "buildings": ["building", "apartment", "hospital", "temple", "shrine", "church",
                  "castle", "tower", "factory", "library", "museum", "stadium",
                  "skyscraper", "warehouse", "cottage", "mansion", "palace",
                  "dormitory", "embassy", "cathedral"],
    "furniture": ["chair", "desk", "sofa", "couch", "bookshelf", "cupboard",
                  "wardrobe", "drawer", "cabinet", "bench", "stool", "mirror",
                  "curtain", "carpet", "futon", "shelf", "nightstand"],
    "school": ["classroom", "textbook", "homework", "blackboard", "chalk",
               "university", "professor", "principal", "schoolbag", "semester",
               "recess", "curriculum", "scholarship", "diploma", "tuition",
               "kindergarten", "schoolwork", "lecture"],
    "travel": ["tourist", "airport", "passport", "luggage", "suitcase",
               "itinerary", "sightseeing", "souvenir", "visa", "boarding",
               "voyage", "excursion", "layover", "customs", "immigration"],
    "jobs": ["lawyer", "firefighter", "farmer", "waitress", "waiter", "pilot",
             "dentist", "salesperson", "carpenter", "electrician", "plumber",
             "hairdresser", "photographer", "occupation", "profession",
             "bureaucrat", "civil servant", "accountant", "librarian",
             "veterinarian", "journalist", "architect", "translator",
             "interpreter", "clerk"],
    "dishes": ["curry", "noodle", "ramen", "sushi", "tempura", "dumpling",
               "dessert", "pastry", "sandwich", "porridge", "sukiyaki",
               "udon", "soba", "miso soup", "hot pot", "stir-fry", "casserole"],
    "animals": ["horse", "cow", "pig", "sheep", "goat", "chicken", "duck",
                "rabbit", "elephant", "lion", "tiger", "monkey", "fox", "wolf",
                "deer", "snake", "frog", "turtle", "giraffe", "zebra", "camel",
                "kangaroo", "hedgehog", "raccoon", "squirrel", "bat (animal)"],
    "colors": ["crimson", "scarlet", "turquoise", "beige", "indigo", "maroon",
               "lavender (color)", "colour", "pastel"],
    "clothing": ["trousers", "sweater", "necktie", "kimono", "underwear",
                 "raincoat", "swimsuit", "pajamas", "mitten", "cardigan",
                 "sleeve", "collar (clothing)", "button-down"],
    "weather": ["typhoon", "drizzle", "humidity", "forecast", "thunderstorm",
                "monsoon", "heatwave", "frost", "hail", "gale", "blizzard",
                "downpour"],
    "family": ["grandfather", "grandmother", "nephew", "niece", "sibling",
                "in-law", "stepfather", "stepmother", "twin", "spouse",
                "great-grandfather", "great-grandmother", "relative"],
    "emotions": ["loneliness", "jealous", "embarrassed", "anxiety", "grief",
                 "delight", "resentment", "affection", "gratitude", "regret",
                 "envy", "despair", "relief", "irritation", "nostalgia"],
    "nature": ["mountain", "valley", "waterfall", "volcano", "cliff", "cave",
               "meadow", "swamp", "canyon", "glacier", "peninsula", "plateau",
               "wilderness", "horizon"],
    "vehicles": ["motorcycle", "subway", "helicopter", "ambulance",
                 "fire engine", "ferry", "yacht", "scooter", "tram",
                 "spaceship", "submarine", "carriage", "sled"],
    "technology": ["smartphone", "software", "hardware", "keyboard", "monitor",
                   "application", "processor", "database", "server", "wireless",
                   "algorithm", "artificial intelligence", "webpage",
                   "download", "upload", "password"],
    "sports": ["basketball", "volleyball", "wrestling", "boxing", "judo",
               "karate", "sumo", "marathon", "gymnastics", "archery",
               "fencing", "badminton", "referee", "tournament", "athlete"],
    "music": ["piano", "guitar", "violin", "trumpet", "flute", "melody",
              "rhythm", "orchestra", "symphony", "harmony", "chorus",
              "conductor", "cello", "saxophone", "harmonica"],
    "kitchen_items": ["frying pan", "chopsticks", "kettle", "microwave",
                       "cutting board", "colander", "ladle", "whisk",
                       "grater", "spatula", "rolling pin", "strainer"],
    "office_supplies": ["stapler", "envelope", "binder", "eraser", "ruler",
                          "paperclip", "highlighter", "clipboard", "whiteboard"],
    "shopping_money": ["receipt", "discount", "banknote", "wallet",
                        "currency", "cashier", "installment", "coupon",
                        "warranty", "refund", "invoice"],
    "geography": ["continent", "peninsula", "hemisphere", "equator", "border",
                  "province", "territory", "archipelago", "latitude",
                  "longitude"],
    "insects_bugs": ["mosquito", "cricket", "cicada", "dragonfly", "cockroach",
                       "ladybug", "caterpillar", "centipede", "grasshopper",
                       "beetle", "firefly", "moth", "larva"],
    "birds": ["sparrow", "pigeon", "eagle", "hawk", "owl", "swan", "parrot",
               "peacock", "penguin", "seagull", "crane (bird)", "woodpecker",
               "falcon", "stork", "nightingale"],
    "seafood": ["shrimp", "crab", "squid", "octopus", "clam", "oyster",
                "salmon", "seaweed", "lobster", "eel", "scallop", "sardine",
                "mackerel", "tuna"],
    "drinks": ["coffee", "beer", "sake", "soda", "beverage", "cocktail",
               "lemonade", "smoothie", "espresso"],
    "shapes": ["triangle", "rectangle", "sphere", "cube", "cylinder",
               "diamond (shape)", "oval", "hexagon", "pyramid (shape)"],
    "materials": ["plastic", "cotton", "wool", "silk", "leather", "rubber",
                  "bronze", "aluminum", "cement", "concrete", "marble",
                  "ceramic", "velvet", "linen"],
    "tools": ["hammer", "screwdriver", "wrench", "chisel", "drill", "pliers",
              "shovel", "crowbar", "sandpaper", "wheelbarrow"],
    "medical": ["injection", "surgery", "symptom", "clinic", "bandage",
                "prescription", "vaccine", "diagnosis", "stethoscope",
                "anesthesia", "stitches", "crutches", "wheelchair"],
    "plants_trees": ["blossom", "sapling", "bamboo", "moss", "fern", "vine",
                      "petal", "pollen", "stem", "sprout", "orchid",
                      "cherry blossom"],
    "household_items": ["toothbrush", "vacuum cleaner", "washing machine",
                          "clothespin", "detergent", "dustpan", "mop",
                          "flashlight", "candle", "thermos"],
    "holidays_events": ["festival", "ceremony", "anniversary", "parade",
                          "fireworks", "pilgrimage", "reunion", "banquet"],
}


def _pattern(keyword: str) -> re.Pattern:
    return re.compile(rf"\b{re.escape(keyword)}\b", re.IGNORECASE)


def _load_deck():
    with open(_DECK_JSON, encoding="utf-8") as f:
        deck = json.load(f)
    for level, words in deck.items():
        for w in words:
            yield w.get("kanji", ""), w.get("kana", ""), w.get("meaning", "")


def build():
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
    patterns = {theme: [_pattern(k) for k in kws] for theme, kws in THEMES.items()}
    exclude_patterns = {
        theme: [_pattern(x) if " " not in x and "." not in x else re.compile(re.escape(x), re.IGNORECASE) for x in kws]
        for theme, kws in EXCLUDES.items()
    }

    def _excluded(theme: str, meaning: str) -> bool:
        return any(p.search(meaning) for p in exclude_patterns.get(theme, []))

    stats = {}
    for theme, pats in patterns.items():
        rank = 0
        seen = set()

        # 1) curated deck first — always included, never capped.
        for kanji, kana, meaning in curated:
            key = (kanji, kana)
            if key in seen:
                continue
            if any(p.search(meaning) for p in pats) and not _excluded(theme, meaning):
                rank += 1
                seen.add(key)
                conn.execute(
                    "INSERT INTO theme_words VALUES (?,?,?,?,?,?)",
                    (theme, rank, "vocab", kanji, kana, meaning),
                )

        # 2) JMdict pool fills in the rest, ordered by freq_rank (most
        # common first), capped, and excluding proper nouns.
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
            if blob:
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
    stats = build()
    total = sum(stats.values())
    for theme, count in sorted(stats.items(), key=lambda kv: -kv[1]):
        print(f"{theme:20s} {count:5d}")
    print(f"\nTOTAL rows: {total}")
