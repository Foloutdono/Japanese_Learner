# ── 回送 — cards a learner set aside (plan 328) ────────────────────
# A card set aside is served in no mode and counted in nothing owed --
# not as a new card, not as a review -- until it is taken back, when it
# resumes on the schedule it had. On a user of its own, wiped after each
# test, as the ration's tests are.
import pytest

import core.user_level as user_level
from core.auth import get_user_id
from core.db import db_conn
from core.srs_instance import srs
from main import app

USER = "set-aside-test-user"


def _wipe(user_id: str) -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM card_first_review WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM cards WHERE id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM card_set_aside WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM credit_ledger WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM user_profiles WHERE user_id = %s", (user_id,))
        conn.commit()
    finally:
        conn.close()
    user_level._cache.pop(user_id, None)
    srs.forget_history(user_id)


@pytest.fixture()
def client(client):
    _wipe(USER)
    previous = app.dependency_overrides.get(get_user_id)
    app.dependency_overrides[get_user_id] = lambda: USER
    try:
        yield client
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_user_id, None)
        else:
            app.dependency_overrides[get_user_id] = previous
        _wipe(USER)


def _board(client, target=3):
    r = client.post("/api/onboarding/complete", json={
        "jlptLevel": "N5", "dailyNewTarget": target, "kanaKnown": "both", "lines": ["vocab"],
    })
    assert r.status_code == 200, r.text


def _ids(cards):
    return [c["card_id"] for c in cards]


def _make_due(raw_id: str) -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE card_modes SET next_review = NOW() - INTERVAL '1 hour' WHERE card_id = %s",
                        (f"{USER}:{raw_id}",))
        conn.commit()
    finally:
        conn.close()


def test_a_new_card_set_aside_is_never_dealt(client):
    _board(client)
    first = client.get("/api/today/cards?count=10").json()["cards"]
    assert len(first) == 3
    gone = first[0]["card_id"]

    r = client.post("/api/cards/set-aside", json={"cardId": gone})
    assert r.status_code == 200, r.text

    # The ration deals the next card in its place: the pace is not spent
    # by a card that was never answered.
    again = client.get("/api/today/cards?count=10").json()["cards"]
    assert len(again) == 3 and gone not in _ids(again)
    assert client.get("/api/today").json()["total"] == 3

    # Taken back, it is the deck's next card again.
    assert client.post("/api/cards/take-back", json={"cardId": gone}).status_code == 200
    assert gone in _ids(client.get("/api/today/cards?count=10").json()["cards"])


def test_a_due_card_set_aside_leaves_the_queue_and_comes_back_on_its_schedule(client):
    _board(client, target=1)
    card = client.get("/api/today/cards?count=10").json()["cards"][0]
    r = client.post("/api/today/review", json={"card_id": card["card_id"], "mode": card["mode"], "quality": 4})
    assert r.status_code == 200
    _make_due(card["card_id"])
    assert card["card_id"] in _ids(client.get("/api/today/cards?count=10").json()["cards"])
    before = srs.get_states_for([f"{USER}:{card['card_id']}"], [card["mode"]])
    owed = srs.get_due_forecast(USER, days=1)[0]["count"]

    client.post("/api/cards/set-aside", json={"cardId": card["card_id"]})
    assert card["card_id"] not in _ids(client.get("/api/today/cards?count=10").json()["cards"])
    assert all(row["card_id"] != f"{USER}:{card['card_id']}" for row in srs.get_due_rows(USER))
    assert srs.get_due_forecast(USER, days=1)[0]["count"] == owed - 1

    client.post("/api/cards/take-back", json={"cardId": card["card_id"]})
    assert card["card_id"] in _ids(client.get("/api/today/cards?count=10").json()["cards"])
    # Nothing of its schedule was touched while it was away.
    assert srs.get_states_for([f"{USER}:{card['card_id']}"], [card["mode"]]) == before


def test_the_list_names_each_card_in_the_learners_language(client):
    _board(client)
    assert client.post("/api/cards/set-aside", json={"cardId": "vocab_N5_駅_えき"}).status_code == 200
    assert client.post("/api/cards/set-aside", json={"cardId": "kanji_N5_土"}).status_code == 200
    # Twice is once.
    assert client.post("/api/cards/set-aside", json={"cardId": "kanji_N5_土"}).status_code == 200

    listed = client.get("/api/cards/set-aside?lang=fr").json()["cards"]
    by_id = {c["cardId"]: c for c in listed}
    assert set(by_id) == {"vocab_N5_駅_えき", "kanji_N5_土"}
    assert by_id["vocab_N5_駅_えき"]["jp"] == "駅" and by_id["vocab_N5_駅_えき"]["reading"] == "えき"
    assert by_id["vocab_N5_駅_えき"]["meaning"]
    assert by_id["kanji_N5_土"]["source"] == "kanji"

    client.post("/api/cards/take-back", json={"cardId": "kanji_N5_土"})
    assert [c["cardId"] for c in client.get("/api/cards/set-aside").json()["cards"]] == ["vocab_N5_駅_えき"]


def test_only_a_card_the_learner_could_be_served_is_set_aside(client):
    _board(client)
    for junk in ("vocab_N5_nothing_here", "custom_999_999999", "whatever", "vocab_jmdict_notanumber"):
        r = client.post("/api/cards/set-aside", json={"cardId": junk})
        assert r.status_code == 404, junk
    assert client.post("/api/cards/set-aside", json={"cardId": "x" * 500}).status_code == 422
    assert client.get("/api/cards/set-aside").json()["cards"] == []
    # Taking back what was never set aside is no error.
    assert client.post("/api/cards/take-back", json={"cardId": "kanji_N5_土"}).status_code == 200


def test_the_set_is_bounded(client, monkeypatch):
    _board(client)
    monkeypatch.setattr(type(srs), "SET_ASIDE_MAX", 1)
    assert client.post("/api/cards/set-aside", json={"cardId": "kanji_N5_土"}).status_code == 200
    r = client.post("/api/cards/set-aside", json={"cardId": "kanji_N5_山"})
    assert r.status_code == 409 and r.json()["detail"] == "set_aside_full"


def test_deleting_the_account_takes_the_set(client):
    _board(client)
    client.post("/api/cards/set-aside", json={"cardId": "kanji_N5_土"})
    from routes.account import PLAN, prefix_pattern
    (clause,) = [clause for table, clause, _why in PLAN if table == "card_set_aside"]
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(f"DELETE FROM card_set_aside WHERE {clause}",
                        {"user": USER, "prefix": prefix_pattern(USER)})
            assert cur.rowcount == 1
        conn.commit()
    finally:
        conn.close()
    assert srs.get_set_aside(USER) == []
