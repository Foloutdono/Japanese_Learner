"""
What learners wrote to us (plan 222), newest first, as markdown.

    python -m scripts.read_feedback                 # the last 7 days
    python -m scripts.read_feedback --days 30
    python -m scripts.read_feedback --kind card     # problem | idea | fault | card | rating
    python -m scripts.read_feedback --reply         # only those asking for an answer

Read-only. There is no --yes because there is nothing to confirm.

-- Why a script and not a dashboard ------------------------------
The 足跡 dashboards count; they never read a word a learner typed
(tests/test_metabase_sync.py holds every question to it), and the
weekly digest lands on a GitHub run page anyone with the repository can
open. A message is nothing but words, so it is read here, by a person,
from the backend's Render Shell or a terminal holding DATABASE_URL --
and nowhere else. docs/analytics/metabase/10-messages.sql counts them.

Each message prints its kind, when, the screen and device classes it
carried (if the learner left them joined), a failure's area and status,
a card's id and reasons, and the address to answer when one was asked
for. The address is the account's own, read when the message was sent
(routes/feedback.py); `reply` with no address is a learner who asked
while the auth service could not be read -- their user id finds them.
"""
import argparse

import scripts._env  # noqa: F401  -- must precede core.db, which reads
#                       DATABASE_URL at module scope. See scripts/_env.py.
from core.db import db_conn

DEFAULT_DAYS = 7
KINDS = ("problem", "idea", "fault", "card", "rating")
# The most a run prints: a backlog is read a page at a time.
LIMIT = 200


def fetch(cur, days: int, kind: str | None, reply: bool) -> list[dict]:
    where = ["created_at > NOW() - (%s || ' days')::interval"]
    params: list = [days]
    if kind:
        where.append("kind = %s")
        params.append(kind)
    if reply:
        where.append("reply")
    cur.execute(
        f"""
        SELECT id, user_id, kind, body, reasons, card_id, exam_id, revision, question_id, rating, route, area, status,
               platform, vp, os, lang, reply, reply_to, created_at
          FROM feedback
         WHERE {' AND '.join(where)}
         ORDER BY created_at DESC, id DESC
         LIMIT {LIMIT}
        """,
        params,
    )
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def render(row: dict) -> str:
    head = f"### #{row['id']} · {row['kind']} · {row['created_at']:%Y-%m-%d %H:%M} UTC"
    facts = []
    if row.get("question_id"):
        reasons = ", ".join(row["reasons"]) if row["reasons"] else "—"
        facts.append(f"question `{row['exam_id']}` r{row['revision']} `{row['question_id']}` · {reasons}")
    if row["card_id"]:
        reasons = ", ".join(row["reasons"]) if row["reasons"] else "—"
        facts.append(f"card `{row['card_id']}` · {reasons}")
    if row.get("rating"):
        facts.append(f"rating {row['rating']}/5")
    if row["area"]:
        facts.append(f"failed `{row['area']}` · {row['status']}")
    where = " · ".join(v for v in (row["route"], row["vp"], row["os"], row["platform"], row["lang"]) if v)
    if where:
        facts.append(where)
    if row["reply"]:
        facts.append(f"answer to: {row['reply_to'] or 'address not read — user ' + row['user_id']}")
    facts.append(f"user `{row['user_id']}`")
    body = "\n".join(f"> {line}" if line else ">" for line in row["body"].splitlines()) or "> _(no words)_"
    return "\n".join([head, "", *(f"- {f}" for f in facts), "", body, ""])


def main() -> int:
    ap = argparse.ArgumentParser(description="What learners wrote to us, newest first.")
    ap.add_argument("--days", type=int, default=DEFAULT_DAYS, help=f"window in days (default {DEFAULT_DAYS})")
    ap.add_argument("--kind", choices=KINDS, help="one kind only")
    ap.add_argument("--reply", action="store_true", help="only the messages asking for an answer")
    args = ap.parse_args()

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            rows = fetch(cur, args.days, args.kind, args.reply)
    finally:
        conn.close()

    print(f"## Written to us — the last {args.days} days ({len(rows)})\n")
    if not rows:
        print("_Nothing yet._")
    for row in rows:
        print(render(row))
    if len(rows) == LIMIT:
        print(f"_The newest {LIMIT}; narrow --days or --kind for the rest._")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
