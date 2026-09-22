-- ═══════════════════════════════════════════════════════════════
--  Erase learner data — for psql or the Supabase SQL Editor
--
--  Dashboard -> SQL Editor -> New query -> paste -> highlight ONE
--  part -> Run. Or: psql "$DATABASE_URL" -f delete_user_data.sql
--  (which would run every part in order — don't; run PART 1 first
--  and read it, then run exactly one of PART 2 / PART 3).
--
--    PART 1  REPORT — changes nothing. Always run this first.
--    PART 2  delete ONE learner, by id.
--    PART 3  delete EVERY learner. Needs a confirmation constant set.
--    PART 4  what happened, and the confirming counts.
--    PART 5  the Supabase auth users — optional, commented out.
--
--  -- What it deletes ------------------------------------------
--  Exactly routes/account.py's PLAN: every table that holds a
--  learner's own rows, children before parents, identity last.
--  Kept the same way DELETE /api/account keeps it (its SHARED set):
--  comprehension_pool, exam_papers, exam_generation_jobs,
--  grammar_sentences and phrase_analysis_cache are shared content
--  keyed by content, not by learner, and are never touched here.
--  Neither is anything under content/ or datas/ — the decks, the
--  kanji, the audio are files, not rows.
--
--  -- When to use this rather than the code --------------------
--  Prefer the maintained paths where they fit:
--    DELETE /api/account         one learner erasing themselves,
--                                rows AND their Supabase auth user
--    scripts/wipe_srs.py         one learner starting over, keeping
--                                identity and history
--    scripts/purge_orphans.py    learners whose auth user is gone
--  This file is for the operator case none of those cover: clearing
--  a staging database, or wiping every learner before a relaunch,
--  with nothing to install and no service key to copy anywhere.
--
--  -- Safety ---------------------------------------------------
--  * Each part is ONE statement (a DO block), so it commits whole or
--    not at all. The foreign keys hold at every step because the
--    order is PLAN's.
--  * A table this database has not created yet is SKIPPED, not an
--    error — every table self-migrates at import time, so a fresh
--    or older install has fewer of them.
--  * A learner is matched the way the app matches one:
--    split_part(card_id, ':', 1), the id namespacing from
--    core/auth.py. No LIKE, so no wildcard in an id can widen it.
--  * PART 3 refuses to run until you change I_MEAN_IT to 'YES'.
--
--  ⚠ There is no undo and no backup taken here. On Supabase, take a
--    backup (Database -> Backups) before PART 3.
--
--  ⚠ PART 3 leaves the auth users standing, so everyone can still
--    sign in — into an empty account that onboarding starts over.
--    That is usually what you want. PART 5 is the other choice.
-- ═══════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────
--  PART 1 — REPORT. Changes nothing. Run this first.
-- ───────────────────────────────────────────────────────────────

DO $$
DECLARE
    -- (table, how a row is scoped to a learner, the column). This is
    -- routes/account.py's PLAN, in its order: children before parents
    -- (card_modes -> cards; custom_cards/deck_cards/deck_reports/
    -- deck_subscriptions -> decks; video_session_jobs ->
    -- video_sessions), user_profiles last so a run that somehow failed
    -- midway leaves an account that can still sign in and be retried.
    plan CONSTANT TEXT[][] := ARRAY[
        ['review_log',           'prefix',  'card_id'],
        ['review_daily',         'column',  'user_id'],
        ['card_first_review',    'prefix',  'card_id'],
        ['review_compaction',    'column',  'user_id'],
        ['card_modes',           'prefix',  'card_id'],
        ['cards',                'prefix',  'id'],
        ['xp_ledger',            'column',  'user_id'],
        ['custom_cards',         'column',  'user_id'],
        ['deck_cards',           'column',  'user_id'],
        ['deck_reports',         'column',  'user_id'],
        ['deck_subscriptions',   'column',  'user_id'],
        ['decks',                'column',  'user_id'],
        ['video_session_jobs',   'session', 'session_id'],
        ['video_sessions',       'column',  'user_id'],
        ['phrase_history',       'column',  'user_id'],
        ['reading_log',          'column',  'user_id'],
        ['comprehension_log',    'column',  'user_id'],
        ['comprehension_served', 'column',  'user_id'],
        ['comprehension_usage',  'column',  'user_id'],
        ['translation_log',      'column',  'user_id'],
        ['dictation_log',        'column',  'user_id'],
        ['exam_attempts',        'column',  'user_id'],
        ['frequency_overrides',  'column',  'user_id'],
        ['ocr_usage',            'column',  'user_id'],
        ['dictionary_favorites', 'column',  'user_id'],
        ['credit_ledger',        'column',  'user_id'],
        ['event_log',            'column',  'user_id'],
        ['event_daily',          'column',  'user_id'],
        ['user_profiles',        'column',  'user_id']
    ];
    i        INT;
    n_rows   BIGINT;
    n_users  BIGINT;
BEGIN
    -- A plain table, not a temp one: the SQL Editor does not guarantee
    -- the next statement gets the same session, and it does not show
    -- RAISE NOTICE reliably either. PART 4 reads this and drops it.
    DROP TABLE IF EXISTS public.user_data_report;
    CREATE TABLE public.user_data_report (
        step INT, table_name TEXT, rows_found BIGINT, learners BIGINT
    );

    FOR i IN 1 .. array_length(plan, 1) LOOP
        IF to_regclass('public.' || plan[i][1]) IS NULL THEN
            INSERT INTO public.user_data_report
                VALUES (i, plan[i][1] || '  (not in this database)', 0, 0);
            CONTINUE;
        END IF;

        IF plan[i][2] = 'prefix' THEN
            EXECUTE format(
                'SELECT COUNT(*), COUNT(DISTINCT split_part(t.%I, '':'', 1))
                   FROM public.%I t', plan[i][3], plan[i][1]
            ) INTO n_rows, n_users;
        ELSIF plan[i][2] = 'session' THEN
            -- Scoped through its parent, so it cannot name a learner
            -- video_sessions does not already name.
            EXECUTE format('SELECT COUNT(*), NULL::BIGINT FROM public.%I t',
                           plan[i][1]) INTO n_rows, n_users;
        ELSE
            EXECUTE format(
                'SELECT COUNT(*), COUNT(DISTINCT t.%I) FROM public.%I t',
                plan[i][3], plan[i][1]
            ) INTO n_rows, n_users;
        END IF;

        INSERT INTO public.user_data_report
            VALUES (i, plan[i][1], n_rows, n_users);
    END LOOP;
END $$;

SELECT step, table_name, rows_found, learners
  FROM public.user_data_report
 ORDER BY step;

-- Who is in the database, biggest first. No single table answers this:
-- a learner who never opened the profile screen has review rows and no
-- user_profiles row at all.
WITH app_users AS (
    SELECT split_part(card_id, ':', 1) AS uid FROM review_log
    UNION SELECT split_part(card_id, ':', 1) FROM card_modes
    UNION SELECT split_part(id,      ':', 1) FROM cards
    UNION SELECT user_id FROM user_profiles
    UNION SELECT user_id FROM decks
    UNION SELECT user_id FROM phrase_history
    UNION SELECT user_id FROM reading_log
    UNION SELECT user_id FROM exam_attempts
)
SELECT
    a.uid                                                      AS user_id,
    p.username,
    (SELECT COUNT(*) FROM review_log r
      WHERE split_part(r.card_id, ':', 1) = a.uid)             AS reviews,
    (SELECT COUNT(*) FROM card_modes c
      WHERE split_part(c.card_id, ':', 1) = a.uid)             AS cards_in_progress,
    (SELECT COUNT(*) FROM decks d WHERE d.user_id = a.uid)     AS decks,
    p.created_at
  FROM app_users a
  LEFT JOIN user_profiles p ON p.user_id = a.uid
 WHERE a.uid <> ''
 ORDER BY reviews DESC NULLS LAST;


-- ───────────────────────────────────────────────────────────────
--  PART 2 — DELETE ONE LEARNER. This deletes.
--  Put the id from PART 1 in TARGET_IDS, highlight from DO to $$;
--  and Run. More than one id is fine.
-- ───────────────────────────────────────────────────────────────

DO $$
DECLARE
    -- ── Edit this line ─────────────────────────────────────────
    TARGET_IDS CONSTANT TEXT[] := ARRAY[
        '00000000-0000-0000-0000-000000000000'
    ];

    plan CONSTANT TEXT[][] := ARRAY[
        ['review_log',           'prefix',  'card_id'],
        ['review_daily',         'column',  'user_id'],
        ['card_first_review',    'prefix',  'card_id'],
        ['review_compaction',    'column',  'user_id'],
        ['card_modes',           'prefix',  'card_id'],
        ['cards',                'prefix',  'id'],
        ['xp_ledger',            'column',  'user_id'],
        ['custom_cards',         'column',  'user_id'],
        ['deck_cards',           'column',  'user_id'],
        ['deck_reports',         'column',  'user_id'],
        ['deck_subscriptions',   'column',  'user_id'],
        ['decks',                'column',  'user_id'],
        ['video_session_jobs',   'session', 'session_id'],
        ['video_sessions',       'column',  'user_id'],
        ['phrase_history',       'column',  'user_id'],
        ['reading_log',          'column',  'user_id'],
        ['comprehension_log',    'column',  'user_id'],
        ['comprehension_served', 'column',  'user_id'],
        ['comprehension_usage',  'column',  'user_id'],
        ['translation_log',      'column',  'user_id'],
        ['dictation_log',        'column',  'user_id'],
        ['exam_attempts',        'column',  'user_id'],
        ['frequency_overrides',  'column',  'user_id'],
        ['ocr_usage',            'column',  'user_id'],
        ['dictionary_favorites', 'column',  'user_id'],
        ['credit_ledger',        'column',  'user_id'],
        ['event_log',            'column',  'user_id'],
        ['event_daily',          'column',  'user_id'],
        ['user_profiles',        'column',  'user_id']
    ];
    i     INT;
    n     BIGINT;
    total BIGINT := 0;
BEGIN
    IF TARGET_IDS IS NULL OR cardinality(TARGET_IDS) = 0
       OR '' = ANY(TARGET_IDS) THEN
        RAISE EXCEPTION 'TARGET_IDS is empty — nothing done.';
    END IF;

    DROP TABLE IF EXISTS public.user_data_report;
    CREATE TABLE public.user_data_report (
        step INT, table_name TEXT, rows_found BIGINT, learners BIGINT
    );

    FOR i IN 1 .. array_length(plan, 1) LOOP
        IF to_regclass('public.' || plan[i][1]) IS NULL THEN
            INSERT INTO public.user_data_report
                VALUES (i, plan[i][1] || '  (not in this database)', 0, 0);
            CONTINUE;
        END IF;

        IF plan[i][2] = 'prefix' THEN
            EXECUTE format(
                'DELETE FROM public.%I t WHERE split_part(t.%I, '':'', 1) = ANY($1)',
                plan[i][1], plan[i][3]) USING TARGET_IDS;
        ELSIF plan[i][2] = 'session' THEN
            EXECUTE format(
                'DELETE FROM public.%I t
                  WHERE t.%I IN (SELECT v.id FROM public.video_sessions v
                                  WHERE v.user_id = ANY($1))',
                plan[i][1], plan[i][3]) USING TARGET_IDS;
        ELSE
            EXECUTE format(
                'DELETE FROM public.%I t WHERE t.%I = ANY($1)',
                plan[i][1], plan[i][3]) USING TARGET_IDS;
        END IF;

        GET DIAGNOSTICS n = ROW_COUNT;
        total := total + n;
        INSERT INTO public.user_data_report VALUES (i, plan[i][1], n, NULL);
    END LOOP;

    -- Deleting a learner deletes their published decks OUTRIGHT, with
    -- none of the grace period routes/decks.delete_deck gives a
    -- withdrawn one (ADR 0010: delete means delete). The `decks` step
    -- therefore also cascades away OTHER learners' deck_subscriptions
    -- and deck_reports rows, which the counts above do not include.
    INSERT INTO public.user_data_report
        VALUES (99, format('TOTAL across %s learner(s)',
                           cardinality(TARGET_IDS)), total, NULL);
END $$;


-- ───────────────────────────────────────────────────────────────
--  PART 3 — DELETE EVERY LEARNER. This is the big one.
--  Change I_MEAN_IT to 'YES' first; it refuses to run otherwise.
-- ───────────────────────────────────────────────────────────────

DO $$
DECLARE
    -- ── Edit this line to 'YES' to arm the block ───────────────
    I_MEAN_IT CONSTANT TEXT := 'no';

    plan CONSTANT TEXT[] := ARRAY[
        'review_log', 'review_daily', 'card_first_review',
        'review_compaction', 'card_modes', 'cards', 'xp_ledger',
        'custom_cards', 'deck_cards', 'deck_reports',
        'deck_subscriptions', 'decks', 'video_session_jobs',
        'video_sessions', 'phrase_history', 'reading_log',
        'comprehension_log', 'comprehension_served',
        'comprehension_usage', 'translation_log', 'dictation_log',
        'exam_attempts', 'frequency_overrides', 'ocr_usage',
        'dictionary_favorites', 'credit_ledger', 'event_log',
        'event_daily', 'user_profiles'
    ];
    i     INT;
    n     BIGINT;
    total BIGINT := 0;
BEGIN
    IF I_MEAN_IT <> 'YES' THEN
        RAISE EXCEPTION
            'PART 3 erases every learner. Set I_MEAN_IT to ''YES'' to run it.';
    END IF;

    DROP TABLE IF EXISTS public.user_data_report;
    CREATE TABLE public.user_data_report (
        step INT, table_name TEXT, rows_found BIGINT, learners BIGINT
    );

    -- No scoping clause: every row of these tables is some learner's.
    -- Still in PLAN order, children first, so the foreign keys hold.
    -- (TRUNCATE the whole list in one statement would be faster on a
    -- large review_log; DELETE is kept because it can report what it
    -- removed, and because nothing shared is a child of these.)
    FOR i IN 1 .. array_length(plan, 1) LOOP
        IF to_regclass('public.' || plan[i]) IS NULL THEN
            INSERT INTO public.user_data_report
                VALUES (i, plan[i] || '  (not in this database)', 0, 0);
            CONTINUE;
        END IF;

        EXECUTE format('DELETE FROM public.%I', plan[i]);
        GET DIAGNOSTICS n = ROW_COUNT;
        total := total + n;
        INSERT INTO public.user_data_report VALUES (i, plan[i], n, NULL);
    END LOOP;

    INSERT INTO public.user_data_report VALUES (99, 'TOTAL', total, NULL);
END $$;


-- ───────────────────────────────────────────────────────────────
--  PART 4 — WHAT HAPPENED, then CONFIRM. Run last.
-- ───────────────────────────────────────────────────────────────

SELECT step, table_name, rows_found
  FROM public.user_data_report
 ORDER BY step;

-- After PART 3 every one of these is 0. After PART 2 they are the
-- remaining learners' figures.
SELECT
    (SELECT COUNT(*) FROM user_profiles)  AS profiles,
    (SELECT COUNT(*) FROM review_log)     AS review_log_rows,
    (SELECT COUNT(*) FROM card_modes)     AS cards_in_progress,
    (SELECT COUNT(*) FROM decks)          AS decks;

-- The shared content this script must NOT have touched — these should
-- read the same before and after (routes/account.py's SHARED).
SELECT
    (SELECT COUNT(*) FROM exam_papers)           AS exam_papers,
    (SELECT COUNT(*) FROM comprehension_pool)    AS comprehension_pool,
    (SELECT COUNT(*) FROM grammar_sentences)     AS grammar_sentences,
    (SELECT COUNT(*) FROM phrase_analysis_cache) AS phrase_cache;

DROP TABLE IF EXISTS public.user_data_report;


-- ───────────────────────────────────────────────────────────────
--  PART 5 — THE AUTH USERS. Optional, and deliberately inert.
--
--  The parts above leave every sign-in working, into an empty
--  account that onboarding starts over. Removing the sign-ins too
--  means removing the Supabase users, which live in the `auth`
--  schema and are reachable only as `postgres` — the SQL Editor, not
--  the app's role.
--
--  ORDER MATTERS, and this way round only: rows first (above), then
--  auth. Auth-first leaves rows for users who no longer exist, which
--  is exactly the orphan state purge_orphans.py exists to repair.
--
--  Uncomment to use. It deletes EVERY user in the project, including
--  yours.
-- ───────────────────────────────────────────────────────────────

-- DELETE FROM auth.users;
