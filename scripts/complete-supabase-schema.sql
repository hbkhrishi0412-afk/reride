-- ============================================================================
-- Complete Supabase Database Schema for ReRide Website
-- ============================================================================
-- This script creates all tables, columns, indexes, and constraints needed
-- for the entire website. Run this in Supabase SQL Editor.
-- ============================================================================
-- IMPORTANT: This script uses IF NOT EXISTS to avoid errors if tables already exist
-- It will add missing columns to existing tables without breaking anything
-- ============================================================================

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    mobile TEXT,
    password TEXT, -- Bcrypt hashed password for email/password auth. NULL for OAuth-only users.
    role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'seller', 'admin')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    avatar_url TEXT,
    is_verified BOOLEAN DEFAULT false,
    dealership_name TEXT,
    bio TEXT,
    logo_url TEXT,
    subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro', 'premium')),
    featured_credits INTEGER DEFAULT 0,
    used_certifications INTEGER DEFAULT 0,
    phone_verified BOOLEAN DEFAULT false,
    email_verified BOOLEAN DEFAULT false,
    govt_id_verified BOOLEAN DEFAULT false,
    trust_score INTEGER CHECK (trust_score >= 0 AND trust_score <= 100),
    location TEXT,
    address TEXT,
    firebase_uid TEXT,
    auth_provider TEXT DEFAULT 'email' CHECK (auth_provider IN ('email', 'google', 'phone')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Add password column if it doesn't exist (for existing tables)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;

-- Add address column if it doesn't exist (for existing tables)
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_subscription_plan ON users(subscription_plan);
CREATE INDEX IF NOT EXISTS idx_users_location ON users(location);

-- Enable RLS (Row Level Security) for users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. VEHICLES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    category TEXT CHECK (category IN ('four-wheeler', 'two-wheeler', 'three-wheeler', 'commercial', 'farm', 'construction')),
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    variant TEXT,
    year INTEGER,
    price NUMERIC DEFAULT 0 CHECK (price >= 0),
    mileage NUMERIC CHECK (mileage >= 0),
    images TEXT[],
    features TEXT[],
    description TEXT,
    seller_email TEXT,
    seller_name TEXT,
    engine TEXT,
    transmission TEXT,
    fuel_type TEXT,
    fuel_efficiency TEXT,
    color TEXT,
    status TEXT DEFAULT 'published' CHECK (status IN ('published', 'unpublished', 'sold')),
    is_featured BOOLEAN DEFAULT false,
    views INTEGER DEFAULT 0 CHECK (views >= 0),
    inquiries_count INTEGER DEFAULT 0 CHECK (inquiries_count >= 0),
    registration_year INTEGER,
    insurance_validity TEXT,
    insurance_type TEXT,
    rto TEXT,
    city TEXT,
    state TEXT,
    no_of_owners INTEGER CHECK (no_of_owners >= 0),
    displacement TEXT,
    ground_clearance TEXT,
    boot_space TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Add metadata column if it doesn't exist
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create indexes for vehicles table
CREATE INDEX IF NOT EXISTS idx_vehicles_category ON vehicles(category);
CREATE INDEX IF NOT EXISTS idx_vehicles_make ON vehicles(make);
CREATE INDEX IF NOT EXISTS idx_vehicles_model ON vehicles(model);
CREATE INDEX IF NOT EXISTS idx_vehicles_seller_email ON vehicles(seller_email);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_is_featured ON vehicles(is_featured);
CREATE INDEX IF NOT EXISTS idx_vehicles_city ON vehicles(city);
CREATE INDEX IF NOT EXISTS idx_vehicles_state ON vehicles(state);
CREATE INDEX IF NOT EXISTS idx_vehicles_price ON vehicles(price);
CREATE INDEX IF NOT EXISTS idx_vehicles_year ON vehicles(year);
CREATE INDEX IF NOT EXISTS idx_vehicles_created_at ON vehicles(created_at DESC);

-- Composite index for common query pattern: published vehicles sorted by created_at
-- This dramatically speeds up the most common query: fetching published vehicles
CREATE INDEX IF NOT EXISTS idx_vehicles_status_created_at ON vehicles(status, created_at DESC);

-- Enable RLS (Row Level Security) for vehicles
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. CONVERSATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    seller_id TEXT,
    vehicle_id TEXT,
    customer_name TEXT,
    seller_name TEXT,
    vehicle_name TEXT,
    vehicle_price NUMERIC,
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    is_read_by_seller BOOLEAN DEFAULT false,
    is_read_by_customer BOOLEAN DEFAULT true,
    is_flagged BOOLEAN DEFAULT false,
    flag_reason TEXT,
    flagged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Add missing columns if they don't exist
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS seller_name TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create indexes for conversations table
CREATE INDEX IF NOT EXISTS idx_conversations_customer_id ON conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_seller_id ON conversations(seller_id);
CREATE INDEX IF NOT EXISTS idx_conversations_vehicle_id ON conversations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_is_read_by_seller ON conversations(is_read_by_seller);
CREATE INDEX IF NOT EXISTS idx_conversations_is_read_by_customer ON conversations(is_read_by_customer);
CREATE INDEX IF NOT EXISTS idx_conversations_is_flagged ON conversations(is_flagged);

-- Enable RLS (Row Level Security) for conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    type TEXT,
    title TEXT,
    message TEXT,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Add missing columns if they don't exist
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Make user_id nullable (some notifications may not have a user_id)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'user_id' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE notifications ALTER COLUMN user_id DROP NOT NULL;
    END IF;
END $$;

-- Make type nullable (some notifications may not have a type)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'type' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE notifications ALTER COLUMN type DROP NOT NULL;
    END IF;
END $$;

-- Make title nullable (some notifications may not have a title)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'title' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE notifications ALTER COLUMN title DROP NOT NULL;
    END IF;
END $$;

-- Create indexes for notifications table
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read, created_at DESC);

-- Enable RLS (Row Level Security) for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. NEW_CARS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS new_cars (
    id TEXT PRIMARY KEY,
    brand_name TEXT,
    model_name TEXT,
    model_year INTEGER,
    price NUMERIC CHECK (price >= 0),
    images TEXT[],
    features TEXT[],
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Create indexes for new_cars table
CREATE INDEX IF NOT EXISTS idx_new_cars_brand_name ON new_cars(brand_name);
CREATE INDEX IF NOT EXISTS idx_new_cars_model_name ON new_cars(model_name);
CREATE INDEX IF NOT EXISTS idx_new_cars_model_year ON new_cars(model_year);
CREATE INDEX IF NOT EXISTS idx_new_cars_price ON new_cars(price);

-- Enable RLS (Row Level Security) for new_cars
ALTER TABLE new_cars ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. PLANS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT,
    price NUMERIC DEFAULT 0 CHECK (price >= 0),
    duration TEXT,
    features TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Create indexes for plans table
CREATE INDEX IF NOT EXISTS idx_plans_name ON plans(name);
CREATE INDEX IF NOT EXISTS idx_plans_price ON plans(price);

-- Enable RLS (Row Level Security) for plans
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Insert default plans if they don't exist (required for foreign key constraint)
-- These plan IDs must match the CHECK constraint values in users.subscription_plan
INSERT INTO plans (id, name, price, duration, features) 
VALUES 
    ('free', 'Free Plan', 0, 'monthly', ARRAY['Basic listing', 'Limited features']),
    ('pro', 'Pro Plan', 0, 'monthly', ARRAY['Enhanced listing', 'More features']),
    ('premium', 'Premium Plan', 0, 'monthly', ARRAY['Premium listing', 'All features'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7. SERVICE_PROVIDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_providers (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    phone TEXT,
    location TEXT,
    services TEXT[],
    rating NUMERIC CHECK (rating >= 0 AND rating <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Create indexes for service_providers table
CREATE INDEX IF NOT EXISTS idx_service_providers_email ON service_providers(email);
CREATE INDEX IF NOT EXISTS idx_service_providers_location ON service_providers(location);
CREATE INDEX IF NOT EXISTS idx_service_providers_rating ON service_providers(rating);

-- Enable RLS (Row Level Security) for service_providers
ALTER TABLE service_providers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. SERVICE_REQUESTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    provider_id TEXT,
    service_type TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Create indexes for service_requests table
CREATE INDEX IF NOT EXISTS idx_service_requests_user_id ON service_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_provider_id ON service_requests(provider_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_service_type ON service_requests(service_type);

-- Enable RLS (Row Level Security) for service_requests
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 9. MESSAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    sender TEXT,
    text TEXT,
    message_type TEXT DEFAULT 'text',
    payload JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns if they don't exist
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Create indexes for messages table
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);

-- Enable RLS (Row Level Security) for messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 10. FOREIGN KEY CONSTRAINTS: Connect tables for schema visualization
-- ============================================================================
-- These foreign key constraints establish relationships between tables
-- which allows schema visualizers to properly display table connections

-- Drop existing foreign key constraints if they exist (to avoid errors on re-run)
DO $$ 
BEGIN
    -- Drop foreign keys if they exist
    ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_subscription_plan;
    ALTER TABLE conversations DROP CONSTRAINT IF EXISTS fk_conversations_customer_id;
    ALTER TABLE conversations DROP CONSTRAINT IF EXISTS fk_conversations_seller_id;
    ALTER TABLE conversations DROP CONSTRAINT IF EXISTS fk_conversations_vehicle_id;
    ALTER TABLE messages DROP CONSTRAINT IF EXISTS fk_messages_conversation_id;
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_user_id;
    ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS fk_service_requests_user_id;
    ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS fk_service_requests_provider_id;
    ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS fk_vehicles_seller_email;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Conversations foreign keys
-- Note: These constraints may fail if existing data violates referential integrity
-- Clean up orphaned records before running this script if needed
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_conversations_customer_id'
    ) THEN
        ALTER TABLE conversations 
            ADD CONSTRAINT fk_conversations_customer_id 
            FOREIGN KEY (customer_id) REFERENCES users(id) 
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not add fk_conversations_customer_id: %', SQLERRM;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_conversations_seller_id'
    ) THEN
        ALTER TABLE conversations 
            ADD CONSTRAINT fk_conversations_seller_id 
            FOREIGN KEY (seller_id) REFERENCES users(id) 
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not add fk_conversations_seller_id: %', SQLERRM;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_conversations_vehicle_id'
    ) THEN
        ALTER TABLE conversations 
            ADD CONSTRAINT fk_conversations_vehicle_id 
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) 
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not add fk_conversations_vehicle_id: %', SQLERRM;
END $$;

-- Messages foreign key
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_messages_conversation_id'
    ) THEN
        ALTER TABLE messages 
            ADD CONSTRAINT fk_messages_conversation_id 
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) 
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not add fk_messages_conversation_id: %', SQLERRM;
END $$;

-- Notifications foreign key
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_notifications_user_id'
    ) THEN
        ALTER TABLE notifications 
            ADD CONSTRAINT fk_notifications_user_id 
            FOREIGN KEY (user_id) REFERENCES users(id) 
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not add fk_notifications_user_id: %', SQLERRM;
END $$;

-- Service requests foreign keys
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_service_requests_user_id'
    ) THEN
        ALTER TABLE service_requests 
            ADD CONSTRAINT fk_service_requests_user_id 
            FOREIGN KEY (user_id) REFERENCES users(id) 
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not add fk_service_requests_user_id: %', SQLERRM;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_service_requests_provider_id'
    ) THEN
        ALTER TABLE service_requests 
            ADD CONSTRAINT fk_service_requests_provider_id 
            FOREIGN KEY (provider_id) REFERENCES service_providers(id) 
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not add fk_service_requests_provider_id: %', SQLERRM;
END $$;

-- Vehicles foreign key (using email since seller_email references users.email)
-- Note: This creates a relationship based on email, not id
-- This may fail if there are vehicles with seller_email values that don't exist in users.email
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_vehicles_seller_email'
    ) THEN
        ALTER TABLE vehicles 
            ADD CONSTRAINT fk_vehicles_seller_email 
            FOREIGN KEY (seller_email) REFERENCES users(email) 
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not add fk_vehicles_seller_email: %. You may need to clean up vehicles with invalid seller_email values first.', SQLERRM;
END $$;

-- Users to Plans foreign key
-- Connects users.subscription_plan to plans.id
-- Note: This requires that plans.id values match subscription_plan values ('free', 'pro', 'premium')
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_subscription_plan'
    ) THEN
        ALTER TABLE users 
            ADD CONSTRAINT fk_users_subscription_plan 
            FOREIGN KEY (subscription_plan) REFERENCES plans(id) 
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not add fk_users_subscription_plan: %. Make sure plans table has rows with id values matching subscription_plan values (free, pro, premium).', SQLERRM;
END $$;

-- ============================================================================
-- 11. FUNCTIONS: Auto-update updated_at timestamp
-- ============================================================================
-- Function to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist (to avoid errors on re-run)
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_vehicles_updated_at ON vehicles;
DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
DROP TRIGGER IF EXISTS update_new_cars_updated_at ON new_cars;
DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;
DROP TRIGGER IF EXISTS update_service_providers_updated_at ON service_providers;
DROP TRIGGER IF EXISTS update_service_requests_updated_at ON service_requests;

-- Create triggers for all tables with updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_new_cars_updated_at BEFORE UPDATE ON new_cars
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_providers_updated_at BEFORE UPDATE ON service_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_requests_updated_at BEFORE UPDATE ON service_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 12. RLS POLICIES (Optional - Uncomment after testing)
-- ============================================================================
-- These policies control who can read/write data. Adjust based on your needs.

-- Users Policies:
-- Allow users to read their own data
-- CREATE POLICY "Users can read own data" ON users
--   FOR SELECT USING (auth.uid()::text = id);

-- Allow users to update their own data
-- CREATE POLICY "Users can update own data" ON users
--   FOR UPDATE USING (auth.uid()::text = id);

-- Allow public read access to active users (for seller profiles)
-- CREATE POLICY "Public can read active users" ON users
--   FOR SELECT USING (status = 'active');

-- Vehicles Policies:
-- Allow public read access to published vehicles
-- CREATE POLICY "Public can read published vehicles" ON vehicles
--   FOR SELECT USING (status = 'published');

-- Allow sellers to insert their own vehicles
-- CREATE POLICY "Sellers can insert own vehicles" ON vehicles
--   FOR INSERT WITH CHECK (auth.uid()::text = seller_email);

-- Allow sellers to update their own vehicles
-- CREATE POLICY "Sellers can update own vehicles" ON vehicles
--   FOR UPDATE USING (auth.uid()::text = seller_email);

-- Conversations Policies:
-- Allow users to read their own conversations
-- CREATE POLICY "Users can read own conversations" ON conversations
--   FOR SELECT USING (
--     auth.uid()::text = customer_id OR 
--     auth.uid()::text = seller_id
--   );

-- Allow users to create conversations
-- CREATE POLICY "Users can create conversations" ON conversations
--   FOR INSERT WITH CHECK (auth.uid()::text = customer_id);

-- Allow users to update their own conversations
-- CREATE POLICY "Users can update own conversations" ON conversations
--   FOR UPDATE USING (
--     auth.uid()::text = customer_id OR 
--     auth.uid()::text = seller_id
--   );

-- Notifications Policies:
-- Allow users to read their own notifications
-- CREATE POLICY "Users can read own notifications" ON notifications
--   FOR SELECT USING (auth.uid()::text = user_id);

-- Allow users to update their own notifications
-- CREATE POLICY "Users can update own notifications" ON notifications
--   FOR UPDATE USING (auth.uid()::text = user_id);

-- New Cars Policies:
-- Allow public read access to new cars
-- CREATE POLICY "Public can read new cars" ON new_cars
--   FOR SELECT USING (true);

-- Plans Policies:
-- Allow public read access to plans
-- CREATE POLICY "Public can read plans" ON plans
--   FOR SELECT USING (true);

-- Service Providers Policies:
-- Allow public read access to service providers
-- CREATE POLICY "Public can read service providers" ON service_providers
--   FOR SELECT USING (true);

-- Service Requests Policies:
-- Allow users to read their own service requests
-- CREATE POLICY "Users can read own service requests" ON service_requests
--   FOR SELECT USING (auth.uid()::text = user_id);

-- Allow service providers to read requests assigned to them
-- CREATE POLICY "Providers can read assigned requests" ON service_requests
--   FOR SELECT USING (auth.uid()::text = provider_id);

-- Allow users to create their own service requests
-- CREATE POLICY "Users can create service requests" ON service_requests
--   FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- ============================================================================
-- 13. VERIFICATION: Check that all tables and columns exist
-- ============================================================================
DO $$
DECLARE
    missing_items TEXT[] := ARRAY[]::TEXT[];
    table_count INTEGER;
BEGIN
    -- Check all required tables exist
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('users', 'vehicles', 'conversations', 'notifications', 
                       'new_cars', 'plans', 'service_providers', 'service_requests', 'messages');
    
    IF table_count < 9 THEN
        missing_items := array_append(missing_items, 'Some tables are missing');
    END IF;
    
    -- Check critical columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password'
    ) THEN
        missing_items := array_append(missing_items, 'users.password column');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' AND column_name = 'seller_name'
    ) THEN
        missing_items := array_append(missing_items, 'conversations.seller_name column');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' AND column_name = 'last_message'
    ) THEN
        missing_items := array_append(missing_items, 'conversations.last_message column');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'read'
    ) THEN
        missing_items := array_append(missing_items, 'notifications.read column');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'metadata'
    ) THEN
        missing_items := array_append(missing_items, 'vehicles.metadata column');
    END IF;
    
    -- Report results
    IF array_length(missing_items, 1) > 0 THEN
        RAISE NOTICE '⚠️  Some items could not be created: %', array_to_string(missing_items, ', ');
    ELSE
        RAISE NOTICE '✅ All schema components created successfully!';
        RAISE NOTICE '✅ Total tables: %', table_count;
    END IF;
END $$;

-- ============================================================================
-- 14. COMMENTS: Add documentation to tables
-- ============================================================================
COMMENT ON TABLE users IS 'User accounts for customers, sellers, and admins';
COMMENT ON TABLE vehicles IS 'Vehicle listings (used cars, bikes, etc.)';
COMMENT ON TABLE conversations IS 'Chat conversations between customers and sellers';
COMMENT ON TABLE messages IS 'Individual messages within conversations';
COMMENT ON TABLE notifications IS 'User notifications';
COMMENT ON TABLE new_cars IS 'New car listings';
COMMENT ON TABLE plans IS 'Subscription plans for sellers';
COMMENT ON TABLE service_providers IS 'Service providers (mechanics, etc.)';
COMMENT ON TABLE service_requests IS 'Service requests from users to providers';

COMMENT ON COLUMN users.password IS 'Bcrypt hashed password for email/password authentication. NULL for OAuth-only users.';
COMMENT ON COLUMN users.subscription_plan IS 'Foreign key reference to plans.id (free, pro, premium)';
COMMENT ON COLUMN vehicles.metadata IS 'Additional vehicle data (certifications, ratings, etc.)';
COMMENT ON COLUMN vehicles.seller_email IS 'Foreign key reference to users.email';
COMMENT ON COLUMN conversations.metadata IS 'Chat messages array and additional conversation data';
COMMENT ON COLUMN conversations.customer_id IS 'Foreign key reference to users table';
COMMENT ON COLUMN conversations.seller_id IS 'Foreign key reference to users table';
COMMENT ON COLUMN conversations.vehicle_id IS 'Foreign key reference to vehicles table';
COMMENT ON COLUMN messages.conversation_id IS 'Foreign key reference to conversations table';
COMMENT ON COLUMN notifications.metadata IS 'Additional notification data';
COMMENT ON COLUMN notifications.user_id IS 'Foreign key reference to users table';
COMMENT ON COLUMN service_requests.user_id IS 'Foreign key reference to users table';
COMMENT ON COLUMN service_requests.provider_id IS 'Foreign key reference to service_providers table';

-- ============================================================================
-- Schema Setup Complete!
-- ============================================================================
-- Next steps:
-- 1. Verify all tables exist in Supabase Dashboard → Table Editor
-- 2. Review and enable RLS policies as needed (uncomment policies above)
-- 3. Test your application connection
-- 4. Run migration script if migrating from Firebase
-- ============================================================================

