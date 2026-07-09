import type { Vehicle } from '../types.js';

/** Normalize seller email for strict ownership comparisons. */
export function normalizeSellerEmail(email: string | null | undefined): string {
  return (email || '').toLowerCase().trim();
}

/** Keep only vehicles owned by the given seller email. */
export function filterVehiclesBySellerEmail(
  vehicles: Vehicle[] | null | undefined,
  sellerEmail: string | null | undefined,
): Vehicle[] {
  const normalized = normalizeSellerEmail(sellerEmail);
  if (!normalized || !Array.isArray(vehicles)) return [];
  return vehicles.filter(
    (v) => v && normalizeSellerEmail(v.sellerEmail) === normalized,
  );
}
