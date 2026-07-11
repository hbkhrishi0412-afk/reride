-- Combined launch-security grant fixes — paste once in Supabase SQL Editor.
-- See also: scripts/migrations/fix-revoke-users-password.sql
--           scripts/migrations/fix-security-kv-rpc-grants.sql

-- ── 1. users.password column revoke ─────────────────────────────────────────

REVOKE ALL ON TABLE public.users FROM anon;
GRANT SELECT (
  id,
  email,
  name,
  role,
  status,
  avatar_url,
  is_verified,
  dealership_name,
  bio,
  logo_url,
  phone_verified,
  email_verified,
  govt_id_verified,
  trust_score,
  location,
  auth_provider,
  created_at,
  updated_at,
  plan_activated_at,
  plan_expires_at
) ON TABLE public.users TO anon;

REVOKE ALL ON TABLE public.users FROM authenticated;
GRANT SELECT, UPDATE ON TABLE public.users TO authenticated;
REVOKE SELECT (password) ON TABLE public.users FROM authenticated;

-- ── 2. security_kv RPC lockdown ───────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.security_kv_touch(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.security_kv_get(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.security_kv_set(text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.security_kv_delete(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.security_kv_touch(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.security_kv_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.security_kv_set(text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.security_kv_delete(text) TO service_role;

REVOKE ALL ON TABLE public.security_kv FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.security_kv TO service_role;
