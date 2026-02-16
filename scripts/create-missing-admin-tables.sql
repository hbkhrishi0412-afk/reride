-- ============================================================================
-- Create Missing Admin Tables (Supabase)
-- ============================================================================
-- Run this in Supabase SQL Editor to ensure admin modules persist correctly.

-- FAQs
CREATE TABLE IF NOT EXISTS faqs (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Support Tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  "userEmail" TEXT NOT NULL,
  "userName" TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open',
  replies JSONB DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Sell Car Submissions
CREATE TABLE IF NOT EXISTS sell_car_submissions (
  id TEXT PRIMARY KEY,
  registration TEXT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  variant TEXT,
  year TEXT,
  district TEXT,
  "noOfOwners" TEXT,
  kilometers TEXT,
  "fuelType" TEXT,
  transmission TEXT,
  "customerContact" TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  "adminNotes" TEXT,
  "estimatedPrice" NUMERIC,
  "submittedAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Requests
CREATE TABLE IF NOT EXISTS payment_requests (
  id TEXT PRIMARY KEY,
  "sellerEmail" TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  plan TEXT NOT NULL,
  "packageId" TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  "adminEmail" TEXT,
  notes TEXT,
  "rejectionReason" TEXT,
  "reviewedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_faqs_category ON faqs(category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_email ON support_tickets("userEmail");
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_sell_car_submissions_status ON sell_car_submissions(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_seller_email ON payment_requests("sellerEmail");
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);

-- Enable RLS (service role in API bypasses this, but keep enabled for consistency)
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sell_car_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

-- Ensure plans table supports admin panel fields
ALTER TABLE plans ADD COLUMN IF NOT EXISTS "listingLimit" INTEGER DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS "featuredCredits" INTEGER DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS "freeCertifications" INTEGER DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS "isMostPopular" BOOLEAN DEFAULT false;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE plans ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();


