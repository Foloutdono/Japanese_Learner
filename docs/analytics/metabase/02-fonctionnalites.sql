-- dashboard: Tsuji — 足跡 · Fonctionnalités
-- description: Ce qui est utilisé, par combien d'apprenants, et ce qui ne l'est jamais. Plan 218.

-- ==== question
-- title: Écrans : vues, apprenants, temps
-- display: table
-- size: 14x10
-- description: Vues = arrivées (screen_view). Temps = temps engagé (screen_leave), onglet caché exclu.
WITH actifs AS (
  SELECT count(DISTINCT user_id) AS n FROM event_log
  WHERE name <> 'api_error' AND at >= now() - ({{days}} || ' days')::interval
    AND user_id NOT IN {{snippet: internal_users}}
), vues AS (
  SELECT props->>'route' AS route, count(*) AS vues, count(DISTINCT user_id) AS apprenants
  FROM event_log
  WHERE name = 'screen_view' AND at >= now() - ({{days}} || ' days')::interval
    AND user_id NOT IN {{snippet: internal_users}}
  GROUP BY 1
), temps AS (
  SELECT props->>'route' AS route,
         sum((props->>'ms')::numeric) AS ms,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'ms')::numeric) AS med
  FROM event_log
  WHERE name = 'screen_leave' AND at >= now() - ({{days}} || ' days')::interval
    AND user_id NOT IN {{snippet: internal_users}}
  GROUP BY 1
)
SELECT v.route AS "Écran", v.vues AS "Vues", v.apprenants AS "Apprenants",
       round(100.0 * v.apprenants / nullif((SELECT n FROM actifs), 0), 1) AS "% des actifs",
       round(coalesce(t.ms, 0) / 60000, 1) AS "Minutes au total",
       round((t.med / 1000)::numeric, 1) AS "Séjour médian (s)"
FROM vues v LEFT JOIN temps t USING (route)
ORDER BY v.apprenants DESC, v.vues DESC;

-- ==== question
-- title: Écrans jamais ou presque jamais ouverts
-- display: table
-- size: 10x10
-- description: Toutes les routes d'App.jsx (lib/routePattern.js ROUTES ; un test garde la liste égale). Triées des moins vues aux plus vues.
WITH routes(route) AS (VALUES
    ('/'),
    ('/app'),
    ('/today'),
    ('/today/run'),
    ('/today/clear'),
    ('/ride'),
    ('/ride/intro'),
    ('/ride/cards'),
    ('/ride/reading'),
    ('/learn'),
    ('/learn/kana'),
    ('/learn/kana/:set'),
    ('/learn/kana/:set/:mode'),
    ('/learn/vocab'),
    ('/learn/vocab/levels'),
    ('/learn/vocab/tiers'),
    ('/learn/vocab/themes'),
    ('/learn/vocab/:level'),
    ('/learn/vocab/:level/:mode'),
    ('/learn/vocab/tier/:tier'),
    ('/learn/vocab/tier/:tier/:mode'),
    ('/learn/vocab/theme/:theme'),
    ('/learn/vocab/theme/:theme/:mode'),
    ('/learn/vocab/theme/:theme/level/:themeLevel'),
    ('/learn/vocab/theme/:theme/level/:themeLevel/:mode'),
    ('/learn/kanji'),
    ('/learn/kanji/levels'),
    ('/learn/kanji/tiers'),
    ('/learn/kanji/:level'),
    ('/learn/kanji/:level/:mode'),
    ('/learn/kanji/tier/:tier'),
    ('/learn/kanji/tier/:tier/:mode'),
    ('/learn/kanji/radicals'),
    ('/learn/kanji/radical/:radical'),
    ('/learn/basics'),
    ('/learn/basics/:unit'),
    ('/learn/kanji/radical/:radical/:mode'),
    ('/learn/grammar'),
    ('/learn/grammar/:level'),
    ('/learn/grammar/:level/:mode'),
    ('/learn/decks'),
    ('/learn/decks/library'),
    ('/learn/decks/library/:deck_id'),
    ('/learn/decks/:deck_id'),
    ('/learn/decks/:deck_id/study'),
    ('/learn/decks/:deck_id/study/:mode'),
    ('/practice'),
    ('/practice/exam'),
    ('/practice/exam/:examId'),
    ('/practice/exam/:examId/results'),
    ('/practice/reading'),
    ('/practice/reading/levels'),
    ('/practice/reading/tiers'),
    ('/practice/reading/cards'),
    ('/practice/reading/level/:level'),
    ('/practice/reading/tier/:tier'),
    ('/practice/reading/mastery'),
    ('/practice/translation'),
    ('/practice/translation/levels'),
    ('/practice/translation/tiers'),
    ('/practice/translation/cards'),
    ('/practice/translation/level/:level'),
    ('/practice/translation/tier/:tier'),
    ('/practice/translation/mastery'),
    ('/practice/comprehension'),
    ('/practice/comprehension/:level'),
    ('/practice/dictation'),
    ('/practice/dictation/:level'),
    ('/practice/composition'),
    ('/practice/composition/:level'),
    ('/practice/conversation'),
    ('/practice/conversation/:scenario/:mode'),
    ('/dictionary'),
    ('/dictionary/analyzer'),
    ('/profile'),
    ('/profile/stats'),
    ('/profile/tickets'),
    ('/profile/settings'),
    ('/profile/settings/:page')
), vues AS (
  SELECT props->>'route' AS route, count(*) AS vues, count(DISTINCT user_id) AS apprenants
  FROM event_log
  WHERE name = 'screen_view' AND at >= now() - ({{days}} || ' days')::interval
    AND user_id NOT IN {{snippet: internal_users}}
  GROUP BY 1
)
SELECT r.route AS "Écran", coalesce(v.apprenants, 0) AS "Apprenants", coalesce(v.vues, 0) AS "Vues"
FROM routes r LEFT JOIN vues v USING (route)
ORDER BY 2, 3, 1;

-- ==== question
-- title: Part des apprenants actifs par onglet
-- display: bar
-- size: 12x6
WITH actifs AS (
  SELECT count(DISTINCT user_id) AS n FROM event_log
  WHERE name <> 'api_error' AND at >= now() - ({{days}} || ' days')::interval
    AND user_id NOT IN {{snippet: internal_users}}
)
SELECT coalesce(props->>'tab', '(hors onglet)') AS "Onglet",
       round(100.0 * count(DISTINCT user_id) / nullif((SELECT n FROM actifs), 0), 1) AS "% des actifs"
FROM event_log
WHERE name = 'screen_view' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Fonctions : utilisations et apprenants
-- display: table
-- size: 12x7
-- description: feature_use, compté par écran puis envoyé en le quittant (n = nombre d'utilisations). Depuis le plan 218.
SELECT props->>'feature' AS "Fonction", props->>'action' AS "Geste",
       sum((props->>'n')::int) AS "Utilisations", count(DISTINCT user_id) AS "Apprenants"
FROM event_log
WHERE name = 'feature_use' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2 ORDER BY 4 DESC, 3 DESC;

-- ==== question
-- title: Fonctions jamais utilisées sur la période
-- display: table
-- size: 12x7
WITH gestes(feature, action) AS (VALUES
  ('speech', 'play'), ('analyzer', 'text'), ('analyzer', 'photo'), ('analyzer', 'video'),
  ('ocr', 'scan'), ('ask', 'send'), ('explain', 'open'), ('dictionary', 'search'), ('export', 'progress'),
  ('level_fit', 'open'), ('level_fit', 'move'), ('level_fit', 'stay')
), used AS (
  SELECT props->>'feature' AS feature, props->>'action' AS action,
         count(DISTINCT user_id) AS apprenants, sum((props->>'n')::int) AS n
  FROM event_log
  WHERE name = 'feature_use' AND at >= now() - ({{days}} || ' days')::interval
    AND user_id NOT IN {{snippet: internal_users}}
  GROUP BY 1, 2
)
SELECT g.feature AS "Fonction", g.action AS "Geste",
       coalesce(u.apprenants, 0) AS "Apprenants", coalesce(u.n, 0) AS "Utilisations"
FROM gestes g LEFT JOIN used u USING (feature, action)
ORDER BY 3, 4;

-- ==== question
-- title: Séances démarrées par type
-- display: bar
-- size: 12x6
SELECT coalesce(props->>'kind', '?') AS "Type", count(*) AS "Séances", count(DISTINCT user_id) AS "Apprenants"
FROM event_log
WHERE name = 'run_start' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Modes d'étude choisis
-- display: table
-- size: 12x7
SELECT props->>'kind' AS "Type", coalesce(props->>'mode', '—') AS "Mode",
       count(*) AS "Séances", count(DISTINCT user_id) AS "Apprenants"
FROM event_log
WHERE name = 'run_start' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2 ORDER BY 3 DESC;

-- ==== question
-- title: Réglages changés
-- display: table
-- size: 12x7
SELECT props->>'setting' AS "Réglage", coalesce(props->>'value', '—') AS "Valeur",
       count(*) AS "Changements", count(DISTINCT user_id) AS "Apprenants"
FROM event_log
WHERE name = 'setting_change' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2 ORDER BY 1, 3 DESC;

-- ==== question
-- title: Autres gestes (bibliothèque, favoris, partage, rappels…)
-- display: table
-- size: 12x7
SELECT name AS "Événement", count(*) AS "Fois", count(DISTINCT user_id) AS "Apprenants"
FROM event_log
WHERE name IN ('favorite_toggle', 'deck_publish', 'deck_unpublish', 'deck_subscribe', 'deck_detach',
               'library_view', 'ticket_share', 'nudge_opened', 'install_prompt',
               'grammar_tour_done', 'basics_unit_done', 'basics_skipped', 'day_clear', 'rest_day_used')
  AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 3 DESC, 2 DESC;
