"""
回数券 — the credits ledger (plan 069), on synthetic learners.

Every test runs on its own probe-<uuid> user so the rows it writes are
its own and are erased on the way out (delete_user_rows, the account
route's own plan). The economy's rules, one each: a new account is
seeded with the day's refill; the refill is taken once per local day
and never past the cap; a fare is charged only after the scheduler
accepted the review; shadow mode records what there is and never
blocks; enforcement refuses with the 402 shapes; a pass never spends;
the free tier's deck count; the day boundary follows the learner's
clock; and the ledger is in the account's deletion plan.
"""
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest

import core.auth as auth
from core import credits
from core.db import db_conn
from core.srs_instance import srs
from routes.account import PLAN, delete_user_rows


def _tables(plan):
    return [t for t, _c, _w in plan]


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


def _rows(user):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT delta, reason, ref FROM credit_ledger WHERE user_id = %s ORDER BY id", (user,))
            return cur.fetchall()
    finally:
        conn.close()


def _set_profile(user, **cols):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            sets = ", ".join(f"{k} = %s" for k in cols)
            cur.execute(f"UPDATE user_profiles SET {sets} WHERE user_id = %s", (*cols.values(), user))
        conn.commit()
    finally:
        conn.close()
    credits.forget(user)


# ── The seed and the refill ──────────────────────────────────────

def test_a_new_account_starts_with_the_days_refill(uid):
    s = credits.summary(uid)
    assert s["balance"] == credits.DAILY_REFILL
    assert s["cap"] == credits.CAP and s["dailyRefill"] == credits.DAILY_REFILL
    assert s["plan"] == "free" and s["unlimited"] is False
    assert s["enforced"] is False
    assert _rows(uid) == [(credits.DAILY_REFILL, "grant", "seed")]
    # The seed IS today's refill: reading again adds nothing.
    credits.refill_if_due(uid)
    assert _rows(uid) == [(credits.DAILY_REFILL, "grant", "seed")]


def test_the_refill_comes_once_per_local_day_and_holds_at_the_cap(uid):
    credits.summary(uid)
    # Yesterday's seed (30), today's refill: only what the cap allows.
    _set_profile(uid, credits_refilled_on=date.today() - timedelta(days=1))
    s = credits.refill_if_due(uid)
    assert s["balance"] == credits.CAP
    assert [(r[0], r[1]) for r in _rows(uid)] == [(30, "grant"), (20, "refill")]
    # Asking twice the same day is one refill.
    credits.refill_if_due(uid)
    assert len(_rows(uid)) == 2
    # Spent down to 5, the next day's refill is the whole 30.
    credits.grant(uid, -45, "test")
    _set_profile(uid, credits_refilled_on=date.today() - timedelta(days=1))
    assert credits.refill_if_due(uid)["balance"] == 35
    assert _rows(uid)[-1][0] == credits.DAILY_REFILL
    # At 45 it is the 5 that fit.
    credits.grant(uid, 10, "test")
    _set_profile(uid, credits_refilled_on=date.today() - timedelta(days=1))
    assert credits.refill_if_due(uid)["balance"] == credits.CAP
    assert _rows(uid)[-1][0] == credits.CAP - 45


def test_the_day_boundary_is_the_learners_midnight():
    # 23:30 UTC on the 1st is already the 2nd for a learner at UTC+1,
    # and still the 1st at UTC-5.
    at = datetime(2026, 9, 1, 23, 30, tzinfo=timezone.utc)
    assert credits.local_today(60, at) == date(2026, 9, 2)
    assert credits.local_today(-300, at) == date(2026, 9, 1)
    assert credits.local_today(None, at) == date(2026, 9, 1)
    # The next refill is the next local midnight, as a UTC instant.
    assert credits.next_refill_at(60, at) == datetime(2026, 9, 2, 23, 0, tzinfo=timezone.utc)
    assert credits.next_refill_at(0, at) == datetime(2026, 9, 2, 0, 0, tzinfo=timezone.utc)


# ── The fare ───────────────────────────────────────────────────

def test_a_review_costs_one_credit_after_the_scheduler_accepts_it(client):
    user = auth.DEV_USER_ID
    before = credits.refill_if_due(user)["balance"]
    r = client.post("/api/kana/review", json={"card_id": "probe_credit_card", "mode": "kana.mcq.reading", "quality": 4})
    assert r.status_code == 200
    body = r.json()
    assert body["credits"] == {"balance": before - 1, "unlimited": False}
    assert credits.refill_if_due(user)["balance"] == before - 1
    # A rejected review is not a ride: the mode is refused before the
    # scheduler, and nothing is charged.
    r = client.post("/api/today/review", json={"card_id": "probe_credit_card", "mode": "banana", "quality": 4})
    assert r.status_code == 400
    assert credits.refill_if_due(user)["balance"] == before - 1
    # The fare is in every review response, and the summary beside the
    # run's total.
    today = client.get("/api/today").json()
    assert today["fare"] == today["total"]
    assert today["credits"]["balance"] == before - 1
    assert client.get("/api/credits").json()["balance"] == before - 1


def test_shadow_mode_records_what_there_is_and_never_blocks(uid, caplog):
    credits.summary(uid)
    credits.grant(uid, -credits.DAILY_REFILL + 1, "test")  # 1 credit left
    assert credits.spend(uid, 1, "c1") == {"balance": 0, "unlimited": False}
    # Empty, and still not refused: the ledger records nothing (there
    # was nothing to record), the balance never goes below zero, and
    # the refusal that WOULD have happened is logged.
    with caplog.at_level("INFO", logger="core.credits"):
        assert credits.spend(uid, 1, "c2") == {"balance": 0, "unlimited": False}
    assert "would have blocked" in caplog.text
    assert credits.balance(uid) == 0
    fares = lambda: [d for d, r, _f in _rows(uid) if r == "review"]
    assert fares() == [-1]
    # Three credits with two left: the two are charged, not three.
    credits.grant(uid, 2, "test")
    assert credits.spend(uid, 3, "c3")["balance"] == 0
    assert fares() == [-1, -2]


def test_enforcement_refuses_with_the_402_shapes(uid, monkeypatch):
    monkeypatch.setattr(credits, "ENFORCE", True)
    credits.summary(uid)
    credits.grant(uid, -credits.DAILY_REFILL, "test")  # 0
    with pytest.raises(credits.OutOfCredits) as e:
        credits.spend(uid, 1, "c1")
    assert e.value.balance == 0 and e.value.refill_at.endswith("+00:00")
    assert _rows(uid)[-1][1] == "grant"  # nothing charged
    # The pass features and the free tier's counts.
    with pytest.raises(credits.PassRequired):
        credits.require_pass(uid)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for i in range(credits.FREE_DECKS):
                cur.execute("INSERT INTO decks (user_id, name, type) VALUES (%s, %s, 'standard')", (uid, f"d{i}"))
            with pytest.raises(credits.LimitReached) as e:
                credits.check_deck_limit(cur, uid)
            assert e.value.what == "decks" and e.value.limit == credits.FREE_DECKS
            credits.check_card_limit(cur, uid, adding=credits.FREE_CARDS)
            with pytest.raises(credits.LimitReached):
                credits.check_card_limit(cur, uid, adding=credits.FREE_CARDS + 1)
        conn.rollback()
    finally:
        conn.close()


def test_the_402s_reach_the_client_flat(client, monkeypatch):
    # The route-level shape, through the app's handlers, on the real
    # dev user: a pass feature, refused.
    monkeypatch.setattr(credits, "ENFORCE", True)
    credits.forget(auth.DEV_USER_ID)
    r = client.get("/api/reading/history")
    assert r.status_code == 402
    assert r.json() == {"detail": "pass_required"}
    credits.forget(auth.DEV_USER_ID)


def test_a_pass_never_spends_and_prints_no_balance(uid):
    credits.summary(uid)
    _set_profile(uid, plan="pass", plan_until=None)
    s = credits.summary(uid)
    assert s["unlimited"] is True and s["balance"] is None and s["plan"] == "pass"
    assert credits.spend(uid, 1, "c1") == {"balance": None, "unlimited": True}
    assert [r[1] for r in _rows(uid)] == ["grant"]
    assert credits.require_pass(uid) == uid
    # An expired pass is a free pass again.
    _set_profile(uid, plan="pass", plan_until=datetime.now(timezone.utc) - timedelta(days=1))
    assert credits.summary(uid)["unlimited"] is False


def test_the_tz_offset_lands_on_the_profile(client):
    r = client.patch("/api/profile/learning", json={"tzOffsetMin": 120})
    assert r.status_code == 200 and r.json()["tzOffsetMin"] == 120
    assert client.patch("/api/profile/learning", json={"tzOffsetMin": 9000}).status_code == 422


def test_the_ledger_is_in_the_deletion_plan():
    assert "credit_ledger" in _tables(PLAN)
    assert _tables(PLAN).index("credit_ledger") < _tables(PLAN).index("user_profiles")
