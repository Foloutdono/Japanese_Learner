"""
DELETE /api/account — the learner erases their own account.

Both stores require it: Apple's guideline 5.1.1(v) says an app that
lets people create an account must let them delete it in the app, and
Google Play's data-deletion policy wants the same path reachable from a
web page. Until this route existed the only erasure was the operator
running scripts/wipe_srs.py by hand.

-- What it deletes ---------------------------------------------
Every row that is the learner's, in one transaction, in FK order
(children first), and then the Supabase auth user. PLAN below is the
same shape as scripts/wipe_srs.py's — (table, user-scoping clause,
why) — so tests/test_account.py can pin the order and the scoping keys
the way test_wipe_srs.py does. The difference from the wipe: the wipe
keeps identity and history (a wipe is "start over"); this keeps
nothing, because after it there is no learner to keep it for.

SHARED names the tables that hold no learner rows at all and must never
appear in PLAN: exam papers are a pool other learners' attempts
reference, the sentence cache is keyed by content, the grammar
sentences are generated content. The exam MP3s on disk are hash-named
per paper and shared the same way. tests/test_account.py's completeness
guard asserts that every table data_structure.sql declares is in
exactly one of the two lists, so a table added later cannot be
forgotten by this route.

-- The order of the two halves ---------------------------------
Rows first, commit, then GoTrue. The invariant the store policy cares
about is "the database never holds data for an auth user that no longer
exists". Auth-first would risk the opposite: the sign-in gone, the rows
orphaned, and no way for the learner to come back and retry. Rows-first
means a GoTrue failure leaves a signed-in but empty account, the
response says so (502), and a second attempt is idempotent — every
DELETE counts 0 and a 404 from GoTrue counts as gone.

-- A window worth knowing --------------------------------------
Tokens are verified locally against Supabase's JWKS with no revocation
check (core/auth.py), so a token minted before the deletion stays valid
until it expires, about an hour. A second tab holding one could, in
that window, make a request that lazily re-seeds a user_profiles row
(routes/profile.py's ensure_profile_row) — a random username under a
dead uuid, no personal data. The deleting device signs out at once, and
the row is harmless; documented rather than engineered around.
"""
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException

import core.auth as auth
from core.auth import get_user_id
from core.db import db_conn
from core.user_level import forget_stored_level

router = APIRouter()
logger = logging.getLogger(__name__)

# Children before parents: card_modes -> cards; custom_cards and
# deck_cards -> decks; video_session_jobs -> video_sessions.
# user_profiles last, so a run that fails midway leaves an account that
# can still sign in and try again.
PLAN = [
    ("review_log",          "card_id LIKE %(prefix)s",  "review history: XP, level, streak, leaderboard standing"),
    ("card_modes",          "card_id LIKE %(prefix)s",  "per-(card, mode) scheduler state"),
    ("cards",               "id LIKE %(prefix)s",       "the card id registry — every id embeds the user's own id"),
    ("xp_ledger",           "user_id = %(user)s",       "XP awarded outside a review"),
    ("custom_cards",        "user_id = %(user)s",       "hand-written personal cards"),
    ("deck_cards",          "user_id = %(user)s",       "app cards attached to a personal deck"),
    ("decks",               "user_id = %(user)s",       "the personal decks themselves"),
    ("video_session_jobs",  "session_id IN (SELECT id FROM video_sessions WHERE user_id = %(user)s)",
                                                        "claim locks of this learner's transcript jobs"),
    ("video_sessions",      "user_id = %(user)s",       "uploaded and pasted transcripts"),
    ("phrase_history",      "user_id = %(user)s",       "the sentence bank"),
    ("reading_log",         "user_id = %(user)s",       "reading practice history"),
    ("comprehension_log",   "user_id = %(user)s",       "reading comprehension history"),
    ("translation_log",     "user_id = %(user)s",       "translation practice history"),
    ("exam_attempts",       "user_id = %(user)s",       "exam history (the papers are a shared pool and stay)"),
    ("frequency_overrides", "user_id = %(user)s",       "per-user frequency-tier tweaks"),
    ("ocr_usage",           "user_id = %(user)s",       "the OCR daily counters"),
    ("credit_ledger",       "user_id = %(user)s",       "the credit ledger: refills, fares, grants"),
    ("user_profiles",       "user_id = %(user)s",       "identity: username, level, goal, preferences"),
]

# Considered and kept, on record — see the module docstring.
SHARED = {
    "exam_papers":           "generated papers are a shared pool; other learners' attempts reference them",
    "exam_generation_jobs":  "claim locks keyed by exam id, not by user",
    "grammar_sentences":     "generated content cache keyed by (level, pattern)",
    "phrase_analysis_cache": "keyed by a hash of the phrase; shared across every caller",
}


def _prefix_pattern(user_id: str) -> str:
    # The same escaping SRSEngine applies to its own LIKE patterns: a
    # Supabase uuid carries none of these, but DEV_USER_ID is free
    # text and an underscore in it is a LIKE wildcard.
    safe = user_id.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")
    return f"{safe}:%"


def delete_user_rows(cur, user_id: str) -> dict[str, int]:
    """Run PLAN on an open cursor; the caller owns the transaction."""
    params = {"user": user_id, "prefix": _prefix_pattern(user_id)}
    counts: dict[str, int] = {}
    for table, clause, _why in PLAN:
        cur.execute(f'DELETE FROM "{table}" WHERE {clause}', params)
        counts[table] = cur.rowcount
    return counts


class AuthDeleteError(RuntimeError):
    """The Supabase user could not be removed; the rows are already gone."""


def _delete_auth_user(user_id: str) -> bool:
    """True when the Supabase user is gone — deleted now, or already
    absent (404). False when there is no Supabase user to delete, which
    is the DEV_USER_ID case. Raises AuthDeleteError on anything else."""
    if auth.DEV_USER_ID:
        logger.warning("account delete: DEV_USER_ID is set, no Supabase user for %s", user_id)
        return False
    if not (auth.SUPABASE_URL and auth.SUPABASE_SERVICE_KEY):
        raise AuthDeleteError("SUPABASE_URL / SUPABASE_SERVICE_KEY are not set")
    try:
        r = httpx.delete(
            f"{auth.SUPABASE_URL}/auth/v1/admin/users/{user_id}",
            headers={
                "Authorization": f"Bearer {auth.SUPABASE_SERVICE_KEY}",
                "apikey": auth.SUPABASE_SERVICE_KEY,
            },
            timeout=10,
        )
    except httpx.RequestError as e:
        raise AuthDeleteError(str(e)) from e
    if r.status_code in (200, 204, 404):
        return True
    raise AuthDeleteError(f"{r.status_code} {r.text[:200]}")


@router.delete("/api/account")
def delete_account(user_id: str = Depends(get_user_id)):
    logger.info("Deleting account user_id=%s", user_id)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            counts = delete_user_rows(cur, user_id)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    forget_stored_level(user_id)
    try:
        auth_deleted = _delete_auth_user(user_id)
    except AuthDeleteError:
        logger.exception("account delete: rows erased, Supabase user remains user_id=%s", user_id)
        raise HTTPException(
            status_code=502,
            detail="Your data was erased, but the sign-in account could not be removed yet. Please try again.",
        )
    return {"ok": True, "deleted": counts, "auth_deleted": auth_deleted}
