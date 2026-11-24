"""
The referral's cases worth a look (plan 332), as markdown.

    python -m scripts.read_referrals               # the last 60 days
    python -m scripts.read_referrals --days 120
    python -m scripts.read_referrals --learner aiko   # one parrain, whole

Read-only. There is no --yes because there is nothing to confirm.

-- Why a script and not a dashboard ------------------------------
A referral names two people, the parrain and the filleul. The 足跡
dashboard (docs/analytics/metabase/02-fonctionnalites.sql) counts the
steps and never reads who; who sponsored whom is read here, by a person,
from the backend's Render Shell or a terminal holding DATABASE_URL, as
scripts/read_reports.py reads the duels' reports.

No fingerprint of any device is read (ADR 0022, the CNIL frame): what
this lists is what the tables already say, and nothing in it is proof.
What to do is the reader's call. A case is printed when:

  * a filleul converted and has studied no day since (study for the
    reward, then gone),
  * a parrain's filleuls were opened within a day of each other (a batch),
  * a parrain reached the month's cap (500),
  * a parrain's filleuls mostly converted and then stopped.
"""
import argparse
import re
from datetime import timedelta

import scripts._env  # noqa: F401  -- must precede core.db, which reads
#                       DATABASE_URL at module scope. See scripts/_env.py.
from core.db import db_conn

DEFAULT_DAYS = 60
LIMIT = 200
USERNAME = re.compile(r"^[a-zA-Z0-9_]{3,20}$")
MONTH_CAP = 500


def fetch(cur, days: int, learner: str | None) -> list[dict]:
    where = ["r.asked_at > NOW() - (%s || ' days')::interval"]
    params: list = [days]
    if learner:
        where.append("lower(s.username) = lower(%s)")
        params.append(learner)
    cur.execute(
        f"""
        SELECT r.sponsor_id, s.username AS sponsor, r.filleul_id, f.username AS filleul,
               f.created_at AS opened, r.asked_at, r.accepted_at, r.refused_at, r.converted_at, r.released_at,
               (SELECT COUNT(DISTINCT (l.reviewed_at)::date) FROM review_log l
                 WHERE l.card_id LIKE r.filleul_id || ':%%' AND r.converted_at IS NOT NULL
                   AND l.reviewed_at > r.converted_at) AS days_after
          FROM referrals r
          LEFT JOIN user_profiles s ON s.user_id = r.sponsor_id
          LEFT JOIN user_profiles f ON f.user_id = r.filleul_id
         WHERE {' AND '.join(where)}
         ORDER BY r.sponsor_id, f.created_at
         LIMIT {LIMIT}
        """,
        params,
    )
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def capped(cur, days: int) -> dict[str, int]:
    """Parrains paid the whole cap in a calendar month, and how often."""
    cur.execute(
        """
        SELECT sponsor_id, COUNT(*) FROM (
            SELECT sponsor_id, date_trunc('month', paid_at) AS m, SUM(paid) AS n
              FROM referral_rewards WHERE paid_at > NOW() - (%s || ' days')::interval AND kind <> 'max_week'
             GROUP BY 1, 2) x
         WHERE n >= %s GROUP BY 1
        """,
        (days, MONTH_CAP),
    )
    return {s: int(n) for s, n in cur.fetchall()}


def flags(rows: list[dict], months_capped: int) -> list[str]:
    out = []
    converted = [r for r in rows if r["converted_at"]]
    gone = [r for r in converted if not r["days_after"]]
    for r in gone:
        out.append(f"{r['filleul'] or '(account gone)'} converted and has studied no day since")
    opened = sorted(r["opened"] for r in rows if r["opened"])
    if any(b - a < timedelta(days=1) for a, b in zip(opened, opened[1:])):
        out.append("filleuls opened within a day of each other")
    if months_capped:
        out.append(f"the month's cap reached {months_capped} time{'s' if months_capped > 1 else ''}")
    if len(converted) >= 2 and len(gone) * 2 >= len(converted) and len(gone) >= 2:
        out.append("most converted filleuls stopped after the reward")
    return out


def render(rows: list[dict], marks: list[str]) -> str:
    first = rows[0]
    head = f"### {first['sponsor'] or '(account gone)'} · {len(rows)} filleul{'s' if len(rows) > 1 else ''}"
    lines = [head, "", f"- user `{first['sponsor_id']}`", *(f"- **{m}**" for m in marks), ""]
    for r in rows:
        state = ("released" if r["released_at"] else "refused" if r["refused_at"] else
                 "converted" if r["converted_at"] else "accepted" if r["accepted_at"] else "asked")
        after = f" · {r['days_after']} days since" if r["converted_at"] else ""
        lines.append(f"- {r['filleul'] or '(account gone)'} (`{r['filleul_id']}`) · opened "
                     f"{r['opened']:%Y-%m-%d %H:%M} UTC · {state}{after}" if r["opened"] else
                     f"- (account gone) (`{r['filleul_id']}`) · {state}")
    return "\n".join(lines + [""])


def main() -> int:
    ap = argparse.ArgumentParser(description="The referral's cases worth a look.")
    ap.add_argument("--days", type=int, default=DEFAULT_DAYS, help=f"window in days (default {DEFAULT_DAYS})")
    ap.add_argument("--learner", help="one parrain, every filleul whatever the flags")
    args = ap.parse_args()
    if args.learner and not USERNAME.match(args.learner):
        ap.error("a username is 3 to 20 letters, digits or _")

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            rows = fetch(cur, args.days, args.learner)
            caps = capped(cur, args.days)
    finally:
        conn.close()

    by_sponsor: dict[str, list[dict]] = {}
    for row in rows:
        by_sponsor.setdefault(row["sponsor_id"], []).append(row)
    shown = 0
    print(f"## Referrals — the last {args.days} days ({len(rows)} filleuls, {len(by_sponsor)} parrains)\n")
    for sponsor_id, group in by_sponsor.items():
        marks = flags(group, caps.get(sponsor_id, 0))
        if marks or args.learner:
            print(render(group, marks))
            shown += 1
    if not shown:
        print("_Nothing to look at._")
    if len(rows) == LIMIT:
        print(f"_The first {LIMIT}; narrow --days for the rest._")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
