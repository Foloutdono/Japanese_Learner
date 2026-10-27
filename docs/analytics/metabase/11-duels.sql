-- dashboard: Tsuji — 足跡 · Duels
-- description: Les duels entre apprenants (plan 279) : des sprints de 60 s, entre amis (gratuits, sans Elo) ou classés (2 crédits, l'Elo). Lancés et terminés, contre qui, combien de temps un défi attend, les corrections achetées, les crédits dépensés, l'Elo, les amitiés et les signalements, comptés par raison seulement : qui a signalé qui se lit avec backend/scripts/read_reports.py, jamais ici.

-- ==== question
-- title: Sprints lancés par semaine
-- display: bar
-- size: 12x6
-- viz: {"stackable.stack_type": "stacked"}
-- dims: 2
-- description: pvp_duel_start, un par joueur et par course. friend : un ami ; seek : la course d'un autre apprenant restée sans adversaire ; ghost : l'enregistrement d'un joueur d'Elo proche ; open : une liste neuve qui attend un adversaire 48 h.
SELECT date_trunc('week', at AT TIME ZONE 'Europe/Paris')::date AS "Semaine", props->>'against' AS "Contre",
       count(*) AS "Sprints"
FROM event_log
WHERE name = 'pvp_duel_start' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2 ORDER BY 1;

-- ==== question
-- title: Apprenants qui ont joué
-- display: scalar
-- size: 6x6
SELECT count(DISTINCT user_id) AS "Apprenants"
FROM event_log
WHERE name = 'pvp_duel_start' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}};

-- ==== question
-- title: Amical ou classé
-- display: pie
-- size: 6x6
SELECT props->>'kind' AS "Sorte", count(*) AS "Sprints"
FROM event_log
WHERE name = 'pvp_duel_start' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Comment les duels finissent
-- display: bar
-- size: 12x6
-- viz: {"stackable.stack_type": "stacked"}
-- dims: 2
-- description: pvp_duel_done. win, loss, draw : un par joueur ; expired (personne n'a joué dans les 48 h, ou n'est entré dans la salle en 2 min) et declined (l'ami a refusé) : un par défi, du côté de qui l'a lancé.
SELECT props->>'kind' AS "Sorte", props->>'outcome' AS "Issue", count(*) AS "Duels"
FROM event_log
WHERE name = 'pvp_duel_done' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2 ORDER BY 1, 3 DESC;

-- ==== question
-- title: Ce qu'attend un défi
-- display: table
-- size: 12x6
-- description: Les heures entre la création d'un duel en différé et son issue (wait_h), en médiane et au 9e décile. Un défi qui attend trop finit expiré.
SELECT props->>'kind' AS "Sorte", props->>'outcome' AS "Issue", count(*) AS "Duels",
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'wait_h')::numeric)::numeric, 1) AS "Médiane (h)",
       round(percentile_cont(0.9) WITHIN GROUP (ORDER BY (props->>'wait_h')::numeric)::numeric, 1) AS "9e décile (h)"
FROM event_log
WHERE name = 'pvp_duel_done' AND props->>'mode' = 'async' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2 ORDER BY 1, 3 DESC;

-- ==== question
-- title: Bonnes réponses par sprint
-- display: bar
-- size: 12x6
-- description: Les justes d'une course terminée (win, loss, draw), par tranche de cinq. Trop de sprints à zéro dirait un barème qui décourage ; trop au plafond, des questions trop faciles.
SELECT (((props->>'rights')::int / 5) * 5)::text || '–' || (((props->>'rights')::int / 5) * 5 + 4)::text AS "Justes",
       count(*) AS "Sprints"
FROM event_log
WHERE name = 'pvp_duel_done' AND props->>'outcome' IN ('win', 'loss', 'draw')
  AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY ((props->>'rights')::int / 5) ORDER BY ((props->>'rights')::int / 5);

-- ==== question
-- title: Corrections achetées
-- display: table
-- size: 12x6
-- description: pvp_review (1 crédit, une fois par duel et par joueur) face aux courses terminées.
SELECT d.kind AS "Sorte", d.played AS "Courses terminées", coalesce(r.bought, 0) AS "Corrections achetées",
       round(100.0 * coalesce(r.bought, 0) / nullif(d.played, 0), 1) AS "%"
FROM (SELECT props->>'kind' AS kind, count(*) AS played FROM event_log
       WHERE name = 'pvp_duel_done' AND props->>'outcome' IN ('win', 'loss', 'draw')
         AND at >= now() - ({{days}} || ' days')::interval AND user_id NOT IN {{snippet: internal_users}}
       GROUP BY 1) d
LEFT JOIN (SELECT props->>'kind' AS kind, count(*) AS bought FROM event_log
            WHERE name = 'pvp_review' AND at >= now() - ({{days}} || ' days')::interval
              AND user_id NOT IN {{snippet: internal_users}}
            GROUP BY 1) r USING (kind)
ORDER BY 2 DESC;

-- ==== question
-- title: Crédits des duels par semaine
-- display: bar
-- size: 12x6
-- dims: 2
-- description: credit_ledger, motifs duel (2 au départ d'un classé, rendus quand la liste expire sans adversaire : la ligne positive) et duel_review (1 la correction). Un abonné ne laisse aucune ligne. Les débits refusés en mode fantôme sont dans « Débits refusés ».
SELECT date_trunc('week', at AT TIME ZONE 'Europe/Paris')::date AS "Semaine", reason AS "Motif",
       -sum(delta) AS "Crédits nets"
FROM credit_ledger
WHERE reason IN ('duel', 'duel_review') AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1, 2 ORDER BY 1;

-- ==== question
-- title: Débits refusés
-- display: table
-- size: 12x6
-- description: fare_blocked des duels : en mode fantôme (CREDITS_ENFORCE éteint), un départ classé ou une correction que le solde ne couvrait pas, joué quand même.
SELECT props->>'kind' AS "Motif", count(*) AS "Refus", count(DISTINCT user_id) AS "Apprenants"
FROM event_log
WHERE name = 'fare_blocked' AND props->>'kind' IN ('duel', 'duel_review')
  AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Répartition de l'Elo
-- display: bar
-- size: 12x6
-- description: pvp_ratings, les apprenants qui ont joué au moins un duel classé, par tranche de 100. Le départ vient du test de placement : N5 1000, N4 1200, N3 1400, N2 1600, N1 1800.
SELECT (floor(rating / 100) * 100)::int AS "Elo", count(*) AS "Apprenants"
FROM pvp_ratings
WHERE games > 0 AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 1;

-- ==== question
-- title: Placements notés
-- display: pie
-- size: 6x6
-- description: pvp_placed : le verdict du test de placement, noté comme Elo de départ tant qu'aucun duel classé n'a été joué.
SELECT props->>'level' AS "Niveau", count(*) AS "Placements"
FROM event_log
WHERE name = 'pvp_placed' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 1;

-- ==== question
-- title: K gardé haut (smurfs)
-- display: scalar
-- size: 6x6
-- description: pvp_smurf : un duel classé où la performance des 10 derniers dépassait l'Elo de 300 avec plus de 80 % de victoires, K restant à 40.
SELECT count(DISTINCT user_id) AS "Apprenants"
FROM event_log
WHERE name = 'pvp_smurf' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}};

-- ==== question
-- title: Amitiés
-- display: bar
-- size: 12x6
-- description: pvp_friend : les demandes, ce qu'elles deviennent, et les blocages.
SELECT props->>'action' AS "Geste", count(*) AS "Fois", count(DISTINCT user_id) AS "Apprenants"
FROM event_log
WHERE name = 'pvp_friend' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;

-- ==== question
-- title: Signalements par raison
-- display: pie
-- size: 12x6
-- description: pvp_report : name (pseudo), cheat (triche), spam, other. Compté seulement : la file se lit avec read_reports.
SELECT props->>'reason' AS "Raison", count(*) AS "Signalements"
FROM event_log
WHERE name = 'pvp_report' AND at >= now() - ({{days}} || ' days')::interval
  AND user_id NOT IN {{snippet: internal_users}}
GROUP BY 1 ORDER BY 2 DESC;
