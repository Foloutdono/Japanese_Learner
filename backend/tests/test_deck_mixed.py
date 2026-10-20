# ── A mixed deck (plan 215) ────────────────────────────────────────
# A song is its words and its lines: one deck holding app cards of any
# source beside written front/back pairs. What came back with the type
# is the rule the first mixed deck lacked -- a card, not the deck,
# decides its modes -- so these hold that rule end to end: the modes the
# deck offers, which cards a session in each serves, the counts, and the
# states on the deck's page.
#
# A lyrics deck (plan 262), a song's deck, holds what a mixed deck holds
# by the same rule until its own modes come, so every test here that
# makes a mixed deck makes one of each.
from datetime import datetime, timedelta, timezone

import pytest

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, grammar_to_id
from content.kanji_data import KANJI_BY_LEVEL, kanji_to_id
from content.vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from core.db import db_conn
from main import app
from routes.profile import get_user_id
from tests.conftest import acting_as
from study.modes import GRADED_ORDER_FOR_SOURCE

MUID = "deck-mixed-test-user"

WORD = vocab_to_id(VOCAB_BY_LEVEL["N5"][0], "N5")
GLYPH = kanji_to_id(KANJI_BY_LEVEL["N5"][0], "N5")
POINT = grammar_to_id(GRAMMAR_POINTS_BY_LEVEL["N5"][0], "N5")

VOCAB_F2B = "vocab.flashcard.f2b"
KANJI_F2B = "kanji.flashcard.f2b"
STANDARD_F2B = "standard.flashcard.f2b"


def _wipe(user_id: str) -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM cards WHERE id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM deck_cards WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM custom_cards WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM decks WHERE user_id = %s", (user_id,))
        conn.commit()
    finally:
        conn.close()


@pytest.fixture(params=["mixed", "lyrics"])
def card_led(request):
    """A structure in which a card, not the deck, decides its modes."""
    return request.param


@pytest.fixture()
def mclient(client):
    _wipe(MUID)
    app.dependency_overrides[get_user_id] = lambda: MUID
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_user_id, None)
        _wipe(MUID)


def _deck(client, deck_type="mixed", name="夜に駆ける"):
    r = client.post("/api/decks", json={"name": name, "type": deck_type})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _link(client, deck_id, *refs):
    r = client.post(f"/api/decks/{deck_id}/cards/app", json={"cards": [
        {"source": source, "level": "N5", "raw_id": raw_id} for source, raw_id in refs
    ]})
    assert r.status_code == 200, r.text
    return r.json()["added"]


def _write(client, deck_id, front="君の名前を呼ぶよ", back="きみのなまえをよぶよ"):
    r = client.post(f"/api/decks/{deck_id}/cards", json={"front": front, "back": back})
    assert r.status_code == 200, r.text
    return r.json()


def _modes(client, deck_id):
    return client.get(f"/api/decks/{deck_id}/modes").json()["modes"]


def _served(client, deck_id, mode):
    r = client.get(f"/api/decks/{deck_id}/study", params={"mode": mode, "count": 20, "lang": "fr"})
    assert r.status_code == 200, r.text
    return [c["card_id"] for c in r.json()["cards"]]


def _make_due(raw_id: str, mode: str) -> None:
    past = datetime.now(timezone.utc) - timedelta(days=1)
    card_id = f"{MUID}:{raw_id}"
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO cards (id) VALUES (%s) ON CONFLICT DO NOTHING", (card_id,))
            cur.execute("""
                INSERT INTO card_modes (card_id, mode, interval_days, difficulty,
                                        stability, repetitions, is_learning,
                                        learning_step, total_reviews,
                                        correct_reviews, next_review)
                VALUES (%s, %s, 10, 2.5, 10, 3, FALSE, 0, 3, 3, %s)
            """, (card_id, mode, past))
        conn.commit()
    finally:
        conn.close()


def test_a_mixed_deck_takes_every_source_and_written_pairs(mclient, card_led):
    deck_id = _deck(mclient, card_led)
    assert _link(mclient, deck_id, ("vocab", WORD), ("kanji", GLYPH), ("grammar", POINT)) == 3
    card = _write(mclient, deck_id)
    # A mixed deck's written card is a plain front/back pair.
    assert card["structure"] == "standard"
    listed = mclient.get(f"/api/decks/{deck_id}/cards").json()["cards"]
    assert sorted(c.get("source", c["origin"]) for c in listed) == ["custom", "grammar", "kanji", "vocab"]


def test_an_empty_mixed_deck_offers_nothing(mclient, card_led):
    assert _modes(mclient, _deck(mclient, card_led)) == []


def test_its_modes_are_those_of_the_sources_it_holds_in_the_registry_s_order(mclient, card_led):
    deck_id = _deck(mclient, card_led)
    _write(mclient, deck_id)
    assert _modes(mclient, deck_id) == list(GRADED_ORDER_FOR_SOURCE["standard"])

    _link(mclient, deck_id, ("vocab", WORD))
    assert _modes(mclient, deck_id) == [
        *GRADED_ORDER_FOR_SOURCE["vocab"], *GRADED_ORDER_FOR_SOURCE["standard"],
    ]
    _link(mclient, deck_id, ("kanji", GLYPH))
    assert _modes(mclient, deck_id) == [
        *GRADED_ORDER_FOR_SOURCE["kanji"], *GRADED_ORDER_FOR_SOURCE["vocab"],
        *GRADED_ORDER_FOR_SOURCE["standard"],
    ]


def test_a_session_serves_only_the_cards_its_mode_belongs_to(mclient, card_led):
    deck_id = _deck(mclient, card_led)
    _link(mclient, deck_id, ("vocab", WORD), ("kanji", GLYPH))
    written = f"custom_{deck_id}_{_write(mclient, deck_id)['id']}"

    assert _served(mclient, deck_id, VOCAB_F2B) == [WORD]
    assert _served(mclient, deck_id, KANJI_F2B) == [GLYPH]
    assert _served(mclient, deck_id, STANDARD_F2B) == [written]
    # A grammar mode, in a deck holding no point, serves nothing at all.
    assert _served(mclient, deck_id, "grammar.flashcard.f2b") == []

    stats = mclient.get(f"/api/decks/{deck_id}/stats", params={"mode": VOCAB_F2B}).json()
    assert (stats["total"], stats["new"]) == (1, 1)
    stats = mclient.get(f"/api/decks/{deck_id}/stats", params={"mode": STANDARD_F2B}).json()
    assert (stats["total"], stats["new"]) == (1, 1)


def test_each_card_on_the_page_is_read_in_its_own_modes(mclient, card_led):
    deck_id = _deck(mclient, card_led)
    _link(mclient, deck_id, ("vocab", WORD))
    _write(mclient, deck_id)
    _make_due(WORD, VOCAB_F2B)

    listed = mclient.get(f"/api/decks/{deck_id}/cards").json()["cards"]
    states = {c["origin"]: c["state"] for c in listed}
    assert states == {"app": "due", "custom": "new"}


def test_a_single_structure_deck_still_holds_its_one_source(mclient):
    deck_id = _deck(mclient, "vocab", "Mots")
    assert _link(mclient, deck_id, ("kanji", GLYPH), ("vocab", WORD)) == 1
    assert _modes(mclient, deck_id) == list(GRADED_ORDER_FOR_SOURCE["vocab"])
    assert _served(mclient, deck_id, STANDARD_F2B) == []


def test_a_published_mixed_deck_is_found_under_its_kind_and_studied_by_a_follower(mclient, card_led, other_user):
    deck_id = _deck(mclient, card_led)
    _link(mclient, deck_id, ("vocab", WORD))
    written = f"custom_{deck_id}_{_write(mclient, deck_id)['id']}"
    r = mclient.post(f"/api/decks/{deck_id}/publish", json={"description": ""})
    assert r.status_code == 200, r.text

    with acting_as(other_user):
        body = mclient.get("/api/decks/library", params={"type": card_led}).json()
        assert deck_id in [d["id"] for d in body["results"]]
        assert mclient.post(f"/api/decks/{deck_id}/subscribe").status_code == 200
        assert _modes(mclient, deck_id) == [
            *GRADED_ORDER_FOR_SOURCE["vocab"], *GRADED_ORDER_FOR_SOURCE["standard"],
        ]
        assert _served(mclient, deck_id, VOCAB_F2B) == [WORD]
        assert _served(mclient, deck_id, STANDARD_F2B) == [written]
