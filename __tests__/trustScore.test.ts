import { calculateTrustScore } from '../services/trustSafetyService';
import type { User } from '../types';

describe('calculateTrustScore', () => {
  it('counts flat verification flags and seller ratings', () => {
    const user = {
      email: 's@x.com',
      phoneVerified: true,
      emailVerified: true,
      sellerAverageRating: 5,
      sellerRatingCount: 3,
      soldListings: 4,
    } as User;
    // 2 verifications (20) + rating (20) + sold (4)
    expect(calculateTrustScore(user).score).toBe(44);
  });
});
