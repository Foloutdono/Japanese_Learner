"""
The filter at the library's door, and at the username's (plan 310).

What another learner reads is read by core/content_filter.py first: a
deck when it is published, any write to a deck another learner already
reads, and a username. A private deck is the learner's own notebook.
A refusal is a code with the field it was found in, never the text.
"""
import pytest

from core.auth import DEV_USER_ID
from core.db import db_conn
from tests.conftest import acting_as

SLUR = "ニガー"           # refused everywhere
VULGAR = "Fuck"           # refused in a name, let through on a card


def _deck(client, name="Shitamachi no kotoba", cards=({"front": "下町", "back": "shitamachi"},)):
    made = client.post("/api/decks", json={"name": name, "type": "standard"})
    assert made.status_code == 200, made.text
    deck_id = made.json()["id"]
    for card in cards:
        out = client.post(f"/api/decks/{deck_id}/cards", json=card)
        assert out.status_code == 200, out.text
    return deck_id


def _refused(out, field, word):
    assert out.status_code == 422, out.text
    detail = out.json()["detail"]
    assert detail["code"] == "content_refused"
    assert detail["field"] == field
    # The refusal names the field, never what was in it.
    assert word not in out.text
    return detail


# ── Publishing ────────────────────────────────────────────────

def test_an_ordinary_deck_is_published(client, clean_decks):
    """Romaji, Japanese, and a card that says what くそ means."""
    deck_id = _deck(client, cards=(
        {"front": "下町", "back": "shitamachi — the old downtown"},
        {"front": "くそ", "back": "shit; damn"},
        {"front": "ガイジン", "back": "foreigner"},
    ))
    out = client.post(f"/api/decks/{deck_id}/publish")
    assert out.status_code == 200, out.text
    assert out.json()["visibility"] == "public"


def test_a_name_the_filter_refuses_is_not_published(client, clean_decks):
    deck_id = _deck(client, name=f"{VULGAR} kanji")
    _refused(client.post(f"/api/decks/{deck_id}/publish"), "name", VULGAR)
    assert client.get(f"/api/decks/{deck_id}").json()["visibility"] == "private"


def test_a_description_the_filter_refuses_is_not_published(client, clean_decks):
    deck_id = _deck(client)
    # Private, so the learner may write it; publishing reads it.
    assert client.patch(f"/api/decks/{deck_id}",
                        json={"description": f"Words for {VULGAR.lower()}ing around"}).status_code == 200
    _refused(client.post(f"/api/decks/{deck_id}/publish"), "description", VULGAR.lower())


def test_a_card_the_filter_refuses_is_named_and_the_deck_not_published(client, clean_decks):
    deck_id = _deck(client)
    bad = client.post(f"/api/decks/{deck_id}/cards", json={"front": SLUR, "back": "a word"})
    # Private: the notebook is the learner's own.
    assert bad.status_code == 200, bad.text
    detail = _refused(client.post(f"/api/decks/{deck_id}/publish"), "card", SLUR)
    assert detail["card_id"] == bad.json()["id"]


def test_a_cards_notes_are_read_too(client, clean_decks):
    deck_id = _deck(client, cards=({"front": "会議", "back": "meeting", "notes": SLUR},))
    _refused(client.post(f"/api/decks/{deck_id}/publish"), "card", SLUR)


# ── Writing to a deck another learner reads ───────────────────

@pytest.fixture
def mine_published(client, clean_decks):
    deck_id = _deck(client)
    assert client.post(f"/api/decks/{deck_id}/publish").status_code == 200
    return deck_id


def test_a_card_added_to_a_published_deck_is_read(client, mine_published):
    _refused(client.post(f"/api/decks/{mine_published}/cards",
                         json={"front": "会議", "back": SLUR}), "card", SLUR)
    # A vulgar gloss is a card's to give.
    assert client.post(f"/api/decks/{mine_published}/cards",
                       json={"front": "くそ", "back": "shit"}).status_code == 200


def test_a_card_edited_on_a_published_deck_is_read(client, mine_published):
    card = next(c for c in client.get(f"/api/decks/{mine_published}/cards").json()["cards"]
                if c.get("origin") == "custom")
    detail = _refused(client.put(f"/api/decks/{mine_published}/cards/{card['id']}",
                                 json={"front": "下町", "back": SLUR}), "card", SLUR)
    assert detail["card_id"] == card["id"]


def test_a_batch_lands_what_passes_and_names_what_does_not(client, mine_published):
    out = client.post(f"/api/decks/{mine_published}/cards/batch", json={"cards": [
        {"front": "会議", "back": "meeting"},
        {"front": SLUR, "back": "a word"},
        {"front": "電話", "back": "telephone"},
    ]})
    assert out.status_code == 200, out.text
    body = out.json()
    assert body["inserted"] == 2
    assert body["errors"] == [{"index": 1, "code": "content_refused"}]


def test_a_csv_on_a_published_deck_skips_what_is_refused(client, mine_published):
    csv = f"front,back\n会議,meeting\n{SLUR},a word\n".encode()
    out = client.post(f"/api/decks/{mine_published}/import",
                      files={"file": ("cards.csv", csv, "text/csv")})
    assert out.status_code == 200, out.text
    assert out.json()["inserted"] == 1
    assert len(out.json()["errors"]) == 1


def test_renaming_a_published_deck_is_read(client, mine_published):
    _refused(client.patch(f"/api/decks/{mine_published}", json={"name": f"{VULGAR} it"}),
             "name", VULGAR)
    _refused(client.patch(f"/api/decks/{mine_published}", json={"description": SLUR}),
             "description", SLUR)
    assert client.patch(f"/api/decks/{mine_published}",
                        json={"name": "Pique-nique au parc"}).status_code == 200


def test_a_deck_taken_out_of_the_library_is_still_read_while_followed(client, other_user, clean_decks):
    """Unpublishing delists, and the followers go on reading it."""
    deck_id = _deck(client)
    client.post(f"/api/decks/{deck_id}/publish")
    with acting_as(other_user):
        assert client.post(f"/api/decks/{deck_id}/subscribe").status_code == 200
    client.delete(f"/api/decks/{deck_id}/publish")
    _refused(client.post(f"/api/decks/{deck_id}/cards", json={"front": SLUR, "back": "x"}),
             "card", SLUR)
    with acting_as(other_user):
        client.delete(f"/api/decks/{deck_id}/subscribe")
    # Nobody reads it now: the notebook is the learner's again.
    assert client.post(f"/api/decks/{deck_id}/cards",
                       json={"front": SLUR, "back": "x"}).status_code == 200


# ── The username ──────────────────────────────────────────────

@pytest.fixture
def own_username(client):
    before = client.get("/api/profile").json()["username"]
    yield before
    client.patch("/api/profile", json={"username": before})


def test_a_username_the_filter_refuses_is_not_taken(client, own_username):
    for handle in ("Fuck_you", "BigShit", "f_u_c_k", "Puta99"):
        _refused(client.patch("/api/profile", json={"username": handle}), "username", handle)
    assert client.get("/api/profile").json()["username"] == own_username


def test_an_ordinary_username_is_taken(client, own_username):
    out = client.patch("/api/profile", json={"username": "ShitaMachi_310"})
    assert out.status_code == 200, out.text
    assert out.json()["username"] == "ShitaMachi_310"


def test_a_card_name_is_the_learners_own_and_not_read(client, own_username):
    """The card's name is printed on the learner's own card alone."""
    before = client.get("/api/profile").json().get("cardName")
    try:
        assert client.patch("/api/profile", json={"cardName": "Fuck"}).status_code == 200
    finally:
        client.patch("/api/profile", json={"cardName": before or ""})


@pytest.fixture
def drawn():
    """A learner whose handle is the one the app drew."""
    user_id = "test-content-filter-drawn"
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO user_profiles(user_id, username) VALUES (%s, %s) "
                        "ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username",
                        (user_id, "QuietTsuki3104"))
        conn.commit()
        yield user_id
    finally:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM user_profiles WHERE user_id = %s", (user_id,))
        conn.commit()
        conn.close()


def test_a_first_name_the_filter_refuses_leaves_the_drawn_handle(drawn):
    from routes.profile import claim_handle
    assert claim_handle(drawn, "Fuck") is None
    assert claim_handle(drawn, "N1gger") is None
    assert claim_handle(drawn, "Shitamachi") == "Shitamachi"


def test_nothing_a_refusal_reads_is_kept(client, clean_decks):
    """No row of the trail or the feedback queue carries the refused text."""
    deck_id = _deck(client, name=f"{VULGAR} kanji")
    client.post(f"/api/decks/{deck_id}/publish")
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT props::text FROM event_log WHERE user_id = %s", (DEV_USER_ID,))
            assert not any(VULGAR.lower() in (row[0] or "").lower() for row in cur.fetchall())
    finally:
        conn.close()
