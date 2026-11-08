"""
A block reaches the library (plan 310).

The duels' block says "you will no longer find each other", and the
library keeps it: across a block, neither learner finds the other's
decks in the list, its search, its type chips, À la une, Abonnements,
a deck's page or a 番付 card, and the block ends the follows between
the two as it ends their friendship. A report still reaches past it.

A is DEV_USER_ID, the reader; B is OTHER_USER, an author.
"""
import pytest

from tests.conftest import acting_as
from tests.pvp_world import A, B, learners, sql  # noqa: F401


def _published(client, name, structure="kanji"):
    card = {"fields": {"kanji": "会", "meaning": "meeting",
                       "readings": {"on": ["カイ"], "kun": ["あ.う"]}, "radical": 9}}
    deck_id = client.post("/api/decks", json={"name": name, "type": structure}).json()["id"]
    assert client.post(f"/api/decks/{deck_id}/cards", json=card).status_code == 200
    assert client.post(f"/api/decks/{deck_id}/publish").status_code == 200
    return deck_id


@pytest.fixture
def authors_deck(client, learners, clean_decks):
    with acting_as(B):
        return _published(client, "Kanji du bureau, plan 310")


def _found(client, deck_id) -> dict:
    """Where the reader finds a deck in the library."""
    library = client.get("/api/decks/library", params={"limit": 100}).json()
    searched = client.get("/api/decks/library", params={"q": "plan 310", "limit": 100}).json()
    home = client.get("/api/decks/library/home").json()
    return {
        "list": deck_id in [d["id"] for d in library["results"]],
        "search": deck_id in [d["id"] for d in searched["results"]],
        "types": "kanji" in library["types"],
        "featured": (home["featured"] or {}).get("id") == deck_id,
        "following": deck_id in [d["id"] for d in home["following"]],
        "page": client.get(f"/api/decks/library/{deck_id}").status_code == 200,
    }


def _block(client, by: str, whom: str, names: dict) -> None:
    with acting_as(by):
        assert client.post("/api/pvp/blocks", json={"username": names[whom]}).status_code == 200


def test_the_blocker_no_longer_finds_the_blocked_learners_decks(client, learners, authors_deck):
    seen = _found(client, authors_deck)
    assert seen["list"] and seen["search"] and seen["page"]
    _block(client, A, B, learners)
    gone = _found(client, authors_deck)
    assert not any(gone.values()), gone
    # Nor can it be followed by its id.
    assert client.post(f"/api/decks/{authors_deck}/subscribe").status_code == 404
    # The count is the list's, so a page never prints a tally it cannot show.
    library = client.get("/api/decks/library", params={"q": "plan 310"}).json()
    assert library["total"] == 0


def test_the_blocked_learner_no_longer_finds_the_blockers_decks(client, learners, authors_deck):
    """Both ways: the block is B's here, and A is the one who loses B."""
    _block(client, B, A, learners)
    assert not any(_found(client, authors_deck).values())


def test_unblocking_puts_the_decks_back(client, learners, authors_deck):
    _block(client, A, B, learners)
    assert client.delete(f"/api/pvp/blocks/{learners[B]}").status_code == 200
    back = _found(client, authors_deck)
    assert back["list"] and back["search"] and back["page"] and back["types"]


def test_a_block_ends_the_follows_between_the_two(client, learners, authors_deck):
    mine = _published(client, "Mes kanji, plan 310")
    assert client.post(f"/api/decks/{authors_deck}/subscribe").status_code == 200
    with acting_as(B):
        assert client.post(f"/api/decks/{mine}/subscribe").status_code == 200
    assert _found(client, authors_deck)["following"]

    _block(client, A, B, learners)
    follows = sql("SELECT deck_id, user_id FROM deck_subscriptions WHERE deck_id = ANY(%s)",
                  ([authors_deck, mine],), fetch=True)
    assert follows == []
    # Gone from the shelf too, not only from the library.
    assert authors_deck not in [d["id"] for d in client.get("/api/decks").json()["decks"]]
    assert not _found(client, authors_deck)["following"]


def test_a_follow_a_block_made_before_kept_is_kept_out_of_the_library(client, learners, authors_deck):
    """A block written before this plan ended no follow: Abonnements
    keeps it out all the same."""
    assert client.post(f"/api/decks/{authors_deck}/subscribe").status_code == 200
    sql("INSERT INTO pvp_blocks (user_id, blocked_id) VALUES (%s, %s)", (A, B))
    found = _found(client, authors_deck)
    assert not found["following"] and not found["page"]


def test_a_deck_across_a_block_can_still_be_reported(client, learners, authors_deck):
    _block(client, A, B, learners)
    out = client.post(f"/api/decks/{authors_deck}/report", json={"reason": "offensive"})
    assert out.status_code == 200, out.text


def test_a_block_leaves_everyone_elses_library_alone(client, learners, authors_deck):
    """Only the two: C, a third learner, still finds B's deck."""
    from tests.pvp_world import C
    _block(client, A, B, learners)
    with acting_as(C):
        assert authors_deck in [d["id"] for d in client.get(
            "/api/decks/library", params={"limit": 100}).json()["results"]]


def test_the_board_card_shows_no_deck_across_a_block(client, learners, authors_deck):
    from study import banzuke
    banzuke._cache.clear()   # the roster is read a minute old at most
    card = client.get(f"/api/leaderboard/learner/{learners[B]}")
    assert card.status_code == 200, card.text
    assert authors_deck in [d["id"] for d in card.json()["decks"]]
    _block(client, A, B, learners)
    assert client.get(f"/api/leaderboard/learner/{learners[B]}").json()["decks"] == []
