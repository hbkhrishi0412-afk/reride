-- ============================================================================
-- ReRide — Enable Row Level Security (Production)
-- ============================================================================
-- Run this ONCE in the Supabase SQL Editor before going live. It is idempotent:
-- running it a second time replaces the existing policies.
--
-- Threat model: if the VITE_SUPABASE_ANON_KEY ever leaks (baked into every
-- client bundle), an attacker can query the database directly. RLS makes sure
-- the anon role can only see public data, and the authenticated role can only
-- see their own rows. The API continues to work unchanged because it uses the
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
--
-- This is the single, consolidated policy script. It covers:
--   - all public.* tables (users, vehicles, conversations, messages,
--     notifications, service_requests, service_providers, plans, new_cars,
--     app_config, push_device_tokens, services, faqs, support_tickets,
--     sell_car_submissions, payment_requests, buyer_activity,
--     service_request_audit_logs)
--   - storage.objects for the 'Images' bucket (INSERT/UPDATE/DELETE; SELECT
--     only for authenticated — not public/anon — see storage section)
--
-- The older per-concern scripts below are superseded and kept only for
-- history — do NOT run them after this one, they would create duplicate
-- policies with the old names:
--   - scripts/fix-rls-performance-issues.sql
--   - scripts/fix-users-rls-policies.sql
--   - scripts/fix-conversations-rls-realtime.sql
--   - scripts/fix-rls-issue-now.sql
--   - scripts/fix-storage-rls-policies.sql
--   - scripts/add-push-device-tokens.sql (now only creates the table; RLS here)
--   - scripts/add-service-request-audit-and-metrics.sql (same — table only)
--   - scripts/add-buyer-activity-table.sql (same — table only)
--
-- ----------------------------------------------------------------------------
-- Supabase dashboard warnings that CANNOT be fixed in SQL — do these by hand:
--
--   1. "Public Bucket Allows Listing" on storage.Images
--      Do NOT add a broad FOR SELECT policy for role `anon` on storage.objects.
--      Keep the bucket Public if you want .../object/public/Images/... URLs;
--      public buckets already serve files without that policy. An anon SELECT
--      policy is what enables `list()` / enumeration of every path (the linter
--      warning). Use authenticated-only SELECT if clients need delete/upsert.
--
--   2. "Leaked Password Protection Disabled"
--      Dashboard → Authentication → Policies → enable
--      "Check passwords against HaveIBeenPwned". Zero code changes needed.
-- ----------------------------------------------------------------------------
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Ensure RLS is enabled on every user-facing table.
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vehicles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS new_cars           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS plans              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS service_providers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS service_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS app_config         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS push_device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS services                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS faqs                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS support_tickets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sell_car_submissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payment_requests            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS buyer_activity              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS service_request_audit_logs  ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 0b. Columns referenced by policies (older DBs may predate these columns)
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published';
ALTER TABLE IF EXISTS service_providers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- ----------------------------------------------------------------------------
-- 0c. Nuke EVERY pre-existing policy on the tables we own.
--     Older scripts left policies with other names ("Users can view own X",
--     "Admins can manage all X", etc.) that show up in Supabase linter as
--     "Multiple Permissive Policies". We drop them all first and recreate
--     exactly the set we want below. This keeps re-runs clean.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
    target_tables TEXT[] := ARRAY[
      'users', 'vehicles', 'conversations', 'messages', 'notifications',
      'service_requests', 'service_providers', 'plans', 'new_cars', 'app_config',
      'push_device_tokens', 'services', 'faqs', 'support_tickets',
      'sell_car_submissions', 'payment_requests', 'buyer_activity',
      'service_request_audit_logs'
    ];
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY(target_tables)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Also nuke every Images-bucket policy on storage.objects (by name pattern).
-- Supabase ships with default policies for public buckets; we replace them.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        qual::text LIKE '%''Images''%'
        OR with_check::text LIKE '%''Images''%'
        OR lower(policyname) LIKE '%image%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- 1. USERS
--    - admins: read/update all
--    - authenticated owner: read/update own
--    - anon: read active users only (needed for public seller profiles)
-- ============================================================================
DROP POLICY IF EXISTS "Users read access"    ON users;
DROP POLICY IF EXISTS "Users update access"  ON users;
DROP POLICY IF EXISTS "Admins can read all users"    ON users;
DROP POLICY IF EXISTS "Users can read own data"      ON users;
DROP POLICY IF EXISTS "Public can read active users" ON users;
DROP POLICY IF EXISTS "Admins can update all users"  ON users;
DROP POLICY IF EXISTS "Users can update own data"    ON users;

CREATE POLICY "Users read access"
ON users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users AS u
    WHERE u.id = (SELECT auth.uid())::text
      AND u.role = 'admin'
  )
  OR (SELECT auth.uid())::text = id
  OR status = 'active'
);

CREATE POLICY "Users update access"
ON users
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users AS u
    WHERE u.id = (SELECT auth.uid())::text
      AND u.role = 'admin'
  )
  OR (SELECT auth.uid())::text = id
);

-- ============================================================================
-- 2. VEHICLES
--    - anon: read published
--    - seller (matched by email): read/insert/update/delete own
--    - admin: all
-- ============================================================================
DROP POLICY IF EXISTS "Vehicles read access"   ON vehicles;
DROP POLICY IF EXISTS "Vehicles insert access" ON vehicles;
DROP POLICY IF EXISTS "Vehicles update access" ON vehicles;
DROP POLICY IF EXISTS "Vehicles delete access" ON vehicles;

CREATE POLICY "Vehicles read access"
ON vehicles
FOR SELECT
USING (
  status = 'published'
  OR EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND u.role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND lower(trim(u.email)) = lower(trim(vehicles.seller_email))
  )
);

CREATE POLICY "Vehicles insert access"
ON vehicles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND (u.role = 'admin' OR lower(trim(u.email)) = lower(trim(vehicles.seller_email)))
  )
);

CREATE POLICY "Vehicles update access"
ON vehicles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND (u.role = 'admin' OR lower(trim(u.email)) = lower(trim(vehicles.seller_email)))
  )
);

CREATE POLICY "Vehicles delete access"
ON vehicles
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND (u.role = 'admin' OR lower(trim(u.email)) = lower(trim(vehicles.seller_email)))
  )
);

-- ============================================================================
-- 3. CONVERSATIONS
--    Email-fallback matching because public.users.id may be email_key, not
--    auth.uid(), for users registered via the custom JWT flow.
-- ============================================================================
DROP POLICY IF EXISTS "Conversations read access"   ON conversations;
DROP POLICY IF EXISTS "Conversations insert access" ON conversations;
DROP POLICY IF EXISTS "Conversations update access" ON conversations;

CREATE POLICY "Conversations read access"
ON conversations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND u.role = 'admin'
  )
  OR (SELECT auth.uid())::text = customer_id
  OR (SELECT auth.uid())::text = seller_id
  OR EXISTS (
    SELECT 1 FROM users u
    WHERE u.id IN (conversations.customer_id, conversations.seller_id)
      AND u.email IS NOT NULL
      AND lower(trim(u.email)) = lower(trim(coalesce(((SELECT auth.jwt()) ->> 'email')::text, '')))
      AND coalesce(trim(((SELECT auth.jwt()) ->> 'email')::text), '') <> ''
  )
);

CREATE POLICY "Conversations insert access"
ON conversations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND u.role = 'admin'
  )
  OR (SELECT auth.uid())::text = customer_id
  OR EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = conversations.customer_id
      AND u.email IS NOT NULL
      AND lower(trim(u.email)) = lower(trim(coalesce(((SELECT auth.jwt()) ->> 'email')::text, '')))
      AND coalesce(trim(((SELECT auth.jwt()) ->> 'email')::text), '') <> ''
  )
);

CREATE POLICY "Conversations update access"
ON conversations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND u.role = 'admin'
  )
  OR (SELECT auth.uid())::text = customer_id
  OR (SELECT auth.uid())::text = seller_id
  OR EXISTS (
    SELECT 1 FROM users u
    WHERE u.id IN (conversations.customer_id, conversations.seller_id)
      AND u.email IS NOT NULL
      AND lower(trim(u.email)) = lower(trim(coalesce(((SELECT auth.jwt()) ->> 'email')::text, '')))
      AND coalesce(trim(((SELECT auth.jwt()) ->> 'email')::text), '') <> ''
  )
);

-- ============================================================================
-- 4. MESSAGES  — participants of the parent conversation only
-- ============================================================================
DROP POLICY IF EXISTS "Messages read access"   ON messages;
DROP POLICY IF EXISTS "Messages insert access" ON messages;

CREATE POLICY "Messages read access"
ON messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND u.role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
      AND (
        c.customer_id = (SELECT auth.uid())::text
        OR c.seller_id = (SELECT auth.uid())::text
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.id IN (c.customer_id, c.seller_id)
            AND u.email IS NOT NULL
            AND lower(trim(u.email)) = lower(trim(coalesce(((SELECT auth.jwt()) ->> 'email')::text, '')))
            AND coalesce(trim(((SELECT auth.jwt()) ->> 'email')::text), '') <> ''
        )
      )
  )
);

CREATE POLICY "Messages insert access"
ON messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND u.role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
      AND (
        c.customer_id = (SELECT auth.uid())::text
        OR c.seller_id = (SELECT auth.uid())::text
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.id IN (c.customer_id, c.seller_id)
            AND u.email IS NOT NULL
            AND lower(trim(u.email)) = lower(trim(coalesce(((SELECT auth.jwt()) ->> 'email')::text, '')))
            AND coalesce(trim(((SELECT auth.jwt()) ->> 'email')::text), '') <> ''
        )
      )
  )
);

-- ============================================================================
-- 5. NOTIFICATIONS
-- ============================================================================
DROP POLICY IF EXISTS "Notifications read access"   ON notifications;
DROP POLICY IF EXISTS "Notifications insert access" ON notifications;
DROP POLICY IF EXISTS "Notifications update access" ON notifications;

CREATE POLICY "Notifications read access"
ON notifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND u.role = 'admin'
  )
  OR (SELECT auth.uid())::text = user_id
);

CREATE POLICY "Notifications insert access"
ON notifications
FOR INSERT
WITH CHECK (
  -- Creation of notifications is almost always done by the API via service role
  -- (which bypasses RLS). This policy is a belt-and-suspenders for authenticated
  -- clients — limit to admins + self-targeted notifications.
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND u.role = 'admin'
  )
  OR (SELECT auth.uid())::text = user_id
);

CREATE POLICY "Notifications update access"
ON notifications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND u.role = 'admin'
  )
  OR (SELECT auth.uid())::text = user_id
);

-- ============================================================================
-- 6. SERVICE_REQUESTS  — owner, assigned provider, admins
-- ============================================================================
DROP POLICY IF EXISTS "Service requests read access"   ON service_requests;
DROP POLICY IF EXISTS "Service requests insert access" ON service_requests;
DROP POLICY IF EXISTS "Service requests update access" ON service_requests;

CREATE POLICY "Service requests read access"
ON service_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND u.role = 'admin'
  )
  OR (SELECT auth.uid())::text = user_id
  OR (SELECT auth.uid())::text = provider_id
);

CREATE POLICY "Service requests insert access"
ON service_requests
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND u.role = 'admin'
  )
  OR (SELECT auth.uid())::text = user_id
);

CREATE POLICY "Service requests update access"
ON service_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND u.role = 'admin'
  )
  OR (SELECT auth.uid())::text = user_id
  OR (SELECT auth.uid())::text = provider_id
);

-- ============================================================================
-- 7. SERVICE_PROVIDERS — public directory
--    Anyone can browse active providers. Only admins and the provider owner can
--    modify. The `email` column is used to match the provider owner.
-- ============================================================================
DROP POLICY IF EXISTS "Service providers read access"   ON service_providers;
DROP POLICY IF EXISTS "Service providers update access" ON service_providers;

CREATE POLICY "Service providers read access"
ON service_providers
FOR SELECT
USING (
  coalesce(status, 'active') = 'active'
  OR EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND u.role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND u.email IS NOT NULL
      AND service_providers.email IS NOT NULL
      AND lower(trim(u.email)) = lower(trim(service_providers.email))
  )
);

CREATE POLICY "Service providers update access"
ON service_providers
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND (
        u.role = 'admin'
        OR (
          u.email IS NOT NULL
          AND service_providers.email IS NOT NULL
          AND lower(trim(u.email)) = lower(trim(service_providers.email))
        )
      )
  )
);

-- ============================================================================
-- 8. PLANS — public read (pricing page)
-- ============================================================================
DROP POLICY IF EXISTS "Plans read access" ON plans;

CREATE POLICY "Plans read access"
ON plans
FOR SELECT
USING (true);

-- ============================================================================
-- 9. NEW_CARS — public read (browse new cars)
-- ============================================================================
DROP POLICY IF EXISTS "New cars read access" ON new_cars;

CREATE POLICY "New cars read access"
ON new_cars
FOR SELECT
USING (true);

-- ============================================================================
-- 10. APP_CONFIG — public read, admin write
--     Use separate per-action policies instead of FOR ALL so the read policy
--     doesn't collide with SELECT-from-ALL in Supabase's "Multiple Permissive
--     Policies" linter.
-- ============================================================================
CREATE POLICY "App config read access"
ON app_config
FOR SELECT
USING (true);

CREATE POLICY "App config insert access"
ON app_config
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND u.role = 'admin'
  )
);

CREATE POLICY "App config update access"
ON app_config
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND u.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND u.role = 'admin'
  )
);

CREATE POLICY "App config delete access"
ON app_config
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text
      AND u.role = 'admin'
  )
);

-- ============================================================================
-- 10b. PUSH_DEVICE_TOKENS
--     Optional table created by scripts/add-push-device-tokens.sql for native
--     FCM/APNs push. Only the signed-in owner (matched by email) can see or
--     mutate their own row. All auth.*() calls are wrapped in (SELECT ...) to
--     avoid the "Auth RLS Initialization Plan" performance warning.
--
--     If you don't use push_device_tokens, these CREATE POLICY calls are no-ops
--     because the table won't exist (we ALTER TABLE IF EXISTS it above and
--     pg_policies won't have rows for a missing table). To be extra safe the
--     whole block is wrapped in a to_regclass guard.
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.push_device_tokens') IS NOT NULL THEN
    EXECUTE $POLICY$
      CREATE POLICY "Push tokens read access"
      ON push_device_tokens
      FOR SELECT
      TO authenticated
      USING (LOWER(user_email) = LOWER((SELECT auth.jwt()) ->> 'email'))
    $POLICY$;

    EXECUTE $POLICY$
      CREATE POLICY "Push tokens insert access"
      ON push_device_tokens
      FOR INSERT
      TO authenticated
      WITH CHECK (LOWER(user_email) = LOWER((SELECT auth.jwt()) ->> 'email'))
    $POLICY$;

    EXECUTE $POLICY$
      CREATE POLICY "Push tokens update access"
      ON push_device_tokens
      FOR UPDATE
      TO authenticated
      USING (LOWER(user_email) = LOWER((SELECT auth.jwt()) ->> 'email'))
      WITH CHECK (LOWER(user_email) = LOWER((SELECT auth.jwt()) ->> 'email'))
    $POLICY$;

    EXECUTE $POLICY$
      CREATE POLICY "Push tokens delete access"
      ON push_device_tokens
      FOR DELETE
      TO authenticated
      USING (LOWER(user_email) = LOWER((SELECT auth.jwt()) ->> 'email'))
    $POLICY$;
  END IF;
END $$;

-- ============================================================================
-- 10c. SERVICES (public catalog — created by create-services-table.sql)
--     Anyone can read active services; writes go through the API (service role).
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.services') IS NOT NULL THEN
    EXECUTE $POLICY$
      CREATE POLICY "Services read access"
      ON services
      FOR SELECT
      USING (active = true)
    $POLICY$;
  END IF;
END $$;

-- ============================================================================
-- 10d. FAQS (public knowledge base — created by create-missing-admin-tables.sql)
--     Anyone can read FAQs. Writes go through the API (service role).
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.faqs') IS NOT NULL THEN
    EXECUTE $POLICY$
      CREATE POLICY "Faqs read access"
      ON faqs
      FOR SELECT
      USING (true)
    $POLICY$;
  END IF;
END $$;

-- ============================================================================
-- 10e. SUPPORT_TICKETS (admin module)
--     Owner (by email) can read and create their own tickets. Admin can read
--     all. All writes use the API service role anyway, but the read policies
--     let the profile page render the user's ticket list directly.
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.support_tickets') IS NOT NULL THEN
    EXECUTE $POLICY$
      CREATE POLICY "Support tickets read access"
      ON support_tickets
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM users AS u
          WHERE u.id = (SELECT auth.uid())::text
            AND u.role = 'admin'
        )
        OR lower(trim("userEmail")) = lower(trim(coalesce(((SELECT auth.jwt()) ->> 'email')::text, '')))
      )
    $POLICY$;

    EXECUTE $POLICY$
      CREATE POLICY "Support tickets insert access"
      ON support_tickets
      FOR INSERT
      WITH CHECK (
        lower(trim("userEmail")) = lower(trim(coalesce(((SELECT auth.jwt()) ->> 'email')::text, '')))
      )
    $POLICY$;
  END IF;
END $$;

-- ============================================================================
-- 10f. SELL_CAR_SUBMISSIONS (admin module)
--     Admin-only. Service role handles the inserts from the public submission
--     form, so no anon/authenticated INSERT policy is needed.
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.sell_car_submissions') IS NOT NULL THEN
    EXECUTE $POLICY$
      CREATE POLICY "Sell car submissions read access"
      ON sell_car_submissions
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM users AS u
          WHERE u.id = (SELECT auth.uid())::text
            AND u.role = 'admin'
        )
      )
    $POLICY$;
  END IF;
END $$;

-- ============================================================================
-- 10g. PAYMENT_REQUESTS (admin module)
--     Seller (by email) can read their own payment requests; admin can read
--     all. Writes go through API (service role).
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.payment_requests') IS NOT NULL THEN
    EXECUTE $POLICY$
      CREATE POLICY "Payment requests read access"
      ON payment_requests
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM users AS u
          WHERE u.id = (SELECT auth.uid())::text
            AND u.role = 'admin'
        )
        OR lower(trim("sellerEmail")) = lower(trim(coalesce(((SELECT auth.jwt()) ->> 'email')::text, '')))
      )
    $POLICY$;
  END IF;
END $$;

-- ============================================================================
-- 10h. BUYER_ACTIVITY (personal buyer data)
--     Only the owner can see/mutate their own row. Same rules as the older
--     script but using (SELECT auth.uid()) so the auth function is evaluated
--     once per query instead of per row.
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.buyer_activity') IS NOT NULL THEN
    EXECUTE $POLICY$
      CREATE POLICY "Buyer activity read access"
      ON buyer_activity
      FOR SELECT
      USING ((SELECT auth.uid())::text = user_id)
    $POLICY$;

    EXECUTE $POLICY$
      CREATE POLICY "Buyer activity insert access"
      ON buyer_activity
      FOR INSERT
      WITH CHECK ((SELECT auth.uid())::text = user_id)
    $POLICY$;

    EXECUTE $POLICY$
      CREATE POLICY "Buyer activity update access"
      ON buyer_activity
      FOR UPDATE
      USING ((SELECT auth.uid())::text = user_id)
      WITH CHECK ((SELECT auth.uid())::text = user_id)
    $POLICY$;
  END IF;
END $$;

-- ============================================================================
-- 10i. SERVICE_REQUEST_AUDIT_LOGS (admin-only observability)
--     Read-only for admins. Inserts happen from the API (service role).
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('public.service_request_audit_logs') IS NOT NULL THEN
    EXECUTE $POLICY$
      CREATE POLICY "Service request audit logs read access"
      ON service_request_audit_logs
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE lower(trim(u.email)) = lower(trim(coalesce(((SELECT auth.jwt()) ->> 'email')::text, '')))
            AND u.role = 'admin'
        )
      )
    $POLICY$;
  END IF;
END $$;

-- ============================================================================
-- 11. STORAGE — Images bucket
--     Supabase Storage is a separate schema (`storage`), so table RLS above
--     does NOT apply to uploaded files. These policies control who can
--     read/upload/update/delete files in the 'Images' bucket used by the
--     vehicle photo uploader.
--
--     Change 'Images' below if your bucket is named differently. If you add
--     more buckets (e.g. 'Documents', 'Avatars'), duplicate this block per
--     bucket.
-- ============================================================================
-- Clean up every prior variant of these policies so re-runs are idempotent.
DROP POLICY IF EXISTS "Public can view images"               ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read Images objects" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own images"    ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own images"    ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;

-- No anon/public SELECT: it allows listing every object path while the bucket
-- is Public. Public URLs still work (see Storage bucket fundamentals).
-- Authenticated SELECT: Storage often needs this for client delete/upsert.
-- USING must not be ONLY `bucket_id = '…'` or Supabase linter 0025 flags it
-- ("Public Bucket Allows Listing") even with TO authenticated.
CREATE POLICY "Authenticated users can read Images objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'Images'
  AND (SELECT auth.role()) = 'authenticated'
);

-- Upload: only authenticated users. The API uses the service role (bypasses
-- RLS) when uploading server-side; this policy handles direct client uploads.
CREATE POLICY "Authenticated users can upload images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'Images'
  AND (SELECT auth.role()) = 'authenticated'
);

-- Update: owner (first folder segment = user's email) or admin.
-- Uploads are organized as `<email>/<filename>` so this pins files to owners.
CREATE POLICY "Users can update their own images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'Images'
  AND (
    ((SELECT auth.role()) = 'authenticated' AND (storage.foldername(name))[1] = (SELECT auth.email()))
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.email = (SELECT auth.email())
        AND users.role = 'admin'
    )
  )
)
WITH CHECK (
  bucket_id = 'Images'
  AND (
    ((SELECT auth.role()) = 'authenticated' AND (storage.foldername(name))[1] = (SELECT auth.email()))
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.email = (SELECT auth.email())
        AND users.role = 'admin'
    )
  )
);

-- Delete: same rules as update.
CREATE POLICY "Users can delete their own images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'Images'
  AND (
    ((SELECT auth.role()) = 'authenticated' AND (storage.foldername(name))[1] = (SELECT auth.email()))
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.email = (SELECT auth.email())
        AND users.role = 'admin'
    )
  )
);

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
  t TEXT;
  c INTEGER;
  tables TEXT[] := ARRAY[
    'users', 'vehicles', 'conversations', 'messages', 'notifications',
    'service_requests', 'service_providers', 'plans', 'new_cars', 'app_config',
    'push_device_tokens', 'services', 'faqs', 'support_tickets',
    'sell_car_submissions', 'payment_requests', 'buyer_activity',
    'service_request_audit_logs'
  ];
  storage_count INTEGER;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE '% skipped (table does not exist)', t;
      CONTINUE;
    END IF;
    SELECT COUNT(*) INTO c FROM pg_policies WHERE schemaname = 'public' AND tablename = t;
    RAISE NOTICE '% has % polic%', t, c, CASE WHEN c = 1 THEN 'y' ELSE 'ies' END;
  END LOOP;

  SELECT COUNT(*) INTO storage_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname IN (
      'Authenticated users can read Images objects',
      'Authenticated users can upload images',
      'Users can update their own images',
      'Users can delete their own images'
    );
  RAISE NOTICE 'storage.objects (Images bucket) has % of 4 expected policies', storage_count;

  RAISE NOTICE '✅ RLS production policies enabled.';
END $$;
