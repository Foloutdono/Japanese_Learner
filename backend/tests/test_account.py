# ── DELETE /api/account — the learner erases their own account ──
# Plan-shape tests mirror tests/test_wipe_srs.py (the same (table,
# clause, why) shape); the deletion itself runs against synthetic ids on
# the real DB, with another user's rows kept as the control; the route
# is exercised with the destructive halves patched out, so the shared
# DEV_USER_ID rows every other test relies on are never touched.
import re
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

import core.auth as auth_mod
import routes.account as account
from core.db import db_conn
from core.srs_instance import srs
from routes.account import PLAN, SHARED, prefix_pattern, delete_user_rows

SCHEMA_FILE = Path(__file__).resolve().parent.parent / "srs" / "data_structure.sql"
# Anchored to a statement at the start of a line: the file's header
# comment mentions "CREATE TABLE IF NOT EXISTS" in prose.
DECLARED_RE = re.compile(r"^CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)", re.IGNORECASE | re.MULTILINE)


def _tables(steps):
    return [t for t, _clause, _why in steps]


# ── The plan itself ──────────────────────────────────────────────

def test_children_are_deleted_before_their_parents():
    order = _tables(PLAN)
    for child, parent in [
        ("card_modes", "cards"),
        ("custom_cards", "decks"),
        ("deck_cards", "decks"),
        ("video_session_jobs", "video_sessions"),
    ]:
        assert order.index(child) < order.index(parent), f"{child} before {parent}"


def test_identity_goes_last():
    # A run that fails midway must leave an account that can sign in
    # and retry; the profile row is what the app gates on.
    assert _tables(PLAN)[-1] == "user_profiles"


def test_plan_and_shared_never_overlap():
    assert set(_tables(PLAN)) & set(SHARED) == set()


def test_every_step_scopes_and_explains_itself():
    by_prefix = {"review_log", "card_modes", "cards", "card_first_review"}
    for table, clause, why in PLAN:
        assert "%(" in clause, f"{table} has no user-scoping placeholder"
        assert why and len(why) > 10, f"{table} has no reason given"
        if table in by_prefix:
            assert "%(prefix)s" in clause, table
        elif table == "video_session_jobs":
            assert "session_id IN" in clause, table
        else:
            assert "user_id = %(user)s" in clause, table


def test_every_declared_table_is_classified():
    # The completeness guard: a table added to the schema later must be
    # put in PLAN or SHARED on purpose, or this fails.
    declared = {m.group(1) for m in DECLARED_RE.finditer(SCHEMA_FILE.read_text(encoding="utf-8"))}
    classified = set(_tables(PLAN)) | set(SHARED)
    assert declared == classified, (
        f"unclassified: {sorted(declared - classified)}; "
        f"classified but not declared: {sorted(classified - declared)}"
    )


def testprefix_pattern_escapes_like_wildcards():
    assert prefix_pattern("abc") == "abc:%"
    assert prefix_pattern("dev_user") == r"dev\_user:%"
    assert prefix_pattern("50%") == r"50\%:%"


# ── The deletion, on synthetic ids ───────────────────────────────

def _seed(uid):
    srs.review(f"{uid}:probe_card", "kana.mcq.reading", 5)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO user_profiles (user_id, username) VALUES (%s, %s)",
                (uid, f"probe-{uid[-8:]}"),
            )
            cur.execute("INSERT INTO ocr_usage (user_id, day, count) VALUES (%s, CURRENT_DATE, 1)", (uid,))
            cur.execute(
                "INSERT INTO credit_ledger (user_id, delta, reason, ref) VALUES (%s, 30, 'grant', 'probe')",
                (uid,),
            )
            cur.execute(
                "INSERT INTO phrase_history (user_id, phrase, created_at) VALUES (%s, %s, NOW())",
                (uid, "駅で待っています。"),
            )
        conn.commit()
    finally:
        conn.close()


def _count(cur, table, clause, uid):
    cur.execute(
        f'SELECT COUNT(*) FROM "{table}" WHERE {clause}',
        {"user": uid, "prefix": prefix_pattern(uid)},
    )
    return cur.fetchone()[0]


def _cleanup(uid):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            delete_user_rows(cur, uid)
        conn.commit()
    finally:
        conn.close()


def test_delete_user_rows_empties_every_table_and_keeps_other_users():
    uid, other = f"probe-{uuid.uuid4()}", f"probe-{uuid.uuid4()}"
    try:
        _seed(uid)
        _seed(other)
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                seeded = {t: _count(cur, t, c, uid) for t, c, _w in PLAN}
                assert seeded["review_log"] >= 1 and seeded["card_modes"] >= 1
                assert seeded["user_profiles"] == 1 and seeded["ocr_usage"] == 1
                assert seeded["phrase_history"] == 1
                assert seeded["credit_ledger"] == 1

                counts = delete_user_rows(cur, uid)
                conn.commit()

                assert counts["user_profiles"] == 1
                for table, clause, _why in PLAN:
                    assert _count(cur, table, clause, uid) == 0, f"{table} still has rows for {uid}"
                # The control: the other learner is untouched.
                assert _count(cur, "user_profiles", "user_id = %(user)s", other) == 1
                assert _count(cur, "review_log", "card_id LIKE %(prefix)s", other) >= 1
                assert _count(cur, "phrase_history", "user_id = %(user)s", other) == 1
        finally:
            conn.close()
    finally:
        _cleanup(uid)
        _cleanup(other)


# ── The route ────────────────────────────────────────────────────

def test_route_erases_rows_then_the_auth_user(client, monkeypatch):
    calls = []
    monkeypatch.setattr(account, "delete_user_rows", lambda cur, uid: calls.append(("rows", uid)) or {"user_profiles": 1})
    monkeypatch.setattr(account, "_delete_auth_user", lambda uid: calls.append(("auth", uid)) or True)
    r = client.delete("/api/account")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True and body["auth_deleted"] is True
    assert body["deleted"] == {"user_profiles": 1}
    # Rows first, auth second — the order the module docstring argues for.
    assert [c[0] for c in calls] == ["rows", "auth"]


def test_route_reports_502_when_the_auth_user_survives(client, monkeypatch):
    calls = []
    monkeypatch.setattr(account, "delete_user_rows", lambda cur, uid: calls.append("rows") or {})

    def boom(uid):
        raise account.AuthDeleteError("503 upstream")

    monkeypatch.setattr(account, "_delete_auth_user", boom)
    r = client.delete("/api/account")
    assert r.status_code == 502
    assert "erased" in r.json()["detail"]
    assert calls == ["rows"], "the rows go even when the auth half fails; a retry is idempotent"


# ── The GoTrue call ──────────────────────────────────────────────

def _live_auth(monkeypatch):
    monkeypatch.setattr(auth_mod, "DEV_USER_ID", None)
    monkeypatch.setattr(auth_mod, "SUPABASE_URL", "https://proj.supabase.co")
    monkeypatch.setattr(auth_mod, "SUPABASE_SERVICE_KEY", "service-key")


@pytest.mark.parametrize("status", [200, 204, 404])
def test_auth_delete_counts_gone_as_success(monkeypatch, status):
    _live_auth(monkeypatch)
    resp = MagicMock(status_code=status, text="")
    with patch.object(account.httpx, "delete", return_value=resp) as delete:
        assert account._delete_auth_user("abc-123") is True
    url = delete.call_args.args[0]
    headers = delete.call_args.kwargs["headers"]
    assert url == "https://proj.supabase.co/auth/v1/admin/users/abc-123"
    assert headers["Authorization"] == "Bearer service-key"
    assert headers["apikey"] == "service-key"


def test_auth_delete_raises_on_a_real_failure(monkeypatch):
    _live_auth(monkeypatch)
    resp = MagicMock(status_code=500, text="boom")
    with patch.object(account.httpx, "delete", return_value=resp):
        with pytest.raises(account.AuthDeleteError):
            account._delete_auth_user("abc-123")


def test_auth_delete_is_skipped_under_dev_user_id(monkeypatch):
    monkeypatch.setattr(auth_mod, "DEV_USER_ID", "dev-user")
    with patch.object(account.httpx, "delete") as delete:
        assert account._delete_auth_user("dev-user") is False
    delete.assert_not_called()
