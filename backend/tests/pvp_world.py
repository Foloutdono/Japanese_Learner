"""対戦 — what the duels' tests share (plan 279): three learners, a clock
the tests move, and a way to play a run as the server times it.

A is DEV_USER_ID (the requests' own identity), B is conftest's
OTHER_USER and C a third; their usernames are the ones their profiles
were given, read back, never assumed.
"""
from datetime import datetime, timedelta, timezone

import pytest

from core.auth import DEV_USER_ID
from core.db import db_conn
from study import duel_elo, duel_friends, duels
from tests.conftest import OTHER_USER, _wipe, acting_as

A = DEV_USER_ID
B = OTHER_USER
C = "pvp-test-third-learner"
ALL = (A, B, C)


def sql(query: str, args: tuple = (), fetch: bool = False):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(query, args)
            rows = cur.fetchall() if fetch else None
        conn.commit()
        return rows
    finally:
        conn.close()


def forget(*users: str) -> None:
    users = list(users)
    sql("DELETE FROM pvp_duels WHERE id IN (SELECT duel_id FROM pvp_entries WHERE user_id = ANY(%s))", (users,))
    for table, cols in (("pvp_entries", ("user_id",)), ("pvp_ratings", ("user_id",)),
                        ("pvp_friends", ("user_id", "friend_id")), ("pvp_requests", ("user_id", "target_id")),
                        ("pvp_blocks", ("user_id", "blocked_id")), ("pvp_reports", ("user_id", "reported_id"))):
        where = " OR ".join(f"{c} = ANY(%s)" for c in cols)
        sql(f"DELETE FROM {table} WHERE {where}", tuple(users for _ in cols))
    sql("DELETE FROM xp_ledger WHERE user_id = ANY(%s) AND source = 'duel'", (users,))
    sql("DELETE FROM credit_ledger WHERE user_id = ANY(%s) AND reason IN ('duel', 'duel_review')", (users,))
    sql("DELETE FROM event_log WHERE user_id = ANY(%s) AND name LIKE 'pvp_%%'", (users,))
    duel_friends._searches.clear()
    from core import credits
    from core.srs_instance import srs
    from core.user_level import forget_stored_level
    for uid in users:
        credits.forget(uid)
        srs.forget_history(uid)
        forget_stored_level(uid)


@pytest.fixture
def learners(other_user):
    """{A, B, C: username}, every duel row of theirs gone before and after."""
    from routes.profile import ensure_profile_row
    for uid in ALL:
        ensure_profile_row(uid)
    forget(*ALL)
    # A is the tests' own identity: what this changes on its profile is
    # put back.
    (level, hidden), = sql("SELECT jlpt_level, board_hidden FROM user_profiles WHERE user_id = %s", (A,), fetch=True)
    sql("UPDATE user_profiles SET board_hidden = FALSE, jlpt_level = NULL WHERE user_id = ANY(%s)", (list(ALL),))
    # Enough credits for the fares, whatever the other tests spent.
    from core import credits
    for uid in ALL:
        if (credits.read_fresh(uid)["balance"] or 0) < 20:
            credits.grant(uid, 20, ref="pvp-test")
    rows = sql("SELECT user_id, username FROM user_profiles WHERE user_id = ANY(%s)", (list(ALL),), fetch=True)
    yield dict(rows)
    forget(*ALL)
    sql("DELETE FROM credit_ledger WHERE user_id = ANY(%s) AND ref = 'pvp-test'", (list(ALL),))
    for uid in ALL:
        credits.forget(uid)
    sql("UPDATE user_profiles SET jlpt_level = %s, board_hidden = %s WHERE user_id = %s", (level, hidden, A))
    from core.user_level import forget_stored_level
    forget_stored_level(A)
    _wipe(C)


def set_profile(user_id: str, *, level: str | None = None, hidden: bool | None = None) -> None:
    from core.user_level import forget_stored_level
    if level is not None:
        sql("UPDATE user_profiles SET jlpt_level = %s WHERE user_id = %s", (level, user_id))
        forget_stored_level(user_id)
    if hidden is not None:
        sql("UPDATE user_profiles SET board_hidden = %s WHERE user_id = %s", (hidden, user_id))


class Clock:
    """The duels' clock, moved by the tests."""

    def __init__(self):
        self.at = datetime.now(timezone.utc)

    def __call__(self) -> datetime:
        return self.at

    def tick(self, ms: float) -> None:
        self.at += timedelta(milliseconds=ms)

    def to(self, iso: str) -> None:
        self.at = datetime.fromisoformat(iso)


@pytest.fixture
def clock(monkeypatch):
    c = Clock()
    monkeypatch.setattr(duels, "_now", c)
    monkeypatch.setattr(duel_friends, "_now", c)
    return c


def befriend(client, a: str, b: str, names: dict) -> None:
    with acting_as(a):
        assert client.post("/api/pvp/requests", json={"username": names[b]}).json()["status"] == "sent"
    with acting_as(b):
        assert client.post(f"/api/pvp/requests/{names[a]}/accept").status_code == 200


def place(user_id: str, level: str = "N5") -> None:
    """Start the learner's Elo at `level`, as their first ranked sprint
    would from their level."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            duel_elo.start(cur, user_id, level)
        conn.commit()
    finally:
        conn.close()


def keys(duel_id: int) -> list[int]:
    (paper,), = sql("SELECT paper FROM pvp_duels WHERE id = %s", (duel_id,), fetch=True)
    return [item["answer"] for item in paper["items"]]


def play(client, clock: Clock, user_id: str, duel_id: int, plan, *, finish: bool = True) -> list[dict]:
    """Play `user_id`'s run: `plan` is [(ms to think, right?)], each
    answer sent `ms` after its question was served. With `finish`, the
    clock is then moved past the minute and the duel read, so the run is
    settled. The replies, in order."""
    key = keys(duel_id)
    replies = []
    with acting_as(user_id):
        r = client.post(f"/api/pvp/duels/{duel_id}/start")
        assert r.status_code == 200, r.text
        run = r.json()
        clock.to(run["qAt"])
        q = run["q"]
        for ms, right in plan:
            if q is None:
                break
            clock.tick(ms)
            pick = key[q["n"]] if right else (key[q["n"]] + 1) % 4
            reply = client.post(f"/api/pvp/duels/{duel_id}/answer", json={"n": q["n"], "pick": pick}).json()
            replies.append(reply)
            if reply.get("over"):
                break
            clock.to(reply["nextAt"])
            q = reply["next"]
        if finish:
            clock.to(run["endsAt"])
            clock.tick(duels.GRACE_MS + 1)
            assert client.get(f"/api/pvp/duels/{duel_id}").status_code == 200
    return replies


def events_of(user_id: str, name: str) -> list[dict]:
    rows = sql("SELECT props FROM event_log WHERE user_id = %s AND name = %s ORDER BY id", (user_id, name), fetch=True)
    return [props for (props,) in rows]
