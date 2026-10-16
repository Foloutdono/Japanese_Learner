# ── Does the level fit? (plan 221) ────────────────────────────────
# study/level_fit reads two things the learner's answers already say:
# the level rule's checks behind the level (mostly failed: board lower)
# and the level's words the first time they are asked (nearly all known:
# try higher).
# The verdict is pure and pinned case by case; the endpoint runs on a
# user of its own, through real reviews, wiped around each test.
import pytest

import core.user_level as user_level
from core.auth import get_user_id, prefixed
from core.db import db_conn
from core.srs_instance import srs
from main import app
from study import card_index, level_fit, level_rule
from study.level_fit import MIN_CHECKS, MIN_WORDS, verdict

FUID = "level-fit-test-user"


# ── The verdict ───────────────────────────────────────────────────
def test_no_evidence_no_suggestion():
    assert verdict("N3", {}, (0, 0)) == {"suggest": None, "to": None}
    assert verdict(None, {}, (0, 0)) == {"suggest": None, "to": None}


def test_a_stop_behind_whose_checks_mostly_fail_is_where_to_board():
    n = MIN_CHECKS
    assert verdict("N3", {"N5": (n, n), "N4": (3, n)}, (0, 0)) == {"suggest": "down", "to": "N4"}
    # The lowest failing stop wins: told once, not one stop at a time.
    assert verdict("N3", {"N5": (4, n), "N4": (3, n)}, (0, 0)) == {"suggest": "down", "to": "N5"}
    # Too few answers is no verdict, however they went.
    assert verdict("N3", {"N4": (0, n - 1)}, (0, 0)) == {"suggest": None, "to": None}
    # A stop the learner stands on loses a few words, not half.
    assert verdict("N3", {"N4": (8, n)}, (0, 0)) == {"suggest": None, "to": None}


def test_words_known_when_first_asked_point_up_unless_something_behind_gives():
    m = MIN_WORDS
    assert verdict("N5", {}, (m, m)) == {"suggest": "up", "to": "N4"}
    assert verdict("N4", {}, (m - 1, m - 1)) == {"suggest": None, "to": None}
    assert verdict("N4", {}, (int(m * 0.7), m)) == {"suggest": None, "to": None}
    # Checks behind that merely hold are not enough to send them higher.
    assert verdict("N4", {"N5": (9, MIN_CHECKS)}, (m, m)) == {"suggest": None, "to": None}
    # And N1 has nowhere higher.
    assert verdict("N1", {}, (m, m)) == {"suggest": None, "to": None}


def test_tally_keeps_the_stops_behind_the_level_alone():
    rows = [
        ("vocab_N5_駅_えき", 4), ("kanji_N5_山", 1), ("grammar_N4_ながら", 3),
        ("kana_あ", 1),                 # the kana door: no JLPT stop
        ("vocab_N3_到着_とうちゃく", 1),  # at the level, not behind it
    ]
    assert level_fit.tally_checks(rows, "N3") == {"N5": (1, 2), "N4": (1, 1)}
    assert level_fit.tally_checks(rows, "N5") == {}


# ── The spread asks every stop behind from the first day ──────────
def test_the_checks_deal_the_stops_in_turn():
    mode = level_rule.primary_mode("vocab")
    n5 = card_index.raw_ids("vocab", "N5", mode)
    n4 = card_index.raw_ids("vocab", "N4", mode)
    (_, _, ids), *_ = level_rule.known_batches(["N5", "N4"])
    assert ids[:4] == [n5[0], n4[0], n5[1], n4[1]]
    assert set(ids) == set(n5) | set(n4)
    # One stop alone is its deck order, as it always was.
    (_, _, alone), *_ = level_rule.known_batches(["N5"])
    assert alone == list(dict.fromkeys(n5))


# ── The endpoint ──────────────────────────────────────────────────
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
def fclient(client):
    _wipe(FUID)
    previous = app.dependency_overrides.get(get_user_id)
    app.dependency_overrides[get_user_id] = lambda: FUID
    try:
        yield client
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_user_id, None)
        else:
            app.dependency_overrides[get_user_id] = previous
        _wipe(FUID)


def _board(client, level):
    r = client.post("/api/onboarding/complete", json={
        "jlptLevel": level, "dailyNewTarget": 10, "kanaKnown": "both",
    })
    assert r.status_code == 200, r.text


def _cards(source, level, n, start=0):
    mode = level_rule.primary_mode(source)
    return mode, prefixed(card_index.raw_ids(source, level, mode)[start:start + n], FUID)


def test_a_learner_who_never_boarded_is_told_nothing(fclient):
    fit = fclient.get("/api/profile/level-fit").json()
    assert fit["suggest"] is None and fit["checks"] == [] and fit["words"] == {"known": 0, "met": 0}


def test_an_n3_boarder_failing_the_n4_checks_is_shown_n4(fclient):
    _board(fclient, "N3")
    mode, n5 = _cards("vocab", "N5", MIN_CHECKS)
    for card in n5:
        srs.review(card, mode, 4)
    mode, n4 = _cards("vocab", "N4", MIN_CHECKS)
    for i, card in enumerate(n4):
        srs.review(card, mode, 4 if i < 3 else 1)

    fit = fclient.get("/api/profile/level-fit").json()
    assert (fit["level"], fit["suggest"], fit["to"]) == ("N3", "down", "N4")
    assert fit["checks"] == [
        {"level": "N5", "passed": MIN_CHECKS, "answered": MIN_CHECKS},
        {"level": "N4", "passed": 3, "answered": MIN_CHECKS},
    ]

    # Taken, the move gives N4 back as new cards, and the watch says
    # nothing more: N5 held.
    fclient.patch("/api/profile/learning", json={"jlptLevel": "N4"})
    fit = fclient.get("/api/profile/level-fit").json()
    assert (fit["level"], fit["suggest"]) == ("N4", None)
    assert fit["checks"] == [{"level": "N5", "passed": MIN_CHECKS, "answered": MIN_CHECKS}]


def test_an_n5_learner_who_knows_every_new_word_is_shown_n4(fclient):
    _board(fclient, "N5")
    mode, words = _cards("vocab", "N5", MIN_WORDS)
    for card in words:
        srs.review(card, mode, 4)
    # A second answer to a word is no first answer.
    srs.review(words[0], mode, 1)

    fit = fclient.get("/api/profile/level-fit").json()
    assert (fit["suggest"], fit["to"]) == ("up", "N4")
    assert fit["words"] == {"known": MIN_WORDS, "met": MIN_WORDS}


def test_checks_are_no_first_answers(fclient):
    # An N4 boarder's checks at N5, answered well, say N5 holds; they
    # never count as N4 words known when first asked.
    _board(fclient, "N4")
    mode, n5 = _cards("vocab", "N5", MIN_WORDS)
    for card in n5:
        srs.review(card, mode, 4)
    fit = fclient.get("/api/profile/level-fit").json()
    assert fit["suggest"] is None
    assert fit["words"] == {"known": 0, "met": 0}
    assert fit["checks"] == [{"level": "N5", "passed": MIN_WORDS, "answered": MIN_WORDS}]
