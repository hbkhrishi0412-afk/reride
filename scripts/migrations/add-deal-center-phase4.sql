-- Deal Center Phase 4: complaints linked to deals, mechanic inspection bookings
-- Run after add-deal-center-phase2.sql

CREATE TABLE IF NOT EXISTS deal_complaints (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL REFERENCES deal_leads(id) ON DELETE CASCADE,
    reporter_email TEXT NOT NULL,
    category TEXT NOT NULL
        CHECK (category IN (
            'payment_issue', 'vehicle_mismatch', 'seller_behavior',
            'buyer_behavior', 'documentation', 'other'
        )),
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
    admin_notes TEXT,
    resolved_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deal_complaints_lead ON deal_complaints(lead_id);
CREATE INDEX IF NOT EXISTS idx_deal_complaints_status ON deal_complaints(status);

CREATE TABLE IF NOT EXISTS deal_inspection_bookings (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL REFERENCES deal_leads(id) ON DELETE CASCADE,
    booked_by TEXT NOT NULL,
    scheduled_date TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    address TEXT NOT NULL,
    notes TEXT,
    mechanic_name TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_inspection_lead ON deal_inspection_bookings(lead_id);
CREATE INDEX IF NOT EXISTS idx_deal_inspection_status ON deal_inspection_bookings(status);

ALTER TABLE deal_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_inspection_bookings ENABLE ROW LEVEL SECURITY;
