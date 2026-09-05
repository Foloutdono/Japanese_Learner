"""
One-time production migration: rewrites SRS rows still keyed under the
pre-2026-08 quiz-mode names onto the current study-mode registry.

WHY THIS EXISTS
----------------
study/modes.py replaced study/quiz_modes.py (commit 3b5f9eb6, "study-mode
registry with per-source validation"). The old key space was:

    QCM_FLASHCARD_MODES = {"qcm-kj-m", "qcm-m-kj",
                           "flashcard-kj-m", "flashcard-m-kj"}
    KANA_MODES    = ["qcm", "flashcard", "write"]
    KANJI_MODES   = QCM_FLASHCARD_MODES + ["write"]
    GRAMMAR_MODES = ["flashcard", "mcq", "fill"]

A LEGACY_ALIASES table translated those keys at lookup time, and it was
dropped in commit 90366215 ("LEGACY_ALIASES dropped (phase 7)") on the
reasoning that "a permanent alias table would quietly keep the old
ambiguity". What was never written is the other half: nothing ever
rewrote the ROWS. `git log -S"UPDATE card_modes"` finds no migration.

So on any database that predates the rework, card_modes and review_log
still hold rows under keys nothing reads. Those rows have been invisible
to /api/stats since the rework (card_index.locate() returns None for an
unregistered mode, and the per-section loop skips it) while still being
counted by the whole-account aggregates -- and now that those aggregates
are filtered to registered modes too (SRSEngine._servable_filter), they
count nowhere at all. A learner's mastery count and interval ladder
would silently drop by whatever share of their history sits under an
old key.

This script closes that gap by renaming the rows, so the progress is
restored rather than hidden.

WHAT IT DOES
------------
The old key alone is ambiguous -- "write" is kana's or kanji's, and
"flashcard" is kana's, grammar's or a personal card's -- so the mapping
is keyed (source, old_key), exactly as LEGACY_ALIASES was. The source
comes from the card id's own category prefix -- a card's category is
the first underscore-token of its raw id:

    kana_...            -> kana
    kanji_{level}_...   -> kanji
    vocab_{level}_...   -> vocab      (vocab_jmdict_... too)
    grammar_{level}_... -> grammar
    custom_{deck}_...   -> that deck's structure (decks.structure:
                           standard | kanji | vocab | grammar)

Anything that does not resolve to a (source, old_key) pair in the table
is REPORTED AND LEFT ALONE. That includes:

  * `sentence.reading` / `sentence.translation`. These are current, and
    deliberately outside the registry (see routes/reading.py's SRS_MODE
    note) -- they are not legacy and must never be rewritten. The script
    would otherwise mistake "not in SRS_MODES" for "old".
  * a key the alias table never covered, or a custom card whose deck is
    gone. Guessing a mode is worse than leaving a row unread: the wrong
    guess silently advances a schedule the learner never earned.

COLLISIONS
----------
Two old keys can map onto one new key -- `qcm-kj-m` and
`flashcard-kj-m` both become `vocab.flashcard.f2b`, which is the point
of the rework ("they were one exercise at two help levels, and the help
level is now indice_1"). The target row may also already exist, from
studying after the rework. So this is a merge, not a rename:

  effort counters   summed (total_reviews, correct_reviews, lapses) --
                    all of it really happened
  schedule          taken from the LEAST advanced row (smallest
                    interval_days, then earliest next_review)

The conservative direction is deliberate. Taking the furthest-along row
would let a card mastered in the easy MCQ variant arrive "mastered"
outright, re-inflating the very counts this migration exists to make
honest. Taking the least advanced costs the learner one early review of
something they may know well; the other direction costs them a true
mastery number. Cheap beats wrong.

USAGE
-----
    python scripts/migrate_legacy_modes.py             # dry run, reports only
    python scripts/migrate_legacy_modes.py --apply     # actually rewrites
    python scripts/migrate_legacy_modes.py --user U    # one account only

Requires DATABASE_URL in the environment (the same variable
srs_instance.py reads). Idempotent: once applied there are no rows left
under an old key, so a second run finds nothing to do. Each card is
rewritten in its own transaction, so an interrupted run leaves the cards
it already finished finished, and resumes on the next run.
"""
import argparse
import collections
import logging
import os
import sys

import psycopg2

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from study.modes import (  # noqa: E402
    SRS_MODES, KANA, KANJI, VOCAB, GRAMMAR, STANDARD,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("migrate_legacy_modes")


# The mapping, reproduced verbatim from the LEGACY_ALIASES table dropped
# in commit 90366215 -- `git show 90366215 -- study/modes.py` to compare.
# Not re-derived: the old keys are gone from the codebase, and the alias
# table is the only surviving statement of what each one meant.
LEGACY_ALIASES: dict[tuple[str, str], str] = {
    (KANA, "qcm"): "kana.flashcard.f2b",
    (KANA, "flashcard"): "kana.flashcard.f2b",
    (KANA, "write"): "kana.write_kana",

    (KANJI, "qcm-kj-m"): "kanji.flashcard.f2b",
    (KANJI, "flashcard-kj-m"): "kanji.flashcard.f2b",
    (KANJI, "qcm-m-kj"): "kanji.flashcard.b2f",
    (KANJI, "flashcard-m-kj"): "kanji.flashcard.b2f",
    (KANJI, "write"): "kanji.write_kanji",

    (VOCAB, "qcm-kj-m"): "vocab.flashcard.f2b",
    (VOCAB, "flashcard-kj-m"): "vocab.flashcard.f2b",
    (VOCAB, "qcm-m-kj"): "vocab.flashcard.b2f",
    (VOCAB, "flashcard-m-kj"): "vocab.flashcard.b2f",

    (GRAMMAR, "flashcard"): "grammar.flashcard.f2b",
    (GRAMMAR, "mcq"): "grammar.flashcard.f2b",
    (GRAMMAR, "fill"): "grammar.fill_in",

    (STANDARD, "flashcard"): "standard.flashcard.f2b",
}

# Card-id category -> mode source. A personal card is not here: its
# source is its deck's structure, looked up per card.
CATEGORY_SOURCE = {
    "kana": KANA,
    "kanji": KANJI,
    "vocab": VOCAB,
    "grammar": GRAMMAR,
}

PERSONAL = "custom"

# A deck structure IS a mode source, with the same names -- except that
# 'standard' is spelled the same in both. Kept explicit so a new
# structure has to be considered here rather than silently falling
# through to a wrong source.
STRUCTURE_SOURCE = {
    "standard": STANDARD,
    "kanji": KANJI,
    "vocab": VOCAB,
    "grammar": GRAMMAR,
}

# Modes that are unregistered ON PURPOSE and are NOT legacy. The reading
# and translation screens schedule a vocabulary card under these; see
# routes/reading.py's SRS_MODE comment. Excluded by prefix rather than
# by name so a third sentence mode does not have to remember to come
# back and edit this.
CURRENT_UNREGISTERED_PREFIX = "sentence."

# The 13 columns of card_modes, in table order.
STATE_COLUMNS = (
    "difficulty", "stability", "interval_days", "repetitions", "lapses",
    "learning_step", "is_learning", "next_review", "total_reviews",
    "correct_reviews", "last_quality",
)


def _unprefixed(card_id: str) -> str:
    """Strip the '{user_id}:' namespace. A user id cannot contain ':'
    (core/auth.py builds the prefix from it), so the first colon is the
    separator."""
    _, _, raw = card_id.partition(":")
    return raw


def _deck_structures(cur) -> dict[str, str]:
    """deck id (as text) -> structure. One query rather than one per
    personal card; a user with a few hundred cards across a handful of
    decks would otherwise do a few hundred round trips.

    Reads whichever column the database actually has. A database old
    enough to hold legacy mode keys may well predate the deck-structures
    phase too -- `structure` is added by routes/decks.py at import, so a
    standalone run of this script against an untouched dump finds only
    the original `type` column, and against a very old one, neither.
    `type`'s legacy 'mixed' value maps to nothing on purpose: a mixed
    deck could hold cards of several sources, so its personal cards are
    exactly the ambiguous case this script refuses to guess at.
    """
    cur.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'decks' AND column_name IN ('structure', 'type')
        """
    )
    available = {row[0] for row in cur.fetchall()}
    column = "structure" if "structure" in available else ("type" if "type" in available else None)
    if column is None:
        logger.warning(
            "decks has neither a `structure` nor a `type` column -- "
            "personal cards cannot be resolved and will be reported, not moved"
        )
        return {}
    cur.execute(f"SELECT id::text, {column} FROM decks")
    return dict(cur.fetchall())


def _source_for(raw_id: str, structures: dict[str, str]) -> str | None:
    """The mode source a card belongs to, or None if it cannot be told.

    None is a real answer here, not a failure to try: a personal card
    whose deck has been deleted has no structure to read, and its old
    mode key ('flashcard') is ambiguous between standard and grammar.
    """
    category, _, rest = raw_id.partition("_")
    if category in CATEGORY_SOURCE:
        return CATEGORY_SOURCE[category]
    if category == PERSONAL:
        deck_id, _, _ = rest.partition("_")
        structure = structures.get(deck_id)
        return STRUCTURE_SOURCE.get(structure) if structure else None
    return None


def _legacy_rows(cur, user: str | None):
    """Every card_modes row under a mode that is not in the registry.

    Read from card_modes rather than from a list of known old keys, so a
    key the alias table never covered still shows up in the report
    instead of sitting there unnoticed.
    """
    sql = """
        SELECT card_id, mode, difficulty, stability, interval_days,
               repetitions, lapses, learning_step, is_learning,
               next_review, total_reviews, correct_reviews, last_quality
        FROM card_modes
        WHERE NOT (mode = ANY(%s))
    """
    params: list = [sorted(SRS_MODES)]
    if user is not None:
        sql += " AND card_id LIKE %s"
        params.append(f"{user}:%")
    cur.execute(sql, params)
    cols = ["card_id", "mode"] + list(STATE_COLUMNS)
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def _merge(rows: list[dict]) -> dict:
    """One card_modes row from several that now share a mode.

    Effort is summed because all of it happened; the schedule is taken
    from the least advanced row. See COLLISIONS in the module docstring
    for why that direction.
    """
    least = min(rows, key=lambda r: (r["interval_days"], r["next_review"]))
    merged = dict(least)
    merged["total_reviews"] = sum(r["total_reviews"] for r in rows)
    merged["correct_reviews"] = sum(r["correct_reviews"] for r in rows)
    merged["lapses"] = sum(r["lapses"] for r in rows)
    return merged


def _plan(rows: list[dict], structures: dict[str, str]):
    """(targets, skipped) -- what each card becomes, and what is left.

    targets: card_id -> {new_mode: [source rows]}
    skipped: list of (card_id, mode, reason)
    """
    targets: dict[str, dict[str, list[dict]]] = collections.defaultdict(
        lambda: collections.defaultdict(list)
    )
    skipped = []
    for row in rows:
        mode = row["mode"]
        if mode.startswith(CURRENT_UNREGISTERED_PREFIX):
            skipped.append((row["card_id"], mode, "current, deliberately unregistered"))
            continue
        source = _source_for(_unprefixed(row["card_id"]), structures)
        if source is None:
            skipped.append((row["card_id"], mode, "cannot tell which source this card belongs to"))
            continue
        new_mode = LEGACY_ALIASES.get((source, mode))
        if new_mode is None:
            skipped.append((row["card_id"], mode, f"no alias for ({source}, {mode})"))
            continue
        targets[row["card_id"]][new_mode].append(row)
    return targets, skipped


def _existing(cur, card_id: str, modes: list[str]) -> list[dict]:
    """Rows already sitting on the target modes, which the merge has to
    absorb rather than overwrite -- a learner who studied the same card
    after the rework has real progress under the new key."""
    cur.execute(
        f"""
        SELECT card_id, mode, {", ".join(STATE_COLUMNS)}
        FROM card_modes WHERE card_id = %s AND mode = ANY(%s)
        """,
        (card_id, modes),
    )
    cols = ["card_id", "mode"] + list(STATE_COLUMNS)
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def _apply_card(cur, card_id: str, by_mode: dict[str, list[dict]]) -> None:
    """Rewrite one card's rows, inside the caller's transaction.

    Delete-then-insert rather than UPDATE: two old rows can collapse
    onto one new one, so there is not always a row-for-row rename to
    make, and the primary key (card_id, mode) would collide half way
    through if there were.
    """
    old_modes = [r["mode"] for rows in by_mode.values() for r in rows]
    for new_mode, rows in by_mode.items():
        merged = _merge(rows + _existing(cur, card_id, [new_mode]))
        cur.execute(
            "DELETE FROM card_modes WHERE card_id = %s AND mode = ANY(%s)",
            (card_id, old_modes + [new_mode]),
        )
        cols = ", ".join(STATE_COLUMNS)
        placeholders = ", ".join(["%s"] * len(STATE_COLUMNS))
        cur.execute(
            f"INSERT INTO card_modes (card_id, mode, {cols}) "
            f"VALUES (%s, %s, {placeholders})",
            (card_id, new_mode, *[merged[c] for c in STATE_COLUMNS]),
        )
        # The history moves with the schedule, so accuracy trends and the
        # daily-new budget (both read review_log) see the reviews again.
        # No unique constraint here, so a plain UPDATE is enough.
        cur.execute(
            "UPDATE review_log SET mode = %s WHERE card_id = %s AND mode = ANY(%s)",
            (new_mode, card_id, [r["mode"] for r in rows]),
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    parser.add_argument("--apply", action="store_true",
                        help="actually rewrite (default is a dry run)")
    parser.add_argument("--user", help="limit to one user id")
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        logger.error("DATABASE_URL is not set")
        return 2

    conn = psycopg2.connect(database_url)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            structures = _deck_structures(cur)
            rows = _legacy_rows(cur, args.user)
        conn.rollback()

        if not rows:
            logger.info("nothing to do: every card_modes row is on a registered mode")
            return 0

        targets, skipped = _plan(rows, structures)

        counts = collections.Counter(
            (r["mode"],) for r in rows
        )
        logger.info("found %d row(s) under %d unregistered mode(s):", len(rows), len(counts))
        for (mode,), n in sorted(counts.items()):
            logger.info("    %-24s %d", mode, n)

        moving = sum(len(rs) for by_mode in targets.values() for rs in by_mode.values())
        logger.info("%d row(s) on %d card(s) will be rewritten", moving, len(targets))
        merges = [(c, m, len(rs)) for c, by in targets.items()
                  for m, rs in by.items() if len(rs) > 1]
        for card_id, mode, n in merges:
            logger.info("    merge %d rows -> %s on %s", n, mode, card_id)
        if skipped:
            logger.warning("%d row(s) left untouched:", len(skipped))
            for card_id, mode, reason in skipped[:50]:
                logger.warning("    %-24s %-40s %s", mode, card_id, reason)
            if len(skipped) > 50:
                logger.warning("    ... and %d more", len(skipped) - 50)

        if not args.apply:
            logger.info("dry run -- nothing written. Re-run with --apply.")
            return 0

        done = 0
        for card_id, by_mode in targets.items():
            try:
                with conn.cursor() as cur:
                    _apply_card(cur, card_id, by_mode)
                conn.commit()
                done += 1
            except Exception:
                conn.rollback()
                logger.exception("failed on %s -- rolled back that card, continuing", card_id)
        logger.info("rewrote %d of %d card(s)", done, len(targets))
        return 0 if done == len(targets) else 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
