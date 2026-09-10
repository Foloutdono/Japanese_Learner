"""
Fold old event_log rows into event_daily, then delete them.

    python -m scripts.compact_events              # report only, changes nothing
    python -m scripts.compact_events --yes        # do it
    python -m scripts.compact_events --days 60    # keep 60 days of raw rows
    python -m scripts.compact_events --yes --user u1

-- Why this exists ---------------------------------------------
event_log answers two different kinds of question and only one of them
needs the rows.

  ORDER    "which boarding step came before the drop-off", "what did
           they open in the session they never came back from". These
           need the individual rows, in sequence, and no rollup can
           reconstruct them.
  RATE     "how many people opened the app on day 7", "how often is
           dictation finished rather than abandoned". These are counts,
           and a count per (learner, day, name) answers them exactly.

Rate questions are asked about all of history; order questions are
asked about the recent past, because a funnel you are still fixing is
this month's funnel. So the counts are kept forever and the rows are
kept for a month.

The one exception is the once-per-learner families -- the boarding and
the fare gate (core/events.KEEP_LONG). Those are a handful of rows per
account for its whole life, they cost nothing to keep, and they are
precisely the ones whose ORDER matters years later: "did the people who
stopped at the level step ever come back" cannot be asked of a rollup.

-- What this costs ---------------------------------------------
Nothing the app reads. Nothing in the frontend or in any route queries
event_log; it exists for scripts/weekly_digest.py and for whatever
question is asked of the database directly. Both halves are added back
together by any query that wants a total -- see the digest for the
shape.

Safe by default: without --yes it reports and changes nothing.
"""
import argparse
import logging

import scripts._env  # noqa: F401  -- must precede core.db, which reads
#                       DATABASE_URL at module scope. See scripts/_env.py.
from core.db import db_conn
from core.events import KEEP_LONG

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("compact-events")

DEFAULT_RETENTION_DAYS = 30
# Below a week the raw rows stop being able to answer anything about a
# funnel -- a learner who boards on Friday and returns on Monday is
# already outside a 2-day window.
MIN_RETENTION_DAYS = 7


def _scope(user_id: str | None) -> tuple[str, dict]:
    if user_id is None:
        return "", {}
    return " AND user_id = %(user)s", {"user": user_id}


def report(cur, days: int, user_id: str | None) -> tuple[int, int]:
    """(rows past the window, rows of that which will be kept anyway)."""
    clause, params = _scope(user_id)
    params = {**params, "days": days, "keep": list(KEEP_LONG)}
    cur.execute(
        f"SELECT COUNT(*) FROM event_log"
        f" WHERE at < NOW() - (%(days)s || ' days')::interval{clause}",
        params,
    )
    old = cur.fetchone()[0]
    cur.execute(
        f"SELECT COUNT(*) FROM event_log"
        f" WHERE at < NOW() - (%(days)s || ' days')::interval"
        f"   AND name = ANY(%(keep)s){clause}",
        params,
    )
    spared = cur.fetchone()[0]
    return old, spared


def roll_up(cur, days: int, user_id: str | None) -> int:
    """Add the doomed rows to event_daily. Returns rows written.

    Idempotent: re-running before the delete adds the same rows twice,
    which is why the two run in ONE transaction below and never apart.
    """
    clause, params = _scope(user_id)
    params = {**params, "days": days, "keep": list(KEEP_LONG)}
    cur.execute(
        f"""
        INSERT INTO event_daily (user_id, day, name, n)
        SELECT user_id, (at AT TIME ZONE 'UTC')::date, name, COUNT(*)
          FROM event_log
         WHERE at < NOW() - (%(days)s || ' days')::interval
           AND NOT (name = ANY(%(keep)s))
           {clause}
         GROUP BY user_id, (at AT TIME ZONE 'UTC')::date, name
        ON CONFLICT (user_id, day, name)
        DO UPDATE SET n = event_daily.n + EXCLUDED.n
        """,
        params,
    )
    return cur.rowcount


def delete_old(cur, days: int, user_id: str | None) -> int:
    clause, params = _scope(user_id)
    params = {**params, "days": days, "keep": list(KEEP_LONG)}
    cur.execute(
        f"""
        DELETE FROM event_log
         WHERE at < NOW() - (%(days)s || ' days')::interval
           AND NOT (name = ANY(%(keep)s))
           {clause}
        """,
        params,
    )
    return cur.rowcount


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Roll old event_log rows into event_daily, then delete them."
    )
    ap.add_argument("--yes", action="store_true",
                    help="actually compact; without it, only report")
    ap.add_argument("--days", type=int, default=DEFAULT_RETENTION_DAYS,
                    help=f"keep this many days of raw rows "
                         f"(default {DEFAULT_RETENTION_DAYS}, minimum {MIN_RETENTION_DAYS})")
    ap.add_argument("--user", default=None, help="scope to one user id")
    args = ap.parse_args()

    days = max(args.days, MIN_RETENTION_DAYS)
    if days != args.days:
        logger.info("--days %d is below the %d-day floor; using %d.",
                    args.days, MIN_RETENTION_DAYS, days)

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            old, spared = report(cur, days, args.user)
            movable = old - spared
            logger.info("Past %d days: %d rows, of which %d are kept long "
                        "(boarding and the fare gate).", days, old, spared)
            if movable == 0:
                logger.info("Nothing to compact.")
                conn.rollback()
                return 0
            if not args.yes:
                logger.info("Would roll up and delete %d rows. Re-run with --yes.", movable)
                conn.rollback()
                return 0

            # One transaction, both halves. A rollup that committed
            # without its delete would double every count the next time
            # this ran.
            written = roll_up(cur, days, args.user)
            removed = delete_old(cur, days, args.user)
            logger.info("Rolled %d rows into %d event_daily rows, then deleted them.",
                        removed, written)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
