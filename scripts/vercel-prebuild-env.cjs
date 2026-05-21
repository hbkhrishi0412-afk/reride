#!/usr/bin/env node
/**
 * Vercel + Supabase integration often injects SUPABASE_* but Vite requires VITE_SUPABASE_*.
 * Run before `vite build` on Vercel (see build:vercel / vercel.json).
 */
const pairs = [
  ['SUPABASE_URL', 'VITE_SUPABASE_URL'],
  ['SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY'],
];

for (const [src, dest] of pairs) {
  const value = process.env[src];
  if (value && value.trim() && !process.env[dest]) {
    process.env[dest] = value.trim();
    console.log(`[vercel-prebuild] Mapped ${src} → ${dest}`);
  }
}

const onVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
if (!onVercel) {
  process.exit(0);
}

const isPlaceholder = (v) =>
  !v ||
  v.includes('your-project-ref') ||
  v.includes('your_supabase') ||
  v.includes('your_anon_key');

const required = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

const missing = required.filter((key) => isPlaceholder(process.env[key]));

if (missing.length > 0) {
  console.error('\n[vercel-prebuild] Missing or placeholder env on Vercel:\n  ' + missing.join('\n  '));
  console.error(`
Fix "Provisioning integrations failed" / empty Supabase vars:
  1. Vercel → reride-2 → Settings → Integrations → Re-ride (Supabase)
     → Remove integration, then Add again → Connect EXISTING project (pqtrsoytudolnvuydvfo)
  2. Settings → Environment Variables → fix any "Needs attention" rows
     Required: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
               VITE_SUPABASE_URL (same URL), VITE_SUPABASE_ANON_KEY (same anon key),
               JWT_SECRET, ALLOWED_ORIGINS
  3. Redeploy Production

See docs/VERCEL_SUPABASE_DEPLOY.md
`);
  process.exit(1);
}

console.log('[vercel-prebuild] Supabase env OK for Vercel build');
