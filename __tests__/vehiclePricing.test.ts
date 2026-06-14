import type { Vehicle } from '../types';
import { analyzeVehiclePricing, estimateFairUsedPrice, getReferenceOnRoadPrice } from '../utils/vehiclePricing';

const kicks: Vehicle = {
  id: 1,
  category: 'four_wheeler' as Vehicle['category'],
  make: 'Nissan',
  model: 'Kicks',
  year: 2023,
  price: 2234771,
  mileage: 65203,
  images: [],
  features: [],
  description: '',
  sellerEmail: 'seller@test.com',
  engine: '',
  transmission: 'Automatic',
  fuelType: 'CNG',
  fuelEfficiency: '',
  color: 'Red',
  status: 'published',
  registrationYear: 2023,
  insuranceValidity: '',
  insuranceType: 'Comprehensive',
  rto: 'TS-09',
  city: 'Hyderabad',
  state: 'TS',
  location: 'Hyderabad',
  noOfOwners: 2,
  displacement: '',
  groundClearance: '',
  bootSpace: '',
};

describe('vehiclePricing sanity anchors', () => {
  it('knows Nissan Kicks new on-road is around 11.5L', () => {
    expect(getReferenceOnRoadPrice('Nissan', 'Kicks')).toBe(1150000);
  });

  it('estimates fair used value well below 22L for a 2023 Kicks with 65k km', () => {
    const fair = estimateFairUsedPrice(kicks);
    expect(fair).not.toBeNull();
    expect(fair!).toBeLessThan(900000);
  });

  it('does not show a positive deal badge when used price exceeds new car price', () => {
    const inflatedComps = [
      { price: 2014000, year: 2023, mileage: 60000 },
      { price: 2369000, year: 2023, mileage: 62000 },
      { price: 2724000, year: 2022, mileage: 70000 },
      { price: 2500000, year: 2023, mileage: 58000 },
    ];

    const analysis = analyzeVehiclePricing(kicks, inflatedComps);

    expect(analysis.buyerVisibleLabel).toBeNull();
    expect(analysis.fairnessLabel).not.toBe('Good Price');
    expect(analysis.fairnessLabel).not.toBe('Great Deal');
    expect(analysis.marketAverage).toBeLessThan(1000000);
  });

  it('uses live external benchmark when provided', () => {
    const external = {
      newOnRoadPrice: 1150000,
      usedFairLow: 550000,
      usedFairHigh: 750000,
      usedFairAverage: 650000,
      source: 'live_search' as const,
      fetchedAt: new Date().toISOString(),
    };

    const analysis = analyzeVehiclePricing(kicks, [], external);

    expect(analysis.buyerVisibleLabel).toBeNull();
    expect(analysis.dataSource).toBe('live_search');
    expect(analysis.marketAverage).toBeLessThanOrEqual(750000);
  });

  it('estimates a 2022 Verna around 9-12L, not 7L', () => {
    const verna: Pick<Vehicle, 'make' | 'model' | 'year' | 'mileage'> = {
      make: 'Hyundai',
      model: 'Verna',
      year: 2022,
      mileage: 20443,
    };
    const fair = estimateFairUsedPrice(verna);
    expect(fair).not.toBeNull();
    expect(fair!).toBeGreaterThan(950000);
    expect(fair!).toBeLessThan(1250000);
  });

  it('still rewards genuinely cheap listings against fair value', () => {
    const cheapKicks = { ...kicks, price: 550000 };
    const analysis = analyzeVehiclePricing(cheapKicks, []);

    expect(analysis.buyerVisibleLabel).toBe('Great Deal');
    expect(analysis.priceDifferencePercent).toBeLessThanOrEqual(-10);
  });
});
