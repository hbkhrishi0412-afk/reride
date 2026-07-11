import { VehicleCategory } from '../types.js';
import type { Vehicle } from '../types.js';
import {
  vehicleSearchHaystack,
  vehicleMatchesSearchText,
  resolveMakeFromList,
  resolveModelFromVehicles,
  normalizeParsedOwnership,
  matchesVehicleFilters,
  VEHICLE_LIST_MIN_PRICE,
  type VehicleListFilterSnapshot,
} from '../utils/vehicleListFilters.js';

const vehicle = {
  id: 1,
  make: 'Hyundai',
  model: 'Creta',
  variant: 'SX',
  year: 2021,
  price: 900000,
  mileage: 30000,
  category: VehicleCategory.FOUR_WHEELER,
  fuelType: 'Diesel',
  transmission: 'Automatic',
  city: 'Mumbai',
  state: 'Maharashtra',
  location: 'Andheri',
  features: ['Sunroof'],
  noOfOwners: 1,
} as Vehicle;

const defaultSnap: VehicleListFilterSnapshot = {
  categoryFilter: 'ALL',
  makeFilter: '',
  modelFilter: '',
  fuelFilter: '',
  transmissionFilter: '',
  ownershipFilter: '',
  minPrice: VEHICLE_LIST_MIN_PRICE,
  maxPrice: 5000000,
  minYear: 1990,
  maxYear: 2026,
  minMileage: 0,
  maxMileage: 200000,
  locationFilter: '',
  selectedFeatures: [],
};

describe('vehicleListFilters', () => {
  it('builds searchable haystack from vehicle fields', () => {
    const hay = vehicleSearchHaystack(vehicle);
    expect(hay).toContain('hyundai');
    expect(hay).toContain('sunroof');
  });

  it('matches search text case-insensitively', () => {
    expect(vehicleMatchesSearchText(vehicle, 'creta')).toBe(true);
    expect(vehicleMatchesSearchText(vehicle, 'bmw')).toBe(false);
  });

  it('resolves make from list', () => {
    expect(resolveMakeFromList('hyundai', ['Hyundai', 'Maruti Suzuki'])).toBe('Hyundai');
  });

  it('resolves model for make', () => {
    expect(resolveModelFromVehicles('creta', [vehicle], 'Hyundai')).toBe('Creta');
  });

  it('normalizes ownership aliases', () => {
    expect(normalizeParsedOwnership('first')).toBe('1');
    expect(normalizeParsedOwnership('3+')).toBe('3plus');
  });

  it('filters by make and features', () => {
    expect(matchesVehicleFilters(vehicle, { ...defaultSnap, makeFilter: 'Hyundai' }, '')).toBe(true);
    expect(
      matchesVehicleFilters(vehicle, { ...defaultSnap, selectedFeatures: ['Sunroof', 'ABS'] }, ''),
    ).toBe(false);
  });
});
