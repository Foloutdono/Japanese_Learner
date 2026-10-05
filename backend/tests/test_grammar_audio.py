"""
The tour's voices (plan 187d): a line is served only if the catalogue
says it, by that speaker; without a voice engine the answer is 503 and
nothing breaks; a clip the current voice made is served as it is, one an
earlier voice made is remade.
"""
import os

import pytest

from content.grammar_points_data import find
from study import grammar_audio
from study.exam_tts import TTSFailed


def _lines():
    level, entry = find("か")
    scene = entry["tour"]["scene"]
    them = next(l["jp"] for l in scene["lines"] if l["who"] == "them")
    me = next(l["jp"] for l in scene["lines"] if l["who"] == "me")
    return entry["examples"][0]["jp"], them, me, scene["ask"]["choices"]


def test_the_catalogue_says_each_line_by_its_speaker():
    example, them, me, replies = _lines()
    assert grammar_audio.speakable(example, "reader")
    assert grammar_audio.speakable(them, "them")
    assert grammar_audio.speakable(me, "me")
    # Every reply the learner can pick is heard in their own voice.
    assert all(grammar_audio.speakable(r, "me") for r in replies)
    # A line in the wrong mouth, or one nobody says, is no clip.
    assert not grammar_audio.speakable(them, "me")
    assert not grammar_audio.speakable("これは何でもない文です。", "reader")
    assert not grammar_audio.speakable(example, "narrator")


def test_two_speakers_never_share_a_clip():
    _example, them, _me, _r = _lines()
    assert grammar_audio.clip_name(them, "them") != grammar_audio.clip_name(them, "me")


def test_an_unknown_line_is_a_404_and_no_engine_a_503(client, monkeypatch):
    example, *_ = _lines()
    assert client.get("/api/grammar/audio", params={"text": "なにかほかのぶん。"}).status_code == 404
    assert client.get("/api/grammar/audio", params={"text": example, "who": "narrator"}).status_code == 422

    def refuse(*a, **k):
        raise TTSFailed("no engine")
    monkeypatch.setattr(grammar_audio.engine, "say", refuse)
    monkeypatch.setattr(grammar_audio, "is_current", lambda path: False)
    assert client.get("/api/grammar/audio", params={"text": example}).status_code == 503


def test_a_clip_is_made_once_and_served_after(client, monkeypatch, tmp_path):
    example, them, *_ = _lines()
    made = []
    monkeypatch.setattr(grammar_audio, "clip_dir", lambda: str(tmp_path))
    monkeypatch.setattr(grammar_audio.engine, "say", lambda text, style, speed=1.0: made.append(text) or b"pcm")
    monkeypatch.setattr(grammar_audio.engine, "encode_mp3", lambda pcm, kbps=48: b"ID3mp3")
    monkeypatch.setattr(grammar_audio.engine, "style_for_slot", lambda slot: slot)
    monkeypatch.setattr(grammar_audio.engine, "tempo_for_slot", lambda slot: 1.0)
    monkeypatch.setattr(grammar_audio, "is_current", lambda path: os.path.exists(path))
    first = client.get("/api/grammar/audio", params={"text": them, "who": "them"})
    assert first.status_code == 200 and first.content == b"ID3mp3"
    assert "immutable" in first.headers["cache-control"]
    again = client.get("/api/grammar/audio", params={"text": them, "who": "them"})
    assert again.status_code == 200
    assert made == [them]
