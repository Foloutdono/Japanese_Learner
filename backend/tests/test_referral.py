"""縁 — the referral (plan 332): the owner's figures, who may name whom,
what converts a filleul, what pays a parrain, and what a reward is never
allowed to be (a day studied, a place on the 番付)."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from core import credits, events
from core.db import db_conn
from core.srs_instance import srs
from routes import account
from routes import referral as referral_routes
from study import referral as r

NOW = datetime.now(timezone.utc)


# ── The figures are the owner's option B ───────────────────────────────
def test_the_figures_are_option_b():
    assert (r.FILLEUL, r.CONVERSION, r.WEEK, r.WEEKS, r.MONTH_CAP, r.MAX_WEEKS) == (300, 100, 25, 8, 500, 4)
    assert (r.SLOTS, r.CHOOSE_DAYS, r.WINDOW_DAYS, r.STUDY_DAYS, r.ACTIVE_DAYS) == (3, 3, 14, 3, 3)


def test_a_referral_pays_through_its_own_ledger_reason_and_closed_events():
    assert "referral" in credits.REASONS and "referral" in credits.AWARDS
    assert set(events.VALUES["referral_claimed"]["kind"]) == set(r.KINDS)
    for name in ("referral_asked", "referral_linked", "referral_converted", "referral_released"):
        assert name in events.EVENTS
    assert "referral" in events.VALUES["boarding_done"]["source"]


def test_the_routes_hold_a_username_to_the_duels_pattern():
    with pytest.raises(Exception):
        referral_routes.Named(username="a b")
    with pytest.raises(Exception):
        referral_routes.Named(username="x" * 21)
    assert referral_routes.Named(username="Aiko_2").username == "Aiko_2"


def test_both_tables_are_erased_with_the_account():
    tables = {entry[0] for entry in account.PLAN}
    assert {"referrals", "referral_rewards"} <= tables


# ── Fixtures ────────────────────────────────────────────────────────────
@pytest.fixture
def people():
    made = []

    def make(age_days=1, plan=None, until=None):
        user = f"ref-{uuid.uuid4().hex[:10]}"
        name = f"r{uuid.uuid4().hex[:12]}"
        from routes.profile import ensure_profile_row
        ensure_profile_row(user)
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("UPDATE user_profiles SET username = %s, created_at = %s, tz_offset_min = 0, "
                            "plan = COALESCE(%s, plan), plan_until = %s WHERE user_id = %s",
                            (name, NOW - timedelta(days=age_days), plan, until, user))
            conn.commit()
        finally:
            conn.close()
        made.append(user)
        return user, name

    yield make
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for user in made:
                cur.execute("DELETE FROM referrals WHERE filleul_id = %s OR sponsor_id = %s", (user, user))
                cur.execute("DELETE FROM referral_rewards WHERE filleul_id = %s OR sponsor_id = %s", (user, user))
                for table in ("xp_ledger", "credit_ledger", "event_log", "user_profiles"):
                    cur.execute(f"DELETE FROM {table} WHERE user_id = %s", (user,))
                cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (f"{user}:%",))
        conn.commit()
    finally:
        conn.close()
    for user in made:
        srs.forget_history(user)
        credits.forget(user)
        r._settled.pop(user, None)


@pytest.fixture(autouse=True)
def verified():
    r.verifier = lambda user: True
    yield
    r.verifier = None


def _study(user, *days):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for i, at in enumerate(days):
                cur.execute("INSERT INTO review_log (card_id, mode, quality, xp_earned, reviewed_at) "
                            "VALUES (%s,%s,4,0,%s)", (f"{user}:vocab_N5_x_y{i}", "vocab.flashcard.f2b", at))
        conn.commit()
    finally:
        conn.close()
    srs.forget_history(user)
    r._settled.clear()


def _link(people, sponsor_name=None, **filleul):
    sponsor, name = people() if sponsor_name is None else sponsor_name
    fid, fname = people(**filleul)
    r.choose(fid, name)
    r.answer(sponsor, fname, True)
    return (sponsor, name), (fid, fname)


def _balance(user):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COALESCE(SUM(delta), 0) FROM credit_ledger WHERE user_id = %s AND reason = 'referral'",
                        (user,))
            return int(cur.fetchone()[0])
    finally:
        conn.close()


def _age(user, days):
    """The account was opened `days` ago (named while young, read later)."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE user_profiles SET created_at = %s WHERE user_id = %s", (NOW - timedelta(days=days), user))
        conn.commit()
    finally:
        conn.close()
    r._settled.clear()


def _converted(people, sponsor_name=None):
    (sponsor, name), (fid, fname) = _link(people, sponsor_name=sponsor_name)
    _age(fid, 5)
    start = NOW - timedelta(days=5)
    _study(fid, *(start + timedelta(days=k, hours=2) for k in range(3)))
    r.view(fid)
    return (sponsor, name), (fid, fname)


# ── Choosing a parrain ─────────────────────────────────────────────────
def test_a_parrain_is_named_by_username_in_any_case(people):
    sponsor, name = people()
    fid, fname = people()
    assert r.choose(fid, name.upper())["username"] == name
    v = r.view(sponsor)
    # Before the parrain accepts, all they see of the learner is the username.
    assert v["sponsoring"]["requests"] == [{"username": fname}]
    assert v["sponsoring"]["filleuls"] == []
    assert r.view(fid)["me"]["sponsor"] == {"username": name, "state": "asked", "studyDays": 0, "studyOf": 3,
                                            "windowDay": 2, "window": 14}


def test_the_choice_is_refused_by_code(people):
    me, myname = people()
    with pytest.raises(r.Refused) as e:
        r.choose(me, myname)
    assert e.value.code == "referral_self"
    with pytest.raises(r.Refused) as e:
        r.choose(me, "nobody_has_this_name")
    assert e.value.code == "referral_not_found"
    late, _ = people(age_days=4)
    with pytest.raises(r.Refused) as e:
        r.choose(late, myname)
    assert e.value.code == "referral_closed"


def test_a_parrain_has_three_places(people):
    sponsor = people()
    for _ in range(3):
        _link(people, sponsor_name=sponsor)
    fourth, _ = people()
    with pytest.raises(r.Refused) as e:
        r.choose(fourth, sponsor[1])
    assert e.value.code == "referral_full"


def test_a_parrain_is_named_once_and_a_refused_learner_names_another(people):
    (a, aname), (b, bname) = people(), people()
    fid, fname = people()
    r.choose(fid, aname)
    with pytest.raises(r.Refused) as e:
        r.choose(fid, bname)
    assert e.value.code == "referral_closed"
    r.answer(a, fname, False)
    assert r.view(fid)["me"]["sponsor"]["state"] == "refused"
    assert r.view(fid)["me"]["canChoose"]
    r.choose(fid, bname)
    r.answer(b, fname, True)
    with pytest.raises(r.Refused):
        r.choose(fid, aname)


# ── The conversion ─────────────────────────────────────────────────────
def test_three_days_of_study_convert_and_pay_both(people):
    (sponsor, _), (fid, fname) = _converted(people)
    assert _balance(fid) == r.FILLEUL
    v = r.view(fid)
    assert v["me"]["sponsor"]["state"] == "converted" and v["me"]["welcome"]
    r.told(fid)
    assert not r.view(fid)["me"]["welcome"]
    f = r.view(sponsor)["sponsoring"]["filleuls"][0]
    assert f["owed"] == r.CONVERSION and f["state"] == "active"
    assert r.claim(sponsor, fname) == {"credits": r.CONVERSION, "xp": 0}
    assert _balance(sponsor) == r.CONVERSION
    assert r.claim(sponsor, fname) is None       # paid once


def test_two_days_do_not_convert(people):
    (sponsor, _), (fid, _) = _link(people)
    _age(fid, 5)
    _study(fid, NOW - timedelta(days=4), NOW - timedelta(days=3))
    assert r.view(fid)["me"]["sponsor"]["studyDays"] == 2
    assert _balance(fid) == 0 and r.view(sponsor)["sponsoring"]["owed"] == 0


def test_a_guest_account_never_converts(people):
    r.verifier = lambda user: False
    (sponsor, _), (fid, _) = _converted(people)
    assert _balance(fid) == 0
    assert r.view(fid)["me"]["sponsor"]["state"] == "accepted"


# ── The weeks ──────────────────────────────────────────────────────────
def _next_week(now):
    from study.missions import week_window
    return week_window(0, now)[2]


def test_an_active_week_pays_only_if_the_parrain_studied_it(people):
    (sponsor, _), (fid, fname) = _converted(people)
    monday = _next_week(NOW)
    _study(fid, *(monday + timedelta(days=k, hours=3) for k in range(3)))
    later = monday + timedelta(days=4)
    r.view(sponsor, now=later)
    assert r.view(sponsor, now=later)["sponsoring"]["owed"] == r.CONVERSION      # not yet: the parrain did nothing
    _study(sponsor, monday + timedelta(hours=5))
    assert r.view(sponsor, now=later)["sponsoring"]["owed"] == r.CONVERSION + r.WEEK


def test_the_month_is_capped_at_500_and_the_rest_clipped(people):
    (sponsor, _), (fid, fname) = _converted(people)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO referral_rewards (sponsor_id, filleul_id, kind, period, credits, paid_at, paid) "
                        "VALUES (%s, %s, 'week', %s, 480, NOW(), 480)", (sponsor, f"{fid}-old", NOW.date()))
        conn.commit()
    finally:
        conn.close()
    assert r.claim(sponsor, fname) == {"credits": 20, "xp": 0}


# ── On the pass: XP for the level, never for the board nor the days ────
def test_a_parrain_on_the_pass_is_paid_xp_that_stays_off_the_board(people):
    sponsor = people(plan="pass")
    (_, _), (fid, fname) = _converted(people, sponsor_name=sponsor)
    assert r.view(sponsor[0])["unit"] == "xp"
    before = srs.xp_totals().get(sponsor[0], 0)
    assert r.claim(sponsor[0], fname) == {"credits": 0, "xp": r.CONVERSION}
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT SUM(xp) FROM xp_ledger WHERE user_id = %s AND source = 'referral'", (sponsor[0],))
            assert cur.fetchone()[0] == r.CONVERSION
    finally:
        conn.close()
    assert srs.xp_totals().get(sponsor[0], 0) == before
    from srs.srs import NOT_STUDY_SOURCES
    assert "referral" in NOT_STUDY_SOURCES
    assert srs._studied_days(sponsor[0]) == set()


# ── A week of the pass, for a filleul's first payment ──────────────────
def test_a_payment_gives_the_parrain_a_week_of_the_pass_four_a_year(people):
    (sponsor, name), (fid, _) = _converted(people)
    got = r.grant_max_week(fid)
    assert got["xp"] == 0
    until = datetime.fromisoformat(got["until"])
    assert timedelta(days=6, hours=23) < until - NOW < timedelta(days=7, hours=1)
    assert r.grant_max_week(fid) is None            # once a filleul (and a day)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for k in range(3):
                cur.execute("INSERT INTO referral_rewards (sponsor_id, filleul_id, kind, period, credits, paid_at, paid) "
                            "VALUES (%s, %s, 'max_week', %s, 0, NOW(), 0)", (sponsor, f"{fid}-{k}", NOW.date()))
        conn.commit()
    finally:
        conn.close()
    # Four this year already: a second filleul's payment gives nothing more.
    (_, _), (fid2, _) = _converted(people, sponsor_name=(sponsor, name))
    assert r.grant_max_week(fid2) is None


def test_a_parrain_on_an_endless_pass_is_given_xp_instead(people):
    sponsor = people(plan="pass")
    (_, _), (fid, _) = _converted(people, sponsor_name=sponsor)
    assert r.grant_max_week(fid) == {"xp": r.MAX_WEEK_XP, "until": None}


# ── Letting go ─────────────────────────────────────────────────────────
def test_a_filleul_still_in_their_window_is_not_let_go(people):
    (sponsor, _), (fid, fname) = _link(people)
    with pytest.raises(r.Refused) as e:
        r.release(sponsor, fname)
    assert e.value.code == "referral_active"


def test_a_quiet_filleul_frees_the_place_and_names_no_other(people):
    (sponsor, name), (fid, fname) = _link(people)
    later = NOW + timedelta(days=20)
    assert r.view(sponsor, now=later)["sponsoring"]["filleuls"][0]["canRelease"]
    r.release(sponsor, fname, now=later)
    assert r.view(sponsor)["sponsoring"]["filleuls"] == []
    other, oname = people()
    with pytest.raises(r.Refused) as e:
        r.choose(fid, oname)
    assert e.value.code == "referral_closed"


# ── What Today's gate says, and to whom ────────────────────────────────
def test_the_gate_speaks_to_a_new_learner_a_waiting_parrain_and_once_at_the_reward(people):
    old, _ = people(age_days=30)
    assert not r.notice_open(old)                       # nothing to say: nothing asked
    young, _ = people()
    assert r.notice_open(young)                         # may name a parrain
    sponsor, sname = people(age_days=30)
    fid, fname = people()
    r.choose(fid, sname)
    assert r.notice_open(sponsor)                       # someone named them
    r.answer(sponsor, fname, True)
    assert not r.notice_open(sponsor)
    _age(fid, 5)
    assert r.notice_open(fid)                           # on the way to the reward
    _study(fid, *(NOW - timedelta(days=5, hours=-2) + timedelta(days=k) for k in range(3)))
    r.view(fid)
    assert r.notice_open(fid)                           # once, to say it was paid
    r.told(fid)
    assert not r.notice_open(fid)
