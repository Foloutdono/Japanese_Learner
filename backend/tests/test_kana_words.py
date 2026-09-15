"""
study/kana_words.py -- the words a kana is read in (plan 088).

A kana's entry used to stop at the character, its romaji and its stroke
sheet, which is everything about あ except what it is for. These are the
promises the ledger under it makes: the reader can read every row of it,
the rows are words they will actually meet, and the block is empty
rather than padded where the language has nothing to offer.

Pure: the deck and the pool's own data, no database and no client, the
way test_kanji_words.py is.
"""
import re

import pytest

from content.kana_data import get_syllabary
from study.kana_words import (
    MAX_WORDS, POOL_RANK_HORIZON, _spelled_with, kana_words, reading_of,
)

HIRAGANA = re.compile(r"[ぁ-ゖー]+")
KATAKANA = re.compile(r"[ァ-ヴー]+")


def readings(kana, lang="en"):
    return [w["kana"] for w in kana_words(kana, lang)]


class TestReadingOf:
    def test_a_reading_is_taken_from_the_kana_field(self):
        assert reading_of({"kanji": "朝", "kana": "あさ"}, HIRAGANA) == "あさ"

    def test_only_the_first_of_a_packed_pair(self):
        # vocab_data.py packs a word's second reading behind a "/".
        assert reading_of({"kanji": "毎月", "kana": "まいげつ/まいつき"}, HIRAGANA) == "まいげつ"

    def test_a_kana_headword_stands_in_for_a_note(self):
        # Sixty deck entries file a part-of-speech note where the
        # reading goes; the headword is itself kana in seventeen of them.
        assert reading_of({"kanji": "すみません", "kana": "（感）"}, HIRAGANA) == "すみません"

    def test_a_field_that_is_not_a_reading_yields_nothing(self):
        assert reading_of({"kanji": "経験", "kana": "けいけん・する"}, HIRAGANA) is None
        assert reading_of({"kanji": "十", "kana": "じゅう とお"}, HIRAGANA) is None

    def test_the_script_asked_for_is_the_script_returned(self):
        terebi = {"kanji": "", "kana": "テレビ"}
        assert reading_of(terebi, KATAKANA) == "テレビ"
        assert reading_of(terebi, HIRAGANA) is None


class TestSpelledWith:
    def test_a_reading_names_its_own_kana_once_each(self):
        assert _spelled_with("ねこ") == {"ね", "こ"}
        # Twice over is still one key: the row is shown once.
        assert _spelled_with("ここ") == {"こ"}

    def test_a_digraph_is_a_key_beside_its_halves(self):
        # きゃく is an example of き and of きゃ both, and the small ゃ is
        # not a syllabary entry of its own.
        assert _spelled_with("きゃく") == {"き", "きゃ", "く"}

    def test_a_long_vowel_is_a_key_and_the_bar_alone_is_not(self):
        assert _spelled_with("アート") == {"ア", "アー", "ト"}
        assert _spelled_with("えいが") == {"え", "えい", "い", "が"}


class TestKanaWords:
    def test_the_words_are_read_with_the_kana(self):
        for kana in ("あ", "ん", "きゃ", "ア", "ティ"):
            for reading in readings(kana):
                assert kana in reading

    def test_a_word_begins_with_the_kana_before_one_merely_containing_it(self):
        # A syllabary is taught as "あ as in あさ", so the ledger leads
        # with the words that start there. め is read in めがね and in
        # あめ; めがね comes first.
        first = readings("め")[0]
        assert first.startswith("め")

    def test_the_commonest_level_leads(self):
        # りょ has N5 words (りょうり, りょこう) and N1 ones; the N5 pair
        # is what a reader meets first.
        assert readings("りょ")[:2] == ["りょうり", "りょこう"]

    def test_a_kana_that_only_ever_ends_a_word_still_has_its_words(self):
        # ん is never initial, and the rest of the rule holds unchanged.
        rows = readings("ん")
        assert len(rows) == MAX_WORDS
        assert not any(r.startswith("ん") for r in rows)

    def test_no_row_repeats_a_reading(self):
        for kana in ("あ", "い", "う", "ア", "ン", "しょ"):
            rows = readings(kana)
            assert len(rows) == len(set(rows))

    def test_at_most_four_rows(self):
        for script in ("hiragana", "katakana"):
            for entry in get_syllabary(script):
                assert len(kana_words(entry["kana"], "en")) <= MAX_WORDS


class TestTheReaderCanReadEveryRow:
    """The one promise that matters: a kana card's examples are in the
    script the card teaches, whole. A katakana card showing こうちゃ or
    a hiragana card showing コーヒー is an example of nothing."""

    @pytest.mark.parametrize("script, pattern", [
        ("hiragana", HIRAGANA),
        ("katakana", KATAKANA),
    ])
    def test_every_row_of_every_card_is_in_one_script(self, script, pattern):
        for entry in get_syllabary(script):
            for reading in readings(entry["kana"]):
                assert pattern.fullmatch(reading), f"{entry['kana']}: {reading}"

    def test_the_katakana_half_is_not_left_to_the_pool_alone(self):
        # The deck files ドア and テレビ with an empty `kanji` and the
        # katakana in `kana`; without that reading they would be invisible
        # here and the chart would fall back to loanword-dictionary
        # curiosities.
        assert "アパート" in readings("ア")
        assert "テレビ" in readings("テ")


class TestTheGaps:
    def test_a_kana_ordinary_writing_has_no_word_for_prints_nothing(self):
        # ヲ is not read outside of その手のもの-style stylisation, and the
        # pool's ranked head has nothing for it either. An empty list is
        # the honest answer; the panel then draws no block at all.
        assert kana_words("ヲ", "en") == []

    def test_a_thin_kana_is_short_rather_than_padded(self):
        # ひゃ is read in ひゃく and almost nowhere else the deck goes.
        rows = readings("ひゃ")
        assert rows[0] == "ひゃく"
        assert len(rows) < MAX_WORDS

    def test_nothing_is_asked_of_an_empty_kana(self):
        assert kana_words("", "en") == []


class TestThePoolFillsInBehindTheDeck:
    def test_the_deck_leads_where_it_has_words(self):
        # ティ: the deck's パーティー before the pool's ティー, even though
        # the pool's is shorter and begins with the kana.
        rows = kana_words("ティ", "en")
        assert rows[0]["kana"] == "パーティー"
        assert rows[0]["level"] == "N5"
        # …and the pool's rows carry no level, because they have none.
        assert [r["level"] for r in rows[2:]] == [None] * len(rows[2:])

    def test_the_pool_answers_for_the_sounds_the_jlpt_lists_do_not(self):
        # ヴ, ウォ and the rest of the 外来音: the deck has nothing at all.
        assert readings("ヴ")[0] == "ヴァイオリン"
        assert "ウォッカ" in readings("ウォ")

    def test_nothing_is_drawn_from_past_the_horizon(self):
        # freq_rank is the dump's own sequence past POOL_RANK_HORIZON
        # (content/theme_data.py says so of the same column), so there is
        # no commonest word to pick there and the block stays empty
        # rather than printing whatever the tail happens to begin with.
        # ニョッキ is rank 103,823; ニョ has nothing else and prints
        # nothing.
        assert POOL_RANK_HORIZON == 23_000
        assert kana_words("ニョ", "en") == []
        for kana in ("ヲ", "ヂ", "ヅ"):
            assert kana_words(kana, "en") == []


class TestARowIsALedgerRow:
    def test_it_is_the_shape_the_kanji_ledger_already_has(self):
        for row in kana_words("あ", "en"):
            assert set(row) == {"kanji", "kana", "meaning", "level"}
            assert row["meaning"]

    def test_the_written_form_rides_along_for_the_row_to_open(self):
        # あめ prints as あめ and opens 飴; テレビ has no written form of
        # its own and opens itself.
        by_reading = {r["kana"]: r for r in kana_words("あ", "en")}
        assert by_reading["あめ"]["kanji"] == "飴"
        assert next(r for r in kana_words("テ", "en") if r["kana"] == "テレビ")["kanji"] == ""

    def test_the_gloss_arrives_in_the_session_language(self):
        english = {r["kana"]: r["meaning"] for r in kana_words("あ", "en")}
        french = {r["kana"]: r["meaning"] for r in kana_words("あ", "fr")}
        assert english["あお"] == "blue"
        assert french["あお"] == "bleu"

    def test_a_pool_word_falls_back_to_english_where_there_is_no_french(self):
        # The same fallback the deck's own French gaps take
        # (routes/dictionary.py). Nothing is left blank.
        for row in kana_words("ヴ", "fr"):
            assert row["meaning"]
