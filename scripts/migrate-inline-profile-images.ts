/**
 * Move inline base64 avatar/logo images out of public.users into the Images storage bucket.
 *
 * Dry run:  node --import tsx scripts/migrate-inline-profile-images.ts
 * Apply:    node --import tsx scripts/migrate-inline-profile-images.ts --apply
 */
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local'), override: true });
config({ path: join(__dirname, '..', '.env') });

const apply = process.argv.includes('--apply');

async function main(): Promise<void> {
  const { getSupabaseAdminClient, uploadDataUrlImage } = await import('../lib/supabase-admin.js');
  const supabase = getSupabaseAdminClient();

  for (const column of ['avatar_url', 'logo_url'] as const) {
    const { data, error } = await supabase
      .from('users')
      .select(`email, updated_at, ${column}`)
      .like(column, 'data:%');
    if (error) throw error;

    for (const row of (data ?? []) as Array<Record<string, string>>) {
      const original = row[column];
      console.log(`${row.email} ${column}: ${Math.round(original.length / 1024)} KB inline`);
      if (!apply) continue;

      const url = await uploadDataUrlImage(original, `${row.email.toLowerCase().trim()}/profile`);
      // Only overwrite if the row hasn't changed since we read it.
      const { error: updateError } = await supabase
        .from('users')
        .update({ [column]: url })
        .eq('email', row.email)
        .eq('updated_at', row.updated_at);
      if (updateError) throw updateError;
      console.log(`  -> ${url}`);
    }
  }
  if (!apply) console.log('Dry run. Re-run with --apply to migrate.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
