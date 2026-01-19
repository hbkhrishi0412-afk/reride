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
  onViewSellerProfile,
  recommendations,
  allVehicles,
  onNavigate,
  onSelectCity
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const carouselRef = useRef<HTMLDivElement>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Featured Vehicles</h2>
            <button
              onClick={() => onNavigate(ViewEnum.USED_CARS)}
              className="text-sm text-orange-500 font-semibold"
            >
              View All
            </button>
          </div>
          
          <div
            ref={carouselRef}
            className="flex overflow-x-auto snap-x snap-mandatory gap-4 -mx-4 px-4"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {displayedFeaturedVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="flex-shrink-0 w-[calc(100%-2rem)] snap-center"
                onClick={() => onSelectVehicle(vehicle)}
              >
                <div className="bg-white rounded-xl shadow-lg overflow-hidden active:scale-[0.98] transition-transform">
                  <div className="relative h-48">
                    <img
                      src={optimizeImageUrl(getFirstValidImage(vehicle.images), 800, 85)}
                      alt={`${vehicle.make} ${vehicle.model}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                      Verified
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWishlist(vehicle.id);
                      }}
                      className="absolute top-3 right-3 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center"
                      style={{ minWidth: '44px', minHeight: '44px' }}
                    >
                      <svg
                        className={`w-5 h-5 ${wishlist.includes(vehicle.id) ? 'fill-red-500 text-red-500' : 'text-gray-700'}`}
                        fill={wishlist.includes(vehicle.id) ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 mb-1">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </h3>
                    <p className="text-lg font-bold text-orange-500 mb-2">
                      {formatCurrency(vehicle.price)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                      <span>{vehicle.mileage.toLocaleString()} km</span>
                      <span>•</span>
                      <span>{vehicle.fuelType}</span>
                      <span>•</span>
                      <span>{vehicle.transmission}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      <span>{vehicle.city || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
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

      {/* Categories Section */}
      <div className="px-4 py-6 bg-white border-t border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Browse by Category</h2>
        <div className="grid grid-cols-5 gap-3">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => {
                onSelectCategory(category.id);
                onNavigate(ViewEnum.USED_CARS);
              }}
              className="flex flex-col items-center gap-2 p-3 bg-gray-50 rounded-xl active:scale-95 transition-transform"
            >
              <span className="text-3xl">{category.icon}</span>
              <span className="text-xs font-medium text-gray-700 text-center leading-tight">
                {category.name}
              </span>
              <span className="text-[10px] text-gray-500">{category.count} cars</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cities Section */}
      <div className="px-4 py-6 bg-white border-t border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Explore by Location</h2>
          <button
            onClick={() => onNavigate(ViewEnum.USED_CARS)}
            className="text-sm text-orange-500 font-semibold"
          >
            View All
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
          {cities.map((city, idx) => (
            <button
              key={idx}
              onClick={() => {
                onSelectCity(city.name);
                onNavigate(ViewEnum.USED_CARS);
              }}
              className="flex-shrink-0 bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl p-4 text-white min-w-[110px] active:scale-95 transition-transform"
            >
              <div className="text-2xl font-bold mb-1">{city.abbr}</div>
              <div className="text-xs font-medium">{city.name}</div>
              <div className="text-[11px] text-white/90 mt-1">{city.count} cars</div>
            </button>
          ))}
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

