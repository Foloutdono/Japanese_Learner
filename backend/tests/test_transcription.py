"""A recording as a Track (plan 265): the MP3 the browser makes is
measured from its own frames, the recogniser's answer becomes cues
with their words timed, and a session made from one is held to the
learner's and the app's minutes. No test reaches the recogniser: each
replaces study.transcribe.transcribe or the HTTP call under it."""
import time

import lameenc
import pytest

import routes.video as video_module
import study.transcribe as transcribe
from core.db import db_conn
from study.captions import CaptionFetchError


def _mp3(seconds: float, rate: int = 16000) -> bytes:
    """`seconds` of silence as the browser encodes it: mono, 32 kbps."""
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(32)
    encoder.set_in_sample_rate(rate)
    encoder.set_channels(1)
    encoder.set_quality(7)
    pcm = b"\x00\x00" * int(seconds * rate)
    return bytes(encoder.encode(pcm) + encoder.flush())


WHISPER = {
    "duration": 9.0,
    "segments": [
        {"start": 0.5, "end": 3.0, "text": "今日は暑いですね。", "no_speech_prob": 0.01, "avg_logprob": -0.2},
        {"start": 3.0, "end": 6.0, "text": "ご視聴ありがとうございました", "no_speech_prob": 0.9, "avg_logprob": -1.4},
        {"start": 6.0, "end": 9.0, "text": " そうですね。", "no_speech_prob": 0.02, "avg_logprob": -0.3},
    ],
    "words": [
        {"word": "今日", "start": 0.5, "end": 0.9},
        {"word": "は", "start": 0.9, "end": 1.0},
        {"word": "暑い", "start": 1.1, "end": 1.6},
        {"word": "ですね", "start": 1.7, "end": 2.4},
        {"word": "ご視聴", "start": 3.2, "end": 3.9},
        {"word": "そう", "start": 6.1, "end": 6.5},
        {"word": "ですね", "start": 6.6, "end": 7.2},
    ],
}


class TestTheMp3sOwnLength:
    def test_a_recording_is_measured_from_its_frames(self):
        for seconds in (3.0, 61.5):
            measured = transcribe.mp3_duration(_mp3(seconds))
            # The encoder pads its first and last frames.
            assert measured == pytest.approx(seconds, abs=0.2)

    def test_an_id3_tag_before_the_frames_is_stepped_over(self):
        tag = b"ID3\x04\x00\x00\x00\x00\x00\x10" + b"\x00" * 16
        assert transcribe.mp3_duration(tag + _mp3(3.0)) == pytest.approx(3.0, abs=0.2)

    def test_what_is_not_an_mp3_is_none(self):
        assert transcribe.mp3_duration(b"") is None
        assert transcribe.mp3_duration(b"WEBVTT\n\n00:00.000 --> 00:01.000\nx" * 50) is None
        assert transcribe.mp3_duration(bytes(range(256)) * 400) is None

    def test_the_allowance_counts_whole_minutes_up(self):
        assert transcribe.minutes(1) == 1
        assert transcribe.minutes(60) == 1
        assert transcribe.minutes(61) == 2


class TestTheRecognisersAnswer:
    def test_a_segment_is_a_cue_its_words_timed_and_the_window_offset_added(self):
        cues = transcribe.cues_from_whisper(WHISPER, offset=100.0)
        assert [c["text"] for c in cues] == ["今日は暑いですね。", "そうですね。"]
        assert (cues[0]["start"], cues[0]["end"]) == (100.5, 103.0)
        assert cues[0]["words"] == [[0, 100.5], [2, 100.9], [3, 101.1], [5, 101.7]]
        assert cues[1]["words"] == [[0, 106.1], [2, 106.6]]

    def test_what_the_recogniser_doubts_is_not_taught(self):
        # The silence Whisper fills with ご視聴ありがとうございました.
        texts = [c["text"] for c in transcribe.cues_from_whisper(WHISPER)]
        assert "ご視聴ありがとうございました" not in texts
        loop = {"segments": [{"start": 0, "end": 5, "text": "あああ" * 30, "compression_ratio": 3.1}]}
        assert transcribe.cues_from_whisper(loop) == []

    def test_a_word_the_text_does_not_hold_is_skipped_not_misplaced(self):
        result = {"segments": [{"start": 0, "end": 2, "text": "猫が好き"}],
                  "words": [{"word": "猫", "start": 0.1}, {"word": "犬", "start": 0.5}, {"word": "好き", "start": 1.0}]}
        [cue] = transcribe.cues_from_whisper(result)
        assert cue["words"] == [[0, 0.1], [2, 1.0]]

    def test_the_call_asks_for_japanese_with_every_words_time(self, monkeypatch):
        monkeypatch.setenv("TRANSCRIBE_API_KEY", "test-key")
        sent = {}

        class Answer:
            status_code = 200

            def json(self):
                return WHISPER

        def post(url, headers, data, files, timeout):
            sent.update(url=url, headers=headers, data=data, files=files)
            return Answer()

        monkeypatch.setattr(transcribe.httpx, "post", post)
        cues = transcribe.transcribe(b"mp3", offset=0)
        assert len(cues) == 2
        assert sent["headers"]["Authorization"] == "Bearer test-key"
        assert ("language", "ja") in sent["data"]
        assert ("response_format", "verbose_json") in sent["data"]
        assert ("timestamp_granularities[]", "word") in sent["data"]

    def test_a_refusal_is_a_fetch_error_with_a_code(self, monkeypatch):
        monkeypatch.setenv("TRANSCRIBE_API_KEY", "test-key")

        class Busy:
            status_code = 429
            text = "slow down"

        monkeypatch.setattr(transcribe.httpx, "post", lambda *a, **k: Busy())
        with pytest.raises(CaptionFetchError) as caught:
            transcribe.transcribe(b"mp3")
        assert caught.value.code == "transcribe_busy"

    def test_no_key_is_refused_before_any_call(self, monkeypatch):
        monkeypatch.delenv("TRANSCRIBE_API_KEY", raising=False)
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        monkeypatch.setattr(transcribe.httpx, "post", lambda *a, **k: pytest.fail("called"))
        with pytest.raises(CaptionFetchError) as caught:
            transcribe.transcribe(b"mp3")
        assert caught.value.code == "transcribe_disabled"


# ── The session ──────────────────────────────────────────────
def _poll(client, session_id, timeout=10.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        response = client.get(f"/api/video/session/{session_id}")
        if response.json().get("status") != "generating":
            return response
        time.sleep(0.1)
    raise AssertionError("the session never settled")


@pytest.fixture
def can_transcribe(monkeypatch):
    monkeypatch.setenv("TRANSCRIBE_API_KEY", "test-key")
    monkeypatch.setattr(transcribe, "DAILY_MINUTES", 60)
    monkeypatch.setattr(transcribe, "DAILY_MINUTES_TOTAL", 10**6)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM daily_usage WHERE feature = 'transcription'")
        conn.commit()
    finally:
        conn.close()
    heard = []

    def fake(audio, offset=0.0):
        heard.append((len(audio), offset))
        return transcribe.cues_from_whisper(WHISPER, offset)

    monkeypatch.setattr(transcribe, "transcribe", fake)
    return heard


def test_capabilities_say_whether_recordings_can_be_heard(client, monkeypatch):
    monkeypatch.delenv("TRANSCRIBE_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert client.get("/api/video/capabilities").json()["transcribe"] is False
    monkeypatch.setenv("TRANSCRIBE_API_KEY", "test-key")
    caps = client.get("/api/video/capabilities").json()
    assert caps["transcribe"] is True
    assert caps["transcribeMaxSeconds"] == transcribe.MAX_SECONDS
    assert 0 <= caps["transcribeMinutesLeft"] <= transcribe.DAILY_MINUTES


def test_a_recording_becomes_a_session_of_its_heard_lines(client, can_transcribe):
    response = client.post(
        "/api/video/recording",
        files={"audio": ("audio.mp3", _mp3(9.0), "audio/mpeg")},
        data={"name": "episode-12.m4a", "source": "media", "start": "30", "end": "39"},
    )
    assert response.status_code == 202, response.text
    body = _poll(client, response.json()["sessionId"]).json()
    assert body["status"] == "ready"
    assert body["source"] == "media"
    assert body["sourceRef"] == "episode-12.m4a"
    assert body["mediaUrl"] is None
    assert [s["text"] for s in body["sentences"]] == ["今日は暑いですね。", "そうですね。"]
    # The recording starts at the window's start: its lines are said
    # at the video's times.
    assert body["sentences"][0]["cue_start"] == 30.5
    assert can_transcribe[0][1] == 30.0


def test_a_podcast_session_keeps_the_episode_its_player_plays(client, can_transcribe):
    response = client.post(
        "/api/video/recording",
        files={"audio": ("audio.mp3", _mp3(9.0), "audio/mpeg")},
        data={"name": "第12回", "source": "podcast",
              "media_url": "https://cdn.example/ep12.mp3", "media_title": "第12回 旅の話"},
    )
    assert response.status_code == 202, response.text
    body = _poll(client, response.json()["sessionId"]).json()
    assert body["mediaUrl"] == "https://cdn.example/ep12.mp3"
    assert body["mediaTitle"] == "第12回 旅の話"
    listed = client.get("/api/video/sessions").json()
    assert any(s["mediaUrl"] == "https://cdn.example/ep12.mp3" for s in listed)


def test_a_podcast_session_needs_the_episodes_address(client, can_transcribe):
    response = client.post(
        "/api/video/recording",
        files={"audio": ("audio.mp3", _mp3(3.0), "audio/mpeg")},
        data={"source": "podcast"},
    )
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "bad_media_url"


def test_what_is_not_an_mp3_is_refused_by_name(client, can_transcribe):
    response = client.post(
        "/api/video/recording", files={"audio": ("a.mp3", b"not audio at all" * 100, "audio/mpeg")},
    )
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "audio_unreadable"
    assert can_transcribe == []


def test_a_recording_past_the_sessions_length_is_refused(client, can_transcribe, monkeypatch):
    monkeypatch.setattr(transcribe, "MAX_SECONDS", 5)
    response = client.post("/api/video/recording", files={"audio": ("a.mp3", _mp3(9.0), "audio/mpeg")})
    assert response.status_code == 413
    assert response.json()["detail"]["code"] == "media_too_long"


def test_the_learners_minutes_refuse_without_spending(client, can_transcribe, monkeypatch):
    monkeypatch.setattr(transcribe, "DAILY_MINUTES", 2)
    long = _mp3(150.0)  # three minutes of the allowance
    response = client.post("/api/video/recording", files={"audio": ("a.mp3", long, "audio/mpeg")})
    assert response.status_code == 429
    assert response.json()["detail"]["code"] == "transcribe_allowance_mine"
    # Refused, nothing spent: a shorter one still fits.
    response = client.post("/api/video/recording", files={"audio": ("a.mp3", _mp3(9.0), "audio/mpeg")})
    assert response.status_code == 202
    assert client.get("/api/video/capabilities").json()["transcribeMinutesLeft"] == 1
    _poll(client, response.json()["sessionId"])


def test_the_apps_minutes_are_their_own_refusal(client, can_transcribe, monkeypatch):
    monkeypatch.setattr(transcribe, "DAILY_MINUTES_TOTAL", 0)
    response = client.post("/api/video/recording", files={"audio": ("a.mp3", _mp3(9.0), "audio/mpeg")})
    assert response.status_code == 429
    assert response.json()["detail"]["code"] == "transcribe_allowance_app"


def test_a_server_that_cannot_transcribe_refuses_at_the_door(client, monkeypatch):
    monkeypatch.delenv("TRANSCRIBE_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    response = client.post("/api/video/recording", files={"audio": ("a.mp3", _mp3(3.0), "audio/mpeg")})
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "transcribe_disabled"


def test_a_recogniser_failure_fails_the_session_by_its_code(client, can_transcribe, monkeypatch):
    def refused(audio, offset=0.0):
        raise CaptionFetchError("busy", "transcribe_busy")

    monkeypatch.setattr(transcribe, "transcribe", refused)
    response = client.post("/api/video/recording", files={"audio": ("a.mp3", _mp3(3.0), "audio/mpeg")})
    failed = _poll(client, response.json()["sessionId"])
    assert failed.status_code == 503
    assert failed.json()["code"] == "transcribe_busy"


def test_an_upload_can_name_the_pages_media_file_to_play(client):
    srt = "1\n00:00:01,000 --> 00:00:04,000\n私は学生です。\n".encode("utf-8")
    vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n私は学生です。\n".encode("utf-8")
    response = client.post(
        "/api/video/session",
        files={"file": ("www.example.jp.ja.vtt", vtt, "text/vtt")},
        data={"media_url": "https://cdn.example.jp/news.mp4", "media_title": "ニュース"},
    )
    body = _poll(client, response.json()["sessionId"]).json()
    assert body["mediaUrl"] == "https://cdn.example.jp/news.mp4"
    assert body["mediaTitle"] == "ニュース"
    bad = client.post(
        "/api/video/session",
        files={"file": ("a.srt", srt, "text/plain")},
        data={"media_url": "javascript:alert(1)"},
    )
    assert bad.status_code == 400
    assert bad.json()["detail"]["code"] == "bad_media_url"


def test_a_recording_past_its_bytes_is_refused_before_it_is_parsed(client, can_transcribe, monkeypatch):
    from starlette.requests import Request

    async def _parsed(self, *args, **kwargs):
        raise AssertionError("an oversized recording reached the multipart parser")

    monkeypatch.setattr(Request, "form", _parsed)
    monkeypatch.setattr(transcribe, "MAX_AUDIO_BYTES", 1000)
    response = client.post("/api/video/recording", files={"audio": ("a.mp3", b"x" * 200_000, "audio/mpeg")})
    assert response.status_code == 413
    assert response.json()["detail"]["code"] == "audio_too_large"


def test_a_recording_refused_while_two_are_preparing_spends_nothing(client, can_transcribe, monkeypatch):
    from fastapi import HTTPException

    def busy(*args, **kwargs):
        raise HTTPException(status_code=429, detail={"code": "session_preparing", "message": "busy"})

    monkeypatch.setattr(video_module, "_open_session", busy)
    response = client.post("/api/video/recording", files={"audio": ("a.mp3", _mp3(150.0), "audio/mpeg")})
    assert response.status_code == 429
    assert response.json()["detail"]["code"] == "session_preparing"
    assert client.get("/api/video/capabilities").json()["transcribeMinutesLeft"] == transcribe.DAILY_MINUTES
