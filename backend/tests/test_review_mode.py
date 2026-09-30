"""The section review endpoints refuse a mode that is not their own.

/api/today/review validated the mode from the start, and every card,
cards and stats endpoint takes require_mode; the three section review
POSTs took `mode` as a bare string straight into srs.review. A key they
do not grade -- a typo, another section's key -- was scheduled under
that key (a card_modes row nothing reads), logged to review_log (XP,
the streak) and charged a fare. They now 400 before the scheduler, as
routes/decks.py's per-source checks do, and a rejected review is not a
ride: nothing is written and nothing is charged.
"""
import pytest

from core import credits
from core.auth import DEV_USER_ID
from core.db import db_conn

ENDPOINTS = [
    # (path, a card id of the section, its own graded mode)
    ("/api/kana/review", "kana_あ", "kana.flashcard.f2b"),
    ("/api/kanji/review", "kanji_N5_水", "kanji.flashcard.f2b"),
    ("/api/vocab/review", "probe_review_mode", "vocab.flashcard.f2b"),
]


def _mode_rows(card_id: str, mode: str) -> tuple[int, int]:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            full = f"{DEV_USER_ID}:{card_id}"
            cur.execute("SELECT COUNT(*) FROM card_modes WHERE card_id = %s AND mode = %s", (full, mode))
            (modes,) = cur.fetchone()
            cur.execute("SELECT COUNT(*) FROM review_log WHERE card_id = %s AND mode = %s", (full, mode))
            (logged,) = cur.fetchone()
        return modes, logged
    finally:
        conn.close()


@pytest.mark.parametrize("path,card_id,own", ENDPOINTS)
@pytest.mark.parametrize("bad", ["banana", "grammar.fill_in"])
def test_a_mode_the_section_does_not_grade_is_refused(client, path, card_id, own, bad):
    before = credits.read_fresh(DEV_USER_ID)["balance"]
    r = client.post(path, json={"card_id": card_id, "mode": bad, "quality": 4})
    assert r.status_code == 400
    assert _mode_rows(card_id, bad) == (0, 0)
    assert credits.read_fresh(DEV_USER_ID)["balance"] == before


@pytest.mark.parametrize("path,card_id,own", ENDPOINTS)
def test_another_sections_mode_is_refused(client, path, card_id, own):
    other = next(o for p, _c, o in ENDPOINTS if p != path)
    r = client.post(path, json={"card_id": card_id, "mode": other, "quality": 4})
    assert r.status_code == 400
    assert _mode_rows(card_id, other) == (0, 0)


@pytest.mark.parametrize("path,card_id,own", ENDPOINTS)
def test_the_sections_own_mode_is_still_reviewed(client, path, card_id, own):
    r = client.post(path, json={"card_id": card_id, "mode": own, "quality": 4})
    assert r.status_code == 200
    assert _mode_rows(card_id, own)[0] == 1
