-- ============================================================================
-- Fix conversations RLS so Realtime + SELECT work for buyers/sellers
-- ============================================================================
-- Problem: policies used (auth.uid())::text = customer_id, but public.users.id
-- is often email_key (e.g. customer@test_com), not auth.users UUID. Then RLS
-- denies rows → Supabase Realtime postgres_changes never reach the customer
-- when the seller sends a message (API still works via service role).
--
-- Fix: allow access when JWT email matches public.users.email for the row's
-- customer_id / seller_id, OR when id columns store auth UUID as text.
--
-- Run in Supabase SQL Editor (Dashboard → SQL) after reviewing.
-- ============================================================================

DROP POLICY IF EXISTS "Conversations read access" ON conversations;
DROP POLICY IF EXISTS "Conversations insert access" ON conversations;
DROP POLICY IF EXISTS "Conversations update access" ON conversations;

-- Shared: current JWT email (lowercase), empty if missing
-- Participant: user's public.users row matches JWT email and equals FK on conversation

CREATE POLICY "Conversations read access"
ON conversations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.role = 'admin'
      AND u.email IS NOT NULL
      AND lower(trim(u.email)) = lower(trim(coalesce((auth.jwt() ->> 'email')::text, '')))
      AND coalesce(trim((auth.jwt() ->> 'email')::text), '') <> ''
  )
  OR (select auth.uid())::text = customer_id
  OR (select auth.uid())::text = seller_id
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = conversations.customer_id
      AND u.email IS NOT NULL
      AND lower(trim(u.email)) = lower(trim(coalesce((auth.jwt() ->> 'email')::text, '')))
      AND coalesce(trim((auth.jwt() ->> 'email')::text), '') <> ''
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = conversations.seller_id
      AND u.email IS NOT NULL
      AND lower(trim(u.email)) = lower(trim(coalesce((auth.jwt() ->> 'email')::text, '')))
      AND coalesce(trim((auth.jwt() ->> 'email')::text), '') <> ''
  )
);

CREATE POLICY "Conversations insert access"
ON conversations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.role = 'admin'
      AND u.email IS NOT NULL
      AND lower(trim(u.email)) = lower(trim(coalesce((auth.jwt() ->> 'email')::text, '')))
      AND coalesce(trim((auth.jwt() ->> 'email')::text), '') <> ''
  )
  OR (select auth.uid())::text = customer_id
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = customer_id
      AND u.email IS NOT NULL
      AND lower(trim(u.email)) = lower(trim(coalesce((auth.jwt() ->> 'email')::text, '')))
      AND coalesce(trim((auth.jwt() ->> 'email')::text), '') <> ''
  )
);

CREATE POLICY "Conversations update access"
ON conversations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.role = 'admin'
      AND u.email IS NOT NULL
      AND lower(trim(u.email)) = lower(trim(coalesce((auth.jwt() ->> 'email')::text, '')))
      AND coalesce(trim((auth.jwt() ->> 'email')::text), '') <> ''
  )
  OR (select auth.uid())::text = customer_id
  OR (select auth.uid())::text = seller_id
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = conversations.customer_id
      AND u.email IS NOT NULL
      AND lower(trim(u.email)) = lower(trim(coalesce((auth.jwt() ->> 'email')::text, '')))
      AND coalesce(trim((auth.jwt() ->> 'email')::text), '') <> ''
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = conversations.seller_id
      AND u.email IS NOT NULL
      AND lower(trim(u.email)) = lower(trim(coalesce((auth.jwt() ->> 'email')::text, '')))
      AND coalesce(trim((auth.jwt() ->> 'email')::text), '') <> ''
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.role = 'admin'
      AND u.email IS NOT NULL
      AND lower(trim(u.email)) = lower(trim(coalesce((auth.jwt() ->> 'email')::text, '')))
      AND coalesce(trim((auth.jwt() ->> 'email')::text), '') <> ''
  )
  OR (select auth.uid())::text = customer_id
  OR (select auth.uid())::text = seller_id
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = customer_id
      AND u.email IS NOT NULL
      AND lower(trim(u.email)) = lower(trim(coalesce((auth.jwt() ->> 'email')::text, '')))
      AND coalesce(trim((auth.jwt() ->> 'email')::text), '') <> ''
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = seller_id
      AND u.email IS NOT NULL
      AND lower(trim(u.email)) = lower(trim(coalesce((auth.jwt() ->> 'email')::text, '')))
      AND coalesce(trim((auth.jwt() ->> 'email')::text), '') <> ''
  )
);

COMMENT ON POLICY "Conversations read access" ON conversations IS
  'SELECT for Realtime: match auth.uid() to FK text id OR JWT email to public.users.email';
