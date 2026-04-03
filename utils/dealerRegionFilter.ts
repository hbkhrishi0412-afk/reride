import type { User } from '../types.js';
import { CITIES_BY_STATE, INDIAN_STATES } from '../constants/location.js';
import { getCityNamesForDisplay } from './cityMapping.js';

/**
 * Whether a dealer should show when the user picked a region in the header LocationModal.
 * Handles "All of India", state names (any city in that state), and city / display names.
 */
export function sellerMatchesHeaderRegion(seller: User, region: string | undefined): boolean {
  const r = (region || '').trim();
  if (!r || /^all of india$/i.test(r)) return true;

  const blob = [seller.location, seller.address]
    .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    .join(' ')
    .toLowerCase();
  const rl = r.toLowerCase();

  if (blob.includes(rl)) return true;

  for (const alias of getCityNamesForDisplay(r)) {
    const a = alias.toLowerCase();
    if (a && blob.includes(a)) return true;
  }

  const state = INDIAN_STATES.find(
    (s) =>
      s.name.toLowerCase() === rl ||
      s.name.toLowerCase().includes(rl) ||
      rl.includes(s.name.toLowerCase())
  );
  if (state) {
    const cities = CITIES_BY_STATE[state.code] || [];
    if (cities.some((city) => blob.includes(city.toLowerCase()))) return true;
    if (blob.includes(state.name.toLowerCase())) return true;
  }

  return false;
}
