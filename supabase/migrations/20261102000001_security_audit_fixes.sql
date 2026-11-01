-- Security audit fixes: column grants, write revokes, atomic counters, storage paths.

-- 1) users: table-level SELECT/UPDATE must not cover password / PII scrape columns.
--    Column-level REVOKE SELECT (password) does NOT override GRANT SELECT ON TABLE.
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

-- Owner/admin profile reads that need email go through the service-role API.
-- Keep email readable only for the row owner via a narrow grant is impossible per-policy;
-- so email stays off the PostgREST grants entirely.

-- Writes already revoked by 20261003000000; re-assert.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.users FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.vehicles FROM anon, authenticated;

-- 2) service_requests: client could UPDATE any column (status/total) under broad policies.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.service_requests FROM anon, authenticated;

-- 3) Atomic OTP failed-attempt counter (closes parallel-guess race).
CREATE OR REPLACE FUNCTION public.otp_register_failed_attempt(
  p_phone text,
  p_max_attempts int DEFAULT 5,
  p_lockout_minutes int DEFAULT 30
)
RETURNS TABLE(attempt_count int, locked_until timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.otp_verifications ov
  SET
    attempt_count = COALESCE(ov.attempt_count, 0) + 1,
    locked_until = CASE
      WHEN COALESCE(ov.attempt_count, 0) + 1 >= p_max_attempts
        THEN now() + make_interval(mins => p_lockout_minutes)
      ELSE ov.locked_until
    END
  WHERE ov.phone = p_phone
  RETURNING ov.attempt_count, ov.locked_until;
END;
$$;

REVOKE ALL ON FUNCTION public.otp_register_failed_attempt(text, int, int) FROM PUBLIC, anon, authenticated;

-- 4) Atomic boost credit / certify quota consume.
CREATE OR REPLACE FUNCTION public.consume_featured_credit(p_email text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_remaining int;
BEGIN
  UPDATE public.users
  SET featured_credits = featured_credits - 1,
      updated_at = now()
  WHERE lower(trim(email)) = lower(trim(p_email))
    AND featured_credits > 0
  RETURNING featured_credits INTO v_remaining;
  RETURN v_remaining; -- NULL if no row matched / no credits
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_certification_quota(p_email text, p_allowed int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_used int;
BEGIN
  UPDATE public.users
  SET used_certifications = COALESCE(used_certifications, 0) + 1,
      updated_at = now()
  WHERE lower(trim(email)) = lower(trim(p_email))
    AND COALESCE(used_certifications, 0) < p_allowed
  RETURNING used_certifications INTO v_used;
  RETURN v_used;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_sold_listings(p_email text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_sold int;
BEGIN
  UPDATE public.users
  SET
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{soldListings}',
      to_jsonb(COALESCE((metadata->>'soldListings')::int, 0) + 1),
      true
    ),
    updated_at = now()
  WHERE lower(trim(email)) = lower(trim(p_email))
  RETURNING COALESCE((metadata->>'soldListings')::int, 0) INTO v_sold;
  RETURN v_sold;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_featured_credit(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_certification_quota(text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_sold_listings(text) FROM PUBLIC, anon, authenticated;

-- 5) Storage: drop open folder prefixes (vehicles/chat-messages/listings/profiles).
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
CREATE POLICY "Authenticated users can upload images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'Images'
  AND (SELECT auth.role()) = 'authenticated'
  AND (storage.foldername(name))[1] = (SELECT auth.email())
);

-- 6) buyer_activity: unique user_id so concurrent first writes upsert instead of duplicating.
CREATE UNIQUE INDEX IF NOT EXISTS buyer_activity_user_id_uidx ON public.buyer_activity (user_id);
