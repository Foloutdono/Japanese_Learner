"""任務 — the missions (plan 331): the sizing, the choice, the goals, the
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
ALL = {k: True for k in m.DAILY}


def test_the_day_is_the_same_for_the_same_profile_and_date():
    assert m.pick_day(ALL, 7) == m.pick_day(ALL, 7)
    assert len(set(m.pick_day(ALL, 7))) == m.DAYS_PER_DAY


def test_every_kind_of_the_pool_comes_round_and_two_days_share_none():
    for eligible in (ALL, {**ALL, "duel": False}, {**ALL, "message": False},
                     {**ALL, "duel": False, "message": False}):
        n = sum(eligible.values())
        days = [m.pick_day(eligible, d) for d in range(n)]
        assert {k for day in days for k in day} == {k for k, ok in eligible.items() if ok}
        for a, b in zip(days, days[1:]):
            assert not set(a) & set(b)


def test_an_ineligible_kind_is_never_dealt():
    for d in range(30):
        assert "duel" not in m.pick_day({**ALL, "duel": False}, d)
        assert "message" not in m.pick_day({**ALL, "message": False}, d)


def test_the_three_of_a_day_come_from_different_corners():
    ai = {"ask", "explain", "analyze"}
    practice = {"read", "comprehension", "dictation", "translation", "composition", "conversation", "exam", "in_out"}
    for d in range(26):
        day = set(m.pick_day(ALL, d))
        assert len(day & ai) <= 1, day
        assert len(day & practice) <= 2, day


def test_the_old_pool_is_retired_but_still_read():
    assert not set(m.LEGACY_DAILY) & set(m.DAILY)
    assert set(m.LEGACY_DAILY) <= m.KINDS


def test_every_kind_of_the_pool_has_a_goal_and_the_platform_it_waives():
    assert set(m.DAY_TARGETS) == set(m.DAILY)
    assert set(m.DAY_PLATFORM) <= set(m.DAILY)
    assert set(m.DAY_PLATFORM.values()) - {"duel", "exam"} <= set(m.SKILL_LOGS)
    assert set(m.IN_PLATFORMS) | set(m.OUT_PLATFORMS) <= set(m.SKILL_LOGS)
    assert all(t >= 1 for t in m.DAY_TARGETS.values())


def test_the_week_always_has_its_five_days_and_two_more():
    elig = {"volume": True, "new_mode": True, "exam_section": True, "write10": True, "duels5": True}
    week = m.pick_week(elig, 47)
    assert week[0] == "days5" and len(week) == 3 and len(set(week)) == 3
    assert "duels5" not in m.pick_week({**elig, "duels5": False}, 47)


# ── Rewards (plan 335, the owner: "too small") ─────────────────────────
def test_a_discovery_and_a_plate_pay_what_a_milestone_is_worth():
    assert sum(m.DISCOVERIES.values()) == 560 and min(m.DISCOVERIES.values()) >= 40
    assert m.DISCOVERY_XP == 30
    assert sum(c for c, _ in m.ACHIEVEMENTS.values()) == 1075
    assert min(c for c, _ in m.ACHIEVEMENTS.values()) >= 45
    # A harder plate pays more than an easier one of its line.
    assert m.ACHIEVEMENTS["words_100"] < m.ACHIEVEMENTS["words_500"] < m.ACHIEVEMENTS["words_1000"]
    assert m.ACHIEVEMENTS["days_7"] < m.ACHIEVEMENTS["days_30"] < m.ACHIEVEMENTS["days_100"]


# ── Goals that ask a learner to beat themselves are capped ─────────────
def test_the_volume_goal_is_a_tenth_more_and_never_150_more():
    assert m.volume_goal(100) == 110
    assert m.volume_goal(5000) == 5150


# ── The database ────────────────────────────────────────────────────────
@pytest.fixture
def uid():
    user = f"msn-{uuid.uuid4().hex[:10]}"
    yield user
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for table in ("missions", "mission_marks", "xp_ledger", "credit_ledger", "day_clears",
                          "dictation_log", "composition_log", "phrase_history", "feedback",
                          "daily_usage", "pvp_entries", "user_profiles"):
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


def _assign(user, kinds, now, platform=None):
    """Write a day of `kinds` as ensure_day would, for a test that needs a
    kind the rotation does not deal that day."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            tz, _ = m._profile(cur, user)
            day, _, _ = m.day_window(tz, now)
            cur.execute("DELETE FROM missions WHERE user_id = %s", (user,))
            for slot, kind in enumerate(kinds):
                m._insert_mission(cur, user, "day", day, kind, slot, m.DAY_TARGETS[kind], None,
                                  m.DAY_CREDITS, m.DAY_XP, m.DAY_PLATFORM.get(kind))
            m._insert_mission(cur, user, "bonus", day, m.BONUS, 3, 3, None, m.BONUS_CREDITS, m.BONUS_XP)
        conn.commit()
    finally:
        conn.close()


def _insert(user, sql, params):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.commit()
    finally:
        conn.close()


def _of(user, now, kind):
    return next(x for x in m.view(user, now)["day"]["missions"] if x["kind"] == kind)


def test_the_day_is_dealt_from_the_pool_with_its_goals_and_platforms(uid):
    _profile(uid)
    view = m.view(uid, NOW)
    for x in view["day"]["missions"]:
        assert x["kind"] in m.DAILY and x["of"] == m.DAY_TARGETS[x["kind"]]
        assert x.get("platform") == m.DAY_PLATFORM.get(x["kind"])
    assert "duel" not in {x["kind"] for x in view["day"]["missions"]}     # no duel met yet


def test_a_practice_platform_mission_counts_its_own_log_until_its_goal(uid):
    _profile(uid)
    now = datetime.now(timezone.utc)
    _assign(uid, ["dictation", "translation", "composition"], now)
    for i in range(m.DAY_TARGETS["dictation"] - 1):
        _insert(uid, "INSERT INTO dictation_log (user_id, clip_id, phrase, answer, correct, accuracy) "
                     "VALUES (%s,'c','p','a',TRUE,100)", (uid,))
    d = _of(uid, now, "dictation")
    assert (d["have"], d["of"], d["done"]) == (4, 5, False)
    _insert(uid, "INSERT INTO dictation_log (user_id, clip_id, phrase, answer, correct, accuracy) "
                 "VALUES (%s,'c','p','a',TRUE,100)", (uid,))
    assert _of(uid, now, "dictation")["done"] is True
    assert _of(uid, now, "translation")["have"] == 0          # another platform's log is not this one's
    _insert(uid, "DELETE FROM dictation_log WHERE user_id = %s", (uid,))


def test_in_out_wants_one_exercise_of_each_side(uid):
    _profile(uid)
    now = datetime.now(timezone.utc)
    _assign(uid, ["in_out", "ask", "explain"], now)
    _insert(uid, "INSERT INTO dictation_log (user_id, clip_id, phrase, answer, correct, accuracy) "
                 "VALUES (%s,'c','p','a',TRUE,100)", (uid,))
    assert (_of(uid, now, "in_out")["have"], _of(uid, now, "in_out")["done"]) == (1, False)
    _insert(uid, "INSERT INTO composition_log (user_id, raw_id, pattern, sentence, correct, quality) "
                 "VALUES (%s,'r','p','s',TRUE,4)", (uid,))
    assert _of(uid, now, "in_out")["done"] is True
    for t in ("dictation_log", "composition_log"):
        _insert(uid, f"DELETE FROM {t} WHERE user_id = %s", (uid,))


def test_the_asking_and_the_explanation_are_read_off_the_days_counters(uid):
    _profile(uid)
    now = datetime.now(timezone.utc)
    _assign(uid, ["ask", "explain", "analyze"], now)
    assert not _of(uid, now, "ask")["done"] and not _of(uid, now, "explain")["done"]
    from core import daily_limit
    daily_limit.claim(uid, "ask", 40)
    m.tick(uid, "explain")
    m.tick(uid, "analyze")                    # not a tick: nothing is written
    assert _of(uid, now, "ask")["done"] and _of(uid, now, "explain")["done"]
    assert not _of(uid, now, "analyze")["done"]
    _insert(uid, "DELETE FROM daily_usage WHERE user_id = %s", (uid,))


def test_a_line_broken_down_counts_but_not_a_scrap(uid):
    _profile(uid)
    now = datetime.now(timezone.utc)
    _assign(uid, ["analyze", "ask", "explain"], now)
    _insert(uid, "INSERT INTO phrase_history (user_id, phrase) VALUES (%s, 'あ')", (uid,))
    assert not _of(uid, now, "analyze")["done"]
    _insert(uid, "INSERT INTO phrase_history (user_id, phrase) VALUES (%s, '猫が好きです')", (uid,))
    assert _of(uid, now, "analyze")["done"]
    _insert(uid, "DELETE FROM phrase_history WHERE user_id = %s", (uid,))


def test_a_message_counts_when_it_says_something_and_is_one_a_learner_writes(uid):
    _profile(uid)
    now = datetime.now(timezone.utc)
    _assign(uid, ["message", "ask", "explain"], now)
    add = lambda kind, body: _insert(uid, "INSERT INTO feedback (user_id, kind, body) VALUES (%s,%s,%s)", (uid, kind, body))
    add("idea", "trop court")                                   # under MESSAGE_MIN_CHARS
    add("card", "x" * 60)                                       # a card's flag is no message
    add("rating", "x" * 60)
    assert not _of(uid, now, "message")["done"]
    add("idea", "x" * m.MESSAGE_MIN_CHARS)
    assert _of(uid, now, "message")["done"]
    _insert(uid, "DELETE FROM feedback WHERE user_id = %s", (uid,))


def test_the_message_is_offered_at_most_once_a_fortnight(uid):
    _profile(uid)
    now = datetime.now(timezone.utc)
    _assign(uid, ["message", "ask", "explain"], now - timedelta(days=m.MESSAGE_EVERY_DAYS - 1))
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            day = m.credits_mod.local_today(0, now)
            assert m.message_offered_lately(cur, uid, day) is True
            assert m.message_offered_lately(cur, uid, day + timedelta(days=2)) is False
    finally:
        conn.close()


def test_a_mission_retired_by_plan_335_is_still_read_and_paid(uid):
    _profile(uid)
    now = datetime.now(timezone.utc)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            tz, _ = m._profile(cur, uid)
            day, _, _ = m.day_window(tz, now)
            for slot, kind in enumerate(["new", "practice", "write"]):
                m._insert_mission(cur, uid, "day", day, kind, slot, 1, None, m.DAY_CREDITS, m.DAY_XP,
                                  "reading" if kind == "practice" else None)
        conn.commit()
    finally:
        conn.close()
    view = m.view(uid, now)
    assert [x["kind"] for x in view["day"]["missions"]] == ["new", "practice", "write"]
    _review(uid, 1)
    assert m.view(uid, now)["day"]["missions"][0]["done"] is True       # a new card, met today
    _insert(uid, "UPDATE missions SET done_at = NOW() WHERE user_id = %s AND kind = 'new'", (uid,))
    assert m.claim(uid, "day", "new", now)["credits"] == m.DAY_CREDITS


def test_waives_names_what_an_open_mission_asks_until_it_is_done(uid):
    _profile(uid)
    now = datetime.now(timezone.utc)
    _assign(uid, ["translation", "in_out", "duel"], now)
    assert m.waives(uid, "translation", now) is True
    assert m.waives(uid, "reading", now) is True            # in_out: any of the six
    assert m.waives(uid, "exam", now) is False              # not asked today
    _insert(uid, "UPDATE missions SET done_at = NOW() WHERE user_id = %s AND kind IN ('translation', 'in_out')", (uid,))
    assert m.waives(uid, "translation", now) is False
    assert m.waives(uid, "reading", now) is False


def test_a_duel_the_mission_asks_is_free_once_and_only_once(uid):
    _profile(uid)
    now = datetime.now(timezone.utc)
    _assign(uid, ["duel", "ask", "explain"], now)
    assert m.waives(uid, "duel", now) is True
    duel_id = 987_000_000 + int(uuid.uuid4().int % 1_000_000)
    _insert(uid, "INSERT INTO pvp_duels (id, kind, mode, level, seed, paper_rev, paper, status, expires_at) "
            "VALUES (%s,'ranked','words','N5',1,'x','{}','open', NOW() + interval '1 day')",
            (duel_id,))
    _insert(uid, "INSERT INTO pvp_entries (duel_id, user_id, role, answers, started_at, finished_at) "
                 "VALUES (%s,%s,'challenger','[{\"n\":0}]', NOW(), NOW())", (duel_id, uid))
    try:
        assert m.waives(uid, "duel", now) is False          # one is played: the next pays its fare
    finally:
        _insert(uid, "DELETE FROM pvp_duels WHERE id = %s", (duel_id,))


def test_a_deep_explanation_counts_for_the_mission_even_when_the_cache_serves_it(client, monkeypatch):
    """A sentence explained before is read from the shared cache and claims
    no daily_usage slot: the mission must not wait for one."""
    import routes.phrase as phrase_module
    from core.auth import DEV_USER_ID
    phrase = "猫が机の上で寝ています。"

    def used(feature):
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT COALESCE(SUM(count), 0) FROM daily_usage WHERE user_id = %s AND feature = %s",
                            (DEV_USER_ID, feature))
                return cur.fetchone()[0]
        finally:
            conn.close()

    for sql_, args in (("DELETE FROM phrase_analysis_cache WHERE phrase = %s", (phrase,)),
                       ("DELETE FROM daily_usage WHERE user_id = %s", (DEV_USER_ID,))):
        _insert(DEV_USER_ID, sql_, args)
    monkeypatch.setattr(phrase_module, "chat", lambda *a, **k: '{"words": [], "explanation": "Un chat dort."}')
    try:
        for expected_ticks in (1, 2):
            r = client.post("/api/phrase/analyze", json={"phrase": phrase, "deep": True, "lang": "en", "save": False})
            assert r.status_code == 200
            assert used(m.TICKS["explain"]) == expected_ticks
        assert used("deep_analysis") == 1               # the second one was the cache's: no slot
        # A local analysis, which explains nothing, ticks nothing.
        client.post("/api/phrase/analyze", json={"phrase": phrase, "lang": "en", "save": False})
        assert used(m.TICKS["explain"]) == 2
    finally:
        _insert(DEV_USER_ID, "DELETE FROM daily_usage WHERE user_id = %s", (DEV_USER_ID,))
        _insert(DEV_USER_ID, "DELETE FROM phrase_analysis_cache WHERE phrase = %s", (phrase,))


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
