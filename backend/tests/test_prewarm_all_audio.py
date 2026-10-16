"""
scripts/prewarm_all_audio.py (plan 235): every clip the app can say,
made ahead of the learner.

Held here: it walks every part at every level by default (N2 and N1
words and the conversation bank included), it writes nothing without
--yes, it makes each missing clip once and the names the routes look
for, a rerun calls the engine for nothing, and a dead engine stops it.
The engine is stubbed; the content is the real content.
"""
import math
import os
from array import array
from unittest import mock

import pytest

import scripts.prewarm_all_audio as prewarm
import study.exam_tts as tts
import study.voice_engine as engine
from study import grammar_audio, word_tts


@pytest.fixture
def store(tmp_path):
    directory = str(tmp_path / "audio")
    os.makedirs(directory)
    with mock.patch.object(tts, "_resolve_audio_dir", lambda: directory):
        yield directory


def _sound() -> engine.Pcm:
    rate = engine.DIALOGUE_RATE
    samples = array("h", (int(8000 * math.sin(2 * math.pi * 440 * i / rate)) for i in range(rate // 10)))
    return engine.Pcm(samples.tobytes(), rate)


@pytest.fixture
def stub_engine():
    with mock.patch.object(engine, "configured", lambda: True), \
            mock.patch.object(engine, "style_for_slot", lambda slot: 100 + slot), \
            mock.patch.object(engine, "say", mock.Mock(side_effect=lambda *a, **k: _sound())) as say:
        yield say


def test_the_default_plan_is_every_part_at_every_level():
    clips = prewarm.plan(prewarm.PARTS, prewarm.LEVELS)
    seen = {(c.part, c.level) for c in clips}
    for part in prewarm.PARTS:
        for level in ("N2", "N1"):
            assert (part, level) in seen, f"{part} {level} missing from the plan"


def test_every_conversation_line_is_planned_in_its_speakers_voice():
    clips = prewarm.plan(("conversation",), prewarm.LEVELS)
    planned = {c.key for c in clips}
    for them, me in grammar_audio.conversation_lines():
        for jp in them:
            assert ("grammar", "them", jp) in planned
        for jp in me:
            assert ("grammar", "me", jp) in planned


def test_every_word_reading_n5_to_n1_is_planned_once():
    clips = prewarm.plan(("words",), prewarm.LEVELS)
    forms = [c.text for c in clips]
    assert len(forms) == len(set(forms))
    assert set(forms) == set(word_tts.deck_readings(prewarm.LEVELS))


def test_a_planned_line_is_one_the_route_will_serve():
    for clip in prewarm.plan(("examples", "tours", "conversation"), prewarm.LEVELS):
        _, who, text = clip.key
        assert grammar_audio.speakable(text, who), clip


def test_without_yes_it_reports_and_makes_nothing(store, stub_engine, caplog):
    with caplog.at_level("INFO", logger="prewarm_all_audio"):
        assert prewarm.main(["--part", "conversation", "--level", "N1"]) == 0
    assert stub_engine.call_count == 0
    assert "Report only" in caplog.text


def test_with_yes_it_makes_what_is_missing_and_a_rerun_makes_nothing(store, stub_engine, caplog):
    scenario = grammar_audio.conversation_lines()  # warm the bank outside the count
    assert scenario
    clips = prewarm.plan(("conversation",), ("N1",))
    with mock.patch.object(prewarm, "plan", lambda parts, levels: clips[:4]):
        assert prewarm.main(["--yes"]) == 0
        assert stub_engine.call_count == 4
        assert all(c.made() for c in clips[:4])
        stub_engine.reset_mock()
        with caplog.at_level("INFO", logger="prewarm_all_audio"):
            assert prewarm.main(["--yes"]) == 0
    assert stub_engine.call_count == 0
    assert "Nothing to do" in caplog.text


def test_a_word_and_a_dictation_line_land_where_their_routes_look(store, stub_engine):
    word = prewarm.plan(("words",), ("N2",))[0]
    line = prewarm.plan(("dictation",), ("N2",))[0]
    with mock.patch.object(prewarm, "plan", lambda parts, levels: [word, line]):
        assert prewarm.main(["--yes"]) == 0
    assert word_tts.is_made(word.text)
    assert line.made()


def test_it_refuses_without_an_engine(store, stub_engine):
    with mock.patch.object(engine, "configured", lambda: False):
        assert prewarm.main(["--part", "conversation", "--level", "N1", "--yes"]) == 1
    assert stub_engine.call_count == 0


def test_a_dead_engine_stops_it_after_a_few_failures(store):
    make = mock.Mock(side_effect=tts.TTSFailed("down"))
    clips = [prewarm.Clip("words", "N1", str(i), ("word", str(i)), lambda: False, make)
             for i in range(prewarm.MAX_CONSECUTIVE_FAILURES * 4)]
    with mock.patch.object(prewarm, "plan", lambda parts, levels: clips), \
            mock.patch.object(engine, "configured", lambda: True):
        assert prewarm.main(["--yes"]) == 1
    assert make.call_count == prewarm.MAX_CONSECUTIVE_FAILURES
