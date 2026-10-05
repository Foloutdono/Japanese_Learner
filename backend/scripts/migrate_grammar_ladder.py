"""
Put every grammar point a learner has studied onto the ladder (plan 187e).

    python -m scripts.migrate_grammar_ladder                 # report only, changes nothing
    python -m scripts.migrate_grammar_ladder --yes           # do it
    python -m scripts.migrate_grammar_ladder --yes --user U  # one account only

WHY THIS EXISTS
----------------
Plan 187e moves grammar's track in the day's run from the recognition
flashcard (grammar.flashcard.f2b) to the ladder (grammar.ladder), whose
exercise climbs with the card's own progress. It is now grammar's primary
mode (study/level_rule.primary_mode): the one Today deals a new point on,
the level rule marks known and the basics course rides. A learner with a
hundred points behind them would otherwise meet all hundred again as new
on the ladder, and be asked to recognise は again on day one.

WHAT IT DOES
------------
For every grammar point a learner has a row for in any grammar mode, and
no ladder row yet:

- a grammar.ladder row is written with the schedule of the learner's BEST
  grammar mode for that point -- the one furthest along (srs._progress,
  the card's own bar), the most reviewed on a tie -- so nobody starts
  over (plan 187, Q2) and the ladder starts on the rung their best work
  has earned;
- the grammar.flashcard.f2b row is folded into it and removed: that was
  Today's main lane, which the ladder replaces, and left standing it would
  come due beside the ladder and ask the same point twice. Its history
  stays in review_log, so no figure summed over it moves (vocab's
  RETIRED makes the same cut).

The other grammar modes -- b2f, fill_in, contrast -- are platforms a
learner chose on the station, and keep their own schedules.

A point that already has a ladder row is left alone, whoever wrote it,
so the script can be run twice. Run it once, after the deploy that
carries the ladder: until then the ration deals already-studied points
as new on the ladder.
"""
import argparse
import logging
import sys
from collections import Counter

from core.db import db_conn
from srs.srs import SRSEngine

logging.basicConfig(level=logging.INFO, format="%(message)s", stream=sys.stdout)
logger = logging.getLogger("migrate_grammar_ladder")

LADDER = "grammar.ladder"
MAIN = "grammar.flashcard.f2b"
# The scheduler's columns, copied from the best mode's row as they are.
_COLUMNS = ("difficulty", "stability", "interval_days", "repetitions", "lapses",
            "learning_step", "is_learning", "next_review", "total_reviews",
            "correct_reviews", "last_quality")


def _user_clause(user: str | None) -> tuple[str, tuple]:
    return (" AND card_id LIKE %s", (f"{user}:%",)) if user else ("", ())


def _plan(cur, user: str | None) -> list[tuple[str, dict]]:
    """(card_id, best row) for every grammar card with no ladder row."""
    clause, params = _user_clause(user)
    cur.execute(
        f"""
        SELECT card_id, mode, {", ".join(_COLUMNS)}
        FROM card_modes
        WHERE mode LIKE 'grammar.%%' AND split_part(card_id, ':', 2) LIKE 'grammar\\_%%'{clause}
        ORDER BY card_id, mode
        """,
        params,
    )
    by_card: dict[str, list[dict]] = {}
    for row in cur.fetchall():
        card_id, mode = row[0], row[1]
        by_card.setdefault(card_id, []).append({"mode": mode, **dict(zip(_COLUMNS, row[2:]))})
    out = []
    for card_id, rows in by_card.items():
        if any(r["mode"] == LADDER for r in rows):
            continue
        best = max(rows, key=lambda r: (
            SRSEngine._progress(r["total_reviews"], r["interval_days"], r["is_learning"], r["learning_step"]),
            r["total_reviews"],
        ))
        out.append((card_id, best, any(r["mode"] == MAIN for r in rows)))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Seed grammar.ladder from each point's best grammar mode.")
    ap.add_argument("--yes", action="store_true", help="actually write; without it, only report")
    ap.add_argument("--user", default=None, help="scope to one user id")
    args = ap.parse_args()

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            plan = _plan(cur, args.user)
            users = {card_id.split(":", 1)[0] for card_id, _, _ in plan}
            sources = Counter(best["mode"] for _, best, _ in plan)
            folded = sum(1 for *_, has_main in plan if has_main)
            logger.info("%d grammar point(s) to put on the ladder, over %d learner(s).", len(plan), len(users))
            for mode, n in sources.most_common():
                logger.info("  %5d seeded from %s", n, mode)
            logger.info("%d %s row(s) folded into the ladder and removed.", folded, MAIN)
            if not plan:
                logger.info("Nothing to do.")
                return 0
            if not args.yes:
                logger.info("Dry run. Re-run with --yes to write them.")
                return 0
            for card_id, best, has_main in plan:
                cur.execute(
                    f"""
                    INSERT INTO card_modes (card_id, mode, {", ".join(_COLUMNS)})
                    VALUES (%s, %s, {", ".join(["%s"] * len(_COLUMNS))})
                    ON CONFLICT (card_id, mode) DO NOTHING
                    """,
                    (card_id, LADDER, *(best[c] for c in _COLUMNS)),
                )
                if has_main:
                    cur.execute("DELETE FROM card_modes WHERE card_id = %s AND mode = %s", (card_id, MAIN))
        conn.commit()
        logger.info("Done.")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
