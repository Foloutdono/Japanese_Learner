"""
対戦 — the duels' routes (plan 279).

Thin, as every router here is: the friends are study/duel_friends.py's,
a duel's life study/duels.py's, the Elo study/duel_elo.py's and the
questions study/duel_paper.py's. Every route is a plain `def` (they read
and write the database), every parameter has a bound, a username in a
path or a body has the profile's shape, and a refusal is a code
({"detail": {"code", "message"}}) the screens map to their own words.

  GET    /api/pvp                          the hall in one call
  GET    /api/pvp/search?username=         a learner by exact username
  GET    /api/pvp/friends                  friends, requests, blocks
  POST   /api/pvp/requests                 ask {username}
  POST   /api/pvp/requests/{u}/accept      ... /refuse
  DELETE /api/pvp/requests/{u}             withdraw one's own
  DELETE /api/pvp/friends/{u}              no longer friends
  POST   /api/pvp/blocks, DELETE .../{u}   block, unblock
  POST   /api/pvp/reports                  {username | duelId, reason}
  GET    /api/pvp/learner/{u}              a learner's card
  POST   /api/pvp/duels                    {opponent, mode} or {ranked}
  GET    /api/pvp/duels/{id}               the cover, the result
  POST   /api/pvp/duels/{id}/start         « Partir »
  POST   /api/pvp/duels/{id}/answer        {n, pick}
  POST   /api/pvp/duels/{id}/join          a live room, walked into
  GET    /api/pvp/duels/{id}/live?v=       the room or the race, each second
  POST   /api/pvp/duels/{id}/decline       a friend's challenge, refused
  DELETE /api/pvp/duels/{id}               one's own, while nobody played
  POST   /api/pvp/duels/{id}/review        the corrections, bought; GET reads them again
  GET    /api/pvp/history?offset=&limit=   past duels
  GET    /api/pvp/rating                   the Elo
  GET    /api/pvp/board?scope=             the Elo board, apart from the 番付
"""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field

from core import events
from core.auth import get_user_id
from study import duel_friends as friends, duel_paper, duels
from study import duel_schema  # noqa: F401  -- the seven tables, at import
from study.duel_friends import REPORT_REASONS, Refused

router = APIRouter()

USERNAME = r"^[a-zA-Z0-9_]{3,20}$"
DUEL_ID = 2 ** 62


def _do(fn, *args):
    try:
        return duels.run(fn, *args)
    except Refused as exc:
        raise HTTPException(status_code=exc.status, detail={"code": exc.code, "message": exc.code})


def _id(duel_id: int = Path(..., ge=1, le=DUEL_ID)) -> int:
    return duel_id


class Named(BaseModel):
    username: str = Field(..., pattern=USERNAME)


class ReportPayload(BaseModel):
    username: str | None = Field(default=None, pattern=USERNAME)
    duelId: int | None = Field(default=None, ge=1, le=DUEL_ID)
    reason: Literal[REPORT_REASONS]


class DuelPayload(BaseModel):
    opponent: str | None = Field(default=None, pattern=USERNAME)
    mode: Literal["async", "live"] = "async"
    ranked: bool = False


class AnswerPayload(BaseModel):
    n: int = Field(..., ge=0, le=duel_paper.ITEMS)
    pick: int = Field(..., ge=0, le=3)


def _friend_event(cur, user_id: str, action: str) -> None:
    events.record(user_id, "pvp_friend", {"action": action}, cur=cur)


# ── The hall ────────────────────────────────────────────────────────

@router.get("/api/pvp")
def get_hall(user_id: str = Depends(get_user_id)):
    return _do(duels.hub, user_id)


# ── Friends ─────────────────────────────────────────────────────────

@router.get("/api/pvp/search")
def search(username: str = Query(..., pattern=USERNAME), user_id: str = Depends(get_user_id)):
    """`{username, relation}`, or not found: the username alone, before
    a request is accepted."""
    def go(cur, _after):
        friends.count_search(user_id)
        other, name = friends.reach(cur, user_id, username)
        return {"username": name, "relation": friends.relation(cur, user_id, other)}
    return _do(go)


@router.get("/api/pvp/friends")
def get_friends(user_id: str = Depends(get_user_id)):
    return _do(lambda cur, _after: friends.page(cur, user_id))


@router.post("/api/pvp/requests")
def send_request(payload: Named, user_id: str = Depends(get_user_id)):
    def go(cur, _after):
        other, _name = friends.reach(cur, user_id, payload.username)
        status = friends.request(cur, user_id, other)
        if status == "already":
            return {"status": "friends"}
        _friend_event(cur, user_id, "request" if status == "sent" else "accept")
        return {"status": status}
    return _do(go)


@router.post("/api/pvp/requests/{username}/accept")
def accept_request(username: str = Path(..., pattern=USERNAME), user_id: str = Depends(get_user_id)):
    def go(cur, _after):
        other, _name = friends.reach(cur, user_id, username)
        friends.accept(cur, user_id, other)
        _friend_event(cur, user_id, "accept")
        return {"status": "friends"}
    return _do(go)


@router.post("/api/pvp/requests/{username}/refuse")
def refuse_request(username: str = Path(..., pattern=USERNAME), user_id: str = Depends(get_user_id)):
    def go(cur, _after):
        other, _name = friends.reach(cur, user_id, username)
        friends.refuse(cur, user_id, other)
        _friend_event(cur, user_id, "refuse")
        return {"status": "refused"}
    return _do(go)


@router.delete("/api/pvp/requests/{username}")
def withdraw_request(username: str = Path(..., pattern=USERNAME), user_id: str = Depends(get_user_id)):
    def go(cur, _after):
        other, _name = friends.reach(cur, user_id, username)
        friends.withdraw(cur, user_id, other)
        _friend_event(cur, user_id, "withdraw")
        return {"status": "withdrawn"}
    return _do(go)


@router.delete("/api/pvp/friends/{username}")
def remove_friend(username: str = Path(..., pattern=USERNAME), user_id: str = Depends(get_user_id)):
    def go(cur, after):
        other, _name = friends.reach(cur, user_id, username)
        friends.unfriend(cur, after, user_id, other)
        _friend_event(cur, user_id, "remove")
        return {"status": "removed"}
    return _do(go)


def _anyone(cur, username: str) -> str:
    # Blocking, unblocking and reporting reach past a block.
    found = friends.find(cur, username)
    if found is None:
        raise Refused(404, "pvp_not_found")
    return found[0]


@router.post("/api/pvp/blocks")
def block(payload: Named, user_id: str = Depends(get_user_id)):
    def go(cur, after):
        friends.block(cur, after, user_id, _anyone(cur, payload.username))
        _friend_event(cur, user_id, "block")
        return {"status": "blocked"}
    return _do(go)


@router.delete("/api/pvp/blocks/{username}")
def unblock(username: str = Path(..., pattern=USERNAME), user_id: str = Depends(get_user_id)):
    def go(cur, _after):
        friends.unblock(cur, user_id, _anyone(cur, username))
        _friend_event(cur, user_id, "unblock")
        return {"status": "unblocked"}
    return _do(go)


@router.post("/api/pvp/reports")
def report(payload: ReportPayload, user_id: str = Depends(get_user_id)):
    """A profile, or a duel's other player (who may be « Voyageur »):
    a closed reason, no words."""
    def go(cur, _after):
        if payload.duelId is not None:
            cur.execute(
                "SELECT o.user_id FROM pvp_entries m JOIN pvp_entries o ON o.duel_id = m.duel_id "
                "AND NOT (o.user_id = m.user_id AND o.role = m.role) "
                "WHERE m.duel_id = %s AND m.user_id = %s AND m.role <> 'ghost' LIMIT 1",
                (payload.duelId, user_id),
            )
            row = cur.fetchone()
            if row is None:
                raise Refused(404, "pvp_not_found")
            other = row[0]
        elif payload.username is not None:
            other = _anyone(cur, payload.username)
        else:
            raise Refused(400, "pvp_not_found")
        friends.report(cur, user_id, other, payload.reason, payload.duelId)
        events.record(user_id, "pvp_report", {"reason": payload.reason}, cur=cur)
        return {"status": "reported"}
    return _do(go)


@router.get("/api/pvp/learner/{username}")
def learner(username: str = Path(..., pattern=USERNAME), user_id: str = Depends(get_user_id)):
    def go(cur, _after):
        other, name = friends.reach(cur, user_id, username)
        return friends.card(cur, user_id, other, name)
    return _do(go)


# ── Duels ───────────────────────────────────────────────────────────

@router.post("/api/pvp/duels")
def create_duel(payload: DuelPayload, user_id: str = Depends(get_user_id)):
    """A friend challenged (async or live), or a ranked sprint. A second
    press finds the duel the first one made."""
    def go(cur, after):
        if payload.ranked:
            duel_id, against = duels.ranked(cur, after, user_id)
            return {"id": duel_id, "against": against}
        if payload.opponent is None:
            raise Refused(400, "pvp_no_opponent")
        return {"id": duels.challenge(cur, after, user_id, payload.opponent, payload.mode), "against": "friend"}
    return _do(go)


@router.get("/api/pvp/duels/{duel_id}")
def get_duel(duel_id: int = Depends(_id), user_id: str = Depends(get_user_id)):
    return _do(duels.cover, user_id, duel_id)


@router.post("/api/pvp/duels/{duel_id}/start")
def start_duel(duel_id: int = Depends(_id), user_id: str = Depends(get_user_id)):
    return _do(duels.start, user_id, duel_id)


@router.post("/api/pvp/duels/{duel_id}/answer")
def answer(payload: AnswerPayload, duel_id: int = Depends(_id), user_id: str = Depends(get_user_id)):
    return _do(duels.answer, user_id, duel_id, payload.n, payload.pick)


@router.post("/api/pvp/duels/{duel_id}/join")
def join(duel_id: int = Depends(_id), user_id: str = Depends(get_user_id)):
    return _do(duels.join, user_id, duel_id)


@router.get("/api/pvp/duels/{duel_id}/live")
def live(duel_id: int = Depends(_id), v: int = Query(0, ge=0, le=duel_paper.ITEMS),
         user_id: str = Depends(get_user_id)):
    return _do(duels.live, user_id, duel_id, v)


@router.post("/api/pvp/duels/{duel_id}/decline")
def decline(duel_id: int = Depends(_id), user_id: str = Depends(get_user_id)):
    _do(duels.decline, user_id, duel_id)
    return {"status": "declined"}


@router.delete("/api/pvp/duels/{duel_id}")
def cancel(duel_id: int = Depends(_id), user_id: str = Depends(get_user_id)):
    _do(duels.cancel, user_id, duel_id)
    return {"status": "cancelled"}


@router.post("/api/pvp/duels/{duel_id}/review")
def buy_review(duel_id: int = Depends(_id), user_id: str = Depends(get_user_id)):
    return _do(duels.review, user_id, duel_id, True)


@router.get("/api/pvp/duels/{duel_id}/review")
def read_review(duel_id: int = Depends(_id), user_id: str = Depends(get_user_id)):
    return _do(duels.review, user_id, duel_id, False)


@router.get("/api/pvp/history")
def history(offset: int = Query(0, ge=0, le=10_000), limit: int = Query(20, ge=1, le=50),
            user_id: str = Depends(get_user_id)):
    return _do(duels.history, user_id, offset, limit)


# ── The Elo ─────────────────────────────────────────────────────────

@router.get("/api/pvp/rating")
def get_rating(user_id: str = Depends(get_user_id)):
    return _do(lambda cur, _after: duels.rating(cur, user_id))


@router.get("/api/pvp/board")
def get_board(
    scope: Literal["all", "friends"] = Query("all"),
    offset: int = Query(0, ge=0, le=100_000),
    limit: int = Query(20, ge=1, le=200),
    around: int = Query(0, ge=0, le=5),
    user_id: str = Depends(get_user_id),
):
    return _do(lambda cur, _after: duels.board(cur, user_id, scope, offset, limit, around))
