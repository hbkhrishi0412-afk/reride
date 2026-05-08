import { VehicleCategory } from '../vehicle-category.js';
import { CITY_MAPPING } from '../utils/cityMapping';

/** Cities shown on home / mobile discovery rails (order preserved). */
export const HOME_DISCOVERY_CITY_ORDER = Object.keys(CITY_MAPPING);

export type HomeDiscoveryCityName = string;

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
const HOME_MOBILE_CITY_GRADIENT_BASE: Record<string, string> = {
  'Delhi NCR': 'linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 45%, #DDD6FE 100%)',
  Hyderabad: 'linear-gradient(135deg, #FFE4E6 0%, #FECDD3 45%, #FECACA 100%)',
  Bangalore: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 45%, #A7F3D0 100%)',
  Pune: 'linear-gradient(135deg, #F5E8FF 0%, #E9D5FF 45%, #FAE8FF 100%)',
  Mumbai: 'linear-gradient(135deg, #FFF1E0 0%, #FFE0C0 45%, #FED7AA 100%)',
  Chennai: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 45%, #C7D2FE 100%)',
  Ahmedabad: 'linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 45%, #F3E8FF 100%)',
  Kolkata: 'linear-gradient(135deg, #FFE4E6 0%, #FBCFE8 45%, #F5D0FE 100%)',
};

/**
 * Solid + soft accents for each city, used in the redesigned mobile location
 * cards (count chip background and the soft tinted footer/border). Picked from
 * the same hue family as `HOME_MOBILE_CITY_GRADIENT` so the card reads as a
 * single coordinated unit.
 */
const HOME_MOBILE_CITY_ACCENT_BASE: Record<
  string,
  { solid: string; soft: string; ring: string }
> = {
  'Delhi NCR': { solid: '#7C3AED', soft: '#F3E8FF', ring: 'rgba(124, 58, 237, 0.18)' },
  Hyderabad: { solid: '#E11D48', soft: '#FFE4E6', ring: 'rgba(225, 29, 72, 0.18)' },
  Bangalore: { solid: '#0F9D72', soft: '#D1FAE5', ring: 'rgba(15, 157, 114, 0.18)' },
  Pune: { solid: '#9333EA', soft: '#F5E8FF', ring: 'rgba(147, 51, 234, 0.18)' },
  Mumbai: { solid: '#EA580C', soft: '#FFEDD5', ring: 'rgba(234, 88, 12, 0.18)' },
  Chennai: { solid: '#2563EB', soft: '#DBEAFE', ring: 'rgba(37, 99, 235, 0.18)' },
  Ahmedabad: { solid: '#6D28D9', soft: '#EDE9FE', ring: 'rgba(109, 40, 217, 0.18)' },
  Kolkata: { solid: '#DB2777', soft: '#FCE7F3', ring: 'rgba(219, 39, 119, 0.18)' },
};

/** Desktop “Explore by location” pill gradients (Tailwind). */
export const HOME_DESKTOP_CITY_STYLE: Record<
  string,
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
  Chennai: {
    abbr: 'CH',
    gradient: 'from-blue-400 via-indigo-500 to-violet-500',
    accent: 'text-indigo-950',
  },
  Ahmedabad: {
    abbr: 'AH',
    gradient: 'from-violet-400 via-purple-500 to-fuchsia-500',
    accent: 'text-violet-950',
  },
  Kolkata: {
    abbr: 'KO',
    gradient: 'from-rose-400 via-pink-500 to-fuchsia-500',
    accent: 'text-pink-950',
  },
};

const FALLBACK_DESKTOP_GRADIENTS = [
  'from-indigo-400 via-violet-500 to-purple-500',
  'from-sky-400 via-blue-500 to-indigo-500',
  'from-emerald-400 via-teal-500 to-cyan-500',
  'from-amber-400 via-orange-400 to-yellow-500',
  'from-pink-400 via-rose-500 to-fuchsia-500',
];

const FALLBACK_MOBILE_GRADIENT =
  'linear-gradient(135deg, #E0ECFF 0%, #D9E4FF 45%, #EDE9FE 100%)';
const FALLBACK_ACCENT = {
  solid: '#4F46E5',
  soft: '#E0E7FF',
  ring: 'rgba(79, 70, 229, 0.18)',
};

export function getHomeDesktopCityStyle(cityName: string): {
  abbr: string;
  gradient: string;
  accent: string;
} {
  const preset = HOME_DESKTOP_CITY_STYLE[cityName];
  if (preset) return preset;

  const parts = cityName.trim().split(/\s+/).filter(Boolean);
  const abbr = (parts.length > 1
    ? parts.map((part) => part[0]).join('').slice(0, 2)
    : parts[0]?.slice(0, 2) || cityName.slice(0, 2) || 'CI'
  ).toUpperCase();
  const hash = cityName.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const gradient = FALLBACK_DESKTOP_GRADIENTS[hash % FALLBACK_DESKTOP_GRADIENTS.length];

  return { abbr, gradient, accent: 'text-indigo-950' };
}

export function getHomeMobileCityGradient(cityName: string): string {
  return HOME_MOBILE_CITY_GRADIENT_BASE[cityName] || FALLBACK_MOBILE_GRADIENT;
}

export function getHomeMobileCityAccent(cityName: string): {
  solid: string;
  soft: string;
  ring: string;
} {
  return HOME_MOBILE_CITY_ACCENT_BASE[cityName] || FALLBACK_ACCENT;
}
