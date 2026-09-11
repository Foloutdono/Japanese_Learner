"""
Who may see what — the DeckAccess resolver, at the edges.

Two of these pin bugs the resolver closed rather than behaviour it
added: a non-numeric deck id used to reach Postgres unconverted and come
back a 500, and a leading zero used to open a whole second SRS track for
the same deck.
"""
import pytest

from tests.conftest import acting_as

MODE = "standard.flashcard.f2b"


@pytest.fixture
def mine(client, clean_decks):
    made = client.post("/api/decks", json={"name": "Mine", "type": "standard"})
    deck_id = made.json()["id"]
    client.post(f"/api/decks/{deck_id}/cards", json={"front": "会議", "back": "meeting"})
    return deck_id


@pytest.fixture
def theirs_private(client, other_user, clean_decks):
    with acting_as(other_user):
        made = client.post("/api/decks", json={"name": "Theirs", "type": "standard"})
        deck_id = made.json()["id"]
        client.post(f"/api/decks/{deck_id}/cards", json={"front": "秘密", "back": "secret"})
    return deck_id


@pytest.fixture
def theirs_public(client, other_user, theirs_private):
    with acting_as(other_user):
        client.post(f"/api/decks/{theirs_private}/publish")
    return theirs_private


# ── A deck id is a bigint ─────────────────────────────────────

@pytest.mark.parametrize("path", [
    "/api/decks/not-a-number",
    "/api/decks/not-a-number/cards",
    "/api/decks/not-a-number/export",
    "/api/decks/not-a-number/stats",
])
def test_a_non_numeric_deck_id_is_not_found_rather_than_a_crash(client, path):
    # This used to be a 500 app-wide: the path segment went straight to
    # a bigint column and raised out of the driver. It also meant a
    # literal route declared in the wrong order failed loudly instead of
    # harmlessly — see get_structures' comment.
    assert client.get(path).status_code == 404


def test_a_leading_zero_is_the_same_deck(client, mine):
    """Postgres casts '042' to 42, so the deck was found — while the raw
    ids were built from the STRING, giving `custom_042_7`: a second,
    invisible SRS track for the same deck, reachable by typing a zero."""
    plain = client.get(f"/api/decks/{mine}/study", params={"mode": MODE, "count": 5})
    padded = client.get(f"/api/decks/0{mine}/study", params={"mode": MODE, "count": 5})
    assert plain.status_code == 200 and padded.status_code == 200
    assert [c["card_id"] for c in plain.json()["cards"]] == \
           [c["card_id"] for c in padded.json()["cards"]]
    assert f"custom_{mine}_" in plain.json()["cards"][0]["card_id"]


# ── A private deck is not merely refused, it is absent ────────

@pytest.mark.parametrize("suffix", ["", "/cards", "/modes", "/stats", "/export"])
def test_someone_elses_private_deck_is_not_found(client, theirs_private, suffix):
    # 404 and not 403: whether a private deck exists is its author's
    # business, and a 403 would answer that question.
    assert client.get(f"/api/decks/{theirs_private}{suffix}").status_code == 404


def test_a_published_deck_shows_its_cover_but_not_its_cards(client, theirs_public):
    # PUBLIC — the pre-follow preview answers to anyone...
    deck = client.get(f"/api/decks/{theirs_public}")
    assert deck.status_code == 200
    assert deck.json()["role"] == "visitor"
    assert deck.json()["author"]

    # ...but browsing the library is not studying from it. Following is
    # the act that puts a deck on your shelf.
    assert client.get(f"/api/decks/{theirs_public}/cards").status_code == 404
    assert client.get(f"/api/decks/{theirs_public}/study",
                      params={"mode": MODE}).status_code == 404


def test_the_library_page_previews_the_cards(client, theirs_public):
    """The one place a visitor does see cards — enough to judge the deck
    by, sliced from the same listing the deck screen uses."""
    body = client.get(f"/api/decks/library/{theirs_public}").json()
    assert body["followed"] is False
    assert [c["front"] for c in body["preview"]] == ["秘密"]


def test_a_private_deck_has_no_library_page(client, theirs_private):
    assert client.get(f"/api/decks/library/{theirs_private}").status_code == 404


# ── A follower reads, and is told so plainly when they write ──

@pytest.mark.parametrize("method,path,body", [
    ("post",   "/cards",      {"front": "x", "back": "y"}),
    ("post",   "/cards/app",  {"cards": []}),
    ("patch",  "",            {"name": "Mine now"}),
    ("delete", "",            None),
])
def test_a_follower_is_refused_writes_with_403(client, theirs_public, method, path, body):
    client.post(f"/api/decks/{theirs_public}/subscribe")
    call = getattr(client, method)
    url = f"/api/decks/{theirs_public}{path}"
    out = call(url, json=body) if body is not None else call(url)
    assert out.status_code == 403, out.text


def test_a_visitor_may_not_review_against_a_deck_they_do_not_follow(client, theirs_public):
    out = client.post(f"/api/decks/{theirs_public}/review",
                      json={"card_id": "custom_1_1", "mode": MODE, "quality": 5})
    assert out.status_code == 404
