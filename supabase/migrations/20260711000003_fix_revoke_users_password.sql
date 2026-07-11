-- Supabase: explicit column GRANT for anon (password never granted).

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
