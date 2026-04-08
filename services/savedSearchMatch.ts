import type { SearchFilters, Vehicle } from '../types';

function matchesOwnership(noOfOwners: number | undefined, ownership: SearchFilters['ownership']): boolean {
  if (!ownership) return true;
  if (typeof noOfOwners !== 'number' || Number.isNaN(noOfOwners)) return false;
  if (ownership === '1') return noOfOwners === 1;
  if (ownership === '2') return noOfOwners === 2;
  return noOfOwners >= 3;
}

/** Shared rules for saved-search / alert matching (listings + buyer dashboard). */
export function vehicleMatchesSearchFilters(vehicle: Vehicle, filters: SearchFilters): boolean {
  if (filters.make && vehicle.make?.toLowerCase().trim() !== filters.make.toLowerCase().trim()) return false;

  if (filters.model && vehicle.model?.toLowerCase().trim() !== filters.model.toLowerCase().trim()) return false;

  if (filters.minPrice != null && vehicle.price < filters.minPrice) return false;
  if (filters.maxPrice != null && vehicle.price > filters.maxPrice) return false;

  if (filters.minYear != null && vehicle.year < filters.minYear) return false;
  if (filters.maxYear != null && vehicle.year > filters.maxYear) return false;

  if (filters.year != null && vehicle.year !== filters.year) return false;

  if (filters.minMileage != null && (vehicle.mileage == null || vehicle.mileage < filters.minMileage)) return false;
  if (filters.maxMileage != null && (vehicle.mileage == null || vehicle.mileage > filters.maxMileage)) return false;

  if (filters.category && vehicle.category !== filters.category) return false;

  if (filters.fuelType && vehicle.fuelType?.toLowerCase().trim() !== filters.fuelType.toLowerCase().trim()) {
    return false;
  }

  if (
    filters.transmission &&
    vehicle.transmission?.toLowerCase().trim() !== filters.transmission.toLowerCase().trim()
  ) {
    return false;
  }

  if (!matchesOwnership(vehicle.noOfOwners, filters.ownership)) return false;

  if (filters.location && vehicle.city !== filters.location && vehicle.state !== filters.location) return false;

  return true;
}
