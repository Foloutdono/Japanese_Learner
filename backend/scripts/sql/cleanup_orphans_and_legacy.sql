-- ═══════════════════════════════════════════════════════════════
--  One-time cleanup, for the Supabase SQL Editor
--
--  Dashboard -> SQL Editor -> New query -> paste -> Run.
--
--  Does two things:
--    A. erases every learner whose Supabase auth user is gone
--    B. drops the five tables the retired gamification features left
--
--  Run PART 1 on its own first and READ WHAT IT PRINTS. Only then run
--  PART 2, which is the part that deletes. They are separate on
--  purpose: part 1 cannot change anything, so there is no cost to
--  looking.
--
--  -- Why this file exists at all -------------------------------
--  backend/scripts/purge_orphans.py is the maintained version of A and
--  the one to use from now on. It has to ask Supabase's admin API who
--  still exists, because the app's database role is not assumed to be
--  able to read the `auth` schema (see the note on user_profiles in
--  srs/data_structure.sql). The SQL Editor runs as `postgres`, which
--  CAN read it -- so here the same question is a plain join, and there
--  is nothing to install and no credential to copy anywhere.
--
--  This is a one-shot, so the duplication cannot rot: run it once and
--  the scripts take over.
--
--  -- Safety ---------------------------------------------------
--  * Part 2 is one transaction. It commits completely or not at all.
--  * Deletion order is children-before-parents, mirroring
--    routes/account.py's PLAN exactly, so the foreign keys hold at
--    every step.
--  * Tables that do not exist yet are SKIPPED, not errors -- three of
--    the tables in PLAN (review_daily, card_first_review,
--    review_compaction) are created by the backend on its next start,
--    so this file works whether you run it before or after that deploy.
--  * The KEEP list at the top of part 2 spares any id you name.
--
--  ⚠ IF auth.users IS EMPTY, EVERY LEARNER IS AN ORPHAN and part 2
--    erases all of them. That is the expected case here -- the users
--    were deleted from the dashboard, which is what left the rows
--    behind -- but it is worth seeing part 1 confirm it rather than
--    taking this comment's word for it.
-- ═══════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────
--  PART 1 — REPORT. Changes nothing. Run this first.
-- ───────────────────────────────────────────────────────────────

WITH app_users AS (
    -- Every user id that still has a row anywhere. The card tables have
    -- no user_id column at all: a row is a learner's because its card id
    -- starts with "<user_id>:" (core/auth.py's prefixed()), so the id has
    -- to be split back out of it.
    SELECT split_part(card_id, ':', 1) AS uid FROM review_log
    UNION SELECT split_part(card_id, ':', 1) FROM card_modes
    UNION SELECT split_part(id,      ':', 1) FROM cards
    UNION SELECT user_id FROM user_profiles
    UNION SELECT user_id FROM xp_ledger
    UNION SELECT user_id FROM credit_ledger
    UNION SELECT user_id FROM decks
    UNION SELECT user_id FROM custom_cards
    UNION SELECT user_id FROM deck_cards
    UNION SELECT user_id FROM video_sessions
    UNION SELECT user_id FROM phrase_history
    UNION SELECT user_id FROM reading_log
    UNION SELECT user_id FROM comprehension_log
    UNION SELECT user_id FROM translation_log
    UNION SELECT user_id FROM exam_attempts
    UNION SELECT user_id FROM frequency_overrides
    UNION SELECT user_id FROM ocr_usage
),
orphans AS (
    SELECT a.uid
      FROM app_users a
      -- a.id::text, never a.uid::uuid: user_id is TEXT and may hold an
      -- id that is not a uuid at all (a DEV_USER_ID), which would make
      -- the cast throw instead of simply not matching.
     WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id::text = a.uid)
       AND a.uid <> ''
)
SELECT
    o.uid                                            AS orphaned_user_id,
    p.username,
    (SELECT COUNT(*) FROM review_log r
      WHERE r.card_id LIKE o.uid || ':%')            AS reviews,
    (SELECT COUNT(*) FROM card_modes c
      WHERE c.card_id LIKE o.uid || ':%')            AS cards_in_progress,
    (SELECT COUNT(*) FROM decks d  WHERE d.user_id = o.uid) AS decks,
    p.created_at
  FROM orphans o
  LEFT JOIN user_profiles p ON p.user_id = o.uid
 ORDER BY p.created_at NULLS LAST;

-- ...and the headline numbers, so an empty auth table is impossible to
-- miss. Run this alongside the above.
SELECT
    (SELECT COUNT(*) FROM auth.users)                AS auth_users_remaining,
    (SELECT COUNT(*) FROM user_profiles)             AS app_profiles,
    (SELECT COUNT(*) FROM review_log)                AS review_log_rows;


-- ───────────────────────────────────────────────────────────────
--  PART 2 — THE CLEANUP. This deletes. Run it after reading part 1.
-- ───────────────────────────────────────────────────────────────

BEGIN;

-- ── Edit this line to spare anyone ─────────────────────────────
-- Any id listed here is kept even though it has no auth user.
-- Leave it as the empty string to purge every orphan part 1 listed.
CREATE TEMP TABLE keep_ids (uid TEXT) ON COMMIT DROP;
INSERT INTO keep_ids (uid) VALUES ('');
-- e.g.  INSERT INTO keep_ids (uid) VALUES ('57a2cd3e-f61c-4d33-80c7-7c3e1f1b6448');

CREATE TEMP TABLE doomed (uid TEXT PRIMARY KEY) ON COMMIT DROP;

INSERT INTO doomed (uid)
SELECT DISTINCT a.uid FROM (
    SELECT split_part(card_id, ':', 1) AS uid FROM review_log
    UNION SELECT split_part(card_id, ':', 1) FROM card_modes
    UNION SELECT split_part(id,      ':', 1) FROM cards
    UNION SELECT user_id FROM user_profiles
    UNION SELECT user_id FROM xp_ledger
    UNION SELECT user_id FROM credit_ledger
    UNION SELECT user_id FROM decks
    UNION SELECT user_id FROM custom_cards
    UNION SELECT user_id FROM deck_cards
    UNION SELECT user_id FROM video_sessions
    UNION SELECT user_id FROM phrase_history
    UNION SELECT user_id FROM reading_log
    UNION SELECT user_id FROM comprehension_log
    UNION SELECT user_id FROM translation_log
    UNION SELECT user_id FROM exam_attempts
    UNION SELECT user_id FROM frequency_overrides
    UNION SELECT user_id FROM ocr_usage
) a
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id::text = a.uid)
  AND a.uid <> ''
  AND a.uid NOT IN (SELECT uid FROM keep_ids);

-- ── A. Erase them, in routes/account.py's PLAN order ───────────
DO $$
DECLARE
    step     RECORD;
    n        BIGINT;
    total    BIGINT := 0;
    -- (table, how a row is scoped to a learner). Children before
    -- parents: card_modes -> cards, custom_cards/deck_cards -> decks,
    -- video_session_jobs -> video_sessions. Identity last, so a run
    -- that somehow failed midway leaves an account that can still
    -- sign in.
    plan CONSTANT TEXT[][] := ARRAY[
        ['review_log',          'prefix',  'card_id'],
        ['review_daily',        'column',  'user_id'],
        ['card_first_review',   'prefix',  'card_id'],
        ['review_compaction',   'column',  'user_id'],
        ['card_modes',          'prefix',  'card_id'],
        ['cards',               'prefix',  'id'],
        ['xp_ledger',           'column',  'user_id'],
        ['custom_cards',        'column',  'user_id'],
        ['deck_cards',          'column',  'user_id'],
        ['decks',               'column',  'user_id'],
        ['video_session_jobs',  'session', 'session_id'],
        ['video_sessions',      'column',  'user_id'],
        ['phrase_history',      'column',  'user_id'],
        ['reading_log',         'column',  'user_id'],
        ['comprehension_log',   'column',  'user_id'],
        ['translation_log',     'column',  'user_id'],
        ['exam_attempts',       'column',  'user_id'],
        ['frequency_overrides', 'column',  'user_id'],
        ['ocr_usage',           'column',  'user_id'],
        ['credit_ledger',       'column',  'user_id'],
        ['user_profiles',       'column',  'user_id']
    ];
    i INT;
BEGIN
    FOR i IN 1 .. array_length(plan, 1) LOOP
        -- Skip a table this database does not have yet rather than
        -- failing: the three rollup tables arrive with the next deploy.
        IF to_regclass('public.' || plan[i][1]) IS NULL THEN
            RAISE NOTICE 'skipped % (not in this database)', plan[i][1];
            CONTINUE;
        END IF;

        IF plan[i][2] = 'prefix' THEN
            -- The same escaping the app applies to its own LIKE patterns:
            -- a uuid carries none of these, but an id typed by hand can.
            EXECUTE format(
                'DELETE FROM public.%I t USING doomed d
                  WHERE t.%I LIKE replace(replace(replace(d.uid,
                        %L, %L), %L, %L), %L, %L) || '':%%''',
                plan[i][1], plan[i][3],
                '\', '\\', '%', '\%', '_', '\_'
            );
        ELSIF plan[i][2] = 'session' THEN
            EXECUTE format(
                'DELETE FROM public.%I t
                  WHERE t.%I IN (SELECT v.id FROM public.video_sessions v
                                   JOIN doomed d ON d.uid = v.user_id)',
                plan[i][1], plan[i][3]
            );
        ELSE
            EXECUTE format(
                'DELETE FROM public.%I t USING doomed d WHERE t.%I = d.uid',
                plan[i][1], plan[i][3]
            );
        END IF;

        GET DIAGNOSTICS n = ROW_COUNT;
        total := total + n;
        IF n > 0 THEN
            RAISE NOTICE '% : % rows', plan[i][1], n;
        END IF;
    END LOOP;

    RAISE NOTICE '--- % rows erased across % users ---',
        total, (SELECT COUNT(*) FROM doomed);
END $$;

-- ── B. The tables a removed feature left behind ────────────────
-- Retired by commit 8f96f6b ("retire darumas, tonight, badges, mastery
-- ranks and the storehouse"), which deleted routes/daruma.py,
-- srs/daruma.py, routes/cosmetics.py and srs/cosmetics.py but could not
-- drop what their CREATE TABLE IF NOT EXISTS had already made. Nothing
-- in the codebase references any of these names -- a test now pins that
-- (backend/tests/test_legacy_tables.py).
--
-- No CASCADE: these have no dependents, and if one has somehow acquired
-- a view or a foreign key, failing loudly beats taking it along.
DROP TABLE IF EXISTS daruma_state;
DROP TABLE IF EXISTS daruma_goals;
DROP TABLE IF EXISTS user_cosmetics;
DROP TABLE IF EXISTS user_loadout;
DROP TABLE IF EXISTS streak_mends;

COMMIT;


-- ───────────────────────────────────────────────────────────────
--  PART 3 — CONFIRM. Both counts should be 0.
-- ───────────────────────────────────────────────────────────────

SELECT
    (SELECT COUNT(*) FROM user_profiles p
      WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id::text = p.user_id))
        AS profiles_without_an_auth_user,
    (SELECT COUNT(*) FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('daruma_state', 'daruma_goals', 'user_cosmetics',
                           'user_loadout', 'streak_mends'))
        AS legacy_tables_remaining;
