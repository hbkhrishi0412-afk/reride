import { VehicleCategory } from '../vehicle-category.js';
import type { Vehicle } from '../types.js';
import { View } from '../types.js';
import { computePageSeoMeta } from '../utils/pageSeoMeta.js';
import { buildVehicleDetailJsonLd, organizationJsonLd, vehicleJsonLd } from '../utils/vehicleJsonLd.js';

const vehicle = {
  id: 42,
  make: 'Hyundai',
  model: 'Creta',
  year: 2021,
  price: 950000,
  mileage: 28000,
  city: 'Pune',
  category: VehicleCategory.FOUR_WHEELER,
  images: ['https://cdn.example.com/creta.jpg'],
} as Vehicle;

describe('vehicleJsonLd', () => {
  it('builds Organization schema', () => {
    const org = organizationJsonLd();
    expect(org['@type']).toBe('Organization');
    expect(org.name).toBe('ReRide');
  });

  it('builds Car schema with offer', () => {
    const schema = vehicleJsonLd(vehicle, vehicle.images![0]);
    expect(schema['@type']).toBe('Car');
    expect(schema.offers).toMatchObject({ priceCurrency: 'INR', price: 950000 });
    expect(String(schema.url)).toContain('/vehicle/42');
  });

  it('returns org + car for detail pages', () => {
    const schemas = buildVehicleDetailJsonLd(vehicle, vehicle.images![0]);
    expect(schemas).toHaveLength(2);
    expect(schemas[1]['@type']).toBe('Car');
  });
});

describe('computePageSeoMeta', () => {
  it('includes JSON-LD on vehicle detail view', () => {
    const meta = computePageSeoMeta({
      view: View.DETAIL,
      pathname: '/vehicle/42',
      selectedVehicle: vehicle,
      selectedCity: 'Pune',
    });
    expect(meta.path).toBe('/vehicle/42');
    expect(meta.jsonLd).toHaveLength(2);
    expect(meta.type).toBe('article');
    expect(meta.title).toContain('Hyundai');
  });

  it('includes Organization JSON-LD on home', () => {
    const meta = computePageSeoMeta({
      view: View.HOME,
      pathname: '/',
      selectedVehicle: null,
      selectedCity: null,
    });
    expect(meta.jsonLd?.[0]['@type']).toBe('Organization');
  });
});
