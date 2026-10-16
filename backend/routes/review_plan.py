"""回復運転 — the review plan's routes (plan 217).

What the learner sets about the day's REVIEWS (core/review_plan.py has
the model and the reasons): the comeback sheet's answer on Today, and
Settings › Reviews -- the ceiling, the catch-up under way, an absence
declared ahead. Every write answers with the plan as it now stands,
the shape GET returns, so a screen redraws from what the server holds.

Every body is bounded (plan 211): a choice from a closed set, a day
count from SPREAD_DAYS, a ceiling in [CAP_MIN, CAP_MAX], an absence of
at most AWAY_MAX_DAYS starting today or later.
"""
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from core import events, review_plan
from core.auth import get_user_id
from study import review_cap

router = APIRouter()
logger = logging.getLogger(__name__)


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _state(user_id: str) -> dict:
    """The plan as Settings › Reviews draws it: the ceiling and the
    choices it offers, the learner's daily load (for the warning a
    ceiling under it earns), the catch-up and the absence."""
    plan = review_plan.read_plan(user_id)
    return {
        "reviewCap": plan.review_cap,
        "capChoices": list(review_plan.CAP_CHOICES),
        "load": round(review_plan.daily_load(user_id)),
        "catchup": plan.catchup_payload(_today()),
        "away": plan.away_payload(),
        "awayMaxDays": review_plan.AWAY_MAX_DAYS,
    }


@router.get("/api/review-plan")
def get_review_plan(user_id: str = Depends(get_user_id)):
    return _state(user_id)


class CapPayload(BaseModel):
    """The ceiling, or null for none."""
    reviewCap: int | None

    @field_validator("reviewCap")
    @classmethod
    def valid_cap(cls, v: int | None) -> int | None:
        if v is not None and not (review_plan.CAP_MIN <= v <= review_plan.CAP_MAX):
            raise ValueError(f"must be between {review_plan.CAP_MIN} and {review_plan.CAP_MAX}")
        return v


@router.put("/api/review-plan/cap")
def put_review_cap(payload: CapPayload, user_id: str = Depends(get_user_id)):
    review_plan.set_cap(user_id, payload.reviewCap)
    events.record(user_id, "review_cap_set", {"cap": payload.reviewCap})
    return _state(user_id)


class CatchupPayload(BaseModel):
    """The comeback sheet's answer: spread the backlog over `days`
    (one of SPREAD_DAYS), twenty a day with no end, or all of it now."""
    choice: Literal["spread", "gentle", "all"]
    days: int | None = None

    @field_validator("days")
    @classmethod
    def valid_days(cls, v: int | None) -> int | None:
        if v is not None and v not in review_plan.SPREAD_DAYS:
            raise ValueError(f"must be one of {review_plan.SPREAD_DAYS}")
        return v


def _owed(user_id: str) -> int:
    """The reviews the gate would print uncut: what a spread divides."""
    from routes.today import _day_queue  # lazily: today imports the plan's core
    queue = _day_queue(user_id)
    if queue.plan.cap is not None:
        return queue.cut.owed
    return review_cap.owed(queue.cut.lanes, set())


@router.post("/api/review-plan/catchup")
def post_catchup(payload: CatchupPayload, user_id: str = Depends(get_user_id)):
    """Priced as the offer was (core/review_plan.comeback), from the
    backlog as it stands now. "All" starts nothing and quiets the offer
    for DECLINE_QUIET_DAYS."""
    days, per_day = None, None
    if payload.choice == "all":
        review_plan.stop_catchup(user_id)
        review_plan.decline(user_id)
    elif payload.choice == "gentle":
        per_day = review_plan.GENTLE_PER_DAY
        review_plan.start_catchup(user_id, per_day, None)
    else:
        days = payload.days or review_plan.DEFAULT_SPREAD_DAYS
        per_day = review_cap.spread_per_day(_owed(user_id), days, review_plan.daily_load(user_id),
                                            review_plan.SPREAD_FLOOR)
        review_plan.start_catchup(user_id, per_day, days)
    events.record(user_id, "catchup_choice", {"choice": payload.choice, "days": days, "per_day": per_day})
    logger.info("catch-up chosen user_id=%s choice=%s days=%s per_day=%s", user_id, payload.choice, days, per_day)
    return _state(user_id)


@router.delete("/api/review-plan/catchup")
def delete_catchup(user_id: str = Depends(get_user_id)):
    """Stop a catch-up from Settings: the gate is the learner's own again,
    under their ceiling if they have one."""
    review_plan.stop_catchup(user_id)
    return _state(user_id)


class AwayPayload(BaseModel):
    start: date
    until: date


@router.put("/api/review-plan/away")
def put_away(payload: AwayPayload, user_id: str = Depends(get_user_id)):
    today = _today()
    # The device's date may be a day ahead of or behind the queue's UTC
    # day; a start of yesterday by UTC is today for a learner east of it.
    if payload.start < today - timedelta(days=1):
        raise HTTPException(status_code=422, detail="away_in_past")
    if payload.until < payload.start:
        raise HTTPException(status_code=422, detail="away_order")
    days = (payload.until - payload.start).days + 1
    if days > review_plan.AWAY_MAX_DAYS:
        raise HTTPException(status_code=422, detail="away_too_long")
    review_plan.set_away(user_id, payload.start, payload.until)
    events.record(user_id, "away_set", {"days": days})
    return _state(user_id)


@router.delete("/api/review-plan/away")
def delete_away(user_id: str = Depends(get_user_id)):
    review_plan.set_away(user_id, None, None)
    events.record(user_id, "away_set", {"days": 0})
    return _state(user_id)
