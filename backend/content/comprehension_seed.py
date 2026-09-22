"""
The seed pool: hand-written reading-comprehension exercises, one file
per JLPT level, in both of the app's languages (plan 111).

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
# request at a level needs one; three is a new learner's first three
# sittings before the model is ever asked for them. Raise it with the
# content that meets it, never ahead of it.
MIN_PER_LEVEL = 3


def _load(level: str) -> list[dict]:
    path = os.path.join(_BASE_DIR, f"{level}.json")
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def entries() -> tuple[dict, ...]:
    """Every seed exercise, every level, in file order."""
    return tuple(e for level in LEVELS for e in _load(level))


def by_level() -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {level: [] for level in LEVELS}
    for e in entries():
        out.setdefault(e["level"], []).append(e)
    return out


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
        "questions": [
            {
                "type": q["type"],
                "question": _pick(q["question"], lang),
                "options": [_pick(o, lang) for o in _pick_list(q["options"], lang)],
                "correct": q["correct"],
            }
            for q in entry["questions"]
        ],
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
