"""
What learners wrote to us (plan 222), as markdown, grouped by kind and
newest first in each, and each message's place in the owner's queue
(plan 278).

    python -m scripts.read_feedback                 # the open ones (new, seen), any age
    python -m scripts.read_feedback --id 412        # one message, whatever its state
    python -m scripts.read_feedback --triage all --days 30
    python -m scripts.read_feedback --kind card     # problem | fault | card | question | idea | rating
    python -m scripts.read_feedback --reply         # only those asking for an answer

    python -m scripts.read_feedback --seen 412      # read, and waiting on a fix
    python -m scripts.read_feedback --done 412 413  # fixed, or answered
    python -m scripts.read_feedback --drop 414      # nothing to do
    python -m scripts.read_feedback --reopen 412    # back to new

Reading changes nothing. A status is set only on the messages named:
the ids are the confirmation there is no --yes for, and --reopen undoes
it. `triaged_at` keeps when a message left new.

-- Why a script and not a dashboard ------------------------------
The 足跡 dashboards count; they never read a word a learner typed
(tests/test_metabase_sync.py holds every question to it), and the
weekly digest lands on a GitHub run page anyone with the repository can
open. A message is nothing but words, so it is read here, by a person,
from the backend's Render Shell or a terminal holding DATABASE_URL --
and nowhere else. docs/analytics/metabase/10-messages.sql counts them.

-- The bell (plan 278) ---------------------------------------------
Each message rings the owner's private Discord forum (core/bell.py),
tagged by its kind, with its number and closed classes and never its
words; the post names the --id line that prints it here. The forum's
tags sort the posts; the status kept here is what says a message is
handled.

Each message prints its kind, its status, when, the screen and device
classes it carried (if the learner left them joined), a failure's area
and status, a card's id and reasons, and the address to answer when one
was asked for. The address is the account's own, read when the message
was sent (routes/feedback.py); `reply` with no address is a learner who
asked while the auth service could not be read -- their user id finds
them.
"""
import argparse

import scripts._env  # noqa: F401  -- must precede core.db, which reads
#                       DATABASE_URL at module scope. See scripts/_env.py.
from core.db import db_conn

# The order the kinds are printed in: what is broken first.
KINDS = ("problem", "fault", "card", "question", "idea", "rating")
# routes/feedback.TRIAGE, and the flag that sets each (tests hold them equal).
SETS = {"seen": "seen", "done": "done", "drop": "dropped", "reopen": "new"}
OPEN = ("new", "seen")
VIEWS = ("open", "new", "seen", "done", "dropped", "all")
# The most a run prints: a backlog is read a page at a time.
LIMIT = 200


def fetch(cur, days: int | None, kind: str | None, reply: bool,
          triage: str = "all", ids: list[int] | None = None) -> list[dict]:
    """Newest first. `ids` names messages whatever else is asked."""
    where, params = [], []
    if ids:
        where.append("id = ANY(%s)")
        params.append(list(ids))
    else:
        if days:
            where.append("created_at > NOW() - (%s || ' days')::interval")
            params.append(days)
        if kind:
            where.append("kind = %s")
            params.append(kind)
        if reply:
            where.append("reply")
        if triage == "open":
            where.append("triage = ANY(%s)")
            params.append(list(OPEN))
        elif triage != "all":
            where.append("triage = %s")
            params.append(triage)
    cur.execute(
        f"""
        SELECT id, user_id, kind, body, reasons, card_id, exam_id, revision, question_id, rating, route, area, status,
               platform, vp, os, lang, reply, reply_to, triage, created_at
          FROM feedback
         WHERE {' AND '.join(where) or 'TRUE'}
         ORDER BY created_at DESC, id DESC
         LIMIT {LIMIT}
        """,
        params,
    )
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def mark(cur, ids: list[int], triage: str) -> list[tuple[int, str]]:
    """Set the named messages' status; the (id, kind) of each that exists.
    Back to new, a message is untriaged again."""
    cur.execute(
        "UPDATE feedback SET triage = %s, "
        "triaged_at = CASE WHEN %s = 'new' THEN NULL ELSE NOW() END "
        "WHERE id = ANY(%s) RETURNING id, kind",
        (triage, triage, list(ids)),
    )
    return sorted(cur.fetchall())


def render(row: dict) -> str:
    head = f"### #{row['id']} · {row['kind']} · {row.get('triage', 'new')} · {row['created_at']:%Y-%m-%d %H:%M} UTC"
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


def by_kind(rows: list[dict]) -> list[tuple[str, list[dict]]]:
    """The rows in KINDS' order, each kind's newest first, as fetched."""
    order = list(KINDS) + sorted({r["kind"] for r in rows} - set(KINDS))
    return [(k, [r for r in rows if r["kind"] == k]) for k in order if any(r["kind"] == k for r in rows)]


def main() -> int:
    ap = argparse.ArgumentParser(description="What learners wrote to us, by kind, newest first.")
    ap.add_argument("--id", type=int, nargs="+", dest="ids", metavar="ID", help="these messages, whatever their state")
    ap.add_argument("--triage", choices=VIEWS, default="open", help="which state to list (default: open, new and seen)")
    ap.add_argument("--days", type=int, help="only the last N days (default: any age)")
    ap.add_argument("--kind", choices=KINDS, help="one kind only")
    ap.add_argument("--reply", action="store_true", help="only the messages asking for an answer")
    acts = ap.add_mutually_exclusive_group()
    for flag, triage in SETS.items():
        acts.add_argument(f"--{flag}", type=int, nargs="+", metavar="ID", help=f"mark these messages {triage}")
    args = ap.parse_args()

    action = next(((SETS[f], getattr(args, f)) for f in SETS if getattr(args, f)), None)
    if action:
        triage, ids = action
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                done = mark(cur, ids, triage)
            conn.commit()
        finally:
            conn.close()
        for number, kind in done:
            print(f"#{number} · {kind} → {triage}")
        missing = sorted(set(ids) - {n for n, _ in done})
        for number in missing:
            print(f"#{number}: no such message")
        return 1 if missing else 0

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            rows = fetch(cur, args.days, args.kind, args.reply, args.triage, args.ids)
    finally:
        conn.close()

    if args.ids:
        print(f"# Written to us — {', '.join(f'#{n}' for n in args.ids)}\n")
    else:
        window = f"the last {args.days} days" if args.days else "any age"
        print(f"# Written to us — {args.triage}, {window} ({len(rows)})\n")
    if not rows:
        print("_Nothing here._")
        return 0
    states = " · ".join(f"{s} {n}" for s in ("new", "seen", "done", "dropped")
                        if (n := sum(r["triage"] == s for r in rows)))
    print(f"{states}\n")
    for kind, group in by_kind(rows):
        print(f"## {kind} ({len(group)})\n")
        for row in group:
            print(render(row))
    if len(rows) == LIMIT:
        print(f"_The newest {LIMIT}; narrow --days or --kind for the rest._")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
