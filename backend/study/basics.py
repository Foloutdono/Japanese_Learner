"""
基礎 — the basics course (plan 186).

A short, ordered course an N5 learner rides before the rest of N5:
fourteen units, each a handful of grammar points with the words and kanji
needed to use them and a few sentences built only from what came before
(content/basics.json; tests/test_basics.py holds every sentence to its
unit and the units before it).

Every card here is a reference to an N5 card the decks already serve,
never a card of its own, the way a theme is a reference to vocab ids: a
learner's progress on the course is their progress on N5, and a learner
who boards above N5 has met every unit already, since the level rule
seeds N5 known. That is also why a course card must be an N5 card: a due
review's lane is its card's level (study/daily_queue.lanes), and the
level rule holds back every lane above the learner's.

Nothing is stored: a unit is met when each of its cards has been
reviewed once, which card_modes already says.
"""
import json
import os
from functools import lru_cache

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, grammar_to_id
from content.kanji_data import KANJI_BY_LEVEL, kanji_to_id
from content.vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from study.modes import GRAMMAR, KANJI, VOCAB

LEVEL = "N5"
COURSE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "content", "basics.json")

# The order a unit is dealt in: its rules first, each opening on its
# lesson, then the words that use them, then the kanji of words met.
SOURCES = (GRAMMAR, VOCAB, KANJI)


def _vocab_ids() -> dict[str, str]:
    """"{kanji}::{kana}" -> the N5 card id."""
    return {f"{e.get('kanji', '')}::{e.get('kana', '')}": vocab_to_id(e, LEVEL) for e in VOCAB_BY_LEVEL[LEVEL]}


def _kanji_ids() -> dict[str, str]:
    return {e["kanji"]: kanji_to_id(e, LEVEL) for e in KANJI_BY_LEVEL[LEVEL]}


def _grammar_ids() -> dict[str, str]:
    return {e["pattern"]: grammar_to_id(e, LEVEL) for e in GRAMMAR_POINTS_BY_LEVEL[LEVEL]}


def _resolve(names: list[str], ids: dict[str, str], what: str, unit: str) -> list[str]:
    missing = [n for n in names if n not in ids]
    if missing:
        raise ValueError(f"basics unit {unit!r}: no N5 {what} card for {missing}")
    return [ids[n] for n in names]


@lru_cache(maxsize=1)
def units() -> tuple[dict, ...]:
    """The course's units in order, each with its cards resolved to ids:
    {"id", "jp", "title": {"en", "fr"}, "sentences", "grammar", "vocab",
    "kanji", "cards": {source: [raw_id, ...]}}. Raises on a name that is
    no N5 card, so a deck change cannot leave the course pointing at
    nothing (content/vocab_renames.py moves the id, not this file)."""
    with open(COURSE_PATH, encoding="utf-8") as f:
        doc = json.load(f)
    vocab, kanji, grammar = _vocab_ids(), _kanji_ids(), _grammar_ids()
    out = []
    for unit in doc["units"]:
        uid = unit["id"]
        out.append({
            **unit,
            "cards": {
                GRAMMAR: _resolve(unit["grammar"], grammar, "grammar", uid),
                VOCAB: _resolve(unit["vocab"], vocab, "vocab", uid),
                KANJI: _resolve(unit["kanji"], kanji, "kanji", uid),
            },
        })
    return tuple(out)


@lru_cache(maxsize=1)
def sequence() -> tuple[tuple[str, str, int], ...]:
    """Every course card as (source, raw_id, unit index), in the order the
    course deals them: unit by unit, and in a unit its rules, its words,
    then its kanji."""
    return tuple(
        (source, raw_id, n)
        for n, unit in enumerate(units())
        for source in SOURCES
        for raw_id in unit["cards"][source]
    )


@lru_cache(maxsize=1)
def _unit_by_id() -> dict[str, int]:
    return {raw_id: n for _, raw_id, n in sequence()}


def unit_of(raw_id: str) -> int | None:
    """The index of the unit that teaches `raw_id`, or None."""
    return _unit_by_id().get(raw_id)


def course_ids(source: str) -> list[str]:
    """One line's course cards, in the order the course deals them."""
    return [raw_id for src, raw_id, _ in sequence() if src == source]


# ── Closure: what a sentence asks of a learner ───────────────────
# A word a learner must have met is what the breakdown gives a card, or
# ought to; a particle, an ending or a mark is a point's, never a word's.
CONTENT_POS = frozenset({
    "noun", "pronoun", "verb", "adjective", "adverb", "interjection",
    "adnominal", "conjunction", "other",
})
_NUMERALS = frozenset("一二三四五六七八九十百千万")


def taught_through(n: int) -> tuple[set[str], set[str]]:
    """(vocab ids, grammar patterns) a learner has met by the end of unit
    `n` (0-based)."""
    words: set[str] = set()
    points: set[str] = set()
    for unit in units()[:n + 1]:
        words |= set(unit["cards"][VOCAB])
        points |= set(unit["grammar"])
    return words, points


def strays(sentence: str, words: set[str], points: set[str]) -> list[str]:
    """What `sentence` asks of a learner who has met only `words` and
    `points`, read the way the breakdown reads it: each point it lights
    that is not met, each word whose card is not, and each word the
    breakdown finds no card for. A point's own letters (the ください of
    〜をください) are the point's, and a number is its digits'."""
    from study import analysis          # the tokenizer; not on the import path of the ration

    result = analysis.analyze_local(sentence)
    out = [f"point {g['pattern']}" for g in result["grammar"] if g["pattern"] not in points]
    for token in result["tokens"]:
        hits = token.get("grammar") or []
        if hits and all(g["pattern"] in points for g in hits):
            continue
        surface = token["surface"]
        if surface and set(surface) <= _NUMERALS and all(
                any(w.startswith(f"vocab_{LEVEL}_{c}_") for w in words) for c in surface):
            continue
        match = token.get("vocab_match")
        if match:
            if match["raw_id"] not in words:
                out.append(f"word {surface} ({match['raw_id']})")
        elif token.get("pos") in CONTENT_POS:
            out.append(f"no card for {surface}")
    return out
