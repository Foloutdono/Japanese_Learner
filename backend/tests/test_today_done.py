# ── 済 — the gate with nothing due draws the day it closed (plan 199) ──
# The Today redesign's dial, when the queue is empty, is the day's ring:
# what was reviewed today, by line, round the day's stamp, with what
# tomorrow brings under it. /api/today carries both, and only then.
from datetime import datetime, timedelta, timezone

from core.db import db_conn
from core.srs_instance import srs

from tests.test_today_ration import RATION_USER, client  # noqa: F401  (fixture)


def _log(user_id, rows):
    """review_log rows: (card suffix, mode, when)."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for card, mode, at in rows:
                cur.execute(
                    "INSERT INTO review_log (card_id, mode, quality, reviewed_at) VALUES (%s, %s, 4, %s)",
                    (f"{user_id}:{card}", mode, at),
                )
        conn.commit()
    finally:
        conn.close()


def test_today_s_reviews_are_counted_by_the_line_their_mode_names(client):  # noqa: F811
    now = datetime.now(timezone.utc)
    _log(RATION_USER, [
        ("vocab_N5_a_a", "vocab.flashcard.f2b", now),
        ("vocab_N5_b_b", "vocab.word_reading", now),
        ("kanji_N5_x", "kanji.flashcard.f2b", now),
        ("kana_a", "kana.flashcard.f2b", now),
        # Yesterday's is not today's.
        ("vocab_N5_c_c", "vocab.flashcard.f2b", now - timedelta(days=1, hours=1)),
    ])
    assert srs.get_reviews_today_by_line(RATION_USER) == {
        "total": 4, "by_line": {"kana": 1, "vocab": 2, "kanji": 1},
    }


def test_an_empty_gate_carries_the_day_and_tomorrow(client):  # noqa: F811
    _log(RATION_USER, [("grammar_N5_x", "grammar.ladder", datetime.now(timezone.utc))])
    today = client.get("/api/today").json()
    assert today["total"] == 0
    assert today["reviewed"] == {"total": 1, "by_line": {"grammar": 1}}
    assert set(today["tomorrow"]) == {"cards", "minutes"}


def test_a_gate_with_cards_due_carries_neither(client):  # noqa: F811
    r = client.post("/api/onboarding/complete", json={
        "jlptLevel": "N5", "dailyNewTarget": 3, "kanaKnown": "both", "lines": ["vocab"],
    })
    assert r.status_code == 200, r.text
    today = client.get("/api/today").json()
    assert today["total"] > 0
    assert "reviewed" not in today and "tomorrow" not in today
