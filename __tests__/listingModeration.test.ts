import { isListingUnderModeration } from '../services/listingLifecycleService';
import type { Vehicle } from '../types';

const v = (over: Partial<Vehicle>): Vehicle => ({ id: 1, ...over }) as Vehicle;

describe('isListingUnderModeration', () => {
  it('blocks republish only when the listing is flagged', () => {
    expect(isListingUnderModeration(v({ isFlagged: true }))).toBe(true);
  });

  it('does not block a plan-limit demotion (suspended/draft, not flagged)', () => {
    expect(isListingUnderModeration(v({ isFlagged: false, listingStatus: 'suspended' }))).toBe(false);
    expect(isListingUnderModeration(v({ listingStatus: 'draft' }))).toBe(false);
    expect(isListingUnderModeration(v({}))).toBe(false);
  });
});
