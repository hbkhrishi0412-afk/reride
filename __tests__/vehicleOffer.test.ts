import type { Vehicle } from '../types.js';
import {
  formatOfferDateRangeLabel,
  isSellerListingOfferVisible,
} from '../utils/vehicleOffer.js';

const baseVehicle = {
  id: 1,
  offerEnabled: true,
  offerTitle: 'Festive discount',
} as Vehicle;

describe('vehicleOffer', () => {
  it('uses custom offer label when set', () => {
    expect(formatOfferDateRangeLabel({ ...baseVehicle, offerDateLabel: 'Diwali Sale' })).toBe(
      'Diwali Sale',
    );
  });

  it('formats same-day date range', () => {
    expect(
      formatOfferDateRangeLabel({
        ...baseVehicle,
        offerStartDate: '2026-01-15',
        offerEndDate: '2026-01-15',
      }),
    ).toContain('15');
  });

  it('returns false when offer disabled or empty', () => {
    expect(isSellerListingOfferVisible({ ...baseVehicle, offerEnabled: false })).toBe(false);
    expect(
      isSellerListingOfferVisible({
        ...baseVehicle,
        offerTitle: '',
        offerDescription: '',
        offerHighlight: '',
      }),
    ).toBe(false);
  });

  it('respects offer window dates', () => {
    const now = new Date('2026-06-15T12:00:00');
    expect(
      isSellerListingOfferVisible(
        { ...baseVehicle, offerStartDate: '2026-07-01', offerEndDate: '2026-07-31' },
        now,
      ),
    ).toBe(false);
    expect(
      isSellerListingOfferVisible(
        { ...baseVehicle, offerStartDate: '2026-06-01', offerEndDate: '2026-06-30' },
        now,
      ),
    ).toBe(true);
  });
});
