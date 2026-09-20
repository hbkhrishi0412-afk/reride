import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { VehicleCategory, View as ViewEnum, type Vehicle, type View } from '../types';
import { getFirstValidImage, optimizeImageUrl } from '../utils/imageUtils';
import { matchesLocation } from '../utils/cityMapping';
import { countCityVehicles } from '../utils/storefrontDiscoveryCounts';
import LazyImage from './LazyImage';
import { useStorefrontAggregates } from '../hooks/useStorefrontAggregates';
import {
    getHomeDesktopCityStyle,
    HOME_DISCOVERY_CATEGORIES,
    HOME_DISCOVERY_CITY_ORDER,
    HOME_HERO_SURFACE,
    HOME_SECTION_BG,
    HOME_SECTION_FADE,
    HOME_LISTING_CARD,
} from '../constants/homeDiscovery';
import DealRoomHeroPreview from './DealRoomHeroPreview';
import { HomeCategoryTiles } from './home/HomeCategoryTiles';
import { HomeCityGrid } from './home/HomeCityGrid';
import { showVerifiedListingBadge } from '../utils/listingTrust';
import {
    getLocalRecentIds,
    RECENTLY_VIEWED_CHANGED_EVENT,
} from '../utils/recentlyViewed';
import { getPopularMakes } from '../utils/popularListings';
import { formatIndianPrice } from '../utils/vehiclePricing';
import { PopularCitiesChips } from './PopularCitiesChips.js';
import { useRevealOnScroll } from '../hooks/useRevealOnScroll';
import FloatingWhatsApp from './FloatingWhatsApp';
import ActiveDealsHomeBanner from './ActiveDealsHomeBanner';
import type { User } from '../types';

interface HomeProps {
    onSearch: (query: string) => void;
    /**
     * Deep-link filter applier. Budget / brand chips use URL-encoded filters
     * applied deterministically by `VehicleList.initialFilters`.
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
    onNavigate: (view: View) => void;
    onSelectCity: (city: string) => void;
    allVehicles?: Vehicle[];
    selectedCity?: string;
    onBrowseAllIndia?: () => void;
    onUseMyLocation?: (city: string, locationLabel: string) => void;
    userLocation?: string;
    onOpenLocationPicker?: () => void;
    addToast?: (message: string, type: 'success' | 'error' | 'info') => void;
    /** True while the vehicle catalog is still loading — avoids infinite skeletons when the catalog is empty. */
    isCatalogLoading?: boolean;
    onRetryCatalogLoad?: () => void;
    currentUser?: User | null;
}

const Home: React.FC<HomeProps> = ({ 
    featuredVehicles, 
    onSelectVehicle, 
    onToggleCompare,
    onToggleWishlist, 
    wishlist,
    onNavigate,
    onSelectCity,
    onSelectCategory,
    comparisonList,
    recommendations,
    onSearch,
    onApplyFilters,
    allVehicles = [],
    selectedCity = '',
    onBrowseAllIndia,
    onUseMyLocation,
    userLocation = '',
    onOpenLocationPicker,
    addToast,
    isCatalogLoading = false,
    onRetryCatalogLoad,
    currentUser = null,
}) => {
    const { t, i18n } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const { data: storefrontAgg } = useStorefrontAggregates();

    const activeLocationFilter =
        selectedCity.trim() && !/^all of india$/i.test(selectedCity.trim()) ? selectedCity.trim() : '';

    const publishedVehicles = useMemo(() => {
        const base = allVehicles.filter((v) => v && v.status === 'published');
        if (!activeLocationFilter) return base;
        return base.filter((v) => matchesLocation(v.city, v.state, activeLocationFilter));
    }, [allVehicles, activeLocationFilter]);
    const recentListingWindowMs = useMemo(() => {
        const raw =
            typeof import.meta !== 'undefined'
                ? (import.meta as any)?.env?.VITE_RECENT_LISTING_DAYS
                : undefined;
        const parsedDays = Number.parseInt(String(raw ?? ''), 10);
        const safeDays = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 7;
        return safeDays * 24 * 60 * 60 * 1000;
    }, []);

    const recentVehicles = useMemo(() => {
        const getTimestamp = (v: Vehicle) => {
            // "Recently added" should prioritize listing creation time.
            const raw = v.createdAt || v.featuredAt || v.updatedAt;
            const ts = raw ? Date.parse(raw) : NaN;
            return Number.isFinite(ts) ? ts : 0;
        };

        const sorted = [...publishedVehicles].sort((a, b) => {
            const aTime = getTimestamp(a);
            const bTime = getTimestamp(b);
            if (aTime !== bTime) return bTime - aTime;
            return (b.id || 0) - (a.id || 0);
        });

        return sorted.slice(0, 8);
    }, [publishedVehicles]);

    const citiesBase = useMemo(
        () =>
            HOME_DISCOVERY_CITY_ORDER.map((name) => ({
                name,
                ...getHomeDesktopCityStyle(name),
                total: 0,
            })),
        []
    );

    const citiesWithCounts = useMemo(() => {
        return citiesBase.map((city) => {
            const clientTotal = countCityVehicles(publishedVehicles, city.name);
            const apiCount = storefrontAgg?.cities[city.name];
            const total = clientTotal > 0 ? clientTotal : (apiCount !== undefined ? apiCount : 0);
            return { ...city, total };
        });
    }, [citiesBase, publishedVehicles, storefrontAgg?.cities]);

    const sortedCities = [...citiesWithCounts].sort((a, b) => b.total - a.total);
    const topCities = sortedCities.filter((city) => city.total > 0).slice(0, 6);

    const handleCityCardClick = useCallback(
        (city: { name: string; total: number }) => {
            if (city.total > 0) {
                onSelectCity(city.name);
                return;
            }
            addToast?.(
                t('mobile.home.cityNoListings', {
                    city: city.name,
                    defaultValue: `No cars in ${city.name} yet. Showing listings across India.`,
                }),
                'info',
            );
            onBrowseAllIndia?.();
        },
        [onSelectCity, onBrowseAllIndia, addToast, t],
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

    const categoriesWithCounts = useMemo(
        () =>
            HOME_DISCOVERY_CATEGORIES.map((category) => {
                const clientCount = categoryCounts[category.id] || 0;
                const apiCount = storefrontAgg?.categories[category.id];
                const vehicles = apiCount !== undefined ? apiCount : clientCount;
                return {
                    name: category.name,
                    id: category.id,
                    count: vehicles,
                };
            }),
        [categoryCounts, storefrontAgg?.categories]
    );

    const featuredListRef = useRef<HTMLDivElement>(null);

    // Hero: cursor-follow radial glow (very subtle, disabled on touch)
    const heroRef = useRef<HTMLDivElement>(null);
    const [heroGlow, setHeroGlow] = useState<{ x: number; y: number } | null>(null);
    const onHeroMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const node = heroRef.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        setHeroGlow({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }, []);
    const onHeroMouseLeave = useCallback(() => setHeroGlow(null), []);

    // Sticky compact search bar — appears once user scrolls past the hero.
    const [showStickySearch, setShowStickySearch] = useState(false);
    useEffect(() => {
        const onScroll = () => {
            // Show after ~600px so it appears once the hero is mostly off-screen.
            setShowStickySearch(window.scrollY > 620);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Refs that drive scroll-reveal animations on each major section.
    const featuredHeadRef = useRevealOnScroll<HTMLDivElement>(0);
    const featuredGridRef = useRevealOnScroll<HTMLDivElement>(120);
    const recentHeadRef = useRevealOnScroll<HTMLDivElement>(0);
    const recentGridRef = useRevealOnScroll<HTMLDivElement>(120);
    const citiesHeadRef = useRevealOnScroll<HTMLDivElement>(0);
    const citiesGridRef = useRevealOnScroll<HTMLDivElement>(100);
    const testimonialsRef = useRevealOnScroll<HTMLDivElement>(0);
    const categoriesRef = useRevealOnScroll<HTMLDivElement>(0);
    const sellRef = useRevealOnScroll<HTMLDivElement>(0);

    const handleSearch = useCallback(() => {
        const q = searchQuery.trim();
        if (!q) return;
        // Prefer deep-link so `?q=...` ends up in the URL and the text-match
        // fallback in VehicleList is seeded correctly on reload / share.
        if (onApplyFilters) {
            onApplyFilters({ query: q });
        } else {
            onSearch(q);
            onNavigate(ViewEnum.USED_CARS);
        }
    }, [searchQuery, onApplyFilters, onSearch, onNavigate]);

    // --- Voice search (Web Speech API) ---------------------------------------
    // Progressive enhancement: only renders the mic button when the browser
    // supports SpeechRecognition. Speech result applies the same deep-link
    // path as the text search.
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const supportsVoiceSearch = useMemo(() => {
        if (typeof window === 'undefined') return false;
        const w = window as unknown as {
            SpeechRecognition?: unknown;
            webkitSpeechRecognition?: unknown;
        };
        return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
    }, []);

    const handleVoiceSearch = useCallback(() => {
        if (!supportsVoiceSearch) return;
        if (isListening && recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch { /* ignore */ }
            return;
        }
        const w = window as unknown as {
            SpeechRecognition?: new () => any;
            webkitSpeechRecognition?: new () => any;
        };
        const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
        if (!Ctor) return;
        const recognition = new Ctor();
        recognition.lang = i18n.language === 'hi' ? 'hi-IN'
            : i18n.language === 'te' ? 'te-IN'
            : i18n.language === 'ta' ? 'ta-IN'
            : 'en-IN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);
        recognition.onresult = (event: any) => {
            const transcript = event?.results?.[0]?.[0]?.transcript?.trim?.() || '';
            if (!transcript) return;
            setSearchQuery(transcript);
            if (onApplyFilters) {
                onApplyFilters({ query: transcript });
            } else {
                onSearch(transcript);
                onNavigate(ViewEnum.USED_CARS);
            }
        };
        recognitionRef.current = recognition;
        try { recognition.start(); } catch { setIsListening(false); }
    }, [supportsVoiceSearch, isListening, i18n.language, onApplyFilters, onSearch, onNavigate]);

    // --- Continue browsing (anonymous-friendly) ------------------------------
    const [recentIds, setRecentIds] = useState<number[]>(() => getLocalRecentIds());
    useEffect(() => {
        const refresh = () => setRecentIds(getLocalRecentIds());
        window.addEventListener(RECENTLY_VIEWED_CHANGED_EVENT, refresh);
        window.addEventListener('storage', refresh);
        return () => {
            window.removeEventListener(RECENTLY_VIEWED_CHANGED_EVENT, refresh);
            window.removeEventListener('storage', refresh);
        };
    }, []);

    const continueBrowsingVehicles = useMemo(() => {
        if (!recentIds.length) return [] as Vehicle[];
        const byId = new Map(publishedVehicles.map((v) => [v.id, v]));
        return recentIds
            .map((id) => byId.get(id))
            .filter((v): v is Vehicle => Boolean(v))
            .slice(0, 8);
    }, [recentIds, publishedVehicles]);

    // --- Budget chips --------------------------------------------------------
    // Structured price filters rather than natural-language queries so they
    // apply deterministically via URL params.
    const budgetChips = useMemo<
        Array<{ label: string; filters: Record<string, string | number> }>
    >(
        () => [
            { label: t('mobile.home.budget.under3'), filters: { maxPrice: 300000 } as Record<string, string | number> },
            { label: t('mobile.home.budget.3to5'), filters: { minPrice: 300000, maxPrice: 500000 } as Record<string, string | number> },
            { label: t('mobile.home.budget.5to8'), filters: { minPrice: 500000, maxPrice: 800000 } as Record<string, string | number> },
            { label: t('mobile.home.budget.8to15'), filters: { minPrice: 800000, maxPrice: 1500000 } as Record<string, string | number> },
            { label: t('mobile.home.budget.above15'), filters: { minPrice: 1500000 } as Record<string, string | number> },
        ],
        [t, i18n.language]
    );

    // --- Popular makes / models (data-driven) --------------------------------
    // Ranked by live listing count against `allVehicles`, so new catalog
    // entries surface automatically in production without any code change.
    // We fall back to a conservative static list only while vehicles are
    // still loading to avoid a blank chip row.
    const popularMakes = useMemo(() => getPopularMakes(allVehicles, 9), [allVehicles]);
    const POPULAR_MAKES_FALLBACK = ['Maruti Suzuki', 'Hyundai', 'Honda', 'Tata', 'Mahindra', 'Toyota', 'Kia'];
    const popularMakeLabels = popularMakes.length > 0
        ? popularMakes.map((m) => m.name)
        : POPULAR_MAKES_FALLBACK;

    const scrollFeatured = (direction: 'left' | 'right') => {
        const container = featuredListRef.current;
        if (!container) return;
        const delta = container.clientWidth * 0.8 * (direction === 'left' ? -1 : 1);
        container.scrollBy({ left: delta, behavior: 'smooth' });
    };

    const handleStartService = (serviceId: string) => {
        sessionStorage.setItem('service_cart_prefill', JSON.stringify({ serviceId }));
        onNavigate(ViewEnum.SERVICE_CART);
    };

    // Rough EMI estimate: 5-year loan at ~10% APR, 20% down payment.
    // Display-only — this is intentionally a directional figure, not a real quote.
    const estimateEmi = (price: number) => {
        const principal = price * 0.8;
        const monthlyRate = 0.10 / 12;
        const months = 60;
        const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
        return Math.round(emi / 100) * 100;
    };

    const showSkeletons =
        isCatalogLoading &&
        featuredVehicles.length === 0 &&
        recommendations.length === 0 &&
        recentVehicles.length === 0;

    const testimonialItems = useMemo(
        () => [
            {
                name: t('home.testimonials.amitName'),
                quote: t('home.testimonials.amitQuote'),
                tag: t('home.testimonials.amitTag'),
            },
            {
                name: t('home.testimonials.riyaName'),
                quote: t('home.testimonials.riyaQuote'),
                tag: t('home.testimonials.riyaTag'),
            },
            {
                name: t('home.testimonials.karanName'),
                quote: t('home.testimonials.karanQuote'),
                tag: t('home.testimonials.karanTag'),
            },
        ],
        [t, i18n.language]
    );

    const sellSteps = useMemo(
        () => [
            {
                title: t('home.sell.step1Title'),
                desc: t('home.sell.step1Desc'),
                cta: t('home.sell.step1Cta'),
                n: '01',
            },
            {
                title: t('home.sell.step2Title'),
                desc: t('home.sell.step2Desc'),
                cta: t('home.sell.step2Cta'),
                n: '02',
            },
            {
                title: t('home.sell.step3Title'),
                desc: t('home.sell.step3Desc'),
                cta: t('home.sell.step3Cta'),
                n: '03',
            },
        ],
        [t, i18n.language]
    );

    const skeletonCard = (key: string) => (
        <div
            key={key}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse"
        >
            <div className="h-48 bg-gray-100" />
            <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
        </div>
    );

    return (
        <div className={`min-h-screen w-full ${HOME_SECTION_BG.page}`}>
            {/* Sticky compact search — appears once the hero scrolls off-screen */}
            {showStickySearch && (
                <div
                    className="fixed top-0 left-0 right-0 z-40 bg-white/85 backdrop-blur-lg border-b border-gray-200/80 shadow-sm animate-sticky-slide-down"
                    role="search"
                >
                    <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 font-semibold text-gray-900 text-sm tracking-tight">
                            <span className="inline-block w-6 h-6 rounded-md bg-gradient-to-br from-reride-orange to-orange-400"></span>
                            ReRide
                        </div>
                        <div className="flex-1 flex items-center gap-2 bg-gray-50 hover:bg-white border border-gray-200 hover:border-orange-300 rounded-full px-4 py-2 transition-colors focus-within:border-reride-orange focus-within:bg-white">
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                id="search-bar"
                                type="search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder={t('search.placeholderHero')}
                                aria-label={t('common.search')}
                                className="flex-1 bg-transparent outline-none text-[14px] text-gray-800 placeholder-gray-400"
                                style={{ fontFamily: "'Poppins', sans-serif" }}
                            />
                            {supportsVoiceSearch && (
                                <button
                                    type="button"
                                    onClick={handleVoiceSearch}
                                    aria-label={isListening ? t('a11y.voiceListening') : t('a11y.voiceSearch')}
                                    aria-pressed={isListening}
                                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                                        isListening
                                            ? 'bg-red-50 text-red-500 ring-2 ring-red-400/50 animate-pulse'
                                            : 'text-gray-400 hover:text-reride-orange hover:bg-orange-50'
                                    }`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m7 7v3m-4 0h8m-4-7a3 3 0 01-3-3V6a3 3 0 016 0v5a3 3 0 01-3 3z" />
                                    </svg>
                                </button>
                            )}
                        </div>
                        <button
                            onClick={handleSearch}
                            className="text-white px-4 sm:px-5 py-2 rounded-full font-semibold text-sm transition-all duration-200 hover:opacity-90 flex-shrink-0"
                            style={{
                                background: 'linear-gradient(135deg, #FF6B35 0%, #F97316 50%, #FB923C 100%)',
                                boxShadow: '0 8px 20px -6px rgba(255, 107, 53, 0.55), inset 0 1px 0 rgba(255,255,255,0.25)',
                                fontFamily: "'Poppins', sans-serif"
                            }}
                        >
                            {t('common.search')}
                        </button>
                    </div>
                </div>
            )}

            {/* Hero Section with Search */}
            <div 
                ref={heroRef}
                onMouseMove={onHeroMouseMove}
                onMouseLeave={onHeroMouseLeave}
                className="relative pt-0 pb-16 md:pt-4 md:pb-24 px-4 overflow-hidden bg-[#0B1020]"
                style={{
                    background: HOME_HERO_SURFACE,
                    fontFamily: "'Poppins', sans-serif"
                }}
            >
                {/* Background Pattern + Glows + Cursor-follow Spotlight */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div
                        className="home-hero-grid absolute inset-0 opacity-[0.07]"
                        style={{
                            backgroundImage:
                                'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
                            backgroundSize: '56px 56px',
                            maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
                            WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)'
                        }}
                    ></div>
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                        <span
                            key={i}
                            aria-hidden="true"
                            className="home-particle"
                            style={{
                                left: `${8 + i * 11}%`,
                                top: `${12 + (i % 4) * 18}%`,
                                ['--particle-dur' as string]: `${6 + (i % 3) * 1.5}s`,
                                ['--particle-delay' as string]: `${i * 0.65}s`,
                            }}
                        />
                    ))}
                    <div
                        className="absolute -top-32 -right-24 w-[30rem] h-[30rem] rounded-full blur-3xl opacity-40 animate-orb-a"
                        style={{ background: 'radial-gradient(circle, #FF6B35 0%, transparent 70%)' }}
                    ></div>
                    <div
                        className="absolute -bottom-40 -left-24 w-[32rem] h-[32rem] rounded-full blur-3xl opacity-25 animate-orb-b"
                        style={{ background: 'radial-gradient(circle, #FF6B35 0%, transparent 70%)' }}
                    ></div>
                    {/* Cursor-follow spotlight (only when mouse is over hero) */}
                    <div
                        className="absolute pointer-events-none transition-opacity duration-500"
                        style={{
                            opacity: heroGlow ? 0.55 : 0,
                            left: (heroGlow?.x ?? 0) - 250,
                            top: (heroGlow?.y ?? 0) - 250,
                            width: 500,
                            height: 500,
                            background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 65%)',
                        }}
                    ></div>
                </div>

                <div className="relative max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-12 items-center">
                <div className="text-center lg:text-left">
                    {/* Trust Badge */}
                    <div 
                        className="home-trust-badge hero-rise hero-rise-1 inline-flex items-center gap-2 px-5 py-2 rounded-full mb-4 shadow-lg"
                        style={{
                            background: 'rgba(255, 107, 53, 0.18)',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)'
                        }}
                    >
                        <div 
                            className="w-3 h-3 rounded-full flex items-center justify-center flex-shrink-0 sparkle-pulse"
                            style={{ background: '#6DD278' }}
                        >
                            <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                        </div>
                        <span 
                            className="text-white font-medium tracking-wide"
                            style={{ fontSize: '13px', fontFamily: "'Poppins', sans-serif" }}
                        >
                            {t('home.trustBadgeVerified')}
                        </span>
                    </div>

                    {/* Main Heading — animated gradient text */}
                    <h1 
                        className="hero-rise hero-rise-2 hero-gradient-text mb-5 leading-[1.1]"
                        style={{
                            fontSize: 'clamp(32px, 4.8vw, 56px)',
                            fontWeight: 700,
                            fontFamily: "'Poppins', sans-serif",
                            letterSpacing: '-0.025em'
                        }}
                    >
                        {t('home.premiumUsedCars')}
                    </h1>
                    
                    {/* Subheading */}
                    <p 
                        className="hero-rise hero-rise-3 mb-8 max-w-2xl mx-auto lg:mx-0"
                        style={{
                            fontSize: 'clamp(14px, 1.45vw, 16px)',
                            fontWeight: 400,
                            fontFamily: "'Poppins', sans-serif",
                            color: 'rgba(255, 255, 255, 0.88)',
                            lineHeight: '1.65'
                        }}
                    >
                        {t('home.marketingSubhead')}
                    </p>

                    <div className="hero-rise hero-rise-3 mb-8 lg:hidden">
                        <DealRoomHeroPreview compact />
                    </div>

                    {/* Search Bar */}
                    <div 
                        className="home-search-glow hero-rise hero-rise-4 flex flex-col md:flex-row items-stretch md:items-center bg-white mb-6 max-w-3xl mx-auto lg:mx-0 overflow-hidden"
                        style={{
                            borderRadius: '20px',
                        }}
                    >
                        <div className="flex-1 flex items-center gap-3 px-6 py-4 md:py-5">
                            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                id="search-bar"
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder={t('search.placeholderHero')}
                                className="flex-1 outline-none text-gray-800 placeholder-gray-400"
                                style={{
                                    fontSize: '15px',
                                    fontWeight: 400,
                                    fontFamily: "'Poppins', sans-serif"
                                }}
                            />
                            {supportsVoiceSearch && (
                                <button
                                    type="button"
                                    onClick={handleVoiceSearch}
                                    aria-label={isListening ? t('a11y.voiceListening') : t('a11y.voiceSearch')}
                                    aria-pressed={isListening}
                                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                                        isListening
                                            ? 'bg-red-50 text-red-500 ring-2 ring-red-400/50 animate-pulse'
                                            : 'text-gray-400 hover:text-reride-orange hover:bg-orange-50'
                                    }`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m7 7v3m-4 0h8m-4-7a3 3 0 01-3-3V6a3 3 0 016 0v5a3 3 0 01-3 3z" />
                                    </svg>
                                </button>
                            )}
                        </div>
                        <button
                            onClick={handleSearch}
                            className="hero-cta-glow text-white px-8 py-4 md:py-5 font-semibold flex items-center justify-center gap-2 transition-all duration-300 hover:opacity-95"
                            style={{
                                background: 'linear-gradient(135deg, #FF6B35 0%, #F97316 50%, #FB923C 100%)',
                                boxShadow: '0 10px 24px -6px rgba(255, 107, 53, 0.55), inset 0 1px 0 rgba(255,255,255,0.25)',
                                borderRadius: '20px',
                                fontSize: '15px',
                                fontWeight: 600,
                                letterSpacing: '0.01em',
                                fontFamily: "'Poppins', sans-serif"
                            }}
                        >
                            {t('common.search')}
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    {onBrowseAllIndia ? (
                        <PopularCitiesChips
                            className="hero-rise hero-rise-4 max-w-3xl mx-auto mb-5 text-left px-1"
                            variant="light"
                            cities={citiesWithCounts.map((c) => ({ name: c.name, count: c.total }))}
                            selectedCity={selectedCity}
                            onSelectCity={(name) => {
                                const city = citiesWithCounts.find((c) => c.name === name);
                                handleCityCardClick({ name, total: city?.total ?? 0 });
                            }}
                            onBrowseAllIndia={onBrowseAllIndia}
                        />
                    ) : null}

                    {/* Budget Chips — deep-link via structured min/maxPrice filters
                        so they work even when the AI proxy is unavailable. */}
                    <div className="hero-rise hero-rise-4 flex flex-wrap items-center justify-center gap-2 mb-5 max-w-3xl mx-auto">
                        <span className="text-[12px] font-medium text-white/70 mr-1">
                            {t('mobile.home.budget.heading')}
                        </span>
                        {budgetChips.map((chip) => (
                            <button
                                key={chip.label}
                                onClick={() => {
                                    if (onApplyFilters) {
                                        onApplyFilters({ filters: chip.filters });
                                    } else {
                                        onSearch(chip.label);
                                        onNavigate(ViewEnum.USED_CARS);
                                    }
                                }}
                                className="px-3.5 py-1.5 rounded-full text-[12px] font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/25 hover:border-white/50 backdrop-blur-sm transition-all"
                            >
                                {chip.label}
                            </button>
                        ))}
                    </div>

                    {/* Popular Brand Chips — data-driven. Ranked by live listing
                        count so new makes added in production surface here
                        automatically. Falls back to a small static list only
                        while inventory is still loading. */}
                    <div className="hero-rise hero-rise-5 flex flex-wrap items-center justify-center gap-2 mb-5">
                        <span className="text-[12px] font-medium text-white/70 mr-1">Popular:</span>
                        {popularMakeLabels.map((brand) => (
                            <button
                                key={brand}
                                onClick={() => {
                                    if (onApplyFilters) {
                                        onApplyFilters({ filters: { make: brand } });
                                    } else {
                                        setSearchQuery(brand);
                                        onSearch(brand);
                                        onNavigate(ViewEnum.USED_CARS);
                                    }
                                }}
                                className="px-3 py-1 rounded-full text-[12px] font-medium text-white/90 border border-white/20 hover:border-white/50 hover:bg-white/10 backdrop-blur-sm transition-all"
                            >
                                {brand}
                            </button>
                        ))}
                    </div>

                    </div>
                    <div className="hidden lg:block hero-rise hero-rise-6 w-full max-w-md lg:max-w-none mx-auto" aria-hidden="true">
                        <DealRoomHeroPreview />
                    </div>
                </div>
            </div>

            {currentUser?.role === 'customer' ? (
                <div className="max-w-7xl mx-auto px-4 pt-6">
                    <ActiveDealsHomeBanner onNavigate={onNavigate} />
                </div>
            ) : null}

            {/* Continue browsing — only rendered when we actually have recent
                vehicles to show. Backed by localStorage so it works for
                logged-out visitors too. */}
            {continueBrowsingVehicles.length > 0 && (
                <div className={HOME_SECTION_BG.continue}>
                    <div className="max-w-7xl mx-auto px-4 py-8 md:py-10">
                        <div className="flex items-end justify-between mb-5">
                            <div>
                                <h2
                                    className="text-gray-900"
                                    style={{
                                        fontSize: '20px',
                                        fontWeight: 700,
                                        fontFamily: "'Poppins', sans-serif",
                                        letterSpacing: '-0.01em',
                                    }}
                                >
                                    {t('mobile.home.continue.title')}
                                </h2>
                                <p className="text-[13px] text-gray-500 mt-0.5">
                                    {t('mobile.home.continue.subtitle')}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
                            {continueBrowsingVehicles.map((vehicle) => {
                                const image = getFirstValidImage(vehicle.images, vehicle.id);
                                const optimized = image && !image.startsWith('data:')
                                    ? optimizeImageUrl(image, 400, 75)
                                    : image;
                                return (
                                    <button
                                        key={vehicle.id}
                                        onClick={() => onSelectVehicle(vehicle)}
                                        className={`group flex-shrink-0 w-[220px] md:w-[240px] ${HOME_LISTING_CARD} shine-on-hover rounded-2xl overflow-hidden text-left`}
                                    >
                                        <div className="relative h-[130px] bg-gray-100">
                                            {optimized ? (
                                                <LazyImage
                                                    src={optimized}
                                                    alt={`${vehicle.make} ${vehicle.model}`}
                                                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                                                />
                                            ) : null}
                                        </div>
                                        <div className="p-3">
                                            <div
                                                className="text-gray-900 truncate"
                                                style={{ fontSize: '13px', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}
                                            >
                                                {vehicle.make} {vehicle.model}
                                            </div>
                                            <div className="text-[12px] text-gray-500 truncate mt-0.5">
                                                {vehicle.year} · {vehicle.city}
                                            </div>
                                            <div className="text-[13px] font-bold text-orange-700 mt-1">
                                                {formatIndianPrice(vehicle.price)}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Featured Collection Section */}
            {featuredVehicles.length > 0 ? (
                <div className={`py-16 md:py-20 px-4 ${HOME_SECTION_BG.featured}`}>
                    <div className="max-w-7xl mx-auto">
                        <div ref={featuredHeadRef} className="reveal-on-scroll flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10 md:mb-12">
                            <div className="space-y-3 text-center md:text-left">
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-orange-700">
                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    {t('home.featured.badge')}
                                </span>
                                <h2 className="home-section-heading text-3xl md:text-4xl font-bold text-gray-900 tracking-tight leading-tight">{t('home.featured.title')}</h2>
                                <p className="text-gray-600 text-base max-w-xl leading-relaxed">{t('home.featured.subtitle')}</p>
                            </div>
                            <button
                                onClick={() => onNavigate(ViewEnum.USED_CARS)}
                                className="self-center md:self-end inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-gray-300 text-gray-800 font-medium text-sm hover:border-orange-600 hover:text-orange-700 transition-colors"
                            >
                                {t('home.featured.viewAllVehicles')}
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>

                        <div ref={featuredGridRef} className="reveal-on-scroll reveal-blur relative">
                            {featuredVehicles.length > 1 && (
                                <>
                                    <button
                                        onClick={() => scrollFeatured('left')}
                                        className="hidden md:flex absolute -left-5 top-1/2 -translate-y-1/2 z-10 h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg border border-gray-200 hover:-translate-x-1 hover:shadow-xl transition-all"
                                        aria-label={t('a11y.scrollLeft')}
                                    >
                                        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => scrollFeatured('right')}
                                        className="hidden md:flex absolute -right-5 top-1/2 -translate-y-1/2 z-10 h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg border border-gray-200 hover:translate-x-1 hover:shadow-xl transition-all"
                                        aria-label={t('a11y.scrollRight')}
                                    >
                                        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                </>
                            )}

                            <div 
                                ref={featuredListRef}
                                className="flex gap-5 md:gap-6 overflow-x-auto pb-2 snap-x snap-mandatory"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            >
                                {featuredVehicles.map((vehicle, index) => (
                                    <div
                                        key={vehicle.id}
                                        onClick={() => onSelectVehicle(vehicle)}
                                        className={`${HOME_LISTING_CARD} shine-on-hover rounded-2xl overflow-hidden cursor-pointer flex-shrink-0 snap-start min-w-[260px] md:min-w-[300px] lg:min-w-[320px]`}
                                    >
                                        <div className="relative h-56 overflow-hidden">
                                            <LazyImage
                                                src={getFirstValidImage(vehicle.images, vehicle.id)}
                                                alt={`${vehicle.make} ${vehicle.model}`}
                                                className="w-full h-full object-cover"
                                                width={400}
                                                quality={85}
                                                eager={index === 0}
                                                fetchPriority={index === 0 ? 'high' : 'auto'}
                                            />
                                            <div className="absolute top-3 left-3 bg-green-600 text-white px-2.5 py-1 rounded-md flex items-center gap-1 text-[11px] font-semibold tracking-wide shadow-sm">
                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                                </svg>
                                                {t('common.verified')}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onToggleWishlist(vehicle.id);
                                                }}
                                                aria-label={
                                                    wishlist.includes(vehicle.id)
                                                        ? t('vehicle.card.wishlistRemove')
                                                        : t('vehicle.card.wishlistAdd')
                                                }
                                                className="absolute top-3 right-3 w-9 h-9 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm"
                                            >
                                                <svg 
                                                    className={`w-5 h-5 transition-all ${wishlist.includes(vehicle.id) ? 'fill-red-500 text-red-500' : 'text-gray-600'}`}
                                                    fill={wishlist.includes(vehicle.id) ? 'currentColor' : 'none'}
                                                    stroke="currentColor" 
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                                </svg>
                                            </button>
                                            <div className="absolute bottom-3 right-3 bg-gray-900/95 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg shadow-sm">
                                                <span className="font-bold text-sm tracking-tight">₹{(vehicle.price / 100000).toFixed(2)}L</span>
                                            </div>
                                        </div>
                                        <div className="p-5">
                                            <h3 className="font-semibold text-gray-900 mb-1 text-[17px] leading-snug tracking-tight">
                                                {vehicle.year} {vehicle.make} {vehicle.model}
                                            </h3>
                                            <div className="text-[12px] text-gray-500 mb-3">
                                                EMI from <span className="font-semibold text-gray-700">₹{estimateEmi(vehicle.price).toLocaleString('en-IN')}/mo</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[13px] text-gray-500 mb-3">
                                                <span className="flex items-center gap-1">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    {vehicle.mileage.toLocaleString()} km
                                                </span>
                                                <span className="text-gray-300">•</span>
                                                <span>{vehicle.fuelType}</span>
                                                <span className="text-gray-300">•</span>
                                                <span>{vehicle.transmission || t('common.manual')}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-gray-700 pt-3 border-t border-gray-100">
                                                <svg className="w-3.5 h-3.5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                <span className="text-[13px] font-medium">{vehicle.city || t('common.notAvailable')}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : showSkeletons ? (
                <div className={`py-16 md:py-20 px-4 ${HOME_SECTION_BG.featured}`}>
                    <div className="max-w-7xl mx-auto space-y-4">
                        <div className="h-4 bg-gray-100 rounded w-40 animate-pulse" />
                        <div className="h-6 bg-gray-100 rounded w-64 animate-pulse mb-6" />
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {Array.from({ length: 4 }).map((_, idx) => skeletonCard(`featured-${idx}`))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className={`py-16 md:py-20 px-4 ${HOME_SECTION_BG.featured}`}>
                    <div className="max-w-3xl mx-auto">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-reride-orange to-orange-400 rounded-2xl mb-5 shadow-md">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </div>
                            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">{t('home.featured.emptyTitle')}</h2>
                            <p className="text-gray-600 text-base md:text-lg max-w-xl mx-auto leading-relaxed mb-8">
                                {t('home.featured.emptyBody')}
                            </p>
                            <button 
                                onClick={() => onNavigate(ViewEnum.USED_CARS)}
                                className="btn-brand-primary px-7 py-3.5 rounded-full font-semibold text-base inline-flex items-center gap-2 shadow-md hover:shadow-lg"
                            >
                                {t('home.featured.browseAll')}
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Recently Added Section */}
            {recentVehicles.length > 0 ? (
                <div className={`py-16 md:py-20 px-4 ${HOME_SECTION_BG.recent}`}>
                    <div className="max-w-7xl mx-auto">
                        <div ref={recentHeadRef} className="reveal-on-scroll flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10 md:mb-12">
                            <div className="space-y-3 text-center md:text-left">
                                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-orange-700">
                                    <span className="h-px w-6 bg-orange-300"></span>
                                    Just Listed
                                </span>
                                <h2 className="home-section-heading text-3xl md:text-4xl font-bold text-gray-900 tracking-tight leading-tight">{t('home.recent.title')}</h2>
                                <p className="text-gray-600 text-base max-w-xl leading-relaxed">{t('home.recent.subtitle')}</p>
                            </div>
                            <button 
                                onClick={() => onNavigate(ViewEnum.USED_CARS)}
                                className="self-center md:self-end inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-gray-300 text-gray-800 font-medium text-sm hover:border-orange-600 hover:text-orange-700 transition-colors"
                            >
                                {t('home.recent.viewAll')}
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>

                        <div ref={recentGridRef} className="reveal-on-scroll reveal-blur home-stagger-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
                            {recentVehicles.map((vehicle, index) => {
                                const listingTimestamp = Date.parse(vehicle.createdAt || vehicle.featuredAt || vehicle.updatedAt || '');
                                const isNewlyListed =
                                    Number.isFinite(listingTimestamp) &&
                                    Date.now() - listingTimestamp <= recentListingWindowMs;

                                return (
                                <div
                                    key={vehicle.id}
                                    onClick={() => onSelectVehicle(vehicle)}
                                    className={`${HOME_LISTING_CARD} shine-on-hover rounded-2xl overflow-hidden cursor-pointer`}
                                >
                                    <div className="relative h-48 overflow-hidden">
                                        <LazyImage
                                            src={getFirstValidImage(vehicle.images, vehicle.id)}
                                            alt={`${vehicle.make} ${vehicle.model}`}
                                            className="w-full h-full object-cover"
                                            width={380}
                                            quality={85}
                                            eager={index === 0}
                                        />
                                        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
                                            {isNewlyListed && (
                                                <span className="bg-orange-500 text-white px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide shadow-sm">
                                                    {t('common.newBadge')}
                                                </span>
                                            )}
                                            {showVerifiedListingBadge(vehicle) && (
                                                <span className="bg-green-600 text-white px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide shadow-sm">
                                                    {t('common.verified')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="absolute bottom-3 right-3 bg-gray-900/95 text-white px-3 py-1.5 rounded-lg shadow-sm">
                                            <span className="font-bold text-sm tracking-tight">₹{(vehicle.price / 100000).toFixed(2)}L</span>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-semibold text-gray-900 text-[16px] leading-snug tracking-tight">
                                                {vehicle.year} {vehicle.make} {vehicle.model}
                                            </h3>
                                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 font-medium flex-shrink-0">
                                                {vehicle.fuelType}
                                            </span>
                                        </div>
                                        <div className="text-[12px] text-gray-500 mt-1">
                                            EMI from <span className="font-semibold text-gray-700">₹{estimateEmi(vehicle.price).toLocaleString('en-IN')}/mo</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[13px] text-gray-500 mt-2">
                                            <span>{vehicle.mileage.toLocaleString()} km</span>
                                            <span className="text-gray-300">•</span>
                                            <span>{vehicle.transmission || t('common.manual')}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-gray-700 mt-3 pt-3 border-t border-gray-100">
                                            <svg className="w-3.5 h-3.5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            <span className="text-[13px] font-medium">{vehicle.city || t('common.notAvailable')}</span>
                                        </div>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ) : showSkeletons ? (
                <div className={`py-16 md:py-20 px-4 ${HOME_SECTION_BG.recent}`}>
                    <div className="max-w-7xl mx-auto">
                        <div className="h-6 bg-gray-100 rounded w-52 mb-3 animate-pulse" />
                        <div className="h-4 bg-gray-100 rounded w-80 mb-10 animate-pulse" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
                            {Array.from({ length: 4 }).map((_, idx) => skeletonCard(`recent-${idx}`))}
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Explore by Location Section — postcard-style cards (matches mobile design) */}
            <div className={`py-16 md:py-20 px-4 ${HOME_SECTION_BG.cities}`}>
                <div className="max-w-7xl mx-auto">
                    <div ref={citiesHeadRef} className="reveal-on-scroll flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 md:mb-10">
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 text-orange-600 text-[11px] font-bold uppercase tracking-[0.14em]">
                                <span className="h-px w-5 bg-orange-300" />
                                {t('mobile.home.exploreLocation')}
                            </div>
                            <h2 className="home-section-heading text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
                              {t('home.popularCities.label', { defaultValue: 'Popular cities' })}
                            </h2>
                            <p className="text-gray-500 text-[15px] leading-snug">{t('home.cities.subtitle')}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => onNavigate(ViewEnum.USED_CARS)}
                            className="self-start md:self-end inline-flex items-center gap-1 text-orange-500 font-semibold text-sm px-3 py-2 rounded-lg hover:bg-orange-50 transition-all"
                        >
                            {t('home.recent.viewAll')}
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    <div ref={citiesGridRef} className="reveal-on-scroll reveal-blur">
                        <HomeCityGrid
                            cities={topCities}
                            onSelectCity={handleCityCardClick}
                            variant="desktop"
                        />
                    </div>
                </div>
            </div>

            {/* Deal journey */}
            <div ref={testimonialsRef} className={`reveal-on-scroll py-16 md:py-20 px-4 ${HOME_SECTION_BG.testimonials}`}>
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-10 md:mb-12 space-y-3">
                        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-orange-700">
                            <span className="h-px w-6 bg-orange-300" />
                            {t('home.dealJourney.badge')}
                            <span className="h-px w-6 bg-orange-300" />
                        </span>
                        <h2 className="home-section-heading text-3xl md:text-4xl font-bold text-gray-900 tracking-tight leading-tight">{t('home.testimonials.title')}</h2>
                        <p className="text-gray-600 text-base max-w-xl mx-auto leading-relaxed">{t('home.testimonials.subtitle')}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
                        {testimonialItems.map((item, idx) => (
                            <div key={idx} className="home-listing-card rounded-xl p-6 transition-all duration-200 border border-gray-100">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="h-10 w-10 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-sm">
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900 text-sm tracking-tight">{item.name}</div>
                                        <div className="text-[12px] text-orange-700 font-medium">{item.tag}</div>
                                    </div>
                                </div>
                                <p className="text-gray-700 text-[15px] leading-relaxed">{item.quote}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Browse by Category — tile cards with illustrated icon plates (matches mobile design) */}
            <div ref={categoriesRef} className={`reveal-on-scroll py-16 md:py-20 px-4 ${HOME_SECTION_BG.categories}`}>
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 md:mb-10">
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 text-orange-600 text-[11px] font-bold uppercase tracking-wider">
                                <span className="h-px w-5 bg-orange-300" />
                                Browse
                            </div>
                            <h2 className="home-section-heading text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
                                {t('home.categories.title')}
                            </h2>
                            <p className="text-gray-500 text-[15px] leading-snug">{t('mobile.home.quickTaps')}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => onNavigate(ViewEnum.USED_CARS)}
                            className="self-start md:self-end inline-flex items-center gap-1 text-orange-500 font-semibold text-sm px-3 py-2 rounded-lg hover:bg-orange-50 transition-all"
                        >
                            {t('home.recent.viewAll')}
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    <HomeCategoryTiles
                        categories={categoriesWithCounts}
                        onSelectCategory={onSelectCategory}
                        variant="desktop"
                    />
                </div>
            </div>

            {/* Sell Car Steps Section */}
            <div ref={sellRef} className={`reveal-on-scroll py-16 md:py-20 px-4 ${HOME_SECTION_BG.sell}`}>
                <div className="max-w-6xl mx-auto text-center">
                    <h2 className="home-section-heading text-3xl md:text-4xl font-bold text-gray-900 mb-12 md:mb-16 tracking-tight leading-tight">{t('home.sell.title')}</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12 mb-12">
                        {sellSteps.map((item, idx) => (
                            <div key={idx} className="flex flex-col items-center text-center gap-4">
                                <div className="relative">
                                    <div className="h-32 w-32 rounded-full bg-orange-100/80 blur-3xl absolute inset-0" />
                                    <div className="relative h-32 w-32 rounded-full bg-gradient-to-br from-white to-gray-50 border border-gray-200/80 shadow-sm flex items-center justify-center">
                                        <span className="text-3xl font-bold text-orange-600 tabular-nums">{item.n}</span>
                                    </div>
                                </div>
                                <div className="space-y-2 max-w-xs">
                                    <h3 className="text-lg font-semibold text-gray-900 tracking-tight">{item.title}</h3>
                                    <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                                </div>
                                <button
                                    onClick={() => onNavigate(idx === 1 ? ViewEnum.SELLER_DASHBOARD : ViewEnum.SELL_CAR)}
                                    className="inline-flex items-center gap-1 text-orange-700 font-medium text-sm hover:gap-2 transition-all"
                                >
                                    {item.cta}
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <button
                            onClick={() => onNavigate(ViewEnum.SELL_CAR)}
                            className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-reride-orange text-white font-semibold text-sm shadow-md hover:bg-orange-600 hover:shadow-lg transition-all"
                        >
                            {t('home.sell.watchHow')}
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                        <button
                            onClick={() => onNavigate(ViewEnum.ABOUT_US)}
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-gray-300 text-gray-800 font-medium text-sm hover:border-orange-500 hover:text-orange-700 transition-colors"
                        >
                            {t('home.sell.learnMore')}
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Trending Now / Popular Dealers */}
            {featuredVehicles.length > 4 && (
                <div className={`py-16 md:py-20 px-4 ${HOME_SECTION_BG.trending}`}>
                    <div className="max-w-3xl mx-auto">
                        <div className="text-center space-y-4">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-orange-700">
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                </svg>
                                {t('home.trending.badge')}
                            </span>
                            <h2 className="home-section-heading text-3xl md:text-4xl font-bold text-gray-900 tracking-tight leading-tight">{t('home.trending.title')}</h2>
                            <p className="text-gray-600 text-base max-w-xl mx-auto leading-relaxed">{t('home.trending.subtitle')}</p>
                            <div className="pt-3">
                                <button 
                                    onClick={() => onNavigate(ViewEnum.USED_CARS)}
                                    className="bg-orange-500 hover:bg-orange-600 text-white px-7 py-3 rounded-full font-semibold text-sm inline-flex items-center gap-2 mx-auto transition-all duration-300 shadow-md hover:shadow-lg"
                                >
                                    {t('home.trending.viewAll')}
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* WHY: WhatsApp is the #1 support/conversion channel for Indian buyers;
                self-gating component renders only when a business number is configured. */}
            <FloatingWhatsApp />
        </div>
    );
};

export default Home;