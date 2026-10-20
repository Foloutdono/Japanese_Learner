"""番付 — the whole board, its divisions and its days (plan 262).

Before this plan the board was a top five and a rank asked apart, by two
sums that broke a tie two ways: the top numbered tied learners 1, 2, 3
in whatever order the database gave them, the rank counted only the
learners strictly ahead. Now every board is ONE ranked list, built from
one sum (`srs.xp_totals`) a minute old at most, and everything the board
says -- a page, the learner's own place, the rows around it, the gap to
the next one, the move since yesterday -- is read off that list. A tie
is broken by the user id, so a place is a place: nobody shares one, and
the same learner holds the same place on every page.

Three boards ride on it:

- `all`, lifetime XP;
- `week`, XP since Monday 00:00 UTC. A calendar week, not the last seven
  days: a board that ends is a board you can race (plan 262 moved it off
  the rolling window), and the week just ended gives its podium
  (`champions`);
- `division`, the week's XP among the learners of one 段 -- the six
  divisions of sumo, 序ノ口 at the foot to 幕内 at the top. Every learner
  starts at 序ノ口; each Monday the week just ended is settled
  (`settle`): the top fifth of a division with XP goes up, the bottom
  fifth goes down, and so does anyone above 序ノ口 who earned nothing.
  A learner who sinks to 序ノ口 idle leaves the table and comes back
  there on their next XP, so the foot of the board is never a list of
  the gone.

A learner may keep off the board (`user_profiles.board_hidden`): they
are left out of every list other learners read, and still see their own
place, the one they would hold among the visible.

Nothing here keeps a learner's history: XP is review_log's, review_daily's
and xp_ledger's, as it always was. The two tables this module writes are
a learner's division (`banzuke_division`) and their place at the start
of the day (`banzuke_rank`); both go with the account.
"""
from __future__ import annotations

import bisect
import math
import threading
import time
from datetime import date, datetime, timedelta, timezone
from typing import Callable

from psycopg2.extras import execute_values

from core.db import db_conn
from core.rls import enable_rls

# The six 段, foot to top. A division's index is its height.
DIVISIONS = ("jonokuchi", "jonidan", "sandanme", "makushita", "juryo", "makuuchi")
TOP = len(DIVISIONS) - 1
# The share of a division that moves each week, up and down.
SHARE = 0.2
# The places a podium shows.
PODIUM = 3
PERIODS = ("all", "week", "division")
SCOPES = ("all", "level")

_TTL = 60.0
_lock = threading.Lock()
_cache: dict[tuple, tuple[float, object]] = {}
# The weeks this process has seen settled: one database check a week.
_settled: set[datetime] = set()
# Past this many keys, the ones gone stale are dropped (a key a day and
# a week accumulate otherwise).
_CACHE_MAX = 256


def _now() -> datetime:
    """The clock, one seam: the tests move it."""
    return datetime.now(timezone.utc)


def week_start(at: datetime) -> datetime:
    """Monday 00:00 UTC of the week `at` falls in."""
    day = at.astimezone(timezone.utc).date()
    monday = day - timedelta(days=day.weekday())
    return datetime(monday.year, monday.month, monday.day, tzinfo=timezone.utc)


def _cached(key: tuple, build: Callable[[], object]):
    now = time.monotonic()
    with _lock:
        hit = _cache.get(key)
    if hit is not None and now - hit[0] < _TTL:
        return hit[1]
    value = build()
    with _lock:
        if len(_cache) >= _CACHE_MAX:
            for stale in [k for k, (at, _) in _cache.items() if now - at >= _TTL]:
                del _cache[stale]
        _cache[key] = (now, value)
    return value


def forget() -> None:
    """Drop every board kept: a learner left the board or came back, or
    a test wrote XP by hand."""
    with _lock:
        _cache.clear()
        _settled.clear()


# ── Tables ────────────────────────────────────────────────────────────
def _division_table(cur) -> None:
    cur.execute("""
        CREATE TABLE IF NOT EXISTS banzuke_division (
            user_id  TEXT NOT NULL,
            week     DATE NOT NULL,
            division SMALLINT NOT NULL,
            moved    SMALLINT NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, week)
        )
    """)
    enable_rls(cur, "banzuke_division")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_banzuke_division_week ON banzuke_division(week, division)")


def _rank_table(cur) -> None:
    cur.execute("""
        CREATE TABLE IF NOT EXISTS banzuke_rank (
            user_id TEXT NOT NULL,
            period  TEXT NOT NULL,
            day     DATE NOT NULL,
            rank    INTEGER NOT NULL,
            PRIMARY KEY (user_id, period)
        )
    """)
    enable_rls(cur, "banzuke_rank")


def _marks_table(cur) -> None:
    cur.execute("""
        CREATE TABLE IF NOT EXISTS banzuke_marks (
            kind TEXT NOT NULL,
            at   DATE NOT NULL,
            PRIMARY KEY (kind, at)
        )
    """)
    enable_rls(cur, "banzuke_marks")


def init_db() -> None:
    """The board's three tables, one transaction each (CLAUDE.md: a
    failing ALTER must not roll back another table's)."""
    for create in (_division_table, _rank_table, _marks_table):
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                create(cur)
            conn.commit()
        finally:
            conn.close()


# ── What the board is read from ───────────────────────────────────────
def roster() -> dict[str, tuple[str, str | None, bool]]:
    """user_id -> (username, JLPT level, keeps off the board)."""
    def build():
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT user_id, username, jlpt_level, board_hidden FROM user_profiles")
                return {uid: (name, level, bool(hidden)) for uid, name, level, hidden in cur.fetchall()}
        finally:
            conn.close()
    return _cached(("roster",), build)


def totals(srs, since: datetime | None, until: datetime | None = None) -> dict[str, int]:
    return _cached(("totals", since, until), lambda: srs.xp_totals(since=since, until=until))


def _hidden(uid: str, names: dict) -> bool:
    row = names.get(uid)
    return bool(row and row[2])


def _order(pool: dict[str, int]) -> list[tuple[str, int]]:
    return sorted(pool.items(), key=lambda kv: (-kv[1], kv[0]))


def zones(order: list[tuple[str, int]], division: int) -> dict[str, int]:
    """Who a division's week sends up (+1) and down (-1), as the list
    stands: the top fifth with XP up (none from 幕内), the bottom fifth
    down, and anyone who earned nothing down too (none from 序ノ口). One
    rule for the board's marks and for the Monday that applies them."""
    n = len(order)
    out: dict[str, int] = {}
    if division > 0:
        down = math.floor(n * SHARE)
        for uid, _ in (order[n - down:] if down else ()):
            out[uid] = -1
        for uid, xp in order:
            if xp <= 0:
                out[uid] = -1
    if division < TOP:
        for uid, xp in order[:math.ceil(n * SHARE)]:
            if xp > 0:
                out[uid] = 1
    return out


# ── The Monday ────────────────────────────────────────────────────────
def _members(cur, week: date) -> dict[str, int]:
    """The divisions the last settled week left, user_id -> division."""
    cur.execute("SELECT MAX(week) FROM banzuke_division WHERE week <= %s", (week,))
    latest = cur.fetchone()[0]
    if latest is None:
        return {}
    cur.execute("SELECT user_id, division FROM banzuke_division WHERE week = %s", (latest,))
    return dict(cur.fetchall())


def settle(srs, start: datetime) -> None:
    """Apply the week before `start` to the divisions, once: whoever
    takes the mark writes the week's rows, everyone after reads them.
    Lazy, on the first board of the week, so no job has to run."""
    if start in _settled:
        return
    week = start.date()
    previous = start - timedelta(days=7)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO banzuke_marks (kind, at) VALUES ('week', %s) ON CONFLICT DO NOTHING RETURNING 1",
                (week,),
            )
            if cur.fetchone():
                members = _members(cur, week - timedelta(days=1))
                earned = srs.xp_totals(since=previous, until=start)
                for uid, xp in earned.items():
                    if xp > 0:
                        members.setdefault(uid, 0)
                rows = []
                for division in range(len(DIVISIONS)):
                    pool = {uid: earned.get(uid, 0) for uid, d in members.items() if d == division}
                    moves = zones(_order(pool), division)
                    for uid, xp in pool.items():
                        moved = moves.get(uid, 0)
                        to = division + moved
                        # Idle at the foot: off the table until the next XP.
                        if to == 0 and xp <= 0:
                            continue
                        rows.append((uid, week, to, moved))
                if rows:
                    execute_values(
                        cur,
                        "INSERT INTO banzuke_division (user_id, week, division, moved) VALUES %s "
                        "ON CONFLICT (user_id, week) DO NOTHING",
                        rows,
                    )
                cur.execute("DELETE FROM banzuke_division WHERE week < %s", (week - timedelta(days=7),))
        conn.commit()
    finally:
        conn.close()
    with _lock:
        _settled.add(start)
        for key in [k for k in _cache if k[0] == "divisions"]:
            del _cache[key]


def divisions(start: datetime) -> dict[str, tuple[int, int]]:
    """This week's table, user_id -> (division, the move that put them
    there). A learner missing from it sits at 序ノ口, unmoved."""
    def build():
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT user_id, division, moved FROM banzuke_division WHERE week = %s",
                    (start.date(),),
                )
                return {uid: (d, m) for uid, d, m in cur.fetchall()}
        finally:
            conn.close()
    return _cached(("divisions", start), build)


# ── The day's first places ───────────────────────────────────────────
def _snapshot(srs, period: str, today: date, ranked: list[tuple[str, int]], names: dict) -> dict[str, int]:
    """Each learner's place at the start of `today` on a global board,
    written by the day's first board and read by the rest: what a row's
    ▲3 is measured from. A learner who keeps off the board is given the
    place they would hold, as their own board shows them."""
    def build():
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO banzuke_marks (kind, at) VALUES (%s, %s) ON CONFLICT DO NOTHING RETURNING 1",
                    (f"rank:{period}", today),
                )
                if cur.fetchone():
                    keys = [(-xp, uid) for uid, xp in ranked]
                    rows = [(uid, period, today, i + 1) for i, (uid, _) in enumerate(ranked)]
                    for uid, xp in board_pool(srs, period, None, names).items():
                        if _hidden(uid, names):
                            rows.append((uid, period, today, bisect.bisect_left(keys, (-xp, uid)) + 1))
                    cur.execute("DELETE FROM banzuke_rank WHERE period = %s", (period,))
                    if rows:
                        execute_values(
                            cur, "INSERT INTO banzuke_rank (user_id, period, day, rank) VALUES %s", rows,
                        )
                    conn.commit()
                    return {uid: rank for uid, _, _, rank in rows}
                conn.commit()
                cur.execute("SELECT user_id, rank FROM banzuke_rank WHERE period = %s AND day = %s", (period, today))
                return dict(cur.fetchall())
        finally:
            conn.close()
    return _cached(("snapshot", period, today), build)


# ── A board ───────────────────────────────────────────────────────────
def board_pool(srs, period: str, division: int | None, names: dict) -> dict[str, int]:
    """Everyone a board ranks, user_id -> XP, before anyone is hidden."""
    start = week_start(_now())
    if period == "all":
        return totals(srs, None)
    earned = totals(srs, start)
    if period == "week":
        return earned
    table = divisions(start)
    pool = {uid: earned.get(uid, 0) for uid, (d, _) in table.items() if d == division}
    if division == 0:
        for uid, xp in earned.items():
            if uid not in table and xp > 0:
                pool[uid] = xp
    return pool


def _visible(srs, period: str, level: str | None, scoped: bool, division: int | None,
             names: dict) -> list[tuple[str, int]]:
    """The board as other learners read it: ranked, the hidden left out;
    `scoped`, only the learners at `level`."""
    def build():
        pool = board_pool(srs, period, division, names)
        if scoped:
            pool = {uid: xp for uid, xp in pool.items()
                    if (names.get(uid) or (None, None, False))[1] == level}
        return [(uid, xp) for uid, xp in _order(pool) if not _hidden(uid, names)]
    key_level = level if scoped else None
    return _cached(("visible", period, key_level, scoped, division, week_start(_now())), build)


def division_of(viewer: str, start: datetime) -> tuple[int, int]:
    return divisions(start).get(viewer, (0, 0))


def read(srs, viewer: str, period: str = "all", scope: str = "all", *, limit: int = 20,
         offset: int = 0, around: int = 0, division: int | None = None) -> dict:
    """One board as `viewer` reads it. Rows carry a user_id; the route
    turns it into a username and drops it."""
    now = _now()
    start = week_start(now)
    settle(srs, start)
    names = roster()
    mine_div, moved = division_of(viewer, start)
    if period == "division" and division is None:
        division = mine_div
    if period != "division":
        division = None
    viewer_level = (names.get(viewer) or (None, None, False))[1]
    scoped = scope == "level"

    ranked = _visible(srs, period, viewer_level, scoped, division, names)
    pool = board_pool(srs, period, division, names)
    in_pool = viewer in pool or (period == "division" and division == mine_div)
    my_xp = pool.get(viewer, 0)
    ranked = list(ranked)
    index = next((i for i, (uid, _) in enumerate(ranked) if uid == viewer), None)
    if index is None and in_pool:
        # Hidden, or in their own division with nothing earned yet: the
        # place they would hold among the visible.
        index = bisect.bisect_left([(-xp, uid) for uid, xp in ranked], (-my_xp, viewer))
        ranked.insert(index, (viewer, my_xp))

    marks: dict[str, int] = {}
    if period == "division":
        marks = zones(ranked, division)

    moves: dict[str, int] = {}
    if period in ("all", "week") and not scoped and not (period == "week" and now.date() == start.date()):
        before = _snapshot(srs, period, now.date(), _visible(srs, period, viewer_level, False, None, names), names)
        moves = {uid: before[uid] - (i + 1) for i, (uid, _) in enumerate(ranked) if uid in before}

    def row(i: int) -> dict:
        uid, xp = ranked[i]
        return {"user_id": uid, "rank": i + 1, "xp": xp, "move": moves.get(uid), "zone": marks.get(uid, 0)}

    out: dict = {
        "period": period,
        "scope": scope,
        "offset": offset,
        "total": len(ranked),
        "entries": [row(i) for i in range(offset, min(offset + limit, len(ranked)))],
        "near": [],
        "me": {"user_id": viewer, "rank": None, "xp": my_xp, "move": None, "zone": 0, "gap": None},
        "hidden": _hidden(viewer, names),
        "level": viewer_level if scoped else None,
        "week": {"start": start.isoformat(), "end": (start + timedelta(days=7)).isoformat()},
    }
    if index is not None:
        out["me"] = {**row(index), "gap": None}
        if index > 0:
            ahead, ahead_xp = ranked[index - 1]
            out["me"]["gap"] = {"user_id": ahead, "xp": ahead_xp - my_xp + 1}
        if around:
            out["near"] = [row(i) for i in range(max(0, index - around), min(len(ranked), index + around + 1))]
    if period == "division":
        n = len(ranked)
        ups = [i for i, (uid, _) in enumerate(ranked) if marks.get(uid) == 1]
        downs = [i for i, (uid, _) in enumerate(ranked) if marks.get(uid) == -1]
        mine_zone = marks.get(viewer, 0) if index is not None else 0
        # What it takes the reader to be in the week's move (plan 262's
        # A1, the owner's pick of the canvas "Tsuji — the 番付 redesign"):
        # the XP that passes the last learner going up, or, standing in
        # the bottom, the last one staying.
        to_up = to_stay = None
        if index is not None and mine_zone != 1 and ups:
            to_up = ranked[ups[-1]][1] - my_xp + 1
        if index is not None and mine_zone == -1:
            safe = [i for i in range(n) if marks.get(ranked[i][0], 0) != -1]
            to_stay = max(1, ranked[safe[-1]][1] - my_xp + 1) if safe else 1
        out["division"] = {
            "index": division,
            "key": DIVISIONS[division],
            "count": len(DIVISIONS),
            "up": math.ceil(n * SHARE) if division < TOP else 0,
            "down": math.floor(n * SHARE) if division > 0 else 0,
            # The rows marked, which the idle (sent down whatever their
            # place) can make more than `down`.
            "upCount": len(ups),
            "downCount": len(downs),
            "mine": mine_div,
            "moved": moved if division == mine_div else 0,
            "zone": mine_zone,
            "toUp": to_up,
            "toStay": to_stay,
            # Each division's size this week, foot to top: the desk's
            # ladder of the six.
            "sizes": [len(_visible(srs, "division", None, False, d, names)) for d in range(len(DIVISIONS))],
        }
    if period == "week":
        out["champions"] = champions(srs, start, names)
    return out


def champions(srs, start: datetime, names: dict) -> list[dict]:
    """The week just ended, its first three among the visible."""
    earned = totals(srs, start - timedelta(days=7), start)
    ranked = [(uid, xp) for uid, xp in _order(earned) if xp > 0 and not _hidden(uid, names)]
    return [{"user_id": uid, "rank": i + 1, "xp": xp} for i, (uid, xp) in enumerate(ranked[:PODIUM])]


def place(srs, uid: str, period: str) -> int | None:
    """A learner's place on a global board, as others read it."""
    names = roster()
    ranked = _visible(srs, period, None, False, None, names)
    return next((i + 1 for i, (u, _) in enumerate(ranked) if u == uid), None)
