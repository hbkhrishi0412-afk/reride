import type { Vehicle } from '../types';
import { filterVehiclesBySellerEmail } from '../utils/sellerVehicleFilter';

const base = (overrides: Partial<Vehicle>): Vehicle =>
  ({
    id: 1,
    make: 'Tata',
    model: 'Nexon',
    year: 2020,
    price: 500000,
    mileage: 10000,
    sellerEmail: 'seller@test.com',
    status: 'published',
    category: 'FOUR_WHEELER',
    features: [],
    images: [],
    ...overrides,
  }) as Vehicle;

describe('filterVehiclesBySellerEmail', () => {
  it('returns only vehicles for the requested seller', () => {
    const list = [
      base({ id: 1, sellerEmail: 'seller@test.com' }),
      base({ id: 2, sellerEmail: 'other@seller.com' }),
      base({ id: 3, sellerEmail: 'Seller@Test.com' }),
    ];
    const result = filterVehiclesBySellerEmail(list, 'seller@test.com');
    expect(result.map((v) => v.id)).toEqual([1, 3]);
  });

  it('returns empty when email is missing', () => {
    expect(filterVehiclesBySellerEmail([base({})], '')).toEqual([]);
    expect(filterVehiclesBySellerEmail([base({})], undefined)).toEqual([]);
  });
});
