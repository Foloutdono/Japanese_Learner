-- dashboard: Tsuji — 足跡 · IA & plafonds
-- description: L'usage des fonctions qui appellent un modèle, face aux plafonds quotidiens (core/daily_limit.py) et aux crédits. daily_usage n'est gardé que 30 jours (prune_logs) ; ai_use (plan 218) le prolonge dans event_daily. Les questions « Crédits — » en bas de page mesurent la consommation des crédits (core/credits.py) pour régler le bonus d'accueil, la recharge et le plafond.

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
-- description: Plafonds par défaut du code : ask 40, composition 30, translation_review 60, deep_analysis 150, exam_paper 5, conversation_talk 80 (répliques), conversation_review 60 (corrections), lyrics_sort 20 (chansons triées), OCR 20, compréhension générée 10 (variables d'env. sur Render).
WITH c AS (
  SELECT feature, user_id, day, count FROM daily_usage
  UNION ALL SELECT 'ocr', user_id, day, count FROM ocr_usage
  UNION ALL SELECT 'comprehension', user_id, day, count FROM comprehension_usage
), caps(feature, cap) AS (VALUES ('ask', 40), ('composition', 30), ('translation_review', 60),
                             ('deep_analysis', 150), ('exam_paper', 5),
                             ('conversation_talk', 80), ('conversation_review', 60), ('lyrics_sort', 20),
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

-- ==== question
-- title: Crédits — dépense par jour d'étude (moyenne et centiles)
-- display: table
-- size: 24x4
-- description: Une journée d'étude = un apprenant qui a dépensé au moins un crédit ce jour-là (credit_ledger, motif review ; la journée est celle de Paris). Le kana et les répétitions d'une étape d'apprentissage sont gratuits et ne comptent pas ; un abonné ne laisse aucune ligne. À comparer aux réglages de core/credits.py : recharge 30 par jour (un crédit toutes les 48 min), réservoir 50, bonus d'accueil 200. Un solde vide plafonne la dépense observée : voir « Crédits — demande vs dépense ».
WITH j AS (
  SELECT user_id, (at AT TIME ZONE 'Europe/Paris')::date AS d, sum(-delta) AS n
  FROM credit_ledger
  WHERE reason = 'review' AND at >= now() - ({{days}} || ' days')::interval
    AND user_id NOT IN {{snippet: internal_users}}
  GROUP BY 1, 2
)
SELECT count(*) AS "Journées d'étude", count(DISTINCT user_id) AS "Apprenants",
       round(avg(n), 1) AS "Moyenne par jour d'étude",
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY n))::numeric, 1) AS "Médiane",
       round((percentile_cont(0.75) WITHIN GROUP (ORDER BY n))::numeric, 1) AS "P75",
       round((percentile_cont(0.9) WITHIN GROUP (ORDER BY n))::numeric, 1) AS "P90",
       round((percentile_cont(0.95) WITHIN GROUP (ORDER BY n))::numeric, 1) AS "P95",
       max(n) AS "Max",
       30 AS "Recharge par jour",
       round(100.0 * count(*) FILTER (WHERE n > 30) / nullif(count(*), 0), 1) AS "% de journées au-delà de la recharge"
FROM j;

-- ==== question
-- title: Crédits — dépense moyenne par jour d'étude
-- display: line
-- size: 12x6
-- description: Moyenne et médiane des crédits dépensés par les apprenants actifs ce jour-là, face à la recharge quotidienne (30).
WITH j AS (
  SELECT user_id, (at AT TIME ZONE 'Europe/Paris')::date AS d, sum(-delta) AS n
  FROM credit_ledger
  WHERE reason = 'review' AND at >= now() - ({{days}} || ' days')::interval
    AND user_id NOT IN {{snippet: internal_users}}
  GROUP BY 1, 2
)
SELECT d AS "Jour", round(avg(n), 1) AS "Moyenne",
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY n))::numeric, 1) AS "Médiane",
       30 AS "Recharge par jour"
FROM j GROUP BY 1 ORDER BY 1;

-- ==== question
-- title: Crédits — journées d'étude par crédits dépensés
-- display: bar
-- size: 12x6
-- description: Combien de journées d'étude tiennent dans la recharge (jusqu'à 30) et combien la dépassent. Les barres au-delà de 30 vivent du solde accumulé ou du bonus d'accueil.
WITH j AS (
  SELECT user_id, (at AT TIME ZONE 'Europe/Paris')::date AS d, sum(-delta) AS n
  FROM credit_ledger
  WHERE reason = 'review' AND at >= now() - ({{days}} || ' days')::interval
    AND user_id NOT IN {{snippet: internal_users}}
  GROUP BY 1, 2
)
SELECT CASE WHEN n <= 10 THEN '1–10' WHEN n <= 20 THEN '11–20' WHEN n <= 30 THEN '21–30'
            WHEN n <= 50 THEN '31–50' WHEN n <= 100 THEN '51–100' ELSE '100+' END AS "Crédits dépensés dans la journée",
       count(*) AS "Journées d'étude"
FROM j GROUP BY 1 ORDER BY min(n);

-- ==== question
-- title: Crédits — apprenants par dépense moyenne
-- display: bar
-- size: 12x6
-- description: Chaque apprenant selon sa dépense moyenne sur ses jours d'étude. La part au-dessus de 30 est celle que la recharge seule ne suffirait pas à servir.
WITH j AS (
  SELECT user_id, (at AT TIME ZONE 'Europe/Paris')::date AS d, sum(-delta) AS n
  FROM credit_ledger
  WHERE reason = 'review' AND at >= now() - ({{days}} || ' days')::interval
    AND user_id NOT IN {{snippet: internal_users}}
  GROUP BY 1, 2
), l AS (
  SELECT user_id, avg(n) AS moy FROM j GROUP BY 1
)
SELECT CASE WHEN moy <= 10 THEN '1–10' WHEN moy <= 20 THEN '11–20' WHEN moy <= 30 THEN '21–30'
            WHEN moy <= 50 THEN '31–50' ELSE '50+' END AS "Dépense moyenne par jour d'étude",
       count(*) AS "Apprenants"
FROM l GROUP BY 1 ORDER BY min(moy);

-- ==== question
-- title: Crédits — le bonus d'accueil face à la dépense cumulée
-- display: line
-- size: 12x6
-- viz: {"graph.metrics": ["Dépense cumulée moyenne", "Bonus d'accueil"]}
-- description: Pour chaque jour k depuis l'ouverture du compte (grant « welcome »), les crédits dépensés en moyenne dans les k premiers jours par les apprenants inscrits depuis au moins k jours (inscrits dans la période choisie). La courbe franchit le bonus (200) le jour où il est épuisé ; la recharge s'y ajoute. Colonnes « Apprenants » et « % au-delà du bonus » dans les données.
WITH w AS (
  SELECT user_id, min(at) AS t0
  FROM credit_ledger
  WHERE reason = 'grant' AND ref = 'welcome' AND user_id NOT IN {{snippet: internal_users}}
  GROUP BY 1
  HAVING min(at) >= now() - ({{days}} || ' days')::interval
)
SELECT k.j AS "Jour depuis l'inscription", round(avg(s.n), 1) AS "Dépense cumulée moyenne",
       200 AS "Bonus d'accueil", count(*) AS "Apprenants",
       round(100.0 * avg((s.n > 200)::int), 1) AS "% au-delà du bonus"
FROM generate_series(1, 14) AS k(j)
JOIN w ON w.t0 <= now() - make_interval(days => k.j)
CROSS JOIN LATERAL (
  SELECT coalesce(sum(-l.delta), 0) AS n FROM credit_ledger l
  WHERE l.user_id = w.user_id AND l.reason = 'review'
    AND l.at >= w.t0 AND l.at < w.t0 + make_interval(days => k.j)
) s
GROUP BY 1 ORDER BY 1;

-- ==== question
-- title: Crédits — soldes actuels des apprenants actifs
-- display: bar
-- size: 12x6
-- description: Le solde du registre (les crédits arrivés mais pas encore réclamés n'y sont pas) des apprenants qui ont dépensé un crédit dans la période. Beaucoup à 0 : l'allocation est courte ; beaucoup au-dessus de 50 : le bonus ou la recharge dépassent l'usage.
SELECT CASE WHEN bal <= 0 THEN '0' WHEN bal < 10 THEN '1–9' WHEN bal < 30 THEN '10–29'
            WHEN bal <= 50 THEN '30–50' WHEN bal < 200 THEN '51–199' ELSE '200+' END AS "Solde",
       count(*) AS "Apprenants"
FROM (
  SELECT user_id, sum(delta) AS bal FROM credit_ledger
  WHERE user_id NOT IN {{snippet: internal_users}}
  GROUP BY 1
  HAVING bool_or(reason = 'review' AND at >= now() - ({{days}} || ' days')::interval)
) b
GROUP BY 1 ORDER BY min(bal);

-- ==== question
-- title: Crédits — demande vs dépense
-- display: bar
-- size: 12x6
-- viz: {"stackable.stack_type": "stacked"}
-- dims: 2
-- description: Révisions payées (le solde les couvrait) et révisions restées en attente faute de crédits (credit_stops : en mode ombre, celles que la barrière aurait refusées). La somme est la demande réelle : la dépense seule la sous-estime dès que des apprenants butent sur un solde vide.
SELECT d AS "Jour", motif AS "Motif", sum(n) AS "Révisions"
FROM (
  SELECT (at AT TIME ZONE 'Europe/Paris')::date AS d, 'Payées' AS motif, -delta AS n
  FROM credit_ledger
  WHERE reason = 'review' AND at >= now() - ({{days}} || ' days')::interval
    AND user_id NOT IN {{snippet: internal_users}}
  UNION ALL
  SELECT (at AT TIME ZONE 'Europe/Paris')::date, 'En attente (solde vide)', cards
  FROM credit_stops
  WHERE at >= now() - ({{days}} || ' days')::interval
    AND user_id NOT IN {{snippet: internal_users}}
) x
GROUP BY 1, 2 ORDER BY 1;

-- ==== question
-- title: Crédits — apprenants arrêtés par un solde vide
-- display: table
-- size: 12x6
-- description: Sur la période, par apprenant ayant dépensé un crédit ou butté sur un solde vide : la dépense moyenne, et la part de ceux qu'un solde vide a arrêtés au moins une fois (credit_stops). Cette part est le chiffre à surveiller en réglant l'allocation gratuite.
WITH p AS (
  SELECT user_id, sum(-delta) AS payees FROM credit_ledger
  WHERE reason = 'review' AND at >= now() - ({{days}} || ' days')::interval
    AND user_id NOT IN {{snippet: internal_users}}
  GROUP BY 1
), s AS (
  SELECT user_id, sum(cards) AS attente FROM credit_stops
  WHERE at >= now() - ({{days}} || ' days')::interval
    AND user_id NOT IN {{snippet: internal_users}}
  GROUP BY 1
)
SELECT count(*) AS "Apprenants", round(avg(coalesce(p.payees, 0)), 1) AS "Crédits dépensés (moyenne par apprenant)",
       count(*) FILTER (WHERE s.attente > 0) AS "Apprenants arrêtés",
       round(100.0 * count(*) FILTER (WHERE s.attente > 0) / nullif(count(*), 0), 1) AS "% arrêtés",
       coalesce(sum(s.attente), 0) AS "Révisions en attente"
FROM p FULL JOIN s USING (user_id);
