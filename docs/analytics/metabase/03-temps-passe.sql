-- dashboard: Tsuji — 足跡 · Temps passé
-- description: Temps engagé (onglet caché exclu, lib/dwell.js) par écran, visite, séance et carte. Plan 215 : les séjours datent de son déploiement.

-- ==== question
-- title: Heures engagées sur la période
-- display: scalar
-- size: 6x3
SELECT round(sum((props->>'ms')::numeric) / 3600000, 1) AS "Heures"
FROM event_log
WHERE name = 'screen_leave' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}};

-- ==== question
-- title: Visites mesurées
-- display: scalar
-- size: 6x3
SELECT count(DISTINCT sid) AS "Visites"
FROM event_log
WHERE name = 'screen_leave' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}};

-- ==== question
-- title: Temps par écran
-- display: table
-- size: 12x10
SELECT props->>'route' AS "Écran",
       round(sum((props->>'ms')::numeric) / 60000, 1) AS "Minutes",
       round(100.0 * sum((props->>'ms')::numeric) / nullif(sum(sum((props->>'ms')::numeric)) OVER (), 0), 1) AS "% du temps",
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'ms')::numeric) / 1000)::numeric, 1) AS "Médiane (s)",
       round((percentile_cont(0.9) WITHIN GROUP (ORDER BY (props->>'ms')::numeric) / 1000)::numeric, 1) AS "P90 (s)",
       count(*) AS "Séjours", count(DISTINCT user_id) AS "Apprenants"
FROM event_log
WHERE name = 'screen_leave' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Part du temps par onglet
-- display: pie
-- size: 12x10
SELECT coalesce(props->>'tab', '(séances et hors onglet)') AS "Onglet",
       round(sum((props->>'ms')::numeric) / 60000, 1) AS "Minutes"
FROM event_log
WHERE name = 'screen_leave' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Durée des visites
-- display: bar
-- size: 12x6
WITH visits AS (
  SELECT sid, sum((props->>'ms')::numeric) / 60000 AS minutes
  FROM event_log
  WHERE name = 'screen_leave' AND sid IS NOT NULL
    AND at >= now() - ({{days}} || ' days')::interval
    AND user_id NOT IN {{snippet: internal_users}}
  GROUP BY sid
)
SELECT CASE WHEN minutes < 1 THEN '1. < 1 min'
            WHEN minutes < 3 THEN '2. 1–3 min'
            WHEN minutes < 10 THEN '3. 3–10 min'
            WHEN minutes < 30 THEN '4. 10–30 min'
            ELSE '5. 30 min et plus' END AS "Durée",
       count(*) AS "Visites"
FROM visits GROUP BY 1 ORDER BY 1;

-- ==== question
-- title: Minutes engagées par jour
-- display: line
-- size: 12x6
WITH per_user AS (
  SELECT (at AT TIME ZONE 'Europe/Paris')::date AS day, user_id, sum((props->>'ms')::numeric) / 60000 AS minutes
  FROM event_log
  WHERE name = 'screen_leave' AND at >= now() - ({{days}} || ' days')::interval
    AND user_id NOT IN {{snippet: internal_users}}
  GROUP BY 1, 2
)
SELECT day AS "Jour", round(sum(minutes), 1) AS "Minutes au total",
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY minutes))::numeric, 1) AS "Médiane par apprenant"
FROM per_user GROUP BY 1 ORDER BY 1;

-- ==== question
-- title: Durée des séances par type
-- display: table
-- size: 12x7
-- description: run_complete et run_abandon. ms = temps engagé (plan 215) ; avant lui, secs (horloge).
WITH runs AS (
  SELECT props->>'kind' AS kind, name,
         coalesce((props->>'ms')::numeric, (props->>'secs')::numeric * 1000) AS ms,
         coalesce((props->>'items')::numeric, (props->>'done')::numeric) AS items
  FROM event_log
  WHERE name IN ('run_complete', 'run_abandon') AND at >= now() - ({{days}} || ' days')::interval
    AND user_id NOT IN {{snippet: internal_users}}
)
SELECT kind AS "Type", count(*) AS "Séances",
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY ms) / 60000)::numeric, 1) AS "Médiane (min)",
       round((percentile_cont(0.9) WITHIN GROUP (ORDER BY ms) / 60000)::numeric, 1) AS "P90 (min)",
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY items))::numeric, 0) AS "Cartes (médiane)"
FROM runs WHERE ms IS NOT NULL
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Temps par carte (secondes)
-- display: table
-- size: 12x7
-- description: card_p50 / card_p90 de chaque séance (temps engagé par réponse), puis la médiane de ces séances.
SELECT props->>'kind' AS "Type", coalesce(props->>'mode', '—') AS "Mode", count(*) AS "Séances",
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'card_p50')::numeric) / 1000)::numeric, 1) AS "Carte médiane (s)",
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'card_p90')::numeric) / 1000)::numeric, 1) AS "Carte lente, P90 (s)"
FROM event_log
WHERE name IN ('run_complete', 'run_abandon') AND props ? 'card_p50'
  AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2 ORDER BY 3 DESC;

-- ==== question
-- title: Heures de visite (heure de Paris)
-- display: bar
-- size: 12x6
SELECT extract(hour FROM at AT TIME ZONE 'Europe/Paris')::int AS "Heure", count(*) AS "Visites"
FROM event_log
WHERE name = 'session_start' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 1;

-- ==== question
-- title: Jours de visite
-- display: bar
-- size: 12x6
SELECT extract(isodow FROM at AT TIME ZONE 'Europe/Paris')::int || '. ' ||
       (ARRAY['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'])[extract(isodow FROM at AT TIME ZONE 'Europe/Paris')::int] AS "Jour",
       count(*) AS "Visites", count(DISTINCT user_id) AS "Apprenants"
FROM event_log
WHERE name = 'session_start' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 1;
