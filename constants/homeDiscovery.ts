import { VehicleCategory } from '../types';

/** Cities shown on home / mobile discovery rails (order preserved). */
export const HOME_DISCOVERY_CITY_ORDER = [
  'Delhi NCR',
  'Hyderabad',
  'Bangalore',
  'Pune',
  'Mumbai',
] as const;

export type HomeDiscoveryCityName = (typeof HOME_DISCOVERY_CITY_ORDER)[number];

/** Category chips on home (excludes construction — same as legacy home UI). */
export const HOME_DISCOVERY_CATEGORIES = [
  {
    name: 'Four Wheeler',
    icon: '🚗',
    id: VehicleCategory.FOUR_WHEELER,
    gradient: 'from-blue-400 via-sky-500 to-indigo-500',
    mobileCardGradient: 'from-blue-500 to-indigo-600',
  },
  {
    name: 'Two Wheeler',
    icon: '🏍️',
    id: VehicleCategory.TWO_WHEELER,
    gradient: 'from-green-400 via-emerald-500 to-teal-500',
    mobileCardGradient: 'from-red-500 to-pink-600',
  },
  {
    name: 'Three Wheeler',
    icon: '🛺',
    id: VehicleCategory.THREE_WHEELER,
    gradient: 'from-orange-400 via-amber-500 to-orange-600',
    mobileCardGradient: 'from-yellow-500 to-orange-600',
  },
  {
    name: 'Commercial',
    icon: '🚚',
    id: VehicleCategory.COMMERCIAL,
    gradient: 'from-purple-400 via-violet-500 to-fuchsia-500',
    mobileCardGradient: 'from-purple-500 to-violet-600',
  },
  {
    name: 'Farm',
    icon: '🚜',
    id: VehicleCategory.FARM,
    gradient: 'from-yellow-400 via-amber-500 to-orange-500',
    mobileCardGradient: 'from-green-500 to-emerald-600',
  },
] as const;

/** Circular city tiles on mobile — gradient keyed by display name for stable theming. */
export const HOME_MOBILE_CITY_GRADIENT: Record<HomeDiscoveryCityName, string> = {
  'Delhi NCR': 'linear-gradient(135deg, #A855F7 0%, #9333EA 50%, #7C3AED 100%)',
  Hyderabad: 'linear-gradient(135deg, #EC4899 0%, #F43F5E 50%, #DC2626 100%)',
  Bangalore: 'linear-gradient(135deg, #4ADE80 0%, #10B981 50%, #14B8A6 100%)',
  Pune: 'linear-gradient(135deg, #8B5CF6 0%, #9333EA 50%, #D946EF 100%)',
  Mumbai: 'linear-gradient(135deg, #F97316 0%, #EA580C 50%, #DC2626 100%)',
};

/** Desktop “Explore by location” pill gradients (Tailwind). */
export const HOME_DESKTOP_CITY_STYLE: Record<
  HomeDiscoveryCityName,
  { abbr: string; gradient: string; accent: string }
> = {
  'Delhi NCR': {
    abbr: 'DN',
    gradient: 'from-amber-400 via-orange-400 to-yellow-500',
    accent: 'text-amber-950',
  },
  Hyderabad: {
    abbr: 'HY',
    gradient: 'from-purple-400 via-purple-500 to-indigo-500',
    accent: 'text-purple-950',
  },
  Bangalore: {
    abbr: 'BA',
    gradient: 'from-sky-400 via-blue-500 to-indigo-500',
    accent: 'text-indigo-950',
  },
  Pune: {
    abbr: 'PU',
    gradient: 'from-emerald-400 via-teal-500 to-cyan-500',
    accent: 'text-emerald-950',
  },
  Mumbai: {
    abbr: 'MU',
    gradient: 'from-pink-400 via-rose-500 to-fuchsia-500',
    accent: 'text-rose-950',
  },
};
