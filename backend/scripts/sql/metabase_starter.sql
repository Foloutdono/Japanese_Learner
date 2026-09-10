-- ═══════════════════════════════════════════════════════════════
--  Metabase — the connection, and the questions worth saving first
--
--  Metabase self-hosted is free (AGPL) and is the PULL half of reading
--  this database. The PUSH half is scripts/weekly_digest.py, which runs
--  every Monday and writes four numbers into its workflow run's summary
--  without anyone having to remember to look. Neither replaces the
--  other: the digest tells you something changed, Metabase is where you
--  find out why.
--
--    docker run -d -p 3000:3000 --name metabase metabase/metabase
--
--  -- Connecting ------------------------------------------------
--  Supabase dashboard -> Connect -> SESSION POOLER, and use those
--  values. Not the direct connection (IPv6-only unless the project has
--  the IPv4 add-on) and not the transaction pooler on 6543. The same
--  constraint .github/workflows/db-maintenance.yml already documents
--  for compact_review_log.
--
--  In Metabase: Settings -> Admin settings -> Databases -> Add ->
--  PostgreSQL.
--
--    Host      aws-0-<region>.pooler.supabase.com   (from Connect)
--    Port      5432
--    Database  postgres
--    Username  metabase_ro.<project-ref>            (see PART 0)
--    Password  the one you choose below
--    SSL       on
--
--  The username really does carry the project ref after a dot -- that
--  is Supavisor's routing, not a typo, and getting it wrong is the
--  usual reason the connection is refused with no useful message.
--
--  -- How to run this file --------------------------------------
--  PART 0 is the only part that CHANGES anything. Run it once, in the
--  Supabase SQL Editor, as postgres. Everything after it is SELECTs:
--  paste one at a time into Metabase (+ New -> SQL query), run it, and
--  Save it as a question.
--
--  PART A works TODAY, against tables that already have rows.
--  PART B needs the 足跡 tables, which appear when docs/adr/0012's
--  work is deployed -- core/events.py creates them on import. Until
--  then those queries return nothing, which is not an error.
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════
--  PART 0 — a read-only role for Metabase          (run once, as postgres)
-- ═══════════════════════════════════════════════════════════════
--
--  Metabase runs arbitrary SQL by design: that is the point of it. So
--  the credentials it holds are the credentials anyone who reaches that
--  Metabase holds, and `postgres` there means a DROP TABLE is one
--  textarea away. This role can read everything and change nothing.
--
--  CHOOSE YOUR OWN PASSWORD and do not commit it. A password written
--  into a tracked file is a password in every clone and every fork of
--  this repository, forever, whatever is done to the file afterwards.

CREATE ROLE metabase_ro LOGIN PASSWORD 'CHANGE-ME-BEFORE-RUNNING';

GRANT CONNECT ON DATABASE postgres TO metabase_ro;
GRANT USAGE   ON SCHEMA public     TO metabase_ro;
GRANT SELECT  ON ALL TABLES IN SCHEMA public TO metabase_ro;

-- Tables created LATER are the ones this is really for: event_log and
-- event_daily do not exist yet on a database where the analytics work
-- has not deployed, and every future table is covered by the same
-- line rather than by remembering to come back here.
--
-- ONE DEPENDENCY WORTH KNOWING: default privileges only cover tables
-- created by the role that ran this statement. It works because the
-- app connects as `postgres` and every table in `public` is owned by
-- postgres -- which is true on Supabase and was verified before this
-- file was written. If DATABASE_URL is ever pointed at a different
-- role, tables it creates from then on will be invisible to Metabase
-- until this is re-run as that role. The symptom is a new table simply
-- not appearing in the sidebar, with no error anywhere.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO metabase_ro;

-- Sequences are readable so a SELECT on a serial column cannot fail on
-- a permission; nothing here can advance one.
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO metabase_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO metabase_ro;


-- ═══════════════════════════════════════════════════════════════
--  PART A — what the database can already tell you
-- ═══════════════════════════════════════════════════════════════
--  None of this needs the analytics work. These tables have rows now.


-- A1 ── The shape of the audience ──────────────────────────────
-- Accounts, how many finished boarding, how many are on a pass.
-- `onboarded_at` is NULL until POST /api/onboarding/complete, so it is
-- the honest completed-signup count.
SELECT
  COUNT(*)                                            AS accounts,
  COUNT(onboarded_at)                                 AS finished_boarding,
  COUNT(*) FILTER (WHERE plan = 'pass')               AS on_a_pass,
  COUNT(*) FILTER (WHERE notifications)               AS want_reminders,
  ROUND(100.0 * COUNT(onboarded_at) / NULLIF(COUNT(*), 0), 1) AS pct_boarded
FROM user_profiles;


-- A2 ── WHY they are here ──────────────────────────────────────
-- The boarding flow has asked every learner this since it shipped, and
-- nothing has ever read the answer. It is the single most useful thing
-- the app knows about someone it has just met: 'studies' and 'trip'
-- want different products.
SELECT
  COALESCE(motive, '(not asked)')                     AS motive,
  COUNT(*)                                            AS learners,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1)  AS pct
FROM user_profiles
GROUP BY motive
ORDER BY learners DESC;


-- A3 ── Where they say they are starting ───────────────────────
-- Self-declared JLPT level against chosen pace (5 各駅停車 / 10 快速 /
-- 20 特急). A pace nobody picks is a service worth retiring; a level
-- nobody picks is content worth not building next.
SELECT
  COALESCE(jlpt_level, '(none)')                      AS level,
  COALESCE(daily_new_target::text, '(none)')          AS pace,
  COUNT(*)                                            AS learners
FROM user_profiles
GROUP BY jlpt_level, daily_new_target
ORDER BY learners DESC;


-- A4 ── Active learners and reviews per day ────────────────────
-- Reads BOTH halves of the review history. review_log holds recent
-- rows; compact_review_log.py folds older ones into review_daily and
-- deletes them. A query over review_log alone looks fine today and
-- develops a cliff on the day that script first runs -- at exactly the
-- point the graph is long enough to be worth reading.
--
-- The learner count is a lower bound on the compacted half: user_id is
-- known per (day, hour) there, which is what this needs, but the raw
-- half keys on the prefixed card_id and the id is split back out.
WITH daily AS (
  SELECT
    (reviewed_at AT TIME ZONE 'UTC')::date            AS day,
    split_part(card_id, ':', 1)                       AS user_id,
    1                                                 AS reviews
  FROM review_log
  UNION ALL
  SELECT day, user_id, reviews
  FROM review_daily
)
SELECT
  day,
  COUNT(DISTINCT user_id)                             AS active_learners,
  SUM(reviews)                                        AS reviews
FROM daily
GROUP BY day
ORDER BY day DESC
LIMIT 90;


-- A5 ── The credit economy ─────────────────────────────────────
-- credit_ledger is append-only and the balance is SUM(delta); there is
-- no balance column. `reason` is one of refill / review / grant /
-- adjust. Fares ('review') rising against refills is the shape that
-- says the free allowance is starting to bind.
SELECT
  (at AT TIME ZONE 'UTC')::date                       AS day,
  reason,
  COUNT(DISTINCT user_id)                             AS learners,
  SUM(ABS(delta))                                     AS credits
FROM credit_ledger
GROUP BY day, reason
ORDER BY day DESC, reason
LIMIT 200;


-- A6 ── Who is close to the ceiling ────────────────────────────
-- Deck and card counts per learner against the free limits (7 decks,
-- 200 cards -- core/credits.py). Until CREDITS_ENFORCE=1 nobody is
-- stopped, so anyone at or past a limit is someone getting value the
-- pass is meant to charge for.
SELECT
  p.user_id,
  COALESCE(d.decks, 0)                                AS decks,
  COALESCE(c.cards, 0)                                AS cards,
  COALESCE(d.decks, 0) >= 7    AS at_deck_limit,
  COALESCE(c.cards, 0) >= 200  AS at_card_limit
FROM user_profiles p
LEFT JOIN (
  SELECT user_id, COUNT(*) AS decks FROM decks GROUP BY user_id
) d ON d.user_id = p.user_id
LEFT JOIN (
  SELECT user_id, SUM(n) AS cards FROM (
    SELECT user_id, COUNT(*) AS n FROM custom_cards GROUP BY user_id
    UNION ALL
    SELECT user_id, COUNT(*) AS n FROM deck_cards   GROUP BY user_id
  ) x GROUP BY user_id
) c ON c.user_id = p.user_id
WHERE COALESCE(d.decks, 0) > 0 OR COALESCE(c.cards, 0) > 0
ORDER BY cards DESC, decks DESC
LIMIT 100;


-- A7 ── Which practice modes get used at all ───────────────────
-- The four sentence sections keep their own per-attempt logs. This is
-- the crude version of PART B's run_start/run_complete -- it counts
-- attempts, not sessions, and cannot see anything abandoned before the
-- first answer. Worth having until B7 has rows.
SELECT 'reading'       AS mode, COUNT(*) AS attempts, COUNT(DISTINCT user_id) AS learners FROM reading_log
UNION ALL
SELECT 'comprehension',        COUNT(*),              COUNT(DISTINCT user_id) FROM comprehension_log
UNION ALL
SELECT 'translation',          COUNT(*),              COUNT(DISTINCT user_id) FROM translation_log
UNION ALL
SELECT 'dictation',            COUNT(*),              COUNT(DISTINCT user_id) FROM dictation_log
UNION ALL
SELECT 'exam',                 COUNT(*),              COUNT(DISTINCT user_id) FROM exam_attempts
ORDER BY attempts DESC;


-- ═══════════════════════════════════════════════════════════════
--  PART B — the 足跡 questions          (needs the analytics deploy)
-- ═══════════════════════════════════════════════════════════════
--
--  scripts/weekly_digest.py is the MAINTAINED copy of this logic: it is
--  what runs on a schedule and what to edit when a number is wrong.
--  These are the exploration copies -- same questions, shaped so a
--  Metabase date filter can drive them and each is one saved question
--  on a dashboard rather than a row in a markdown table. Expect them to
--  read similarly and not identically; that is the intent, not drift.
--
--  Every one of them reads event_log AND event_daily, for the reason A4
--  unions the review halves: compact_events.py moves rows between them
--  after thirty days.


-- B1 ── みどりの窓口: where boarding is lost ────────────────────
-- Distinct learners who reached each step, in track order. The drop
-- between two consecutive rows IS the answer. There is no 'abandoned'
-- event and there does not need to be -- a boarding_step with no
-- boarding_done after it already says so.
--
-- Reads event_log only, deliberately: boarding_step is in
-- core/events.KEEP_LONG, so compact_events.py never moves it. If this
-- ever returns less than the digest does, that exemption has been lost.
WITH steps AS (
  SELECT
    props->>'step'                                    AS step,
    MIN((props->>'index')::int)                       AS idx,
    COUNT(DISTINCT user_id)                           AS learners
  FROM event_log
  WHERE name = 'boarding_step'
    AND props->>'index' ~ '^[0-9]+$'
  GROUP BY props->>'step'
),
started AS (SELECT MAX(learners) AS n FROM steps)
SELECT
  s.step,
  s.learners,
  ROUND(100.0 * s.learners / NULLIF(t.n, 0), 1)       AS pct_of_starters
FROM steps s CROSS JOIN started t
ORDER BY s.idx;


-- B2 ── ...and how many actually boarded ───────────────────────
-- The far end of B1. Split by motive, because the reason someone gives
-- for being here and whether they finish signing up are the two facts
-- most worth crossing.
SELECT
  COALESCE(props->>'motive', '(none)')                AS motive,
  COUNT(DISTINCT user_id)                             AS boarded
FROM event_log
WHERE name = 'boarding_done'
GROUP BY props->>'motive'
ORDER BY boarded DESC;


-- B3 ── Coming back: D1 / D7 / D30 ─────────────────────────────
-- Day zero is each learner's OWN first app_open, not a calendar date,
-- so a cohort is "people who arrived" rather than "people who arrived
-- in January". The single strongest predictor of whether anyone would
-- ever pay for this.
WITH opens AS (
  SELECT user_id, (at AT TIME ZONE 'UTC')::date AS day
    FROM event_log   WHERE name = 'app_open'
  UNION ALL
  SELECT user_id, day
    FROM event_daily WHERE name = 'app_open'
),
first_seen AS (
  SELECT user_id, MIN(day) AS d0 FROM opens GROUP BY user_id
)
-- COUNT(DISTINCT f.user_id), not COUNT(*): the LEFT JOIN below fans
-- each learner out to one row per open they have, so COUNT(*) counts
-- opens and calls them people. weekly_digest.py sidesteps this with a
-- scalar subquery over the cohort; here the DISTINCT is the fix. It
-- reads plausibly either way -- the number is just quietly too big --
-- which is exactly the kind of error a dashboard never surfaces.
SELECT
  COUNT(DISTINCT f.user_id)                                                   AS cohort,
  COUNT(DISTINCT CASE WHEN o.day - f.d0 >= 1  THEN f.user_id END)             AS returned_d1,
  COUNT(DISTINCT CASE WHEN o.day - f.d0 >= 7  THEN f.user_id END)             AS returned_d7,
  COUNT(DISTINCT CASE WHEN o.day - f.d0 >= 30 THEN f.user_id END)             AS returned_d30
FROM first_seen f
LEFT JOIN opens o ON o.user_id = f.user_id;


-- B4 ── What the boot costs ────────────────────────────────────
-- render.yaml carries `plan: starter` to move this number. Median and
-- p90, never a mean: one 45 s timeout drags a mean to somewhere no
-- learner ever actually was.
SELECT
  (at AT TIME ZONE 'UTC')::date                       AS day,
  COUNT(*)                                            AS opens,
  PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY (props->>'boot_ms')::int) AS median_ms,
  PERCENTILE_DISC(0.9) WITHIN GROUP (ORDER BY (props->>'boot_ms')::int) AS p90_ms,
  COUNT(*) FILTER (WHERE props->>'cold' = 'true')     AS cold
FROM event_log
WHERE name = 'app_open'
  AND props->>'boot_ms' ~ '^[0-9]+$'
GROUP BY day
ORDER BY day DESC
LIMIT 90;


-- B5 ── Boots nobody waited out ────────────────────────────────
-- The 45 s gate in App.jsx reached, or the network gave out. Either
-- way someone watched a loading screen and got nothing, which is the
-- worst first impression the app can make.
SELECT
  (at AT TIME ZONE 'UTC')::date                       AS day,
  COUNT(*)                                            AS gave_up,
  COUNT(DISTINCT user_id)                             AS learners
FROM event_log
WHERE name = 'boot_timeout'
GROUP BY day
ORDER BY day DESC
LIMIT 90;


-- B6 ── Who wanted more than the free allowance ────────────────
-- CREDITS_ENFORCE is unset, so nobody was actually refused: these are
-- the learners who WOULD have been. Both names are in KEEP_LONG, so
-- the rows stay put and this is the demand signal for the pass.
SELECT
  name                                                AS signal,
  COALESCE(props->>'kind', '—')                       AS kind,
  COUNT(DISTINCT user_id)                             AS learners,
  COUNT(*)                                            AS times
FROM event_log
WHERE name IN ('fare_blocked', 'limit_reached')
GROUP BY name, props->>'kind'
ORDER BY learners DESC;


-- B7 ── What gets finished ─────────────────────────────────────
-- Started against finished, per kind. The RATIO is the point: a mode
-- with a high start count and a low finish rate is a mode people want
-- and cannot get through, which is a different problem from one nobody
-- opens at all.
WITH runs AS (
  SELECT name, props->>'kind' AS kind, 1 AS n
    FROM event_log
   WHERE name IN ('run_start', 'run_complete', 'run_abandon')
  UNION ALL
  SELECT name, NULL AS kind, n
    FROM event_daily
   WHERE name IN ('run_start', 'run_complete', 'run_abandon')
)
SELECT
  COALESCE(kind, '(rolled up)')                       AS kind,
  SUM(n) FILTER (WHERE name = 'run_start')            AS started,
  SUM(n) FILTER (WHERE name = 'run_complete')         AS finished,
  SUM(n) FILTER (WHERE name = 'run_abandon')          AS left_early,
  ROUND(100.0 * SUM(n) FILTER (WHERE name = 'run_complete')
        / NULLIF(SUM(n) FILTER (WHERE name = 'run_start'), 0), 1) AS finish_rate
FROM runs
GROUP BY kind
ORDER BY started DESC NULLS LAST;
--
-- Note the '(rolled up)' bucket. event_daily counts by (user, day,
-- name) and keeps no properties, so a run older than thirty days can
-- still be counted but can no longer be attributed to a kind. That is
-- the documented cost of the rollup, and it is visible here rather
-- than quietly folded into one of the real kinds.


-- B8 ── Which screens actually get opened ──────────────────────
-- Route PATTERNS, never paths: lib/routePattern.js reduces
-- /learn/vocab/theme/animaux/... to /learn/vocab/theme/:theme/...
-- before anything is recorded, so no theme, deck or exam a learner
-- named is in this table to be grouped by.
SELECT
  props->>'route'                                     AS route,
  props->>'tab'                                       AS tab,
  COUNT(*)                                            AS views,
  COUNT(DISTINCT user_id)                             AS learners
FROM event_log
WHERE name = 'screen_view'
GROUP BY props->>'route', props->>'tab'
ORDER BY views DESC
LIMIT 60;
