#!/usr/bin/env node
/**
 * Generates public/sitemap.xml from Supabase published vehicles + static routes.
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or anon key for read-only).
 *
 * Usage: node scripts/generate-sitemap.cjs
 */
const fs = require('fs');
const path = require('path');

const BASE = (process.env.VITE_APP_URL || 'https://www.reride.co.in').replace(/\/$/, '');
const OUT = path.join(process.cwd(), 'public', 'sitemap.xml');

const STATIC_ROUTES = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/used-cars', changefreq: 'hourly', priority: '0.9' },
  { loc: '/sell-car', changefreq: 'weekly', priority: '0.8' },
  { loc: '/dealers', changefreq: 'daily', priority: '0.7' },
  { loc: '/car-services', changefreq: 'daily', priority: '0.8' },
  { loc: '/compare', changefreq: 'weekly', priority: '0.6' },
  { loc: '/pricing', changefreq: 'weekly', priority: '0.6' },
  { loc: '/about-us', changefreq: 'monthly', priority: '0.5' },
  { loc: '/faq', changefreq: 'monthly', priority: '0.5' },
  { loc: '/support', changefreq: 'monthly', priority: '0.5' },
  { loc: '/safety-center', changefreq: 'monthly', priority: '0.5' },
  { loc: '/privacy-policy', changefreq: 'yearly', priority: '0.3' },
  { loc: '/terms-of-service', changefreq: 'yearly', priority: '0.3' },
];

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function urlEntry(loc, changefreq, priority, lastmod) {
  const parts = [`  <url><loc>${xmlEscape(loc)}</loc>`];
  if (lastmod) parts.push(`<lastmod>${lastmod}</lastmod>`);
  parts.push(`<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`);
  return parts.join('');
}

async function fetchPublishedVehicles() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn('[sitemap] Supabase env missing — static routes only.');
    return [];
  }

  const vehicles = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const apiUrl = `${url.replace(/\/$/, '')}/rest/v1/vehicles?select=id,updated_at,city,status&status=eq.published&order=updated_at.desc&offset=${offset}&limit=${pageSize}`;
    const res = await fetch(apiUrl, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    if (!res.ok) {
      console.warn('[sitemap] Supabase fetch failed:', res.status, await res.text());
      break;
    }
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    vehicles.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return vehicles;
}

async function main() {
  const entries = STATIC_ROUTES.map((r) => urlEntry(`${BASE}${r.loc}`, r.changefreq, r.priority));

  const vehicles = await fetchPublishedVehicles();
  const cities = new Set();
  for (const v of vehicles) {
    const id = v.id;
    if (!id) continue;
    const lastmod = v.updated_at ? String(v.updated_at).slice(0, 10) : undefined;
    entries.push(urlEntry(`${BASE}/vehicle/${encodeURIComponent(id)}`, 'daily', '0.8', lastmod));
    const city = (v.city || '').trim();
    if (city) cities.add(city.toLowerCase().replace(/\s+/g, '-'));
  }
  for (const slug of cities) {
    entries.push(urlEntry(`${BASE}/city/${encodeURIComponent(slug)}`, 'weekly', '0.7'));
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');

  fs.writeFileSync(OUT, xml, 'utf8');
  console.log(`[sitemap] Wrote ${entries.length} URLs to ${OUT}`);
}

main().catch((err) => {
  console.error('[sitemap] Failed:', err);
  process.exit(1);
});
