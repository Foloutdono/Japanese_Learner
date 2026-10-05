# ── 新規 — the day's ration in the daily queue (plan 098) ──────────
# The queue served reviews only, which left a learner who had just
# boarded on an empty gate. It now carries what is left of the pace as
# new cards: kana first for a learner who does not read them, then the
# chosen lines in turn; nothing without a stored target; spent as the
# day's first reviews land. On a user of its own, wiped after each
# test -- boarding runs the level rule, and the shared DEV user's card
# state is what the dictionary tests are served.
from collections import OrderedDict

import pytest

import core.user_level as user_level
from core.auth import get_user_id
from core.db import db_conn
from main import app
from study import daily_queue
from study.daily_queue import SECTION

RATION_USER = "ration-test-user"


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


@pytest.fixture()
def client(client):
    _wipe(RATION_USER)
    previous = app.dependency_overrides.get(get_user_id)
    app.dependency_overrides[get_user_id] = lambda: RATION_USER
    try:
        yield client
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_user_id, None)
        else:
            app.dependency_overrides[get_user_id] = previous
        _wipe(RATION_USER)


def _board(client, level, kana, target, lines):
    r = client.post("/api/onboarding/complete", json={
        "jlptLevel": level, "dailyNewTarget": target, "kanaKnown": kana, "lines": lines,
    })
    assert r.status_code == 200, r.text


# ── The pure part ─────────────────────────────────────────────────

def test_ration_spends_kana_first_then_the_lines_in_turn():
    kana = OrderedDict([
        ((SECTION, "kana", "hiragana_basic", "m"), ["a", "i", "u"]),
        ((SECTION, "kana", "katakana_basic", "m"), ["A", "I"]),
    ])
    lines = OrderedDict([
        ((SECTION, "vocab", "N5", "v"), ["v1", "v2", "v3"]),
        ((SECTION, "kanji", "N5", "k"), ["k1", "k2"]),
    ])
    out = daily_queue.ration(kana, lines, 7)
    assert list(out.values()) == [["a", "i", "u"], ["A", "I"], ["v1"], ["k1"]]
    # A budget the kana alone exhaust reaches no line.
    assert list(daily_queue.ration(kana, lines, 2).values()) == [["a", "i"]]
    # Nothing to spend, nothing offered.
    assert daily_queue.ration(kana, lines, 0) == OrderedDict()
    # Lines alone round-robin: a word, a kanji, a word, a kanji, a word.
    assert list(daily_queue.ration(OrderedDict(), lines, 5).values()) == [["v1", "v2", "v3"], ["k1", "k2"]]


def test_merge_new_keeps_due_first_and_counts_the_new_apart():
    due = OrderedDict([((SECTION, "vocab", "N5", "v"), ["d1", "d2"])])
    new = OrderedDict([
        ((SECTION, "vocab", "N5", "v"), ["n1", "d2"]),      # d2 is already due: not new twice
        ((SECTION, "kanji", "N5", "k"), ["k1"]),
    ])
    merged, counts = daily_queue.merge_new(due, new)
    assert list(merged.items()) == [
        ((SECTION, "vocab", "N5", "v"), ["d1", "d2", "n1"]),
        ((SECTION, "kanji", "N5", "k"), ["k1"]),
    ]
    assert counts == {(SECTION, "vocab", "N5", "v"): 1, (SECTION, "kanji", "N5", "k"): 1}


# ── The queue ─────────────────────────────────────────────────────

def test_a_novice_first_day_is_kana_up_to_the_pace(client):
    _board(client, "N5", "none", 5, ["vocab", "kanji"])
    today = client.get("/api/today").json()
    assert today["total"] == 5
    assert today["pace"] == {"target": 5, "newToday": 0, "remaining": 5}
    assert len(today["lanes"]) == 1
    lane = today["lanes"][0]
    assert (lane["source"], lane["deck"]) == ("kana", "hiragana_basic")
    assert (lane["due"], lane["new"]) == (0, 5)
    assert lane["free"] is True
    # The fare: kana ride free.
    assert today["fare"] == 0

    cards = client.get("/api/today/cards?count=10").json()["cards"]
    assert len(cards) == 5
    assert {c["source"] for c in cards} == {"kana"}
    assert all(c["stage"] == "new" and c["review_preview"] for c in cards)
    assert len({c["card_id"] for c in cards}) == 5


def test_a_learner_with_both_scripts_is_served_the_lines_in_turn(client):
    _board(client, "N4", "both", 4, ["vocab", "kanji"])
    today = client.get("/api/today").json()
    assert today["total"] == 4
    by = {(l["source"], l["deck"]): l for l in today["lanes"]}
    assert set(by) == {("vocab", "N4"), ("kanji", "N4")}
    assert by[("vocab", "N4")]["new"] == 2 and by[("kanji", "N4")]["new"] == 2
    assert all(l["due"] == 0 for l in today["lanes"])
    # A switched-off line offers nothing new either.
    only_vocab = client.get(f"/api/today/cards?count=10&lanes={by[('vocab', 'N4')]['id']}").json()["cards"]
    assert len(only_vocab) == 2 and {c["source"] for c in only_vocab} == {"vocab"}


def test_the_ration_is_spent_as_the_first_reviews_land(client):
    _board(client, "N5", "both", 3, ["vocab"])
    cards = client.get("/api/today/cards?count=10").json()["cards"]
    assert len(cards) == 3
    first = cards[0]
    r = client.post("/api/today/review", json={"card_id": first["card_id"], "mode": first["mode"], "quality": 4})
    assert r.status_code == 200
    today = client.get("/api/today").json()
    assert today["pace"] == {"target": 3, "newToday": 1, "remaining": 2}
    assert today["total"] == 2
    left = client.get("/api/today/cards?count=10").json()["cards"]
    assert len(left) == 2
    assert first["card_id"] not in {c["card_id"] for c in left}


def test_no_target_no_ration(client):
    # An account that never boarded, or set no pace: the queue is the
    # reviews-only queue it always was.
    from routes.profile import ensure_profile_row
    ensure_profile_row(RATION_USER)
    today = client.get("/api/today").json()
    assert today["total"] == 0 and today["lanes"] == []
    assert client.get("/api/today/cards").json()["cards"] == []


def test_only_serves_that_card_and_no_ration(client):
    _board(client, "N5", "both", 5, ["vocab"])
    assert client.get("/api/today/cards?only=vocab_N5_駅_えき").json()["cards"] == []


# ── 教順 — the ration in teaching order (plan 186a) ──────────────

def test_the_ration_deals_each_deck_in_the_order_it_teaches(client):
    # A random draw once dealt 〜なければなりません before は. The rules
    # now come in the catalogue's order, the words and kanji commonest
    # first. An N4 learner, since an N5 one rides the basics course
    # first (plan 186e, below).
    from study import teaching_order
    _board(client, "N4", "both", 9, ["vocab", "kanji", "grammar"])
    cards = client.get("/api/today/cards?count=10").json()["cards"]
    by_source = {}
    for c in cards:
        by_source.setdefault(c["source"], []).append(c["card_id"])
    for source, mode in (("vocab", "vocab.flashcard.f2b"), ("kanji", "kanji.flashcard.f2b"),
                         ("grammar", "grammar.flashcard.f2b")):
        assert by_source[source] == teaching_order.raw_ids(source, "N4", mode)[:3], source


def test_the_gate_counts_the_cards_the_run_serves(client):
    # Drawn at random on every request, the cards the gate counted were
    # not the cards the run then served, and a client topping up its
    # queue was dealt cards past the pace. In order, both agree.
    _board(client, "N5", "both", 4, ["vocab", "grammar"])
    first = client.get("/api/today/cards?count=10").json()["cards"]
    again = client.get("/api/today/cards?count=10").json()["cards"]
    assert [c["card_id"] for c in first] == [c["card_id"] for c in again]
    held = ",".join(f'{c["card_id"]}|{c["mode"]}' for c in first)
    assert client.get(f"/api/today/cards?count=10&exclude={held}").json()["cards"] == []


# ── 基礎 — an N5 learner rides the basics course (plan 186e) ───────

def test_the_course_ration_puts_the_basic_hiragana_first_then_the_course_beside_the_other_kana():
    kana = OrderedDict([
        ((SECTION, "kana", "hiragana_basic", "m"), ["a", "i"]),
        ((SECTION, "kana", "katakana_basic", "m"), ["A", "I", "U"]),
    ])
    course = [((SECTION, "grammar", "N5", "g"), "desu"), ((SECTION, "vocab", "N5", "v"), "watashi"),
              ((SECTION, "vocab", "N5", "v"), "gakusei"), ((SECTION, "vocab", "N5", "v"), "sensei")]
    lines = OrderedDict([((SECTION, "vocab", "N5", "v"), ["eki"])])
    # Budget eats the basic hiragana whole first.
    assert list(daily_queue.ration(kana, lines, 2, course=course).values()) == [["a", "i"]]
    # Then the course, one katakana in every three.
    out = daily_queue.ration(kana, lines, 8, course=course)
    assert out[(SECTION, "kana", "hiragana_basic", "m")] == ["a", "i"]
    assert out[(SECTION, "grammar", "N5", "g")] == ["desu"]
    assert out[(SECTION, "vocab", "N5", "v")] == ["watashi", "gakusei", "sensei"]
    assert out[(SECTION, "kana", "katakana_basic", "m")] == ["A", "I"]
    # Once the course and the kana run dry, the lines.
    assert daily_queue.ration(OrderedDict(), lines, 3, course=[])[(SECTION, "vocab", "N5", "v")] == ["eki"]


def _new_ids(cards):
    return [c["card_id"] for c in cards if c["stage"] in (None, "new")]


def test_an_n5_learner_is_dealt_the_first_unit_in_course_order(client):
    from study import basics
    _board(client, "N5", "both", 6, ["vocab", "kanji", "grammar"])
    cards = client.get("/api/today/cards?count=10").json()["cards"]
    first = [raw_id for _, raw_id, _ in basics.sequence()][:6]
    assert sorted(_new_ids(cards)) == sorted(first)
    assert first[:3] == ["grammar_N5_です／だ", "grammar_N5_は", "grammar_N5_か"]
    # Each card names its unit, and the gate the unit the course is at.
    assert {c["basics"]["id"] for c in cards} == {"hajimemashite"}
    assert cards[0]["basics"]["unit"] == 1 and cards[0]["basics"]["of"] == len(basics.units())
    status = client.get("/api/today").json()["basics"]
    assert status["done"] is False and status["unit"] == 1 and status["title"]["fr"] == "Enchanté"


def test_the_course_follows_the_learners_lines(client):
    _board(client, "N5", "both", 6, ["vocab"])
    cards = client.get("/api/today/cards?count=10").json()["cards"]
    assert {c["source"] for c in cards} == {"vocab"}
    assert _new_ids(cards)[0] == "vocab_N5_私_わたし"


def test_a_novice_rides_the_basic_hiragana_before_the_course(client):
    _board(client, "N5", "none", 5, ["vocab", "grammar"])
    cards = client.get("/api/today/cards?count=10").json()["cards"]
    assert {c["source"] for c in cards} == {"kana"}
    assert all("basics" not in c for c in cards)


def test_a_learner_above_n5_never_rides_the_course(client):
    _board(client, "N4", "both", 4, ["vocab", "grammar"])
    cards = client.get("/api/today/cards?count=10").json()["cards"]
    assert all(c["card_id"].startswith(("vocab_N4_", "grammar_N4_")) for c in cards)
    assert all("basics" not in c for c in cards)
    assert client.get("/api/today").json()["basics"] is None


def test_a_met_unit_gives_way_to_the_next(client):
    # Meet every card of unit 1 in the learner's lines; the gate moves
    # to unit 2 and the ration starts there.
    from study import basics
    _board(client, "N5", "both", 50, ["grammar", "vocab"])
    first = basics.units()[0]
    for source in ("grammar", "vocab"):
        for raw_id in first["cards"][source]:
            r = client.post("/api/today/review", json={"card_id": raw_id, "mode": f"{source}.flashcard.f2b", "quality": 4})
            assert r.status_code == 200, r.text
    status = client.get("/api/today").json()["basics"]
    assert status["unit"] == 2 and status["id"] == "kore-sore"
    cards = client.get("/api/today/cards?count=5").json()["cards"]
    assert _new_ids(cards)[0] == "grammar_N5_これ／それ／あれ／どれ"
