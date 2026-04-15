/**
 * Creates (or repairs) a fixed dev test car-service account in Supabase:
 *   Auth user + service_providers row (id = auth uid) + public.users sync row.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL or VITE_SUPABASE_URL in .env / .env.local.
 *
 * Run: npm run seed:test-provider
 */
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Force local file values to override inherited shell/system env vars.
// This avoids stale placeholder keys in user-level environment settings.
config({ path: join(__dirname, '..', '.env.local'), override: true });
config({ path: join(__dirname, '..', '.env') });

const TEST = {
  email: 'provider@test.com',
  // Avoid compromised/common passwords blocked by Supabase Auth policies.
  password: 'Provider!Test#2026',
  name: 'Demo Service Provider',
  phone: '+91-98765-00000',
  city: 'Mumbai',
  workshops: ['Central Workshop'],
  skills: ['Periodic Service', 'AC Service'],
  availability: 'weekdays',
} as const;

function emailToKey(email: string): string {
  return email.toLowerCase().trim().replace(/[.#$[\]]/g, '_');
}

async function cleanupStaleUserRecord(supabase: SupabaseClient, email: string): Promise<void> {
  const emailKey = emailToKey(email);
  const normalizedEmail = email.toLowerCase().trim();
  const { error } = await supabase
    .from('users')
    .delete()
    .or(`id.eq.${emailKey},email.eq.${normalizedEmail}`);
  if (error) {
    throw new Error(`users cleanup: ${error.message}`);
  }
}

async function findAuthUserByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<{ id: string; email?: string } | null> {
  const normalized = email.toLowerCase().trim();
  let page = 1;
  const perPage = 200;
  while (page <= 50) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`auth.admin.listUsers: ${error.message}`);
    const users = data?.users || [];
    const hit = users.find((u) => (u.email || '').toLowerCase().trim() === normalized);
    if (hit?.id) return { id: hit.id, email: hit.email };
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

async function insertServiceProviderRow(supabase: SupabaseClient, uid: string): Promise<void> {
  const metadata = { workshops: [...TEST.workshops], availability: TEST.availability };
  const { error } = await supabase.from('service_providers').insert({
    id: uid,
    name: TEST.name,
    email: TEST.email,
    phone: TEST.phone,
    location: TEST.city,
    services: [...TEST.skills],
    metadata,
  });
  if (error) throw new Error(`service_providers insert: ${error.message}`);
}

async function upsertUsersRow(supabase: SupabaseClient, uid: string): Promise<void> {
  const emailKey = emailToKey(TEST.email);
  const now = new Date().toISOString();
  const row = {
    id: emailKey,
    email: TEST.email,
    name: TEST.name,
    mobile: TEST.phone,
    role: 'service_provider',
    status: 'active',
    auth_provider: 'email',
    location: TEST.city,
    firebase_uid: uid,
    created_at: now,
    updated_at: now,
  };
  const { error } = await supabase.from('users').upsert(row, { onConflict: 'id' });
  if (error) {
    console.warn('users upsert (non-fatal):', error.message);
  }
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key || String(key).includes('your_')) {
    console.error(
      'Missing Supabase admin config. Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.',
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = TEST.email;
  const { data: sp } = await supabase.from('service_providers').select('id,email').eq('email', email).maybeSingle();
  const authUser = await findAuthUserByEmail(supabase, email);

  if (sp && authUser && sp.id !== authUser.id) {
    console.error(
      'Inconsistent state: service_providers row id does not match Auth user id. Fix manually in Supabase.',
    );
    process.exit(1);
  }

  if (sp && !authUser) {
    console.log('Removing orphaned service_providers row (no Auth user).');
    await supabase.from('service_providers').delete().eq('email', email);
  }

  const spAfter = (await supabase.from('service_providers').select('id').eq('email', email).maybeSingle()).data;
  const authAfter = await findAuthUserByEmail(supabase, email);

  if (spAfter && authAfter && spAfter.id === authAfter.id) {
    await upsertUsersRow(supabase, authAfter.id);
    console.log(`OK — test service provider already linked: ${email} (uid ${authAfter.id})`);
    console.log(`Login: ${email} / ${TEST.password}`);
    return;
  }

  if (!spAfter && authAfter) {
    await insertServiceProviderRow(supabase, authAfter.id);
    await upsertUsersRow(supabase, authAfter.id);
    console.log(`OK — created service_providers + synced users for existing Auth user ${authAfter.id}`);
    console.log(`Login: ${email} / (existing password or reset in Dashboard)`);
    return;
  }

  // If auth user is missing, stale public.users rows for this email can make
  // auth trigger insert fail with "Database error creating new user".
  await cleanupStaleUserRecord(supabase, email);

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: TEST.password,
    email_confirm: true,
    user_metadata: { name: TEST.name, mobile: TEST.phone },
  });

  if (authError || !authData?.user?.id) {
    const msg = authError?.message || 'Failed to create auth user';
    console.error('auth.admin.createUser:', msg);
    process.exit(1);
  }

  const uid = authData.user.id;
  try {
    await insertServiceProviderRow(supabase, uid);
  } catch (e) {
    try {
      await supabase.auth.admin.deleteUser(uid);
    } catch {
      /* ignore */
    }
    throw e;
  }

  await upsertUsersRow(supabase, uid);
  console.log(`OK — created test service provider Auth user + profile`);
  console.log(`Login: ${email} / ${TEST.password}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
