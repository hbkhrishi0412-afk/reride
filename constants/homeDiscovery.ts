import { VehicleCategory } from '../vehicle-category.js';
import { CITY_MAPPING } from '../utils/cityMapping.js';

/** Cities shown on home / mobile discovery rails (pan-India tier-1; order from CITY_MAPPING). */
export const HOME_DISCOVERY_CITY_ORDER = Object.keys(CITY_MAPPING);

export type HomeDiscoveryCityName = string;

/** Navy + orange only — no purple/rainbow orbs. Shared by desktop + mobile heroes. */
export const HOME_HERO_SURFACE =
  'radial-gradient(900px 520px at -8% -12%, rgba(255,107,53,0.20) 0%, transparent 58%), radial-gradient(700px 480px at 110% 120%, rgba(255,107,53,0.08) 0%, transparent 55%), linear-gradient(165deg, #0B1020 0%, #12141C 52%, #1A130E 100%)';

/** Category icon plate — stone, not rainbow. */
export const HOME_CATEGORY_PLATE = 'from-stone-800 to-stone-900';

/** One city accent for every metro — monument + name carry identity, not hue. */
export const HOME_CITY_ACCENT = {
  solid: '#1C1917',
  soft: '#F4F0EA',
  ring: 'rgba(28, 25, 23, 0.12)',
  header: 'linear-gradient(165deg, #F7F4F0 0%, #EDE8E1 100%)',
  pin: '#FF6B35',
} as const;

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

export function getHomeMobileCityGradient(_cityName: string): string {
  return HOME_CITY_ACCENT.header;
}

export function getHomeMobileCityAccent(_cityName: string): {
  solid: string;
  soft: string;
  ring: string;
} {
  return HOME_CITY_ACCENT;
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
