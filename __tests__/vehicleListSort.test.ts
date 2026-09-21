import { describe, expect, it } from 'vitest';
import type { Vehicle } from '../types.js';
import { compareVehiclesForListingSort } from '../utils/vehicleListSort.js';

/** Real catalog shape from the listings sort bug report. */
const venue = { id: 14, price: '1711477.00', year: 2020, isFeatured: true } as unknown as Vehicle;
const kicks = { id: 9, price: '2234771.00', year: 2023, isFeatured: true } as unknown as Vehicle;
const bajaj = {
  id: '17772276006460884',
  price: '90000.00',
  year: 2024,
  isFeatured: false,
} as unknown as Vehicle;
const xuv = { id: 1, price: '723580.00', year: 2023, isFeatured: false } as unknown as Vehicle;

describe('compareVehiclesForListingSort', () => {
  it('PRICE_ASC: featured first (price-sorted), then remaining (price-sorted)', () => {
    const ordered = [venue, kicks, bajaj, xuv].sort((a, b) =>
      compareVehiclesForListingSort(a, b, 'PRICE_ASC'),
    );
    // Featured: Venue 17.11L then Kicks 22.35L; then Bajaj 0.90L then XUV 7.24L
    expect(ordered.map((v) => v.id)).toEqual([14, 9, '17772276006460884', 1]);
  });

  it('PRICE_DESC: featured first (price-sorted), then remaining (price-sorted)', () => {
    const ordered = [venue, kicks, bajaj, xuv].sort((a, b) =>
      compareVehiclesForListingSort(a, b, 'PRICE_DESC'),
    );
    // Featured: Kicks 22.35L then Venue 17.11L; then XUV 7.24L then Bajaj 0.90L
    expect(ordered.map((v) => v.id)).toEqual([9, 14, 1, '17772276006460884']);
  });

  it('keeps featured ahead even when a non-featured car is cheaper', () => {
    const ordered = [bajaj, venue].sort((a, b) =>
      compareVehiclesForListingSort(a, b, 'PRICE_ASC'),
    );
    expect(ordered.map((v) => v.id)).toEqual([14, '17772276006460884']);
  });
});
