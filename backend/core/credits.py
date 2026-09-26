"""
回数券 — the credits ledger (plan 069).

1 credit = 1 review, except on a line that rides free -- see
FREE_SOURCES below, which today is 仮名 and nothing else. A new account
is welcomed with SIGNUP_BONUS. After that a free pass fills itself
through the day (plan 139): DAILY_REFILL a day, one credit every
REFILL_EVERY, up to at most CAP -- a balance still above CAP (a fresh
welcome is) simply takes nothing until it has been spent down; the
subscription pass is unlimited. The fare gate prices a run against the
balance before departure, and a run longer than the balance stops at
the balance -- at the balance's worth of PAID reviews, that is: the
free ones ride on past it.

-- The balance is a SUM, never a column ----------------------
credit_ledger is append-only, modelled on xp_ledger: every refill, every
fare, every grant is a signed row, and the balance is SUM(delta) over
the learner's rows. A balance column that could drift from its own
history is exactly the bug a ledger exists to make impossible. The sum
is cached per worker for a minute (the HUD asks often) and evicted on
every write from this process.

-- 補充 — the refill fills, and waits to be claimed (plan 139) ----
It used to land in one go, DAILY_REFILL at the learner's local
midnight. It lands as the day goes now: one credit every REFILL_EVERY
(48 minutes, the day's thirty spread over it), counted from
user_profiles.credits_accrued_at -- the refill's clock. What has landed
since the clock is PENDING: owed, not yet in the ledger. Reading the
balance never moves it; claiming it (POST /api/credits/claim, the
"while you were away" sheet the app opens on arrival) writes it as one
`refill` row and moves the clock on by exactly the credits it paid,
so the minutes towards the next one are kept.

The tank holds CAP. Pending stops growing at the room under it, and a
tank that fills is full: the minutes past the last credit are not
banked, and while the balance sits at or above CAP the clock does not
run at all. It starts again, from that moment, on the fare that takes
the balance back under CAP -- the energy bar every idle game has, and
the only rule under which a learner who was away a week comes back to
the same full tank as one who was away a day.

Nothing waits on the claim to be spendable: a fare claims what is
pending first (spend below), so an unclaimed credit is never a refusal,
and balance() -- what the queue trims a batch to -- counts it.

-- Shadow mode ----------------------------------------------
The ledger runs and the HUD prints the balance, but nothing is blocked
until CREDITS_ENFORCE=1 is set in the environment: a fare on an empty
balance is recorded as what there was (never below zero) and logged as
"would have blocked". Enforcement flips one flag, after a grace
announcement (plans/README.md, wave 14); the 402 shapes below are what
the client already knows how to read.

-- What a pass entitles ---------------------------------------
Free: the whole kana line at no fare at all, the refill through the
day, the learning modes, the dictionary without the analyzer, today's
run, the full profile, FREE_DECKS decks and FREE_CARDS cards. Pass:
unlimited credits, the practice modes, the analyzer, PASS_DECKS and
PASS_CARDS. Practice never spends credits.
There is no purchase flow yet (HAS_STORE in the frontend's
domain/credits.js), so `plan` is only ever set by hand.

-- Local midnight --------------------------------------------
The refill no longer waits for one, but the rest of the app's daily
allowances do (the OCR limit, the comprehension ceiling, the asking):
user_profiles.tz_offset_min is the device's offset (minutes EAST of
UTC, PATCHed on boot by the app), and resets_at below computes the
learner's day boundary from it. Without it, UTC.
"""
import logging
import os
import time
from datetime import date, datetime, timedelta, timezone

from fastapi import Depends

from core.auth import get_user_id

logger = logging.getLogger(__name__)

DAILY_REFILL = 30
# One credit at a time, the day's DAILY_REFILL spread evenly over it:
# 48 minutes. Derived rather than written, so the rate and the daily
# figure the copy prints cannot disagree.
REFILL_EVERY = timedelta(days=1) / DAILY_REFILL
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
    """A fare the balance cannot cover, under enforcement — 402.
    `next_credit_at` is when the refill lands its next credit."""
    def __init__(self, balance: int, next_credit_at: str | None):
        super().__init__("out_of_credits")
        self.balance = balance
        self.next_credit_at = next_credit_at


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


def _midnight_starting(day: date, tz_offset_min: int | None) -> datetime:
    """The local midnight that opens `day`, as a UTC instant."""
    offset = timedelta(minutes=tz_offset_min or 0)
    return (datetime.combine(day, datetime.min.time()) - offset).replace(tzinfo=timezone.utc)


def next_midnight(tz_offset_min: int | None, now: datetime | None = None) -> datetime:
    """The next local midnight, as a UTC instant."""
    now = now or datetime.now(timezone.utc)
    return _midnight_starting(local_today(tz_offset_min, now) + timedelta(days=1), tz_offset_min)


def resets_at(user_id: str) -> datetime:
    """When this learner's day rolls over, as a UTC instant.

    The learner's midnight, looked up by user id -- which is what a
    daily cap somewhere else in the app (the OCR limit, the
    comprehension ceiling) needs in order to say WHEN an allowance
    comes back. The credits' own refill used to land on the same
    boundary and no longer does (plan 139), but the offset and the day
    rule are still this module's business, and every one of those caps
    would otherwise carry the same four lines.

    Falls back to UTC for a learner with no profile row or no reported
    offset, exactly as local_today does."""
    from core.db import db_conn

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT tz_offset_min FROM user_profiles WHERE user_id = %s",
                (user_id,),
            )
            row = cur.fetchone()
        return next_midnight(row[0] if row else None)
    finally:
        conn.close()


# ── 補充 — the refill's clock (plan 139) ───────────────────────
# Pure arithmetic, apart from the rows: what has landed by `now` on a
# clock, and when the next credit and a full tank come. Kept free of
# the database so the rule the module docstring states is the whole of
# what these do, and so the tests can put a clock anywhere.

def accrual(balance: int, clock: datetime, now: datetime) -> tuple[int, datetime]:
    """(credits landed, the clock after taking them).

    One credit per whole REFILL_EVERY since `clock`, at most the room
    under CAP. While the balance holds CAP or more nothing lands and
    the clock is not read at all -- spend() restarts it when a fare
    takes the balance back under. A tank the credits fill is full: its
    clock moves to `now`, and the minutes past the last credit that
    fitted are dropped rather than banked. Otherwise the clock moves on
    by exactly the credits taken, keeping the minutes towards the next.
    """
    room = CAP - balance
    if room <= 0 or clock >= now:
        return 0, clock
    landed = (now - clock) // REFILL_EVERY
    if landed >= room:
        return room, now
    return landed, clock + landed * REFILL_EVERY


def schedule(balance: int, pending: int, clock: datetime) -> tuple[datetime | None, datetime | None]:
    """(the next credit, the tank full) as instants -- both None when
    nothing more is coming. `clock` is the one after `pending` was
    taken off it (accrual's second value)."""
    room = CAP - balance - pending
    if room <= 0:
        return None, None
    return clock + REFILL_EVERY, clock + room * REFILL_EVERY


# ── The cache ─────────────────────────────────────────────────
# user_id -> (state, expires_at). Only a full, consistent state is ever
# cached; every write from this process evicts, so a spend is visible
# on the very next read here and within a minute on other workers.
_CACHE_TTL_S = 60.0
_cache: dict[str, tuple[dict, float]] = {}

# A user who is never read again leaves a stale entry behind forever --
# forget() only fires on a write BY that user, and eviction-on-expiry
# only happens to a key that gets looked up again. Swept every N
# insertions rather than on every one: the cache is read far more than
# it is refilled, so this is cheap over the process's life and still
# keeps a long-running worker's dict bounded by recently-active users
# rather than by every user it has ever seen.
_SWEEP_EVERY = 200
_writes_since_sweep = 0


def _sweep_cache(now: float) -> None:
    global _writes_since_sweep
    _writes_since_sweep += 1
    if _writes_since_sweep < _SWEEP_EVERY:
        return
    _writes_since_sweep = 0
    expired = [uid for uid, (_, expires_at) in _cache.items() if expires_at <= now]
    for uid in expired:
        _cache.pop(uid, None)


def forget(user_id: str) -> None:
    _cache.pop(user_id, None)


# ── The rows ──────────────────────────────────────────────────

def _profile_bits(cur, user_id: str) -> dict:
    cur.execute(
        "SELECT plan, plan_until, credits_accrued_at, credits_refilled_on, tz_offset_min "
        "FROM user_profiles WHERE user_id = %s",
        (user_id,),
    )
    row = cur.fetchone()
    if row is None:
        return {"plan": "free", "plan_until": None, "clock": None, "refilled_on": None,
                "tz": None, "exists": False}
    # In UTC whatever the connection's TimeZone: the instants built on
    # it go out as ISO strings, and the client reads them as the same
    # moment either way, but one zone keeps them comparable at a glance.
    clock = row[2].astimezone(timezone.utc) if row[2] else None
    return {"plan": row[0] or "free", "plan_until": row[1], "clock": clock,
            "refilled_on": row[3], "tz": row[4], "exists": True}


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


def _move_clock(cur, user_id: str, seen: datetime | None, to: datetime) -> bool:
    """Move the refill's clock from where this transaction SAW it to
    `to`, once: the conditional UPDATE is the lock, so two workers
    settling the same learner at once cannot both pay out the same
    credits (or both welcome the same account). A loser's UPDATE waits
    on the winner's row lock, then finds the clock moved and matches
    nothing. True for the one that won."""
    cur.execute(
        "UPDATE user_profiles SET credits_accrued_at = %s "
        "WHERE user_id = %s AND credits_accrued_at IS NOT DISTINCT FROM %s",
        (to, user_id, seen),
    )
    return cur.rowcount == 1


def _clock_start(bits: dict, now: datetime) -> datetime:
    """Where a clock that has never run starts.

    An account from before the refill filled through the day took its
    last one in one go, on the local day credits_refilled_on records.
    Its clock starts at the midnight after that day -- when the next
    lump would have landed -- so a learner away since is owed what the
    old rule would have paid them, landed the new way (and capped the
    same). Never later than now: a learner refilled this very day
    starts filling from the deploy rather than waiting out a midnight
    that no longer means anything. Everyone else starts now."""
    day = bits["refilled_on"]
    if day is None:
        return now
    return min(_midnight_starting(day + timedelta(days=1), bits["tz"]), now)


def _insert(cur, user_id: str, delta: int, reason: str, ref: str | None) -> None:
    assert reason in REASONS, reason
    cur.execute(
        "INSERT INTO credit_ledger (user_id, delta, reason, ref) VALUES (%s, %s, %s, %s)",
        (user_id, delta, reason, ref),
    )


def _settle(cur, user_id: str, now: datetime, claim: bool = False) -> dict:
    """Read the learner's state, seeding a new account and starting a
    clock that has never run. With `claim`, what the refill has landed
    is written to the ledger as well; without it, it is only counted.
    Returns {balance, pending, claimed, clock, unlimited, plan, tz};
    `clock` is the one after `pending` was taken off it, so schedule()
    reads the next credit off it either way. The caller commits."""
    bits = _profile_bits(cur, user_id)
    if not bits["exists"]:
        # A first read before any profile row (a brand-new sign-in that
        # has not reached the onboarding yet): the row is the seat the
        # refill's clock sits on, so it is made here, the same way
        # routes/profile.py makes it lazily for every other reader.
        from routes.profile import ensure_profile_row
        ensure_profile_row(user_id)
        bits = _profile_bits(cur, user_id)

    unlimited = _is_pass(bits, now)
    claimed = 0
    # Twice at most: a race lost on the clock is re-read once, and the
    # second read finds the winner's rows committed (READ COMMITTED --
    # the lost UPDATE waited for them).
    for _attempt in range(2):
        total = _ledger_sum(cur, user_id)
        clock = bits["clock"]
        if total is None:
            # A new account is welcomed with SIGNUP_BONUS, and its clock
            # starts with it -- idle while the welcome holds the balance
            # over CAP. `total is None` means an empty ledger, so this
            # is once per account; the clock's lock keeps two workers
            # racing a first read from welcoming the same learner twice.
            if _move_clock(cur, user_id, clock, now):
                _insert(cur, user_id, SIGNUP_BONUS, "grant", "welcome")
                total, clock = SIGNUP_BONUS, now
            else:
                bits = _profile_bits(cur, user_id)
                continue
        elif clock is None:
            start = _clock_start(bits, now)
            if not _move_clock(cur, user_id, None, start):
                bits = _profile_bits(cur, user_id)
                continue
            clock = start

        pending, after = (0, clock) if unlimited else accrual(total, clock, now)
        if claim and pending > 0:
            if not _move_clock(cur, user_id, clock, after):
                bits = _profile_bits(cur, user_id)
                continue
            _insert(cur, user_id, pending, "refill", None)
            total += pending
            claimed, pending = pending, 0
        break
    else:
        # Lost twice in a row: someone else is settling this learner
        # right now. Their rows are the truth; count, and claim nothing.
        total = _ledger_sum(cur, user_id) or 0
        pending, after = 0, bits["clock"] or now

    return {"balance": total, "pending": pending, "claimed": claimed, "clock": after,
            "unlimited": unlimited, "plan": "pass" if unlimited else "free", "tz": bits["tz"]}


def _restart_if_under_cap(cur, user_id: str, s: dict, after: int, now: datetime) -> None:
    """A balance that held CAP or more has just gone under it: the
    refill's clock starts now, not from whenever it last moved -- the
    hours the tank sat full are not owed to anybody."""
    if s["balance"] >= CAP > after:
        _move_clock(cur, user_id, s["clock"], now)


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
    _sweep_cache(now)
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

def _iso(at: datetime | None) -> str | None:
    return at.isoformat() if at else None


def _summary_of(s: dict) -> dict:
    next_at, full_at = (None, None) if s["unlimited"] else schedule(s["balance"], s["pending"], s["clock"])
    return {
        "balance": None if s["unlimited"] else s["balance"],
        # 補充 — landed since the last claim and not yet in the balance
        # (plan 139): what the "while you were away" sheet offers.
        "pending": 0 if s["unlimited"] else s["pending"],
        "cap": CAP,
        "dailyRefill": DAILY_REFILL,
        "refillEvery": int(REFILL_EVERY.total_seconds()),
        "nextCreditAt": _iso(next_at),
        "fullAt": _iso(full_at),
        "signupBonus": SIGNUP_BONUS,
        "plan": s["plan"],
        "unlimited": s["unlimited"],
        "enforced": ENFORCE,
        # What rides free, stated rather than mirrored: the client
        # keeps its own copy for the figures it prints before the API
        # has answered (frontend/src/domain/credits.js), and this is
        # what that copy is checked against at runtime.
        "freeSources": sorted(FREE_SOURCES),
    }


def summary(user_id: str) -> dict:
    """GET /api/credits — and what /api/today prints beside the fare.
    Counts what the refill has landed without claiming it."""
    return _summary_of(_state(user_id))


def claim(user_id: str) -> dict:
    """POST /api/credits/claim — what the refill has landed, written to
    the ledger: the summary after it, and `claimed`, the credits this
    call moved (0 when another worker, or a fare, got there first)."""
    from core.db import db_conn
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            s = _settle(cur, user_id, datetime.now(timezone.utc), claim=True)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    forget(user_id)
    return {**_summary_of(s), "claimed": s["claimed"]}


def entitlement(user_id: str) -> str:
    return _state(user_id)["plan"]


def balance(user_id: str) -> int | None:
    """What a fare can draw on, or None on a pass (nothing to count):
    the balance AND what the refill has landed unclaimed, because
    spend() claims that before it charges."""
    s = _state(user_id)
    return None if s["unlimited"] else s["balance"] + s["pending"]


def read_fresh(user_id: str) -> dict:
    """The state, bypassing the cache — the tests. Claims nothing."""
    return _state(user_id, fresh=True)


def spend(user_id: str, n: int = COST_PER_REVIEW, ref: str | None = None) -> dict:
    """Charge n credits for a review the scheduler has already accepted.

    Never called before srs.review() returns: a rejected review is not a
    fare. What the refill has landed is claimed first, so a credit
    waiting on the "while you were away" sheet is never a refusal. On a
    pass, nothing is written. In shadow mode a fare the balance cannot
    cover records what there is (never below zero) and logs it; under
    enforcement it raises OutOfCredits and writes nothing.
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
            s = _settle(cur, user_id, now, claim=True)
            if s["unlimited"]:
                conn.commit()
                forget(user_id)
                return {"balance": None, "unlimited": True}
            have = s["balance"]
            if have < n:
                if ENFORCE:
                    conn.rollback()
                    forget(user_id)
                    next_at, _full = schedule(have, 0, s["clock"])
                    raise OutOfCredits(have, _iso(next_at))
                logger.info("credits: would have blocked user_id=%s balance=%d fare=%d ref=%s",
                            user_id, have, n, ref)
                # ...and again where it can be counted. That log line
                # goes to stdout, which on Render is not queryable and
                # does not outlive the instance, so the one signal this
                # whole shadow mode exists to produce -- who wants more
                # than the free allowance gives -- was being thrown
                # away. On `cur`, inside the transaction already open,
                # so a fare and its refusal cannot disagree. `ref` is a
                # card id and stays out of it: the question is how
                # often and to whom, never which card.
                from core import events
                events.record(user_id, "fare_blocked",
                              {"balance": have, "fare": n, "kind": "review"}, cur=cur)
            charge = min(n, have)
            if charge > 0:
                _insert(cur, user_id, -charge, "review", ref)
            new_balance = have - charge
            _restart_if_under_cap(cur, user_id, s, new_balance, now)
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
            now = datetime.now(timezone.utc)
            s = _settle(cur, user_id, now, claim=True)
            _insert(cur, user_id, n, "grant", ref)
            total = _ledger_sum(cur, user_id) or 0
            _restart_if_under_cap(cur, user_id, s, total, now)
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


def _count(cur) -> int:
    """The single number a COUNT query returned, whatever cursor ran it.

    All three call sites in routes/decks.py hand these helpers a
    RealDictCursor, on which `row[0]` raises KeyError instead of giving
    the count. That was invisible for as long as the counts sat behind
    `if not ENFORCE: return` -- they never ran. The first
    CREDITS_ENFORCE=1 deploy would have met it on the first deck anyone
    created, with a 500 where a 402 was meant.
    """
    row = cur.fetchone()
    if row is None:
        return 0
    if isinstance(row, dict):
        return int(next(iter(row.values())))
    return int(row[0])


def check_deck_limit(cur, user_id: str) -> None:
    """Before INSERT INTO decks. Refuses only under enforcement; in
    shadow mode it still counts, and records the crossing."""
    limit = deck_limit(user_id)
    # withdrawn_at IS NULL: a deck the author deleted while other
    # learners followed it is kept alive for them alone (see
    # routes/decks.delete_deck). It has left this shelf, so it must not
    # go on occupying a slot on it.
    cur.execute(
        "SELECT COUNT(*) FROM decks WHERE user_id = %s AND withdrawn_at IS NULL",
        (user_id,),
    )
    have = _count(cur)
    if have < limit:
        return
    if ENFORCE:
        raise LimitReached("decks", limit)
    _shadow_limit(cur, user_id, "decks", limit, have == limit)


def _shadow_limit(cur, user_id: str, kind: str, limit: int, crossing: bool) -> None:
    """Record a limit a free learner has just walked past, once.

    Only on the crossing -- the deck that would have been the first one
    refused -- because after it every further add is also past the limit
    and would say the same thing again. One row per learner per limit is
    the shape the question wants ("how many people want more than seven
    decks"), and the alternative is a learner with three hundred cards
    writing a hundred identical rows.

    The count above used to sit behind `if not ENFORCE: return`, so
    shadow mode never even looked. That made the pass's own value
    proposition the one thing the app could not measure.
    """
    if not crossing:
        return
    from core import events
    events.record(user_id, "limit_reached", {"kind": kind, "at": limit}, cur=cur)


def check_card_limit(cur, user_id: str, adding: int = 1) -> None:
    """Before a card lands in any of the learner's decks — hand-written
    or browsed in. Refuses only under enforcement; in shadow mode it
    still counts, and records the crossing."""
    limit = card_limit(user_id)
    cur.execute(
        "SELECT (SELECT COUNT(*) FROM custom_cards WHERE user_id = %s)"
        " + (SELECT COUNT(*) FROM deck_cards WHERE user_id = %s)",
        (user_id, user_id),
    )
    have = _count(cur)
    if have + adding <= limit:
        return
    if ENFORCE:
        raise LimitReached("cards", limit)
    # The crossing is the batch that takes them past it, so a learner
    # already over the line does not re-report on every card after.
    _shadow_limit(cur, user_id, "cards", limit, have <= limit)
