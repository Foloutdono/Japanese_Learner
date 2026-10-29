"""
対戦 — a duel's life (plan 279).

A duel is a sprint (study/duel_paper.py): two minutes of quick
questions (plan 284; one under sprint-1), the same ones in the same
order for both players. The server keeps the clock. A run starts
LEAD_MS after « Partir » (live, after the friend walks in); the server
serves one question at a time, notes when it was served, and times each
answer as it arrives. A right answer is worth TOP points for its first
FULL_MS, then less and less, down to FLOOR at LIMIT_MS, and nothing
after; a wrong one nothing. A streak multiplies them (plan 285): ×1.5
from the fifth right answer in a row, ×2 from the tenth, ×3 from the
twentieth (COMBO_TIERS), until a wrong one; and a right answer in the
sprint's last RUSH_MS earns its points once more (the rush). An answer
keeps its parts (pts, combo, rush), and the result's lines are read
back from them. The next question waits RIGHT_HOLD_MS after a right
answer and LOCK_MS after a wrong one, so guessing costs time. A reply
says right or wrong, never which choice was right: the paper is shared,
and the corrections open only once the duel is settled, for a credit
(review).

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
play alone, and never one a block stands between. The paper is built
at the mix the Elo stands at (plan 286, duel_paper.mix_of): the
lower of two friends' (the start of their level for one with none
yet), a ranked player's own, whose stranger is met on a paper near
it; never one a player has met before.

Nothing runs in the background. A duel's state is a function of the
instants stored, and settle() brings it up to date on every read: a run
past its sprint is finished and paid its XP, a duel whose two runs are
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

logger = logging.getLogger(__name__)

# A sprint's length goes with its paper (plan 284): a duel keeps the
# paper it was dealt and the time that came with it, so a sprint-1 duel
# still open when the two minutes came in is run, and raced, in one.
SPRINT_MS_BY_REV = {"sprint-1": 60_000, "sprint-2": 120_000, "sprint-3": 120_000, "sprint-4": 120_000}
SPRINT_MS = SPRINT_MS_BY_REV[duel_paper.PAPER_REV]
# And so does the way an answer is scored (plan 285): sprint-2's runs
# pay a streak and the last seconds more, sprint-1's pay speed alone.
COMBO_REVS = frozenset({"sprint-2", "sprint-3", "sprint-4"})
# (right answers in a row, the multiplier from there on)
COMBO_TIERS = ((5, 1.5), (10, 2.0), (20, 3.0))
RUSH_MS = 15_000
# The result's grade needs a run of this many answers: a sprint left
# after three is graded nothing.
MIN_GRADED = 10
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
# Namespace half of the advisory locks taken here (cf. routes/favorites).
DUEL_LOCK = 931_279
# What the hall shows: the last results, the Elo's curve over its last
# ranked duels.
RECENT = 5
TREND = 20

ACTIVE = ("open", "lobby", "live")
SETTLED = ("done", "expired", "declined", "cancelled")

_DUEL = ("id", "kind", "mode", "level", "seed", "paper_rev", "status", "ghost",
         "live_start", "created_at", "expires_at", "resolved_at", "mix")
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


def multiplier(streak: int) -> float:
    """What a right answer's points are multiplied by, `streak` right
    answers in a row with it."""
    mult = 1.0
    for at, m in COMBO_TIERS:
        if streak >= at:
            mult = m
    return mult


def combo_on(duel: dict) -> bool:
    """Whether the duel's runs are scored with the combo and the rush."""
    return duel["paper_rev"] in COMBO_REVS


def streak_of(answers: list[dict]) -> int:
    """The right answers in a row a run ends on."""
    n = 0
    for a in reversed(answers):
        if not a["right"]:
            break
        n += 1
    return n


def scored(a: dict) -> int:
    """What an answer added to the score: its speed's points, the
    combo's and the rush's (none on an answer of sprint-1)."""
    return a["pts"] + a.get("combo", 0) + a.get("rush", 0)


def grade(rights: int, answered: int, flashes: int) -> str | None:
    """The result's grade (plan 285): S for a run nearly all right with
    a third of its right answers given in their first second, then A, B
    and C by the share right; none for a run too short to say."""
    if answered < MIN_GRADED:
        return None
    share = rights / answered
    if share >= 0.95 and flashes >= 0.3 * rights:
        return "S"
    if share >= 0.88:
        return "A"
    if share >= 0.75:
        return "B"
    return "C"


def lines(entry: dict) -> dict:
    """What a run's score was made of, for the result's lines (plan
    285): the points of speed, of the combo and of the rush, the longest
    streak, the answers worth TOP (« éclairs »), the right ones among
    the answers, and the grade."""
    answers = entry["answers"] or []
    best = run = 0
    for a in answers:
        run = run + 1 if a["right"] else 0
        best = max(best, run)
    rights = sum(1 for a in answers if a["right"])
    flashes = sum(1 for a in answers if a["pts"] >= TOP)
    return {
        "speed": sum(a["pts"] for a in answers),
        "combo": sum(a.get("combo", 0) for a in answers),
        "rush": sum(a.get("rush", 0) for a in answers),
        "best": best, "flashes": flashes,
        "rights": rights, "answered": len(answers),
        "grade": grade(rights, len(answers), flashes),
    }


def rules(duel: dict) -> dict | None:
    """The combo's tiers and the rush's length, for the run's screen to
    draw (never to score): none for a duel scored on speed alone."""
    if not combo_on(duel):
        return None
    return {"tiers": [{"at": at, "mult": m} for at, m in COMBO_TIERS], "rushMs": RUSH_MS}


def _ms(delta: timedelta) -> int:
    return int(delta.total_seconds() * 1000)


def _iso(at: datetime | None) -> str | None:
    return at.isoformat() if at else None


def run(fn, *args, **kwargs):
    """fn(cur, after, *args) in one transaction; then what it left in
    `after` (the XP's history and the credits moved on), once it is
    committed.

    A refusal commits too. Every function here refuses before it writes
    anything of its own, so what the transaction holds then is what
    settle() wrote on the way in -- an expiry, a seat given back -- and
    that is true whatever the refusal says.

    A deadlock is run again, once, from the start: settling takes a
    duel's rows, then its players' Elo and credits, and two reads that
    settle duels sharing a learner can take them in crossed orders. The
    connection goes back to the pool whatever happens, a dead one too:
    a slot lost each time would empty the pool every route shares."""
    import psycopg2.extensions
    from core.db import db_conn
    for attempt in (1, 2):
        after: list = []
        refused = None
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                try:
                    out = fn(cur, after, *args, **kwargs)
                except Refused as exc:
                    refused = exc
            conn.commit()
        except psycopg2.extensions.TransactionRollbackError:
            _rollback(conn)
            if attempt == 1:
                continue
            raise
        except BaseException:
            _rollback(conn)
            raise
        finally:
            conn.close()
        for task in after:
            task()
        if refused is not None:
            raise refused
        return out


def _rollback(conn) -> None:
    try:
        conn.rollback()
    except Exception:
        # The connection is gone: so is its transaction.
        pass


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


def sprint_ms(duel: dict) -> int:
    """The duel's sprint, by the paper it was dealt."""
    return SPRINT_MS_BY_REV.get(duel["paper_rev"], SPRINT_MS)


def _end(duel: dict, entry: dict) -> datetime:
    return entry["started_at"] + timedelta(milliseconds=sprint_ms(duel))


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
    """The duel XP of the learner's local day that holds `now`."""
    start = _day_start(cur, user_id, now)
    cur.execute(
        "SELECT COALESCE(SUM(xp), 0) FROM xp_ledger "
        "WHERE user_id = %s AND source = 'duel' AND awarded_at >= %s AND awarded_at < %s",
        (user_id, start, start + timedelta(days=1)),
    )
    return int(cur.fetchone()[0])


def _pay_xp(cur, after: list, entry: dict, at: datetime) -> int:
    """A finished run's XP, dated when it ended (`at`) and held to that
    day's cap: a run left mid-sprint and finished by a later read -- the
    friend's, the next day -- was the learner's study that day, not on
    the reader's (their cap, their studied days)."""
    from core.srs_instance import srs
    from srs.xp import BASE_XP_BY_QUALITY
    uid = entry["user_id"]
    raw = sum(BASE_XP_BY_QUALITY[4] if a["right"] else BASE_XP_BY_QUALITY[1] for a in entry["answers"])
    if raw <= 0:
        return 0
    # The day's XP is read and then added to: two of the learner's runs
    # finished at once, by two reads, would each read it without the
    # other's and both pay up to the cap.
    cur.execute("SELECT pg_advisory_xact_lock(%s, hashtext(%s))", (DUEL_LOCK, f"xp:{uid}"))
    xp = max(0, min(raw, XP_CAP - xp_today(cur, uid, at)))
    if xp > 0:
        srs.award_xp(uid, "duel", f"duel:{entry['duel_id']}", xp, cur=cur, at=at)
        after.append(lambda: srs.forget_history(uid))
    return xp


# ── Settling ────────────────────────────────────────────────────────

def _finish(cur, after: list, entry: dict, at: datetime, now: datetime) -> None:
    entry["finished_at"] = at
    entry["xp"] = _pay_xp(cur, after, entry, at)
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
        # Locked before they are read, in one order: two of a learner's
        # duels resolved at once each move the Elo the other left, never
        # both the one they read.
        cur.execute("SELECT user_id FROM pvp_ratings WHERE user_id = ANY(%s) ORDER BY user_id FOR UPDATE",
                    (sorted(e["user_id"] for e in players),))
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
        _give_back(cur, after, duel, e)
    first = next((e for e in entries if e["role"] == "challenger"), None)
    if first is not None:
        _done_event(cur, duel, first, outcome, now)


# ── The fares ───────────────────────────────────────────────────────
# Taken and given back in the duel's own transaction (core/credits on
# its cursor): a fare is never taken for a run that failed to start, and
# a refund never lost between the expiry that owes it and a write of its
# own. The credits' cache is forgotten once the transaction commits.

def _pay(cur, after: list, me: str, n: int, reason: str, duel_id: int) -> int:
    paid = credits.pay(me, n, reason, f"duel:{duel_id}", cur=cur)
    after.append(lambda: credits.forget(me))
    return paid


def _give_back(cur, after: list, duel: dict, entry: dict) -> None:
    if entry["role"] == "ghost" or not entry["paid"]:
        return
    uid = entry["user_id"]
    credits.refund(uid, entry["paid"], "duel", f"duel:{duel['id']}", cur=cur)
    after.append(lambda: credits.forget(uid))


def settle(cur, after: list, duel: dict, entries: list[dict], now: datetime) -> None:
    """Bring a locked duel up to date (the module's docstring). The
    rows are updated in place; a duel given back entirely reads status
    `gone`."""
    if duel["status"] not in ACTIVE:
        return
    for e in entries:
        if e["role"] != "ghost" and e["started_at"] and not e["finished_at"]:
            if now >= _end(duel, e) + timedelta(milliseconds=GRACE_MS):
                _finish(cur, after, e, _end(duel, e), now)
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
        # A run started before the deadline has its sprint: the expiry
        # waits for it to be finished above, its sprint and grace over.
        running = any(e["started_at"] is not None and e["finished_at"] is None for e in entries)
        if unplayed and not running:
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
    """A run as the other player races it: what each answer added to the
    score (its combo and rush with it), and when, so the recording sums
    to the score."""
    if not entry:
        return []
    return [{"t": a["t"], "pts": scored(a), "right": a["right"]} for a in entry["answers"]]


# ── Creating a duel ─────────────────────────────────────────────────

def _unresolved(cur, me: str) -> int:
    """The unresolved duels `me` opened or has run in: what OPEN_MAX
    bounds. A challenge received and not played is the friend's, counted
    in theirs: a dozen friends challenging must not shut `me` out."""
    cur.execute(
        "SELECT COUNT(*) FROM pvp_entries e JOIN pvp_duels d ON d.id = e.duel_id "
        "WHERE e.user_id = %s AND e.role <> 'ghost' AND d.status = ANY(%s) "
        "AND (e.role = 'challenger' OR e.started_at IS NOT NULL)",
        (me, list(ACTIVE)),
    )
    return int(cur.fetchone()[0])


def _room_for_one(cur, after: list, me: str, now: datetime) -> None:
    if _unresolved(cur, me) >= OPEN_MAX:
        # Some may be past their deadline with no read since: settled,
        # then counted again.
        _settle_mine(cur, after, me, now)
        if _unresolved(cur, me) >= OPEN_MAX:
            raise Refused(409, "pvp_too_many")


def _insert_duel(cur, kind: str, mode: str, level: str, seed: int, paper: dict, now: datetime,
                 expires: datetime, ghost: bool = False) -> int:
    cur.execute(
        """
        INSERT INTO pvp_duels (kind, mode, level, seed, paper_rev, paper, status, ghost, created_at, expires_at, mix)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """,
        (kind, mode, level, seed, paper["rev"], json.dumps(paper, ensure_ascii=False),
         "lobby" if mode == "live" else "open", ghost, now, expires, paper.get("mix")),
    )
    return cur.fetchone()[0]


def _seat(cur, duel_id: int, user_id: str, role: str, now: datetime) -> None:
    cur.execute("INSERT INTO pvp_entries (duel_id, user_id, role, created_at) VALUES (%s, %s, %s, %s)",
                (duel_id, user_id, role, now))


def _fresh_paper(mix: int) -> tuple[int, dict]:
    seed = secrets.randbelow(2 ** 62)
    return seed, duel_paper.build_paper(seed, mix=mix)


def _elo_of(cur, user_id: str) -> int:
    """A learner's Elo, or the one their level would start them at."""
    row = duel_elo.rating_row(cur, user_id)
    return row["rating"] if row else duel_elo.START[resolve_level(user_id)]


def mix_line(duel: dict) -> list[dict] | None:
    """What a duel's paper asks, level by level, for the ticket: none for
    a paper built at one level before plan 286."""
    if duel.get("mix") is None:
        return None
    return [{"level": lv, "share": share} for lv, share in duel_paper.blend(duel["mix"])]


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
    now = _now()
    # Two presses at once (a double tap, a rematch pressed twice) would
    # each find none and make one each: a pair's challenges are made one
    # at a time, and the second press finds the first's.
    cur.execute("SELECT pg_advisory_xact_lock(%s, hashtext(%s))", (DUEL_LOCK, f"challenge:{me}:{other}"))
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
        # One no read has caught up with -- a room its host left, a
        # challenge past its 48 hours -- is settled, not handed back.
        duel = _duel(cur, row[0], lock=True)
        settle(cur, after, duel, _entries(cur, row[0], lock=True), now)
        if duel["status"] in ACTIVE:
            return row[0]
    _room_for_one(cur, after, me, now)
    seed, paper = _fresh_paper(duel_paper.mix_of(min(_elo_of(cur, me), _elo_of(cur, other))))
    duel_id = _insert_duel(cur, "friend", mode, paper["level"], seed, paper, now,
                           now + (LOBBY if mode == "live" else WAIT))
    _seat(cur, duel_id, me, "challenger", now)
    _seat(cur, duel_id, other, "opponent", now)
    return duel_id


def _met_paper_sql(alias: str) -> str:
    # Never a paper the player has met before, in any duel.
    return (f"NOT EXISTS (SELECT 1 FROM pvp_entries m JOIN pvp_duels md ON md.id = m.duel_id "
            f"WHERE m.user_id = %(me)s AND md.seed = {alias}.seed AND md.level = {alias}.level "
            f"AND md.mix IS NOT DISTINCT FROM {alias}.mix AND md.paper_rev = {alias}.paper_rev)")


_APART = ("NOT EXISTS (SELECT 1 FROM pvp_blocks b WHERE (b.user_id = %(me)s AND b.blocked_id = {u}) "
          "OR (b.user_id = {u} AND b.blocked_id = %(me)s))")


def _reach(window: int) -> int:
    """How far a paper's mix may stand from the seeker's, in tenths of a
    level: half the Elo window (plan 286)."""
    return window // (2 * duel_paper.ELO_STEP)


def _seek(cur, me: str, elo: int, mix: int, now: datetime) -> int | None:
    """A run another learner played that nobody has met, on a paper
    whose mix is near `me`'s and by a player of an Elo near theirs:
    locked, or None. Never one on a retired revision of the paper: it
    waits out its 48 hours and is refunded, and nobody new is dealt what
    the revision corrected."""
    taken: list[int] = []
    for window in WINDOWS:
        for _try in range(3):
            cur.execute(
                f"""
                SELECT d.id FROM pvp_duels d
                  JOIN pvp_entries e ON e.duel_id = d.id
                  JOIN pvp_ratings r ON r.user_id = e.user_id
                 WHERE d.kind = 'ranked' AND d.mode = 'async' AND d.status = 'open' AND NOT d.ghost
                   AND d.paper_rev = %(rev)s
                   AND d.expires_at > %(soon)s AND ABS(d.mix - %(mix)s) <= %(reach)s
                   AND e.user_id <> %(me)s AND e.finished_at IS NOT NULL
                   AND (SELECT COUNT(*) FROM pvp_entries x WHERE x.duel_id = d.id) = 1
                   AND r.rating BETWEEN %(elo)s - %(window)s AND %(elo)s + %(window)s
                   AND d.id <> ALL(%(taken)s)
                   AND {_APART.format(u="e.user_id")}
                   AND {_met_paper_sql("d")}
                 ORDER BY ABS(d.mix - %(mix)s), ABS(r.rating - %(elo)s), d.created_at
                 LIMIT 1
                 FOR UPDATE OF d SKIP LOCKED
                """,
                # A seat is held HOLD before it must be started: a run
                # closer than that to its deadline is not offered.
                {"me": me, "elo": elo, "mix": mix, "reach": _reach(window), "window": window,
                 "soon": now + HOLD, "taken": taken, "rev": duel_paper.PAPER_REV},
            )
            row = cur.fetchone()
            if row is None:
                break
            # The count above is the statement's snapshot: a seeker who
            # took the seat and let the lock go while it ran is seen
            # only by a new statement, now that the run is locked.
            cur.execute("SELECT COUNT(*) FROM pvp_entries WHERE duel_id = %s", (row[0],))
            if cur.fetchone()[0] == 1:
                return row[0]
            taken.append(row[0])
    return None


def _ghost_source(cur, me: str, elo: int, mix: int) -> dict | None:
    """The recorded run of a real player of a near Elo, on a paper whose
    mix is near `me`'s and that `me` has never met. Never a run with no
    answer in it (a free win), never a paper of a retired revision, and
    never one whose corrections anyone has bought: dealt again, its keys
    could be handed to the next player before they run."""
    for window in WINDOWS:
        cur.execute(
            f"""
            SELECT e.duel_id, e.user_id FROM pvp_entries e
              JOIN pvp_duels d ON d.id = e.duel_id
             WHERE d.kind = 'ranked' AND d.status IN ('done', 'expired') AND d.paper_rev = %(rev)s
               AND e.role <> 'ghost' AND e.finished_at IS NOT NULL AND e.rating_before IS NOT NULL
               AND jsonb_array_length(e.answers) > 0
               AND e.user_id <> %(me)s AND ABS(d.mix - %(mix)s) <= %(reach)s
               AND e.rating_before BETWEEN %(elo)s - %(window)s AND %(elo)s + %(window)s
               AND {_APART.format(u="e.user_id")}
               AND {_met_paper_sql("d")}
               AND NOT EXISTS (SELECT 1 FROM pvp_entries rv JOIN pvp_duels rd ON rd.id = rv.duel_id
                                WHERE rv.reviewed AND rd.seed = d.seed AND rd.level = d.level
                                  AND rd.mix IS NOT DISTINCT FROM d.mix AND rd.paper_rev = d.paper_rev)
             ORDER BY ABS(d.mix - %(mix)s), ABS(e.rating_before - %(elo)s), e.finished_at DESC
             LIMIT 1
            """,
            {"me": me, "elo": elo, "mix": mix, "reach": _reach(window), "window": window,
             "rev": duel_paper.PAPER_REV},
        )
        row = cur.fetchone()
        if row:
            return {"duel_id": row[0], "user_id": row[1]}
    return None


def ranked(cur, after: list, me: str) -> tuple[int, str]:
    """A ranked sprint for `me`, never waiting: (duel id, against). A
    second press while a seat waits unstarted finds that seat. A first
    one starts the learner's Elo, from their level, with no test asked
    first (plan 282)."""
    level = resolve_level(me)
    rating, started = duel_elo.start(cur, me, level)
    if started:
        events.record(me, "pvp_placed", {"level": rating["placed_level"]}, cur=cur)
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
    _room_for_one(cur, after, me, now)
    elo = rating["rating"]
    # The paper stands where the Elo does (plan 286), not at the level.
    mix = duel_paper.mix_of(elo)

    duel_id = _seek(cur, me, elo, mix, now)
    if duel_id is not None:
        _seat(cur, duel_id, me, "opponent", now)
        return duel_id, "seek"

    source = _ghost_source(cur, me, elo, mix)
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

    seed, paper = _fresh_paper(mix)
    duel_id = _insert_duel(cur, "ranked", "async", paper["level"], seed, paper, now, now + WAIT)
    _seat(cur, duel_id, me, "challenger", now)
    return duel_id, "open"


# ── The cover ───────────────────────────────────────────────────────

def _price(duel: dict, mine: dict) -> int:
    return RANKED_PRICE if duel["kind"] == "ranked" and mine["started_at"] is None else 0


def _score_kept(duel: dict, mine: dict) -> bool:
    """A ranked run's score to beat is the player's once their own run
    has started, and not before: seen with a seat still unstarted (which
    costs nothing to give back), a strong run would be passed up for a
    weaker one. A friend's challenge shows it, as the challenge it is."""
    return duel["kind"] == "ranked" and mine["started_at"] is None


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
        # What each score was made of, line by line (plan 285).
        "lines": {"mine": lines(mine), "theirs": lines(other) if other else None},
        "elo": None if delta is None else {"before": mine["rating_before"], "after": mine["rating_after"],
                                           "delta": delta},
        "xp": mine["xp"],
    }


def cover(cur, after: list, me: str, duel_id: int) -> dict:
    """GET /api/pvp/duels/{id}: who, the level, the score to beat (a
    ranked one once the learner's run has started), the price, and once
    settled the result."""
    duel, entries, mine, now = _settled(cur, after, me, duel_id)
    other = _other(entries, me)
    named = names(cur, me, [e["user_id"] for e in entries])
    levels = {e["user_id"]: resolve_level(e["user_id"]) for e in entries if e["role"] != "ghost"}
    them = None
    if other is not None:
        rated = friends.ratings(cur, [other["user_id"]]).get(other["user_id"]) or {}
        played = other["finished_at"] is not None
        shown = played and not _score_kept(duel, mine)
        them = {
            "username": named.get(other["user_id"]),
            "level": levels.get(other["user_id"]),
            "elo": other["rating_before"] if other["role"] == "ghost" else rated.get("elo"),
            "played": played,
            # The score to beat, once their run is over -- a ranked one
            # once the learner's own has started.
            "score": (other["score"] or 0) if shown else None,
            "rights": (other["rights"] or 0) if shown else None,
        }
    elif duel["status"] == "done":
        them = {"username": None, "gone": True}
    passed = credits.unlimited_on(cur, me)
    refunded = False
    if duel["kind"] == "ranked":
        # A fare given back (an expiry, a closing): the result says so.
        cur.execute("SELECT 1 FROM credit_ledger WHERE user_id = %s AND reason = 'duel' AND ref = %s AND delta > 0",
                    (me, f"duel:{duel['id']}"))
        refunded = cur.fetchone() is not None
    return {
        "id": duel["id"],
        "kind": duel["kind"],
        "mode": duel["mode"],
        "level": duel["level"],
        # The levels the paper asks, and in what share (plan 286).
        "mix": mix_line(duel),
        "status": duel["status"],
        "against": against(duel, entries),
        "you": {"username": named.get(me), "level": levels.get(me), "role": mine["role"],
                "played": mine["finished_at"] is not None, "started": mine["started_at"] is not None,
                "score": mine["score"] if mine["finished_at"] else None,
                "rights": mine["rights"] if mine["finished_at"] else None,
                "answered": len(mine["answers"]) if mine["finished_at"] else None,
                "xp": mine["xp"] if mine["finished_at"] else None,
                "lines": lines(mine) if mine["finished_at"] else None,
                "refunded": refunded},
        "them": them,
        # The pass pays for everything: nothing to print on it.
        "price": 0 if passed else _price(duel, mine),
        "sprintMs": sprint_ms(duel),
        "rules": rules(duel),
        "expiresAt": _iso(duel["expires_at"]),
        "startsAt": _iso(duel["live_start"]),
        "serverNow": _iso(now),
        "result": _result(duel, mine, other),
        "reviewed": mine["reviewed"],
        "reviewPrice": 0 if passed else REVIEW_PRICE,
        # The day's duel XP against its ceiling, for the result's « N more today ».
        "xp": {"today": xp_today(cur, me, now), "cap": XP_CAP},
    }


# ── The sprint ──────────────────────────────────────────────────────

def _run_state(duel: dict, entries: list[dict], mine: dict, paper: dict, now: datetime) -> dict:
    other = _other(entries, me=mine["user_id"])
    n = mine["served_q"] or 0
    items = paper["items"]
    over = mine["finished_at"] is not None or n >= len(items)
    streak = streak_of(mine["answers"] or [])
    return {
        "startsAt": _iso(mine["started_at"]),
        "endsAt": _iso(_end(duel, mine)),
        "serverNow": _iso(now),
        "q": None if over else duel_paper.served(items[n], n),
        "qAt": _iso(mine["served_at"]),
        "total": mine["score"] or 0,
        "rights": mine["rights"] or 0,
        # The streak a run picked up again is on, and what it pays.
        "streak": streak,
        "mult": multiplier(streak) if combo_on(duel) else 1.0,
        "rules": rules(duel),
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
        if duel["kind"] == "ranked":
            mine["paid"] = _pay(cur, after, me, RANKED_PRICE, "duel", duel_id)
            _save(cur, mine, "paid")
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
        return _answered(duel, mine, a, items, over=mine["finished_at"] is not None)
    if mine["finished_at"] is not None:
        # settle() finished it: the sprint is over.
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
    # after the sprint lands on the finish line, never past it, so the
    # recording the other player races sums to the score.
    t = min(sprint_ms(duel), max(0, _ms(now - mine["started_at"])))
    a = {"n": n, "pick": pick, "right": right, "ms": ms, "pts": pts, "t": t}
    if combo_on(duel):
        # The streak this answer makes multiplies its points, and the
        # sprint's last seconds pay them once more (plan 285).
        mult = multiplier(streak_of(mine["answers"]) + 1) if right else 1.0
        a["combo"] = math.floor(pts * (mult - 1) + 0.5)
        a["rush"] = pts if t >= sprint_ms(duel) - RUSH_MS else 0
    mine["answers"] = [*mine["answers"], a]
    mine["score"] = (mine["score"] or 0) + scored(a)
    mine["rights"] = (mine["rights"] or 0) + int(right)
    mine["served_q"] = n + 1
    mine["served_at"] = now + timedelta(milliseconds=RIGHT_HOLD_MS if right else LOCK_MS)
    keys = ["answers", "score", "rights", "served_q", "served_at"]
    _save(cur, mine, *keys)
    # No question left, or the next one would be served after the
    # sprint: the run is over now, not once a grace nobody can use has
    # run out, so the reply that says so and a cover read right after it
    # agree -- and no question served after the end is ever answered.
    over = mine["served_q"] >= len(items) or mine["served_at"] >= _end(duel, mine)
    if over:
        _finish(cur, after, mine, min(now, _end(duel, mine)), now)
        settle(cur, after, duel, entries, now)
    return _answered(duel, mine, a, items, over=over)


def _answered(duel: dict, mine: dict, a: dict, items: list, over: bool) -> dict:
    nxt = mine["served_q"]
    # The answer is the run's last: the streak it ends on is its own.
    streak = streak_of(mine["answers"])
    return {
        # The pick the answer was recorded with, which a reply sent again
        # (lost on the way, a second device) is about: never the key.
        "n": a["n"], "pick": a["pick"], "right": a["right"], "pts": a["pts"], "ms": a["ms"],
        # What it added: the speed's points, the combo's and the rush's
        # (plan 285), and the streak the run is on with what it pays.
        "combo": a.get("combo", 0), "rush": a.get("rush", 0), "scored": scored(a),
        "streak": streak, "mult": multiplier(streak) if combo_on(duel) else 1.0,
        "total": mine["score"] or 0, "rights": mine["rights"] or 0,
        "next": None if over or nxt >= len(items) else duel_paper.served(items[nxt], nxt),
        "nextAt": _iso(mine["served_at"]),
        "endsAt": _iso(_end(duel, mine)),
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
    # Asked of a ranked duel (no screen does), the other's run stays kept
    # as the cover keeps it.
    seen = None if _score_kept(duel, mine) else other
    line = _timeline(seen)
    return {
        "status": duel["status"],
        "startsAt": _iso(duel["live_start"]),
        "endsAt": _iso(duel["live_start"] + timedelta(milliseconds=sprint_ms(duel))) if duel["live_start"] else None,
        "expiresAt": _iso(duel["expires_at"]),
        "serverNow": _iso(now),
        "them": {"total": (seen or {}).get("score") or 0, "rights": (seen or {}).get("rights") or 0,
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
    if any(e["started_at"] is not None and e["finished_at"] is None for e in entries):
        # The challenger is running their sprint: theirs to finish, and
        # declined only once it is over.
        raise Refused(409, "pvp_running")
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


# ── Closing what can no longer be played out ────────────────────────

def _close(cur, after: list, duel: dict, entries: list[dict], now: datetime, leaving: str | None = None) -> None:
    """Cancel a duel nobody can finish -- a friendship ended, a block, an
    account erased (`leaving`): a run under way ends where it stands and
    is paid its answers, and a fare paid is given back with the closing.
    The learner leaving is owed nothing: their rows go."""
    for e in entries:
        if e["role"] == "ghost" or e["user_id"] == leaving:
            continue
        if e["started_at"] and not e["finished_at"]:
            _finish(cur, after, e, min(now, _end(duel, e)), now)
        _give_back(cur, after, duel, e)
    _set_status(cur, duel, "cancelled", now)


def _up_to_date(cur, after: list, duel_id: int, now: datetime) -> tuple[dict | None, list[dict]]:
    """A duel locked and brought up to date as far as its runs go: one
    past its sprint is finished, two finished are resolved -- so what was
    played is kept rather than cancelled. (Not settle(): its expiries and
    seats given back would refund a learner whose account is going.)"""
    duel = _duel(cur, duel_id, lock=True)
    if duel is None:
        return None, []
    entries = _entries(cur, duel_id, lock=True)
    if duel["status"] not in ACTIVE:
        return duel, entries
    for e in entries:
        if e["role"] != "ghost" and e["started_at"] and not e["finished_at"]:
            if now >= _end(duel, e) + timedelta(milliseconds=GRACE_MS):
                _finish(cur, after, e, _end(duel, e), now)
    if len(entries) == 2 and all(e["finished_at"] for e in entries):
        _resolve(cur, duel, entries, now)
    return duel, entries


def close_between(cur, after: list, a: str, b: str) -> list[int]:
    """The friend duels between two learners still unresolved, cancelled
    (study/duel_friends: a friendship ended, a block). Returns their ids."""
    now = _now()
    cur.execute(
        """
        SELECT d.id FROM pvp_duels d
         WHERE d.kind = 'friend' AND d.status = ANY(%s)
           AND EXISTS (SELECT 1 FROM pvp_entries WHERE duel_id = d.id AND user_id = %s)
           AND EXISTS (SELECT 1 FROM pvp_entries WHERE duel_id = d.id AND user_id = %s)
         ORDER BY d.id
        """,
        (list(ACTIVE), a, b),
    )
    closed = []
    for (duel_id,) in cur.fetchall():
        duel, entries = _up_to_date(cur, after, duel_id, now)
        if duel is not None and duel["status"] in ACTIVE:
            _close(cur, after, duel, entries, now)
            closed.append(duel_id)
    return closed


def leave_all(cur, after: list, user_id: str) -> list[int]:
    """A learner's account is being erased (routes/account.py, before
    PLAN deletes their rows): every duel still unresolved that another
    learner is in is cancelled for them, what was played kept and their
    fares given back -- except a seat taken in another learner's ranked
    run, which the erasure gives back to the run, waiting for a stranger
    again. A duel nobody else is in goes whole with the erasure. Returns
    the ids cancelled."""
    now = _now()
    cur.execute(
        "SELECT DISTINCT e.duel_id FROM pvp_entries e JOIN pvp_duels d ON d.id = e.duel_id "
        "WHERE e.user_id = %s AND d.status = ANY(%s) ORDER BY e.duel_id",
        (user_id, list(ACTIVE)),
    )
    closed = []
    for (duel_id,) in cur.fetchall():
        duel, entries = _up_to_date(cur, after, duel_id, now)
        if duel is None or duel["status"] not in ACTIVE:
            continue
        if not any(e["role"] != "ghost" and e["user_id"] != user_id for e in entries):
            continue
        seat = _mine(entries, user_id)
        if duel["kind"] == "ranked" and not duel["ghost"] and seat is not None and seat["role"] == "opponent":
            continue
        _close(cur, after, duel, entries, now, leaving=user_id)
        closed.append(duel_id)
    return closed


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
        _pay(cur, after, me, REVIEW_PRICE, "duel_review", duel_id)
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
        # challenger | opponent: a challenge received is one the learner
        # is the opponent in (Today's notice names only those).
        "status": duel["status"], "against": against(duel, entries), "role": mine["role"],
        "who": named.get(other["user_id"]) if other else None,
        "gone": other is None and duel["status"] == "done",
        "mine": mine["score"] if mine["finished_at"] else None,
        "theirs": other["score"] if other and other["finished_at"] and not _score_kept(duel, mine) else None,
        "expiresAt": _iso(duel["expires_at"]),
        "since": _iso(mine["finished_at"] or mine["created_at"]),
    }
    if mine["started_at"] is not None and mine["finished_at"] is None and duel["status"] in ACTIVE:
        # A run left mid-sprint (the app closed, the screen left): the
        # way back in, while the sprint lasts.
        row["running"] = True
        row["endsAt"] = _iso(_end(duel, mine))
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


# What a client built before plan 282 reads before it draws the Elo (it
# sent a learner without one to the placement test): every learner has
# one now. A web tab keeps its bundle until the learner reloads.
_PLACED = {"placed": True}


def rating(cur, me: str) -> dict:
    """The learner's Elo: the figure, provisional or not, the record,
    the peak, the place on the Elo board, the level it started from and
    its curve over the last ranked duels. Before a first ranked sprint,
    the Elo their level starts them at, written by none (plan 282)."""
    row = duel_elo.rating_row(cur, me)
    if row is None:
        level = resolve_level(me)
        start = duel_elo.START[level]
        return {
            "elo": start, "provisional": True, "games": 0, "wins": 0, "draws": 0, "losses": 0,
            "peak": start, "level": level, "start": start,
            "rank": None, "of": board_place(cur, me)["of"], "trend": [],
            **_PLACED,
        }
    cur.execute(
        """
        SELECT e.rating_after FROM pvp_entries e JOIN pvp_duels d ON d.id = e.duel_id
         WHERE e.user_id = %s AND e.role <> 'ghost' AND d.kind = 'ranked' AND e.rating_after IS NOT NULL
         ORDER BY d.resolved_at DESC LIMIT %s
        """,
        (me, TREND),
    )
    last = cur.fetchall()[::-1]
    place = board_place(cur, me, row)
    return {
        **_PLACED,
        "elo": row["rating"],
        "provisional": row["games"] < duel_elo.PROVISIONAL,
        "games": row["games"], "wins": row["wins"], "draws": row["draws"], "losses": row["losses"],
        "peak": row["peak"], "level": row["placed_level"],
        # Where the learner's level started it: the curve's floor line.
        "start": duel_elo.START.get(row["placed_level"]),
        "rank": place["rank"], "of": place["of"],
        # The Elo after each of the last TREND ranked duels, oldest first.
        "trend": [int(a) for (a,) in last],
    }


def hub(cur, after: list, me: str) -> dict:
    """GET /api/pvp: the duels' hall in one call -- the Elo (before a
    first ranked sprint, the one the learner's level starts them at),
    the challenges to play, the live invitations, the duels waiting on
    the other, the last results, the friends and requests."""
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
        "prices": ({"ranked": 0, "review": 0} if credits.unlimited_on(cur, me)
                   else {"ranked": RANKED_PRICE, "review": REVIEW_PRICE}),
        "xp": {"today": xp_today(cur, me, now), "cap": XP_CAP},
    }


def history(cur, after: list, me: str, offset: int, limit: int) -> dict:
    # A duel closed under a run (a block, an account erased) kept what
    # was played: it is history too. One closed before anybody ran is not.
    rows = _rows(cur, me, "(d.status = ANY(%s) OR (d.status = 'cancelled' AND e.started_at IS NOT NULL))",
                 (["done", "expired", "declined"],), limit, offset)
    return {"entries": _named_rows(cur, me, rows), "offset": offset}


# ── The Elo board ───────────────────────────────────────────────────

def _ranked_sql(scope: str) -> str:
    """The board, ranked in the base: everyone rated who has played a
    ranked duel and keeps on the 番付, or `me` and their friends, best
    first, the ties by id. `me` is always counted, so a hidden learner
    sees their own place."""
    friends_only = ("AND (r.user_id = %(me)s OR r.user_id IN "
                    "(SELECT friend_id FROM pvp_friends WHERE user_id = %(me)s))")
    return f"""
        SELECT r.user_id, r.rating, r.games,
               ROW_NUMBER() OVER (ORDER BY r.rating DESC, r.user_id) AS rank
          FROM pvp_ratings r JOIN user_profiles p ON p.user_id = r.user_id
         WHERE r.games > 0 AND (NOT COALESCE(p.board_hidden, FALSE) OR r.user_id = %(me)s)
           {friends_only if scope == "friends" else ""}
    """


def board_place(cur, me: str, mine: dict | None = None) -> dict:
    """`me`'s place on the whole board and how many are on it, counted
    in the base (the hall asks on every read): one ahead is rated
    higher, or as high with a smaller id."""
    mine = mine if mine is not None else duel_elo.rating_row(cur, me)
    on = mine is not None and mine["games"] > 0
    cur.execute(
        """
        SELECT COUNT(*),
               COUNT(*) FILTER (WHERE r.rating > %(rating)s OR (r.rating = %(rating)s AND r.user_id < %(me)s))
          FROM pvp_ratings r JOIN user_profiles p ON p.user_id = r.user_id
         WHERE r.games > 0 AND (NOT COALESCE(p.board_hidden, FALSE) OR r.user_id = %(me)s)
        """,
        {"me": me, "rating": mine["rating"] if on else 0},
    )
    of, ahead = cur.fetchone()
    return {"rank": int(ahead) + 1 if on else None, "of": int(of)}


def board(cur, me: str, scope: str, offset: int, limit: int, around: int) -> dict:
    """A page of the board, `me`'s place with the gap to the one ahead,
    and the rows around it: ranked in the base, and only the rows shown
    leave it."""
    # One statement, so the size, the place and the rows are one
    # ranking: read in two, a learner hiding between them would leave a
    # page asking for a row that is no longer there.
    cur.execute(
        f"""
        WITH ranked AS ({_ranked_sql(scope)}),
             summary AS (SELECT COUNT(*) AS size, MAX(rank) FILTER (WHERE user_id = %(me)s) AS mine FROM ranked)
        SELECT s.size, s.mine, r.rank, r.user_id, r.rating, r.games, p.username
          FROM summary s
          LEFT JOIN ranked r ON (r.rank > %(offset)s AND r.rank <= %(offset)s + %(limit)s)
                             -- the rows around `me`, and the one ahead for the gap
                             OR r.rank BETWEEN s.mine - %(back)s AND s.mine + %(around)s
          LEFT JOIN user_profiles p ON p.user_id = r.user_id
        """,
        {"me": me, "offset": offset, "limit": limit, "around": around, "back": max(around, 1)},
    )
    rows = cur.fetchall()
    of, my_rank = int(rows[0][0]), rows[0][1]
    by_rank = {int(k): (uid, int(r), int(g), name) for _n, _m, k, uid, r, g, name in rows if k is not None}

    def row(k: int) -> dict:
        uid, r, g, name = by_rank[k]
        return {"rank": k, "username": name, "elo": r, "provisional": g < duel_elo.PROVISIONAL, "me": uid == me}

    out = {
        "scope": scope,
        "offset": offset,
        "of": of,
        "entries": [row(k) for k in range(offset + 1, min(offset + limit, of) + 1)],
        "near": [],
        "me": None,
    }
    if my_rank is not None:
        my_rank = int(my_rank)
        out["me"] = {**row(my_rank), "gap": None}
        if my_rank > 1:
            ahead = row(my_rank - 1)
            out["me"]["gap"] = {"elo": ahead["elo"] - by_rank[my_rank][1] + 1,
                                "username": ahead["username"], "rank": ahead["rank"]}
        if around:
            out["near"] = [row(k) for k in range(max(1, my_rank - around), min(of, my_rank + around) + 1)]
    else:
        mine = duel_elo.rating_row(cur, me)
        out["me"] = {"rank": None, "elo": mine["rating"] if mine else duel_elo.START[resolve_level(me)],
                     "provisional": True, "gap": None, "me": True}
    return out
