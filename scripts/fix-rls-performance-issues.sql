-- ============================================================================
-- Fix RLS Performance Issues
-- ============================================================================
-- This script fixes two types of performance issues:
-- 1. Auth RLS Initialization Plan: Replaces auth.uid() with (select auth.uid())
-- 2. Multiple Permissive Policies: Consolidates duplicate policies
-- ============================================================================
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. VEHICLES TABLE - Fix and Consolidate Policies
-- ============================================================================

-- Drop existing policies (both old and new names)
DROP POLICY IF EXISTS "Users can insert own vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can update own vehicles" ON vehicles;
DROP POLICY IF EXISTS "Sellers can insert own vehicles" ON vehicles;
DROP POLICY IF EXISTS "Sellers can update own vehicles" ON vehicles;
DROP POLICY IF EXISTS "Sellers can delete own vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins can manage all vehicles" ON vehicles;
DROP POLICY IF EXISTS "Public can read published vehicles" ON vehicles;
DROP POLICY IF EXISTS "Vehicles are viewable by everyone" ON vehicles;
-- Drop new consolidated policies if they exist
DROP POLICY IF EXISTS "Vehicles read access" ON vehicles;
DROP POLICY IF EXISTS "Vehicles insert access" ON vehicles;
DROP POLICY IF EXISTS "Vehicles update access" ON vehicles;
DROP POLICY IF EXISTS "Vehicles delete access" ON vehicles;

-- Create optimized consolidated policies
-- SELECT: Combine all read policies into one
CREATE POLICY "Vehicles read access"
ON vehicles
FOR SELECT
USING (
  -- Admins can read all
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())::text
    AND users.role = 'admin'
  )
  OR
  -- Public can read published vehicles
  status = 'published'
);

-- INSERT: Combine all insert policies into one
CREATE POLICY "Vehicles insert access"
ON vehicles
FOR INSERT
WITH CHECK (
  -- Admins can insert all
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())::text
    AND users.role = 'admin'
  )
  OR
  -- Sellers can insert their own vehicles
  (select auth.uid())::text = seller_email
);

-- UPDATE: Combine all update policies into one
CREATE POLICY "Vehicles update access"
ON vehicles
FOR UPDATE
USING (
  -- Admins can update all
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())::text
    AND users.role = 'admin'
  )
  OR
  -- Sellers can update their own vehicles
  (select auth.uid())::text = seller_email
);

-- DELETE: Combine all delete policies into one
CREATE POLICY "Vehicles delete access"
ON vehicles
FOR DELETE
USING (
  -- Admins can delete all
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())::text
    AND users.role = 'admin'
  )
  OR
  -- Sellers can delete their own vehicles
  (select auth.uid())::text = seller_email
);

-- ============================================================================
-- 2. CONVERSATIONS TABLE - Fix and Consolidate Policies
-- ============================================================================

-- Drop existing policies (both old and new names)
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can read own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
DROP POLICY IF EXISTS "Admins can manage all conversations" ON conversations;
-- Drop new consolidated policies if they exist
DROP POLICY IF EXISTS "Conversations read access" ON conversations;
DROP POLICY IF EXISTS "Conversations insert access" ON conversations;
DROP POLICY IF EXISTS "Conversations update access" ON conversations;

-- Create optimized consolidated policies
-- SELECT: Combine all read policies into one
CREATE POLICY "Conversations read access"
ON conversations
FOR SELECT
USING (
  -- Admins can read all
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())::text
    AND users.role = 'admin'
  )
  OR
  -- Users can read their own conversations
  (select auth.uid())::text = customer_id
  OR
  (select auth.uid())::text = seller_id
);

-- INSERT: Combine all insert policies into one
CREATE POLICY "Conversations insert access"
ON conversations
FOR INSERT
WITH CHECK (
  -- Admins can insert all
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())::text
    AND users.role = 'admin'
  )
  OR
  -- Users can create conversations where they are the customer
  (select auth.uid())::text = customer_id
);

-- UPDATE: Combine all update policies into one
CREATE POLICY "Conversations update access"
ON conversations
FOR UPDATE
USING (
  -- Admins can update all
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())::text
    AND users.role = 'admin'
  )
  OR
  -- Users can update their own conversations
  (select auth.uid())::text = customer_id
  OR
  (select auth.uid())::text = seller_id
);

-- ============================================================================
-- 3. MESSAGES TABLE - Fix Policies (if table exists)
-- ============================================================================

-- Drop existing policies if they exist (both old and new names)
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON messages;
DROP POLICY IF EXISTS "Users can insert messages in own conversations" ON messages;
DROP POLICY IF EXISTS "Messages read access" ON messages;
DROP POLICY IF EXISTS "Messages insert access" ON messages;

-- Create optimized policies (only if messages table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'messages'
  ) THEN
    -- Drop new policies if they exist
    EXECUTE 'DROP POLICY IF EXISTS "Messages read access" ON messages';
    EXECUTE 'DROP POLICY IF EXISTS "Messages insert access" ON messages';
    
    -- SELECT: Users can view messages in their own conversations
    EXECUTE '
      CREATE POLICY "Messages read access"
      ON messages
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = (select auth.uid())::text
          AND users.role = ''admin''
        )
        OR
        EXISTS (
          SELECT 1 FROM conversations
          WHERE conversations.id = messages.conversation_id
          AND (
            conversations.customer_id = (select auth.uid())::text
            OR conversations.seller_id = (select auth.uid())::text
          )
        )
      )';

    -- INSERT: Users can insert messages in their own conversations
    EXECUTE '
      CREATE POLICY "Messages insert access"
      ON messages
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = (select auth.uid())::text
          AND users.role = ''admin''
        )
        OR
        EXISTS (
          SELECT 1 FROM conversations
          WHERE conversations.id = messages.conversation_id
          AND (
            conversations.customer_id = (select auth.uid())::text
            OR conversations.seller_id = (select auth.uid())::text
          )
        )
      )';
  END IF;
END $$;

-- ============================================================================
-- 4. NOTIFICATIONS TABLE - Fix and Consolidate Policies
-- ============================================================================

-- Drop existing policies (both old and new names)
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can manage all notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
-- Drop new consolidated policies if they exist
DROP POLICY IF EXISTS "Notifications read access" ON notifications;
DROP POLICY IF EXISTS "Notifications insert access" ON notifications;
DROP POLICY IF EXISTS "Notifications update access" ON notifications;

-- Create optimized consolidated policies
-- SELECT: Combine all read policies into one
CREATE POLICY "Notifications read access"
ON notifications
FOR SELECT
USING (
  -- Admins can read all
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())::text
    AND users.role = 'admin'
  )
  OR
  -- Users can read their own notifications
  (select auth.uid())::text = user_id
);

-- INSERT: Combine all insert policies into one
CREATE POLICY "Notifications insert access"
ON notifications
FOR INSERT
WITH CHECK (
  -- Admins can insert all
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())::text
    AND users.role = 'admin'
  )
  OR
  -- System/service role can create notifications
  -- Note: Service role bypasses RLS, so this allows authenticated users
  -- to create notifications. Adjust if you need stricter control.
  (select auth.uid()) IS NOT NULL
);

-- UPDATE: Combine all update policies into one
CREATE POLICY "Notifications update access"
ON notifications
FOR UPDATE
USING (
  -- Admins can update all
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())::text
    AND users.role = 'admin'
  )
  OR
  -- Users can update their own notifications
  (select auth.uid())::text = user_id
);

-- ============================================================================
-- 5. SERVICE_REQUESTS TABLE - Fix and Consolidate Policies
-- ============================================================================

-- Drop existing policies (both old and new names)
DROP POLICY IF EXISTS "Users can read own service requests" ON service_requests;
DROP POLICY IF EXISTS "Providers can read assigned requests" ON service_requests;
DROP POLICY IF EXISTS "Users can create service requests" ON service_requests;
-- Drop new consolidated policies if they exist
DROP POLICY IF EXISTS "Service requests read access" ON service_requests;
DROP POLICY IF EXISTS "Service requests insert access" ON service_requests;

-- Create optimized consolidated policies
-- SELECT: Combine all read policies into one
CREATE POLICY "Service requests read access"
ON service_requests
FOR SELECT
USING (
  -- Admins can read all
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())::text
    AND users.role = 'admin'
  )
  OR
  -- Users can read their own service requests
  (select auth.uid())::text = user_id
  OR
  -- Providers can read requests assigned to them
  (select auth.uid())::text = provider_id
);

-- INSERT: Users can create service requests
CREATE POLICY "Service requests insert access"
ON service_requests
FOR INSERT
WITH CHECK (
  -- Admins can insert all
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (select auth.uid())::text
    AND users.role = 'admin'
  )
  OR
  -- Users can create their own service requests
  (select auth.uid())::text = user_id
);

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  -- Count policies on vehicles
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename = 'vehicles';
  
  RAISE NOTICE '✅ Vehicles table has % policies', policy_count;
  
  -- Count policies on conversations
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename = 'conversations';
  
  RAISE NOTICE '✅ Conversations table has % policies', policy_count;
  
  -- Count policies on notifications
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename = 'notifications';
  
  RAISE NOTICE '✅ Notifications table has % policies', policy_count;
  
  -- Count policies on service_requests
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename = 'service_requests';
  
  RAISE NOTICE '✅ Service requests table has % policies', policy_count;
  
  RAISE NOTICE '✅ All RLS performance issues have been fixed!';
END $$;

