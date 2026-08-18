"""
Drop all SRS progress, so the new mode taxonomy starts from a clean slate.

    python -m scripts.wipe_srs                  # report only, changes nothing
    python -m scripts.wipe_srs --yes            # do it
    python -m scripts.wipe_srs --yes --user u1  # scope to one user
    python -m scripts.wipe_srs --yes --include-cards

-- Why a wipe and not a rename --------------------------------
Two independent reasons, either of which alone would force it:

1. THE MODE KEYS CHANGED. card_modes.mode is a bare TEXT column with no
   CHECK and no FK, so rows under retired keys ("qcm-m-kj", "flashcard")
   do not error -- they linger. And get_mastered_count, get_due_forecast,
   get_interval_histogram, get_weakest_cards and the daruma facts all
   filter by card_id LIKE and never by mode, so those rows would inflate
   the 段位 rank, vow progress and every forecast permanently.

2. EVERY GRAMMAR CARD ID CHANGED. routes/grammar.py moved onto the
   project's own catalogue, where the field is `pattern` rather than the
   scraped file's `grammar`, so grammar_{level}_{...} now resolves
   differently for all 205 points. Those rows are already orphaned.

-- What this costs --------------------------------------------
review_log is the single source of truth for lifetime XP, level, streak,
leaderboard standing and daruma progress: all of it is SUM(xp_earned) and
COUNT(*) over that table. Clearing it means:

  * XP and level reset to zero
  * BADGES RELOCK. They are recomputed live in routes/profile.py and
    never persisted, so they follow the numbers down.
  * the 段位 rank falls to 十級
  * the streak resets -- which is why streak_mends goes too. A bought-back
    day survives independently and would otherwise keep a phantom
    "showed up" alive under an empty review log.
  * in-flight daruma vows lose their progress

What SURVIVES, deliberately: cosmetic unlocks (persisted on first
satisfaction and never revoked), already-claimed daruma, exam papers and
attempts, reading and comprehension history, and the generated
grammar_sentences cache.

-- Operationally ----------------------------------------------
No API restart is needed. That requirement belonged to
srs/batch_cache.py's old ensure_initialized guard, which returned early
on an unchanged key and so stranded every session until the process was
restarted; removing the pre-materialisation removed the guard with it. A
running API may still hold partly-consumed id pools in batch_cache, which
is transient -- they refill on the next request -- not a lockout.
"""
import argparse
import logging
import sys

from core.db import db_conn

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("wipe-srs")

# Ordered CHILDREN FIRST, so the foreign keys hold at every step:
#   card_modes.card_id   -> cards
#   custom_cards.deck_id -> decks
#   deck_cards.deck_id   -> decks
# Each entry is (table, user-scoping clause, why it goes).
PLAN = [
    ("review_log", "card_id LIKE %(prefix)s",
     "lifetime XP, level, streak, leaderboard, daruma progress"),
    ("card_modes", "card_id LIKE %(prefix)s",
     "per-(card, mode) scheduler state, under retired mode keys"),
    ("xp_ledger", "user_id = %(user)s",
     "XP awarded outside a review"),
    ("streak_mends", "user_id = %(user)s",
     "bought-back days, which would outlive the reviews they sit beside"),
    ("custom_cards", "deck_id IN (SELECT id FROM decks WHERE user_id = %(user)s)",
     "hand-written personal cards"),
    ("deck_cards", "deck_id IN (SELECT id FROM decks WHERE user_id = %(user)s)",
     "browsed-in app cards attached to a deck"),
    ("decks", "user_id = %(user)s",
     "the decks themselves"),
]

# Left populated by default. `cards` is only an id registry: nothing reads
# a row from it to decide what to serve any more, since get_new_cards
# selects over the ids the router passes rather than joining it.
OPTIONAL = [
    ("cards", "id LIKE %(prefix)s", "the card id registry"),
]

# Named so a reader can see these were considered and kept, rather than
# wondering whether they were forgotten.
UNTOUCHED = {
    "user_cosmetics": "unlocks are persisted on first satisfaction and never revoked",
    "user_loadout": "what the learner has equipped is not progress",
    "daruma_state": "already-claimed daruma survive",
    "daruma_goals": "vow definitions; their PROGRESS comes from review_log and resets with it",
    "user_profiles": "identity, not progress",
    "exam_papers": "generated papers are content, and attempts reference them",
    "exam_attempts": "exam history is separate from SRS scheduling",
    "reading_log": "reading practice history",
    "comprehension_log": "reading comprehension history",
    "phrase_history": "analyzer history",
    "translation_log": "translation history",
    "frequency_overrides": "per-user frequency tweaks are settings",
    "grammar_sentences": "generated example sentences are content, and expensive",
}


def _counts(cur, steps, scoped, params):
    out = {}
    for table, clause, _why in steps:
        where = f" WHERE {clause}" if scoped else ""
        cur.execute(f'SELECT COUNT(*) FROM "{table}"{where}', params)
        out[table] = cur.fetchone()[0]
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Wipe SRS progress.")
    ap.add_argument("--yes", action="store_true",
                    help="actually delete; without it this only reports")
    ap.add_argument("--user", help="scope to one user id (default: every user)")
    ap.add_argument("--include-cards", action="store_true",
                    help="also empty the `cards` id registry")
    args = ap.parse_args()

    steps = PLAN + (OPTIONAL if args.include_cards else [])
    scoped = args.user is not None
    params = {"user": args.user, "prefix": f"{args.user}:%"} if scoped else {}

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            before = _counts(cur, steps, scoped, params)

            logger.info("scope: %s", f"user {args.user!r}" if scoped else "ALL USERS")
            logger.info("")
            total = 0
            for table, _clause, why in steps:
                logger.info("  %-14s %7d   %s", table, before[table], why)
                total += before[table]
            logger.info("  %-14s %7d", "TOTAL", total)
            logger.info("")

            if not args.yes:
                logger.info("Nothing was changed. Re-run with --yes to delete the above.")
                logger.info("Untouched either way: %s", ", ".join(sorted(UNTOUCHED)))
                return 0

            if total == 0:
                logger.info("Already empty; nothing to do.")
                return 0

            # One transaction. A half-applied wipe would leave card_modes
            # rows pointing at a review history that no longer explains
            # them, which is worse than either end state.
            for table, clause, _why in steps:
                where = f" WHERE {clause}" if scoped else ""
                cur.execute(f'DELETE FROM "{table}"{where}', params)
                logger.info("  deleted %-14s %7d", table, cur.rowcount)
            conn.commit()

            after = _counts(cur, steps, scoped, params)

        logger.info("")
        logger.info("after: %s", ", ".join(f"{t}={after[t]}" for t, _, _ in steps))
        remaining = sum(after.values())
        if remaining:
            logger.warning("%d row(s) survived -- expected 0", remaining)
            return 1
        logger.info("Done. XP, level, badges, 段位 and streak now read as zero.")
        logger.info("Cosmetics, claimed daruma and exam history were left alone.")
        return 0
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
