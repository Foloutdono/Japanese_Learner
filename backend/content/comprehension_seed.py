"""
The seed pool: hand-written reading-comprehension exercises, one file
per JLPT level, in both of the app's languages (plan 111; six per level
since plan 230, ten since plan 258, thirty since plan 259, drafted and
reviewed with scripts/comprehension_seed_report).

── Why this exists ───────────────────────────────────────────
理解 (reading comprehension, routes/reading.py) is the most expensive
model call this app makes, and since plan 092 its answer is POOLED:
an exercise is generated once per (level, lang) bucket and served to
every learner who has not read it. The pool starts empty, though, so
the first learner at each bucket -- ten buckets, and the first reader
of each -- still waits under a spinner for a two-minute generation and
pays for it. scripts/prewarm_comprehension_pool.py fills the pool
ahead of demand, but only when an operator runs it with a key.

These exercises are the floor under that. They are checked in, loaded
into comprehension_pool by routes/reading.py at import (an idempotent
upsert keyed on `seed_key`), and so exist on every deploy, in every
bucket, before any learner or any script has done anything. A new
learner's first exercise at every level is served from here; the model
is asked only once the seeds -- and whatever the pool has since
accumulated -- are read.

── Shape ─────────────────────────────────────────────────────
One JSON list per level, one object per exercise, the Japanese written
ONCE and every learner-facing string carried as an {en, fr} pair:

    {"id": "n5-01", "level": "N5", "title": "...",
     "grammar": ["<pattern>", ...],           the catalogue points it uses
     "text": "...",                           220-280 characters
     "questions": [{"type", "question": {en, fr}, "options": {en, fr}, "correct"}],
     "breakdown": [{"jp", "translation": {en, fr}, "note": {en, fr},
                    "words": [{"surface", "meaning": {en, fr}}]}]}

render() flattens one language out of that into exactly the dict
routes/reading._call_llm_comprehension returns for a model answer --
text, questions, breakdown WITH its word lists, translation, and the
grammar_points objects -- so a seeded row and a generated row are the
same thing to everything downstream (the decoration, the screen, the
log).

── The rules each exercise follows ───────────────────────────
Enforced by tests/test_comprehension_seed.py, through the same checks
a model answer must pass (routes/reading._check_comprehension):

  * the text is 220-280 characters (COMPREHENSION_CHARS)
  * every kanji is in the level's set, seed patterns' own kanji excepted
  * no more than one content word in twenty is filed above the level
  * every pattern in `grammar` is a checkable point AT that level, and
    the text verifiably contains it
  * the breakdown reproduces the text sentence for sentence, and each
    sentence's word list reproduces the sentence
  * the paper has exactly COMPREHENSION_SPECS[level] questions, four
    options each, with every question type represented
  * both languages are present on every string

NOT one of the rules: which slot the right answer is written in. Every
exercise's options are re-ordered per serving, seeds and model answers
alike (study/answer_balance, called from
routes/reading.get_comprehension_text), because a model asked to write
four options and pick one picks the first far too often and an author
writing the true sentence before the three false ones does the same.
So `correct` here is WHICH option is right, never the position a
learner meets it in -- write the true one wherever it reads best.
"""
import json
import os
from functools import lru_cache

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, gloss, grammar_to_id

_BASE_DIR = os.path.join(os.path.dirname(__file__), "comprehension")

LEVELS: tuple[str, ...] = ("N5", "N4", "N3", "N2", "N1")

# The languages the app's UI ships (frontend/src/locales), and so the
# ones every seed carries. routes/reading.LANG_NAMES accepts more; a
# learner on another language is generated for, as before.
LANGS: tuple[str, ...] = ("en", "fr")

# The smallest number of exercises each level's file may carry. A first
# request at a level needs one; thirty (plan 259, from ten in plan 258,
# six in plan 230, three before) is a new learner's first thirty sittings
# before the model is ever asked for them, and _pool_take serves them
# before anything generated. Raise it with the content that meets it,
# never ahead of it.
MIN_PER_LEVEL = 30


def _load(level: str, object_hook=None) -> list[dict]:
    path = os.path.join(_BASE_DIR, f"{level}.json")
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f, object_hook=object_hook)


def entries() -> tuple[dict, ...]:
    """Every seed exercise, every level, in file order, read from the
    files at each call. Never cache it: parsed, the seeds weigh some
    86 KB each in dicts and strings (13 MB at 150 seeds), which a
    process that kept them would carry for its whole life inside the
    backend's 512 MB. Only the pool's upsert at import (rows) needs
    them whole; what a request reads of them is index()."""
    return tuple(e for level in LEVELS for e in _load(level))


def by_level() -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {level: [] for level in LEVELS}
    for e in entries():
        out.setdefault(e["level"], []).append(e)
    return out


# What a request reads of every seed: routes/practice names a text the
# learner read by its seed's title and grammar, and routes/station lists
# each level's titles and points and opens its card on the first text.
_INDEXED = ("title", "text", "grammar")


@lru_cache(maxsize=1)
def index() -> dict[str, tuple[dict, ...]]:
    """by_level(), cut to what a request reads: each seed's title, text
    and grammar, and the questions of each level's first seed besides,
    which the station's card asks the first of. The breakdowns and the
    other questions, most of a seed's weight, stay in the files: at
    150 seeds this keeps 257 KB of the 13 MB entries() reads.

    Cut as the files are parsed, never out of by_level(): read whole,
    the seeds grow the process by their 13 MB, and the strings kept,
    spread through all of it, hold that memory from going back, so the
    process stays as large as if it had kept everything."""
    out: dict[str, list[dict]] = {level: [] for level in LEVELS}

    def cut(obj: dict) -> dict:
        # json calls this on every object it builds, innermost first: a
        # seed is the one with a breakdown, and it is cut before the next
        # one is read. A question, a sentence, a word or an {en, fr}
        # pair passes through as it was.
        if "breakdown" not in obj:
            return obj
        seeds = out.setdefault(obj["level"], [])
        kept = {key: obj[key] for key in _INDEXED if key in obj}
        if not seeds:
            kept["questions"] = obj["questions"]
        seeds.append(kept)
        return kept

    for level in LEVELS:
        _load(level, object_hook=cut)
    return {level: tuple(seeds) for level, seeds in out.items()}


def seed_key(entry: dict, lang: str) -> str:
    """The stable identity of one (exercise, language) row in the pool.
    Content-independent on purpose: a corrected seed UPDATES its row
    rather than adding a second copy beside the old one."""
    return f"seed:{entry['id']}:{lang}"


def _pick(pair, lang: str) -> str:
    if isinstance(pair, str):
        return pair
    if not pair:
        return ""
    return pair.get(lang) or pair.get("en") or ""


def render(entry: dict, lang: str) -> dict:
    """One language of a seed, in the pool's stored shape -- what
    routes/reading._call_llm_comprehension returns for a model answer,
    word lists included (the decoration consumes those per request)."""
    level = entry["level"]
    points = {p["pattern"]: p for p in GRAMMAR_POINTS_BY_LEVEL.get(level, [])}
    breakdown = [
        {
            "jp": part["jp"],
            "translation": _pick(part.get("translation"), lang),
            "note": _pick(part.get("note"), lang),
            "words": [
                {"surface": w["surface"], "meaning": _pick(w.get("meaning"), lang)}
                for w in part.get("words", [])
            ],
        }
        for part in entry["breakdown"]
    ]
    return {
        "text": entry["text"],
        "questions": [render_question(q, lang) for q in entry["questions"]],
        "breakdown": breakdown,
        # Derived from the breakdown, exactly as _parse_comprehension
        # derives it for a model answer: the two can never disagree.
        "translation": " ".join(p["translation"] for p in breakdown if p["translation"]),
        "grammar_points": [
            {
                "pattern": pattern,
                "structure": points[pattern].get("structure", ""),
                "meaning": gloss(points[pattern], lang),
                "level": level,
                "raw_id": grammar_to_id(points[pattern], level),
            }
            for pattern in entry.get("grammar", [])
            if pattern in points
        ],
    }


def render_question(question: dict, lang: str) -> dict:
    """One of a seed's questions in one language, as render() puts it."""
    return {
        "type": question["type"],
        "question": _pick(question["question"], lang),
        "options": [_pick(o, lang) for o in _pick_list(question["options"], lang)],
        "correct": question["correct"],
    }


def _pick_list(options, lang: str) -> list:
    """`options` is {en: [...], fr: [...]} in the files; a bare list is
    accepted too, so a monolingual draft still renders."""
    if isinstance(options, dict):
        return options.get(lang) or options.get("en") or []
    return list(options)


def rows() -> list[tuple[str, str, str, list[str], dict]]:
    """Everything the pool should hold, as (seed_key, level, lang,
    grammar patterns, exercise) -- one row per seed per language."""
    out = []
    for entry in entries():
        for lang in LANGS:
            data = render(entry, lang)
            grammar = [p["pattern"] for p in data["grammar_points"]]
            out.append((seed_key(entry, lang), entry["level"], lang, grammar, data))
    return out
