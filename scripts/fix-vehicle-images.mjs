/**
 * One-off maintenance script: replace placeholder demo car images with real,
 * model-specific photos and self-host them in Supabase Storage.
 *
 * Why: 42 seed vehicles pointed at `placehold.co` SVG placeholders (saved as
 * `vehicles/<id>/fetched_1.jpg` because no UNSPLASH_ACCESS_KEY was configured),
 * which rendered as gray "No image" tiles. This downloads a real car render per
 * make/model from the imagin.studio automotive CDN and uploads it to our own
 * `Images` bucket so we don't hotlink an external service at runtime.
 *
 * Usage:  node scripts/fix-vehicle-images.mjs           (dry run - lists targets)
 *         node scripts/fix-vehicle-images.mjs --apply   (perform the migration)
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const APPLY = process.argv.includes('--apply');
const BUCKET = 'Images';
const IMAGIN_CUSTOMER = 'img'; // public demo customer key

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment (.env.local).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const slug = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// imagin.studio expects manufacturer + modelFamily slugs. Most map directly from
// our make/model; a few need explicit aliases.
const MAKE_ALIASES = {
  'maruti-suzuki': 'suzuki',
};
const MODEL_ALIASES = {
  'urban-cruiser': 'urban-cruiser-hyryder',
};

function imaginUrl(make, model) {
  const makeSlug = MAKE_ALIASES[slug(make)] || slug(make);
  const modelSlug = MODEL_ALIASES[slug(model)] || slug(model);
  const u = new URL('https://cdn.imagin.studio/getimage');
  u.searchParams.set('customer', IMAGIN_CUSTOMER);
  u.searchParams.set('make', makeSlug);
  u.searchParams.set('modelFamily', modelSlug);
  u.searchParams.set('angle', '23');
  u.searchParams.set('width', '800');
  u.searchParams.set('fileType', 'webp');
  return u.toString();
}

const isPlaceholderImage = (img) =>
  typeof img === 'string' && (img.includes('/fetched_') || img.trim() === '');

function needsFix(images) {
  if (!Array.isArray(images) || images.length === 0) return true;
  // Fix only if EVERY image is a placeholder (leave rows with real uploads alone).
  return images.every(isPlaceholderImage);
}

async function main() {
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('id, make, model, year, images')
    .order('id', { ascending: true });

  if (error) {
    console.error('Failed to load vehicles:', error.message);
    process.exit(1);
  }

  const targets = vehicles.filter((v) => needsFix(v.images));
  console.log(`Total vehicles: ${vehicles.length}`);
  console.log(`Vehicles needing real images: ${targets.length}`);
  console.log(APPLY ? '\nAPPLYING changes...\n' : '\nDRY RUN (pass --apply to write)\n');

  let ok = 0;
  let failed = 0;

  for (const v of targets) {
    const label = `#${v.id} ${v.year} ${v.make} ${v.model}`;
    const srcUrl = imaginUrl(v.make, v.model);

    if (!APPLY) {
      console.log(`  [dry] ${label}  <-  ${srcUrl}`);
      continue;
    }

    try {
      const res = await fetch(srcUrl, { headers: { Accept: 'image/*' } });
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const contentType = res.headers.get('content-type') || 'image/webp';
      const ext = contentType.includes('png') ? 'png' : contentType.includes('jpeg') ? 'jpg' : 'webp';
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.byteLength < 2000) throw new Error(`suspiciously small image (${buffer.byteLength}b)`);

      const filePath = `vehicles/${v.id}/photo_1.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, buffer, { contentType, cacheControl: '86400', upsert: true });
      if (upErr) throw new Error(`upload: ${upErr.message}`);

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) throw new Error('no public url');

      const { error: updErr } = await supabase
        .from('vehicles')
        .update({ images: [publicUrl] })
        .eq('id', v.id);
      if (updErr) throw new Error(`db update: ${updErr.message}`);

      ok++;
      console.log(`  ✅ ${label}  (${(buffer.byteLength / 1024).toFixed(0)} KB)`);
    } catch (e) {
      failed++;
      console.log(`  ❌ ${label}  -> ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (APPLY) {
    console.log(`\nDone. Updated: ${ok}, Failed: ${failed}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
