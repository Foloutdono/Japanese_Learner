# ── core/history.py — the analyser's shelf, held to its limit ─────
# The shelf is one list over phrase_history (texts, photos) and
# video_sessions, kept sentences aside. Every test runs as a learner of
# its own, so the shared DEV_USER_ID history other tests read is left
# alone, and removes what it made.
import time
import uuid

import pytest

import core.history as history
from core.db import db_conn
from tests.conftest import acting_as

_SRT = (
    "1\n00:00:01,000 --> 00:00:04,000\n私は学生です。\n\n"
    "2\n00:00:05,000 --> 00:00:08,000\n今日は暑い！\n"
).encode("utf-8")


@pytest.fixture
def learner():
    uid = f"history-test-{uuid.uuid4()}"
    yield uid
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM phrase_history WHERE user_id = %s", (uid,))
            cur.execute("DELETE FROM video_sessions WHERE user_id = %s", (uid,))
        conn.commit()
    finally:
        conn.close()


def _run(sql, params=()):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall() if cur.description else None
        conn.commit()
        return rows
    finally:
        conn.close()


def _passage(uid, text, minutes_ago, kept=False):
    return _run(
        "INSERT INTO phrase_history(user_id, phrase, source, kept, created_at) "
        "VALUES (%s, %s, 'typed', %s, NOW() - make_interval(mins => %s)) RETURNING id",
        (uid, text, kept, minutes_ago),
    )[0][0]


def _session(uid, ref, minutes_ago, status="ready"):
    return _run(
        "INSERT INTO video_sessions(user_id, source, source_ref, status, sentences, created_at) "
        "VALUES (%s, 'upload', %s, %s, '[]'::jsonb, NOW() - make_interval(mins => %s)) RETURNING id",
        (uid, ref, status, minutes_ago),
    )[0][0]


def _trim(uid, keep):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            history.trim_history(cur, uid, keep)
        conn.commit()
    finally:
        conn.close()


def _shelf(client):
    passages = [p["phrase"] for p in client.get("/api/phrase/history").json() if not p["kept"]]
    sessions = [s["sourceRef"] for s in client.get("/api/video/sessions").json()]
    return passages, sessions


def test_the_newest_stand_across_texts_and_videos(client, learner):
    # Oldest first: a text, a video, a text, a video, a text.
    _passage(learner, "一", 50)
    _session(learner, "a.srt", 40)
    _passage(learner, "三", 30)
    _session(learner, "b.srt", 20)
    _passage(learner, "五", 10)
    _trim(learner, 3)
    with acting_as(learner):
        assert _shelf(client) == (["五", "三"], ["b.srt"])


def test_a_kept_sentence_is_neither_counted_nor_touched(client, learner):
    _passage(learner, "保存", 99, kept=True)
    _passage(learner, "古い", 20)
    _passage(learner, "新しい", 10)
    _trim(learner, 1)
    with acting_as(learner):
        rows = client.get("/api/phrase/history").json()
    assert [(r["phrase"], r["kept"]) for r in rows] == [("保存", True), ("新しい", False)]


def test_a_session_still_being_made_is_left_alone(learner):
    making = _session(learner, "making.srt", 60, status="generating")
    _session(learner, "done.srt", 10)
    _trim(learner, 1)
    [(deleted_at,)] = _run("SELECT deleted_at FROM video_sessions WHERE id = %s", (making,))
    assert deleted_at is None


def test_analysing_a_passage_trims_the_shelf(client, learner, monkeypatch):
    monkeypatch.setattr(history, "HISTORY_LIMIT", 2)
    _session(learner, "old.srt", 60)
    with acting_as(learner):
        for text in ("一つ目の文です。", "二つ目の文です。"):
            assert client.post("/api/phrase/analyze", json={"phrase": text}).status_code == 200
        assert _shelf(client) == (["二つ目の文です。", "一つ目の文です。"], [])


def test_a_video_leaves_the_shelf_and_comes_back_on_undo(client, learner):
    sid = _session(learner, "clip.srt", 5)
    with acting_as(learner):
        assert client.delete(f"/api/video/session/{sid}").status_code == 200
        assert _shelf(client)[1] == []
        # Gone for every reader, not just the list.
        assert client.get(f"/api/video/session/{sid}").status_code == 404
        assert client.post(f"/api/video/session/{sid}/restore").status_code == 200
        assert _shelf(client)[1] == ["clip.srt"]
        # Nothing to restore once it is back.
        assert client.post(f"/api/video/session/{sid}/restore").status_code == 404


def test_a_removed_video_is_erased_a_day_later(learner):
    sid = _session(learner, "gone.srt", 5)
    _run("UPDATE video_sessions SET deleted_at = NOW() - INTERVAL '25 hours' WHERE id = %s", (sid,))
    fresh = _session(learner, "fresh.srt", 3)
    _run("UPDATE video_sessions SET deleted_at = NOW() WHERE id = %s", (fresh,))
    _trim(learner, 30)
    ids = {r[0] for r in _run("SELECT id FROM video_sessions WHERE user_id = %s", (learner,))}
    assert ids == {fresh}


def test_a_line_explain_wrote_before_is_not_listed_and_goes_on_the_next_write(client, learner):
    """Until 2026-09-27 Explain on a video line wrote the line here
    (source 'video'), and the shelf drew it as a text card beside its
    video. A line the learner kept is theirs and stays."""
    _run(
        "INSERT INTO phrase_history(user_id, phrase, source, source_ref) "
        "VALUES (%s, '溶けないで', 'video', 'clip.srt@12.0')",
        (learner,),
    )
    _passage(learner, "保存した行", 30, kept=True)
    _run("UPDATE phrase_history SET source = 'video' WHERE user_id = %s AND kept", (learner,))
    with acting_as(learner):
        assert [r["phrase"] for r in client.get("/api/phrase/history").json()] == ["保存した行"]
        assert client.post("/api/phrase/analyze", json={"phrase": "新しい文です。"}).status_code == 200
    rows = _run("SELECT phrase FROM phrase_history WHERE user_id = %s ORDER BY phrase", (learner,))
    assert sorted(r[0] for r in rows) == sorted(["保存した行", "新しい文です。"])


def test_one_learner_cannot_remove_another_s_video(client, learner):
    sid = _session(learner, "mine.srt", 5)
    with acting_as(f"{learner}-other"):
        client.delete(f"/api/video/session/{sid}")
    with acting_as(learner):
        assert _shelf(client)[1] == ["mine.srt"]


def test_an_uploaded_video_trims_the_shelf_when_it_lands(client, learner, monkeypatch):
    monkeypatch.setattr(history, "HISTORY_LIMIT", 1)
    _passage(learner, "古い文", 60)
    with acting_as(learner):
        sid = client.post("/api/video/session", files={"file": ("new.srt", _SRT, "text/plain")}).json()["sessionId"]
        for _ in range(100):
            if client.get(f"/api/video/session/{sid}").json().get("status") == "ready":
                break
            time.sleep(0.1)
        assert _shelf(client) == ([], ["new.srt"])
