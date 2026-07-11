-- Deal pipeline, platform, and API-only table RLS policies
-- Run after enable-rls-production.sql and deal/trust migrations.
-- Idempotent: drops named policies before recreate.

-- Helper: normalized JWT email (custom JWT + Supabase Auth)
CREATE OR REPLACE FUNCTION public.reride_auth_email()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT lower(trim(coalesce((auth.jwt() ->> 'email')::text, '')));
$$;

CREATE OR REPLACE FUNCTION public.reride_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())::text
      AND u.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.reride_is_deal_participant(p_buyer text, p_seller text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    public.reride_is_admin()
    OR (
      public.reride_auth_email() <> ''
      AND (
        lower(trim(coalesce(p_buyer, ''))) = public.reride_auth_email()
        OR lower(trim(coalesce(p_seller, ''))) = public.reride_auth_email()
      )
    );
$$;

-- Revoke public RPC execution on SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.expire_stale_listings() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_by_email() FROM PUBLIC, anon, authenticated;

-- Fix SECURITY DEFINER search_path on listing expiry (keep integer return — matches production)
CREATE OR REPLACE FUNCTION public.expire_stale_listings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.vehicles
    SET
      status = 'unpublished',
      listing_status = 'expired',
      updated_at = now()
    WHERE status = 'published'
      AND listing_expires_at IS NOT NULL
      AND listing_expires_at < now()
    RETURNING id
  )
  SELECT count(*) INTO expired_count FROM expired;

  WITH seller_expired AS (
    UPDATE public.vehicles v
    SET
      status = 'unpublished',
      listing_status = 'expired',
      updated_at = now()
    FROM public.users u
    WHERE lower(trim(u.email)) = lower(trim(v.seller_email))
      AND u.plan_expires_at IS NOT NULL
      AND u.plan_expires_at < now()
      AND v.status = 'published'
    RETURNING v.id
  )
  SELECT expired_count + count(*) INTO expired_count FROM seller_expired;

  RETURN expired_count;
END;
$$;

-- ── deal_leads ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Deal leads read" ON deal_leads;
DROP POLICY IF EXISTS "Deal leads write" ON deal_leads;

CREATE POLICY "Deal leads read"
ON deal_leads FOR SELECT
USING (public.reride_is_deal_participant(buyer_email, seller_email));

CREATE POLICY "Deal leads write"
ON deal_leads FOR ALL
USING (public.reride_is_deal_participant(buyer_email, seller_email))
WITH CHECK (public.reride_is_deal_participant(buyer_email, seller_email));

-- ── deal child tables (via lead) ───────────────────────────────────────────
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'deal_timeline_events',
    'deal_surveys',
    'deal_offers',
    'deal_documents',
    'deal_complaints',
    'deal_inspection_bookings'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Deal child read" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Deal child write" ON %I', tbl);
    EXECUTE format($p$
      CREATE POLICY "Deal child read" ON %I FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM deal_leads dl
          WHERE dl.id = %I.lead_id
            AND public.reride_is_deal_participant(dl.buyer_email, dl.seller_email)
        )
      )
    $p$, tbl, tbl);
    EXECUTE format($p$
      CREATE POLICY "Deal child write" ON %I FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM deal_leads dl
          WHERE dl.id = %I.lead_id
            AND public.reride_is_deal_participant(dl.buyer_email, dl.seller_email)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM deal_leads dl
          WHERE dl.id = %I.lead_id
            AND public.reride_is_deal_participant(dl.buyer_email, dl.seller_email)
        )
      )
    $p$, tbl, tbl, tbl);
  END LOOP;
END $$;

-- ── vehicle_trust_deals + peer_ratings ──────────────────────────────────────
DROP POLICY IF EXISTS "Trust deals read" ON vehicle_trust_deals;
DROP POLICY IF EXISTS "Trust deals write" ON vehicle_trust_deals;

CREATE POLICY "Trust deals read"
ON vehicle_trust_deals FOR SELECT
USING (public.reride_is_deal_participant(buyer_email, seller_email));

CREATE POLICY "Trust deals write"
ON vehicle_trust_deals FOR ALL
USING (public.reride_is_deal_participant(buyer_email, seller_email))
WITH CHECK (public.reride_is_deal_participant(buyer_email, seller_email));

DROP POLICY IF EXISTS "Peer ratings read" ON peer_ratings;
DROP POLICY IF EXISTS "Peer ratings write" ON peer_ratings;

CREATE POLICY "Peer ratings read"
ON peer_ratings FOR SELECT
USING (
  public.reride_is_admin()
  OR lower(trim(rater_email)) = public.reride_auth_email()
  OR lower(trim(rated_email)) = public.reride_auth_email()
);

CREATE POLICY "Peer ratings write"
ON peer_ratings FOR ALL
USING (
  public.reride_is_admin()
  OR lower(trim(rater_email)) = public.reride_auth_email()
)
WITH CHECK (
  public.reride_is_admin()
  OR lower(trim(rater_email)) = public.reride_auth_email()
);

-- ── complaint_cases ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Complaint cases read" ON complaint_cases;
DROP POLICY IF EXISTS "Complaint cases write" ON complaint_cases;

CREATE POLICY "Complaint cases read"
ON complaint_cases FOR SELECT
USING (
  public.reride_is_admin()
  OR lower(trim(reporter_email)) = public.reride_auth_email()
);

CREATE POLICY "Complaint cases write"
ON complaint_cases FOR ALL
USING (
  public.reride_is_admin()
  OR lower(trim(reporter_email)) = public.reride_auth_email()
)
WITH CHECK (
  public.reride_is_admin()
  OR lower(trim(reporter_email)) = public.reride_auth_email()
);

-- ── API-only: explicit deny for direct PostgREST access ──────────────────────
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'otp_verifications',
    'deal_lead_sequence',
    'platform_settings',
    'audit_log'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "No direct client access" ON %I', tbl);
    EXECUTE format($p$
      CREATE POLICY "No direct client access" ON %I
      FOR ALL TO authenticated, anon
      USING (false) WITH CHECK (false)
    $p$, tbl);
  END LOOP;
END $$;

-- ── web_push_subscriptions ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Web push owner access" ON web_push_subscriptions;

CREATE POLICY "Web push owner access"
ON web_push_subscriptions FOR ALL
USING (
  public.reride_is_admin()
  OR lower(trim(coalesce(user_email, ''))) = public.reride_auth_email()
)
WITH CHECK (
  public.reride_is_admin()
  OR lower(trim(coalesce(user_email, ''))) = public.reride_auth_email()
);

-- ── Missing FK indexes (performance advisor) ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_complaint_cases_deal_lead_id ON complaint_cases(deal_lead_id);
CREATE INDEX IF NOT EXISTS idx_deal_offers_parent_offer_id ON deal_offers(parent_offer_id);

-- ── vehicles.seller_email FK (skip if orphaned rows exist) ───────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_vehicles_seller_email'
  ) THEN
    BEGIN
      ALTER TABLE vehicles
        ADD CONSTRAINT fk_vehicles_seller_email
        FOREIGN KEY (seller_email) REFERENCES users(email) ON DELETE SET NULL;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'fk_vehicles_seller_email skipped: %', SQLERRM;
    END;
  END IF;
END $$;
