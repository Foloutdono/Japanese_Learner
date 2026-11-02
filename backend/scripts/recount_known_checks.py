"""
Take the level rule's virtual check out of the cards answered before plan 300.

    python -m scripts.recount_known_checks                 # report only, changes nothing
    python -m scripts.recount_known_checks --yes           # do it
    python -m scripts.recount_known_checks --yes --user U  # one account only

WHY THIS EXISTS
---------------
A card the level rule marks known (plan 074; an import too, plan 243) is
written with KNOWN_STATE's one check of one in card_modes, which is what
makes it read met and mastered before anybody asks. Until plan 300 the
first real answer counted on top of it: one answer, two in the row. So
the card read "2 of 2, 100%" after one pass, and every figure after it
was one answer and one right answer too many -- a miss later read 2 of
3 where the learner went 1 of 2, and the statistics' deck grid and the
weakest cards carried the same extra. From plan 300 the review takes the
virtual check out as the real one comes in (SRSEngine.review); this does
the same for the rows answered before.

WHAT IT DOES
------------
A row whose whole history is still in review_log -- none of it folded
into the rollup, which card_first_review would record -- counts exactly
its logged answers, unless it carries the virtual check: then it counts
one answer and one right answer more than its log, and nothing else
makes a row do that. Every such row is set to its log's count. Never a
row the recount would leave reading untouched (one review, KNOWN_STATE's
repetitions, no lapse, not learning): it keeps its virtual check rather
than be asked its check again, as the review does. A row set matches its
log, so the script can be run twice.

The level rule's rows were answered before the checks were marked
(review_log.assumed, plan 224), so the count finds them where the mark
could not. A row with history folded away is left alone and counted in
the report: its log no longer says what it was answered. Run it once,
after the deploy that carries plan 300. Compaction keeps 180 days, and a
check passed since plan 300 counts once; folded away much later, its
row would read as one over its log too.
"""
import argparse
import logging
import sys

import scripts._env  # noqa: F401  -- must precede core.db, which reads
#                       DATABASE_URL at module scope. See scripts/_env.py.
from core.db import db_conn
from routes.account import prefix_pattern
from srs.srs import SRSEngine

logging.basicConfig(level=logging.INFO, format="%(message)s", stream=sys.stdout)
logger = logging.getLogger("recount_known_checks")

_K = SRSEngine.KNOWN_STATE

# The rows over their log by exactly the virtual check, whole history
# logged, that the recount would not leave reading untouched. A right
# answer is the scheduler's and the ladder's: a grade of 3 or more.
_OVER = f"""
    WITH logged AS (
        SELECT card_id, mode, COUNT(*) AS n, COUNT(*) FILTER (WHERE quality >= 3) AS good
        FROM review_log
        WHERE card_id LIKE %(pattern)s
        GROUP BY card_id, mode
    )
    SELECT cm.card_id, cm.mode, l.n, l.good
    FROM card_modes cm
    JOIN logged l ON l.card_id = cm.card_id AND l.mode = cm.mode
    WHERE cm.card_id LIKE %(pattern)s
      AND cm.total_reviews = l.n + {_K["total_reviews"]}
      AND cm.correct_reviews = l.good + {_K["correct_reviews"]}
      AND NOT EXISTS (SELECT 1 FROM card_first_review f
                      WHERE f.card_id = cm.card_id AND f.mode = cm.mode)
      AND NOT (l.n = {_K["total_reviews"]} AND cm.repetitions = {_K["repetitions"]}
               AND cm.lapses = 0 AND NOT cm.is_learning)
"""


def _pattern(user: str | None) -> str:
    return prefix_pattern(user) if user else "%"


def over(cur, user: str | None = None) -> list[tuple[str, str, int, int]]:
    """(card id, mode, logged answers, logged right answers) for every row
    that still carries its virtual check over a logged history."""
    cur.execute(_OVER, {"pattern": _pattern(user)})
    return [(r[0], r[1], int(r[2]), int(r[3])) for r in cur.fetchall()]


def folded(cur, user: str | None = None) -> int:
    """How many rows have history folded into the rollup: their log no
    longer says what they were answered, so they are left as they are."""
    cur.execute(
        """
        SELECT COUNT(*) FROM card_modes cm
        WHERE cm.card_id LIKE %(pattern)s AND cm.total_reviews > 0
          AND EXISTS (SELECT 1 FROM card_first_review f
                      WHERE f.card_id = cm.card_id AND f.mode = cm.mode)
        """,
        {"pattern": _pattern(user)},
    )
    return int(cur.fetchone()[0])


def recount(cur, user: str | None = None) -> int:
    """Set every such row to its log's count. Returns how many moved."""
    cur.execute(
        f"""
        UPDATE card_modes cm
        SET total_reviews = o.n, correct_reviews = o.good
        FROM ({_OVER}) o(card_id, mode, n, good)
        WHERE cm.card_id = o.card_id AND cm.mode = o.mode
        """,
        {"pattern": _pattern(user)},
    )
    return cur.rowcount


def main() -> int:
    ap = argparse.ArgumentParser(description="Take the level rule's virtual check out of cards answered before plan 300.")
    ap.add_argument("--yes", action="store_true", help="actually recount; without it, only report")
    ap.add_argument("--user", default=None, help="scope to one user id")
    args = ap.parse_args()

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            logger.info("scope: %s", f"user {args.user!r}" if args.user else "ALL USERS")
            rows = over(cur, args.user)
            by_mode: dict[str, int] = {}
            for _card, mode, _n, _good in rows:
                by_mode[mode] = by_mode.get(mode, 0) + 1
            logger.info("  %d row(s) one check of one over their log", len(rows))
            for mode, n in sorted(by_mode.items(), key=lambda kv: -kv[1]):
                logger.info("    %-28s %d", mode, n)
            logger.info("  %d row(s) with history folded into the rollup, left as they are", folded(cur, args.user))
            if not rows:
                logger.info("Nothing to recount.")
                return 0
            if not args.yes:
                logger.info("Dry run. Re-run with --yes to set them to their log's count.")
                return 0
            moved = recount(cur, args.user)
        conn.commit()
        logger.info("Recounted %d row(s).", moved)
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
