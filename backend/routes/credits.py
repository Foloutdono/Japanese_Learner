"""GET /api/credits — the balance the HUD's pass prints (plan 069).
Reading it settles the day: a new account is seeded, a due refill is
taken. See core/credits.py."""
from fastapi import APIRouter, Depends

from core import credits
from core.auth import get_user_id

router = APIRouter()


@router.get("/api/credits")
def get_credits(user_id: str = Depends(get_user_id)):
    return credits.summary(user_id)
