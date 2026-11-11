"""
Give the accounts that boarded before plan 247b the handle their card name spells.

    python -m scripts.migrate_handles                    # report only, changes nothing
    python -m scripts.migrate_handles --yes              # do it
    python -m scripts.migrate_handles --yes --user U     # one account only (repeatable)

WHY THIS EXISTS
----------------
Plan 247 split the card's name from the username: the boarding asked for
a first name, and the username stayed the handle the app drew
(LuckyNinja6569). Plan 247b makes the first boarding's name the username
too, but only at the boarding, so every account that boarded before the
deploy that carries it still wears a drawn handle beside a name on its
card. This brings them in line with the accounts that board after.

WHAT IT DOES
------------
For every account with a name on its card (card_name neither NULL nor
''), oldest account first, routes.profile.claim_handle_with: the username
becomes the Latin letters of the name if nobody holds them (in any case),
the name and the first number free (Tifa2, Tifa3) if somebody does. The
oldest account of a name gets the bare one. Nothing is drawn at random,
so the report is exact. An account is left alone when its name has no
Latin letters (さくら), when its username is not one the app drew (a
learner's own pick is never replaced), or when it already has the handle
its name spells. A second run finds nothing left to move.

The report is the real run: both run the moves in one transaction, and
without --yes it is rolled back, so the figures and the examples are what
--yes will do.

BEFORE --yes
------------
A username is public: the 番付 and the attribution under every published
deck print it. These learners typed their name when the sheet said only
"printed on your card" (the note says more since plan 247b), so --yes
publishes a name they gave for the card, and renames the author of a
deck other learners follow. Read the report, and decide that first.

The old handle is not kept anywhere: there is no way back but a second
rename by hand, so take a snapshot before --yes.
"""
import argparse
import logging
import sys

from core.db import db_conn
from routes.profile import _GENERATED_RE, claim_handle_with, handle_from_name

logging.basicConfig(level=logging.INFO, format="%(message)s", stream=sys.stdout)
logger = logging.getLogger("migrate_handles")

# How many of the moves the report prints. Usernames only: the names on
# the cards stay where they are.
EXAMPLES = 10


def named(cur, users: list[str] | None = None) -> list[tuple[str, str, str]]:
    """(user_id, username, card_name) of every account with a name on its
    card, the oldest account first -- which is who gets a name bare."""
    scope = " AND user_id = ANY(%s)" if users else ""
    cur.execute(
        f"""
        SELECT user_id, username, card_name FROM user_profiles
        WHERE card_name IS NOT NULL AND card_name <> ''{scope}
        ORDER BY created_at, user_id
        """,
        (users,) if users else (),
    )
    return cur.fetchall()


def migrate(cur, users: list[str] | None = None) -> dict:
    """Move every account that can be moved, on `cur`'s transaction (the
    caller commits or rolls back), and say what happened to each."""
    report = {"named": 0, "moved": [], "bare": 0, "numbered": 0,
              "own_handle": 0, "no_latin": 0, "all_taken": 0}
    for user_id, username, card_name in named(cur, users):
        report["named"] += 1
        base = handle_from_name(card_name)
        if not base:
            report["no_latin"] += 1
        elif not _GENERATED_RE.match(username):
            report["own_handle"] += 1
        else:
            handle = claim_handle_with(cur, user_id, card_name)
            if handle is None:
                report["all_taken"] += 1
                continue
            report["moved"].append((user_id, username, handle))
            report["bare" if handle == base else "numbered"] += 1
    return report


def run(users: list[str] | None = None, apply: bool = False) -> dict:
    """migrate(), committed with `apply` and rolled back without it."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            report = migrate(cur, users)
        if apply:
            conn.commit()
        else:
            conn.rollback()
        return report
    finally:
        conn.close()


def main() -> int:
    ap = argparse.ArgumentParser(description="Give accounts that boarded before plan 247b the handle their card name spells.")
    ap.add_argument("--yes", action="store_true", help="actually rename; without it, only report")
    ap.add_argument("--user", action="append", default=None, help="scope to a user id (repeatable)")
    args = ap.parse_args()

    logger.info("scope: %s", f"{len(args.user)} user(s)" if args.user else "ALL USERS")
    report = run(args.user, apply=args.yes)
    moved = report["moved"]
    logger.info("  %d account(s) with a name on their card", report["named"])
    logger.info("  %d %s their name as is, %d with a number behind it",
                report["bare"], "take" if args.yes else "would take", report["numbered"])
    logger.info("  %d left alone: the name has no Latin letters", report["no_latin"])
    logger.info("  %d left alone: the username is not one the app drew", report["own_handle"])
    if report["all_taken"]:
        logger.info("  %d left alone: every candidate was taken", report["all_taken"])
    for _, old, new in moved[:EXAMPLES]:
        logger.info("    %s -> %s", old, new)
    if len(moved) > EXAMPLES:
        logger.info("    ... and %d more", len(moved) - EXAMPLES)
    if not moved:
        logger.info("Nothing to rename.")
    elif args.yes:
        logger.info("Renamed %d account(s).", len(moved))
    else:
        logger.info("Dry run. Re-run with --yes to rename them (a username is public: see the header).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
