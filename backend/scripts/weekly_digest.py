"""
The weekly numbers, as markdown.

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

-- The questions -----------------------------------------------
  1  BOARDING     where people give up on the way in. The one funnel
                  that exists today, and the top of every other one.
  2  RETENTION    D1/D7/D30 return. The strongest single predictor of
                  whether anyone would ever pay for this.
  3  FARE         who wanted more than the free allowance gives, from
                  the shadow-mode refusals core/credits.py records.
  4  USE          which modes get finished rather than abandoned, by
                  level.
  5  ENGAGEMENT   how many learners are active per day / week / month,
                  and how sticky that is (DAU over MAU).
  5b SESSIONS    how long a visit lasts, how many screens it sees, how
                  many a day a learner has (event_log.sid).
  6  OFFER        per door: seen, pressed, refused, and how long the
                  decision took.
  7  RIDE/GUIDE   whether the first ride and the gate guides are sat
                  through or skipped.
  8  FRICTION     the requests that failed (api_error) and the install
                  prompt's answers. Both were declared in core/events.py
                  from the start and sent by nothing until the client began to send them.
  9  MESSAGES     what learners wrote to us (plan 221), COUNTED: by
                  kind, who asked for an answer, the cards reported most.
                  Never the words, which this page on GitHub is no place
                  for: scripts/read_feedback.py reads them, run by a person.

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
            SELECT name, props->>'kind' AS kind, props->>'level' AS level, 1 AS n
              FROM event_log
             WHERE name IN ('run_start', 'run_complete', 'run_abandon')
               AND at > NOW() - (%s || ' days')::interval
        )
        SELECT COALESCE(kind, '—') AS kind,
               COALESCE(level, '—') AS level,
               SUM(CASE WHEN name = 'run_start'    THEN n ELSE 0 END) AS started,
               SUM(CASE WHEN name = 'run_complete' THEN n ELSE 0 END) AS finished,
               SUM(CASE WHEN name = 'run_abandon'  THEN n ELSE 0 END) AS left_early
          FROM runs
         GROUP BY kind, level
         ORDER BY started DESC, kind, level
        """,
        (days,),
    )
    rows = []
    for kind, level, started, finished, abandoned in cur.fetchall():
        share = f"{100 * finished // started}%" if started else "—"
        rows.append((kind, level, started, finished, abandoned, share))
    return table(["kind", "level", "started", "finished", "left early", "finish rate"], rows)


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


def engagement(cur, days: int) -> str:
    """Learners with at least one event, per day / week / month.

    'Active' here is 'the app recorded anything for them', which is what
    the trail can say without joining review_log -- and it counts a
    learner who only opened the app, so it reads a little above 'studied'.
    The window is fixed (24 h, 7 d, 30 d), not --days: DAU/MAU is only a
    ratio of those two lengths.

    event_daily is added to event_log because compact_events moves rows
    from one to the other; each day is counted once per learner whichever
    half holds it.
    """
    cur.execute(
        """
        WITH seen AS (
            SELECT user_id, (at AT TIME ZONE 'UTC')::date AS day
              FROM event_log
             WHERE at > NOW() - INTERVAL '31 days'
            UNION
            SELECT user_id, day
              FROM event_daily
             WHERE day > (NOW() - INTERVAL '31 days')::date
        ),
        today AS (SELECT (NOW() AT TIME ZONE 'UTC')::date AS d)
        SELECT
          (SELECT COUNT(DISTINCT user_id) FROM seen, today WHERE day > d - 1),
          (SELECT COUNT(DISTINCT user_id) FROM seen, today WHERE day > d - 7),
          (SELECT COUNT(DISTINCT user_id) FROM seen, today WHERE day > d - 30),
          (SELECT COUNT(*) FROM seen, today WHERE day > d - 7)
        """
    )
    dau, wau, mau, learner_days_7 = cur.fetchone()
    if not mau:
        return "_Nothing yet._\n"
    # Average daily actives over the last seven days, against the month.
    avg_dau = learner_days_7 / 7
    stick = f"{round(100 * avg_dau / mau)}%"
    return table(
        ["today (UTC)", "7 days", "30 days", "avg daily, 7 days", "stickiness (avg DAU / MAU)"],
        [(dau, wau, mau, f"{avg_dau:.1f}", stick)],
    )


def sessions(cur, days: int) -> str:
    """How long a visit lasts and what it sees.

    A session is one (learner, sid): the client's random id for a visit,
    which ends after thirty minutes without an event (lib/track.js).
    Length is first event to last, so it is a floor -- the time spent
    after the last tap is invisible -- and a session of one event has no
    length at all, which is why the median is over the others. Raw rows
    only (30 days); the per-day table below also reads `session_start`
    from event_daily, so it keeps going after the rows are gone.
    """
    cur.execute(
        """
        WITH s AS (
            SELECT user_id, sid,
                   EXTRACT(EPOCH FROM MAX(at) - MIN(at)) AS secs,
                   COUNT(*) FILTER (WHERE name = 'screen_view') AS screens
              FROM event_log
             WHERE sid IS NOT NULL
               AND at > NOW() - (%s || ' days')::interval
             GROUP BY user_id, sid
        )
        SELECT COUNT(*),
               COUNT(DISTINCT user_id),
               PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY secs) FILTER (WHERE secs > 0),
               PERCENTILE_DISC(0.9) WITHIN GROUP (ORDER BY secs) FILTER (WHERE secs > 0),
               PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY screens),
               COUNT(*) FILTER (WHERE screens <= 1)
          FROM s
        """,
        (days,),
    )
    total, learners, median_s, p90_s, median_screens, one_screen = cur.fetchone()
    if not total:
        return "_Nothing yet._\n"
    mins = lambda v: "—" if v is None else f"{int(v) // 60} min {int(v) % 60:02d} s"   # noqa: E731
    out = [table(
        ["sessions", "learners", "per learner", "median length", "p90 length", "median screens", "one screen or none"],
        [(total, learners, f"{total / learners:.1f}", mins(median_s), mins(p90_s),
          median_screens, f"{100 * one_screen // total}%")],
    )]
    cur.execute(
        """
        WITH starts AS (
            SELECT user_id, (at AT TIME ZONE 'UTC')::date AS day, 1 AS n
              FROM event_log
             WHERE name = 'session_start' AND at > NOW() - (%s || ' days')::interval
            UNION ALL
            SELECT user_id, day, n
              FROM event_daily
             WHERE name = 'session_start' AND day > (NOW() - (%s || ' days')::interval)::date
        )
        SELECT day, SUM(n), COUNT(DISTINCT user_id)
          FROM starts GROUP BY day ORDER BY day DESC LIMIT 14
        """,
        (days, days),
    )
    out.append("**Sessions per day**\n")
    out.append(table(["day (UTC)", "sessions", "learners"], cur.fetchall()))
    return "\n".join(out)


def offer(cur, days: int) -> str:
    """Per door: seen, pressed, refused. Learners, not events -- a door
    opened twice by one person is one person's opinion. The median is the
    gap between seeing the pass and pressing it: a high intent rate with
    a one-second median is a mis-tap, not demand (core/events.py)."""
    cur.execute(
        """
        SELECT COALESCE(props->>'where', '—') AS door,
               COUNT(DISTINCT user_id) FILTER (WHERE name = 'offer_view')    AS seen,
               COUNT(DISTINCT user_id) FILTER (WHERE name = 'offer_intent')  AS pressed,
               COUNT(DISTINCT user_id) FILTER (WHERE name = 'offer_dismiss') AS refused,
               PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY (props->>'ms')::bigint)
                   FILTER (WHERE name = 'offer_intent' AND props->>'ms' ~ '^[0-9]+$') AS median_ms
          FROM event_log
         WHERE name IN ('offer_view', 'offer_intent', 'offer_dismiss')
           AND at > NOW() - (%s || ' days')::interval
         GROUP BY props->>'where'
         ORDER BY seen DESC
        """,
        (days,),
    )
    rows = []
    for door, seen, pressed, refused, median_ms in cur.fetchall():
        rate = f"{100 * pressed // seen}%" if seen else "—"
        rows.append((door, seen, pressed, refused, rate, f"{median_ms} ms" if median_ms is not None else "—"))
    return table(["door", "saw it", "pressed", "refused", "press rate", "median to press"], rows)


def ride_and_guides(cur, days: int) -> str:
    """Whether the first ride and each gate's guide are sat through."""
    cur.execute(
        """
        SELECT name,
               COALESCE(props->>'at', props->>'gate', '—') AS which,
               COUNT(*) AS finished,
               COUNT(*) FILTER (WHERE props->>'skipped' = 'true') AS skipped,
               PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY (props->>'ms')::bigint)
                   FILTER (WHERE props->>'ms' ~ '^[0-9]+$') AS median_ms
          FROM event_log
         WHERE name IN ('ride_done', 'guide_done')
           AND at > NOW() - (%s || ' days')::interval
         GROUP BY name, which
         ORDER BY name, which
        """,
        (days,),
    )
    rows = []
    for name, which, finished, skipped, median_ms in cur.fetchall():
        share = f"{100 * skipped // finished}%" if finished else "—"
        rows.append((name, which, finished, skipped, share, f"{median_ms} ms" if median_ms is not None else "—"))
    return table(["what", "where", "ended", "skipped", "skip rate", "median time"], rows)


def friction(cur, days: int) -> str:
    """Failed requests by area and status (status 0 is a request that got
    no answer at all), then what the install prompt was answered with."""
    cur.execute(
        """
        SELECT COALESCE(props->>'path', '—') AS area,
               COALESCE(props->>'status', '—') AS status,
               COUNT(DISTINCT user_id) AS learners,
               COUNT(*) AS times
          FROM event_log
         WHERE name = 'api_error'
           AND at > NOW() - (%s || ' days')::interval
         GROUP BY props->>'path', props->>'status'
         ORDER BY learners DESC, times DESC
         LIMIT 20
        """,
        (days,),
    )
    out = [table(["area", "status", "learners", "times"], cur.fetchall())]
    cur.execute(
        """
        SELECT COALESCE(props->>'outcome', '—') AS outcome,
               COUNT(DISTINCT user_id) AS learners
          FROM event_log
         WHERE name = 'install_prompt'
           AND at > NOW() - (%s || ' days')::interval
         GROUP BY props->>'outcome'
         ORDER BY learners DESC
        """,
        (days,),
    )
    out.append("**Install prompt**\n")
    out.append(table(["answer", "learners"], cur.fetchall()))
    return "\n".join(out)


def time_spent(cur, days: int) -> str:
    """Where the engaged time goes, and which small features are used.

    screen_leave's `ms` is ENGAGED time (lib/dwell.js: a hidden tab does
    not count), sent on leaving a screen and on hiding the page (plan
    218), so a screen's total is real attention, not an open tab.
    feature_use is one row per (feature, action) per screen left, `n`
    the presses. Raw rows only, so the window is the last 30 days at most.
    """
    cur.execute(
        """
        SELECT props->>'route',
               ROUND(SUM((props->>'ms')::numeric) / 60000, 1),
               ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (props->>'ms')::numeric) / 1000)::numeric, 1),
               COUNT(DISTINCT user_id)
          FROM event_log
         WHERE name = 'screen_leave' AND at > NOW() - (%s || ' days')::interval
         GROUP BY 1 ORDER BY 2 DESC LIMIT 12
        """,
        (days,),
    )
    screens = cur.fetchall()
    if not screens:
        return "_Nothing yet (screen_leave arrived with plan 218)._\n"
    out = [table(["screen", "minutes", "median stay (s)", "learners"], screens)]
    cur.execute(
        """
        SELECT props->>'feature', props->>'action', SUM((props->>'n')::int), COUNT(DISTINCT user_id)
          FROM event_log
         WHERE name = 'feature_use' AND at > NOW() - (%s || ' days')::interval
         GROUP BY 1, 2 ORDER BY 4 DESC, 3 DESC
        """,
        (days,),
    )
    uses = cur.fetchall()
    out.append("**Features used**\n")
    out.append(table(["feature", "action", "uses", "learners"], uses) if uses else "_None yet._\n")
    return "\n".join(out)


def messages(cur, days: int) -> str:
    """What learners wrote to us (plan 221), counted and never read. The
    words belong to scripts/read_feedback.py, run by a person in a
    terminal, not to a run summary anyone with the repository can open.
    A card's id is the content's key, not anything a learner typed."""
    cur.execute(
        """
        SELECT kind, COUNT(*), COUNT(DISTINCT user_id), COUNT(*) FILTER (WHERE reply)
          FROM feedback
         WHERE created_at > NOW() - (%s || ' days')::interval
         GROUP BY kind
         ORDER BY 2 DESC, 1
        """,
        (days,),
    )
    out = [table(["kind", "messages", "learners", "want an answer"], cur.fetchall())]
    cur.execute(
        """
        SELECT f.card_id, COUNT(DISTINCT f.id), COUNT(DISTINCT f.user_id),
               STRING_AGG(DISTINCT r, ', ' ORDER BY r)
          FROM feedback f
          LEFT JOIN LATERAL UNNEST(f.reasons) AS r ON TRUE
         WHERE f.kind = 'card'
           AND f.created_at > NOW() - (%s || ' days')::interval
         GROUP BY f.card_id
         ORDER BY 3 DESC, 2 DESC, 1
         LIMIT 10
        """,
        (days,),
    )
    out.append("**Cards reported**\n")
    out.append(table(["card", "reports", "learners", "what is wrong"], cur.fetchall()))
    out.append(f"_Read them: `python -m scripts.read_feedback --days {days}`._\n")
    return "\n".join(out)


SECTIONS = [
    ("みどりの窓口 — where boarding is lost", boarding),
    ("Coming back", retention),
    ("Who is active", engagement),
    ("Sessions", sessions),
    ("Where the time goes", time_spent),
    ("The boot", boot),
    ("Who wanted more than the free allowance", fare),
    ("The offer, door by door", offer),
    ("The first ride and the guides", ride_and_guides),
    ("What gets finished", use),
    ("What broke", friction),
    ("Written to us", messages),
]


def main() -> int:
    ap = argparse.ArgumentParser(description="The weekly numbers, as markdown.")
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
                    conn.rollback()           # cost the others
                    logger.warning("section %r failed: %s", title, exc)
                    out.append(f"_Could not be computed: {exc}_\n")
                out.append("")
    finally:
        conn.close()

    print("\n".join(out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
