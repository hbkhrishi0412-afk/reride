import type { Vehicle } from '../types.js';
import {
  buildVehicleMutationBody,
  findVehicleByIdentity,
  getCanonicalPrimaryKey,
  normalizeVehicleIdentity,
  parseVehicleIdentityFromBody,
  VehicleMutationIdentityError,
} from '../utils/vehicleIdentity.js';
import { authenticatedFetch, handleApiResponse } from '../utils/authenticatedFetch.js';
import { dataService } from './dataService.js';

/**
 * Recover canonical listing identity from the API (for stale client state).
 */
export async function resolveVehicleFromApi(
  vehicleId: number,
  databaseId?: string,
): Promise<Vehicle | null> {
  const params = new URLSearchParams({ action: 'resolve' });
  const pk = databaseId?.trim();
  const hasVehicleId = Number.isFinite(vehicleId) && vehicleId > 0;
  if (pk) {
    params.set('databaseId', pk);
    if (hasVehicleId) {
      params.set('vehicleId', String(vehicleId));
    }
  } else if (hasVehicleId) {
    params.set('vehicleId', String(vehicleId));
  } else {
    return null;
  }

  const response = await authenticatedFetch(`/api/vehicles?${params.toString()}`, {
    method: 'GET',
    skipAuth: false,
  });
  const result = await handleApiResponse<{ success?: boolean; vehicle?: Vehicle }>(response);
  if (!result.success || !result.data?.vehicle) {
    return null;
  }
  return normalizeVehicleIdentity(result.data.vehicle);
}

/**
 * Build a POST mutation body, healing stale client rows that lack `databaseId`
 * (common for sold listings loaded before seller-inventory refresh).
 */
export async function ensureVehicleMutationPayload(
  vehicleId: number,
  vehicles: ReadonlyArray<Vehicle>,
  options?: { sellerEmail?: string; databaseId?: string },
): Promise<Record<string, unknown>> {
  const list = Array.isArray(vehicles) ? vehicles : [];
  const explicitPk = options?.databaseId?.trim();
  const existing = findVehicleByIdentity(list, vehicleId, explicitPk);
  const existingPk = getCanonicalPrimaryKey(existing || { id: vehicleId, databaseId: explicitPk });
  if (existingPk) {
    const lookupList =
      existing && !getCanonicalPrimaryKey(existing) && explicitPk
        ? list.map((v) =>
            findVehicleByIdentity([v], vehicleId, explicitPk) ? { ...v, databaseId: explicitPk } : v,
          )
        : list;
    return buildVehicleMutationBody(vehicleId, lookupList);
  }

  const sellerEmail =
    options?.sellerEmail?.trim().toLowerCase() || existing?.sellerEmail?.trim().toLowerCase();

  const recovered = await resolveVehicleFromApi(
    vehicleId,
    explicitPk || existing?.databaseId,
  );
  if (recovered && getCanonicalPrimaryKey(recovered)) {
    const merged = existing ? { ...existing, ...recovered } : recovered;
    const healedList = existing
      ? list.map((v) => (findVehicleByIdentity([v], vehicleId, recovered.databaseId) ? merged : v))
      : [...list, merged];
    return buildVehicleMutationBody(vehicleId, healedList);
  }

  if (sellerEmail) {
    const freshList = await dataService.getSellerVehicles(sellerEmail);
    const fresh = findVehicleByIdentity(freshList, vehicleId, explicitPk);
    if (fresh && getCanonicalPrimaryKey(fresh)) {
      return buildVehicleMutationBody(vehicleId, freshList);
    }
  }

  throw new VehicleMutationIdentityError();
}

export { normalizeVehicleIdentity, parseVehicleIdentityFromBody };
