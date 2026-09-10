"""
The four numbers, as markdown.

    python -m scripts.weekly_digest              # last 28 days
    python -m scripts.weekly_digest --days 7

Read-only. There is no --yes because there is nothing to confirm.

-- Why a digest rather than a dashboard ------------------------
A dashboard has to be remembered. This runs from
.github/workflows/weekly-digest.yml every Monday and writes into the
run's own summary page, so the numbers arrive whether or not anyone
thought to go and look -- which for a project with one maintainer is
the difference between analytics that get used and analytics that get
built.

Metabase is still the right thing for DIGGING (point it at the same
database and it will do everything below by clicking, plus the
follow-up question this cannot anticipate). It is not the right thing
for noticing, because noticing is what you do when you were not
already looking.

-- The four questions ------------------------------------------
  1  BOARDING     where people give up on the way in. The one funnel
                  that exists today, and the top of every other one.
  2  RETENTION    D1/D7/D30 return. The strongest single predictor of
                  whether anyone would ever pay for this.
  3  FARE         who wanted more than the free allowance gives, from
                  the shadow-mode refusals core/credits.py records.
  4  USE          which modes get finished rather than abandoned.

Each reads event_log and event_daily and adds the two together where a
total is wanted, because scripts/compact_events.py moves rows from the
first to the second and a query that read only one would show a cliff
on the day it last ran.
"""
import argparse
import logging

import scripts._env  # noqa: F401  -- must precede core.db, which reads
#                       DATABASE_URL at module scope. See scripts/_env.py.
from core.db import db_conn

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("weekly-digest")

DEFAULT_DAYS = 28


def table(header: list[str], rows: list[tuple]) -> str:
    if not rows:
        return "_Nothing yet._\n"
    out = ["| " + " | ".join(header) + " |",
           "|" + "|".join("---" for _ in header) + "|"]
    for row in rows:
        out.append("| " + " | ".join("—" if v is None else str(v) for v in row) + " |")
    return "\n".join(out) + "\n"


def boarding(cur, days: int) -> str:
    """Distinct learners who reached each step, in track order.

    The drop between two consecutive rows IS the answer -- there is no
    'abandoned' event because a boarding_step with no boarding_done
    after it already says so.
    """
    cur.execute(
        """
        SELECT props->>'step'             AS step,
               MIN((props->>'index')::int) AS idx,
               COUNT(DISTINCT user_id)     AS learners
          FROM event_log
         WHERE name = 'boarding_step'
           AND props->>'index' ~ '^[0-9]+$'
           AND at > NOW() - (%s || ' days')::interval
         GROUP BY props->>'step'
         ORDER BY idx
        """,
        (days,),
    )
    steps = cur.fetchall()

    cur.execute(
        "SELECT COUNT(DISTINCT user_id) FROM event_log"
        " WHERE name = 'boarding_done' AND at > NOW() - (%s || ' days')::interval",
        (days,),
    )
    finished = cur.fetchone()[0]

    rows = []
    first = steps[0][2] if steps else 0
    for step, _idx, learners in steps:
        share = f"{100 * learners // first}%" if first else "—"
        rows.append((step, learners, share))
    if first:
        rows.append(("**boarded**", finished, f"{100 * finished // first}%"))
    return table(["step", "learners", "of those who started"], rows)


def retention(cur, days: int) -> str:
    """Of the learners first seen in the window, how many came back.

    Day zero is each learner's own first app_open, not a calendar date,
    so a cohort is 'people who arrived', not 'people who arrived in
    January'.
    """
    cur.execute(
        """
        WITH opens AS (
            SELECT user_id, (at AT TIME ZONE 'UTC')::date AS day
              FROM event_log WHERE name = 'app_open'
            UNION ALL
            SELECT user_id, day FROM event_daily WHERE name = 'app_open'
        ),
        first_seen AS (
            SELECT user_id, MIN(day) AS d0 FROM opens GROUP BY user_id
        ),
        cohort AS (
            SELECT user_id, d0 FROM first_seen
             WHERE d0 > (NOW() - (%s || ' days')::interval)::date
        )
        SELECT (SELECT COUNT(*) FROM cohort),
               COUNT(DISTINCT CASE WHEN o.day - c.d0 >= 1  THEN c.user_id END),
               COUNT(DISTINCT CASE WHEN o.day - c.d0 >= 7  THEN c.user_id END),
               COUNT(DISTINCT CASE WHEN o.day - c.d0 >= 30 THEN c.user_id END)
          FROM cohort c LEFT JOIN opens o ON o.user_id = c.user_id
        """,
        (days,),
    )
    total, d1, d7, d30 = cur.fetchone()
    if not total:
        return "_Nothing yet._\n"
    pct = lambda n: f"{100 * n // total}%"          # noqa: E731
    return table(
        ["cohort", "came back D1+", "D7+", "D30+"],
        [(total, f"{d1} ({pct(d1)})", f"{d7} ({pct(d7)})", f"{d30} ({pct(d30)})")],
    )


def fare(cur, days: int) -> str:
    """Who hit a ceiling they would have been stopped at.

    CREDITS_ENFORCE is unset, so nobody was actually refused -- these
    are the learners who WOULD have been, which is the same thing as
    the learners who wanted more than the free allowance gives.
    """
    cur.execute(
        """
        SELECT name,
               COALESCE(props->>'kind', '—')  AS kind,
               COUNT(DISTINCT user_id)        AS learners,
               COUNT(*)                       AS times
          FROM event_log
         WHERE name IN ('fare_blocked', 'limit_reached')
           AND at > NOW() - (%s || ' days')::interval
         GROUP BY name, props->>'kind'
         ORDER BY learners DESC
        """,
        (days,),
    )
    return table(["signal", "kind", "learners", "times"], cur.fetchall())


def use(cur, days: int) -> str:
    """Started against finished, per kind. The ratio is the point."""
    cur.execute(
        """
        WITH runs AS (
            SELECT name, props->>'kind' AS kind, 1 AS n
              FROM event_log
             WHERE name IN ('run_start', 'run_complete', 'run_abandon')
               AND at > NOW() - (%s || ' days')::interval
        )
        SELECT COALESCE(kind, '—') AS kind,
               SUM(CASE WHEN name = 'run_start'    THEN n ELSE 0 END) AS started,
               SUM(CASE WHEN name = 'run_complete' THEN n ELSE 0 END) AS finished,
               SUM(CASE WHEN name = 'run_abandon'  THEN n ELSE 0 END) AS left_early
          FROM runs
         GROUP BY kind
         ORDER BY started DESC
        """,
        (days,),
    )
    rows = []
    for kind, started, finished, abandoned in cur.fetchall():
        share = f"{100 * finished // started}%" if started else "—"
        rows.append((kind, started, finished, abandoned, share))
    return table(["kind", "started", "finished", "left early", "finish rate"], rows)


def boot(cur, days: int) -> str:
    """What the boot actually costs, since render.yaml was changed to
    move it. Median and p90 rather than a mean: one 45 s timeout drags
    a mean somewhere no learner ever was."""
    cur.execute(
        """
        SELECT COUNT(*),
               PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY (props->>'boot_ms')::int),
               PERCENTILE_DISC(0.9) WITHIN GROUP (ORDER BY (props->>'boot_ms')::int),
               SUM(CASE WHEN props->>'cold' = 'true' THEN 1 ELSE 0 END)
          FROM event_log
         WHERE name = 'app_open'
           AND props->>'boot_ms' ~ '^[0-9]+$'
           AND at > NOW() - (%s || ' days')::interval
        """,
        (days,),
    )
    n, median, p90, cold = cur.fetchone()
    if not n:
        return "_Nothing yet._\n"
    cur.execute(
        "SELECT COUNT(*) FROM event_log WHERE name = 'boot_timeout'"
        " AND at > NOW() - (%s || ' days')::interval",
        (days,),
    )
    return table(
        ["opens", "median", "p90", "cold (>5 s)", "gave up"],
        [(n, f"{median} ms", f"{p90} ms", cold, cur.fetchone()[0])],
    )


SECTIONS = [
    ("みどりの窓口 — where boarding is lost", boarding),
    ("Coming back", retention),
    ("The boot", boot),
    ("Who wanted more than the free allowance", fare),
    ("What gets finished", use),
]


def main() -> int:
    ap = argparse.ArgumentParser(description="The four numbers, as markdown.")
    ap.add_argument("--days", type=int, default=DEFAULT_DAYS,
                    help=f"window in days (default {DEFAULT_DAYS})")
    args = ap.parse_args()

    out = [f"## 足跡 — the last {args.days} days\n"]
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for title, fn in SECTIONS:
                out.append(f"### {title}\n")
                try:
                    out.append(fn(cur, args.days))
                except Exception as exc:      # one bad section must not
                    conn.rollback()           # cost the other four
                    logger.warning("section %r failed: %s", title, exc)
                    out.append(f"_Could not be computed: {exc}_\n")
                out.append("")
    finally:
        conn.close()

    print("\n".join(out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
