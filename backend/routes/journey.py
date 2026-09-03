# ── 路線図 — the journey endpoints ────────────────────────────────
# The routes behind the ghost train on the back of the commuter pass
# (plan 063), and behind 行先, the settings counter that changes what
# the pass promises:
#
#   GET    /api/journey/status  the contract + the two measured facts
#   POST   /api/journey/reprint move the date, the pace or the hour, in ink
#   POST   /api/journey/goal    issue a destination onto the pass (発行)
#   DELETE /api/journey/goal    hand the destination back (払戻)
#
# The last two are the settings counter's half of the office: the
# onboarding flow signs the first contract, 行先 in /settings signs
# every one after it. They are NOT reprints — a reprint moves a
# promise that exists, and issuing a destination makes a new one.
#
# The endpoint returns FACTS, never projections: the arrival math
# (projected date, delta days, recovery pace, status word) lives in the
# frontend's domain layer, the same split /api/onboarding/volumes
# already made for the onboarding board — one honesty engine, not two
# that can disagree by a rounding rule.
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from core.auth import get_user_id
from core.db import db_conn
from core.srs_instance import srs
from core.user_level import LEVELS
from routes.onboarding import DEPARTURES, VOLUMES
from routes.profile import ensure_profile_row

router = APIRouter()

WINDOW_DAYS = 14


def _journey_row(user_id: str):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT jlpt_level, daily_new_target, goal_start_level,
                       goal_level, goal_target_date, goal_set_at,
                       daily_departure
                FROM user_profiles WHERE user_id = %s
                """,
                (user_id,),
            )
            return cur.fetchone()
    finally:
        conn.close()


def _journey_levels(start: str, goal: str | None) -> list[str]:
    """The levels a journey covers, boarding level included. No goal =
    the whole line ahead (start..N1), so the pace-only pass back still
    reports against something real."""
    a = LEVELS.index(start)
    b = LEVELS.index(goal) if goal else len(LEVELS) - 1
    return list(LEVELS[a:b + 1])


def _items_total(levels: list[str], include_kana: bool) -> int:
    total = VOLUMES["kana"] if include_kana else 0
    for lvl in levels:
        total += VOLUMES["vocab"][lvl] + VOLUMES["kanji"][lvl] + VOLUMES["grammar"][lvl]
    return total


def _status_payload(user_id: str) -> dict:
    row = _journey_row(user_id)
    if row is None or row[0] is None:
        # Never onboarded (or no row at all): every field present, all
        # null/zero, so the client needs no second shape for this case.
        return {
            "goalStartLevel": None,
            "goalLevel": None,
            "goalTargetDate": None,
            "goalSetAt": None,
            "dailyDeparture": None,
            "plannedPerDay": None,
            "itemsTotal": 0,
            "itemsDone": 0,
            "actual14": 0,
            "days14": WINDOW_DAYS,
        }
    (jlpt_level, daily_new_target, goal_start_level, goal_level,
     goal_target_date, goal_set_at, daily_departure) = row
    start = goal_start_level or jlpt_level
    levels = _journey_levels(start, goal_level)
    # The kana front-load belongs to the journey exactly when the line
    # begins at N5 — the beginner path and the N5 picker both board
    # there, and counting the glyphs in BOTH itemsTotal and itemsDone
    # (get_journey_item_counts applies the same rule) keeps the train's
    # position honest either way. Plan 063 open question 2, settled by
    # the cheapest answer that lies to nobody.
    include_kana = start == "N5"
    counts = srs.get_journey_item_counts(
        user_id, goal_set_at, levels, include_kana, window_days=WINDOW_DAYS
    )
    return {
        "goalStartLevel": goal_start_level,
        "goalLevel": goal_level,
        "goalTargetDate": goal_target_date.isoformat() if goal_target_date else None,
        "goalSetAt": goal_set_at.isoformat() if goal_set_at else None,
        "dailyDeparture": daily_departure,
        "plannedPerDay": daily_new_target,
        "itemsTotal": _items_total(levels, include_kana),
        # itemsDone is "since the goal was set" when there is a goal,
        # "ever" when there isn't (goal_set_at NULL) — the pace-only
        # pass back reports lifetime position on the open line.
        "itemsDone": counts["items_done"],
        # actual14 is a COUNT over the window; the client divides by
        # days14. Sending the raw pair keeps the rounding rule in one
        # place (the frontend's goal math) instead of two.
        "actual14": counts["new_in_window"],
        "days14": WINDOW_DAYS,
    }


@router.get("/api/journey/status")
def journey_status(user_id: str = Depends(get_user_id)):
    return _status_payload(user_id)


class ReprintPayload(BaseModel):
    """At least one of the three (checked in the route: 'none' is a
    caller bug, same convention as PATCH /api/profile/learning).
    goal_set_at deliberately survives a reprint: the contract began
    when it began — a reprint moves the promise, not history. A reprint
    ledger is deferred, not half-built (plan 063).

    dailyDeparture is the one field whose None is a VALUE (自由,
    flexible) rather than 'not sent', so the route reads
    model_fields_set for it instead of testing for None — otherwise
    the hour could be set from the settings counter and never
    cleared."""
    goalTargetDate: date | None = None
    dailyNewTarget: int | None = None
    dailyDeparture: str | None = None

    @field_validator("goalTargetDate")
    @classmethod
    def valid_goal_date(cls, v: date | None) -> date | None:
        if v is not None and v <= date.today():
            raise ValueError("must be in the future")
        return v

    @field_validator("dailyNewTarget")
    @classmethod
    def valid_target(cls, v: int | None) -> int | None:
        # Same free-integer knob as onboarding's pace bound.
        if v is not None and not (1 <= v <= 100):
            raise ValueError("must be between 1 and 100")
        return v

    @field_validator("dailyDeparture")
    @classmethod
    def valid_departure(cls, v: str | None) -> str | None:
        # NULL is 自由; the client never sends a fourth string. Same
        # rule as onboarding's own departure field.
        if v is not None and v not in DEPARTURES:
            raise ValueError(f"must be one of {', '.join(DEPARTURES)} or null")
        return v


@router.post("/api/journey/reprint")
def journey_reprint(payload: ReprintPayload, user_id: str = Depends(get_user_id)):
    departure_sent = "dailyDeparture" in payload.model_fields_set
    if (payload.goalTargetDate is None and payload.dailyNewTarget is None
            and not departure_sent):
        raise HTTPException(status_code=422, detail="Nothing to reprint")
    ensure_profile_row(user_id)
    row = _journey_row(user_id)
    goal_level = row[3] if row else None
    if payload.goalTargetDate is not None and goal_level is None:
        raise HTTPException(
            status_code=422,
            detail="No destination to move — set a goal at the office first",
        )
    sets, args = [], []
    if payload.goalTargetDate is not None:
        sets.append("goal_target_date = %s")
        args.append(payload.goalTargetDate)
    if payload.dailyNewTarget is not None:
        sets.append("daily_new_target = %s")
        args.append(payload.dailyNewTarget)
    if departure_sent:
        sets.append("daily_departure = %s")
        args.append(payload.dailyDeparture)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE user_profiles SET {', '.join(sets)} WHERE user_id = %s",
                (*args, user_id),
            )
        conn.commit()
    finally:
        conn.close()
    # The fresh facts, so the pass back can redraw without a second
    # round trip — and the front's gold 有効期限 with it.
    return _status_payload(user_id)


class GoalPayload(BaseModel):
    """行先 — a destination issued onto a pass from the settings
    counter, replacing whatever it carried. Not a reprint: a reprint
    moves a promise that exists, so it keeps goal_set_at, while this
    signs a NEW contract and must stamp it (the itemsDone window is
    anchored there — see _status_payload).

    dailyNewTarget rides along because a destination and the pace that
    reaches it are one decision, priced together on the departure
    board (components/onboarding/DepartureBoard.jsx). Sending none
    leaves the pace exactly as it stands.

    goalTargetDate is optional for the same reason it is in
    domain/goalMath's journeyModel: a goal signed by pace alone still
    has an arrival, the one its own signing maths implies."""
    goalLevel: str
    goalTargetDate: date | None = None
    dailyNewTarget: int | None = None

    @field_validator("goalLevel")
    @classmethod
    def valid_goal_level(cls, v: str) -> str:
        if v not in LEVELS:
            raise ValueError(f"must be one of {', '.join(LEVELS)}")
        return v

    @field_validator("goalTargetDate")
    @classmethod
    def valid_goal_date(cls, v: date | None) -> date | None:
        if v is not None and v <= date.today():
            raise ValueError("must be in the future")
        return v

    @field_validator("dailyNewTarget")
    @classmethod
    def valid_target(cls, v: int | None) -> int | None:
        if v is not None and not (1 <= v <= 100):
            raise ValueError("must be between 1 and 100")
        return v


@router.post("/api/journey/goal")
def journey_goal(payload: GoalPayload, user_id: str = Depends(get_user_id)):
    ensure_profile_row(user_id)
    row = _journey_row(user_id)
    # The boarding level is where the learner stands TODAY, not where
    # an older contract boarded: re-signing at N4 must not keep
    # promising the N5 volume. Same stamp routes/onboarding.py makes,
    # for the same reason — itemsTotal must never drift when
    # jlpt_level later moves.
    start = row[0] if row else None
    if start is None:
        raise HTTPException(
            status_code=422,
            detail="No boarding level — complete the office first",
        )
    if LEVELS.index(payload.goalLevel) <= LEVELS.index(start):
        raise HTTPException(
            status_code=422,
            detail=f"goalLevel must be beyond {start}",
        )
    sets = [
        "goal_start_level = %s",
        "goal_level = %s",
        "goal_target_date = %s",
        "goal_set_at = NOW()",
    ]
    args = [start, payload.goalLevel, payload.goalTargetDate]
    if payload.dailyNewTarget is not None:
        sets.append("daily_new_target = %s")
        args.append(payload.dailyNewTarget)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE user_profiles SET {', '.join(sets)} WHERE user_id = %s",
                (*args, user_id),
            )
        conn.commit()
    finally:
        conn.close()
    return _status_payload(user_id)


@router.delete("/api/journey/goal")
def journey_goal_cancel(user_id: str = Depends(get_user_id)):
    """払戻 — hand the destination back. The pace and the departure
    hour stay behind: giving up a destination is not giving up the
    ride, and the goal-less pass back still reports on pace kept. The
    four goal columns move as one block, exactly as a goal-less replay
    of the office clears them."""
    ensure_profile_row(user_id)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE user_profiles
                SET goal_start_level = NULL,
                    goal_level = NULL,
                    goal_target_date = NULL,
                    goal_set_at = NULL
                WHERE user_id = %s
                """,
                (user_id,),
            )
        conn.commit()
    finally:
        conn.close()
    return _status_payload(user_id)
