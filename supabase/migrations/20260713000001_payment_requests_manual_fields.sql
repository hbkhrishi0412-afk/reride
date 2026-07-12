-- Add columns required by manual / Razorpay payment request flows
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS "planId" TEXT;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS "paymentProof" TEXT;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS "transactionId" TEXT;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS "requestedAt" TIMESTAMPTZ;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMPTZ;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMPTZ;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS "rejectedBy" TEXT;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS "razorpayOrderId" TEXT;

-- Backfill planId from legacy plan column
UPDATE payment_requests
SET "planId" = plan
WHERE "planId" IS NULL AND plan IS NOT NULL;

-- Backfill requestedAt from createdAt
UPDATE payment_requests
SET "requestedAt" = "createdAt"
WHERE "requestedAt" IS NULL AND "createdAt" IS NOT NULL;
