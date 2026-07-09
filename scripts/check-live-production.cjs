/**
 * Quick live check: does production still ship the broken vendor-i18n chunk?
 * Run: node scripts/check-live-production.cjs [url]
 */
const url = process.argv[2] || 'https://www.reride.co.in/';

async function main() {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const html = await res.text();

  const scriptSrc = [...html.matchAll(/<script[^>]+src="([^"]+)"/gi)].map((m) => m[1]);
  const modulePreload = [...html.matchAll(/<link[^>]+href="([^"]+)"/gi)].map((m) => m[1]);
  const assets = [...scriptSrc, ...modulePreload];

  const hasVendorI18n = assets.some((a) => a.includes('vendor-i18n'));
  const hasBrokenTsxPreload = assets.some((a) => a.endsWith('.tsx'));
  const entry = assets.find((a) => /\/assets\/index-[^/]+\.js/.test(a));

  console.log(`URL: ${url}`);
  console.log(`Entry script: ${entry || '(not found)'}`);
  console.log(`vendor-i18n referenced: ${hasVendorI18n ? 'YES (BROKEN — not deployed with fix)' : 'no'}`);
  console.log(`Broken .tsx preload: ${hasBrokenTsxPreload ? 'YES' : 'no'}`);

  if (entry) {
    try {
      const entryUrl = new URL(entry, url).href;
      const entryRes = await fetch(entryUrl, { signal: AbortSignal.timeout(20000) });
      const entryJs = await entryRes.text();
      const entryImportsI18n = /vendor-i18n-[A-Za-z0-9_-]+\.js/.test(entryJs);
      console.log(`Entry imports vendor-i18n chunk: ${entryImportsI18n ? 'YES (BROKEN)' : 'no'}`);
      if (hasVendorI18n || entryImportsI18n) process.exit(1);
    } catch (e) {
      console.warn(`Could not fetch entry bundle: ${e.message}`);
    }
  }

  if (hasVendorI18n || hasBrokenTsxPreload) process.exit(1);
  console.log('✅ Live HTML looks like the fixed build (or at least not the known-broken i18n split).');
}

main().catch((e) => {
  console.error('❌ Live check failed:', e.message);
  process.exit(2);
});
