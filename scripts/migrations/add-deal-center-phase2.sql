    -- Deal Center Phase 2: kanban status, admin assignment, notes, normalized offers/documents
    -- Run after add-deal-pipeline.sql

    ALTER TABLE deal_leads
        ADD COLUMN IF NOT EXISTS kanban_status TEXT,
        ADD COLUMN IF NOT EXISTS assigned_admin_email TEXT,
        ADD COLUMN IF NOT EXISTS seller_notes TEXT,
        ADD COLUMN IF NOT EXISTS internal_notes TEXT;

    CREATE INDEX IF NOT EXISTS idx_deal_leads_kanban ON deal_leads(kanban_status);
    CREATE INDEX IF NOT EXISTS idx_deal_leads_assigned_admin ON deal_leads(assigned_admin_email);

    CREATE TABLE IF NOT EXISTS deal_offers (
        id TEXT PRIMARY KEY,
        lead_id TEXT NOT NULL REFERENCES deal_leads(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL,
        offered_by TEXT NOT NULL CHECK (offered_by IN ('buyer', 'seller')),
        status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'accepted', 'rejected', 'countered')),
        parent_offer_id TEXT REFERENCES deal_offers(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_deal_offers_lead ON deal_offers(lead_id);

    CREATE TABLE IF NOT EXISTS deal_documents (
        id TEXT PRIMARY KEY,
        lead_id TEXT NOT NULL REFERENCES deal_leads(id) ON DELETE CASCADE,
        doc_type TEXT NOT NULL
            CHECK (doc_type IN ('token_receipt', 'sale_agreement', 'delivery_note', 'rc_transfer', 'inspection_report')),
        url TEXT NOT NULL,
        uploaded_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_deal_documents_lead ON deal_documents(lead_id);

    ALTER TABLE deal_offers ENABLE ROW LEVEL SECURITY;
    ALTER TABLE deal_documents ENABLE ROW LEVEL SECURITY;

    -- Backfill kanban_status from current_stage for existing rows
    UPDATE deal_leads SET kanban_status = CASE
        WHEN status = 'cancelled' THEN 'cancelled'
        WHEN status = 'completed' OR current_stage = 'deal_completed' THEN 'completed'
        WHEN current_stage IN ('rc_pending', 'rc_completed') THEN 'rc_transfer'
        WHEN current_stage IN ('delivery_completed', 'documents_pending', 'documents_completed') THEN 'vehicle_delivered'
        WHEN current_stage IN ('token_uploaded', 'token_confirmed', 'delivery_pending') THEN 'payment_pending'
        WHEN current_stage IN ('inspection_requested', 'inspection_completed') THEN 'inspection'
        WHEN current_stage IN ('offer_made', 'offer_accepted') THEN 'offer_sent'
        WHEN current_stage IN ('test_drive_scheduled', 'test_drive_completed', 'chat_accepted') THEN 'chat_started'
        WHEN chat_status = 'pending' THEN 'buyer_contacted'
        ELSE 'lead_created'
    END
    WHERE kanban_status IS NULL;
