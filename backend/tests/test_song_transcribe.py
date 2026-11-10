# ── 歌 — a song from its audio (plan 315) ─────────────────────────
# study/song_transcribe.py hears a song as a Track, and routes/video.py's
# /api/video/song turns it into an ordinary session. The model is never
# called here: `chat` is replaced, and what it is handed is asserted.
import base64
import json
import struct
import threading
import time

import pytest

import routes.video as video_module
from study import llm_shared, song_transcribe
from study.llm_shared import LLMUnavailable, Provider
from study.song_transcribe import SongError, cues_from, lyric_lines, seconds_of, wav_seconds


def wav(seconds: float, rate: int = 16_000) -> bytes:
    """A silent mono 16-bit PCM WAV `seconds` long, as lib/songAudio.js
    writes one."""
    data = b"\x00\x00" * int(rate * seconds)
    return (
        b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVE"
        + b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16)
        + b"data" + struct.pack("<I", len(data)) + data
    )


# ── The audio ─────────────────────────────────────────────────────
def test_a_wav_is_read_for_its_length():
    assert wav_seconds(wav(2.5)) == pytest.approx(2.5)


@pytest.mark.parametrize("body", [b"", b"ID3\x04" + b"\x00" * 60, b"RIFF\x00\x00\x00\x00WAVE" + b"\x00" * 40])
def test_anything_but_a_pcm_wav_is_refused(body):
    with pytest.raises(ValueError):
        wav_seconds(body)


def test_pasted_lyrics_are_their_lines():
    assert lyric_lines("  朝の駅で\n\n   君を  待っていた  \n") == ["朝の駅で", "君を 待っていた"]
    assert lyric_lines(None) == []
    many = "\n".join(f"{i}行目" for i in range(500))
    assert len(lyric_lines(many)) == song_transcribe.MAX_LYRIC_LINES


@pytest.mark.parametrize("raw, expected", [
    (72.5, 72.5), ("72.5", 72.5), ("1:12.5", 72.5), ("0:01:12.5", 72.5), (3, 3.0),
    ("soon", None), (None, None), (True, None), (float("nan"), None),
])
def test_a_time_is_read_as_a_model_writes_one(raw, expected):
    assert seconds_of(raw) == expected


# ── The answer ────────────────────────────────────────────────────
def test_the_lines_heard_are_put_in_order_and_kept_apart():
    items = [
        {"start": 9.0, "end": 12.0, "text": "君を呼ぶ"},
        {"start": 1.0, "end": 9.5, "text": "夜が  来る"},
        {"start": 14.0, "text": "星が光る"},          # no end: four seconds
        {"start": 15.0, "end": 14.0, "text": "まだ"},   # end before start: the song's end
        {"start": 400.0, "end": 401.0, "text": "後"},  # past the song
        {"start": 2.0, "end": 3.0, "text": "   "},      # nothing said
        "not a line",
    ]
    assert cues_from(items, 20.0) == [
        {"start": 1.0, "end": 9.0, "text": "夜が 来る"},
        {"start": 9.0, "end": 12.0, "text": "君を呼ぶ"},
        {"start": 14.0, "end": 15.0, "text": "星が光る"},
        {"start": 15.0, "end": 19.0, "text": "まだ"},
    ]


def test_pasted_lyrics_are_timed_by_their_number_and_kept_as_written():
    lyrics = ["夜が来る", "君を呼ぶ"]
    items = [
        {"n": 1, "start": 1.0, "end": 3.0},
        {"n": "2", "start": 3.0, "end": 5.0},
        {"n": 1, "start": 6.0, "end": 8.0},   # the chorus again
        {"n": 7, "start": 9.0, "end": 10.0},  # no such line
        {"start": 11.0, "end": 12.0, "text": "勝手な行"},  # the model's own words are never taken
    ]
    assert [c["text"] for c in cues_from(items, 20.0, lyrics)] == ["夜が来る", "君を呼ぶ", "夜が来る"]


# ── The asks ──────────────────────────────────────────────────────
def _answer(monkeypatch, reply):
    """`chat` replaced: every call recorded, `reply` answered."""
    calls = []

    def fake_chat(messages, **kwargs):
        calls.append({"messages": messages, **kwargs})
        assert kwargs["accept"](reply) in (True, False)
        return reply

    monkeypatch.setattr(song_transcribe, "chat", fake_chat)
    return calls


def test_a_song_is_heard_by_a_model_that_takes_audio(monkeypatch):
    audio = wav(3)
    calls = _answer(monkeypatch, '```json\n{"lines": [{"start": "0:00.5", "end": 2.0, "text": "夜が来る"}]}\n```')
    assert song_transcribe.transcribe(audio) == [{"start": 0.5, "end": 2.0, "text": "夜が来る"}]
    (call,) = calls
    assert call["audio"] is True and call["task"] == "song"
    text, sound = call["messages"][0]["content"]
    assert "never romaji" in text["text"]
    assert sound == {"type": "input_audio", "input_audio": {"data": base64.b64encode(audio).decode(), "format": "wav"}}


def test_pasted_lyrics_are_numbered_for_the_model(monkeypatch):
    calls = _answer(monkeypatch, json.dumps({"lines": [{"n": 2, "start": 1.0, "end": 2.0}]}))
    assert song_transcribe.transcribe(wav(3), ["夜が来る", "君を呼ぶ"]) == [{"start": 1.0, "end": 2.0, "text": "君を呼ぶ"}]
    prompt = calls[0]["messages"][0]["content"][0]["text"]
    assert "1. 夜が来る\n2. 君を呼ぶ" in prompt
    assert '{"lines": [{"n": 1' in prompt


@pytest.mark.parametrize("reply, lyrics, code", [
    ('{"lines": []}', None, "song_unheard"),
    ('{"lines": []}', ["夜が来る"], "song_lyrics_unmatched"),
    ('{"lines": [{"start": 1, "end": 2, "text": "baby baby"}]}', None, "song_not_japanese"),
])
def test_a_song_with_nothing_to_study_says_why(monkeypatch, reply, lyrics, code):
    _answer(monkeypatch, reply)
    with pytest.raises(SongError) as raised:
        song_transcribe.transcribe(wav(3), lyrics)
    assert raised.value.code == code


def test_a_reply_that_is_no_json_is_not_accepted():
    assert song_transcribe._lines_of("I hear a song about a train.") is None
    assert song_transcribe._lines_of('{"lines": "none"}') is None
    assert song_transcribe._lines_of('Here: {"lines": []}') == []


# ── Only a model that hears is asked ──────────────────────────────
class _Session:
    def __init__(self):
        self.models = []

    def post(self, url, headers=None, json=None, timeout=None):
        self.models.append(json["model"])

        class Reply:
            status_code = 200
            ok = True
            text = "body"

            @staticmethod
            def json():
                return {"choices": [{"message": {"content": '{"lines": []}'}}]}
        return Reply()


def _provider(name, models, audio=()):
    return Provider(name=name, url=f"https://{name}.test/v1/chat/completions", api_key="k",
                    models=tuple(models), audio_models=tuple(audio))


def test_an_audio_call_walks_only_the_models_that_hear(monkeypatch):
    session = _Session()
    monkeypatch.setattr(llm_shared, "PROVIDERS", [_provider("deaf", ["t1"]), _provider("ears", ["t2"], ["a1"])])
    monkeypatch.setattr(llm_shared.requests, "Session", lambda: session)
    monkeypatch.setattr(llm_shared, "_DEAD_MODELS", set())
    monkeypatch.setattr(llm_shared, "_DEAD_PROVIDERS", set())
    assert llm_shared.hears_audio() is True
    llm_shared.chat([{"role": "user", "content": "x"}], audio=True)
    assert session.models == ["a1"]


def test_no_model_that_hears_is_unavailable(monkeypatch):
    monkeypatch.setattr(llm_shared, "PROVIDERS", [_provider("deaf", ["t1"])])
    assert llm_shared.hears_audio() is False
    with pytest.raises(LLMUnavailable):
        llm_shared.chat([{"role": "user", "content": "x"}], audio=True)


def test_google_hears_and_the_others_do_not():
    catalog = llm_shared._PROVIDER_CATALOG
    assert catalog["google"].audio_models
    assert not any(p.audio_models for name, p in catalog.items() if name != "google")


# ── The route ─────────────────────────────────────────────────────
@pytest.fixture
def song_feature(monkeypatch):
    """The allowance counted under a name of this test's own, wiped
    after: the suite's learner is shared."""
    from core.db import db_conn
    feature = f"song_test_{time.time_ns()}"
    monkeypatch.setattr(song_transcribe, "FEATURE", feature)
    monkeypatch.setattr(video_module, "hears_audio", lambda: True)
    yield feature
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM daily_usage WHERE feature = %s", (feature,))
        conn.commit()
    finally:
        conn.close()


def _poll(client, session_id, timeout=10.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        response = client.get(f"/api/video/session/{session_id}")
        if response.json().get("status") != "generating":
            return response
        time.sleep(0.05)
    raise AssertionError(f"song session {session_id} never settled")


def _post(client, audio, **data):
    return client.post("/api/video/song", files={"audio": ("song.wav", audio, "audio/wav")}, data=data)


def test_a_song_becomes_a_session_of_timed_lines(client, monkeypatch, song_feature):
    _answer(monkeypatch, json.dumps({"lines": [
        {"start": 0.5, "end": 1.5, "text": "私は学生です。"},
        {"start": 1.5, "end": 2.8, "text": "今日は暑い！"},
    ]}))
    posted = _post(client, wav(3), name="ma-chanson.mp3")
    assert posted.status_code == 202
    body = _poll(client, posted.json()["sessionId"]).json()
    assert body["status"] == "ready"
    assert body["source"] == "song" and body["sourceRef"] == "ma-chanson.mp3"
    assert body["videoId"] is None
    assert [(s["text"], s["cue_start"], s["cue_end"]) for s in body["sentences"]] == [
        ("私は学生です。", 0.5, 1.5), ("今日は暑い！", 1.5, 2.8),
    ]
    listed = client.get("/api/video/sessions").json()
    assert any(row.get("id") == posted.json()["sessionId"] for row in listed)


def test_the_lyrics_pasted_are_the_lines_studied(client, monkeypatch, song_feature):
    calls = _answer(monkeypatch, json.dumps({"lines": [{"n": 1, "start": 0.5, "end": 2.0}]}))
    posted = _post(client, wav(3), lyrics="私は学生です。\n", name="x.mp3")
    body = _poll(client, posted.json()["sessionId"]).json()
    assert [s["text"] for s in body["sentences"]] == ["私は学生です。"]
    assert "1. 私は学生です。" in calls[0]["messages"][0]["content"][0]["text"]


def test_a_song_no_model_could_hear_fails_with_its_code(client, monkeypatch, song_feature):
    def unavailable(*a, **k):
        raise LLMUnavailable("down")
    monkeypatch.setattr(song_transcribe, "chat", unavailable)
    posted = _post(client, wav(2))
    failed = _poll(client, posted.json()["sessionId"])
    assert failed.status_code == 503
    assert failed.json()["code"] == "song_unavailable"


def test_a_server_that_hears_nothing_refuses_up_front(client, monkeypatch, song_feature):
    monkeypatch.setattr(video_module, "hears_audio", lambda: False)
    refused = _post(client, wav(2))
    assert refused.status_code == 503
    assert refused.json()["detail"]["code"] == "song_unavailable"


@pytest.mark.parametrize("audio, code, status", [
    (b"ID3" + b"\x00" * 100, "song_not_wav", 400),
    (wav(0.5), "song_too_short", 400),
])
def test_audio_that_cannot_be_heard_is_refused_before_it_is_counted(client, song_feature, audio, code, status):
    refused = _post(client, audio)
    assert refused.status_code == status
    assert refused.json()["detail"]["code"] == code


def test_a_song_past_the_longest_is_refused(client, monkeypatch, song_feature):
    monkeypatch.setattr(song_transcribe, "MAX_SECONDS", 1)
    refused = _post(client, wav(3))
    assert refused.status_code == 413
    assert refused.json()["detail"]["code"] == "song_too_long"


def test_the_days_allowance_is_counted(client, monkeypatch, song_feature):
    _answer(monkeypatch, json.dumps({"lines": [{"start": 0.5, "end": 1.5, "text": "私は学生です。"}]}))
    monkeypatch.setattr(song_transcribe, "SONG_DAILY_LIMIT", 1)
    first = _post(client, wav(2))
    assert first.status_code == 202
    _poll(client, first.json()["sessionId"])
    second = _post(client, wav(2))
    assert second.status_code == 429
    assert second.json()["detail"]["code"] == "song_allowance"


# ── The songs one process holds (plan 211) ─────────────────────────
def _usage(feature):
    from core.db import db_conn
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COALESCE(SUM(count), 0) FROM daily_usage WHERE feature = %s", (feature,))
            return cur.fetchone()[0]
    finally:
        conn.close()


def _places_back(before, timeout=3.0):
    # The worker gives its place back just after it writes the session.
    deadline = time.time() + timeout
    while song_transcribe._HELD._value != before and time.time() < deadline:
        time.sleep(0.02)
    return song_transcribe._HELD._value


def test_a_full_house_is_told_to_come_back_and_costs_nothing(client, monkeypatch, song_feature):
    full = threading.BoundedSemaphore(1)
    full.acquire()
    monkeypatch.setattr(song_transcribe, "_HELD", full)
    refused = _post(client, wav(2))
    assert refused.status_code == 503
    assert refused.json()["detail"]["code"] == "song_busy"
    assert _usage(song_feature) == 0


def test_every_song_gives_its_place_back(client, monkeypatch, song_feature):
    before = song_transcribe._HELD._value
    _answer(monkeypatch, json.dumps({"lines": [{"start": 0.5, "end": 1.5, "text": "私は学生です。"}]}))
    _poll(client, _post(client, wav(2)).json()["sessionId"])
    assert _places_back(before) == before
    # Refused once held: not a WAV, too short, past the allowance.
    assert _post(client, b"not a song").status_code == 400
    assert _post(client, wav(0.5)).status_code == 400
    monkeypatch.setattr(song_transcribe, "SONG_DAILY_LIMIT", 1)
    assert _post(client, wav(2)).status_code == 429
    assert song_transcribe._HELD._value == before
    # A worker that failed.

    def unavailable(*_a, **_k):
        raise LLMUnavailable("down")

    monkeypatch.setattr(song_transcribe, "SONG_DAILY_LIMIT", 5)
    monkeypatch.setattr(song_transcribe, "chat", unavailable)
    failed = _poll(client, _post(client, wav(2)).json()["sessionId"])
    assert failed.json()["code"] == "song_unavailable"
    assert _places_back(before) == before


def test_a_waiting_song_holds_its_bytes_alone(monkeypatch):
    # The audio's base64, the larger copy, is made only once a slot is
    # free: a song waiting for one holds its bytes alone.
    seen = {"in_slot": False, "encoded_in_slot": None}

    class Slot:
        def __enter__(self):
            seen["in_slot"] = True

        def __exit__(self, *_exc):
            seen["in_slot"] = False

    real = base64.b64encode

    def encode(data):
        seen["encoded_in_slot"] = seen["in_slot"]
        return real(data)

    monkeypatch.setattr(song_transcribe, "_SLOTS", Slot())
    monkeypatch.setattr(song_transcribe.base64, "b64encode", encode)
    _answer(monkeypatch, json.dumps({"lines": [{"start": 0.5, "end": 1.5, "text": "私は学生です。"}]}))
    song_transcribe.transcribe(wav(2))
    assert seen["encoded_in_slot"] is True


# ── What a song's line is, to the rest of the analyser ─────────────

def test_a_song_s_line_is_explained_as_a_song_s():
    # The deep tier is told where a line stands (plan 235): a song's
    # stands in its lyrics, at its time, between the lines around it.
    sentences = [{"text": "夜が来る", "cue_start": 1.0}, {"text": "君を呼ぶ", "cue_start": 72.0}]
    context = video_module._line_context({"source": "song"}, sentences, 1, "夜の歌", "")
    assert "From the lyrics of a Japanese song: \"夜の歌\"." in context
    assert "Line 2 of 2, said at 1:12." in context
    assert "Before it: 夜が来る" in context


def test_a_song_s_line_can_be_kept(client):
    # A line pinned from a song is kept under its session's source, as a
    # video's is (KeepRequest), its ref the file's name and the cue.
    sentence = f"{time.time_ns()}の歌を保存します。"
    kept = client.post("/api/phrase/keep", json={
        "sentence": sentence, "source": "song", "source_ref": "ma-chanson.mp3@72.0",
    })
    assert kept.status_code == 200
    client.delete(f"/api/phrase/keep/{kept.json()['id']}")
