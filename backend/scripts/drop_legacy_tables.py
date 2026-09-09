"""
Drop the tables left behind when a feature was removed from the code.

    python -m scripts.drop_legacy_tables          # report only, changes nothing
    python -m scripts.drop_legacy_tables --yes    # do it

-- Why they are still there ------------------------------------
Every table in this app is self-migrated: the module that owns it runs
CREATE TABLE IF NOT EXISTS at import time (see srs/data_structure.sql's
header). That makes adding a table automatic and removing one manual --
deleting the module deletes the CREATE, but nothing drops what the
CREATE already made. So a retired feature leaves its tables standing,
full of rows, referenced by nothing.

LEGACY below is the set that commit 8f96f6b ("retire darumas, tonight,
badges, mastery ranks and the storehouse") left behind: it removed
routes/daruma.py, srs/daruma.py, routes/cosmetics.py and
srs/cosmetics.py along with the two screens and their stores, but the
five tables those modules had created stayed in the database. They are
absent from srs/data_structure.sql (so a database built from that file
never had them), absent from routes/account.py's PLAN, and absent from
the codebase entirely -- tests/test_legacy_tables.py pins that last
part, so a name here can never quietly come back into use while this
script is still willing to drop it.

Being outside PLAN is the reason they are worth dropping rather than
ignoring: DELETE /api/account cannot erase a table it does not know
about, so every one of these rows would outlive the account it belongs
to no matter how correctly a learner deletes themselves.

-- Reversibility -----------------------------------------------
There is none: the rows are gone. They are unlock records and goal
state for features no build of the app can display, so there is nothing
to restore them into. The dry run prints the row counts first; take a
dump beforehand if you want the option.
"""
import argparse
import logging

import scripts._env  # noqa: F401  -- must precede core.db, which reads
#                       DATABASE_URL at module scope. See scripts/_env.py.
from core.db import db_conn

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("drop-legacy-tables")

# (table, the feature it belonged to). Ordered children-first in case a
# future entry has a foreign key; these five have none between them.
LEGACY = [
    ("daruma_state",   "the Daruma Hall — per-daruma progress (routes/daruma.py)"),
    ("daruma_goals",   "the Daruma Hall — the goals a daruma was set against"),
    ("user_cosmetics", "the 蔵 storehouse — papers, rings, seals, backdrops, brushes"),
    ("user_loadout",   "the 蔵 storehouse — the quick-change drawer's chosen set"),
    ("streak_mends",   "streak mends, removed with the badge tickets"),
]


def _present(cur, table: str) -> bool:
    cur.execute(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = %s)",
        (table,),
    )
    return cur.fetchone()[0]


def main() -> int:
    ap = argparse.ArgumentParser(description="Drop tables left by removed features.")
    ap.add_argument("--yes", action="store_true",
                    help="actually drop; without it, only report")
    args = ap.parse_args()

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            found = []
            for table, why in LEGACY:
                if not _present(cur, table):
                    logger.info("  %-16s already gone", table)
                    continue
                cur.execute(f'SELECT COUNT(*) FROM "{table}"')
                found.append((table, cur.fetchone()[0], why))

            if not found:
                logger.info("")
                logger.info("Nothing to drop.")
                return 0

            logger.info("")
            for table, rows, why in found:
                logger.info("  %-16s %6d rows   %s", table, rows, why)
            logger.info("")
            logger.info("%d tables, %d rows", len(found), sum(r for _t, r, _w in found))

            if not args.yes:
                logger.info("")
                logger.info("Dry run. Re-run with --yes to drop. This cannot be undone.")
                return 0

            for table, _rows, _why in found:
                # No CASCADE: these tables have no dependents, and if one
                # ever acquires a view or a foreign key, failing loudly is
                # better than silently taking the dependent with it.
                cur.execute(f'DROP TABLE "{table}"')
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    logger.info("")
    logger.info("Dropped %d tables.", len(found))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
