"""
Erase the rows of learners who no longer have a Supabase auth user.

    python -m scripts.purge_orphans                     # report only, changes nothing
    python -m scripts.purge_orphans --yes               # do it
    python -m scripts.purge_orphans --keep <uuid>       # spare one id
    python -m scripts.purge_orphans --yes --allow-empty-auth

-- The hole this closes -----------------------------------------
DELETE /api/account (routes/account.py) erases everything a learner
owns and then removes their Supabase user. Deleting the user ANY OTHER
WAY -- the Supabase dashboard's Users page, a direct call to GoTrue's
admin API, a project restore -- removes only the auth row. Every app
row survives, invisible: the profile, the review history, the XP that
goes on counting on the 番付, the decks.

Nothing in the schema prevents that, and nothing can:

  * The card-scoped tables (review_log, card_modes, cards,
    card_first_review) have NO user_id column at all. A row belongs to
    a learner because its card id STARTS WITH "{user_id}:" -- see
    core/auth.py's prefixed(). There is no column for a foreign key to
    constrain.
  * user_id elsewhere is TEXT; auth.users.id is a uuid. A foreign key
    needs matching types.
  * DEV_USER_ID (core/auth.py) is free text with no auth row behind it
    at all, so a foreign key would make local development and CI
    impossible.
  * srs/data_structure.sql keeps this schema deliberately independent
    of Supabase's auth schema, so the DB role need not be able to read
    it.

So the two sides are reconciled after the fact instead, which is what
this script is. It is the repair for a deletion that already happened;
DELETE /api/account remains the path that does it properly.

-- Safety ------------------------------------------------------
The dangerous failure is an auth list that comes back short: every
learner it omits looks like an orphan. So the list is fetched with the
service key and, if the call fails at all, the script stops without
touching a row. An auth list that is legitimately EMPTY (every user
really was deleted -- the case this was written for) still refuses
until --allow-empty-auth says so out loud.

DEV_USER_ID is always kept, and --keep spares any other id.

Deletion reuses routes/account.py's delete_user_rows, so it is exactly
the erasure the in-app path performs, in the same order, and cannot
drift from it. There is no Supabase user left to delete -- that is what
made these rows orphans.
"""
import argparse
import logging

import scripts._env  # noqa: F401  -- must precede core.db, which reads
#                       DATABASE_URL at module scope. See scripts/_env.py.
import httpx

import core.auth as auth
from core.db import db_conn
from routes.account import PLAN, delete_user_rows, user_ids_present

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("purge-orphans")

# GoTrue's admin list endpoint pages; 1000 is its documented maximum.
PAGE_SIZE = 1000


class AuthListError(RuntimeError):
    """The live user list could not be fetched. Nothing may be deleted
    on the strength of a list we do not have."""


def list_auth_user_ids() -> set[str]:
    """Every user id Supabase still knows about.

    Raises rather than returning a partial set: a short list here reads
    as "these learners are orphans" downstream, which would delete live
    accounts.
    """
    if auth.DEV_USER_ID:
        raise AuthListError(
            "DEV_USER_ID is set, so this instance has no Supabase users to "
            "reconcile against. Run this against the deployed database."
        )
    if not (auth.SUPABASE_URL and auth.SUPABASE_SERVICE_KEY):
        raise AuthListError("SUPABASE_URL / SUPABASE_SERVICE_KEY are not set")

    headers = {
        "Authorization": f"Bearer {auth.SUPABASE_SERVICE_KEY}",
        "apikey": auth.SUPABASE_SERVICE_KEY,
    }
    ids: set[str] = set()
    page = 1
    while True:
        try:
            r = httpx.get(
                f"{auth.SUPABASE_URL}/auth/v1/admin/users",
                headers=headers,
                params={"page": page, "per_page": PAGE_SIZE},
                timeout=30,
            )
        except httpx.RequestError as e:
            raise AuthListError(str(e)) from e
        if r.status_code != 200:
            raise AuthListError(f"{r.status_code} {r.text[:200]}")
        batch = r.json().get("users") or []
        ids.update(u["id"] for u in batch if u.get("id"))
        if len(batch) < PAGE_SIZE:
            return ids
        page += 1


def _counts(cur, user_id: str) -> dict[str, int]:
    """Rows this id owns per PLAN table, for the report. Counted with
    PLAN's own clauses so the report and the deletion can never disagree
    about what is scoped to whom."""
    from routes.account import prefix_pattern

    params = {"user": user_id, "prefix": prefix_pattern(user_id)}
    out = {}
    for table, clause, _why in PLAN:
        cur.execute(f'SELECT COUNT(*) FROM "{table}" WHERE {clause}', params)
        n = cur.fetchone()[0]
        if n:
            out[table] = n
    return out


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Erase rows belonging to users Supabase no longer has."
    )
    ap.add_argument("--yes", action="store_true",
                    help="actually delete; without it, only report")
    ap.add_argument("--keep", action="append", default=[], metavar="USER_ID",
                    help="spare this id even if it has no auth user (repeatable)")
    ap.add_argument("--allow-empty-auth", action="store_true",
                    help="proceed when Supabase reports NO users at all — "
                         "every id in the database is then an orphan")
    args = ap.parse_args()

    try:
        live = list_auth_user_ids()
    except AuthListError as e:
        logger.error("Could not list Supabase users: %s", e)
        logger.error("Refusing to delete anything on an unknown user list.")
        return 2

    if not live and not args.allow_empty_auth:
        logger.error("Supabase reports 0 users.")
        logger.error("Every id in the database would be an orphan. If that is "
                     "genuinely the case, re-run with --allow-empty-auth.")
        return 2

    keep = set(args.keep)
    if auth.DEV_USER_ID:
        keep.add(auth.DEV_USER_ID)

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            present = user_ids_present(cur)
            orphans = sorted(present - live - keep)

            logger.info("%6d users in Supabase", len(live))
            logger.info("%6d users with rows in the database", len(present))
            if keep:
                logger.info("%6d spared by --keep/DEV_USER_ID", len(keep & present))
            logger.info("%6d orphaned", len(orphans))
            logger.info("")

            if not orphans:
                logger.info("Nothing to purge.")
                return 0

            total = 0
            for user_id in orphans:
                counts = _counts(cur, user_id)
                rows = sum(counts.values())
                total += rows
                logger.info("  %s  %d rows", user_id, rows)
                for table, n in sorted(counts.items()):
                    logger.info("      %-20s %d", table, n)
            logger.info("")
            logger.info("%d rows across %d users", total, len(orphans))

            if not args.yes:
                logger.info("")
                logger.info("Dry run. Re-run with --yes to erase.")
                return 0

            # One transaction for the whole sweep: a half-purged learner
            # is the state this script exists to clean up, so it must not
            # be able to create one.
            for user_id in orphans:
                delete_user_rows(cur, user_id)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    logger.info("")
    logger.info("Purged %d orphaned users.", len(orphans))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
