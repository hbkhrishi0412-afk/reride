-- Distributed rate-limit + token-revocation store (Upstash alternative via Supabase Postgres)
CREATE TABLE IF NOT EXISTS public.security_kv (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '1',
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS security_kv_expires_at_idx ON public.security_kv (expires_at);

ALTER TABLE public.security_kv ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.security_kv_touch(p_key text, p_ttl_seconds integer DEFAULT 900)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_count integer;
  v_expires timestamptz := now() + make_interval(secs => GREATEST(1, p_ttl_seconds));
BEGIN
  DELETE FROM public.security_kv WHERE expires_at < now();
  INSERT INTO public.security_kv (key, value, expires_at)
  VALUES (p_key, '1', v_expires)
  ON CONFLICT (key) DO UPDATE SET
    value = (COALESCE(NULLIF(public.security_kv.value, ''), '0')::integer + 1)::text,
    expires_at = GREATEST(public.security_kv.expires_at, EXCLUDED.expires_at)
  RETURNING value::integer INTO v_new_count;
  RETURN v_new_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.security_kv_get(p_key text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.security_kv
  WHERE key = p_key AND expires_at > now()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.security_kv_set(p_key text, p_value text, p_ttl_seconds integer DEFAULT 900)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_kv (key, value, expires_at)
  VALUES (p_key, p_value, now() + make_interval(secs => GREATEST(1, p_ttl_seconds)))
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    expires_at = EXCLUDED.expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.security_kv_delete(p_key text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.security_kv WHERE key = p_key;
$$;

REVOKE ALL ON TABLE public.security_kv FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.security_kv_touch(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.security_kv_get(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.security_kv_set(text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.security_kv_delete(text) FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.security_kv TO service_role;
GRANT EXECUTE ON FUNCTION public.security_kv_touch(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.security_kv_get(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.security_kv_set(text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.security_kv_delete(text) TO service_role;
