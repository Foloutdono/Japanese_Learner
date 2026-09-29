"""評価 — asking a learner what they think of the app (routes/rating.py,
plan 167).

Pins the stores' rules as the route keeps them -- in the apps only the
store's own prompt, requested with nothing before it and spaced out;
the web's sheet answered once, "not now" a snooze and three of them a
no -- and what reaches us: the stars and the comment beside a rating,
feedback from Settings at any time, one learner's rows their own.
"""
from datetime import datetime, timedelta, timezone

import pytest

from core.auth import DEV_USER_ID
from core.db import db_conn
from routes import rating
from tests.conftest import OTHER_USER, acting_as

NOW = datetime(2026, 9, 29, 12, tzinfo=timezone.utc)


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
                "SELECT kind, stars, comment, platform, lang FROM app_ratings WHERE user_id = %s ORDER BY id",
                (user,),
            )
            return cur.fetchall()
    finally:
        conn.close()


def _age(user, days):
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


def _prompt(client, platform="web"):
    r = client.get("/api/rating/prompt", params={"platform": platform})
    assert r.status_code == 200
    return r.json()


def _rate(client, **body):
    return client.post("/api/rating", json={"platform": "web", **body})


# ── The rules, pure ───────────────────────────────────────────

@pytest.mark.parametrize("reviews, days, used", [
    (rating.MIN_REVIEWS, rating.MIN_DAYS, True),
    (rating.MIN_REVIEWS - 1, rating.MIN_DAYS, False),
    (rating.MIN_REVIEWS, rating.MIN_DAYS - 1, False),
    (5000, 1, False),     # one long evening is not an opinion of the app
])
def test_enough_use_to_have_an_opinion(reviews, days, used):
    assert rating.used_enough(reviews, days) is used


def test_the_store_prompt_is_spaced_and_bounded():
    soon = NOW - timedelta(days=rating.STORE_EVERY_DAYS - 1)
    later = NOW - timedelta(days=rating.STORE_EVERY_DAYS)
    assert rating.should_ask_store(prompts=0, last_prompt=None, now=NOW)
    assert not rating.should_ask_store(prompts=1, last_prompt=soon, now=NOW)
    assert rating.should_ask_store(prompts=1, last_prompt=later, now=NOW)
    assert not rating.should_ask_store(prompts=rating.MAX_STORE_PROMPTS,
                                       last_prompt=NOW - timedelta(days=999), now=NOW)


def test_the_sheet_is_answered_once_and_put_off_three_times():
    soon = NOW - timedelta(days=rating.SNOOZE_DAYS - 1)
    later = NOW - timedelta(days=rating.SNOOZE_DAYS)
    assert rating.should_ask_sheet(rated=False, put_offs=0, last_put_off=None, now=NOW)
    assert not rating.should_ask_sheet(rated=True, put_offs=0, last_put_off=None, now=NOW)
    assert not rating.should_ask_sheet(rated=False, put_offs=1, last_put_off=soon, now=NOW)
    assert rating.should_ask_sheet(rated=False, put_offs=1, last_put_off=later, now=NOW)
    assert not rating.should_ask_sheet(rated=False, put_offs=rating.MAX_PUT_OFFS,
                                       last_put_off=NOW - timedelta(days=999), now=NOW)


# ── The prompt ────────────────────────────────────────────────

def test_a_new_learner_is_not_asked(client, monkeypatch):
    monkeypatch.setattr(rating.srs, "get_total_reviews", lambda uid: 3)
    monkeypatch.setattr(rating.srs, "count_studied_days", lambda uid: 1)
    assert _prompt(client) == {"ask": False, "how": "sheet"}
    assert _prompt(client, "ios") == {"ask": False, "how": "store"}


@pytest.mark.parametrize("platform", ["ios", "android"])
def test_an_app_asks_the_way_its_store_requires(client, seasoned, platform):
    # The store's own prompt, and nothing of the app's before it.
    assert _prompt(client, platform) == {"ask": True, "how": "store"}
    r = client.post("/api/rating", json={"kind": "store_prompt", "platform": platform})
    assert r.status_code == 200
    assert _rows(DEV_USER_ID) == [("store_prompt", None, None, platform, None)]
    assert _prompt(client, platform)["ask"] is False
    _age(DEV_USER_ID, rating.STORE_EVERY_DAYS)
    assert _prompt(client, platform)["ask"] is True


def test_the_store_prompt_stops_after_its_bound(client, seasoned):
    for _ in range(rating.MAX_STORE_PROMPTS):
        assert _prompt(client, "android")["ask"] is True
        client.post("/api/rating", json={"kind": "store_prompt", "platform": "android"})
        _age(DEV_USER_ID, rating.STORE_EVERY_DAYS)
    assert _prompt(client, "android")["ask"] is False


@pytest.mark.parametrize("body", [
    {"kind": "store_prompt", "platform": "ios", "stars": 5},       # no rating rides a store prompt
    {"kind": "store_prompt", "platform": "web"},                   # the web has no store prompt
    {"kind": "rating", "platform": "android", "stars": 4},         # the apps have no sheet
    {"kind": "put_off", "platform": "ios"},
])
def test_each_platform_is_asked_its_own_way(client, body):
    assert client.post("/api/rating", json=body).status_code == 422
    assert _rows(DEV_USER_ID) == []


# ── The web's sheet ───────────────────────────────────────────

def test_a_rating_is_kept_and_closes_the_question(client, seasoned):
    assert _prompt(client)["ask"] is True
    r = _rate(client, kind="rating", stars=5, lang="fr")
    assert r.status_code == 200 and r.json() == {"ok": True}
    assert _rows(DEV_USER_ID) == [("rating", 5, None, "web", "fr")]
    assert _prompt(client)["ask"] is False
    # A second rating is refused rather than stacked.
    assert _rate(client, kind="rating", stars=4).status_code == 409


def test_under_five_comes_with_what_was_written(client, seasoned):
    r = _rate(client, kind="rating", stars=3, comment="  Les phrases d'exemple sont trop dures.  ", lang="fr")
    assert r.status_code == 200
    assert _rows(DEV_USER_ID) == [("rating", 3, "Les phrases d'exemple sont trop dures.", "web", "fr")]


def test_a_blank_comment_is_no_comment(client):
    assert _rate(client, kind="rating", stars=2, comment="   ").status_code == 200
    assert _rows(DEV_USER_ID) == [("rating", 2, None, "web", None)]


def test_not_now_snoozes_then_asks_again_then_stops(client, seasoned):
    for i in range(rating.MAX_PUT_OFFS):
        assert _prompt(client)["ask"] is True, f"asked on round {i}"
        assert _rate(client, kind="put_off").status_code == 200
        assert _prompt(client)["ask"] is False
        _age(DEV_USER_ID, rating.SNOOZE_DAYS)
    assert _prompt(client)["ask"] is False


@pytest.mark.parametrize("body", [
    {"kind": "rating"},
    {"kind": "rating", "stars": 0},
    {"kind": "rating", "stars": 6},
    {"kind": "put_off", "comment": "a comment with no rating"},
    {"kind": "put_off", "stars": 3},
    {"kind": "rating", "stars": 3, "comment": "x" * (rating.MAX_COMMENT + 1)},
    {"kind": "rating", "stars": 3, "platform": "windows"},
    {"kind": "rating", "stars": 3, "lang": "de"},
    {"kind": "opinion", "stars": 3},
])
def test_malformed_answers_are_refused(client, body):
    assert _rate(client, **body).status_code == 422
    assert _rows(DEV_USER_ID) == []


def test_one_client_in_a_loop_is_bounded(client):
    for _ in range(rating.MAX_ROWS):
        assert _rate(client, kind="put_off").status_code == 200
    assert _rate(client, kind="put_off").status_code == 429


# ── Feedback, from Settings ───────────────────────────────────

def test_feedback_reaches_us_from_any_platform(client):
    for platform in ("ios", "android", "web"):
        r = client.post("/api/feedback", json={"comment": f" from {platform} ", "platform": platform, "lang": "en"})
        assert r.status_code == 200
    assert _rows(DEV_USER_ID) == [
        ("feedback", None, "from ios", "ios", "en"),
        ("feedback", None, "from android", "android", "en"),
        ("feedback", None, "from web", "web", "en"),
    ]


def test_feedback_is_not_a_rating(client, seasoned):
    client.post("/api/feedback", json={"comment": "the kana audio is quiet", "platform": "web"})
    # Writing to us is not an answer to the sheet, nor counted against it.
    assert _prompt(client)["ask"] is True
    assert _rate(client, kind="rating", stars=4).status_code == 200


@pytest.mark.parametrize("comment", ["", "   ", "x" * (rating.MAX_COMMENT + 1)])
def test_feedback_has_words(client, comment):
    assert client.post("/api/feedback", json={"comment": comment, "platform": "web"}).status_code == 422
    assert _rows(DEV_USER_ID) == []


def test_feedback_is_bounded_by_the_day(client):
    for i in range(rating.FEEDBACK_PER_DAY):
        assert client.post("/api/feedback", json={"comment": f"note {i}", "platform": "web"}).status_code == 200
    assert client.post("/api/feedback", json={"comment": "one more", "platform": "web"}).status_code == 429
    _age(DEV_USER_ID, 1)
    assert client.post("/api/feedback", json={"comment": "tomorrow", "platform": "web"}).status_code == 200


def test_one_learners_rows_are_theirs(client, seasoned):
    assert _rate(client, kind="rating", stars=5).status_code == 200
    with acting_as(OTHER_USER):
        assert _prompt(client)["ask"] is True
        assert _rate(client, kind="rating", stars=4, comment="more kanji").status_code == 200
    assert _rows(DEV_USER_ID) == [("rating", 5, None, "web", None)]
    assert _rows(OTHER_USER) == [("rating", 4, "more kanji", "web", None)]
