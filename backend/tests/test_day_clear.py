"""終着 — the day cleared (plan 191).

The run's end asks POST /api/today/clear whether it emptied the day. A
day is cleared when the queue the gate counts is empty and a card was
reviewed today (UTC, the streak's day); it is paid once, the day's bonus
for the streak and a jackpot on a milestone, under the day_clears row's
primary key. The first good review's streak bonus is gone from the
review's XP: it was folded into the day's.

Each test runs as a learner of its own, its history seeded as review_log
rows with explicit timestamps, and erased with routes/account.py's own
deletion, which is also what the last test pins.
"""
import math
import uuid
from datetime import datetime, timedelta, timezone

import pytest

import core.user_level as user_level
from core.db import db_conn
from core.srs_instance import srs
from routes import today as today_route
from routes.account import delete_user_rows
from srs import xp as xp_math
from tests.conftest import acting_as

F2B = "vocab.flashcard.f2b"
CARD = "vocab_N5_水_みず"
OTHER_CARD = "vocab_N5_火曜日_かようび"


@pytest.fixture
def learner():
    uid = f"clear-test-{uuid.uuid4()}"
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


def _review(uid, days_ago, n=1, card=CARD):
    """`n` card reviews logged `days_ago` days back (0 is today)."""
    at = datetime.now(timezone.utc) - timedelta(days=days_ago)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for _ in range(n):
                cur.execute(
                    "INSERT INTO review_log (card_id, mode, quality, xp_earned, reviewed_at) "
                    "VALUES (%s, %s, 4, 7, %s)",
                    (f"{uid}:{card}", F2B, at),
                )
        conn.commit()
    finally:
        conn.close()


def _studied(uid, days_ago):
    for back in days_ago:
        _review(uid, back)


def _schedule(uid, card, due_in: timedelta):
    """A card in `uid`'s schedule, met before and due `due_in` from now."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO cards (id) VALUES (%s) ON CONFLICT DO NOTHING", (f"{uid}:{card}",))
            cur.execute(
                "INSERT INTO card_modes (card_id, mode, interval_days, repetitions, is_learning, "
                "next_review, total_reviews, correct_reviews, last_quality) "
                "VALUES (%s, %s, 3, 2, FALSE, %s, 2, 2, 4)",
                (f"{uid}:{card}", F2B, datetime.now(timezone.utc) + due_in),
            )
        conn.commit()
    finally:
        conn.close()


def _ledger(uid, source="day_clear"):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT ref, xp FROM xp_ledger WHERE user_id = %s AND source = %s ORDER BY id",
                        (uid, source))
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


def _clear(client, uid):
    with acting_as(uid):
        r = client.post("/api/today/clear")
    assert r.status_code == 200, r.text
    return r.json()


# ── The arithmetic ───────────────────────────────────────────────

@pytest.mark.parametrize("streak, bonus, jackpot", [
    (1, 30, 0),
    (3, 40, 100),
    (6, 55, 0),
    (7, 60, 250),
    (14, 95, 500),
    (30, 175, 1000),
    (60, 325, 0),
    (61, 325, 0),          # the bonus stops growing at sixty days
    (100, 325, 3000),
    (365, 325, 10000),
    (400, 325, 3000),      # every hundredth day past the year
    (500, 325, 3000),
])
def test_the_bonus_and_the_jackpot_per_streak(streak, bonus, jackpot):
    assert xp_math.day_clear_bonus(streak) == bonus
    assert xp_math.jackpot_for(xp_math.milestone_at(streak)) == jackpot


def test_the_milestones_and_what_comes_after_each():
    assert [d for d in range(1, 701) if xp_math.milestone_at(d)] == [
        3, 7, 14, 30, 50, 100, 200, 365, 400, 500, 600, 700,
    ]
    # 300 is no milestone: the hundreds are counted past the year only.
    assert xp_math.milestone_at(300) is None
    assert xp_math.jackpot_for(300) == 0
    assert [xp_math.next_milestone(d) for d in (0, 3, 6, 7, 29, 30, 200, 364, 365, 400, 450)] == [
        3, 7, 7, 14, 30, 50, 365, 365, 400, 500, 500,
    ]
    # A rest day is earned from the seventh day on.
    assert [xp_math.next_rest_at(d) for d in (0, 3, 6, 7, 14)] == [7, 7, 7, 14, 30]


def test_the_milestone_picks_the_ceremony():
    assert xp_math.clear_tier(None) == "day"
    assert [xp_math.clear_tier(m) for m in (3, 7, 14)] == ["ticket"] * 3
    assert [xp_math.clear_tier(m) for m in (30, 50, 100, 200, 365, 400)] == ["month"] * 6


def test_a_review_pays_no_streak_bonus_any_more(learner):
    # Five days of streak behind it, the day's first perfect review pays
    # its base at the day's-first rate and nothing on top: the streak is
    # the day's clear's to pay now.
    assert xp_math.compute_review_xp(5, 0) == 20
    _studied(learner, range(1, 6))
    result = srs.review(f"{learner}:{CARD}", F2B, 5)
    assert result["xp_earned"] == 20
    preview = srs.preview_reviews_bulk([f"{learner}:{OTHER_CARD}"], F2B, learner)
    assert preview[f"{learner}:{OTHER_CARD}"][5]["xp_earned"] == xp_math.compute_review_xp(5, 1)


# ── Not cleared ──────────────────────────────────────────────────

def test_not_cleared_while_cards_remain(client, learner):
    _studied(learner, range(0, 5))
    _schedule(learner, OTHER_CARD, timedelta(hours=-1))
    body = _clear(client, learner)
    assert body == {
        "cleared": False,
        "remaining": 1,
        "seconds_per_review": None,
        "preview": {"streak": 5, "bonus": 50, "jackpot": 0, "milestone": None},
        "run_xp": None,
    }
    assert _ledger(learner) == []
    with acting_as(learner):
        today = client.get("/api/today").json()
    # The gate and the clear count the same queue.
    assert today["total"] == 1
    assert today["day_clear"] == {"done": False, "preview": body["preview"]}


def test_not_cleared_with_no_review_today(client, learner):
    # Four days behind, nothing due, nothing reviewed today: an empty
    # gate on a day nothing came is no victory.
    _studied(learner, range(1, 5))
    body = _clear(client, learner)
    assert body["cleared"] is False
    assert body["remaining"] == 0
    # The preview counts today: clearing it would be day five.
    assert body["preview"] == {"streak": 5, "bonus": 50, "jackpot": 0, "milestone": None}
    assert _ledger(learner) == []


# ── Cleared ──────────────────────────────────────────────────────

def test_an_everyday_clear_pays_the_bonus_and_draws_the_day(client, learner):
    _studied(learner, [0, 1, 2, 3, 4, 5])
    before = srs.get_lifetime_xp(learner)
    body = _clear(client, learner)
    today = _today()
    assert body["cleared"] is True and body["already"] is False
    assert body["day"] == today.isoformat()
    assert (body["streak"], body["longest"]) == (6, 6)
    assert (body["bonus"], body["jackpot"], body["milestone"], body["tier"]) == (55, 0, None, "day")
    assert (body["next_milestone"], body["next_jackpot"]) == (7, 250)
    assert body["rest"] == {"held": 0, "earned": False, "next_at": 7}
    assert body["xp"]["xp_earned"] == 55
    assert set(body["xp"]) == {"xp_earned", "leveled_up", "new_level"}
    after = srs.get_lifetime_xp(learner)
    assert after == before + 55
    level = xp_math.level_from_xp(after)
    assert body["level"] == {
        "level": level,
        "into": after - xp_math.xp_threshold(level),
        "span": xp_math.xp_threshold(level + 1) - xp_math.xp_threshold(level),
    }
    assert [d["state"] for d in body["week"]] == ["missed"] + ["studied"] * 6
    assert body["tomorrow"] == {"cards": 0, "minutes": 0}
    assert _ledger(learner) == [(today.isoformat(), 55)]
    assert _events(learner, "day_clear") == [{"streak": 6, "milestone": None, "tier": "day"}]
    with acting_as(learner):
        gate = client.get("/api/today").json()
    assert gate["day_clear"] == {
        "done": True, "preview": {"streak": 6, "bonus": 55, "jackpot": 0, "milestone": None},
    }


def test_the_day_is_paid_exactly_once(client, learner):
    _studied(learner, [0, 1, 2])
    first = _clear(client, learner)
    assert first["already"] is False
    assert (first["streak"], first["bonus"], first["jackpot"], first["tier"]) == (3, 40, 100, "ticket")
    assert first["xp"]["xp_earned"] == 140
    xp_after_first = srs.get_lifetime_xp(learner)

    second = _clear(client, learner)
    assert second["cleared"] is True and second["already"] is True
    # The day as it was paid, and nothing more.
    assert (second["streak"], second["bonus"], second["jackpot"], second["milestone"]) == (3, 40, 100, 3)
    assert second["xp"] == {"xp_earned": 0, "leveled_up": False, "new_level": second["level"]["level"]}
    assert second["level"] == first["level"]
    assert srs.get_lifetime_xp(learner) == xp_after_first
    assert len(_ledger(learner)) == 1
    assert len(_events(learner, "day_clear")) == 1


def _review_worth(uid, xp, n=1):
    """`n` reviews logged now, each worth `xp`."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for _ in range(n):
                cur.execute(
                    "INSERT INTO review_log (card_id, mode, quality, xp_earned) VALUES (%s, %s, 4, %s)",
                    (f"{uid}:{CARD}", F2B, xp),
                )
        conn.commit()
    finally:
        conn.close()


def _clear_run(client, uid, reviews):
    with acting_as(uid):
        r = client.post("/api/today/clear", json={"reviews": reviews})
    assert r.status_code == 200, r.text
    return r.json()


def test_the_run_s_xp_is_what_its_own_reviews_wrote(client, learner):
    # A review's XP shrinks as the day's count grows, so the previews a
    # run summed run high; the clear reads what the run's reviews wrote:
    # the latest `reviews` of today's rows, not an earlier run's.
    _studied(learner, [1, 2])
    _review(learner, 0, n=3)            # an earlier run today, 7 each
    _review_worth(learner, 4, n=2)      # this run's two reviews
    body = _clear_run(client, learner, 2)
    assert body["cleared"] is True
    assert body["run_xp"] == 8
    # Never past today's rows, however many the run claims.
    again = _clear_run(client, learner, 50)
    assert again["already"] is True and again["run_xp"] == 3 * 7 + 2 * 4
    # Asked without a count, the answer has no figure for the run.
    assert _clear(client, learner)["run_xp"] is None


def test_a_partial_run_s_xp_is_counted_too(client, learner):
    _studied(learner, [1])
    _review_worth(learner, 5, n=4)
    _schedule(learner, OTHER_CARD, timedelta(hours=-1))
    body = _clear_run(client, learner, 4)
    assert body["cleared"] is False and body["run_xp"] == 20


def test_a_run_s_count_is_never_negative(client, learner):
    with acting_as(learner):
        r = client.post("/api/today/clear", json={"reviews": -1})
    assert r.status_code == 422


def test_tomorrow_counts_what_falls_due_and_the_minutes_it_takes(client, learner):
    _studied(learner, [0])
    _schedule(learner, OTHER_CARD, timedelta(days=1))
    body = _clear(client, learner)
    assert body["cleared"] is True
    # One card, at the default pace until the learner's own is known.
    assert body["tomorrow"] == {
        "cards": 1,
        "minutes": max(1, math.ceil(today_route.DEFAULT_SECONDS_PER_REVIEW / 60)),
    }


def test_the_day_clear_xp_never_makes_a_studied_day(learner):
    # A day_clear ledger row alone, on a day nothing was studied: not a
    # day shown up, and not a practice answer.
    _studied(learner, [0, 1])
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO xp_ledger (user_id, source, ref, xp, awarded_at) VALUES (%s, 'day_clear', 'x', 55, %s)",
                (learner, datetime.now(timezone.utc) - timedelta(days=2)),
            )
        conn.commit()
    finally:
        conn.close()
    assert srs.get_streak(learner) == {"current": 2, "longest": 2}
    assert srs.get_daily_practice_counts(learner, days=7) == []
    assert (_today() - timedelta(days=2)) not in srs._studied_days(learner)


def test_clearing_does_not_turn_the_day_into_practice(client, learner):
    _studied(learner, [0])
    assert _clear(client, learner)["cleared"] is True
    assert srs.get_daily_practice_counts(learner, days=7) == []
    with acting_as(learner):
        profile = client.get("/api/profile").json()
    today = _today().isoformat()
    assert next(d for d in profile["calendar"] if d["date"] == today)["practice"] == 0


# ── The milestones ───────────────────────────────────────────────

def test_the_seventh_day_is_a_ticket_and_earns_a_rest_day(client, learner):
    _studied(learner, range(0, 7))
    body = _clear(client, learner)
    assert (body["streak"], body["milestone"], body["tier"]) == (7, 7, "ticket")
    assert (body["bonus"], body["jackpot"]) == (60, 250)
    assert body["xp"]["xp_earned"] == 310
    assert body["rest"] == {"held": 1, "earned": True, "next_at": 14}
    assert (body["next_milestone"], body["next_jackpot"]) == (14, 500)
    assert [d["state"] for d in body["week"]] == ["studied"] * 7
    assert _events(learner, "day_clear") == [{"streak": 7, "milestone": 7, "tier": "ticket"}]


def test_the_thirtieth_day_is_the_month(client, learner):
    _studied(learner, range(0, 30))
    body = _clear(client, learner)
    assert (body["streak"], body["milestone"], body["tier"]) == (30, 30, "month")
    assert (body["bonus"], body["jackpot"]) == (175, 1000)
    assert (body["next_milestone"], body["next_jackpot"]) == (50, 1500)
    # The month's sheet: thirty days ending today, all studied here.
    assert len(body["month"]) == 30
    assert body["month"][-1]["day"] == _today().isoformat()
    assert {d["state"] for d in body["month"]} == {"studied"}


def test_only_the_month_carries_the_month_sheet(client, learner):
    _studied(learner, range(0, 7))
    assert _clear(client, learner)["month"] is None


def test_a_rest_day_is_earned_at_7_and_14_and_two_are_held_at_most(learner):
    today = _today()
    day = lambda back: today - timedelta(days=back)  # noqa: E731
    first = srs.record_day_clear(learner, day(40), 7, 60, 250, 7)
    second = srs.record_day_clear(learner, day(33), 14, 95, 500, 14)
    third = srs.record_day_clear(learner, day(17), 30, 175, 1000, 30)
    assert [r["rest_earned"] for r in (first, second, third)] == [True, True, False]
    assert srs.rest_held(learner) == 2
    # The third day's milestone is still in the ticket book: only the
    # rest day was not kept.
    assert [t["days"] for t in srs.get_day_tickets(learner)] == [7, 14, 30]
    # Three, never a rest day: below the seventh.
    assert srs.record_day_clear(learner, day(50), 3, 40, 100, 3)["rest_earned"] is False


def test_a_milestone_clear_at_the_cap_keeps_no_rest_day(client, learner):
    today = _today()
    for back, streak in ((60, 7), (53, 14)):
        srs.record_day_clear(learner, today - timedelta(days=back), streak, 0, 0, streak)
    _studied(learner, range(0, 14))
    body = _clear(client, learner)
    assert body["milestone"] == 14
    assert body["rest"] == {"held": 2, "earned": False, "next_at": None}


# ── The profile ──────────────────────────────────────────────────

def test_the_profile_carries_the_ticket_book(client, learner):
    today = _today()
    srs.record_day_clear(learner, today - timedelta(days=20), 3, 40, 100, 3)
    srs.record_day_clear(learner, today - timedelta(days=16), 7, 60, 250, 7)
    srs.record_day_clear(learner, today - timedelta(days=15), 8, 65, 0, None)
    # Five days on the streak, today not yet studied: the next ticket
    # is the seventh day's.
    _studied(learner, range(1, 6))
    with acting_as(learner):
        profile = client.get("/api/profile").json()
    assert profile["tickets"] == [
        {"days": 3, "day": (today - timedelta(days=20)).isoformat()},
        {"days": 7, "day": (today - timedelta(days=16)).isoformat()},
    ]
    assert profile["restHeld"] == 1
    assert profile["nextMilestone"] == 7


def test_the_profile_s_next_milestone_is_today_s_until_it_is_cleared(client, learner):
    _studied(learner, range(0, 7))
    with acting_as(learner):
        assert client.get("/api/profile").json()["nextMilestone"] == 7
        client.post("/api/today/clear")
        assert client.get("/api/profile").json()["nextMilestone"] == 14


# ── Erasure ──────────────────────────────────────────────────────

def test_deleting_the_account_takes_the_days_and_the_rest_tickets(client, learner):
    _studied(learner, range(0, 7))
    assert _clear(client, learner)["rest"]["earned"] is True
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            counts = delete_user_rows(cur, learner)
            conn.commit()
            assert counts["day_clears"] == 1 and counts["rest_tickets"] == 1
            for table in ("day_clears", "rest_tickets"):
                cur.execute(f"SELECT COUNT(*) FROM {table} WHERE user_id = %s", (learner,))
                assert cur.fetchone()[0] == 0, table
    finally:
        conn.close()
