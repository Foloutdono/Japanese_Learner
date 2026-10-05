# ── 基礎 — the basics on the Learn gate (plan 186g) ──────────────
# GET /api/basics, the plate: the fourteen units with their figures and
# the unit the course is at; GET /api/basics/{unit}, a unit's station;
# and /api/today/cards?unit=, a unit boarded from it -- its due reviews,
# then its unmet cards in the order the course deals them.
from tests.test_today_ration import RATION_USER, _board, client  # noqa: F401  (the fixture)

from study import basics


def test_the_plate_lists_every_unit_at_the_first(client):
    _board(client, "N5", "both", 6, ["vocab", "kanji", "grammar"])
    body = client.get("/api/basics").json()
    assert body["riding"] is True and body["at"] == 1 and body["done"] is False
    assert [u["id"] for u in body["units"]] == [u["id"] for u in basics.units()]
    first = body["units"][0]
    assert first["unit"] == 1 and first["jp"] == "はじめまして" and first["title"]["fr"] == "Enchanté"
    unit = basics.units()[0]
    assert first["total"] == sum(len(unit["cards"][s]) for s in basics.SOURCES)
    assert first["met"] == 0 and first["learned"] == 0
    assert first["points"] == ["です／だ", "は", "か"]


def test_a_met_card_moves_its_unit(client):
    _board(client, "N5", "both", 6, ["grammar"])
    for raw_id in basics.units()[0]["cards"]["grammar"]:
        client.post("/api/today/review", json={"card_id": raw_id, "mode": "grammar.flashcard.f2b", "quality": 4})
    first = client.get("/api/basics").json()["units"][0]
    assert first["met"] == 3
    # A card in progress counts for how far it has come (plan 184): three
    # first reviews are some way short of three cards.
    assert 0 <= first["learned"] < 3


def test_above_n5_the_course_is_met_whole(client):
    _board(client, "N4", "both", 4, ["vocab", "grammar", "kanji"])
    body = client.get("/api/basics").json()
    assert body["riding"] is False and body["done"] is True and body["at"] is None
    assert all(u["met"] == u["total"] for u in body["units"])


def test_a_units_station_holds_its_cards_in_course_order(client):
    _board(client, "N5", "both", 6, ["vocab", "kanji", "grammar"])
    body = client.get("/api/basics/kazu?lang=en").json()
    unit = basics.units()[2]
    assert body["unit"] == 3 and body["of"] == 14 and body["jp"] == "数"
    assert [c["card_id"] for c in body["grammar"]] == unit["cards"]["grammar"]
    assert [c["card_id"] for c in body["vocab"]] == unit["cards"]["vocab"]
    assert [c["card_id"] for c in body["kanji"]] == unit["cards"]["kanji"]
    assert all(c["meaning"] for c in body["vocab"] + body["grammar"] + body["kanji"])
    assert all(c["progress"] == 0 and c["met"] is False for c in body["vocab"])
    assert [s["jp"] for s in body["sentences"]] == unit["sentences"]
    assert all(s["translation"] for s in body["sentences"])
    # The bank is English only: a French reader gets no translation.
    assert all(s["translation"] is None for s in client.get("/api/basics/kazu").json()["sentences"])
    assert client.get("/api/basics/nope").status_code == 404


def _ride(client, unit_id):
    """Every card a unit's run serves, batch by batch, as the run asks."""
    served = []
    exclude = []
    while True:
        r = client.get(f"/api/today/cards?count=10&unit={unit_id}&exclude={','.join(exclude)}")
        assert r.status_code == 200, r.text
        cards = r.json()["cards"]
        if not cards:
            return served
        assert all(c["basics"]["id"] == unit_id for c in cards)
        served += [c["card_id"] for c in cards]
        exclude += [f"{c['card_id']}|{c['mode']}" for c in cards]


def test_boarding_a_unit_serves_its_cards_in_course_order(client):
    _board(client, "N5", "both", 2, ["vocab", "kanji", "grammar"])
    unit = basics.units()[3]
    want = [raw_id for source in basics.SOURCES for raw_id in unit["cards"][source]]
    # Whatever the day's ration (two): the whole unit, rules first.
    assert _ride(client, unit["id"]) == want
    assert client.get("/api/today/cards?unit=nope").status_code == 404


def test_a_units_due_review_comes_before_its_new_cards(client):
    _board(client, "N5", "both", 2, ["vocab"])
    unit = basics.units()[0]
    word = unit["cards"]["vocab"][3]
    # A miss is due again within minutes: hold it due now.
    client.post("/api/today/review", json={"card_id": word, "mode": "vocab.flashcard.f2b", "quality": 0})
    from core.db import db_conn
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE card_modes SET next_review = now() - interval '1 minute' WHERE card_id = %s",
                        (f"{RATION_USER}:{word}",))
        conn.commit()
    finally:
        conn.close()
    cards = client.get(f"/api/today/cards?count=3&unit={unit['id']}").json()["cards"]
    assert cards[0]["card_id"] == word
    assert [c["card_id"] for c in cards[1:]] == [w for w in unit["cards"]["vocab"] if w != word][:2]


def test_the_course_is_the_learners_lines_part_of_it(client):
    # A learner riding vocab alone: a unit of words, everywhere.
    _board(client, "N5", "both", 6, ["vocab"])
    unit = basics.units()[2]
    plate = client.get("/api/basics").json()["units"][2]
    assert plate["total"] == len(unit["cards"]["vocab"])
    station = client.get(f"/api/basics/{unit['id']}").json()
    assert station["grammar"] == [] and station["kanji"] == [] and len(station["vocab"]) == plate["total"]
    assert _ride(client, unit["id"]) == unit["cards"]["vocab"]
