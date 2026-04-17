import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { VehicleCategory, View as ViewEnum, type Vehicle, type View } from '../types';
import { getFirstValidImage, optimizeImageUrl } from '../utils/imageUtils';
import { matchesCity } from '../utils/cityMapping';
import LazyImage from './LazyImage';
import { useStorefrontAggregates } from '../hooks/useStorefrontAggregates';
import {
    HOME_DESKTOP_CITY_STYLE,
    HOME_DISCOVERY_CATEGORIES,
    HOME_DISCOVERY_CITY_ORDER,
    HOME_MOBILE_CITY_ACCENT,
    HOME_MOBILE_CITY_GRADIENT,
    type HomeDiscoveryCityName,
} from '../constants/homeDiscovery';
import CityMonument from './CityMonument';
import VehicleCategoryIcon from './VehicleCategoryIcon';
import { showVerifiedListingBadge } from '../utils/listingTrust';
import {
    getLocalRecentIds,
    RECENTLY_VIEWED_CHANGED_EVENT,
} from '../utils/recentlyViewed';
import { getPopularMakes } from '../utils/popularListings';

// Adds an `is-visible` class to the target element (which already has the
// `reveal-on-scroll` class) the first time it intersects the viewport.
// Optional delay staggers grids/lists for a natural cascade.
const useRevealOnScroll = <T extends HTMLElement>(delayMs: number = 0) => {
    const ref = useRef<T | null>(null);
    useEffect(() => {
        const node = ref.current;
        if (!node) return;
        if (typeof IntersectionObserver === 'undefined') {
            node.classList.add('is-visible');
            return;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const t = window.setTimeout(() => {
                            entry.target.classList.add('is-visible');
                        }, delayMs);
                        observer.unobserve(entry.target);
                        return () => window.clearTimeout(t);
                    }
                });
            },
            { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [delayMs]);
    return ref;
};

// Lightweight count-up that animates from 0 to `end` once `start` flips true.
// Uses requestAnimationFrame so it's smooth and stops cleanly on unmount.
const useCountUp = (end: number, start: boolean, duration: number = 1600) => {
    const [value, setValue] = useState(0);
    useEffect(() => {
        if (!start) return;
        let raf = 0;
        const t0 = performance.now();
        const tick = (now: number) => {
            const progress = Math.min(1, (now - t0) / duration);
            // easeOutCubic for a satisfying decelerate
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(end * eased);
            if (progress < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [end, start, duration]);
    return value;
};

interface AnimatedStatProps {
    value: number;
    suffix?: string;
    label: string;
    visible: boolean;
    formatter?: (n: number) => string;
}

const AnimatedStat: React.FC<AnimatedStatProps> = ({ value, suffix = '', label, visible, formatter }) => {
    const current = useCountUp(value, visible);
    const display = formatter ? formatter(current) : Math.round(current).toLocaleString('en-IN');
    return (
        <div className="flex flex-col items-center justify-center text-center px-2 pt-6 md:pt-0 first:pt-0">
            <div
                className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight tabular-nums"
                style={{ fontFamily: "'Poppins', sans-serif" }}
            >
                {display}{suffix}
            </div>
            <div className="text-[12px] md:text-[13px] text-gray-500 mt-1 tracking-wide">
                {label}
            </div>
        </div>
    );
};

interface HomeProps {
    onSearch: (query: string) => void;
    /**
     * Deep-link filter applier. Budget / brand chips and voice search use
     * this instead of `onSearch` so they don't depend on the Gemini
     * proxy — the filters are encoded in the URL and applied deterministically
     * by `VehicleList.initialFilters`.
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
    allVehicles = []
}) => {
    const { t, i18n } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const { data: storefrontAgg } = useStorefrontAggregates();

    // Preload the first featured vehicle image (LCP element) for better performance
    useEffect(() => {
        if (featuredVehicles.length > 0) {
            const firstVehicle = featuredVehicles[0];
            const firstImage = getFirstValidImage(firstVehicle.images, firstVehicle.id);
            if (firstImage && !firstImage.startsWith('data:')) {
                const optimizedImage = optimizeImageUrl(firstImage, 800, 85);
                // Check if preload link already exists to avoid duplicates
                const existingLink = document.querySelector(`link[rel="preload"][as="image"][href="${optimizedImage}"]`);
                if (!existingLink) {
                    const link = document.createElement('link');
                    link.rel = 'preload';
                    link.as = 'image';
                    link.href = optimizedImage;
                    link.setAttribute('fetchpriority', 'high');
                    document.head.appendChild(link);
                }
            }
        }
    }, [featuredVehicles]);

    const publishedVehicles = allVehicles.filter(v => v && v.status === 'published');

    const recentVehicles = useMemo(() => {
        const sorted = [...publishedVehicles].sort((a, b) => {
            const getDate = (v: Vehicle) => new Date(v.createdAt || v.updatedAt || v.featuredAt || 0).getTime();
            const aDate = getDate(a);
            const bDate = getDate(b);
            if (aDate !== bDate) return bDate - aDate;
            return (b.id || 0) - (a.id || 0);
        });
        return sorted.slice(0, 8);
    }, [publishedVehicles]);

    const citiesBase = useMemo(
        () =>
            HOME_DISCOVERY_CITY_ORDER.map((name) => ({
                name,
                ...HOME_DESKTOP_CITY_STYLE[name],
                cars: 0,
            })),
        []
    );

    const citiesWithCounts = useMemo(() => {
        return citiesBase.map((city) => {
            const clientCount = publishedVehicles.filter((vehicle) =>
                matchesCity(vehicle.city, city.name)
            ).length;
            const apiCount = storefrontAgg?.cities[city.name];
            const cars = apiCount !== undefined ? apiCount : clientCount;
            return { ...city, cars };
        });
    }, [citiesBase, publishedVehicles, storefrontAgg?.cities]);

    // Real trust metrics derived from actual published listings (no fabricated figures).
    // `verifiedListings` counts listings that qualify for the verified badge.
    // `averageRating` averages the `averageRating` field of all rated listings.
    const verifiedListingCount = useMemo(
        () => publishedVehicles.filter((v) => showVerifiedListingBadge(v)).length,
        [publishedVehicles]
    );
    const averageCustomerRating = useMemo(() => {
        const rated = publishedVehicles.filter(
            (v) => typeof v.averageRating === 'number' && (v.ratingCount || 0) > 0
        );
        if (rated.length === 0) return 0;
        const total = rated.reduce((sum, v) => sum + Number(v.averageRating || 0), 0);
        return total / rated.length;
    }, [publishedVehicles]);

    const sortedCities = [...citiesWithCounts].sort((a, b) => b.cars - a.cars);
    const topCities = sortedCities.slice(0, 6);

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
                    icon: category.icon,
                    id: category.id,
                    gradient: category.gradient,
                    mobileCardGradient: category.mobileCardGradient,
                    vehicles,
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
    const statsRef = useRevealOnScroll<HTMLDivElement>(0);
    const [statsVisible, setStatsVisible] = useState(false);
    useEffect(() => {
        const node = statsRef.current;
        if (!node) return;
        const obs = new IntersectionObserver(
            (entries) => entries.forEach((e) => e.isIntersecting && setStatsVisible(true)),
            { threshold: 0.4 }
        );
        obs.observe(node);
        return () => obs.disconnect();
    }, [statsRef]);

    const featuredHeadRef = useRevealOnScroll<HTMLDivElement>(0);
    const featuredGridRef = useRevealOnScroll<HTMLDivElement>(120);
    const recentHeadRef = useRevealOnScroll<HTMLDivElement>(0);
    const recentGridRef = useRevealOnScroll<HTMLDivElement>(120);
    const citiesHeadRef = useRevealOnScroll<HTMLDivElement>(0);
    const citiesGridRef = useRevealOnScroll<HTMLDivElement>(100);
    const testimonialsRef = useRevealOnScroll<HTMLDivElement>(0);
    const categoriesRef = useRevealOnScroll<HTMLDivElement>(0);
    const sellRef = useRevealOnScroll<HTMLDivElement>(0);
    const serviceRef = useRevealOnScroll<HTMLDivElement>(0);

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
    const budgetChips = useMemo(
        () => [
            { label: t('mobile.home.budget.under3'), filters: { maxPrice: 300000 } },
            { label: t('mobile.home.budget.3to5'), filters: { minPrice: 300000, maxPrice: 500000 } },
            { label: t('mobile.home.budget.5to8'), filters: { minPrice: 500000, maxPrice: 800000 } },
            { label: t('mobile.home.budget.8to15'), filters: { minPrice: 800000, maxPrice: 1500000 } },
            { label: t('mobile.home.budget.above15'), filters: { minPrice: 1500000 } },
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

    const showSkeletons = featuredVehicles.length === 0 && recommendations.length === 0 && recentVehicles.length === 0;

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
                accent: 'from-purple-500 to-pink-500',
                emoji: '⏱️',
            },
            {
                title: t('home.sell.step2Title'),
                desc: t('home.sell.step2Desc'),
                cta: t('home.sell.step2Cta'),
                accent: 'from-blue-500 to-cyan-500',
                emoji: '📋',
            },
            {
                title: t('home.sell.step3Title'),
                desc: t('home.sell.step3Desc'),
                cta: t('home.sell.step3Cta'),
                accent: 'from-emerald-500 to-teal-500',
                emoji: '💸',
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
        <div className="min-h-screen bg-white overflow-x-hidden w-full">
            {/* Sticky compact search — appears once the hero scrolls off-screen */}
            {showStickySearch && (
                <div
                    className="fixed top-0 left-0 right-0 z-40 bg-white/85 backdrop-blur-lg border-b border-gray-200/80 shadow-sm animate-sticky-slide-down"
                    role="search"
                >
                    <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 font-semibold text-gray-900 text-sm tracking-tight">
                            <span className="inline-block w-6 h-6 rounded-md bg-gradient-to-br from-purple-600 to-pink-500"></span>
                            ReRide
                        </div>
                        <div className="flex-1 flex items-center gap-2 bg-gray-50 hover:bg-white border border-gray-200 hover:border-purple-400 rounded-full px-4 py-2 transition-colors focus-within:border-purple-500 focus-within:bg-white">
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder={t('search.placeholderHero')}
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
                                            : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
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
                className="relative py-16 md:py-24 px-4 overflow-hidden bg-[#0B1020]"
                style={{
                    background:
                        'radial-gradient(1000px 600px at -10% -10%, rgba(255,107,53,0.18) 0%, transparent 60%), radial-gradient(900px 600px at 110% 10%, rgba(124,58,237,0.22) 0%, transparent 60%), radial-gradient(1200px 800px at 50% 120%, rgba(59,130,246,0.18) 0%, transparent 60%), linear-gradient(135deg, #0B1020 0%, #111834 50%, #1A1240 100%)',
                    fontFamily: "'Poppins', sans-serif"
                }}
            >
                {/* Background Pattern + Glows + Cursor-follow Spotlight */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div
                        className="absolute inset-0 opacity-[0.07]"
                        style={{
                            backgroundImage:
                                'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
                            backgroundSize: '56px 56px',
                            maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)',
                            WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)'
                        }}
                    ></div>
                    <div
                        className="absolute -top-32 -right-24 w-[30rem] h-[30rem] rounded-full blur-3xl opacity-40 animate-orb-a"
                        style={{ background: 'radial-gradient(circle, #FF6B35 0%, transparent 70%)' }}
                    ></div>
                    <div
                        className="absolute -bottom-40 -left-24 w-[32rem] h-[32rem] rounded-full blur-3xl opacity-40 animate-orb-b"
                        style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)' }}
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

                <div className="relative max-w-5xl mx-auto text-center">
                    {/* Trust Badge */}
                    <div 
                        className="hero-rise hero-rise-1 inline-flex items-center gap-2 px-5 py-2 rounded-full mb-7 shadow-lg"
                        style={{
                            background: 'rgba(159, 122, 234, 0.3)',
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
                            fontSize: 'clamp(36px, 5.2vw, 56px)',
                            fontWeight: 700,
                            fontFamily: "'Poppins', sans-serif",
                            letterSpacing: '-0.025em'
                        }}
                    >
                        {t('home.premiumUsedCars')}
                    </h1>
                    
                    {/* Subheading */}
                    <p 
                        className="hero-rise hero-rise-3 mb-10 max-w-2xl mx-auto"
                        style={{
                            fontSize: 'clamp(15px, 1.6vw, 17px)',
                            fontWeight: 400,
                            fontFamily: "'Poppins', sans-serif",
                            color: 'rgba(255, 255, 255, 0.88)',
                            lineHeight: '1.65'
                        }}
                    >
                        {t('home.marketingSubhead')}
                    </p>

                    {/* Search Bar */}
                    <div 
                        className="hero-rise hero-rise-4 flex flex-col md:flex-row items-stretch md:items-center bg-white mb-6 max-w-3xl mx-auto overflow-hidden"
                        style={{
                            borderRadius: '20px',
                            boxShadow: '0 12px 40px -8px rgba(0, 0, 0, 0.25)'
                        }}
                    >
                        <div className="flex-1 flex items-center gap-3 px-6 py-4 md:py-5">
                            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
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
                                            : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
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

                    {/* Feature Cards */}
                    <div className="hero-rise hero-rise-6 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 max-w-5xl mx-auto">
                        {/* Card 1: 200+ Quality Checks */}
                        <button
                            type="button"
                            onClick={() => onNavigate(ViewEnum.SAFETY_CENTER)}
                            className="p-5 md:p-6 transition-all duration-300 hover:-translate-y-1 cursor-pointer text-left w-full"
                            aria-label={`${t('home.card.qualityTitle')} - learn more`}
                            style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                backdropFilter: 'blur(14px)',
                                WebkitBackdropFilter: 'blur(14px)',
                                borderRadius: '18px',
                                border: '1px solid rgba(255, 255, 255, 0.16)'
                            }}
                        >
                            <div 
                                className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center mb-3 md:mb-4 mx-auto transition-transform duration-300 group-hover:scale-110"
                                style={{ 
                                    background: 'linear-gradient(135deg, #4CAF50 0%, #45A049 100%)',
                                    borderRadius: '16px',
                                    boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)'
                                }}
                            >
                                <svg className="w-6 h-6 md:w-7 md:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <h3 
                                className="text-white mb-1.5 text-center"
                                style={{
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    fontFamily: "'Poppins', sans-serif",
                                    letterSpacing: '-0.01em',
                                    lineHeight: '1.35'
                                }}
                            >
                                {t('home.card.qualityTitle')}
                            </h3>
                            <p 
                                className="text-center"
                                style={{
                                    fontSize: '12px',
                                    fontWeight: 400,
                                    fontFamily: "'Poppins', sans-serif",
                                    color: 'rgba(255, 255, 255, 0.78)',
                                    lineHeight: '1.5'
                                }}
                            >
                                {t('home.card.qualityDesc')}
                            </p>
                        </button>

                        {/* Card 2: Fixed Price */}
                        <button
                            type="button"
                            onClick={() => onNavigate(ViewEnum.USED_CARS)}
                            className="p-5 md:p-6 transition-all duration-300 hover:-translate-y-1 cursor-pointer text-left w-full"
                            aria-label={`${t('home.card.fixedTitle')} - browse cars`}
                            style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                backdropFilter: 'blur(14px)',
                                WebkitBackdropFilter: 'blur(14px)',
                                borderRadius: '18px',
                                border: '1px solid rgba(255, 255, 255, 0.16)'
                            }}
                        >
                            <div 
                                className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center mb-3 md:mb-4 mx-auto transition-transform duration-300 group-hover:scale-110"
                                style={{ 
                                    background: 'linear-gradient(135deg, #42A5F5 0%, #1E88E5 100%)',
                                    borderRadius: '16px',
                                    boxShadow: '0 4px 12px rgba(66, 165, 245, 0.3)'
                                }}
                            >
                                <span 
                                    className="text-white"
                                    style={{
                                        fontSize: '20px',
                                        fontWeight: 700,
                                        fontFamily: "'Poppins', sans-serif"
                                    }}
                                >
                                    ₹
                                </span>
                            </div>
                            <h3 
                                className="text-white mb-1.5 text-center"
                                style={{
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    fontFamily: "'Poppins', sans-serif",
                                    letterSpacing: '-0.01em',
                                    lineHeight: '1.35'
                                }}
                            >
                                {t('home.card.fixedTitle')}
                            </h3>
                            <p 
                                className="text-center"
                                style={{
                                    fontSize: '12px',
                                    fontWeight: 400,
                                    fontFamily: "'Poppins', sans-serif",
                                    color: 'rgba(255, 255, 255, 0.78)',
                                    lineHeight: '1.5'
                                }}
                            >
                                {t('home.card.fixedDesc')}
                            </p>
                        </button>

                        {/* Card 3: 5-Day Money Back */}
                        <button
                            type="button"
                            onClick={() => onNavigate(ViewEnum.FAQ)}
                            className="p-5 md:p-6 transition-all duration-300 hover:-translate-y-1 cursor-pointer text-left w-full"
                            aria-label={`${t('home.card.moneyTitle')} - read policy`}
                            style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                backdropFilter: 'blur(14px)',
                                WebkitBackdropFilter: 'blur(14px)',
                                borderRadius: '18px',
                                border: '1px solid rgba(255, 255, 255, 0.16)'
                            }}
                        >
                            <div 
                                className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center mb-3 md:mb-4 mx-auto transition-transform duration-300 group-hover:scale-110"
                                style={{ 
                                    background: 'linear-gradient(135deg, #FF7043 0%, #F4511E 100%)',
                                    borderRadius: '16px',
                                    boxShadow: '0 4px 12px rgba(255, 112, 67, 0.3)'
                                }}
                            >
                                <svg className="w-6 h-6 md:w-7 md:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </div>
                            <h3 
                                className="text-white mb-1.5 text-center"
                                style={{
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    fontFamily: "'Poppins', sans-serif",
                                    letterSpacing: '-0.01em',
                                    lineHeight: '1.35'
                                }}
                            >
                                {t('home.card.moneyTitle')}
                            </h3>
                            <p 
                                className="text-center"
                                style={{
                                    fontSize: '12px',
                                    fontWeight: 400,
                                    fontFamily: "'Poppins', sans-serif",
                                    color: 'rgba(255, 255, 255, 0.78)',
                                    lineHeight: '1.5'
                                }}
                            >
                                {t('home.card.moneyDesc')}
                            </p>
                        </button>

                        {/* Card 4: Free RC Transfer */}
                        <button
                            type="button"
                            onClick={() => onNavigate(ViewEnum.FAQ)}
                            className="p-5 md:p-6 transition-all duration-300 hover:-translate-y-1 cursor-pointer text-left w-full"
                            aria-label={`${t('home.card.rcTitle')} - learn more`}
                            style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                backdropFilter: 'blur(14px)',
                                WebkitBackdropFilter: 'blur(14px)',
                                borderRadius: '18px',
                                border: '1px solid rgba(255, 255, 255, 0.16)'
                            }}
                        >
                            <div 
                                className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center mb-3 md:mb-4 mx-auto transition-transform duration-300 group-hover:scale-110"
                                style={{ 
                                    background: 'linear-gradient(135deg, #AB47BC 0%, #8E24AA 100%)',
                                    borderRadius: '16px',
                                    boxShadow: '0 4px 12px rgba(171, 71, 188, 0.3)'
                                }}
                            >
                                <svg className="w-6 h-6 md:w-7 md:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h3 
                                className="text-white mb-1.5 text-center"
                                style={{
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    fontFamily: "'Poppins', sans-serif",
                                    letterSpacing: '-0.01em',
                                    lineHeight: '1.35'
                                }}
                            >
                                {t('home.card.rcTitle')}
                            </h3>
                            <p 
                                className="text-center"
                                style={{
                                    fontSize: '12px',
                                    fontWeight: 400,
                                    fontFamily: "'Poppins', sans-serif",
                                    color: 'rgba(255, 255, 255, 0.78)',
                                    lineHeight: '1.5'
                                }}
                            >
                                {t('home.card.rcDesc')}
                            </p>
                        </button>
                    </div>

                </div>
            </div>

            {/* Stats Trust Strip — real counters trigger when scrolled into view.
                We intentionally avoid fabricated numbers: cars/cities reflect
                published inventory and only show "+" when the figure is
                meaningfully large. */}
            <div ref={statsRef} className="bg-white border-b border-gray-100 reveal-on-scroll">
                <div className="max-w-6xl mx-auto px-4 py-8 md:py-10">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                        <AnimatedStat
                            value={publishedVehicles.length}
                            suffix={publishedVehicles.length >= 100 ? '+' : ''}
                            label="Cars Listed"
                            visible={statsVisible}
                            formatter={(n) => Math.round(n).toLocaleString('en-IN')}
                        />
                        <AnimatedStat
                            value={citiesWithCounts.filter((c) => c.cars > 0).length}
                            suffix={citiesWithCounts.filter((c) => c.cars > 0).length >= 10 ? '+' : ''}
                            label="Cities Covered"
                            visible={statsVisible}
                        />
                        <AnimatedStat
                            value={verifiedListingCount}
                            suffix={verifiedListingCount >= 100 ? '+' : ''}
                            label="Verified Listings"
                            visible={statsVisible}
                            formatter={(n) => Math.round(n).toLocaleString('en-IN')}
                        />
                        {averageCustomerRating > 0 ? (
                            <AnimatedStat
                                value={averageCustomerRating}
                                suffix="★"
                                label="Avg Listing Rating"
                                visible={statsVisible}
                                formatter={(n) => n.toFixed(1)}
                            />
                        ) : (
                            <AnimatedStat
                                value={publishedVehicles.filter((v) => v.isFeatured).length}
                                suffix={publishedVehicles.filter((v) => v.isFeatured).length >= 10 ? '+' : ''}
                                label="Featured Cars"
                                visible={statsVisible}
                                formatter={(n) => Math.round(n).toLocaleString('en-IN')}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Actions — four high-intent shortcuts that cover every major
                surface of the app. Deliberately placed right below the stats so
                returning users can jump to a task without scrolling. */}
            <div className="bg-white border-b border-gray-100">
                <div className="max-w-6xl mx-auto px-4 py-8 md:py-10">
                    <div className="flex items-end justify-between mb-5">
                        <h2
                            className="text-gray-900"
                            style={{
                                fontSize: '18px',
                                fontWeight: 700,
                                fontFamily: "'Poppins', sans-serif",
                                letterSpacing: '-0.01em',
                            }}
                        >
                            {t('mobile.home.quickActions.title')}
                        </h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                        {[
                            {
                                key: 'sell',
                                label: t('mobile.home.quickActions.sell'),
                                view: ViewEnum.SELL_CAR,
                                gradient: 'from-emerald-500 to-teal-500',
                                badge: null as number | null,
                                icon: (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                ),
                            },
                            {
                                key: 'wishlist',
                                label: t('mobile.home.quickActions.wishlist'),
                                view: ViewEnum.WISHLIST,
                                gradient: 'from-pink-500 to-rose-500',
                                badge: wishlist.length || null,
                                icon: (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
                                ),
                            },
                            {
                                key: 'compare',
                                label: t('mobile.home.quickActions.compare'),
                                view: ViewEnum.COMPARISON,
                                gradient: 'from-indigo-500 to-purple-500',
                                badge: comparisonList.length || null,
                                icon: (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                ),
                            },
                            {
                                key: 'activity',
                                label: t('mobile.home.quickActions.activity'),
                                view: ViewEnum.BUYER_DASHBOARD,
                                gradient: 'from-amber-500 to-orange-500',
                                badge: null,
                                icon: (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                ),
                            },
                        ].map((action) => (
                            <button
                                key={action.key}
                                onClick={() => onNavigate(action.view)}
                                className="group relative flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-white hover:border-purple-200 hover:shadow-md transition-all text-left"
                            >
                                <div
                                    className={`w-11 h-11 rounded-xl flex items-center justify-center text-white flex-shrink-0 bg-gradient-to-br ${action.gradient} group-hover:scale-105 transition-transform`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        {action.icon}
                                    </svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div
                                        className="text-gray-900 truncate"
                                        style={{ fontSize: '14px', fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}
                                    >
                                        {action.label}
                                    </div>
                                </div>
                                {action.badge ? (
                                    <span className="ml-auto bg-purple-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                                        {action.badge}
                                    </span>
                                ) : null}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Continue browsing — only rendered when we actually have recent
                vehicles to show. Backed by localStorage so it works for
                logged-out visitors too. */}
            {continueBrowsingVehicles.length > 0 && (
                <div className="bg-gray-50/60 border-b border-gray-100">
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
                                        className="group flex-shrink-0 w-[220px] md:w-[240px] bg-white rounded-2xl border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all overflow-hidden text-left"
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
                                            <div className="text-[13px] font-bold text-purple-700 mt-1">
                                                ₹{Math.round(vehicle.price / 1000).toLocaleString('en-IN')}K
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
                <div className="py-16 md:py-20 px-4 bg-gradient-to-b from-white to-gray-50/60">
                    <div className="max-w-7xl mx-auto">
                        <div ref={featuredHeadRef} className="reveal-on-scroll flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10 md:mb-12">
                            <div className="space-y-3 text-center md:text-left">
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-purple-700">
                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    {t('home.featured.badge')}
                                </span>
                                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight leading-tight">{t('home.featured.title')}</h2>
                                <p className="text-gray-600 text-base max-w-xl leading-relaxed">{t('home.featured.subtitle')}</p>
                            </div>
                            <button
                                onClick={() => onNavigate(ViewEnum.USED_CARS)}
                                className="self-center md:self-end inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-gray-300 text-gray-800 font-medium text-sm hover:border-purple-600 hover:text-purple-700 transition-colors"
                            >
                                {t('home.featured.viewAllVehicles')}
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>

                        <div ref={featuredGridRef} className="reveal-on-scroll relative">
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
                                        className="shine-on-hover bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200/80 hover:shadow-xl hover:border-gray-300 transition-all duration-300 cursor-pointer group hover:-translate-y-1 flex-shrink-0 snap-start min-w-[260px] md:min-w-[300px] lg:min-w-[320px]"
                                    >
                                        <div className="relative h-56 overflow-hidden">
                                            <LazyImage
                                                src={getFirstValidImage(vehicle.images, vehicle.id)}
                                                alt={`${vehicle.make} ${vehicle.model}`}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                width={400}
                                                quality={85}
                                                eager={index === 0}
                                                fetchPriority={index === 0 ? 'high' : 'auto'}
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                            <div className="absolute top-3 left-3 bg-green-600 text-white px-2.5 py-1 rounded-md flex items-center gap-1 text-[11px] font-semibold tracking-wide shadow-sm">
                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                                </svg>
                                                {t('common.verified')}
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onToggleWishlist(vehicle.id);
                                                }}
                                                className="absolute top-3 right-3 w-9 h-9 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-all duration-300 shadow-sm hover:scale-110"
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
                                                <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <div className="py-16 md:py-20 px-4 bg-gradient-to-b from-white to-gray-50/60">
                    <div className="max-w-7xl mx-auto space-y-4">
                        <div className="h-4 bg-gray-100 rounded w-40 animate-pulse" />
                        <div className="h-6 bg-gray-100 rounded w-64 animate-pulse mb-6" />
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {Array.from({ length: 4 }).map((_, idx) => skeletonCard(`featured-${idx}`))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="py-16 md:py-20 px-4 bg-gradient-to-b from-white to-gray-50/60">
                    <div className="max-w-3xl mx-auto">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mb-5 shadow-md">
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
                                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-7 py-3.5 rounded-full font-semibold text-base inline-flex items-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg"
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
                <div className="py-16 md:py-20 px-4 bg-white">
                    <div className="max-w-7xl mx-auto">
                        <div ref={recentHeadRef} className="reveal-on-scroll flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10 md:mb-12">
                            <div className="space-y-3 text-center md:text-left">
                                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-orange-700">
                                    <span className="h-px w-6 bg-orange-300"></span>
                                    Just Listed
                                </span>
                                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight leading-tight">{t('home.recent.title')}</h2>
                                <p className="text-gray-600 text-base max-w-xl leading-relaxed">{t('home.recent.subtitle')}</p>
                            </div>
                            <button 
                                onClick={() => onNavigate(ViewEnum.USED_CARS)}
                                className="self-center md:self-end inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-gray-300 text-gray-800 font-medium text-sm hover:border-purple-600 hover:text-purple-700 transition-colors"
                            >
                                {t('home.recent.viewAll')}
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>

                        <div ref={recentGridRef} className="reveal-on-scroll grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
                            {recentVehicles.map((vehicle, index) => (
                                <div
                                    key={vehicle.id}
                                    onClick={() => onSelectVehicle(vehicle)}
                                    className="shine-on-hover bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200/80 hover:shadow-lg hover:border-gray-300 transition-all duration-300 cursor-pointer group hover:-translate-y-1"
                                >
                                    <div className="relative h-48 overflow-hidden">
                                        <LazyImage
                                            src={getFirstValidImage(vehicle.images, vehicle.id)}
                                            alt={`${vehicle.make} ${vehicle.model}`}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            width={380}
                                            quality={85}
                                            eager={index === 0}
                                        />
                                        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
                                            <span className="bg-orange-500 text-white px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide shadow-sm">
                                                {t('common.newBadge')}
                                            </span>
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
                                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-medium flex-shrink-0">
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
                                            <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            ) : showSkeletons ? (
                <div className="py-16 md:py-20 px-4 bg-white">
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
            <div className="py-16 md:py-20 px-4 bg-white border-t border-gray-100">
                <div className="max-w-7xl mx-auto">
                    <div ref={citiesHeadRef} className="reveal-on-scroll flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 md:mb-10">
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 text-purple-600 text-[11px] font-bold uppercase tracking-[0.14em]">
                                <span
                                    className="relative inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 shadow-[0_4px_12px_-2px_rgba(168,85,247,0.55)]"
                                    aria-hidden="true"
                                >
                                    <span className="absolute inset-0 rounded-full border border-purple-400/60 mc-header-radar" />
                                    <svg className="relative w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z" fill="currentColor" stroke="none" />
                                        <circle cx="12" cy="9" r="2.4" fill="#fff" />
                                    </svg>
                                </span>
                                <span className="mc-eyebrow-accent">{t('mobile.home.exploreLocation')}</span>
                            </div>
                            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">{t('home.cities.title')}</h2>
                            <p className="text-gray-500 text-[15px] leading-snug">{t('mobile.home.nearYou')}</p>
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

                    <div ref={citiesGridRef} className="reveal-on-scroll grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
                        {topCities.slice(0, 5).map((city, index) => {
                            const cityKey = city.name as HomeDiscoveryCityName;
                            const accent = HOME_MOBILE_CITY_ACCENT[cityKey];
                            const hasVehicles = city.cars > 0;

                            return (
                                <button
                                    key={index}
                                    type="button"
                                    aria-label={t('mobile.home.cityAria', { name: city.name, count: city.cars })}
                                    onClick={() => onSelectCity(city.name)}
                                    className="mc-card group relative rounded-3xl bg-white overflow-hidden text-left transition-all duration-300 active:scale-[0.98] hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                                    style={{
                                        border: `1px solid ${accent.ring}`,
                                        boxShadow:
                                            '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px -8px rgba(15, 23, 42, 0.16)',
                                        ['--mc-delay' as string]: `${index * 80}ms`,
                                    }}
                                >
                                    {/* Gradient header — carries city identity */}
                                    <div
                                        className="mc-gradient relative h-[148px] w-full overflow-hidden"
                                        style={{ background: HOME_MOBILE_CITY_GRADIENT[cityKey] }}
                                    >
                                        {/* Decorative blobs */}
                                        <div className="absolute inset-0 opacity-50 motion-reduce:hidden" aria-hidden="true">
                                            <div
                                                className="absolute -top-8 -right-6 w-32 h-32 rounded-full blur-2xl"
                                                style={{ backgroundColor: accent.soft }}
                                            />
                                            <div
                                                className="absolute -bottom-10 -left-8 w-28 h-28 rounded-full blur-2xl"
                                                style={{ backgroundColor: accent.soft }}
                                            />
                                        </div>
                                        {/* Dotted texture */}
                                        <div
                                            className="absolute inset-0 opacity-[0.10] motion-reduce:hidden"
                                            aria-hidden="true"
                                            style={{
                                                backgroundImage: `radial-gradient(circle at 1px 1px, ${accent.solid} 1px, transparent 0)`,
                                                backgroundSize: '12px 12px',
                                            }}
                                        />

                                        {/* Monument silhouette */}
                                        <CityMonument city={cityKey} className="mc-monument" color={accent.solid} />

                                        {/* Pin badge with radar-ping rings */}
                                        <div className="absolute top-3 right-3" aria-hidden="true">
                                            <span className="relative flex w-8 h-8 items-center justify-center">
                                                <span
                                                    className="mc-radar-ring absolute inset-0 rounded-full"
                                                    style={{ backgroundColor: accent.solid, opacity: 0.22 }}
                                                />
                                                <span
                                                    className="mc-radar-ring mc-radar-ring-2 absolute inset-0 rounded-full"
                                                    style={{ backgroundColor: accent.solid, opacity: 0.22 }}
                                                />
                                                <span
                                                    className="relative w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md"
                                                    style={{
                                                        backgroundColor: 'rgba(255,255,255,0.75)',
                                                        border: `1px solid ${accent.ring}`,
                                                    }}
                                                >
                                                    <svg
                                                        className="w-4 h-4"
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

                                        {/* Big city abbreviation */}
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span
                                                className="mc-abbr text-[56px] leading-none font-black tracking-tight"
                                                style={{
                                                    color: accent.solid,
                                                    fontFeatureSettings: '"tnum"',
                                                    textShadow: '0 1px 0 rgba(255,255,255,0.35)',
                                                }}
                                            >
                                                {city.abbr}
                                            </span>
                                        </div>

                                        {/* Hover sheen */}
                                        <div
                                            className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 motion-reduce:hidden"
                                            aria-hidden="true"
                                        />
                                    </div>

                                    {/* Footer */}
                                    <div className="px-4 pt-3 pb-4 flex flex-col gap-2">
                                        <div className="flex items-start justify-between gap-1">
                                            <h3 className="text-[16px] font-bold text-gray-900 leading-tight tracking-tight truncate">
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
                                                className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full text-[12px] font-bold"
                                                style={{ backgroundColor: accent.soft, color: accent.solid }}
                                            >
                                                <span
                                                    className="mc-live-dot w-1.5 h-1.5 rounded-full"
                                                    style={{ backgroundColor: accent.solid }}
                                                    aria-hidden="true"
                                                />
                                                {t('mobile.home.cityAvailable', { count: city.cars })}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full text-[12px] font-semibold bg-gray-100 text-gray-500">
                                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" aria-hidden="true" />
                                                {t('mobile.home.cityComingSoon')}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Testimonials */}
            <div ref={testimonialsRef} className="reveal-on-scroll py-16 md:py-20 px-4 bg-white">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-10 md:mb-12 space-y-3">
                        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-pink-700">
                            <span className="h-px w-6 bg-pink-300"></span>
                            What Customers Say
                            <span className="h-px w-6 bg-pink-300"></span>
                        </span>
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight leading-tight">{t('home.testimonials.title')}</h2>
                        <p className="text-gray-600 text-base max-w-xl mx-auto leading-relaxed">{t('home.testimonials.subtitle')}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
                        {testimonialItems.map((item, idx) => (
                            <div key={idx} className="bg-gray-50/80 rounded-xl border border-gray-200/80 p-6 hover:shadow-md hover:bg-white transition-all duration-200">
                                <svg className="w-7 h-7 text-purple-200 mb-3" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                                </svg>
                                <p className="text-gray-700 text-[15px] leading-relaxed mb-5">{item.quote}</p>
                                <div className="flex items-center gap-3 pt-4 border-t border-gray-200/80">
                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center font-semibold text-sm">
                                        {item.name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900 text-sm tracking-tight">{item.name}</div>
                                        <div className="text-[12px] text-purple-700 font-medium">{item.tag}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Browse by Category — tile cards with illustrated icon plates (matches mobile design) */}
            <div ref={categoriesRef} className="reveal-on-scroll py-16 md:py-20 px-4 bg-gradient-to-b from-white to-gray-50 border-t border-gray-100">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 md:mb-10">
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 text-orange-600 text-[11px] font-bold uppercase tracking-wider">
                                <span className="h-px w-5 bg-orange-300" />
                                Browse
                            </div>
                            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
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

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
                        {categoriesWithCounts.map((category, index) => {
                            const gradient = category.mobileCardGradient;
                            const hasVehicles = category.vehicles > 0;

                            return (
                                <button
                                    key={category.id}
                                    type="button"
                                    onClick={() => {
                                        onSelectCategory(category.id);
                                        onNavigate(ViewEnum.USED_CARS);
                                    }}
                                    className="vc-tile group relative flex flex-col items-center gap-3 p-5 bg-white rounded-2xl shadow-sm border border-gray-100 active:scale-95 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:active:scale-100 motion-reduce:hover:translate-y-0"
                                    style={{
                                        animationDelay: `${index * 50}ms`,
                                        minHeight: '160px',
                                    }}
                                >
                                    <div
                                        className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-2xl opacity-0 group-active:opacity-5 group-hover:opacity-10 transition-opacity duration-300 motion-reduce:transition-none`}
                                    />

                                    {/* Icon plate */}
                                    <div
                                        className={`vc-plate relative w-16 h-16 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow duration-300`}
                                    >
                                        <VehicleCategoryIcon category={category.id} className="relative z-10 w-12 h-12 drop-shadow-sm" />
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/35 via-white/0 to-transparent rounded-2xl pointer-events-none" />
                                        <div
                                            className="absolute inset-x-1 bottom-0 h-2 rounded-b-2xl pointer-events-none"
                                            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.18), transparent)' }}
                                        />
                                    </div>

                                    <span className="text-[14px] font-bold text-gray-900 text-center leading-tight group-hover:text-orange-600 transition-colors duration-300 motion-reduce:transition-none">
                                        {category.name}
                                    </span>

                                    <div
                                        className={`flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all duration-300 motion-reduce:transition-none ${
                                            hasVehicles
                                                ? 'bg-orange-100 text-orange-600 group-hover:bg-orange-200'
                                                : 'bg-gray-100 text-gray-500'
                                        }`}
                                    >
                                        <span>{category.vehicles}</span>
                                        <span className="ml-1">{t('mobile.home.carsSuffix')}</span>
                                    </div>

                                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 motion-reduce:transition-none" />
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Sell Car Steps Section */}
            <div ref={sellRef} className="reveal-on-scroll py-16 md:py-20 px-4 bg-white">
                <div className="max-w-6xl mx-auto text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 md:mb-16 tracking-tight leading-tight">{t('home.sell.title')}</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12 mb-12">
                        {sellSteps.map((item, idx) => (
                            <div key={idx} className="flex flex-col items-center text-center gap-4">
                                <div className="relative">
                                    <div className={`h-32 w-32 rounded-full bg-gradient-to-br ${item.accent} opacity-30 blur-3xl absolute inset-0`} />
                                    <div className="relative h-32 w-32 rounded-full bg-gradient-to-br from-white to-gray-50 border border-gray-200/80 shadow-sm flex items-center justify-center text-4xl">
                                        <span role="img" aria-label={item.title}>{item.emoji}</span>
                                    </div>
                                </div>
                                <div className="space-y-2 max-w-xs">
                                    <h3 className="text-lg font-semibold text-gray-900 tracking-tight">{item.title}</h3>
                                    <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                                </div>
                                <button
                                    onClick={() => onNavigate(ViewEnum.SELL_CAR)}
                                    className="inline-flex items-center gap-1 text-purple-700 font-medium text-sm hover:gap-2 transition-all"
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
                            className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-purple-700 text-white font-semibold text-sm shadow-md hover:bg-purple-800 hover:shadow-lg transition-all"
                        >
                            {t('home.sell.watchHow')}
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                        <button
                            onClick={() => onNavigate(ViewEnum.SELL_CAR)}
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-gray-300 text-gray-800 font-medium text-sm hover:border-purple-500 hover:text-purple-700 transition-colors"
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
                <div className="py-16 md:py-20 px-4 bg-gradient-to-br from-orange-50 via-amber-50 to-orange-50">
                    <div className="max-w-3xl mx-auto">
                        <div className="text-center space-y-4">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-orange-700">
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                </svg>
                                {t('home.trending.badge')}
                            </span>
                            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight leading-tight">{t('home.trending.title')}</h2>
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

            {/* Car Service Section */}
            <div 
                ref={serviceRef}
                className="reveal-on-scroll relative py-16 md:py-24 px-4 text-white overflow-hidden bg-[#0B1020]"
                style={{
                    background:
                        'radial-gradient(1000px 600px at -10% -10%, rgba(255,107,53,0.18) 0%, transparent 60%), radial-gradient(900px 600px at 110% 10%, rgba(124,58,237,0.22) 0%, transparent 60%), radial-gradient(1200px 800px at 50% 120%, rgba(59,130,246,0.18) 0%, transparent 60%), linear-gradient(135deg, #0B1020 0%, #111834 50%, #1A1240 100%)'
                }}
            >
                <div className="absolute inset-0 overflow-hidden">
                    <div
                        className="absolute -top-32 -right-24 w-[30rem] h-[30rem] rounded-full blur-3xl opacity-40"
                        style={{ background: 'radial-gradient(circle, #FF6B35 0%, transparent 70%)' }}
                    ></div>
                    <div
                        className="absolute -bottom-40 -left-24 w-[32rem] h-[32rem] rounded-full blur-3xl opacity-40"
                        style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)' }}
                    ></div>
                </div>
                <div className="relative max-w-5xl mx-auto text-center">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-white/80 mb-4">
                        <span className="h-px w-6 bg-white/40"></span>
                        {t('home.service.badge')}
                        <span className="h-px w-6 bg-white/40"></span>
                    </span>
                    <h2 className="text-3xl md:text-5xl font-bold mb-4 leading-[1.1] tracking-tight text-white">{t('home.service.title')}</h2>
                    <p className="text-base md:text-lg text-white/85 mb-12 max-w-2xl mx-auto leading-relaxed">
                        {t('home.service.subtitle')}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
                        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-7 border border-white/20 hover:bg-white/15 hover:-translate-y-1 transition-all duration-300">
                            <div className="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center mb-5 mx-auto shadow-lg">
                                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <h3 className="font-semibold text-[17px] mb-2 tracking-tight text-white">{t('home.service.card1Title')}</h3>
                            <p className="text-white/80 text-sm leading-relaxed">{t('home.service.card1Desc')}</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-7 border border-white/20 hover:bg-white/15 hover:-translate-y-1 transition-all duration-300">
                            <div className="w-14 h-14 bg-green-500 rounded-xl flex items-center justify-center mb-5 mx-auto shadow-lg">
                                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <h3 className="font-semibold text-[17px] mb-2 tracking-tight text-white">{t('home.service.card2Title')}</h3>
                            <p className="text-white/80 text-sm leading-relaxed">{t('home.service.card2Desc')}</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-7 border border-white/20 hover:bg-white/15 hover:-translate-y-1 transition-all duration-300">
                            <div className="w-14 h-14 bg-pink-500 rounded-xl flex items-center justify-center mb-5 mx-auto shadow-lg">
                                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="font-semibold text-[17px] mb-2 tracking-tight text-white">{t('home.service.card3Title')}</h3>
                            <p className="text-white/80 text-sm leading-relaxed">{t('home.service.card3Desc')}</p>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default Home;