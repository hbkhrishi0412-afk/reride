/**
 * Anonymous-friendly recently-viewed vehicle tracking.
 *
 * The authenticated flow already uses `services/buyerService.ts` to sync
 * recently-viewed IDs to Supabase. This utility is a lightweight parallel
 * store for *anonymous* users (and a hot cache for authed users) so that
 * the home page can show a "Continue browsing" strip the very first time
 * a visitor taps a card — before they ever create an account.
 *
 * Storage is localStorage-only and capped at 20 ids. Failures are silent.
 */

import { safeGetItem, safeSetItem } from './safeStorage';

const KEY = 'reride.recentlyViewed.local';
const MAX_IDS = 20;

/** Custom event fired when the list changes; components can subscribe. */
export const RECENTLY_VIEWED_CHANGED_EVENT = 'reride:recently-viewed-changed';

const parse = (raw: string | null): number[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((v) => (typeof v === 'number' ? v : Number(v)))
      .filter((n) => Number.isFinite(n));
  } catch {
    return [];
  }
};

/** Returns up to MAX_IDS recently-viewed vehicle ids, most recent first. */
export const getLocalRecentIds = (): number[] => {
  return parse(safeGetItem(KEY));
};

/**
 * Records `vehicleId` at the front of the list. If it already existed, it
 * is moved to the front (not duplicated). Dispatches a DOM event so other
 * tabs/components can react without polling.
 */
export const addLocalRecentId = (vehicleId: number): void => {
  if (!Number.isFinite(vehicleId)) return;
  const current = parse(safeGetItem(KEY));
  const filtered = current.filter((id) => id !== vehicleId);
  const next = [vehicleId, ...filtered].slice(0, MAX_IDS);
  safeSetItem(KEY, JSON.stringify(next));
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(RECENTLY_VIEWED_CHANGED_EVENT));
    } catch {
      /* CustomEvent unsupported — non-critical */
    }
  }
};
