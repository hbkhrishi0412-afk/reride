-- Fix "Database error saving new user" on Google (and other) OAuth when a row in
-- public.users already exists for the same email (legacy / Firebase id) but a different
-- primary key. The old handle_new_user() only had ON CONFLICT (id) DO NOTHING, so a new
-- auth.users UUID insert failed the UNIQUE (email) constraint and aborted signup.
--
-- Apply in Supabase Dashboard → SQL Editor (or: supabase db push / migration pipeline).
-- Safe to re-run: CREATE OR REPLACE FUNCTION is idempotent.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_name text;
  v_auth_provider text;
  v_email text;
BEGIN
  v_email := NULLIF(btrim(NEW.email), '');
  IF v_email IS NULL THEN
    RAISE LOG 'handle_new_user: skipped public.users (no email) for auth user %', NEW.id;
    RETURN NEW;
  END IF;

  v_auth_provider := COALESCE(NULLIF(btrim(NEW.raw_app_meta_data->>'provider'), ''), 'email');

  v_name := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'display_name'), ''),
    split_part(v_email, '@', 1),
    'User'
  );
  IF v_name IS NULL OR btrim(v_name) = '' THEN
    v_name := 'User';
  END IF;

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

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'On auth.users insert: upsert public.users by email, migrating PK to new auth id when needed (child FKs use ON UPDATE CASCADE).';
