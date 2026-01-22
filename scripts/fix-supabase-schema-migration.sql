    -- Migration to fix missing columns and tables in Supabase
    -- Run this in Supabase SQL Editor before re-running the migration script
    -- This fixes the schema issues encountered during migration

    -- ============================================
    -- 1. Add missing columns to conversations table
    -- ============================================
    -- Add seller_name column (required for migration)
    ALTER TABLE conversations 
    ADD COLUMN IF NOT EXISTS seller_name TEXT;

    -- Add last_message column (required for migration)
    ALTER TABLE conversations 
    ADD COLUMN IF NOT EXISTS last_message TEXT;

    -- Add flagged_at column (optional, for flagging conversations)
    ALTER TABLE conversations 
    ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ;

    -- Add metadata column (required for storing messages array)
    ALTER TABLE conversations 
    ADD COLUMN IF NOT EXISTS metadata JSONB;

    -- ============================================
    -- 2. Add missing columns to notifications table
    -- ============================================
    -- Add read column (required for migration)
    ALTER TABLE notifications 
    ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

    -- Add metadata column (optional, for storing additional data)
    ALTER TABLE notifications 
    ADD COLUMN IF NOT EXISTS metadata JSONB;

    -- Make user_id nullable (some notifications may not have a user_id)
    -- This allows notifications without user_id to be migrated
    ALTER TABLE notifications 
    ALTER COLUMN user_id DROP NOT NULL;

    -- Make type nullable (some notifications may not have a type)
    -- This allows notifications without type to be migrated
    ALTER TABLE notifications 
    ALTER COLUMN type DROP NOT NULL;

    -- ============================================
    -- 3. Create service_providers table if it doesn't exist
    -- ============================================
    CREATE TABLE IF NOT EXISTS service_providers (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    phone TEXT,
    location TEXT,
    services TEXT[],
    rating NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
    );

    -- Enable RLS (Row Level Security) for service_providers
    ALTER TABLE service_providers ENABLE ROW LEVEL SECURITY;

    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_service_providers_email ON service_providers(email);
    CREATE INDEX IF NOT EXISTS idx_service_providers_location ON service_providers(location);
    CREATE INDEX IF NOT EXISTS idx_service_providers_rating ON service_providers(rating);

    -- ============================================
    -- 4. Verify all required columns exist
    -- ============================================
    -- This is just for reference - Supabase will show errors if columns don't exist

    -- Conversations table should have:
    --   - seller_name TEXT ✓ (added above - REQUIRED for migration)
    --   - last_message TEXT ✓ (added above - REQUIRED for migration)
    --   - flagged_at TIMESTAMPTZ ✓ (added above)
    --   - metadata JSONB ✓ (added above - REQUIRED for migration)

    -- Notifications table should have:
    --   - read BOOLEAN ✓ (added above - REQUIRED for migration)
    --   - metadata JSONB ✓ (added above)
    --   - user_id TEXT (nullable) ✓ (made nullable above to allow notifications without user_id)
    --   - type TEXT (nullable) ✓ (made nullable above to allow notifications without type)

    -- Service Providers table should exist ✓ (created above)

    -- ============================================
    -- Optional: Add RLS policies for service_providers
    -- ============================================
    -- Uncomment these after migration if you want to restrict access:

    -- -- Allow public read access to service providers
    -- CREATE POLICY "Service providers are viewable by everyone" ON service_providers
    --   FOR SELECT USING (true);

    -- -- Only authenticated users can insert service providers
    -- CREATE POLICY "Authenticated users can insert service providers" ON service_providers
    --   FOR INSERT WITH CHECK (auth.role() = 'authenticated');

    -- -- Only service providers can update their own records
    -- CREATE POLICY "Service providers can update own records" ON service_providers
    --   FOR UPDATE USING (auth.uid()::text = id);

