# Plain pytest-style functions with the `client`/`monkeypatch` fixtures --
# same reason test_http_smoke.py deviates from this suite's usual
# unittest.TestCase style: TestClient and monkeypatch wire in more
# naturally as plain functions.
import routes.phrase as phrase_module
from core.db import db_conn


def test_analyze_returns_local_tier_with_no_explanation(client):
    response = client.post("/api/phrase/analyze", json={"phrase": "私は学生です。"})
    assert response.status_code == 200
    body = response.json()
    assert body["tokens"]
    assert "grammar" in body
    assert "level" in body
    assert body["available"] is True
    assert body["explanation"] == ""


def test_analyze_makes_no_llm_call_by_default(client, monkeypatch):
    # The single most important test in this file: the whole point of
    # the two-tier split (docs/adr/0001) is that the default path never
    # touches a model. If this regresses, the analyzer silently starts
    # costing a call again on every request.
    def _boom(*args, **kwargs):
        raise AssertionError("chat() must not be called on the non-deep path")

    monkeypatch.setattr(phrase_module, "chat", _boom)
    response = client.post("/api/phrase/analyze", json={"phrase": "私は学生です。"})
    assert response.status_code == 200


def test_empty_phrase_returns_400(client):
    response = client.post("/api/phrase/analyze", json={"phrase": "   "})
    assert response.status_code == 400


def test_save_false_returns_no_id_and_writes_no_history_row(client):
    phrase = "これはテストの文です。"
    response = client.post("/api/phrase/analyze", json={"phrase": phrase, "save": False})
    assert response.status_code == 200
    body = response.json()
    assert body["id"] is None
    assert body["created_at"] is None

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM phrase_history WHERE phrase = %s", (phrase,))
            (count,) = cur.fetchone()
    finally:
        conn.close()
    assert count == 0


def test_deep_tier_merges_explanation_and_word_meaning(client, monkeypatch):
    def _fake_chat(messages, timeout=30, max_tokens=1200, reasoning=False):
        return (
            '{"words": [{"surface": "私", "base": "私", "reading": "わたし", '
            '"meaning": "I", "pos": "pronoun"}], '
            '"explanation": "A simple self-introduction sentence."}'
        )

    monkeypatch.setattr(phrase_module, "chat", _fake_chat)
    response = client.post(
        "/api/phrase/analyze",
        json={"phrase": "私は学生です。", "deep": True, "lang": "en"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["explanation"] == "A simple self-introduction sentence."
    assert any(t.get("meaning") == "I" for t in body["tokens"])


def test_phrase_key_differs_by_language():
    en_key = phrase_module._phrase_key("私は学生です。", "en")
    fr_key = phrase_module._phrase_key("私は学生です。", "fr")
    assert en_key != fr_key


def test_words_alias_matches_tokens(client):
    response = client.post("/api/phrase/analyze", json={"phrase": "私は学生です。"})
    body = response.json()
    assert body["words"] == body["tokens"]
