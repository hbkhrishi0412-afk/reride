import {
  mergeSellerPlanFields,
  sellerPlanFieldsChanged,
} from '../utils/sellerPlanSync';
import type { User } from '../types';

const baseSeller = {
  id: '1',
  email: 'seller@test.com',
  name: 'Seller',
  role: 'seller',
  subscriptionPlan: 'free',
  featuredCredits: 0,
} as User;

describe('sellerPlanSync', () => {
  it('detects plan field changes from admin updates', () => {
    expect(
      sellerPlanFieldsChanged(baseSeller, {
        ...baseSeller,
        subscriptionPlan: 'pro',
      }),
    ).toBe(true);
    expect(
      sellerPlanFieldsChanged(baseSeller, {
        ...baseSeller,
        planExpiryDate: '2026-12-01T00:00:00.000Z',
      }),
    ).toBe(true);
    expect(sellerPlanFieldsChanged(baseSeller, { ...baseSeller })).toBe(false);
  });

  it('merges only plan fields onto the current user', () => {
    const merged = mergeSellerPlanFields(baseSeller, {
      subscriptionPlan: 'premium',
      planActivatedDate: '2026-11-01T00:00:00.000Z',
      planExpiryDate: '2026-12-01T00:00:00.000Z',
      featuredCredits: 5,
      name: 'ShouldNotApply',
    } as Partial<User>);

    expect(merged.subscriptionPlan).toBe('premium');
    expect(merged.planActivatedDate).toBe('2026-11-01T00:00:00.000Z');
    expect(merged.planExpiryDate).toBe('2026-12-01T00:00:00.000Z');
    expect(merged.featuredCredits).toBe(5);
    expect(merged.name).toBe('Seller');
  });
});
