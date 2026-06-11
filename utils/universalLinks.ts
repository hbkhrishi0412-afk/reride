/**
 * Universal Links (iOS) / App Links (Android) — open https://www.reride.co.in/* in the native app.
 * Requires `.well-known` files on the web host and associated-domains / intent-filters in native projects.
 */
import { App } from '@capacitor/app';
import { isCapacitorNative } from './apiConfig.js';

const UNIVERSAL_LINK_HOSTS = new Set(['www.reride.co.in', 'reride.co.in']);

const PROTECTED_PATH_PREFIXES = [
  '/seller/dashboard',
  '/admin',
  '/profile',
  '/inbox',
  '/buyer/dashboard',
  '/customer/dashboard',
  '/car-services/dashboard',
];

function isOAuthDeepLink(urlString: string): boolean {
  return urlString.startsWith('com.reride.app://');
}

function isProtectedAppPath(pathname: string): boolean {
  const normalized = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

function hasAuthenticatedSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('reRideCurrentUser');
    if (!raw) return false;
    const user = JSON.parse(raw) as { email?: string; role?: string };
    return Boolean(user?.email && user?.role);
  } catch {
    return false;
  }
}

export function applyUniversalLink(urlString: string): void {
  if (isOAuthDeepLink(urlString)) return;
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'https:' || !UNIVERSAL_LINK_HOSTS.has(parsed.hostname)) {
      return;
    }

    if (isProtectedAppPath(parsed.pathname) && !hasAuthenticatedSession()) {
      window.location.hash = '/login';
      return;
    }

    const hashPath = `${parsed.pathname}${parsed.search}`;
    const nextHash = hashPath.startsWith('#') ? hashPath : `#${hashPath}`;
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  } catch {
    /* ignore malformed URLs */
  }
}

export function initUniversalLinksHandler(): void {
  if (!isCapacitorNative() || typeof window === 'undefined') return;

  void App.getLaunchUrl()
    .then((result) => {
      if (result?.url) applyUniversalLink(result.url);
    })
    .catch(() => {
      /* non-fatal */
    });

  void App.addListener('appUrlOpen', ({ url }) => {
    applyUniversalLink(url);
  });
}
