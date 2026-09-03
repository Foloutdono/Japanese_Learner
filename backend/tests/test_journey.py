# ── The journey endpoints: status, reprint, and 行先's own two ────
# Runs as a DEDICATED user (dependency override), not DEV_USER_ID:
# itemsDone/actual14 count review_log firsts, and the shared dev user
# accumulates review rows from every other suite — assertions on exact
# counts would depend on test order. Each fixture use seeds and fully
# deletes its own rows.
from datetime import date, datetime, timedelta

import pytest

from core.db import db_conn
from main import app
# The override key must be the EXACT function object the routers'
# Depends() closed over. test_auth_jwks.py reloads core.auth mid-suite,
# which mints a fresh get_user_id — after that, core.auth.get_user_id
# is a different object from the one inside every router, and an
# override keyed on it silently matches nothing (requests then run as
# DEV_USER_ID and these counts read someone else's rows). Importing it
# from the router module pins the pre-reload object the app really uses.
from routes.journey import get_user_id
from routes.onboarding import VOLUMES
from study.modes import SRS_MODES

JUID = "journey-test-user"
MODE = sorted(SRS_MODES)[0]  # any servable mode — the filter must accept it


@pytest.fixture()
def jclient(client):
    app.dependency_overrides[get_user_id] = lambda: JUID
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_user_id, None)
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (f"{JUID}:%",))
                cur.execute("DELETE FROM user_profiles WHERE user_id = %s", (JUID,))
            conn.commit()
        finally:
            conn.close()


def _seed_review(card_id: str, days_ago: float, mode: str = MODE):
    """One review_log row for JUID, `days_ago` days in the past."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO review_log (card_id, mode, quality, reviewed_at)
                VALUES (%s, %s, 4, NOW() - make_interval(secs => %s))
                """,
                (f"{JUID}:{card_id}", mode, days_ago * 86400),
            )
        conn.commit()
    finally:
        conn.close()


def _backdate_goal(days_ago: int):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE user_profiles
                SET goal_set_at = NOW() - make_interval(days => %s)
                WHERE user_id = %s
                """,
                (days_ago, JUID),
            )
        conn.commit()
    finally:
        conn.close()


def _complete(jclient, **extra):
    body = {"jlptLevel": "N5", "dailyNewTarget": 10,
            "goalLevel": "N3", "goalTargetDate": "2030-01-01", **extra}
    r = jclient.post("/api/onboarding/complete", json=body)
    assert r.status_code == 200
    return r.json()


def _level_items(lvl: str) -> int:
    return VOLUMES["vocab"][lvl] + VOLUMES["kanji"][lvl] + VOLUMES["grammar"][lvl]


def test_status_before_onboarding_is_all_null(jclient):
    body = jclient.get("/api/journey/status").json()
    assert body["goalLevel"] is None
    assert body["plannedPerDay"] is None
    assert body["itemsTotal"] == 0
    assert body["itemsDone"] == 0
    assert body["actual14"] == 0
    assert body["days14"] == 14


def test_items_total_is_the_promised_volume(jclient):
    _complete(jclient)
    body = jclient.get("/api/journey/status").json()
    # N5 boarding includes the kana front-load; the journey covers
    # N5+N4+N3 — recomputed here from VOLUMES independently of the
    # route's own helper.
    expected = VOLUMES["kana"] + sum(_level_items(l) for l in ("N5", "N4", "N3"))
    assert body["itemsTotal"] == expected


def test_items_are_deduped_across_modes(jclient):
    # THE plan-063 acceptance case: one word met through two modes is
    # one item, not two.
    _complete(jclient)
    _backdate_goal(1)  # the contract must predate the backdated reviews
    modes = sorted(SRS_MODES)
    assert len(modes) >= 2, "the dedupe case needs two servable modes"
    _seed_review("vocab_N5_0001", 0.1, modes[0])
    _seed_review("vocab_N5_0001", 0.05, modes[1])
    body = jclient.get("/api/journey/status").json()
    assert body["itemsDone"] == 1
    assert body["actual14"] == 1


def test_only_the_promised_content_moves_the_train(jclient):
    _complete(jclient)  # N5 → N3, kana included
    _backdate_goal(1)  # the contract must predate the backdated reviews
    _seed_review("vocab_N5_0002", 0.1)   # on the journey
    _seed_review("kana_a", 0.1)          # kana front-load: counts (N5 start)
    _seed_review("vocab_N1_9999", 0.1)   # beyond the destination: no
    _seed_review("custom_mydeck_1", 0.1) # never priced by the promise: no
    body = jclient.get("/api/journey/status").json()
    assert body["itemsDone"] == 2
    assert body["actual14"] == 2


def test_windows_and_the_goal_anchor(jclient):
    _complete(jclient)
    _backdate_goal(30)
    _seed_review("vocab_N5_0010", 40)   # before the contract: not done
    _seed_review("vocab_N5_0011", 20)   # done, but outside the 14 days
    _seed_review("vocab_N5_0012", 1)    # done and recent
    body = jclient.get("/api/journey/status").json()
    assert body["itemsDone"] == 2
    assert body["actual14"] == 1
    # The two filters are independent: move the anchor to now and the
    # 1-day-old first drops out of itemsDone yet stays in the window.
    _backdate_goal(0)
    body = jclient.get("/api/journey/status").json()
    assert body["itemsDone"] == 0
    assert body["actual14"] == 1


def test_goalless_status_reports_the_open_line(jclient):
    r = jclient.post("/api/onboarding/complete",
                     json={"jlptLevel": "N4", "dailyNewTarget": 5})
    assert r.status_code == 200
    _seed_review("vocab_N4_0001", 0.1)
    _seed_review("kana_i", 0.1)  # start is N4: kana is NOT on this line
    body = jclient.get("/api/journey/status").json()
    assert body["goalLevel"] is None
    assert body["plannedPerDay"] == 5
    # itemsDone means "ever" on the open line…
    assert body["itemsDone"] == 1
    # …which runs to the terminus.
    assert body["itemsTotal"] == sum(_level_items(l) for l in ("N4", "N3", "N2", "N1"))


def test_reprint_moves_the_date_and_keeps_the_anchor(jclient):
    _complete(jclient)
    before = jclient.get("/api/journey/status").json()
    new_date = (date.today() + timedelta(days=400)).isoformat()
    r = jclient.post("/api/journey/reprint", json={"goalTargetDate": new_date})
    assert r.status_code == 200
    body = r.json()
    assert body["goalTargetDate"] == new_date
    # The contract began when it began — a reprint moves the promise,
    # not history.
    assert body["goalSetAt"] == before["goalSetAt"]


def test_reprint_of_the_pace_alone(jclient):
    _complete(jclient)
    body = jclient.post("/api/journey/reprint", json={"dailyNewTarget": 17}).json()
    assert body["plannedPerDay"] == 17
    assert body["goalTargetDate"] == "2030-01-01"  # untouched


def test_reprint_refusals(jclient):
    # Nothing to reprint.
    assert jclient.post("/api/journey/reprint", json={}).status_code == 422
    # A date in the past.
    _complete(jclient)
    assert jclient.post("/api/journey/reprint",
                        json={"goalTargetDate": "2020-01-01"}).status_code == 422
    # Moving a date that doesn't exist: strip the goal first.
    jclient.post("/api/onboarding/complete",
                 json={"jlptLevel": "N5", "dailyNewTarget": 10})
    assert jclient.post("/api/journey/reprint",
                        json={"goalTargetDate": "2030-01-01"}).status_code == 422
    # The pace alone stays reprintable on a goal-less pass.
    assert jclient.post("/api/journey/reprint",
                        json={"dailyNewTarget": 8}).status_code == 200


# ── 行先 — the settings counter's own two routes ──────────────────
# POST /api/journey/goal issues a destination onto a pass (the office
# signs the first contract; this signs every one after it), DELETE
# hands it back. What separates them from a reprint is the anchor: a
# reprint keeps goal_set_at, and these two must move it.
def test_goal_issued_onto_a_passless_ride(jclient):
    jclient.post("/api/onboarding/complete",
                 json={"jlptLevel": "N5", "dailyNewTarget": 5})
    before = jclient.get("/api/journey/status").json()
    assert before["goalLevel"] is None and before["goalSetAt"] is None

    target = (date.today() + timedelta(days=300)).isoformat()
    r = jclient.post("/api/journey/goal", json={
        "goalLevel": "N3", "goalTargetDate": target, "dailyNewTarget": 15,
    })
    assert r.status_code == 200
    body = r.json()
    assert body["goalLevel"] == "N3"
    assert body["goalTargetDate"] == target
    # Boarding is stamped with where the learner stands today, so the
    # promised volume can never drift when jlpt_level later moves.
    assert body["goalStartLevel"] == "N5"
    assert body["goalSetAt"] is not None
    assert body["plannedPerDay"] == 15
    assert body["itemsTotal"] == VOLUMES["kana"] + sum(
        _level_items(l) for l in ("N5", "N4", "N3")
    )


def test_reissuing_a_destination_moves_the_anchor(jclient):
    _complete(jclient)  # N5 → N3
    _backdate_goal(30)
    before = jclient.get("/api/journey/status").json()

    body = jclient.post("/api/journey/goal", json={"goalLevel": "N2"}).json()
    assert body["goalLevel"] == "N2"
    # A new destination is a new contract: the window it measures
    # starts now, not thirty days ago.
    assert (datetime.fromisoformat(body["goalSetAt"])
            > datetime.fromisoformat(before["goalSetAt"]))
    # The pace was not sent, so it stands.
    assert body["plannedPerDay"] == before["plannedPerDay"]
    assert body["itemsTotal"] > before["itemsTotal"]


def test_goal_refusals(jclient):
    # No boarding level yet — nothing to issue a ticket against.
    assert jclient.post("/api/journey/goal",
                        json={"goalLevel": "N3"}).status_code == 422
    _complete(jclient)
    # Not beyond the boarding level (LEVELS is journey-ordered).
    assert jclient.post("/api/journey/goal",
                        json={"goalLevel": "N5"}).status_code == 422
    # Not a level at all, and a date already expired.
    assert jclient.post("/api/journey/goal",
                        json={"goalLevel": "N9"}).status_code == 422
    assert jclient.post("/api/journey/goal",
                        json={"goalLevel": "N2",
                              "goalTargetDate": "2020-01-01"}).status_code == 422
    # None of them wrote: the pass still carries the original contract.
    body = jclient.get("/api/journey/status").json()
    assert body["goalLevel"] == "N3"


def test_cancelling_keeps_the_ride(jclient):
    _complete(jclient, dailyDeparture="am")
    body = jclient.delete("/api/journey/goal").json()
    assert body["goalLevel"] is None
    assert body["goalTargetDate"] is None
    assert body["goalStartLevel"] is None
    assert body["goalSetAt"] is None
    # Giving up a destination is not giving up the ride.
    assert body["plannedPerDay"] == 10
    assert body["dailyDeparture"] == "am"
    # And the goal-less pass reports the open line again.
    assert body["itemsTotal"] == VOLUMES["kana"] + sum(
        _level_items(l) for l in ("N5", "N4", "N3", "N2", "N1")
    )


def test_reprint_sets_and_clears_the_departure_hour(jclient):
    # The hour is reprintable on a goal-less pass too — it is a habit,
    # not a promise.
    jclient.post("/api/onboarding/complete",
                 json={"jlptLevel": "N5", "dailyNewTarget": 5})
    body = jclient.post("/api/journey/reprint", json={"dailyDeparture": "pm"}).json()
    assert body["dailyDeparture"] == "pm"
    # An explicit null is 自由 — a VALUE, not "nothing to reprint".
    body = jclient.post("/api/journey/reprint", json={"dailyDeparture": None}).json()
    assert body["dailyDeparture"] is None
    assert body["plannedPerDay"] == 5  # nothing else moved
    assert jclient.post("/api/journey/reprint",
                        json={"dailyDeparture": "midnight"}).status_code == 422
