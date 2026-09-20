import { lowestPublishedPrices, mergeServiceCatalogPackages } from '../utils/serviceCartCatalog';

describe('mergeServiceCatalogPackages', () => {
  it('replaces stale catalog with API packages but keeps service-* prefill', () => {
    const prev = [
      { id: 'pkg-comprehensive', name: 'Mock Comprehensive' },
      { id: 'service-oil-change', name: 'Oil Change' },
    ];
    const fromApi = [{ id: 'pkg-essential-service', name: 'Essential Service' }];
    const merged = mergeServiceCatalogPackages(prev, fromApi);
    expect(merged.map((p) => p.id).sort()).toEqual(['pkg-essential-service', 'service-oil-change'].sort());
  });
});

describe('lowestPublishedPrices', () => {
  const catalog = {
    demo: [{ serviceType: 'Car Diagnostics', price: 999, active: true }],
    local: [{ serviceType: 'Car Diagnostics', price: 1499, active: true }],
  };

  it('ignores workshops that are not in the listed directory', () => {
    expect(lowestPublishedPrices(catalog, ['local'])).toEqual({ 'Car Diagnostics': 1499 });
  });

  it('returns no prices when the listed set is empty', () => {
    expect(lowestPublishedPrices(catalog, [])).toEqual({});
  });
});
