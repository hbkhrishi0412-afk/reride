import type { BoostPackage } from '../types.js';

export const BOOST_PACKAGES: BoostPackage[] = [
  {
    id: 'top_search_3',
    name: 'Top Search - 3 Days',
    type: 'top_search',
    durationDays: 3,
    price: 299,
    features: ['Top of search results', '3x more visibility', 'Priority placement'],
  },
  {
    id: 'top_search_7',
    name: 'Top Search - 7 Days',
    type: 'top_search',
    durationDays: 7,
    price: 599,
    features: ['Top of search results', '3x more visibility', 'Priority placement', 'Best Value'],
  },
  {
    id: 'homepage_spot',
    name: 'Homepage Spotlight',
    type: 'homepage_spotlight',
    durationDays: 7,
    price: 999,
    features: ['Featured on homepage', 'Maximum visibility', 'Premium badge', 'Guaranteed views'],
  },
  {
    id: 'featured_badge',
    name: 'Featured Badge',
    type: 'featured_badge',
    durationDays: 15,
    price: 499,
    features: ['Featured badge', 'Stand out from crowd', 'Trust indicator'],
  },
  {
    id: 'multi_city',
    name: 'Multi-City Promotion',
    type: 'multi_city',
    durationDays: 7,
    price: 1499,
    features: ['Visible in 3 cities', 'Maximum reach', 'Best for dealers', 'Top placement'],
  },
];
