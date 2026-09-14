# ── /api/stats/report — the service record (plan 085) ────────────
# The statistics screen draws one chart, retention by week, off the
# daily rows this endpoint returns. The things worth pinning are the
# ones that would print a wrong percentage rather than fail:
#
#   * a day's reviews and its good-or-better count add BOTH halves —
#     the live review_log rows and the compacted review_daily rollup —
#     so compaction never moves the line
#   * "good" means quality >= 3 in both halves
#   * a day with nothing is absent, never a zero row (the client folds
#     the sparse rows into weeks and zero-fills there)
#   * the window is REPORT_DAYS of history; a review older than that
#     is not on the chart
#   * the weakest list is sorted lapses first, then accuracy
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest

from core.db import db_conn
from core.srs_instance import srs
from routes.account import delete_user_rows
from routes.stats import REPORT_DAYS

MODE = "vocab.flashcard.f2b"


def _uid():
    return f"report-test-{uuid.uuid4()}"


def _seed_log(uid, rows):
    """rows: (card, days_ago, quality). Straight into review_log so the
    timestamps can be historical."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for card, days_ago, quality in rows:
                at = (datetime.now(timezone.utc) - timedelta(days=days_ago)).replace(
                    hour=12, minute=0, second=0, microsecond=0
                )
                cur.execute("INSERT INTO cards(id) VALUES (%s) ON CONFLICT DO NOTHING",
                            (f"{uid}:{card}",))
                cur.execute(
                    "INSERT INTO review_log(card_id, mode, quality, xp_earned, reviewed_at) "
                    "VALUES (%s, %s, %s, %s, %s)",
                    (f"{uid}:{card}", MODE, quality, 1, at),
                )
        conn.commit()
    finally:
        conn.close()


def _seed_rollup(uid, rows):
    """rows: (days_ago, q0..q5) — a compacted day, the way
    scripts/compact_review_log.py leaves it."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for days_ago, *qs in rows:
                day = date.today() - timedelta(days=days_ago)
                cur.execute(
                    "INSERT INTO review_daily(user_id, day, hour, reviews, xp, q0, q1, q2, q3, q4, q5) "
                    "VALUES (%s, %s, 12, %s, 0, %s, %s, %s, %s, %s, %s)",
                    (uid, day, sum(qs), *qs),
                )
        conn.commit()
    finally:
        conn.close()


@pytest.fixture
def uid():
    u = _uid()
    yield u
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            delete_user_rows(cur, u)
        conn.commit()
    finally:
        conn.close()


def _by_date(rows):
    return {r["date"]: r for r in rows}


def test_a_day_adds_its_live_rows_and_its_rollup(uid):
    # Three days ago: two live reviews (one good, one not) AND a rollup
    # of five (four good) — the shape compaction day leaves behind.
    _seed_log(uid, [("a", 3, 4), ("b", 3, 1)])
    _seed_rollup(uid, [(3, 0, 1, 0, 2, 1, 1)])

    rows = srs.get_daily_quality(uid, days=REPORT_DAYS)
    day = (date.today() - timedelta(days=3)).isoformat()
    assert _by_date(rows)[day] == {"date": day, "reviews": 7, "good": 5}


def test_good_means_three_or_better(uid):
    _seed_log(uid, [("a", 1, 0), ("b", 1, 1), ("c", 1, 2), ("d", 1, 3), ("e", 1, 4), ("f", 1, 5)])
    rows = srs.get_daily_quality(uid, days=REPORT_DAYS)
    assert len(rows) == 1
    assert rows[0]["reviews"] == 6
    assert rows[0]["good"] == 3


def test_days_with_nothing_are_absent_and_the_order_is_oldest_first(uid):
    _seed_log(uid, [("a", 1, 4), ("b", 10, 4)])
    rows = srs.get_daily_quality(uid, days=REPORT_DAYS)
    assert [r["reviews"] for r in rows] == [1, 1]
    assert rows[0]["date"] < rows[1]["date"]


def test_the_window_is_the_report_days(uid):
    _seed_log(uid, [("old", REPORT_DAYS + 5, 4), ("recent", 2, 4)])
    _seed_rollup(uid, [(REPORT_DAYS + 5, 0, 0, 0, 3, 0, 0)])
    rows = srs.get_daily_quality(uid, days=REPORT_DAYS)
    assert len(rows) == 1
    assert rows[0]["reviews"] == 1


def test_a_learner_with_no_history_gets_no_rows(uid):
    assert srs.get_daily_quality(uid, days=REPORT_DAYS) == []


def test_the_report_shape(client):
    r = client.get("/api/stats/report")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"days", "strength", "weakest"}
    assert isinstance(body["days"], list)
    assert isinstance(body["strength"], list)
    assert isinstance(body["weakest"], list)
    for w in body["weakest"]:
        assert {"card_id", "mode", "accuracy", "lapses", "raw_id", "category", "key"} <= set(w)


def test_the_weakest_are_lapses_first_then_accuracy(client):
    body = client.get("/api/stats/report").json()
    keys = [(-w["lapses"], w["accuracy"]) for w in body["weakest"]]
    assert keys == sorted(keys)


def test_the_extra_endpoint_is_gone(client):
    assert client.get("/api/stats/extra").status_code == 404
