import type { Vehicle } from '../types.js';

/** Show a “verified” style badge when listing or seller signals trust. */
export function showVerifiedListingBadge(vehicle: Vehicle | null | undefined): boolean {
  if (!vehicle) return false;
  if (vehicle.certificationStatus === 'certified') return true;
  if (vehicle.sellerBadges?.some((b) => b.type === 'verified')) return true;
  return false;
}
