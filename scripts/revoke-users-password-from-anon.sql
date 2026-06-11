-- Run once in Supabase Dashboard → SQL Editor (production).
-- Prevents direct PostgREST reads of password hashes when VITE_SUPABASE_ANON_KEY is in the client bundle.
REVOKE SELECT (password) ON public.users FROM anon, authenticated;
