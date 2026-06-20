/**
 * Backfill workshop trust stats (rating, reviewCount, completedJobs) from completed
 * service_requests into service_providers.rating + metadata.
 *
 * Run: npm run backfill:provider-trust
 */
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { backfillAllProviderTrustMetadata } from '../services/provider-trust-stats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

config({ path: join(__dirname, '..', '.env.local'), override: true });
config({ path: join(__dirname, '..', '.env') });

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key || String(key).includes('your_')) {
    console.error(
      'Missing Supabase admin config. Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.',
    );
    process.exit(1);
  }

  console.log('Aggregating trust stats from completed service_requests…');
  const { updated, providers } = await backfillAllProviderTrustMetadata();

  if (updated === 0) {
    console.log('No service_providers rows found.');
    return;
  }

  console.log(`Updated ${updated} provider(s):\n`);
  for (const row of providers) {
    const { stats } = row;
    console.log(
      `  ${row.id} — ${stats.completedJobs} jobs, ${stats.reviewCount} reviews, rating ${stats.rating ?? '—'}`,
    );
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
