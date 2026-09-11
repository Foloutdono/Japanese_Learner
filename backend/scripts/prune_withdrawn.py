"""
Collect the decks an author deleted while other learners followed them.

    python -m scripts.prune_withdrawn                # report only, changes nothing
    python -m scripts.prune_withdrawn --yes          # do it
    python -m scripts.prune_withdrawn --yes --days 7 # a shorter grace

-- What a withdrawn deck is ------------------------------------
Deleting a deck nobody follows deletes it. Deleting one that other
learners DO follow cannot, or their shelf loses a deck mid-session with
no explanation, so routes/decks.delete_deck marks it instead:
`withdrawn_at = NOW()`, visibility back to private. From that moment the
deck is gone for its author — off their shelf, out of their deck limit
(core/credits.check_deck_limit), 404 on every endpoint — and exists only
so the people following it can read the warning and take a copy
("make it mine", POST /api/decks/{id}/detach).

This script is the other half of that promise. Without it a withdrawn
deck is not a grace period, it is a leak: content its author asked to
delete, kept forever because somebody once followed it.

-- What deleting one takes with it -----------------------------
custom_cards, deck_cards, deck_subscriptions and deck_reports all FK to
decks(id) ON DELETE CASCADE, so one DELETE clears the lot.

The followers' SCHEDULER rows are deleted here too, explicitly: a
personal card's SRS key is "{follower}:custom_{deck}_{card}", which no
foreign key reaches, so they would otherwise sit in card_modes forever
naming a card nothing can resolve. Their review_log rows are NOT
touched, for the same reason detach does not copy them — lifetime XP,
the level and the streak are aggregates over that table, and deleting
rows from it is an account reset, not a cleanup. See CLAUDE.md.

-- Grace -------------------------------------------------------
DEFAULT_DAYS is the window, and it is deliberately generous: the cost of
waiting is a few rows, and the cost of being early is a learner losing a
deck they meant to copy.
"""
import argparse
import logging

import scripts._env  # noqa: F401  -- must precede core.db, which reads
#                       DATABASE_URL at module scope. See scripts/_env.py.
from core.db import db_conn

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("prune-withdrawn")

# Kept in step with routes/decks.WITHDRAWN_GRACE_DAYS, which is what the
# screen's warning is written against.
DEFAULT_DAYS = 30


def _due(cur, days: int) -> list[tuple]:
    """(deck_id, owner, followers) for every deck past its grace."""
    cur.execute(
        """
        SELECT d.id, d.user_id,
               (SELECT COUNT(*) FROM deck_subscriptions s WHERE s.deck_id = d.id)
        FROM decks d
        WHERE d.withdrawn_at IS NOT NULL
          AND d.withdrawn_at < NOW() - make_interval(days => %s)
        ORDER BY d.withdrawn_at
        """,
        (days,),
    )
    return cur.fetchall()


def _follower_card_keys(cur, deck_ids: list[int]) -> list[str]:
    """
    Every follower's SRS key for every personal card in these decks.

    Built here rather than left to a cascade because nothing
    foreign-keys an SRS row to a deck: the link is a string, the raw id
    "custom_{deck}_{card}" under each reader's own user prefix.
    """
    cur.execute(
        """
        SELECT s.user_id, c.deck_id, c.id
        FROM deck_subscriptions s
        JOIN custom_cards c ON c.deck_id = s.deck_id
        WHERE s.deck_id = ANY(%s)
        """,
        (deck_ids,),
    )
    return [f"{uid}:custom_{deck}_{card}" for uid, deck, card in cur.fetchall()]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--yes", action="store_true", help="actually delete")
    parser.add_argument("--days", type=int, default=DEFAULT_DAYS,
                        help=f"grace period in days (default {DEFAULT_DAYS})")
    args = parser.parse_args()

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            due = _due(cur, args.days)
            logger.info("Withdrawn decks past %d days: %d", args.days, len(due))
            for deck_id, owner, followers in due:
                logger.info("  deck %-8s owner %-40s %d follower(s)",
                            deck_id, owner, followers)

            if not due:
                logger.info("Nothing to collect.")
                return 0

            deck_ids = [d[0] for d in due]
            keys = _follower_card_keys(cur, deck_ids)
            logger.info("")
            logger.info("Would also retire %d follower scheduler key(s).", len(keys))

            if not args.yes:
                logger.info("Dry run. Re-run with --yes to collect.")
                return 0

            # Scheduler rows first: they are found THROUGH the cards, and
            # the cards go with the deck.
            if keys:
                cur.execute("DELETE FROM card_modes WHERE card_id = ANY(%s)", (keys,))
                cur.execute("DELETE FROM card_first_review WHERE card_id = ANY(%s)", (keys,))
                cur.execute("DELETE FROM cards WHERE id = ANY(%s)", (keys,))
            cur.execute("DELETE FROM decks WHERE id = ANY(%s)", (deck_ids,))
            removed = cur.rowcount
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    logger.info("Collected %d deck(s).", removed)
    logger.info("review_log is untouched — those rows are the learners' own XP.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
