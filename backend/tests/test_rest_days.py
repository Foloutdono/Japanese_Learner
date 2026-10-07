"""運休 — rest days (plan 191).

A rest ticket is earned on clearing a milestone day of seven or more,
two held at most. A missed day is bridged lazily -- by GET /api/today,
POST /api/today/clear and GET /api/profile -- when the learner holds a
ticket for every day missed since they last showed up: the streak walks
through a bridged day without counting it. More days missed than
tickets held, and nothing is spent: the streak is broken.

Histories are review_log rows with explicit timestamps, on a learner of
the test's own, erased after it with routes/account.py's deletion.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest

import core.user_level as user_level
from core.db import db_conn
from core.srs_instance import srs
from routes.account import delete_user_rows
from srs.srs import WEEKDAY_KANJI, streak_of
from tests.conftest import acting_as

F2B = "vocab.flashcard.f2b"
CARD = "vocab_N5_水_みず"


@pytest.fixture
def learner():
    uid = f"rest-test-{uuid.uuid4()}"
    yield uid
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            delete_user_rows(cur, uid)
            cur.execute("DELETE FROM event_log WHERE user_id = %s", (uid,))
        conn.commit()
    finally:
        conn.close()
    user_level._cache.pop(uid, None)


def _today():
    return datetime.now(timezone.utc).date()


def _ago(n):
    return _today() - timedelta(days=n)


def _studied(uid, days_ago):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for back in days_ago:
                cur.execute(
                    "INSERT INTO review_log (card_id, mode, quality, xp_earned, reviewed_at) "
                    "VALUES (%s, %s, 4, 7, %s)",
                    (f"{uid}:{CARD}", F2B, datetime.now(timezone.utc) - timedelta(days=back)),
                )
        conn.commit()
    finally:
        conn.close()


def _ticket(uid, earned_ago, milestone=7, used_ago=None):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO rest_tickets (user_id, earned_on, milestone, used_on) VALUES (%s, %s, %s, %s)",
                (uid, _ago(earned_ago), milestone, None if used_ago is None else _ago(used_ago)),
            )
        conn.commit()
    finally:
        conn.close()


def _tickets(uid):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT used_on, seen_at IS NOT NULL FROM rest_tickets WHERE user_id = %s ORDER BY id", (uid,))
            return cur.fetchall()
    finally:
        conn.close()


def _events(uid, name):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT props FROM event_log WHERE user_id = %s AND name = %s ORDER BY id", (uid, name))
            return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()


# ── The walk ─────────────────────────────────────────────────────

def test_a_bridged_day_keeps_the_streak_without_counting():
    today = _today()
    studied = {today - timedelta(days=n) for n in (0, 2, 3, 4)}
    rested = {today - timedelta(days=1)}
    assert streak_of(studied, rested, today) == {"current": 4, "longest": 4}
    # Unbridged, the same days are two streaks.
    assert streak_of(studied, set(), today) == {"current": 1, "longest": 3}
    # Today not yet studied, the streak still stands through yesterday's
    # rest day until tonight.
    assert streak_of(studied - {today}, rested, today) == {"current": 3, "longest": 3}
    # No study at all is no streak, whatever a rest day says.
    assert streak_of(set(), rested, today) == {"current": 0, "longest": 0}


def test_the_longest_streak_walks_through_rest_days_too():
    today = _today()
    old = {today - timedelta(days=n) for n in (20, 21, 23, 24, 25)}
    assert streak_of(old, {today - timedelta(days=22)}, today)["longest"] == 5
    assert streak_of(old, set(), today)["longest"] == 3


# ── The bridge ───────────────────────────────────────────────────

def test_a_single_missed_day_is_bridged_by_a_held_ticket(client, learner):
    # Eight days, then yesterday missed, today not yet studied.
    _studied(learner, range(2, 10))
    _ticket(learner, earned_ago=4)
    assert srs.get_streak(learner)["current"] == 0

    with acting_as(learner):
        today = client.get("/api/today").json()
    yesterday = _ago(1)
    assert _tickets(learner) == [(yesterday, False)]
    # The streak continues, its count not moved by the rest day.
    assert today["rest"] == {"held": 0, "unseen": [yesterday.isoformat()], "streak": 8, "next_at": 14}
    assert today["day_clear"]["preview"]["streak"] == 9
    assert _events(learner, "rest_day_used") == [{"days": 1}]

    # The bridge is idempotent: a second visit spends nothing more.
    with acting_as(learner):
        again = client.get("/api/today").json()
    assert again["rest"]["unseen"] == [yesterday.isoformat()]
    assert len(_events(learner, "rest_day_used")) == 1

    # Seen, it is not shown again.
    with acting_as(learner):
        assert client.post("/api/today/rest/seen").json() == {"ok": True}
        seen = client.get("/api/today").json()
    assert seen["rest"]["unseen"] == []
    assert _tickets(learner) == [(yesterday, True)]

    # Studied today, the streak is nine: the rest day kept it, uncounted.
    _studied(learner, [0])
    assert srs.get_streak(learner) == {"current": 9, "longest": 9}


def test_two_missed_days_with_one_ticket_break_the_streak(client, learner):
    _studied(learner, range(3, 10))
    _ticket(learner, earned_ago=3)
    with acting_as(learner):
        today = client.get("/api/today").json()
    # No ticket spent: one cannot keep a streak two days missed broke.
    assert _tickets(learner) == [(None, False)]
    assert today["rest"]["held"] == 1
    assert today["rest"]["unseen"] == []
    assert today["rest"]["streak"] == 0
    assert today["day_clear"]["preview"]["streak"] == 1
    assert _events(learner, "rest_day_used") == []
    # And it stays unspent the day after, three days missed.
    assert srs.bridge_rest_days(learner) == []


def test_two_missed_days_with_two_tickets_are_both_bridged(learner):
    _studied(learner, range(3, 10))
    _ticket(learner, earned_ago=10, milestone=7)
    _ticket(learner, earned_ago=3, milestone=14)
    assert srs.bridge_rest_days(learner) == [_ago(2), _ago(1)]
    assert srs.rest_held(learner) == 0
    assert srs.get_streak(learner)["current"] == 7
    assert srs.bridge_rest_days(learner) == []


def test_no_day_missed_spends_nothing(learner):
    _studied(learner, range(1, 9))
    _ticket(learner, earned_ago=2)
    assert srs.bridge_rest_days(learner) == []
    assert srs.rest_held(learner) == 1


def test_the_profile_and_the_clear_bridge_too(client, learner):
    _studied(learner, range(2, 10))
    _ticket(learner, earned_ago=3)
    with acting_as(learner):
        profile = client.get("/api/profile").json()
    assert profile["streak"] == 8
    assert profile["restHeld"] == 0
    assert _tickets(learner) == [(_ago(1), False)]

    other = f"{learner}-b"
    try:
        _studied(other, range(2, 10))
        _ticket(other, earned_ago=3)
        _studied(other, [0])
        with acting_as(other):
            body = client.post("/api/today/clear").json()
        assert body["cleared"] is True
        assert body["streak"] == 9
        assert [d["state"] for d in body["week"]][-3:] == ["studied", "rest", "studied"]
    finally:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                delete_user_rows(cur, other)
                cur.execute("DELETE FROM event_log WHERE user_id = %s", (other,))
            conn.commit()
        finally:
            conn.close()


# ── The week row ─────────────────────────────────────────────────

def test_the_week_row_names_each_day_and_its_state(learner):
    _studied(learner, [6, 5, 4, 1])
    _ticket(learner, earned_ago=20, used_ago=2)
    row = srs.week_row(learner)
    assert [d["day"] for d in row] == [_ago(n).isoformat() for n in range(6, -1, -1)]
    assert [d["kanji"] for d in row] == [WEEKDAY_KANJI[_ago(n).weekday()] for n in range(6, -1, -1)]
    assert [d["state"] for d in row] == ["studied", "studied", "studied", "missed", "rest", "studied", "today"]
    _studied(learner, [0])
    assert srs.week_row(learner)[-1]["state"] == "studied"


def test_the_weekday_kanji_start_on_monday():
    assert WEEKDAY_KANJI == "月火水木金土日"
    # 2026-10-06 is a Tuesday.
    assert WEEKDAY_KANJI[datetime(2026, 10, 6).weekday()] == "火"


# ── The profile's week and stamp book ────────────────────────────

def test_the_profile_marks_a_bridged_day_on_its_week_and_calendar(client, learner):
    # Eight days, yesterday missed and bridged on this visit, today studied.
    _studied(learner, [0, *range(2, 10)])
    _ticket(learner, earned_ago=4)
    with acting_as(learner):
        profile = client.get("/api/profile").json()
    yesterday = _ago(1).isoformat()
    week = {d["date"]: d for d in profile["week"]}
    calendar = {d["date"]: d for d in profile["calendar"]}
    # The rest day is an entry of its own, nothing counted on it.
    assert week[yesterday] == {"date": yesterday, "count": 0, "practice": 0, "rest": True}
    assert calendar[yesterday]["rest"] is True
    # A studied day carries no `rest`, and the days stay oldest first.
    assert "rest" not in week[_today().isoformat()]
    assert [d["date"] for d in profile["calendar"]] == sorted(calendar)
    assert profile["streak"] == 9


def test_a_rest_day_outside_the_calendar_is_left_out(client, learner):
    _studied(learner, [0, 1])
    _ticket(learner, earned_ago=60, used_ago=50)
    with acting_as(learner):
        profile = client.get("/api/profile").json()
    assert not any(d.get("rest") for d in profile["calendar"])
    assert srs.get_rest_days(learner, days=60) == [_ago(50).isoformat()]
    assert srs.get_rest_days(learner, days=35) == []
