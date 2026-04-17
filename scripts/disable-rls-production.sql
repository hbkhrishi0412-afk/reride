-- ============================================================================
-- ReRide — Emergency RLS disable (Production)
-- ============================================================================
-- Run this ONLY if enable-rls-production.sql caused a regression you can't
-- immediately debug. It drops the policies created by that script and leaves
-- RLS enabled on the tables (an empty policy set = deny all for non-service-role).
--
-- Your API still works (service role bypasses RLS), but client-side reads will
-- return empty results. This is a SAFE rollback — it does NOT leak data.
--
-- To fully turn off RLS (data becomes world-readable via the anon key), uncomment
-- the ALTER TABLE ... DISABLE statements at the bottom. Do NOT do this in prod.
-- ============================================================================

DROP POLICY IF EXISTS "Users read access"           ON users;
DROP POLICY IF EXISTS "Users update access"         ON users;

DROP POLICY IF EXISTS "Vehicles read access"        ON vehicles;
DROP POLICY IF EXISTS "Vehicles insert access"      ON vehicles;
DROP POLICY IF EXISTS "Vehicles update access"      ON vehicles;
DROP POLICY IF EXISTS "Vehicles delete access"      ON vehicles;

DROP POLICY IF EXISTS "Conversations read access"   ON conversations;
DROP POLICY IF EXISTS "Conversations insert access" ON conversations;
DROP POLICY IF EXISTS "Conversations update access" ON conversations;

DROP POLICY IF EXISTS "Messages read access"        ON messages;
DROP POLICY IF EXISTS "Messages insert access"      ON messages;

DROP POLICY IF EXISTS "Notifications read access"   ON notifications;
DROP POLICY IF EXISTS "Notifications insert access" ON notifications;
DROP POLICY IF EXISTS "Notifications update access" ON notifications;

DROP POLICY IF EXISTS "Service requests read access"   ON service_requests;
DROP POLICY IF EXISTS "Service requests insert access" ON service_requests;
DROP POLICY IF EXISTS "Service requests update access" ON service_requests;

DROP POLICY IF EXISTS "Service providers read access"   ON service_providers;
DROP POLICY IF EXISTS "Service providers update access" ON service_providers;

DROP POLICY IF EXISTS "Plans read access"           ON plans;
DROP POLICY IF EXISTS "New cars read access"        ON new_cars;
DROP POLICY IF EXISTS "App config read access"      ON app_config;
DROP POLICY IF EXISTS "App config insert access"    ON app_config;
DROP POLICY IF EXISTS "App config update access"    ON app_config;
DROP POLICY IF EXISTS "App config delete access"    ON app_config;
DROP POLICY IF EXISTS "App config write access"     ON app_config;  -- legacy name

-- Push device tokens (optional table)
DO $$
BEGIN
  IF to_regclass('public.push_device_tokens') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Push tokens read access"   ON push_device_tokens;
    DROP POLICY IF EXISTS "Push tokens insert access" ON push_device_tokens;
    DROP POLICY IF EXISTS "Push tokens update access" ON push_device_tokens;
    DROP POLICY IF EXISTS "Push tokens delete access" ON push_device_tokens;
  END IF;
END $$;

-- Supplemental tables (optional)
DO $$
BEGIN
  IF to_regclass('public.services') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Services read access" ON services;
  END IF;
  IF to_regclass('public.faqs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Faqs read access" ON faqs;
  END IF;
  IF to_regclass('public.support_tickets') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Support tickets read access"   ON support_tickets;
    DROP POLICY IF EXISTS "Support tickets insert access" ON support_tickets;
  END IF;
  IF to_regclass('public.sell_car_submissions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Sell car submissions read access" ON sell_car_submissions;
  END IF;
  IF to_regclass('public.payment_requests') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Payment requests read access" ON payment_requests;
  END IF;
  IF to_regclass('public.buyer_activity') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Buyer activity read access"   ON buyer_activity;
    DROP POLICY IF EXISTS "Buyer activity insert access" ON buyer_activity;
    DROP POLICY IF EXISTS "Buyer activity update access" ON buyer_activity;
  END IF;
  IF to_regclass('public.service_request_audit_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service request audit logs read access" ON service_request_audit_logs;
  END IF;
END $$;

-- Storage (Images bucket)
DROP POLICY IF EXISTS "Public can view images"                ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own images"     ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own images"     ON storage.objects;

-- ----------------------------------------------------------------------------
-- DANGER ZONE — fully disable RLS (data becomes world-readable via anon key).
-- Do NOT run in production. Uncomment only if you are absolutely sure.
-- ----------------------------------------------------------------------------
-- ALTER TABLE users              DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE vehicles           DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE conversations      DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE messages           DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE notifications      DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE new_cars           DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE plans              DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE service_providers  DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE service_requests   DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE app_config         DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  RAISE NOTICE 'RLS policies dropped. Tables remain RLS-enabled (deny-by-default for anon/authenticated).';
END $$;
