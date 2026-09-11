"""
A followed deck feeds the daily queue like any other.

_personal_rows used to ask for "every personal card this user owns". A
followed deck's cards are the AUTHOR's rows, so without the change they
were invisible here — the deck sat on the shelf, was studiable from its
own screen, and never once appeared in 本日.
"""
import pytest

from core.auth import DEV_USER_ID
from core.db import db_conn
from study import daily_queue
from tests.conftest import acting_as

MODE = "standard.flashcard.f2b"


def _make_due(card_key: str) -> None:
    """Pull a scheduler row back into the past, so the queue sees it."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE card_modes SET next_review = NOW() - INTERVAL '1 day' "
                "WHERE card_id = %s",
                (card_key,),
            )
            assert cur.rowcount, "no scheduler row to make due"
        conn.commit()
    finally:
        conn.close()


@pytest.fixture
def followed(client, other_user, clean_decks):
    with acting_as(other_user):
        made = client.post("/api/decks", json={"name": "Their N3 verbs", "type": "standard"})
        deck_id = made.json()["id"]
        client.post(f"/api/decks/{deck_id}/cards", json={"front": "会議", "back": "meeting"})
        client.post(f"/api/decks/{deck_id}/publish")
    client.post(f"/api/decks/{deck_id}/subscribe")
    return deck_id


def _due_card(client, deck_id):
    card_id = client.get(f"/api/decks/{deck_id}/cards").json()["cards"][0]["id"]
    raw = f"custom_{deck_id}_{card_id}"
    client.post(f"/api/decks/{deck_id}/review",
                json={"card_id": raw, "mode": MODE, "quality": 5})
    _make_due(f"{DEV_USER_ID}:{raw}")
    return raw


def test_a_followed_decks_card_reaches_today(client, followed):
    raw = _due_card(client, followed)

    body = client.get("/api/today").json()
    assert body["by_source"].get("personal", 0) >= 1

    served = client.get("/api/today/cards", params={"count": 20}).json()["cards"]
    assert raw in [c["card_id"] for c in served]


def test_the_lane_is_named_after_the_authors_deck(client, followed):
    """The queue says which deck a card came from, and for a followed
    deck that name is the author's — the learner has to recognise it."""
    _due_card(client, followed)
    lanes = client.get("/api/today").json()["lanes"]
    personal = [lane for lane in lanes if lane["kind"] == daily_queue.PERSONAL]
    assert [lane["deck_name"] for lane in personal] == ["Their N3 verbs"]
    assert personal[0]["deck_id"] == followed


def test_unfollowing_takes_the_card_out_of_the_queue(client, followed):
    raw = _due_card(client, followed)
    assert raw in [c["card_id"] for c in
                   client.get("/api/today/cards", params={"count": 20}).json()["cards"]]

    client.delete(f"/api/decks/{followed}/subscribe")

    # The scheduler row is deliberately kept (re-following restores it),
    # so this is exactly the case where the queue must filter by the
    # SHELF rather than by what has a row.
    served = client.get("/api/today/cards", params={"count": 20}).json()["cards"]
    assert raw not in [c["card_id"] for c in served]
    assert client.get("/api/today").json()["by_source"].get("personal", 0) == 0


def test_the_author_does_not_inherit_the_followers_progress(client, followed, other_user):
    _due_card(client, followed)
    with acting_as(other_user):
        assert client.get("/api/today").json()["by_source"].get("personal", 0) == 0
