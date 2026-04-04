/**
 * Backfill conversations.seller_id from vehicles.seller_email when seller_id was cleared.
 *
 * Requires service role (bypasses RLS). Loads .env.local like other scripts.
 *
 *   node scripts/repair-conversations-seller-id.js           # dry-run (default)
 *   node scripts/repair-conversations-seller-id.js --apply   # write updates
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const apply = process.argv.includes('--apply');

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function isMissingSellerId(row) {
  const s = row?.seller_id;
  return s == null || String(s).trim() === '';
}

async function main() {
  const { data: nullRows, error: e1 } = await supabase
    .from('conversations')
    .select('id, vehicle_id, seller_id, seller_name, customer_id')
    .is('seller_id', null);

  const { data: emptyRows, error: e2 } = await supabase
    .from('conversations')
    .select('id, vehicle_id, seller_id, seller_name, customer_id')
    .eq('seller_id', '');

  if (e1 || e2) {
    console.error('Query error:', e1 || e2);
    process.exit(1);
  }

  const byId = new Map();
  for (const r of [...(nullRows || []), ...(emptyRows || [])]) {
    if (r?.id) byId.set(r.id, r);
  }
  const orphans = [...byId.values()].filter(isMissingSellerId);

  console.log(`Found ${orphans.length} conversation(s) with missing seller_id.\n`);
  if (orphans.length === 0) {
    process.exit(0);
  }

  let wouldFix = 0;
  let skipped = 0;

  for (const conv of orphans) {
    const vid = conv.vehicle_id;
    if (vid == null || String(vid).trim() === '') {
      console.log(`SKIP ${conv.id}: no vehicle_id`);
      skipped++;
      continue;
    }

    const { data: vehicle, error: ve } = await supabase
      .from('vehicles')
      .select('id, seller_email, seller_name')
      .eq('id', String(vid).trim())
      .maybeSingle();

    if (ve) {
      console.error(`ERROR vehicle lookup ${conv.id}:`, ve.message);
      skipped++;
      continue;
    }

    const email = vehicle?.seller_email ? String(vehicle.seller_email).trim().toLowerCase() : '';
    if (!email) {
      console.log(`SKIP ${conv.id}: vehicle ${vid} has no seller_email`);
      skipped++;
      continue;
    }

    wouldFix++;
    const sellerName =
      conv.seller_name && String(conv.seller_name).trim()
        ? conv.seller_name
        : vehicle.seller_name || null;

    console.log(
      `${apply ? 'UPDATE' : 'DRY-RUN'} ${conv.id} -> seller_id=${email} (vehicle ${vid})`
    );

    if (apply) {
      const { error: ue } = await supabase
        .from('conversations')
        .update({
          seller_id: email,
          seller_name: sellerName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conv.id);

      if (ue) {
        console.error(`  FAILED: ${ue.message}`);
      }
    }
  }

  console.log(
    `\nDone. ${wouldFix} repairable, ${skipped} skipped.${apply ? '' : ' Re-run with --apply to write.'}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
