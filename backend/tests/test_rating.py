"""評価 — the app's rating sheet (routes/rating.py, plan 167).

Pins the rule for who is asked -- enough use to have an opinion, never
twice, "not now" a snooze and three of them a no -- and what an answer
stores: the stars, the comment only beside a rating, one learner's rows
their own.
"""
from datetime import datetime, timedelta, timezone

import pytest

from core.auth import DEV_USER_ID
from core.db import db_conn
from routes import rating
from tests.conftest import OTHER_USER, acting_as

NOW = datetime(2026, 9, 29, 12, tzinfo=timezone.utc)
USED = dict(reviews=rating.MIN_REVIEWS, days=rating.MIN_DAYS)


def _wipe(*users):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for user in users:
                cur.execute("DELETE FROM app_ratings WHERE user_id = %s", (user,))
        conn.commit()
    finally:
        conn.close()


def _rows(user):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT stars, comment, platform, lang FROM app_ratings WHERE user_id = %s ORDER BY id",
                (user,),
            )
            return cur.fetchall()
    finally:
        conn.close()


def _age_put_offs(user, days):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE app_ratings SET at = at - (%s || ' days')::interval WHERE user_id = %s",
                (days, user),
            )
        conn.commit()
    finally:
        conn.close()


@pytest.fixture(autouse=True)
def clean():
    _wipe(DEV_USER_ID, OTHER_USER)
    yield
    _wipe(DEV_USER_ID, OTHER_USER)


@pytest.fixture
def seasoned(monkeypatch):
    """A learner past both thresholds, whatever the test database holds."""
    monkeypatch.setattr(rating.srs, "get_total_reviews", lambda uid: rating.MIN_REVIEWS)
    monkeypatch.setattr(rating.srs, "count_studied_days", lambda uid: rating.MIN_DAYS)


def _ask(client):
    r = client.get("/api/rating/prompt")
    assert r.status_code == 200
    return r.json()["ask"]


def _answer(client, **body):
    return client.post("/api/rating", json={"platform": "android", **body})


# ── The rule, pure ────────────────────────────────────────────

def test_a_learner_past_both_thresholds_is_asked():
    assert rating.should_ask(rated=False, put_offs=0, last_put_off=None, now=NOW, **USED)


@pytest.mark.parametrize("reviews, days", [
    (rating.MIN_REVIEWS - 1, rating.MIN_DAYS),
    (rating.MIN_REVIEWS, rating.MIN_DAYS - 1),
    (5000, 1),     # one long evening is not an opinion of the app
])
def test_too_little_use_is_not_asked(reviews, days):
    assert not rating.should_ask(rated=False, put_offs=0, last_put_off=None,
                                 reviews=reviews, days=days, now=NOW)


def test_a_rating_is_never_asked_for_again():
    assert not rating.should_ask(rated=True, put_offs=0, last_put_off=None, now=NOW, **USED)


def test_not_now_is_a_snooze():
    just = NOW - timedelta(days=rating.SNOOZE_DAYS - 1)
    later = NOW - timedelta(days=rating.SNOOZE_DAYS)
    assert not rating.should_ask(rated=False, put_offs=1, last_put_off=just, now=NOW, **USED)
    assert rating.should_ask(rated=False, put_offs=1, last_put_off=later, now=NOW, **USED)


def test_three_put_offs_are_a_no():
    long_ago = NOW - timedelta(days=365)
    assert not rating.should_ask(rated=False, put_offs=rating.MAX_PUT_OFFS,
                                 last_put_off=long_ago, now=NOW, **USED)


# ── The routes ────────────────────────────────────────────────

def test_a_new_learner_is_not_asked(client, monkeypatch):
    monkeypatch.setattr(rating.srs, "get_total_reviews", lambda uid: 3)
    monkeypatch.setattr(rating.srs, "count_studied_days", lambda uid: 1)
    assert _ask(client) is False


def test_a_five_goes_to_the_store_and_closes_the_question(client, seasoned):
    assert _ask(client) is True
    r = _answer(client, stars=5, lang="fr")
    assert r.status_code == 200
    assert r.json() == {"ok": True, "store": True}
    assert _rows(DEV_USER_ID) == [(5, None, "android", "fr")]
    assert _ask(client) is False
    # A second rating is refused rather than stacked.
    assert _answer(client, stars=4).status_code == 409


def test_under_five_stays_here_with_what_was_written(client, seasoned):
    r = _answer(client, stars=3, comment="  Les phrases d'exemple sont trop dures.  ", platform="ios", lang="fr")
    assert r.status_code == 200
    assert r.json()["store"] is False
    assert _rows(DEV_USER_ID) == [(3, "Les phrases d'exemple sont trop dures.", "ios", "fr")]
    assert _ask(client) is False


def test_a_blank_comment_is_no_comment(client, seasoned):
    assert _answer(client, stars=2, comment="   ").status_code == 200
    assert _rows(DEV_USER_ID) == [(2, None, "android", None)]


def test_not_now_snoozes_then_asks_again_then_stops(client, seasoned):
    for i in range(rating.MAX_PUT_OFFS):
        assert _ask(client) is True, f"asked on round {i}"
        assert _answer(client, stars=None).json() == {"ok": True, "store": False}
        assert _ask(client) is False
        _age_put_offs(DEV_USER_ID, rating.SNOOZE_DAYS)
    # Three put-offs: the question has been answered.
    assert _ask(client) is False


@pytest.mark.parametrize("body", [
    {"stars": 0},
    {"stars": 6},
    {"stars": None, "comment": "a comment with no rating"},
    {"stars": 3, "comment": "x" * (rating.MAX_COMMENT + 1)},
    {"stars": 3, "platform": "windows"},
    {"stars": 3, "lang": "de"},
])
def test_malformed_answers_are_refused(client, body):
    assert _answer(client, **body).status_code == 422
    assert _rows(DEV_USER_ID) == []


def test_one_client_in_a_loop_is_bounded(client):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for _ in range(rating.MAX_ROWS):
                cur.execute(
                    "INSERT INTO app_ratings (user_id, stars, platform) VALUES (%s, NULL, 'web')",
                    (DEV_USER_ID,),
                )
        conn.commit()
    finally:
        conn.close()
    assert _answer(client, stars=None).status_code == 429


def test_one_learners_answer_is_theirs(client, seasoned):
    assert _answer(client, stars=5).status_code == 200
    with acting_as(OTHER_USER):
        assert _ask(client) is True
        assert _answer(client, stars=4, comment="more kanji").status_code == 200
    assert _rows(DEV_USER_ID) == [(5, None, "android", None)]
    assert _rows(OTHER_USER) == [(4, "more kanji", "android", None)]
