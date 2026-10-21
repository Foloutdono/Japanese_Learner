"""A YouTube video with no subtitles, watched by Gemini (plan 265, the
2026-10-21 amendment of docs/adr/0003): what is asked of the model,
how its lines become a Track on the video's clock, and the session it
makes, held to the learner's day of listening. No test reaches Google:
each replaces the HTTP call or youtube_hearing.transcribe."""
import json
import time

import pytest

import study.transcribe as transcribe
import study.youtube_hearing as hearing
from core.db import db_conn
from study.captions import CaptionFetchError


class TestTheModelsLines:
    def test_times_from_the_clips_start_are_moved_onto_the_videos_clock(self):
        cues = hearing.cues_from_lines([
            {"start": 0.5, "end": 3.0, "text": "今日は暑いですね。"},
            {"start": 3.2, "end": 5.0, "text": "そうですね。"},
        ], start=60, length=600)
        assert [(c["start"], c["end"], c["text"]) for c in cues] == [
            (60.5, 63.0, "今日は暑いですね。"), (63.2, 65.0, "そうですね。"),
        ]

    def test_a_model_that_counted_from_the_videos_start_is_not_moved_twice(self):
        cues = hearing.cues_from_lines([
            {"start": 61.0, "end": 63.0, "text": "一"},
            {"start": 700.0, "text": "二"},
        ], start=60, length=600)
        assert [c["start"] for c in cues] == [61.0, 700.0]

    def test_clock_strings_are_read_and_a_missing_end_closes_at_the_next_line(self):
        cues = hearing.cues_from_lines([
            {"start": "1:02.5", "text": "一つ目"},
            {"start": "01:05", "end": "01:04", "text": "二つ目"},
        ], start=0, length=600)
        assert [(c["start"], c["end"]) for c in cues] == [(62.5, 65.0), (65.0, 68.0)]

    def test_a_line_repeated_back_to_back_is_kept_once(self):
        cues = hearing.cues_from_lines(
            [{"start": t, "text": "ご視聴ありがとうございました"} for t in (1, 2, 3)], start=0, length=60)
        assert len(cues) == 1


class TestTheCall:
    def test_it_asks_gemini_to_watch_the_window_and_never_fetches_the_video(self, monkeypatch):
        monkeypatch.setenv("GOOGLE_API_KEY", "g-key")
        sent = {}

        class Answer:
            status_code = 200

            def json(self):
                return {"candidates": [{"content": {"parts": [{"text": json.dumps(
                    {"lines": [{"start": 1, "end": 2, "text": "こんにちは"}]}, ensure_ascii=False)}]}}]}

        def post(url, headers, json, timeout):
            sent.update(url=url, headers=headers, body=json)
            return Answer()

        monkeypatch.setattr(hearing.httpx, "post", post)
        cues = hearing.transcribe("dQw4w9WgXcQ", 30, 630)
        assert cues == [{"start": 31.0, "end": 32.0, "text": "こんにちは"}]
        assert sent["headers"] == {"x-goog-api-key": "g-key"}
        video = sent["body"]["contents"][0]["parts"][0]
        assert video["fileData"]["fileUri"] == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        assert video["videoMetadata"] == {"startOffset": "30s", "endOffset": "630s"}
        assert sent["body"]["generationConfig"]["responseMimeType"] == "application/json"

    @pytest.mark.parametrize("status, code", [(400, "video_unavailable"), (403, "video_unavailable"),
                                              (429, "transcribe_busy"), (500, "transcribe_failed")])
    def test_a_refusal_is_a_fetch_error_with_a_code(self, monkeypatch, status, code):
        monkeypatch.setenv("GOOGLE_API_KEY", "g-key")

        class Refused:
            status_code = status
            text = "no"

        monkeypatch.setattr(hearing.httpx, "post", lambda *a, **k: Refused())
        with pytest.raises(CaptionFetchError) as caught:
            hearing.transcribe("dQw4w9WgXcQ", 0, 60)
        assert caught.value.code == code

    def test_a_video_with_nothing_said_is_no_speech(self, monkeypatch):
        monkeypatch.setenv("GOOGLE_API_KEY", "g-key")

        class Empty:
            status_code = 200

            def json(self):
                return {"candidates": [{"content": {"parts": [{"text": '{"lines": []}'}]}}]}

        monkeypatch.setattr(hearing.httpx, "post", lambda *a, **k: Empty())
        with pytest.raises(CaptionFetchError) as caught:
            hearing.transcribe("dQw4w9WgXcQ", 0, 60)
        assert caught.value.code == "no_speech"


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
def can_hear(monkeypatch):
    monkeypatch.setenv("GOOGLE_API_KEY", "g-key")
    monkeypatch.setattr(transcribe, "DAILY_MINUTES", 60)
    monkeypatch.setattr(transcribe, "DAILY_MINUTES_TOTAL", 10**6)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM daily_usage WHERE feature = 'transcription'")
            # A job another file left running on purpose (a worker it
            # replaced) would hold one of the learner's two slots for
            # fifteen minutes: a rerun soon after would be refused.
            cur.execute("UPDATE video_session_jobs SET status = 'failed' WHERE status = 'running'")
        conn.commit()
    finally:
        conn.close()
    asked = []

    def fake(video_id, start, end):
        asked.append((video_id, start, end))
        # Four minutes and a bit of speech, however long the window.
        return hearing.cues_from_lines([
            {"start": 1, "end": 4, "text": "今日は暑いですね。"},
            {"start": 250, "end": 252, "text": "またね。"},
        ], start, end - start)

    monkeypatch.setattr(hearing, "transcribe", fake)
    return asked


def test_capabilities_say_whether_a_video_can_be_heard(client, monkeypatch):
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert client.get("/api/video/capabilities").json()["youtubeHear"] is False
    monkeypatch.setenv("GOOGLE_API_KEY", "g-key")
    caps = client.get("/api/video/capabilities").json()
    assert caps["youtubeHear"] is True
    assert "transcribeMinutesLeft" in caps


def test_a_video_without_subtitles_becomes_a_heard_session_on_its_own_player(client, can_hear):
    response = client.post("/api/video/youtube-hear", json={"url": "https://youtu.be/dQw4w9WgXcQ", "start": 30})
    assert response.status_code == 202, response.text
    body = _poll(client, response.json()["sessionId"]).json()
    assert body["status"] == "ready"
    assert body["source"] == "youtube_heard"
    assert body["videoId"] == "dQw4w9WgXcQ"
    assert body["sentences"][0]["cue_start"] == 31.0
    # A session's length was asked for, from the window's start.
    assert can_hear == [("dQw4w9WgXcQ", 30.0, 30.0 + transcribe.MAX_SECONDS)]


def test_the_minutes_the_video_did_not_say_are_given_back(client, can_hear):
    response = client.post("/api/video/youtube-hear", json={"url": "https://youtu.be/dQw4w9WgXcQ"})
    _poll(client, response.json()["sessionId"])
    # Thirty claimed, five heard (the last line ends at 4:12).
    assert client.get("/api/video/capabilities").json()["transcribeMinutesLeft"] == 60 - 5


def test_a_window_past_a_sessions_length_and_a_link_that_is_no_video_are_refused(client, can_hear):
    too_long = client.post("/api/video/youtube-hear",
                           json={"url": "https://youtu.be/dQw4w9WgXcQ", "start": 0, "end": transcribe.MAX_SECONDS + 60})
    assert too_long.status_code == 413
    assert too_long.json()["detail"]["code"] == "media_too_long"
    not_video = client.post("/api/video/youtube-hear", json={"url": "https://example.com/watch"})
    assert not_video.status_code == 400
    assert not_video.json()["detail"]["code"] == "not_youtube_url"
    assert can_hear == []


def test_the_learners_minutes_refuse_a_video_without_spending(client, can_hear, monkeypatch):
    monkeypatch.setattr(transcribe, "DAILY_MINUTES", 10)
    response = client.post("/api/video/youtube-hear", json={"url": "https://youtu.be/dQw4w9WgXcQ"})
    assert response.status_code == 429
    assert response.json()["detail"]["code"] == "transcribe_allowance_mine"
    short = client.post("/api/video/youtube-hear", json={"url": "https://youtu.be/dQw4w9WgXcQ", "start": 0, "end": 300})
    assert short.status_code == 202
    _poll(client, short.json()["sessionId"])


def test_a_server_without_a_google_key_refuses_at_the_door(client, monkeypatch):
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    response = client.post("/api/video/youtube-hear", json={"url": "https://youtu.be/dQw4w9WgXcQ"})
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "transcribe_disabled"
