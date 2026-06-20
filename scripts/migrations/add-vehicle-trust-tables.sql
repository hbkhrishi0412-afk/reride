-- Vehicle trust: deals, peer ratings, buyer inspections, disclosure flags
-- Run after complete-supabase-schema.sql

CREATE TABLE IF NOT EXISTS vehicle_trust_deals (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    seller_email TEXT NOT NULL,
    buyer_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_buyer_confirm'
        CHECK (status IN ('pending_buyer_confirm', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    seller_confirmed_at TIMESTAMPTZ,
    buyer_confirmed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_vehicle_trust_deals_vehicle ON vehicle_trust_deals(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_trust_deals_seller ON vehicle_trust_deals(seller_email);
CREATE INDEX IF NOT EXISTS idx_vehicle_trust_deals_buyer ON vehicle_trust_deals(buyer_email);
CREATE INDEX IF NOT EXISTS idx_vehicle_trust_deals_status ON vehicle_trust_deals(status);

CREATE TABLE IF NOT EXISTS peer_ratings (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL REFERENCES vehicle_trust_deals(id) ON DELETE CASCADE,
    rater_email TEXT NOT NULL,
    rated_email TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (deal_id, rater_email)
);

CREATE INDEX IF NOT EXISTS idx_peer_ratings_rated ON peer_ratings(rated_email);

CREATE TABLE IF NOT EXISTS buyer_inspections (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    buyer_email TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    flagged_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
    general_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyer_inspections_vehicle ON buyer_inspections(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_buyer_inspections_buyer ON buyer_inspections(buyer_email);

CREATE TABLE IF NOT EXISTS disclosure_flags (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    seller_email TEXT NOT NULL,
    buyer_email TEXT NOT NULL,
    inspection_id TEXT REFERENCES buyer_inspections(id) ON DELETE SET NULL,
    flagged_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disclosure_flags_seller ON disclosure_flags(seller_email);

ALTER TABLE vehicle_trust_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE peer_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE disclosure_flags ENABLE ROW LEVEL SECURITY;

-- Pre-purchase inspection service catalog entry
INSERT INTO services (id, name, display_name, description, base_price, min_price, max_price, price_range, icon_name, active, display_order, metadata)
VALUES (
    'pre-purchase-inspection',
    'Pre-Purchase Inspection',
    'Pre-Purchase Inspection',
    'Independent used-car inspection before you buy. Pay the mechanic directly — ReRide connects you with local experts.',
    0,
    0,
    0,
    'Pay mechanic directly',
    'clipboard-check',
    true,
    0,
    '{"category":"diagnostics","isPrePurchaseInspection":true,"leadOnly":true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    price_range = EXCLUDED.price_range,
    metadata = EXCLUDED.metadata,
    display_order = 0,
    updated_at = NOW();
