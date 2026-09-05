# Raw docstring: the psql restore recipe below contains a literal
# \copy, which Python would otherwise read as an escape sequence.
r"""
Pull back cards the old growth rule pushed years out.

    python -m scripts.rescale_intervals                     # report only
    python -m scripts.rescale_intervals --apply
    python -m scripts.rescale_intervals --apply --user u1
    python -m scripts.rescale_intervals --beyond 730        # a different horizon

-- What went wrong -------------------------------------------
Interval growth used to be `ease x the grade's bonus x (1 + stability/20,
capped at 2.5)` -- three numbers each above 1, multiplied, so one review
could multiply an interval by 10.06. Replaying that rule on a card that
has just graduated and is then answered Correct every time gives
intervals of 3, 8, 23, 69, 217, 712, 2430, 8611 days: eight correct
answers and the card is twenty-three years out. Retired, not scheduled.

The third term is a settling ramp now rather than an amplifier (see
srs/scheduler.py), and the same card gets 2, 4, 9, 23, 66, 194, 581,
1769. But that only governs reviews from here on. Cards already sitting
in 2049 stay in 2049, because nothing recomputes a schedule that has
already been written.

-- What this does --------------------------------------------
For every (card, mode) whose next review is further out than --beyond,
it REPLAYS that card's own review history through the current scheduler
and writes back the state the card would have if the current rule had
always been in force. Not a cap and not a rescale: the same qualities in
the same order, run through today's code.

The new due date is anchored to the card's LAST REAL REVIEW, not to now,
so a card reviewed six months ago that should have come back in three is
overdue rather than granted a fresh six months.

-- What it refuses to do -------------------------------------
A replay is only honest if the log it replays is the whole history, so a
card is SKIPPED unless review_log holds exactly card_modes.total_reviews
rows for it. A short log would produce a short interval and flood the
queue with cards that are not actually due; a long one would push them
further out than they have earned. Either way the card is left alone and
counted in the report.

Cards inside --beyond are never touched, however the current rule would
schedule them. This is a repair for a specific breakage, not a
re-scheduling of everyone's deck.

-- Reversibility ---------------------------------------------
There is no undo, so --apply first writes every affected row's current
state to a CSV (path printed, --restore-file to choose it) before
changing anything -- written and flushed BEFORE the update, so even a
failure halfway through leaves a complete record. To put it back:

    psql "$DATABASE_URL"
    BEGIN;
    CREATE TEMP TABLE rescale_restore (
      card_id TEXT, mode TEXT, difficulty REAL, stability REAL,
      interval_days INTEGER, repetitions INTEGER, lapses INTEGER,
      learning_step INTEGER, is_learning BOOLEAN, next_review TIMESTAMPTZ
    );
    \copy rescale_restore FROM 'rescale-restore-....csv' WITH (FORMAT csv, HEADER true)
    UPDATE card_modes c SET
      difficulty = r.difficulty, stability = r.stability,
      interval_days = r.interval_days, repetitions = r.repetitions,
      lapses = r.lapses, learning_step = r.learning_step,
      is_learning = r.is_learning, next_review = r.next_review
    FROM rescale_restore r
    WHERE c.card_id = r.card_id AND c.mode = r.mode;
    COMMIT;

-- What it costs ---------------------------------------------
Cards move from "mastered" back to "learning" in the stats when their
interval drops under 21 days (srs.py's _classify_stage), because that
is what the honest interval says. Nothing else reads interval_days:
XP, level, streak and the profile's records all come from review_log,
which this never touches.
"""
import argparse
import csv
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

import scripts._env  # noqa: F401  -- must precede core.db, which reads
#                       DATABASE_URL at module scope. See scripts/_env.py.
from core.db import db_conn
from srs.models import CardState
from srs.scheduler import LEARNING_STEPS, Scheduler

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("rescale-intervals")

# The columns this rewrites, and therefore the ones the restore file
# has to carry. total_reviews/correct_reviews/last_quality are
# deliberately absent: the replay reproduces them exactly (they are
# counted off the same log), so writing them could only ever introduce
# a disagreement with the log itself.
WRITTEN = (
    "difficulty", "stability", "interval_days", "repetitions",
    "lapses", "learning_step", "is_learning", "next_review",
)


def replay(qualities, scheduler=None) -> CardState:
    """A fresh card taken through `qualities` by the CURRENT scheduler.

    Wall-clock during the replay is irrelevant: only the final counters
    are read out of it, and the due date is computed separately by
    `due_after` from the card's real last-review time.
    """
    scheduler = scheduler or Scheduler()
    state = CardState(card_id="replay", mode="replay")
    for quality in qualities:
        state = scheduler.review(state, quality)
    return state


def due_after(state: CardState, last_reviewed_at: datetime) -> datetime:
    """When the replayed card is next due, anchored to its last review.

    Mirrors what the scheduler itself would have set at that moment: a
    graduated card waits interval_days, a card back in the learning
    steps waits whichever step it is on. A card whose gap has already
    elapsed comes out in the past, i.e. due now, which is the point.
    """
    gap = (timedelta(days=state.interval_days) if not state.is_learning
           else LEARNING_STEPS[state.learning_step])
    return last_reviewed_at + gap


def _candidates(cur, beyond_days: int, prefix: str | None):
    where = ["next_review > NOW() + make_interval(days => %(beyond)s)"]
    params = {"beyond": beyond_days}
    if prefix:
        where.append("card_id LIKE %(prefix)s")
        params["prefix"] = prefix
    cur.execute(
        f"""
        SELECT card_id, mode, interval_days, next_review, total_reviews
        FROM card_modes
        WHERE {' AND '.join(where)}
        ORDER BY next_review DESC
        """,
        params,
    )
    return cur.fetchall()


def _history(cur, card_id: str, mode: str):
    cur.execute(
        """
        SELECT quality, reviewed_at FROM review_log
        WHERE card_id = %s AND mode = %s
        ORDER BY reviewed_at, id
        """,
        (card_id, mode),
    )
    return cur.fetchall()


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Replay far-future cards through the current scheduler.")
    ap.add_argument("--apply", action="store_true",
                    help="actually rewrite; without it this only reports")
    ap.add_argument("--user", help="scope to one user id (default: every user)")
    ap.add_argument("--beyond", type=int, default=365, metavar="DAYS",
                    help="only touch cards due further out than this (default: 365)")
    ap.add_argument("--restore-file", type=Path,
                    help="where to write the pre-change rows (default: "
                         "rescale-restore-<timestamp>.csv in the working directory)")
    args = ap.parse_args()

    prefix = f"{args.user}:%" if args.user else None
    scheduler = Scheduler()
    now = datetime.now(timezone.utc)

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            rows = _candidates(cur, args.beyond, prefix)

            logger.info("scope:     %s", f"user {args.user!r}" if args.user else "ALL USERS")
            logger.info("horizon:   further out than %d days", args.beyond)
            logger.info("candidates: %d", len(rows))
            logger.info("")

            planned, skipped = [], []
            for card_id, mode, interval_days, next_review, total_reviews in rows:
                log = _history(cur, card_id, mode)
                if len(log) != total_reviews:
                    skipped.append((card_id, mode, len(log), total_reviews))
                    continue
                state = replay([q for q, _ in log], scheduler)
                planned.append({
                    "card_id": card_id,
                    "mode": mode,
                    "was_interval": interval_days,
                    "was_due": next_review,
                    "state": state,
                    "due": due_after(state, log[-1][1]),
                })

            if skipped:
                logger.info("skipped %d card(s) whose review log is not their whole "
                            "history:", len(skipped))
                for card_id, mode, logged, claimed in skipped[:10]:
                    logger.info("  %-40s %-24s %d logged vs %d reviews",
                                card_id, mode, logged, claimed)
                if len(skipped) > 10:
                    logger.info("  ... and %d more", len(skipped) - 10)
                logger.info("")

            if not planned:
                logger.info("Nothing to rescale.")
                return 0

            due_now = sum(1 for p in planned if p["due"] <= now)
            pulled = sorted((p["was_due"] - p["due"]).days for p in planned)
            logger.info("%d card(s) would move:", len(planned))
            logger.info("  pulled back by   %d days (median), %d (most)",
                        pulled[len(pulled) // 2], pulled[-1])
            logger.info("  due immediately  %d", due_now)
            logger.info("")
            logger.info("  %-34s %-22s %10s -> %-10s", "card", "mode", "was due", "now due")
            for p in planned[:15]:
                logger.info("  %-34s %-22s %10s -> %-10s", p["card_id"][:34], p["mode"][:22],
                            p["was_due"].date(), p["due"].date())
            if len(planned) > 15:
                logger.info("  ... and %d more", len(planned) - 15)
            logger.info("")

            if not args.apply:
                logger.info("Nothing was changed. Re-run with --apply to write the above.")
                return 0

            # Written BEFORE the update, and flushed, so a failure
            # halfway through still leaves a complete record of what the
            # rows looked like going in.
            restore = args.restore_file or Path(
                f"rescale-restore-{now.strftime('%Y%m%d-%H%M%S')}.csv")
            cur.execute(
                f"""
                SELECT card_id, mode, {', '.join(WRITTEN)}
                FROM card_modes WHERE (card_id, mode) IN %s
                """,
                (tuple((p["card_id"], p["mode"]) for p in planned),),
            )
            with restore.open("w", newline="", encoding="utf-8") as fh:
                writer = csv.writer(fh)
                writer.writerow(("card_id", "mode", *WRITTEN))
                writer.writerows(cur.fetchall())
            logger.info("restore file: %s", restore.resolve())

            # One transaction: a half-applied rescale would leave some
            # cards explained by the new rule and some by the old, with
            # nothing on the row to say which.
            for p in planned:
                s = p["state"]
                cur.execute(
                    """
                    UPDATE card_modes
                    SET difficulty = %s, stability = %s, interval_days = %s,
                        repetitions = %s, lapses = %s, learning_step = %s,
                        is_learning = %s, next_review = %s
                    WHERE card_id = %s AND mode = %s
                    """,
                    (s.difficulty, s.stability, s.interval_days, s.repetitions,
                     s.lapses, s.learning_step, s.is_learning, p["due"],
                     p["card_id"], p["mode"]),
                )
            conn.commit()
            logger.info("Rescaled %d card(s).", len(planned))
            return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
