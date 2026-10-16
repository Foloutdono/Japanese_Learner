-- dashboard: Tsuji — 足跡 · Messages
-- description: Ce que les apprenants nous écrivent (plan 221), compté et jamais lu ici : les mots se lisent avec backend/scripts/read_feedback.py. Par sorte, ceux qui attendent une réponse, les cartes les plus signalées.

-- ==== question
-- title: Messages par semaine
-- display: bar
-- size: 12x6
-- viz: {"stackable.stack_type": "stacked"}
-- dims: 2
-- description: problem, idea, fault (Nous écrire) et card (le drapeau d’une carte répondue).
SELECT date_trunc('week', created_at AT TIME ZONE 'Europe/Paris')::date AS "Semaine", kind AS "Sorte",
       count(*) AS "Messages"
FROM feedback
WHERE created_at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2 ORDER BY 1;

-- ==== question
-- title: Réponses demandées
-- display: scalar
-- size: 6x6
-- description: Les messages dont l’auteur a coché « Me répondre ». L’adresse se lit avec read_feedback --reply.
SELECT count(*) AS "À répondre"
FROM feedback
WHERE reply AND created_at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}};

-- ==== question
-- title: Messages par sorte
-- display: pie
-- size: 6x6
SELECT kind AS "Sorte", count(*) AS "Messages"
FROM feedback
WHERE created_at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Cartes les plus signalées
-- display: table
-- size: 24x8
-- description: Une carte par ligne, ce qui ne va pas d’après ceux qui l’ont signalée. L’id est la clé du contenu (le même que l’audit lit).
SELECT f.card_id AS "Carte", count(DISTINCT f.id) AS "Signalements", count(DISTINCT f.user_id) AS "Apprenants",
       string_agg(DISTINCT r, ', ') AS "Ce qui ne va pas", max(f.created_at) AS "Dernier"
FROM feedback f
LEFT JOIN LATERAL unnest(f.reasons) AS r ON TRUE
WHERE f.kind = 'card' AND f.created_at >= now() - ({{days}} || ' days')::interval
  AND f.user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 3 DESC, 2 DESC
LIMIT 50;
