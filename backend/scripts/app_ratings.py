"""
What learners told us of the app (plan 167), as markdown.

    python -m scripts.app_ratings              # last 90 days
    python -m scripts.app_ratings --days 30
    python -m scripts.app_ratings --all        # every comment, not the last fifty

Read-only. There is no --yes because there is nothing to confirm.

In the iOS and Android apps a learner is asked through the store's own
review prompt, which is read on the store and tells us nothing; what is
here is the web's sheet (stars, and what a rating under five would have
needed) and the feedback anyone sends from Settings. Three parts: the
web's stars as a distribution, how often each way of asking was used,
and the comments, newest first, each with its stars (or "feedback"),
platform and language. See routes/rating.py.
"""
import argparse
import logging

import scripts._env  # noqa: F401  -- must precede core.db, which reads
#                       DATABASE_URL at module scope. See scripts/_env.py.
from core.db import db_conn
from scripts.weekly_digest import table

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("app-ratings")

DEFAULT_DAYS = 90
COMMENTS = 50


def stars(cur, days: int) -> str:
    cur.execute(
        """
        SELECT stars, COUNT(*), COUNT(comment)
          FROM app_ratings
         WHERE kind = 'rating'
           AND at > NOW() - (%s || ' days')::interval
         GROUP BY stars
         ORDER BY stars DESC
        """,
        (days,),
    )
    rows = cur.fetchall()
    total = sum(n for _s, n, _c in rows)
    body = table(["stars", "ratings", "with a comment"],
                 [("★" * s, n, c) for s, n, c in rows])
    if total:
        mean = sum(s * n for s, n, _c in rows) / total
        body += f"\n{total} ratings, mean {mean:.2f}.\n"
    return body


def asked(cur, days: int) -> str:
    cur.execute(
        """
        SELECT platform,
               COUNT(*) FILTER (WHERE kind = 'store_prompt'),
               COUNT(*) FILTER (WHERE kind = 'rating'),
               COUNT(*) FILTER (WHERE kind = 'put_off'),
               COUNT(*) FILTER (WHERE kind = 'feedback')
          FROM app_ratings
         WHERE at > NOW() - (%s || ' days')::interval
         GROUP BY platform
         ORDER BY platform
        """,
        (days,),
    )
    return table(["platform", "store prompt", "rated", "not now", "feedback"], cur.fetchall())


def comments(cur, days: int, limit: int | None) -> str:
    cur.execute(
        f"""
        SELECT at::date, kind, stars, platform, lang, comment
          FROM app_ratings
         WHERE comment IS NOT NULL
           AND at > NOW() - (%s || ' days')::interval
         ORDER BY at DESC
         {"LIMIT %s" if limit else ""}
        """,
        (days, limit) if limit else (days,),
    )
    rows = cur.fetchall()
    if not rows:
        return "_Nothing yet._\n"
    out = []
    for day, kind, s, platform, lang, text in rows:
        quoted = "\n".join(f"> {line}" for line in text.splitlines() or [""])
        head = "★" * s if kind == "rating" else kind
        out.append(f"**{head}** · {day} · {platform} · {lang or '—'}\n\n{quoted}\n")
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser(description="What learners told us of the app, as markdown.")
    ap.add_argument("--days", type=int, default=DEFAULT_DAYS,
                    help=f"window in days (default {DEFAULT_DAYS})")
    ap.add_argument("--all", action="store_true",
                    help=f"every comment in the window, not the last {COMMENTS}")
    args = ap.parse_args()

    out = [f"## 評価 — the last {args.days} days\n"]
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            out += ["### The web's stars\n", stars(cur, args.days), ""]
            out += ["### How learners were asked\n", asked(cur, args.days), ""]
            out += ["### What they wrote\n", comments(cur, args.days, None if args.all else COMMENTS)]
    finally:
        conn.close()

    print("\n".join(out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
