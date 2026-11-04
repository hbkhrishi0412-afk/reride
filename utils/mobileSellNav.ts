import { View } from '../types.js';

/** Bottom-nav Sell and drawer “Sell Car” must agree. */
export function mobileSellDestination(role: string | undefined | null): View {
  return role === 'seller' ? View.SELLER_DASHBOARD : View.SELL_CAR;
}
