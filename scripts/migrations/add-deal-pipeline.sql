-- Deal pipeline: leads (RR-LD-xxx), timeline events, follow-up surveys
-- Run after complete-supabase-schema.sql and add-vehicle-trust-tables.sql

CREATE TABLE IF NOT EXISTS deal_lead_sequence (
    id INTEGER PRIMARY KEY DEFAULT 1,
    next_val INTEGER NOT NULL DEFAULT 101,
    CONSTRAINT deal_lead_sequence_singleton CHECK (id = 1)
);

INSERT INTO deal_lead_sequence (id, next_val) VALUES (1, 101)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS deal_leads (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    seller_email TEXT NOT NULL,
    buyer_email TEXT NOT NULL,
    buyer_name TEXT,
    conversation_id TEXT,
    chat_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (chat_status IN ('pending', 'accepted', 'declined')),
    current_stage TEXT NOT NULL DEFAULT 'lead_created',
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'cancelled')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    trust_deal_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    chat_accepted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    UNIQUE (vehicle_id, buyer_email)
);

CREATE INDEX IF NOT EXISTS idx_deal_leads_seller ON deal_leads(seller_email);
CREATE INDEX IF NOT EXISTS idx_deal_leads_buyer ON deal_leads(buyer_email);
CREATE INDEX IF NOT EXISTS idx_deal_leads_vehicle ON deal_leads(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_deal_leads_stage ON deal_leads(current_stage);
CREATE INDEX IF NOT EXISTS idx_deal_leads_conversation ON deal_leads(conversation_id);

CREATE TABLE IF NOT EXISTS deal_timeline_events (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL REFERENCES deal_leads(id) ON DELETE CASCADE,
    stage TEXT NOT NULL,
    event_type TEXT NOT NULL,
    actor_email TEXT,
    label TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_timeline_lead ON deal_timeline_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_deal_timeline_created ON deal_timeline_events(created_at);

CREATE TABLE IF NOT EXISTS deal_surveys (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL REFERENCES deal_leads(id) ON DELETE CASCADE,
    due_at TIMESTAMPTZ NOT NULL,
    response TEXT CHECK (response IN ('yes', 'no', 'negotiating')),
    services_interested JSONB DEFAULT '[]'::jsonb,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_surveys_lead ON deal_surveys(lead_id);
CREATE INDEX IF NOT EXISTS idx_deal_surveys_due ON deal_surveys(due_at);

ALTER TABLE deal_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_surveys ENABLE ROW LEVEL SECURITY;
