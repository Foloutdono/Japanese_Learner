# 入門, the introduction before the first card (plan 170).
#
# Six screens hang on one sentence, frontend/src/domain/nyumon.js's
# INTRO_SENTENCE. ADR 0017: a lesson is fed from the bank the real thing
# draws on, so the sentence must stand in the curated N5 reading bank --
# held there to every check the reading platform's sentences pass
# (tests/test_reading_sentences.py) -- and its words and kanji must be
# N5 cards, since the screens tell a learner who reads no kana yet that
# the flashcards will teach them. The frontend file is read as text, the
# way tests/test_events.py reads lib/track.js: one definition, no copy.
import re
from pathlib import Path

from content.kanji_data import KANJI_BY_LEVEL
from content.reading_sentences import N5
from content.vocab_data import VOCAB_BY_LEVEL

NYUMON = Path(__file__).resolve().parents[2] / "frontend" / "src" / "domain" / "nyumon.js"


def _intro_sentence() -> str:
    source = NYUMON.read_text(encoding="utf-8")
    found = re.search(r"^export const INTRO_SENTENCE = '([^']+)'", source, re.MULTILINE)
    assert found, f"no INTRO_SENTENCE in {NYUMON}"
    return found.group(1)


def test_the_sentence_is_read_from_the_frontend():
    assert _intro_sentence() == "駅でコーヒーを飲みます。"


def test_the_sentence_is_in_the_curated_n5_bank():
    sentence = _intro_sentence()
    assert any(row["jp"] == sentence for row in N5), (
        f"{sentence} is not in content/reading_sentences.py's N5 list")


def test_its_three_words_are_n5_cards():
    sentence = _intro_sentence()
    deck = {(e.get("kanji", ""), e.get("kana", "")) for e in VOCAB_BY_LEVEL["N5"]}
    # (the card's kanji, its kana, how the sentence writes it)
    for kanji, kana, written in (("駅", "えき", "駅"),
                                 ("", "コーヒー", "コーヒー"),
                                 ("飲む", "のむ", "飲み")):
        assert written in sentence
        assert (kanji, kana) in deck, f"{kanji or kana} ({kana}) is not an N5 vocab card"


def test_its_two_kanji_are_n5_kanji():
    sentence = _intro_sentence()
    n5 = {e["kanji"] for e in KANJI_BY_LEVEL["N5"]}
    written = [ch for ch in sentence if "一" <= ch <= "鿿"]
    assert written == ["駅", "飲"]
    for ch in written:
        assert ch in n5, f"{ch} is not an N5 kanji"
