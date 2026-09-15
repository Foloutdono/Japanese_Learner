"""
Rename the learner rows of every grammar point the catalogue moved
(plan 087).

    python -m scripts.migrate_grammar_ids                 # report only, changes nothing
    python -m scripts.migrate_grammar_ids --yes           # do it
    python -m scripts.migrate_grammar_ids --yes --user U  # one account only

WHY THIS EXISTS
----------------
A grammar card id is `grammar_{level}_{pattern}`: the pattern text and
the level a point is filed under are part of the learner's progress.
Re-evaluating the catalogue moves some points to the level the modern
syllabus files them at, renames a few, and folds a few into a
neighbour. content/grammar/renames.py records each of those as
MOVES (old id -> new id) or RETIRED (old id, nothing stands in for it),
and tests/test_grammar_points.py holds every id the catalogue ever
served to one of the three fates -- kept, moved, retired. This script
is the moved half: it renames the rows so a returning learner finds
their progress under the point's new name instead of a "new" card.

WHAT IT DOES
------------
For every distinct grammar card id in the four tables that carry one
(cards, card_modes, review_log, card_first_review -- review_log has no
FK and can outlive a deleted card, so each table is scanned):

  served    -> nothing to do
  in MOVES  -> renamed, in one transaction per old id, FK-safe:
               a. INSERT the new cards row (ON CONFLICT DO NOTHING)
               b. card_modes: UPDATE the old row onto the new id, or,
                  when the learner already studied the target point in
                  that mode, MERGE the two rows -- effort summed
                  (total_reviews, correct_reviews, lapses), the
                  least-advanced schedule kept (smallest interval, then
                  earliest next_review), exactly migrate_legacy_modes.py's
                  rule, for its reason: a merge that took the furthest
                  schedule would re-inflate mastery
               c. DELETE the old cards row (nothing references it now,
                  so the ON DELETE CASCADE has nothing to do -- the order
                  matters, see migrate_jmdict_card_ids.py)
               d. review_log: UPDATE onto the new id
               e. card_first_review: UPDATE, or keep the earlier first_at
  in RETIRED-> reported and left exactly as it is
  unknown   -> reported and left exactly as it is (content drift since
               the row was written; never guess)

Then, once per moved id rather than per learner:

  deck_cards (source = 'grammar')   raw_id AND level are rewritten -- a
               deck row names the level the point lives under, and
               routes/decks._linked_entry re-checks it. The primary key
               is (deck_id, source, raw_id), so a deck that already
               holds the target keeps its row and the old one is
               dropped.
  comprehension_log.grammar          a JSON list of PATTERN texts, not
               ids (plan 084): a renamed pattern is rewritten in every
               list that names it; a pure level move changes nothing.

Left alone, and why: xp_ledger.ref and credit_ledger.ref hold card ids
as receipts -- every reader SUMs the ledger and none joins on ref -- so
a stale ref changes no figure a learner sees.

Idempotent by construction: after a run no moved id exists in any
scanned table, and a MOVES key can never re-enter the catalogue (the
stability test forbids it), so a second run finds nothing to do.

Deploy the code first, run this once after: between the two a moved
point reads as "new", and nothing is lost.
"""
import argparse
import json
import logging
import sys

import scripts._env  # noqa: F401  -- loads backend/.env before core.db reads DATABASE_URL

from content.grammar.renames import MOVES, RETIRED, pattern_renames
from content.grammar_points_data import all_ids
from core.db import db_conn

logger = logging.getLogger("migrate_grammar_ids")

TABLES_WITH_CARD_IDS = (
    ("cards", "id"),
    ("card_modes", "card_id"),
    ("review_log", "card_id"),
    ("card_first_review", "card_id"),
)

# The scheduler's own columns, merged the way migrate_legacy_modes merges.
_SUMMED = ("total_reviews", "correct_reviews", "lapses")
_STATE = (
    "difficulty", "stability", "interval_days", "repetitions", "lapses",
    "learning_step", "is_learning", "next_review", "total_reviews",
    "correct_reviews", "last_quality",
)


def _split(card_id: str) -> tuple[str, str]:
    user_id, _, raw = card_id.partition(":")
    return user_id, raw


def _level_of(raw_id: str) -> str:
    return raw_id.split("_", 2)[1]


def find_card_ids(cur, user: str | None = None) -> list[str]:
    """Every distinct prefixed card id that looks like a grammar card,
    across the four tables."""
    pattern = f"{user}:grammar\\_%" if user else "%:grammar\\_%"
    parts = [f"SELECT {col} AS card_id FROM {table} WHERE {col} LIKE %(pat)s" for table, col in TABLES_WITH_CARD_IDS]
    cur.execute(" UNION ".join(parts), {"pat": pattern})
    return sorted(row[0] for row in cur.fetchall())


def classify(card_ids: list[str], served: frozenset[str]) -> dict[str, list[str]]:
    out = {"served": [], "moved": [], "retired": [], "unknown": []}
    for card_id in card_ids:
        _, raw = _split(card_id)
        if raw in served:
            out["served"].append(card_id)
        elif raw in MOVES:
            out["moved"].append(card_id)
        elif raw in RETIRED:
            out["retired"].append(card_id)
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
    """One learner's rows for one moved point, in one transaction.
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
    """deck_cards rows onto the new raw_id and level. Returns (renamed,
    dropped): a deck that already held the target keeps its row."""
    renamed = dropped = 0
    scope = " AND user_id = %(user)s" if user else ""
    for old, new in MOVES.items():
        params = {"old": old, "new": new, "level": _level_of(new), "user": user}
        cur.execute(
            f"""
            UPDATE deck_cards SET raw_id = %(new)s, level = %(level)s
            WHERE source = 'grammar' AND raw_id = %(old)s{scope}
              AND NOT EXISTS (
                SELECT 1 FROM deck_cards d2
                WHERE d2.deck_id = deck_cards.deck_id AND d2.source = 'grammar' AND d2.raw_id = %(new)s
              )
            """,
            params,
        )
        renamed += cur.rowcount
        cur.execute(f"DELETE FROM deck_cards WHERE source = 'grammar' AND raw_id = %(old)s{scope}", params)
        dropped += cur.rowcount
    return renamed, dropped


def rewrite_comprehension_log(cur, user: str | None = None) -> int:
    """comprehension_log.grammar lists pattern texts; a renamed pattern
    is rewritten wherever it is named."""
    renames = pattern_renames()
    if not renames:
        return 0
    scope = " AND user_id = %(user)s" if user else ""
    cur.execute(
        f"SELECT id, grammar FROM comprehension_log WHERE grammar ?| %(olds)s{scope}",
        {"olds": list(renames), "user": user},
    )
    rows = cur.fetchall()
    for row_id, patterns in rows:
        new_list = [renames.get(p, p) for p in patterns]
        cur.execute("UPDATE comprehension_log SET grammar = %s::jsonb WHERE id = %s", (json.dumps(new_list, ensure_ascii=False), row_id))
    return len(rows)


def count_deck_and_log_candidates(cur, user: str | None = None) -> tuple[int, int]:
    scope = " AND user_id = %(user)s" if user else ""
    cur.execute(
        f"SELECT COUNT(*) FROM deck_cards WHERE source = 'grammar' AND raw_id = ANY(%(olds)s){scope}",
        {"olds": list(MOVES), "user": user},
    )
    decks = cur.fetchone()[0]
    renames = pattern_renames()
    logs = 0
    if renames:
        cur.execute(
            f"SELECT COUNT(*) FROM comprehension_log WHERE grammar ?| %(olds)s{scope}",
            {"olds": list(renames), "user": user},
        )
        logs = cur.fetchone()[0]
    return decks, logs


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    parser.add_argument("--yes", action="store_true", help="apply the renames; without it, report only")
    parser.add_argument("--user", help="limit to one user id")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    served = all_ids()

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            fates = classify(find_card_ids(cur, args.user), served)
            decks, logs = count_deck_and_log_candidates(cur, args.user)
        conn.commit()

        logger.info("grammar card ids: %d served, %d to move, %d retired (left), %d unknown (left)",
                    len(fates["served"]), len(fates["moved"]), len(fates["retired"]), len(fates["unknown"]))
        for card_id in fates["retired"]:
            logger.info("  retired, left as is: %s", card_id)
        for card_id in fates["unknown"]:
            logger.warning("  not in the catalogue and not in renames.py, left as is: %s", card_id)
        for card_id in fates["moved"]:
            logger.info("  %s -> %s", card_id, MOVES[_split(card_id)[1]])
        logger.info("deck_cards rows to move: %d; comprehension_log rows to rewrite: %d", decks, logs)

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
            rewritten = rewrite_comprehension_log(cur, args.user)
        conn.commit()
        logger.info("moved %d card id(s) (%d card_modes rows merged into an existing track); "
                    "deck_cards: %d moved, %d dropped as duplicates; comprehension_log: %d rewritten",
                    len(fates["moved"]), merged, renamed, dropped, rewritten)
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
