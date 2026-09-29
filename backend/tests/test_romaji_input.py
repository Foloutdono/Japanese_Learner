# A sentence typed in romaji, read back as kana (study/romaji.kana_of):
# what 作文's check reads, and what the breakdown reads when there is no
# tutor to write the sentence out in kanji.
import pytest

from study.romaji import is_romaji, kana_of


@pytest.mark.parametrize("typed, kana", [
    ("mizu to gohan wo tabemashita", "みずとごはんをたべました"),
    # The particles as they are said: wa, o, e.
    ("watashi wa gakusei desu.", "わたしはがくせいです。"),
    ("ringo o tabemasu", "りんごをたべます"),
    ("gakkou e ikimasu ka?", "がっこうへいきますか？"),
    # Kunrei's spellings too, and the capitals of a sentence's start.
    ("Watasi wa tya o nomimasu", "わたしはちゃをのみます"),
    # The apostrophe closes the ん; a hyphen is the long vowel, or joins a title.
    ("kan'i desu", "かんいです"),
    ("ra-men ga suki", "らーめんがすき"),
    ("Tanaka-san wa kimashita", "たなかさんはきました"),
    ("kitte, soshite hon", "きって、そしてほん"),
])
def test_a_romaji_sentence_reads_as_kana(typed, kana):
    assert kana_of(typed) == kana


def test_a_word_that_is_no_romaji_is_kept_as_typed():
    assert kana_of("Paris ni ikimasu") == "Parisにいきます"


@pytest.mark.parametrize("text", ["水とご飯を食べました", "mizu と gohan", "", "   ", "hello", "123"])
def test_japanese_or_nothing_readable_is_none(text):
    assert kana_of(text) is None


def test_is_romaji():
    assert is_romaji("mizu to gohan")
    assert not is_romaji("みず to gohan")
    assert not is_romaji("123 !")
