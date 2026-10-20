"""番付 — the board's routes (plan 262).

`GET /api/leaderboard` pages any of the three boards (lifetime, the
week, a division), optionally only the learners at the reader's own JLPT
level, with the reader's own row, the rows around it and the gap to the
next place. `GET /api/leaderboard/learner/{username}` is the card a row
opens: what the board already says about that learner (their XP, their
level, their places, their division), and the decks they published to
the library -- nothing a learner did not put in front of others already
(privacy.html: other learners see the username, on the board and on a
published deck). Never their streak, their JLPT level or their card's
name. The logic is study/banzuke.py's; this file names the
rows (a username, never a user id) and holds every parameter to a bound.
"""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from core.auth import get_user_id
from core.db import db_conn
from core.srs_instance import srs
from routes.profile import _get_or_create_username, usernames_for
from srs.xp import level_progress
from study import banzuke

router = APIRouter()

try:
    banzuke.init_db()
except Exception:  # pragma: no cover - a missing DB must not stop import
    import logging
    logging.getLogger(__name__).exception("the board's tables could not be initialised")

# The decks a learner's card lists, newest first.
CARD_DECKS = 5


def _named(rows: list[dict], names: dict[str, str], lifetime: dict[str, int]) -> list[dict]:
    out = []
    for r in rows:
        uid = r.pop("user_id")
        r["username"] = names.get(uid) or _get_or_create_username(uid)
        r["level"] = level_progress(lifetime.get(uid, 0))["level"]
        if r.get("gap"):
            gap_uid = r["gap"].pop("user_id")
            r["gap"]["username"] = names.get(gap_uid) or _get_or_create_username(gap_uid)
        out.append(r)
    return out


@router.get("/api/leaderboard")
def get_leaderboard(
    limit: int = Query(20, ge=1, le=200),
    # A page of the whole board (plan 262): the list goes as far as the
    # learners do, and the bound is on the request, not on the board.
    offset: int = Query(0, ge=0, le=100000),
    # The rows either side of the reader's own place.
    around: int = Query(0, ge=0, le=5),
    # 通算, 今週 or 段: lifetime, the calendar week, the reader's division.
    period: Literal["all", "week", "division"] = Query("all"),
    # Everyone, or only the learners at the reader's own JLPT level.
    scope: Literal["all", "level"] = Query("all"),
    # Another division than the reader's, for the division board.
    division: int | None = Query(None, ge=0, le=banzuke.TOP),
    user_id: str = Depends(get_user_id),
):
    board = banzuke.read(srs, user_id, period, scope, limit=limit, offset=offset,
                         around=around, division=division)
    ids = {r["user_id"] for r in (*board["entries"], *board["near"], board["me"], *board.get("champions", []))}
    if board["me"].get("gap"):
        ids.add(board["me"]["gap"]["user_id"])
    names = usernames_for(sorted(ids))
    lifetime = banzuke.totals(srs, None)
    board["entries"] = _named(board["entries"], names, lifetime)
    board["near"] = _named(board["near"], names, lifetime)
    board["me"] = _named([board["me"]], names, lifetime)[0]
    if "champions" in board:
        board["champions"] = _named(board["champions"], names, lifetime)
    return board


@router.get("/api/leaderboard/learner/{username}")
def get_learner(
    username: str = Path(..., pattern=r"^[a-zA-Z0-9_]{3,20}$"),
    user_id: str = Depends(get_user_id),
):
    """The card a board's row opens. A learner who keeps off the board
    is nobody's to open but their own."""
    roster = banzuke.roster()
    uid = next((u for u, (name, _, _) in roster.items() if name == username), None)
    if uid is None or (roster[uid][2] and uid != user_id):
        raise HTTPException(status_code=404, detail="no such learner")
    xp = banzuke.totals(srs, None).get(uid, 0)
    start = banzuke.week_start(banzuke._now())
    banzuke.settle(srs, start)
    division, _ = banzuke.division_of(uid, start)

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, type FROM decks
                WHERE user_id = %s AND visibility = 'public' AND withdrawn_at IS NULL
                ORDER BY published_at DESC NULLS LAST, id DESC
                LIMIT %s
                """,
                (uid, CARD_DECKS),
            )
            decks = [{"id": i, "name": n, "type": t} for i, n, t in cur.fetchall()]
    finally:
        conn.close()

    return {
        "username": username,
        "me": uid == user_id,
        "level": level_progress(xp)["level"],
        "xp": xp,
        "weekXp": banzuke.totals(srs, start).get(uid, 0),
        "division": {"index": division, "key": banzuke.DIVISIONS[division]},
        "places": {"all": banzuke.place(srs, uid, "all"), "week": banzuke.place(srs, uid, "week")},
        "decks": decks,
    }
