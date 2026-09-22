# ── A saved queue asks before it replays ──────────────────────────
# Every study screen keeps its queue in the browser and used to resume
# it exactly as saved, so a card answered since -- in Today, in another
# section that holds the same card, on another device -- came straight
# back out of it and was reviewed again days early. POST
# /api/today/stale names the saved cards that were answered since and
# are not due yet; the client drops them (hooks/useCardSession.js).
import pytest

from core.auth import get_user_id
from core.db import db_conn
from core.srs_instance import srs
from main import app
from routes.today import MAX_STALE_CHECK

STALE_USER = "stale-check-test-user"
OTHER_USER = "stale-check-other-user"

CARD = "vocab_N5_水_みず"
F2B = "vocab.flashcard.f2b"
B2F = "vocab.flashcard.b2f"


def _wipe(user_id: str) -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM card_first_review WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM cards WHERE id LIKE %s", (f"{user_id}:%",))
        conn.commit()
    finally:
        conn.close()


@pytest.fixture()
def client(client):
    for user in (STALE_USER, OTHER_USER):
        _wipe(user)
    previous = app.dependency_overrides.get(get_user_id)
    app.dependency_overrides[get_user_id] = lambda: STALE_USER
    try:
        yield client
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_user_id, None)
        else:
            app.dependency_overrides[get_user_id] = previous
        for user in (STALE_USER, OTHER_USER):
            _wipe(user)


def _answer(user_id: str, card: str, mode: str, quality: int = 4) -> None:
    srs.review(f"{user_id}:{card}", mode, quality)


def _make_due(user_id: str, card: str, mode: str) -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE card_modes SET next_review = NOW() - INTERVAL '1 minute' "
                "WHERE card_id = %s AND mode = %s",
                (f"{user_id}:{card}", mode),
            )
            assert cur.rowcount == 1
        conn.commit()
    finally:
        conn.close()


def _stale(client, cards):
    r = client.post("/api/today/stale", json={"cards": cards})
    assert r.status_code == 200, r.text
    return r.json()["stale"]


def test_a_card_answered_since_is_stale(client):
    _answer(STALE_USER, CARD, F2B)
    assert _stale(client, [{"card_id": CARD, "mode": F2B}]) == [
        {"card_id": CARD, "mode": F2B},
    ]


def test_a_card_never_answered_is_not(client):
    # A new card is servable: it was new when saved and still is.
    assert _stale(client, [{"card_id": CARD, "mode": F2B}]) == []


def test_a_card_due_again_is_not(client):
    # Answered since, but its next review has come round: a batch would
    # serve it again now, so the saved queue may too.
    _answer(STALE_USER, CARD, F2B)
    _make_due(STALE_USER, CARD, F2B)
    assert _stale(client, [{"card_id": CARD, "mode": F2B}]) == []


def test_the_mode_is_half_the_key(client):
    # 水 answered as a meaning card says nothing about 水 as a reading
    # card: those are two schedules, and the queue may hold both.
    _answer(STALE_USER, CARD, F2B)
    assert _stale(client, [
        {"card_id": CARD, "mode": F2B},
        {"card_id": CARD, "mode": B2F},
    ]) == [{"card_id": CARD, "mode": F2B}]


def test_a_failed_card_waiting_on_its_step_is_stale(client):
    # Answered wrong, it is due again in minutes, not now; the batch
    # would not hand it out yet either.
    _answer(STALE_USER, CARD, F2B, quality=1)
    assert _stale(client, [{"card_id": CARD, "mode": F2B}]) == [
        {"card_id": CARD, "mode": F2B},
    ]


def test_another_learners_rows_are_not_read(client):
    _answer(OTHER_USER, CARD, F2B)
    assert _stale(client, [{"card_id": CARD, "mode": F2B}]) == []
    # Nor by naming them outright: the id is prefixed with the caller's.
    assert _stale(client, [{"card_id": f"{OTHER_USER}:{CARD}", "mode": F2B}]) == []


def test_an_empty_queue_asks_nothing(client):
    assert _stale(client, []) == []


def test_the_list_is_bounded(client):
    cards = [{"card_id": f"c{i}", "mode": F2B} for i in range(MAX_STALE_CHECK + 1)]
    r = client.post("/api/today/stale", json={"cards": cards})
    assert r.status_code == 422
