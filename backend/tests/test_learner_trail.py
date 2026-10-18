# ── 足跡 — one learner's trail, read back (plan 249) ──
# scripts/learner_trail.py is read by a person deciding what to fix, so
# the way it breaks is a finding that is not there: a renamed property
# and the ride begun twice reads as a quiet account. These walk a
# learner through the patterns it names, against real rows, and hold it
# to what it must never read.
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from core import events
from core.db import db_conn
from scripts import learner_trail as trail

USER = "trail-test-learner"
QUIET = "trail-test-objector"
T0 = datetime(2026, 10, 18, 6, 20, tzinfo=timezone.utc)


def _at(seconds: float) -> datetime:
    return T0 + timedelta(seconds=seconds)


def _wipe(cur):
    for uid in (USER, QUIET):
        cur.execute("DELETE FROM event_log WHERE user_id = %s", (uid,))
        cur.execute("DELETE FROM user_profiles WHERE user_id = %s", (uid,))
        cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (f"{uid}:%",))


def _ride(sid, t, finish):
    """The two rides, cards then reading, from `t`; `finish` sends
    ride_done off the plate, else the learner leaves it."""
    steps = [("known", "known-dict"), ("known-dict", "known-back"), ("known-back", "unknown"),
             ("unknown", "unknown-back"), ("unknown-back", "done"), ("done", "reading"),
             ("read", "type"), ("type", "measure"), ("measure", "pass")]
    rows = [("screen_view", {"route": "/ride/cards"}, _at(t), None, sid)]
    for n, (a, b) in enumerate(steps, 1):
        rows.append(("ride_step", {"step": a, "to": b, "dir": "fwd", "ms": 5000}, _at(t + 5 * n), None, sid))
    if finish:
        rows.append(("ride_done", {"skipped": False, "at": "reading", "ms": 45000}, _at(t + 50), None, sid))
        rows.append(("screen_view", {"route": "/today", "tab": "today"}, _at(t + 51), None, sid))
    else:
        rows.append(("screen_view", {"route": "/app"}, _at(t + 50), None, sid))
        rows.append(("screen_view", {"route": "/ride/cards"}, _at(t + 50.1), None, sid))
    return rows


@pytest.fixture
def seeded():
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            _wipe(cur)
            cur.execute(
                "INSERT INTO user_profiles (user_id, username, jlpt_level, kana_known, notifications, tz_offset_min) "
                "VALUES (%s, 'trail-test-typed-name', 'N5', 'hiragana', FALSE, 330)", (USER,))
            cur.execute(
                "INSERT INTO user_profiles (user_id, username, analytics_off) VALUES (%s, 'trail-test-objector-name', TRUE)", (QUIET,))
            a, b = "trail-test-visit-a", "trail-test-visit-b"
            rows = [
                ("session_start", {"vp": "phone", "os": "android", "platform": "web", "lang": "fr"}, _at(0), None, a),
                ("app_open", {"boot_ms": 1200}, _at(0), None, a),
                ("boarding_step", {"step": "name", "to": "why", "index": 1, "ms": 100_000}, _at(100), None, a),
                ("boarding_done", {"level": "N5", "ms": 9000}, _at(110), None, a),
                *_ride(a, 120, finish=False),
                ("api_error", {"path": "/api/today", "status": 0}, _at(171), None, a),
                ("session_start", {"vp": "phone"}, _at(400), None, b),
                *_ride(b, 401, finish=True),
                ("transfer_offer", {"choice": "go"}, _at(470), None, None),
                ("screen_view", {"route": "/profile/settings/:page", "tab": "profile"}, _at(470), None, b),
                ("screen_leave", {"route": "/profile/settings/:page", "tab": "profile", "ms": 10_000}, _at(480), None, b),
                ("vitals", {"route": "/app", "lcp": 10640, "cls": 1321, "inp": 136}, _at(480), None, b),
            ]
            events.write(cur, USER, [(n, events.clean(n, p), at, cid, sid) for n, p, at, cid, sid in rows])
            events.write(cur, QUIET, [("app_open", {"boot_ms": 1}, _at(0))])
        conn.commit()
        yield
    finally:
        with conn.cursor() as cur:
            _wipe(cur)
        conn.commit()
        conn.close()


def _read(uid, now=None):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            data = trail.gather(cur, uid)
    finally:
        conn.close()
    return data, trail.analyse(data, now=now or _at(6 * 3600))


def _whats(report):
    return [f["what"] for f in report["findings"]]


def test_visits_and_where_it_stopped(seeded):
    data, report = _read(USER)
    assert len(report["visits"]) == 2
    # The server's own row (no visit id) joins the visit it fell in.
    assert any(i.name == "transfer_offer" for i in report["visits"][1]["items"])
    left = report["left"]
    assert left["screen"] == "/profile/settings/:page"
    assert left["dwell_ms"] == 10_000
    assert left["last_study"] is None


def test_the_ride_begun_again_is_named(seeded):
    _, report = _read(USER)
    whats = _whats(report)
    assert any("begun again from the first card" in w and "`pass`" in w for w in whats)
    assert report["findings"][0]["level"] == "block"


def test_the_other_patterns_are_named(seeded):
    _, report = _read(USER)
    text = "\n".join(_whats(report))
    assert "Never answered one card" in text
    assert "Correspondance" in text and "imported nothing" in text
    assert "Hesitated on the boarding's `name` step" in text
    assert "largest paint 10.6s" in text and "layout shift 1.32" in text
    assert "as the page closed on it" in text
    assert "Notifications are off" in text


def test_a_review_answers_the_never_studied_finding(seeded):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO review_log (card_id, mode, quality, reviewed_at, xp_earned) "
                        "VALUES (%s, 'vocab.flashcard', 4, %s, 1)", (f"{USER}:vocab_n5_x", _at(460)))
        conn.commit()
    finally:
        conn.close()
    data, report = _read(USER)
    assert not any("Never answered" in w for w in _whats(report))
    md = trail.render(data, report)
    assert "**studied** 1 review(s) (vocab), 1 right" in md


def test_an_objection_is_honoured():
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            _wipe(cur)
            cur.execute("INSERT INTO user_profiles (user_id, username, analytics_off) VALUES (%s, 'trail-test-objector-name', TRUE)", (QUIET,))
            events.write(cur, QUIET, [("app_open", {"boot_ms": 1}, _at(0))])
        conn.commit()
        with conn.cursor() as cur:
            data = trail.gather(cur, QUIET)
        assert data.get("opted_out") is True
        assert "events" not in data and "reviews" not in data
    finally:
        with conn.cursor() as cur:
            _wipe(cur)
        conn.commit()
        conn.close()


def test_the_report_renders_without_the_typed_name(seeded):
    data, report = _read(USER)
    md = trail.render(data, report)
    assert "trail-test-typed-name" not in md
    assert "#### Visit 2" in md and "(11:50 local)" in md


def test_nothing_a_learner_typed_is_selected():
    """No query names a text column a learner wrote into: an answer, a
    phrase, a sentence, a prompt, a deck's name, a message's body, a
    username. The feedback is counted here; read_feedback reads it."""
    src = Path(trail.__file__).read_text()
    sql = " ".join(re.findall(r'"((?:SELECT|FROM|WHERE)[^"]*)"', src)) + " ".join(trail.PROFILE_COLS)
    assert "FROM event_log" in sql  # the pattern still finds the queries
    for column in ("answer", "answers", "phrase", "sentence", "translation_prompt", "romaji", "body",
                   "username", "description", "reply_to", "front", "back", "text", "questions"):
        assert re.search(rf"\b{column}\b", sql) is None, column
