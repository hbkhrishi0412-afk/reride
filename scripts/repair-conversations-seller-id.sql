-- ============================================================================
-- Repair conversations missing seller_id (after partial-update bug cleared it)
-- ============================================================================
-- Run in Supabase Dashboard → SQL Editor (as postgres / service role).
--
-- Fills seller_id from vehicles.seller_email when vehicle_id matches vehicles.id.
-- Normalizes to lower(trim()) to match app queries (see supabase-conversation-service).
--
-- 1) Preview rows that would be updated (review before running UPDATE):
-- ============================================================================

SELECT
  c.id,
  c.vehicle_id,
  c.seller_id AS current_seller_id,
  lower(trim(v.seller_email)) AS repaired_seller_id,
  v.seller_name AS vehicle_seller_name,
  c.customer_id
FROM conversations c
INNER JOIN vehicles v ON v.id = c.vehicle_id
WHERE (c.seller_id IS NULL OR length(trim(c.seller_id)) = 0)
  AND v.seller_email IS NOT NULL
  AND length(trim(v.seller_email)) > 0;

-- ============================================================================
-- 2) Apply repair (run after preview looks correct):
-- ============================================================================

UPDATE conversations c
SET
  seller_id = lower(trim(v.seller_email)),
  seller_name = CASE
    WHEN c.seller_name IS NULL OR length(trim(c.seller_name)) = 0
    THEN v.seller_name
    ELSE c.seller_name
  END,
  updated_at = NOW()
FROM vehicles v
WHERE v.id = c.vehicle_id
  AND (c.seller_id IS NULL OR length(trim(c.seller_id)) = 0)
  AND v.seller_email IS NOT NULL
  AND length(trim(v.seller_email)) > 0;

-- ============================================================================
-- 3) Rows still missing seller_id (vehicle deleted, bad vehicle_id, etc.):
-- ============================================================================

SELECT c.id, c.vehicle_id, c.seller_id, c.customer_id, c.last_message_at
FROM conversations c
WHERE c.seller_id IS NULL OR length(trim(c.seller_id)) = 0
ORDER BY c.last_message_at DESC NULLS LAST;

-- For those, fix manually or restore the listing, then re-run section 2.
