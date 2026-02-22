import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View as ViewEnum, VehicleCategory, type Vehicle } from '../types';
import { getFirstValidImage, optimizeImageUrl } from '../utils/imageUtils';
import { matchesCity } from '../utils/cityMapping';
import MobileVehicleCard from './MobileVehicleCard';

interface MobileHomePageProps {
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
  allVehicles: Vehicle[];
  onNavigate: (view: ViewEnum) => void;
  onSelectCity: (city: string) => void;
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
  onSelectCity
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const carouselRef = useRef<HTMLDivElement>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const touchStartData = useRef<Map<number, { x: number; y: number; time: number }>>(new Map());

  const publishedVehicles = useMemo(
    () => allVehicles.filter(vehicle => vehicle && vehicle.status === 'published'),
    [allVehicles]
  );

  // Memoize static data to prevent recreation on every render
  const baseCities = useMemo(() => [
    { name: 'Delhi NCR', abbr: 'DN' },
    { name: 'Hyderabad', abbr: 'HY' },
    { name: 'Bangalore', abbr: 'BA' },
    { name: 'Pune', abbr: 'PU' },
    { name: 'Mumbai', abbr: 'MU' },
  ], []);

  const cities = useMemo(() => baseCities.map(city => ({
    ...city,
    count: publishedVehicles.filter(vehicle => matchesCity(vehicle.city, city.name)).length,
  })), [baseCities, publishedVehicles]);

  const baseCategories = useMemo(() => [
    { name: 'Four Wheeler', icon: '🚗', id: VehicleCategory.FOUR_WHEELER },
    { name: 'Two Wheeler', icon: '🏍️', id: VehicleCategory.TWO_WHEELER },
    { name: 'Three Wheeler', icon: '🛺', id: VehicleCategory.THREE_WHEELER },
    { name: 'Commercial', icon: '🚚', id: VehicleCategory.COMMERCIAL },
    { name: 'Farm', icon: '🚜', id: VehicleCategory.FARM },
  ], []);

  const categoryCounts = useMemo(() => publishedVehicles.reduce((acc, vehicle) => {
    if (vehicle?.category) {
      acc[vehicle.category] = (acc[vehicle.category] || 0) + 1;
    }
    return acc;
  }, {} as Record<VehicleCategory, number>), [publishedVehicles]);

  const categories = useMemo(() => baseCategories.map(category => ({
    ...category,
    count: categoryCounts[category.id] || 0
  })), [baseCategories, categoryCounts]);

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
    if (trimmedQuery) {
      onSearch(trimmedQuery);
      onNavigate(ViewEnum.USED_CARS);
    } else {
      onNavigate(ViewEnum.USED_CARS);
    }
  }, [searchQuery, onSearch, onNavigate]);

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }, []);

  // Memoize featured vehicles slice to prevent unnecessary re-renders
  const displayedFeaturedVehicles = useMemo(
    () => featuredVehicles,
    [featuredVehicles]
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Hero Section */}
      <div
        className="relative pt-4 pb-8 px-4"
        style={{
          background: 'linear-gradient(180deg, #6A2D9D 0%, #D24B9F 100%)',
        }}
      >
        {/* Trust Badge */}
        <div className="flex items-center justify-center mb-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-white text-xs font-medium">Trusted by 1M+ Customers</span>
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-white mb-2 text-center">Premium Used Cars</h1>
        <p className="text-white/90 text-sm text-center mb-6 px-4">
          Discover exceptional vehicles with comprehensive quality assurance
        </p>

        {/* Search Bar */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by brand, model, budget..."
              className="flex-1 outline-none text-gray-700 placeholder-gray-400"
              style={{ minHeight: '44px' }}
            />
            <button
              onClick={handleSearch}
              className="bg-orange-500 text-white px-4 py-2.5 rounded-xl font-semibold flex-shrink-0"
              style={{ minHeight: '44px' }}
            >
              Search
            </button>
          </div>
        </div>

        {/* Feature Pills */}
        <div className="grid grid-cols-4 gap-2 mt-6">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
            <svg className="w-6 h-6 text-white mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <p className="text-white text-xs font-medium">200+ Checks</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
            <svg className="w-6 h-6 text-white mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-white text-xs font-medium">Fixed Price</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
            <svg className="w-6 h-6 text-white mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p className="text-white text-xs font-medium">Money Back</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
            <svg className="w-6 h-6 text-white mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-white text-xs font-medium">Free RC</p>
          </div>
        </div>
      </div>

      {/* Featured Vehicles Carousel */}
      {featuredVehicles.length > 0 ? (
        <div className="px-4 py-6 bg-white">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Featured Vehicles</h2>
              <p className="text-xs text-gray-500">Handpicked quality vehicles</p>
            </div>
            <button
              onClick={() => onNavigate(ViewEnum.USED_CARS)}
              className="text-sm text-orange-500 font-semibold flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-orange-50 active:scale-95 transition-all"
            >
              View All
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          <div
            ref={carouselRef}
            className="flex overflow-x-auto snap-x snap-mandatory gap-4 -mx-4 px-4"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {displayedFeaturedVehicles.map((vehicle) => {
              const handleTouchStart = (e: React.TouchEvent) => {
                touchStartData.current.set(vehicle.id, {
                  x: e.touches[0].clientX,
                  y: e.touches[0].clientY,
                  time: Date.now()
                });
              };
              
              const handleTouchEnd = (e: React.TouchEvent) => {
                const touchStart = touchStartData.current.get(vehicle.id);
                if (!touchStart) return;
                
                const touchEnd = {
                  x: e.changedTouches[0].clientX,
                  y: e.changedTouches[0].clientY,
                  time: Date.now()
                };
                
                const deltaX = Math.abs(touchEnd.x - touchStart.x);
                const deltaY = Math.abs(touchEnd.y - touchStart.y);
                const deltaTime = touchEnd.time - touchStart.time;
                
                // If it's a tap (small movement, short time) and not a scroll
                if (deltaX < 10 && deltaY < 10 && deltaTime < 300) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onSelectVehicle) {
                    onSelectVehicle(vehicle);
                  }
                }
                
                touchStartData.current.delete(vehicle.id);
              };
              
              const handleClick = (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                if (onSelectVehicle) {
                  onSelectVehicle(vehicle);
                }
              };
              
              return (
                <div
                  key={vehicle.id}
                  className="flex-shrink-0 w-[calc(100%-2rem)] snap-center cursor-pointer"
                  onClick={handleClick}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  <div className="bg-white rounded-2xl shadow-xl overflow-hidden active:scale-[0.98] transition-all duration-300 hover:shadow-2xl border border-gray-100 cursor-pointer">
                  <div className="relative h-52 overflow-hidden">
                    <img
                      src={optimizeImageUrl(getFirstValidImage(vehicle.images, vehicle.id), 800, 85)}
                      alt={`${vehicle.make} ${vehicle.model}`}
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
                    
                    {/* Verified Badge - Premium Style */}
                    <div className="absolute top-3 left-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Verified
                    </div>
                    
                    {/* Wishlist Button - Premium Style */}
                    <button
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
                  <div className="p-5">
                    <h3 className="font-bold text-lg text-gray-900 mb-2 leading-tight">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </h3>
                    <div className="flex items-baseline gap-2 mb-3">
                      <p className="text-2xl font-black text-orange-500">
                        {formatCurrency(vehicle.price)}
                      </p>
                      <span className="text-xs text-gray-500 line-through opacity-60">
                        {formatCurrency(vehicle.price * 1.1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-3 flex-wrap">
                      <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-lg">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {vehicle.mileage.toLocaleString()} km
                      </span>
                      <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-lg">
                        {vehicle.fuelType}
                      </span>
                      <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-lg">
                        {vehicle.transmission}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 pt-2 border-t border-gray-100">
                      <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="font-medium">{vehicle.city || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
            })}
          </div>

          {/* Carousel Indicators */}
          {displayedFeaturedVehicles.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              {displayedFeaturedVehicles.map((_, idx) => (
                <button
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
        <div className="px-4 py-6 bg-white">
          <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-center">
            <p className="text-gray-800 font-semibold mb-1">No featured vehicles yet</p>
            <p className="text-gray-500 text-sm mb-4">Browse all cars to see what’s available.</p>
            <button
              onClick={() => onNavigate(ViewEnum.USED_CARS)}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg font-semibold active:scale-95 transition-transform w-full"
              style={{ minHeight: '44px' }}
            >
              Browse All Cars
            </button>
          </div>
        </div>
      )}

      {/* Categories Section - Premium Design */}
      <div className="px-4 py-6 bg-gradient-to-b from-white to-gray-50">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-bold text-gray-900">Browse by Category</h2>
          <button
            onClick={() => onNavigate(ViewEnum.USED_CARS)}
            className="text-sm text-orange-500 font-semibold flex items-center gap-1"
          >
            View All
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-5 gap-2.5">
          {categories.map((category, index) => {
            // Define gradient backgrounds for each category
            const categoryGradients: Record<VehicleCategory, string> = {
              [VehicleCategory.FOUR_WHEELER]: 'from-blue-500 to-indigo-600',
              [VehicleCategory.TWO_WHEELER]: 'from-red-500 to-pink-600',
              [VehicleCategory.THREE_WHEELER]: 'from-yellow-500 to-orange-600',
              [VehicleCategory.COMMERCIAL]: 'from-purple-500 to-violet-600',
              [VehicleCategory.FARM]: 'from-green-500 to-emerald-600',
              [VehicleCategory.CONSTRUCTION]: 'from-gray-500 to-slate-600',
            };
            
            const gradient = categoryGradients[category.id] || 'from-gray-500 to-gray-600';
            const hasVehicles = category.count > 0;
            
            return (
              <button
                key={category.id}
                onClick={() => {
                  onSelectCategory(category.id);
                  onNavigate(ViewEnum.USED_CARS);
                }}
                className="group relative flex flex-col items-center gap-2.5 p-3.5 bg-white rounded-2xl shadow-sm border border-gray-100 active:scale-95 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                style={{
                  animationDelay: `${index * 50}ms`,
                  minHeight: '100px'
                }}
              >
                {/* Gradient Background on Hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-2xl opacity-0 group-active:opacity-5 group-hover:opacity-10 transition-opacity duration-300`}></div>
                
                {/* Icon Container with Gradient */}
                <div className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all duration-300`}>
                  <span className="text-2xl relative z-10">{category.icon}</span>
                  {/* Shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl"></div>
                </div>
                
                {/* Category Name */}
                <span className="text-xs font-bold text-gray-900 text-center leading-tight group-hover:text-orange-600 transition-colors duration-300">
                  {category.name}
                </span>
                
                {/* Car Count Badge */}
                <div className={`flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-300 ${
                  hasVehicles 
                    ? 'bg-orange-100 text-orange-600 group-hover:bg-orange-200' 
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  <span>{category.count}</span>
                  <span className="ml-0.5">cars</span>
                </div>
                
                {/* Active Indicator */}
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cities Section */}
      <div className="px-4 py-6 bg-gradient-to-b from-white to-gray-50">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Explore by Location</h2>
            <p className="text-xs text-gray-500">Find vehicles near you</p>
          </div>
          <button
            onClick={() => onNavigate(ViewEnum.USED_CARS)}
            className="text-sm text-orange-500 font-semibold flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-orange-50 active:scale-95 transition-all"
          >
            View All
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {cities.map((city, idx) => {
            // Define vibrant, premium gradients for each city - matching the design
            // Using inline styles to ensure colors always render correctly
            const gradientStyles = [
              // Purple gradient (Hyderabad) - #A855F7 to #7C3AED to #6D28D9
              { background: 'linear-gradient(135deg, #A855F7 0%, #9333EA 50%, #7C3AED 100%)' },
              // Pink/Red gradient (Bangalore) - #EC4899 to #F43F5E to #DC2626
              { background: 'linear-gradient(135deg, #EC4899 0%, #F43F5E 50%, #DC2626 100%)' },
              // Green gradient (Pune) - #4ADE80 to #10B981 to #14B8A6
              { background: 'linear-gradient(135deg, #4ADE80 0%, #10B981 50%, #14B8A6 100%)' },
              // Purple/Violet gradient (Mumbai) - #8B5CF6 to #9333EA to #D946EF
              { background: 'linear-gradient(135deg, #8B5CF6 0%, #9333EA 50%, #D946EF 100%)' },
              // Orange gradient (fallback) - #F97316 to #EA580C to #DC2626
              { background: 'linear-gradient(135deg, #F97316 0%, #EA580C 50%, #DC2626 100%)' },
            ];
            const gradientStyle = gradientStyles[idx % gradientStyles.length];
            const hasVehicles = city.count > 0;
            
            return (
              <button
                key={idx}
                onClick={() => {
                  onSelectCity(city.name);
                  onNavigate(ViewEnum.USED_CARS);
                }}
                className="group flex-shrink-0 rounded-full p-5 text-white w-[135px] h-[135px] active:scale-95 transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-2 relative overflow-hidden border border-white/30 flex items-center justify-center"
                style={{
                  ...gradientStyle,
                  boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15), 0 4px 8px rgba(0, 0, 0, 0.1)'
                }}
              >
                {/* Animated Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-3xl transform translate-x-8 -translate-y-8 group-hover:scale-150 transition-transform duration-500"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full blur-2xl transform -translate-x-6 translate-y-6 group-hover:scale-125 transition-transform duration-500"></div>
                </div>
                
                {/* Shine effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                {/* Content */}
                <div className="relative z-10 flex flex-col items-center justify-center text-center">
                  {/* City Abbreviation - Large and Bold */}
                  <div className="text-3xl font-black mb-1.5 drop-shadow-lg leading-none tracking-tight">
                    {city.abbr}
                  </div>
                  
                  {/* City Name */}
                  <div className="text-xs font-bold mb-2 text-white/95 leading-tight px-2">
                    {city.name}
                  </div>
                  
                  {/* Car Count Badge - Premium Glassmorphism Style */}
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full backdrop-blur-md transition-all duration-300 ${
                    hasVehicles 
                      ? 'bg-white/30 hover:bg-white/40 shadow-lg border border-white/40' 
                      : 'bg-white/20 border border-white/30'
                  }`}
                  style={{
                    backdropFilter: 'blur(12px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(12px) saturate(180%)'
                  }}>
                    <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                      <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                    </svg>
                    <span className="text-[10px] font-black text-white">
                      {city.count}
                    </span>
                  </div>
                  
                  {/* Arrow indicator on hover */}
                  <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="px-4 py-6 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Recommended For You</h2>
            <button
              onClick={() => onNavigate(ViewEnum.USED_CARS)}
              className="text-sm text-orange-500 font-semibold"
            >
              View All
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
                onToggleWishlist={() => onToggleWishlist(vehicle.id)}
                onToggleCompare={() => onToggleCompare(vehicle.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sell Your Car CTA */}
      <div className="px-4 py-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white mx-4 mb-6 rounded-xl">
        <h2 className="text-xl font-bold mb-2">Ready to Sell?</h2>
        <p className="text-white/90 text-sm mb-4">List your vehicle and reach thousands of buyers</p>
        <button
          onClick={() => onNavigate(ViewEnum.SELL_CAR)}
          className="w-full bg-white text-orange-500 py-3 rounded-xl font-semibold active:scale-95 transition-transform"
          style={{ minHeight: '48px' }}
        >
          Sell Your Car
        </button>
      </div>
    </div>
  );
});

MobileHomePage.displayName = 'MobileHomePage';

export default MobileHomePage;

