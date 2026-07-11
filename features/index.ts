/** Product scope boundaries — marketplace, car services, deal pipeline. */
export * as marketplace from './marketplace/index.js';
export * as carServices from './car-services/index.js';
export * as deals from './deals/index.js';

export { View } from '../types.js';

/** Views belonging to each product area (for routing and analytics). */
export const MARKETPLACE_VIEWS = [
  'HOME',
  'USED_CARS',
  'DETAIL',
  'SELL_CAR',
  'DEALER_PROFILES',
  'SELLER_DASHBOARD',
  'SELLER_PROFILE',
  'COMPARE',
  'WISHLIST',
] as const;

export const CAR_SERVICE_VIEWS = [
  'CAR_SERVICES',
  'SERVICE_DETAIL',
  'SERVICE_CART',
  'CAR_SERVICE_DASHBOARD',
  'CAR_SERVICE_LOGIN',
] as const;

export const DEAL_PIPELINE_VIEWS = [
  'MY_DEALS',
  'DEAL_DETAIL',
  'INBOX',
] as const;
