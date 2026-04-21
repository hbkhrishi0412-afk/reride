import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { View as ViewEnum, VehicleCategory, type Vehicle } from '../types';
import { getFirstValidImage } from '../utils/imageUtils';
import { matchesCity, primaryLocationLabel } from '../utils/cityMapping';
import { FALLBACK_VEHICLES } from '../constants/fallback';
import MobileVehicleCard from './MobileVehicleCard';
import LazyImage from './LazyImage';

// Lazy-load the shared LocationModal — only costs the user the bundle when they
// actually tap the location pill on the mobile hero.
const LocationModal = lazy(() => import('./LocationModal'));
import { useStorefrontAggregates } from '../hooks/useStorefrontAggregates';
import { showVerifiedListingBadge } from '../utils/listingTrust';
import {
  HOME_DESKTOP_CITY_STYLE,
  HOME_DISCOVERY_CATEGORIES,
  HOME_DISCOVERY_CITY_ORDER,
  HOME_MOBILE_CITY_ACCENT,
  HOME_MOBILE_CITY_GRADIENT,
} from '../constants/homeDiscovery';
import CityMonument from './CityMonument';
import VehicleCategoryIcon from './VehicleCategoryIcon';
import {
  RECENTLY_VIEWED_CHANGED_EVENT,
  getLocalRecentIds,
} from '../utils/recentlyViewed';
import { getPopularMakes } from '../utils/popularListings';

// Adds the `is-visible` class once the element scrolls into view (one-shot).
// Used in tandem with the `.reveal-on-scroll` CSS utility for a fade-up effect.
const useRevealOnScroll = <T extends HTMLElement>(delayMs: number = 0) => {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      node.classList.add('is-visible');
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            window.setTimeout(() => entry.target.classList.add('is-visible'), delayMs);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [delayMs]);
  return ref;
};

// Lightweight number ticker driven by requestAnimationFrame. Triggers when `start` flips true.
const useCountUp = (end: number, start: boolean, duration: number = 1400) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(end * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [end, start, duration]);
  return value;
};

interface MobileStatProps {
  value: number;
  suffix?: string;
  label: string;
  visible: boolean;
  formatter?: (n: number) => string;
}

const MobileStat: React.FC<MobileStatProps> = ({ value, suffix = '', label, visible, formatter }) => {
  const current = useCountUp(value, visible);
  const display = formatter ? formatter(current) : Math.round(current).toLocaleString('en-IN');
  return (
    <div className="text-center">
      <div className="text-xl font-bold text-gray-900 tracking-tight tabular-nums leading-none">
        {display}{suffix}
      </div>
      <div className="text-[11px] text-gray-500 mt-1 tracking-wide">{label}</div>
    </div>
  );
};

// Rough EMI estimate: 5-year loan at ~10% APR, 20% down. Display-only.
const estimateMobileEmi = (price: number) => {
  const principal = price * 0.8;
  const monthlyRate = 0.10 / 12;
  const months = 60;
  const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
  return Math.round(emi / 100) * 100;
};

interface MobileHomePageProps {
  onSearch: (query: string) => void;
  /**
   * Deep-link filter applier. Used by budget and brand chips so they
   * don't depend on the Gemini proxy to translate natural-language
   * strings into structured filters (which silently fails in dev /
   * offline). App.tsx pushes the filters into the URL query string and
   * VehicleList applies them on mount.
   */
  onApplyFilters?: (opts: { filters?: Record<string, string | number>; query?: string }) => void;
  onSelectCategory: (category: VehicleCategory) => void;
  featuredVehicles: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  onToggleCompare: (id: number) => void;
  comparisonList: number[];
  onToggleWishlist: (id: number) => void;
  wishlist: number[];
  onViewSellerProfile: (sellerEmail: string) => void;
  recommendations: Vehicle[];
  allVehicles: Vehicle[];
  onNavigate: (view: ViewEnum) => void;
  onSelectCity: (city: string) => void;
  /**
   * Current user's saved/detected location. When provided together with
   * `onLocationChange`, the hero renders a tap-target that opens the shared
   * LocationModal (city/district/detect) — mirroring the desktop header.
   * Optional so we don't break existing callers during the rollout.
   */
  userLocation?: string;
  onLocationChange?: (location: string) => void;
  addToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * Mobile-Optimized Home Page
 * Features:
 * - Full-screen hero with search
 * - Swipeable featured vehicles carousel
 * - Touch-friendly category/city selection
 * - Pull-to-refresh ready
 * - Optimized for mobile performance
 */
export const MobileHomePage: React.FC<MobileHomePageProps> = React.memo(({
  onSearch,
  onApplyFilters,
  onSelectCategory,
  featuredVehicles,
  onSelectVehicle,
  onToggleCompare,
  onToggleWishlist,
  wishlist,
  comparisonList,
  onViewSellerProfile: _onViewSellerProfile,
  recommendations,
  allVehicles,
  onNavigate,
  onSelectCity,
  userLocation,
  onLocationChange,
  addToast,
}) => {
  const { t } = useTranslation();
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // Short label for the pill: strip state suffix ("Mumbai, MH" → "Mumbai").
  const locationLabel = useMemo(() => {
    const raw = (userLocation || '').trim();
    if (!raw) return t('header.selectLocation') || 'Select location';
    return primaryLocationLabel(raw) || raw;
  }, [userLocation, t]);

  const canUseLocationPicker = typeof onLocationChange === 'function';

  const handleLocationChange = useCallback(
    (next: string) => {
      onLocationChange?.(next);
    },
    [onLocationChange]
  );

  // Fallback toast when the parent didn't pass one (keeps LocationModal happy
  // without forcing every caller to wire a toast bus).
  const noopToast = useCallback((_message: string, _type: 'success' | 'error' | 'info') => {
    // Intentionally empty; the parent should provide a real toast impl.
  }, []);
  const { data: storefrontAgg } = useStorefrontAggregates();
  const [searchQuery, setSearchQuery] = useState('');
  const carouselRef = useRef<HTMLDivElement>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Voice search (Web Speech API) — feature-detected so we can hide the mic
  // button on unsupported browsers (Firefox desktop, older iOS WebViews).
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const supportsVoiceSearch = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }, []);

  // Reveal-on-scroll refs for major mobile sections (fade-up entrance).
  const statsRef = useRef<HTMLDivElement | null>(null);
  const [statsVisible, setStatsVisible] = useState(false);
  useEffect(() => {
    const node = statsRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          setStatsVisible(true);
        }
      }),
      { threshold: 0.4 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  // Recently-viewed ids — populated by AppProvider.selectVehicle via
  // `utils/recentlyViewed` (localStorage). We subscribe to the in-app
  // "changed" event so the strip updates after the user taps a card,
  // navigates to detail, and returns home.
  const [recentIds, setRecentIds] = useState<number[]>(() => getLocalRecentIds());
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const refresh = () => setRecentIds(getLocalRecentIds());
    refresh();
    window.addEventListener(RECENTLY_VIEWED_CHANGED_EVENT, refresh);
    // Cross-tab sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'reride.recentlyViewed.local') refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(RECENTLY_VIEWED_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const continueBrowsingVehicles = useMemo(() => {
    if (!recentIds.length) return [];
    const idToVehicle = new Map<number, Vehicle>();
    allVehicles.forEach((v) => {
      if (v?.id != null) idToVehicle.set(v.id, v);
    });
    return recentIds
      .map((id) => idToVehicle.get(id))
      .filter((v): v is Vehicle => !!v && v.status !== 'sold')
      .slice(0, 8);
  }, [recentIds, allVehicles]);

  const continueRef = useRevealOnScroll<HTMLDivElement>(0);

  const featuredRef = useRevealOnScroll<HTMLDivElement>(0);
  const categoriesRef = useRevealOnScroll<HTMLDivElement>(0);
  const citiesRef = useRevealOnScroll<HTMLDivElement>(0);
  const recsRef = useRevealOnScroll<HTMLDivElement>(0);
  const sellRef = useRevealOnScroll<HTMLDivElement>(0);
  /**
   * Featured carousel: horizontal scroll + strict touch heuristics used to swallow taps on real devices
   * (small scrollDelta / missing synthetic click on iOS). Pointer down→up with a movement slop fixes opens.
   */
  const carouselPointerRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    vehicleId: number;
  } | null>(null);
  /** After pointer-up navigation, skip the follow-up synthetic click (selectVehicle dedupes, but avoids double work). */
  const carouselTapSuppressClickRef = useRef(false);
  /** Touch fallback when Pointer Events + click are unreliable inside horizontal scroll (Android WebView). */
  const carouselTouchRef = useRef<{
    x: number;
    y: number;
    vehicleId: number;
  } | null>(null);

  const publishedVehicles = useMemo(
    () => allVehicles.filter(vehicle => vehicle && vehicle.status === 'published' && vehicle.listingType !== 'rental'),
    [allVehicles]
  );

  const cities = useMemo(
    () =>
      HOME_DISCOVERY_CITY_ORDER.map((name) => {
        const client = publishedVehicles.filter((vehicle) =>
          matchesCity(vehicle.city, name)
        ).length;
        const apiCount = storefrontAgg?.cities[name];
        return {
          name,
          abbr: HOME_DESKTOP_CITY_STYLE[name].abbr,
          count: apiCount !== undefined ? apiCount : client,
        };
      }),
    [publishedVehicles, storefrontAgg?.cities]
  );

  const categoryCounts = useMemo(
    () =>
      publishedVehicles.reduce((acc, vehicle) => {
        if (vehicle?.category) {
          acc[vehicle.category] = (acc[vehicle.category] || 0) + 1;
        }
        return acc;
      }, {} as Record<VehicleCategory, number>),
    [publishedVehicles]
  );

  const categories = useMemo(
    () =>
      HOME_DISCOVERY_CATEGORIES.map((category) => {
        const client = categoryCounts[category.id] || 0;
        const apiCount = storefrontAgg?.categories[category.id];
        return {
          name: category.name,
          icon: category.icon,
          id: category.id,
          mobileCardGradient: category.mobileCardGradient,
          count: apiCount !== undefined ? apiCount : client,
        };
      }),
    [categoryCounts, storefrontAgg?.categories]
  );

  // Track carousel scroll position with throttling for performance
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollLeft = carousel.scrollLeft;
          const itemWidth = carousel.clientWidth;
          const currentIndex = Math.round(scrollLeft / itemWidth);
          setCarouselIndex(currentIndex);
          ticking = false;
        });
        ticking = true;
      }
    };

    carousel.addEventListener('scroll', handleScroll, { passive: true });
    return () => carousel.removeEventListener('scroll', handleScroll);
  }, [featuredVehicles.length]);

  const handleSearch = useCallback(() => {
    const trimmedQuery = searchQuery.trim();
    if (onApplyFilters) {
      // Deep-link into `/used-cars?q=...` — stays on the URL and is
      // reproducible on refresh / share.
      onApplyFilters({ query: trimmedQuery });
      return;
    }
    if (trimmedQuery) {
      onSearch(trimmedQuery);
      onNavigate(ViewEnum.USED_CARS);
    } else {
      onNavigate(ViewEnum.USED_CARS);
    }
  }, [searchQuery, onApplyFilters, onSearch, onNavigate]);

  // Kick off a one-shot voice search. Result fills the input and submits.
  // Stops any in-flight recognition (toggle-off) when already listening.
  const handleVoiceSearch = useCallback(() => {
    if (!supportsVoiceSearch) return;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR =
      (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!SR) return;
    // The Web Speech API typings aren't standard across browsers; use `any`
    // locally with a tight surface area.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new (SR as unknown as new () => unknown)();
    rec.lang = 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      const transcript: string =
        event?.results?.[0]?.[0]?.transcript?.trim?.() ?? '';
      if (transcript) {
        setSearchQuery(transcript);
        if (onApplyFilters) {
          onApplyFilters({ query: transcript });
        } else {
          onSearch(transcript);
          onNavigate(ViewEnum.USED_CARS);
        }
      }
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    try {
      rec.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }, [supportsVoiceSearch, isListening, onApplyFilters, onSearch, onNavigate]);

  useEffect(() => () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore teardown errors */
    }
  }, []);

  // Budget quick-filter chips — deep-link straight to structured filters
  // so they work even if the AI proxy is offline. Prices are in INR.
  const budgetChips = useMemo<
    Array<{ key: string; label: string; filters: Record<string, string | number> }>
  >(
    () => [
      { key: 'under3', label: t('mobile.home.budget.under3'), filters: { maxPrice: 300000 } as Record<string, string | number> },
      { key: '3to5', label: t('mobile.home.budget.3to5'), filters: { minPrice: 300000, maxPrice: 500000 } as Record<string, string | number> },
      { key: '5to8', label: t('mobile.home.budget.5to8'), filters: { minPrice: 500000, maxPrice: 800000 } as Record<string, string | number> },
      { key: '8to15', label: t('mobile.home.budget.8to15'), filters: { minPrice: 800000, maxPrice: 1500000 } as Record<string, string | number> },
      { key: 'above15', label: t('mobile.home.budget.above15'), filters: { minPrice: 1500000 } as Record<string, string | number> },
    ],
    [t]
  );

  // Popular makes / models ranked by live listing count — new catalog
  // additions surface here automatically in production. Fallback list is
  // only used while inventory is still loading.
  const popularMakes = useMemo(() => getPopularMakes(allVehicles, 9), [allVehicles]);
  const POPULAR_MAKES_FALLBACK = ['Maruti Suzuki', 'Hyundai', 'Honda', 'Toyota', 'Tata', 'Mahindra', 'Kia'];
  const popularMakeLabels = popularMakes.length > 0
    ? popularMakes.map((m) => m.name)
    : POPULAR_MAKES_FALLBACK;

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }, []);

  // Premium carousel: show featured first, then fill with other published listings.
  // (Previously we only showed `featuredVehicles` when any existed — e.g. one featured
  // row in DB meant a single card even if many listings were published.)
  const displayedFeaturedVehicles = useMemo(
    () => {
      const MAX_CAROUSEL = 24;
      const nonRentalFeatured = featuredVehicles.filter(vehicle => vehicle && vehicle.listingType !== 'rental');
      const seen = new Set<number>();
      const merged: Vehicle[] = [];

      const pushUnique = (vehicle: Vehicle) => {
        if (merged.length >= MAX_CAROUSEL) return;
        if (vehicle?.id != null && !seen.has(vehicle.id)) {
          seen.add(vehicle.id);
          merged.push(vehicle);
        }
      };

      nonRentalFeatured.forEach(pushUnique);
      publishedVehicles.forEach(pushUnique);
      if (merged.length > 0) return merged;

      const activeLikeVehicles = allVehicles.filter(vehicle =>
        vehicle &&
        vehicle.listingType !== 'rental' &&
        vehicle.status !== 'sold' &&
        vehicle.listingStatus === 'active'
      );
      if (activeLikeVehicles.length > 0) return activeLikeVehicles.slice(0, MAX_CAROUSEL);

      const nonSoldVehicles = allVehicles.filter(vehicle =>
        vehicle &&
        vehicle.listingType !== 'rental' &&
        vehicle.status !== 'sold'
      );
      if (nonSoldVehicles.length > 0) return nonSoldVehicles.slice(0, MAX_CAROUSEL);

      return FALLBACK_VEHICLES.slice(0, 4);
    },
    [featuredVehicles, publishedVehicles, allVehicles]
  );

  return (
    <div className="bg-gray-50">
      {/* Hero Section */}
      <div
        className="relative pt-5 pb-8 px-4 overflow-hidden bg-[#0B1020]"
        style={{
          background:
            'radial-gradient(600px 380px at -10% -10%, rgba(255,107,53,0.22) 0%, transparent 60%), radial-gradient(520px 380px at 110% 10%, rgba(124,58,237,0.26) 0%, transparent 60%), radial-gradient(720px 480px at 50% 120%, rgba(59,130,246,0.18) 0%, transparent 60%), linear-gradient(135deg, #0B1020 0%, #111834 50%, #1A1240 100%)',
        }}
      >
        {/* Subtle grid texture (purely decorative) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(ellipse at top, black 40%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at top, black 40%, transparent 75%)',
          }}
        />
        {/* Soft drifting orbs */}
        <div
          aria-hidden="true"
          className="absolute -top-12 -left-10 w-44 h-44 rounded-full blur-3xl opacity-50 animate-orb-a pointer-events-none"
          style={{ background: 'radial-gradient(circle, #FF6B35 0%, transparent 70%)' }}
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-16 -right-10 w-52 h-52 rounded-full blur-3xl opacity-50 animate-orb-b pointer-events-none"
          style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)' }}
        />

        <div className="relative">
          {/* Top row: Location picker + Trust badge.
              The location pill sits on the left so one-handed users can reach
              it with a thumb; the RTO trust badge stays centered as the visual
              anchor. Both share the same glassmorphic treatment. */}
          <div className="flex items-center justify-between gap-2 mb-4 hero-rise hero-rise-1">
            {canUseLocationPicker ? (
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(true)}
                aria-label={t('a11y.chooseLocation') || 'Choose location'}
                className="inline-flex items-center gap-1.5 max-w-[55%] px-3 py-1.5 bg-white/15 hover:bg-white/25 active:bg-white/30 backdrop-blur-md rounded-full border border-white/25 text-white text-[11px] font-semibold tracking-wide transition-colors active:scale-95"
                style={{ minHeight: '32px' }}
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="truncate">{locationLabel}</span>
                <svg className="w-3 h-3 flex-shrink-0 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            ) : (
              <span aria-hidden="true" />
            )}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/15 backdrop-blur-md rounded-full border border-white/20">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full sparkle-pulse" />
              <span className="text-white text-[11px] font-medium tracking-wide">{t('home.trustBadgeVerified')}</span>
            </div>
            {/* Balancing spacer so the trust badge sits optically centered when
                the location pill is hidden (e.g. caller didn't wire it). */}
            {!canUseLocationPicker && <span aria-hidden="true" />}
          </div>

          {/* Heading */}
          <h1
            className="text-[28px] font-bold text-white mb-2 text-center hero-rise hero-rise-2 hero-gradient-text"
            style={{ letterSpacing: '-0.02em', lineHeight: 1.15 }}
          >
            {t('home.premiumUsedCars')}
          </h1>
          <p className="text-white/85 text-[13px] text-center mb-5 px-2 leading-snug hero-rise hero-rise-3">
            {t('mobile.home.heroSub')}
          </p>

          {/* Search Bar */}
          <div
            className="bg-white rounded-2xl overflow-hidden hero-rise hero-rise-4"
            style={{ boxShadow: '0 12px 30px -10px rgba(0,0,0,0.35), 0 4px 8px -4px rgba(0,0,0,0.15)' }}
          >
            <div className="flex items-center gap-2 px-3.5 py-2.5">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={t('search.placeholderMobile')}
                aria-label={t('a11y.searchVehicles')}
                className="flex-1 min-w-0 outline-none text-gray-700 placeholder-gray-400 text-[14px]"
                style={{ minHeight: '44px' }}
              />
              {supportsVoiceSearch && (
                <button
                  type="button"
                  onClick={handleVoiceSearch}
                  aria-label={isListening ? t('a11y.voiceListening') : t('a11y.voiceSearch')}
                  aria-pressed={isListening}
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                    isListening
                      ? 'bg-red-50 text-red-600 ring-2 ring-red-200 animate-pulse'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={{ minWidth: '40px', minHeight: '40px' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8" />
                    <rect x="9" y="3" width="6" height="12" rx="3" strokeWidth={2} />
                  </svg>
                </button>
              )}
              <button
                onClick={handleSearch}
                aria-label={t('common.search')}
                className="bg-orange-500 text-white px-4 py-2.5 rounded-xl font-semibold flex-shrink-0 text-[13px] hero-cta-glow active:scale-95 transition-transform"
                style={{ minHeight: '44px' }}
              >
                {t('common.search')}
              </button>
            </div>
          </div>

          {/* Budget quick-filter chips — the most-used filter on a mobile
              used-car app. Placed above brands so budget-first shoppers
              don't have to scroll. Natural-language queries are parsed by
              the AI search in VehicleList. */}
          <div className="relative mt-3 -mx-4 hero-rise hero-rise-5">
            <div className="flex gap-2 overflow-x-auto pb-1 px-4 scrollbar-hide">
              {budgetChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => {
                    if (onApplyFilters) {
                      onApplyFilters({ filters: chip.filters });
                    } else {
                      // Fallback (no deep-link handler wired): just navigate.
                      onNavigate(ViewEnum.USED_CARS);
                    }
                  }}
                  className="flex-shrink-0 px-3.5 py-1.5 rounded-full bg-white text-orange-600 text-[12px] font-semibold shadow-sm active:scale-95 transition-transform"
                >
                  {chip.label}
                </button>
              ))}
            </div>
            {/* Right-edge fade as a swipe affordance (more chips off-screen). */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 bottom-0 w-8"
              style={{ background: 'linear-gradient(to left, rgba(11,16,32,0.95), rgba(11,16,32,0))' }}
            />
          </div>

          {/* Popular brands — data-driven, ranked by live listing count so
              new makes added in production show up here automatically.
              Falls back to a conservative static list only while inventory
              is still loading (empty `allVehicles`). */}
          <div className="relative mt-2 -mx-4 hero-rise hero-rise-5">
            <div className="flex gap-2 overflow-x-auto pb-1 px-4 scrollbar-hide">
              {popularMakeLabels.map((brand) => (
                <button
                  key={brand}
                  type="button"
                  onClick={() => {
                    if (onApplyFilters) {
                      onApplyFilters({ filters: { make: brand } });
                    } else {
                      onSearch(brand);
                      onNavigate(ViewEnum.USED_CARS);
                    }
                  }}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 active:bg-white/30 backdrop-blur-md text-white text-[11px] font-medium border border-white/20 transition-colors"
                >
                  {brand}
                </button>
              ))}
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 bottom-0 w-8"
              style={{ background: 'linear-gradient(to left, rgba(11,16,32,0.95), rgba(11,16,32,0))' }}
            />
          </div>

          {/* Feature Pills */}
          <div className="grid grid-cols-4 gap-2 mt-5 hero-rise hero-rise-6">
            {[
              { icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', label: t('mobile.hero.checksPill') },
              { icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label: t('mobile.hero.fixedPrice') },
              { icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', label: t('mobile.hero.moneyBack') },
              { icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: t('mobile.hero.freeRc') },
            ].map((pill) => (
              <div
                key={pill.label}
                className="bg-white/12 backdrop-blur-sm rounded-xl p-2.5 text-center border border-white/15"
              >
                <svg className="w-5 h-5 text-white mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={pill.icon} />
                </svg>
                <p className="text-white text-[10px] font-medium leading-tight">{pill.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Trust Strip — show honest counts. Only append "+" once the
          numbers are meaningfully large, so a growing marketplace doesn't
          advertise "7+ Cars, 5+ Cities" and torpedo the trust badge. */}
      <div
        ref={statsRef}
        className="reveal-on-scroll bg-white border-t border-gray-100 px-4 py-4"
      >
        <div className="grid grid-cols-4 gap-2">
          <MobileStat
            value={publishedVehicles.length}
            label={t('home.stats.cars') || 'Cars'}
            suffix={publishedVehicles.length >= 100 ? '+' : ''}
            visible={statsVisible}
          />
          <MobileStat
            value={cities.filter((c) => c.count > 0).length || cities.length}
            label={t('home.stats.cities') || 'Cities'}
            suffix={cities.filter((c) => c.count > 0).length >= 10 ? '+' : ''}
            visible={statsVisible}
          />
          <MobileStat value={200} label={t('home.stats.checks') || 'Checks'} suffix="+" visible={statsVisible} />
          <MobileStat value={4.8} label={t('home.stats.rating') || 'Rating'} visible={statsVisible} formatter={(n) => n.toFixed(1)} />
        </div>
      </div>

      {/* Continue Browsing — anon-friendly "pick up where you left off"
          strip. Only renders when the local recently-viewed list has at
          least one match against the current catalog. */}
      {continueBrowsingVehicles.length > 0 && (
        <div
          ref={continueRef}
          className="reveal-on-scroll px-4 py-5 bg-white border-t border-gray-100"
        >
          <div className="flex items-end justify-between mb-3">
            <div className="space-y-0.5">
              <div className="inline-flex items-center gap-1.5 text-indigo-600 text-[10px] font-semibold uppercase tracking-wider">
                <span className="h-px w-4 bg-indigo-300" />
                {t('mobile.home.continue.subtitle')}
              </div>
              <h2 className="text-[18px] font-bold text-gray-900 tracking-tight leading-tight">
                {t('mobile.home.continue.title')}
              </h2>
            </div>
          </div>
          <div
            className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-hide snap-x"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {continueBrowsingVehicles.map((vehicle) => (
              <button
                key={vehicle.id}
                type="button"
                onClick={() => onSelectVehicle?.(vehicle)}
                className="flex-shrink-0 w-[132px] snap-start text-left active:scale-[0.97] transition-transform"
                aria-label={`View ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              >
                <div className="rounded-xl overflow-hidden border border-gray-100 bg-white shadow-sm">
                  <div className="relative w-full h-[88px] bg-gray-100 overflow-hidden">
                    <LazyImage
                      src={getFirstValidImage(vehicle.images, vehicle.id)}
                      alt={`${vehicle.make} ${vehicle.model}`}
                      className="w-full h-full object-cover"
                      width={320}
                      quality={70}
                    />
                  </div>
                  <div className="px-2 py-1.5">
                    <p className="text-[11px] font-semibold text-gray-900 truncate leading-tight">
                      {vehicle.year} {vehicle.make}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate leading-tight">
                      {vehicle.model}
                    </p>
                    <p className="text-[12px] font-bold text-orange-600 mt-0.5 tracking-tight">
                      {formatCurrency(vehicle.price)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Featured Vehicles Carousel */}
      {displayedFeaturedVehicles.length > 0 ? (
        <div ref={featuredRef} className="reveal-on-scroll px-4 py-6 bg-white border-t border-gray-100">
          <div className="flex items-end justify-between mb-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-purple-700 text-[10px] font-semibold uppercase tracking-wider">
                <span className="h-px w-4 bg-purple-300" />
                {t('home.featured.badge')}
              </div>
              <h2 className="text-[22px] font-bold text-gray-900 tracking-tight leading-tight">{t('home.featured.title')}</h2>
              <p className="text-gray-500 text-[12px] leading-snug">{t('home.featured.subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(ViewEnum.USED_CARS)}
              className="flex-shrink-0 inline-flex items-center gap-1 text-purple-700 font-semibold text-[12px] px-2 py-1 active:scale-95 transition-transform"
            >
              {t('home.recent.viewAll')}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          <div className="relative">
            <div
              className="pointer-events-none absolute left-0 top-0 bottom-0 w-7 bg-gradient-to-r from-white to-transparent z-10"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute right-0 top-0 bottom-0 w-7 bg-gradient-to-l from-white to-transparent z-10"
              aria-hidden="true"
            />
            <div
              ref={carouselRef}
              className="flex overflow-x-auto snap-x snap-mandatory gap-4 -mx-4 px-4 relative z-0"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
            >
            {displayedFeaturedVehicles.map((vehicle, idx) => {
              const TAP_MOVE_SLACK_PX = 56;

              const openVehicleFromCarousel = () => {
                carouselTapSuppressClickRef.current = true;
                window.setTimeout(() => {
                  carouselTapSuppressClickRef.current = false;
                }, 450);
                onSelectVehicle?.(vehicle);
              };

              const handlePointerDown = (e: React.PointerEvent) => {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                const el = e.target as HTMLElement | null;
                // Only skip real controls — not [role="button"] on this slide (the slide root uses it for a11y).
                if (el?.closest?.('button, a')) return;
                carouselPointerRef.current = {
                  pointerId: e.pointerId,
                  x: e.clientX,
                  y: e.clientY,
                  vehicleId: vehicle.id,
                };
              };

              const handlePointerUp = (e: React.PointerEvent) => {
                const el = e.target as HTMLElement | null;
                if (el?.closest?.('button, a')) return;
                const start = carouselPointerRef.current;
                if (
                  !start ||
                  start.vehicleId !== vehicle.id ||
                  start.pointerId !== e.pointerId
                ) {
                  return;
                }
                carouselPointerRef.current = null;
                const dx = Math.abs(e.clientX - start.x);
                const dy = Math.abs(e.clientY - start.y);
                if (dx < TAP_MOVE_SLACK_PX && dy < TAP_MOVE_SLACK_PX) {
                  e.preventDefault();
                  carouselTouchRef.current = null;
                  openVehicleFromCarousel();
                }
              };

              const handlePointerCancel = (e: React.PointerEvent) => {
                const start = carouselPointerRef.current;
                if (start && start.pointerId === e.pointerId) {
                  carouselPointerRef.current = null;
                }
                carouselTouchRef.current = null;
              };

              const handleTouchStart = (e: React.TouchEvent) => {
                const el = e.target as HTMLElement | null;
                if (el?.closest?.('button, a')) return;
                const t = e.touches[0];
                if (!t) return;
                carouselTouchRef.current = {
                  x: t.clientX,
                  y: t.clientY,
                  vehicleId: vehicle.id,
                };
              };

              const handleTouchEnd = (e: React.TouchEvent) => {
                if (carouselTapSuppressClickRef.current) return;
                const el = e.target as HTMLElement | null;
                if (el?.closest?.('button, a')) return;
                const start = carouselTouchRef.current;
                if (!start || start.vehicleId !== vehicle.id) return;
                carouselTouchRef.current = null;
                const t = e.changedTouches[0];
                if (!t) return;
                const dx = Math.abs(t.clientX - start.x);
                const dy = Math.abs(t.clientY - start.y);
                if (dx < TAP_MOVE_SLACK_PX && dy < TAP_MOVE_SLACK_PX) {
                  e.preventDefault();
                  carouselPointerRef.current = null;
                  openVehicleFromCarousel();
                }
              };

              const handleTouchCancel = () => {
                carouselTouchRef.current = null;
              };

              const handleClick = () => {
                if (carouselTapSuppressClickRef.current) return;
                onSelectVehicle?.(vehicle);
              };

              return (
                <div
                  key={vehicle.id}
                  className="flex-shrink-0 w-[calc(100%-2rem)] snap-center cursor-pointer touch-manipulation"
                  role="group"
                  tabIndex={0}
                  aria-label={`View ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                  onClick={handleClick}
                  onPointerDown={handlePointerDown}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerCancel}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchCancel}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && onSelectVehicle) {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelectVehicle(vehicle);
                    }
                  }}
                >
                  <div className="bg-white rounded-2xl overflow-hidden active:scale-[0.98] transition-transform duration-200 border border-gray-100 cursor-pointer shine-on-hover" style={{ boxShadow: '0 6px 16px -8px rgba(0,0,0,0.18), 0 2px 6px -2px rgba(0,0,0,0.08)' }}>
                  <div className="relative h-52 overflow-hidden">
                      <LazyImage
                        src={getFirstValidImage(vehicle.images, vehicle.id)}
                        alt={`${vehicle.make} ${vehicle.model}`}
                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                        width={800}
                        quality={85}
                        eager={idx === 0}
                        fetchPriority={idx === 0 ? 'high' : 'auto'}
                      />
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
                    
                    {showVerifiedListingBadge(vehicle) && (
                    <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-sm flex items-center gap-1 border border-emerald-100">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {t('common.verified')}
                    </div>
                    )}
                    {/* Wishlist Button - Premium Style */}
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onPointerUp={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWishlist(vehicle.id);
                      }}
                      className="absolute top-3 right-3 w-11 h-11 bg-white/95 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all duration-300 hover:scale-110 active:scale-95"
                      style={{ minWidth: '44px', minHeight: '44px' }}
                    >
                      <svg
                        className={`w-5 h-5 transition-all duration-300 ${wishlist.includes(vehicle.id) ? 'fill-red-500 text-red-500 scale-110' : 'text-gray-700'}`}
                        fill={wishlist.includes(vehicle.id) ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-[16px] text-gray-900 mb-0.5 leading-tight tracking-tight">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </h3>
                    <p className="text-[11px] text-gray-500 mb-2.5">
                      EMI from ₹{estimateMobileEmi(vehicle.price).toLocaleString('en-IN')}/mo
                    </p>
                    <div className="flex items-baseline gap-2 mb-3">
                      <p className="text-[20px] font-bold text-orange-600 tracking-tight">
                        {formatCurrency(vehicle.price)}
                      </p>
                      <span className="text-[11px] text-gray-400 line-through">
                        {formatCurrency(vehicle.price * 1.1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-600 mb-3 flex-wrap">
                      <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {vehicle.mileage.toLocaleString()} km
                      </span>
                      <span className="bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                        {vehicle.fuelType}
                      </span>
                      <span className="bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                        {vehicle.transmission}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 pt-2 border-t border-gray-100">
                      <svg className="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="font-medium text-gray-600">{vehicle.city || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
            })}
            </div>
          </div>

          {/* Carousel Indicators */}
          {displayedFeaturedVehicles.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              {displayedFeaturedVehicles.map((_, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => {
                    if (carouselRef.current) {
                      const itemWidth = carouselRef.current.clientWidth;
                      carouselRef.current.scrollTo({
                        left: idx * itemWidth,
                        behavior: 'smooth'
                      });
                    }
                  }}
                  className={`h-2 rounded-full transition-all ${
                    idx === carouselIndex ? 'bg-orange-500 w-8' : 'bg-gray-300 w-2'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 py-5 bg-white border-t border-gray-100">
          <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-center">
            <p className="text-gray-800 font-semibold mb-1">{t('mobile.home.noFeatured')}</p>
            <p className="text-gray-500 text-sm mb-4">{t('mobile.home.browseHint')}</p>
            <button
              onClick={() => onNavigate(ViewEnum.USED_CARS)}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg font-semibold active:scale-95 transition-transform w-full"
              style={{ minHeight: '44px' }}
            >
              {t('mobile.home.browseAllCars')}
            </button>
          </div>
        </div>
      )}

      {/* Categories Section - Compact Mobile Tiles */}
      <section
        ref={categoriesRef}
        className="reveal-on-scroll px-4 py-6 bg-gradient-to-b from-white to-gray-50 border-t border-gray-100"
        aria-labelledby="mobile-home-categories-heading"
      >
        <div className="flex items-end justify-between mb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-orange-600 text-[10px] font-semibold uppercase tracking-wider">
              <span className="h-px w-4 bg-orange-300" />
              Browse
            </div>
            <h2 id="mobile-home-categories-heading" className="text-[20px] font-bold text-gray-900 tracking-tight leading-tight">
              {t('home.categories.title')}
            </h2>
            <p className="text-[12px] text-gray-500 leading-snug">{t('mobile.home.quickTaps')}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate(ViewEnum.USED_CARS)}
            className="text-sm text-orange-500 font-semibold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-orange-50 active:scale-95 transition-all motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {t('home.recent.viewAll')}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div
          className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide snap-x snap-mandatory scroll-pl-1"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {categories.map((category, index) => {
            const gradient = category.mobileCardGradient;
            const hasVehicles = category.count > 0;

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  onSelectCategory(category.id);
                  onNavigate(ViewEnum.USED_CARS);
                }}
                className="vc-tile group relative flex-shrink-0 flex flex-col items-center gap-2.5 p-3 bg-white rounded-2xl shadow-sm border border-gray-100 active:scale-95 transition-all duration-300 hover:shadow-lg w-[112px] snap-start motion-reduce:transition-none motion-reduce:active:scale-100 motion-reduce:hover:shadow-sm"
                style={{
                  animationDelay: `${index * 50}ms`,
                  minHeight: '96px',
                }}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-2xl opacity-0 group-active:opacity-5 group-hover:opacity-10 transition-opacity duration-300 motion-reduce:transition-none`}
                />

                {/* Icon plate — a gradient-tinted square holding the sketch-SVG
                    vehicle. `vc-plate` gives it a subtle 3D tilt on hover;
                    the SVG itself drives the wheel/body animations via the
                    `vc-wheel` / `vc-body` classes defined in index.css. */}
                <div
                  className={`vc-plate relative w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow duration-300`}
                >
                  <VehicleCategoryIcon category={category.id} className="relative z-10 w-9 h-9 drop-shadow-sm" />
                  {/* Glossy sheen — adds the "toy car" 3D highlight on top. */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/35 via-white/0 to-transparent rounded-xl pointer-events-none" />
                  {/* Bottom inner shadow for weight/grounding. */}
                  <div
                    className="absolute inset-x-1 bottom-0 h-1.5 rounded-b-xl pointer-events-none"
                    style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.18), transparent)' }}
                  />
                </div>

                <span className="text-[11px] font-bold text-gray-900 text-center leading-tight group-hover:text-orange-600 transition-colors duration-300 motion-reduce:transition-none">
                  {category.name}
                </span>

                <div
                  className={`flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-300 motion-reduce:transition-none ${
                    hasVehicles
                      ? 'bg-orange-100 text-orange-600 group-hover:bg-orange-200'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <span>{category.count}</span>
                  <span className="ml-0.5">{t('mobile.home.carsSuffix')}</span>
                </div>

                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 motion-reduce:transition-none" />
              </button>
            );
          })}
        </div>
      </section>

      {/* Cities Section — Premium "Skyline" location cards.
          A coloured gradient header carries the city's identity (high recall),
          and a clean white footer carries the data with proper contrast for
          the count chip. Replaces the older circular tiles where the
          glassmorphic count badge was hard to read on top of the gradient. */}
      <section
        ref={citiesRef}
        className="reveal-on-scroll px-4 pt-6 pb-2 bg-white border-t border-gray-100"
        aria-labelledby="mobile-home-locations-heading"
      >
        <div className="flex items-end justify-between mb-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-purple-600 text-[10px] font-semibold uppercase tracking-[0.14em]">
              {/* Signature icon: map-pin inside a soft radar.
                  Instantly reads as "discover nearby" and ties the whole
                  section together as a single brand moment. */}
              <span
                className="relative inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 shadow-[0_4px_12px_-2px_rgba(168,85,247,0.55)]"
                aria-hidden="true"
              >
                <span className="absolute inset-0 rounded-full border border-purple-400/60 mc-header-radar" />
                <svg className="relative w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z" fill="currentColor" stroke="none" />
                  <circle cx="12" cy="9" r="2.4" fill="#fff" />
                </svg>
              </span>
              <span className="mc-eyebrow-accent font-bold">
                {t('mobile.home.exploreLocation')}
              </span>
            </div>
            <h2
              id="mobile-home-locations-heading"
              className="text-[22px] font-extrabold text-gray-900 tracking-tight leading-tight"
            >
              {t('home.cities.title')}
            </h2>
            <p className="text-[12.5px] text-gray-500 leading-snug">{t('mobile.home.nearYou')}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate(ViewEnum.USED_CARS)}
            className="text-sm text-orange-500 font-semibold flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg hover:bg-orange-50 active:scale-95 transition-all motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {t('home.recent.viewAll')}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div
          className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory scroll-pl-4"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {cities.map((city, index) => {
            const cityKey = city.name as (typeof HOME_DISCOVERY_CITY_ORDER)[number];
            const accent = HOME_MOBILE_CITY_ACCENT[cityKey];
            const hasVehicles = city.count > 0;

            return (
              <button
                key={city.name}
                type="button"
                aria-label={t('mobile.home.cityAria', { name: city.name, count: city.count })}
                onClick={() => onSelectCity(city.name)}
                className="mc-card group relative flex-shrink-0 w-[156px] h-[184px] rounded-3xl bg-white overflow-hidden snap-start text-left transition-all duration-300 active:scale-[0.97] hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  border: `1px solid ${accent.ring}`,
                  boxShadow:
                    '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px -8px rgba(15, 23, 42, 0.16)',
                  // Cascading entrance delay: 0ms, 80ms, 160ms, ...
                  ['--mc-delay' as string]: `${index * 80}ms`,
                }}
              >
                {/* Gradient header — carries city identity.
                    Light pastel background by design, so the monument and
                    abbreviation can render in the city's dark accent colour
                    for maximum postcard-style legibility. */}
                <div
                  className="mc-gradient relative h-[108px] w-full overflow-hidden"
                  style={{ background: HOME_MOBILE_CITY_GRADIENT[cityKey] }}
                >
                  {/* Soft decorative blobs (purely visual) */}
                  <div className="absolute inset-0 opacity-50 motion-reduce:hidden" aria-hidden="true">
                    <div
                      className="absolute -top-6 -right-4 w-24 h-24 rounded-full blur-2xl"
                      style={{ backgroundColor: accent.soft }}
                    />
                    <div
                      className="absolute -bottom-8 -left-6 w-20 h-20 rounded-full blur-2xl"
                      style={{ backgroundColor: accent.soft }}
                    />
                  </div>
                  {/* Subtle dotted texture for depth — dots in the accent
                      colour so they stay visible on the pastel background. */}
                  <div
                    className="absolute inset-0 opacity-[0.10] motion-reduce:hidden"
                    aria-hidden="true"
                    style={{
                      backgroundImage: `radial-gradient(circle at 1px 1px, ${accent.solid} 1px, transparent 0)`,
                      backgroundSize: '12px 12px',
                    }}
                  />

                  {/* Iconic monument silhouette — dark accent on pastel so it
                      reads as a classic postcard silhouette. */}
                  <CityMonument city={cityKey} className="mc-monument" color={accent.solid} />

                  {/* Pin badge with radar-ping rings — "live listings here".
                      Rings + chip use the city's accent colour so they stay
                      visible on the pastel background. */}
                  <div className="absolute top-2.5 right-2.5" aria-hidden="true">
                    <span className="relative flex w-7 h-7 items-center justify-center">
                      <span
                        className="mc-radar-ring absolute inset-0 rounded-full"
                        style={{ backgroundColor: accent.solid, opacity: 0.22 }}
                      />
                      <span
                        className="mc-radar-ring mc-radar-ring-2 absolute inset-0 rounded-full"
                        style={{ backgroundColor: accent.solid, opacity: 0.22 }}
                      />
                      <span
                        className="relative w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.75)',
                          border: `1px solid ${accent.ring}`,
                        }}
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          style={{ color: accent.solid }}
                        >
                          <path d="M12 22s7-6.3 7-12a7 7 0 10-14 0c0 5.7 7 12 7 12z" />
                          <circle cx="12" cy="10" r="2.6" fill="#fff" />
                        </svg>
                      </span>
                    </span>
                  </div>

                  {/* Big city abbreviation — bold dark text on pastel for
                      travel-poster contrast. */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span
                      className="mc-abbr text-[44px] leading-none font-black tracking-tight"
                      style={{
                        color: accent.solid,
                        fontFeatureSettings: '"tnum"',
                        textShadow: '0 1px 0 rgba(255,255,255,0.35)',
                      }}
                    >
                      {city.abbr}
                    </span>
                  </div>

                  {/* Hover sheen sweeping across */}
                  <div
                    className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 motion-reduce:hidden"
                    aria-hidden="true"
                  />
                </div>

                {/* Footer — clean white surface for legible data */}
                <div className="px-3.5 pt-2.5 pb-3 flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="text-[14.5px] font-bold text-gray-900 leading-tight tracking-tight truncate">
                      {city.name}
                    </h3>
                    <svg
                      className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5 group-hover:text-gray-500 group-hover:translate-x-1 transition-all duration-300 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>

                  {hasVehicles ? (
                    <span
                      className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-full text-[11px] font-bold"
                      style={{ backgroundColor: accent.soft, color: accent.solid }}
                    >
                      <span
                        className="mc-live-dot w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: accent.solid }}
                        aria-hidden="true"
                      />
                      {t('mobile.home.cityAvailable', { count: city.count })}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" aria-hidden="true" />
                      {t('mobile.home.cityComingSoon')}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div ref={recsRef} className="reveal-on-scroll px-4 py-6 bg-gray-50 border-t border-gray-100">
          <div className="flex items-end justify-between mb-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-pink-600 text-[10px] font-semibold uppercase tracking-wider">
                <span className="h-px w-4 bg-pink-300" />
                For You
              </div>
              <h2 className="text-[20px] font-bold text-gray-900 tracking-tight leading-tight">{t('mobile.home.recommended')}</h2>
            </div>
            <button
              onClick={() => onNavigate(ViewEnum.USED_CARS)}
              className="text-[12px] text-orange-600 font-semibold flex items-center gap-1 active:scale-95 transition-transform"
            >
              {t('home.recent.viewAll')}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <div className="space-y-4">
            {recommendations.slice(0, 5).map((vehicle) => (
              <MobileVehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                onSelect={onSelectVehicle}
                isInWishlist={wishlist.includes(vehicle.id)}
                isInCompare={comparisonList.includes(vehicle.id)}
                onToggleWishlist={onToggleWishlist}
                onToggleCompare={onToggleCompare}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sell Your Car CTA */}
      <div ref={sellRef} className="reveal-on-scroll px-4 pt-6 pb-8">
        <div
          className="relative overflow-hidden rounded-2xl p-5 text-white border border-white/10"
          style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #C026D3 100%)' }}
        >
          {/* Decorative orbs */}
          <div aria-hidden="true" className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div aria-hidden="true" className="absolute -bottom-12 -left-8 w-28 h-28 bg-pink-300/20 rounded-full blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[10px] font-semibold uppercase tracking-wider mb-2 border border-white/20">
              <span className="w-1 h-1 bg-green-400 rounded-full sparkle-pulse" />
              List in 60s
            </div>
            <h2 className="text-[20px] font-bold mb-1 tracking-tight leading-tight">{t('mobile.home.readyToSell')}</h2>
            <p className="text-white/85 text-[13px] leading-snug mb-4">{t('mobile.home.listVehicle')}</p>
            <button
              onClick={() => onNavigate(ViewEnum.SELL_CAR)}
              className="w-full bg-white text-purple-700 py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform text-[14px] hero-cta-glow"
              style={{ minHeight: '48px' }}
            >
              {t('nav.sellCar')}
            </button>
          </div>
        </div>
      </div>

      {/* Location Picker Modal — lazily mounted on first open to avoid
          shipping ~30KB of state/city data to users who never tap the pill. */}
      {canUseLocationPicker && isLocationModalOpen && (
        <Suspense fallback={null}>
          <LocationModal
            isOpen={isLocationModalOpen}
            onClose={() => setIsLocationModalOpen(false)}
            currentLocation={userLocation || ''}
            onLocationChange={handleLocationChange}
            addToast={addToast || noopToast}
          />
        </Suspense>
      )}
    </div>
  );
});

MobileHomePage.displayName = 'MobileHomePage';

export default MobileHomePage;

