"""
Rename the learner rows of every kanji card the deck stopped serving twice (plan 112).

    python -m scripts.migrate_kanji_ids                 # report only, changes nothing
    python -m scripts.migrate_kanji_ids --yes           # do it
    python -m scripts.migrate_kanji_ids --yes --user U  # one account only

WHY THIS EXISTS
----------------
A kanji card id is `kanji_{level}_{character}`, and 23 characters were
taught at two levels (会 at N5 and N4, 耳 at N5 and N3). The deck keeps
the lower one now; content/kanji_renames.py maps each retired id onto
it, and this script moves the learner's rows so the history they built
at N4 lands on the N5 card instead of vanishing.

WHAT IT DOES
------------
scripts/migrate_vocab_ids.py's procedure, on the kanji ids: for every
distinct kanji card id in cards, card_modes, review_log and
card_first_review,

  served    -> nothing to do
  in MOVES  -> renamed in one transaction per id; where the learner had
               studied the N5 card too, the two card_modes rows MERGE --
               effort summed, the least-advanced schedule kept -- and
               the earlier first review is kept (the vocab migration's
               own helpers, so the two can never disagree on the rule)
  unknown   -> reported and left exactly as it is

then deck_cards (source = 'kanji'): raw_id and level onto the target,
and a deck that already held the N5 card keeps its one row.

Left alone, and why: frequency_overrides (domain 'kanji') and
dictionary_favorites (kind 'kanji') name a kanji by its character, which
did not change; xp_ledger.ref and credit_ledger.ref are receipts that
nothing joins on.

Idempotent: after a run no moved id is left in any scanned table.
Deploy the code first, run this once after: between the two an N4 row
reads as a card the deck no longer serves, and nothing is lost.
"""
import argparse
import logging
import sys

import scripts._env  # noqa: F401  -- loads backend/.env before core.db reads DATABASE_URL

from content.kanji_data import KANJI_BY_LEVEL, kanji_to_id
from content.kanji_renames import MOVES
from core.db import db_conn
from scripts.migrate_vocab_ids import TABLES_WITH_CARD_IDS, _merge_modes, _move_first_review, _split

logger = logging.getLogger("migrate_kanji_ids")


def served_ids() -> frozenset[str]:
    return frozenset(
        kanji_to_id(entry, level)
        for level, entries in KANJI_BY_LEVEL.items()
        for entry in entries
    )


def find_card_ids(cur, user: str | None = None) -> list[str]:
    """Every distinct prefixed card id that looks like a kanji card."""
    pattern = f"{user}:kanji\\_%" if user else "%:kanji\\_%"
    parts = [f"SELECT {col} AS card_id FROM {table} WHERE {col} LIKE %(pat)s"
             for table, col in TABLES_WITH_CARD_IDS]
    cur.execute(" UNION ".join(parts), {"pat": pattern})
    return sorted(row[0] for row in cur.fetchall())


def classify(card_ids: list[str], served: frozenset[str]) -> dict[str, list[str]]:
    out = {"served": [], "moved": [], "unknown": []}
    for card_id in card_ids:
        _, raw = _split(card_id)
        if raw in MOVES:
            out["moved"].append(card_id)
        elif raw in served:
            out["served"].append(card_id)
        else:
            out["unknown"].append(card_id)
    return out


def rename_card(conn, card_id: str) -> int:
    """One learner's rows for one retired id, in one transaction.
    Returns the number of card_modes rows merged rather than renamed."""
    user_id, raw = _split(card_id)
    new_id = f"{user_id}:{MOVES[raw]}"
    with conn.cursor() as cur:
        cur.execute("INSERT INTO cards(id) VALUES (%s) ON CONFLICT (id) DO NOTHING", (new_id,))
        merged = _merge_modes(cur, card_id, new_id)
        cur.execute("DELETE FROM cards WHERE id = %s", (card_id,))
        cur.execute("UPDATE review_log SET card_id = %s WHERE card_id = %s", (new_id, card_id))
        _move_first_review(cur, card_id, new_id)
    conn.commit()
    return merged


def rename_deck_cards(cur, user: str | None = None) -> tuple[int, int]:
    """deck_cards rows onto the kept card's raw_id and level. Returns
    (renamed, dropped): a deck that already held the target keeps its row."""
    renamed = dropped = 0
    scope = " AND user_id = %(user)s" if user else ""
    for old, new in MOVES.items():
        params = {"old": old, "new": new, "user": user, "level": new.split("_", 2)[1]}
        cur.execute(
            f"""
            UPDATE deck_cards SET raw_id = %(new)s, level = %(level)s
            WHERE source = 'kanji' AND raw_id = %(old)s{scope}
              AND NOT EXISTS (
                SELECT 1 FROM deck_cards d2
                WHERE d2.deck_id = deck_cards.deck_id AND d2.source = 'kanji' AND d2.raw_id = %(new)s
              )
            """,
            params,
        )
        renamed += cur.rowcount
        cur.execute(f"DELETE FROM deck_cards WHERE source = 'kanji' AND raw_id = %(old)s{scope}", params)
        dropped += cur.rowcount
    return renamed, dropped


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    parser.add_argument("--yes", action="store_true", help="apply the renames; without it, report only")
    parser.add_argument("--user", help="limit to one user id")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            fates = classify(find_card_ids(cur, args.user), served_ids())
            scope = " AND user_id = %(user)s" if args.user else ""
            cur.execute(f"SELECT COUNT(*) FROM deck_cards WHERE source = 'kanji' AND raw_id = ANY(%(olds)s){scope}",
                        {"olds": list(MOVES), "user": args.user})
            decks = cur.fetchone()[0]
        conn.commit()

        logger.info("kanji card ids: %d served, %d to move, %d unknown (left)",
                    len(fates["served"]), len(fates["moved"]), len(fates["unknown"]))
        for card_id in fates["unknown"]:
            logger.warning("  not in the deck and not in kanji_renames.py, left as is: %s", card_id)
        for card_id in fates["moved"]:
            logger.info("  %s -> %s", card_id, MOVES[_split(card_id)[1]])
        logger.info("deck_cards rows to move: %d", decks)

        if not args.yes:
            logger.info("dry run -- nothing written. Re-run with --yes to apply.")
            return 0

        merged = 0
        for card_id in fates["moved"]:
            try:
                merged += rename_card(conn, card_id)
            except Exception:
                conn.rollback()
                logger.exception("failed renaming %s; rolled back, continuing", card_id)
        with conn.cursor() as cur:
            renamed, dropped = rename_deck_cards(cur, args.user)
        conn.commit()
        logger.info("moved %d card id(s) (%d card_modes rows merged into an existing track); "
                    "deck_cards: %d moved, %d dropped as duplicates",
                    len(fates["moved"]), merged, renamed, dropped)
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
