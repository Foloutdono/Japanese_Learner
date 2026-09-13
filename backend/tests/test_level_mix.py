# 読解 -- the level-mix gate (study/level_mix.py).
#
# A generated text is graded on the SHARE of its vocabulary and kanji
# that sit above the level, not on the first offender. These pin the
# counting rule, the tolerance, what is named and what is never counted.
# No database and no model; the tokenizer is required, as it is for
# test_analysis.py.
import math

from study import level_mix, morphology

# All-N5 on every gate (kanji, vocabulary, grammar) -- the sentence the
# comprehension fixture reads too.
N5 = "駅で友だちに会いました。"
# 人生 is filed at N3 (and written in N5 kanji, so only the vocabulary
# gate sees it).
N3_WORD = "人生は長いです。"


def test_an_n5_sentence_passes():
    mix = level_mix.level_mix(N5, "N5")
    assert mix["available"] is True
    assert mix["vocab_over"] == []
    assert mix["kanji_over"] == []
    assert level_mix.validate_level_mix(N5, "N5") == []


def test_one_hard_word_in_twenty_odd_passes():
    text = N5 * 7 + N3_WORD
    mix = level_mix.level_mix(text, "N5")
    assert [(e["word"], e["level"]) for e in mix["vocab_over"]] == [("人生", "N3")]
    assert mix["vocab_ratio"] <= level_mix.MAX_RATIO, mix
    assert level_mix.validate_vocab_mix(text, "N5") == []


def test_three_hard_words_in_thirty_fail_and_are_named():
    text = N5 * 7 + N3_WORD * 3
    errors = level_mix.validate_vocab_mix(text, "N5")
    assert len(errors) == 1
    assert "vocabulary above N5" in errors[0]
    assert "人生" in errors[0] and "N3" in errors[0]
    # And the count is by occurrence: three sentences, three hits.
    assert "3 of" in errors[0]


def test_kanji_are_counted_by_occurrence():
    text = "遅い電車。遅い駅。"
    mix = level_mix.level_mix(text, "N5")
    assert mix["kanji_total"] == 5
    assert mix["kanji_over"] == [{"kanji": "遅", "count": 2}]
    errors = level_mix.validate_kanji_mix(text, "N5")
    assert len(errors) == 1
    assert "2 of 5" in errors[0]
    assert errors[0].count("遅") == 1


def test_seed_kanji_are_exempt():
    text = "違います。"
    assert level_mix.level_mix(text, "N5")["kanji_over"], \
        "違 should be above N5 for this test to mean anything"
    assert level_mix.level_mix(text, "N5", allow_kanji="違")["kanji_over"] == []
    assert level_mix.validate_kanji_mix(text, "N5", allow_kanji="違") == []


def test_off_deck_words_are_named_but_never_counted():
    text = "ピカチュウと駅で会いました。"
    mix = level_mix.level_mix(text, "N5")
    assert mix["vocab_over_count"] == 0
    assert "ピカチュウ" in mix["off_deck"]
    assert level_mix.validate_vocab_mix(text, "N5") == []
    # The name reaches the model only when there is a message to carry it.
    errors = level_mix.validate_vocab_mix(text + N3_WORD * 3, "N5")
    assert errors and "ピカチュウ" in errors[0]


def test_tokenizer_unavailable_gives_no_verdict(monkeypatch):
    monkeypatch.setattr(morphology, "tokenize", lambda text: None)
    text = N5 * 3 + N3_WORD * 5
    mix = level_mix.level_mix(text, "N5")
    assert mix["available"] is False
    assert level_mix.validate_level_mix(text, "N5") == []


def test_ratio_is_the_same_rule_as_the_floor_count():
    for n in range(10, 61):
        for count in range(0, n + 1):
            by_ratio = count / n > level_mix.MAX_RATIO
            by_floor = count > math.floor(level_mix.MAX_RATIO * n)
            assert by_ratio == by_floor, (n, count)


def test_messages_never_route_into_the_kanji_feedback_branch():
    """exam_reading_gen._as_feedback sends any message containing
    'outside' and 'allowed set' down its kanji path; these must pass
    through as the instructions they already are."""
    text = "遅い電車。" + N3_WORD * 3
    errors = level_mix.validate_level_mix(text, "N5")
    assert len(errors) == 2
    for message in errors:
        assert not ("outside" in message and "allowed set" in message)
