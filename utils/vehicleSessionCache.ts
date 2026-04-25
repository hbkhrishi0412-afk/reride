import type { Vehicle } from '../types';

/**
 * Fields excluded from sessionStorage: bulky base64 docs, direct phone channels, precise
 * lat/lng, listing email, description, and service/accident text (CodeQL: clear-text storage).
 * The app can merge from catalog/API for full fields after refresh.
 */
export function toVehicleSessionSnapshot(vehicle: Vehicle): Vehicle {
  if (!vehicle || typeof vehicle !== 'object') {
    return vehicle;
  }
  return {
    ...vehicle,
    documents: undefined,
    sellerPhone: undefined,
    sellerWhatsApp: undefined,
    exactLocation: undefined,
    sellerEmail: '',
    description: '',
    serviceRecords: undefined,
    accidentHistory: undefined,
  };
}

export function stringifyVehicleForSession(vehicle: Vehicle): string {
  return JSON.stringify(toVehicleSessionSnapshot(vehicle));
}
