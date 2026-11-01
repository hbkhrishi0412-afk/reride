-- Sell-car client fields that the API whitelist already (or now) accepts.
ALTER TABLE public.sell_car_submissions
  ADD COLUMN IF NOT EXISTS "customerName" text,
  ADD COLUMN IF NOT EXISTS "customerEmail" text,
  ADD COLUMN IF NOT EXISTS "expectedPrice" numeric,
  ADD COLUMN IF NOT EXISTS "comments" text,
  ADD COLUMN IF NOT EXISTS "color" text,
  ADD COLUMN IF NOT EXISTS "insurance" text,
  ADD COLUMN IF NOT EXISTS "engineNumber" text,
  ADD COLUMN IF NOT EXISTS "chassisNumber" text,
  ADD COLUMN IF NOT EXISTS "condition" text,
  ADD COLUMN IF NOT EXISTS "sellerType" text,
  ADD COLUMN IF NOT EXISTS "vehicleImages" jsonb,
  ADD COLUMN IF NOT EXISTS "submittedBy" text;
