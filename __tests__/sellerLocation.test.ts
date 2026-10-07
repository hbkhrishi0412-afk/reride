import type { User } from '../types';
import { getSellerMapCoordinatesBatch } from '../utils/sellerLocation';

test('dealer pins: city fallback first, precise geocode cached across calls', async () => {
  const fetchMock = jest.fn(async () => ({
    ok: true,
    json: async () => [{ lat: '19.1', lon: '72.9' }],
  }));
  (global as any).fetch = fetchMock;

  const seller = {
    email: 'a@x.com',
    role: 'seller',
    location: 'Mumbai, Maharashtra',
    address: '12 MG Road',
    pincode: '400001',
  } as unknown as User;

  const partials: Array<Map<string, unknown>> = [];
  const first = await getSellerMapCoordinatesBatch([seller], (m) => partials.push(m));

  expect(partials).toHaveLength(1);
  expect(partials[0].get('a@x.com')).not.toBeNull();
  expect(first.get('a@x.com')!.lat).toBeCloseTo(19.1, 2);
  expect(fetchMock).toHaveBeenCalledTimes(1);

  const second = await getSellerMapCoordinatesBatch([seller]);
  expect(second.get('a@x.com')).toEqual(first.get('a@x.com'));
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
