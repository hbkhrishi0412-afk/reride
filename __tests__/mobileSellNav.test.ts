import { View } from '../types';
import { mobileSellDestination } from '../utils/mobileSellNav';

describe('mobileSellDestination', () => {
  it('sends sellers to the dashboard and everyone else into the sell flow', () => {
    expect(mobileSellDestination('seller')).toBe(View.SELLER_DASHBOARD);
    expect(mobileSellDestination('customer')).toBe(View.SELL_CAR);
    expect(mobileSellDestination(undefined)).toBe(View.SELL_CAR);
    expect(mobileSellDestination(null)).toBe(View.SELL_CAR);
  });
});
