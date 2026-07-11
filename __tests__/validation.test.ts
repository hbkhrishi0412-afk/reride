import { VehicleCategory } from '../vehicle-category.js';
import type { Vehicle } from '../types.js';
import {
  validateVehicleListing,
  validateUserData,
  validateSearchFilters,
  sanitizeText,
  validateImageUrl,
  formatValidationErrors,
  formatValidationWarnings,
} from '../utils/validation.js';

const baseVehicle: Partial<Vehicle> = {
  make: 'Maruti Suzuki',
  model: 'Swift',
  year: 2020,
  price: 500000,
  mileage: 25000,
  category: VehicleCategory.FOUR_WHEELER,
  sellerEmail: 'seller@test.com',
  images: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg', 'https://cdn.example.com/c.jpg', 'https://cdn.example.com/d.jpg'],
};

describe('validateVehicleListing', () => {
  it('passes for a complete valid listing', () => {
    const result = validateVehicleListing(baseVehicle);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('requires make, model, year, and price', () => {
    const result = validateVehicleListing({});
    expect(result.isValid).toBe(false);
    expect(result.errors.map((e) => e.field)).toEqual(
      expect.arrayContaining(['make', 'model', 'year', 'price']),
    );
  });

  it('rejects out-of-range year', () => {
    const result = validateVehicleListing({ ...baseVehicle, year: 1800 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === 'INVALID_YEAR')).toBe(true);
  });
});

describe('validateUserData', () => {
  it('passes for valid customer profile', () => {
    const result = validateUserData({
      name: 'Test User',
      email: 'test@example.com',
      role: 'customer',
      mobile: '+91 9876543210',
    });
    expect(result.isValid).toBe(true);
  });

  it('rejects invalid email and short name', () => {
    const result = validateUserData({ name: 'A', email: 'bad', role: 'customer' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.field === 'email')).toBe(true);
    expect(result.errors.some((e) => e.field === 'name')).toBe(true);
  });
});

describe('validateSearchFilters', () => {
  it('rejects inverted price range', () => {
    const result = validateSearchFilters({ minPrice: 500000, maxPrice: 100000 });
    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe('INVALID_PRICE_RANGE');
  });
});

describe('sanitizeText', () => {
  it('escapes HTML special characters', () => {
    expect(sanitizeText('<script>"x"</script>')).toBe(
      '&lt;script&gt;&quot;x&quot;&lt;&#x2F;script&gt;',
    );
  });
});

describe('validateImageUrl', () => {
  it('accepts supabase storage URLs', () => {
    expect(
      validateImageUrl('https://abc.supabase.co/storage/v1/object/public/images/car.jpg').valid,
    ).toBe(true);
  });

  it('rejects empty URLs', () => {
    expect(validateImageUrl('').valid).toBe(false);
  });
});

describe('formatValidationErrors', () => {
  it('returns empty string when valid', () => {
    expect(formatValidationErrors({ isValid: true, errors: [], warnings: [] })).toBe('');
  });
});

describe('formatValidationWarnings', () => {
  it('formats warnings with suggestions', () => {
    const text = formatValidationWarnings({
      isValid: true,
      errors: [],
      warnings: [{ field: 'make', message: 'Unknown', suggestion: 'Check spelling' }],
    });
    expect(text).toContain('make');
    expect(text).toContain('Check spelling');
  });
});
