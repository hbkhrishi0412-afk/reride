import type { Vehicle } from '../types.js';
import { VehicleCategory } from '../vehicle-category.js';
import { HOME_DISCOVERY_CATEGORIES } from '../constants/homeDiscovery.js';

export const MAX_COMPARE_VEHICLES = 4;

export type CompareBlockReason = 'max' | 'category_mismatch' | 'vehicle_not_found';

export type CompareToggleResult = {
  nextList: number[];
  added: boolean;
  removed: boolean;
  blockedReason?: CompareBlockReason;
  requiredCategory?: string;
  vehicleCategory?: string;
};

/** Normalize category strings (`FOUR_WHEELER`, `four-wheeler`, `Four Wheeler`, …). */
export function normalizeVehicleCategory(category: string | undefined | null): string {
  if (!category) return normalizeVehicleCategory(VehicleCategory.FOUR_WHEELER);
  return String(category).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
}

export function getVehicleById(vehicles: Vehicle[], id: number): Vehicle | undefined {
  return vehicles.find((v) => v.id === id);
}

export function getComparisonCategory(
  vehicles: Vehicle[],
  comparisonList: number[],
): string | null {
  if (!comparisonList.length) return null;
  const first = getVehicleById(vehicles, comparisonList[0]);
  return first ? normalizeVehicleCategory(first.category) : null;
}

export function getCategoryDisplayName(category: string): string {
  const normalized = normalizeVehicleCategory(category);
  const preset = HOME_DISCOVERY_CATEGORIES.find(
    (entry) => normalizeVehicleCategory(entry.id) === normalized,
  );
  if (preset) return preset.name;
  return category
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Keep only valid ids that share the same category as the first listed vehicle. */
export function sanitizeComparisonList(vehicles: Vehicle[], comparisonList: number[]): number[] {
  const safeList = Array.isArray(comparisonList)
    ? comparisonList.filter((id) => typeof id === 'number')
    : [];
  if (!safeList.length) return [];

  const resolved = safeList
    .map((id) => getVehicleById(vehicles, id))
    .filter((vehicle): vehicle is Vehicle => Boolean(vehicle));

  if (!resolved.length) return [];

  const anchorCategory = normalizeVehicleCategory(resolved[0].category);
  return resolved
    .filter((vehicle) => normalizeVehicleCategory(vehicle.category) === anchorCategory)
    .map((vehicle) => vehicle.id)
    .slice(0, MAX_COMPARE_VEHICLES);
}

export function computeCompareToggle(
  prevList: number[],
  vehicleId: number,
  vehicles: Vehicle[],
): CompareToggleResult {
  const safePrev = Array.isArray(prevList) ? prevList : [];

  if (safePrev.includes(vehicleId)) {
    return {
      nextList: safePrev.filter((id) => id !== vehicleId),
      added: false,
      removed: true,
    };
  }

  const vehicle = getVehicleById(vehicles, vehicleId);
  if (!vehicle) {
    return { nextList: safePrev, added: false, removed: false, blockedReason: 'vehicle_not_found' };
  }

  if (safePrev.length >= MAX_COMPARE_VEHICLES) {
    return { nextList: safePrev, added: false, removed: false, blockedReason: 'max' };
  }

  const vehicleCategory = normalizeVehicleCategory(vehicle.category);
  const comparisonCategory = getComparisonCategory(vehicles, safePrev);

  if (comparisonCategory !== null && vehicleCategory !== comparisonCategory) {
    return {
      nextList: safePrev,
      added: false,
      removed: false,
      blockedReason: 'category_mismatch',
      requiredCategory: comparisonCategory,
      vehicleCategory,
    };
  }

  return { nextList: [...safePrev, vehicleId], added: true, removed: false };
}

export function isCompareDisabledForVehicle(
  vehicle: Vehicle,
  comparisonList: number[],
  comparisonCategory: string | null,
): boolean {
  if (comparisonList.includes(vehicle.id)) return false;
  if (comparisonList.length >= MAX_COMPARE_VEHICLES) return true;
  if (comparisonCategory === null) return false;
  return normalizeVehicleCategory(vehicle.category) !== comparisonCategory;
}
