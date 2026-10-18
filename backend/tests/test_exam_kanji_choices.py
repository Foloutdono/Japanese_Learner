# The choices of a 漢字読み / 表記 item (plan 254): readings a Japanese word
# could have, a set with no centre, and only the kanji the paper's level has
# been taught. The counter-cases are what the old builder (exam_kanji_gen)
# made: ぱじめ, まぢ, a star around the answer, 燵 in an N5 paper.
import random

import pytest

from content.vocab_data import VOCAB_BY_LEVEL
from study import exam_kanji_choices as K
from study import exam_tells
from study.exam_gen_utils import GenerationFailed
from study.llm_shared import kanji_set_for_level


def test_what_no_word_is_spelled_like_is_no_reading():
    assert K.kana_problems("ぱじめ", "はじめ")        # ぱ opens no word
    assert K.kana_problems("まぢ", "まち")            # ぢ where the word has none
    assert K.kana_problems("まっど", "まど")          # っ before a voiced consonant
    assert K.kana_problems("かえっ", "かえす")        # ends in っ
    assert K.kana_problems("あゃ", "あや")            # a small ゃ after あ
    assert K.kana_problems("ハジメ", "はじめ")        # not hiragana


def test_real_readings_pass():
    for reading in ("はじめ", "がっこう", "せんしゅう", "しゅっぱつ", "じゅうにがつ", "いっぽん", "ひとり", "づくり"):
        assert not K.kana_problems(reading, reading), reading


def test_the_grid_of_a_week():
    wrong = [w for _, w in K.reading_sets("先週", "せんしゅう", "N5")]
    assert sorted(["せんしゅ", "ぜんしゅう", "ぜんしゅ"]) in [sorted(w) for w in wrong]


def test_a_wrong_reading_is_never_another_reading_of_the_word():
    rng = random.Random(3)
    words = [w for w in VOCAB_BY_LEVEL["N3"] if K.askable(w, "N3")]
    for w in rng.sample(words, 40):
        valid = K.readings_of_spelling(w["kanji"])
        for _, wrong in K.reading_sets(w["kanji"], K._first_reading(w), "N3")[:6]:
            assert not set(wrong) & valid, (w["kanji"], wrong)


def test_every_set_is_symmetric_and_never_centred_on_the_answer():
    rng = random.Random(4)
    for level in ("N5", "N4", "N3"):
        words = [w for w in VOCAB_BY_LEVEL[level] if K.askable(w, level)]
        for w in rng.sample(words, 25):
            reading = K._first_reading(w)
            for _, wrong in K.reading_sets(w["kanji"], reading, level)[:6]:
                choices = [reading] + wrong
                assert exam_tells.tell(choices) is None, choices
                assert exam_tells.centre(choices) != 0 and exam_tells.outlier(choices) != 0, choices
                assert not any(K.kana_problems(x, reading) for x in wrong), choices


def test_a_paper_asks_only_the_words_its_level_has_taught():
    assert K.askable({"kanji": "学校", "kana": "がっこう"}, "N5")
    assert not K.askable({"kanji": "町", "kana": "まち"}, "N5")      # 町 is taught at N4
    assert not K.askable({"kanji": "写真", "kana": "しゃしん"}, "N5")
    assert K.askable({"kanji": "町", "kana": "まち"}, "N4")


def test_a_spelling_the_course_reads_two_ways_is_not_asked_alone():
    # 一月 is ひとつき and, as January, いちがつ
    assert not K.askable({"kanji": "一月", "kana": "ひとつき"}, "N5")


def test_the_old_builders_choices_are_refused():
    why = K.reading_item_problems("初め", ["ぱじめ", "はじめ", "はしめ", "ばじめ"], 1)
    assert any("ぱじめ" in p for p in why)
    assert K.reading_item_problems("明日", ["あした", "あす", "あじた", "あしだ"], 0) == [
        "'あす' is also a reading of 明日"]


def test_a_wrong_spelling_may_not_be_another_spelling_of_the_word():
    # かう is 買う and 飼う
    assert K.orthography_item_problems("かう", ["買う", "飼う", "貫う", "貴う"], 0) == ["'飼う' is also a spelling read かう"]


def test_wrong_spellings_are_made_of_the_levels_kanji():
    allowed = kanji_set_for_level("N5")
    asked = 0
    for w in VOCAB_BY_LEVEL["N5"]:
        if not K.askable(w, "N5"):
            continue
        kanji, reading = w["kanji"], K._first_reading(w)
        sets = K.orthography_sets(kanji, reading, "N5")
        for _, wrong in sets[:6]:
            assert all(c in allowed for x in wrong for c in x if "一" <= c <= "龯"), wrong
            assert exam_tells.tell([kanji] + wrong) is None, wrong
        asked += bool(sets)
    assert asked >= 10        # an N5 paper can find its five 表記 items


def test_a_wrong_spelling_is_a_kanji_that_looks_like_the_right_one():
    # 大学 has no kanji at N5 that looks like 学 or 大 (天 is the one): it is not asked there
    # rather than offered 花 for 先 or 午 for 気, which scored 2.0 to 2.7 and fooled no one
    assert K.orthography_sets("大学", "だいがく", "N5") == []
    assert K.orthography_sets("先月", "せんげつ", "N5") == [] or all(
        "花" not in x for _, wrong in K.orthography_sets("先月", "せんげつ", "N5") for x in wrong)


def test_a_word_of_several_kanji_is_asked_as_a_grid_of_lookalikes():
    wrong = K.orthography_sets("日本語", "にほんご", "N5")[0][1]
    assert exam_tells.structure(["日本語"] + wrong) == "ring"
    assert len(set(wrong)) == 3


def test_the_builder_builds_a_mondai_of_the_levels_words():
    rng = random.Random(1)
    pool = [w for w in VOCAB_BY_LEVEL["N5"] if w.get("kanji")]
    rng.shuffle(pool)
    spec = {"id": "moji_1", "official_number": 1, "count": 7}
    mondai = K.build_reading_mondai(spec, pool, set(), set(), rng, "N5")
    allowed = kanji_set_for_level("N5")
    assert [q["id"] for q in mondai["questions"]] == [f"moji_1_q{i}" for i in range(1, 8)]
    for q in mondai["questions"]:
        assert all(c in allowed for c in q["promptJp"] if "一" <= c <= "龯"), q["promptJp"]
        texts = [c["textJp"] for c in q["choices"]]
        assert len(set(texts)) == 4 and exam_tells.tell(texts) is None
        assert q["answer"] in {c["id"] for c in q["choices"]}


def test_a_wrong_reading_fits_the_kana_the_prompt_prints():
    # 閉じる prints じる: しめる / しまる / とける end otherwise, so the one
    # reading that fits (とじる) was the answer without a word being read
    assert K.fits_prompt("閉じる", "とじる") and not K.fits_prompt("閉じる", "しめる")
    assert K.fits_prompt("引き出し", "ひきだし") and not K.fits_prompt("引き出し", "ひいだし")
    assert K.fits_prompt("ガス代", "がすだい") and K.fits_prompt("お茶", "おちゃ") and K.fits_prompt("人々", "ひとびと")
    assert K.reading_item_problems("閉じる", ["とじる", "しめる", "しまる", "とける"], 0) == [
        "'しめる' does not fit the kana 閉じる prints",
        "'しまる' does not fit the kana 閉じる prints",
        "'とける' does not fit the kana 閉じる prints"]
    assert K.reading_item_problems("閉じる", ["とじる", "へいじる", "ひじる", "しじる"], 0) == []


def test_every_set_the_builder_offers_fits_the_prompt():
    rng = random.Random(7)
    for level in ("N4", "N3", "N2"):
        words = [w for w in VOCAB_BY_LEVEL[level] if K.askable(w, level) and not all(
            "\u4e00" <= c <= "\u9fff" for c in w["kanji"])]          # the words that print okurigana
        for w in rng.sample(words, 30):
            for _, wrong in K.reading_sets(w["kanji"], K._first_reading(w), level)[:6]:
                assert all(K.fits_prompt(w["kanji"], t) for t in wrong), (w["kanji"], wrong)


def test_a_wrong_spelling_does_not_write_a_kanji_twice():
    assert K.orthography_item_problems("ことし", ["今年", "今今", "去年", "今午"], 0) == ["'今今' writes a kanji twice"]
    for _, wrong in K.orthography_sets("今年", "ことし", "N4")[:6]:
        assert not any(a == b for text in wrong for a, b in zip(text, text[1:])), wrong


def test_a_kanji_is_asked_once_in_a_paper():
    pool = [w for w in VOCAB_BY_LEVEL["N5"] if w.get("kanji") in ("学校", "大学")]
    assert len(pool) == 2 and all(K.askable(w, "N5") for w in pool)
    used_words, used_prompts = set(), set()
    spec = {"id": "moji_1", "official_number": 1, "count": 1}
    K.build_reading_mondai(spec, pool, used_words, used_prompts, random.Random(1), "N5")
    # 学校 and 大学 share 学: the second would be a second question on one character
    with pytest.raises(GenerationFailed):
        K.build_orthography_mondai({"id": "moji_2", "official_number": 2, "count": 1}, pool, used_words, used_prompts,
                                   random.Random(1), "N5")


def test_a_word_an_exam_leaves_out_is_not_asked():
    assert not K.askable({"kanji": "自殺", "kana": "じさつ"}, "N1")


def test_a_key_alone_in_its_length_is_not_a_symmetric_set():
    # き against きい / きの / きく: the one mora is the answer
    assert not K._symmetric(["き", "きい", "きの", "きく"])
    assert K._symmetric(["きく", "きい", "きの", "きし"])
