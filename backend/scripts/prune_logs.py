"""
Cap the logs that grow without bound and are never read past a point.

    python -m scripts.prune_logs                  # report only, changes nothing
    python -m scripts.prune_logs --yes            # do it
    python -m scripts.prune_logs --yes --user u1  # scope to one learner

-- What "never read past a point" means ------------------------
Each policy below is set from what the READERS can actually reach, not
from a guess about what looks old:

  comprehension_log  is written by routes/reading.py and read by
                     nothing at all -- no endpoint selects from it. Its
                     entire value is being able to look at recent rows
                     when a comprehension bug is reported, so a small
                     per-learner cap loses nothing that was reachable.
  reading_log        /api/reading/history is the only reader and its
                     limit is capped at 200 (Query(le=200)). Row 201
                     back has never been servable.
  translation_log    /api/translation/history, same ceiling, same
                     reasoning.
  dictation_log      /api/dictation/history, ceiling 100 (Query(le=100)).
                     Row 101 back has never been servable.
  phrase_history     /api/phrase/history, ceiling 200, ordered
                     `kept DESC, created_at DESC`. KEPT rows are the
                     learner's own pins (保存) and are never touched --
                     only the unpinned history behind them is capped.
  video_sessions     /api/video/sessions lists at most 100 (le=100).
                     These are the heaviest rows in the schema (a whole
                     transcript in JSONB), and the cap is set at the
                     ceiling so the list view stays exactly as full as
                     it can be. Fetching one OLDER than the cap by id
                     is the one thing this gives up.
  ocr_usage          a per-(learner, day) counter, and routes/ocr.py
                     only ever touches CURRENT_DATE's row. Past days
                     are read by nothing.
  the two job tables claim locks, deleted on success -- so a row that
                     is still there long after its last update is from
                     a run that died. Neither is a lock any more.

review_log is deliberately NOT here. It looks like the same kind of
table and is not one: lifetime XP, the level, the streak, the 番付 and
the daily-new budget are all aggregates over it, so trimming it by date
is an account reset. It has its own tool, which rolls the rows up
before deleting them -- scripts/compact_review_log.py.

-- Scope -------------------------------------------------------
Everything here is per learner, so one very heavy user cannot push
another's history out. Row counts are reported before anything is
deleted, and nothing happens at all without --yes.
"""
import argparse
import logging

import scripts._env  # noqa: F401  -- must precede core.db, which reads
#                       DATABASE_URL at module scope. See scripts/_env.py.
from core.db import db_conn

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("prune-logs")

# (table, keep-per-user, extra WHERE, why). The cap is the reader's own
# ceiling wherever there is one, so the pruning is invisible.
PER_USER = [
    ("comprehension_log", 50,  "", "written by the reading screen, read by no endpoint"),
    ("reading_log",       200, "", "/api/reading/history caps at 200"),
    ("translation_log",   200, "", "/api/translation/history caps at 200"),
    ("dictation_log",     100, "", "/api/dictation/history caps at 100"),
    ("phrase_history",    200, " AND NOT kept",
     "/api/phrase/history caps at 200; pinned (保存) rows are never touched"),
    ("video_sessions",    100, "", "/api/video/sessions caps at 100; the heaviest rows here"),
]

# (table, timestamp column, days, why). Row age, not a per-user count,
# because there is nothing to rank -- these are keyed by day, or dead.
BY_AGE = [
    ("ocr_usage", "day", 30,
     "routes/ocr.py only ever reads CURRENT_DATE's counter"),
    ("exam_generation_jobs", "updated_at", 7,
     "a claim lock still standing a week after its last update is a dead run"),
    ("video_session_jobs", "updated_at", 7,
     "same, for transcript generation"),
    # The outer bound only. compact_events.py is what actually keeps
    # event_log small -- it folds rows into event_daily BEFORE deleting
    # them, and spares the once-per-learner families. This cut is a year
    # out and spares nothing, so it can only ever fire on rows that
    # script has already rolled up, or on a database where it was never
    # run. Same relationship prune_logs has always had with review_log,
    # except that one is excluded outright because its rows ARE the XP.
    ("event_log", "at", 365,
     "足跡 past a year; scripts/compact_events.py is the real retention"),
]


def _user_clause(user_id: str | None, column: str = "user_id") -> tuple[str, dict]:
    if user_id is None:
        return "", {}
    return f" AND {column} = %(user)s", {"user": user_id}


def _over_cap(cur, table: str, keep: int, extra: str, scope: str, params: dict) -> int:
    """How many rows sit past the cap. Same ranking the delete uses, so
    the report and the deletion can never disagree."""
    cur.execute(
        f"""
        SELECT COUNT(*) FROM (
            SELECT ROW_NUMBER() OVER (PARTITION BY user_id
                                          ORDER BY created_at DESC, id DESC) AS rn
              FROM "{table}"
             WHERE TRUE{extra}{scope}
        ) ranked
        WHERE rn > %(keep)s
        """,
        dict(params, keep=keep),
    )
    return cur.fetchone()[0]


def _trim(cur, table: str, keep: int, extra: str, scope: str, params: dict) -> int:
    # id DESC breaks ties inside a created_at that two rows share, so the
    # cut is deterministic rather than whichever the planner returned.
    cur.execute(
        f"""
        DELETE FROM "{table}" WHERE id IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id
                                                  ORDER BY created_at DESC, id DESC) AS rn
                  FROM "{table}"
                 WHERE TRUE{extra}{scope}
            ) ranked
            WHERE rn > %(keep)s
        )
        """,
        dict(params, keep=keep),
    )
    return cur.rowcount


def _older_than(cur, table: str, column: str, days: int, scope: str,
                params: dict, count_only: bool) -> int:
    where = f'WHERE "{column}" < NOW() - make_interval(days => %(days)s){scope}'
    p = dict(params, days=days)
    if count_only:
        cur.execute(f'SELECT COUNT(*) FROM "{table}" {where}', p)
        return cur.fetchone()[0]
    cur.execute(f'DELETE FROM "{table}" {where}', p)
    return cur.rowcount


def main() -> int:
    ap = argparse.ArgumentParser(description="Cap the append-only logs that nothing reads past a point.")
    ap.add_argument("--yes", action="store_true",
                    help="actually delete; without it, only report")
    ap.add_argument("--user", default=None, help="scope to one user id")
    args = ap.parse_args()

    scope, params = _user_clause(args.user)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            logger.info("scope: %s", f"user {args.user!r}" if args.user else "ALL USERS")
            logger.info("")

            work = []
            for table, keep, extra, why in PER_USER:
                n = _over_cap(cur, table, keep, extra, scope, params)
                logger.info("  %-22s %6d past the %d-per-learner cap   %s",
                            table, n, keep, why)
                if n:
                    work.append(("cap", table, keep, extra))

            for table, column, days, why in BY_AGE:
                # These two carry no user_id column; a --user scope
                # cannot narrow them, so it leaves them alone entirely
                # rather than pruning another learner's rows under it.
                if args.user and table != "ocr_usage":
                    logger.info("  %-22s %6s (no user column; skipped when scoped)", table, "-")
                    continue
                job_scope, job_params = _user_clause(args.user) if table == "ocr_usage" else ("", {})
                n = _older_than(cur, table, column, days, job_scope, job_params, count_only=True)
                logger.info("  %-22s %6d older than %d days   %s", table, n, days, why)
                if n:
                    work.append(("age", table, column, days))

            logger.info("")
            if not work:
                logger.info("Nothing to prune.")
                return 0
            if not args.yes:
                logger.info("Dry run. Re-run with --yes to prune.")
                return 0

            total = 0
            for kind, table, a, b in work:
                if kind == "cap":
                    total += _trim(cur, table, a, b, scope, params)
                else:
                    job_scope, job_params = (
                        _user_clause(args.user) if table == "ocr_usage" else ("", {})
                    )
                    total += _older_than(cur, table, a, b, job_scope, job_params,
                                         count_only=False)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    logger.info("Pruned %d rows.", total)
    logger.info("review_log is untouched — see scripts/compact_review_log.py.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
