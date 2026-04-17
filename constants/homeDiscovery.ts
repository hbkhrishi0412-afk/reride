import { VehicleCategory } from '../vehicle-category.js';

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

/**
 * Mobile city-card gradients — intentionally LIGHT (pastel) so the dark
 * monument silhouette and bold city abbreviation read with high contrast,
 * like a travel-app postcard. Previous dark gradients were swallowing the
 * white monument overlay; flipping to pastel bg + dark foreground makes the
 * silhouette the visual star of the card.
 */
export const HOME_MOBILE_CITY_GRADIENT: Record<HomeDiscoveryCityName, string> = {
  'Delhi NCR': 'linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 45%, #DDD6FE 100%)',
  Hyderabad: 'linear-gradient(135deg, #FFE4E6 0%, #FECDD3 45%, #FECACA 100%)',
  Bangalore: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 45%, #A7F3D0 100%)',
  Pune: 'linear-gradient(135deg, #F5E8FF 0%, #E9D5FF 45%, #FAE8FF 100%)',
  Mumbai: 'linear-gradient(135deg, #FFF1E0 0%, #FFE0C0 45%, #FED7AA 100%)',
};

/**
 * Solid + soft accents for each city, used in the redesigned mobile location
 * cards (count chip background and the soft tinted footer/border). Picked from
 * the same hue family as `HOME_MOBILE_CITY_GRADIENT` so the card reads as a
 * single coordinated unit.
 */
export const HOME_MOBILE_CITY_ACCENT: Record<
  HomeDiscoveryCityName,
  { solid: string; soft: string; ring: string }
> = {
  'Delhi NCR': { solid: '#7C3AED', soft: '#F3E8FF', ring: 'rgba(124, 58, 237, 0.18)' },
  Hyderabad: { solid: '#E11D48', soft: '#FFE4E6', ring: 'rgba(225, 29, 72, 0.18)' },
  Bangalore: { solid: '#0F9D72', soft: '#D1FAE5', ring: 'rgba(15, 157, 114, 0.18)' },
  Pune: { solid: '#9333EA', soft: '#F5E8FF', ring: 'rgba(147, 51, 234, 0.18)' },
  Mumbai: { solid: '#EA580C', soft: '#FFEDD5', ring: 'rgba(234, 88, 12, 0.18)' },
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
