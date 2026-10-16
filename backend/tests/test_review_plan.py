"""回復運転 — the review plan (plan 217).

A learner back from a stretch away met a gate of hundreds of reviews,
and a day cleared only on an empty gate: the wall, then a partial
finish at every run. The review plan cuts the gate to the day's share
-- the learner's own ceiling, or a catch-up chosen on the comeback
sheet -- and the day is cleared on the share. A declared absence keeps
the streak and stops the new cards before it.

The pure cut first, then the whole path on a learner of each test's
own, with a backlog of real N5 cards met a month ago and overdue.
"""
import uuid
from collections import OrderedDict
from datetime import date, datetime, timedelta, timezone

import pytest

import core.user_level as user_level
from core import review_plan
from core.db import db_conn
from core.srs_instance import srs
from routes.account import delete_user_rows
from study import review_cap, teaching_order
from study.daily_queue import SECTION
from tests.conftest import acting_as

F2B = "vocab.flashcard.f2b"
NOW = datetime(2026, 10, 16, 12, tzinfo=timezone.utc)


# ── The cut ──────────────────────────────────────────────────────

def _row(overdue_days, interval, learning=False):
    return {"next_review": NOW - timedelta(days=overdue_days), "interval_days": interval, "is_learning": learning}


def test_the_share_keeps_the_exempt_and_the_best_ranked_and_counts_the_rest():
    key_v, key_k = (SECTION, "vocab", "N5", F2B), (SECTION, "kanji", "N5", "kanji.flashcard.f2b")
    lanes = OrderedDict([(key_v, ["young", "mature", "lapsed"]), (key_k, ["learning", "again"])])
    rows = {
        ("young", F2B): _row(20, 2),            # three weeks late on two days: gone already
        ("mature", F2B): _row(1, 60),           # a day late on two months: still known
        ("lapsed", F2B): _row(5, 10),
        ("learning", "kanji.flashcard.f2b"): _row(0.1, 0, learning=True),
        ("again", "kanji.flashcard.f2b"): _row(0, 1),
    }
    exempt = {("again", "kanji.flashcard.f2b")}   # reviewed today already
    shared, held = review_cap.share(lanes, rows, cap=4, spent=2, exempt=exempt, now=NOW)
    # Two places left: the learning step, then the least overdue for
    # its interval; the exempt card rides whatever the ceiling says.
    assert shared == OrderedDict([(key_v, ["mature"]), (key_k, ["learning", "again"])])
    assert held == 2
    assert review_cap.owed(lanes, exempt) == 4


def test_a_share_that_holds_nothing_back_returns_the_lanes_as_they_were():
    lanes = OrderedDict([((SECTION, "vocab", "N5", F2B), ["a", "b"])])
    rows = {("a", F2B): _row(1, 3), ("b", F2B): _row(2, 3)}
    assert review_cap.share(lanes, rows, cap=5, spent=0, exempt=set(), now=NOW) == (lanes, 0)
    # A spent share serves nothing but the exempt.
    assert review_cap.share(lanes, rows, cap=5, spent=5, exempt={("b", F2B)}, now=NOW)[0] == OrderedDict(
        [((SECTION, "vocab", "N5", F2B), ["b"])])


def test_a_spread_is_the_backlog_over_its_days_plus_a_day_s_load_and_never_under_the_floor():
    assert review_cap.spread_per_day(400, 5, 12.3, 20) == 80 + 13
    assert review_cap.spread_per_day(30, 7, 0, 20) == 20


def test_the_plan_s_ceiling_is_the_lower_and_a_catch_up_or_an_absence_pauses_the_new_cards():
    plan = review_plan.Plan(review_cap=100, catchup_cap=60, catchup_days=5, catchup_from=date(2026, 10, 14))
    assert plan.cap == 60 and plan.catching_up
    assert plan.new_paused(date(2026, 10, 16))
    assert plan.catchup_payload(date(2026, 10, 16)) == {"per_day": 60, "day": 3, "of": 5}
    # Past its days a spread holds its last day: finished late, not failed.
    assert plan.catchup_payload(date(2026, 10, 30))["day"] == 5
    away = review_plan.Plan(away_from=date(2026, 10, 20), away_until=date(2026, 10, 25))
    assert away.cap is None
    assert not away.new_paused(date(2026, 10, 17))
    assert away.new_paused(date(2026, 10, 18)) and away.new_paused(date(2026, 10, 25))
    assert not away.new_paused(date(2026, 10, 26))


# ── The path ─────────────────────────────────────────────────────

@pytest.fixture
def learner(client):
    uid = f"plan-test-{uuid.uuid4()}"
    with acting_as(uid):
        r = client.post("/api/onboarding/complete", json={
            "jlptLevel": "N5", "dailyNewTarget": 5, "kanaKnown": "none", "lines": ["vocab"],
        })
        assert r.status_code == 200, r.text
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
    srs.forget_history(uid)


def _cards(n, skip=0):
    return teaching_order.raw_ids("vocab", "N5", F2B)[skip:skip + n]


def _backlog(uid, cards, overdue=timedelta(days=10)):
    """`cards` met a month ago (a review_log row then) and overdue now."""
    now = datetime.now(timezone.utc)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for raw in cards:
                cid = f"{uid}:{raw}"
                cur.execute("INSERT INTO cards (id) VALUES (%s) ON CONFLICT DO NOTHING", (cid,))
                cur.execute(
                    "INSERT INTO card_modes (card_id, mode, interval_days, repetitions, is_learning, "
                    "next_review, total_reviews, correct_reviews, last_quality) "
                    "VALUES (%s, %s, 3, 2, FALSE, %s, 2, 2, 4)",
                    (cid, F2B, now - overdue),
                )
                cur.execute(
                    "INSERT INTO review_log (card_id, mode, quality, reviewed_at) VALUES (%s, %s, 4, %s)",
                    (cid, F2B, now - timedelta(days=30)),
                )
        conn.commit()
    finally:
        conn.close()
    srs.forget_history(uid)


def _review_now(uid, cards):
    """`cards` answered today: a log row, and due again in a week."""
    now = datetime.now(timezone.utc)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for raw in cards:
                cid = f"{uid}:{raw}"
                cur.execute("INSERT INTO review_log (card_id, mode, quality, reviewed_at) VALUES (%s, %s, 4, %s)",
                            (cid, F2B, now))
                cur.execute("UPDATE card_modes SET next_review = %s WHERE card_id = %s AND mode = %s",
                            (now + timedelta(days=7), cid, F2B))
        conn.commit()
    finally:
        conn.close()
    srs.forget_history(uid)


def _today(client):
    r = client.get("/api/today")
    assert r.status_code == 200, r.text
    return r.json()


def _reviews(today):
    return today["total"] - sum(lane["new"] for lane in today["lanes"])


def test_a_ceiling_cuts_the_gate_to_the_share_and_the_day_clears_on_it(client, learner):
    _backlog(learner, _cards(40))
    r = client.put("/api/review-plan/cap", json={"reviewCap": 15})
    assert r.status_code == 200, r.text
    assert r.json()["reviewCap"] == 15

    today = _today(client)
    assert _reviews(today) == 15
    assert today["review"]["held"] == 25
    served = client.get("/api/today/cards?count=25").json()["cards"]
    assert len([c for c in served if c.get("stage") != "new"]) <= 15

    # Fifteen answered: the share is spent, the gate holds only the new
    # cards, and once they are met too the day clears with 25 held back.
    shared = [lane for lane in today["lanes"] if lane["due"]]
    assert shared
    _review_now(learner, _cards(40)[:15])
    after = _today(client)
    assert _reviews(after) == 0
    assert after["review"]["held"] == 25

    # The extra run serves what was held back, past the share.
    extra = client.get("/api/today/cards?count=25&extra=1").json()["cards"]
    assert len(extra) == 25


def test_with_nothing_but_held_reviews_left_the_gate_opens_at_the_next_share(client, learner):
    _backlog(learner, _cards(17))
    assert client.put("/api/review-plan/cap", json={"reviewCap": 10}).status_code == 200
    _review_now(learner, _cards(17)[:10])
    # No new card either: the gate holds nothing the share allows.
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE user_profiles SET daily_new_target = NULL WHERE user_id = %s", (learner,))
        conn.commit()
    finally:
        conn.close()
    today = _today(client)
    assert today["total"] == 0
    assert today["review"]["held"] == 7
    midnight = datetime.combine(datetime.now(timezone.utc).date() + timedelta(days=1),
                                datetime.min.time(), tzinfo=timezone.utc)
    assert datetime.fromisoformat(today["next_due"]) == midnight
    clear = client.post("/api/today/clear").json()
    assert clear["cleared"] is True


def test_a_backlog_opens_the_gate_on_the_comeback_offer_priced_per_spread(client, learner):
    _backlog(learner, _cards(100))
    offer = _today(client)["review"]["comeback"]
    assert offer is not None
    assert offer["owed"] == 100
    assert [s["days"] for s in offer["spread"]] == list(review_plan.SPREAD_DAYS)
    assert offer["default_days"] == review_plan.DEFAULT_SPREAD_DAYS
    assert offer["gentle"] == {"per_day": review_plan.GENTLE_PER_DAY}
    five = next(s for s in offer["spread"] if s["days"] == 5)
    assert five["per_day"] == 20  # 100 over five days, nothing else falls due

    # A few cards behind is an ordinary day: no offer.
    small = f"{learner}-small"
    with acting_as(small):
        try:
            _backlog(small, _cards(10))
            assert _today(client)["review"]["comeback"] is None
        finally:
            conn = db_conn()
            try:
                with conn.cursor() as cur:
                    delete_user_rows(cur, small)
                conn.commit()
            finally:
                conn.close()


def test_a_spread_cuts_the_gate_pauses_the_new_cards_and_ends_itself_when_caught_up(client, learner):
    _backlog(learner, _cards(100))
    r = client.post("/api/review-plan/catchup", json={"choice": "spread", "days": 5})
    assert r.status_code == 200, r.text
    assert r.json()["catchup"] == {"per_day": 20, "day": 1, "of": 5}

    today = _today(client)
    assert today["total"] == 20                       # the share, and no new card
    assert all(lane["new"] == 0 for lane in today["lanes"])
    assert today["review"]["catchup"]["per_day"] == 20
    assert today["review"]["comeback"] is None

    # Seventy answered: seventy left, more than a share -- it runs on.
    _review_now(learner, _cards(100)[:30])
    assert _today(client)["review"]["catchup"] is not None
    # Eighty-five, past the share at once: fifteen left, less than one
    # share, and the work is done.
    _review_now(learner, _cards(100)[30:85])
    today = _today(client)
    assert today["review"]["catchup"] is None          # caught up: it ended
    assert any(lane["new"] for lane in today["lanes"])  # the new cards are back


def test_gentle_has_no_end_and_all_quiets_the_offer(client, learner):
    _backlog(learner, _cards(100))
    r = client.post("/api/review-plan/catchup", json={"choice": "gentle"})
    assert r.json()["catchup"] == {"per_day": 20, "day": 1, "of": None}
    assert _today(client)["total"] == 20

    r = client.delete("/api/review-plan/catchup")
    assert r.json()["catchup"] is None
    assert _today(client)["review"]["comeback"] is not None

    client.post("/api/review-plan/catchup", json={"choice": "all"})
    today = _today(client)
    assert today["review"]["comeback"] is None
    assert _reviews(today) == 100


def test_the_bodies_are_bounded(client, learner):
    assert client.put("/api/review-plan/cap", json={"reviewCap": 5}).status_code == 422
    assert client.put("/api/review-plan/cap", json={"reviewCap": 100000}).status_code == 422
    assert client.put("/api/review-plan/cap", json={"reviewCap": None}).status_code == 200
    assert client.post("/api/review-plan/catchup", json={"choice": "spread", "days": 40}).status_code == 422
    assert client.post("/api/review-plan/catchup", json={"choice": "nap"}).status_code == 422
    today = datetime.now(timezone.utc).date()
    span = {"start": (today + timedelta(days=2)).isoformat(), "until": (today + timedelta(days=40)).isoformat()}
    assert client.put("/api/review-plan/away", json=span).status_code == 422
    past = {"start": (today - timedelta(days=5)).isoformat(), "until": today.isoformat()}
    assert client.put("/api/review-plan/away", json=past).status_code == 422
    backwards = {"start": (today + timedelta(days=5)).isoformat(), "until": (today + timedelta(days=2)).isoformat()}
    assert client.put("/api/review-plan/away", json=backwards).status_code == 422


def test_an_absence_declared_pauses_the_new_cards_before_it_and_keeps_the_streak_through_it(client, learner):
    today = datetime.now(timezone.utc).date()
    span = {"start": (today + timedelta(days=1)).isoformat(), "until": (today + timedelta(days=6)).isoformat()}
    r = client.put("/api/review-plan/away", json=span)
    assert r.status_code == 200, r.text
    assert r.json()["away"] == {"from": span["start"], "until": span["until"]}
    assert all(lane["new"] == 0 for lane in _today(client)["lanes"])

    # Back from it: studied the day before it began, nothing during, and
    # the streak walks through its days as rest days, no ticket spent.
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE user_profiles SET away_from = %s, away_until = %s WHERE user_id = %s",
                        (today - timedelta(days=4), today - timedelta(days=1), learner))
            cur.execute("INSERT INTO review_log (card_id, mode, quality, reviewed_at) VALUES (%s, %s, 4, %s)",
                        (f"{learner}:{_cards(1)[0]}", F2B, datetime.now(timezone.utc) - timedelta(days=5)))
        conn.commit()
    finally:
        conn.close()
    srs.forget_history(learner)
    _today(client)
    rested = srs.get_rest_days(learner)
    assert rested == [(today - timedelta(days=n)).isoformat() for n in (4, 3, 2, 1)]
    assert srs.rest_held(learner) == 0 and srs.rest_unseen(learner) == []
    assert srs.streak_figures(learner)["today"] >= 2
    # Idempotent: a second visit writes nothing more.
    _today(client)
    assert srs.get_rest_days(learner) == rested

    r = client.delete("/api/review-plan/away")
    assert r.json()["away"] is None
    assert srs.get_rest_days(learner) == rested


def test_the_notifications_count_the_share_and_flag_a_backlog_without_one(client, learner):
    _backlog(learner, _cards(100))
    at = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    point = client.get("/api/today/ahead", params={"at": at}).json()["points"][0]
    assert point["comeback"] is True
    client.post("/api/review-plan/catchup", json={"choice": "spread", "days": 5})
    point = client.get("/api/today/ahead", params={"at": at}).json()["points"][0]
    assert point["comeback"] is False
    assert point["total"] == 20 and point["new"] == 0


def test_settings_reads_the_plan(client, learner):
    state = client.get("/api/review-plan").json()
    assert state == {
        "reviewCap": None, "capChoices": list(review_plan.CAP_CHOICES), "load": 0,
        "catchup": None, "away": None, "awayMaxDays": review_plan.AWAY_MAX_DAYS,
    }
