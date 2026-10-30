"""
対戦 — the Elo (plan 279).

A ranked sprint moves the Elo, a friendly one never does: friendly duels
are free, and a second account made a friend would lift anyone. The Elo
is apart from the 番付's XP -- the XP pays study, the Elo ranks sprints
-- and has no seasons.

  - It starts from the learner's level when their first ranked sprint
    is dealt (core/user_level.resolve_level, the level they study at):
    N5 1000, N4 1200, N3 1400, N2 1600, N1 1800 (the beginner's stop,
    a learner riding to the kana, 800 since plan 289), written then and once,
    so a level moved later leaves the Elo where its duels took it. No
    test is asked first (plan 282, the owner's call: the placement test
    was friction on the way to a first sprint). A start too high costs a
    few provisional duels at K 40; a strong learner starting low is the
    smurf below.
  - K is 40 for the first PROVISIONAL ranked duels, 20 after.
  - A smurf -- a strong learner on a fresh account -- keeps K at 40:
    from SMURF_GAMES duels on, when the last SMURF_WINDOW duels' rating
    performance (the opponents' mean + 400 x (wins - losses) / n) stands
    SMURF_GAP or more over the Elo with more than SMURF_WINS of them won.
  - The classic expectation, 1 / (1 + 10^((Rb - Ra) / 400)), a draw
    counts a half, and nobody falls under FLOOR.
"""
from __future__ import annotations

from datetime import datetime, timezone

# The beginner's stop (plan 289): a learner riding to the kana (their
# goal is core/user_level.NOVICE_GOAL) starts a level under N5.
NOVICE = "novice"
START = {"novice": 800, "N5": 1000, "N4": 1200, "N3": 1400, "N2": 1600, "N1": 1800}
K_PROVISIONAL = 40
K_SETTLED = 20
PROVISIONAL = 15
FLOOR = 100

SMURF_GAMES = 5
SMURF_WINDOW = 10
SMURF_GAP = 300
SMURF_WINS = 0.8


def expected(rating: float, opponent: float) -> float:
    """What a player rated `rating` is expected to score against `opponent`."""
    return 1 / (1 + 10 ** ((opponent - rating) / 400))


def performance(recent: list[tuple[int, float]]) -> float | None:
    """The rating the recent results perform at: [(opponent, result)]."""
    if not recent:
        return None
    wins = sum(1 for _o, r in recent if r == 1)
    losses = sum(1 for _o, r in recent if r == 0)
    return sum(o for o, _r in recent) / len(recent) + 400 * (wins - losses) / len(recent)


def is_smurf(rating: int, games: int, recent: list[tuple[int, float]]) -> bool:
    window = recent[:SMURF_WINDOW]
    if games < SMURF_GAMES or not window:
        return False
    wins = sum(1 for _o, r in window if r == 1)
    return performance(window) >= rating + SMURF_GAP and wins / len(window) > SMURF_WINS


def k_factor(rating: int, games: int, recent: list[tuple[int, float]]) -> int:
    if games < PROVISIONAL or is_smurf(rating, games, recent):
        return K_PROVISIONAL
    return K_SETTLED


def rated(rating: int, opponent: int, result: float, games: int,
          recent: list[tuple[int, float]]) -> int:
    """The Elo after one ranked duel. `games` and `recent` (newest first,
    [(opponent, result)]) are the learner's before it."""
    k = k_factor(rating, games, recent)
    return max(FLOOR, round(rating + k * (result - expected(rating, opponent))))


# ── The rating row ─────────────────────────────────────────────────

def rating_row(cur, user_id: str) -> dict | None:
    cur.execute(
        "SELECT rating, games, wins, draws, losses, peak, placed_level FROM pvp_ratings WHERE user_id = %s",
        (user_id,),
    )
    row = cur.fetchone()
    if not row:
        return None
    keys = ("rating", "games", "wins", "draws", "losses", "peak", "placed_level")
    return dict(zip(keys, row))


def start(cur, user_id: str, level: str) -> tuple[dict, bool]:
    """The learner's rating row, written at `level`'s start the first
    time a ranked sprint asks for it (placed_level and placed_at: the
    level it started from, and when): (the row, written now). A row
    already there is left as it stands."""
    now = datetime.now(timezone.utc)
    cur.execute(
        """
        INSERT INTO pvp_ratings (user_id, rating, peak, placed_level, placed_at, updated_at)
        VALUES (%(user)s, %(start)s, %(start)s, %(level)s, %(now)s, %(now)s)
        ON CONFLICT (user_id) DO NOTHING
        """,
        {"user": user_id, "start": START[level], "level": level, "now": now},
    )
    written = cur.rowcount == 1
    return rating_row(cur, user_id), written


def recent_results(cur, user_id: str) -> list[tuple[int, float]]:
    """The last ranked results, newest first: [(opponent rating, result)]."""
    cur.execute(
        """
        SELECT e.opponent_rating, e.result
          FROM pvp_entries e JOIN pvp_duels d ON d.id = e.duel_id
         WHERE e.user_id = %s AND e.role <> 'ghost' AND d.kind = 'ranked'
           AND e.result IS NOT NULL AND e.opponent_rating IS NOT NULL
         ORDER BY e.finished_at DESC NULLS LAST
         LIMIT %s
        """,
        (user_id, SMURF_WINDOW),
    )
    return [(int(o), float(r)) for o, r in cur.fetchall()]


def apply(cur, user_id: str, opponent: int, result: float) -> tuple[int, int, bool]:
    """Move the learner's Elo for one ranked duel: (before, after, smurf)."""
    row = rating_row(cur, user_id)
    if row is None:
        raise LookupError("no Elo started")
    recent = recent_results(cur, user_id)
    smurf = is_smurf(row["rating"], row["games"], recent)
    after = rated(row["rating"], opponent, result, row["games"], recent)
    cur.execute(
        """
        UPDATE pvp_ratings
           SET rating = %(after)s, games = games + 1,
               wins = wins + %(w)s, draws = draws + %(d)s, losses = losses + %(l)s,
               peak = GREATEST(peak, %(after)s), updated_at = NOW()
         WHERE user_id = %(user)s
        """,
        {"after": after, "w": int(result == 1), "d": int(result == 0.5), "l": int(result == 0), "user": user_id},
    )
    return row["rating"], after, smurf
