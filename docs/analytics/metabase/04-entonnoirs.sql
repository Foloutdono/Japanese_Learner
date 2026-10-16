-- dashboard: Tsuji — 足跡 · Entonnoirs
-- description: Où l'on perd les apprenants : activation, embarquement, premier trajet, guides, cours de base, tours de grammaire, offre. Plan 215.

-- ==== question
-- title: Activation des nouveaux apprenants
-- display: funnel
-- size: 12x8
-- description: Apprenants vus pour la première fois dans la période, puis chaque marche franchie (à n'importe quel moment).
WITH active AS (
  SELECT user_id, (at AT TIME ZONE 'Europe/Paris')::date AS day FROM event_log WHERE name <> 'api_error'
  UNION ALL
  SELECT user_id, day FROM event_daily WHERE name <> 'api_error'
), cohort AS (
  SELECT user_id, min(day) AS first_day FROM active GROUP BY user_id
  HAVING min(day) >= current_date - {{days}}
), marks AS (
  SELECT c.user_id,
         bool_or(e.name = 'boarding_done') AS boarded,
         bool_or(e.name = 'run_start') AS started,
         bool_or(e.name = 'run_complete') AS completed
  FROM cohort c LEFT JOIN event_log e USING (user_id)
  GROUP BY c.user_id
), back AS (
  SELECT DISTINCT a.user_id FROM active a JOIN cohort c USING (user_id) WHERE a.day > c.first_day
)
SELECT step AS "Étape", n AS "Apprenants" FROM (
  SELECT 1 AS o, 'Arrivés' AS step, count(*) AS n FROM cohort WHERE user_id NOT IN {{snippet: internal_users}}
  UNION ALL SELECT 2, 'Embarqués', count(*) FILTER (WHERE boarded) FROM marks WHERE user_id NOT IN {{snippet: internal_users}}
  UNION ALL SELECT 3, 'Première séance', count(*) FILTER (WHERE started) FROM marks WHERE user_id NOT IN {{snippet: internal_users}}
  UNION ALL SELECT 4, 'Séance terminée', count(*) FILTER (WHERE completed) FROM marks WHERE user_id NOT IN {{snippet: internal_users}}
  UNION ALL SELECT 5, 'Revenus un autre jour', count(*) FROM back WHERE user_id NOT IN {{snippet: internal_users}}
) s ORDER BY o;

-- ==== question
-- title: Embarquement, étape par étape
-- display: bar
-- size: 12x8
-- description: Apprenants ayant quitté chaque étape (boarding_step), dans l'ordre médian du parcours. Les étapes gardées longtemps (KEEP_LONG) remontent au-delà de 30 jours.
SELECT props->>'step' AS "Étape",
       count(DISTINCT user_id) AS "Apprenants"
FROM event_log
WHERE name = 'boarding_step' AND coalesce(props->>'dir', 'fwd') <> 'back'
  AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1
ORDER BY percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'index')::numeric), 1;

-- ==== question
-- title: Temps passé par étape d'embarquement
-- display: table
-- size: 12x8
SELECT props->>'step' AS "Étape", count(*) AS "Passages",
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'ms')::numeric) / 1000)::numeric, 1) AS "Médiane (s)",
       round((percentile_cont(0.9) WITHIN GROUP (ORDER BY (props->>'ms')::numeric) / 1000)::numeric, 1) AS "P90 (s)",
       count(*) FILTER (WHERE props->>'dir' = 'back') AS "Retours"
FROM event_log
WHERE name = 'boarding_step' AND props ? 'ms'
  AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1
ORDER BY percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'index')::numeric), 1;

-- ==== question
-- title: Embarquement terminé : choix faits
-- display: table
-- size: 12x8
SELECT coalesce(props->>'motive', '—') AS "Motif", coalesce(props->>'level', '—') AS "Niveau",
       coalesce(props->>'pace', '—') AS "Rythme", count(DISTINCT user_id) AS "Apprenants",
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'ms')::numeric) / 60000)::numeric, 1) AS "Durée médiane (min)"
FROM event_log
WHERE name = 'boarding_done' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2, 3 ORDER BY 4 DESC;

-- ==== question
-- title: Premier trajet (試乗)
-- display: table
-- size: 12x7
SELECT props->>'step' AS "Étape quittée", count(DISTINCT user_id) AS "Apprenants",
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'ms')::numeric) / 1000)::numeric, 1) AS "Médiane (s)"
FROM event_log
WHERE name = 'ride_step' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Premier trajet : terminé ou passé
-- display: pie
-- size: 6x7
SELECT CASE WHEN (props->>'skipped')::boolean THEN 'Passé (' || coalesce(props->>'at', '?') || ')'
            ELSE 'Terminé' END AS "Fin", count(DISTINCT user_id) AS "Apprenants"
FROM event_log
WHERE name = 'ride_done' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1;

-- ==== question
-- title: Guides par portail
-- display: table
-- size: 6x7
SELECT props->>'gate' AS "Portail",
       count(DISTINCT user_id) FILTER (WHERE NOT (props->>'skipped')::boolean) AS "Suivis",
       count(DISTINCT user_id) FILTER (WHERE (props->>'skipped')::boolean) AS "Passés",
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'stops')::numeric))::numeric, 0) AS "Arrêts vus"
FROM event_log
WHERE name = 'guide_done' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 1;

-- ==== question
-- title: Cours de base : unités terminées
-- display: bar
-- size: 12x6
SELECT (props->>'unit')::int AS "Unité",
       count(DISTINCT user_id) FILTER (WHERE name = 'basics_unit_done') AS "Terminée",
       count(DISTINCT user_id) FILTER (WHERE name = 'basics_skipped') AS "Cours quitté ici"
FROM event_log
WHERE name IN ('basics_unit_done', 'basics_skipped')
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 1;

-- ==== question
-- title: Tours de grammaire : où l'on s'arrête
-- display: table
-- size: 12x7
SELECT coalesce(props->>'level', '—') AS "Niveau", props->>'stop' AS "Arrêt",
       coalesce(props->>'outcome', '—') AS "Issue", count(*) AS "Fois", count(DISTINCT user_id) AS "Apprenants"
FROM event_log
WHERE name = 'grammar_tour_step' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2, 3 ORDER BY 1, 4 DESC;

-- ==== question
-- title: Offre par porte
-- display: table
-- size: 12x7
SELECT props->>'where' AS "Porte",
       count(DISTINCT user_id) FILTER (WHERE name = 'offer_view') AS "Vue",
       count(DISTINCT user_id) FILTER (WHERE name = 'offer_intent') AS "Intention",
       count(DISTINCT user_id) FILTER (WHERE name = 'offer_dismiss') AS "Refus",
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'ms')::numeric) FILTER (WHERE name <> 'offer_view') / 1000)::numeric, 1) AS "Décision (s)"
FROM event_log
WHERE name IN ('offer_view', 'offer_intent', 'offer_dismiss')
  AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;
