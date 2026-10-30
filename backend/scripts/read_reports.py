"""
The duels' reports (plan 279), newest first, as markdown.

    python -m scripts.read_reports                  # the last 30 days
    python -m scripts.read_reports --days 90
    python -m scripts.read_reports --reason cheat   # name | cheat | spam | other
    python -m scripts.read_reports --learner taro   # the reports OF one username

Read-only. There is no --yes because there is nothing to confirm.

-- Why a script and not a dashboard ------------------------------
A report names two people: who reported, and whom. The 足跡 dashboard
(docs/analytics/metabase/11-duels.sql) counts them by reason and never
reads who; the weekly digest lands on a GitHub run page anyone with the
repository can open. So who reported whom is read here, by a person,
from the backend's Render Shell or a terminal holding DATABASE_URL --
and nowhere else, as scripts/read_feedback.py reads the messages.

A report carries no words: a closed reason (name, an inappropriate
username; cheat, cheating or a strong player on a fresh account; spam,
requests or challenges sent again and again; other), and the duel it
was made from when it was an opponent's. One row per pair: a second
report replaces the first one's reason. Nothing is hidden or blocked
because of one; what to do is the reader's call.

Each reported learner is printed once, with every report against them,
their Elo record and, for `cheat`, the duels the reports point at.
"""
import argparse
import re

import scripts._env  # noqa: F401  -- must precede core.db, which reads
#                       DATABASE_URL at module scope. See scripts/_env.py.
from core.db import db_conn

DEFAULT_DAYS = 30
REASONS = ("name", "cheat", "spam", "other")
# The most a run prints: a backlog is read a page at a time.
LIMIT = 200
USERNAME = re.compile(r"^[a-zA-Z0-9_]{3,20}$")


def fetch(cur, days: int, reason: str | None, learner: str | None) -> list[dict]:
    where = ["r.created_at > NOW() - (%s || ' days')::interval"]
    params: list = [days]
    if reason:
        where.append("r.reason = %s")
        params.append(reason)
    if learner:
        where.append("lower(t.username) = lower(%s)")
        params.append(learner)
    cur.execute(
        f"""
        SELECT r.id, r.reason, r.duel_id, r.created_at, r.reported_id, t.username AS reported,
               r.user_id, b.username AS reporter, g.rating, g.games, g.wins, g.losses, g.placed_level
          FROM pvp_reports r
          LEFT JOIN user_profiles t ON t.user_id = r.reported_id
          LEFT JOIN user_profiles b ON b.user_id = r.user_id
          LEFT JOIN pvp_ratings g ON g.user_id = r.reported_id
         WHERE {' AND '.join(where)}
         ORDER BY r.created_at DESC, r.id DESC
         LIMIT {LIMIT}
        """,
        params,
    )
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def render(reported_id: str, rows: list[dict]) -> str:
    first = rows[0]
    name = first["reported"] or "(account gone)"
    head = f"### {name} · {len(rows)} report{'s' if len(rows) > 1 else ''}"
    facts = [f"user `{reported_id}`"]
    if first["rating"] is not None:
        facts.append(f"Elo {first['rating']} · {first['wins']}–{first['losses']} in {first['games']} ranked"
                     f" · started at {first['placed_level']}")
    lines = []
    for row in rows:
        duel = f" · duel {row['duel_id']}" if row["duel_id"] else ""
        lines.append(f"- {row['created_at']:%Y-%m-%d %H:%M} UTC · **{row['reason']}**{duel}"
                     f" · by {row['reporter'] or '(account gone)'} (`{row['user_id']}`)")
    return "\n".join([head, "", *(f"- {f}" for f in facts), "", *lines, ""])


def main() -> int:
    ap = argparse.ArgumentParser(description="The duels' reports, newest first.")
    ap.add_argument("--days", type=int, default=DEFAULT_DAYS, help=f"window in days (default {DEFAULT_DAYS})")
    ap.add_argument("--reason", choices=REASONS, help="one reason only")
    ap.add_argument("--learner", help="the reports of one username")
    args = ap.parse_args()
    if args.learner and not USERNAME.match(args.learner):
        ap.error("a username is 3 to 20 letters, digits or _")

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            rows = fetch(cur, args.days, args.reason, args.learner)
    finally:
        conn.close()

    by_learner: dict[str, list[dict]] = {}
    for row in rows:
        by_learner.setdefault(row["reported_id"], []).append(row)

    print(f"## Reports — the last {args.days} days ({len(rows)}, {len(by_learner)} learners)\n")
    if not rows:
        print("_Nothing yet._")
    for reported_id, group in sorted(by_learner.items(), key=lambda kv: -len(kv[1])):
        print(render(reported_id, group))
    if len(rows) == LIMIT:
        print(f"_The newest {LIMIT}; narrow --days or --reason for the rest._")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
