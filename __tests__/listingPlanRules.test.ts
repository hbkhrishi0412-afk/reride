import {
  countPublishedListings,
  isListingLimitReached,
  validateListingRenewal,
  validateNewListingCreation,
} from '../utils/listingPlanRules';
import type { Vehicle } from '../types';

const freeSeller = { subscriptionPlan: 'free' as const };
const freePlan = { id: 'free' as const, name: 'Free', price: 0, listingLimit: 1, featuredCredits: 0, freeCertifications: 0, features: [] };

const published = (id: number): Vehicle =>
  ({ id, status: 'published', sellerEmail: 's@test.com' }) as Vehicle;

const unpublished = (id: number): Vehicle =>
  ({ id, status: 'unpublished', sellerEmail: 's@test.com' }) as Vehicle;

describe('listingPlanRules', () => {
  it('counts only published listings', () => {
    expect(countPublishedListings([published(1), unpublished(2), published(3)])).toBe(2);
  });

  it('blocks new listing when free plan is at limit', () => {
    const vehicles = [published(1)];
    const result = validateNewListingCreation(freeSeller, vehicles, freePlan);
    expect(result.allowed).toBe(false);
    expect(result.limitReached).toBe(true);
  });

  it('allows new listing when a slot is free', () => {
    const result = validateNewListingCreation(freeSeller, [], freePlan);
    expect(result.allowed).toBe(true);
  });

  it('blocks re-publishing when at limit', () => {
    const vehicles = [published(1), unpublished(2)];
    const result = validateListingRenewal(freeSeller, unpublished(2), vehicles, freePlan);
    expect(result.allowed).toBe(false);
    expect(result.limitReached).toBe(true);
  });

  it('reports limit reached for dashboard gating', () => {
    expect(isListingLimitReached(freeSeller, [published(1)], freePlan)).toBe(true);
    expect(isListingLimitReached(freeSeller, [], freePlan)).toBe(false);
  });
});
