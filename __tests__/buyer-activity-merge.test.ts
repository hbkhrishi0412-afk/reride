import { mergeBuyerActivityRecord, uniqueIds } from '../server/handlers/buyer-activity-merge';

describe('mergeBuyerActivityRecord', () => {
  it('keeps server recently-viewed when the client sends an empty list', () => {
    const merged = mergeBuyerActivityRecord(
      { recently_viewed: [1, 2, 3], saved_searches: [{ id: 's1' }], price_drops: [9], new_matches: [] },
      { recentlyViewed: [], savedSearches: [], notifications: { priceDrops: [], newMatches: [] } },
    );
    expect(merged.recently_viewed).toEqual([1, 2, 3]);
    expect(merged.saved_searches).toEqual([{ id: 's1' }]);
    expect(merged.price_drops).toEqual([9]);
  });

  it('unions price-drop alerts from parallel writes', () => {
    const merged = mergeBuyerActivityRecord(
      { recently_viewed: [], saved_searches: [], price_drops: [1], new_matches: [] },
      { recentlyViewed: [], savedSearches: [], notifications: { priceDrops: [2] } },
    );
    expect(merged.price_drops).toEqual([1, 2]);
  });

  it('applies explicit price-drop removals', () => {
    const merged = mergeBuyerActivityRecord(
      { recently_viewed: [], saved_searches: [], price_drops: [1, 2, 3], new_matches: [] },
      { recentlyViewed: [], savedSearches: [], notifications: { priceDrops: [1, 3] }, removePriceDrops: [2] },
    );
    expect(merged.price_drops).toEqual([1, 3]);
  });

  it('uniqueIds preserves first-seen order', () => {
    expect(uniqueIds([5, 1, 5, 2])).toEqual([5, 1, 2]);
  });

  it('drops a saved search only when the client names it for removal', () => {
    const merged = mergeBuyerActivityRecord(
      { saved_searches: [{ id: 's1' }, { id: 's2' }] },
      { savedSearches: [{ id: 's1', name: 'updated' }], removeSavedSearchIds: ['s2'] },
    );
    expect(merged.saved_searches).toEqual([{ id: 's1', name: 'updated' }]);
  });
});
