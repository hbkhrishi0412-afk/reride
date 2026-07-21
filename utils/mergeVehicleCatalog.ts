import type { Vehicle } from '../types.js';
import { logWarn } from './logger.js';
import { normalizeVehiclesList, vehicleIdsEqual } from './vehicleIdentity.js';

/**
 * Merge catalog updates without wiping a larger local set with a smaller page.
 * Non-admin: upsert by identity (page-1 / load-more safe). Admin: take server list.
 */
export function mergeVehicleCatalog(prev: Vehicle[], incoming: Vehicle[], isAdmin: boolean): Vehicle[] {
  const normPrev = normalizeVehiclesList(Array.isArray(prev) ? prev : []);
  const normIncoming = normalizeVehiclesList(Array.isArray(incoming) ? incoming : []);
  if (normIncoming.length === 0) return normPrev.length > 0 ? normPrev : [];
  if (isAdmin) return normIncoming;
  if (normPrev.length === 0) return normIncoming;

  // Prefer upsert whenever incoming is a partial page (typical storefront pagination).
  if (normIncoming.length < normPrev.length) {
    const byKey = new Map<string, Vehicle>();
    const keyOf = (v: Vehicle) =>
      (v.databaseId && String(v.databaseId).trim()) || String(v.id);

    for (const v of normPrev) {
      byKey.set(keyOf(v), v);
    }
    for (const v of normIncoming) {
      const k = keyOf(v);
      const existing = byKey.get(k);
      if (existing) {
        byKey.set(k, { ...existing, ...v });
      } else {
        // Also try numeric id collision
        let replaced = false;
        for (const [ek, ev] of byKey) {
          if (vehicleIdsEqual(ev.id, v.id)) {
            byKey.set(ek, { ...ev, ...v });
            replaced = true;
            break;
          }
        }
        if (!replaced) byKey.set(k, v);
      }
    }
    if (normPrev.length >= 5 && normIncoming.length <= 2) {
      logWarn(
        `⚠️ Catalog upsert from partial response (${normIncoming.length} into ${normPrev.length}).`,
      );
    }
    return Array.from(byKey.values());
  }

  return normIncoming;
}
