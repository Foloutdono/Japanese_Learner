-- dashboard: Tsuji — 足跡 · Fiabilité
-- description: Ce qui casse ou traîne : requêtes en échec, démarrages ratés, erreurs côté client (jamais leur texte), vitesse des pages. Erreurs client et vitesse depuis le plan 218.

-- ==== question
-- title: Requêtes en échec par jour
-- display: bar
-- size: 12x6
-- viz: {"stackable.stack_type": "stacked"}
-- dims: 2
-- description: api_error : un 5xx ou aucune réponse (statut 0), dédoublonné par zone et statut à la minute.
SELECT (at AT TIME ZONE 'Europe/Paris')::date AS "Jour", props->>'path' || ' ' || coalesce(props->>'status', '?') AS "Zone et statut",
       count(*) AS "Échecs"
FROM event_log
WHERE name = 'api_error' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2 ORDER BY 1;

-- ==== question
-- title: Requêtes en échec par zone
-- display: table
-- size: 12x6
SELECT props->>'path' AS "Zone", coalesce(props->>'status', '?') AS "Statut",
       count(*) AS "Échecs", count(DISTINCT user_id) AS "Apprenants", max(at) AS "Dernier"
FROM event_log
WHERE name = 'api_error' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2 ORDER BY 3 DESC;

-- ==== question
-- title: Démarrages réussis et ratés par jour
-- display: line
-- size: 12x6
-- description: Un raté se dit par sa cause : le délai de 45 s dépassé, une réponse en erreur, ou aucune réponse (réseau coupé). « Avant la cause » : les ratés enregistrés avant que la cause le soit.
SELECT (at AT TIME ZONE 'Europe/Paris')::date AS "Jour",
       count(*) FILTER (WHERE name = 'app_open') AS "Démarrages",
       count(*) FILTER (WHERE name = 'boot_timeout' AND props->>'reason' = 'timeout') AS "Délai dépassé (45 s)",
       count(*) FILTER (WHERE name = 'boot_timeout' AND props->>'reason' = 'server') AS "Réponse en erreur",
       count(*) FILTER (WHERE name = 'boot_timeout' AND props->>'reason' = 'network') AS "Aucune réponse",
       count(*) FILTER (WHERE name = 'boot_timeout' AND props->>'reason' IS NULL) AS "Avant la cause",
       count(*) FILTER (WHERE name = 'app_open' AND (props->>'cold')::boolean) AS "À froid"
FROM event_log
WHERE name IN ('app_open', 'boot_timeout') AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 1;

-- ==== question
-- title: Erreurs côté client par écran
-- display: table
-- size: 12x6
-- description: La classe de l'erreur (TypeError…), jamais son message. « — » : les erreurs enregistrées avant la classe.
SELECT props->>'route' AS "Écran", props->>'step' AS "Étape", props->>'where' AS "Nature",
       coalesce(props->>'kind', '—') AS "Classe",
       count(*) AS "Fois", count(DISTINCT user_id) AS "Apprenants", max(at) AS "Dernière"
FROM event_log
WHERE name = 'client_error' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2, 3, 4 ORDER BY 5 DESC;

-- ==== question
-- title: Vitesse des pages (P75)
-- display: table
-- size: 24x7
-- description: Une mesure par chargement de page, sur l'écran où il a eu lieu. Repères : LCP < 2 500 ms, INP < 200 ms, CLS < 100 (×1000), TTFB < 800 ms. Un écran n'apparaît qu'à partir de 20 chargements : en dessous, le P75 ne dit rien. Le LCP n'est compté que pour une page vue dès son chargement (les onglets restaurés n'en ont pas).
SELECT props->>'route' AS "Écran", count(*) AS "Chargements",
       round((percentile_cont(0.75) WITHIN GROUP (ORDER BY (props->>'lcp')::numeric))::numeric, 0) AS "LCP (ms)",
       round((percentile_cont(0.75) WITHIN GROUP (ORDER BY (props->>'inp')::numeric))::numeric, 0) AS "INP (ms)",
       round((percentile_cont(0.75) WITHIN GROUP (ORDER BY (props->>'cls')::numeric))::numeric, 0) AS "CLS (×1000)",
       round((percentile_cont(0.75) WITHIN GROUP (ORDER BY (props->>'ttfb')::numeric))::numeric, 0) AS "TTFB (ms)"
FROM event_log
WHERE name = 'vitals' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 HAVING count(*) >= 20 ORDER BY 2 DESC;
