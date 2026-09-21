"""
Stamp the first ride as seen on every account that boarded before it existed (plan 097).

    python -m scripts.backfill_first_ride                 # report only, changes nothing
    python -m scripts.backfill_first_ride --yes           # do it
    python -m scripts.backfill_first_ride --yes --user U  # one account only

WHY THIS EXISTS
----------------
Plan 097 adds two columns to user_profiles: tutorial_at, when the two
rides after the boarding ended, and guided, which gates' guides have
been seen. Both are read as "not yet" when empty -- the index route
shows the ride to a learner with no tutorial_at, and each gate opens its
guide while its id is not in guided. Every account that boarded before
the deploy that carries them is therefore, as far as the app can tell,
a learner who has never flipped a card. Nobody who has reviewed three
thousand of them is to be shown how; this script says so.

WHAT IT DOES
------------
For every profile row WHERE onboarded_at IS NOT NULL AND tutorial_at IS
NULL: tutorial_at = onboarded_at, and guided = every gate at
onboarded_at. The onboarding time rather than now, so the trail reads as
the truth it is -- these learners were past the ride the day they
boarded. A row already stamped is left alone, whoever stamped it, so the
script can be run twice.

WHY NOT AT IMPORT
-----------------
routes/profile.py's _init_db is where the columns are added, and an
UPDATE beside the ALTER would run on every worker's start -- including
the one that starts during a deploy, when a learner who completed the
boarding a minute earlier and has not yet reached the ride would be
stamped past it. A one-shot run once, by hand, after the backend that
carries the columns is up and before the frontend that reads them is.
The learner who boards between the two simply gets the ride.

Settings offers both back to anyone stamped here who wants them.
"""
import argparse
import json
import logging
import sys

from core.db import db_conn

logging.basicConfig(level=logging.INFO, format="%(message)s", stream=sys.stdout)
logger = logging.getLogger("backfill_first_ride")

# The five gates -- config/tabs.js's TAB_IDS, as routes/onboarding.py
# spells them. Imported from there rather than copied, so a sixth gate
# cannot be stamped on one side and not the other.
from routes.onboarding import GUIDE_GATES  # noqa: E402  (after logging setup)

_WHERE = "onboarded_at IS NOT NULL AND tutorial_at IS NULL"


def _user_clause(user: str | None) -> tuple[str, tuple]:
    return (" AND user_id = %s", (user,)) if user else ("", ())


def count_pending(cur, user: str | None = None) -> int:
    scope, params = _user_clause(user)
    cur.execute(f"SELECT COUNT(*) FROM user_profiles WHERE {_WHERE}{scope}", params)
    return cur.fetchone()[0]


def stamp(cur, user: str | None = None) -> int:
    """tutorial_at = onboarded_at and every gate guided at onboarded_at,
    on the rows still pending. Returns how many rows moved."""
    scope, params = _user_clause(user)
    # jsonb_build_object takes key/value pairs; every gate gets the
    # same onboarded_at, rendered by Postgres so its shape matches what
    # routes/onboarding.py's mark_guided writes (an ISO timestamp).
    pairs = ", ".join("%s, to_char(onboarded_at, 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"+00:00\"')" for _ in GUIDE_GATES)
    cur.execute(
        f"""
        UPDATE user_profiles
        SET tutorial_at = onboarded_at,
            guided = jsonb_build_object({pairs})
        WHERE {_WHERE}{scope}
        """,
        (*GUIDE_GATES, *params),
    )
    return cur.rowcount


def main() -> int:
    ap = argparse.ArgumentParser(description="Stamp the first ride as seen on accounts that boarded before it existed.")
    ap.add_argument("--yes", action="store_true", help="actually stamp; without it, only report")
    ap.add_argument("--user", default=None, help="scope to one user id")
    args = ap.parse_args()

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            logger.info("scope: %s", f"user {args.user!r}" if args.user else "ALL USERS")
            pending = count_pending(cur, args.user)
            logger.info("  %d boarded account(s) with no ride stamp", pending)
            if not pending:
                logger.info("Nothing to stamp.")
                return 0
            if not args.yes:
                logger.info("Dry run. Re-run with --yes to stamp them (gates: %s).", ", ".join(GUIDE_GATES))
                return 0
            moved = stamp(cur, args.user)
        conn.commit()
        logger.info("Stamped %d account(s): tutorial_at = onboarded_at, every gate guided.", moved)
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
