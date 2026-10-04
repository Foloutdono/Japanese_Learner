"""
止 — where the credits stopped a learner, and the offer's week (plan 172).

The offer a free learner is shown when a run stops at zero draws their
last seven days: the paid reviews of each day (the ledger's fares) and
the reviews that waited for the balance (credit_stops). One rule each:
shadow mode writes a stop for every review it would have refused, and
only for what the balance could not cover; the app's own stop (what a
run stopped under enforcement left) is clamped to a count and never
names a card; the week is seven local days, oldest first, the
learner's clock deciding which day a review fell on; and the stops are
in the account's deletion plan.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from core import credits
from core.db import db_conn
from routes.account import PLAN, delete_user_rows


@pytest.fixture
def uid():
    user = f"probe-{uuid.uuid4()}"
    yield user
    credits.forget(user)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            delete_user_rows(cur, user)
        conn.commit()
    finally:
        conn.close()


def _stops(user):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT cards FROM credit_stops WHERE user_id = %s ORDER BY id", (user,))
            return [r[0] for r in cur.fetchall()]
    finally:
        conn.close()


def _set_tz(user, minutes):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE user_profiles SET tz_offset_min = %s WHERE user_id = %s", (minutes, user))
        conn.commit()
    finally:
        conn.close()
    credits.forget(user)


def _backdate_stop(user, cards, at):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO credit_stops (user_id, cards, at) VALUES (%s, %s, %s)", (user, cards, at))
        conn.commit()
    finally:
        conn.close()


def _today(week):
    return week["days"][-1]


def test_shadow_mode_writes_a_stop_for_each_review_it_would_have_refused(uid):
    credits.summary(uid)
    credits.grant(uid, -credits.SIGNUP_BONUS + 1, "test")  # 1 credit left
    credits.spend(uid, 1, "c1")            # paid: no stop
    assert _stops(uid) == []
    credits.spend(uid, 1, "c2")            # refused in shadow: one waits
    credits.spend(uid, 1, "c3")
    assert _stops(uid) == [1, 1]
    # Three with two left: the two are charged, one waits.
    credits.grant(uid, 2, "test")
    credits.spend(uid, 3, "c4")
    assert _stops(uid) == [1, 1, 1]

    w = credits.week(uid)
    assert _today(w) == {"date": _today(w)["date"], "reviewed": 3, "waited": 3}
    assert w["stops"] == 1 and w["waited"] == 3
    assert w["cap"] == credits.DAILY_REFILL


def test_a_pass_never_stops(uid):
    credits.summary(uid)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE user_profiles SET plan = 'pass' WHERE user_id = %s", (uid,))
        conn.commit()
    finally:
        conn.close()
    credits.forget(uid)
    credits.spend(uid, 5, "c1")
    assert _stops(uid) == []


def test_the_apps_stop_is_a_clamped_count(uid):
    credits.summary(uid)
    assert credits.record_stop(uid, 12) == 12
    assert credits.record_stop(uid, 0) == 1
    assert credits.record_stop(uid, 10_000) == credits.STOP_MAX
    assert _stops(uid) == [12, 1, credits.STOP_MAX]


def test_the_week_is_seven_local_days_oldest_first(uid):
    credits.summary(uid)
    now = datetime(2026, 9, 30, 23, 30, tzinfo=timezone.utc)
    # Two hours east of UTC: 23:30 UTC is already the 1st of October.
    _set_tz(uid, 120)
    _backdate_stop(uid, 5, now)                                  # 1 Oct, local
    _backdate_stop(uid, 4, now - timedelta(days=2))              # 29 Sep
    _backdate_stop(uid, 9, now - timedelta(days=9))              # out of the week
    w = credits.week(uid, now=now)
    dates = [d["date"] for d in w["days"]]
    assert dates == ["2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28",
                     "2026-09-29", "2026-09-30", "2026-10-01"]
    assert [d["waited"] for d in w["days"]] == [0, 0, 0, 0, 4, 0, 5]
    assert w["stops"] == 2 and w["waited"] == 9


def test_the_routes(client):
    from core.auth import DEV_USER_ID
    r = client.get("/api/credits/week")
    assert r.status_code == 200
    body = r.json()
    assert len(body["days"]) == credits.WEEK_DAYS
    assert set(body) == {"days", "cap", "stops", "waited"}
    before = _stops(DEV_USER_ID)
    try:
        assert client.post("/api/credits/stop", json={"cards": 7}).json() == {"cards": 7}
        assert _stops(DEV_USER_ID) == before + [7]
        # A count, bounded: nothing else is accepted.
        assert client.post("/api/credits/stop", json={"cards": 0}).status_code == 422
        assert client.post("/api/credits/stop", json={"cards": credits.STOP_MAX + 1}).status_code == 422
    finally:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM credit_stops WHERE user_id = %s", (DEV_USER_ID,))
            conn.commit()
        finally:
            conn.close()


def test_the_stops_are_in_the_deletion_plan():
    assert "credit_stops" in [t for t, _c, _w in PLAN]
