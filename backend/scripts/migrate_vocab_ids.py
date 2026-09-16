"""
Rename the learner rows of every vocab entry the deck corrected (plan 091).

    python -m scripts.migrate_vocab_ids                 # report only, changes nothing
    python -m scripts.migrate_vocab_ids --yes           # do it
    python -m scripts.migrate_vocab_ids --yes --user U  # one account only

WHY THIS EXISTS
----------------
A vocab card id is `vocab_{level}_{kanji}_{kana}`, so both surface fields
are part of the learner's progress. 34 deck entries carried one spreadsheet
export's residue in those fields -- a part-of-speech note where the reading
belongs, or the word duplicated into the kanji column -- and correcting
them changes their ids. content/vocab_renames.py records each as a MOVE
(old id -> new id); this script renames the rows so a returning learner
finds their progress under the corrected entry instead of a "new" card.
Nothing is retired: every corrected entry is still served.

WHAT IT DOES
------------
For every distinct vocab card id in the four tables that carry one
(cards, card_modes, review_log, card_first_review -- review_log has no
FK and can outlive a deleted card, so each table is scanned):

  served    -> nothing to do
  in MOVES  -> renamed, in one transaction per old id, FK-safe:
               a. INSERT the new cards row (ON CONFLICT DO NOTHING)
               b. card_modes: UPDATE the old row onto the new id, or,
                  when the learner already studied the target in that
                  mode, MERGE the two rows -- effort summed
                  (total_reviews, correct_reviews, lapses), the
                  least-advanced schedule kept (smallest interval, then
                  earliest next_review), exactly migrate_grammar_ids.py's
                  rule, for its reason: a merge that took the furthest
                  schedule would re-inflate mastery
               c. DELETE the old cards row (nothing references it now,
                  so the ON DELETE CASCADE has nothing to do -- the order
                  matters, see migrate_jmdict_card_ids.py)
               d. review_log: UPDATE onto the new id
               e. card_first_review: UPDATE, or keep the earlier first_at
  unknown   -> reported and left exactly as it is (content drift from
               before renames.py existed; never guess)

A MOVES target was never itself a served id, so in practice (b) and (e)
only merge where the learner reached the same card through a deck.

Then, once per moved id rather than per learner:

  deck_cards (source = 'vocab')      raw_id is rewritten. `level` is NOT:
               no entry changed level, only its surface fields. The
               primary key is (deck_id, source, raw_id), so a deck that
               already holds the target keeps its row and the old one is
               dropped.
  frequency_overrides (domain='vocab')  item_key is the deck's own
               "{kanji}::{kana}" key (frequency_data.resolve()), so the
               same 34 corrections move it too -- see
               vocab_renames.KEY_MOVES. 22 of the corrected keys collapse
               onto a key a lower level already contributed (the
               frequency order dedups N5 -> N1, first occurrence wins),
               so where the learner already pinned that key their
               existing pin is kept and the moved one dropped: the kept
               row is the one that still resolves to an entry.

Left alone, and why: xp_ledger.ref and credit_ledger.ref hold card ids
as receipts -- every reader SUMs the ledger and none joins on ref -- so
a stale ref changes no figure a learner sees.

Idempotent by construction: after a run no moved id exists in any scanned
table, and a MOVES key can never re-enter the deck (tests/test_vocab_deck
.py's shape tests forbid the field shapes it names), so a second run
finds nothing to do.

Deploy the code first, run this once after: between the two a corrected
entry reads as "new", and nothing is lost.
"""
import argparse
import logging
import sys

import scripts._env  # noqa: F401  -- loads backend/.env before core.db reads DATABASE_URL

from content.vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from content.vocab_renames import KEY_MOVES, MOVES
from core.db import db_conn

logger = logging.getLogger("migrate_vocab_ids")

TABLES_WITH_CARD_IDS = (
    ("cards", "id"),
    ("card_modes", "card_id"),
    ("review_log", "card_id"),
    ("card_first_review", "card_id"),
)

# The scheduler's own columns, merged the way migrate_grammar_ids merges.
_SUMMED = ("total_reviews", "correct_reviews", "lapses")
_STATE = (
    "difficulty", "stability", "interval_days", "repetitions", "lapses",
    "learning_step", "is_learning", "next_review", "total_reviews",
    "correct_reviews", "last_quality",
)


def served_ids() -> frozenset[str]:
    """Every raw vocab id the deck serves today."""
    return frozenset(
        vocab_to_id(entry, level)
        for level, entries in VOCAB_BY_LEVEL.items()
        for entry in entries
    )


def _split(card_id: str) -> tuple[str, str]:
    user_id, _, raw = card_id.partition(":")
    return user_id, raw


def find_card_ids(cur, user: str | None = None) -> list[str]:
    """Every distinct prefixed card id that looks like a vocab card,
    across the four tables. `vocab\\_jmdict\\_%` is a DIFFERENT source with
    its own migration (migrate_jmdict_card_ids.py) and is excluded here."""
    pattern = f"{user}:vocab\\_%" if user else "%:vocab\\_%"
    parts = [
        f"SELECT {col} AS card_id FROM {table} "
        f"WHERE {col} LIKE %(pat)s AND {col} NOT LIKE %(jmdict)s"
        for table, col in TABLES_WITH_CARD_IDS
    ]
    cur.execute(" UNION ".join(parts),
                {"pat": pattern, "jmdict": f"{user}:vocab\\_jmdict\\_%" if user else "%:vocab\\_jmdict\\_%"})
    return sorted(row[0] for row in cur.fetchall())


def classify(card_ids: list[str], served: frozenset[str]) -> dict[str, list[str]]:
    out = {"served": [], "moved": [], "unknown": []}
    for card_id in card_ids:
        _, raw = _split(card_id)
        if raw in MOVES:
            # Checked before `served`: no MOVES key is served (the
            # rename tests hold that), so the order only documents intent.
            out["moved"].append(card_id)
        elif raw in served:
            out["served"].append(card_id)
        else:
            out["unknown"].append(card_id)
    return out


def _merge_modes(cur, old_id: str, new_id: str) -> int:
    """card_modes rows off the old id, onto the new. Returns how many
    were merged into a row the target already had."""
    cur.execute(
        f"SELECT mode, {', '.join(_STATE)} FROM card_modes WHERE card_id = %s",
        (old_id,),
    )
    cols = ["mode", *_STATE]
    old_rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    merged = 0
    for row in old_rows:
        cur.execute(
            f"SELECT {', '.join(_STATE)} FROM card_modes WHERE card_id = %s AND mode = %s",
            (new_id, row["mode"]),
        )
        hit = cur.fetchone()
        if hit is None:
            cur.execute(
                "UPDATE card_modes SET card_id = %s WHERE card_id = %s AND mode = %s",
                (new_id, old_id, row["mode"]),
            )
            continue
        existing = dict(zip(_STATE, hit))
        least = min((row, existing), key=lambda r: (r["interval_days"], r["next_review"]))
        result = dict(least)
        for col in _SUMMED:
            result[col] = row[col] + existing[col]
        cur.execute(
            "UPDATE card_modes SET " + ", ".join(f"{c} = %s" for c in _STATE)
            + " WHERE card_id = %s AND mode = %s",
            (*[result[c] for c in _STATE], new_id, row["mode"]),
        )
        cur.execute("DELETE FROM card_modes WHERE card_id = %s AND mode = %s", (old_id, row["mode"]))
        merged += 1
    return merged


def _move_first_review(cur, old_id: str, new_id: str) -> None:
    cur.execute("SELECT mode, first_at FROM card_first_review WHERE card_id = %s", (old_id,))
    for mode, first_at in cur.fetchall():
        cur.execute(
            "INSERT INTO card_first_review(card_id, mode, first_at) VALUES (%s, %s, %s) "
            "ON CONFLICT (card_id, mode) DO UPDATE SET first_at = LEAST(card_first_review.first_at, EXCLUDED.first_at)",
            (new_id, mode, first_at),
        )
    cur.execute("DELETE FROM card_first_review WHERE card_id = %s", (old_id,))


def rename_card(conn, card_id: str) -> int:
    """One learner's rows for one corrected entry, in one transaction.
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
    """deck_cards rows onto the new raw_id. `level` is untouched: no entry
    changed level. Returns (renamed, dropped): a deck that already held
    the target keeps its row."""
    renamed = dropped = 0
    scope = " AND user_id = %(user)s" if user else ""
    for old, new in MOVES.items():
        params = {"old": old, "new": new, "user": user}
        cur.execute(
            f"""
            UPDATE deck_cards SET raw_id = %(new)s
            WHERE source = 'vocab' AND raw_id = %(old)s{scope}
              AND NOT EXISTS (
                SELECT 1 FROM deck_cards d2
                WHERE d2.deck_id = deck_cards.deck_id AND d2.source = 'vocab' AND d2.raw_id = %(new)s
              )
            """,
            params,
        )
        renamed += cur.rowcount
        cur.execute(f"DELETE FROM deck_cards WHERE source = 'vocab' AND raw_id = %(old)s{scope}", params)
        dropped += cur.rowcount
    return renamed, dropped


def rename_frequency_overrides(cur, user: str | None = None) -> tuple[int, int]:
    """frequency_overrides.item_key onto the corrected deck key. Returns
    (renamed, dropped): a learner who already pinned the target key keeps
    that pin -- it is the one that still resolves to an entry."""
    renamed = dropped = 0
    scope = " AND user_id = %(user)s" if user else ""
    for old, new in KEY_MOVES.items():
        params = {"old": old, "new": new, "user": user}
        cur.execute(
            f"""
            UPDATE frequency_overrides SET item_key = %(new)s
            WHERE domain = 'vocab' AND item_key = %(old)s{scope}
              AND NOT EXISTS (
                SELECT 1 FROM frequency_overrides f2
                WHERE f2.user_id = frequency_overrides.user_id
                  AND f2.domain = 'vocab' AND f2.item_key = %(new)s
              )
            """,
            params,
        )
        renamed += cur.rowcount
        cur.execute(
            f"DELETE FROM frequency_overrides WHERE domain = 'vocab' AND item_key = %(old)s{scope}",
            params,
        )
        dropped += cur.rowcount
    return renamed, dropped


def count_side_table_candidates(cur, user: str | None = None) -> tuple[int, int]:
    scope = " AND user_id = %(user)s" if user else ""
    cur.execute(
        f"SELECT COUNT(*) FROM deck_cards WHERE source = 'vocab' AND raw_id = ANY(%(olds)s){scope}",
        {"olds": list(MOVES), "user": user},
    )
    decks = cur.fetchone()[0]
    cur.execute(
        f"SELECT COUNT(*) FROM frequency_overrides WHERE domain = 'vocab' AND item_key = ANY(%(olds)s){scope}",
        {"olds": list(KEY_MOVES), "user": user},
    )
    pins = cur.fetchone()[0]
    return decks, pins


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    parser.add_argument("--yes", action="store_true", help="apply the renames; without it, report only")
    parser.add_argument("--user", help="limit to one user id")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    served = served_ids()

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            fates = classify(find_card_ids(cur, args.user), served)
            decks, pins = count_side_table_candidates(cur, args.user)
        conn.commit()

        logger.info("vocab card ids: %d served, %d to move, %d unknown (left)",
                    len(fates["served"]), len(fates["moved"]), len(fates["unknown"]))
        for card_id in fates["unknown"]:
            logger.warning("  not in the deck and not in vocab_renames.py, left as is: %s", card_id)
        for card_id in fates["moved"]:
            logger.info("  %s -> %s", card_id, MOVES[_split(card_id)[1]])
        logger.info("deck_cards rows to move: %d; frequency_overrides rows to move: %d", decks, pins)

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
            pins_renamed, pins_dropped = rename_frequency_overrides(cur, args.user)
        conn.commit()
        logger.info("moved %d card id(s) (%d card_modes rows merged into an existing track); "
                    "deck_cards: %d moved, %d dropped as duplicates; "
                    "frequency_overrides: %d moved, %d dropped as duplicates",
                    len(fates["moved"]), merged, renamed, dropped, pins_renamed, pins_dropped)
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
