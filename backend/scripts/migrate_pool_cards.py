"""
Carry a learner's pool card onto the deck card it became (plan 110b).

    python -m scripts.migrate_pool_cards                 # report only, changes nothing
    python -m scripts.migrate_pool_cards --yes           # do it
    python -m scripts.migrate_pool_cards --yes --user U  # one account only

WHY THIS EXISTS
----------------
When the deck gains a word the JMdict pool already held, plan 110's
scripts/prune_pool_overlap.py takes the pool row out and records the
row's id and the deck card it became in datas/vocab/pool_moves.json. A
learner who had studied the word from the pool -- through the 頻度 tiers
or the dictionary -- holds rows under `vocab_jmdict_{id}`, an id that
now resolves to nothing, and would meet the deck card as "new". This
script renames those rows onto the deck card, merging where the learner
already studied it there, exactly as migrate_vocab_ids.py does for a
corrected entry (its merge rule is imported, not copied: effort summed,
the least-advanced schedule kept).

WHAT IT DOES
------------
For every distinct `vocab_jmdict_%` card id in the four tables that
carry one (cards, card_modes, review_log, card_first_review):

  in pool_moves.json -> renamed onto the deck card, one transaction
                        per old id, merging on collision
  still in the pool  -> nothing to do
  in neither         -> reported and left exactly as it is (an id from
                        before the pool was pruned by this method, or
                        the old seq-based scheme migrate_jmdict_card_ids.py
                        handles; never guessed)

Then, once per moved key: frequency_overrides rows pinned under
domain='vocab_jmdict' with the pool key move to domain='vocab' under the
deck's key; a learner who already pinned the deck key keeps that pin.

And the deck links (plan 144): a vocab deck takes a pool word since the
analyser and the dictionary offer every word the app holds, so a
deck_cards row can name `vocab_jmdict_{id}` under routes/decks.POOL_LEVEL.
It moves to the deck card and the level that card's id carries; a deck
that already holds the deck card keeps that row, and the pool one goes.

Idempotent: a renamed id is no longer a `vocab_jmdict_%` id, so a second
run finds nothing. Without --yes nothing is written.
"""
import argparse
import json
import logging
import os
import sys

import scripts._env  # noqa: F401  -- loads backend/.env before core.db reads DATABASE_URL

from content import vocab_jmdict_data as jmdict_db
from core.db import db_conn
from scripts.migrate_vocab_ids import TABLES_WITH_CARD_IDS, _merge_modes, _move_first_review

logger = logging.getLogger("migrate_pool_cards")

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOVES_PATH = os.path.join(_BASE_DIR, "datas", "vocab", "pool_moves.json")


def load_moves() -> dict[str, dict]:
    """pool id (as a string) -> {"card": deck raw id, "key": deck key}."""
    with open(MOVES_PATH, encoding="utf-8") as f:
        return json.load(f)


def _split(card_id: str) -> tuple[str, str]:
    user_id, _, raw = card_id.partition(":")
    return user_id, raw


def pool_id_of(raw: str) -> str | None:
    """'vocab_jmdict_44065' -> '44065'; None for anything else."""
    prefix = "vocab_jmdict_"
    if raw.startswith(prefix) and raw[len(prefix):].isdigit():
        return raw[len(prefix):]
    return None


def find_card_ids(cur, user: str | None = None) -> list[str]:
    pattern = f"{user}:vocab\\_jmdict\\_%" if user else "%:vocab\\_jmdict\\_%"
    parts = [f"SELECT {col} AS card_id FROM {table} WHERE {col} LIKE %(pat)s"
             for table, col in TABLES_WITH_CARD_IDS]
    cur.execute(" UNION ".join(parts), {"pat": pattern})
    return sorted(row[0] for row in cur.fetchall())


def classify(card_ids: list[str], moves: dict[str, dict]) -> dict[str, list[str]]:
    out = {"moved": [], "in_pool": [], "unknown": []}
    for card_id in card_ids:
        pool_id = pool_id_of(_split(card_id)[1])
        if pool_id is None:
            out["unknown"].append(card_id)
        elif pool_id in moves:
            out["moved"].append(card_id)
        elif jmdict_db.get_by_id(int(pool_id)) is not None:
            out["in_pool"].append(card_id)
        else:
            out["unknown"].append(card_id)
    return out


def rename_card(conn, card_id: str, moves: dict[str, dict]) -> int:
    """One learner's rows for one pruned pool word, in one transaction.
    Returns the number of card_modes rows merged rather than renamed."""
    user_id, raw = _split(card_id)
    new_id = f"{user_id}:{moves[pool_id_of(raw)]['card']}"
    with conn.cursor() as cur:
        cur.execute("INSERT INTO cards(id) VALUES (%s) ON CONFLICT (id) DO NOTHING", (new_id,))
        merged = _merge_modes(cur, card_id, new_id)
        cur.execute("DELETE FROM cards WHERE id = %s", (card_id,))
        cur.execute("UPDATE review_log SET card_id = %s WHERE card_id = %s", (new_id, card_id))
        _move_first_review(cur, card_id, new_id)
    conn.commit()
    return merged


def rename_frequency_overrides(cur, moves: dict[str, dict], user: str | None = None) -> tuple[int, int]:
    """Pins under domain='vocab_jmdict' on a pruned word's key move to
    domain='vocab' under the deck's key. The pool key is the row's own
    (kanji, kana); the deck key may pack several readings, which is why
    both are recorded. Returns (moved, dropped as duplicates)."""
    moved = dropped = 0
    scope = " AND user_id = %(user)s" if user else ""
    for entry in moves.values():
        deck_key = entry["key"]
        kanji, _, packed = deck_key.partition("::")
        pool_keys = [f"{kanji}::{r.strip()}" for r in packed.replace(";", "/").split("/") if r.strip()]
        for pool_key in pool_keys:
            params = {"old": pool_key, "new": deck_key, "user": user}
            cur.execute(
                f"""
                UPDATE frequency_overrides SET domain = 'vocab', item_key = %(new)s
                WHERE domain = 'vocab_jmdict' AND item_key = %(old)s{scope}
                  AND NOT EXISTS (
                    SELECT 1 FROM frequency_overrides f2
                    WHERE f2.user_id = frequency_overrides.user_id
                      AND f2.domain = 'vocab' AND f2.item_key = %(new)s
                  )
                """,
                params,
            )
            moved += cur.rowcount
            cur.execute(
                f"DELETE FROM frequency_overrides WHERE domain = 'vocab_jmdict' AND item_key = %(old)s{scope}",
                params,
            )
            dropped += cur.rowcount
    return moved, dropped


def count_pins(cur, moves: dict[str, dict], user: str | None = None) -> int:
    keys = []
    for entry in moves.values():
        kanji, _, packed = entry["key"].partition("::")
        keys += [f"{kanji}::{r.strip()}" for r in packed.replace(";", "/").split("/") if r.strip()]
    if not keys:
        return 0
    scope = " AND user_id = %(user)s" if user else ""
    cur.execute(
        f"SELECT count(*) FROM frequency_overrides WHERE domain = 'vocab_jmdict' AND item_key = ANY(%(keys)s){scope}",
        {"keys": keys, "user": user},
    )
    return cur.fetchone()[0]


def _deck_level(deck_raw_id: str) -> str:
    """'vocab_N5_顔_かお' -> 'N5': a deck card's id carries its level."""
    return deck_raw_id.split("_", 2)[1]


def _linked_pool_ids(cur, moves: dict[str, dict], user: str | None = None) -> list[str]:
    """The moved pool ids some deck links, as `vocab_jmdict_{id}`."""
    scope = " AND user_id = %(user)s" if user else ""
    cur.execute(
        f"SELECT DISTINCT raw_id FROM deck_cards WHERE source = 'vocab' "
        f"AND raw_id = ANY(%(ids)s){scope}",
        {"ids": [f"vocab_jmdict_{pool_id}" for pool_id in moves], "user": user},
    )
    return sorted(row[0] for row in cur.fetchall())


def rename_deck_links(cur, moves: dict[str, dict], user: str | None = None) -> tuple[int, int]:
    """A deck's link to a pruned pool word moves onto the deck card
    (plan 144); a deck already holding the deck card keeps that link and
    the pool one is dropped. `user` scopes to the decks one account
    owns -- deck_cards.user_id is the owner, and a follower reads the
    owner's rows. Returns (moved, dropped as duplicates)."""
    moved = dropped = 0
    scope = " AND user_id = %(user)s" if user else ""
    for raw_id in _linked_pool_ids(cur, moves, user):
        target = moves[pool_id_of(raw_id)]["card"]
        params = {"old": raw_id, "new": target, "level": _deck_level(target), "user": user}
        cur.execute(
            f"""
            UPDATE deck_cards SET raw_id = %(new)s, level = %(level)s
            WHERE source = 'vocab' AND raw_id = %(old)s{scope}
              AND NOT EXISTS (
                SELECT 1 FROM deck_cards d2
                WHERE d2.deck_id = deck_cards.deck_id AND d2.source = 'vocab' AND d2.raw_id = %(new)s
              )
            """,
            params,
        )
        moved += cur.rowcount
        cur.execute(f"DELETE FROM deck_cards WHERE source = 'vocab' AND raw_id = %(old)s{scope}", params)
        dropped += cur.rowcount
    return moved, dropped


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    parser.add_argument("--yes", action="store_true", help="apply the renames; without it, report only")
    parser.add_argument("--user", help="limit to one user id")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    moves = load_moves()

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            fates = classify(find_card_ids(cur, args.user), moves)
            pins = count_pins(cur, moves, args.user)
            links = _linked_pool_ids(cur, moves, args.user)
        conn.commit()

        logger.info("pool card ids: %d to move, %d still in the pool, %d unknown (left)",
                    len(fates["moved"]), len(fates["in_pool"]), len(fates["unknown"]))
        for card_id in fates["unknown"]:
            logger.warning("  neither in the pool nor in pool_moves.json, left as is: %s", card_id)
        for card_id in fates["moved"]:
            logger.info("  %s -> %s", card_id, moves[pool_id_of(_split(card_id)[1])]["card"])
        logger.info("frequency_overrides rows to move: %d", pins)
        logger.info("pool words linked from a deck, to move: %d", len(links))

        if not args.yes:
            logger.info("dry run -- nothing written. Re-run with --yes to apply.")
            return 0

        merged = 0
        for card_id in fates["moved"]:
            try:
                merged += rename_card(conn, card_id, moves)
            except Exception:
                conn.rollback()
                logger.exception("failed renaming %s; rolled back, continuing", card_id)
        with conn.cursor() as cur:
            pins_moved, pins_dropped = rename_frequency_overrides(cur, moves, args.user)
            links_moved, links_dropped = rename_deck_links(cur, moves, args.user)
        conn.commit()
        logger.info("moved %d card id(s) (%d card_modes rows merged into an existing track); "
                    "frequency_overrides: %d moved, %d dropped as duplicates; "
                    "deck links: %d moved, %d dropped as duplicates",
                    len(fates["moved"]), merged, pins_moved, pins_dropped, links_moved, links_dropped)
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
