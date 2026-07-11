import type { Page } from '@playwright/test';
import { E2E_TEST_USERS } from '../fixtures/test-users';

export type E2ERole = 'admin' | 'seller' | 'customer';

const LOGIN_ROLE_CUSTOMER = /^Customer$/i;
const LOGIN_ROLE_SELLER = /^Seller$/i;

/** Wait until the SPA has replaced the static "Loading ReRide" shell. */
export async function waitForAppMounted(page: Page, timeout = 60_000) {
  await page.waitForFunction(
    () => {
      if ((window as Window & { __RERIDE_MOUNTED__?: boolean }).__RERIDE_MOUNTED__) return true;
      const root = document.getElementById('root');
      if (!root) return false;
      return !root.innerHTML.includes('Loading ReRide');
    },
    undefined,
    { timeout },
  );
}

/** Login portal role picker (Customer / Seller tiles). */
export async function waitForLoginPortal(page: Page, timeout = 60_000) {
  await waitForAppMounted(page, timeout);
  await page.getByRole('button', { name: LOGIN_ROLE_CUSTOMER }).first().waitFor({
    state: 'visible',
    timeout,
  });
  await page.getByRole('button', { name: LOGIN_ROLE_SELLER }).first().waitFor({
    state: 'visible',
    timeout,
  });
}

/** Persist test users + dismiss cookie banner before navigation. */
export async function prepareE2EPage(page: Page, baseURL = 'http://localhost:5173') {
  const origin = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
  await page.context().addCookies([
    {
      name: 'CookieConsent',
      value: 'true',
      url: `${origin}/`,
    },
  ]);
  await page.addInitScript((users) => {
    // Init scripts run on EVERY navigation. Seed users each time (idempotent), but only
    // clear auth/session state once per test — otherwise page.goto() after login logs the user out.
    localStorage.setItem('reRideUsers', JSON.stringify(users));
    localStorage.setItem('reRideUsers_prod', JSON.stringify(users));
    if (localStorage.getItem('__reride_e2e_prepared__')) {
      return;
    }
    localStorage.setItem('__reride_e2e_prepared__', '1');

    const clearSupabaseKeys = () => {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (
          key === 'sb-access-token' ||
          key === 'supabase.auth.token' ||
          (key.startsWith('sb-') && key.endsWith('-auth-token'))
        ) {
          toRemove.push(key);
        }
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
    };

    localStorage.setItem('reRideUsers', JSON.stringify(users));
    localStorage.setItem('reRideUsers_prod', JSON.stringify(users));
    localStorage.removeItem('reRideCurrentUser');
    localStorage.removeItem('reRideAccessToken');
    localStorage.removeItem('reRideRefreshToken');
    localStorage.removeItem('reride_oauth_role');
    localStorage.removeItem('reride_oauth_mode');
    localStorage.removeItem('reride_last_role');
    clearSupabaseKeys();
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('currentUser');
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('reride_oauth_role');
      sessionStorage.removeItem('reride_oauth_mode');
      sessionStorage.removeItem('reride_last_role');
    }
  }, E2E_TEST_USERS);
}

export async function dismissCookieBanner(page: Page) {
  const accept = page.locator('#rcc-confirm-button');
  try {
    await accept.waitFor({ state: 'visible', timeout: 2000 });
    await accept.click();
  } catch {
    /* not shown */
  }
}

async function submitCredentialForm(page: Page, email: string, password: string) {
  const emailInput = page
    .locator('#email-address, #mobile-email, input[name="email"], input[type="email"]')
    .first();
  await emailInput.waitFor({ state: 'visible', timeout: 60_000 });
  await emailInput.click();
  await emailInput.fill('');
  await emailInput.fill(email);
  const passwordInput = page
    .locator('#password, #mobile-password, input[name="password"], input[type="password"]')
    .first();
  await passwordInput.waitFor({ state: 'visible', timeout: 30_000 });
  await passwordInput.fill(password);
  const submit = page
    .locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Sign in")')
    .first();
  await submit.waitFor({ state: 'visible', timeout: 30_000 });
  await submit.click();
}

/** Login portal → role tile (or ?role=) → email/password form. */
export async function loginViaPortal(page: Page, role: 'seller' | 'customer', baseURL?: string) {
  await prepareE2EPage(page, baseURL);
  await page.goto(`/login?role=${role}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await dismissCookieBanner(page);
  await waitForAppMounted(page);
  const emailField = page.locator('#email-address, #mobile-email, input[name="email"], input[type="email"]').first();
  const roleLabel = role === 'seller' ? LOGIN_ROLE_SELLER : LOGIN_ROLE_CUSTOMER;
  const roleButton = page.getByRole('button', { name: roleLabel }).first();
  // ?role= usually skips the role picker, but lazy chunks can render either late — wait for whichever appears.
  await emailField
    .or(roleButton)
    .first()
    .waitFor({ state: 'visible', timeout: 60_000 });
  if (!(await emailField.isVisible())) {
    await roleButton.click();
    await emailField.waitFor({ state: 'visible', timeout: 30_000 });
  }
  const user = E2E_TEST_USERS.find((u) => u.role === role)!;
  await submitCredentialForm(page, user.email, user.password);
}

function isPostAdminLoginUrl(url: URL): boolean {
  const path = url.pathname.replace(/\/$/, '') || '/';
  return path === '/admin' || (path.startsWith('/admin/') && !path.includes('/login'));
}

export async function loginAsAdmin(page: Page, baseURL?: string) {
  await prepareE2EPage(page, baseURL);
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await dismissCookieBanner(page);
  await waitForAppMounted(page);
  await page.getByRole('button', { name: /Sign in as Admin/i }).waitFor({ state: 'visible', timeout: 60_000 });
  const user = E2E_TEST_USERS.find((u) => u.role === 'admin')!;
  await submitCredentialForm(page, user.email, user.password);
  await page.waitForURL(isPostAdminLoginUrl, { timeout: 30_000 });
}

export async function loginAsSeller(page: Page, baseURL?: string) {
  await loginViaPortal(page, 'seller', baseURL);
  await page.waitForURL(/\/seller\/dashboard/, { timeout: 30_000 });
}

export async function loginAsCustomer(page: Page, baseURL?: string) {
  await loginViaPortal(page, 'customer', baseURL);
  await page.waitForURL(
    (url) => {
      const path = url.pathname.replace(/\/$/, '') || '/';
      return path === '/' || !path.includes('login');
    },
    { timeout: 30_000 },
  );
  await page.getByText('Test Customer').first().waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForFunction(
    () => {
      try {
        return Boolean(
          sessionStorage.getItem('reRideAccessToken') ||
            localStorage.getItem('reRideAccessToken') ||
            localStorage.getItem('reRideRefreshToken'),
        );
      } catch {
        return false;
      }
    },
    undefined,
    { timeout: 30_000 },
  );
}

/** Header Login → portal (legacy specs). */
export async function openLoginPortal(page: Page, baseURL?: string) {
  await prepareE2EPage(page, baseURL);
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await dismissCookieBanner(page);
  await waitForLoginPortal(page);
}
