-- Post-completion return flow: returned → seller review → relist or archive
-- Run after add-deal-pipeline.sql

ALTER TABLE deal_leads
  ADD COLUMN IF NOT EXISTS return_status TEXT
    CHECK (return_status IS NULL OR return_status IN ('returned', 'relisted', 'archived'));

ALTER TABLE deal_leads ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;
ALTER TABLE deal_leads ADD COLUMN IF NOT EXISTS return_reason TEXT;
ALTER TABLE deal_leads ADD COLUMN IF NOT EXISTS return_reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_deal_leads_return_status
  ON deal_leads(return_status)
  WHERE return_status IS NOT NULL;

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS listing_cycle INTEGER NOT NULL DEFAULT 1;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_vehicles_listing_cycle ON vehicles(listing_cycle);
