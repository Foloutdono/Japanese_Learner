"""
対戦 — a duel's life (plan 276).

A duel is a sprint (study/duel_paper.py): sixty seconds of quick
questions, the same ones in the same order for both players. The server
keeps the clock. A run starts LEAD_MS after « Partir » (live, after the
friend walks in); the server serves one question at a time, notes when
it was served, and times each answer as it arrives. A right answer is
worth TOP points for its first FULL_MS, then less and less, down to
FLOOR at LIMIT_MS, and nothing after; a wrong one nothing. The next
question waits RIGHT_HOLD_MS after a right answer and LOCK_MS after a
wrong one, so guessing costs time. A reply says right or wrong, never
which choice was right: the paper is shared, and the corrections open
only once the duel is settled, for a credit (review).

Three ways to play:

  friend, async  a friend has WAIT to play the same paper; whoever plays
                 second races the first one's recording. Free, unranked.
  friend, live   a room the friend has LOBBY to walk into; both runs
                 start together and each reads the other's score by a
                 one-second poll (live). Free, unranked.
  ranked         never waits: a run another learner played that nobody
                 has met (seek), else the recorded run of a real player
                 of a near Elo (ghost: only the player's Elo moves,
                 against the one the recording had; its author is not
                 told), else a fresh paper that waits WAIT for a
                 stranger (open), refunded if nobody comes.
                 RANKED_PRICE credits, paid at the start.

Only friends challenge each other; a stranger is met through ranked
play alone, and never one a block stands between. The paper is at the
lower of the two players' levels (core/user_level), and never one a
player has met before.

Nothing runs in the background. A duel's state is a function of the
instants stored, and settle() brings it up to date on every read: a run
past its minute is finished and paid its XP, a duel whose two runs are
over is resolved (the results, the Elo), one past its deadline with a
run unplayed expires (its ranked fare refunded), and a ranked seat
taken and left unstarted for HOLD is given back.

XP: a finished run pays its answers as practice does (srs.award_xp,
source `duel`: 7 a right answer, 1 a wrong one), XP_CAP a local day at
most; a win pays nothing more -- it is paid in Elo.

Every function here takes the caller's cursor and an `after` list of
what to do once the transaction commits (run() below), and raises
Refused (study/duel_friends.py) with a code the screens map to words.
"""
from __future__ import annotations

import json
import logging
import math
import secrets
from datetime import datetime, timedelta, timezone

from core import credits, events
from core.user_level import resolve_level
from study import duel_elo, duel_friends as friends, duel_paper
from study.duel_friends import Refused
from study.difficulty import LEVELS

logger = logging.getLogger(__name__)

SPRINT_MS = 60_000
LEAD_MS = 3_000
FULL_MS = 1_000
LIMIT_MS = 6_000
TOP, FLOOR = 100, 25
RIGHT_HOLD_MS = 300
LOCK_MS = 1_000
# An answer sent in the last instant arrives after the end; one may
# arrive a little before its question's clock started, by the client's
# reckoning of the server's time.
GRACE_MS = 750
EARLY_MS = 250

WAIT = timedelta(hours=48)
LOBBY = timedelta(minutes=2)
HOLD = timedelta(minutes=10)

RANKED_PRICE = 2
REVIEW_PRICE = 1
XP_CAP = 150
# The Elo window a ranked match looks in, widened when nobody is near.
WINDOWS = (200, 400)
# The duels a learner may have unresolved at once.
OPEN_MAX = 20
# What the hall shows: the last results, the Elo's last moves.
RECENT = 5
TREND = 20

ACTIVE = ("open", "lobby", "live")
SETTLED = ("done", "expired", "declined", "cancelled")

_DUEL = ("id", "kind", "mode", "level", "seed", "paper_rev", "status", "ghost",
         "live_start", "created_at", "expires_at", "resolved_at")
_ENTRY = ("duel_id", "user_id", "role", "answers", "served_q", "served_at", "score", "rights",
          "started_at", "finished_at", "rating_before", "rating_after", "opponent_rating",
          "result", "paid", "reviewed", "xp", "created_at")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def points(ms: int) -> int:
    """A right answer's worth after `ms` (domain/duel.js's points)."""
    if ms > LIMIT_MS:
        return 0
    if ms <= FULL_MS:
        return TOP
    return max(FLOOR, math.floor(TOP - (TOP - FLOOR) * (ms - FULL_MS) / (LIMIT_MS - FULL_MS) + 0.5))


def _ms(delta: timedelta) -> int:
    return int(delta.total_seconds() * 1000)


def _iso(at: datetime | None) -> str | None:
    return at.isoformat() if at else None


def lower_level(a: str, b: str) -> str:
    return LEVELS[min(LEVELS.index(a), LEVELS.index(b))]


def run(fn, *args, **kwargs):
    """fn(cur, after, *args) in one transaction; then what it left in
    `after` (the XP's history moved on, a fare refunded), once it is
    committed.

    A refusal commits too. Every function here refuses before it writes
    anything of its own, so what the transaction holds then is what
    settle() wrote on the way in -- an expiry, a seat given back -- and
    that is true whatever the refusal says."""
    from core.db import db_conn
    after: list = []
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            out = fn(cur, after, *args, **kwargs)
        conn.commit()
    except Refused:
        conn.commit()
        conn.close()
        for task in after:
            task()
        raise
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    for task in after:
        task()
    return out


# ── The rows ────────────────────────────────────────────────────────

def _duel(cur, duel_id: int, lock: bool = False) -> dict | None:
    cur.execute(f"SELECT {', '.join(_DUEL)} FROM pvp_duels WHERE id = %s" + (" FOR UPDATE" if lock else ""),
                (duel_id,))
    row = cur.fetchone()
    return dict(zip(_DUEL, row)) if row else None


def _entries(cur, duel_id: int, lock: bool = False) -> list[dict]:
    cur.execute(f"SELECT {', '.join(_ENTRY)} FROM pvp_entries WHERE duel_id = %s ORDER BY created_at, user_id"
                + (" FOR UPDATE" if lock else ""), (duel_id,))
    return [dict(zip(_ENTRY, row)) for row in cur.fetchall()]


def _paper(cur, duel_id: int) -> dict:
    cur.execute("SELECT paper FROM pvp_duels WHERE id = %s", (duel_id,))
    return cur.fetchone()[0]


def _save(cur, entry: dict, *keys: str) -> None:
    sets = ", ".join(f"{k} = %s" for k in keys)
    values = [json.dumps(entry[k]) if k == "answers" else entry[k] for k in keys]
    cur.execute(f"UPDATE pvp_entries SET {sets} WHERE duel_id = %s AND user_id = %s",
                (*values, entry["duel_id"], entry["user_id"]))


def _set_status(cur, duel: dict, status: str, now: datetime) -> None:
    duel["status"] = status
    duel["resolved_at"] = now if status in SETTLED else None
    cur.execute("UPDATE pvp_duels SET status = %s, resolved_at = %s WHERE id = %s",
                (status, duel["resolved_at"], duel["id"]))


def _mine(entries: list[dict], me: str) -> dict | None:
    return next((e for e in entries if e["user_id"] == me and e["role"] != "ghost"), None)


def _other(entries: list[dict], me: str) -> dict | None:
    return next((e for e in entries if not (e["user_id"] == me and e["role"] != "ghost")), None)


def _end(entry: dict) -> datetime:
    return entry["started_at"] + timedelta(milliseconds=SPRINT_MS)


def against(duel: dict, entries: list[dict]) -> str:
    """friend | ghost | seek | open: what a duel is played against."""
    if duel["kind"] == "friend":
        return "friend"
    if duel["ghost"]:
        return "ghost"
    return "seek" if len(entries) == 2 else "open"


def _load(cur, me: str, duel_id: int, lock: bool = True) -> tuple[dict, list[dict], dict]:
    """The duel, its entries and `me`'s, brought up to date; not found
    for a duel `me` is not in."""
    duel = _duel(cur, duel_id, lock=lock)
    entries = _entries(cur, duel_id, lock=lock) if duel else []
    mine = _mine(entries, me)
    if duel is None or mine is None:
        raise Refused(404, "pvp_not_found")
    return duel, entries, mine


# ── The day's XP ────────────────────────────────────────────────────

def _day_start(cur, user_id: str, now: datetime) -> datetime:
    cur.execute("SELECT tz_offset_min FROM user_profiles WHERE user_id = %s", (user_id,))
    row = cur.fetchone()
    return credits.next_midnight(row[0] if row else None, now) - timedelta(days=1)


def xp_today(cur, user_id: str, now: datetime) -> int:
    cur.execute(
        "SELECT COALESCE(SUM(xp), 0) FROM xp_ledger WHERE user_id = %s AND source = 'duel' AND awarded_at >= %s",
        (user_id, _day_start(cur, user_id, now)),
    )
    return int(cur.fetchone()[0])


def _pay_xp(cur, after: list, entry: dict, now: datetime) -> int:
    from core.srs_instance import srs
    from srs.xp import BASE_XP_BY_QUALITY
    raw = sum(BASE_XP_BY_QUALITY[4] if a["right"] else BASE_XP_BY_QUALITY[1] for a in entry["answers"])
    xp = max(0, min(raw, XP_CAP - xp_today(cur, entry["user_id"], now)))
    if xp > 0:
        uid = entry["user_id"]
        srs.award_xp(uid, "duel", f"duel:{entry['duel_id']}", xp, cur=cur)
        after.append(lambda: srs.forget_history(uid))
    return xp


# ── Settling ────────────────────────────────────────────────────────

def _finish(cur, after: list, entry: dict, at: datetime, now: datetime) -> None:
    entry["finished_at"] = at
    entry["xp"] = _pay_xp(cur, after, entry, now)
    _save(cur, entry, "finished_at", "xp")


def _outcome(result: float | None) -> str:
    return {1: "win", 0.5: "draw", 0: "loss"}.get(result, "draw")


def _done_event(cur, duel: dict, entry: dict, outcome: str, now: datetime) -> None:
    events.record(entry["user_id"], "pvp_duel_done", {
        "kind": duel["kind"], "mode": duel["mode"], "level": duel["level"], "outcome": outcome,
        "rights": entry["rights"] or 0,
        "wait_h": round((now - duel["created_at"]).total_seconds() / 3600, 1),
    }, cur=cur)


def _resolve(cur, duel: dict, entries: list[dict], now: datetime) -> None:
    a, b = entries
    for e, o in ((a, b), (b, a)):
        if e["role"] == "ghost":
            continue
        mine, theirs = e["score"] or 0, o["score"] or 0
        e["result"] = 1.0 if mine > theirs else 0.0 if mine < theirs else 0.5
    if duel["kind"] == "ranked":
        players = [e for e in entries if e["role"] != "ghost"]
        # Each against the other's Elo as it stood before either moved;
        # a ghost against the Elo its recording had.
        standing = {}
        for e in entries:
            if e["role"] == "ghost":
                standing[id(e)] = e["rating_before"]
            else:
                row = duel_elo.rating_row(cur, e["user_id"])
                standing[id(e)] = row["rating"] if row else duel_elo.START[duel["level"]]
        for e in players:
            o = b if e is a else a
            e["opponent_rating"] = standing[id(o)]
            try:
                before, after_, smurf = duel_elo.apply(cur, e["user_id"], e["opponent_rating"], e["result"])
            except LookupError:
                continue
            e["rating_before"], e["rating_after"] = before, after_
            if smurf:
                row = duel_elo.rating_row(cur, e["user_id"])
                events.record(e["user_id"], "pvp_smurf", {"games": row["games"]}, cur=cur)
    for e in entries:
        if e["role"] != "ghost":
            _save(cur, e, "result", "rating_before", "rating_after", "opponent_rating")
    _set_status(cur, duel, "done", now)
    for e in entries:
        if e["role"] != "ghost":
            _done_event(cur, duel, e, _outcome(e["result"]), now)


def _expire(cur, after: list, duel: dict, entries: list[dict], now: datetime, outcome: str = "expired") -> None:
    _set_status(cur, duel, outcome, now)
    for e in entries:
        if e["role"] != "ghost" and e["paid"]:
            # Once the expiry is committed, so it is given back once.
            uid, n, ref = e["user_id"], e["paid"], f"duel:{duel['id']}"
            after.append(lambda uid=uid, n=n, ref=ref: _refund(uid, n, ref))
    first = next((e for e in entries if e["role"] == "challenger"), None)
    if first is not None:
        _done_event(cur, duel, first, outcome, now)


def _refund(user_id: str, n: int, ref: str) -> None:
    try:
        credits.refund(user_id, n, "duel", ref)
    except Exception:
        logger.exception("duels: the fare of %s could not be refunded", ref)


def settle(cur, after: list, duel: dict, entries: list[dict], now: datetime) -> None:
    """Bring a locked duel up to date (the module's docstring). The
    rows are updated in place; a duel given back entirely reads status
    `gone`."""
    if duel["status"] not in ACTIVE:
        return
    for e in entries:
        if e["role"] != "ghost" and e["started_at"] and not e["finished_at"]:
            if now >= _end(e) + timedelta(milliseconds=GRACE_MS):
                _finish(cur, after, e, _end(e), now)
    if duel["kind"] == "ranked":
        for e in list(entries):
            if e["role"] == "ghost" or e["started_at"] is not None or now - e["created_at"] < HOLD:
                continue
            if any(o is not e and o["role"] != "ghost" for o in entries):
                # A seat taken in another learner's run: theirs again.
                cur.execute("DELETE FROM pvp_entries WHERE duel_id = %s AND user_id = %s",
                            (e["duel_id"], e["user_id"]))
                entries.remove(e)
            else:
                cur.execute("DELETE FROM pvp_duels WHERE id = %s", (duel["id"],))
                duel["status"] = "gone"
                return
    if len(entries) == 2 and all(e["finished_at"] for e in entries):
        _resolve(cur, duel, entries, now)
        return
    if now >= duel["expires_at"]:
        unplayed = len(entries) < 2 or any(e["started_at"] is None for e in entries)
        if unplayed:
            _expire(cur, after, duel, entries, now)


def _settled(cur, after: list, me: str, duel_id: int, now: datetime | None = None):
    now = now or _now()
    duel, entries, mine = _load(cur, me, duel_id)
    settle(cur, after, duel, entries, now)
    mine = _mine(entries, me)
    if duel["status"] == "gone" or mine is None:
        raise Refused(404, "pvp_not_found")
    return duel, entries, mine, now


# ── Names ───────────────────────────────────────────────────────────

def names(cur, me: str, user_ids: list[str]) -> dict[str, str | None]:
    """How `me` may name each learner: a friend by their username,
    anyone else by their username unless they keep off the 番付
    (None: « Voyageur », without a card)."""
    if not user_ids:
        return {}
    cur.execute(
        """
        SELECT p.user_id, p.username, p.board_hidden,
               EXISTS (SELECT 1 FROM pvp_friends f WHERE f.user_id = %s AND f.friend_id = p.user_id)
          FROM user_profiles p WHERE p.user_id = ANY(%s)
        """,
        (me, list(user_ids)),
    )
    return {uid: (name if friend or not hidden or uid == me else None)
            for uid, name, hidden, friend in cur.fetchall()}


def _timeline(entry: dict | None) -> list[dict]:
    if not entry:
        return []
    return [{"t": a["t"], "pts": a["pts"], "right": a["right"]} for a in entry["answers"]]


# ── Creating a duel ─────────────────────────────────────────────────

def _unresolved(cur, me: str) -> int:
    cur.execute(
        "SELECT COUNT(*) FROM pvp_entries e JOIN pvp_duels d ON d.id = e.duel_id "
        "WHERE e.user_id = %s AND e.role <> 'ghost' AND d.status = ANY(%s)",
        (me, list(ACTIVE)),
    )
    return int(cur.fetchone()[0])


def _insert_duel(cur, kind: str, mode: str, level: str, seed: int, paper: dict, now: datetime,
                 expires: datetime, ghost: bool = False) -> int:
    cur.execute(
        """
        INSERT INTO pvp_duels (kind, mode, level, seed, paper_rev, paper, status, ghost, created_at, expires_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """,
        (kind, mode, level, seed, paper["rev"], json.dumps(paper, ensure_ascii=False),
         "lobby" if mode == "live" else "open", ghost, now, expires),
    )
    return cur.fetchone()[0]


def _seat(cur, duel_id: int, user_id: str, role: str, now: datetime) -> None:
    cur.execute("INSERT INTO pvp_entries (duel_id, user_id, role, created_at) VALUES (%s, %s, %s, %s)",
                (duel_id, user_id, role, now))


def _fresh_paper(level: str) -> tuple[int, dict]:
    seed = secrets.randbelow(2 ** 62)
    return seed, duel_paper.build_paper(seed, level)


def challenge(cur, after: list, me: str, username: str, mode: str) -> int:
    """Challenge a friend, async or live. A second press, or a second
    challenge while one waits, finds the one already made."""
    if mode not in ("async", "live"):
        raise Refused(400, "pvp_bad_mode")
    other, _ = friends.reach(cur, me, username)
    if other == me:
        raise Refused(400, "pvp_self")
    if not friends.are_friends(cur, me, other):
        raise Refused(403, "pvp_not_friends")
    cur.execute(
        """
        SELECT d.id FROM pvp_duels d
          JOIN pvp_entries a ON a.duel_id = d.id AND a.user_id = %s AND a.role = 'challenger'
          JOIN pvp_entries b ON b.duel_id = d.id AND b.user_id = %s
         WHERE d.kind = 'friend' AND d.mode = %s AND d.status = ANY(%s)
         ORDER BY d.id DESC LIMIT 1
        """,
        (me, other, mode, list(ACTIVE)),
    )
    row = cur.fetchone()
    if row:
        return row[0]
    if _unresolved(cur, me) >= OPEN_MAX:
        raise Refused(409, "pvp_too_many")
    now = _now()
    level = lower_level(resolve_level(me), resolve_level(other))
    seed, paper = _fresh_paper(level)
    duel_id = _insert_duel(cur, "friend", mode, level, seed, paper, now,
                           now + (LOBBY if mode == "live" else WAIT))
    _seat(cur, duel_id, me, "challenger", now)
    _seat(cur, duel_id, other, "opponent", now)
    return duel_id


def _met_paper_sql(alias: str) -> str:
    # Never a paper the player has met before, in any duel.
    return (f"NOT EXISTS (SELECT 1 FROM pvp_entries m JOIN pvp_duels md ON md.id = m.duel_id "
            f"WHERE m.user_id = %(me)s AND md.seed = {alias}.seed AND md.level = {alias}.level "
            f"AND md.paper_rev = {alias}.paper_rev)")


_APART = ("NOT EXISTS (SELECT 1 FROM pvp_blocks b WHERE (b.user_id = %(me)s AND b.blocked_id = {u}) "
          "OR (b.user_id = {u} AND b.blocked_id = %(me)s))")


def _seek(cur, me: str, elo: int, level: str, now: datetime) -> int | None:
    """A run another learner played that nobody has met, at a level at
    or under `me`'s and an Elo near theirs: locked, or None."""
    levels = list(LEVELS[:LEVELS.index(level) + 1])
    for window in WINDOWS:
        cur.execute(
            f"""
            SELECT d.id FROM pvp_duels d
              JOIN pvp_entries e ON e.duel_id = d.id
              JOIN pvp_ratings r ON r.user_id = e.user_id
             WHERE d.kind = 'ranked' AND d.mode = 'async' AND d.status = 'open' AND NOT d.ghost
               AND d.expires_at > %(soon)s AND d.level = ANY(%(levels)s)
               AND e.user_id <> %(me)s AND e.finished_at IS NOT NULL
               AND (SELECT COUNT(*) FROM pvp_entries x WHERE x.duel_id = d.id) = 1
               AND ABS(r.rating - %(elo)s) <= %(window)s
               AND {_APART.format(u="e.user_id")}
               AND {_met_paper_sql("d")}
             ORDER BY (d.level = %(level)s) DESC, ABS(r.rating - %(elo)s), d.created_at
             LIMIT 1
             FOR UPDATE OF d SKIP LOCKED
            """,
            # A seat is held HOLD before it must be started: a run
            # closer than that to its deadline is not offered.
            {"me": me, "elo": elo, "level": level, "levels": levels, "window": window, "soon": now + HOLD},
        )
        row = cur.fetchone()
        if row:
            return row[0]
    return None


def _ghost_source(cur, me: str, elo: int, level: str) -> dict | None:
    """The recorded run of a real player of a near Elo, at a level at or
    under `me`'s, on a paper `me` has never met."""
    levels = list(LEVELS[:LEVELS.index(level) + 1])
    for window in WINDOWS:
        cur.execute(
            f"""
            SELECT e.duel_id, e.user_id FROM pvp_entries e
              JOIN pvp_duels d ON d.id = e.duel_id
             WHERE d.kind = 'ranked' AND d.status IN ('done', 'expired')
               AND e.role <> 'ghost' AND e.finished_at IS NOT NULL AND e.rating_before IS NOT NULL
               AND e.user_id <> %(me)s AND d.level = ANY(%(levels)s)
               AND ABS(e.rating_before - %(elo)s) <= %(window)s
               AND {_APART.format(u="e.user_id")}
               AND {_met_paper_sql("d")}
             ORDER BY (d.level = %(level)s) DESC, ABS(e.rating_before - %(elo)s), e.finished_at DESC
             LIMIT 1
            """,
            {"me": me, "elo": elo, "level": level, "levels": levels, "window": window},
        )
        row = cur.fetchone()
        if row:
            return {"duel_id": row[0], "user_id": row[1]}
    return None


def ranked(cur, after: list, me: str) -> tuple[int, str]:
    """A ranked sprint for `me`, never waiting: (duel id, against). A
    second press while a seat waits unstarted finds that seat."""
    rating = duel_elo.rating_row(cur, me)
    if rating is None:
        raise Refused(409, "pvp_not_placed")
    now = _now()
    cur.execute(
        """
        SELECT d.id FROM pvp_entries e JOIN pvp_duels d ON d.id = e.duel_id
         WHERE e.user_id = %s AND e.role <> 'ghost' AND d.kind = 'ranked' AND d.status = 'open'
           AND e.started_at IS NULL AND e.created_at > %s
         ORDER BY e.created_at DESC LIMIT 1
        """,
        (me, now - HOLD),
    )
    row = cur.fetchone()
    if row:
        duel = _duel(cur, row[0])
        return row[0], against(duel, _entries(cur, row[0]))
    if _unresolved(cur, me) >= OPEN_MAX:
        raise Refused(409, "pvp_too_many")
    level = resolve_level(me)
    elo = rating["rating"]

    duel_id = _seek(cur, me, elo, level, now)
    if duel_id is not None:
        _seat(cur, duel_id, me, "opponent", now)
        return duel_id, "seek"

    source = _ghost_source(cur, me, elo, level)
    if source is not None:
        cur.execute("SELECT level, seed, paper_rev, paper FROM pvp_duels WHERE id = %s", (source["duel_id"],))
        lv, seed, _rev, paper = cur.fetchone()
        duel_id = _insert_duel(cur, "ranked", "async", lv, seed, paper, now, now + WAIT, ghost=True)
        cur.execute(
            """
            INSERT INTO pvp_entries (duel_id, user_id, role, answers, served_q, served_at, score, rights,
                                     started_at, finished_at, rating_before, created_at)
            SELECT %s, user_id, 'ghost', answers, served_q, served_at, score, rights,
                   started_at, finished_at, rating_before, %s
              FROM pvp_entries WHERE duel_id = %s AND user_id = %s
            """,
            (duel_id, now - timedelta(seconds=1), source["duel_id"], source["user_id"]),
        )
        _seat(cur, duel_id, me, "opponent", now)
        return duel_id, "ghost"

    seed, paper = _fresh_paper(level)
    duel_id = _insert_duel(cur, "ranked", "async", level, seed, paper, now, now + WAIT)
    _seat(cur, duel_id, me, "challenger", now)
    return duel_id, "open"


# ── The cover ───────────────────────────────────────────────────────

def _price(duel: dict, mine: dict) -> int:
    return RANKED_PRICE if duel["kind"] == "ranked" and mine["started_at"] is None else 0


def _result(duel: dict, mine: dict, other: dict | None) -> dict | None:
    if duel["status"] != "done":
        return None
    delta = None
    if mine["rating_after"] is not None and mine["rating_before"] is not None:
        delta = mine["rating_after"] - mine["rating_before"]
    return {
        "outcome": _outcome(mine["result"]),
        "mine": mine["score"] or 0, "theirs": (other or {}).get("score") or 0,
        "rights": mine["rights"] or 0, "theirRights": (other or {}).get("rights") or 0,
        "answered": len(mine["answers"]), "theirAnswered": len((other or {}).get("answers") or []),
        "elo": None if delta is None else {"before": mine["rating_before"], "after": mine["rating_after"],
                                           "delta": delta},
        "xp": mine["xp"],
    }


def cover(cur, after: list, me: str, duel_id: int) -> dict:
    """GET /api/pvp/duels/{id}: who, the level, the score to beat, the
    price, and once settled the result."""
    duel, entries, mine, now = _settled(cur, after, me, duel_id)
    other = _other(entries, me)
    named = names(cur, me, [e["user_id"] for e in entries])
    levels = {e["user_id"]: resolve_level(e["user_id"]) for e in entries if e["role"] != "ghost"}
    them = None
    if other is not None:
        rated = friends.ratings(cur, [other["user_id"]]).get(other["user_id"]) or {}
        played = other["finished_at"] is not None
        them = {
            "username": named.get(other["user_id"]),
            "level": levels.get(other["user_id"]),
            "elo": other["rating_before"] if other["role"] == "ghost" else rated.get("elo"),
            "played": played,
            # The score to beat, once their run is over.
            "score": (other["score"] or 0) if played else None,
            "rights": (other["rights"] or 0) if played else None,
        }
    elif duel["status"] == "done":
        them = {"username": None, "gone": True}
    return {
        "id": duel["id"],
        "kind": duel["kind"],
        "mode": duel["mode"],
        "level": duel["level"],
        "status": duel["status"],
        "against": against(duel, entries),
        "you": {"username": named.get(me), "level": levels.get(me), "role": mine["role"],
                "played": mine["finished_at"] is not None, "started": mine["started_at"] is not None,
                "score": mine["score"] if mine["finished_at"] else None,
                "rights": mine["rights"] if mine["finished_at"] else None,
                "xp": mine["xp"] if mine["finished_at"] else None},
        "them": them,
        "price": _price(duel, mine),
        "expiresAt": _iso(duel["expires_at"]),
        "startsAt": _iso(duel["live_start"]),
        "serverNow": _iso(now),
        "result": _result(duel, mine, other),
        "reviewed": mine["reviewed"],
        "reviewPrice": REVIEW_PRICE,
        # The day's duel XP against its ceiling, for the result's « N more today ».
        "xp": {"today": xp_today(cur, me, now), "cap": XP_CAP},
    }


# ── The sprint ──────────────────────────────────────────────────────

def _run_state(duel: dict, entries: list[dict], mine: dict, paper: dict, now: datetime) -> dict:
    other = _other(entries, me=mine["user_id"])
    n = mine["served_q"] or 0
    items = paper["items"]
    over = mine["finished_at"] is not None or n >= len(items)
    return {
        "startsAt": _iso(mine["started_at"]),
        "endsAt": _iso(_end(mine)),
        "serverNow": _iso(now),
        "q": None if over else duel_paper.served(items[n], n),
        "qAt": _iso(mine["served_at"]),
        "total": mine["score"] or 0,
        "rights": mine["rights"] or 0,
        # The other's recording, when there is one to race: a live
        # opponent's comes by the poll.
        "opponent": ({"timeline": _timeline(other)}
                     if other is not None and other["finished_at"] is not None and duel["mode"] == "async"
                     else None),
    }


def _begin(cur, mine: dict, at: datetime) -> None:
    mine.update(started_at=at, served_q=0, served_at=at, score=0, rights=0, answers=[])
    _save(cur, mine, "started_at", "served_q", "served_at", "score", "rights", "answers")


def _start_event(cur, duel: dict, entries: list[dict], mine: dict) -> None:
    events.record(mine["user_id"], "pvp_duel_start", {
        "kind": duel["kind"], "mode": duel["mode"], "level": duel["level"],
        "against": against(duel, entries),
    }, cur=cur)


def _paid_already(cur, user_id: str, duel_id: int, reason: str) -> bool:
    # A fare is paid on its own connection (core/credits); a transaction
    # that fails after it must not charge it twice on the retry.
    cur.execute("SELECT 1 FROM credit_ledger WHERE user_id = %s AND reason = %s AND ref = %s AND delta < 0",
                (user_id, reason, f"duel:{duel_id}"))
    return cur.fetchone() is not None


def start(cur, after: list, me: str, duel_id: int) -> dict:
    """POST /api/pvp/duels/{id}/start: « Partir ». The run starts LEAD_MS
    from now; a run already under way is resumed where it is."""
    duel, entries, mine, now = _settled(cur, after, me, duel_id)
    if mine["finished_at"] is not None:
        raise Refused(409, "pvp_played")
    if mine["started_at"] is None:
        if duel["status"] == "lobby":
            raise Refused(409, "pvp_waiting")
        if duel["status"] != "open":
            raise Refused(409, "pvp_closed")
        if duel["kind"] == "ranked" and not _paid_already(cur, me, duel_id, "duel"):
            mine["paid"] = credits.pay(me, RANKED_PRICE, "duel", f"duel:{duel_id}")
            _save(cur, mine, "paid")
        if duel["kind"] == "ranked":
            row = duel_elo.rating_row(cur, me)
            mine["rating_before"] = row["rating"] if row else None
            _save(cur, mine, "rating_before")
        _begin(cur, mine, now + timedelta(milliseconds=LEAD_MS))
        _start_event(cur, duel, entries, mine)
    return _run_state(duel, entries, mine, _paper(cur, duel_id), now)


def answer(cur, after: list, me: str, duel_id: int, n: int, pick: int) -> dict:
    """POST /api/pvp/duels/{id}/answer: right or wrong (never which was
    right), its points as timed here, and the next question with the
    instant it is served."""
    duel, entries, mine, now = _settled(cur, after, me, duel_id)
    if mine["started_at"] is None:
        raise Refused(409, "pvp_not_started")
    if duel["status"] in ("cancelled", "declined", "expired"):
        raise Refused(409, "pvp_closed")
    paper = _paper(cur, duel_id)
    items = paper["items"]
    served = mine["served_q"] or 0
    done = {a["n"]: a for a in mine["answers"]}
    if n in done and n == served - 1:
        # The same answer again (a reply lost on the way): what it got.
        a = done[n]
        return _answered(mine, a, items, over=mine["finished_at"] is not None)
    if mine["finished_at"] is not None:
        # settle() finished it: the minute is over.
        return {"over": True, "total": mine["score"] or 0, "rights": mine["rights"] or 0}
    if n != served or n >= len(items):
        return {"stale": True, "q": duel_paper.served(items[served], served) if served < len(items) else None,
                "qAt": _iso(mine["served_at"]), "total": mine["score"] or 0}
    if now < mine["served_at"] - timedelta(milliseconds=EARLY_MS):
        raise Refused(409, "pvp_too_early")
    ms = max(0, _ms(now - mine["served_at"]))
    right = pick == items[n]["answer"]
    pts = points(ms) if right else 0
    # `t`, where the answer lands on the race: one accepted in the grace
    # after the minute lands on the finish line, never past it, so the
    # recording the other player races sums to the score.
    a = {"n": n, "pick": pick, "right": right, "ms": ms, "pts": pts,
         "t": min(SPRINT_MS, max(0, _ms(now - mine["started_at"])))}
    mine["answers"] = [*mine["answers"], a]
    mine["score"] = (mine["score"] or 0) + pts
    mine["rights"] = (mine["rights"] or 0) + int(right)
    mine["served_q"] = n + 1
    mine["served_at"] = now + timedelta(milliseconds=RIGHT_HOLD_MS if right else LOCK_MS)
    keys = ["answers", "score", "rights", "served_q", "served_at"]
    over = mine["served_q"] >= len(items) or mine["served_at"] >= _end(mine)
    _save(cur, mine, *keys)
    if mine["served_q"] >= len(items):
        _finish(cur, after, mine, now, now)
        settle(cur, after, duel, entries, now)
    return _answered(mine, a, items, over=over)


def _answered(mine: dict, a: dict, items: list, over: bool) -> dict:
    nxt = mine["served_q"]
    return {
        "n": a["n"], "right": a["right"], "pts": a["pts"], "ms": a["ms"],
        "total": mine["score"] or 0, "rights": mine["rights"] or 0,
        "next": None if over or nxt >= len(items) else duel_paper.served(items[nxt], nxt),
        "nextAt": _iso(mine["served_at"]),
        "endsAt": _iso(_end(mine)),
    }


# ── Live ────────────────────────────────────────────────────────────

def join(cur, after: list, me: str, duel_id: int) -> dict:
    """POST /api/pvp/duels/{id}/join: the friend walks into the room;
    both runs start LEAD_MS from now."""
    duel, entries, mine, now = _settled(cur, after, me, duel_id)
    if duel["mode"] != "live":
        raise Refused(400, "pvp_bad_mode")
    if duel["status"] == "live":
        return _run_state(duel, entries, mine, _paper(cur, duel_id), now)
    if duel["status"] != "lobby":
        raise Refused(409, "pvp_closed")
    if mine["role"] != "opponent":
        raise Refused(409, "pvp_waiting")
    at = now + timedelta(milliseconds=LEAD_MS)
    for e in entries:
        _begin(cur, e, at)
    duel["live_start"] = at
    cur.execute("UPDATE pvp_duels SET status = 'live', live_start = %s WHERE id = %s", (at, duel_id))
    duel["status"] = "live"
    for e in entries:
        _start_event(cur, duel, entries, e)
    return _run_state(duel, entries, mine, _paper(cur, duel_id), now)


def live(cur, after: list, me: str, duel_id: int, v: int) -> dict:
    """GET /api/pvp/duels/{id}/live?v=: the room or the race, read each
    second: the other's answers from the `v`-th on."""
    duel, entries, mine, now = _settled(cur, after, me, duel_id)
    other = _other(entries, me)
    line = _timeline(other)
    return {
        "status": duel["status"],
        "startsAt": _iso(duel["live_start"]),
        "endsAt": _iso(duel["live_start"] + timedelta(milliseconds=SPRINT_MS)) if duel["live_start"] else None,
        "expiresAt": _iso(duel["expires_at"]),
        "serverNow": _iso(now),
        "them": {"total": (other or {}).get("score") or 0, "rights": (other or {}).get("rights") or 0,
                 "timeline": line[v:], "v": len(line)},
        "result": _result(duel, mine, other),
    }


# ── Saying no ───────────────────────────────────────────────────────

def decline(cur, after: list, me: str, duel_id: int) -> None:
    duel, entries, mine, now = _settled(cur, after, me, duel_id)
    if duel["kind"] != "friend" or mine["role"] != "opponent" or mine["started_at"] is not None:
        raise Refused(409, "pvp_closed")
    if duel["status"] not in ("open", "lobby"):
        raise Refused(409, "pvp_closed")
    _expire(cur, after, duel, entries, now, outcome="declined")


def cancel(cur, after: list, me: str, duel_id: int) -> None:
    """DELETE /api/pvp/duels/{id}: one's own challenge while nobody has
    played it, or one's ranked seat while it is unstarted (given back
    to the run it was taken in, or dropped with a paper nobody played)."""
    duel, entries, mine, now = _settled(cur, after, me, duel_id)
    if duel["status"] not in ("open", "lobby") or mine["started_at"] is not None:
        raise Refused(409, "pvp_closed")
    if duel["kind"] == "ranked":
        if any(e is not mine and e["role"] != "ghost" for e in entries):
            cur.execute("DELETE FROM pvp_entries WHERE duel_id = %s AND user_id = %s", (duel_id, me))
        else:
            cur.execute("DELETE FROM pvp_duels WHERE id = %s", (duel_id,))
        return
    if mine["role"] != "challenger" or any(e["started_at"] is not None for e in entries):
        raise Refused(409, "pvp_closed")
    _set_status(cur, duel, "cancelled", now)


# ── The corrections ─────────────────────────────────────────────────

def review(cur, after: list, me: str, duel_id: int, buy: bool) -> dict:
    """The detail and the corrections: each question either player met,
    its right answer, both answers and their times. A credit, once per
    duel and player, and only once the duel is settled -- before, the
    first player could hand the second the answers."""
    duel, entries, mine, now = _settled(cur, after, me, duel_id)
    if mine["finished_at"] is None or duel["status"] not in ("done", "expired"):
        raise Refused(409, "pvp_not_settled")
    if not mine["reviewed"]:
        if not buy:
            raise Refused(409, "pvp_review_unpaid")
        if not _paid_already(cur, me, duel_id, "duel_review"):
            credits.pay(me, REVIEW_PRICE, "duel_review", f"duel:{duel_id}")
        mine["reviewed"] = True
        _save(cur, mine, "reviewed")
        events.record(me, "pvp_review", {"kind": duel["kind"]}, cur=cur)
    other = _other(entries, me)
    items = _paper(cur, duel_id)["items"]
    by_n = {a["n"]: a for a in mine["answers"]}
    theirs = {a["n"]: a for a in (other or {}).get("answers") or []}
    met = sorted(set(by_n) | set(theirs))

    def side(a):
        return None if a is None else {"pick": a["pick"], "right": a["right"], "ms": a["ms"], "pts": a["pts"]}

    return {
        "id": duel_id,
        "questions": [
            {**duel_paper.served(items[n], n), "answer": items[n]["answer"],
             "mine": side(by_n.get(n)), "theirs": side(theirs.get(n))}
            for n in met if n < len(items)
        ],
    }


# ── The hall ────────────────────────────────────────────────────────

def _settle_mine(cur, after: list, me: str, now: datetime) -> None:
    cur.execute(
        "SELECT d.id FROM pvp_entries e JOIN pvp_duels d ON d.id = e.duel_id "
        "WHERE e.user_id = %s AND e.role <> 'ghost' AND d.status = ANY(%s) ORDER BY d.id LIMIT %s",
        (me, list(ACTIVE), OPEN_MAX * 2),
    )
    for (duel_id,) in cur.fetchall():
        duel = _duel(cur, duel_id, lock=True)
        if duel is None:
            continue
        settle(cur, after, duel, _entries(cur, duel_id, lock=True), now)


def _rows(cur, me: str, where: str, params: tuple, limit: int, offset: int = 0) -> list[tuple[dict, list[dict]]]:
    cur.execute(
        f"""
        SELECT d.id FROM pvp_entries e JOIN pvp_duels d ON d.id = e.duel_id
         WHERE e.user_id = %s AND e.role <> 'ghost' AND {where}
         ORDER BY COALESCE(d.resolved_at, d.created_at) DESC, d.id DESC
         LIMIT %s OFFSET %s
        """,
        (me, *params, limit, offset),
    )
    out = []
    for (duel_id,) in cur.fetchall():
        out.append((_duel(cur, duel_id), _entries(cur, duel_id)))
    return out


def _line(cur, me: str, duel: dict, entries: list[dict], named: dict) -> dict:
    mine = _mine(entries, me)
    other = _other(entries, me)
    row = {
        "id": duel["id"], "kind": duel["kind"], "mode": duel["mode"], "level": duel["level"],
        "status": duel["status"], "against": against(duel, entries),
        "who": named.get(other["user_id"]) if other else None,
        "gone": other is None and duel["status"] == "done",
        "mine": mine["score"] if mine["finished_at"] else None,
        "theirs": other["score"] if other and other["finished_at"] else None,
        "expiresAt": _iso(duel["expires_at"]),
        "since": _iso(mine["finished_at"] or mine["created_at"]),
    }
    if duel["status"] == "done":
        row["outcome"] = _outcome(mine["result"])
        row["elo"] = (mine["rating_after"] - mine["rating_before"]
                      if mine["rating_after"] is not None and mine["rating_before"] is not None else None)
        row["at"] = _iso(duel["resolved_at"])
    elif duel["status"] in ("expired", "declined", "cancelled"):
        row["outcome"] = duel["status"]
        row["at"] = _iso(duel["resolved_at"])
    return row


def _named_rows(cur, me: str, rows: list[tuple[dict, list[dict]]]) -> list[dict]:
    ids = sorted({e["user_id"] for _d, es in rows for e in es})
    named = names(cur, me, ids)
    return [_line(cur, me, d, es, named) for d, es in rows]


def rating(cur, me: str) -> dict:
    """The learner's Elo: the figure, provisional or not, the record,
    the peak, the place on the Elo board and the last moves."""
    row = duel_elo.rating_row(cur, me)
    if row is None:
        return {"placed": False}
    cur.execute(
        """
        SELECT e.rating_before, e.rating_after FROM pvp_entries e JOIN pvp_duels d ON d.id = e.duel_id
         WHERE e.user_id = %s AND e.role <> 'ghost' AND d.kind = 'ranked' AND e.rating_after IS NOT NULL
         ORDER BY d.resolved_at DESC LIMIT %s
        """,
        (me, TREND),
    )
    last = cur.fetchall()[::-1]
    place = board_place(cur, me)
    return {
        "placed": True,
        "elo": row["rating"],
        "provisional": row["games"] < duel_elo.PROVISIONAL,
        "games": row["games"], "wins": row["wins"], "draws": row["draws"], "losses": row["losses"],
        "peak": row["peak"], "placedLevel": row["placed_level"],
        # Where the placement test started it: the curve's floor line.
        "start": duel_elo.START.get(row["placed_level"]),
        "rank": place["rank"], "of": place["of"],
        # The last TREND ranked duels, oldest first: the Elo after each,
        # and what each one moved it.
        "trend": [int(a) for _b, a in last],
        "moves": [int(a) - int(b) for b, a in last],
    }


def hub(cur, after: list, me: str) -> dict:
    """GET /api/pvp: the duels' hall in one call -- the Elo (or « to be
    placed »), the challenges to play, the live invitations, the duels
    waiting on the other, the last results, the friends and requests."""
    now = _now()
    _settle_mine(cur, after, me, now)
    active = _rows(cur, me, "d.status = ANY(%s)", (list(ACTIVE),), OPEN_MAX * 2)
    lines = _named_rows(cur, me, active)
    to_play, live_rooms, running = [], [], []
    for (duel, entries), line in zip(active, lines):
        mine = _mine(entries, me)
        if duel["status"] == "lobby":
            (live_rooms if mine["role"] == "opponent" else running).append(line)
        elif duel["status"] == "open" and mine["started_at"] is None:
            to_play.append(line)
        else:
            running.append(line)
    done = _named_rows(cur, me, _rows(cur, me, "d.status = 'done'", (), RECENT))
    return {
        "rating": rating(cur, me),
        "toPlay": to_play,
        "live": live_rooms,
        "running": running,
        "done": done,
        "friends": {"count": friends.friend_count(cur, me), "requests": friends.requests_waiting(cur, me)},
        "prices": {"ranked": RANKED_PRICE, "review": REVIEW_PRICE},
        "xp": {"today": xp_today(cur, me, now), "cap": XP_CAP},
    }


def history(cur, after: list, me: str, offset: int, limit: int) -> dict:
    rows = _rows(cur, me, "d.status = ANY(%s)", (["done", "expired", "declined"],), limit, offset)
    return {"entries": _named_rows(cur, me, rows), "offset": offset}


# ── The Elo board ───────────────────────────────────────────────────

def _board(cur, me: str, scope: str) -> list[tuple[str, int, int]]:
    """(user_id, rating, games), best first, the ties by id: everyone
    rated who has played a ranked duel and keeps on the 番付, or `me`
    and their friends. `me` is always counted, so a hidden learner sees
    their own place."""
    friends_only = "AND (r.user_id = %(me)s OR r.user_id IN (SELECT friend_id FROM pvp_friends WHERE user_id = %(me)s))"
    cur.execute(
        f"""
        SELECT r.user_id, r.rating, r.games FROM pvp_ratings r
          JOIN user_profiles p ON p.user_id = r.user_id
         WHERE r.games > 0 AND (NOT COALESCE(p.board_hidden, FALSE) OR r.user_id = %(me)s)
           {friends_only if scope == "friends" else ""}
         ORDER BY r.rating DESC, r.user_id
        """,
        {"me": me},
    )
    return [(uid, int(r), int(g)) for uid, r, g in cur.fetchall()]


def board_place(cur, me: str) -> dict:
    ranked = _board(cur, me, "all")
    rank = next((i + 1 for i, (uid, _r, _g) in enumerate(ranked) if uid == me), None)
    return {"rank": rank, "of": len(ranked)}


def board(cur, me: str, scope: str, offset: int, limit: int, around: int) -> dict:
    ranked = _board(cur, me, scope)
    ids = [uid for uid, _r, _g in ranked]
    cur.execute("SELECT user_id, username FROM user_profiles WHERE user_id = ANY(%s)", (ids,))
    usernames = dict(cur.fetchall())

    def row(i: int) -> dict:
        uid, r, g = ranked[i]
        return {"rank": i + 1, "username": usernames.get(uid), "elo": r,
                "provisional": g < duel_elo.PROVISIONAL, "me": uid == me}

    index = next((i for i, uid in enumerate(ids) if uid == me), None)
    out = {
        "scope": scope,
        "offset": offset,
        "of": len(ranked),
        "entries": [row(i) for i in range(offset, min(offset + limit, len(ranked)))],
        "near": [],
        "me": None,
    }
    if index is not None:
        out["me"] = {**row(index), "gap": None}
        if index > 0:
            ahead = row(index - 1)
            out["me"]["gap"] = {"elo": ahead["elo"] - ranked[index][1] + 1,
                                "username": ahead["username"], "rank": ahead["rank"]}
        if around:
            out["near"] = [row(i) for i in range(max(0, index - around), min(len(ranked), index + around + 1))]
    else:
        mine = duel_elo.rating_row(cur, me)
        out["me"] = {"rank": None, "elo": mine["rating"] if mine else None, "placed": mine is not None,
                     "provisional": True, "gap": None, "me": True}
    return out
