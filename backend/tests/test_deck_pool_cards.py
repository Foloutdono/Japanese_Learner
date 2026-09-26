# ── A JMdict pool word in a deck (plan 148) ───────────────────────
# The analyser and the dictionary offer every word the app holds a card
# for, the 212k JMdict words past the course included, and a vocab deck
# takes one as the vocab card it already is: `vocab_jmdict_<id>`, with
# no level. These are that round trip -- added, listed, studied, counted,
# and asked again in the daily queue, in the deck's own lane, since a
# pool word has no JLPT stop to be asked at.
from datetime import datetime, timedelta, timezone

import pytest

import content.vocab_jmdict_data as jmdict_db
from core.db import db_conn
from main import app
from routes.decks import POOL_LEVEL
from routes.profile import get_user_id

PUID = "deck-pool-test-user"


def _pool_id(kanji: str, kana: str) -> str:
    entry = jmdict_db.get_by_key(kanji, kana)
    assert entry is not None, f"{kanji}/{kana} left the pool"
    return jmdict_db.vocab_jmdict_to_id(entry)


TOUGENKYOU = _pool_id("桃源郷", "とうげんきょう")


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


@pytest.fixture()
def pclient(client):
    _wipe(PUID)
    app.dependency_overrides[get_user_id] = lambda: PUID
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_user_id, None)
        _wipe(PUID)


def _deck(client, name, deck_type="vocab"):
    r = client.post("/api/decks", json={"name": name, "type": deck_type})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _add(client, deck_id, *cards):
    r = client.post(f"/api/decks/{deck_id}/cards/app", json={"cards": list(cards)})
    assert r.status_code == 200, r.text
    return r.json()["added"]


def _make_due(user_id: str, raw_id: str, mode: str) -> None:
    past = datetime.now(timezone.utc) - timedelta(days=1)
    card_id = f"{user_id}:{raw_id}"
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
                ON CONFLICT (card_id, mode) DO UPDATE SET next_review = EXCLUDED.next_review
            """, (card_id, mode, past))
        conn.commit()
    finally:
        conn.close()


def test_a_vocab_deck_takes_a_pool_word_with_no_level(pclient):
    deck_id = _deck(pclient, "Anime")
    # The analyser sends no level: the pool has none.
    assert _add(pclient, deck_id, {"source": "vocab", "level": None, "raw_id": TOUGENKYOU}) == 1
    # Once is enough, whatever level a second press claims.
    assert _add(pclient, deck_id, {"source": "vocab", "level": "N1", "raw_id": TOUGENKYOU}) == 0

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT level FROM deck_cards WHERE deck_id = %s", (deck_id,))
            assert [r[0] for r in cur.fetchall()] == [POOL_LEVEL]
    finally:
        conn.close()

    # Listed as a vocab card with no level to badge, in JMdict's own
    # gloss even for a French reader: VOCAB_FR is the course's.
    listed = pclient.get(f"/api/decks/{deck_id}/cards", params={"lang": "fr"}).json()["cards"]
    assert [(c["origin"], c["source"], c["level"], c["front"], c["kana"], c["back"]) for c in listed] == [
        ("app", "vocab", None, "桃源郷", "とうげんきょう", "earthly paradise"),
    ]


def test_only_a_pool_row_that_exists_is_taken(pclient):
    deck_id = _deck(pclient, "Anime")
    assert _add(pclient, deck_id,
                {"source": "vocab", "raw_id": "vocab_jmdict_999999999"},
                {"source": "vocab", "raw_id": "vocab_jmdict_x"},
                # A course card still needs its level to resolve.
                {"source": "vocab", "level": None, "raw_id": "vocab_N5_行く_いく"}) == 0
    # And a kana deck takes no vocab card, from the pool or the course.
    kana_deck = _deck(pclient, "かな", "kana")
    assert _add(pclient, kana_deck, {"source": "vocab", "raw_id": TOUGENKYOU}) == 0


def test_a_pool_word_is_studied_and_counted_in_its_deck(pclient):
    deck_id = _deck(pclient, "Anime")
    _add(pclient, deck_id, {"source": "vocab", "raw_id": TOUGENKYOU})

    stats = pclient.get(f"/api/decks/{deck_id}/stats", params={"mode": "vocab.flashcard.f2b"}).json()
    assert (stats["total"], stats["new"]) == (1, 1)

    cards = pclient.get(f"/api/decks/{deck_id}/study",
                        params={"mode": "vocab.flashcard.f2b", "count": 5, "lang": "fr"}).json()["cards"]
    assert [(c["card_id"], c["kanji"], c["kana"], c["meaning"], c["source"]) for c in cards] == [
        (TOUGENKYOU, "桃源郷", "とうげんきょう", "earthly paradise", "builtin_vocab"),
    ]
    # The multiple-choice hint draws its wrong answers from the pool
    # words ranked beside it, never an empty level.
    choices = cards[0]["hints"]["indice_1"]
    assert len(choices) == 4
    assert "earthly paradise" in {c["meaning"] for c in choices}


def test_a_pool_word_comes_back_in_its_deck_s_lane(pclient):
    deck_id = _deck(pclient, "Anime")
    _add(pclient, deck_id, {"source": "vocab", "raw_id": TOUGENKYOU})
    _make_due(PUID, TOUGENKYOU, "vocab.flashcard.f2b")

    cards = pclient.get("/api/today/cards", params={"count": 20}).json()["cards"]
    pooled = [c for c in cards if c["card_id"] == TOUGENKYOU]
    assert len(pooled) == 1
    card = pooled[0]
    assert (card["kanji"], card["meaning"], card["source"]) == ("桃源郷", "earthly paradise", "vocab")
    assert (card["deck"], str(card["deck_id"])) == ("Anime", str(deck_id))

    one = pclient.get("/api/today/cards", params={"count": 20, "only": TOUGENKYOU}).json()["cards"]
    assert [c["card_id"] for c in one] == [TOUGENKYOU]

    # A review of it is taken like any other.
    r = pclient.post("/api/today/review", json={
        "card_id": TOUGENKYOU, "mode": "vocab.flashcard.f2b", "quality": 4,
    })
    assert r.status_code == 200, r.text


def test_a_pool_word_in_no_deck_is_not_asked_by_the_queue(pclient):
    # The queue asks a pool word through a deck it is in; one studied
    # only from the frequency line's JMdict tiers is that line's.
    _make_due(PUID, TOUGENKYOU, "vocab.flashcard.f2b")
    cards = pclient.get("/api/today/cards", params={"count": 20}).json()["cards"]
    assert TOUGENKYOU not in {c["card_id"] for c in cards}


# ── Edge cases (plan 150) ─────────────────────────────────────────

SARABA = _pool_id("", "さらば")          # a pool word written in kana alone


def test_a_pool_word_leaves_its_deck_and_the_queue(pclient):
    deck_id = _deck(pclient, "Anime")
    _add(pclient, deck_id, {"source": "vocab", "raw_id": TOUGENKYOU})
    _make_due(PUID, TOUGENKYOU, "vocab.flashcard.f2b")

    r = pclient.delete(f"/api/decks/{deck_id}/cards/app", params={"source": "vocab", "raw_id": TOUGENKYOU})
    assert r.status_code == 200, r.text
    # Once: a second removal finds nothing.
    r = pclient.delete(f"/api/decks/{deck_id}/cards/app", params={"source": "vocab", "raw_id": TOUGENKYOU})
    assert r.status_code == 404
    assert pclient.get(f"/api/decks/{deck_id}/cards").json()["cards"] == []
    # In no deck, the queue has nothing to ask it through.
    cards = pclient.get("/api/today/cards", params={"count": 20}).json()["cards"]
    assert TOUGENKYOU not in {c["card_id"] for c in cards}


def test_a_pool_word_is_exported_with_its_gloss(pclient):
    deck_id = _deck(pclient, "Anime")
    _add(pclient, deck_id, {"source": "vocab", "raw_id": TOUGENKYOU})
    r = pclient.get(f"/api/decks/{deck_id}/export")
    assert r.status_code == 200
    rows = r.content.decode("utf-8-sig").splitlines()
    assert rows == ["front,back", "桃源郷,earthly paradise"]


def test_a_pool_word_in_two_decks_is_asked_once(pclient):
    first, second = _deck(pclient, "Anime"), _deck(pclient, "Songs")
    _add(pclient, first, {"source": "vocab", "raw_id": TOUGENKYOU})
    _add(pclient, second, {"source": "vocab", "raw_id": TOUGENKYOU})
    _make_due(PUID, TOUGENKYOU, "vocab.flashcard.f2b")
    cards = pclient.get("/api/today/cards", params={"count": 20}).json()["cards"]
    assert [c["card_id"] for c in cards].count(TOUGENKYOU) == 1


def test_a_kana_only_pool_word_is_never_asked_its_reading(pclient):
    """word_reading shows the word and asks how it is read: さらば would
    print its own answer. The flashcards still ask it."""
    deck_id = _deck(pclient, "Anime")
    _add(pclient, deck_id, {"source": "vocab", "raw_id": SARABA}, {"source": "vocab", "raw_id": TOUGENKYOU})

    def total(mode):
        return pclient.get(f"/api/decks/{deck_id}/stats", params={"mode": mode}).json()["total"]

    assert total("vocab.flashcard.f2b") == 2
    assert total("vocab.flashcard.b2f") == 2
    assert total("vocab.word_reading") == 1
    served = pclient.get(f"/api/decks/{deck_id}/study",
                         params={"mode": "vocab.word_reading", "count": 5}).json()["cards"]
    assert [c["card_id"] for c in served] == [TOUGENKYOU]


def test_a_followed_deck_hands_its_pool_word_to_the_follower(pclient, other_user):
    from tests.conftest import acting_as

    with acting_as(other_user):
        deck_id = _deck(pclient, "Someone's anime words")
        _add(pclient, deck_id, {"source": "vocab", "raw_id": TOUGENKYOU})
        assert pclient.post(f"/api/decks/{deck_id}/publish").status_code == 200

    assert pclient.post(f"/api/decks/{deck_id}/subscribe").status_code == 200
    listed = pclient.get(f"/api/decks/{deck_id}/cards").json()["cards"]
    assert [(c["front"], c["level"], c["back"]) for c in listed] == [("桃源郷", None, "earthly paradise")]
    served = pclient.get(f"/api/decks/{deck_id}/study",
                         params={"mode": "vocab.flashcard.f2b", "count": 5}).json()["cards"]
    assert [c["card_id"] for c in served] == [TOUGENKYOU]

    # "Make it mine": the copy holds the same pool card, still levelless.
    copied = pclient.post(f"/api/decks/{deck_id}/detach")
    assert copied.status_code == 200, copied.text
    mine = copied.json().get("id") or copied.json().get("deck_id")
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT raw_id, level FROM deck_cards WHERE deck_id = %s", (mine,))
            assert cur.fetchall() == [(TOUGENKYOU, POOL_LEVEL)]
    finally:
        conn.close()
