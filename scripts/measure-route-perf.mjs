/**
 * Baseline / after route performance sampler (Playwright).
 * Measures navigation timing + paint metrics for major routes.
 *
 * Usage: node scripts/measure-route-perf.mjs [baseUrl] [outJson]
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const baseUrl = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '');
const outPath =
  process.argv[3] ||
  path.join(process.cwd(), 'scripts', `perf-results-${Date.now()}.json`);

const ROUTES = [
  { name: 'Home', path: '/' },
  { name: 'Vehicle Listing', path: '/used-cars' },
  { name: 'Login', path: '/login' },
  { name: 'Dealers', path: '/dealers' },
  { name: 'Car Services', path: '/car-services' },
  { name: 'Sell Car', path: '/sell-car' },
  { name: 'Pricing', path: '/pricing' },
  { name: 'Support', path: '/support' },
  { name: 'FAQ', path: '/faq' },
  { name: 'Wishlist', path: '/wishlist' },
  { name: 'Compare', path: '/compare' },
  { name: 'Inbox', path: '/inbox' },
  { name: 'Profile', path: '/profile' },
  { name: 'Seller Dashboard', path: '/seller/dashboard' },
  { name: 'Buyer Dashboard', path: '/customer/dashboard' },
  { name: 'Admin', path: '/admin' },
];

async function collectMetrics(page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paints = performance.getEntriesByType('paint');
    const fp = paints.find((p) => p.name === 'first-paint')?.startTime ?? null;
    const fcp =
      paints.find((p) => p.name === 'first-contentful-paint')?.startTime ?? null;

    let lcp = null;
    try {
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      if (lcpEntries.length) lcp = lcpEntries[lcpEntries.length - 1].startTime;
    } catch {
      /* ignore */
    }

    const resources = performance.getEntriesByType('resource');
    const transferSize = resources.reduce(
      (sum, r) => sum + (r.transferSize || 0),
      0,
    );
    const jsBytes = resources
      .filter((r) => r.name.includes('.js') || r.initiatorType === 'script')
      .reduce((sum, r) => sum + (r.transferSize || 0), 0);
    const cssBytes = resources
      .filter((r) => r.name.includes('.css') || r.initiatorType === 'link')
      .reduce((sum, r) => sum + (r.transferSize || 0), 0);

    return {
      ttfb: nav ? nav.responseStart - nav.requestStart : null,
      domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.startTime : null,
      loadEvent: nav ? nav.loadEventEnd - nav.startTime : null,
      fp,
      fcp,
      lcp,
      resourceCount: resources.length,
      transferKB: Math.round(transferSize / 1024),
      jsKB: Math.round(jsBytes / 1024),
      cssKB: Math.round(cssBytes / 1024),
      jsHeapMB:
        performance.memory
          ? Math.round((performance.memory.usedJSHeapSize / (1024 * 1024)) * 10) /
            10
          : null,
    };
  });
}

async function measureRoute(browser, route, mobile) {
  const context = await browser.newContext(
    mobile
      ? {
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
          userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        }
      : { viewport: { width: 1440, height: 900 } },
  );
  await context.addInitScript(() => {
    try {
      new PerformanceObserver((list) => {
        list.getEntries().forEach((e) => {
          void e;
        });
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      /* ignore */
    }
  });
  const page = await context.newPage();
  const started = Date.now();
  try {
    await page.goto(`${baseUrl}${route.path}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForTimeout(3000);
    const metrics = await collectMetrics(page);
    const wallMs = Date.now() - started;
    await context.close();
    return { ...route, mobile, wallMs, error: null, ...metrics };
  } catch (e) {
    const error = e?.message || String(e);
    await context.close();
    return {
      ...route,
      mobile,
      wallMs: Date.now() - started,
      error,
      ttfb: null,
      fcp: null,
      lcp: null,
    };
  }
}

async function main() {
  console.log(`Measuring ${ROUTES.length} routes at ${baseUrl}…`);
  const browser = await chromium.launch({ headless: true });
  const results = [];

  {
    const warm = await browser.newPage();
    try {
      await warm.goto(baseUrl + '/', { waitUntil: 'networkidle', timeout: 90000 });
      await warm.waitForTimeout(2000);
    } catch {
      /* continue */
    }
    await warm.close();
  }

  for (const route of ROUTES) {
    process.stdout.write(`  desktop ${route.name}… `);
    const desk = await measureRoute(browser, route, false);
    console.log(
      desk.error
        ? `ERR ${desk.error.slice(0, 80)}`
        : `FCP=${desk.fcp?.toFixed?.(0) ?? 'n/a'} LCP=${desk.lcp?.toFixed?.(0) ?? 'n/a'} load=${desk.loadEvent?.toFixed?.(0) ?? 'n/a'}ms heap=${desk.jsHeapMB ?? 'n/a'}MB`,
    );
    results.push(desk);

    process.stdout.write(`  mobile  ${route.name}… `);
    const mob = await measureRoute(browser, route, true);
    console.log(
      mob.error
        ? `ERR ${mob.error.slice(0, 80)}`
        : `FCP=${mob.fcp?.toFixed?.(0) ?? 'n/a'} LCP=${mob.lcp?.toFixed?.(0) ?? 'n/a'} load=${mob.loadEvent?.toFixed?.(0) ?? 'n/a'}ms heap=${mob.jsHeapMB ?? 'n/a'}MB`,
    );
    results.push(mob);
  }

  await browser.close();

  const ok = results.filter((r) => !r.error);
  const avg = (key) => {
    const vals = ok.map((r) => r[key]).filter((v) => typeof v === 'number');
    if (!vals.length) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  const summary = {
    measuredAt: new Date().toISOString(),
    baseUrl,
    routeCount: ROUTES.length,
    sampleCount: results.length,
    averages: {
      fcp: avg('fcp'),
      lcp: avg('lcp'),
      ttfb: avg('ttfb'),
      loadEvent: avg('loadEvent'),
      transferKB: avg('transferKB'),
      jsKB: avg('jsKB'),
      jsHeapMB: avg('jsHeapMB'),
    },
    desktopAvg: {
      fcp: avgFrom(ok.filter((r) => !r.mobile), 'fcp'),
      lcp: avgFrom(ok.filter((r) => !r.mobile), 'lcp'),
      loadEvent: avgFrom(ok.filter((r) => !r.mobile), 'loadEvent'),
    },
    mobileAvg: {
      fcp: avgFrom(ok.filter((r) => r.mobile), 'fcp'),
      lcp: avgFrom(ok.filter((r) => r.mobile), 'lcp'),
      loadEvent: avgFrom(ok.filter((r) => r.mobile), 'loadEvent'),
    },
    results,
  };

  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`\nWrote ${outPath}`);
  console.log('Averages:', summary.averages);
  console.log('Desktop:', summary.desktopAvg);
  console.log('Mobile:', summary.mobileAvg);
}

function avgFrom(rows, key) {
  const vals = rows.map((r) => r[key]).filter((v) => typeof v === 'number');
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
