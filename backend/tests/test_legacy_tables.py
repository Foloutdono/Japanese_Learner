# ── scripts/drop_legacy_tables.py — tables a removed feature left ──
#
# Self-migration makes adding a table automatic and removing one manual,
# so a retired feature leaves its tables standing in every database that
# ever ran the old code. The script drops them; these tests are what
# make dropping them safe to run unattended.
#
# The guard that matters is test_no_legacy_table_is_referenced_anywhere:
# it is the difference between "unused" (an opinion) and "unreferenced"
# (a fact). If someone ever brings one of these names back into use, the
# guard fails before the script gets a chance to drop their data.
import re
import subprocess
from pathlib import Path

import pytest

from core.db import db_conn
from routes.account import PLAN, SHARED
from scripts.drop_legacy_tables import LEGACY, _present

REPO = Path(__file__).resolve().parent.parent.parent
BACKEND = REPO / "backend"
SCHEMA_FILE = BACKEND / "srs" / "data_structure.sql"

NAMES = [table for table, _why in LEGACY]

# The files whose whole job is to name these tables. Everything else
# mentioning one means the feature is not as dead as this list claims.
CLEANUP_TOOLS = {
    "backend/scripts/drop_legacy_tables.py",
    "backend/scripts/sql/cleanup_orphans_and_legacy.sql",
    "backend/tests/test_legacy_tables.py",
}


def test_the_list_is_named_and_explained():
    assert NAMES, "nothing listed"
    for table, why in LEGACY:
        assert re.fullmatch(r"[a-z_]+", table), table
        assert len(why) > 20, f"{table} has no reason given"


def test_no_legacy_table_is_referenced_anywhere():
    # ripgrep over the tracked sources, not just backend/: a frontend
    # reference would mean the feature is half-alive and the rows still
    # matter to somebody.
    for table in NAMES:
        hits = subprocess.run(
            ["git", "grep", "-l", "-w", table, "--",
             "backend", "frontend/src", "docs"],
            cwd=REPO, capture_output=True, text=True,
        ).stdout.split()
        hits = [h for h in hits if h not in CLEANUP_TOOLS]
        assert hits == [], f"{table} is still referenced by {hits}"


def test_no_legacy_table_is_declared_in_the_schema():
    # A database built from data_structure.sql never had these, which is
    # why the schema/account completeness guards do not already cover
    # them -- and why they can be dropped without touching either.
    declared = SCHEMA_FILE.read_text(encoding="utf-8")
    for table in NAMES:
        assert not re.search(rf"^CREATE TABLE\s+(?:IF NOT EXISTS\s+)?{table}\b",
                             declared, re.IGNORECASE | re.MULTILINE), table


def test_no_legacy_table_is_classified_for_deletion_or_sharing():
    classified = {t for t, _c, _w in PLAN} | set(SHARED)
    assert classified.isdisjoint(NAMES)


def test_they_are_outside_the_account_deletion_plan_which_is_why_they_go():
    # The point worth pinning: DELETE /api/account cannot erase a table
    # it does not know about, so these rows would outlive the account
    # they belong to however correctly a learner deletes themselves.
    planned = {t for t, _c, _w in PLAN}
    for table in NAMES:
        assert table not in planned


# ── the drop itself, on stand-ins ────────────────────────────────

@pytest.fixture
def stand_ins():
    """Real tables under the legacy names, so the drop can be exercised
    on a database that (correctly) does not have them."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for table in NAMES:
                cur.execute(f'CREATE TABLE IF NOT EXISTS "{table}" (user_id TEXT)')
                cur.execute(f'INSERT INTO "{table}" (user_id) VALUES (%s)', ("probe",))
        conn.commit()
        yield
    finally:
        with conn.cursor() as cur:
            for table in NAMES:
                cur.execute(f'DROP TABLE IF EXISTS "{table}"')
        conn.commit()
        conn.close()


def test_dry_run_reports_without_dropping(stand_ins):
    from scripts.drop_legacy_tables import main
    import sys
    argv = sys.argv
    sys.argv = ["drop_legacy_tables"]
    try:
        assert main() == 0
    finally:
        sys.argv = argv

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for table in NAMES:
                assert _present(cur, table), f"{table} was dropped by a dry run"
    finally:
        conn.close()


def test_yes_drops_every_one_of_them(stand_ins):
    from scripts.drop_legacy_tables import main
    import sys
    argv = sys.argv
    sys.argv = ["drop_legacy_tables", "--yes"]
    try:
        assert main() == 0
    finally:
        sys.argv = argv

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for table in NAMES:
                assert not _present(cur, table), f"{table} survived"
    finally:
        conn.close()


def test_a_second_run_is_a_no_op():
    # Nothing present: the script reports "already gone" and succeeds,
    # so it is safe on a database that was built from the schema file.
    from scripts.drop_legacy_tables import main
    import sys
    argv = sys.argv
    sys.argv = ["drop_legacy_tables", "--yes"]
    try:
        assert main() == 0
    finally:
        sys.argv = argv
