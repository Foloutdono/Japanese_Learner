-- dashboard: Tsuji — 足跡 · Rétention
-- description: Qui revient, ce qui distingue ceux qui reviennent, et le plan de retour après une absence (回復運転, plan 217). Activité = au moins un événement ce jour-là (event_log ∪ event_daily, donc tout l'historique gardé). Plan 218.

-- ==== question
-- title: Cohortes hebdomadaires (% actifs la semaine N)
-- display: table
-- size: 24x8
-- description: Cohorte = semaine du premier événement. S1 = la semaine suivante, etc. Les 12 dernières cohortes.
WITH active AS (
  SELECT DISTINCT user_id, (at AT TIME ZONE 'Europe/Paris')::date AS day FROM event_log WHERE name <> 'api_error'
  UNION
  SELECT user_id, day FROM event_daily WHERE name <> 'api_error'
), firsts AS (
  SELECT user_id, min(day) AS first_day FROM active
  WHERE user_id NOT IN {{snippet: internal_users}}
  GROUP BY user_id
), weeks AS (
  SELECT f.user_id, date_trunc('week', f.first_day)::date AS cohort,
         (date_trunc('week', a.day)::date - date_trunc('week', f.first_day)::date) / 7 AS w
  FROM firsts f JOIN active a USING (user_id)
)
SELECT cohort AS "Cohorte",
       count(DISTINCT user_id) AS "Apprenants",
       round(100.0 * count(DISTINCT user_id) FILTER (WHERE w = 1) / count(DISTINCT user_id), 0) AS "S1 %",
       round(100.0 * count(DISTINCT user_id) FILTER (WHERE w = 2) / count(DISTINCT user_id), 0) AS "S2 %",
       round(100.0 * count(DISTINCT user_id) FILTER (WHERE w = 3) / count(DISTINCT user_id), 0) AS "S3 %",
       round(100.0 * count(DISTINCT user_id) FILTER (WHERE w = 4) / count(DISTINCT user_id), 0) AS "S4 %",
       round(100.0 * count(DISTINCT user_id) FILTER (WHERE w = 6) / count(DISTINCT user_id), 0) AS "S6 %",
       round(100.0 * count(DISTINCT user_id) FILTER (WHERE w = 8) / count(DISTINCT user_id), 0) AS "S8 %",
       round(100.0 * count(DISTINCT user_id) FILTER (WHERE w = 12) / count(DISTINCT user_id), 0) AS "S12 %"
FROM weeks
WHERE cohort >= date_trunc('week', current_date)::date - 7 * 12
GROUP BY 1 ORDER BY 1 DESC;

-- ==== question
-- title: Courbe de rétention (jours depuis l'arrivée)
-- display: line
-- size: 12x7
-- description: Pour chaque jour J, la part des apprenants arrivés il y a au moins J jours qui étaient actifs à J.
WITH active AS (
  SELECT DISTINCT user_id, (at AT TIME ZONE 'Europe/Paris')::date AS day FROM event_log WHERE name <> 'api_error'
  UNION
  SELECT user_id, day FROM event_daily WHERE name <> 'api_error'
), firsts AS (
  SELECT user_id, min(day) AS first_day FROM active
  WHERE user_id NOT IN {{snippet: internal_users}}
  GROUP BY user_id
), days AS (SELECT generate_series(1, 30) AS d)
SELECT d.d AS "Jour",
       round(100.0 * count(DISTINCT a.user_id) / nullif(count(DISTINCT f.user_id), 0), 1) AS "% actifs"
FROM days d
JOIN firsts f ON f.first_day <= current_date - d.d
LEFT JOIN active a ON a.user_id = f.user_id AND a.day = f.first_day + d.d
GROUP BY d.d ORDER BY d.d;

-- ==== question
-- title: J1, J7, J30 par cohorte
-- display: table
-- size: 12x7
-- description: Revenu le jour exact (J1) ou à n'importe quel jour entre J+1 et J+7 / J+30 (« revenu dans la semaine / le mois »).
WITH active AS (
  SELECT DISTINCT user_id, (at AT TIME ZONE 'Europe/Paris')::date AS day FROM event_log WHERE name <> 'api_error'
  UNION
  SELECT user_id, day FROM event_daily WHERE name <> 'api_error'
), firsts AS (
  SELECT user_id, min(day) AS first_day FROM active
  WHERE user_id NOT IN {{snippet: internal_users}}
  GROUP BY user_id
), marks AS (
  SELECT f.user_id, date_trunc('week', f.first_day)::date AS cohort, f.first_day,
         bool_or(a.day = f.first_day + 1) AS d1,
         bool_or(a.day BETWEEN f.first_day + 1 AND f.first_day + 7) AS w1,
         bool_or(a.day BETWEEN f.first_day + 1 AND f.first_day + 30) AS m1
  FROM firsts f LEFT JOIN active a USING (user_id)
  GROUP BY 1, 2, 3
)
SELECT cohort AS "Cohorte", count(*) AS "Apprenants",
       round(100.0 * count(*) FILTER (WHERE d1) / count(*), 0) AS "J1 %",
       CASE WHEN max(first_day) <= current_date - 7 THEN round(100.0 * count(*) FILTER (WHERE w1) / count(*), 0) END AS "Sous 7 j %",
       CASE WHEN max(first_day) <= current_date - 30 THEN round(100.0 * count(*) FILTER (WHERE m1) / count(*), 0) END AS "Sous 30 j %"
FROM marks
WHERE cohort >= date_trunc('week', current_date)::date - 7 * 12
GROUP BY 1 ORDER BY 1 DESC;

-- ==== question
-- title: Revenus sous 7 jours, par motif d'embarquement
-- display: table
-- size: 12x7
WITH active AS (
  SELECT DISTINCT user_id, (at AT TIME ZONE 'Europe/Paris')::date AS day FROM event_log WHERE name <> 'api_error'
  UNION
  SELECT user_id, day FROM event_daily WHERE name <> 'api_error'
), firsts AS (
  SELECT user_id, min(day) AS first_day FROM active GROUP BY user_id
), motive AS (
  SELECT DISTINCT ON (user_id) user_id, coalesce(props->>'motive', '—') AS motive, coalesce(props->>'level', '—') AS level
  FROM event_log WHERE name = 'boarding_done' ORDER BY user_id, at
), marks AS (
  SELECT m.motive, m.level, f.user_id,
         bool_or(a.day BETWEEN f.first_day + 1 AND f.first_day + 7) AS back
  FROM motive m JOIN firsts f USING (user_id) LEFT JOIN active a USING (user_id)
  WHERE f.first_day <= current_date - 7 AND f.user_id NOT IN {{snippet: internal_users}}
  GROUP BY 1, 2, 3
)
SELECT motive AS "Motif", count(*) AS "Apprenants",
       round(100.0 * count(*) FILTER (WHERE back) / count(*), 0) AS "Revenus sous 7 j %"
FROM marks GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Revenus sous 7 jours, par niveau choisi
-- display: table
-- size: 12x7
WITH active AS (
  SELECT DISTINCT user_id, (at AT TIME ZONE 'Europe/Paris')::date AS day FROM event_log WHERE name <> 'api_error'
  UNION
  SELECT user_id, day FROM event_daily WHERE name <> 'api_error'
), firsts AS (
  SELECT user_id, min(day) AS first_day FROM active GROUP BY user_id
), lvl AS (
  SELECT DISTINCT ON (user_id) user_id, coalesce(props->>'level', '—') AS level
  FROM event_log WHERE name = 'boarding_done' ORDER BY user_id, at
), marks AS (
  SELECT l.level, f.user_id, bool_or(a.day BETWEEN f.first_day + 1 AND f.first_day + 7) AS back
  FROM lvl l JOIN firsts f USING (user_id) LEFT JOIN active a USING (user_id)
  WHERE f.first_day <= current_date - 7 AND f.user_id NOT IN {{snippet: internal_users}}
  GROUP BY 1, 2
)
SELECT level AS "Niveau", count(*) AS "Apprenants",
       round(100.0 * count(*) FILTER (WHERE back) / count(*), 0) AS "Revenus sous 7 j %"
FROM marks GROUP BY 1 ORDER BY 1;

-- ==== question
-- title: Revenus sous 7 jours, selon le premier trajet
-- display: table
-- size: 12x7
WITH active AS (
  SELECT DISTINCT user_id, (at AT TIME ZONE 'Europe/Paris')::date AS day FROM event_log WHERE name <> 'api_error'
  UNION
  SELECT user_id, day FROM event_daily WHERE name <> 'api_error'
), firsts AS (
  SELECT user_id, min(day) AS first_day FROM active GROUP BY user_id
), ride AS (
  SELECT DISTINCT ON (user_id) user_id,
         CASE WHEN (props->>'skipped')::boolean THEN 'passé' ELSE 'terminé' END AS ride
  FROM event_log WHERE name = 'ride_done' ORDER BY user_id, at
), marks AS (
  SELECT coalesce(r.ride, 'jamais vu') AS ride, f.user_id,
         bool_or(a.day BETWEEN f.first_day + 1 AND f.first_day + 7) AS back
  FROM firsts f LEFT JOIN ride r USING (user_id) LEFT JOIN active a USING (user_id)
  WHERE f.first_day <= current_date - 7 AND f.user_id NOT IN {{snippet: internal_users}}
  GROUP BY 1, 2
)
SELECT ride AS "Premier trajet", count(*) AS "Apprenants",
       round(100.0 * count(*) FILTER (WHERE back) / count(*), 0) AS "Revenus sous 7 j %"
FROM marks GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Revenus sous 7 jours, par écran et système de la première visite
-- display: table
-- size: 12x7
-- description: Contexte du premier session_start porteur de contexte (plan 218).
WITH active AS (
  SELECT DISTINCT user_id, (at AT TIME ZONE 'Europe/Paris')::date AS day FROM event_log WHERE name <> 'api_error'
  UNION
  SELECT user_id, day FROM event_daily WHERE name <> 'api_error'
), firsts AS (
  SELECT user_id, min(day) AS first_day FROM active GROUP BY user_id
), ctx AS (
  SELECT DISTINCT ON (user_id) user_id, props->>'vp' AS vp, props->>'os' AS os
  FROM event_log WHERE name = 'session_start' AND props ? 'vp' ORDER BY user_id, at
), marks AS (
  SELECT c.vp, c.os, f.user_id, bool_or(a.day BETWEEN f.first_day + 1 AND f.first_day + 7) AS back
  FROM ctx c JOIN firsts f USING (user_id) LEFT JOIN active a USING (user_id)
  WHERE f.first_day <= current_date - 7 AND f.user_id NOT IN {{snippet: internal_users}}
  GROUP BY 1, 2, 3
)
SELECT vp AS "Écran", os AS "Système", count(*) AS "Apprenants",
       round(100.0 * count(*) FILTER (WHERE back) / count(*), 0) AS "Revenus sous 7 j %"
FROM marks GROUP BY 1, 2 ORDER BY 3 DESC;

-- ==== question
-- title: Nouveaux et revenants par semaine
-- display: bar
-- size: 12x7
-- viz: {"stackable.stack_type": "stacked"}
WITH active AS (
  SELECT DISTINCT user_id, (at AT TIME ZONE 'Europe/Paris')::date AS day FROM event_log WHERE name <> 'api_error'
  UNION
  SELECT user_id, day FROM event_daily WHERE name <> 'api_error'
), firsts AS (
  SELECT user_id, min(day) AS first_day FROM active GROUP BY user_id
)
SELECT date_trunc('week', a.day)::date AS "Semaine",
       count(DISTINCT a.user_id) FILTER (WHERE date_trunc('week', f.first_day) = date_trunc('week', a.day)) AS "Nouveaux",
       count(DISTINCT a.user_id) FILTER (WHERE date_trunc('week', f.first_day) < date_trunc('week', a.day)) AS "Revenants"
FROM active a JOIN firsts f USING (user_id)
WHERE a.day >= current_date - 7 * 16 AND a.user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 1;

-- ==== question
-- title: Plan de retour (回復運転) : proposé, choisi, tenu
-- display: funnel
-- size: 12x7
-- description: catchup_offer (la feuille de retour ouverte), catchup_choice hors « tout d'un coup » (un plan étalé ou en douceur), catchup_done (le plan arrivé au bout).
WITH e AS (
  SELECT name, user_id, props FROM event_log
  WHERE name IN ('catchup_offer', 'catchup_choice', 'catchup_done')
    AND at >= now() - ({{days}} || ' days')::interval
    AND user_id NOT IN {{snippet: internal_users}}
)
SELECT "Étape", "Apprenants" FROM (
  SELECT 1 AS k, 'Plan proposé' AS "Étape", count(DISTINCT user_id) AS "Apprenants" FROM e WHERE name = 'catchup_offer'
  UNION ALL
  SELECT 2, 'Plan choisi', count(DISTINCT user_id) FROM e WHERE name = 'catchup_choice' AND props->>'choice' <> 'all'
  UNION ALL
  SELECT 3, 'Plan tenu jusqu''au bout', count(DISTINCT user_id) FROM e WHERE name = 'catchup_done'
) s ORDER BY k;

-- ==== question
-- title: Plan de retour : les choix
-- display: table
-- size: 12x7
-- description: spread = étalé sur des jours, gentle = en douceur, all = tout d'un coup (pas de plan). Le retard et l'absence viennent de la feuille proposée (catchup_offer).
WITH offers AS (
  SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'owed')::numeric))::numeric, 0) AS owed,
         round((percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'away')::numeric))::numeric, 0) AS away
  FROM event_log
  WHERE name = 'catchup_offer' AND at >= now() - ({{days}} || ' days')::interval
    AND user_id NOT IN {{snippet: internal_users}}
)
SELECT props->>'choice' AS "Choix", count(*) AS "Fois", count(DISTINCT user_id) AS "Apprenants",
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'days')::numeric))::numeric, 0) AS "Jours du plan (médiane)",
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'per_day')::numeric))::numeric, 0) AS "Par jour (médiane)",
       max(o.owed) AS "Retard proposé (médiane)", max(o.away) AS "Jours d'absence (médiane)"
FROM event_log, offers o
WHERE name = 'catchup_choice' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Absences déclarées et plafond de révisions
-- display: table
-- size: 12x7
-- description: away_set (une absence déclarée, ou retirée), away_day_used (les jours d'absence que le pont a couverts), review_cap_set (le plafond choisi dans les Réglages, « aucun » s'il est retiré).
SELECT CASE WHEN name = 'review_cap_set' THEN 'Plafond de révisions'
            WHEN name = 'away_day_used' THEN 'Jours d''absence couverts'
            WHEN (props->>'days')::int = 0 THEN 'Absence retirée'
            ELSE 'Absence déclarée' END AS "Geste",
       CASE WHEN name = 'review_cap_set' THEN coalesce(props->>'cap', 'aucun') ELSE '—' END AS "Plafond",
       count(*) AS "Fois", count(DISTINCT user_id) AS "Apprenants",
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'days')::numeric))::numeric, 0) AS "Jours (médiane)"
FROM event_log
WHERE name IN ('away_set', 'away_day_used', 'review_cap_set')
  AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2 ORDER BY 1, 3 DESC;
