import type { Conversation, Vehicle } from '../types';
import { aggregateListingStats } from '../services/listingService';

describe('aggregateListingStats', () => {
  const vehicle = {
    id: 42,
    views: 120,
    phoneViews: 5,
    inquiriesCount: 2,
  } as Vehicle;

  it('uses vehicle counters and conversation count for chat starts', () => {
    const conversations = [
      { vehicleId: 42 },
      { vehicleId: 42 },
      { vehicleId: 99 },
    ] as Conversation[];
    const stats = aggregateListingStats(vehicle, conversations);
    expect(stats.views).toBe(120);
    expect(stats.phoneViews).toBeGreaterThanOrEqual(5);
    expect(stats.chatStarts).toBe(2);
    expect(stats.shares).toBe(0);
    expect(stats.favorites).toBe(0);
  });

  it('falls back to inquiriesCount when no conversations passed', () => {
    const stats = aggregateListingStats(vehicle);
    expect(stats.chatStarts).toBe(2);
  });
});
