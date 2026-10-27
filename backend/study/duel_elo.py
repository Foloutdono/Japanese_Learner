"""
対戦 — the Elo (plan 276).

A ranked sprint moves the Elo, a friendly one never does: friendly duels
are free, and a second account made a friend would lift anyone. The Elo
is apart from the 番付's XP -- the XP pays study, the Elo ranks sprints
-- and has no seasons.

  - It starts where the placement test boards the learner, never at a
    level they declared: N5 1000, N4 1200, N3 1400, N2 1600, N1 1800.
    The climb's verdict is noted when it ends (routes/onboarding.py), and
    rewritten only while no ranked duel has been played: taking the test
    again does not reset an Elo. A learner without one takes the test
    before their first ranked duel.
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

START = {"N5": 1000, "N4": 1200, "N3": 1400, "N2": 1600, "N1": 1800}
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


def record_placement(cur, user_id: str, level: str) -> bool:
    """Note where the placement test boarded the learner, as their
    starting Elo -- only while no ranked duel has been played. True when
    it was written."""
    if level not in START:
        return False
    start = START[level]
    now = datetime.now(timezone.utc)
    cur.execute(
        """
        INSERT INTO pvp_ratings (user_id, rating, peak, placed_level, placed_at, updated_at)
        VALUES (%(user)s, %(start)s, %(start)s, %(level)s, %(now)s, %(now)s)
        ON CONFLICT (user_id) DO UPDATE
           SET rating = EXCLUDED.rating, peak = EXCLUDED.peak,
               placed_level = EXCLUDED.placed_level, placed_at = EXCLUDED.placed_at,
               updated_at = EXCLUDED.updated_at
         WHERE pvp_ratings.games = 0
        """,
        {"user": user_id, "start": start, "level": level, "now": now},
    )
    return cur.rowcount == 1


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
        raise LookupError("not placed")
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
