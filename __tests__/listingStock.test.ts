import type { Vehicle } from '../types';
import {
  getListingStockStatus,
  isListingAvailable,
} from '../utils/listingStock';

describe('getListingStockStatus', () => {
  it('returns unavailable for null/undefined', () => {
    expect(getListingStockStatus(null)).toBe('unavailable');
    expect(getListingStockStatus(undefined)).toBe('unavailable');
  });

  it('maps published to in_stock', () => {
    const v = { status: 'published' } as Vehicle;
    expect(getListingStockStatus(v)).toBe('in_stock');
  });

  it('maps sold to sold', () => {
    const v = { status: 'sold' } as Vehicle;
    expect(getListingStockStatus(v)).toBe('sold');
  });

  it('maps unpublished to unavailable', () => {
    const v = { status: 'unpublished' } as Vehicle;
    expect(getListingStockStatus(v)).toBe('unavailable');
  });
});

describe('isListingAvailable', () => {
  it('is true only for published listings', () => {
    expect(isListingAvailable({ status: 'published' } as Vehicle)).toBe(true);
    expect(isListingAvailable({ status: 'sold' } as Vehicle)).toBe(false);
    expect(isListingAvailable({ status: 'unpublished' } as Vehicle)).toBe(false);
    expect(isListingAvailable(null)).toBe(false);
  });
});
