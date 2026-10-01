"""GET /api/credits — the balance the HUD's pass prints (plan 069).
Reading it settles the account (a new one is seeded, a clock that has
never run is started) and counts what the refill has landed without
claiming it: POST /api/credits/claim is what writes that to the ledger
-- the "while you were away" sheet's button, and the app's quiet claim
as each credit lands while it is open (plan 141). GET /api/credits/week
is the offer's week and POST /api/credits/stop what a stopped run left
waiting (plan 171). See core/credits.py."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from core import credits
from core.auth import get_user_id

router = APIRouter()


@router.get("/api/credits")
def get_credits(user_id: str = Depends(get_user_id)):
    return credits.summary(user_id)


@router.post("/api/credits/claim")
def claim_credits(user_id: str = Depends(get_user_id)):
    return credits.claim(user_id)


@router.get("/api/credits/week")
def credits_week(user_id: str = Depends(get_user_id)):
    return credits.week(user_id)


class Stop(BaseModel):
    # What was left of the run the balance stopped: a count, never
    # which cards.
    cards: int = Field(ge=1, le=credits.STOP_MAX)


@router.post("/api/credits/stop")
def credits_stop(body: Stop, user_id: str = Depends(get_user_id)):
    return {"cards": credits.record_stop(user_id, body.cards)}
