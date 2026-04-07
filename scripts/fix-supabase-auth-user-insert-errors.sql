-- ============================================================================
-- If BOTH client signUp and auth.admin.createUser return "Database error saving
-- new user", a trigger or function on auth.users is failing (e.g. inserting into
-- public.users or public.profiles). Run diagnostics in Supabase SQL Editor.
-- ============================================================================

-- List triggers on auth.users (Supabase / Postgres)
-- SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger
-- WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal;

-- Inspect function source for handle_new_user (or similar):
-- SELECT proname, prosrc FROM pg_proc WHERE proname LIKE '%user%' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Typical fixes (adjust to your function names):
-- 1) Ensure inserts use ON CONFLICT (id) DO NOTHING or DO UPDATE where appropriate.
-- 2) Ensure NOT NULL columns in public.users / profiles get defaults or values.
-- 3) Run RLS policies as SECURITY DEFINER only where intended; service role bypasses RLS but triggers still run as defined.
