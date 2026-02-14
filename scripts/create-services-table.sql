-- Create services table in Supabase for managing service pricing
-- This table stores the 6 main services with their pricing information

CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    base_price NUMERIC DEFAULT 0 CHECK (base_price >= 0),
    min_price NUMERIC DEFAULT 0 CHECK (min_price >= 0),
    max_price NUMERIC DEFAULT 0 CHECK (max_price >= 0),
    price_range TEXT,
    icon_name TEXT,
    active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_services_name ON services(name);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(active);
CREATE INDEX IF NOT EXISTS idx_services_display_order ON services(display_order);

-- Enable RLS (Row Level Security)
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active services
-- Drop policy if it exists to allow re-running the script
DROP POLICY IF EXISTS "Services are viewable by everyone" ON services;
CREATE POLICY "Services are viewable by everyone" ON services
    FOR SELECT USING (active = true);

-- Allow admins to manage services (this will be handled by service_role key in API)
-- For now, we'll allow authenticated users with admin role to manage
-- Note: You may need to adjust this based on your auth setup

-- Insert default services based on the image
INSERT INTO services (id, name, display_name, description, base_price, min_price, max_price, price_range, icon_name, active, display_order) VALUES
    ('periodic-service', 'Periodic Service', 'Periodic Service', 'OEM recommended service schedules with genuine parts', 2499, 2499, 4999, '₹2,499 - ₹4,999', 'calendar', true, 1),
    ('ac-service', 'AC Service', 'AC Service', 'Complete AC servicing ensures reliable performance in all weather conditions', 1999, 1999, 3499, '₹1,999 - ₹3,499', 'snowflake', true, 2),
    ('car-scan', 'Car Scan', 'Car Scan', 'Complete car health scanning and diagnostics', 999, 999, 2499, '₹999 - ₹2,499', 'magnifying-glass', true, 3),
    ('wheel-care', 'Wheel Care', 'Wheel Care', 'Factory-spec wheel alignment for better stability and fuel efficiency', 1499, 1499, 2999, '₹1,499 - ₹2,999', 'gear', true, 4),
    ('interior-clean', 'Interior Clean', 'Interior Clean', 'Deep cleaning to keep your car interior fresh and hygienic', 3999, 3999, 5999, '₹3,999 - ₹5,999', 'broom', true, 5),
    ('engine-care', 'Engine Care', 'Engine Care', 'Engine maintenance and repairs with expert mechanics', 2499, 2499, 4999, '₹2,499 - ₹4,999', 'wrench', true, 6)
ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    base_price = EXCLUDED.base_price,
    min_price = EXCLUDED.min_price,
    max_price = EXCLUDED.max_price,
    price_range = EXCLUDED.price_range,
    icon_name = EXCLUDED.icon_name,
    updated_at = NOW();

-- Create a function to update updated_at timestamp
-- SECURITY: Set search_path to prevent SQL injection vulnerabilities
CREATE OR REPLACE FUNCTION update_services_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_services_updated_at ON services;
CREATE TRIGGER trigger_update_services_updated_at
    BEFORE UPDATE ON services
    FOR EACH ROW
    EXECUTE FUNCTION update_services_updated_at();

