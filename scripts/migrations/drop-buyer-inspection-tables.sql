-- Optional cleanup: buyer verification checklists are no longer collected in the app.
-- Run only after confirming you do not need historical rows in these tables.
--
-- Keeps: vehicle_trust_deals, peer_ratings (still used for deal confirmation flow)
-- Drops: buyer_inspections, disclosure_flags (only populated by removed buyer checklist feature)

DROP TABLE IF EXISTS disclosure_flags;
DROP TABLE IF EXISTS buyer_inspections;
