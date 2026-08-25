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


def test_multi_sentence_passage_returns_one_entry_per_sentence(client):
    response = client.post(
        "/api/phrase/analyze",
        json={"phrase": "私は学生です。今日は暑い！明日は?"},
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["sentences"]) == 3
    assert body["sentences"][0]["text"] == "私は学生です。"
    assert body["truncated"] == 0


def test_history_round_trip_reflects_live_srs_state_not_anything_stored(client, monkeypatch):
    # The defect docs/adr/0002 exists to fix: phrase_history no longer
    # stores stats at all (only `phrase` + provenance), so the only way
    # this test can pass is if the GET genuinely recomputes from live
    # SRS state. Force a distinctive value ("mastered") that nothing in
    # the database could possibly have produced on its own.
    phrase = "大学に行きます。"
    post_resp = client.post("/api/phrase/analyze", json={"phrase": phrase})
    assert post_resp.status_code == 200
    entry_id = post_resp.json()["id"]
    assert entry_id is not None

    raw_id = "vocab_N5_大学_だいがく"

    class _FakeSRS:
        def get_user_states(self, user_id):
            return {
                (f"{user_id}:{raw_id}", "vocab.flashcard.f2b"): {
                    "state": "mastered", "total_reviews": 5, "correct_reviews": 5,
                    "interval_days": 30, "due": False, "next_review": None,
                },
            }

    monkeypatch.setattr(phrase_module, "srs", _FakeSRS())
    get_resp = client.get(f"/api/phrase/history/{entry_id}")
    assert get_resp.status_code == 200
    body = get_resp.json()
    daigaku = next(t for t in body["tokens"] if t["surface"] == "大学")
    assert daigaku["vocab_match"]["stats"]["status"] == "mastered"


def test_history_get_makes_no_llm_call(client, monkeypatch):
    phrase = "私は学生です。"
    post_resp = client.post("/api/phrase/analyze", json={"phrase": phrase})
    entry_id = post_resp.json()["id"]

    def _boom(*args, **kwargs):
        raise AssertionError("chat() must not be called when reopening history")

    monkeypatch.setattr(phrase_module, "chat", _boom)
    get_resp = client.get(f"/api/phrase/history/{entry_id}")
    assert get_resp.status_code == 200
