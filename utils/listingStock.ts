import type { Vehicle } from '../types.js';

export type ListingStockStatus = 'in_stock' | 'sold' | 'unavailable';

export function getListingStockStatus(vehicle: Vehicle | null | undefined): ListingStockStatus {
  if (!vehicle) return 'unavailable';
  if (vehicle.status === 'sold') return 'sold';
  if (vehicle.status === 'published') return 'in_stock';
  return 'unavailable';
}

export function isListingAvailable(vehicle: Vehicle | null | undefined): boolean {
  return getListingStockStatus(vehicle) === 'in_stock';
}
