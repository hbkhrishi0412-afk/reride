-- Tighten anon access to users table: hide PII and internal plan/metadata from anon key.
-- Safe to run on production after enable-rls-production.sql.
-- Public seller profiles still work via non-sensitive columns (name, email, avatar, bio, etc.).

REVOKE SELECT (password) ON public.users FROM anon, authenticated;

-- alternatePhone lives in metadata JSONB, not a dedicated column.
REVOKE SELECT (
  mobile,
  address,
  pincode,
  firebase_uid,
  metadata,
  subscription_plan,
  featured_credits,
  used_certifications
) ON public.users FROM anon;

-- Re-grant table SELECT so row-level policies still apply (column revokes subtract fields only).
GRANT SELECT ON public.users TO anon;
