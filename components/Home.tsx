import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { VehicleCategory, View as ViewEnum, type Vehicle, type View } from '../types';
import { getFirstValidImage, optimizeImageUrl } from '../utils/imageUtils';
import { matchesCity } from '../utils/cityMapping';
import LazyImage from './LazyImage';
import QuickViewModal from './QuickViewModal';
import { useStorefrontAggregates } from '../hooks/useStorefrontAggregates';
import {
    HOME_DESKTOP_CITY_STYLE,
    HOME_DISCOVERY_CATEGORIES,
    HOME_DISCOVERY_CITY_ORDER,
} from '../constants/homeDiscovery';
import { showVerifiedListingBadge } from '../utils/listingTrust';

interface HomeProps {
    onSearch: (query: string) => void;
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
    allVehicles = []
}) => {
    const { t, i18n } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [quickViewVehicle, setQuickViewVehicle] = useState<Vehicle | null>(null);
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
                    vehicles,
                };
            }),
        [categoryCounts, storefrontAgg?.categories]
    );

    const featuredListRef = useRef<HTMLDivElement>(null);

    const handleSearch = () => {
        if (searchQuery.trim()) {
            onSearch(searchQuery);
            onNavigate(ViewEnum.USED_CARS);
        }
    };

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

    const showSkeletons = featuredVehicles.length === 0 && recommendations.length === 0 && recentVehicles.length === 0;

    const whyChooseItems = useMemo(
        () => [
            { icon: '✅', title: t('home.why.checksTitle'), desc: t('home.why.checksDesc') },
            { icon: '🛡️', title: t('home.why.verifiedTitle'), desc: t('home.why.verifiedDesc') },
            { icon: '⚡', title: t('home.why.fastTitle'), desc: t('home.why.fastDesc') },
            { icon: '💰', title: t('home.why.priceTitle'), desc: t('home.why.priceDesc') },
        ],
        [t, i18n.language]
    );

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
            {/* Hero Section with Search - Exact Design Match */}
            <div 
                className="relative py-10 md:py-14 px-4 pb-10 md:pb-12 overflow-hidden"
                style={{
                    background: 'linear-gradient(180deg, #6A2D9D 0%, #D24B9F 100%)',
                    fontFamily: "'Poppins', sans-serif"
                }}
            >
                {/* Subtle Background Shapes */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
                </div>

                <div className="relative max-w-5xl mx-auto text-center">
                    {/* Trust Badge - Exact Match */}
                    <div 
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-5 shadow-lg"
                        style={{
                            background: 'rgba(159, 122, 234, 0.3)',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)'
                        }}
                    >
                        <div 
                            className="w-3 h-3 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: '#6DD278' }}
                        >
                            <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                        </div>
                        <span 
                            className="text-white font-medium"
                            style={{ fontSize: '14px', fontFamily: "'Poppins', sans-serif" }}
                        >
                            {t('home.trustBadge1M')}
                        </span>
                    </div>

                    {/* Main Heading - Exact Match */}
                    <h1 
                        className="text-white mb-3 leading-tight"
                        style={{
                            fontSize: 'clamp(40px, 5vw, 48px)',
                            fontWeight: 700,
                            fontFamily: "'Poppins', sans-serif",
                            letterSpacing: '-0.02em'
                        }}
                    >
                        {t('home.premiumUsedCars')}
                    </h1>
                    
                    {/* Subheading - Exact Match */}
                    <p 
                        className="text-white mb-5 max-w-3xl mx-auto"
                        style={{
                            fontSize: 'clamp(16px, 2vw, 18px)',
                            fontWeight: 400,
                            fontFamily: "'Poppins', sans-serif",
                            color: '#F0F0F0',
                            lineHeight: '1.6'
                        }}
                    >
                        {t('home.marketingSubhead')}
                    </p>

                    {/* Search Bar - Exact Match */}
                    <div 
                        className="flex flex-col md:flex-row items-stretch md:items-center bg-white rounded-3xl shadow-lg mb-8 max-w-4xl mx-auto overflow-hidden"
                        style={{
                            borderRadius: '24px',
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
                        }}
                    >
                        <div className="flex-1 flex items-center gap-3 px-5 py-4">
                            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder={t('search.placeholderHero')}
                                className="flex-1 outline-none text-gray-700 placeholder-gray-500"
                                style={{
                                    fontSize: '16px',
                                    fontWeight: 400,
                                    fontFamily: "'Poppins', sans-serif",
                                    color: '#888888'
                                }}
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            className="text-white px-8 py-4 font-semibold flex items-center justify-center gap-2 transition-all duration-300"
                            style={{
                                background: 'linear-gradient(135deg, #5A67D8 0%, #6B5ECF 100%)',
                                borderRadius: '24px',
                                fontSize: '16px',
                                fontWeight: 600,
                                fontFamily: "'Poppins', sans-serif"
                            }}
                        >
                            {t('common.search')}
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    {/* Feature Cards - Enhanced Style */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-5xl mx-auto">
                        {/* Card 1: 200+ Quality Checks */}
                        <div 
                            className="rounded-3xl p-5 md:p-6 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer"
                            style={{
                                background: 'rgba(159, 122, 234, 0.35)',
                                backdropFilter: 'blur(12px)',
                                WebkitBackdropFilter: 'blur(12px)',
                                borderRadius: '20px',
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                                border: '1px solid rgba(255, 255, 255, 0.2)'
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
                                className="text-white mb-1.5 md:mb-2 text-center"
                                style={{
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    fontFamily: "'Poppins', sans-serif",
                                    lineHeight: '1.3'
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
                                    color: 'rgba(255, 255, 255, 0.85)',
                                    lineHeight: '1.4'
                                }}
                            >
                                {t('home.card.qualityDesc')}
                            </p>
                        </div>

                        {/* Card 2: Fixed Price */}
                        <div 
                            className="rounded-3xl p-5 md:p-6 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer"
                            style={{
                                background: 'rgba(159, 122, 234, 0.35)',
                                backdropFilter: 'blur(12px)',
                                WebkitBackdropFilter: 'blur(12px)',
                                borderRadius: '20px',
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                                border: '1px solid rgba(255, 255, 255, 0.2)'
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
                                className="text-white mb-1.5 md:mb-2 text-center"
                                style={{
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    fontFamily: "'Poppins', sans-serif",
                                    lineHeight: '1.3'
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
                                    color: 'rgba(255, 255, 255, 0.85)',
                                    lineHeight: '1.4'
                                }}
                            >
                                {t('home.card.fixedDesc')}
                            </p>
                        </div>

                        {/* Card 3: 5-Day Money Back */}
                        <div 
                            className="rounded-3xl p-5 md:p-6 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer"
                            style={{
                                background: 'rgba(159, 122, 234, 0.35)',
                                backdropFilter: 'blur(12px)',
                                WebkitBackdropFilter: 'blur(12px)',
                                borderRadius: '20px',
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                                border: '1px solid rgba(255, 255, 255, 0.2)'
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
                                className="text-white mb-1.5 md:mb-2 text-center"
                                style={{
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    fontFamily: "'Poppins', sans-serif",
                                    lineHeight: '1.3'
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
                                    color: 'rgba(255, 255, 255, 0.85)',
                                    lineHeight: '1.4'
                                }}
                            >
                                {t('home.card.moneyDesc')}
                            </p>
                        </div>

                        {/* Card 4: Free RC Transfer */}
                        <div 
                            className="rounded-3xl p-5 md:p-6 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer"
                            style={{
                                background: 'rgba(159, 122, 234, 0.35)',
                                backdropFilter: 'blur(12px)',
                                WebkitBackdropFilter: 'blur(12px)',
                                borderRadius: '20px',
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                                border: '1px solid rgba(255, 255, 255, 0.2)'
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
                                className="text-white mb-1.5 md:mb-2 text-center"
                                style={{
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    fontFamily: "'Poppins', sans-serif",
                                    lineHeight: '1.3'
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
                                    color: 'rgba(255, 255, 255, 0.85)',
                                    lineHeight: '1.4'
                                }}
                            >
                                {t('home.card.rcDesc')}
                            </p>
                        </div>
                    </div>

                    {/* Scroll Indicator */}
                    <div 
                        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-1 h-8 rounded-full opacity-50"
                        style={{
                            background: 'rgba(255, 255, 255, 0.5)',
                            borderRadius: '12px'
                        }}
                    ></div>
                </div>
            </div>

            {/* Featured Collection Section - Premium Style */}
            {featuredVehicles.length > 0 ? (
                <div className="py-10 md:py-14 px-4 bg-gradient-to-b from-white to-gray-50 border-t border-gray-100/80">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-8 space-y-2">
                            <div className="flex flex-col items-center gap-2">
                                <button className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 via-orange-500 to-pink-500 text-white px-6 py-2.5 rounded-full font-black text-xs uppercase tracking-wider shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    {t('home.featured.badge')}
                                </button>
                                <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">{t('home.featured.title')}</h2>
                                <p className="text-gray-600 text-base md:text-lg max-w-2xl mx-auto leading-snug md:leading-relaxed">{t('home.featured.subtitle')}</p>
                            </div>
                            <button
                                onClick={() => onNavigate(ViewEnum.USED_CARS)}
                                className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-purple-600 text-purple-700 font-bold text-sm hover:bg-purple-50 transition-all duration-200 hover:scale-105"
                            >
                                {t('home.featured.viewAllVehicles')}
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>

                        <div className="relative">
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
                                className="flex gap-6 md:gap-8 overflow-x-auto pb-2 snap-x snap-mandatory"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            >
                                {featuredVehicles.map((vehicle, index) => (
                                    <div
                                        key={vehicle.id}
                                        onClick={() => onSelectVehicle(vehicle)}
                                        className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 hover:shadow-2xl transition-all duration-300 cursor-pointer group hover:-translate-y-2 flex-shrink-0 snap-start min-w-[260px] md:min-w-[300px] lg:min-w-[320px]"
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
                                            <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-black shadow-lg">
                                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                                </svg>
                                                {t('common.verified')}
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onToggleWishlist(vehicle.id);
                                                }}
                                                className="absolute top-4 right-4 w-10 h-10 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-all duration-300 shadow-lg hover:scale-110"
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
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setQuickViewVehicle(vehicle);
                                                }}
                                                className="absolute bottom-4 left-4 z-[1] rounded-xl bg-white/95 px-3 py-2 text-xs font-black text-blue-700 shadow-lg backdrop-blur-sm hover:bg-white"
                                            >
                                                {t('home.quickView')}
                                            </button>
                                            <div className="absolute bottom-4 right-4 bg-gray-900/90 backdrop-blur-sm text-white px-4 py-2 rounded-xl shadow-lg">
                                                <span className="font-black text-base">₹{(vehicle.price / 100000).toFixed(2)}L</span>
                                            </div>
                                        </div>
                                        <div className="p-5">
                                            <h3 className="font-black text-gray-900 mb-3 text-lg leading-tight">
                                                {vehicle.year} {vehicle.make} {vehicle.model}
                                            </h3>
                                            <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
                                                <span className="flex items-center gap-1.5">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    {vehicle.mileage.toLocaleString()}
                                                </span>
                                                <span>•</span>
                                                <span>{vehicle.fuelType}</span>
                                                <span>•</span>
                                                <span>{vehicle.transmission || t('common.manual')}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-blue-600">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                <span className="text-sm font-bold">{vehicle.city || t('common.notAvailable')}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : showSkeletons ? (
                <div className="py-10 md:py-14 px-4 bg-gradient-to-b from-white to-gray-50 border-t border-gray-100/80">
                    <div className="max-w-7xl mx-auto space-y-4">
                        <div className="h-4 bg-gray-100 rounded w-40 animate-pulse" />
                        <div className="h-6 bg-gray-100 rounded w-64 animate-pulse" />
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {Array.from({ length: 4 }).map((_, idx) => skeletonCard(`featured-${idx}`))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="py-10 md:py-14 px-4 bg-gradient-to-b from-white to-gray-50 border-t border-gray-100/80">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mb-4">
                                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </div>
                            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-2 tracking-tight">{t('home.featured.emptyTitle')}</h2>
                            <p className="text-gray-600 text-base md:text-lg max-w-2xl mx-auto leading-snug md:leading-relaxed mb-6">
                                {t('home.featured.emptyBody')}
                            </p>
                            <button 
                                onClick={() => onNavigate(ViewEnum.USED_CARS)}
                                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-4 rounded-xl font-bold text-base md:text-lg flex items-center gap-2 mx-auto transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                            >
                                {t('home.featured.browseAll')}
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Recently Added Section */}
            {recentVehicles.length > 0 ? (
                <div className="py-10 md:py-14 px-4 bg-white border-t border-gray-100/80">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
                            <div className="space-y-1">
                                <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">{t('home.recent.title')}</h2>
                                <p className="text-gray-600 text-base md:text-lg leading-snug md:leading-normal">{t('home.recent.subtitle')}</p>
                            </div>
                            <button 
                                onClick={() => onNavigate(ViewEnum.USED_CARS)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-gray-800 font-semibold hover:border-purple-500 hover:text-purple-700 transition-colors"
                            >
                                {t('home.recent.viewAll')}
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {recentVehicles.map((vehicle, index) => (
                                <div
                                    key={vehicle.id}
                                    onClick={() => onSelectVehicle(vehicle)}
                                    className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 hover:shadow-2xl transition-all duration-300 cursor-pointer group"
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
                                            <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-black shadow-md">
                                                {t('common.newBadge')}
                                            </span>
                                            {showVerifiedListingBadge(vehicle) && (
                                                <span className="bg-green-600 text-white px-2.5 py-1 rounded-full text-[10px] font-black shadow-md">
                                                    {t('common.verified')}
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setQuickViewVehicle(vehicle);
                                            }}
                                            className="absolute bottom-3 left-3 z-[1] rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 shadow-md backdrop-blur-sm"
                                        >
                                            {t('home.quickView')}
                                        </button>
                                        <div className="absolute bottom-3 right-3 bg-gray-900/90 text-white px-3 py-1.5 rounded-xl shadow-lg">
                                            <span className="font-black text-sm">₹{(vehicle.price / 100000).toFixed(2)}L</span>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-black text-gray-900 text-lg leading-tight">
                                                {vehicle.year} {vehicle.make} {vehicle.model}
                                            </h3>
                                            <span className="text-xs px-2 py-1 rounded-full bg-purple-50 text-purple-700 font-semibold">
                                                {vehicle.fuelType}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                                            <span>{vehicle.mileage.toLocaleString()} km</span>
                                            <span>•</span>
                                            <span>{vehicle.transmission || t('common.manual')}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-gray-600 mt-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            <span className="text-sm font-semibold">{vehicle.city || t('common.notAvailable')}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : showSkeletons ? (
                <div className="py-10 md:py-14 px-4 bg-white border-t border-gray-100/80">
                    <div className="max-w-7xl mx-auto">
                        <div className="h-6 bg-gray-100 rounded w-52 mb-3 animate-pulse" />
                        <div className="h-4 bg-gray-100 rounded w-80 mb-8 animate-pulse" />
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {Array.from({ length: 4 }).map((_, idx) => skeletonCard(`recent-${idx}`))}
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Explore by Location Section - Premium Style */}
            <div className="py-10 md:py-14 px-4 bg-gradient-to-b from-gray-50 to-white border-t border-gray-100/80">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-8 space-y-2">
                        <button className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-full mb-0 font-black text-xs uppercase tracking-wider shadow-lg">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {t('home.cities.badge')}
                        </button>
                        <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">{t('home.cities.title')}</h2>
                        <p className="text-gray-600 text-base md:text-lg max-w-2xl mx-auto leading-snug md:leading-relaxed">{t('home.cities.subtitle')}</p>
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center justify-center md:justify-between gap-3">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-700 font-semibold text-sm">
                                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                                {t('home.cities.topFirst')}
                            </div>
                            <button 
                                onClick={() => onNavigate(ViewEnum.USED_CARS)}
                                className="inline-flex items-center gap-2 text-purple-700 font-semibold hover:underline decoration-2 underline-offset-4"
                            >
                                {t('home.cities.viewAllLocations')}
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex flex-wrap justify-center gap-3 md:gap-4">
                            {topCities.map((city, index) => (
                                <button
                                    key={index}
                                    onClick={() => {
                                        onSelectCity(city.name);
                                    }}
                                    className="group inline-flex items-center gap-3 px-4 md:px-5 py-3 rounded-full bg-white border border-gray-200 shadow-sm hover:border-purple-500 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                                >
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white bg-gradient-to-r ${city.gradient} shadow-inner`}>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </div>
                                    <div className="flex flex-col items-start text-left">
                                        <span className="text-sm font-semibold text-gray-900">{city.name}</span>
                                        <span className="text-xs text-gray-500">{t('home.cities.carCount', { count: city.cars })}</span>
                                    </div>
                                    <div className="ml-auto flex items-center gap-1 text-purple-600 text-xs font-semibold">
                                        <span>{city.abbr}</span>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Why Choose Us */}
            <div className="py-10 md:py-12 px-4 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-t border-gray-100">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
                    {whyChooseItems.map((item, idx) => (
                        <div key={idx} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex gap-3 items-start hover:shadow-lg transition-shadow">
                            <div className="text-2xl">{item.icon}</div>
                            <div>
                                <div className="font-black text-gray-900 text-base">{item.title}</div>
                                <div className="text-sm text-gray-600 mt-1">{item.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Testimonials / Logos */}
            <div className="py-10 md:py-12 px-4 bg-white border-t border-gray-100/80">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-6 space-y-2">
                        <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">{t('home.testimonials.title')}</h2>
                        <p className="text-gray-600 text-base md:text-lg max-w-2xl mx-auto leading-snug md:leading-normal">{t('home.testimonials.subtitle')}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {testimonialItems.map((item, idx) => (
                            <div key={idx} className="bg-gray-50 rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center font-bold">
                                        {item.name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900 text-sm">{item.name}</div>
                                        <div className="text-xs text-purple-600 font-semibold">{item.tag}</div>
                                    </div>
                                </div>
                                <p className="text-gray-700 text-sm leading-relaxed">“{item.quote}”</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Vehicle Categories Section - Premium Style */}
            <div className="py-10 md:py-14 px-4 bg-gray-50/60 border-t border-gray-100/80">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-8 space-y-2">
                        <button className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white px-6 py-2.5 rounded-full mb-0 font-black text-xs uppercase tracking-wider shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                            {t('home.categories.badge')}
                        </button>
                        <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">{t('home.categories.title')}</h2>
                        <p className="text-gray-600 text-base md:text-lg max-w-2xl mx-auto leading-snug md:leading-relaxed">{t('home.categories.subtitle')}</p>
                    </div>

                    <div className="flex flex-wrap justify-center gap-3 md:gap-4">
                        {categoriesWithCounts.map((category, index) => (
                            <button
                                key={index}
                                type="button"
                                onClick={() => {
                                    onSelectCategory(category.id);
                                    onNavigate(ViewEnum.USED_CARS);
                                }}
                                className="group inline-flex items-center gap-3 px-4 md:px-5 py-3 rounded-full bg-white border border-gray-200 shadow-sm hover:border-blue-600 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                            >
                                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-lg bg-gradient-to-br ${category.gradient} text-white shadow-inner`}>
                                    <span>{category.icon}</span>
                                </div>
                                <div className="flex flex-col items-start text-left">
                                    <span className="text-sm font-semibold text-gray-900">{category.name}</span>
                                    <span className="text-xs text-gray-500">{t('home.categories.vehicleCount', { count: category.vehicles })}</span>
                                </div>
                                <svg className="w-4 h-4 text-blue-600 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sell Car Steps Section - as per provided design */}
            <div className="py-10 md:py-14 px-4 bg-white border-t border-gray-100/80">
                <div className="max-w-6xl mx-auto text-center">
                    <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-8 md:mb-10 tracking-tight">{t('home.sell.title')}</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 mb-8">
                        {sellSteps.map((item, idx) => (
                            <div key={idx} className="flex flex-col items-center text-center gap-3">
                                <div className="relative">
                                    <div className={`h-40 w-40 rounded-full bg-gradient-to-br ${item.accent} opacity-90 blur-2xl absolute inset-0`} />
                                    <div className="relative h-40 w-40 rounded-full bg-gradient-to-br from-white to-gray-100 border border-gray-200 shadow-md flex items-center justify-center text-5xl">
                                        <span role="img" aria-label={item.title}>{item.emoji}</span>
                                    </div>
                                </div>
                                <h3 className="text-lg font-black text-gray-900">{item.title}</h3>
                                <p className="text-sm text-gray-600 leading-snug max-w-xs">{item.desc}</p>
                                <button
                                    onClick={() => onNavigate(ViewEnum.SELL_CAR)}
                                    className="inline-flex items-center gap-1 text-purple-700 font-semibold hover:underline decoration-2 underline-offset-4"
                                >
                                    {item.cta}
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <button
                            onClick={() => onNavigate(ViewEnum.SELL_CAR)}
                            className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-purple-700 text-white font-bold shadow-lg hover:bg-purple-800 transition-colors"
                        >
                            {t('home.sell.watchHow')}
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                        <button
                            onClick={() => onNavigate(ViewEnum.SELL_CAR)}
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-gray-300 text-gray-800 font-semibold hover:border-purple-500 hover:text-purple-700 transition-colors"
                        >
                            {t('home.sell.learnMore')}
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Trending Now / Popular Dealers - Premium Style */}
            {featuredVehicles.length > 4 && (
                <div className="py-10 md:py-14 px-4 bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-50 border-t border-amber-100/80">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-8 space-y-2">
                            <button className="inline-flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-full mb-0 font-black text-xs uppercase tracking-wider shadow-lg">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                </svg>
                                {t('home.trending.badge')}
                            </button>
                            <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">{t('home.trending.title')}</h2>
                            <p className="text-gray-600 text-base md:text-lg max-w-2xl mx-auto leading-snug md:leading-relaxed mb-4">{t('home.trending.subtitle')}</p>
                            <button 
                                onClick={() => onNavigate(ViewEnum.USED_CARS)}
                                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl font-bold text-base md:text-lg flex items-center gap-2 mx-auto transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
                            >
                                {t('home.trending.viewAll')}
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Car Service Section - Premium Style */}
            <div 
                className="relative py-12 md:py-16 px-4 text-white overflow-hidden border-t border-white/10"
                style={{
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #6366f1 100%)'
                }}
            >
                {/* Animated Background Elements */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
                </div>
                <div className="relative max-w-5xl mx-auto text-center">
                    <button className="inline-flex items-center gap-2 bg-purple-500/90 backdrop-blur-sm px-5 py-2.5 rounded-full mb-4 font-black text-xs uppercase tracking-wider shadow-lg">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {t('home.service.badge')}
                    </button>
                    <h2 className="text-4xl md:text-5xl font-black mb-3 leading-tight">{t('home.service.title')}</h2>
                    <p className="text-lg md:text-xl text-white/90 mb-8 max-w-3xl mx-auto leading-snug md:leading-relaxed">
                        {t('home.service.subtitle')}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                        <div className="bg-white/15 backdrop-blur-xl rounded-2xl p-8 border border-white/30 hover:bg-white/20 transition-all duration-300 hover:scale-105">
                            <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-xl">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <h3 className="font-black text-lg mb-3">{t('home.service.card1Title')}</h3>
                            <p className="text-white/90 text-base">{t('home.service.card1Desc')}</p>
                        </div>
                        <div className="bg-white/15 backdrop-blur-xl rounded-2xl p-8 border border-white/30 hover:bg-white/20 transition-all duration-300 hover:scale-105">
                            <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-xl">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <h3 className="font-black text-lg mb-3">{t('home.service.card2Title')}</h3>
                            <p className="text-white/90 text-base">{t('home.service.card2Desc')}</p>
                        </div>
                        <div className="bg-white/15 backdrop-blur-xl rounded-2xl p-8 border border-white/30 hover:bg-white/20 transition-all duration-300 hover:scale-105">
                            <div className="w-16 h-16 bg-pink-500 rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-xl">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="font-black text-lg mb-3">{t('home.service.card3Title')}</h3>
                            <p className="text-white/90 text-base">{t('home.service.card3Desc')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick View Modal */}
            <QuickViewModal
                vehicle={quickViewVehicle}
                onClose={() => setQuickViewVehicle(null)}
                onSelectVehicle={onSelectVehicle}
                onToggleCompare={onToggleCompare}
                onToggleWishlist={onToggleWishlist}
                comparisonList={comparisonList}
                wishlist={wishlist}
            />
        </div>
    );
};

export default Home;