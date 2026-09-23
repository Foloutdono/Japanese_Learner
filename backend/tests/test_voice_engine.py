"""
声 — the voice engine client (study/voice_engine.py, plan 113).

Against a fake engine on httpx.MockTransport: what matters here is what
the client ASKS the engine for -- which path a lone kana takes, which
voice a slot resolves to, what speed a stored rate becomes -- and that
every way the engine can fail arrives as TTSFailed. The MP3 encoder is
the real one.
"""
import io
import json
import math
import wave
from array import array
from urllib.parse import parse_qs

import httpx
import pytest

import study.voice_engine as engine

SPEAKERS = [
    {"name": "女声1", "styles": [{"name": "ノーマル", "id": 10005, "type": "talk"}]},
    {"name": "女声2", "styles": [{"name": "ノーマル", "id": 10007, "type": "talk"}]},
    {"name": "女声6", "styles": [{"name": "ノーマル", "id": 10006, "type": "talk"}]},
    {"name": "男声1", "styles": [{"name": "ノーマル", "id": 10001, "type": "talk"},
                                 {"name": "ささやき", "id": 10009, "type": "talk"}]},
]


def wav(seconds=0.3, rate=24000, channels=1, amplitude=8000) -> bytes:
    frames = array("h", (int(amplitude * math.sin(2 * math.pi * 440 * i / rate))
                         for i in range(round(seconds * rate)) for _c in range(channels)))
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(frames.tobytes())
    return out.getvalue()


class FakeEngine:
    """Answers the five endpoints the client uses, and remembers what it
    was asked."""

    def __init__(self):
        self.calls: list[tuple[str, dict, object]] = []
        self.refuse_notation = False
        self.synthesis = None           # override the WAV /synthesis answers with
        self.failures: list = []        # exceptions or status codes to answer with first

    def __call__(self, request: httpx.Request) -> httpx.Response:
        params = {k: v[0] for k, v in parse_qs(request.url.query.decode()).items()}
        body = json.loads(request.content) if request.content else None
        self.calls.append((request.url.path, params, body))
        if self.failures:
            failure = self.failures.pop(0)
            if isinstance(failure, Exception):
                raise failure
            return httpx.Response(failure, text="boom")
        path = request.url.path
        if path == "/version":
            return httpx.Response(200, json="0.23.0")
        if path == "/speakers":
            return httpx.Response(200, json=SPEAKERS)
        if path == "/audio_query":
            return httpx.Response(200, json={**engine._QUERY_DEFAULTS, "accent_phrases": [],
                                             "kana": params["text"]})
        if path == "/accent_phrases":
            if self.refuse_notation:
                return httpx.Response(400, json={"detail": "unknown text"})
            moras = [{"text": "ハ", "vowel": "a", "vowel_length": 0.1, "pitch": 5.4},
                     {"text": "ア", "vowel": "a", "vowel_length": 0.1, "pitch": 5.0}]
            return httpx.Response(200, json=[{"moras": moras, "accent": 1}])
        if path == "/synthesis":
            data = self.synthesis if self.synthesis is not None else wav(rate=body["outputSamplingRate"])
            return httpx.Response(200, content=data, headers={"content-type": "audio/wav"})
        return httpx.Response(404)

    def paths(self) -> list[str]:
        return [path for path, _params, _body in self.calls]


@pytest.fixture
def fake(monkeypatch):
    fake = FakeEngine()
    monkeypatch.setenv("VOICEVOX_URL", "voicevox-nemo:50121")
    monkeypatch.delenv("TTS_VOICES", raising=False)
    monkeypatch.setattr(engine, "_make_client",
                        lambda url: httpx.Client(base_url=url, transport=httpx.MockTransport(fake)))
    monkeypatch.setattr(engine, "_RETRY_BACKOFF_S", (0, 0))
    engine.reset()
    yield fake
    engine.reset()


# ── Configuration ────────────────────────────────────────────────

def test_a_bare_hostport_gets_a_scheme(monkeypatch):
    # render.yaml's fromService hostport is host:port, no scheme.
    monkeypatch.setenv("VOICEVOX_URL", "voicevox-nemo-ab1c:50121")
    assert engine.base_url() == "http://voicevox-nemo-ab1c:50121"
    monkeypatch.setenv("VOICEVOX_URL", "https://tts.example/")
    assert engine.base_url() == "https://tts.example"


def test_without_an_engine_nothing_is_attempted(monkeypatch):
    monkeypatch.delenv("VOICEVOX_URL", raising=False)
    called = []
    monkeypatch.setattr(engine, "_make_client", lambda url: called.append(url))
    engine.reset()
    assert engine.configured() is False
    assert engine.ready() is False
    with pytest.raises(engine.TTSFailed):
        engine.say("まいげつ", 10005)
    assert called == []


def test_voices_default_and_override(monkeypatch):
    monkeypatch.delenv("TTS_VOICES", raising=False)
    assert engine.voices() == engine.DEFAULT_VOICES
    monkeypatch.setenv("TTS_VOICES", "男声1, 女声2")
    assert engine.voices() == ("男声1", "女声2")


# ── Voices ───────────────────────────────────────────────────────

def test_voices_are_resolved_by_name_once(fake):
    assert engine.style_named("女声1") == 10005
    assert engine.style_named("男声1/ささやき") == 10009
    assert engine.style_for_slot(2) == 10001          # DEFAULT_VOICES[2] is 男声1
    assert fake.paths().count("/speakers") == 1


def test_the_default_slots_are_the_owners_choice(fake):
    # Plan 113b: 女声6 reads and is A, 男声1 is B, 女声1 narrates exams.
    assert [engine.style_for_slot(slot) for slot in range(4)] == [10006, 10006, 10001, 10005]


def test_a_voice_brings_its_tempo_to_whichever_slot_it_takes(monkeypatch):
    monkeypatch.delenv("TTS_VOICES", raising=False)
    assert [engine.tempo_for_slot(slot) for slot in range(4)] == [1.0, 1.0, 0.9, 1.0]
    monkeypatch.setenv("TTS_VOICES", "男声1/ノーマル,女声6")
    assert engine.tempo_for_slot(0) == 0.9
    assert engine.tempo_for_slot(1) == 1.0


def test_an_unknown_voice_names_the_ones_there_are(fake):
    # The website calls them 女性1-6; the engine says 女声. The error has
    # to make that mistake obvious.
    with pytest.raises(engine.TTSFailed, match="女声1, 女声2, 女声6, 男声1"):
        engine.style_named("女性1")


# ── Speed ────────────────────────────────────────────────────────

def test_a_stored_rate_becomes_a_speed_scale():
    assert engine.speed_scale("") == 1.0
    assert engine.speed_scale("-10%") == pytest.approx(0.9)
    assert engine.speed_scale("+20%") == pytest.approx(1.2)
    for bad in ("fast", "-10", "-60%", "+150%"):
        with pytest.raises(ValueError):
            engine.speed_scale(bad)


# ── Kana ─────────────────────────────────────────────────────────

@pytest.mark.parametrize("text, notation", [
    ("は", "ハ'"), ("へ", "ヘ'"), ("を", "ヲ'"), ("ん", "ン'"), ("きゃ", "キャ'"),
    ("ウォ", "ウォ'"), ("ゔ", "ヴ'"), ("ド", "ド'"), ("ぢ", "ヂ'"), (" あ ", "ア'"),
])
def test_one_kana_is_spoken_by_its_notation(text, notation):
    assert engine.lone_kana_notation(text) == notation


@pytest.mark.parametrize("text", [
    "まいげつ", "こんにちは", "っ", "ゃ", "ー", "ああ", "アー", "ゐ", "a", "", "は。", None,
])
def test_anything_else_is_read_as_text(text):
    assert engine.lone_kana_notation(text) is None


def test_a_lone_kana_never_goes_through_text_analysis(fake):
    # Read as text, は is the topic particle: "wa".
    pcm = engine.say("は", 10005)
    assert "/audio_query" not in fake.paths()
    path, params, _body = next(c for c in fake.calls if c[0] == "/accent_phrases")
    assert params == {"text": "ハ'", "speaker": "10005", "is_kana": "true"}
    synthesis = next(c for c in fake.calls if c[0] == "/synthesis")
    assert synthesis[2]["kana"] == "ハ'"
    # Held, so a syllable on its own is not clipped.
    assert synthesis[2]["accent_phrases"][-1]["moras"][-1]["vowel_length"] >= engine.LONE_KANA_HOLD_S
    assert pcm.rate == engine.DIALOGUE_RATE and pcm.frames


def test_a_notation_the_engine_refuses_is_read_as_text_instead(fake):
    fake.refuse_notation = True
    engine.say("は", 10005)
    assert fake.paths()[-2:] == ["/audio_query", "/synthesis"]


def test_a_word_is_read_as_text_at_the_asked_speed(fake):
    engine.say("まいげつ", 10005, speed=engine.speed_scale("-10%"))
    assert "/accent_phrases" not in fake.paths()
    _path, _params, query = fake.calls[-1]
    assert query["speedScale"] == pytest.approx(0.9)
    assert query["outputSamplingRate"] == engine.DIALOGUE_RATE
    assert query["outputStereo"] is False


def test_level_pitch_holds_a_long_vowel_on_one_note(fake):
    engine.say_kana("ア'ア", 10005, level_pitch=True)
    moras = fake.calls[-1][2]["accent_phrases"][0]["moras"]
    assert {m["pitch"] for m in moras} == {5.4}


def test_the_kana_query_carries_every_field_the_engine_requires(fake):
    engine.say_kana("ハ'", 10005, sample_rate=48000, pad=0.08)
    query = fake.calls[-1][2]
    for field in ("accent_phrases", "speedScale", "pitchScale", "intonationScale", "volumeScale",
                  "prePhonemeLength", "postPhonemeLength", "outputSamplingRate", "outputStereo"):
        assert field in query
    assert query["outputSamplingRate"] == 48000
    assert query["prePhonemeLength"] == query["postPhonemeLength"] == 0.08


# ── Failure ──────────────────────────────────────────────────────

def test_a_dropped_connection_is_retried(fake):
    fake.failures = [httpx.ConnectError("refused"), 503]
    assert engine.say("まいげつ", 10005).frames


def test_an_engine_error_is_not_retried(fake):
    fake.failures = [500]
    with pytest.raises(engine.TTSFailed, match="500"):
        engine.say("まいげつ", 10005)
    assert fake.paths() == ["/audio_query"]


def test_an_engine_that_stays_down_fails_as_TTSFailed(fake):
    fake.failures = [httpx.ConnectError("refused")] * 3
    with pytest.raises(engine.TTSFailed, match="unreachable"):
        engine.say("まいげつ", 10005)


@pytest.mark.parametrize("answer", [
    wav(amplitude=0),                   # silence, cached for a year by /api/tts otherwise
    wav(channels=2),                    # not the shape asked for
    wav(rate=22050),
    b"not a wav at all",
])
def test_audio_that_is_not_a_clip_is_refused(fake, answer):
    fake.synthesis = answer
    with pytest.raises(engine.TTSFailed):
        engine.say("まいげつ", 10005)


def test_ready_asks_the_engine(fake):
    assert engine.ready() is True
    fake.failures = [httpx.ConnectError("refused")]
    assert engine.ready() is False


# ── Encoding ─────────────────────────────────────────────────────

def _pcm(seconds, rate):
    return engine.Pcm(array("h", (int(8000 * math.sin(i / 7)) for i in range(round(seconds * rate)))).tobytes(),
                      rate)


def test_a_dialogue_clip_is_a_constant_bitrate_mp3():
    info = engine.mp3_summary(engine.encode_mp3(_pcm(2.0, 24000)))
    assert (info["sample_rate"], info["channels"], info["kbps"]) == (24000, 1, [48])
    assert info["seconds"] == pytest.approx(2.0, abs=0.1)


def test_a_kana_clip_is_48k_at_96kbps():
    info = engine.mp3_summary(engine.encode_mp3(_pcm(0.4, 48000), kbps=96))
    assert (info["sample_rate"], info["channels"], info["kbps"]) == (48000, 1, [96])


def test_parts_are_joined_in_order_at_one_rate():
    joined = engine.join([_pcm(0.2, 24000), engine.silence(0.5, 24000), _pcm(0.3, 24000)])
    assert joined.seconds == pytest.approx(1.0)
    with pytest.raises(engine.TTSFailed):
        engine.join([_pcm(0.2, 24000), _pcm(0.2, 48000)])
