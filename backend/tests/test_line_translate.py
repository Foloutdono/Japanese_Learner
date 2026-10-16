"""A translation under every line of a video, and Explain told where the
line stands (plan 229).

The translations are asked a block of lines at a time
(study/line_translate.py) and kept on the session by the line's text
(routes/video.py's /translations); the explanation of one line is asked
with the video's title, its place and its neighbours, and cached under
that context (routes/phrase.py's deep_context).
"""
import json
import re
import time
import uuid
from pathlib import Path

import pytest

import routes.video as video_module
from core.db import db_conn
from study import line_translate, morphology
from study.llm_shared import LLMUnavailable

needs_tokenizer = pytest.mark.skipif(not morphology.MORPHOLOGY_AVAILABLE, reason="needs the tokenizer")


def _ready(client, srt: str, url: str | None = None) -> int:
    data = {"url": url} if url else {}
    session_id = client.post(
        "/api/video/session",
        files={"file": ("lines.srt", srt.encode("utf-8"), "text/plain")},
        data=data,
    ).json()["sessionId"]
    deadline = time.time() + 10
    while time.time() < deadline:
        if client.get(f"/api/video/session/{session_id}").json().get("status") == "ready":
            return session_id
        time.sleep(0.1)
    raise AssertionError("the session never became ready")


def _srt(*lines: str) -> str:
    return "".join(
        f"{i}\n00:00:{2 * i:02d},000 --> 00:00:{2 * i + 1:02d},500\n{line}\n\n"
        for i, line in enumerate(lines, 1)
    )


# ── The call ─────────────────────────────────────────────────────
def test_the_reply_is_read_line_by_line_and_a_gap_is_none():
    reply = '```json\n{"lines": {"1": "Today is hot.", "3": " See you. "}}\n```'
    assert line_translate.parse_translations(reply, 3) == ["Today is hot.", None, "See you."]
    assert line_translate.parse_translations('["A", "B"]', 2) == ["A", "B"]
    assert line_translate.parse_translations("We need to produce JSON...", 2) == [None, None]


def test_the_lines_are_numbered_and_the_context_is_marked_as_context():
    message = line_translate.user_message(
        ["今日は暑い", "また明日"], ["前の行"], ["次の行"], title="夏の歌", channel="THE FIRST TAKE",
    )
    assert "Video: 夏の歌 -- THE FIRST TAKE" in message
    assert "1. 今日は暑い\n2. また明日" in message
    assert message.index("前の行") < message.index("1. 今日は暑い") < message.index("次の行")
    assert "do not translate" in message


def test_the_client_asks_by_the_server_s_block():
    hook = Path(__file__).resolve().parents[2] / "frontend/src/components/analysis/useLineTranslations.js"
    match = re.search(r"export const BLOCK = (\d+)", hook.read_text(encoding="utf-8"))
    assert match and int(match.group(1)) == line_translate.BLOCK


# ── The route ────────────────────────────────────────────────────
@pytest.fixture
def plenty(monkeypatch):
    """Today's ceiling out of the way: the counter is real and shared
    with every other run of the suite today."""
    monkeypatch.setattr(line_translate, "LINE_TRANSLATION_DAILY_LIMIT", 10 ** 6)


def _fake_model(monkeypatch, calls: list):
    def chat(messages, **kwargs):
        calls.append(messages[1]["content"])
        numbered = re.findall(r"^(\d+)\. (.+)$", messages[1]["content"], flags=re.MULTILINE)
        return json.dumps({"lines": {n: f"<{text}>" for n, text in numbered}}, ensure_ascii=False)

    monkeypatch.setattr(line_translate, "chat", chat)


def test_a_block_is_translated_once_and_kept_on_the_session(client, monkeypatch, plenty):
    session_id = _ready(client, _srt("今日は暑いですね", "I love you", "また明日会いましょう", "今日は暑いですね"))
    calls: list = []
    _fake_model(monkeypatch, calls)

    body = client.post(f"/api/video/session/{session_id}/translations",
                       json={"lang": "fr", "index": 2, "title": "夏"}).json()
    assert body == {"start": 0, "lines": ["<今日は暑いですね>", None, "<また明日会いましょう>", "<今日は暑いですね>"]}
    # The Japanese lines alone, a repeated one once, the title beside them.
    assert len(calls) == 1
    assert "1. 今日は暑いですね\n2. また明日会いましょう" in calls[0]
    assert "I love you" not in calls[0] and "Video: 夏" in calls[0]

    again = client.post(f"/api/video/session/{session_id}/translations", json={"lang": "fr", "index": 0})
    assert again.json() == body
    assert len(calls) == 1, "a block the session holds is not asked again"

    # Another language is another translation.
    client.post(f"/api/video/session/{session_id}/translations", json={"lang": "en", "index": 0})
    assert len(calls) == 2


def test_the_daily_ceiling_refuses_before_the_model_is_called(client, monkeypatch):
    session_id = _ready(client, _srt("今日は暑いですね"))
    calls: list = []
    _fake_model(monkeypatch, calls)
    monkeypatch.setattr(line_translate, "LINE_TRANSLATION_DAILY_LIMIT", 0)

    response = client.post(f"/api/video/session/{session_id}/translations", json={"lang": "fr", "index": 0})
    assert response.status_code == 429
    assert response.json()["detail"]["code"] == "translation_limit"
    assert calls == []


def test_a_model_that_is_down_is_a_503_and_nothing_is_kept(client, monkeypatch, plenty):
    session_id = _ready(client, _srt("今日は暑いですね"))

    def down(messages, **kwargs):
        raise LLMUnavailable("no provider")

    monkeypatch.setattr(line_translate, "chat", down)
    response = client.post(f"/api/video/session/{session_id}/translations", json={"lang": "fr", "index": 0})
    assert response.status_code == 503
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT translations FROM video_sessions WHERE id = %s", (session_id,))
            (stored,) = cur.fetchone()
    finally:
        conn.close()
    assert stored == {}


def test_a_block_past_the_end_is_empty(client, monkeypatch, plenty):
    session_id = _ready(client, _srt("今日は暑いですね"))
    calls: list = []
    _fake_model(monkeypatch, calls)
    body = client.post(f"/api/video/session/{session_id}/translations",
                       json={"lang": "fr", "index": line_translate.BLOCK}).json()
    assert body == {"start": line_translate.BLOCK, "lines": []}
    assert calls == []


# ── Explain, where the line stands ───────────────────────────────
def test_explain_is_asked_with_the_video_its_place_and_its_neighbours(client, monkeypatch):
    session_id = _ready(client, _srt("みなさん、こんにちは", "みなさんがいてくれるので", "一緒に歌いましょう"))
    title = f"夏の歌 {uuid.uuid4().hex[:8]}"  # a key of its own on every run
    seen: list = []

    def chat(messages, **kwargs):
        seen.append(messages[1]["content"])
        return '{"words": [], "translation": "Since you are all here", "explanation": "A reason."}'

    monkeypatch.setattr("routes.phrase.chat", chat)
    body = client.post(f"/api/video/session/{session_id}/sentence/1/explain",
                       json={"lang": "en", "title": title, "channel": "THE FIRST TAKE"}).json()
    assert body["explanation"] == "A reason."
    assert body["cue_start"] == 4.0
    (message,) = seen
    assert message.startswith("みなさんがいてくれるので")
    assert f'"{title}", by THE FIRST TAKE' in message
    assert "Line 2 of 3, said at 0:04" in message
    assert "Before it: みなさん、こんにちは" in message
    assert "After it: 一緒に歌いましょう" in message

    # The same context is the same entry: no second call.
    client.post(f"/api/video/session/{session_id}/sentence/1/explain",
                json={"lang": "en", "title": title, "channel": "THE FIRST TAKE"})
    assert len(seen) == 1


def test_explain_s_context_is_never_written_over_the_plain_entry(client, monkeypatch):
    from routes import phrase

    assert phrase._phrase_key("今日は", "en") != phrase._phrase_key("今日は", "en", "context")
    # The phrase alone keeps the key it always had.
    import hashlib
    assert phrase._phrase_key("今日は", "en") == hashlib.sha256(
        f"v{phrase.CACHE_VERSION}:en:今日は".encode("utf-8")).hexdigest()


# ── A session stored before the cap ──────────────────────────────
@needs_tokenizer
def test_a_wide_line_stored_before_the_cap_is_cut_on_opening(client, monkeypatch):
    wide = "今日はAyaseさんとバンドメンバーとそしてぷらそにかの合唱のみなさんがいてくれるので、"
    session_id = _ready(client, _srt("こんにちは", "また明日"))
    # The session as an older build stored it: the wide line whole.
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT sentences FROM video_sessions WHERE id = %s", (session_id,))
            (stored,) = cur.fetchone()
            old = {**video_module.analyze_local(wide), "cue_start": 10.0, "cue_end": 20.0,
                   "local_rev": video_module.LOCAL_REV}
            cur.execute("UPDATE video_sessions SET sentences = %s WHERE id = %s",
                        (json.dumps([stored[0], old, stored[1]], ensure_ascii=False), session_id))
        conn.commit()
    finally:
        conn.close()

    lines = client.get(f"/api/video/session/{session_id}").json()["sentences"]
    assert [s["text"] for s in lines] == [
        "こんにちは", "今日はAyaseさんとバンドメンバーとそして", "ぷらそにかの合唱のみなさんがいてくれるので、", "また明日",
    ]
    assert (lines[1]["cue_start"], lines[2]["cue_end"]) == (10.0, 20.0)
    assert lines[1]["cue_end"] == lines[2]["cue_start"]

    # Explain reads the line by the index the client was given.
    def chat(messages, **kwargs):
        return '{"words": [], "explanation": "Cut."}'

    monkeypatch.setattr("routes.phrase.chat", chat)
    body = client.post(f"/api/video/session/{session_id}/sentence/3/explain",
                       json={"lang": "en", "title": uuid.uuid4().hex}).json()
    assert body["text"] == "また明日"
