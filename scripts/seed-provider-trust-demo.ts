/**
 * Seed demo completed service_requests with customer reviews for the test provider.
 * Gives the booking flow real trust stats (rating, reviews, completed jobs).
 *
 * Run after: npm run seed:test-provider
 * Then: npm run seed:provider-trust-demo
 */
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { syncProviderTrustMetadata } from '../services/provider-trust-stats.js';
import {
  buildDemoProviderServices,
  demoProviderServiceCategories,
} from '../services/demo-provider-catalog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

config({ path: join(__dirname, '..', '.env.local'), override: true });
config({ path: join(__dirname, '..', '.env') });

const PROVIDER_EMAIL = 'provider@test.com';

const DEMO_JOBS: Array<{
  serviceType: string;
  stars: number;
  comment: string;
  daysAgo: number;
}> = [
  { serviceType: 'Periodic Services', stars: 5, comment: 'On time and thorough.', daysAgo: 12 },
  { serviceType: 'Car AC Servicing', stars: 5, comment: 'AC feels brand new.', daysAgo: 28 },
  { serviceType: 'Periodic Services', stars: 4, comment: 'Good value, minor delay on pickup.', daysAgo: 45 },
  { serviceType: 'Wheel Alignment & Balancing', stars: 5, comment: 'Smooth drive after alignment.', daysAgo: 60 },
  { serviceType: 'Car Diagnostics', stars: 4, comment: 'Clear report, helpful team.', daysAgo: 75 },
  { serviceType: 'Interior Deep Cleaning', stars: 5, comment: 'Spotless interior.', daysAgo: 90 },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

async function seedDemoCatalog(supabase: SupabaseClient, providerId: string): Promise<void> {
  const { data: existing } = await supabase
    .from('service_providers')
    .select('metadata')
    .eq('id', providerId)
    .maybeSingle();

  const priorMeta =
    existing?.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
      ? (existing.metadata as Record<string, unknown>)
      : {};

  const services = buildDemoProviderServices();
  const { error } = await supabase
    .from('service_providers')
    .update({
      services: Object.keys(services),
      metadata: {
        ...priorMeta,
        services,
        serviceCategories: demoProviderServiceCategories(),
        workshops: priorMeta.workshops ?? ['Central Workshop'],
        availability: priorMeta.availability ?? 'weekdays',
      },
    })
    .eq('id', providerId);

  if (error) {
    throw new Error(`Failed to publish demo provider catalog: ${error.message}`);
  }
  console.log(`Published ${Object.keys(services).length} bookable services for demo workshop.`);
}

async function resolveDemoCustomerId(supabase: SupabaseClient): Promise<string | null> {
  const candidates = ['customer@test.com', 'customer@reride.com'];
  for (const email of candidates) {
    const { data } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (data?.id) return String(data.id);
  }
  const demoId = 'demo_customer_trust_seed';
  const { data: existing } = await supabase.from('users').select('id').eq('id', demoId).maybeSingle();
  if (existing?.id) return demoId;

  const { error } = await supabase.from('users').insert({
    id: demoId,
    email: 'demo-customer-trust@reride.local',
    name: 'Demo Customer',
    role: 'customer',
    status: 'active',
    auth_provider: 'email',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.warn('Could not create demo customer row:', error.message);
    return null;
  }
  return demoId;
}

async function seedDemoJobs(
  supabase: SupabaseClient,
  providerId: string,
  customerUserId: string | null,
): Promise<number> {
  let inserted = 0;

  for (let i = 0; i < DEMO_JOBS.length; i += 1) {
    const job = DEMO_JOBS[i];
    const id = `demo_trust_${providerId.slice(0, 8)}_${i}`;
    const completedAt = isoDaysAgo(job.daysAgo);
    const submittedAt = completedAt;

    const { data: existing } = await supabase.from('service_requests').select('id').eq('id', id).maybeSingle();
    if (existing?.id) continue;

    const { error } = await supabase.from('service_requests').insert({
      id,
      provider_id: providerId,
      service_type: job.serviceType,
      status: 'completed',
      ...(customerUserId ? { user_id: customerUserId } : {}),
      created_at: completedAt,
      updated_at: completedAt,
      metadata: {
        title: job.serviceType,
        serviceType: job.serviceType,
        city: 'Mumbai',
        vehicle: 'Maruti Swift • 2020',
        completedAt,
        customerReview: {
          stars: job.stars,
          comment: job.comment,
          submittedAt,
        },
      },
    });

    if (error) {
      console.warn(`Skip ${id}: ${error.message}`);
      continue;
    }
    inserted += 1;
  }

  return inserted;
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

  const { data: provider, error: spErr } = await supabase
    .from('service_providers')
    .select('id, email, name')
    .eq('email', PROVIDER_EMAIL)
    .maybeSingle();

  if (spErr || !provider?.id) {
    console.error(`Test provider not found (${PROVIDER_EMAIL}). Run npm run seed:test-provider first.`);
    process.exit(1);
  }

  const customerUserId = await resolveDemoCustomerId(supabase);
  await seedDemoCatalog(supabase, provider.id);
  const inserted = await seedDemoJobs(supabase, provider.id, customerUserId);
  console.log(`Inserted ${inserted} demo completed job(s) for ${provider.name || provider.email}.`);

  const stats = await syncProviderTrustMetadata(provider.id);
  console.log(
    `Trust stats synced — ${stats.completedJobs} jobs, ${stats.reviewCount} reviews, rating ${stats.rating ?? '—'}`,
  );

  await supabase
    .from('users')
    .update({ is_verified: true, updated_at: new Date().toISOString() })
    .eq('email', PROVIDER_EMAIL);

  console.log('Marked provider user as verified (is_verified = true).');
  console.log('Refresh the booking flow to see live workshop trust badges.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
