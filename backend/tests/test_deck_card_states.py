"""
A deck's cards carry their state (plan 154).

The deck's page on the desk counts its cards as four figures -- due,
new, learning, mastered -- and captions each card with its own. Those
are the viewer's standing, merged over the deck's modes the way the
dictionary merges them (card_lookup.card_stats): due if any mode wants
the card now, else the furthest stage any mode has reached. The four
partition the deck, so the figures add up to its card count.
"""
import pytest

from core.auth import DEV_USER_ID
from core.db import db_conn
from core.srs_instance import srs
from tests.conftest import acting_as

MODE = "standard.flashcard.f2b"
OTHER_MODE = "standard.flashcard.b2f"


@pytest.fixture
def deck(client):
    made = client.post("/api/decks", json={"name": "States", "type": "standard"})
    assert made.status_code == 200, made.text
    deck_id = made.json()["id"]
    for front, back in (("駅", "gare"), ("切符", "billet"), ("電車", "train"), ("改札", "portillon")):
        added = client.post(f"/api/decks/{deck_id}/cards", json={"front": front, "back": back})
        assert added.status_code == 200, added.text
    yield deck_id
    client.delete(f"/api/decks/{deck_id}")


def _set(card_key: str, mode: str, sql: str) -> None:
    """Rewrite one scheduler row, which a review has just made."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE card_modes SET {sql} WHERE card_id = %s AND mode = %s", (card_key, mode))
            assert cur.rowcount == 1, "no scheduler row to set"
        conn.commit()
    finally:
        conn.close()


def _states(client, deck_id):
    cards = client.get(f"/api/decks/{deck_id}/cards").json()["cards"]
    return [c["state"] for c in cards]


def test_a_fresh_deck_is_all_new(client, deck):
    assert _states(client, deck) == ["new"] * 4


def test_each_card_carries_its_standing_merged_over_the_modes(client, deck):
    cards = client.get(f"/api/decks/{deck}/cards").json()["cards"]
    key = lambda c: f"{DEV_USER_ID}:custom_{deck}_{c['id']}"
    for card in cards[:3]:
        srs.review(key(card), MODE, 4)
    # Learning: a few days out.
    _set(key(cards[0]), MODE, "interval_days = 4, next_review = NOW() + INTERVAL '4 days'")
    # Mastered in one mode and new in the other: the furthest wins.
    _set(key(cards[1]), MODE, "interval_days = 30, next_review = NOW() + INTERVAL '30 days'")
    # Mastered in one mode but wanted now in another: due wins.
    _set(key(cards[2]), MODE, "interval_days = 30, next_review = NOW() + INTERVAL '30 days'")
    srs.review(key(cards[2]), OTHER_MODE, 4)
    _set(key(cards[2]), OTHER_MODE, "next_review = NOW() - INTERVAL '1 hour'")

    assert _states(client, deck) == ["learning", "mastered", "due", "new"]


def test_a_follower_reads_their_own_standing_not_the_authors(client, deck, other_user):
    published = client.post(f"/api/decks/{deck}/publish")
    assert published.status_code == 200, published.text
    cards = client.get(f"/api/decks/{deck}/cards").json()["cards"]
    srs.review(f"{DEV_USER_ID}:custom_{deck}_{cards[0]['id']}", MODE, 4)
    with acting_as(other_user):
        assert client.post(f"/api/decks/{deck}/subscribe").status_code == 200
        try:
            assert _states(client, deck) == ["new"] * 4
        finally:
            client.delete(f"/api/decks/{deck}/subscribe")
    assert _states(client, deck)[0] == "learning"
