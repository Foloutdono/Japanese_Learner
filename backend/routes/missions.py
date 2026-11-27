"""任務 — the missions' routes (plan 331; study/missions.py has the rules).

    GET  /api/missions         the day's three and its bonus, the week's
                               three, what waits to be collected
    GET  /api/missions/book    the discoveries and the achievements
    POST /api/missions/claim   collect one reward, once

No parameter is free: the claim's scope and kind are closed sets, the two
reads take none. Plain `def`s, so the work runs off the event loop; a
learner's requests are queued a few at a time (core/concurrency.py).
"""
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.auth import get_user_id
from study import missions

router = APIRouter()

Kind = Literal[
    "due", "new", "practice", "accuracy", "write",
    "duel", "explain", "analyze", "comprehension", "dictation", "read", "conversation",
    "message", "translation", "composition", "exam", "in_out", "ask",
    "days5", "volume", "new_mode", "exam_section", "duels5", "write10", "all3",
    "first_dictation", "first_photo", "first_conversation", "first_exam", "first_deck",
    "first_friend", "first_duel", "arrival_date", "first_import", "first_video",
    "kana_done", "words_100", "words_500", "words_1000", "grammar_n5",
    "days_7", "days_30", "days_100", "exam_passed", "ranked_win",
]


class Claim(BaseModel):
    scope: Literal["day", "week", "bonus", "mark"]
    kind: Kind


@router.get("/api/missions")
def get_missions(user_id: str = Depends(get_user_id)):
    return missions.view(user_id)


@router.get("/api/missions/book")
def get_book(user_id: str = Depends(get_user_id)):
    return missions.book(user_id)


@router.post("/api/missions/claim")
def post_claim(body: Claim, user_id: str = Depends(get_user_id)):
    """What was collected, or `paid: null` when there was nothing to
    collect (not done, nothing studied yet, or collected a moment ago)."""
    got = missions.claim(user_id, body.scope, body.kind)
    return {"paid": got, "missions": missions.view(user_id)}
