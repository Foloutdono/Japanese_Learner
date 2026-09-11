"""
The library: publish a deck, follow someone else's.

Two identities throughout — `acting_as` swaps the id behind the same
TestClient (see conftest). The author is OTHER_USER and the reader is
DEV_USER_ID, so "my shelf" in these tests always means DEV_USER_ID's.
"""
import pytest

from core.auth import DEV_USER_ID
from tests.conftest import acting_as


def _deck_with_a_card(client, name="Library test"):
    """A publishable deck owned by whoever is acting: one card in it."""
    made = client.post("/api/decks", json={"name": name, "type": "standard"})
    assert made.status_code == 200, made.text
    deck_id = made.json()["id"]
    added = client.post(f"/api/decks/{deck_id}/cards",
                        json={"front": "会議", "back": "meeting"})
    assert added.status_code == 200, added.text
    return deck_id


@pytest.fixture
def published(client, other_user, clean_decks):
    """A deck owned and published by the OTHER learner."""
    with acting_as(other_user):
        deck_id = _deck_with_a_card(client, "Someone else's deck")
        out = client.post(f"/api/decks/{deck_id}/publish")
        assert out.status_code == 200, out.text
    return deck_id


# ── Publishing ────────────────────────────────────────────────

def test_an_empty_deck_cannot_be_published(client, clean_decks):
    made = client.post("/api/decks", json={"name": "Empty", "type": "standard"})
    deck_id = made.json()["id"]
    out = client.post(f"/api/decks/{deck_id}/publish")
    assert out.status_code == 400
    assert "empty" in out.json()["detail"].lower()


def test_publishing_is_what_puts_a_deck_in_the_library(client, other_user, clean_decks):
    with acting_as(other_user):
        deck_id = _deck_with_a_card(client)

    assert deck_id not in [d["id"] for d in client.get("/api/decks/library").json()["results"]]

    with acting_as(other_user):
        client.post(f"/api/decks/{deck_id}/publish")

    listed = client.get("/api/decks/library").json()["results"]
    row = next(d for d in listed if d["id"] == deck_id)
    assert row["card_count"] == 1
    assert row["followers"] == 0
    assert row["followed"] is False
    # Every learner has a username from first sight, so attribution is
    # never blank.
    assert row["author"]


def test_your_own_decks_are_not_in_your_library(client, clean_decks):
    deck_id = _deck_with_a_card(client, "Mine")
    assert client.post(f"/api/decks/{deck_id}/publish").status_code == 200
    listed = client.get("/api/decks/library").json()["results"]
    assert deck_id not in [d["id"] for d in listed]


def test_republishing_does_not_jump_the_queue(client, published, other_user):
    first = client.get(f"/api/decks/library/{published}").json()["published_at"]
    with acting_as(other_user):
        client.delete(f"/api/decks/{published}/publish")
        client.post(f"/api/decks/{published}/publish")
    assert client.get(f"/api/decks/library/{published}").json()["published_at"] == first


def test_the_library_pages(client, published):
    body = client.get("/api/decks/library", params={"limit": 1}).json()
    assert body["limit"] == 1 and body["page"] == 0
    assert body["has_more"] == (body["total"] > 1)


def test_an_unknown_sort_is_refused(client):
    assert client.get("/api/decks/library", params={"sort": "best"}).status_code == 400


# ── Following ─────────────────────────────────────────────────

def test_following_puts_the_deck_on_the_shelf(client, published):
    assert client.post(f"/api/decks/{published}/subscribe").status_code == 200

    shelf = client.get("/api/decks").json()["decks"]
    row = next(d for d in shelf if d["id"] == published)
    assert row["role"] == "follower"
    assert row["author"]
    assert row["card_count"] == 1


def test_a_deck_you_follow_leaves_the_library(client, published):
    """It is on the shelf now. Listing it again as something to
    discover, on the very screen that already shows it, is noise."""
    assert published in [d["id"] for d in client.get("/api/decks/library").json()["results"]]
    client.post(f"/api/decks/{published}/subscribe")

    body = client.get("/api/decks/library").json()
    assert published not in [d["id"] for d in body["results"]]
    # The tally has to agree with the rows, or paging walks off the end.
    assert body["total"] == len(body["results"])


def test_a_follower_reads_the_authors_cards(client, published):
    client.post(f"/api/decks/{published}/subscribe")
    cards = client.get(f"/api/decks/{published}/cards").json()["cards"]
    assert [c["front"] for c in cards] == ["会議"]


def test_the_authors_later_edits_reach_the_follower(client, published, other_user):
    client.post(f"/api/decks/{published}/subscribe")
    with acting_as(other_user):
        client.post(f"/api/decks/{published}/cards", json={"front": "締切", "back": "deadline"})
    cards = client.get(f"/api/decks/{published}/cards").json()["cards"]
    assert sorted(c["front"] for c in cards) == ["会議", "締切"]


def test_a_follower_may_not_write(client, published):
    client.post(f"/api/decks/{published}/subscribe")
    # 403, not 404: they can see the deck, so "gone" would be a lie —
    # the screen needs to be able to say "make it yours first".
    out = client.post(f"/api/decks/{published}/cards", json={"front": "x", "back": "y"})
    assert out.status_code == 403
    assert client.delete(f"/api/decks/{published}").status_code == 403


def test_following_is_idempotent(client, published):
    assert client.post(f"/api/decks/{published}/subscribe").status_code == 200
    assert client.post(f"/api/decks/{published}/subscribe").status_code == 200
    shelf = [d["id"] for d in client.get("/api/decks").json()["decks"]]
    assert shelf.count(published) == 1


def test_you_cannot_follow_your_own_deck(client, clean_decks):
    deck_id = _deck_with_a_card(client, "Mine")
    client.post(f"/api/decks/{deck_id}/publish")
    assert client.post(f"/api/decks/{deck_id}/subscribe").status_code == 409


def test_unfollowing_takes_it_off_the_shelf_but_keeps_the_progress(client, published):
    client.post(f"/api/decks/{published}/subscribe")
    card_id = client.get(f"/api/decks/{published}/cards").json()["cards"][0]["id"]
    raw = f"custom_{published}_{card_id}"
    assert client.post(f"/api/decks/{published}/review",
                       json={"card_id": raw, "mode": "standard.flashcard.f2b",
                             "quality": 5}).status_code == 200

    assert client.delete(f"/api/decks/{published}/subscribe").status_code == 200
    assert published not in [d["id"] for d in client.get("/api/decks").json()["decks"]]

    # Following again restores it rather than starting the deck over.
    client.post(f"/api/decks/{published}/subscribe")
    stats = client.get(f"/api/decks/{published}/stats",
                       params={"mode": "standard.flashcard.f2b"}).json()
    assert stats["new"] == 0


# ── Unpublishing only delists ─────────────────────────────────

def test_unpublishing_keeps_existing_followers(client, published, other_user):
    client.post(f"/api/decks/{published}/subscribe")
    with acting_as(other_user):
        out = client.delete(f"/api/decks/{published}/publish")
        assert out.json()["followers"] == 1

    assert published not in [d["id"] for d in client.get("/api/decks/library").json()["results"]]
    # ...and nothing changed for the person already following it.
    assert published in [d["id"] for d in client.get("/api/decks").json()["decks"]]
    assert client.get(f"/api/decks/{published}/cards").status_code == 200


def test_an_unpublished_deck_cannot_be_newly_followed(client, published, other_user):
    with acting_as(other_user):
        client.delete(f"/api/decks/{published}/publish")
    assert client.post(f"/api/decks/{published}/subscribe").status_code == 404


# ── Reporting ─────────────────────────────────────────────────

def test_reporting_is_idempotent_and_hides_nothing(client, published):
    assert client.post(f"/api/decks/{published}/report",
                       json={"reason": "spam"}).status_code == 200
    assert client.post(f"/api/decks/{published}/report",
                       json={"reason": "offensive"}).status_code == 200
    # Still listed: a report is a queue for a person, not a mechanism.
    assert published in [d["id"] for d in client.get("/api/decks/library").json()["results"]]


def test_a_reason_outside_the_set_is_refused(client, published):
    assert client.post(f"/api/decks/{published}/report",
                       json={"reason": "I just don't like it"}).status_code == 400


def test_you_cannot_report_your_own_deck(client, clean_decks):
    deck_id = _deck_with_a_card(client, "Mine")
    client.post(f"/api/decks/{deck_id}/publish")
    assert client.post(f"/api/decks/{deck_id}/report",
                       json={"reason": "spam"}).status_code == 400


# ── Renaming and describing ───────────────────────────────────

def test_a_deck_can_be_renamed_and_described(client, clean_decks):
    deck_id = _deck_with_a_card(client, "Before")
    out = client.patch(f"/api/decks/{deck_id}",
                       json={"name": "After", "description": "  Verbs for N3  "})
    assert out.status_code == 200, out.text
    assert out.json()["name"] == "After"
    assert out.json()["description"] == "Verbs for N3"


def test_a_deck_cannot_be_renamed_to_nothing(client, clean_decks):
    deck_id = _deck_with_a_card(client)
    assert client.patch(f"/api/decks/{deck_id}", json={"name": "   "}).status_code == 400
    assert client.patch(f"/api/decks/{deck_id}", json={}).status_code == 400


def test_a_follower_cannot_rename_the_deck(client, published):
    client.post(f"/api/decks/{published}/subscribe")
    assert client.patch(f"/api/decks/{published}", json={"name": "Mine now"}).status_code == 403
