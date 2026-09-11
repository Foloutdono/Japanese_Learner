"""
"Warn, then vanish" — what a follower sees when the author deletes.

Three different endings, and the distinction is the whole design:

  unpublish          delists, and changes nothing for existing followers
  delete, followed   WITHDRAWN — gone for the author, kept for the
                     followers until the grace period runs out
  delete, unfollowed plain deletion, as it always was
"""
import pytest

from core.auth import DEV_USER_ID
from core.db import db_conn
from tests.conftest import acting_as

MODE = "standard.flashcard.f2b"


def _sql(sql, params=()):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall() if cur.description else None
    finally:
        conn.close()


@pytest.fixture
def followed(client, other_user, clean_decks):
    with acting_as(other_user):
        made = client.post("/api/decks", json={"name": "Withdraw me", "type": "standard"})
        deck_id = made.json()["id"]
        client.post(f"/api/decks/{deck_id}/cards", json={"front": "会議", "back": "meeting"})
        client.post(f"/api/decks/{deck_id}/publish")
    client.post(f"/api/decks/{deck_id}/subscribe")
    return deck_id


# ── Deleting a deck nobody follows is still a delete ───────────

def test_an_unfollowed_deck_is_deleted_outright(client, clean_decks):
    made = client.post("/api/decks", json={"name": "Alone", "type": "standard"})
    deck_id = made.json()["id"]
    out = client.delete(f"/api/decks/{deck_id}")
    assert out.status_code == 200
    assert out.json()["withdrawn"] is False
    assert not _sql("SELECT 1 FROM decks WHERE id = %s", (deck_id,))


# ── Deleting a followed deck withdraws it ──────────────────────

def test_deleting_a_followed_deck_withdraws_it(client, followed, other_user):
    with acting_as(other_user):
        out = client.delete(f"/api/decks/{followed}")
        assert out.status_code == 200
        assert out.json() == {"ok": True, "withdrawn": True, "followers": 1}
        # For the author it is gone: off the shelf, 404 everywhere.
        assert followed not in [d["id"] for d in client.get("/api/decks").json()["decks"]]
        assert client.get(f"/api/decks/{followed}").status_code == 404

    # The rows are still there — that is what the follower still reads.
    assert _sql("SELECT 1 FROM decks WHERE id = %s", (followed,))


def test_the_follower_keeps_it_and_is_told(client, followed, other_user):
    with acting_as(other_user):
        client.delete(f"/api/decks/{followed}")

    shelf = {d["id"]: d for d in client.get("/api/decks").json()["decks"]}
    assert followed in shelf
    assert shelf[followed]["withdrawn"] is True
    assert shelf[followed]["role"] == "follower"

    deck = client.get(f"/api/decks/{followed}").json()
    assert deck["withdrawn"] is True
    # Still fully readable, which is the point of the grace period:
    # "make it mine" needs something to copy.
    assert client.get(f"/api/decks/{followed}/cards").status_code == 200
    assert client.get(f"/api/decks/{followed}/study", params={"mode": MODE}).status_code == 200


def test_a_withdrawn_deck_can_still_be_made_mine(client, followed, other_user):
    with acting_as(other_user):
        client.delete(f"/api/decks/{followed}")
    out = client.post(f"/api/decks/{followed}/detach")
    assert out.status_code == 200, out.text
    assert out.json()["card_count"] == 1


def test_a_withdrawn_deck_leaves_the_library(client, followed, other_user):
    with acting_as(other_user):
        client.delete(f"/api/decks/{followed}")
    listed = [d["id"] for d in client.get("/api/decks/library").json()["results"]]
    assert followed not in listed


def test_a_withdrawn_deck_cannot_be_newly_followed(client, followed, other_user):
    with acting_as(other_user):
        client.delete(f"/api/decks/{followed}")
    # The one follower who has it keeps it; nobody else may start.
    client.delete(f"/api/decks/{followed}/subscribe")
    assert client.post(f"/api/decks/{followed}/subscribe").status_code == 404


def test_a_withdrawn_deck_frees_its_slot_on_the_authors_shelf(client, followed, other_user):
    """It has left that shelf, so it must not go on occupying a slot on
    it — core/credits.check_deck_limit."""
    from core import credits
    with acting_as(other_user):
        client.delete(f"/api/decks/{followed}")
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM decks WHERE user_id = %s AND withdrawn_at IS NULL",
                (other_user,),
            )
            assert cur.fetchone()[0] == 0
    finally:
        conn.close()


# ── The collector ─────────────────────────────────────────────

def test_prune_withdrawn_reports_without_touching_anything(client, followed, other_user,
                                                           capsys, monkeypatch):
    from scripts import prune_withdrawn
    with acting_as(other_user):
        client.delete(f"/api/decks/{followed}")

    monkeypatch.setattr("sys.argv", ["prune_withdrawn", "--days", "0"])
    assert prune_withdrawn.main() == 0
    assert _sql("SELECT 1 FROM decks WHERE id = %s", (followed,)), "a dry run deleted a deck"


def test_prune_withdrawn_collects_past_the_grace(client, followed, other_user, monkeypatch):
    from scripts import prune_withdrawn
    card_id = client.get(f"/api/decks/{followed}/cards").json()["cards"][0]["id"]
    client.post(f"/api/decks/{followed}/review",
                json={"card_id": f"custom_{followed}_{card_id}", "mode": MODE, "quality": 5})
    follower_key = f"{DEV_USER_ID}:custom_{followed}_{card_id}"
    assert _sql("SELECT 1 FROM card_modes WHERE card_id = %s", (follower_key,))

    with acting_as(other_user):
        client.delete(f"/api/decks/{followed}")

    monkeypatch.setattr("sys.argv", ["prune_withdrawn", "--yes", "--days", "0"])
    assert prune_withdrawn.main() == 0

    assert not _sql("SELECT 1 FROM decks WHERE id = %s", (followed,))
    assert not _sql("SELECT 1 FROM deck_subscriptions WHERE deck_id = %s", (followed,))
    # The follower's scheduler rows go too: nothing foreign-keys them to
    # the deck, so a cascade would never have reached them.
    assert not _sql("SELECT 1 FROM card_modes WHERE card_id = %s", (follower_key,))
    # Their review history stays — it is their XP, not the deck's.
    assert _sql("SELECT 1 FROM review_log WHERE card_id = %s", (follower_key,))


def test_a_deck_inside_its_grace_is_left_alone(client, followed, other_user, monkeypatch):
    from scripts import prune_withdrawn
    with acting_as(other_user):
        client.delete(f"/api/decks/{followed}")
    monkeypatch.setattr("sys.argv", ["prune_withdrawn", "--yes"])   # default 30 days
    assert prune_withdrawn.main() == 0
    assert _sql("SELECT 1 FROM decks WHERE id = %s", (followed,))
