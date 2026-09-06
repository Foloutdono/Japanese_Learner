"""
回数券 — the credits ledger (plan 069).

1 credit = 1 review. A free pass refills by DAILY_REFILL at the
learner's local midnight and holds at most CAP; the subscription pass is
unlimited. The fare gate prices a run against the balance before
departure, and a run longer than the balance stops at the balance.

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
Free: the daily refill, the learning modes, the dictionary without the
analyzer, today's run, the full profile, FREE_DECKS decks and
FREE_CARDS cards. Pass: unlimited credits, the practice modes, the
analyzer, PASS_DECKS and PASS_CARDS. Practice never spends credits.
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
COST_PER_REVIEW = 1
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
        # The boarding's pass prints 30/50: a new account starts with
        # the day's refill, and that IS the day's refill.
        if _claim_day(cur, user_id, today):
            _insert(cur, user_id, DAILY_REFILL, "grant", "seed")
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


# ── The public surface ────────────────────────────────────────

def summary(user_id: str) -> dict:
    """GET /api/credits — and what /api/today prints beside the fare."""
    s = _state(user_id)
    return {
        "balance": None if s["unlimited"] else s["balance"],
        "cap": CAP,
        "dailyRefill": DAILY_REFILL,
        "refillAt": next_refill_at(s["tz"]).isoformat(),
        "plan": s["plan"],
        "unlimited": s["unlimited"],
        "enforced": ENFORCE,
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
