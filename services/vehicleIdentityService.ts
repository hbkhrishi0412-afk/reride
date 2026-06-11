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
  const params = new URLSearchParams({ action: 'resolve', vehicleId: String(vehicleId) });
  if (databaseId?.trim()) {
    params.set('databaseId', databaseId.trim());
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
