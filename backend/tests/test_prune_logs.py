# ── scripts/prune_logs.py — capping the logs nothing reads ────────
#
# Each cap is set at its reader's own ceiling, so the property to pin is
# the same one the rollup tests pin for review_log: what the endpoint
# returns must not change. The rest is scoping — one learner's history
# must never be evicted by another's.
#
# Everything here runs scoped to synthetic user ids (never the bare
# script, which is ALL USERS by default) so the shared DEV_USER_ID rows
# other tests rely on are left alone.
import uuid

import pytest

from core.auth import DEV_USER_ID
from core.db import db_conn
from scripts.prune_logs import BY_AGE, PER_USER, _over_cap, _trim, _user_clause


def _uid():
    return f"prune-test-{uuid.uuid4()}"


def _rows(uid, table):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(f'SELECT COUNT(*) FROM "{table}" WHERE user_id = %s', (uid,))
            return cur.fetchone()[0]
    finally:
        conn.close()


def _prune(uid, table, keep, extra=""):
    scope, params = _user_clause(uid)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            n = _trim(cur, table, keep, extra, scope, params)
        conn.commit()
        return n
    finally:
        conn.close()


def _cleanup(*uids):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for uid in uids:
                for table, _keep, _extra, _why in PER_USER:
                    cur.execute(f'DELETE FROM "{table}" WHERE user_id = %s', (uid,))
                cur.execute("DELETE FROM ocr_usage WHERE user_id = %s", (uid,))
        conn.commit()
    finally:
        conn.close()


def _seed_reading(uid, n):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for i in range(n):
                cur.execute(
                    "INSERT INTO reading_log(user_id, level, phase, phrase, romaji, "
                    "answer, correct, created_at) "
                    "VALUES (%s, 'N5', 'read', %s, 'kore', 'kore', TRUE, "
                    "NOW() - make_interval(mins => %s))",
                    (uid, f"これ{i}", n - i),
                )
        conn.commit()
    finally:
        conn.close()


# ── The policies are declared, not improvised ────────────────────

def test_every_policy_explains_itself():
    for table, keep, _extra, why in PER_USER:
        assert keep > 0, table
        assert len(why) > 20, f"{table} has no reason given"
    for table, _col, days, why in BY_AGE:
        assert days > 0, table
        assert len(why) > 20, f"{table} has no reason given"


def test_review_log_is_not_in_any_policy():
    # It is an aggregate source, not a log. Trimming it by date resets
    # XP, the level, the streak and the 番付; it has its own tool.
    named = {t for t, *_ in PER_USER} | {t for t, *_ in BY_AGE}
    assert "review_log" not in named
    assert "xp_ledger" not in named
    assert "credit_ledger" not in named


def test_caps_match_the_ceiling_their_reader_enforces():
    # If an endpoint's Query(le=...) ever rises above its cap, pruning
    # would start hiding rows the screen could have shown.
    caps = {t: keep for t, keep, _e, _w in PER_USER}
    assert caps["reading_log"] >= 200      # /api/reading/history
    assert caps["translation_log"] >= 200  # /api/translation/history
    assert caps["phrase_history"] >= 200   # /api/phrase/history
    assert caps["video_sessions"] >= 100   # /api/video/sessions


# ── The cap itself ───────────────────────────────────────────────

def test_it_keeps_exactly_the_cap_and_the_newest_ones():
    uid = _uid()
    _seed_reading(uid, 12)
    try:
        assert _prune(uid, "reading_log", 5) == 7
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT phrase FROM reading_log WHERE user_id = %s "
                            "ORDER BY created_at DESC", (uid,))
                kept = [r[0] for r in cur.fetchall()]
        finally:
            conn.close()
        # Seeded oldest-first, so the survivors are the last five.
        assert kept == ["これ11", "これ10", "これ9", "これ8", "これ7"]
    finally:
        _cleanup(uid)


def test_what_the_history_endpoint_returns_does_not_change(client):
    # The property the cap is chosen for: pruning at the reader's own
    # ceiling is invisible to the reader.
    uid = DEV_USER_ID
    _seed_reading(uid, 60)
    try:
        before = client.get("/api/reading/history?limit=50").json()
        assert len(before) == 50
        _prune(uid, "reading_log", 50)
        assert client.get("/api/reading/history?limit=50").json() == before
    finally:
        _cleanup(uid)


def test_one_learner_is_never_evicted_by_another():
    heavy, light = _uid(), _uid()
    _seed_reading(heavy, 30)
    _seed_reading(light, 3)
    try:
        scope, params = _user_clause(None)  # ALL USERS, as the script runs
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                _trim(cur, "reading_log", 5, "", scope, params)
            conn.commit()
        finally:
            conn.close()
        assert _rows(heavy, "reading_log") == 5
        assert _rows(light, "reading_log") == 3, "a light user lost rows to a heavy one"
    finally:
        _cleanup(heavy, light)


def test_a_pinned_sentence_is_never_pruned():
    uid = _uid()
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO phrase_history(user_id, phrase, kept, created_at) "
                "VALUES (%s, '駅で待っています。', TRUE, NOW() - interval '900 days')",
                (uid,),
            )
            for i in range(8):
                cur.execute(
                    "INSERT INTO phrase_history(user_id, phrase, kept, created_at) "
                    "VALUES (%s, %s, FALSE, NOW() - make_interval(days => %s))",
                    (uid, f"これ{i}", 8 - i),
                )
        conn.commit()
    finally:
        conn.close()
    try:
        # The pin is the oldest row of the nine, so a cap that ignored
        # `kept` would take it first.
        _prune(uid, "phrase_history", 2, " AND NOT kept")
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT phrase FROM phrase_history "
                            "WHERE user_id = %s AND kept", (uid,))
                assert cur.fetchall() == [("駅で待っています。",)]
                cur.execute("SELECT COUNT(*) FROM phrase_history "
                            "WHERE user_id = %s AND NOT kept", (uid,))
                assert cur.fetchone()[0] == 2
        finally:
            conn.close()
    finally:
        _cleanup(uid)


def test_counting_and_deleting_agree():
    uid = _uid()
    _seed_reading(uid, 9)
    try:
        scope, params = _user_clause(uid)
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                predicted = _over_cap(cur, "reading_log", 4, "", scope, params)
                deleted = _trim(cur, "reading_log", 4, "", scope, params)
            conn.commit()
        finally:
            conn.close()
        assert predicted == deleted == 5
    finally:
        _cleanup(uid)


def test_under_the_cap_nothing_is_touched():
    uid = _uid()
    _seed_reading(uid, 3)
    try:
        assert _prune(uid, "reading_log", 200) == 0
        assert _rows(uid, "reading_log") == 3
    finally:
        _cleanup(uid)


def test_todays_ocr_counter_survives_the_age_policy():
    # routes/ocr.py reads CURRENT_DATE's row to rate-limit; pruning it
    # would hand a throttled client a fresh allowance.
    from scripts.prune_logs import _older_than

    uid = _uid()
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO ocr_usage(user_id, day, count) "
                        "VALUES (%s, CURRENT_DATE, 5)", (uid,))
            cur.execute("INSERT INTO ocr_usage(user_id, day, count) "
                        "VALUES (%s, CURRENT_DATE - 400, 5)", (uid,))
        conn.commit()
    finally:
        conn.close()
    try:
        scope, params = _user_clause(uid)
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                removed = _older_than(cur, "ocr_usage", "day", 30, scope, params,
                                      count_only=False)
            conn.commit()
        finally:
            conn.close()
        assert removed == 1
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT day = CURRENT_DATE FROM ocr_usage WHERE user_id = %s",
                            (uid,))
                assert cur.fetchall() == [(True,)]
        finally:
            conn.close()
    finally:
        _cleanup(uid)
