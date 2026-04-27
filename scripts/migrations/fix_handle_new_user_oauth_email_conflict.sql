-- Fix "Database error saving new user" on Google (and other) OAuth.
--
-- Causes in production:
-- 1) public.users has UNIQUE (email). A legacy row (email_key / old Firebase id) with the
--    same email but a different id than the new auth.users row → INSERT failed before a
--    plain ON CONFLICT (id) only.
-- 2) public.users CHECK (auth_provider) allows only email | google | phone. OAuth
--    metadata can produce values outside that set; we normalize.
-- 3) public.service_providers / buyer_activity may still reference a legacy id when
--    users.id is migrated to the new auth id — we realign by email (service_providers) or
--    old id (buyer_activity).
--
-- Apply in Supabase → SQL Editor (or: MCP apply_migration). Idempotent: REPLACE FUNCTION.
--
-- After deploy, try Google sign-in again with the same test account.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_name text;
  v_auth_provider text;
  v_raw text;
  v_email text;
  v_old_id text;
BEGIN
  v_email := NULLIF(LOWER(btrim(COALESCE(NEW.email, ''))), '');
  IF v_email IS NULL THEN
    RAISE LOG 'handle_new_user: skipped public.users (no email) for auth user %', NEW.id;
    RETURN NEW;
  END IF;

  v_raw := LOWER(btrim(COALESCE(NEW.raw_app_meta_data->>'provider', '')));
  IF v_raw IN ('email', 'google', 'phone') THEN
    v_auth_provider := v_raw;
  ELSIF COALESCE(NEW.raw_app_meta_data->'providers', '[]'::jsonb) @> '["google"]'::jsonb THEN
    v_auth_provider := 'google';
  ELSIF v_raw = '' AND NEW.phone IS NOT NULL AND btrim(COALESCE(NEW.phone, '')) <> '' THEN
    v_auth_provider := 'phone';
  ELSE
    v_auth_provider := 'email';
  END IF;

  v_name := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'user_name'), ''),
    split_part(v_email, '@', 1),
    'User'
  );
  IF v_name IS NULL OR btrim(v_name) = '' THEN
    v_name := 'User';
  END IF;

  SELECT u.id
  INTO v_old_id
  FROM public.users u
  WHERE u.email = v_email
  LIMIT 1;

  INSERT INTO public.users AS u (
    id,
    email,
    name,
    auth_provider,
    firebase_uid
  )
  VALUES (
    NEW.id::text,
    v_email,
    v_name,
    v_auth_provider,
    NEW.id::text
  )
  ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    name = CASE
      WHEN btrim(EXCLUDED.name) <> '' THEN EXCLUDED.name
      ELSE u.name
    END,
    auth_provider = CASE
      WHEN EXCLUDED.auth_provider IS NOT NULL
        AND EXCLUDED.auth_provider <> 'email' THEN EXCLUDED.auth_provider
      ELSE u.auth_provider
    END,
    firebase_uid = EXCLUDED.firebase_uid,
    updated_at = now();

  IF to_regclass('public.service_providers') IS NOT NULL THEN
    UPDATE public.service_providers sp
    SET
      id = NEW.id::text,
      updated_at = now()
    WHERE LOWER(btrim(COALESCE(sp.email, ''))) = v_email
      AND sp.id IS DISTINCT FROM NEW.id::text;
  END IF;

  IF v_old_id IS NOT NULL
     AND v_old_id IS DISTINCT FROM NEW.id::text
     AND to_regclass('public.buyer_activity') IS NOT NULL THEN
    UPDATE public.buyer_activity ba
    SET
      user_id = NEW.id::text,
      updated_at = now()
    WHERE ba.user_id = v_old_id;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'On auth.users insert: upsert public.users by email, migrate id to new auth id, re-link service_provider + buyer_activity when needed.';

-- Trigger on_auth_user_created already calls public.handle_new_user() in this project
-- (CREATE OR REPLACE above is enough; do not drop/recreate the trigger here).
