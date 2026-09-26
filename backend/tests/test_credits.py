"""
回数券 — the credits ledger (plan 069), on synthetic learners.

Every test runs on its own probe-<uuid> user so the rows it writes are
its own and are erased on the way out (delete_user_rows, the account
route's own plan). The economy's rules, one each: a new account is
welcomed with the signup bonus, which sits above the cap and is spent
down before the refill has anything to do; the refill lands one credit
every REFILL_EVERY through the day and waits to be claimed (plan 139),
never past the cap, and a full tank banks nothing; a claim is paid out
once; a fare claims what has landed before it charges, and is charged
only after the scheduler accepted the review; the kana line is charged
nothing at all; shadow mode records what there is and never blocks;
enforcement refuses with the 402 shapes; a pass never spends; the free
tier's deck count; the learner's day follows their clock; and the
ledger is in the account's deletion plan.
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

EVERY = credits.REFILL_EVERY


def _clock_back(user, by):
    """Put the refill's clock `by` in the past: what an absence is."""
    _set_profile(user, credits_accrued_at=datetime.now(timezone.utc) - by)


def _down_to(user, n):
    """Spend the welcome down to `n` -- the refill only has anything to
    do under the cap -- with a grant, which also restarts the clock."""
    have = credits.read_fresh(user)["balance"]
    credits.grant(user, n - have, "test")
    assert credits.read_fresh(user)["balance"] == n


def test_a_new_account_is_welcomed_with_the_signup_bonus(uid):
    s = credits.summary(uid)
    assert s["balance"] == credits.SIGNUP_BONUS
    assert s["cap"] == credits.CAP and s["dailyRefill"] == credits.DAILY_REFILL
    assert s["signupBonus"] == credits.SIGNUP_BONUS
    assert s["plan"] == "free" and s["unlimited"] is False
    assert s["enforced"] is False
    assert _rows(uid) == [(credits.SIGNUP_BONUS, "grant", "welcome")]
    # Nothing is owed on top of it, and nothing is coming: the welcome
    # holds the balance over the cap.
    assert s["pending"] == 0
    assert s["nextCreditAt"] is None and s["fullAt"] is None
    assert credits.claim(uid)["claimed"] == 0
    assert _rows(uid) == [(credits.SIGNUP_BONUS, "grant", "welcome")]
    # It is deliberately over the cap — the cap bounds the refill, not
    # what a learner may hold — and it is granted once, ever.
    assert credits.SIGNUP_BONUS > credits.CAP


def test_the_refill_is_the_days_thirty_spread_over_the_day():
    assert credits.REFILL_EVERY == timedelta(minutes=48)
    assert credits.REFILL_EVERY * credits.DAILY_REFILL == timedelta(days=1)
    assert credits.summary(auth.DEV_USER_ID)["refillEvery"] == 48 * 60


def test_the_accrual_rule():
    t0 = datetime(2026, 9, 1, 8, 0, tzinfo=timezone.utc)
    # One credit per whole 48 minutes; the minutes towards the next are
    # kept on the clock.
    assert credits.accrual(10, t0, t0 + timedelta(minutes=47)) == (0, t0)
    assert credits.accrual(10, t0, t0 + timedelta(minutes=48)) == (1, t0 + EVERY)
    assert credits.accrual(10, t0, t0 + timedelta(minutes=150)) == (3, t0 + 3 * EVERY)
    # Never past the cap, and a tank that fills drops the remainder:
    # the clock is `now`, not the last credit's minute.
    now = t0 + timedelta(hours=10)
    assert credits.accrual(credits.CAP - 4, t0, now) == (4, now)
    # A full tank does not read the clock at all.
    assert credits.accrual(credits.CAP, t0, now) == (0, t0)
    assert credits.accrual(credits.SIGNUP_BONUS, t0, now) == (0, t0)
    # And a day of absence from empty is the day's thirty.
    assert credits.accrual(0, t0, t0 + timedelta(days=1))[0] == credits.DAILY_REFILL


def test_the_schedule_names_the_next_credit_and_the_full_tank():
    t0 = datetime(2026, 9, 1, 8, 0, tzinfo=timezone.utc)
    assert credits.schedule(40, 0, t0) == (t0 + EVERY, t0 + 10 * EVERY)
    assert credits.schedule(40, 4, t0) == (t0 + EVERY, t0 + 6 * EVERY)
    assert credits.schedule(40, 10, t0) == (None, None)
    assert credits.schedule(credits.SIGNUP_BONUS, 0, t0) == (None, None)


def test_the_refill_lands_through_the_day_and_waits_to_be_claimed(uid):
    credits.summary(uid)
    _down_to(uid, 10)
    rows = len(_rows(uid))
    # Two and a half hours away: three credits have landed. Reading the
    # balance counts them and writes nothing.
    _clock_back(uid, timedelta(minutes=150))
    s = credits.summary(uid)
    assert s["balance"] == 10 and s["pending"] == 3
    assert len(_rows(uid)) == rows
    assert credits.balance(uid) == 13  # what a fare can draw on
    # 150 minutes is three credits and six minutes towards the fourth,
    # so the next is 42 minutes off, and the tank is full once the
    # other 36 have landed after it.
    nxt = datetime.fromisoformat(s["nextCreditAt"])
    full = datetime.fromisoformat(s["fullAt"])
    assert timedelta(minutes=41) < nxt - datetime.now(timezone.utc) <= timedelta(minutes=42)
    assert full - nxt == (credits.CAP - 13 - 1) * EVERY
    # The claim writes them as one refill row, and only once.
    c = credits.claim(uid)
    assert c["claimed"] == 3 and c["balance"] == 13 and c["pending"] == 0
    assert _rows(uid)[-1] == (3, "refill", None)
    assert credits.claim(uid)["claimed"] == 0
    assert len(_rows(uid)) == rows + 1
    # The minutes towards the fourth were kept.
    assert credits.summary(uid)["nextCreditAt"] == s["nextCreditAt"]


def test_the_refill_holds_at_the_cap_and_a_full_tank_banks_nothing(uid):
    credits.summary(uid)
    _down_to(uid, credits.CAP - 5)
    # A day away: the 30 of it would overflow, so the 5 that fit land.
    _clock_back(uid, timedelta(days=1))
    s = credits.summary(uid)
    assert s["pending"] == 5 and s["nextCreditAt"] is None and s["fullAt"] is None
    assert credits.claim(uid)["balance"] == credits.CAP
    # Full, the clock does not run: a week later nothing is owed...
    _clock_back(uid, timedelta(days=7))
    assert credits.summary(uid)["pending"] == 0
    # ...and the fare that takes it back under the cap starts the clock
    # from that moment, not from a week ago.
    assert credits.spend(uid, 1, "c1")["balance"] == credits.CAP - 1
    s = credits.summary(uid)
    assert s["pending"] == 0
    assert datetime.fromisoformat(s["nextCreditAt"]) - datetime.now(timezone.utc) > EVERY - timedelta(minutes=1)


def test_the_welcome_is_spent_down_before_the_refill_resumes(uid):
    credits.summary(uid)
    # A balance still over the cap takes nothing, however long away.
    _clock_back(uid, timedelta(days=3))
    assert credits.summary(uid)["pending"] == 0
    # Spent down to the cap exactly, still nothing.
    credits.grant(uid, credits.CAP - credits.SIGNUP_BONUS, "test")
    _clock_back(uid, timedelta(days=3))
    assert credits.summary(uid)["pending"] == 0
    # The fare that takes it under starts the refill, from then.
    credits.spend(uid, 1, "c1")
    assert credits.summary(uid)["pending"] == 0
    _clock_back(uid, EVERY)
    assert credits.summary(uid)["pending"] == 1


def test_two_workers_claiming_at_once_pay_out_once(uid):
    # The clock's conditional UPDATE is the lock: the second worker's
    # UPDATE waits on the first's row, finds the clock moved when it
    # commits, and pays nothing -- it reports the first one's balance.
    import threading
    credits.summary(uid)
    _down_to(uid, 10)
    _clock_back(uid, 3 * EVERY)
    first, second = db_conn(), db_conn()
    try:
        now = datetime.now(timezone.utc)
        with first.cursor() as cur:
            a = credits._settle(cur, uid, now, claim=True)
        got = {}

        def race():
            with second.cursor() as cur:
                got["b"] = credits._settle(cur, uid, now, claim=True)
            second.commit()

        t = threading.Thread(target=race)
        t.start()
        t.join(0.3)
        assert t.is_alive()  # waiting on the first worker's row lock
        first.commit()
        t.join(5)
        assert not t.is_alive()
    finally:
        first.close()
        second.close()
    credits.forget(uid)
    assert a["claimed"] == 3 and got["b"]["claimed"] == 0
    assert got["b"]["balance"] == 13
    assert [r for r in _rows(uid) if r[1] == "refill"] == [(3, "refill", None)]


def test_a_fare_claims_what_has_landed_before_it_charges(uid, monkeypatch):
    monkeypatch.setattr(credits, "ENFORCE", True)
    credits.summary(uid)
    _down_to(uid, 0)
    # Nothing in the balance, two credits landed and unclaimed: the fare
    # is not refused, because they are the learner's.
    _clock_back(uid, 2 * EVERY)
    assert credits.spend(uid, 1, "c1") == {"balance": 1, "unlimited": False}
    assert [(d, r) for d, r, _f in _rows(uid)][-2:] == [(2, "refill"), (-1, "review")]
    assert credits.summary(uid)["pending"] == 0


def test_a_clock_from_before_the_refill_filled_starts_where_the_lump_left_off(uid):
    # An account from the midnight rule: its last lump taken two days
    # ago, the clock never run. It is owed from the midnight after that
    # day -- a day and a bit, capped like any other absence.
    credits.summary(uid)
    _down_to(uid, 0)
    _set_profile(uid, credits_accrued_at=None, tz_offset_min=0,
                 credits_refilled_on=datetime.now(timezone.utc).date() - timedelta(days=2))
    assert credits.summary(uid)["pending"] >= credits.DAILY_REFILL
    # Refilled today, it starts filling now rather than at a midnight
    # that no longer means anything.
    _set_profile(uid, credits_accrued_at=None, tz_offset_min=0,
                 credits_refilled_on=datetime.now(timezone.utc).date())
    s = credits.summary(uid)
    assert s["pending"] == 0
    assert datetime.fromisoformat(s["nextCreditAt"]) - datetime.now(timezone.utc) > EVERY - timedelta(minutes=1)
    # A profile that never took a lump either starts now as well.
    _set_profile(uid, credits_accrued_at=None, credits_refilled_on=None)
    assert credits.summary(uid)["pending"] == 0


def test_the_claim_route(client):
    user = auth.DEV_USER_ID
    body = client.post("/api/credits/claim").json()
    assert body["claimed"] >= 0 and body["pending"] == 0
    assert client.post("/api/credits/claim").json()["claimed"] == 0
    got = client.get("/api/credits").json()
    assert got["balance"] == credits.read_fresh(user)["balance"]
    for key in ("pending", "nextCreditAt", "fullAt", "refillEvery"):
        assert key in got


def test_the_learners_day_is_their_midnight():
    # 23:30 UTC on the 1st is already the 2nd for a learner at UTC+1,
    # and still the 1st at UTC-5.
    at = datetime(2026, 9, 1, 23, 30, tzinfo=timezone.utc)
    assert credits.local_today(60, at) == date(2026, 9, 2)
    assert credits.local_today(-300, at) == date(2026, 9, 1)
    assert credits.local_today(None, at) == date(2026, 9, 1)
    # The next midnight -- when the daily allowances elsewhere reset --
    # as a UTC instant.
    assert credits.next_midnight(60, at) == datetime(2026, 9, 2, 23, 0, tzinfo=timezone.utc)
    assert credits.next_midnight(0, at) == datetime(2026, 9, 2, 0, 0, tzinfo=timezone.utc)


# ── The fare ───────────────────────────────────────────────────

def test_a_review_costs_one_credit_after_the_scheduler_accepts_it(client):
    user = auth.DEV_USER_ID
    before = credits.read_fresh(user)["balance"]
    # Vocab, not kana: the kana line rides free now, so it is no longer
    # a witness for "a review costs a credit" (see below for its own).
    r = client.post("/api/vocab/review", json={"card_id": "probe_credit_card", "mode": "vocab.flashcard.f2b", "quality": 4})
    assert r.status_code == 200
    body = r.json()
    assert body["credits"] == {"balance": before - 1, "unlimited": False}
    assert credits.read_fresh(user)["balance"] == before - 1
    # A rejected review is not a ride: the mode is refused before the
    # scheduler, and nothing is charged.
    r = client.post("/api/today/review", json={"card_id": "probe_credit_card", "mode": "banana", "quality": 4})
    assert r.status_code == 400
    assert credits.read_fresh(user)["balance"] == before - 1
    # The fare is in every review response, and the summary beside the
    # run's total -- at most it, never past it: the free lanes count
    # into what the run CLEARS and out of what it COSTS.
    today = client.get("/api/today").json()
    assert 0 <= today["fare"] <= today["total"]
    assert today["credits"]["balance"] == before - 1
    assert client.get("/api/credits").json()["balance"] == before - 1


# ── 無料 — the kana line ───────────────────────────────────────

def test_the_kana_line_is_priced_at_nothing():
    # The rule itself: one table, read by every review endpoint.
    assert credits.FREE_SOURCES == frozenset({"kana"})
    assert credits.cost_of("kana") == 0
    assert credits.cost_of("kana.flashcard.f2b") == 0
    assert credits.cost_of("kana.write_kana") == 0
    for paid in ("vocab.flashcard.f2b", "kanji.readings", "grammar.fill_in",
                 "standard.flashcard.f2b", "vocab", "kanji", "grammar"):
        assert credits.cost_of(paid) == credits.COST_PER_REVIEW, paid
    # A source is matched whole, and a missing one is not a free ride.
    assert not credits.is_free("kanamoji.flashcard.f2b")
    assert credits.cost_of(None) == credits.COST_PER_REVIEW
    assert credits.cost_of("") == credits.COST_PER_REVIEW
    # And the client is told rather than left to mirror it in the dark
    # (frontend/src/domain/credits.js).
    assert credits.summary(auth.DEV_USER_ID)["freeSources"] == ["kana"]


def test_a_kana_review_is_charged_nothing_and_writes_no_row(client):
    user = auth.DEV_USER_ID
    before = credits.read_fresh(user)["balance"]
    rows = len(_rows(user))
    body = {"card_id": "kana_\u3042", "mode": "kana.flashcard.f2b", "quality": 4}
    r = client.post("/api/kana/review", json=body)
    assert r.status_code == 200
    # The response still carries the balance -- the HUD reconciles
    # against it either way -- and the balance has not moved.
    assert r.json()["credits"] == {"balance": before, "unlimited": False}
    assert credits.read_fresh(user)["balance"] == before
    # A fare of nothing is not a ledger row of zero.
    assert len(_rows(user)) == rows
    # Nor met in the daily queue, which prices the same card the same.
    r = client.post("/api/today/review", json=body)
    assert r.status_code == 200
    assert r.json()["credits"] == {"balance": before, "unlimited": False}
    assert credits.read_fresh(user)["balance"] == before
    assert len(_rows(user)) == rows


def test_the_queue_prices_the_card_and_not_the_mode_key_it_is_sent(client):
    # A free ride is not something a payload gets to ask for. The mixed
    # queue is the one endpoint that must read the mode off the client,
    # so it prices the CARD -- card_index answers which source a
    # (card, mode) pair really belongs to -- and anything it cannot
    # place pays the full fare.
    from routes.today import _review_cost
    assert _review_cost("kana_\u3042", "kana.flashcard.f2b") == 0
    assert _review_cost("probe_not_a_card", "kana.flashcard.f2b") == credits.COST_PER_REVIEW
    assert _review_cost("custom_1_abc", "kana.flashcard.f2b") == credits.COST_PER_REVIEW
    # And through the route, on the dev user's own balance.
    user = auth.DEV_USER_ID
    before = credits.read_fresh(user)["balance"]
    r = client.post("/api/today/review", json={"card_id": "probe_not_a_card", "mode": "kana.flashcard.f2b", "quality": 4})
    assert r.status_code == 200
    assert credits.read_fresh(user)["balance"] == before - 1


def test_enforcement_never_refuses_a_free_review(uid, monkeypatch):
    monkeypatch.setattr(credits, "ENFORCE", True)
    credits.summary(uid)
    credits.grant(uid, -credits.SIGNUP_BONUS, "test")  # 0
    # The paid fare is refused at zero -- the rule the 402 exists for...
    with pytest.raises(credits.OutOfCredits):
        credits.spend(uid, credits.cost_of("vocab.flashcard.f2b"), "c1")
    # ...and the free one is not a fare at all, so there is nothing to
    # refuse: an empty balance still rides the kana line.
    assert credits.spend(uid, credits.cost_of("kana.flashcard.f2b"), "c2") == {
        "balance": 0, "unlimited": False,
    }
    assert [r[1] for r in _rows(uid)] == ["grant", "grant"]


def test_shadow_mode_records_what_there_is_and_never_blocks(uid, caplog):
    credits.summary(uid)
    credits.grant(uid, -credits.SIGNUP_BONUS + 1, "test")  # 1 credit left
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
    credits.grant(uid, -credits.SIGNUP_BONUS, "test")  # 0
    with pytest.raises(credits.OutOfCredits) as e:
        credits.spend(uid, 1, "c1")
    assert e.value.balance == 0 and e.value.next_credit_at.endswith("+00:00")
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
