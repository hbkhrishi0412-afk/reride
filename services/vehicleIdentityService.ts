import type { Vehicle } from '../types.js';
import {
  normalizeVehicleIdentity,
  normalizeVehiclesList,
  parseVehicleIdentityFromBody,
} from '../utils/vehicleIdentity.js';

/**
 * Recover canonical listing identity from the API (for stale client state).
 */
export async function resolveVehicleFromApi(
  vehicleId: number,
  databaseId?: string,
): Promise<Vehicle | null> {
  const { authenticatedFetch, handleApiResponse } = await import('../utils/authenticatedFetch');
  const params = new URLSearchParams({ action: 'resolve' });
  const pk = databaseId?.trim();
  if (pk) {
    params.set('databaseId', pk);
    if (Number.isSafeInteger(vehicleId) && vehicleId > 0) {
      params.set('vehicleId', String(vehicleId));
    }
  } else if (Number.isSafeInteger(vehicleId) && vehicleId > 0) {
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

export { normalizeVehicleIdentity, normalizeVehiclesList, parseVehicleIdentityFromBody };
