/**
 * Hash plain-text passwords in Supabase users table (bcrypt, 12 rounds).
 * Run: node scripts/hash-plaintext-supabase-passwords.js
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });
config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function isBcryptHash(password) {
  return typeof password === 'string' && /^\$2[abxy]\$/.test(password);
}

async function hashPlaintextPasswords() {
  console.log('Fetching users with plain-text passwords...\n');

  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, password')
    .not('password', 'is', null);

  if (error) {
    console.error('Failed to fetch users:', error.message);
    process.exit(1);
  }

  const toHash = (users || []).filter((u) => u.password && !isBcryptHash(u.password));

  if (toHash.length === 0) {
    console.log('No plain-text passwords found. Nothing to do.');
    return;
  }

  console.log(`Found ${toHash.length} user(s) to update:\n`);

  let updated = 0;
  let failed = 0;

  for (const user of toHash) {
    try {
      const hashed = await bcrypt.hash(user.password, 12);
      const { error: updateError } = await supabase
        .from('users')
        .update({ password: hashed, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (updateError) {
        console.error(`  FAIL ${user.email}: ${updateError.message}`);
        failed++;
        continue;
      }

      console.log(`  OK   ${user.email}`);
      updated++;
    } catch (err) {
      console.error(`  FAIL ${user.email}:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Failed: ${failed}`);
}

hashPlaintextPasswords().catch((err) => {
  console.error(err);
  process.exit(1);
});
