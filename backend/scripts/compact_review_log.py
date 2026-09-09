"""
Fold old review_log rows into the daily rollup, then delete them.

    python -m scripts.compact_review_log                   # report only, changes nothing
    python -m scripts.compact_review_log --yes             # do it
    python -m scripts.compact_review_log --days 90         # keep 90 days of rows
    python -m scripts.compact_review_log --yes --user u1   # scope to one learner

-- Why this exists rather than a DELETE ------------------------
review_log looks like an audit log and is not one. Lifetime XP, the
level that follows it, total reviews, the streak, the 番付 standing and
the daily-new budget are every one of them a SUM, COUNT or MIN over
that table -- there is no other copy. `DELETE FROM review_log WHERE
reviewed_at < ...` is therefore not a retention policy, it is a partial
account reset: every learner's XP drops to whatever fell inside the
window, their level drops with it, their longest streak is forgotten,
and the leaderboard reshuffles.

So the rows are ROLLED UP before they go. Three tables catch what the
readers need (see srs/data_structure.sql for the shapes):

  review_daily       one row per (learner, UTC day, UTC hour) carrying
                     the review count, the XP and the six rating
                     counters -- enough to rebuild lifetime XP, total
                     reviews, the studied-day set behind the streak, the
                     calendar, the hour-of-day chart and the rating mix.
  card_first_review  MIN(reviewed_at) per (card, mode). get_new_items_today
                     and get_journey_item_counts ask when a card was
                     FIRST met; without this a card met two years ago
                     would read as new the moment its rows went, and
                     spend the learner's daily allowance a second time.
  review_compaction  how far this has run per learner, plus the
                     best-quality-run high-water mark.

srs.py's readers add the two halves together, so the figures do not
move. What the learner sees is unchanged; only the row count falls.

-- What this DOES cost ----------------------------------------
One figure. get_best_quality_streak counts consecutive ROWS, so a run
is only visible while the rows are: the longest run inside the
compacted range is kept as a high-water mark, but a run STRADDLING the
cut is counted as its two halves. The mark can only ever be lower than
the truth, never higher, and only for runs that span a compaction
boundary.

And one rounding: review_daily buckets by UTC hour, so a learner in a
HALF-hour zone (India, +5:30) can see a compacted hour land in the
neighbouring bucket of the hour-of-day chart. Whole-hour zones are
exact.

-- The retention floor ----------------------------------------
--days may not go below MIN_RETENTION_DAYS. The 番付's 今週 side reads
7 days and the profile calendar 35 (routes/profile.py), and both clip
by timestamp where the rollup clips by whole day. Keeping 35 days of
rows means the rollup only ever answers LIFETIME questions, where a day
boundary cannot skew anything, and those two windowed reads stay on the
raw rows they were written against.

-- Concurrency ------------------------------------------------
Every statement is bounded by `id <= ceiling`, the highest id in range
when the run started, so the rows read and the rows deleted are the
same set even if reviews are being logged throughout. One transaction:
it either all lands or none of it does, and re-running is safe -- the
rollup upserts add and the first-sighting upsert keeps the earlier
date, so a row can never be counted twice or lose its true first date.
"""
import argparse
import logging

import scripts._env  # noqa: F401  -- must precede core.db, which reads
#                       DATABASE_URL at module scope. See scripts/_env.py.
from core.db import db_conn
from routes.account import prefix_pattern

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("compact-review-log")

# See "The retention floor" above.
MIN_RETENTION_DAYS = 35
DEFAULT_RETENTION_DAYS = 180

# The threshold get_best_quality_streak is actually called with
# (routes/profile.py's records lattice). The mark is stored with the
# threshold it was measured at and ignored for any other, so this is
# recorded rather than assumed.
DEFAULT_MIN_QUALITY = 4

# date_trunc so a day is never half-compacted: either all of a day's
# rows are rolled up or none are, which is what makes the studied-day
# set behind the streak exact on both sides of the cut.
CUTOFF = "date_trunc('day', NOW()) - make_interval(days => %(days)s)"


def _scope(user_id: str | None) -> tuple[str, dict]:
    """The WHERE fragment every statement shares, and its params.

    Scoping is by card id prefix, not a user_id column: review_log has
    no user_id: the namespacing in core/auth.py is the only thing that
    ties a row to a learner.
    """
    clause = f" AND reviewed_at < {CUTOFF}"
    params: dict = {}
    if user_id is not None:
        clause += " AND card_id LIKE %(prefix)s"
        params["prefix"] = prefix_pattern(user_id)
    return clause, params


def _ceiling(cur, scope: str, params: dict) -> int | None:
    """Highest review_log id in range right now. Everything below reads
    and deletes at or under it, so a review logged mid-run is neither
    rolled up nor deleted -- it is simply out of scope until next time."""
    cur.execute(f"SELECT MAX(id) FROM review_log WHERE TRUE{scope}", params)
    return cur.fetchone()[0]


def survey(cur, scope: str, params: dict) -> dict:
    """What a run would fold in, without changing anything."""
    cur.execute(
        f"""
        SELECT COUNT(*),
               COUNT(DISTINCT split_part(card_id, ':', 1)),
               COUNT(DISTINCT (split_part(card_id, ':', 1),
                               date_trunc('day', reviewed_at)::date,
                               EXTRACT(HOUR FROM reviewed_at)::int)),
               COUNT(DISTINCT (card_id, mode)),
               MIN(reviewed_at), MAX(reviewed_at)
          FROM review_log
         WHERE TRUE{scope}
        """,
        params,
    )
    rows, users, buckets, cards, oldest, newest = cur.fetchone()
    return {
        "rows": rows, "users": users, "buckets": buckets,
        "cards": cards, "oldest": oldest, "newest": newest,
    }


def compact(cur, scope: str, params: dict, min_quality: int) -> int:
    """Roll the in-scope rows up and delete them. Caller owns the
    transaction. Returns the number of rows deleted."""
    ceiling = _ceiling(cur, scope, params)
    if ceiling is None:
        return 0
    p = dict(params, ceiling=ceiling, minq=min_quality)
    bounded = f" AND id <= %(ceiling)s{scope}"

    # 1. First sightings, BEFORE the rows that carry them are deleted.
    #    LEAST on conflict: a card already in the table was met earlier
    #    than anything this run can see.
    cur.execute(
        f"""
        INSERT INTO card_first_review (card_id, mode, first_at)
        SELECT card_id, mode, MIN(reviewed_at)
          FROM review_log
         WHERE TRUE{bounded}
         GROUP BY card_id, mode
            ON CONFLICT (card_id, mode) DO UPDATE
           SET first_at = LEAST(card_first_review.first_at, EXCLUDED.first_at)
        """,
        p,
    )

    # 2. The daily rollup. Additive on conflict: folding rows in is
    #    addition, so a second run over a day that already has a bucket
    #    (an old row written after that day was compacted, say) tops it
    #    up instead of replacing it.
    cur.execute(
        f"""
        INSERT INTO review_daily (user_id, day, hour, reviews, xp,
                                  q0, q1, q2, q3, q4, q5)
        SELECT split_part(card_id, ':', 1),
               date_trunc('day', reviewed_at)::date,
               EXTRACT(HOUR FROM reviewed_at)::smallint,
               COUNT(*),
               COALESCE(SUM(xp_earned), 0),
               COUNT(*) FILTER (WHERE quality = 0),
               COUNT(*) FILTER (WHERE quality = 1),
               COUNT(*) FILTER (WHERE quality = 2),
               COUNT(*) FILTER (WHERE quality = 3),
               COUNT(*) FILTER (WHERE quality = 4),
               COUNT(*) FILTER (WHERE quality = 5)
          FROM review_log
         WHERE TRUE{bounded}
         GROUP BY 1, 2, 3
            ON CONFLICT (user_id, day, hour) DO UPDATE
           SET reviews = review_daily.reviews + EXCLUDED.reviews,
               xp      = review_daily.xp      + EXCLUDED.xp,
               q0      = review_daily.q0      + EXCLUDED.q0,
               q1      = review_daily.q1      + EXCLUDED.q1,
               q2      = review_daily.q2      + EXCLUDED.q2,
               q3      = review_daily.q3      + EXCLUDED.q3,
               q4      = review_daily.q4      + EXCLUDED.q4,
               q5      = review_daily.q5      + EXCLUDED.q5
        """,
        p,
    )

    # 3. The watermark, and the best run inside what is about to go.
    #    Gaps-and-islands per learner: the gap between two row-number
    #    sequences is constant within an unbroken run. `users` is the
    #    left side of the join so a learner with no qualifying run at
    #    all still gets their watermark written.
    cur.execute(
        f"""
        WITH scoped AS (
            SELECT split_part(card_id, ':', 1) AS user_id, quality, reviewed_at
              FROM review_log
             WHERE TRUE{bounded}
        ),
        ordered AS (
            SELECT user_id, quality,
                   ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY reviewed_at) -
                   ROW_NUMBER() OVER (PARTITION BY user_id, (quality >= %(minq)s)
                                          ORDER BY reviewed_at) AS grp
              FROM scoped
        ),
        runs AS (
            SELECT user_id, COUNT(*) AS cnt
              FROM ordered
             WHERE quality >= %(minq)s
             GROUP BY user_id, grp
        ),
        best AS (
            SELECT user_id, MAX(cnt) AS best_run FROM runs GROUP BY user_id
        ),
        users AS (SELECT DISTINCT user_id FROM scoped)
        INSERT INTO review_compaction (user_id, compacted_through, best_run,
                                       best_run_min, updated_at)
        SELECT u.user_id,
               {CUTOFF},
               COALESCE(b.best_run, 0),
               %(minq)s,
               NOW()
          FROM users u
          LEFT JOIN best b USING (user_id)
            ON CONFLICT (user_id) DO UPDATE
           SET compacted_through = GREATEST(review_compaction.compacted_through,
                                            EXCLUDED.compacted_through),
               -- Only comparable at the same threshold; measured at a
               -- different one, the stored mark answers a different
               -- question and is replaced rather than maxed against.
               best_run = CASE
                   WHEN review_compaction.best_run_min = EXCLUDED.best_run_min
                   THEN GREATEST(review_compaction.best_run, EXCLUDED.best_run)
                   ELSE EXCLUDED.best_run
               END,
               best_run_min = EXCLUDED.best_run_min,
               updated_at = NOW()
        """,
        p,
    )

    # 4. And only now the rows themselves.
    cur.execute(f"DELETE FROM review_log WHERE TRUE{bounded}", p)
    return cur.rowcount


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Roll old review_log rows into review_daily, then delete them."
    )
    ap.add_argument("--yes", action="store_true",
                    help="actually compact; without it, only report")
    ap.add_argument("--days", type=int, default=DEFAULT_RETENTION_DAYS,
                    help=f"keep this many days of raw rows "
                         f"(default {DEFAULT_RETENTION_DAYS}, minimum {MIN_RETENTION_DAYS})")
    ap.add_argument("--user", default=None, help="scope to one user id")
    ap.add_argument("--min-quality", type=int, default=DEFAULT_MIN_QUALITY,
                    help="threshold the best-run mark is measured at "
                         f"(default {DEFAULT_MIN_QUALITY}, matching the profile)")
    args = ap.parse_args()

    if args.days < MIN_RETENTION_DAYS:
        logger.error(
            "--days %d is below the %d-day floor: the 番付's week and the "
            "profile's 35-day calendar clip by timestamp, and must keep "
            "reading raw rows. Refusing.",
            args.days, MIN_RETENTION_DAYS,
        )
        return 2

    scope, params = _scope(args.user)
    params["days"] = args.days

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            found = survey(cur, scope, params)

            logger.info("scope:     %s", f"user {args.user!r}" if args.user else "ALL USERS")
            logger.info("retention: %d days of raw rows", args.days)
            logger.info("")
            if not found["rows"]:
                logger.info("Nothing older than the window; nothing to do.")
                return 0

            logger.info("%8d review_log rows, %s .. %s",
                        found["rows"], found["oldest"], found["newest"])
            logger.info("%8d learners", found["users"])
            logger.info("%8d review_daily rows they fold into", found["buckets"])
            logger.info("%8d (card, mode) first sightings preserved", found["cards"])
            shrink = found["rows"] - found["buckets"]
            logger.info("")
            logger.info("net: %d fewer rows (%.1fx)", shrink,
                        found["rows"] / found["buckets"] if found["buckets"] else 1.0)

            if not args.yes:
                logger.info("")
                logger.info("Dry run. Re-run with --yes to compact.")
                return 0

            deleted = compact(cur, scope, params, args.min_quality)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    logger.info("")
    logger.info("Compacted: %d rows folded into the rollup and deleted.", deleted)
    logger.info("XP, level, total reviews, the streak and the 番付 are unchanged.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
