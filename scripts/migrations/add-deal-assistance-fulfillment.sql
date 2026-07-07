-- Deal assistance fulfillment: index for ops queue queries on metadata
-- Run after add-deal-pipeline.sql

CREATE INDEX IF NOT EXISTS idx_deal_leads_assistance_package
    ON deal_leads ((metadata->>'assistancePackage'))
    WHERE metadata ? 'assistancePackage';

CREATE INDEX IF NOT EXISTS idx_deal_leads_assistance_status
    ON deal_leads ((metadata->'assistanceFulfillment'->>'status'))
    WHERE metadata ? 'assistanceFulfillment';
