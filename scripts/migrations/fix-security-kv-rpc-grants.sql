-- Lock down security_kv RPC: service_role only (anon/authenticated must not call SECURITY DEFINER helpers).
-- Supabase default grants often leave EXECUTE on anon/authenticated even after REVOKE FROM PUBLIC.

REVOKE ALL ON FUNCTION public.security_kv_touch(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.security_kv_get(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.security_kv_set(text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.security_kv_delete(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.security_kv_touch(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.security_kv_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.security_kv_set(text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.security_kv_delete(text) TO service_role;

-- Table stays service_role-only; RLS ON with no policies blocks direct client access.
REVOKE ALL ON TABLE public.security_kv FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.security_kv TO service_role;
