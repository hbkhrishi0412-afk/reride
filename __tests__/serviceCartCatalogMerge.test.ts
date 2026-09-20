import { mergeServiceCatalogPackages } from '../utils/serviceCartCatalog';

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
