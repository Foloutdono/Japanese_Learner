"""連続 — the daily streak counts the practice modes (plan 178).

A graded reading sentence, translation, dictation line, composition,
comprehension text or mock-exam paper that schedules no card pays its
fare as an xp_ledger row and never as a review_log row. The streak was
read off review_log alone, so a learner who spent a day on those -- and
had no card due -- broke it. These rows are what the streak and the
stamp book now read as a day shown up.
"""
from datetime import datetime, timedelta, timezone

from core.db import db_conn
from core.srs_instance import srs
from tests.conftest import acting_as

LEARNER = "practice-streak-learner"


def _wipe() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM xp_ledger WHERE user_id = %s", (LEARNER,))
            cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (f"{LEARNER}:%",))
            cur.execute("DELETE FROM review_daily WHERE user_id = %s", (LEARNER,))
        conn.commit()
    finally:
        conn.close()


def _practised(days_ago: int, n: int = 1) -> None:
    at = datetime.now(timezone.utc) - timedelta(days=days_ago)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for _ in range(n):
                cur.execute(
                    "INSERT INTO xp_ledger(user_id, source, ref, xp, awarded_at) VALUES (%s, 'reading', 'level:N5', 7, %s)",
                    (LEARNER, at),
                )
        conn.commit()
    finally:
        conn.close()


def setup_function(_):
    _wipe()


def teardown_function(_):
    _wipe()


def test_practice_days_make_a_streak():
    for ago in (0, 1, 2):
        _practised(ago)
    assert srs.get_streak(LEARNER) == {"current": 3, "longest": 3}


def test_a_gap_still_breaks_it():
    _practised(0)
    _practised(1)
    _practised(3)
    assert srs.get_streak(LEARNER) == {"current": 2, "longest": 2}


def test_yesterdays_practice_keeps_a_streak_alive_until_tonight():
    _practised(1)
    _practised(2)
    assert srs.get_streak(LEARNER)["current"] == 2


def test_no_practice_is_no_streak():
    assert srs.get_streak(LEARNER) == {"current": 0, "longest": 0}


def test_daily_practice_counts_are_per_day_and_oldest_first():
    _practised(2)
    _practised(0, n=3)
    counts = srs.get_daily_practice_counts(LEARNER, days=7)
    assert [c["count"] for c in counts] == [1, 3]
    assert [c["date"] for c in counts] == sorted(c["date"] for c in counts)


def test_the_profile_stamps_a_practice_only_day(client):
    _practised(0, n=2)
    with acting_as(LEARNER):
        body = client.get("/api/profile").json()
    today = datetime.now(timezone.utc).date().isoformat()
    day = next(d for d in body["calendar"] if d["date"] == today)
    assert day == {"date": today, "count": 0, "practice": 2}
    assert body["streak"] == 1
