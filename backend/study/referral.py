"""
縁 — the referral: a parrain chosen, a filleul converted, the weeks it pays
(plan 332).

What it is for (docs/business/strategie-monetisation.md, "Parrainage"):
growth by recommendation, paid in study, never in ranking. The owner's
decisions, and the figures this module holds them to (tests/test_referral.py):

  * a learner names their parrain by username, once, in their first
    CHOOSE_DAYS days; the parrain accepts or refuses, and until they accept
    each sees only the other's username;
  * a parrain has SLOTS filleuls at most; one who has gone quiet may be let
    go (`release`), which frees the place, and a filleul let go never names
    another parrain;
  * a filleul is converted by STUDY_DAYS days of study within their first
    WINDOW_DAYS days, on an account with an address (e-mail or Google, never
    a guest): they are paid FILLEUL credits, their parrain CONVERSION;
  * then each week the filleul studies ACTIVE_DAYS days or more, for WEEKS
    weeks, the parrain is paid WEEK, if the parrain studied that week too;
  * the parrain's credits are capped at MONTH_CAP a month (what passes the
    cap is clipped, not carried);
  * a filleul who subscribes gives their parrain a week of the pass
    (`grant_max_week`, for the payment's webhook to call), MAX_WEEKS a year;
  * on the pass, credits are paid as the same number of XP, which counts for
    the level and never on the 番付 (srs.REFERRAL_SOURCE is left out of the
    board's sums, and of the days studied).

-- Two tables -------------------------------------------------------
  referrals          a row per filleul: who they named, when it was asked,
                     accepted or refused, when they converted, when they were
                     let go, when they were told.
  referral_rewards   a row per reward a parrain earned (the conversion, an
                     active week, a week of the pass), stamped when paid.

Nothing runs in the background: `settle()` brings a learner's referrals up
to date from the logs on every read (a conversion reached, an active week),
as the duels and the missions do. The parrain collects a reward with a tap
(`claim`); one left a fortnight is paid on the next read. No fingerprint of
any device is read (ADR 0022): the guards are study, an address, the cap and
a person reading `scripts/read_referrals`.
"""
from __future__ import annotations

import logging
import time
from datetime import date, datetime, timedelta, timezone

from core import credits as credits_mod
from core import events
from core.db import db_conn
from core.rls import enable_rls

logger = logging.getLogger(__name__)

# ── The figures (the owner's option B) ────────────────────────────────
FILLEUL = 300
CONVERSION = 100
WEEK = 25
WEEKS = 8
MONTH_CAP = 500
MAX_WEEKS = 4            # weeks of the pass a parrain may be given a year
MAX_WEEK_XP = 100        # what a parrain already on an endless pass gets instead
SLOTS = 3
CHOOSE_DAYS = 3
WINDOW_DAYS = 14
STUDY_DAYS = 3
ACTIVE_DAYS = 3
SETTLE_AFTER = timedelta(days=14)   # a reward nobody collected is paid after this
QUIET_WEEKS = 2          # an active filleul quiet this many weeks may be let go
LINK = "https://tsuji.app/?src=referral&ref={handle}"

KINDS = ("conversion", "week", "max_week")


class Refused(Exception):
    """A request the referral refuses, as a status and a code the screen
    words in the learner's language."""
    def __init__(self, status: int, code: str):
        super().__init__(code)
        self.status = status
        self.code = code


# ── Tables ────────────────────────────────────────────────────────────
def _init_referrals() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS referrals (
                    filleul_id   TEXT PRIMARY KEY,
                    sponsor_id   TEXT NOT NULL,
                    asked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    accepted_at  TIMESTAMPTZ,
                    refused_at   TIMESTAMPTZ,
                    verified_at  TIMESTAMPTZ,
                    converted_at TIMESTAMPTZ,
                    released_at  TIMESTAMPTZ,
                    told_at      TIMESTAMPTZ
                )
                """
            )
            enable_rls(cur, "referrals")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_referrals_sponsor ON referrals(sponsor_id)")
        conn.commit()
    finally:
        conn.close()


def _init_rewards() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS referral_rewards (
                    sponsor_id   TEXT NOT NULL,
                    filleul_id   TEXT NOT NULL,
                    kind         TEXT NOT NULL,
                    period       DATE NOT NULL,
                    credits      SMALLINT NOT NULL,
                    done_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    paid_at      TIMESTAMPTZ,
                    paid         SMALLINT,
                    PRIMARY KEY (filleul_id, kind, period)
                )
                """
            )
            enable_rls(cur, "referral_rewards")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_referral_rewards_sponsor ON referral_rewards(sponsor_id)")
        conn.commit()
    finally:
        conn.close()


for _init in (_init_referrals, _init_rewards):
    try:
        _init()
    except Exception:  # pragma: no cover - a missing DB must not stop import
        logger.exception("referral: %s failed", _init.__name__)


# ── Facts ─────────────────────────────────────────────────────────────
def _profile(cur, user_id: str) -> dict | None:
    cur.execute("SELECT username, created_at, tz_offset_min FROM user_profiles WHERE user_id = %s", (user_id,))
    row = cur.fetchone()
    if row is None:
        return None
    return {"username": row[0], "created_at": row[1], "tz": row[2]}


def _studied_days(cur, user_id: str, tz, start: datetime, end: datetime) -> int:
    from study.missions import studied_days_between
    return studied_days_between(cur, user_id, tz, start, end)


def _week_start(tz, at: datetime) -> datetime:
    from study.missions import week_window
    return week_window(tz, at)[1]


def account_verified(user_id: str) -> bool:
    """Whether the account has an address (e-mail or Google), never a guest.
    Asked of Supabase's admin API, once: the answer is kept on the row
    (`verified_at`). Without the service key (local development, the tests)
    every account counts as verified; a test sets `verifier`."""
    if verifier is not None:
        return bool(verifier(user_id))
    from core import auth
    if auth.DEV_USER_ID or not (auth.SUPABASE_URL and auth.SUPABASE_SERVICE_KEY):
        return True
    import httpx
    try:
        r = httpx.get(
            f"{auth.SUPABASE_URL}/auth/v1/admin/users/{user_id}",
            headers={"Authorization": f"Bearer {auth.SUPABASE_SERVICE_KEY}", "apikey": auth.SUPABASE_SERVICE_KEY},
            timeout=httpx.Timeout(5.0, connect=2.0),
        )
    except httpx.RequestError:
        logger.warning("referral: the account could not be read", exc_info=True)
        return False
    if r.status_code != 200:
        return False
    body = r.json() or {}
    if body.get("is_anonymous"):
        return False
    providers = set((body.get("app_metadata") or {}).get("providers") or [])
    return bool(body.get("email")) and bool(body.get("email_confirmed_at") or providers & {"google", "apple"})


verifier = None   # a seam for the tests: user_id -> bool


def slots_used(cur, sponsor_id: str) -> int:
    cur.execute("SELECT COUNT(*) FROM referrals WHERE sponsor_id = %s AND accepted_at IS NOT NULL "
                "AND released_at IS NULL", (sponsor_id,))
    return int(cur.fetchone()[0])


# ── Choosing, answering, letting go ───────────────────────────────────
def choose(user_id: str, username: str, now: datetime | None = None) -> dict:
    """The learner names their parrain. Refused (a code) when the window has
    passed, a parrain is named already, the learner was let go, the name is
    nobody's, their own, behind a block, or a full parrain's."""
    from core.content_filter import refused as filtered
    from study import duel_friends
    now = now or datetime.now(timezone.utc)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            me = _profile(cur, user_id)
            if me is None or me["created_at"] + timedelta(days=CHOOSE_DAYS) <= now:
                raise Refused(409, "referral_closed")
            cur.execute("SELECT sponsor_id, refused_at, released_at FROM referrals WHERE filleul_id = %s FOR UPDATE",
                        (user_id,))
            row = cur.fetchone()
            if row is not None and (row[1] is None or row[2] is not None):
                raise Refused(409, "referral_closed")
            if filtered(username):
                raise Refused(404, "referral_not_found")
            try:
                other, name = duel_friends.reach(cur, user_id, username)
            except duel_friends.Refused:
                raise Refused(404, "referral_not_found")
            if other == user_id:
                raise Refused(422, "referral_self")
            if slots_used(cur, other) >= SLOTS:
                raise Refused(409, "referral_full")
            if row is None:
                cur.execute("INSERT INTO referrals (filleul_id, sponsor_id) VALUES (%s, %s)", (user_id, other))
            else:
                cur.execute("UPDATE referrals SET sponsor_id = %s, asked_at = NOW(), refused_at = NULL "
                            "WHERE filleul_id = %s", (other, user_id))
            events.record(user_id, "referral_asked", {}, cur=cur)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return {"username": name}


def answer(sponsor_id: str, username: str, accept: bool) -> dict:
    """The parrain accepts or refuses a learner who named them. A refused
    learner may name another while their window lasts."""
    from study import duel_friends
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            found = duel_friends.find(cur, username)
            if found is None:
                raise Refused(404, "referral_not_found")
            filleul = found[0]
            cur.execute("SELECT 1 FROM referrals WHERE filleul_id = %s AND sponsor_id = %s AND accepted_at IS NULL "
                        "AND refused_at IS NULL FOR UPDATE", (filleul, sponsor_id))
            if cur.fetchone() is None:
                raise Refused(404, "referral_not_found")
            if accept:
                if slots_used(cur, sponsor_id) >= SLOTS:
                    raise Refused(409, "referral_full")
                cur.execute("UPDATE referrals SET accepted_at = NOW() WHERE filleul_id = %s", (filleul,))
                events.record(sponsor_id, "referral_linked", {}, cur=cur)
            else:
                cur.execute("UPDATE referrals SET refused_at = NOW() WHERE filleul_id = %s", (filleul,))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return {"username": found[1], "accepted": accept}


def _quiet(cur, row: dict, now: datetime) -> bool:
    """Whether a filleul may be let go: never converted and past the window,
    through their eight weeks, or quiet for QUIET_WEEKS whole weeks."""
    if row["converted_at"] is None:
        return row["created_at"] + timedelta(days=WINDOW_DAYS) <= now
    last = _week_start(row["tz"], now)
    if row["converted_at"] + timedelta(weeks=WEEKS + 1) <= now:
        return True
    for k in range(1, QUIET_WEEKS + 1):
        start = last - timedelta(weeks=k)
        if start < row["converted_at"] - timedelta(weeks=1):
            return False
        if _studied_days(cur, row["filleul_id"], row["tz"], start, start + timedelta(weeks=1)) >= ACTIVE_DAYS:
            return False
    return True


def release(sponsor_id: str, username: str, now: datetime | None = None) -> dict:
    """The parrain lets a quiet filleul go: the place is free, and the
    filleul names no other parrain."""
    from study import duel_friends
    now = now or datetime.now(timezone.utc)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            found = duel_friends.find(cur, username)
            rows = _rows(cur, "sponsor_id", sponsor_id) if found else []
            row = next((r for r in rows if r["filleul_id"] == found[0]), None) if found else None
            if row is None or row["accepted_at"] is None:
                raise Refused(404, "referral_not_found")
            if not _quiet(cur, row, now):
                raise Refused(409, "referral_active")
            cur.execute("UPDATE referrals SET released_at = NOW() WHERE filleul_id = %s AND released_at IS NULL",
                        (row["filleul_id"],))
            events.record(sponsor_id, "referral_released", {}, cur=cur)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    _settled.pop(sponsor_id, None)
    return {"username": found[1]}


# ── Settling: conversions and active weeks, read again from the logs ──
_settled: dict[str, float] = {}
_SETTLE_TTL_S = 60.0


def _rows(cur, column: str, user_id: str) -> list[dict]:
    assert column in ("sponsor_id", "filleul_id")
    cur.execute(
        f"""SELECT r.filleul_id, r.sponsor_id, r.asked_at, r.accepted_at, r.refused_at, r.verified_at,
                   r.converted_at, r.released_at, r.told_at, p.created_at, p.tz_offset_min, p.username,
                   s.username
            FROM referrals r
            JOIN user_profiles p ON p.user_id = r.filleul_id
            LEFT JOIN user_profiles s ON s.user_id = r.sponsor_id
            WHERE r.{column} = %s""",
        (user_id,),
    )
    keys = ("filleul_id", "sponsor_id", "asked_at", "accepted_at", "refused_at", "verified_at", "converted_at",
            "released_at", "told_at", "created_at", "tz", "username", "sponsor_name")
    return [dict(zip(keys, r)) for r in cur.fetchall()]


def _reward(cur, sponsor_id: str, filleul_id: str, kind: str, period: date, n: int) -> bool:
    cur.execute(
        "INSERT INTO referral_rewards (sponsor_id, filleul_id, kind, period, credits) VALUES (%s,%s,%s,%s,%s) "
        "ON CONFLICT DO NOTHING", (sponsor_id, filleul_id, kind, period, n))
    return cur.rowcount == 1


def _settle_row(cur, row: dict, now: datetime) -> None:
    if row["accepted_at"] is None or row["released_at"] is not None:
        return
    fid, sid, tz = row["filleul_id"], row["sponsor_id"], row["tz"]
    if row["converted_at"] is None:
        start = row["created_at"]
        end = start + timedelta(days=WINDOW_DAYS)
        if _studied_days(cur, fid, tz, start, end) < STUDY_DAYS:
            return
        if row["verified_at"] is None:
            if not account_verified(fid):
                return
            cur.execute("UPDATE referrals SET verified_at = NOW() WHERE filleul_id = %s", (fid,))
        cur.execute("UPDATE referrals SET converted_at = NOW() WHERE filleul_id = %s AND converted_at IS NULL "
                    "RETURNING converted_at", (fid,))
        got = cur.fetchone()
        if got is None:
            return
        row["converted_at"] = got[0]
        _pay_learner(cur, fid, FILLEUL, f"welcome:{fid}")
        _reward(cur, sid, fid, "conversion", credits_mod.local_today(tz, now), CONVERSION)
        events.record(fid, "referral_converted", {}, cur=cur)
    # The weeks after the conversion's own: an active one pays the parrain,
    # if the parrain studied that week too.
    first = _week_start(tz, row["converted_at"]) + timedelta(weeks=1)
    sponsor = _profile(cur, sid)
    for k in range(WEEKS):
        start = first + timedelta(weeks=k)
        if start > now:
            break
        end = start + timedelta(weeks=1)
        period = (start + timedelta(minutes=tz or 0)).date()
        cur.execute("SELECT 1 FROM referral_rewards WHERE filleul_id = %s AND kind = 'week' AND period = %s",
                    (fid, period))
        if cur.fetchone():
            continue
        if _studied_days(cur, fid, tz, start, end) < ACTIVE_DAYS:
            continue
        if sponsor is None or _studied_days(cur, sid, sponsor["tz"], start, end) < 1:
            continue
        _reward(cur, sid, fid, "week", period, WEEK)


def settle(cur, user_id: str, now: datetime, force: bool = False) -> None:
    """Bring this learner's referrals up to date, both ways, at most once a
    minute a learner (the study-day reads are the dear part)."""
    tick = time.monotonic()
    if not force and _settled.get(user_id, 0) > tick:
        return
    for row in _rows(cur, "filleul_id", user_id) + _rows(cur, "sponsor_id", user_id):
        _settle_row(cur, row, now)
    _settled[user_id] = tick + _SETTLE_TTL_S


# ── Paying ────────────────────────────────────────────────────────────
def _pay_learner(cur, user_id: str, n: int, ref: str) -> dict:
    """Credits, or on the pass the same number as level-only XP."""
    from core.srs_instance import srs
    from srs.srs import REFERRAL_SOURCE
    if credits_mod.unlimited_on(cur, user_id):
        srs.award_xp(user_id, REFERRAL_SOURCE, ref, n, cur=cur)
        return {"credits": 0, "xp": n}
    credits_mod.award(user_id, n, "referral", ref, cur=cur)
    return {"credits": n, "xp": 0}


def _paid_this_month(cur, sponsor_id: str, tz, now: datetime) -> int:
    today = credits_mod.local_today(tz, now)
    start = credits_mod._midnight_starting(today.replace(day=1), tz)
    cur.execute("SELECT COALESCE(SUM(paid), 0) FROM referral_rewards WHERE sponsor_id = %s AND paid_at >= %s "
                "AND kind <> 'max_week'", (sponsor_id, start))
    return int(cur.fetchone()[0])


def _pay_rewards(cur, sponsor_id: str, where: str, params: tuple, now: datetime) -> dict:
    me = _profile(cur, sponsor_id)
    tz = me["tz"] if me else None
    cur.execute(f"SELECT filleul_id, kind, period, credits FROM referral_rewards WHERE sponsor_id = %s "
                f"AND paid_at IS NULL AND kind <> 'max_week' AND {where} ORDER BY period FOR UPDATE",
                (sponsor_id, *params))
    total = {"credits": 0, "xp": 0}
    for fid, kind, period, n in cur.fetchall():
        room = max(0, MONTH_CAP - _paid_this_month(cur, sponsor_id, tz, now))
        give = min(n, room)
        cur.execute("UPDATE referral_rewards SET paid_at = NOW(), paid = %s WHERE filleul_id = %s AND kind = %s "
                    "AND period = %s AND paid_at IS NULL", (give, fid, kind, period))
        if cur.rowcount != 1 or give <= 0:
            continue
        got = _pay_learner(cur, sponsor_id, give, f"sponsor:{fid}:{kind}:{period.isoformat()}")
        total["credits"] += got["credits"]
        total["xp"] += got["xp"]
        events.record(sponsor_id, "referral_claimed", {"kind": kind}, cur=cur)
    return total


def claim(sponsor_id: str, username: str, now: datetime | None = None) -> dict | None:
    """Collect what one filleul has earned the parrain: every reward of
    theirs not yet paid, under the month's cap. None when nothing waits."""
    from core.srs_instance import srs
    from study import duel_friends
    now = now or datetime.now(timezone.utc)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            found = duel_friends.find(cur, username)
            if found is None:
                conn.rollback()
                return None
            settle(cur, sponsor_id, now, force=True)
            got = _pay_rewards(cur, sponsor_id, "filleul_id = %s", (found[0],), now)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    credits_mod.forget(sponsor_id)
    srs.forget_history(sponsor_id)
    return got if (got["credits"] or got["xp"]) else None


def grant_max_week(filleul_id: str, now: datetime | None = None) -> dict | None:
    """A filleul's first real payment gives their parrain a week of the pass
    (the payment's webhook calls this; no route does). Once a filleul, at
    most MAX_WEEKS a year a parrain; a parrain already on an endless pass is
    given MAX_WEEK_XP level-only XP instead. None when nothing is owed."""
    from core.srs_instance import srs
    from srs.srs import REFERRAL_SOURCE
    now = now or datetime.now(timezone.utc)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT sponsor_id FROM referrals WHERE filleul_id = %s AND accepted_at IS NOT NULL "
                        "AND converted_at IS NOT NULL AND released_at IS NULL", (filleul_id,))
            row = cur.fetchone()
            if row is None:
                conn.rollback()
                return None
            sponsor = row[0]
            cur.execute("SELECT plan, plan_until FROM user_profiles WHERE user_id = %s FOR UPDATE", (sponsor,))
            prof = cur.fetchone()
            if prof is None:
                conn.rollback()
                return None
            cur.execute("SELECT COUNT(*) FROM referral_rewards WHERE sponsor_id = %s AND kind = 'max_week' "
                        "AND done_at >= %s", (sponsor, now - timedelta(days=365)))
            if cur.fetchone()[0] >= MAX_WEEKS:
                conn.rollback()
                return None
            if not _reward(cur, sponsor, filleul_id, "max_week", now.date(), 0):
                conn.rollback()
                return None
            plan, until = prof
            if plan == "pass" and until is None:
                srs.award_xp(sponsor, REFERRAL_SOURCE, f"max_week:{filleul_id}", MAX_WEEK_XP, cur=cur)
                given = {"xp": MAX_WEEK_XP, "until": None}
            else:
                base = until if (plan == "pass" and until and until > now) else now
                new_until = base + timedelta(days=7)
                cur.execute("UPDATE user_profiles SET plan = 'pass', plan_until = %s WHERE user_id = %s",
                            (new_until, sponsor))
                given = {"xp": 0, "until": new_until.isoformat()}
            cur.execute("UPDATE referral_rewards SET paid_at = NOW(), paid = 0 WHERE filleul_id = %s "
                        "AND kind = 'max_week' AND period = %s", (filleul_id, now.date()))
            events.record(sponsor, "referral_claimed", {"kind": "max_week"}, cur=cur)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    credits_mod.forget(sponsor)
    srs.forget_history(sponsor)
    return given


def told(user_id: str) -> None:
    """The filleul has been shown that their conversion paid."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE referrals SET told_at = NOW() WHERE filleul_id = %s AND converted_at IS NOT NULL "
                        "AND told_at IS NULL", (user_id,))
        conn.commit()
    finally:
        conn.close()


# ── The surface ───────────────────────────────────────────────────────
def _gift(n: int, unlimited: bool) -> dict:
    return {"credits": 0, "xp": n} if unlimited else {"credits": n, "xp": 0}


def view(user_id: str, now: datetime | None = None) -> dict:
    """GET /api/referral: the learner's own parrain (or the door to name
    one), the learners they sponsor and the requests waiting on them, their
    link, and what each step pays them."""
    from core.srs_instance import srs
    now = now or datetime.now(timezone.utc)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            me = _profile(cur, user_id)
            if me is None:
                from routes.profile import ensure_profile_row
                ensure_profile_row(user_id)
                me = _profile(cur, user_id)
            unlimited = credits_mod.unlimited_on(cur, user_id)
            settle(cur, user_id, now)
            # A reward nobody collected for a fortnight is paid anyway.
            settled = _pay_rewards(cur, user_id, "done_at < %s", (now - SETTLE_AFTER,), now)
            mine = _rows(cur, "filleul_id", user_id)
            theirs = _rows(cur, "sponsor_id", user_id)
            cur.execute("SELECT filleul_id, COALESCE(SUM(credits), 0) FROM referral_rewards WHERE sponsor_id = %s "
                        "AND paid_at IS NULL AND kind <> 'max_week' GROUP BY filleul_id", (user_id,))
            owed = {f: int(n) for f, n in cur.fetchall()}
            cur.execute("SELECT filleul_id, COUNT(*) FROM referral_rewards WHERE sponsor_id = %s AND kind = 'week' "
                        "GROUP BY filleul_id", (user_id,))
            weeks = {f: int(n) for f, n in cur.fetchall()}
            filleuls, requests = [], []
            for r in theirs:
                if r["released_at"] is not None or r["refused_at"] is not None:
                    continue
                if r["accepted_at"] is None:
                    requests.append({"username": r["username"]})
                    continue
                filleuls.append(_filleul(cur, r, now, owed.get(r["filleul_id"], 0), weeks.get(r["filleul_id"], 0)))
            sponsor = None
            if mine:
                r = mine[0]
                sponsor = _sponsor(cur, r, now)
            window_end = me["created_at"] + timedelta(days=CHOOSE_DAYS)
            open_ = (not mine or (mine[0]["refused_at"] is not None and mine[0]["released_at"] is None))
            can_choose = open_ and window_end > now
            days_left = -(-int((window_end - now).total_seconds()) // 86400) if can_choose else 0
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    if settled["credits"] or settled["xp"]:
        credits_mod.forget(user_id)
        srs.forget_history(user_id)
    welcome = bool(mine and mine[0]["converted_at"] and not mine[0]["told_at"] and not mine[0]["released_at"])
    return {
        "handle": me["username"],
        "link": LINK.format(handle=me["username"]),
        "unit": "xp" if unlimited else "credits",
        "rewards": {"conversion": _gift(CONVERSION, unlimited), "week": _gift(WEEK, unlimited),
                    "filleul": FILLEUL, "weeks": WEEKS, "cap": MONTH_CAP},
        "me": {"sponsor": sponsor, "canChoose": can_choose, "daysLeft": days_left, "welcome": welcome},
        "sponsoring": {"slots": SLOTS, "filleuls": filleuls, "requests": requests,
                       "owed": sum(f["owed"] for f in filleuls)},
    }


def notice_open(user_id: str, now: datetime | None = None) -> bool:
    """Whether Today's gate says a word of the referral (GET /api/profile's
    `referralNotice`): to a new learner while they may name a parrain, then
    on the way to their reward (the WINDOW_DAYS days), once to say it was
    paid, and to a parrain someone has named and who has not answered. Read
    in one query, so a learner with none of these asks nothing more."""
    now = now or datetime.now(timezone.utc)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT p.created_at, r.filleul_id IS NOT NULL, r.refused_at, r.converted_at, r.released_at,
                          r.told_at,
                          EXISTS (SELECT 1 FROM referrals q WHERE q.sponsor_id = p.user_id
                                  AND q.accepted_at IS NULL AND q.refused_at IS NULL AND q.released_at IS NULL)
                   FROM user_profiles p LEFT JOIN referrals r ON r.filleul_id = p.user_id
                   WHERE p.user_id = %s""",
                (user_id,),
            )
            row = cur.fetchone()
    finally:
        conn.close()
    if row is None:
        return False
    created, named, refused, converted, released, told, asked = row
    if asked:
        return True
    if released is not None:
        return False
    if converted is not None:
        return told is None
    if not named or refused is not None:
        return created + timedelta(days=CHOOSE_DAYS) > now
    return created + timedelta(days=WINDOW_DAYS) > now


def _sponsor(cur, r: dict, now: datetime) -> dict:
    state = ("released" if r["released_at"] else "refused" if r["refused_at"] else "converted" if r["converted_at"]
             else "accepted" if r["accepted_at"] else "asked")
    out = {"username": r["sponsor_name"], "state": state}
    if state in ("asked", "accepted"):
        start = r["created_at"]
        out.update(studyDays=min(STUDY_DAYS, _studied_days(cur, r["filleul_id"], r["tz"], start,
                                                           start + timedelta(days=WINDOW_DAYS))),
                   studyOf=STUDY_DAYS, windowDay=min(WINDOW_DAYS, (now - start).days + 1), window=WINDOW_DAYS)
    return out


def _filleul(cur, r: dict, now: datetime, owed: int, weeks_paid: int) -> dict:
    out = {"username": r["username"], "owed": owed, "canRelease": _quiet(cur, r, now)}
    if r["converted_at"] is None:
        start = r["created_at"]
        out.update(state="pending",
                   studyDays=min(STUDY_DAYS, _studied_days(cur, r["filleul_id"], r["tz"], start,
                                                           start + timedelta(days=WINDOW_DAYS))),
                   studyOf=STUDY_DAYS, windowDay=min(WINDOW_DAYS, (now - start).days + 1), window=WINDOW_DAYS)
        return out
    start = _week_start(r["tz"], now)
    days = _studied_days(cur, r["filleul_id"], r["tz"], start, start + timedelta(weeks=1))
    over = r["converted_at"] + timedelta(weeks=WEEKS + 1) <= now
    out.update(state="done" if over else "active", weekDays=min(ACTIVE_DAYS, days), weekOf=ACTIVE_DAYS,
               weeksPaid=weeks_paid, weeks=WEEKS)
    return out
