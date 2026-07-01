import type { Vehicle } from '../types.js';
import { matchesLocation } from './cityMapping.js';

/** Published, non-rental listings used on home discovery rails. */
export function isStorefrontDiscoveryVehicle(vehicle: Vehicle | null | undefined): boolean {
  return Boolean(vehicle && vehicle.status === 'published' && vehicle.listingType !== 'rental');
}

/** Total listings in a display city (all vehicle categories). */
export function countCityVehicles(vehicles: Vehicle[], displayCity: string): number {
  let total = 0;
  for (const vehicle of vehicles) {
    if (!isStorefrontDiscoveryVehicle(vehicle)) continue;
    if (!matchesLocation(vehicle.city, vehicle.state, displayCity)) continue;
    total += 1;
  }
  return total;
}
