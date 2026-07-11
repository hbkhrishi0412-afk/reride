jest.mock('../services/planService.js', () => ({
  planService: {
    getPlanDetails: jest.fn().mockResolvedValue({ name: 'Pro', listingLimit: 10, price: 999 }),
  },
}));

jest.mock('../services/dealService.js', () => ({
  fetchSellerCommandCenter: jest.fn().mockResolvedValue({
    stats: { activeDealCount: 2, pendingInterestCount: 1 },
    activeDeals: [{ vehicleId: '1', id: 'd1' }],
    tasks: [],
  }),
  invalidateSellerCommandCenterCache: jest.fn(),
}));

jest.mock('../utils/validatePersistedSession.js', () => ({
  rehydrateApiCredentials: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

import { renderHook } from '@testing-library/react';
import { useSellerDashboardController } from '../hooks/useSellerDashboardController';
import type { User } from '../types';

const seller: User = {
  id: '1',
  email: 'seller@test.com',
  name: 'Seller',
  role: 'seller',
  subscriptionPlan: 'pro',
} as User;

describe('useSellerDashboardController', () => {
  it('skips loading for non-sellers', () => {
    const customer = { ...seller, role: 'customer' as const };
    const { result } = renderHook(() => useSellerDashboardController(customer));
    expect(result.current.isSeller).toBe(false);
    expect(result.current.plan).toBeNull();
    expect(result.current.commandCenter).toBeNull();
  });
});
