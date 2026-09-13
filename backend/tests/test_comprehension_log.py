# 読解 — the comprehension endpoint, where the exercise meets the SRS
# and the log (plan 084). Needs the database; the generator itself is
# exercised without one in test_comprehension.py.
import json

import pytest

from core.auth import DEV_USER_ID
from core.db import db_conn
from routes import reading
from tests.test_comprehension import _reply, MASHITA, SENTENCE_1


@pytest.fixture
def served(monkeypatch):
    """The endpoint with its one network call stubbed and its seeds
    pinned: the text is the fixture's, written around 〜ました."""
    monkeypatch.setattr(reading, "llm_configured", lambda: True)
    monkeypatch.setattr(reading, "_chat", lambda messages, *a, **kw: _reply())
    monkeypatch.setattr(reading, "_pick_grammar_seeds", lambda *a, **kw: [MASHITA])
    monkeypatch.setattr(reading, "_pick_word_seeds", lambda *a, **kw: [])


@pytest.fixture
def clean_log():
    yield
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM comprehension_log WHERE user_id = %s", (DEV_USER_ID,))
        conn.commit()
    finally:
        conn.close()


def test_each_sentence_carries_its_analysis(client, served):
    r = client.get("/api/reading/comprehension?level=N5&lang=en")
    assert r.status_code == 200, r.text
    body = r.json()

    assert [p["pattern"] for p in body["grammar_points"]] == [MASHITA["pattern"]]

    first = body["breakdown"][0]
    assert first["jp"] == SENTENCE_1
    # The raw word list is not sent; the analysis carries the glosses.
    assert "words" not in first
    analysis = first["analysis"]
    assert analysis["available"] is True
    assert "".join(t["surface"] for t in analysis["tokens"]) == SENTENCE_1

    eki = next(t for t in analysis["tokens"] if t["surface"] == "駅")
    assert eki["furigana"][0]["reading"] == "えき"
    assert eki["meaning"] == "station"
    assert eki["vocab_match"]["stats"]["status"] in ("not_started", "new", "learning", "mastered")

    # 会いました is one word to the model and three morphemes to the
    # tokenizer; the gloss lands on the first with the run's extent.
    ai = next(t for t in analysis["tokens"] if t["surface"] == "会い")
    assert ai["meaning"] == "met"
    assert analysis["tokens"][ai["span_end"]]["surface"] == "た"

    assert isinstance(analysis["unknown_count"], int)
    assert any(g["pattern"] == MASHITA["pattern"] for g in analysis["grammar"])


def test_the_result_records_the_seeded_grammar(client, clean_log):
    payload = {
        "level": "N5",
        "text": SENTENCE_1,
        "translation": "I met a friend at the station.",
        "questions": [{"question": "q", "options": ["a", "b", "c", "d"], "correct": 0}],
        "answers": [0],
        "breakdown": [{"jp": SENTENCE_1, "translation": "", "note": ""}],
        "grammar_points": ["〜てから", "〜ました／〜ませんでした"],
    }
    r = client.post("/api/reading/comprehension/result", json=payload)
    assert r.status_code == 200, r.text
    assert r.json()["score"] == 1

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT grammar FROM comprehension_log WHERE id = %s", (r.json()["id"],))
            (grammar,) = cur.fetchone()
    finally:
        conn.close()
    assert grammar == ["〜てから", "〜ました／〜ませんでした"]

    recent = reading._recent_grammar_patterns(DEV_USER_ID)
    assert "〜てから" in recent and "〜ました／〜ませんでした" in recent


def test_an_older_client_that_sends_no_grammar_still_posts(client, clean_log):
    payload = {
        "level": "N5",
        "text": SENTENCE_1,
        "translation": "x",
        "questions": [{"question": "q", "options": ["a", "b", "c", "d"], "correct": 1}],
        "answers": [0],
    }
    r = client.post("/api/reading/comprehension/result", json=payload)
    assert r.status_code == 200, r.text
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT grammar FROM comprehension_log WHERE id = %s", (r.json()["id"],))
            (grammar,) = cur.fetchone()
    finally:
        conn.close()
    assert grammar is None
    # Nothing read back from a row with no seeds.
    assert isinstance(reading._recent_grammar_patterns(DEV_USER_ID), set)
