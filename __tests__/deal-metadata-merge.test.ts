import { mergeDealMetadata } from '../lib/dealMetadataMerge';

describe('mergeDealMetadata', () => {
  it('deep-merges nested rc/token instead of replacing them', () => {
    const merged = mergeDealMetadata(
      {
        token: { receiptUrl: 'a.pdf', amount: 5000 },
        rc: { transferDocUrl: 'rc.pdf' },
        vehicleName: 'Old',
      },
      {
        token: { confirmedAt: '2026-01-01T00:00:00.000Z' },
        rc: { buyerConfirmedAt: '2026-01-02T00:00:00.000Z' },
        vehicleName: 'New',
      },
    );

    expect(merged.vehicleName).toBe('New');
    expect(merged.token).toEqual({
      receiptUrl: 'a.pdf',
      amount: 5000,
      confirmedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(merged.rc).toEqual({
      transferDocUrl: 'rc.pdf',
      buyerConfirmedAt: '2026-01-02T00:00:00.000Z',
    });
  });
});
