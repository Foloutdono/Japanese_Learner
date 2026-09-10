"""
回数券 — the credits ledger (plan 069).

1 credit = 1 review, except on a line that rides free -- see
FREE_SOURCES below, which today is 仮名 and nothing else. A new account
is welcomed with SIGNUP_BONUS. After that a free pass refills by
DAILY_REFILL at the learner's local midnight and tops up to at most CAP
-- a balance still above CAP (a fresh welcome is) simply takes nothing
until it has been spent down; the subscription pass is unlimited. The
fare gate prices a run against the balance before departure, and a run
longer than the balance stops at the balance -- at the balance's worth
of PAID reviews, that is: the free ones ride on past it.

-- The balance is a SUM, never a column ----------------------
credit_ledger is append-only, modelled on xp_ledger: every refill, every
fare, every grant is a signed row, and the balance is SUM(delta) over
the learner's rows. A balance column that could drift from its own
history is exactly the bug a ledger exists to make impossible. The sum
is cached per worker for a minute (the HUD asks often) and evicted on
every write from this process.

-- Shadow mode ----------------------------------------------
The ledger runs and the HUD prints the balance, but nothing is blocked
until CREDITS_ENFORCE=1 is set in the environment: a fare on an empty
balance is recorded as what there was (never below zero) and logged as
"would have blocked". Enforcement flips one flag, after a grace
announcement (plans/README.md, wave 14); the 402 shapes below are what
the client already knows how to read.

-- What a pass entitles ---------------------------------------
Free: the whole kana line at no fare at all, the daily refill, the
learning modes, the dictionary without the analyzer, today's run, the
full profile, FREE_DECKS decks and FREE_CARDS cards. Pass: unlimited
credits, the practice modes, the analyzer, PASS_DECKS and PASS_CARDS.
Practice never spends credits.
There is no purchase flow yet (HAS_STORE in the frontend's
domain/credits.js), so `plan` is only ever set by hand.

-- Local midnight --------------------------------------------
The refill day is the learner's, not UTC's: user_profiles.tz_offset_min
is the device's offset (minutes EAST of UTC, PATCHed on boot by the
app), and the day boundary is computed from it. Without it, UTC.
"""
import logging
import os
import time
from datetime import date, datetime, timedelta, timezone

from fastapi import Depends

from core.auth import get_user_id

logger = logging.getLogger(__name__)

DAILY_REFILL = 30
CAP = 50
# 開通祝い — what a new account is handed on its first read, once, ever.
# Deliberately well above CAP: the cap is a ceiling on the DAILY REFILL,
# not on what a learner may hold, so the welcome sits on top of it and
# is simply spent down. Once the balance falls below CAP the daily
# refill resumes on its own -- no special case anywhere, because the
# balance is a SUM and the refill already tops up only to the cap.
SIGNUP_BONUS = 200
COST_PER_REVIEW = 1

# ── 仮名は無料 — the lines that ride without a fare ────────────
# Kana costs nothing. It is where every learner starts and the one
# thing nothing else in the app is legible without: a vocab card, a
# kanji reading, a grammar rule, the dictionary — none of them can be
# read at all until the two syllabaries are. Metering the one door
# everybody has to walk through prices the app out of being tried, so
# the kana line rides free: its reviews are charged nothing, they are
# counted out of the day's fare, and a balance at zero still opens the
# gate onto them.
#
# Keyed by SOURCE — the first segment of a mode key, `<source>.<base>
# [.<direction>]` (study/modes.py) — rather than by card id, because
# it is the whole LINE that is free, met in its own section and in the
# daily queue alike. A personal deck can carry a kanji, vocab or
# grammar structure but never a kana one (study/structures.py), so
# there is no free ride to be minted by hand; the callers that take a
# mode key straight from a client check the card against the index
# first (routes/today.py) rather than trusting the key alone.
FREE_SOURCES = frozenset({"kana"})

FREE_DECKS = 7
FREE_CARDS = 200
PASS_DECKS = 100
PASS_CARDS = 10000

# Read once at import, like DEV_USER_ID: a flag that could flip
# mid-process would make one request block and the next not.
ENFORCE = os.environ.get("CREDITS_ENFORCE") == "1"

REASONS = ("refill", "review", "grant", "adjust")


class OutOfCredits(Exception):
    """A fare the balance cannot cover, under enforcement — 402."""
    def __init__(self, balance: int, refill_at: str):
        super().__init__("out_of_credits")
        self.balance = balance
        self.refill_at = refill_at


class PassRequired(Exception):
    """A pass feature asked for by a free learner, under enforcement — 402."""


class LimitReached(Exception):
    """A free-tier count (decks, cards) at its ceiling, under enforcement — 402."""
    def __init__(self, what: str, limit: int):
        super().__init__("limit_reached")
        self.what = what
        self.limit = limit


# ── Time ──────────────────────────────────────────────────────

def local_today(tz_offset_min: int | None, now: datetime | None = None) -> date:
    now = now or datetime.now(timezone.utc)
    return (now + timedelta(minutes=tz_offset_min or 0)).date()


def next_refill_at(tz_offset_min: int | None, now: datetime | None = None) -> datetime:
    """The next local midnight, as a UTC instant."""
    now = now or datetime.now(timezone.utc)
    offset = timedelta(minutes=tz_offset_min or 0)
    local_midnight = datetime.combine(local_today(tz_offset_min, now) + timedelta(days=1), datetime.min.time())
    return (local_midnight - offset).replace(tzinfo=timezone.utc)


# ── The cache ─────────────────────────────────────────────────
# user_id -> (state, expires_at). Only a full, consistent state is ever
# cached; every write from this process evicts, so a spend is visible
# on the very next read here and within a minute on other workers.
_CACHE_TTL_S = 60.0
_cache: dict[str, tuple[dict, float]] = {}


def forget(user_id: str) -> None:
    _cache.pop(user_id, None)


# ── The rows ──────────────────────────────────────────────────

def _profile_bits(cur, user_id: str) -> dict:
    cur.execute(
        "SELECT plan, plan_until, credits_refilled_on, tz_offset_min "
        "FROM user_profiles WHERE user_id = %s",
        (user_id,),
    )
    row = cur.fetchone()
    if row is None:
        return {"plan": "free", "plan_until": None, "refilled_on": None, "tz": None, "exists": False}
    return {"plan": row[0] or "free", "plan_until": row[1], "refilled_on": row[2], "tz": row[3], "exists": True}


def _ledger_sum(cur, user_id: str) -> int | None:
    """SUM(delta), or None when the learner has no ledger yet."""
    cur.execute("SELECT SUM(delta), COUNT(*) FROM credit_ledger WHERE user_id = %s", (user_id,))
    total, n = cur.fetchone()
    return None if not n else int(total)


def _is_pass(bits: dict, now: datetime) -> bool:
    if bits["plan"] != "pass":
        return False
    until = bits["plan_until"]
    return until is None or until > now


def _claim_day(cur, user_id: str, today: date) -> bool:
    """Mark today's refill as taken, once: the conditional UPDATE is the
    lock, so two workers refilling the same learner at once cannot both
    insert. True for the one that won."""
    cur.execute(
        "UPDATE user_profiles SET credits_refilled_on = %s "
        "WHERE user_id = %s AND (credits_refilled_on IS NULL OR credits_refilled_on < %s)",
        (today, user_id, today),
    )
    return cur.rowcount == 1


def _insert(cur, user_id: str, delta: int, reason: str, ref: str | None) -> None:
    assert reason in REASONS, reason
    cur.execute(
        "INSERT INTO credit_ledger (user_id, delta, reason, ref) VALUES (%s, %s, %s, %s)",
        (user_id, delta, reason, ref),
    )


def _settle(cur, user_id: str, now: datetime) -> dict:
    """Read the learner's state, seeding a new account and taking the
    day's refill if it is due. Returns {balance, unlimited, plan, tz,
    refilled_on}; the caller commits."""
    bits = _profile_bits(cur, user_id)
    if not bits["exists"]:
        # A first read before any profile row (a brand-new sign-in that
        # has not reached the onboarding yet): the row is the seat the
        # refill day sits on, so it is made here, the same way
        # routes/profile.py makes it lazily for every other reader.
        from routes.profile import ensure_profile_row
        ensure_profile_row(user_id)
        bits = _profile_bits(cur, user_id)

    unlimited = _is_pass(bits, now)
    total = _ledger_sum(cur, user_id)
    today = local_today(bits["tz"], now)

    if total is None:
        # A new account is welcomed with SIGNUP_BONUS, and that grant IS
        # today's refill: the day is claimed alongside it, so the first
        # day does not also pay out DAILY_REFILL on the next read.
        # `total is None` means an empty ledger, so this is once per
        # account; _claim_day is the lock that keeps two workers racing
        # a first read from welcoming the same learner twice.
        if _claim_day(cur, user_id, today):
            _insert(cur, user_id, SIGNUP_BONUS, "grant", "welcome")
            bits["refilled_on"] = today
        total = _ledger_sum(cur, user_id) or 0
    elif not unlimited and (bits["refilled_on"] is None or bits["refilled_on"] < today):
        added = max(0, min(DAILY_REFILL, CAP - total))
        if _claim_day(cur, user_id, today):
            bits["refilled_on"] = today
            if added > 0:
                _insert(cur, user_id, added, "refill", today.isoformat())
                total += added

    return {"balance": total, "unlimited": unlimited, "plan": "pass" if unlimited else "free",
            "tz": bits["tz"], "refilled_on": bits["refilled_on"]}


def _state(user_id: str, fresh: bool = False) -> dict:
    now = time.monotonic()
    if not fresh:
        cached = _cache.get(user_id)
        if cached is not None and cached[1] > now:
            return cached[0]
    from core.db import db_conn
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            state = _settle(cur, user_id, datetime.now(timezone.utc))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    _cache[user_id] = (state, now + _CACHE_TTL_S)
    return state


# ── The price of a review ─────────────────────────────────────

def is_free(source_or_mode: str | None) -> bool:
    """Whether a review on this line rides free (FREE_SOURCES above).

    Takes either a bare source name ("kana") or a whole mode key
    ("kana.flashcard.f2b"): the source is the key's first segment, so
    one function answers for a section endpoint that knows its source
    outright and for the daily queue, which carries the mode.
    """
    if not source_or_mode:
        return False
    return source_or_mode.split(".", 1)[0] in FREE_SOURCES


def cost_of(source_or_mode: str | None) -> int:
    """The fare for one review: nothing on a free line,
    COST_PER_REVIEW everywhere else.

    Every review endpoint prices itself through here, so "which lines
    ride free" stays the one table above instead of a condition
    repeated across routes/.
    """
    return 0 if is_free(source_or_mode) else COST_PER_REVIEW


# ── The public surface ────────────────────────────────────────

def summary(user_id: str) -> dict:
    """GET /api/credits — and what /api/today prints beside the fare."""
    s = _state(user_id)
    return {
        "balance": None if s["unlimited"] else s["balance"],
        "cap": CAP,
        "dailyRefill": DAILY_REFILL,
        "signupBonus": SIGNUP_BONUS,
        "refillAt": next_refill_at(s["tz"]).isoformat(),
        "plan": s["plan"],
        "unlimited": s["unlimited"],
        "enforced": ENFORCE,
        # What rides free, stated rather than mirrored: the client
        # keeps its own copy for the figures it prints before the API
        # has answered (frontend/src/domain/credits.js), and this is
        # what that copy is checked against at runtime.
        "freeSources": sorted(FREE_SOURCES),
    }


def entitlement(user_id: str) -> str:
    return _state(user_id)["plan"]


def balance(user_id: str) -> int | None:
    """The balance, or None on a pass (nothing to count)."""
    s = _state(user_id)
    return None if s["unlimited"] else s["balance"]


def refill_if_due(user_id: str) -> dict:
    """Settle now, bypassing the cache — the boot-time call and the tests."""
    return _state(user_id, fresh=True)


def spend(user_id: str, n: int = COST_PER_REVIEW, ref: str | None = None) -> dict:
    """Charge n credits for a review the scheduler has already accepted.

    Never called before srs.review() returns: a rejected review is not a
    fare. On a pass, nothing is written. In shadow mode a fare the
    balance cannot cover records what there is (never below zero) and
    logs it; under enforcement it raises OutOfCredits and writes nothing.
    Returns {balance, unlimited} for the response.
    """
    if n <= 0:
        s = _state(user_id)
        return {"balance": None if s["unlimited"] else s["balance"], "unlimited": s["unlimited"]}
    from core.db import db_conn
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            now = datetime.now(timezone.utc)
            s = _settle(cur, user_id, now)
            if s["unlimited"]:
                conn.commit()
                forget(user_id)
                return {"balance": None, "unlimited": True}
            have = s["balance"]
            if have < n:
                if ENFORCE:
                    conn.rollback()
                    forget(user_id)
                    raise OutOfCredits(have, next_refill_at(s["tz"], now).isoformat())
                logger.info("credits: would have blocked user_id=%s balance=%d fare=%d ref=%s",
                            user_id, have, n, ref)
            charge = min(n, have)
            if charge > 0:
                _insert(cur, user_id, -charge, "review", ref)
            new_balance = have - charge
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    forget(user_id)
    return {"balance": new_balance, "unlimited": False}


def grant(user_id: str, n: int, ref: str | None = None) -> int:
    """Credits given outside the refill (support, a promotion). Returns
    the new balance."""
    from core.db import db_conn
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            _settle(cur, user_id, datetime.now(timezone.utc))
            _insert(cur, user_id, n, "grant", ref)
            total = _ledger_sum(cur, user_id) or 0
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    forget(user_id)
    return total


# ── The gates ─────────────────────────────────────────────────

def require_pass(user_id: str = Depends(get_user_id)) -> str:
    """A router dependency for the pass features (practice, the
    analyzer). A no-op until enforcement; then a 402 for a free learner."""
    if ENFORCE and entitlement(user_id) != "pass":
        raise PassRequired()
    return user_id


def deck_limit(user_id: str) -> int:
    return PASS_DECKS if entitlement(user_id) == "pass" else FREE_DECKS


def card_limit(user_id: str) -> int:
    return PASS_CARDS if entitlement(user_id) == "pass" else FREE_CARDS


def check_deck_limit(cur, user_id: str) -> None:
    """Before INSERT INTO decks. A no-op until enforcement."""
    if not ENFORCE:
        return
    limit = deck_limit(user_id)
    cur.execute("SELECT COUNT(*) FROM decks WHERE user_id = %s", (user_id,))
    if cur.fetchone()[0] >= limit:
        raise LimitReached("decks", limit)


def check_card_limit(cur, user_id: str, adding: int = 1) -> None:
    """Before a card lands in any of the learner's decks — hand-written
    or browsed in. A no-op until enforcement."""
    if not ENFORCE:
        return
    limit = card_limit(user_id)
    cur.execute(
        "SELECT (SELECT COUNT(*) FROM custom_cards WHERE user_id = %s)"
        " + (SELECT COUNT(*) FROM deck_cards WHERE user_id = %s)",
        (user_id, user_id),
    )
    if cur.fetchone()[0] + adding > limit:
        raise LimitReached("cards", limit)
