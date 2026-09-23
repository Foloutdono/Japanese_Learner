"""
聴解 — what the listening generator spends before it knows it can speak.

A listening item is worthless without its audio, and the dialogue is
bought from a model before the audio is made. So the voice engine is
asked first (study/voice_engine.ready): with it down or unconfigured,
not one model call is paid for. Plan 113.
"""
from unittest import mock

import pytest

import study.exam_listening_gen as gen
from study.exam_gen_utils import GenerationFailed


@pytest.fixture
def model():
    with mock.patch.object(gen, "llm_configured", return_value=True), \
            mock.patch.object(gen, "call_llm_json_batch",
                              side_effect=GenerationFailed("no items")) as call:
        yield call


def test_no_engine_means_no_model_call(model):
    with mock.patch.object(gen.voice_engine, "ready", return_value=False) as ready:
        with pytest.raises(GenerationFailed):
            gen._generate_listening_paper_once("N5", seed=1)
    model.assert_not_called()
    # Asked once for the paper, not once per mondai.
    assert ready.call_count == 1


def test_with_an_engine_the_dialogue_is_asked_for(model):
    with mock.patch.object(gen.voice_engine, "ready", return_value=True):
        with pytest.raises(GenerationFailed):
            gen._generate_listening_paper_once("N5", seed=1)
    assert model.called


def test_the_prompt_says_who_is_the_woman_and_who_the_man():
    # The voices do (study/exam_tts.voice_slots: A a woman, B a man); the
    # script has to agree, or 「女の人は何をしますか」 asks about the man.
    prompt = gen._LISTENING_MCQ_PROMPT_BATCH
    assert "A is a woman (女の人)" in prompt
    assert "B is a man (男の人)" in prompt
