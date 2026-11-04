import type { Vehicle } from '../types.js';
import { logWarn } from './logger.js';
import { normalizeVehiclesList, vehicleIdsEqual } from './vehicleIdentity.js';

export type MergeVehicleCatalogOptions = {
  /** Server page is the full live catalog — drop rows it no longer returns. */
  authoritative?: boolean;
};

function updatedAtMs(vehicle: Vehicle): number {
  const t = Date.parse(vehicle.updatedAt || '');
  return Number.isNaN(t) ? 0 : t;
}

function keyOf(vehicle: Vehicle): string {
  return (vehicle.databaseId && String(vehicle.databaseId).trim()) || String(vehicle.id);
}

/** Keep the local row when a stale response is older than what the seller just saved. */
function preferIncoming(existing: Vehicle | undefined, incoming: Vehicle): Vehicle {
  if (!existing) return incoming;
  if (updatedAtMs(incoming) < updatedAtMs(existing)) return existing;
  return { ...existing, ...incoming };
}

function upsert(prev: Vehicle[], incoming: Vehicle[]): Vehicle[] {
  const byKey = new Map<string, Vehicle>();
  for (const vehicle of prev) {
    byKey.set(keyOf(vehicle), vehicle);
  }
  for (const vehicle of incoming) {
    const key = keyOf(vehicle);
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, preferIncoming(existing, vehicle));
      continue;
    }
    let replaced = false;
    for (const [existingKey, existingVehicle] of byKey) {
      if (vehicleIdsEqual(existingVehicle.id, vehicle.id)) {
        byKey.set(existingKey, preferIncoming(existingVehicle, vehicle));
        replaced = true;
        break;
      }
    }
    if (!replaced) byKey.set(key, vehicle);
  }
  return Array.from(byKey.values());
}

/**
 * Merge catalog updates without wiping a larger local set with a smaller page.
 * Non-admin: upsert by identity (page-1 / load-more safe). Admin: take server list.
 * A stale payload cannot overwrite a newer local edit.
 */
export function mergeVehicleCatalog(
  prev: Vehicle[],
  incoming: Vehicle[],
  isAdmin: boolean,
  options?: MergeVehicleCatalogOptions,
): Vehicle[] {
  const normPrev = normalizeVehiclesList(Array.isArray(prev) ? prev : []);
  const normIncoming = normalizeVehiclesList(Array.isArray(incoming) ? incoming : []);
  if (normIncoming.length === 0) return normPrev.length > 0 ? normPrev : [];
  if (isAdmin) return normIncoming;
  if (normPrev.length === 0) return normIncoming;

  const merged = upsert(normPrev, normIncoming);
  if (normPrev.length >= 5 && normIncoming.length <= 2 && !options?.authoritative) {
    logWarn(
      `⚠️ Catalog upsert from partial response (${normIncoming.length} into ${normPrev.length}).`,
    );
  }
  if (!options?.authoritative) return merged;

  const newestIncoming = normIncoming.reduce((max, vehicle) => Math.max(max, updatedAtMs(vehicle)), 0);
  return merged.filter((vehicle) => {
    const listed = normIncoming.some(
      (row) => keyOf(row) === keyOf(vehicle) || vehicleIdsEqual(row.id, vehicle.id),
    );
    if (listed) return true;
    // Just saved locally and the snapshot has not caught up yet.
    return updatedAtMs(vehicle) > newestIncoming;
  });
}
