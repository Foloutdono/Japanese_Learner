"""
対戦 — friends, blocks and reports (plan 276).

A friend is found by their exact username, whatever its case: `Taro`
finds `taro`, `tar` finds nobody, so the usernames cannot be walked. A
learner who keeps off the 番付 is found all the same (the owner's
choice); one who blocked the searcher, or whom the searcher blocked, is
not found at all. Searches are bounded per learner (SEARCHES in
SEARCH_WINDOW).

Before a request is accepted each side sees the other's username alone:
the search and the requests received and sent carry nothing else.
Friends see each other's Elo and the record of their duels.

  request   sent; friends at once when the other had asked too
  accept    the other's request: friends, a row each way
  refuse    the request vanishes for its sender, who may not ask the
            same learner again for COOLDOWN
  withdraw  one's own request, while it waits
  remove    a friend; the challenges between the two still unresolved
            are cancelled (only friends challenge each other)
  block     removes the friendship and the requests both ways, cancels
            the friend duels between the two still unresolved, and keeps
            them apart in ranked play; nobody is told
  report    a closed reason (REPORT_REASONS), one row per pair: a second
            report replaces the reason. Nothing is hidden because of
            one: a person reads them (scripts/read_reports.py), the
            dashboards count reasons, never who reported whom.

No text a learner typed is kept: a username is looked up, never stored.
Everything here works on the caller's cursor and raises Refused with a
code the screens map to their own words; the route commits.
"""
from __future__ import annotations

import time
from collections import deque
from datetime import datetime, timedelta, timezone

FRIENDS_MAX = 200
PENDING_MAX = 50
REQUESTS_PER_DAY = 20
COOLDOWN = timedelta(days=30)
REPORT_REASONS = ("name", "cheat", "spam", "other")
SEARCHES = 30
SEARCH_WINDOW = 600.0


class Refused(Exception):
    """A refusal the route answers with: an HTTP status and a code the
    client maps to a locale key (lib/api.js, ApiError.code)."""

    def __init__(self, status: int, code: str):
        super().__init__(code)
        self.status = status
        self.code = code


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── The search's bound ──────────────────────────────────────────────
# In process: the API runs one worker (CLAUDE.md, plan 211). A restart
# forgets the counts, which costs a determined walker one window.
_searches: dict[str, deque] = {}


def count_search(user_id: str, now: float | None = None) -> None:
    """One search, or Refused once SEARCHES were made in SEARCH_WINDOW."""
    now = time.monotonic() if now is None else now
    hits = _searches.setdefault(user_id, deque())
    while hits and hits[0] <= now - SEARCH_WINDOW:
        hits.popleft()
    if len(hits) >= SEARCHES:
        raise Refused(429, "pvp_search_limit")
    hits.append(now)
    if len(_searches) > 1000:
        for uid in [u for u, h in _searches.items() if not h or h[-1] <= now - SEARCH_WINDOW]:
            _searches.pop(uid, None)


# ── Who a username names ────────────────────────────────────────────

def find(cur, username: str) -> tuple[str, str] | None:
    """(user_id, username) for a username in any case, or None."""
    cur.execute(
        "SELECT user_id, username FROM user_profiles WHERE lower(username) = lower(%s)",
        (username,),
    )
    row = cur.fetchone()
    return (row[0], row[1]) if row else None


def blocked_between(cur, a: str, b: str) -> bool:
    cur.execute(
        "SELECT 1 FROM pvp_blocks WHERE (user_id = %s AND blocked_id = %s) OR (user_id = %s AND blocked_id = %s)",
        (a, b, b, a),
    )
    return cur.fetchone() is not None


def reach(cur, me: str, username: str) -> tuple[str, str]:
    """The learner a username names, as `me` may reach them: not found
    when nobody holds it, or when a block stands between the two."""
    found = find(cur, username)
    if found is None or (found[0] != me and blocked_between(cur, me, found[0])):
        raise Refused(404, "pvp_not_found")
    return found


def are_friends(cur, a: str, b: str) -> bool:
    cur.execute("SELECT 1 FROM pvp_friends WHERE user_id = %s AND friend_id = %s", (a, b))
    return cur.fetchone() is not None


def relation(cur, me: str, other: str) -> str:
    """me | friend | received | sent | none, as `me` sees it. A refused
    request reads `none` on both sides: it vanished for its sender."""
    if other == me:
        return "me"
    if are_friends(cur, me, other):
        return "friend"
    cur.execute(
        "SELECT user_id FROM pvp_requests WHERE refused_at IS NULL AND "
        "((user_id = %s AND target_id = %s) OR (user_id = %s AND target_id = %s))",
        (me, other, other, me),
    )
    senders = {row[0] for row in cur.fetchall()}
    if other in senders:
        return "received"
    if me in senders:
        return "sent"
    return "none"


# ── Requests and friendships ────────────────────────────────────────

def _friend_count(cur, user_id: str) -> int:
    cur.execute("SELECT COUNT(*) FROM pvp_friends WHERE user_id = %s", (user_id,))
    return int(cur.fetchone()[0])


def _befriend(cur, a: str, b: str) -> None:
    for uid in (a, b):
        if _friend_count(cur, uid) >= FRIENDS_MAX:
            raise Refused(409, "pvp_friend_limit")
    cur.execute(
        "INSERT INTO pvp_friends (user_id, friend_id) VALUES (%s, %s), (%s, %s) ON CONFLICT DO NOTHING",
        (a, b, b, a),
    )
    cur.execute(
        "DELETE FROM pvp_requests WHERE (user_id = %s AND target_id = %s) OR (user_id = %s AND target_id = %s)",
        (a, b, b, a),
    )


def request(cur, me: str, other: str) -> str:
    """Ask `other` to be friends: `sent`; `friends` when they had asked
    too, which accepts theirs; `already` when they were friends."""
    if other == me:
        raise Refused(400, "pvp_self")
    if are_friends(cur, me, other):
        return "already"
    cur.execute(
        "SELECT 1 FROM pvp_requests WHERE user_id = %s AND target_id = %s AND refused_at IS NULL",
        (other, me),
    )
    if cur.fetchone():
        _befriend(cur, me, other)
        return "friends"
    now = _now()
    cur.execute(
        "SELECT refused_at FROM pvp_requests WHERE user_id = %s AND target_id = %s FOR UPDATE",
        (me, other),
    )
    mine = cur.fetchone()
    if mine and mine[0] is None:
        return "sent"
    if mine and now - mine[0] < COOLDOWN:
        raise Refused(409, "pvp_request_cooldown")
    if _friend_count(cur, me) >= FRIENDS_MAX:
        raise Refused(409, "pvp_friend_limit")
    cur.execute(
        "SELECT COUNT(*) FILTER (WHERE refused_at IS NULL), COUNT(*) FILTER (WHERE created_at > %s) "
        "FROM pvp_requests WHERE user_id = %s",
        (now - timedelta(days=1), me),
    )
    pending, today = cur.fetchone()
    if pending >= PENDING_MAX:
        raise Refused(409, "pvp_pending_limit")
    if today >= REQUESTS_PER_DAY:
        raise Refused(429, "pvp_request_limit")
    if mine:
        cur.execute(
            "UPDATE pvp_requests SET created_at = %s, refused_at = NULL WHERE user_id = %s AND target_id = %s",
            (now, me, other),
        )
    else:
        cur.execute(
            "INSERT INTO pvp_requests (user_id, target_id, created_at) VALUES (%s, %s, %s)",
            (me, other, now),
        )
    return "sent"


def accept(cur, me: str, other: str) -> None:
    cur.execute(
        "SELECT 1 FROM pvp_requests WHERE user_id = %s AND target_id = %s AND refused_at IS NULL",
        (other, me),
    )
    if not cur.fetchone():
        raise Refused(404, "pvp_no_request")
    _befriend(cur, me, other)


def refuse(cur, me: str, other: str) -> None:
    cur.execute(
        "UPDATE pvp_requests SET refused_at = %s WHERE user_id = %s AND target_id = %s AND refused_at IS NULL",
        (_now(), other, me),
    )
    if cur.rowcount == 0:
        raise Refused(404, "pvp_no_request")


def withdraw(cur, me: str, other: str) -> None:
    # A refused request is not the sender's to delete: that would lift
    # its cooldown.
    cur.execute(
        "DELETE FROM pvp_requests WHERE user_id = %s AND target_id = %s AND refused_at IS NULL",
        (me, other),
    )
    if cur.rowcount == 0:
        raise Refused(404, "pvp_no_request")


def _close_between(cur, after: list, a: str, b: str) -> None:
    # The friend duels between the two, cancelled with what was played
    # kept and paid (study/duels, which imports this module).
    from study import duels
    duels.close_between(cur, after, a, b)


def unfriend(cur, after: list, me: str, other: str) -> None:
    cur.execute(
        "DELETE FROM pvp_friends WHERE (user_id = %s AND friend_id = %s) OR (user_id = %s AND friend_id = %s)",
        (me, other, other, me),
    )
    if cur.rowcount == 0:
        raise Refused(404, "pvp_not_friends")
    _close_between(cur, after, me, other)


def block(cur, after: list, me: str, other: str) -> None:
    if other == me:
        raise Refused(400, "pvp_self")
    cur.execute(
        "INSERT INTO pvp_blocks (user_id, blocked_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
        (me, other),
    )
    cur.execute(
        "DELETE FROM pvp_friends WHERE (user_id = %s AND friend_id = %s) OR (user_id = %s AND friend_id = %s)",
        (me, other, other, me),
    )
    cur.execute(
        "DELETE FROM pvp_requests WHERE (user_id = %s AND target_id = %s) OR (user_id = %s AND target_id = %s)",
        (me, other, other, me),
    )
    _close_between(cur, after, me, other)


def unblock(cur, me: str, other: str) -> None:
    cur.execute("DELETE FROM pvp_blocks WHERE user_id = %s AND blocked_id = %s", (me, other))
    if cur.rowcount == 0:
        raise Refused(404, "pvp_not_blocked")


def report(cur, me: str, other: str, reason: str, duel_id: int | None = None) -> None:
    if reason not in REPORT_REASONS:
        raise Refused(400, "pvp_bad_reason")
    if other == me:
        raise Refused(400, "pvp_self")
    cur.execute(
        """
        INSERT INTO pvp_reports (user_id, reported_id, reason, duel_id)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (user_id, reported_id) DO UPDATE
           SET reason = EXCLUDED.reason, duel_id = EXCLUDED.duel_id, created_at = NOW()
        """,
        (me, other, reason, duel_id),
    )


# ── What the friends page reads ─────────────────────────────────────

def records(cur, me: str, others: list[str]) -> dict[str, dict]:
    """The record of `me`'s resolved duels against each of `others`
    (ghosts aside: a race against a recording is not a duel between
    two people): {other: {wins, draws, losses}}."""
    if not others:
        return {}
    cur.execute(
        """
        SELECT o.user_id,
               COUNT(*) FILTER (WHERE m.result = 1),
               COUNT(*) FILTER (WHERE m.result = 0.5),
               COUNT(*) FILTER (WHERE m.result = 0)
          FROM pvp_entries m
          JOIN pvp_entries o ON o.duel_id = m.duel_id AND o.user_id <> m.user_id
          JOIN pvp_duels d ON d.id = m.duel_id
         WHERE m.user_id = %s AND o.user_id = ANY(%s) AND d.status = 'done'
           AND m.role <> 'ghost' AND o.role <> 'ghost' AND d.ghost = FALSE
           AND m.result IS NOT NULL
         GROUP BY o.user_id
        """,
        (me, others),
    )
    return {uid: {"wins": int(w), "draws": int(d), "losses": int(l)} for uid, w, d, l in cur.fetchall()}


def ratings(cur, user_ids: list[str]) -> dict[str, dict]:
    """{user_id: {elo, provisional}} for those who have an Elo."""
    from study.duel_elo import PROVISIONAL
    if not user_ids:
        return {}
    cur.execute("SELECT user_id, rating, games FROM pvp_ratings WHERE user_id = ANY(%s)", (user_ids,))
    return {uid: {"elo": int(r), "provisional": int(g) < PROVISIONAL} for uid, r, g in cur.fetchall()}


def page(cur, me: str) -> dict:
    """The friends page: friends (username, Elo, the record of their
    duels), the requests received and sent (the username alone), and the
    learners `me` blocked (to unblock them)."""
    cur.execute(
        """
        SELECT f.friend_id, p.username FROM pvp_friends f
          JOIN user_profiles p ON p.user_id = f.friend_id
         WHERE f.user_id = %s ORDER BY lower(p.username)
        """,
        (me,),
    )
    friends = cur.fetchall()
    ids = [uid for uid, _ in friends]
    rated = ratings(cur, ids)
    record = records(cur, me, ids)
    empty = {"wins": 0, "draws": 0, "losses": 0}

    def names(sql: str) -> list[dict]:
        cur.execute(sql, (me,))
        return [{"username": name} for (name,) in cur.fetchall()]

    return {
        "friends": [
            {"username": name, "elo": (rated.get(uid) or {}).get("elo"),
             "provisional": (rated.get(uid) or {}).get("provisional", False),
             **record.get(uid, empty)}
            for uid, name in friends
        ],
        "requests": names(
            "SELECT p.username FROM pvp_requests r JOIN user_profiles p ON p.user_id = r.user_id "
            "WHERE r.target_id = %s AND r.refused_at IS NULL ORDER BY r.created_at DESC"
        ),
        "sent": names(
            "SELECT p.username FROM pvp_requests r JOIN user_profiles p ON p.user_id = r.target_id "
            "WHERE r.user_id = %s AND r.refused_at IS NULL ORDER BY r.created_at DESC"
        ),
        "blocked": names(
            "SELECT p.username FROM pvp_blocks b JOIN user_profiles p ON p.user_id = b.blocked_id "
            "WHERE b.user_id = %s ORDER BY b.created_at DESC"
        ),
        "limits": {"friends": FRIENDS_MAX},
    }


def card(cur, me: str, other: str, username: str) -> dict:
    """A learner's card as `me` may read it: a friend's Elo and the
    record of their duels; anyone else's username alone."""
    rel = relation(cur, me, other)
    out: dict = {"username": username, "relation": rel}
    if rel in ("friend", "me"):
        rated = ratings(cur, [other]).get(other) or {}
        out["elo"] = rated.get("elo")
        out["provisional"] = rated.get("provisional", False)
    if rel == "friend":
        out.update(records(cur, me, [other]).get(other) or {"wins": 0, "draws": 0, "losses": 0})
    return out


def requests_waiting(cur, me: str) -> int:
    cur.execute("SELECT COUNT(*) FROM pvp_requests WHERE target_id = %s AND refused_at IS NULL", (me,))
    return int(cur.fetchone()[0])


def friend_count(cur, me: str) -> int:
    return _friend_count(cur, me)
