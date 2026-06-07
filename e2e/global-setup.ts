import { FullConfig } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import { ensureSoldVehicleForE2E } from './helpers/catalog';

const SEED_STORAGE_PATH = path.join(process.cwd(), 'e2e/.auth/seed-storage.json');

async function waitForDevApi() {
  const base = process.env.E2E_API_URL ?? 'http://127.0.0.1:3001';
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return;
    } catch {
      // API still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Dev API did not become ready for E2E setup');
}

async function waitForFrontend(baseURL: string) {
  const origin = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const res = await fetch(origin, { signal: AbortSignal.timeout(3000) });
      if (res.status < 500) return;
    } catch {
      // Vite still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Frontend did not become ready at ${origin}`);
}

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E Test Global Setup...');

  const baseURL =
    (typeof config.projects[0]?.use?.baseURL === 'string' && config.projects[0].use.baseURL) ||
    process.env.PLAYWRIGHT_BASE_URL ||
    'http://localhost:5173';
  const origin = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;

  try {
    await waitForDevApi();
    await waitForFrontend(baseURL);

    await fs.mkdir(path.dirname(SEED_STORAGE_PATH), { recursive: true });
    const cookieDomain = new URL(`${origin}/`).hostname;
    await fs.writeFile(
      SEED_STORAGE_PATH,
      JSON.stringify(
        {
          cookies: [
            {
              name: 'CookieConsent',
              value: 'true',
              domain: cookieDomain,
              path: '/',
              expires: -1,
              httpOnly: false,
              secure: false,
              sameSite: 'Lax',
            },
          ],
          origins: [],
        },
        null,
        2,
      ),
    );

    const sold = await ensureSoldVehicleForE2E();
    if (sold) {
      console.log(`✅ E2E sold fixture ready (vehicle id: ${sold.id})`);
    } else {
      console.warn('⚠️ No sold vehicle seeded — sold listing E2E may skip');
    }
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }

  console.log('✅ Global setup completed');
}

export default globalSetup;
