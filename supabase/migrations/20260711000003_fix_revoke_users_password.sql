-- Supabase: explicit column GRANT (password/email never granted to PostgREST roles).
-- Note: REVOKE SELECT (password) does NOT undo GRANT SELECT ON TABLE — always
-- REVOKE ALL then re-GRANT only safe columns.

REVOKE ALL ON TABLE public.users FROM anon, authenticated;
GRANT SELECT (
  id,
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
) ON TABLE public.users TO anon, authenticated;
