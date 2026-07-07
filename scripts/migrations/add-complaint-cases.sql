-- Platform grievance / complaint cases (Consumer Protection Act workflow)
-- Run after deal pipeline migrations. Distinct from deal_complaints (per-deal disputes).

CREATE TABLE IF NOT EXISTS complaint_cases (
    id TEXT PRIMARY KEY,
    reporter_email TEXT NOT NULL,
    reporter_name TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other'
        CHECK (category IN ('listing', 'user', 'payment', 'deal', 'other')),
    deal_lead_id TEXT REFERENCES deal_leads(id) ON DELETE SET NULL,
    vehicle_id TEXT,
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'investigating', 'resolved', 'escalated')),
    resolution TEXT,
    admin_notes TEXT,
    resolved_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_complaint_cases_status ON complaint_cases(status);
CREATE INDEX IF NOT EXISTS idx_complaint_cases_reporter ON complaint_cases(reporter_email);
CREATE INDEX IF NOT EXISTS idx_complaint_cases_created ON complaint_cases(created_at DESC);

ALTER TABLE complaint_cases ENABLE ROW LEVEL SECURITY;
