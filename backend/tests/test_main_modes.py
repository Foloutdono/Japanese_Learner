# ── 主 — the mode each line is ridden in, and the modes added (plan 273) ──
# A line's main mode is the learner's choice now (Réglages › Modes
# principaux): Today deals its new cards in it, the level rule marks
# known in it, and a change marks what the old mode mastered known in
# the new one. Modes added to a line from Today's services deal the
# cards its main mode has taught, on the same pace. On a user of its
# own, wiped after each test.
import pytest

import core.user_level as user_level
from core.auth import get_user_id
from core.db import db_conn
from core.pace import resolve_pace
from core.srs_instance import srs
from main import app
from collections import OrderedDict

from study import card_index, daily_queue, main_modes, teaching_order
from study.daily_queue import SECTION

MODES_USER = "main-modes-test-user"
MEANING = "kanji.flashcard.f2b"
DRAW = "kanji.write_kanji"
READINGS = "kanji.readings"


def _wipe(user_id: str) -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM card_first_review WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM cards WHERE id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM credit_ledger WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM user_profiles WHERE user_id = %s", (user_id,))
        conn.commit()
    finally:
        conn.close()
    user_level._cache.pop(user_id, None)
    srs.forget_history(user_id)


@pytest.fixture()
def client(client):
    _wipe(MODES_USER)
    previous = app.dependency_overrides.get(get_user_id)
    app.dependency_overrides[get_user_id] = lambda: MODES_USER
    try:
        yield client
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_user_id, None)
        else:
            app.dependency_overrides[get_user_id] = previous
        _wipe(MODES_USER)


def _board(client, level="N4", target=6, lines=("kanji",)):
    r = client.post("/api/onboarding/complete", json={
        "jlptLevel": level, "dailyNewTarget": target, "kanaKnown": "both", "lines": list(lines),
    })
    assert r.status_code == 200, r.text


def _row(raw_id: str, mode: str, *, due_in_hours: float, interval: int, learning=False, reviews=3) -> None:
    """A scheduler row written by hand: a card already studied in `mode`."""
    card_id = f"{MODES_USER}:{raw_id}"
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO cards(id) VALUES (%s) ON CONFLICT DO NOTHING", (card_id,))
            cur.execute(
                """
                INSERT INTO card_modes(card_id, mode, difficulty, stability, interval_days, repetitions,
                                       lapses, learning_step, is_learning, next_review, total_reviews,
                                       correct_reviews, last_quality)
                VALUES (%s, %s, 2.5, 4.0, %s, 2, 0, 0, %s, NOW() + %s * INTERVAL '1 hour', %s, %s, 4)
                """,
                (card_id, mode, interval, learning, due_in_hours, reviews, reviews),
            )
        conn.commit()
    finally:
        conn.close()


def _logged(raw_id: str, mode: str, days_ago: int) -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO review_log (card_id, mode, quality, xp_earned, reviewed_at) "
                "VALUES (%s, %s, 4, 0, NOW() - %s * INTERVAL '1 day')",
                (f"{MODES_USER}:{raw_id}", mode, days_ago),
            )
        conn.commit()
    finally:
        conn.close()
    srs.forget_history(MODES_USER)


def _lanes(client):
    return {(l["source"], l["deck"], l["mode"]): l for l in client.get("/api/today").json()["lanes"]}


# ── The choices ───────────────────────────────────────────────────

def test_a_main_mode_asks_every_card_of_its_line():
    # word_reading has nothing to ask of a kana-only word, radical needs
    # a radical: both ride only as extras.
    assert "vocab.word_reading" not in main_modes.MAIN_CHOICES["vocab"]
    assert "kanji.radical" not in main_modes.MAIN_CHOICES["kanji"]
    assert "vocab.word_reading" in main_modes.EXTRA_CHOICES["vocab"]
    assert "grammar" not in main_modes.MAIN_CHOICES
    with pytest.raises(ValueError):
        main_modes.clean_main({"kanji": "kanji.radical"})
    with pytest.raises(ValueError):
        main_modes.clean_main({"grammar": "grammar.flashcard.f2b"})
    with pytest.raises(ValueError):
        main_modes.clean_extra({"vocab": [DRAW]})
    assert main_modes.clean_extra({"kanji": [READINGS, DRAW, DRAW]}) == {"kanji": [DRAW, READINGS]}


def test_what_the_stored_columns_mean():
    m = main_modes.resolve(None, None)
    assert m.main_of("kanji") == MEANING and m.main_of("grammar") == "grammar.ladder"
    assert m.spending() == frozenset()
    # A main mode is never its own extra, and a mode no longer on offer
    # reads as the default.
    m = main_modes.resolve({"kanji": DRAW, "vocab": "vocab.gone"}, {"kanji": [DRAW, READINGS]})
    assert m.main_of("kanji") == DRAW and m.main_of("vocab") == "vocab.flashcard.f2b"
    assert m.extras_of("kanji") == (READINGS,)
    assert m.spending() == {DRAW, READINGS}


def test_the_profile_reads_and_merges_the_modes_line_by_line(client):
    _board(client)
    got = client.get("/api/profile/modes").json()
    assert got["main"]["kanji"] == MEANING and got["extra"]["kanji"] == []
    assert got["choices"]["main"]["kanji"] == list(main_modes.MAIN_CHOICES["kanji"])
    r = client.patch("/api/profile/learning", json={"extraModes": {"kanji": [DRAW]}})
    assert r.status_code == 200, r.text
    r = client.patch("/api/profile/learning", json={"extraModes": {"vocab": ["vocab.word_reading"]}})
    assert r.json()["modes"]["extra"] == {"kana": [], "vocab": ["vocab.word_reading"], "kanji": [DRAW]}
    for bad in ({"mainModes": {"kanji": "kanji.radical"}}, {"mainModes": {"grammar": "grammar.ladder"}},
                {"extraModes": {"kanji": ["vocab.flashcard.f2b"]}}, {"extraModes": {"kanji": DRAW}}):
        assert client.patch("/api/profile/learning", json=bad).status_code == 422, bad
    assert client.get("/api/profile/modes/preview?line=grammar&mode=grammar.ladder").status_code == 422
    assert client.get("/api/profile/modes/preview?line=kanji&mode=kanji.radical").status_code == 422


# ── A main mode changed ───────────────────────────────────────────

def test_a_new_main_mode_takes_what_the_old_one_mastered_and_deals_the_line_in_it(client):
    _board(client)  # N4: the N5 kanji are marked known in their meaning
    n5 = card_index.raw_ids("kanji", "N5", DRAW)
    preview = client.get(f"/api/profile/modes/preview?line=kanji&mode={DRAW}").json()
    assert preview["markedKnown"] == len(n5) and preview["from"] == MEANING
    assert srs.count_rows([f"{MODES_USER}:{raw}" for raw in n5], DRAW) == 0

    r = client.patch("/api/profile/learning", json={"mainModes": {"kanji": DRAW}})
    assert r.status_code == 200, r.text
    assert r.json()["mainSwitch"] == [{**preview}]
    assert r.json()["modes"]["main"]["kanji"] == DRAW
    # Marked known the level rule's way: an assumption, its check ahead.
    assert srs.count_rows([f"{MODES_USER}:{raw}" for raw in n5], DRAW) == len(n5)
    assert srs.is_assumed(srs._load_state(f"{MODES_USER}:{n5[0]}", DRAW))

    lanes = _lanes(client)
    assert ("kanji", "N4", DRAW) in lanes and ("kanji", "N4", MEANING) not in lanes
    assert lanes[("kanji", "N4", DRAW)]["new"] > 0 and lanes[("kanji", "N4", DRAW)]["main"] is True
    # Back again: nothing to mark, nothing deleted.
    back = client.patch("/api/profile/learning", json={"mainModes": {"kanji": MEANING}}).json()
    assert back["mainSwitch"][0]["markedKnown"] == 0
    assert srs.count_rows([f"{MODES_USER}:{raw}" for raw in n5], DRAW) == len(n5)


def test_a_new_main_mode_can_start_from_zero_and_is_dealt_from_the_lowest_stop(client):
    _board(client)  # N4: the N5 kanji are marked known in their meaning
    n5 = card_index.raw_ids("kanji", "N5", DRAW)
    r = client.patch("/api/profile/learning", json={"mainModes": {"kanji": DRAW}, "carryKnown": False})
    assert r.status_code == 200, r.text
    assert r.json()["mainSwitch"] == [{"line": "kanji", "from": MEANING, "to": DRAW, "carried": False,
                                       "markedKnown": 0, "spreadWeeks": 6}]
    assert srs.count_rows([f"{MODES_USER}:{raw}" for raw in n5], DRAW) == 0
    # Nothing carried, so the stops behind the level are new in the
    # mode: Today starts on them, in teaching order.
    lanes = _lanes(client)
    assert ("kanji", "N5", DRAW) in lanes and ("kanji", "N4", DRAW) not in lanes
    cards = client.get(f"/api/today/cards?count=10&lanes={lanes[('kanji', 'N5', DRAW)]['id']}").json()["cards"]
    assert [c["card_id"] for c in cards] == teaching_order.raw_ids("kanji", "N5", DRAW)[:len(cards)]
    # The meaning rows are untouched.
    assert srs.count_rows([f"{MODES_USER}:{raw}" for raw in card_index.raw_ids("kanji", "N5", MEANING)], MEANING) > 0


def test_the_default_main_mode_keeps_to_the_level(client):
    # A learner who never chose: new cards at their own level only, as
    # before plan 273, whatever is unmet below it.
    _board(client)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{MODES_USER}:kanji_N5_%",))
        conn.commit()
    finally:
        conn.close()
    assert set(_lanes(client)) == {("kanji", "N4", MEANING)}


# ── Modes added to Today ──────────────────────────────────────────

def test_an_added_mode_takes_its_turn_beside_the_rest_of_the_ration():
    kana = OrderedDict([((SECTION, "kana", "hiragana_basic", "m"), ["a", "i", "u", "e"])])
    lines = OrderedDict([((SECTION, "kanji", "N5", "k"), ["k1", "k2"])])
    draw = OrderedDict([((SECTION, "kanji", "N5", "d"), ["d1", "d2", "d3"])])
    # One turn each: the rest keeps its own order (kana first), the
    # added lane takes every other card.
    out = daily_queue.ration(kana, lines, 6, extra=draw)
    assert out == OrderedDict([
        ((SECTION, "kana", "hiragana_basic", "m"), ["a", "i", "u"]),
        ((SECTION, "kanji", "N5", "d"), ["d1", "d2", "d3"]),
    ])
    # Whatever the rest cannot use goes to the added lanes, and back.
    assert sum(len(v) for v in daily_queue.ration(OrderedDict(), OrderedDict(), 6, extra=draw).values()) == 3
    assert daily_queue.share_extras(5, OrderedDict(), 3) == (3, OrderedDict())
    # A course rider is dealt the added lanes too.
    course = [((SECTION, "vocab", "N5", "v"), "w1"), ((SECTION, "vocab", "N5", "v"), "w2")]
    out = daily_queue.ration(OrderedDict(), OrderedDict(), 2, course=course, extra=draw)
    assert out == OrderedDict([((SECTION, "vocab", "N5", "v"), ["w1"]), ((SECTION, "kanji", "N5", "d"), ["d1"])])


def test_an_added_mode_deals_what_the_main_mode_taught_from_the_lowest_stop(client):
    _board(client, target=6)
    before = _lanes(client)
    assert set(before) == {("kanji", "N4", MEANING)}
    client.patch("/api/profile/learning", json={"extraModes": {"kanji": [DRAW]}})
    lanes = _lanes(client)
    # The N5 kanji, known by their meaning, are drawn first; the round
    # robin shares the pace with the main lane.
    draw = lanes[("kanji", "N5", DRAW)]
    assert draw["main"] is True and draw["new"] == 3
    assert lanes[("kanji", "N4", MEANING)]["new"] == 3
    cards = client.get(f"/api/today/cards?count=10&lanes={draw['id']}").json()["cards"]
    assert [c["card_id"] for c in cards] == teaching_order.raw_ids("kanji", "N5", DRAW)[:3]
    assert all(c["mode"] == DRAW for c in cards)


def test_an_added_mode_waits_for_the_main_mode_to_teach_the_card(client):
    _board(client, level="N5", target=4, lines=("kanji",))
    client.patch("/api/profile/learning", json={"extraModes": {"kanji": [DRAW]}})
    n5 = card_index.raw_ids("kanji", "N5", MEANING)
    # Still in its learning steps in meaning: not drawn yet.
    _row(n5[0], MEANING, due_in_hours=1, interval=0, learning=True, reviews=1)
    assert ("kanji", "N5", DRAW) not in _lanes(client)
    # Graduated in meaning: drawn.
    _row(n5[1], MEANING, due_in_hours=48, interval=2)
    lane = _lanes(client)[("kanji", "N5", DRAW)]
    assert lane["new"] == 1
    cards = client.get(f"/api/today/cards?count=10&lanes={lane['id']}").json()["cards"]
    assert [c["card_id"] for c in cards] == [n5[1]]


def test_a_first_answer_in_an_added_mode_spends_the_pace(client):
    _board(client, target=6)
    raw = card_index.raw_ids("kanji", "N4", MEANING)[0]
    # Met by its meaning yesterday, drawn for the first time today.
    _logged(raw, MEANING, days_ago=1)
    _logged(raw, DRAW, days_ago=0)
    assert srs.get_mode_firsts_today(MODES_USER, {DRAW}) == {(f"{MODES_USER}:{raw}", DRAW)}
    assert srs.get_new_items_today(MODES_USER) == 0
    assert resolve_pace(MODES_USER).new_today == 0
    client.patch("/api/profile/learning", json={"extraModes": {"kanji": [DRAW]}})
    assert resolve_pace(MODES_USER).new_today == 1


def test_the_gate_marks_the_lanes_ridden_in_the_learners_modes(client):
    _board(client, target=6)
    raw = card_index.raw_ids("kanji", "N4", READINGS)[0]
    _row(raw, READINGS, due_in_hours=-2, interval=3)
    lanes = _lanes(client)
    assert lanes[("kanji", "N4", READINGS)]["main"] is False
    assert lanes[("kanji", "N4", MEANING)]["main"] is True
    client.patch("/api/profile/learning", json={"extraModes": {"kanji": [READINGS]}})
    assert _lanes(client)[("kanji", "N4", READINGS)]["main"] is True
