import { View } from '../types.js';

export interface AppHistoryState {
  view: View;
  previousView: View;
  timestamp: number;
  selectedVehicleId?: number;
  selectedVehicleDatabaseId?: string;
}

/** React Router pathname for packaged WebView (`/index.html`) → logical app path. */
export function normalizeRouterPath(path: string): string {
  if (path == null || typeof path !== 'string') return '/';
  const p = path.trim();
  const lower = p.toLowerCase();
  if (lower === '/index.html' || lower.endsWith('/index.html')) {
    return '/';
  }
  return p;
}

/**
 * HashRouter should set pathname from the hash, but some Android WebViews briefly report "/"
 * while `location.hash` already contains the real route.
 */
export function getAppPathFromRouter(loc: { pathname?: string; hash?: string }): string {
  const raw = (loc?.pathname ?? '/') || '/';
  const p = normalizeRouterPath(raw);
  if (p.startsWith('/vehicle/')) return p;
  if (p !== '/' && p !== '') return p;
  const hashStr =
    loc?.hash != null && loc.hash.length > 0
      ? loc.hash
      : typeof window !== 'undefined' && window.location.hash
        ? window.location.hash
        : '';
  if (hashStr.length > 1) {
    try {
      const fromHash = hashStr.replace(/^#/, '').split('?')[0] || '/';
      if (fromHash.startsWith('/') && fromHash.length > 1) {
        return fromHash;
      }
    } catch {
      /* ignore */
    }
  }
  return p;
}

/** Map URL paths to views (safe for Capacitor/WebView). */
export function pathToView(path: string): View {
  if (path == null || typeof path !== 'string') return View.HOME;
  const normalizedPath = normalizeRouterPath(path).toLowerCase().trim();

  if (normalizedPath === '/' || normalizedPath === '') return View.HOME;
  if (normalizedPath === '/used-cars') return View.USED_CARS;
  if (normalizedPath === '/new-cars') return View.USED_CARS;
  if (normalizedPath === '/car-services') return View.CAR_SERVICES;
  if (normalizedPath === '/car-services/detail') return View.SERVICE_DETAIL;
  if (normalizedPath === '/car-services/login') return View.CAR_SERVICE_LOGIN;
  if (normalizedPath === '/car-services/dashboard') return View.CAR_SERVICE_DASHBOARD;
  if (normalizedPath === '/car-services/cart') return View.SERVICE_CART;
  if (normalizedPath === '/rental') return View.USED_CARS;
  if (normalizedPath === '/dealers') return View.DEALER_PROFILES;
  if (normalizedPath.startsWith('/vehicle/')) return View.DETAIL;
  if (normalizedPath === '/vehicle') return View.DETAIL;
  if (normalizedPath === '/seller/dashboard') return View.SELLER_DASHBOARD;
  if (normalizedPath === '/admin/login') return View.ADMIN_LOGIN;
  if (normalizedPath === '/admin/new-cars' || normalizedPath === '/admin/new-cars/manage') {
    return View.ADMIN_PANEL;
  }
  if (normalizedPath === '/admin/sell-car') return View.SELL_CAR_ADMIN;
  if (normalizedPath === '/admin' || normalizedPath === '/admin/panel') return View.ADMIN_PANEL;
  if (normalizedPath === '/login') return View.LOGIN_PORTAL;
  if (normalizedPath === '/404') return View.NOT_FOUND;
  if (normalizedPath === '/compare') return View.COMPARISON;
  if (normalizedPath === '/wishlist') return View.WISHLIST;
  if (normalizedPath === '/profile') return View.PROFILE;
  if (normalizedPath === '/forgot-password') return View.FORGOT_PASSWORD;
  if (normalizedPath === '/inbox') return View.INBOX;
  if (normalizedPath === '/notifications') return View.NOTIFICATIONS_CENTER;
  if (normalizedPath.startsWith('/seller/')) return View.SELLER_PROFILE;
  if (normalizedPath === '/seller') return View.SELLER_PROFILE;
  if (normalizedPath === '/pricing') return View.PRICING;
  if (normalizedPath === '/support') return View.SUPPORT;
  if (normalizedPath === '/about-us') return View.ABOUT_US;
  if (normalizedPath === '/faq') return View.HELP_CENTER;
  if (normalizedPath === '/help') return View.HELP_CENTER;
  if (normalizedPath === '/privacy-policy') return View.PRIVACY_POLICY;
  if (normalizedPath === '/terms-of-service') return View.TERMS_OF_SERVICE;
  if (normalizedPath === '/refund-policy') return View.REFUND_POLICY;
  if (normalizedPath === '/complaint-resolution') return View.COMPLAINT_RESOLUTION;
  if (normalizedPath === '/fraud-policy') return View.FRAUD_POLICY;
  if (normalizedPath === '/cookie-policy') return View.COOKIE_POLICY;
  if (normalizedPath === '/safety-center' || normalizedPath === '/safety') return View.SAFETY_CENTER;
  if (normalizedPath === '/customer/dashboard' || normalizedPath === '/buyer/dashboard') {
    return View.BUYER_DASHBOARD;
  }
  if (normalizedPath.startsWith('/city/')) return View.CITY_LANDING;
  if (normalizedPath === '/city') return View.CITY_LANDING;
  if (normalizedPath === '/sell-car') return View.SELL_CAR;

  return View.NOT_FOUND;
}

/** Static View → URL path (dynamic views use helpers in navigate()). */
export const VIEW_TO_PATH_MAP: Partial<Record<View, string>> = {
  [View.HOME]: '/',
  [View.USED_CARS]: '/used-cars',
  [View.CAR_SERVICES]: '/car-services',
  [View.SERVICE_DETAIL]: '/car-services/detail',
  [View.CAR_SERVICE_LOGIN]: '/car-services/login',
  [View.CAR_SERVICE_DASHBOARD]: '/car-services/dashboard',
  [View.SERVICE_CART]: '/car-services/cart',
  [View.RENTAL]: '/used-cars',
  [View.DEALER_PROFILES]: '/dealers',
  [View.SELLER_DASHBOARD]: '/seller/dashboard',
  [View.ADMIN_PANEL]: '/admin',
  [View.ADMIN_LOGIN]: '/admin/login',
  [View.LOGIN_PORTAL]: '/login',
  [View.CUSTOMER_LOGIN]: '/login?role=customer',
  [View.SELLER_LOGIN]: '/login?role=seller',
  [View.COMPARISON]: '/compare',
  [View.WISHLIST]: '/wishlist',
  [View.PROFILE]: '/profile',
  [View.FORGOT_PASSWORD]: '/forgot-password',
  [View.INBOX]: '/inbox',
  [View.PRICING]: '/pricing',
  [View.SUPPORT]: '/support',
  [View.ABOUT_US]: '/about-us',
  [View.FAQ]: '/faq',
  [View.HELP_CENTER]: '/help',
  [View.PRIVACY_POLICY]: '/privacy-policy',
  [View.TERMS_OF_SERVICE]: '/terms-of-service',
  [View.REFUND_POLICY]: '/refund-policy',
  [View.COMPLAINT_RESOLUTION]: '/complaint-resolution',
  [View.FRAUD_POLICY]: '/fraud-policy',
  [View.COOKIE_POLICY]: '/cookie-policy',
  [View.SAFETY_CENTER]: '/safety-center',
  [View.BUYER_DASHBOARD]: '/customer/dashboard',
  [View.SELL_CAR]: '/sell-car',
  [View.SELL_CAR_ADMIN]: '/admin/sell-car',
  [View.NOTIFICATIONS_CENTER]: '/notifications',
  [View.NOT_FOUND]: '/404',
};

export function viewToStaticPath(view: View): string {
  return VIEW_TO_PATH_MAP[view] ?? '/';
}

/** Email segment from /seller/:email (excludes /seller/dashboard). */
export function parseSellerEmailFromPath(path: string): string | null {
  const sellerSeg = path.match(/^\/seller\/(.+)$/i);
  if (!sellerSeg || sellerSeg[1].toLowerCase() === 'dashboard') return null;
  try {
    const email = decodeURIComponent(sellerSeg[1]).toLowerCase().trim();
    return email || null;
  } catch {
    return null;
  }
}

/** Map ?role= on /login to seller/customer login views so refresh keeps the intended portal. */
export function loginViewFromSearch(search: string | null | undefined): View | null {
  if (!search) return null;
  try {
    const role = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('role');
    const normalized = (role || '').toLowerCase().trim();
    if (normalized === 'seller') return View.SELLER_LOGIN;
    if (normalized === 'customer') return View.CUSTOMER_LOGIN;
  } catch {
    /* ignore */
  }
  return null;
}

export function resolveViewFromPathAndState(
  path: string,
  routerState: AppHistoryState | null | undefined,
  search?: string | null,
): View {
  const pathView = pathToView(path);
  if (pathView === View.LOGIN_PORTAL) {
    const roleView = loginViewFromSearch(search);
    if (roleView) return roleView;
    // URL is authoritative for /login — stale history.state.view must not show HOME on /login.
    return View.LOGIN_PORTAL;
  }
  if (pathView === View.SELLER_PROFILE) return View.SELLER_PROFILE;
  if (pathView === View.NOTIFICATIONS_CENTER) return View.NOTIFICATIONS_CENTER;
  if (pathView !== View.DETAIL && routerState?.view === View.DETAIL) {
    return pathView;
  }
  if (
    pathView === View.ADMIN_PANEL ||
    pathView === View.ADMIN_LOGIN ||
    pathView === View.SELL_CAR_ADMIN
  ) {
    return pathView;
  }
  return routerState?.view ?? pathView;
}

export function readInitialAppViewFromBrowser(): View {
  if (typeof window === 'undefined') return View.HOME;
  try {
    const path = getAppPathFromRouter({
      pathname: window.location.pathname || '/',
      hash: window.location.hash || '',
    });
    return resolveViewFromPathAndState(path, null, window.location.search);
  } catch {
    return View.HOME;
  }
}
