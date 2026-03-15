// Lightweight constants index - re-exports from split modules
// Use a single import style per file to avoid Vite chunking warnings (no mixing static + dynamic for same file)

// Core constants (static imports only)
import { PLAN_DETAILS } from './plans.js';
import {
  FUEL_TYPES,
  SAFETY_TIPS,
  FALLBACK_VEHICLES,
  FALLBACK_USERS,
  FALLBACK_FAQS,
  FALLBACK_SUPPORT_TICKETS,
} from './fallback.js';
export { FUEL_TYPES, SAFETY_TIPS } from './fallback.js';
export {
  INSPECTION_SERVICE_FEE,
  LISTING_EXPIRY_DAYS,
  AUTO_REFRESH_DAYS,
  MAX_FREE_LISTINGS,
  MAX_PRO_LISTINGS,
  PLAN_DETAILS,
} from './plans.js';

// Lazy-loaded constants (dynamic import only for these modules — no static import of same file)
export const loadLocationData = async () => {
  const module = await import('./location.js');
  return module;
};

/** Returns PLAN_DETAILS (static import only — avoids Vite chunking warning). */
export const loadPlanDetails = async () => PLAN_DETAILS;

export const loadBoostPackages = async () => {
  const module = await import('./boost.js');
  return module.BOOST_PACKAGES;
};

/** Returns fallback data (uses statically imported constants to avoid mixing import styles). */
export const loadFallbackData = async () => ({
  vehicles: FALLBACK_VEHICLES,
  users: FALLBACK_USERS,
  faqs: FALLBACK_FAQS,
  supportTickets: FALLBACK_SUPPORT_TICKETS,
});

// For backward compatibility - these will be loaded lazily
export const INDIAN_STATES = [] as any; // Will be populated when needed
export const CITIES_BY_STATE = {} as any; // Will be populated when needed
export const BOOST_PACKAGES = [] as any; // Will be populated when needed
export const MOCK_VEHICLES = [] as any; // Will be populated when needed
export const MOCK_USERS = [] as any; // Will be populated when needed
export const MOCK_FAQS = [] as any; // Will be populated when needed
export const MOCK_SUPPORT_TICKETS = [] as any; // Will be populated when needed
