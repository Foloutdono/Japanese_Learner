"""任務 — the missions (plan 328): the sizing, the choice, the goals, the
payment and what a reward is never allowed to be."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from core import credits, events
from core.db import db_conn
from core.srs_instance import srs
from routes import missions as missions_routes
from study import missions as m

NOW = datetime(2026, 11, 25, 15, 0, tzinfo=timezone.utc)   # a Wednesday


# ── The sizing is the plan ─────────────────────────────────────────────
def test_the_free_learners_income_is_the_strategys_35_a_day():
    assert m.DAILY_INCOME == 30
    assert m.WEEKLY_INCOME == 36
    assert round(m.DAILY_INCOME + m.WEEKLY_INCOME / 7) == 35


def test_every_id_is_closed_in_the_trail_and_the_route():
    assert m.KINDS == events._MISSION_KINDS
    assert set(missions_routes.Kind.__args__) == set(m.KINDS)
    assert set(events.VALUES["mission_done"]["kind"]) == set(m.KINDS)


def test_a_mission_pays_through_its_own_ledger_reason():
    assert "mission" in credits.REASONS
    assert "mission" in credits.AWARDS


# ── Choosing ────────────────────────────────────────────────────────────
def test_the_day_is_the_same_for_the_same_profile_and_date():
    elig = {"due": True, "new": True, "practice": True, "write": True, "accuracy": True}
    assert m.pick_day(elig, 7) == m.pick_day(elig, 7)
    assert m.pick_day(elig, 7)[0] == "due"
    assert len(set(m.pick_day(elig, 7))) == 3


def test_every_kind_comes_round_over_the_days():
    elig = {"due": True, "new": True, "practice": True, "write": True, "accuracy": True}
    seen = {k for d in range(10) for k in m.pick_day(elig, d)}
    assert seen == set(m.DAILY)


def test_a_new_learner_is_given_new_cards_a_practice_and_a_sentence():
    elig = {"due": False, "new": True, "practice": True, "write": True, "accuracy": False}
    assert set(m.pick_day(elig, 3)) == {"new", "practice", "write"}


def test_the_week_always_has_its_five_days_and_two_more():
    elig = {"volume": True, "new_mode": True, "exam_section": True, "write10": True, "duels5": True}
    week = m.pick_week(elig, 47)
    assert week[0] == "days5" and len(week) == 3 and len(set(week)) == 3
    assert "duels5" not in m.pick_week({**elig, "duels5": False}, 47)


# ── Goals that ask a learner to beat themselves are capped ─────────────
def test_new_cards_are_their_average_plus_a_tenth_within_the_ration():
    assert m.new_goal(10, None) == 11
    assert m.new_goal(10, 8) == 8            # never past the day's ration
    assert m.new_goal(0, None) == m.NEW_MIN
    assert m.new_goal(500, None) == m.NEW_MAX
    assert m.new_goal(500, 100) == m.NEW_MAX


def test_accuracy_is_three_points_over_their_own_and_never_past_95():
    assert m.accuracy_goal(80) == 83
    assert m.accuracy_goal(99) == m.ACCURACY_MAX


def test_the_volume_goal_is_a_tenth_more_and_never_150_more():
    assert m.volume_goal(100) == 110
    assert m.volume_goal(5000) == 5150


def test_the_practice_is_the_platform_left_longest_and_never_yesterdays():
    now = datetime.now(timezone.utc)
    last = {"reading": now, "comprehension": now - timedelta(days=9),
            "translation": None, "conversation": now - timedelta(days=2)}
    assert m.practice_platform(last, None) == "translation"
    assert m.practice_platform(last, "translation") == "comprehension"


# ── The database ────────────────────────────────────────────────────────
@pytest.fixture
def uid():
    user = f"msn-{uuid.uuid4().hex[:10]}"
    yield user
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for table in ("missions", "mission_marks", "xp_ledger", "credit_ledger", "day_clears",
                          "dictation_log", "user_profiles"):
                cur.execute(f"DELETE FROM {table} WHERE user_id = %s", (user,))
            cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (f"{user}:%",))
        conn.commit()
    finally:
        conn.close()
    srs.forget_history(user)
    credits.forget(user)


def _profile(user, tz=0):
    from routes.profile import ensure_profile_row
    ensure_profile_row(user)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE user_profiles SET tz_offset_min = %s WHERE user_id = %s", (tz, user))
        conn.commit()
    finally:
        conn.close()


def _review(user, n, at=None, quality=4, card="vocab_N5_x_y"):
    at = at or datetime.now(timezone.utc)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for i in range(n):
                cur.execute("INSERT INTO review_log (card_id, mode, quality, xp_earned, reviewed_at) VALUES (%s,%s,%s,0,%s)",
                            (f"{user}:{card}{i}", "vocab.flashcard.f2b", quality, at))
        conn.commit()
    finally:
        conn.close()
    srs.forget_history(user)


def _rows(user, scope="day"):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT kind, target, credits, xp, done_at, paid_at FROM missions WHERE user_id = %s AND scope = %s ORDER BY slot",
                        (user, scope))
            return cur.fetchall()
    finally:
        conn.close()


def _balance(user):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COALESCE(SUM(delta), 0) FROM credit_ledger WHERE user_id = %s AND reason = 'mission'", (user,))
            return cur.fetchone()[0]
    finally:
        conn.close()


def test_the_day_is_three_missions_and_a_bonus_written_once(uid):
    _profile(uid)
    first = m.view(uid, NOW)
    again = m.view(uid, NOW)
    assert [x["kind"] for x in first["day"]["missions"]] == [x["kind"] for x in again["day"]["missions"]]
    assert len(first["day"]["missions"]) == 3
    assert first["day"]["bonus"]["credits"] == m.BONUS_CREDITS
    assert len(first["week"]["missions"]) == 3
    assert [r[0] for r in _rows(uid, "bonus")] == ["all3"]
    assert {x["credits"] for x in first["day"]["missions"]} == {m.DAY_CREDITS}


def test_a_goal_is_frozen_when_assigned(uid):
    _profile(uid)
    m.view(uid, NOW)
    goals = lambda: [r[:4] for r in _rows(uid)]   # (kind, goal, credits, xp)
    before = goals()
    _review(uid, 40, at=NOW)                   # studying more today raises nothing
    m.view(uid, NOW)
    assert goals() == before


def test_nothing_is_paid_to_a_learner_who_has_not_studied(uid):
    _profile(uid)
    m.view(uid, NOW)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE missions SET done_at = NOW() WHERE user_id = %s AND scope = 'day'", (uid,))
        conn.commit()
    finally:
        conn.close()
    kind = _rows(uid)[0][0]
    assert m.claim(uid, "day", kind, NOW) is None
    assert _balance(uid) == 0


def _finish_first(uid):
    """Study, then mark the first of the day's missions done, as its
    progress would."""
    _review(uid, 3)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE missions SET done_at = NOW() WHERE user_id = %s AND scope = 'day' "
                        "AND slot = 0", (uid,))
        conn.commit()
    finally:
        conn.close()
    return _rows(uid)[0][0]


def test_a_finished_mission_pays_its_credits_and_xp_once(uid):
    _profile(uid)
    now = datetime.now(timezone.utc)
    m.view(uid, now)
    kind = _finish_first(uid)
    got = m.claim(uid, "day", kind, now)
    assert got["credits"] == m.DAY_CREDITS and got["xp"] == m.DAY_XP and got["unit"] == "credits"
    assert _balance(uid) == m.DAY_CREDITS
    assert m.claim(uid, "day", kind, now) is None          # not twice
    assert _balance(uid) == m.DAY_CREDITS


def test_two_requests_at_once_pay_one_reward(uid):
    from concurrent.futures import ThreadPoolExecutor
    _profile(uid)
    now = datetime.now(timezone.utc)
    m.view(uid, now)
    kind = _finish_first(uid)
    with ThreadPoolExecutor(4) as pool:
        out = list(pool.map(lambda _: m.claim(uid, "day", kind, now), range(4)))
    assert sum(1 for o in out if o) == 1
    assert _balance(uid) == m.DAY_CREDITS


def test_a_mission_reward_is_neither_a_study_day_nor_a_practice_answer(uid):
    _profile(uid)
    now = datetime.now(timezone.utc)
    m.view(uid, now)
    kind = _finish_first(uid)
    # Study yesterday only: today's reviews are removed again.
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE review_log SET reviewed_at = reviewed_at - interval '3 days' WHERE card_id LIKE %s", (f"{uid}:%",))
        conn.commit()
    finally:
        conn.close()
    srs.forget_history(uid)
    before = srs._studied_days(uid)
    m.claim(uid, "day", kind, now)
    srs.forget_history(uid)
    assert srs._studied_days(uid) == before
    assert not any(d["count"] for d in srs.get_daily_practice_counts(uid, 1))


def test_the_pass_is_paid_in_xp_never_in_credits(uid):
    _profile(uid)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE user_profiles SET plan = 'pass', plan_until = NOW() + interval '30 days' WHERE user_id = %s", (uid,))
        conn.commit()
    finally:
        conn.close()
    now = datetime.now(timezone.utc)
    assert m.view(uid, now)["unit"] == "xp"
    kind = _finish_first(uid)
    got = m.claim(uid, "day", kind, now)
    assert got["credits"] == 0 and got["xp"] == m.DAY_XP + m.DAY_CREDITS and got["unit"] == "xp"
    assert _balance(uid) == 0


def test_the_repeatable_xp_is_clipped_to_the_days_cap(uid):
    _profile(uid)
    now = datetime.now(timezone.utc)
    m.view(uid, now)
    kind = _finish_first(uid)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO xp_ledger (user_id, source, ref, xp) VALUES (%s,'mission','x',%s)", (uid, m.XP_DAY_CAP - 2))
        conn.commit()
    finally:
        conn.close()
    got = m.claim(uid, "day", kind, now)
    assert got["xp"] == 2
    assert got["credits"] == m.DAY_CREDITS      # the credits are not XP: not clipped


def test_a_day_finished_and_not_collected_is_paid_the_next_day(uid):
    _profile(uid)
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    m.view(uid, yesterday)
    _finish_first(uid)
    assert _balance(uid) == 0
    m.view(uid, datetime.now(timezone.utc))
    assert _balance(uid) == m.DAY_CREDITS


def test_the_day_is_done_on_the_clear_and_the_bonus_on_all_three(uid):
    _profile(uid)
    now = datetime.now(timezone.utc)
    m.view(uid, now)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE missions SET done_at = NOW() WHERE user_id = %s AND scope = 'day'", (uid,))
        conn.commit()
    finally:
        conn.close()
    view = m.view(uid, now)
    assert view["day"]["bonus"]["done"] is True
    assert view["waiting"] >= 4


def test_a_discovery_is_noted_once_and_paid_once(uid):
    _profile(uid)
    m.note(uid, "first_photo")
    m.note(uid, "first_photo")
    _review(uid, 2)
    book = m.book(uid)
    photo = next(d for d in book["discoveries"] if d["key"] == "first_photo")
    assert photo["reached"] and not photo["paid"] and photo["credits"] == m.DISCOVERIES["first_photo"]
    got = m.claim(uid, "mark", "first_photo")
    assert got["credits"] == m.DISCOVERIES["first_photo"] and got["xp"] == m.DISCOVERY_XP
    assert m.claim(uid, "mark", "first_photo") is None


def test_only_a_noted_discovery_can_be_noted(uid):
    _profile(uid)
    m.note(uid, "first_dictation")           # read off its log, never noted
    m.note(uid, "kana_done")
    assert m.book(uid)["discoveries"][0]["reached"] is False


def test_a_dictation_before_the_launch_is_no_discovery(uid):
    _profile(uid)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO dictation_log (user_id, clip_id, phrase, answer, correct, accuracy, created_at) "
                        "VALUES (%s,'c','p','a',TRUE,100,%s)", (uid, m.SINCE - timedelta(days=3)))
        conn.commit()
    finally:
        conn.close()
    assert next(d for d in m.book(uid)["discoveries"] if d["key"] == "first_dictation")["reached"] is False
    m._swept.pop(uid, None)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO dictation_log (user_id, clip_id, phrase, answer, correct, accuracy, created_at) "
                        "VALUES (%s,'c','p','a',TRUE,100,%s)", (uid, m.SINCE + timedelta(days=3)))
        conn.commit()
    finally:
        conn.close()
    assert next(d for d in m.book(uid)["discoveries"] if d["key"] == "first_dictation")["reached"] is True


def test_waives_names_todays_practice_platform_until_it_is_done(uid):
    _profile(uid)
    now = datetime.now(timezone.utc)
    view = m.view(uid, now)
    practice = next((x for x in view["day"]["missions"] if x["kind"] == "practice"), None)
    if practice is None:
        pytest.skip("today's three do not include the practice")
    assert m.waives(uid, practice["platform"], now) is True
    other = next(p for p in m.PLATFORMS if p != practice["platform"])
    assert m.waives(uid, other, now) is False


def test_the_routes_answer_and_refuse_what_is_not_a_kind(client):
    assert client.get("/api/missions").status_code == 200
    assert client.get("/api/missions/book").status_code == 200
    assert client.post("/api/missions/claim", json={"scope": "day", "kind": "nope"}).status_code == 422
    assert client.post("/api/missions/claim", json={"scope": "x", "kind": "due"}).status_code == 422
    ok = client.post("/api/missions/claim", json={"scope": "day", "kind": "due"})
    assert ok.status_code == 200 and ok.json()["paid"] is None


def test_the_mission_credit_is_a_row_of_the_ledger_the_balance_sums(uid):
    _profile(uid)
    before = credits.read_fresh(uid)["balance"]
    credits.award(uid, 8, "mission", "day:x:due")
    assert credits.read_fresh(uid)["balance"] == before + 8
    with pytest.raises(AssertionError):
        credits.award(uid, 1, "refill")
