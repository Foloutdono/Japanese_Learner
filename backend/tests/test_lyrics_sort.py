"""Which lines of a music video are the song (plan 264).

study/lyrics_sort.py tells a sound cue and a credit by pattern and asks
the model about the rest; routes/video.py's /lyrics keeps what it found
on the session by the line's text, and never refuses: a spent ration or
a model that is down sorts by the patterns alone and says so.
"""
import json
import re
import time

import pytest

from core.db import db_conn
from study import lyrics_sort
from study.llm_shared import LLMUnavailable


def _ready(client, name: str, content: str) -> int:
    session_id = client.post(
        "/api/video/session",
        files={"file": (name, content.encode("utf-8"), "text/plain")},
    ).json()["sessionId"]
    deadline = time.time() + 10
    while time.time() < deadline:
        if client.get(f"/api/video/session/{session_id}").json().get("status") == "ready":
            return session_id
        time.sleep(0.1)
    raise AssertionError("the session never became ready")


SONG = "\n".join([
    "[音楽]",
    "みなさんこんにちは",
    "作詞：米津玄師",
    "君の名前を呼ぶよ",
    "I love you",
    "君の名前を呼ぶよ",
    "チャンネル登録お願いします",
])


# ── The patterns ─────────────────────────────────────────────────
@pytest.mark.parametrize("line,kind", [
    ("[音楽]", "sound"), ("（拍手）", "sound"), ("(笑)", "sound"), ("[Music]", "sound"),
    ("♪", "sound"), ("♪〜♪", "sound"),
    ("作詞：米津玄師", "credit"), ("Lyrics: Aimer", "credit"), ("歌 / YOASOBI", "credit"),
    # Left to the model: a backing vocal in brackets is sung, and a
    # line that only starts like a role is a lyric.
    ("（君の名を）", None), ("歌いたい", None), ("みなさんこんにちは", None),
])
def test_what_a_pattern_tells_and_what_it_leaves(line, kind):
    assert lyrics_sort.obvious_kind(line) == kind


def test_a_reply_is_read_line_by_line_and_anything_odd_is_sung():
    reply = '```json\n{"lines": {"1": "spoken", "2": " Credit ", "4": "chorus"}}\n```'
    assert lyrics_sort.parse_kinds(reply, 4) == ["spoken", "credit", "sung", "sung"]
    assert lyrics_sort.parse_kinds("We need to produce JSON...", 2) == ["sung", "sung"]


# ── The route ────────────────────────────────────────────────────
@pytest.fixture
def plenty(monkeypatch):
    """Today's ceiling out of the way: the counter is real and shared
    with every other run of the suite today."""
    monkeypatch.setattr(lyrics_sort, "LYRICS_SORT_DAILY_LIMIT", 10 ** 6)


def _fake_model(monkeypatch, calls: list):
    talk = ("こんにちは", "チャンネル登録")

    def chat(messages, **kwargs):
        calls.append(messages[1]["content"])
        numbered = re.findall(r"^(\d+)\. (.+)$", messages[1]["content"], flags=re.MULTILINE)
        return json.dumps({"lines": {
            n: "spoken" if any(w in text for w in talk) else "sung" for n, text in numbered
        }}, ensure_ascii=False)

    monkeypatch.setattr(lyrics_sort, "chat", chat)


def _stored(session_id: int):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT lyrics_sort FROM video_sessions WHERE id = %s", (session_id,))
            (stored,) = cur.fetchone()
    finally:
        conn.close()
    return stored


def test_a_song_is_sorted_once_and_kept_on_the_session(client, monkeypatch, plenty):
    session_id = _ready(client, "YOASOBI - song.txt", SONG)
    calls: list = []
    _fake_model(monkeypatch, calls)

    body = client.post(f"/api/video/session/{session_id}/lyrics").json()
    assert body == {"sorted": True, "reason": None, "kinds": [
        "sound", "spoken", "credit", "sung", "sung", "sung", "spoken",
    ]}
    # One call; the patterns' lines never asked, a repeated line once,
    # and the file's name beside them.
    assert len(calls) == 1
    asked = re.findall(r"^\d+\. (.+)$", calls[0], flags=re.MULTILINE)
    assert asked == ["みなさんこんにちは", "君の名前を呼ぶよ", "I love you", "チャンネル登録お願いします"]
    assert "YOASOBI - song.txt" in calls[0]
    assert _stored(session_id)["rev"] == lyrics_sort.SORT_REV

    again = client.post(f"/api/video/session/{session_id}/lyrics").json()
    assert again == body
    assert len(calls) == 1, "a song the session holds is not asked again"


def test_the_ceiling_sorts_by_the_patterns_without_a_call(client, monkeypatch):
    session_id = _ready(client, "song.txt", SONG)
    calls: list = []
    _fake_model(monkeypatch, calls)
    monkeypatch.setattr(lyrics_sort, "LYRICS_SORT_DAILY_LIMIT", 0)

    body = client.post(f"/api/video/session/{session_id}/lyrics").json()
    assert body["sorted"] is False and body["reason"] == "over_limit"
    assert body["kinds"] == ["sound", "sung", "credit", "sung", "sung", "sung", "sung"]
    assert calls == []
    assert _stored(session_id) is None


def test_a_model_that_is_down_keeps_every_line_and_nothing_is_stored(client, monkeypatch, plenty):
    session_id = _ready(client, "song.txt", SONG)

    def down(messages, **kwargs):
        raise LLMUnavailable("no provider")

    monkeypatch.setattr(lyrics_sort, "chat", down)
    body = client.post(f"/api/video/session/{session_id}/lyrics").json()
    assert body["sorted"] is False and body["reason"] == "ai_unavailable"
    assert body["kinds"].count("sung") == 5
    assert _stored(session_id) is None


def test_a_sort_under_another_revision_is_asked_again(client, monkeypatch, plenty):
    session_id = _ready(client, "song.txt", SONG)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE video_sessions SET lyrics_sort = %s WHERE id = %s",
                        (json.dumps({"rev": lyrics_sort.SORT_REV - 1, "kinds": {"君の名前を呼ぶよ": "spoken"}}),
                         session_id))
        conn.commit()
    finally:
        conn.close()
    calls: list = []
    _fake_model(monkeypatch, calls)
    body = client.post(f"/api/video/session/{session_id}/lyrics").json()
    assert body["kinds"][3] == "sung"
    assert len(calls) == 1


def test_another_learner_s_session_is_not_found(client, plenty):
    from tests.conftest import acting_as, OTHER_USER

    session_id = _ready(client, "song.txt", SONG)
    with acting_as(OTHER_USER):
        assert client.post(f"/api/video/session/{session_id}/lyrics").status_code == 404
