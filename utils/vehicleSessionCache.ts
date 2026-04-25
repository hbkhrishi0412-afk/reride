import type { Vehicle } from '../types';

/** Dropped from session JSON (bulky or high-sensitivity). */
const DROP_FROM_SESSION: (keyof Vehicle)[] = [
  'documents',
  'serviceRecords',
  'accidentHistory',
  'sellerPhone',
  'sellerWhatsApp',
  'exactLocation',
  'qualityReport',
  'certifiedInspection',
];

/**
 * Build a JSON-safe listing snapshot without a full `...vehicle` spread (CodeQL: clear-text storage).
 */
export function toVehicleSessionSnapshot(vehicle: Vehicle): Vehicle {
  if (!vehicle || typeof vehicle !== 'object') {
    return vehicle;
  }
  const o = { ...vehicle };
  for (const k of DROP_FROM_SESSION) {
    delete (o as Record<string, unknown>)[k as string];
  }
  o.sellerEmail = '';
  o.description = '';
  return o;
}

export function stringifyVehicleForSession(vehicle: Vehicle): string {
  return JSON.stringify(toVehicleSessionSnapshot(vehicle));
}
