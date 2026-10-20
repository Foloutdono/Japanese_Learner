"""Every table is born closed to Supabase's Data API.

Supabase serves each table in `public` at /rest/v1/<table> to whoever
holds the anon key, and that key ships in the frontend bundle. Its
default privileges grant every new table there to `anon` and
`authenticated` -- SELECT, INSERT, UPDATE and DELETE -- so a table
without Row Level Security is anyone's to read and to write. The
security advisor found 37 of them on 2026-10-17: `feedback`, the logs
of what learners typed, the trail, and `credit_ledger`, where anyone
could have written themselves credits.

RLS with no policy refuses those two roles every row. It does not bind
the backend: the backend owns the tables -- it created them, and its
self-migrations ALTER them at every boot, which only an owner may --
and a table's owner passes its RLS unless the table FORCEs it. The app
reads nothing through the Data API (the frontend uses Supabase to sign
in, nothing more), so there is no policy to write. Never FORCE it: that
would lock the backend out of its own rows.

So the transaction that creates a table closes it, with enable_rls()
right after the CREATE, and srs/data_structure.sql says the same beside
each CREATE TABLE. tests/test_rls.py fails on a table that is not.
"""
from psycopg2 import sql


def enable_rls(cur, table: str) -> None:
    """Turn Row Level Security on for `table`, on the caller's cursor and
    so in its transaction: a table created in that transaction is never
    committed open.

    Asked first, because this runs at every boot: ALTER TABLE takes the
    table's strongest lock, queueing behind whatever reads it and ahead
    of everything after, and rewrites its catalog row even when RLS is
    already on. A table already closed is left alone, and so is one that
    does not exist."""
    cur.execute(
        "SELECT 1 FROM pg_class WHERE oid = to_regclass(%s) AND NOT relrowsecurity",
        (table,),
    )
    if cur.fetchone():
        cur.execute(
            sql.SQL("ALTER TABLE {} ENABLE ROW LEVEL SECURITY").format(sql.Identifier(table))
        )
