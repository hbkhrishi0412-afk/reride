-- ============================================================================
-- Migration: Fix Plan Expiry & Vehicle Visibility
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================================

-- 1. Add plan tracking columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS plan_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;

COMMENT ON COLUMN public.users.plan_activated_at IS 'When the current subscription plan was activated';
COMMENT ON COLUMN public.users.plan_expires_at IS 'When the current subscription plan expires';

-- 2. Add duration_days to plans for proper expiry calculation
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS duration_days integer NOT NULL DEFAULT 30;

COMMENT ON COLUMN public.plans.duration_days IS 'Plan validity in days';

-- 3. Update plans with proper real-world pricing and limits
UPDATE public.plans SET
  name = 'Free Plan',
  price = 0,
  "listingLimit" = 1,
  "featuredCredits" = 0,
  "freeCertifications" = 0,
  duration_days = 30,
  features = ARRAY['1 Active Listing', '30 Day Listing Duration', 'Basic Support'],
  "updatedAt" = now(),
  updated_at = now()
WHERE id = 'free';

UPDATE public.plans SET
  name = 'Pro Plan',
  price = 1999,
  "listingLimit" = 10,
  "featuredCredits" = 2,
  "freeCertifications" = 1,
  "isMostPopular" = true,
  duration_days = 30,
  features = ARRAY['10 Active Listings', '2 Featured Credits/month', '1 Free Certified Inspection/month', 'Priority Support'],
  "updatedAt" = now(),
  updated_at = now()
WHERE id = 'pro';

UPDATE public.plans SET
  name = 'Premium Plan',
  price = 4999,
  "listingLimit" = 0,
  "featuredCredits" = 5,
  "freeCertifications" = 3,
  duration_days = 30,
  features = ARRAY['Unlimited Active Listings', '5 Featured Credits/month', '3 Free Certified Inspections/month', 'Premium Support', 'Analytics Dashboard'],
  "updatedAt" = now(),
  updated_at = now()
WHERE id = 'premium';

-- 4. Backfill plan_activated_at / plan_expires_at from metadata for sellers who have them
UPDATE public.users
SET
  plan_activated_at = CASE
    WHEN metadata->>'planActivatedDate' IS NOT NULL
      AND metadata->>'planActivatedDate' != ''
      THEN (metadata->>'planActivatedDate')::timestamptz
    ELSE NULL
  END,
  plan_expires_at = CASE
    WHEN metadata->>'planExpiryDate' IS NOT NULL
      AND metadata->>'planExpiryDate' != ''
      THEN (metadata->>'planExpiryDate')::timestamptz
    ELSE NULL
  END
WHERE role = 'seller'
  AND metadata IS NOT NULL
  AND (
    metadata->>'planActivatedDate' IS NOT NULL
    OR metadata->>'planExpiryDate' IS NOT NULL
  );

-- 5. For sellers on free plan with no expiry set, give a 30-day window from now
UPDATE public.users
SET
  plan_activated_at = COALESCE(plan_activated_at, now()),
  plan_expires_at = COALESCE(plan_expires_at, now() + interval '30 days')
WHERE role = 'seller'
  AND subscription_plan = 'free'
  AND plan_expires_at IS NULL;

-- For sellers on pro plan with no expiry set, give a 30-day window from now
UPDATE public.users
SET
  plan_activated_at = COALESCE(plan_activated_at, now()),
  plan_expires_at = COALESCE(plan_expires_at, now() + interval '30 days')
WHERE role = 'seller'
  AND subscription_plan = 'pro'
  AND plan_expires_at IS NULL;

-- For sellers on premium plan with no expiry set, give a 30-day window from now
UPDATE public.users
SET
  plan_activated_at = COALESCE(plan_activated_at, now()),
  plan_expires_at = COALESCE(plan_expires_at, now() + interval '30 days')
WHERE role = 'seller'
  AND subscription_plan = 'premium'
  AND plan_expires_at IS NULL;

-- 6. Set listing_expires_at on ALL published vehicles that don't have one
-- Use the seller's plan_expires_at, or 30 days from now
UPDATE public.vehicles v
SET
  listing_expires_at = COALESCE(
    (SELECT u.plan_expires_at FROM public.users u
     WHERE lower(trim(u.email)) = lower(trim(v.seller_email))
       AND u.plan_expires_at IS NOT NULL
     LIMIT 1),
    now() + interval '30 days'
  ),
  listing_status = 'active'
WHERE v.listing_expires_at IS NULL
  AND v.status = 'published';

-- 7. Mark vehicles as expired if their listing_expires_at is in the past
UPDATE public.vehicles
SET
  status = 'unpublished',
  listing_status = 'expired',
  updated_at = now()
WHERE listing_expires_at IS NOT NULL
  AND listing_expires_at < now()
  AND status = 'published';

-- 8. Create a DB function to expire listings (can be called by pg_cron or edge function)
CREATE OR REPLACE FUNCTION public.expire_stale_listings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_count integer;
BEGIN
  -- Expire published vehicles whose listing_expires_at has passed
  WITH expired AS (
    UPDATE public.vehicles
    SET
      status = 'unpublished',
      listing_status = 'expired',
      updated_at = now()
    WHERE status = 'published'
      AND listing_expires_at IS NOT NULL
      AND listing_expires_at < now()
    RETURNING id
  )
  SELECT count(*) INTO expired_count FROM expired;

  -- Also expire vehicles whose seller's plan has expired
  WITH seller_expired AS (
    UPDATE public.vehicles v
    SET
      status = 'unpublished',
      listing_status = 'expired',
      updated_at = now()
    FROM public.users u
    WHERE lower(trim(u.email)) = lower(trim(v.seller_email))
      AND u.plan_expires_at IS NOT NULL
      AND u.plan_expires_at < now()
      AND v.status = 'published'
    RETURNING v.id
  )
  SELECT expired_count + count(*) INTO expired_count FROM seller_expired;

  RETURN expired_count;
END;
$$;

COMMENT ON FUNCTION public.expire_stale_listings() IS
  'Marks published vehicles as expired when listing_expires_at or seller plan has passed. Call periodically.';

-- 9. Update RLS policy on vehicles to hide expired listings from anonymous/buyer view
-- Drop the existing policy first
DROP POLICY IF EXISTS "Vehicles read access" ON public.vehicles;

-- Create updated policy: public can only see published + non-expired vehicles
-- Sellers can see their own vehicles. Admins can see all.
CREATE POLICY "Vehicles read access" ON public.vehicles
  FOR SELECT
  USING (
    -- Admins see everything
    (EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (SELECT auth.uid())::text
        AND u.role = 'admin'
    ))
    OR
    -- Sellers see their own vehicles (all statuses)
    (EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (SELECT auth.uid())::text
        AND lower(trim(u.email)) = lower(trim(vehicles.seller_email))
    ))
    OR
    -- Public: only published vehicles that are NOT expired
    (
      status = 'published'
      AND (listing_status IS NULL OR listing_status = 'active')
      AND (listing_expires_at IS NULL OR listing_expires_at > now())
    )
  );

-- 10. Enable pg_cron extension (if available on your Supabase plan)
-- Uncomment the lines below if you're on a paid Supabase plan:
--
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule(
--   'expire-stale-listings',
--   '0 * * * *',  -- Every hour
--   $$SELECT public.expire_stale_listings()$$
-- );

-- 11. Run the expiry function once right now to clean up
SELECT public.expire_stale_listings();
