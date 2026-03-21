-- Run in Supabase SQL editor: add optional seller pincode (Indian postal code).
-- Safe to run once; skips if column already exists.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'pincode'
  ) THEN
    ALTER TABLE public.users ADD COLUMN pincode text;
    COMMENT ON COLUMN public.users.pincode IS '6-digit Indian PIN code for dealer map / area grouping';
  END IF;
END $$;
