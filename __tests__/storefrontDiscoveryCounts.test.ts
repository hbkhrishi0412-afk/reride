import { VehicleCategory } from '../types';
import type { Vehicle } from '../types';
import {
  countCityVehicles,
  isStorefrontDiscoveryVehicle,
} from '../utils/storefrontDiscoveryCounts';

const vehicle = {
  id: 1,
  status: 'published',
  listingType: 'sale',
  city: 'Mumbai',
  state: 'Maharashtra',
  category: VehicleCategory.FOUR_WHEELER,
} as Vehicle;

describe('storefrontDiscoveryCounts', () => {
  it('detects storefront discovery vehicles', () => {
    expect(isStorefrontDiscoveryVehicle(vehicle)).toBe(true);
    expect(isStorefrontDiscoveryVehicle({ ...vehicle, status: 'draft' } as Vehicle)).toBe(false);
    expect(isStorefrontDiscoveryVehicle({ ...vehicle, listingType: 'rental' } as Vehicle)).toBe(false);
  });

  it('counts vehicles in a display city', () => {
    expect(countCityVehicles([vehicle], 'Mumbai')).toBe(1);
    expect(countCityVehicles([vehicle], 'Delhi')).toBe(0);
  });
});
