# ── An assumption is not history (plan 224) ───────────────────────
# The level rule marks the stops behind a level known on the learner's
# word. Three things followed from treating that guess as history, and
# each is pinned here against the learner it hurt:
#
#   - a check the learner missed was a lapse: difficulty added for
#     good, the mastered interval kept, a grammar point two steps from
#     "mastered" again although it was never learnt;
#   - a check the learner passed was the card's first sighting, and so
#     spent the day's new cards: an N3 boarder answering the morning's
#     N5 checks was served no N3 card that day;
#   - a move down deleted nothing, so the deck moved down to stood
#     mastered, and the day's ration, which deals cards with no row,
#     had nothing to deal: board at N3, move down to N4, Today empty.
#
# On a user of its own, wiped around each test: boarding runs the
# level rule, and its mastered rows must not leak into other suites.
import pytest

import core.user_level as user_level
from core.auth import get_user_id, prefixed
from core.db import db_conn
from core.srs_instance import srs
from main import app
from srs import ladder
from srs.models import CardState
from srs.srs import SRSEngine
from study import card_index, level_rule

AUID = "assumed-test-user"


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
def aclient(client):
    _wipe(AUID)
    previous = app.dependency_overrides.get(get_user_id)
    app.dependency_overrides[get_user_id] = lambda: AUID
    try:
        yield client
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_user_id, None)
        else:
            app.dependency_overrides[get_user_id] = previous
        _wipe(AUID)


def _board(client, level, target=4, lines=("vocab", "kanji")):
    r = client.post("/api/onboarding/complete", json={
        "jlptLevel": level, "dailyNewTarget": target, "kanaKnown": "both", "lines": list(lines),
    })
    assert r.status_code == 200, r.text
    return r.json()


def _first(source, level, n=1):
    mode = level_rule.primary_mode(source)
    return mode, prefixed(card_index.raw_ids(source, level, mode)[:n], AUID)


def _state(card_id, mode) -> CardState:
    return srs._load_state(card_id, mode)


def _log(card_id, mode) -> list[tuple]:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT quality, assumed FROM review_log WHERE card_id = %s AND mode = %s ORDER BY id",
                (card_id, mode),
            )
            return cur.fetchall()
    finally:
        conn.close()


# ── The signature ─────────────────────────────────────────────────
def test_only_a_seeded_row_nobody_answered_reads_as_assumed():
    assert SRSEngine.is_assumed(CardState(card_id="x", mode="m", **SRSEngine.KNOWN_STATE)) is True
    # A card met from new, after its first review, whatever the grade.
    assert SRSEngine.is_assumed(CardState(card_id="x", mode="m")) is False
    met = srs.scheduler.review(CardState(card_id="x", mode="m"), 5)
    assert SRSEngine.is_assumed(met) is False
    # The seeded row once answered, pass or miss.
    passed = srs.scheduler.review(CardState(card_id="x", mode="m", **SRSEngine.KNOWN_STATE), 4)
    assert SRSEngine.is_assumed(passed) is False
    missed = srs.scheduler.review(CardState(card_id="x", mode="m", **SRSEngine.KNOWN_STATE), 1)
    assert SRSEngine.is_assumed(missed) is False


# ── A check missed is a new card, a check passed stays known ──────
def test_a_missed_check_starts_the_card_as_new_not_as_a_lapse(aclient):
    _board(aclient, "N4")
    mode, (card,) = _first("vocab", "N5")
    assert SRSEngine.is_assumed(_state(card, mode))

    srs.review(card, mode, 1)

    after = _state(card, mode)
    fresh = srs.scheduler.review(CardState(card_id=card, mode=mode), 1)
    # Exactly a new card answered wrong once: the learning steps from
    # the first, no difficulty added, no mastered interval left behind.
    assert (after.is_learning, after.learning_step, after.interval_days, after.repetitions) == (True, 0, 0, 0)
    assert after.difficulty == fresh.difficulty == SRSEngine.KNOWN_STATE["difficulty"]
    assert after.stability == fresh.stability == 0
    assert after.total_reviews == 1
    assert srs.get_bulk_stats([card], mode)[card] == "learning"
    assert _log(card, mode) == [(1, True)]
    # Its next answer is an ordinary review, never a check again.
    srs.review(card, mode, 4)
    assert _log(card, mode) == [(1, True), (4, False)]


def test_a_passed_check_keeps_the_card_known_and_grows_it(aclient):
    _board(aclient, "N4")
    mode, (card,) = _first("kanji", "N5")

    srs.review(card, mode, 4)

    after = _state(card, mode)
    assert after.is_learning is False and after.interval_days > SRSEngine.KNOWN_STATE["interval_days"]
    assert srs.get_bulk_stats([card], mode)[card] == "mastered"
    assert _log(card, mode) == [(4, True)]


def test_a_missed_check_on_a_grammar_point_walks_the_whole_ladder(aclient):
    _board(aclient, "N4", lines=("grammar",))
    mode, (card,) = _first("grammar", "N5")
    assert mode == ladder.LADDER_MODE
    assert ladder.step_of(_state(card, mode)) == ladder.MASTERED

    srs.review(card, mode, 1)

    # Choisir from its first step -- not the relapse, which would have
    # had a point the learner never learnt mastered after two passes.
    assert ladder.step_of(_state(card, mode)) == ladder.PICK[0]


# ── The pace ──────────────────────────────────────────────────────
def test_a_check_passed_spends_no_new_card_and_a_check_missed_does(aclient):
    _board(aclient, "N3")
    mode, cards = _first("vocab", "N5", 3)
    before = srs.get_new_items_today(AUID)

    srs.review(cards[0], mode, 4)
    srs.review(cards[1], mode, 3)
    assert srs.get_new_items_today(AUID) == before

    # Missed, the card is met today: the day's new cards pay for it,
    # as for any card the learner starts to learn.
    srs.review(cards[2], mode, 1)
    assert srs.get_new_items_today(AUID) == before + 1
    _pairs, met = srs.get_reviewed_today(AUID)
    assert met == {cards[2]}


def test_the_n3_boarder_who_answered_the_morning_checks_still_gets_new_cards(aclient):
    _board(aclient, "N3", target=4)
    mode, cards = _first("vocab", "N5", 4)
    for card in cards:
        srs.review(card, mode, 4)

    today = aclient.get("/api/today").json()
    new = {(lane["source"], lane["deck"]): lane["new"] for lane in today["lanes"] if lane.get("new")}
    assert sum(new.values()) == 4 and set(new) <= {("vocab", "N3"), ("kanji", "N3")}


# ── A move down gives the assumptions back ────────────────────────
def test_board_at_n3_move_down_to_n4_and_today_deals_n4(aclient):
    _board(aclient, "N3", target=4)
    n4 = sum(len(ids) for _, _, ids in level_rule.known_batches(["N4"]))

    preview = aclient.get("/api/profile/learning/preview", params={"jlptLevel": "N4"}).json()
    # Nothing at N3 had history, so nothing is set aside; every N4
    # assumption goes back.
    assert preview == {"direction": "down", "setAside": 0, "returned": n4, "deleted": 0}

    moved = aclient.patch("/api/profile/learning", json={"jlptLevel": "N4"})
    assert moved.status_code == 200
    assert moved.json()["levelRule"] == preview

    today = aclient.get("/api/today").json()
    by = {(lane["source"], lane["deck"]): lane for lane in today["lanes"]}
    # It was empty: every N4 card stood mastered, and the ration had
    # nothing left to deal.
    assert by[("vocab", "N4")]["new"] == 2 and by[("kanji", "N4")]["new"] == 2
    cards = aclient.get("/api/today/cards", params={"count": 10}).json()["cards"]
    assert len(cards) == 4 and all(c["stage"] == "new" for c in cards)

    # N5 is still behind the level: its assumptions stand.
    mode, (n5,) = _first("vocab", "N5")
    assert SRSEngine.is_assumed(_state(n5, mode))


def test_a_move_down_never_touches_an_answer(aclient):
    _board(aclient, "N3")
    mode, (kept, failed, untouched) = _first("vocab", "N4", 3)
    srs.review(kept, mode, 4)        # a check passed: history
    srs.review(failed, mode, 1)      # a check missed: being learnt

    aclient.patch("/api/profile/learning", json={"jlptLevel": "N5"})

    rows = srs.get_states_for([kept, failed, untouched], [mode])
    assert (kept, mode) in rows and (failed, mode) in rows
    assert (untouched, mode) not in rows
    assert len(_log(kept, mode)) == 1 and len(_log(failed, mode)) == 1
    # And the N5 deck, assumed when the learner said N3, is new again.
    n5_mode, n5 = _first("vocab", "N5", 5)
    assert srs.get_states_for(n5, [n5_mode]) == {}


def test_the_set_aside_figure_counts_history_alone(aclient):
    _board(aclient, "N2")
    mode, (answered, _other) = _first("kanji", "N3", 2)
    srs.review(answered, mode, 4)

    preview = aclient.get("/api/profile/learning/preview", params={"jlptLevel": "N4"}).json()
    assert preview["setAside"] == 1
    n4_n3 = sum(len(ids) for _, _, ids in level_rule.known_batches(["N4", "N3"]))
    assert preview["returned"] == n4_n3 - 1


def test_a_boarding_replayed_lower_is_a_move_down(aclient):
    _board(aclient, "N3", target=4)
    again = _board(aclient, "N4", target=4)
    assert again["levelRule"]["direction"] == "down"
    assert again["levelRule"]["returned"] == sum(len(ids) for _, _, ids in level_rule.known_batches(["N4"]))
    lanes = aclient.get("/api/today").json()["lanes"]
    assert sum(lane["new"] for lane in lanes) == 4

    # Replayed at the same level or higher, it seeds as it always did.
    assert _board(aclient, "N4")["levelRule"]["markedKnown"] == 0
