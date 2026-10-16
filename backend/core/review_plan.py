# ── 回復運転 — the review plan (plan 216) ─────────────────────────
# What bounds the day's REVIEWS, as core/pace.py bounds its new cards.
# Three things a learner can set, all on user_profiles:
#
#   review_cap        a ceiling of their own, every day (Settings ›
#                     Reviews): 50 / 100 / 150 or none. NULL is none.
#   catchup_*         a catch-up, chosen when the gate offers it after
#                     a stretch away (the comeback sheet on Today): the
#                     backlog spread over a few days, or a gentle twenty
#                     a day with no end date. It ends itself the day the
#                     share no longer holds anything back.
#   away_from/until   an absence declared ahead (Settings › Reviews):
#                     its days keep the streak as rest days do, and the
#                     new cards stop two days before it, so the learner
#                     comes back to less.
#
# The day's share itself is study/review_cap.share's: this module reads
# what it needs, writes what the learner chose, and says what the gate
# offers. Like the pace, every read is a comfort: a failed lookup is no
# plan at all -- the gate as it always was -- never a 500.
import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from core import events
from core.db import db_conn
from study import review_cap

logger = logging.getLogger(__name__)

# The ceiling a learner may set: Settings offers CAP_CHOICES, the
# column takes any figure in [CAP_MIN, CAP_MAX].
CAP_CHOICES = (50, 100, 150)
CAP_MIN, CAP_MAX = 10, 500

# The comeback's offers. A spread is the backlog over SPREAD_DAYS[i]
# days plus a day's own load, never under SPREAD_FLOOR; gentle is
# GENTLE_PER_DAY with no end. DEFAULT_SPREAD_DAYS is the one the sheet
# lights first.
SPREAD_DAYS = (3, 5, 7)
DEFAULT_SPREAD_DAYS = 5
SPREAD_FLOOR = 20
GENTLE_PER_DAY = 20

# When the gate offers it: the reviews it would print are more than
# COMEBACK_LOADS days of the learner's own load, and more than
# COMEBACK_FLOOR whatever the load. "All of them now" is not asked
# again for DECLINE_QUIET_DAYS.
COMEBACK_FLOOR = 60
COMEBACK_LOADS = 3
DECLINE_QUIET_DAYS = 7

# A declared absence: at most AWAY_MAX_DAYS long, starting today or
# later; the new cards stop NEW_PAUSE_BEFORE days before it.
AWAY_MAX_DAYS = 30
NEW_PAUSE_BEFORE = 2

# The columns, in the order read_plan selects them. Declared by
# routes/profile.py's self-migration with every other user_profiles
# column.
COLUMNS = (
    ("review_cap", "INTEGER"),
    ("catchup_cap", "INTEGER"),
    ("catchup_days", "SMALLINT"),
    ("catchup_from", "DATE"),
    ("comeback_declined_on", "DATE"),
    ("away_from", "DATE"),
    ("away_until", "DATE"),
)


def _today() -> date:
    # The queue's day: UTC, as the pace's and the streak's.
    return datetime.now(timezone.utc).date()


@dataclass(frozen=True)
class Plan:
    review_cap: int | None = None
    catchup_cap: int | None = None
    catchup_days: int | None = None
    catchup_from: date | None = None
    declined_on: date | None = None
    away_from: date | None = None
    away_until: date | None = None

    @property
    def catching_up(self) -> bool:
        return self.catchup_cap is not None

    @property
    def cap(self) -> int | None:
        """The ceiling today: the lower of the learner's own and a
        catch-up's, None for neither."""
        caps = [c for c in (self.review_cap, self.catchup_cap) if c is not None]
        return min(caps) if caps else None

    def new_paused(self, today: date) -> bool:
        """No new cards today: a catch-up is under way, or a declared
        absence starts within NEW_PAUSE_BEFORE days or is running."""
        if self.catching_up:
            return True
        if self.away_from and self.away_until:
            return self.away_from - timedelta(days=NEW_PAUSE_BEFORE) <= today <= self.away_until
        return False

    def catchup_payload(self, today: date) -> dict | None:
        """GET /api/today's `catchup`: the share a day, which day of the
        spread this is and of how many (None for gentle, which has no
        end). Past its days a spread keeps going, its day held at the
        last: the learner who missed one finishes it, never fails it."""
        if not self.catching_up:
            return None
        day = (today - self.catchup_from).days + 1 if self.catchup_from else 1
        of = self.catchup_days
        return {"per_day": self.catchup_cap, "day": min(day, of) if of else day, "of": of}

    def quiet(self, today: date) -> bool:
        """"All of them now" was answered within DECLINE_QUIET_DAYS: the
        comeback is not offered again yet."""
        return bool(self.declined_on) and (today - self.declined_on).days < DECLINE_QUIET_DAYS

    def away_payload(self) -> dict | None:
        if not (self.away_from and self.away_until):
            return None
        return {"from": self.away_from.isoformat(), "until": self.away_until.isoformat()}


NO_PLAN = Plan()


def read_plan(user_id: str) -> Plan:
    """The learner's plan, or NO_PLAN when there is no row or the read
    fails."""
    try:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT {', '.join(name for name, _ in COLUMNS)} FROM user_profiles WHERE user_id = %s",
                    (user_id,),
                )
                row = cur.fetchone()
        finally:
            conn.close()
    except Exception:
        logger.exception("review plan lookup failed")
        return NO_PLAN
    return Plan(*row) if row else NO_PLAN


def _write(user_id: str, sets: dict) -> None:
    from routes.profile import ensure_profile_row  # lazily: routes import this module
    ensure_profile_row(user_id)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE user_profiles SET {', '.join(f'{k} = %s' for k in sets)} WHERE user_id = %s",
                (*sets.values(), user_id),
            )
        conn.commit()
    finally:
        conn.close()


def set_cap(user_id: str, cap: int | None) -> None:
    _write(user_id, {"review_cap": cap})


def start_catchup(user_id: str, per_day: int, days: int | None) -> None:
    _write(user_id, {"catchup_cap": per_day, "catchup_days": days, "catchup_from": _today(),
                     "comeback_declined_on": None})


def stop_catchup(user_id: str) -> None:
    _write(user_id, {"catchup_cap": None, "catchup_days": None, "catchup_from": None})


def decline(user_id: str) -> None:
    _write(user_id, {"comeback_declined_on": _today()})


def set_away(user_id: str, start: date | None, until: date | None) -> None:
    """Declare (or, with None, withdraw) an absence. The days the one
    it replaces has already covered are written first, so replacing it
    never takes back a day the streak walked through."""
    bridge_away(user_id)
    _write(user_id, {"away_from": start, "away_until": until})


def bridge_away(user_id: str, plan: Plan | None = None) -> list:
    """srs.bridge_away_days for the declared absence, with its event --
    called where bridge_rest_days is, and before it. A comfort, never a
    reason to fail the screen that asked."""
    from core.srs_instance import srs
    plan = plan or read_plan(user_id)
    if not (plan.away_from and plan.away_until):
        return []
    try:
        days = srs.bridge_away_days(user_id, plan.away_from, plan.away_until)
    except Exception:
        logger.exception("away bridge failed user_id=%s", user_id)
        return []
    if days:
        events.record(user_id, "away_day_used", {"days": len(days)})
    return days


# ── The day's share ──────────────────────────────────────────────
def daily_load(user_id: str) -> float:
    """What falls due on an ordinary day for this learner: the next seven
    days of the forecast, overdue left out (it is folded into today), on
    average. 0 when the forecast fails."""
    from core.srs_instance import srs
    try:
        days = srs.get_due_forecast(user_id, 8)[1:]
    except Exception:
        logger.exception("due forecast failed")
        return 0.0
    return sum(d["count"] for d in days) / len(days) if days else 0.0


def spent_today(user_id: str, lanes) -> tuple[int, set]:
    """(spent, exempt): the pairs reviewed today that the ceiling counts,
    and the (raw_id, mode) pairs of `lanes` it never counts -- reviewed
    today already, or a card first met today."""
    from core.srs_instance import srs
    try:
        pairs, met = srs.get_reviewed_today(user_id)
    except Exception:
        logger.exception("today's reviews failed")
        return 0, set()
    cut = len(user_id) + 1
    met_raw = {cid[cut:] for cid in met}
    reviewed = {(cid[cut:], mode) for cid, mode in pairs}
    spent = sum(1 for raw_id, _ in reviewed if raw_id not in met_raw)
    exempt = set(reviewed)
    for key, ids in lanes.items():
        exempt.update((raw_id, key[-1]) for raw_id in ids if raw_id in met_raw)
    return spent, exempt


@dataclass(frozen=True)
class Cut:
    """The due lanes as the day's share serves them, and the figures
    around it: `held` the reviews the ceiling holds back today, `owed`
    every review it would count before cutting."""
    lanes: object
    held: int
    owed: int


def cut(user_id: str, lanes, due_rows: list, plan: Plan) -> Cut:
    """The due lanes (after the level rule, before the ration) cut to
    the day's share under `plan`'s ceiling; uncut without one."""
    cap = plan.cap
    if cap is None:
        return Cut(lanes, 0, 0)
    spent, exempt = spent_today(user_id, lanes)
    prefix = len(user_id) + 1
    rows = {(r["card_id"][prefix:], r["mode"]): r for r in due_rows}
    shared, held = review_cap.share(lanes, rows, cap, spent, exempt, datetime.now(timezone.utc))
    return Cut(shared, held, review_cap.owed(lanes, exempt))


def settle(user_id: str, plan: Plan, owed: int) -> Plan:
    """End a catch-up whose work is done: what is still owed fits in one
    day's share. Checked on every reading of the gate, so it ends the
    morning of a spread's last day, or the moment a learner who rode
    past the share has left less than a share behind -- and the new
    cards come back with it. Returns the plan as it stands after."""
    if not plan.catching_up or owed > plan.catchup_cap:
        return plan
    try:
        stop_catchup(user_id)
    except Exception:
        logger.exception("catch-up end failed")
        return plan
    taken = (_today() - plan.catchup_from).days + 1 if plan.catchup_from else 1
    events.record(user_id, "catchup_done", {"days": taken})
    return Plan(plan.review_cap, None, None, None, plan.declined_on, plan.away_from, plan.away_until)


def comeback(user_id: str, plan: Plan, owed: int, load: float, days_away: int) -> dict | None:
    """GET /api/today's `comeback`: the offer the gate opens on, or None.
    Offered when no catch-up runs, the reviews the gate would print are
    more than COMEBACK_LOADS days of the learner's load (and more than
    COMEBACK_FLOOR), and "all of them now" was not chosen in the last
    DECLINE_QUIET_DAYS days. Each offer is priced here, so the sheet
    never copies the arithmetic: a spread over each of SPREAD_DAYS, and
    gentle."""
    if plan.catching_up:
        return None
    shown = owed if plan.review_cap is None else min(owed, plan.review_cap)
    if shown <= max(COMEBACK_FLOOR, COMEBACK_LOADS * load):
        return None
    if plan.quiet(_today()):
        return None
    return {
        "owed": owed,
        "days_away": days_away,
        "spread": [
            {"days": d, "per_day": review_cap.spread_per_day(owed, d, load, SPREAD_FLOOR)}
            for d in SPREAD_DAYS
        ],
        "default_days": DEFAULT_SPREAD_DAYS,
        "gentle": {"per_day": GENTLE_PER_DAY},
    }


def days_away(user_id: str) -> int:
    """Whole days since the learner last studied, today left out: 0 for
    one who studied today or yesterday."""
    from core.srs_instance import srs
    try:
        last = srs.last_studied_day(user_id)
    except Exception:
        logger.exception("last studied day failed")
        return 0
    if last is None:
        return 0
    return max(0, (_today() - last).days - 1)
