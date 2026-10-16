-- dashboard: Tsuji — 足跡 · Appareils
-- description: Sur quoi l'on étudie : classe d'écran, système, web / PWA / natif, tactile, langue, thème. Des classes grossières (lib/visitContext.js), jamais une empreinte. Contexte des visites depuis le plan 218.

-- ==== question
-- title: Visites par classe d'écran
-- display: pie
-- size: 8x7
SELECT props->>'vp' AS "Écran", count(*) AS "Visites"
FROM event_log
WHERE name = 'session_start' AND props ? 'vp' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Visites par système
-- display: pie
-- size: 8x7
SELECT props->>'os' AS "Système", count(*) AS "Visites"
FROM event_log
WHERE name = 'session_start' AND props ? 'os' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Web, appli installée (PWA) ou native
-- display: pie
-- size: 8x7
SELECT CASE WHEN props->>'platform' = 'native' THEN 'native'
            WHEN (props->>'standalone')::boolean THEN 'PWA installée'
            ELSE 'navigateur' END AS "Forme", count(*) AS "Visites"
FROM event_log
WHERE name = 'session_start' AND props ? 'platform' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Tactile ou souris
-- display: pie
-- size: 6x6
SELECT props->>'input' AS "Pointeur", count(*) AS "Visites"
FROM event_log
WHERE name = 'session_start' AND props ? 'input' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Langue de l'interface
-- display: pie
-- size: 6x6
SELECT props->>'lang' AS "Langue", count(DISTINCT user_id) AS "Apprenants"
FROM event_log
WHERE name = 'session_start' AND props ? 'lang' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Thème
-- display: pie
-- size: 6x6
SELECT props->>'theme' AS "Thème", count(DISTINCT user_id) AS "Apprenants"
FROM event_log
WHERE name = 'session_start' AND props ? 'theme' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Mouvement réduit demandé (% des visites)
-- display: scalar
-- size: 6x6
SELECT round(100.0 * count(*) FILTER (WHERE (props->>'reduced')::boolean) / nullif(count(*), 0), 1) AS "%"
FROM event_log
WHERE name = 'session_start' AND props ? 'reduced' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}};

-- ==== question
-- title: Temps engagé par classe d'écran
-- display: table
-- size: 12x6
WITH ctx AS (
  SELECT sid, props->>'vp' AS vp FROM event_log
  WHERE name = 'session_start' AND props ? 'vp' AND sid IS NOT NULL
    AND at >= now() - ({{days}} || ' days')::interval
), visits AS (
  SELECT sid, sum((props->>'ms')::numeric) AS ms FROM event_log
  WHERE name = 'screen_leave' AND at >= now() - ({{days}} || ' days')::interval
    AND user_id NOT IN {{snippet: internal_users}}
  GROUP BY sid
)
SELECT c.vp AS "Écran", count(*) AS "Visites",
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY v.ms) / 60000)::numeric, 1) AS "Médiane (min)",
       round(sum(v.ms) / 3600000, 1) AS "Heures"
FROM ctx c JOIN visits v USING (sid)
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Démarrage par plateforme
-- display: table
-- size: 12x6
-- description: app_open.boot_ms : l'attente de GET /api/profile au démarrage (un réveil Render la rend « froide »).
SELECT coalesce(props->>'platform', '?') AS "Plateforme",
       CASE WHEN (props->>'standalone')::boolean THEN 'installée' ELSE 'navigateur' END AS "Forme",
       count(*) AS "Démarrages",
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'boot_ms')::numeric))::numeric, 0) AS "Médiane (ms)",
       round((percentile_cont(0.9) WITHIN GROUP (ORDER BY (props->>'boot_ms')::numeric))::numeric, 0) AS "P90 (ms)",
       round(100.0 * count(*) FILTER (WHERE (props->>'cold')::boolean) / count(*), 0) AS "% à froid"
FROM event_log
WHERE name = 'app_open' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2 ORDER BY 3 DESC;
