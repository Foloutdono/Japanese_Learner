-- ═══════════════════════════════════════════════════════════════
--  Close every table in `public` to the Data API, for the Supabase
--  SQL Editor
--
--  Dashboard -> SQL Editor -> New query -> paste -> Run.
--
--  Run PART 1 on its own first and READ WHAT IT PRINTS. Then PART 2,
--  the part that changes things, and PART 3 to confirm. Highlight a
--  part and press Run to execute just that part. Every statement here
--  can be run again: a second run changes nothing.
--
--  -- What was open ----------------------------------------------
--  On 2026-10-17 the security advisor reported 37 tables in `public`
--  with Row Level Security off. Supabase serves `public` at /rest/v1
--  to anyone holding the anon key, which ships in the frontend bundle
--  (VITE_SUPABASE_ANON_KEY), and its default privileges had granted
--  `anon` SELECT, INSERT, UPDATE and DELETE on every one of them:
--  anyone could read feedback and what learners typed, and write
--  credit_ledger.
--
--  -- Why nothing breaks -----------------------------------------
--  RLS with no policy refuses `anon` and `authenticated` every row and
--  leaves a table's owner alone, unless the table FORCEs it (none does,
--  and none should). Every table here is owned by `postgres`, which has
--  BYPASSRLS besides, and the backend is that owner: the tables it
--  created itself (feedback, agenda_blocks ...) are owned by postgres,
--  and its self-migrations ALTER them at every boot, which Postgres
--  allows the owner alone. Nine tables have had RLS on all along
--  (cards, card_modes, review_log, user_profiles ...) without the app
--  noticing. The frontend reads no table through the Data API: it uses
--  Supabase to sign in, nothing more.
--
--  Metabase is the one reader to look at first. Its dashboards already
--  read review_log and reading_log, two of those nine: if their tiles
--  show figures today, its role passes RLS and nothing changes for it.
--  If they are empty, every dashboard will be after PART 2.
--
--  -- Afterwards -------------------------------------------------
--  The backend closes each table in the transaction that creates it
--  (backend/core/rls.py), so a table the app makes is born closed and
--  backend/tests/test_rls.py fails on one that is not. PART 2 also
--  takes the grants away and stops the next table being granted, which
--  covers a table made by hand, in this editor, that nobody closes.
-- ═══════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────
--  PART 1 — REPORT. Changes nothing. Run this first.
-- ───────────────────────────────────────────────────────────────

-- Every table and view in public: whether RLS is on, who owns it and
-- what `anon` may do to it, the open ones first. Read any view twice:
-- it reads its tables as its owner, so RLS on them does not close it.
-- Only taking its grant away (PART 2) does.
SELECT c.relname                                          AS name,
       CASE WHEN c.relkind IN ('v', 'm') THEN 'view' ELSE 'table' END AS kind,
       c.relrowsecurity                                   AS rls_on,
       pg_get_userbyid(c.relowner)                        AS owner,
       concat_ws(', ',
           CASE WHEN has_table_privilege('anon', c.oid, 'SELECT') THEN 'read' END,
           CASE WHEN has_table_privilege('anon', c.oid, 'INSERT') THEN 'insert' END,
           CASE WHEN has_table_privilege('anon', c.oid, 'UPDATE') THEN 'update' END,
           CASE WHEN has_table_privilege('anon', c.oid, 'DELETE') THEN 'delete' END
       )                                                  AS anon_may
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind IN ('r', 'p', 'v', 'm')
 ORDER BY c.relrowsecurity, kind, c.relname;


-- ───────────────────────────────────────────────────────────────
--  PART 2 — CLOSE. Run it after reading part 1, all of it at once.
-- ───────────────────────────────────────────────────────────────

-- 1. RLS on every table that lacks it, in one statement and so in one
--    transaction: all of them or none. ALTER TABLE takes each table's
--    strongest lock, queueing behind whatever is reading the table and
--    holding the app's next queries behind itself, so the lock_timeout
--    gives up after five seconds rather than stall the app. If it does,
--    nothing changed: run it again.
DO $$
DECLARE
    t TEXT;
BEGIN
    PERFORM set_config('lock_timeout', '5s', true);
    FOR t IN
        SELECT c.relname
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relkind IN ('r', 'p')
           AND NOT c.relrowsecurity
         ORDER BY c.relname
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- 2. The grants. RLS already refuses `anon` and `authenticated` every
--    row; without a grant they cannot even ask, so a policy written by
--    mistake one day still opens nothing. service_role keeps its own:
--    its key never leaves the server, and it passes RLS anyway.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 3. And the next table: whatever `postgres` creates in public from now
--    on, as the backend does, is granted to neither.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM anon, authenticated;


-- ───────────────────────────────────────────────────────────────
--  PART 3 — CONFIRM. Changes nothing. Must return no row.
-- ───────────────────────────────────────────────────────────────

-- One row per thing still open: a table without RLS, a table or view
-- `anon` or `authenticated` may still touch, or a default that would
-- grant them the next table or sequence.
SELECT 'RLS is off on ' || c.relname AS still_open
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind IN ('r', 'p')
   AND NOT c.relrowsecurity
UNION ALL
SELECT r.who || ' is granted ' || c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(who)
 WHERE n.nspname = 'public'
   AND c.relkind IN ('r', 'p', 'v', 'm')
   AND has_table_privilege(r.who, c.oid, 'SELECT, INSERT, UPDATE, DELETE')
UNION ALL
SELECT pg_get_userbyid(a.grantee) || ' is granted the next '
       || CASE d.defaclobjtype WHEN 'r' THEN 'table' ELSE 'sequence' END
  FROM pg_default_acl d
 CROSS JOIN LATERAL aclexplode(d.defaclacl) AS a
 WHERE d.defaclrole = 'postgres'::regrole
   AND (d.defaclnamespace = 0 OR d.defaclnamespace = 'public'::regnamespace)
   AND d.defaclobjtype IN ('r', 'S')
   AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole);

-- The same question from outside, with the anon key from
-- frontend/.env.production in $ANON and the project's ref in $REF.
-- Before PART 2 it was answered; now it must be refused, with code
-- 42501 ("permission denied for table exam_papers"):
--
--   curl -s "https://$REF.supabase.co/rest/v1/exam_papers?limit=1" \
--        -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
