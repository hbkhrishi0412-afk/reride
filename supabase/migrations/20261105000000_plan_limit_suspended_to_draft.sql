-- Plan-limit overflow previously demoted listings to listing_status = 'suspended',
-- which the republish guard treated as "under review" and blocked permanently.
-- Suspended is for moderation only; convert non-flagged overflow rows to the
-- recoverable 'draft' state so sellers can republish them.
UPDATE public.vehicles
SET listing_status = 'draft',
    updated_at = now()
WHERE listing_status = 'suspended'
  AND COALESCE(is_flagged, false) = false;
