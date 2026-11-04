import { mergeVehicleCatalog } from '../utils/mergeVehicleCatalog';
import type { Vehicle } from '../types';

const row = (id: number, updatedAt: string, extra: Partial<Vehicle> = {}): Vehicle =>
  ({ id, databaseId: String(id), updatedAt, status: 'published', make: 'Old', ...extra }) as Vehicle;

describe('mergeVehicleCatalog', () => {
  it('keeps a newer local edit when a stale page arrives', () => {
    const local = [row(1, '2026-11-05T01:00:00.000Z', { price: 900000, make: 'Hyundai' })];
    const stale = [row(1, '2026-11-04T01:00:00.000Z', { price: 100000, make: 'Hyundai' })];
    const merged = mergeVehicleCatalog(local, stale, false);
    expect(merged).toHaveLength(1);
    expect(merged[0].price).toBe(900000);
  });

  it('applies a newer server row over the local catalog', () => {
    const local = [row(1, '2026-11-04T01:00:00.000Z', { price: 100000 })];
    const fresh = [row(1, '2026-11-05T01:00:00.000Z', { price: 900000 })];
    const merged = mergeVehicleCatalog(local, fresh, false);
    expect(merged[0].price).toBe(900000);
  });

  it('drops a listing the full catalog no longer returns', () => {
    const local = [row(1, '2026-11-01T00:00:00.000Z'), row(2, '2026-11-01T00:00:00.000Z')];
    const live = [row(2, '2026-11-05T01:00:00.000Z', { price: 1 })];
    const merged = mergeVehicleCatalog(local, live, false, { authoritative: true });
    expect(merged.map((v) => v.id)).toEqual([2]);
    expect(merged[0].price).toBe(1);
  });
});
