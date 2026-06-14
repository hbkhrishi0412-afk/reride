import type { Vehicle, VehicleCategory } from '../types.js';
import { VehicleCategory as CategoryEnum } from '../types.js';

export const VEHICLE_LIST_MIN_PRICE = 50000;
export const VEHICLE_LIST_MAX_PRICE = 5000000;
export const VEHICLE_LIST_MIN_MILEAGE = 0;
export const VEHICLE_LIST_MAX_MILEAGE = 200000;

export type OwnershipFilterValue = '1' | '2' | '3plus';

export interface VehicleListFilterSnapshot {
  categoryFilter: VehicleCategory | 'ALL';
  makeFilter: string;
  modelFilter: string;
  fuelFilter: string;
  transmissionFilter: string;
  ownershipFilter: OwnershipFilterValue | '';
  minPrice: number;
  maxPrice: number;
  minYear: number;
  maxYear: number;
  minMileage: number;
  maxMileage: number;
  locationFilter: string;
  selectedFeatures: string[];
}

export function vehicleSearchHaystack(v: Vehicle): string {
  return [
    v.make,
    v.model,
    v.variant,
    v.city,
    v.state,
    v.location,
    v.fuelType,
    v.transmission,
    v.color,
    v.description,
    ...(v.features || []),
    ...(v.keywords || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function vehicleMatchesSearchText(v: Vehicle, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return vehicleSearchHaystack(v).includes(q);
}

export function resolveMakeFromList(parsed: string | undefined, makes: string[]): string | null {
  if (!parsed) return null;
  const lower = parsed.toLowerCase();
  return makes.find((m) => m.toLowerCase() === lower) ?? null;
}

export function resolveModelFromVehicles(
  parsed: string | undefined,
  vehicles: Vehicle[],
  make: string,
): string | null {
  if (!parsed || !make) return null;
  const lower = parsed.toLowerCase();
  const models = new Set(
    vehicles.filter((v) => v.make === make).map((v) => v.model).filter(Boolean),
  );
  for (const m of models) {
    if (m.toLowerCase() === lower) return m;
  }
  return null;
}

export function resolveStringFromList(parsed: string | undefined, options: string[]): string | null {
  if (!parsed) return null;
  const lower = parsed.toLowerCase();
  return options.find((o) => o.toLowerCase() === lower) ?? null;
}

export function resolveCategoryFromParse(
  parsed: string | undefined,
  validCategories: VehicleCategory[],
): VehicleCategory | 'ALL' | null {
  if (!parsed) return null;
  const lower = parsed.toLowerCase().replace(/[\s_-]+/g, '');
  if (lower === 'all') return 'ALL';
  const hit = validCategories.find((c) => c.toLowerCase().replace(/[\s_-]+/g, '') === lower);
  return hit ?? null;
}

export function normalizeParsedOwnership(raw: string | undefined): OwnershipFilterValue | '' {
  if (!raw) return '';
  const s = raw.toLowerCase().trim();
  if (s === '1' || s === 'first' || s === 'firstowner' || s === '1st') return '1';
  if (s === '2' || s === 'second' || s === 'secondowner' || s === '2nd') return '2';
  if (s === '3' || s === '3plus' || s === '3+' || s === 'third' || s === 'multiple') return '3plus';
  return '';
}

export function matchesVehicleFilters(
  vehicle: Vehicle,
  snap: VehicleListFilterSnapshot,
  aiSearchQuery: string,
): boolean {
  if (snap.categoryFilter !== 'ALL' && vehicle.category !== snap.categoryFilter) return false;
  if (snap.makeFilter && vehicle.make !== snap.makeFilter) return false;
  if (snap.modelFilter && vehicle.model !== snap.modelFilter) return false;
  if (snap.fuelFilter && vehicle.fuelType !== snap.fuelFilter) return false;
  if (snap.transmissionFilter && vehicle.transmission !== snap.transmissionFilter) return false;

  if (snap.ownershipFilter) {
    const owners = vehicle.noOfOwners ?? 1;
    if (snap.ownershipFilter === '1' && owners !== 1) return false;
    if (snap.ownershipFilter === '2' && owners !== 2) return false;
    if (snap.ownershipFilter === '3plus' && owners < 3) return false;
  }

  if (vehicle.price < snap.minPrice || vehicle.price > snap.maxPrice) return false;
  if (vehicle.year < snap.minYear || vehicle.year > snap.maxYear) return false;
  if (vehicle.mileage < snap.minMileage || vehicle.mileage > snap.maxMileage) return false;

  if (snap.locationFilter) {
    const loc = snap.locationFilter.toLowerCase();
    const hay = [vehicle.city, vehicle.state, vehicle.location].filter(Boolean).join(' ').toLowerCase();
    if (!hay.includes(loc)) return false;
  }

  if (snap.selectedFeatures.length > 0) {
    const feats = new Set((vehicle.features || []).map((f) => f.toLowerCase()));
    if (!snap.selectedFeatures.every((f) => feats.has(f.toLowerCase()))) return false;
  }

  if (!vehicleMatchesSearchText(vehicle, aiSearchQuery)) return false;
  return true;
}

export const ALL_VEHICLE_CATEGORIES: VehicleCategory[] = Object.values(CategoryEnum);
