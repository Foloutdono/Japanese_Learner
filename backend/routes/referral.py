"""縁 — the referral's routes (plan 332; study/referral.py has the rules).

    GET  /api/referral           the learner's parrain, their filleuls and
                                 requests, their link, what each step pays
    POST /api/referral/choose    name a parrain (a username)
    POST /api/referral/answer    a parrain accepts or refuses a request
    POST /api/referral/release   a parrain lets a quiet filleul go
    POST /api/referral/claim     a parrain collects what a filleul earned
    POST /api/referral/told      the filleul has seen their conversion paid

The search of a username is the duels' (GET /api/pvp/search), as the
owner asked. A username is held to the duels' pattern; a refusal is a code
the screen words (referral_not_found, referral_full, referral_self,
referral_closed, referral_active), never a message.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.auth import get_user_id
from study import referral

router = APIRouter()

USERNAME = r"^[a-zA-Z0-9_]{3,20}$"


class Named(BaseModel):
    username: str = Field(..., pattern=USERNAME)


class Answer(Named):
    accept: bool


def _do(fn):
    try:
        return fn()
    except referral.Refused as e:
        raise HTTPException(status_code=e.status, detail={"code": e.code})


@router.get("/api/referral")
def get_referral(user_id: str = Depends(get_user_id)):
    return referral.view(user_id)


@router.post("/api/referral/choose")
def post_choose(body: Named, user_id: str = Depends(get_user_id)):
    _do(lambda: referral.choose(user_id, body.username))
    return referral.view(user_id)


@router.post("/api/referral/answer")
def post_answer(body: Answer, user_id: str = Depends(get_user_id)):
    _do(lambda: referral.answer(user_id, body.username, body.accept))
    return referral.view(user_id)


@router.post("/api/referral/release")
def post_release(body: Named, user_id: str = Depends(get_user_id)):
    _do(lambda: referral.release(user_id, body.username))
    return referral.view(user_id)


@router.post("/api/referral/claim")
def post_claim(body: Named, user_id: str = Depends(get_user_id)):
    paid = referral.claim(user_id, body.username)
    return {"paid": paid, "referral": referral.view(user_id)}


@router.post("/api/referral/told")
def post_told(user_id: str = Depends(get_user_id)):
    referral.told(user_id)
    return {"ok": True}
