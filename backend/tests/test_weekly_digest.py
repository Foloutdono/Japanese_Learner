# ── 足跡 — the weekly digest's sections, against real rows ──
# The digest is SQL in a script nothing imports, so the way it breaks is
# silently: a renamed property or a typo in a FILTER turns a table into
# "_Nothing yet._" and the Monday summary just looks quiet. These seed
# one learner's rows under names no other test uses and read each
# section back.
from datetime import datetime, timezone

import pytest

from core import events
from core.db import db_conn
from scripts import weekly_digest as digest

USER = "digest-test-learner"
DOOR = "digest-test-door"
AREA = "/api/digesttest"


@pytest.fixture(autouse=True)
def seeded():
    def wipe():
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM event_log WHERE user_id = %s", (USER,))
            conn.commit()
        finally:
            conn.close()

    wipe()
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            now = datetime.now(timezone.utc)
            rows = [(name, events.clean(name, props), now) for name, props in [
                ("app_open", {"boot_ms": 800, "cold": False}),
                ("offer_view", {"where": DOOR}),
                ("offer_intent", {"where": DOOR, "ms": 3000}),
                ("ride_done", {"skipped": True, "at": "digest-test-ride", "ms": 4000}),
                ("run_start", {"kind": "digesttest", "mode": "m", "level": "N5"}),
                ("run_complete", {"kind": "digesttest", "mode": "m", "level": "N5", "items": 5, "secs": 30}),
                ("api_error", {"path": AREA, "status": 503}),
                ("api_error", {"path": AREA, "status": 0}),
                ("install_prompt", {"outcome": "digest-test-accepted"}),
            ]]
            events.write(cur, USER, rows)
        conn.commit()
    finally:
        conn.close()
    yield
    wipe()


def section(fn, days=7):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            return fn(cur, days)
    finally:
        conn.close()


def test_engagement_counts_the_learner_who_did_anything_today():
    out = section(digest.engagement)
    assert "_Nothing yet._" not in out
    assert "stickiness" in out


def test_offer_reads_a_door_as_seen_then_pressed():
    out = section(digest.offer)
    row = next(line for line in out.splitlines() if DOOR in line)
    assert row == f"| {DOOR} | 1 | 1 | 0 | 100% | 3000 ms |"


def test_ride_and_guides_reads_the_skip_and_the_time():
    out = section(digest.ride_and_guides)
    row = next(line for line in out.splitlines() if "digest-test-ride" in line)
    assert row == "| ride_done | digest-test-ride | 1 | 1 | 100% | 4000 ms |"


def test_use_splits_by_level_now_that_runs_carry_one():
    out = section(digest.use)
    row = next(line for line in out.splitlines() if "digesttest" in line)
    assert row == "| digesttest | N5 | 1 | 1 | 0 | 100% |"


def test_friction_lists_a_failed_area_per_status_and_the_install_answers():
    out = section(digest.friction)
    assert f"| {AREA} | 503 | 1 | 1 |" in out
    assert f"| {AREA} | 0 | 1 | 1 |" in out
    assert "| digest-test-accepted | 1 |" in out
