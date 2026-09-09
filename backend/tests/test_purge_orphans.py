# ── scripts/purge_orphans.py — rows whose auth user is gone ───────
#
# The failure this script repairs is silent (a dashboard deletion leaves
# every app row standing), and the failure the script itself could cause
# is loud (a short auth list makes live learners look like orphans). So
# the tests are weighted toward the refusals: an auth list that could not
# be fetched, or that came back empty, must delete nothing at all.
#
# list_auth_user_ids is patched throughout — it needs a real Supabase
# project, and the point of these tests is the decision made about the
# list, not the fetching of it.
import sys
import uuid
from unittest.mock import patch

import pytest

import core.auth as auth_mod
from core.db import db_conn
from core.srs_instance import srs
from routes.account import delete_user_rows, user_ids_present
from scripts import purge_orphans
from scripts.purge_orphans import AuthListError, list_auth_user_ids, main

MODE = "vocab.flashcard.f2b"


def _uid():
    return f"orphan-test-{uuid.uuid4()}"


def _seed(uid, with_profile=True):
    """A learner with review history, and optionally a profile row."""
    srs.review(f"{uid}:vocab_N5_a", MODE, 5)
    if with_profile:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("INSERT INTO user_profiles (user_id, username) VALUES (%s, %s)",
                            (uid, f"probe-{uid[-12:]}"))
            conn.commit()
        finally:
            conn.close()


def _present(uid):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            return uid in user_ids_present(cur)
    finally:
        conn.close()


def _cleanup(*uids):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for uid in uids:
                delete_user_rows(cur, uid)
        conn.commit()
    finally:
        conn.close()


def _run(*argv, live=None):
    """main() with a patched auth list. `live` defaults to everyone
    currently in the database, so a test only has to say who is MISSING
    from Supabase — nothing else gets swept up."""
    if live is None:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                live = set(user_ids_present(cur))
        finally:
            conn.close()
    saved = sys.argv
    sys.argv = ["purge_orphans", *argv]
    try:
        with patch.object(purge_orphans, "list_auth_user_ids", return_value=live):
            return main()
    finally:
        sys.argv = saved


# ── Discovery ────────────────────────────────────────────────────

def test_a_learner_with_no_profile_row_is_still_found():
    # The reason discovery reads PLAN rather than user_profiles: a
    # learner who never opened the profile screen has review rows and
    # no profile at all, and would otherwise be invisible forever.
    uid = _uid()
    _seed(uid, with_profile=False)
    try:
        assert _present(uid)
    finally:
        _cleanup(uid)


def test_discovery_covers_every_shape_of_scoping_in_the_plan():
    from routes.account import PLAN

    handled = [
        t for t, clause, _w in PLAN
        if "%(prefix)s" in clause or clause.startswith("user_id = %(user)s")
    ]
    unhandled = [
        t for t, clause, _w in PLAN
        if t not in handled
    ]
    # video_session_jobs is the one subquery-scoped entry, and cannot
    # hold a user its parent video_sessions does not.
    assert unhandled == ["video_session_jobs"], unhandled


# ── The refusals ─────────────────────────────────────────────────

def test_it_deletes_nothing_when_the_auth_list_cannot_be_fetched():
    uid = _uid()
    _seed(uid)
    try:
        saved = sys.argv
        sys.argv = ["purge_orphans", "--yes"]
        try:
            with patch.object(purge_orphans, "list_auth_user_ids",
                              side_effect=AuthListError("boom")):
                assert main() == 2
        finally:
            sys.argv = saved
        assert _present(uid), "rows were deleted on an unknown user list"
    finally:
        _cleanup(uid)


def test_an_empty_auth_list_is_refused_by_default():
    uid = _uid()
    _seed(uid)
    try:
        assert _run("--yes", live=set()) == 2
        assert _present(uid)
    finally:
        _cleanup(uid)


def test_an_empty_auth_list_is_honoured_when_said_out_loud():
    uid = _uid()
    _seed(uid)
    try:
        # DEV_USER_ID is always spared, so its rows are not swept up by
        # a run that is deliberately treating everyone as an orphan.
        assert _run("--yes", "--allow-empty-auth", live=set()) == 0
        assert not _present(uid)
        assert _present(auth_mod.DEV_USER_ID)
    finally:
        _cleanup(uid)


def test_the_dev_user_is_never_an_orphan():
    # It has no Supabase user by definition, so nothing may infer from
    # its absence that its rows should go — even on a run that is
    # deliberately treating every other id as an orphan.
    dev = auth_mod.DEV_USER_ID
    assert dev and _present(dev), "fixture: the dev user should have rows"
    assert _run("--yes", "--allow-empty-auth", live=set()) == 0
    assert _present(dev)


# ── The purge ────────────────────────────────────────────────────

def test_only_the_orphan_goes():
    gone, still_here = _uid(), _uid()
    _seed(gone)
    _seed(still_here)
    try:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                live = set(user_ids_present(cur)) - {gone}
        finally:
            conn.close()

        assert _run("--yes", live=live) == 0
        assert not _present(gone)
        assert _present(still_here)
    finally:
        _cleanup(gone, still_here)


def test_a_dry_run_changes_nothing():
    uid = _uid()
    _seed(uid)
    try:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                live = set(user_ids_present(cur)) - {uid}
        finally:
            conn.close()
        assert _run(live=live) == 0
        assert _present(uid), "a dry run deleted rows"
    finally:
        _cleanup(uid)


def test_keep_spares_an_id_that_has_no_auth_user():
    uid = _uid()
    _seed(uid)
    try:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                live = set(user_ids_present(cur)) - {uid}
        finally:
            conn.close()
        assert _run("--yes", "--keep", uid, live=live) == 0
        assert _present(uid)
    finally:
        _cleanup(uid)


def test_the_purge_erases_the_same_rows_the_account_route_would():
    # Reusing delete_user_rows is what keeps this true; the test is here
    # so replacing it with hand-written DELETEs fails loudly.
    from routes.account import PLAN

    uid = _uid()
    _seed(uid)
    try:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                live = set(user_ids_present(cur)) - {uid}
        finally:
            conn.close()
        _run("--yes", live=live)

        from routes.account import prefix_pattern
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                for table, clause, _why in PLAN:
                    cur.execute(f'SELECT COUNT(*) FROM "{table}" WHERE {clause}',
                                {"user": uid, "prefix": prefix_pattern(uid)})
                    assert cur.fetchone()[0] == 0, f"{table} still holds rows"
        finally:
            conn.close()
    finally:
        _cleanup(uid)


# ── The fetch's own guard ────────────────────────────────────────

def test_listing_refuses_outright_in_a_dev_instance():
    # DEV_USER_ID means there are no Supabase users to reconcile
    # against; answering "none" there would mark every learner an orphan.
    assert auth_mod.DEV_USER_ID
    with pytest.raises(AuthListError):
        list_auth_user_ids()
