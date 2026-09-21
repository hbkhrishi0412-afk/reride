import type { Vehicle } from '../types.js';
import { isEffectivelyFeatured } from './listingPromotion.js';
import { getListingDisclosureScore } from './listingTrust.js';

/** Default browse order. */
export const VEHICLE_LIST_DEFAULT_SORT = 'YEAR_DESC';

function listingSortPrice(vehicle: Vehicle): number {
  const raw = vehicle.price as unknown;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const n = Number(raw.replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function userSort(a: Vehicle, b: Vehicle, sortOrder: string): number {
  switch (sortOrder) {
    case 'RATING_DESC':
      return (b.averageRating || 0) - (a.averageRating || 0);
    case 'DISCLOSURE_DESC':
      return getListingDisclosureScore(b) - getListingDisclosureScore(a);
    case 'PRICE_ASC':
      return listingSortPrice(a) - listingSortPrice(b);
    case 'PRICE_DESC':
      return listingSortPrice(b) - listingSortPrice(a);
    case 'MILEAGE_ASC':
      return (Number(a.mileage) || 0) - (Number(b.mileage) || 0);
    default:
      return (b.year || 0) - (a.year || 0);
  }
}

/**
 * Featured listings always lead; the selected sort applies within featured
 * and again within the remaining (non-featured) pool.
 */
export function compareVehiclesForListingSort(
  a: Vehicle,
  b: Vehicle,
  sortOrder: string,
): number {
  const aFeatured = isEffectivelyFeatured(a);
  const bFeatured = isEffectivelyFeatured(b);
  if (aFeatured && !bFeatured) return -1;
  if (!aFeatured && bFeatured) return 1;
  return userSort(a, b, sortOrder);
}
