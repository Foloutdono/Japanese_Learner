-- dashboard: Tsuji — 足跡 · Vue d'ensemble
-- description: Qui est là, combien de temps, combien de visites. Plan 215. Période réglable (jours).

-- ==== question
-- title: Actifs aujourd'hui
-- display: scalar
-- size: 6x3
SELECT count(DISTINCT user_id) AS "Actifs aujourd'hui"
FROM event_log
WHERE name <> 'api_error'
  AND (at AT TIME ZONE 'Europe/Paris')::date = (now() AT TIME ZONE 'Europe/Paris')::date
  AND user_id NOT IN {{snippet: internal_users}};

-- ==== question
-- title: Actifs sur 7 jours
-- display: scalar
-- size: 6x3
SELECT count(DISTINCT user_id) AS "Actifs 7 j"
FROM event_log
WHERE name <> 'api_error'
  AND at >= now() - interval '7 days'
  AND user_id NOT IN {{snippet: internal_users}};

-- ==== question
-- title: Actifs sur 30 jours
-- display: scalar
-- size: 6x3
SELECT count(DISTINCT user_id) AS "Actifs 30 j"
FROM (
  SELECT user_id FROM event_log
   WHERE name <> 'api_error' AND at >= now() - interval '30 days'
  UNION
  SELECT user_id FROM event_daily
   WHERE name <> 'api_error' AND day >= current_date - 30
) a
WHERE user_id NOT IN {{snippet: internal_users}};

-- ==== question
-- title: Nouveaux apprenants (période)
-- display: scalar
-- size: 6x3
-- description: Premier événement de l'apprenant dans la période choisie.
WITH active AS (
  SELECT user_id, (at AT TIME ZONE 'Europe/Paris')::date AS day FROM event_log WHERE name <> 'api_error'
  UNION ALL
  SELECT user_id, day FROM event_daily WHERE name <> 'api_error'
)
SELECT count(*) AS "Nouveaux"
FROM (SELECT user_id, min(day) AS first_day FROM active GROUP BY user_id) f
WHERE first_day >= current_date - {{days}}
  AND user_id NOT IN {{snippet: internal_users}};

-- ==== question
-- title: Actifs et nouveaux par jour
-- display: line
-- size: 12x6
WITH active AS (
  SELECT DISTINCT user_id, (at AT TIME ZONE 'Europe/Paris')::date AS day FROM event_log WHERE name <> 'api_error'
  UNION
  SELECT user_id, day FROM event_daily WHERE name <> 'api_error'
), firsts AS (
  SELECT user_id, min(day) AS first_day FROM active GROUP BY user_id
)
SELECT a.day AS "Jour",
       count(DISTINCT a.user_id) AS "Actifs",
       count(DISTINCT a.user_id) FILTER (WHERE f.first_day = a.day) AS "Nouveaux"
FROM active a JOIN firsts f USING (user_id)
WHERE a.day >= current_date - {{days}}
  AND a.user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 1;

-- ==== question
-- title: Visites par jour
-- display: bar
-- size: 12x6
-- description: Une visite = un session_start (30 min sans événement la clôt). Les comptes au-delà de 30 jours viennent de event_daily.
SELECT day AS "Jour", sum(n) AS "Visites", count(DISTINCT user_id) AS "Apprenants"
FROM (
  SELECT user_id, (at AT TIME ZONE 'Europe/Paris')::date AS day, 1 AS n FROM event_log WHERE name = 'session_start'
  UNION ALL
  SELECT user_id, day, n FROM event_daily WHERE name = 'session_start'
) v
WHERE day >= current_date - {{days}}
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 1;

-- ==== question
-- title: Durée médiane d'une visite (min)
-- display: scalar
-- size: 6x3
-- description: Somme du temps engagé (screen_leave) par visite. Depuis le plan 215.
WITH visits AS (
  SELECT sid, sum((props->>'ms')::numeric) AS ms
  FROM event_log
  WHERE name = 'screen_leave' AND sid IS NOT NULL
    AND at >= now() - ({{days}} || ' days')::interval
    AND user_id NOT IN {{snippet: internal_users}}
  GROUP BY sid
)
SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY ms) / 60000)::numeric, 1) AS "Minutes" FROM visits;

-- ==== question
-- title: Temps engagé par apprenant et par jour (min, médiane)
-- display: scalar
-- size: 6x3
WITH per_day AS (
  SELECT user_id, (at AT TIME ZONE 'Europe/Paris')::date AS day, sum((props->>'ms')::numeric) AS ms
  FROM event_log
  WHERE name = 'screen_leave'
    AND at >= now() - ({{days}} || ' days')::interval
    AND user_id NOT IN {{snippet: internal_users}}
  GROUP BY 1, 2
)
SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY ms) / 60000)::numeric, 1) AS "Minutes" FROM per_day;

-- ==== question
-- title: Fidélité (actifs du jour / actifs du mois)
-- display: scalar
-- size: 6x3
-- description: Moyenne des actifs quotidiens sur 30 jours, divisée par les actifs sur 30 jours.
WITH daily AS (
  SELECT (at AT TIME ZONE 'Europe/Paris')::date AS day, count(DISTINCT user_id) AS dau
  FROM event_log
  WHERE name <> 'api_error' AND at >= now() - interval '30 days'
    AND user_id NOT IN {{snippet: internal_users}}
  GROUP BY 1
), mau AS (
  SELECT count(DISTINCT user_id) AS n FROM event_log
  WHERE name <> 'api_error' AND at >= now() - interval '30 days'
    AND user_id NOT IN {{snippet: internal_users}}
)
SELECT round(100.0 * (SELECT avg(dau) FROM daily) / nullif((SELECT n FROM mau), 0), 1) AS "% DAU/MAU";

-- ==== question
-- title: Révisions de cartes par jour
-- display: bar
-- size: 12x6
SELECT (reviewed_at AT TIME ZONE 'Europe/Paris')::date AS "Jour",
       count(*) AS "Révisions",
       count(DISTINCT split_part(card_id, ':', 1)) AS "Apprenants"
FROM review_log
WHERE reviewed_at >= now() - ({{days}} || ' days')::interval
  AND split_part(card_id, ':', 1) NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 1;

-- ==== question
-- title: Événements reçus par nom
-- display: table
-- size: 12x8
SELECT name AS "Événement", count(*) AS "Lignes", count(DISTINCT user_id) AS "Apprenants",
       max(at) AS "Dernier"
FROM event_log
WHERE at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;
