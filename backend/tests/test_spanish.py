"""Spanish is the app's third language (plan 291): the decks and the
grammar points' glosses and lessons read it whole, and their tours and
Choisir questions level by level (DRILL_LEVELS); every other text reads
English until its Spanish is written (scripts/spanish_coverage.py counts
what is left).

What is whole is held here, as tests/test_kanji_french.py holds the
French: a card the deck gains, a kanji, a grammar point, is written in
Spanish in the same change, and a line for a card the deck no longer has
is moved with it (content/vocab_renames.py) or dropped."""
import json
import os
import sqlite3

import pytest

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
from content.kanji_data import KANJI_BY_LEVEL
from content.kanji_meanings import KANJI_ES
from content.vocab_data import VOCAB_BY_LEVEL
from routes.translations import _load_translation_map
from translations import get_meaning
from translations.course import KANJI_GLOSSES, VOCAB_GLOSSES
from translations.es.vocab_es import VOCAB_ES

_BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_KANJI_FILE = os.path.join(_BASE, "datas", "kanji", "kanji_meanings_es.json")
_DB = os.path.join(_BASE, "datas", "kanji", "kanji.sqlite3")


def _card_key(entry: dict) -> str:
    return f"{entry['kanji']}::{entry['kana']}" if entry["kanji"] else entry["kana"]


def test_every_deck_card_has_its_own_spanish_line_and_no_other():
    keys = {_card_key(e) for level in VOCAB_BY_LEVEL.values() for e in level}
    missing = sorted(keys - set(VOCAB_ES))
    stray = sorted(set(VOCAB_ES) - keys)
    assert missing == [], f"deck cards with no Spanish in vocab_es.json: {missing[:20]}"
    assert stray == [], f"vocab_es.json lines for no card of the deck (moved or retired?): {stray[:20]}"


def test_a_spanish_gloss_is_one_clean_line():
    bad = [k for k, v in VOCAB_ES.items()
           if not isinstance(v, str) or not v.strip() or v != v.strip() or "\t" in v or "\n" in v]
    assert bad == []


def test_a_card_reads_its_own_spanish_not_a_homographs():
    # 後 is four cards (あと, うしろ, ご, のち); each reads its own line.
    entries = [e for level in VOCAB_BY_LEVEL.values() for e in level if e["kanji"] == "後"]
    glosses = {get_meaning(e, "es", VOCAB_GLOSSES) for e in entries}
    assert len(entries) > 1 and len(glosses) == len(entries)


def test_every_deck_kanji_has_a_spanish_meaning():
    missing = [e["kanji"] for level in KANJI_BY_LEVEL.values() for e in level if not KANJI_ES.get(e["kanji"])]
    assert missing == [], f"deck kanji with no Spanish: {''.join(missing)}"


def test_the_database_carries_the_spanish_supplement():
    """The file is applied: a supplement edited without re-running
    `python -m scripts.build_kanji_db --spanish-only` would ship nothing."""
    with open(_KANJI_FILE, encoding="utf-8") as f:
        supplement = json.load(f)
    conn = sqlite3.connect(f"file:{_DB}?mode=ro", uri=True)
    try:
        stale = [c for c, es in supplement.items()
                 if conn.execute("SELECT meaning_es FROM kanji WHERE char = ?", (c,)).fetchone()[0] != es]
    finally:
        conn.close()
    assert stale == [], "re-run python -m scripts.build_kanji_db --spanish-only"


@pytest.mark.parametrize("level", list(GRAMMAR_POINTS_BY_LEVEL))
def test_every_grammar_point_has_its_spanish_gloss_and_formation(level):
    """Their form is grammar_check's (the English line's Japanese, in
    order, no English left); that they are there is held here."""
    missing = [p["pattern"] for p in GRAMMAR_POINTS_BY_LEVEL[level]
               if not (p.get("meaning") or {}).get("es") or not p.get("structure_es")]
    assert missing == []


@pytest.mark.parametrize("level", list(GRAMMAR_POINTS_BY_LEVEL))
def test_every_grammar_lesson_is_written_in_spanish(level):
    """The lesson, whole (plan 291's second wave): every step, every
    neighbour's line and every example's translation. Their form is
    grammar_check's; a point the catalogue gains is written in Spanish in
    the same change, as it is in French."""
    missing = [
        f"{p['pattern']} {part} {i}"
        for p in GRAMMAR_POINTS_BY_LEVEL[level]
        for part in ("steps", "compare", "examples")
        for i, text in enumerate(p.get(part) or [])
        if not (text.get("es") or "").strip()
    ]
    assert missing == [], f"{len(missing)} lesson texts with no Spanish: {missing[:10]}"


def test_a_lesson_is_served_in_spanish():
    from study.grammar_lesson import lesson_payload
    level, entry = "N5", GRAMMAR_POINTS_BY_LEVEL["N5"][0]
    spanish, english = lesson_payload(level, entry, "es"), lesson_payload(level, entry, "en")
    assert spanish["steps"][0]["text"] == entry["steps"][0]["es"] != english["steps"][0]["text"]


# The levels whose tours and Choisir questions are written in Spanish
# (plan 291's third wave, a batch of levels at a time): held whole, as the
# lessons are. A level joins in the commit that writes it.
DRILL_LEVELS = ("N5", "N4", "N3")


def _drill_texts(point: dict):
    """(path, text) for every text of a point's tour and its own Choisir
    questions: each dict carrying an `en` and a `fr`."""
    def walk(node, path):
        if isinstance(node, dict):
            if isinstance(node.get("en"), str) and isinstance(node.get("fr"), str):
                yield "/".join(path), node
            for k, v in node.items():
                yield from walk(v, path + [k])
        elif isinstance(node, list):
            for i, v in enumerate(node):
                yield from walk(v, path + [str(i)])
    for key in ("tour", "choose"):
        yield from walk(point.get(key), [key])


@pytest.mark.parametrize("level", DRILL_LEVELS)
def test_every_tour_and_choisir_question_is_written_in_spanish(level):
    missing = [f"{p['pattern']} {path}" for p in GRAMMAR_POINTS_BY_LEVEL[level]
               for path, text in _drill_texts(p) if not (text.get("es") or "").strip()]
    assert missing == [], f"{len(missing)} tour/choose texts with no Spanish: {missing[:10]}"


def test_a_tour_is_served_in_spanish():
    from study.grammar_tour import tour_payload
    level, entry = "N5", next(p for p in GRAMMAR_POINTS_BY_LEVEL["N5"] if p.get("tour"))
    tour = tour_payload(level, entry, "es")
    twist = entry["tour"]["twists"][0]
    assert tour["twists"][0]["notion"] == twist["notion"]["es"] != twist["notion"]["en"]
    assert tour["scene"]["them"] == entry["tour"]["scene"]["them"]["es"]


def test_the_spanish_maps_the_client_preloads_are_whole_and_spanish():
    vocab, kanji = _load_translation_map("es", "vocab"), _load_translation_map("es", "kanji")
    assert set(vocab) == set(_load_translation_map("en", "vocab"))
    assert set(kanji) == set(_load_translation_map("en", "kanji"))
    assert kanji["山"] == get_meaning({"kanji": "山"}, "es", KANJI_GLOSSES) != "mountain"


def test_an_unspoken_language_is_still_refused_by_the_maps():
    from fastapi import HTTPException
    with pytest.raises(HTTPException):
        _load_translation_map("de", "vocab")
