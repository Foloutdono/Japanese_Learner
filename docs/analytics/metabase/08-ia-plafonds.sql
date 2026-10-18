-- dashboard: Tsuji — 足跡 · IA & plafonds
-- description: L'usage des fonctions qui appellent un modèle, face aux plafonds quotidiens (core/daily_limit.py) et aux crédits. daily_usage n'est gardé que 30 jours (prune_logs) ; ai_use (plan 218) le prolonge dans event_daily.

-- ==== question
-- title: Appels rationnés par jour (ai_use)
-- display: line
-- size: 12x6
-- dims: 2
SELECT (at AT TIME ZONE 'Europe/Paris')::date AS "Jour", props->>'feature' AS "Fonction", count(*) AS "Appels"
FROM event_log
WHERE name = 'ai_use' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2 ORDER BY 1;

-- ==== question
-- title: Plafonds atteints
-- display: table
-- size: 12x6
SELECT props->>'feature' AS "Fonction", count(*) AS "Appels", count(DISTINCT user_id) AS "Apprenants",
       count(*) FILTER (WHERE (props->>'over')::boolean) AS "Appels au-delà",
       count(DISTINCT user_id) FILTER (WHERE (props->>'over')::boolean) AS "Apprenants au plafond",
       max((props->>'limit')::int) AS "Plafond"
FROM event_log
WHERE name = 'ai_use' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Compteurs quotidiens des 30 derniers jours
-- display: table
-- size: 12x7
-- description: Plafonds par défaut du code : ask 40, composition 30, translation_review 60, deep_analysis 150, exam_paper 5, conversation_talk 80 (répliques), conversation_review 60 (corrections), OCR 20, compréhension générée 10 (variables d'env. sur Render).
WITH c AS (
  SELECT feature, user_id, day, count FROM daily_usage
  UNION ALL SELECT 'ocr', user_id, day, count FROM ocr_usage
  UNION ALL SELECT 'comprehension', user_id, day, count FROM comprehension_usage
), caps(feature, cap) AS (VALUES ('ask', 40), ('composition', 30), ('translation_review', 60),
                             ('deep_analysis', 150), ('exam_paper', 5),
                             ('conversation_talk', 80), ('conversation_review', 60),
                             ('ocr', 20), ('comprehension', 10))
SELECT c.feature AS "Fonction", sum(c.count) AS "Appels", count(DISTINCT c.user_id) AS "Apprenants",
       max(c.count) AS "Max par apprenant et par jour", caps.cap AS "Plafond",
       count(*) FILTER (WHERE c.count >= caps.cap) AS "Journées au plafond"
FROM c LEFT JOIN caps USING (feature)
WHERE c.user_id NOT IN {{snippet: internal_users}}
GROUP BY c.feature, caps.cap ORDER BY 2 DESC;

-- ==== question
-- title: Analyses de phrases par jour (selon la source)
-- display: bar
-- size: 12x6
-- viz: {"stackable.stack_type": "stacked"}
-- dims: 2
-- description: phrase_history, compté seulement : le texte n'est jamais lu ici.
SELECT (created_at AT TIME ZONE 'Europe/Paris')::date AS "Jour", coalesce(source, '—') AS "Source", count(*) AS "Analyses"
FROM phrase_history
WHERE created_at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2 ORDER BY 1;

-- ==== question
-- title: Fonctions IA à l'écran
-- display: table
-- size: 12x6
SELECT props->>'feature' AS "Fonction", props->>'action' AS "Geste",
       sum((props->>'n')::int) AS "Utilisations", count(DISTINCT user_id) AS "Apprenants"
FROM event_log
WHERE name = 'feature_use' AND props->>'feature' IN ('analyzer', 'ask', 'explain', 'ocr')
  AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2 ORDER BY 3 DESC;

-- ==== question
-- title: Crédits par semaine
-- display: bar
-- size: 12x6
-- dims: 2
SELECT date_trunc('week', at)::date AS "Semaine", reason AS "Motif", sum(delta) AS "Crédits"
FROM credit_ledger
WHERE at >= now() - interval '16 weeks'
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2 ORDER BY 1;

-- ==== question
-- title: Billets refusés et limites atteintes
-- display: table
-- size: 12x6
-- description: fare_blocked = aurait été bloqué (mode ombre) ; limit_reached = un plafond de paquets ou de cartes franchi.
SELECT name AS "Événement", coalesce(props->>'kind', '—') AS "Type",
       count(*) AS "Fois", count(DISTINCT user_id) AS "Apprenants"
FROM event_log
WHERE name IN ('fare_blocked', 'limit_reached')
  AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2 ORDER BY 3 DESC;
