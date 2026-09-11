"""
"Make it mine" — detaching a followed deck into a private copy.

The thing under test is not that the cards are copied (they plainly
are) but that the learner's PROGRESS survives the change of raw id. A
personal card's id embeds its deck, so a copy that only moved the rows
would silently reset a mature deck to new.
"""
import pytest

from core.auth import DEV_USER_ID
from core.db import db_conn
from tests.conftest import acting_as

MODE = "standard.flashcard.f2b"


def _rows(sql, params):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()
    finally:
        conn.close()


@pytest.fixture
def followed(client, other_user, clean_decks):
    """A two-card deck of the other learner's, followed by DEV_USER_ID."""
    with acting_as(other_user):
        made = client.post("/api/decks", json={"name": "Detach me", "type": "standard"})
        deck_id = made.json()["id"]
        for front, back in (("会議", "meeting"), ("締切", "deadline")):
            client.post(f"/api/decks/{deck_id}/cards", json={"front": front, "back": back})
        client.post(f"/api/decks/{deck_id}/publish")
    assert client.post(f"/api/decks/{deck_id}/subscribe").status_code == 200
    return deck_id


def _review_first_card(client, deck_id):
    card = client.get(f"/api/decks/{deck_id}/cards").json()["cards"][0]
    raw = f"custom_{deck_id}_{card['id']}"
    out = client.post(f"/api/decks/{deck_id}/review",
                      json={"card_id": raw, "mode": MODE, "quality": 5})
    assert out.status_code == 200, out.text
    return raw


def test_detaching_makes_a_deck_of_your_own(client, followed):
    out = client.post(f"/api/decks/{followed}/detach")
    assert out.status_code == 200, out.text
    copy = out.json()
    assert copy["id"] != followed
    assert copy["role"] == "owner"
    assert copy["card_count"] == 2
    # The copy is private whatever the original was.
    assert copy["visibility"] == "private"

    shelf = {d["id"]: d for d in client.get("/api/decks").json()["decks"]}
    assert copy["id"] in shelf and shelf[copy["id"]]["role"] == "owner"
    assert followed not in shelf          # the subscription is spent


def test_the_copy_is_editable(client, followed):
    copy = client.post(f"/api/decks/{followed}/detach").json()["id"]
    out = client.post(f"/api/decks/{copy}/cards", json={"front": "予定", "back": "plan"})
    assert out.status_code == 200, out.text


def test_progress_survives_the_change_of_id(client, followed):
    _review_first_card(client, followed)
    before = client.get(f"/api/decks/{followed}/stats", params={"mode": MODE}).json()
    assert before["new"] == 1 and before["total"] == 2

    copy = client.post(f"/api/decks/{followed}/detach").json()["id"]

    after = client.get(f"/api/decks/{copy}/stats", params={"mode": MODE}).json()
    assert after["total"] == 2
    # One card reviewed, one never met — exactly as before the copy. A
    # detach that lost the scheduler rows would report new == 2.
    assert after["new"] == before["new"]
    assert after["learning"] == before["learning"]
    assert after["mastered"] == before["mastered"]


def test_the_old_ids_are_retired(client, followed):
    old_raw = _review_first_card(client, followed)
    old_key = f"{DEV_USER_ID}:{old_raw}"
    assert _rows("SELECT 1 FROM card_modes WHERE card_id = %s", (old_key,))

    client.post(f"/api/decks/{followed}/detach")

    assert not _rows("SELECT 1 FROM card_modes WHERE card_id = %s", (old_key,))
    assert not _rows("SELECT 1 FROM cards WHERE id = %s", (old_key,))
    assert not _rows("SELECT 1 FROM card_first_review WHERE card_id = %s", (old_key,))


def test_the_review_history_is_not_duplicated(client, followed):
    """Lifetime XP is a SUM over review_log. Copying rows would pay the
    learner twice for one review; the old rows stay where they are."""
    old_raw = _review_first_card(client, followed)
    old_key = f"{DEV_USER_ID}:{old_raw}"
    before = _rows("SELECT COUNT(*) FROM review_log WHERE card_id LIKE %s",
                   (f"{DEV_USER_ID}:%",))[0][0]

    client.post(f"/api/decks/{followed}/detach")

    after = _rows("SELECT COUNT(*) FROM review_log WHERE card_id LIKE %s",
                  (f"{DEV_USER_ID}:%",))[0][0]
    assert after == before
    # And the history under the old id is still the learner's own.
    assert _rows("SELECT 1 FROM review_log WHERE card_id = %s", (old_key,))


def test_first_sighting_carries_over(client, followed):
    """get_new_items_today takes MIN over review_log and
    card_first_review per card. Without the copy, every detached card
    counts as met today and spends a slot of the day's new-card pace."""
    old_raw = _review_first_card(client, followed)
    copy = client.post(f"/api/decks/{followed}/detach").json()["id"]

    old_card_id = old_raw.rsplit("_", 1)[1]
    new = _rows(
        "SELECT card_id FROM card_first_review WHERE card_id LIKE %s",
        (f"{DEV_USER_ID}:custom_{copy}_%",),
    )
    assert new, "the copied card has no first-sighting row"


def test_the_author_is_untouched(client, followed, other_user):
    _review_first_card(client, followed)
    client.post(f"/api/decks/{followed}/detach")

    with acting_as(other_user):
        # Their deck is still theirs, still published, still two cards.
        deck = client.get(f"/api/decks/{followed}").json()
        assert deck["role"] == "owner" and deck["card_count"] == 2
        assert deck["followers"] == 0
        # ...and the reader's review never touched the author's state.
        stats = client.get(f"/api/decks/{followed}/stats", params={"mode": MODE}).json()
        assert stats["new"] == 2


def test_you_cannot_detach_your_own_deck(client, clean_decks):
    made = client.post("/api/decks", json={"name": "Mine", "type": "standard"})
    deck_id = made.json()["id"]
    assert client.post(f"/api/decks/{deck_id}/detach").status_code == 400


def test_detaching_twice_is_refused(client, followed):
    assert client.post(f"/api/decks/{followed}/detach").status_code == 200
    # The subscription is spent, so the deck is no longer a reading
    # surface at all.
    assert client.post(f"/api/decks/{followed}/detach").status_code == 404


def test_app_sourced_cards_come_across(client, other_user, clean_decks):
    """Their raw ids are the app's own, so they need no remap — and the
    progress on them was never deck-scoped to begin with."""
    with acting_as(other_user):
        made = client.post("/api/decks", json={"name": "Vocab deck", "type": "vocab"})
        deck_id = made.json()["id"]
        found = client.get(f"/api/decks/{deck_id}/browse",
                           params={"source": "vocab", "level": "N5", "limit": 2}).json()
        refs = [{"source": r["source"], "level": r["level"], "raw_id": r["raw_id"]}
                for r in found["results"][:2]]
        assert refs, "no N5 vocab to browse"
        client.post(f"/api/decks/{deck_id}/cards/app", json={"cards": refs})
        client.post(f"/api/decks/{deck_id}/publish")

    client.post(f"/api/decks/{deck_id}/subscribe")
    copy = client.post(f"/api/decks/{deck_id}/detach").json()["id"]

    mine = client.get(f"/api/decks/{copy}/cards").json()["cards"]
    assert {c["raw_id"] for c in mine} == {r["raw_id"] for r in refs}
