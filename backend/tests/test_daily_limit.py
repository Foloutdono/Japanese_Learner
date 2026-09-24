# One counter for every daily ceiling (core/daily_limit.py, plan 125).
#
# The rules ocr_usage and comprehension_usage each enforced alone, held
# once: a slot per claim, features and learners counted apart, the
# learner's own day, and a database failure that fails open.
import datetime as dt
import logging

import pytest

from core import daily_limit
from core.auth import DEV_USER_ID
from core.db import db_conn

OTHER = "daily-limit-other-learner"
FEATURE = "test-feature-a"
FEATURE_B = "test-feature-b"


def _wipe() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM daily_usage WHERE user_id IN (%s, %s)", (DEV_USER_ID, OTHER))
        conn.commit()
    finally:
        conn.close()


@pytest.fixture(autouse=True)
def clean():
    _wipe()
    yield
    _wipe()


def test_each_claim_counts_one_more():
    assert [daily_limit.claim(DEV_USER_ID, FEATURE, 5) for _ in range(3)] == [1, 2, 3]


def test_features_are_counted_apart():
    daily_limit.claim(DEV_USER_ID, FEATURE, 5)
    daily_limit.claim(DEV_USER_ID, FEATURE, 5)
    assert daily_limit.claim(DEV_USER_ID, FEATURE_B, 5) == 1
    assert daily_limit.claim(DEV_USER_ID, FEATURE, 5) == 3


def test_learners_are_counted_apart():
    daily_limit.claim(DEV_USER_ID, FEATURE, 5)
    assert daily_limit.claim(OTHER, FEATURE, 5) == 1
    assert daily_limit.claim(DEV_USER_ID, FEATURE, 5) == 2


def test_the_day_is_the_learners(monkeypatch):
    # Two claims on two different local days: the second starts over.
    # local_today is core.credits' rule (the profile's tz_offset_min);
    # here only the day it answers is driven.
    days = iter([dt.date(2026, 9, 25), dt.date(2026, 9, 26)])
    monkeypatch.setattr(daily_limit, "local_today", lambda offset: next(days))
    assert daily_limit.claim(DEV_USER_ID, FEATURE, 5) == 1
    assert daily_limit.claim(DEV_USER_ID, FEATURE, 5) == 1


def test_a_database_failure_counts_as_under_the_cap(monkeypatch):
    def broken():
        raise RuntimeError("no database")
    monkeypatch.setattr(daily_limit, "db_conn", broken)
    assert daily_limit.claim(DEV_USER_ID, FEATURE, 5) == 0


def test_the_crossing_is_logged_once(caplog):
    with caplog.at_level(logging.INFO, logger="core.daily_limit"):
        for _ in range(4):
            daily_limit.claim(DEV_USER_ID, FEATURE, 2)
    crossings = [r for r in caplog.records if "daily limit crossed" in r.getMessage()]
    assert len(crossings) == 1
    assert "limit=2" in crossings[0].getMessage()
    assert FEATURE in crossings[0].getMessage()
