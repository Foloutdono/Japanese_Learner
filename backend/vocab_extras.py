"""
Loads the JMdict-derived "extras" for the app's vocab deck: grammatical
tags and example sentences, layered on top of vocab_data.py's own
JLPT-leveled deck rather than folded into it (vocab_deck.json only ever
carries {kanji, kana, meaning} — see vocab_data.py's docstring — and
dictionary.py's public contract for a vocab result shouldn't have to
change shape just because this data happens to exist for some words).

Source files sit next to vocab_deck.json under datas/vocab/:

    vocab_meanings.json — "<kanji>::<kana>" -> [sense, sense, ...]
        Keyed exactly like a vocab_deck.json entry's own kanji/kana
        pair (kana can be several readings packed with "/", e.g.
        "毎月::まいげつ/まいつき") so the common case is a direct dict
        lookup with no parsing. Each sense:
        {match_type, term, reading, tags, term_tags, glossary,
         examples: [{jp, en}, ...]}
        tags are JMdict part-of-speech/field/misc codes ("n", "v1",
        "adj-i", ...); term_tags are priority/frequency/name markers
        ("⭐", "ichi", "news3k", "place", ...).

    vocab_tags.json — tag code -> {category, sorting_order, notes, score}
        Human-readable "notes" for every code used above.

Public API: get_vocab_extras(kanji, kana) -> {"tags": [...], "examples": [...]}
Both lists are already deduplicated, translated to their "notes" label,
and capped to a sane display size — callers can render them as-is.
"""
import json
import os

_BASE_DIR = os.path.dirname(__file__)
_DATA_DIR = os.path.join(_BASE_DIR, "datas", "vocab")

with open(os.path.join(_DATA_DIR, "vocab_meanings.json"), encoding="utf-8") as f:
    _VOCAB_MEANINGS: dict[str, list[dict]] = json.load(f)

with open(os.path.join(_DATA_DIR, "vocab_tags.json"), encoding="utf-8") as f:
    _VOCAB_TAGS: dict[str, dict] = json.load(f)

# term_tags mix real study-relevant signal (priority/frequency markers,
# category "popular"/"frequent") with name/place/person/etc. markers
# (category "name") that don't help a JLPT learner's card — only the
# former are surfaced as tags.
_TERM_TAG_CATEGORIES_SHOWN = {"popular", "frequent"}

# A card's tag row is a quick glance, not a JMdict dump — cap it so one
# heavily-sensed verb (e.g. 出る's dozen senses) doesn't spill a wall
# of part-of-speech codes across the detail panel.
_MAX_TAGS = 6
_MAX_EXAMPLES = 3


def _tag_label(code: str) -> str:
    info = _VOCAB_TAGS.get(code)
    return info["notes"] if info and info.get("notes") else code


def _readings(kana: str) -> list[str]:
    return [r.strip() for r in (kana or "").split("/") if r.strip()]


def _find_senses(kanji: str, kana: str) -> list[dict] | None:
    # Fast path: vocab_meanings.json keys its entries with the exact
    # same packed kana string vocab_deck.json uses (see module
    # docstring), so most words resolve with a single dict lookup.
    senses = _VOCAB_MEANINGS.get(f"{kanji}::{kana}")
    if senses:
        return senses
    # Fallback for any mismatch in reading order/subset between the two
    # decks — try each individual reading on its own.
    for reading in _readings(kana):
        senses = _VOCAB_MEANINGS.get(f"{kanji}::{reading}")
        if senses:
            return senses
    return None


def get_vocab_extras(kanji: str, kana: str) -> dict:
    """
    Pools tags and example sentences across every JMdict sense matching
    (kanji, one of its readings). A word can carry many senses but only
    some of them have their own example — pooling means a card still
    shows examples even when the sense that matched the app's own
    glossary entry happens to lack one.
    """
    senses = _find_senses(kanji, kana)
    if not senses:
        return {"tags": [], "examples": []}

    tags = []
    seen_tags = set()
    for sense in senses:
        for code in sense.get("tags", []):
            label = _tag_label(code)
            if label not in seen_tags:
                seen_tags.add(label)
                tags.append(label)
        for code in sense.get("term_tags", []):
            info = _VOCAB_TAGS.get(code)
            if not info or info.get("category") not in _TERM_TAG_CATEGORIES_SHOWN:
                continue
            label = _tag_label(code)
            if label not in seen_tags:
                seen_tags.add(label)
                tags.append(label)
        if len(tags) >= _MAX_TAGS:
            break

    examples = []
    seen_jp = set()
    for sense in senses:
        for ex in sense.get("examples", []):
            jp = ex.get("jp")
            if not jp or jp in seen_jp:
                continue
            seen_jp.add(jp)
            examples.append({"jp": jp, "en": ex.get("en", "")})
            if len(examples) >= _MAX_EXAMPLES:
                break
        if len(examples) >= _MAX_EXAMPLES:
            break

    return {"tags": tags[:_MAX_TAGS], "examples": examples[:_MAX_EXAMPLES]}
