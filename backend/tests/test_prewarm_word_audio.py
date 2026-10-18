"""
scripts/prewarm_word_audio.py (plan 209): the word clips made ahead of
the learner.

What is held is what makes it safe to run on a live service: with no
--yes it writes nothing at all, with it it makes only what is missing,
it can be stopped and run again, and a dead engine stops it after a few
failures rather than after three thousand. The words come from the
decks (word_tts.deck_readings, tested in test_word_tts.py); here they
are three real readings, so a run costs three stubbed syntheses and no
engine.
"""
import math
import os
from array import array
from unittest import mock

import pytest

import scripts.prewarm_word_audio as prewarm
import study.exam_tts as tts
import study.voice_engine as engine
import study.word_tts as word_tts

WORDS = ["まいげつ", "あさ", "ひる"]


@pytest.fixture
def store(tmp_path):
    directory = str(tmp_path / "audio")
    os.makedirs(directory)
    with mock.patch.object(tts, "_resolve_audio_dir", lambda: directory):
        yield os.path.join(directory, "words")


def _word() -> engine.Pcm:
    rate = engine.DIALOGUE_RATE
    samples = array("h", (int(8000 * math.sin(2 * math.pi * 440 * i / rate)) for i in range(rate // 2)))
    return engine.Pcm(samples.tobytes(), rate)


@pytest.fixture
def three_words():
    """Three real readings in place of the decks' three thousand, a
    configured engine, and a stubbed synthesis."""
    with mock.patch.object(word_tts, "deck_readings", lambda levels: list(WORDS)), \
            mock.patch.object(engine, "configured", lambda: True), \
            mock.patch.object(engine, "style_for_slot", lambda slot: 100 + slot), \
            mock.patch.object(engine, "say", mock.Mock(side_effect=lambda *a, **k: _word())) as say:
        yield say


def test_without_yes_it_reports_and_makes_nothing(store, three_words, caplog):
    with caplog.at_level("INFO", logger="prewarm_word_audio"):
        assert prewarm.main([]) == 0
    assert three_words.call_count == 0
    assert not os.path.isdir(store) or not os.listdir(store)
    assert "3 missing" in caplog.text
    assert "Report only" in caplog.text


def test_with_yes_it_makes_each_missing_clip_once(store, three_words):
    assert prewarm.main(["--yes"]) == 0
    assert three_words.call_count == 3
    assert all(word_tts.is_made(w) for w in WORDS)


def test_a_second_run_finds_nothing_to_do_and_does_not_call_the_engine(store, three_words, caplog):
    prewarm.main(["--yes"])
    three_words.reset_mock()
    with caplog.at_level("INFO", logger="prewarm_word_audio"):
        assert prewarm.main(["--yes"]) == 0
    assert three_words.call_count == 0
    assert "Nothing to do" in caplog.text


def test_a_stopped_run_resumes_where_it_left_off(store, three_words):
    word_tts.clip_for(WORDS[0])
    three_words.reset_mock()
    assert prewarm.main(["--yes"]) == 0
    assert three_words.call_count == 2


def test_a_clip_an_earlier_voice_made_is_made_again(store, three_words):
    path = word_tts.clip_for(WORDS[0])
    past = tts.voice_epoch() - 3600
    os.utime(path, (past, past))
    three_words.reset_mock()
    assert prewarm.main(["--yes"]) == 0
    assert three_words.call_count == 3
    assert tts.is_current(path)


def test_it_refuses_without_an_engine_and_writes_nothing(store, three_words):
    with mock.patch.object(engine, "configured", lambda: False):
        assert prewarm.main(["--yes"]) == 1
    assert three_words.call_count == 0


def test_a_dead_engine_stops_it_after_a_few_failures(store, caplog):
    many = [f"{i}" for i in range(prewarm.MAX_CONSECUTIVE_FAILURES * 4)]
    with mock.patch.object(word_tts, "deck_readings", lambda levels: many), \
            mock.patch.object(word_tts, "is_made", lambda form: False), \
            mock.patch.object(word_tts, "clip_for", mock.Mock(side_effect=tts.TTSFailed("down"))) as clip, \
            mock.patch.object(engine, "configured", lambda: True):
        assert prewarm.main(["--yes"]) == 1
    assert clip.call_count == prewarm.MAX_CONSECUTIVE_FAILURES


def test_one_failure_among_successes_is_reported_but_does_not_stop_the_rest(store, three_words):
    calls = {"n": 0}
    real = word_tts.clip_for

    def flaky(form):
        calls["n"] += 1
        if form == WORDS[1]:
            raise tts.TTSFailed("one bad word")
        return real(form)

    with mock.patch.object(word_tts, "clip_for", flaky):
        assert prewarm.main(["--yes"]) == 1, "a partial run exits non-zero"
    assert calls["n"] == 3
    assert word_tts.is_made(WORDS[0]) and word_tts.is_made(WORDS[2])
    assert not word_tts.is_made(WORDS[1])


def test_a_level_can_be_asked_for_by_name():
    seen = []
    with mock.patch.object(word_tts, "deck_readings", lambda levels: seen.append(tuple(levels)) or []):
        assert prewarm.main(["--level", "N5", "--level", "N4"]) == 0
    assert seen == [("N5",), ("N4",)]


def test_the_default_levels_are_n5_to_n3():
    seen = []
    with mock.patch.object(word_tts, "deck_readings", lambda levels: seen.append(tuple(levels)) or []):
        prewarm.main([])
    assert seen == [("N5",), ("N4",), ("N3",)]
