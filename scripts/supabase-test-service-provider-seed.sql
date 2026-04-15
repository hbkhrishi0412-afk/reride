-- =============================================================================
-- Test car-service (service provider) account — public tables only
-- =============================================================================
-- Preferred: run from repo root (creates Auth user + rows via Admin API):
--   npm run seed:test-provider
--
-- If you must use the SQL Editor only:
--   1) Supabase Dashboard → Authentication → Users → "Add user"
--      Email: provider@test.com
--      Password: password123
--      Enable "Auto Confirm User"
--   2) Open the new user and copy their UUID (id).
--   3) Replace BOTH placeholders below: YOUR_AUTH_USER_UUID and run once.

-- ---------------------------------------------------------------------------
-- service_providers (id MUST match auth.users.id)
-- ---------------------------------------------------------------------------
INSERT INTO public.service_providers (id, name, email, phone, location, services, metadata)
VALUES (
  'YOUR_AUTH_USER_UUID',
  'Demo Service Provider',
  'provider@test.com',
  '+91-98765-00000',
  'Mumbai',
  ARRAY['Periodic Service', 'AC Service']::text[],
  jsonb_build_object(
    'workshops', jsonb_build_array('Central Workshop'),
    'availability', 'weekdays'
  )
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  location = EXCLUDED.location,
  services = EXCLUDED.services,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- public.users (id is emailKey for provider@test.com → provider@test_com)
-- ---------------------------------------------------------------------------
INSERT INTO public.users (
  id,
  email,
  name,
  mobile,
  role,
  status,
  auth_provider,
  location,
  firebase_uid,
  created_at,
  updated_at
)
VALUES (
  'provider@test_com',
  'provider@test.com',
  'Demo Service Provider',
  '+91-98765-00000',
  'service_provider',
  'active',
  'email',
  'Mumbai',
  'YOUR_AUTH_USER_UUID',
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  mobile = EXCLUDED.mobile,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  location = EXCLUDED.location,
  firebase_uid = EXCLUDED.firebase_uid,
  updated_at = now();
