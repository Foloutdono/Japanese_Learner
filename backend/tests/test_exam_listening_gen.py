"""
聴解 — what the listening generator spends before it knows it can speak.

A listening item is worthless without its audio, and the dialogue is
bought from a model before the audio is made. So the voice engine is
asked first (study/voice_engine.ready): with it down or unconfigured,
not one model call is paid for. Plan 121.
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


# ── The key is read back by someone who has not seen it (plan 258) ──
# A paper shipped asking who may sit in "this chair", which the dialogue
# calls Takeshi's, keyed to the speaker who asked.

CHAIR = {
    "contextJp": "女の人と男の人が話しています。",
    "turns": [
        {"speaker": "A", "textJp": "このいすにすわってもいいですか。"},
        {"speaker": "B", "textJp": "すみません、このいすはたけしさんのです。ここはあいています。"},
    ],
    "questionJp": "だれがこのいすにすわれますか。",
    "choices": ["A", "B", "たけし", "先生"],
    "correctIndex": 0,
}


def _prepared(item=CHAIR):
    return gen._prepare_listening_mcq_item(item, "N5", "q")


def test_a_key_the_reader_does_not_pick_is_not_kept():
    with mock.patch.object(gen, "chat", return_value="[3]"):
        assert gen._keys_agree([_prepared()]) == [False]


def test_a_key_the_reader_picks_is_kept():
    with mock.patch.object(gen, "chat", return_value="[1]"):
        assert gen._keys_agree([_prepared()]) == [True]


@pytest.mark.parametrize("reply", ["[0]", "[true]", "[1, 2]", "not json", '{"a": 1}'])
def test_an_ambiguous_or_unreadable_reply_keeps_nothing(reply):
    with mock.patch.object(gen, "chat", return_value=reply):
        assert gen._keys_agree([_prepared()]) == [False]


def test_the_reader_is_shown_the_script_and_never_the_key():
    with mock.patch.object(gen, "chat", return_value="[1]") as chat:
        gen._keys_agree([_prepared()])
    sent = chat.call_args.args[0][0]["content"]
    assert "このいすはたけしさんの" in sent and "correctIndex" not in sent


def test_a_dropped_item_is_never_voiced():
    spec = {"id": "m1", "count": 1, "name_jp": "課題理解", "official_number": 1}
    with mock.patch.object(gen, "call_llm_json_batch", return_value=[CHAIR]), \
            mock.patch.object(gen, "chat", return_value="[3]"), \
            mock.patch.object(gen, "synthesize_dialogue") as speak:
        with pytest.raises(GenerationFailed):
            gen._build_listening_mcq_mondai(spec, "N5", __import__("random").Random(1))
    speak.assert_not_called()
