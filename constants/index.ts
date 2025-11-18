// Lightweight constants index - re-exports from split modules
// This allows lazy loading of heavy data when needed

// Core constants (always loaded)
export { FUEL_TYPES, SAFETY_TIPS } from './fallback.js';
export { INSPECTION_SERVICE_FEE, LISTING_EXPIRY_DAYS, AUTO_REFRESH_DAYS, MAX_FREE_LISTINGS, MAX_PRO_LISTINGS } from './plans.js';

// Lazy-loaded constants (loaded on demand)
export const loadLocationData = async () => {
  const module = await import('./location.js');
  return module;
};

export const loadPlanDetails = async () => {
  const module = await import('./plans.js');
  return module.PLAN_DETAILS;
};

export const loadBoostPackages = async () => {
  const module = await import('./boost.js');
  return module.BOOST_PACKAGES;
};

export const loadFallbackData = async () => {
  const module = await import('./fallback.js');
  return {
    vehicles: module.FALLBACK_VEHICLES,
    users: module.FALLBACK_USERS,
    faqs: module.FALLBACK_FAQS,
    supportTickets: module.FALLBACK_SUPPORT_TICKETS
  };
};

// For backward compatibility - these will be loaded lazily
export const PLAN_DETAILS = {} as any; // Will be populated when needed
export const INDIAN_STATES = [] as any; // Will be populated when needed
export const CITIES_BY_STATE = {} as any; // Will be populated when needed
export const BOOST_PACKAGES = [] as any; // Will be populated when needed
export const MOCK_VEHICLES = [] as any; // Will be populated when needed
export const MOCK_USERS = [] as any; // Will be populated when needed
export const MOCK_FAQS = [] as any; // Will be populated when needed
export const MOCK_SUPPORT_TICKETS = [] as any; // Will be populated when needed
