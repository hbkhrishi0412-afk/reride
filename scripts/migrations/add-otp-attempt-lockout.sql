-- OTP brute-force protection: per-phone attempt counter and lockout window.
-- Run in Supabase SQL editor after otp_verifications table exists.

ALTER TABLE public.otp_verifications
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.otp_verifications
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

COMMENT ON COLUMN public.otp_verifications.attempt_count IS 'Failed verify attempts for current OTP';
COMMENT ON COLUMN public.otp_verifications.locked_until IS 'Block further verify attempts until this time';
