"""
One-time production migration: rewrites every SRS card id built from a
JMdict entry's `seq` (the old, colliding scheme — see the CARD-ID SCHEME
note in vocab_jmdict_data.py) to use its `id` (unique per row) instead.

WHY THIS EXISTS
----------------
vocab_jmdict_to_id() used to return f"vocab_jmdict_{entry['seq']}". seq
is the JMdict sequence number, and it is NOT unique per kanji/kana pair:
781 rows across 290 seq groups (out of 212,460 entries in the shipped
vocab_jmdict.sqlite3) share a seq with at least one other entry — e.g.
seq=1063550 covers both シングルス ("singles (tennis)") and シングルズ
("single people"). Two different words collided onto the same SRS card
id, and studying one silently advanced the other's progress too.

The fix (see vocab_jmdict_data.py) switches to entry['id'], the row's
own primary key — unique by construction. That is a code-only change
for every NEW review from here on, but it orphans progress already
recorded under the old seq-based id: a returning user who open a word
they'd studied before would see it as "new" again, because nothing in
the database is keyed under the id the new code now looks for. This
script is what closes that gap, by renaming the existing rows instead
of leaving them behind.

WHAT IT DOES
------------
Old-scheme card ids look like "{user_id}:vocab_jmdict_{seq}", with seq
always a 7-digit JMdict sequence number (empirically 1,000,000-9,999,999
in the shipped data). New-scheme ids use `id`, always in [0, 212,459]
for this dataset. Those ranges don't overlap, so "is the numeric suffix
>= SEQ_FLOOR" is a reliable, self-contained way to tell old rows from
already-migrated ones — which is also what makes this script idempotent:
run it again after it's already applied, or after it's renamed some
rows and been interrupted, and it simply finds nothing left to do.

For every distinct old-scheme card id found (scanning cards.id,
card_modes.card_id, and review_log.card_id, since review_log has no FK
to cards and can outlive a deleted card):

  1. Look up every entries.id sharing that seq in the local
     vocab_jmdict.sqlite3 (the same file get_by_id()/vocab_jmdict_to_id()
     read from). If the seq isn't found at all (JMdict data drift since
     the card was issued), the row is left untouched and reported —
     leaving it exactly as broken as it already was, rather than
     guessing.
  2. Pick the lowest id in that group as the single canonical target.
     A seq shared by N words collapsed to ONE existing row under the old
     scheme (the collision itself), so there is only ever one row to
     rename — never N to create. The other word(s) sharing that seq
     simply start fresh under the new scheme; there's no way to know,
     after the fact, which of them the user's history actually
     belonged to, and duplicating the row across all N would inflate
     account-wide aggregates that count these rows directly
     (SRSEngine.get_total_reviews() is COUNT(*) on review_log,
     get_mastered_count() is COUNT(*) on card_modes) — silently wrong
     stats are worse than one ambiguous card resolving to a specific
     word instead of two.
  3. Rename cards/card_modes/review_log rows old id -> new id. The
     order matters, and not because a wrong order raises an error: the
     FK is ON DELETE CASCADE, which means deleting the old cards row
     while a card_modes row still points at it does not fail loudly —
     it silently cascades the delete and destroys that progress
     (verified: deleting the parent first drops the child row with no
     error at all). So children must be repointed to the new parent
     BEFORE the old parent is removed, never after:
       a. INSERT the new cards row (ON CONFLICT DO NOTHING — a second
          old id from the same seq group, or a second run, may have
          already created it).
       b. UPDATE card_modes to point at the new id (now safe: the new
          parent row exists, and the old one still does too, so
          nothing cascades yet).
       c. DELETE the old cards row (now safe: no card_modes row
          references it anymore, so the cascade has nothing to do).
       d. UPDATE review_log to point at the new id (no FK on this
          table at all, safe at any point in the sequence, but kept
          last for readability).
     Each old id's rename runs in its own transaction, so an interrupted
     run leaves already-renamed rows renamed and just resumes on rerun.

USAGE
-----
    python scripts/migrate_jmdict_card_ids.py            # dry run, reports only
    python scripts/migrate_jmdict_card_ids.py --apply    # actually renames

Requires DATABASE_URL in the environment (same variable srs_instance.py
reads) pointing at the real production database — there is nothing to
migrate in a fresh/local one.
"""
import argparse
import collections
import logging
import os
import sqlite3
import sys

import psycopg2

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("migrate_jmdict_card_ids")

_BASE_DIR = os.path.dirname(os.path.dirname(__file__))  # backend/
_JMDICT_DB_PATH = os.path.join(_BASE_DIR, "datas", "vocab", "vocab_jmdict.sqlite3")

# entries.id is a dense row index (0..212,459 in the shipped data);
# entries.seq is a real JMdict sequence number, always >= 1,000,000 in
# that same data. Anything at or above this floor is unambiguously an
# old-scheme (seq-based) suffix, never an id — see module docstring.
SEQ_FLOOR = 1_000_000

PREFIX = "vocab_jmdict_"


def _build_seq_groups(db_path: str) -> dict[int, list[int]]:
    """seq -> every entries.id sharing that seq. A group of size 1 is
    the common case (no collision); size > 1 is exactly the 290 groups
    the module docstring measures. Kept as the full list (not
    pre-reduced to just the canonical id) so callers can report group
    size for the collision cases, not just silently pick a winner."""
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        groups: dict[int, list[int]] = collections.defaultdict(list)
        for entry_id, seq in conn.execute("SELECT id, seq FROM entries"):
            groups[seq].append(entry_id)
    finally:
        conn.close()
    return groups


def _find_old_scheme_card_ids(cur) -> list[str]:
    """Every distinct card_id anywhere in the schema whose suffix is
    still seq-based (see SEQ_FLOOR). Scans cards/card_modes/review_log
    independently rather than trusting any one of them alone, since
    review_log rows can survive a card being deleted from the other two."""
    cur.execute(
        """
        SELECT id AS card_id FROM cards WHERE id LIKE %(pat)s
        UNION
        SELECT card_id FROM card_modes WHERE card_id LIKE %(pat)s
        UNION
        SELECT card_id FROM review_log WHERE card_id LIKE %(pat)s
        """,
        {"pat": f"%:{PREFIX}%"},
    )
    return [row[0] for row in cur.fetchall()]


def _parse_old_card_id(card_id: str) -> tuple[str, int] | None:
    """(user_id, seq) if `card_id` is an old-scheme JMdict card id,
    else None (already migrated, or not a JMdict card id at all —
    the broad LIKE pattern in _find_old_scheme_card_ids can match
    either)."""
    user_id, _, raw_id = card_id.partition(":")
    if not raw_id.startswith(PREFIX):
        return None
    suffix = raw_id[len(PREFIX):]
    try:
        n = int(suffix)
    except ValueError:
        return None
    if n < SEQ_FLOOR:
        return None  # already a new-scheme id, not a seq
    return user_id, n


def migrate(database_url: str, apply: bool) -> None:
    if not os.path.exists(_JMDICT_DB_PATH):
        logger.error("JMdict database not found at %s", _JMDICT_DB_PATH)
        sys.exit(1)

    logger.info("Loading seq -> id groups from %s ...", _JMDICT_DB_PATH)
    seq_groups = _build_seq_groups(_JMDICT_DB_PATH)
    logger.info(
        "Loaded %d distinct seq values (%d in a collision group of size > 1).",
        len(seq_groups), sum(1 for ids in seq_groups.values() if len(ids) > 1),
    )

    conn = psycopg2.connect(database_url)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            old_card_ids = _find_old_scheme_card_ids(cur)
        conn.commit()  # release the read transaction before the per-row work below

        logger.info("Found %d old-scheme JMdict card id(s) to inspect.", len(old_card_ids))

        renamed = 0
        unknown_seq = 0
        collision_groups_touched = set()

        for card_id in old_card_ids:
            parsed = _parse_old_card_id(card_id)
            if parsed is None:
                continue
            user_id, seq = parsed

            group = seq_groups.get(seq)
            if not group:
                unknown_seq += 1
                logger.warning(
                    "seq=%s (card_id=%s) not found in vocab_jmdict.sqlite3 — "
                    "leaving this row untouched.",
                    seq, card_id,
                )
                continue

            canonical_id = min(group)
            group_size = len(group)
            new_raw_id = f"{PREFIX}{canonical_id}"
            new_card_id = f"{user_id}:{new_raw_id}"

            if new_card_id == card_id:
                # Only possible if seq == canonical_id, which SEQ_FLOOR
                # already rules out — kept as a defensive no-op guard.
                continue

            logger.info("%s -> %s%s", card_id, new_card_id,
                        "  (collision group)" if group_size > 1 else "")
            if group_size > 1:
                collision_groups_touched.add(seq)

            if not apply:
                renamed += 1
                continue

            try:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO cards(id) VALUES (%s) ON CONFLICT (id) DO NOTHING",
                        (new_card_id,),
                    )
                    cur.execute(
                        "UPDATE card_modes SET card_id = %s WHERE card_id = %s",
                        (new_card_id, card_id),
                    )
                    cur.execute(
                        "DELETE FROM cards WHERE id = %s",
                        (card_id,),
                    )
                    cur.execute(
                        "UPDATE review_log SET card_id = %s WHERE card_id = %s",
                        (new_card_id, card_id),
                    )
                conn.commit()
                renamed += 1
            except Exception:
                conn.rollback()
                logger.exception("Failed renaming %s -> %s; rolled back, continuing.",
                                  card_id, new_card_id)

        logger.info(
            "%s %d card id(s) (%d of them for a seq that was a collision group), "
            "%d skipped (seq not found in vocab_jmdict.sqlite3).",
            "Renamed" if apply else "Would rename",
            renamed, len(collision_groups_touched), unknown_seq,
        )
        if not apply:
            logger.info("Dry run only — no changes written. Re-run with --apply to migrate.")
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply", action="store_true",
        help="Actually write the renames. Without this, only reports what would happen.",
    )
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        logger.error("DATABASE_URL is not set.")
        sys.exit(1)

    migrate(database_url, apply=args.apply)


if __name__ == "__main__":
    main()
