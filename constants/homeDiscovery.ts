import { VehicleCategory } from '../vehicle-category.js';
import { CITY_MAPPING } from '../utils/cityMapping.js';

/** Cities shown on home / mobile discovery rails (pan-India tier-1; order from CITY_MAPPING). */
export const HOME_DISCOVERY_CITY_ORDER = Object.keys(CITY_MAPPING);

export type HomeDiscoveryCityName = string;

/** Navy + orange only — no purple/rainbow orbs. Shared by desktop + mobile heroes. */
export const HOME_HERO_SURFACE =
  'radial-gradient(900px 520px at -8% -12%, rgba(255,107,53,0.20) 0%, transparent 58%), radial-gradient(700px 480px at 110% 120%, rgba(255,107,53,0.08) 0%, transparent 55%), linear-gradient(165deg, #0B1020 0%, #12141C 52%, #1A130E 100%)';

/** Per-category plate colour — one hue per vehicle type so the "Browse by
 * Category" rail reads as colourful/distinct at a glance. */
export const HOME_CATEGORY_COLOR: Record<VehicleCategory, string> = {
  [VehicleCategory.FOUR_WHEELER]: 'from-orange-500 to-red-600',
  [VehicleCategory.TWO_WHEELER]: 'from-emerald-500 to-teal-600',
  [VehicleCategory.THREE_WHEELER]: 'from-amber-400 to-yellow-600',
  [VehicleCategory.COMMERCIAL]: 'from-blue-500 to-indigo-600',
  [VehicleCategory.FARM]: 'from-lime-500 to-green-700',
  [VehicleCategory.CONSTRUCTION]: 'from-stone-500 to-stone-700',
};

/** Fallback when a city isn't in the per-metro map. */
export type HomeCityAccent = {
  solid: string;
  soft: string;
  ring: string;
  header: string;
  pin: string;
};

export const HOME_CITY_ACCENT: HomeCityAccent = {
  solid: '#1C1917',
  soft: '#F4F0EA',
  ring: 'rgba(28, 25, 23, 0.12)',
  header: 'linear-gradient(165deg, #F7F4F0 0%, #EDE8E1 100%)',
  pin: '#FF6B35',
};

/** Soft header wash + darker monument/pin per metro so city cards read colourful. */
export const HOME_CITY_ACCENTS: Record<string, HomeCityAccent> = {
  Hyderabad: {
    solid: '#9F1239',
    soft: '#FFF1F2',
    ring: 'rgba(159, 18, 57, 0.14)',
    header: 'linear-gradient(165deg, #FFF1F2 0%, #FECDD3 100%)',
    pin: '#E11D48',
  },
  Chennai: {
    solid: '#115E59',
    soft: '#F0FDFA',
    ring: 'rgba(17, 94, 89, 0.14)',
    header: 'linear-gradient(165deg, #F0FDFA 0%, #99F6E4 100%)',
    pin: '#0D9488',
  },
  Ahmedabad: {
    solid: '#92400E',
    soft: '#FFFBEB',
    ring: 'rgba(146, 64, 14, 0.14)',
    header: 'linear-gradient(165deg, #FFFBEB 0%, #FDE68A 100%)',
    pin: '#D97706',
  },
  Mumbai: {
    solid: '#9A3412',
    soft: '#FFF7ED',
    ring: 'rgba(154, 52, 18, 0.14)',
    header: 'linear-gradient(165deg, #FFF7ED 0%, #FED7AA 100%)',
    pin: '#EA580C',
  },
  Bangalore: {
    solid: '#166534',
    soft: '#F0FDF4',
    ring: 'rgba(22, 101, 52, 0.14)',
    header: 'linear-gradient(165deg, #F0FDF4 0%, #BBF7D0 100%)',
    pin: '#16A34A',
  },
  'Delhi NCR': {
    solid: '#991B1B',
    soft: '#FEF2F2',
    ring: 'rgba(153, 27, 27, 0.14)',
    header: 'linear-gradient(165deg, #FEF2F2 0%, #FECACA 100%)',
    pin: '#DC2626',
  },
  Pune: {
    solid: '#1E3A8A',
    soft: '#EFF6FF',
    ring: 'rgba(30, 58, 138, 0.14)',
    header: 'linear-gradient(165deg, #EFF6FF 0%, #BFDBFE 100%)',
    pin: '#2563EB',
  },
  Kolkata: {
    solid: '#854D0E',
    soft: '#FEFCE8',
    ring: 'rgba(133, 77, 14, 0.14)',
    header: 'linear-gradient(165deg, #FEFCE8 0%, #FEF08A 100%)',
    pin: '#CA8A04',
  },
};

/** Category chips on home (excludes construction — same as legacy home UI). */
export const HOME_DISCOVERY_CATEGORIES = [
  {
    name: 'Four Wheeler',
    id: VehicleCategory.FOUR_WHEELER,
  },
  {
    name: 'Two Wheeler',
    id: VehicleCategory.TWO_WHEELER,
  },
  {
    name: 'Three Wheeler',
    id: VehicleCategory.THREE_WHEELER,
  },
  {
    name: 'Commercial',
    id: VehicleCategory.COMMERCIAL,
  },
  {
    name: 'Farm',
    id: VehicleCategory.FARM,
  },
] as const;

const CITY_ABBR: Record<string, string> = {
  'Delhi NCR': 'DN',
  Hyderabad: 'HY',
  Bangalore: 'BA',
  Pune: 'PU',
  Mumbai: 'MU',
  Chennai: 'CH',
  Ahmedabad: 'AH',
  Kolkata: 'KO',
};

function cityAbbrFromName(cityName: string): string {
  const preset = CITY_ABBR[cityName];
  if (preset) return preset;
  const parts = cityName.trim().split(/\s+/).filter(Boolean);
  return (
    parts.length > 1
      ? parts.map((part) => part[0]).join('').slice(0, 2)
      : parts[0]?.slice(0, 2) || cityName.slice(0, 2) || 'CI'
  ).toUpperCase();
}

export function getHomeDesktopCityStyle(cityName: string): {
  abbr: string;
  gradient: string;
  accent: string;
} {
  return {
    abbr: cityAbbrFromName(cityName),
    gradient: 'from-stone-200 to-stone-300',
    accent: 'text-stone-900',
  };
}

export function getHomeMobileCityGradient(cityName: string): string {
  return getHomeMobileCityAccent(cityName).header;
}

export function getHomeMobileCityAccent(cityName: string): HomeCityAccent {
  return HOME_CITY_ACCENTS[cityName] ?? HOME_CITY_ACCENT;
}

/** Premium home section surfaces — warm ivory palette with subtle brand glows (see index.css). */
export const HOME_SECTION_BG = {
  page: 'home-page',
  continue: 'home-section home-section--continue',
  featured: 'home-section home-section--featured',
  recent: 'home-section home-section--recent',
  cities: 'home-section home-section--cities',
  testimonials: 'home-section home-section--testimonials',
  categories: 'home-section home-section--categories',
  sell: 'home-section home-section--sell',
  recommendations: 'home-section home-section--recommendations',
  trending: 'home-section home-section--trending',
} as const;

/** Carousel edge fades — match featured section base tone. */
export const HOME_SECTION_FADE = {
  featured: 'from-[#ebe8e4]',
} as const;

/** Elevated listing card on home sections. */
export const HOME_LISTING_CARD = 'home-listing-card';
