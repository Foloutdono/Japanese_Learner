# ── scripts/backfill_first_ride.py (plan 097) ───────────────────────
# The one-shot that stamps the accounts that boarded before the ride
# existed. Run against a second learner (conftest's other_user) so the
# shared DEV_USER_ID's own state is never what is being counted.
from datetime import datetime, timedelta, timezone

from core.db import db_conn
from routes.onboarding import GUIDE_GATES
from scripts.backfill_first_ride import count_pending, stamp


def _set(user_id, **cols):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            sets = ", ".join(f"{k} = %s" for k in cols)
            cur.execute(f"UPDATE user_profiles SET {sets} WHERE user_id = %s", (*cols.values(), user_id))
        conn.commit()
    finally:
        conn.close()


def _row(user_id):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT onboarded_at, tutorial_at, guided FROM user_profiles WHERE user_id = %s", (user_id,))
            return cur.fetchone()
    finally:
        conn.close()


def test_a_boarded_account_with_no_stamp_is_stamped_at_its_boarding(other_user):
    boarded = datetime(2026, 8, 30, 9, 15, tzinfo=timezone.utc)
    _set(other_user, onboarded_at=boarded, tutorial_at=None, guided="{}")
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            assert count_pending(cur, other_user) == 1
            assert stamp(cur, other_user) == 1
            # Idempotent: the second run finds nothing.
            assert count_pending(cur, other_user) == 0
            assert stamp(cur, other_user) == 0
        conn.commit()
    finally:
        conn.close()
    onboarded_at, tutorial_at, guided = _row(other_user)
    assert tutorial_at == onboarded_at == boarded
    assert set(guided) == set(GUIDE_GATES)
    # The same shape mark_guided writes: an ISO timestamp, parseable,
    # and the boarding's own moment.
    for gate in GUIDE_GATES:
        assert datetime.fromisoformat(guided[gate]) == boarded


def test_an_account_never_boarded_is_not_stamped(other_user):
    _set(other_user, onboarded_at=None, tutorial_at=None, guided="{}")
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            assert count_pending(cur, other_user) == 0
            assert stamp(cur, other_user) == 0
    finally:
        conn.close()
    assert _row(other_user)[1] is None


def test_an_account_already_stamped_keeps_its_own_stamp(other_user):
    boarded = datetime(2026, 8, 30, 9, 15, tzinfo=timezone.utc)
    rode = boarded + timedelta(days=3)
    _set(other_user, onboarded_at=boarded, tutorial_at=rode, guided='{"today": "x"}')
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            assert count_pending(cur, other_user) == 0
            assert stamp(cur, other_user) == 0
    finally:
        conn.close()
    _, tutorial_at, guided = _row(other_user)
    assert tutorial_at == rode
    assert guided == {"today": "x"}


def test_user_scope_leaves_other_accounts_alone(other_user):
    from core.auth import DEV_USER_ID
    from routes.profile import ensure_profile_row
    ensure_profile_row(DEV_USER_ID)
    boarded = datetime(2026, 8, 30, 9, 15, tzinfo=timezone.utc)
    _set(other_user, onboarded_at=boarded, tutorial_at=None, guided="{}")
    dev_before = _row(DEV_USER_ID)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            stamp(cur, other_user)
        conn.commit()
    finally:
        conn.close()
    assert _row(DEV_USER_ID) == dev_before
    assert _row(other_user)[1] == boarded
