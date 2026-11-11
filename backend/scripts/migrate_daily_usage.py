"""
Fold the two old daily counters into daily_usage, then drop them (plan 320).

    python -m scripts.migrate_daily_usage          # report only, changes nothing
    python -m scripts.migrate_daily_usage --yes    # do it

WHY THIS EXISTS
----------------
routes/ocr.py and routes/reading.py counted their daily ceilings in
tables of their own, ocr_usage and comprehension_usage (user_id, day,
count), written before core/daily_limit.py's shared daily_usage
(user_id, feature, day, count) existed. Plan 320 moved both routes onto
daily_limit.claim under the features "ocr" and "comprehension", and took
the two tables out of every reader (the account's deletion, prune_logs,
the cleanup SQL, the Metabase dashboard). This carries their rows across
so nobody's today starts over, and drops the tables, which nothing
creates, reads or erases any more: left standing, their rows would
outlive the accounts they belong to (DELETE /api/account no longer
knows them).

WHEN TO RUN IT
--------------
Once, after the deploy that carries plan 320. Between that deploy and
this run a learner can have a row for today in both tables: the counts
are ADDED (ON CONFLICT ... count + EXCLUDED.count), so the day's total
is what both counters saw together, never less. Any day is carried, not
only today's: daily_usage's own thirty-day age policy (prune_logs)
collects the old ones as it always does.

The report is the real run: both copy and drop in one transaction, and
without --yes it is rolled back, so the figures are exact. A second run
finds nothing to move (the tables are gone).
"""
import argparse
import logging

import scripts._env  # noqa: F401  -- must precede core.db, which reads
#                       DATABASE_URL at module scope. See scripts/_env.py.
from core.db import db_conn

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("migrate-daily-usage")

# (old table, the feature its rows count as in daily_usage). The feature
# names are the routes' own: routes/ocr.OCR_FEATURE and
# routes/reading.COMPREHENSION_FEATURE (tests/test_migrate_daily_usage.py
# holds them equal).
MOVES = [
    ("ocr_usage", "ocr"),
    ("comprehension_usage", "comprehension"),
]


def _present(cur, table: str) -> bool:
    cur.execute(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = %s)",
        (table,),
    )
    return cur.fetchone()[0]


def migrate(cur) -> list[tuple[str, str, int, int, int]]:
    """Copy each old table into daily_usage and drop it, on an open
    cursor (the caller owns the transaction). Returns, per table found,
    (table, feature, rows read, rows inserted, rows merged into an
    existing daily_usage row)."""
    done = []
    for table, feature in MOVES:
        if not _present(cur, table):
            continue
        cur.execute(f'SELECT COUNT(*) FROM "{table}"')
        (rows,) = cur.fetchone()
        # xmax = 0 tells a fresh insert from a row ON CONFLICT updated.
        cur.execute(
            f"""
            INSERT INTO daily_usage (user_id, feature, day, count)
            SELECT user_id, %s, day, count FROM "{table}"
            ON CONFLICT (user_id, feature, day)
            DO UPDATE SET count = daily_usage.count + EXCLUDED.count
            RETURNING (xmax = 0)
            """,
            (feature,),
        )
        flags = [r[0] for r in cur.fetchall()]
        inserted = sum(1 for f in flags if f)
        cur.execute(f'DROP TABLE "{table}"')
        done.append((table, feature, rows, inserted, len(flags) - inserted))
    return done


def main() -> int:
    ap = argparse.ArgumentParser(description="Move ocr_usage and comprehension_usage into daily_usage.")
    ap.add_argument("--yes", action="store_true",
                    help="actually copy and drop; without it, only report")
    args = ap.parse_args()

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            done = migrate(cur)
        if not done:
            logger.info("Nothing to move: neither old table is there.")
            conn.rollback()
            return 0
        for table, feature, rows, inserted, merged in done:
            logger.info("  %-20s -> daily_usage '%s': %d rows (%d new, %d added to a row already there), then dropped",
                        table, feature, rows, inserted, merged)
        if args.yes:
            conn.commit()
            logger.info("Done.")
        else:
            conn.rollback()
            logger.info("Dry run: rolled back. Re-run with --yes to apply.")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
