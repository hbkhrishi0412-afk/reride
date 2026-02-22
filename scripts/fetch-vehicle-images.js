/**
 * Fetches an image for each vehicle (by make, model, year) and saves to Supabase Storage.
 * Uses Unsplash if UNSPLASH_ACCESS_KEY is set; otherwise a placeholder.
 * Run: node scripts/fetch-vehicle-images.js
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY [, UNSPLASH_ACCESS_KEY ]
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });
config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const unsplashKey = process.env.UNSPLASH_ACCESS_KEY || process.env.VITE_UNSPLASH_ACCESS_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const BUCKET = 'Images';

async function getImageUrl(make, model, year) {
  const query = [make, model, String(year), 'car'].filter(Boolean).join(' ');
  if (unsplashKey && unsplashKey.trim() && !unsplashKey.includes('your_')) {
    try {
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
      const res = await fetch(url, { headers: { Authorization: `Client-ID ${unsplashKey}` } });
      if (res.ok) {
        const data = await res.json();
        const regular = data?.results?.[0]?.urls?.regular;
        if (regular) return regular;
      }
    } catch (e) {
      console.warn('Unsplash failed, using placeholder:', e.message);
    }
  }
  const text = encodeURIComponent(`${year} ${make} ${model}`);
  return `https://placehold.co/800x600/e2e8f0/64748b?text=${text}`;
}

async function fetchAndUpload(vehicleId, make, model, year) {
  const imageUrl = await getImageUrl(make || 'Car', model || '', year || '');
  const res = await fetch(imageUrl, { headers: { Accept: 'image/*' } });
  if (!res.ok) throw new Error(`Fetch image: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const filePath = `vehicles/${vehicleId}/fetched_1.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, buf, { contentType, cacheControl: '3600', upsert: true });

  if (error) throw new Error(`Upload: ${error.message}`);
  return filePath;
}

async function main() {
  console.log('Fetching vehicles...');
  const { data: rows, error } = await supabase
    .from('vehicles')
    .select('id, make, model, year, images');
  if (error) {
    console.error('DB error:', error.message);
    process.exit(1);
  }
  const vehicles = rows || [];
  console.log(`Processing all ${vehicles.length} vehicles.`);

  let ok = 0;
  let fail = 0;
  for (const v of vehicles) {
    try {
      const path = await fetchAndUpload(v.id, v.make, v.model, v.year);
      const newImages = [path];
      const { error: updateErr } = await supabase
        .from('vehicles')
        .update({ images: newImages })
        .eq('id', v.id);
      if (updateErr) throw new Error(updateErr.message);
      console.log(`  ${v.id}: ${v.year} ${v.make} ${v.model} -> ${path}`);
      ok++;
    } catch (e) {
      console.error(`  ${v.id}: ${e.message}`);
      fail++;
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`Done. Updated: ${ok}, failed: ${fail}`);
}

main();
