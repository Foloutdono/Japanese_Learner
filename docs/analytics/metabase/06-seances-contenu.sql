-- dashboard: Tsuji — 足跡 · Séances & contenu
-- description: Ce que les séances deviennent, la justesse des réponses, la pratique et les examens. Les séances de pratique (lecture, traduction, compréhension, dictée, rédaction) sont comptées depuis le plan 218 : sans fin propre, une séance quittée après au moins une réponse est « terminée » (mode 'stream').

-- ==== question
-- title: Séances par type : démarrées, terminées, abandonnées
-- display: table
-- size: 12x8
SELECT props->>'kind' AS "Type",
       count(*) FILTER (WHERE name = 'run_start') AS "Démarrées",
       count(*) FILTER (WHERE name = 'run_complete') AS "Terminées",
       count(*) FILTER (WHERE name = 'run_abandon') AS "Abandonnées",
       round(100.0 * count(*) FILTER (WHERE name = 'run_complete')
             / nullif(count(*) FILTER (WHERE name IN ('run_complete', 'run_abandon')), 0), 0) AS "% terminées",
       count(DISTINCT user_id) AS "Apprenants"
FROM event_log
WHERE name IN ('run_start', 'run_complete', 'run_abandon')
  AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Complétion par mode
-- display: table
-- size: 12x8
SELECT props->>'kind' AS "Type", coalesce(props->>'mode', '—') AS "Mode",
       count(*) FILTER (WHERE name = 'run_complete') AS "Terminées",
       count(*) FILTER (WHERE name = 'run_abandon') AS "Abandonnées",
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'done')::numeric) FILTER (WHERE name = 'run_abandon'))::numeric, 0) AS "Cartes avant abandon (méd.)",
       round(100.0 * sum((props->>'right')::numeric) / nullif(sum(coalesce((props->>'items')::numeric, (props->>'done')::numeric)) FILTER (WHERE props ? 'right'), 0), 0) AS "% justes"
FROM event_log
WHERE name IN ('run_complete', 'run_abandon')
  AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2 ORDER BY 3 + 4 DESC;

-- ==== question
-- title: Séances par niveau
-- display: bar
-- size: 12x6
SELECT coalesce(props->>'level', '(sans niveau)') AS "Niveau", count(*) AS "Séances", count(DISTINCT user_id) AS "Apprenants"
FROM event_log
WHERE name = 'run_start' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 1;

-- ==== question
-- title: Porte d'entrée des séances
-- display: pie
-- size: 12x6
-- description: `where` (plan 218) : depuis Aujourd'hui, Apprendre, un paquet, la Pratique, le premier trajet.
SELECT coalesce(props->>'where', '(avant le plan 218)') AS "Porte", count(*) AS "Séances"
FROM event_log
WHERE name = 'run_start' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Révisions par famille de cartes et par semaine
-- display: bar
-- size: 12x7
-- viz: {"stackable.stack_type": "stacked"}
-- dims: 2
SELECT date_trunc('week', reviewed_at AT TIME ZONE 'Europe/Paris')::date AS "Semaine",
       split_part(mode, '.', 1) AS "Famille", count(*) AS "Révisions"
FROM review_log
WHERE reviewed_at >= now() - interval '16 weeks'
  AND split_part(card_id, ':', 1) NOT IN {{snippet: internal_users}}
GROUP BY 1, 2 ORDER BY 1, 2;

-- ==== question
-- title: Justesse des révisions par mode
-- display: table
-- size: 12x7
-- description: Qualité ≥ 3 = juste (la ligne du planificateur).
SELECT mode AS "Mode", count(*) AS "Révisions", count(DISTINCT split_part(card_id, ':', 1)) AS "Apprenants",
       round(100.0 * count(*) FILTER (WHERE quality >= 3) / count(*), 0) AS "% justes"
FROM review_log
WHERE reviewed_at >= now() - ({{days}} || ' days')::interval
  AND split_part(card_id, ':', 1) NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Pratique par semaine (réponses)
-- display: bar
-- size: 12x7
-- viz: {"stackable.stack_type": "stacked"}
-- dims: 2
-- description: Les journaux de pratique, comptés seulement : leurs colonnes de texte ne sont jamais lues ici.
SELECT semaine AS "Semaine", exercice AS "Exercice", count(*) AS "Réponses" FROM (
  SELECT date_trunc('week', created_at)::date AS semaine, 'lecture' AS exercice, user_id FROM reading_log
  UNION ALL SELECT date_trunc('week', created_at)::date, 'traduction', user_id FROM translation_log
  UNION ALL SELECT date_trunc('week', created_at)::date, 'dictée', user_id FROM dictation_log
  UNION ALL SELECT date_trunc('week', created_at)::date, 'rédaction', user_id FROM composition_log
) p
WHERE semaine >= current_date - 7 * 16 AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2 ORDER BY 1, 2;

-- ==== question
-- title: Examens blancs
-- display: table
-- size: 12x7
SELECT split_part(exam_id, '-', 1) AS "Examen", count(*) AS "Tentatives",
       count(*) FILTER (WHERE finished_at IS NOT NULL) AS "Terminées",
       count(DISTINCT user_id) AS "Apprenants",
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY 100.0 * correct / nullif(total, 0)))::numeric, 0) AS "Score médian %",
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM finished_at - started_at) / 60))::numeric, 0) AS "Durée médiane (min)"
FROM exam_attempts
WHERE created_at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Journées bouclées (終着)
-- display: bar
-- size: 12x6
-- viz: {"stackable.stack_type": "stacked"}
-- dims: 2
SELECT (at AT TIME ZONE 'Europe/Paris')::date AS "Jour", coalesce(props->>'tier', 'day') AS "Cérémonie", count(*) AS "Journées"
FROM event_log
WHERE name = 'day_clear' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2 ORDER BY 1;
