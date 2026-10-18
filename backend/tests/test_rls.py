"""Every table is born closed to Supabase's Data API (core/rls.py).

The anon key ships in the frontend bundle, and Supabase grants every new
table in `public` to `anon` and `authenticated`: a table without Row
Level Security is anyone's to read and to write. So the module that
creates a table enables RLS on it in the same transaction, and
srs/data_structure.sql does beside each CREATE TABLE. These fail on a
table created open in either place, and on one still open in a database
the app has booted against; the last says what closed means.
"""
import re

import pytest
from psycopg2 import errors

from core.db import db_conn
from core.rls import enable_rls
from tests.test_schema_declared import (
    BACKEND_ROOT,
    CREATE_IF_NOT_EXISTS_RE,
    SCANNED_DIRS,
    SCHEMA_FILE,
)

# Anchored like tests/test_account.py's: the schema file's header
# mentions CREATE TABLE in prose.
DECLARED_RE = re.compile(r"^CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)", re.IGNORECASE | re.MULTILINE)
# Closed: by the helper, or by the statement itself (the schema file,
# and routes/reading.py, which runs one statement per transaction).
CLOSED_RE = re.compile(
    r"enable_rls\(\s*\w+\s*,\s*[\"'](\w+)[\"']\s*\)"
    r"|ALTER TABLE\s+(?:IF EXISTS\s+)?(\w+)\s+ENABLE ROW LEVEL SECURITY",
    re.IGNORECASE,
)


def _closed(text: str) -> set[str]:
    return {helper or statement for helper, statement in CLOSED_RE.findall(text)}


def _created_open(text: str) -> set[str]:
    """The tables `text` creates and never closes."""
    return set(CREATE_IF_NOT_EXISTS_RE.findall(text)) - _closed(text)


def _declared() -> set[str]:
    return set(DECLARED_RE.findall(SCHEMA_FILE.read_text(encoding="utf-8")))


def test_every_table_is_closed_by_the_module_that_creates_it():
    created_open = {}
    for dirname in SCANNED_DIRS:
        for path in sorted((BACKEND_ROOT / dirname).glob("*.py")):
            tables = _created_open(path.read_text(encoding="utf-8"))
            if tables:
                created_open[str(path.relative_to(BACKEND_ROOT))] = sorted(tables)
    assert not created_open, (
        f"{created_open}: created open to the Data API. Call "
        "core.rls.enable_rls(cur, table) right after the CREATE, in its "
        "transaction."
    )


def test_a_table_created_open_is_caught():
    """Negative control: the check above must see a table it fails on."""
    source = 'cur.execute("CREATE TABLE IF NOT EXISTS zzz_probe (id TEXT)")\n'
    assert _created_open(source) == {"zzz_probe"}
    assert _created_open(source + 'enable_rls(cur, "zzz_probe")\n') == set()


def test_every_declared_table_is_closed_in_the_schema_file():
    declared = _declared()
    closed = _closed(SCHEMA_FILE.read_text(encoding="utf-8"))
    assert "cards" in declared  # the pattern still reads the file
    assert not declared - closed, (
        f"{sorted(declared - closed)}: declared in srs/data_structure.sql "
        "without `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` after it."
    )
    # psql reads on past a failed statement, so a misspelt name would
    # only print an error on the way.
    assert not closed - declared, sorted(closed - declared)


def test_no_declared_table_is_open_in_this_database():
    """conftest imported main, so every self-migration has run against
    this database: a declared table still open here is one a boot would
    leave open in production. grammar_sentences is the one table no boot
    migrates (scripts/generate_grammar_sentences.py does), so its
    migration is run here."""
    from study.grammar_sentence_store import ensure_grammar_sentence_schema

    ensure_grammar_sentence_schema()
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT relname FROM pg_class"
                " WHERE oid IN (SELECT to_regclass(t) FROM unnest(%s::text[]) AS t)"
                "   AND NOT relrowsecurity ORDER BY relname",
                (sorted(_declared()),),
            )
            still_open = [name for (name,) in cur.fetchall()]
    finally:
        conn.close()
    assert not still_open, f"{still_open}: open to the Data API after a boot."


def test_closed_refuses_a_granted_role_and_spares_the_owner():
    """What enable_rls buys, on a scratch table in a transaction rolled
    back with its roles: a role granted everything on the table, as
    Supabase grants `anon`, reads and changes nothing; its owner, as the
    backend is, reads and writes as before, since nothing is FORCEd; and
    a second call on a closed table rewrites nothing."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT rolsuper FROM pg_roles WHERE rolname = current_user")
            if not cur.fetchone()[0]:
                pytest.skip("making the two roles needs a superuser")
            cur.execute("CREATE ROLE rls_probe_owner NOLOGIN")
            cur.execute("CREATE ROLE rls_probe_anon NOLOGIN")
            cur.execute("CREATE TABLE rls_probe (n INT)")
            cur.execute("ALTER TABLE rls_probe OWNER TO rls_probe_owner")
            cur.execute("GRANT ALL ON rls_probe TO rls_probe_anon")
            cur.execute("INSERT INTO rls_probe VALUES (1)")

            cur.execute("SET LOCAL ROLE rls_probe_owner")
            enable_rls(cur, "rls_probe")
            catalog = (
                "SELECT relrowsecurity, relforcerowsecurity, ctid"
                " FROM pg_class WHERE oid = 'rls_probe'::regclass"
            )
            cur.execute(catalog)
            on, forced, row = cur.fetchone()
            assert on and not forced
            enable_rls(cur, "rls_probe")
            cur.execute(catalog)
            assert cur.fetchone()[2] == row  # the catalog row was not rewritten
            cur.execute("INSERT INTO rls_probe VALUES (2)")
            cur.execute("SELECT count(*) FROM rls_probe")
            assert cur.fetchone()[0] == 2

            cur.execute("SET LOCAL ROLE rls_probe_anon")
            cur.execute("SELECT count(*) FROM rls_probe")
            assert cur.fetchone()[0] == 0
            cur.execute("UPDATE rls_probe SET n = 0")
            assert cur.rowcount == 0
            cur.execute("DELETE FROM rls_probe")
            assert cur.rowcount == 0
            cur.execute("SAVEPOINT refused")
            with pytest.raises(errors.InsufficientPrivilege):
                cur.execute("INSERT INTO rls_probe VALUES (3)")
            cur.execute("ROLLBACK TO SAVEPOINT refused")

            cur.execute("SET LOCAL ROLE rls_probe_owner")
            cur.execute("SELECT count(*) FROM rls_probe")
            assert cur.fetchone()[0] == 2
    finally:
        conn.rollback()
        conn.close()
