import type { Vehicle } from '../types.js';
import { logWarn } from './logger.js';
import { normalizeVehiclesList } from './vehicleIdentity.js';

/**
 * After login sync: avoid replacing a full catalog with a tiny partial response (stale dedup / bad cache).
 * Admins always take the server result so bulk deletes stay correct.
 */
export function mergeVehicleCatalog(prev: Vehicle[], incoming: Vehicle[], isAdmin: boolean): Vehicle[] {
  const normPrev = normalizeVehiclesList(Array.isArray(prev) ? prev : []);
  const normIncoming = normalizeVehiclesList(Array.isArray(incoming) ? incoming : []);
  if (normIncoming.length === 0) return normPrev.length > 0 ? normPrev : [];
  if (normPrev.length === 0 || normIncoming.length >= normPrev.length) return normIncoming;
  if (isAdmin) return normIncoming;
  if (normPrev.length >= 5 && normIncoming.length <= 2) {
    logWarn(
      `⚠️ Skipping vehicle state shrink (${normIncoming.length} vs ${normPrev.length} cached) — likely partial API response.`,
    );
    return normPrev;
  }
  return normIncoming;
}
