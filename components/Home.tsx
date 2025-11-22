

import React, { useState, useEffect, useRef } from 'react';
import type { Vehicle, VehicleCategory, View } from '../types';
import { View as ViewEnum, VehicleCategory as CategoryEnum } from '../types';
import { getFirstValidImage } from '../utils/imageUtils';
import LazyImage from './LazyImage';
import QuickViewModal from './QuickViewModal';

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
    allVehicles: Vehicle[];
    onNavigate: (view: View) => void;
    onSelectCity: (city: string) => void;
}

const categoryIcons: Record<VehicleCategory, React.ReactNode> = {
    [CategoryEnum.FOUR_WHEELER]: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9.25 15.8059C8.33333 16.3562 7 17.4641 7 19C7 20.5359 8.33333 21.6438 9.25 22.1941M14.75 15.8059C15.6667 16.3562 17 17.4641 17 19C17 20.5359 15.6667 21.6438 14.75 22.1941M16 7H8L7 11H17L16 7Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M17 11V15.5C17 16.8807 15.8807 18 14.5 18C13.1193 18 12 16.8807 12 15.5V13.5M7 11V15.5C7 16.8807 8.11929 18 9.5 18C10.8807 18 12 16.8807 12 15.5V13.5M12 13.5V11M12 11H17H7M15.5 4L15 7H9L8.5 4H15.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    [CategoryEnum.TWO_WHEELER]: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 11.5C4 10.1193 5.11929 9 6.5 9H12.5V12.5C12.5 14.1569 11.1569 15.5 9.5 15.5H6.5C5.11929 15.5 4 14.3807 4 13V11.5Z" stroke="currentColor" strokeWidth="1.5"/><path d="M15.5 19.5C17.7091 19.5 19.5 17.7091 19.5 15.5C19.5 13.2909 17.7091 11.5 15.5 11.5C13.2909 11.5 11.5 13.2909 11.5 15.5C11.5 17.7091 13.2909 19.5 15.5 19.5Z" stroke="currentColor" strokeWidth="1.5"/><path d="M5.5 19.5C7.70914 19.5 9.5 17.7091 9.5 15.5C9.5 13.2909 7.70914 11.5 5.5 11.5C3.29086 11.5 1.5 13.2909 1.5 15.5C1.5 17.7091 3.29086 19.5 5.5 19.5Z" stroke="currentColor" strokeWidth="1.5"/><path d="M12.5 12.5L16.5 6.5H20.5L18 10.5H12.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    [CategoryEnum.THREE_WHEELER]: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M17 19.5C18.3807 19.5 19.5 18.3807 19.5 17C19.5 15.6193 18.3807 14.5 17 14.5C15.6193 14.5 14.5 15.6193 14.5 17C14.5 18.3807 15.6193 19.5 17 19.5Z" stroke="currentColor" strokeWidth="1.5"/><path d="M7 19.5C8.38071 19.5 9.5 18.3807 9.5 17C9.5 15.6193 8.38071 14.5 7 14.5C5.61929 14.5 4.5 15.6193 4.5 17C4.5 18.3807 5.61929 19.5 7 19.5Z" stroke="currentColor" strokeWidth="1.5"/><path d="M12 9C13.6569 9 15 7.65685 15 6C15 4.34315 13.6569 3 12 3C10.3431 3 9 4.34315 9 6C9 7.65685 10.3431 9 12 9Z" stroke="currentColor" strokeWidth="1.5"/><path d="M17 14.5H19L21 9H15L14 14.5H9.5M9.5 14.5L9 11H3.5L3 12.5H9.5M9.5 14.5H14.5M12 9V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    [CategoryEnum.COMMERCIAL]: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M3 13L3 18.25C3 19.2165 4.02944 20 5.25 20H18.75C19.9706 20 21 19.2165 21 18.25V13M3 13V8.75C3 7.7835 4.02944 7 5.25 7H9.75C10.9706 7 12 7.7835 12 8.75V13M3 13H12M12 13H21M21 13V8.75C21 7.7835 19.9706 7 18.75 7H13.5L12 4H7L5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    [CategoryEnum.FARM]: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M18 19.5C20.4853 19.5 22.5 17.4853 22.5 15C22.5 12.5147 20.4853 10.5 18 10.5C15.5147 10.5 13.5 12.5147 13.5 15C13.5 17.4853 15.5147 19.5 18 19.5Z" stroke="currentColor" strokeWidth="1.5"/><path d="M7 19.5C9.48528 19.5 11.5 17.4853 11.5 15C11.5 12.5147 9.48528 10.5 7 10.5C4.51472 10.5 2.5 12.5147 2.5 15C2.5 17.4853 4.51472 19.5 7 19.5Z" stroke="currentColor" strokeWidth="1.5"/><path d="M13.5 15H11.5M7 10.5V6.5L9.5 4.5H13.5V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    [CategoryEnum.CONSTRUCTION]: <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M2 17L4 17M4 17L4.47143 16.1143C5.2381 14.6667 6.42857 14 8 14H12C14.6667 14 16.6667 12.3333 18 10L22 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 17L6 21H11L14 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M9.5 14L7.5 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};

const FeaturedVehicleCard: React.FC<Pick<HomeProps, 'onSelectVehicle' | 'onToggleWishlist' | 'wishlist'> & { vehicle: Vehicle; }> = ({ vehicle, onSelectVehicle, onToggleWishlist, wishlist }) => {
    const isInWishlist = wishlist.includes(vehicle.id);
  
    // Abbreviate transmission for better display
    const getTransmissionDisplay = (transmission: string | undefined): string => {
      if (!transmission) return 'N/A';
      const lower = transmission.toLowerCase();
      if (lower.includes('automatic') || lower === 'auto') return 'Auto';
      if (lower.includes('manual')) return 'Manual';
      if (lower.includes('cvt')) return 'CVT';
      if (lower.includes('amt')) return 'AMT';
      return transmission.length > 6 ? transmission.substring(0, 6) : transmission;
    };
  
    const handleWishlistClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleWishlist(vehicle.id);
    };
  
    return (
      <div 
        onClick={() => onSelectVehicle(vehicle)}
        className="group cursor-pointer bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-100 hover:border-blue-200 hover:-translate-y-2 aspect-[3/4] flex flex-col"
      >
        {/* Image Container */}
        <div className="relative overflow-hidden flex-shrink-0" style={{ height: '50%' }}>
          <LazyImage
            src={getFirstValidImage(vehicle.images)}
            alt={`${vehicle.make} ${vehicle.model}`}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            width={800}
            quality={80}
          />
          
          {/* Verified Badge - Top Left (Green) */}
          <div className="absolute top-3 left-3">
            <div className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
              </svg>
              <span>Verified</span>
            </div>
          </div>
          
          {/* Wishlist Button - Top Right (White Heart) */}
          <div className="absolute top-3 right-3">
            <button
              onClick={handleWishlistClick}
              className="p-2 rounded-full bg-white/90 backdrop-blur-sm text-gray-600 hover:bg-white transition-colors shadow-lg"
            >
              <svg className="h-5 w-5" fill={isInWishlist ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
              </svg>
            </button>
          </div>
          
          {/* Price Badge - Bottom Right */}
          <div className="absolute bottom-3 right-3">
            <div className="bg-gray-900/80 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-lg">
              <span className="text-sm font-bold text-white">
                ₹{(vehicle.price / 100000).toFixed(2)}L
              </span>
            </div>
          </div>
        </div>
        
        {/* Content Section */}
        <div className="p-4 flex-grow flex flex-col">
          {/* Vehicle Title - Large and Bold */}
          <div className="mb-2">
            <h3 className="text-lg font-bold text-gray-900 leading-tight">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h3>
            {vehicle.variant && (
              <p className="text-sm text-gray-600 mt-0.5">{vehicle.variant}</p>
            )}
          </div>
          
          {/* Specs - Three icons with text */}
          <div className="flex items-center gap-4 my-3 text-xs text-gray-600">
            {/* Clock Icon - Mileage */}
            <div className="flex items-center gap-1">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 10.586V6z" clipRule="evenodd" />
              </svg>
              <span>{vehicle.mileage.toLocaleString()}...</span>
            </div>
            
            {/* Fuel Pump Icon */}
            <div className="flex items-center gap-1">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
              </svg>
              <span>{vehicle.fuelType}</span>
            </div>
            
            {/* Gear Icon - Transmission */}
            <div className="flex items-center gap-1">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
              </svg>
              <span>{getTransmissionDisplay(vehicle.transmission)}</span>
            </div>
          </div>
          
          {/* Location - Bottom with purple bold text */}
          <div className="mt-auto pt-3">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
              </svg>
              <span className="text-base font-bold" style={{ color: '#9333EA' }}>
                {vehicle.city || vehicle.location || 'Location N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
};

const Home: React.FC<HomeProps> = ({ onSearch, onSelectCategory, featuredVehicles, onSelectVehicle, onToggleCompare, comparisonList, onToggleWishlist, wishlist, recommendations, allVehicles, onNavigate, onSelectCity }) => {
    const [aiSearchQuery, setAiSearchQuery] = useState('');
    const [isAiSearching, setIsAiSearching] = useState(false);
    const [quickViewVehicle, setQuickViewVehicle] = useState<Vehicle | null>(null);
    const cityScrollRef = useRef<HTMLDivElement>(null);
    const categoryScrollRef = useRef<HTMLDivElement>(null);
    const [recentlyViewed, setRecentlyViewed] = useState<Vehicle[]>([]);

    // Analytics tracking functions
    const trackFeaturedCarsClick = (vehicleId: number, vehicleMake: string, vehicleModel: string) => {
        console.log('Analytics: Featured Cars click', { 
            vehicleId, 
            vehicleMake, 
            vehicleModel, 
            section: 'premium_spotlight',
            timestamp: new Date().toISOString()
        });
        // TODO: Integrate with your analytics service (Google Analytics, Mixpanel, etc.)
    };

    const trackPopularCarsClick = (vehicleId: number, vehicleMake: string, vehicleModel: string) => {
        console.log('Analytics: Popular Cars click', { 
            vehicleId, 
            vehicleMake, 
            vehicleModel, 
            section: 'featured_badge',
            timestamp: new Date().toISOString()
        });
        // TODO: Integrate with your analytics service (Google Analytics, Mixpanel, etc.)
    };

    const trackSectionView = (sectionName: string) => {
        console.log('Analytics: Section view', { 
            section: sectionName,
            timestamp: new Date().toISOString()
        });
        // TODO: Integrate with your analytics service
    };

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.1 });
    
        const targets = document.querySelectorAll('.scroll-animate');
        targets.forEach(target => observer.observe(target));
    
        return () => targets.forEach(target => observer.unobserve(target));
      }, []);

    useEffect(() => {
        const getViewedIds = (): number[] => {
            try {
                const viewedJson = localStorage.getItem('viewedVehicleIds');
                return viewedJson ? JSON.parse(viewedJson) : [];
            } catch (error) {
                console.error("Failed to get viewed vehicle IDs:", error);
                return [];
            }
        };

        const viewedIds = getViewedIds();
        if (viewedIds.length > 0) {
            const vehicleMap = new Map((allVehicles || []).map(v => [v.id, v]));
            const viewedVehiclesInOrder = viewedIds.map(id => vehicleMap.get(id)).filter((v): v is Vehicle => !!v);
            setRecentlyViewed(viewedVehiclesInOrder.slice(0, 5));
        }
    }, [allVehicles]);

    const handleAiSearch = async () => {
        if (!aiSearchQuery.trim()) return;
        setIsAiSearching(true);
        try {
            // Navigate to vehicle list with the search query
            onSearch(aiSearchQuery);
            setIsAiSearching(false);
        } catch (error) {
            console.error('AI search failed:', error);
            setIsAiSearching(false);
        }
    };

    return (
        <div 
            className="relative w-full"
            style={{
                background: 'linear-gradient(180deg, #6366F1 0%, #8B5CF6 40%, #A855F7 70%, #EC4899 100%)',
                minHeight: '100vh'
            }}
        >
            {/* Premium Hero Section with Full-Screen Gradient */}
            <section 
                className="relative min-h-screen flex items-center justify-center overflow-hidden"
                style={{
                    minHeight: '100vh',
                    position: 'relative'
                }}
            >
                {/* Premium Background with Multiple Layers */}
                <div 
                    className="absolute inset-0"
                    style={{
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.95) 0%, rgba(139, 92, 246, 0.95) 30%, rgba(168, 85, 247, 0.95) 60%, rgba(236, 72, 153, 0.95) 100%)'
                    }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 via-transparent to-orange-500/20"></div>
                
                {/* Animated Background Elements */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-white/10 to-transparent rounded-full animate-pulse"></div>
                    <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-orange-500/20 to-transparent rounded-full animate-pulse" style={{animationDelay: '2s'}}></div>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full animate-pulse" style={{animationDelay: '4s'}}></div>
                </div>
                
                {/* Content */}
                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    {/* Premium Badge */}
                    <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-6 py-2 mb-8 animate-fade-in">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-white/90 font-medium text-xs">Trusted by 1M+ Customers</span>
                    </div>
                    
                    {/* Main Heading with Premium Typography */}
                    <h1 className="text-3xl md:text-4xl font-black mb-6 text-white leading-tight">
                        <span className="bg-gradient-to-r from-white via-blue-100 to-orange-100 bg-clip-text text-transparent">
                            Premium Used Cars
                        </span>
                    </h1>
                    
                    {/* Subtitle */}
                    <p className="text-base md:text-lg mb-12 text-white/90 font-light max-w-3xl mx-auto leading-relaxed">
                        Discover exceptional vehicles with our comprehensive quality assurance and premium service
                    </p>
                    
                    {/* Premium Search Bar */}
                    <div className="max-w-4xl mx-auto mb-16">
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-3xl blur-xl"></div>
                            <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl p-3 shadow-2xl border border-white/20">
                                <div className="flex flex-col lg:flex-row gap-3">
                                    <div className="flex-1 relative">
                                        <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        <input
                                            type="text"
                                            placeholder="Search by brand, model, budget or features..."
                                            value={aiSearchQuery}
                                            onChange={(e) => setAiSearchQuery(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleAiSearch(); }}
                                            className="w-full pl-12 pr-4 py-4 text-gray-900 border-0 focus:outline-none rounded-2xl bg-transparent placeholder-gray-500 text-base font-medium"
                                        />
                                    </div>
                                    <button 
                                        onClick={handleAiSearch}
                                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-2xl font-semibold text-base transition-all duration-300 transform hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                        disabled={isAiSearching}
                                    >
                                        {isAiSearching ? (
                                            <div className="flex items-center gap-3">
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                <span>Searching...</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span>Search</span>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                                </svg>
                                            </div>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Premium Trust Badges */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
                        <div className="group bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 hover:bg-white/20 transition-all duration-300 hover:scale-105 hover:shadow-xl">
                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                                    </svg>
                                </div>
                                <h3 className="text-white font-bold text-sm mb-1">200+ Quality Checks</h3>
                                <p className="text-white/80 text-xs">Comprehensive inspection</p>
                            </div>
                        </div>
                        
                        <div className="group bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 hover:bg-white/20 transition-all duration-300 hover:scale-105 hover:shadow-xl">
                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" />
                                    </svg>
                                </div>
                                <h3 className="text-white font-bold text-sm mb-1">Fixed Price</h3>
                                <p className="text-white/80 text-xs">No hidden costs</p>
                            </div>
                        </div>
                        
                        <div className="group bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 hover:bg-white/20 transition-all duration-300 hover:scale-105 hover:shadow-xl">
                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                                    </svg>
                                </div>
                                <h3 className="text-white font-bold text-sm mb-1">5-Day Money Back</h3>
                                <p className="text-white/80 text-xs">Risk-free purchase</p>
                            </div>
                        </div>
                        
                        <div className="group bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 hover:bg-white/20 transition-all duration-300 hover:scale-105 hover:shadow-xl">
                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                                        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" />
                                    </svg>
                                </div>
                                <h3 className="text-white font-bold text-sm mb-1">Free RC Transfer</h3>
                                <p className="text-white/80 text-xs">Complete documentation</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Scroll Indicator */}
                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 animate-bounce z-10">
                    <div className="w-8 h-12 border-2 border-white/80 rounded-full flex justify-center bg-white/10 backdrop-blur-sm">
                        <div className="w-2 h-4 bg-white rounded-full mt-3 animate-pulse"></div>
                    </div>
                </div>
            </section>
            
            {/* Spotlight Section - Boosted Listings */}
            {(() => {
                const spotlightVehicles = allVehicles.filter(v => 
                    v.activeBoosts?.some(boost => 
                        boost.type === 'homepage_spotlight' && 
                        boost.isActive && 
                        new Date(boost.expiresAt) > new Date()
                    ) && v.status === 'published'
                );
                
                if (spotlightVehicles.length > 0) {
                    return (
                        <section className="py-16 bg-gradient-to-br from-yellow-50 to-orange-50">
                            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                                <div className="text-center mb-12">
                                    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-2 rounded-full text-sm font-semibold mb-4">
                                        <span>⭐</span>
                                        <span>HOMEPAGE SPOTLIGHT</span>
                                    </div>
                                    <h2 className="text-4xl font-bold text-gray-900 mb-4">Premium Listings</h2>
                                    <p className="text-gray-600 text-lg">Discover our most promoted vehicles with maximum visibility</p>
                                </div>
                                
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {(spotlightVehicles || []).slice(0, 2).map((vehicle) => (
                                        <div key={vehicle.id} className="bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                                            <div className="relative">
                                                <LazyImage
                                                    src={getFirstValidImage(vehicle.images)}
                                                    alt={`${vehicle.make} ${vehicle.model}`}
                                                    className="w-full h-64 object-cover"
                                                    width={800}
                                                    quality={80}
                                                />
                                                <div className="absolute top-4 left-4">
                                                    <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2">
                                                        <span>⭐</span>
                                                        <span>SPOTLIGHT</span>
                                                    </div>
                                                </div>
                                                <div className="absolute top-4 right-4">
                                                    <div className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full">
                                                        <span className="text-lg font-bold text-gray-900">₹{vehicle.price.toLocaleString('en-IN')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="p-6">
                                                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                                    {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.variant || ''}
                                                </h3>
                                                <div className="flex items-center gap-4 text-gray-600 mb-4">
                                                    <span className="flex items-center gap-1">
                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
                                                        </svg>
                                                        {vehicle.mileage.toLocaleString('en-IN')} km
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                                                        </svg>
                                                        {vehicle.city}
                                                    </span>
                                                </div>
                                                
                                                <button
                                                    onClick={() => onSelectVehicle(vehicle)}
                                                    className="w-full bg-gradient-to-r from-spinny-orange to-spinny-blue text-white py-3 px-6 rounded-lg font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                                                >
                                                    View Details
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {spotlightVehicles.length > 2 && (
                                    <div className="text-center mt-8">
                                        <button 
                                            onClick={() => onNavigate(ViewEnum.USED_CARS)}
                                            className="bg-white text-spinny-orange border-2 border-spinny-orange px-8 py-3 rounded-lg font-semibold hover:bg-spinny-orange hover:text-white transition-all duration-300"
                                        >
                                            View All Spotlight Listings ({spotlightVehicles.length})
                                        </button>
                                    </div>
                                )}
                            </div>
                        </section>
                    );
                }
                return null;
            })()}

            {/* Premium Featured Cars Section */}
            <section 
                className="py-24 bg-gradient-to-br from-slate-50 via-white to-blue-50 relative overflow-hidden"
                onMouseEnter={() => trackSectionView('featured_cars')}
            >
                {/* Background Elements */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-20 right-20 w-72 h-72 bg-gradient-to-br from-blue-200/30 to-purple-200/30 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-20 left-20 w-96 h-96 bg-gradient-to-tr from-orange-200/20 to-pink-200/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
                </div>
                
                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Premium Section Header */}
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-full text-sm font-bold mb-6 shadow-lg">
                            <span className="text-lg">🔥</span>
                            <span>FEATURED COLLECTION</span>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black mb-6 bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
                            Premium Vehicles
                        </h2>
                        <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                            Handpicked vehicles that meet our highest standards of quality and performance
                        </p>
                    </div>
                    
                    {/* Premium Vehicle Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {(featuredVehicles || []).slice(0, 8).map((vehicle, index) => (
                            <div 
                                key={vehicle.id}
                                onClick={() => trackFeaturedCarsClick(vehicle.id, vehicle.make, vehicle.model)}
                                className="transform transition-all duration-500 hover:scale-105"
                                style={{animationDelay: `${index * 100}ms`}}
                            >
                                <FeaturedVehicleCard
                                    vehicle={vehicle}
                                    onSelectVehicle={onSelectVehicle}
                                    onToggleWishlist={onToggleWishlist}
                                    wishlist={wishlist}
                                />
                            </div>
                        ))}
                    </div>
                    
                    {/* Premium CTA */}
                    <div className="text-center mt-16">
                        <button 
                            onClick={() => onNavigate(ViewEnum.USED_CARS)}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center gap-3 mx-auto"
                        >
                            <span>Explore All Vehicles</span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </button>
                    </div>
                </div>
            </section>

            {/* Premium Browse by City Section */}
            <section className="py-24 bg-gradient-to-br from-gray-50 via-white to-slate-50 relative overflow-hidden">
                {/* Background Elements */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-10 left-10 w-64 h-64 bg-gradient-to-br from-blue-100/40 to-purple-100/40 rounded-full blur-2xl"></div>
                    <div className="absolute bottom-10 right-10 w-80 h-80 bg-gradient-to-tr from-orange-100/30 to-pink-100/30 rounded-full blur-2xl"></div>
                </div>
                
                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Premium Section Header */}
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-6 py-2 rounded-full text-sm font-bold mb-6 shadow-lg">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                            </svg>
                            <span>EXPLORE BY LOCATION</span>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black mb-6 bg-gradient-to-r from-gray-900 via-indigo-800 to-blue-800 bg-clip-text text-transparent">
                            Find Cars Near You
                        </h2>
                        <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                            Discover premium vehicles available in your city with local sellers and dealers
                        </p>
                    </div>
                    
                    {/* Premium City Cards - Scrollable Carousel */}
                    <div className="relative" style={{ minHeight: '288px' }}>
                        {/* Fixed Scroll Buttons - Outside scrollable container */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (cityScrollRef.current) {
                                    cityScrollRef.current.scrollBy({ left: -300, behavior: 'smooth' });
                                }
                            }}
                            className="absolute left-2 z-20 w-12 h-12 bg-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 border border-gray-200"
                            style={{ top: 'calc(50% - 2rem)' }}
                            aria-label="Scroll left"
                        >
                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (cityScrollRef.current) {
                                    cityScrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
                                }
                            }}
                            className="absolute right-2 z-20 w-12 h-12 bg-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 border border-gray-200"
                            style={{ top: 'calc(50% - 2rem)' }}
                            aria-label="Scroll right"
                        >
                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                        
                        <div ref={cityScrollRef} className="overflow-x-auto scrollbar-hide pb-4 -mx-4 px-12">
                            <div className="flex gap-6 min-w-max">
                                {[
                                    { name: 'Delhi NCR', initials: 'DN', colorClass: 'bg-gradient-to-br from-yellow-400 to-yellow-500', textColor: 'text-purple-900', diamondColor: 'bg-amber-50', diamondBorder: 'border-gray-900', diamondText: 'text-gray-900' },
                                    { name: 'Hyderabad', initials: 'HY', colorClass: 'bg-gradient-to-br from-purple-600 to-purple-700', textColor: 'text-white', diamondColor: 'bg-blue-500', diamondBorder: 'border-purple-300', diamondText: 'text-white' },
                                    { name: 'Bangalore', initials: 'BA', colorClass: 'bg-gradient-to-br from-indigo-400 to-indigo-500', textColor: 'text-white', diamondColor: 'bg-purple-700', diamondBorder: 'border-indigo-300', diamondText: 'text-gray-900' },
                                    { name: 'Pune', initials: 'PU', colorClass: 'bg-gradient-to-br from-teal-500 to-teal-600', textColor: 'text-white', diamondColor: 'bg-amber-50', diamondBorder: 'border-teal-300', diamondText: 'text-gray-900' },
                                    { name: 'Mumbai', initials: 'MU', colorClass: 'bg-gradient-to-br from-pink-500 to-pink-600', textColor: 'text-white', diamondColor: 'bg-orange-500', diamondBorder: 'border-pink-300', diamondText: 'text-white' },
                                    { name: 'Chennai', initials: 'CH', colorClass: 'bg-gradient-to-br from-blue-500 to-blue-600', textColor: 'text-white', diamondColor: 'bg-blue-100', diamondBorder: 'border-blue-300', diamondText: 'text-gray-900' },
                                    { name: 'Ahmedabad', initials: 'AH', colorClass: 'bg-gradient-to-br from-orange-500 to-orange-600', textColor: 'text-white', diamondColor: 'bg-orange-100', diamondBorder: 'border-orange-300', diamondText: 'text-gray-900' },
                                    { name: 'Kolkata', initials: 'KO', colorClass: 'bg-gradient-to-br from-cyan-500 to-cyan-600', textColor: 'text-white', diamondColor: 'bg-cyan-100', diamondBorder: 'border-cyan-300', diamondText: 'text-gray-900' },
                                ].map((cityData, index) => {
                                    const cityName = cityData.name === 'Delhi NCR' ? 'New Delhi' : cityData.name === 'Bangalore' ? 'Bengaluru' : cityData.name;
                                    const cityVehicles = (allVehicles || []).filter(v => v.city === cityName && v.status === 'published');
                                    // Calculate hubs based on vehicle count (stable calculation)
                                    const carsCount = cityVehicles.length;
                                    const hubsCount = Math.max(1, Math.floor(carsCount / 200) + (index % 3));
                                    
                                    return (
                                        <button
                                            key={cityData.name}
                                            onClick={() => {
                                                onSelectCity(cityName);
                                            }}
                                            className={`group relative flex-shrink-0 w-56 h-72 ${cityData.colorClass} rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 hover:scale-105 overflow-hidden`}
                                            style={{animationDelay: `${index * 100}ms`}}
                                        >
                                            {/* Background Pattern */}
                                            <div className="absolute inset-0 opacity-10">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-2xl"></div>
                                                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full blur-xl"></div>
                                            </div>
                                            
                                            {/* Content */}
                                            <div className="relative z-10 h-full flex flex-col p-5">
                                                {/* City Name */}
                                                <h3 className={`text-lg font-bold mb-4 text-center ${cityData.textColor} group-hover:scale-105 transition-transform duration-300`}>
                                                    {cityData.name}
                                                </h3>
                                                
                                                {/* Diamond-shaped Initials */}
                                                <div className="flex-1 flex items-center justify-center mb-4">
                                                    <div className={`relative w-24 h-24 transform rotate-45 ${cityData.diamondColor} rounded-xl shadow-lg border-2 ${cityData.diamondBorder} group-hover:scale-110 group-hover:rotate-[48deg] transition-all duration-500 flex items-center justify-center`}>
                                                        <span className={`-rotate-45 text-2xl font-black ${cityData.diamondText}`}>
                                                            {cityData.initials}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                {/* Metrics */}
                                                <div className={`text-center ${cityData.textColor === 'text-white' ? 'text-gray-900' : cityData.textColor} mt-auto`}>
                                                    <p className="text-sm font-semibold mb-0.5">{hubsCount} hubs</p>
                                                    <p className="text-lg font-bold">{carsCount.toLocaleString()}+ cars</p>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        
                        {/* View All Locations Button */}
                        <div className="flex justify-center mt-8">
                            <button
                                onClick={() => onNavigate(ViewEnum.USED_CARS)}
                                className="px-8 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-full font-semibold text-sm hover:bg-purple-600 hover:text-white transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                            >
                                View all locations
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Premium Categories Section */}
            <section className="py-24 bg-gradient-to-br from-white via-gray-50 to-blue-50 relative overflow-hidden">
                {/* Background Elements */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-20 right-20 w-80 h-80 bg-gradient-to-br from-purple-200/20 to-pink-200/20 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-20 left-20 w-96 h-96 bg-gradient-to-tr from-blue-200/15 to-indigo-200/15 rounded-full blur-3xl animate-pulse" style={{animationDelay: '3s'}}></div>
                </div>
                
                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Premium Section Header */}
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-full text-sm font-bold mb-6 shadow-lg">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                            </svg>
                            <span>VEHICLE CATEGORIES</span>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black mb-6 bg-gradient-to-r from-gray-900 via-purple-800 to-pink-800 bg-clip-text text-transparent">
                            Browse by Category
                        </h2>
                        <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                            Find the perfect vehicle type that matches your needs and lifestyle
                        </p>
                    </div>
                    
                    {/* Premium Category Cards - Scrollable Carousel */}
                    <div className="relative" style={{ minHeight: '288px' }}>
                        {/* Fixed Scroll Buttons - Outside scrollable container */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (categoryScrollRef.current) {
                                    categoryScrollRef.current.scrollBy({ left: -300, behavior: 'smooth' });
                                }
                            }}
                            className="absolute left-2 z-20 w-12 h-12 bg-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 border border-gray-200"
                            style={{ top: 'calc(50% - 2rem)' }}
                            aria-label="Scroll left"
                        >
                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (categoryScrollRef.current) {
                                    categoryScrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
                                }
                            }}
                            className="absolute right-2 z-20 w-12 h-12 bg-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 border border-gray-200"
                            style={{ top: 'calc(50% - 2rem)' }}
                            aria-label="Scroll right"
                        >
                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                        
                        <div ref={categoryScrollRef} className="overflow-x-auto scrollbar-hide pb-4 -mx-4 px-12">
                            <div className="flex gap-6 min-w-max">
                                {[
                                    { category: CategoryEnum.FOUR_WHEELER, name: 'Four Wheeler', initials: 'FW', colorClass: 'bg-gradient-to-br from-blue-500 to-blue-600', textColor: 'text-white', diamondColor: 'bg-blue-100', diamondBorder: 'border-blue-300', diamondText: 'text-gray-900' },
                                    { category: CategoryEnum.TWO_WHEELER, name: 'Two Wheeler', initials: 'TW', colorClass: 'bg-gradient-to-br from-green-500 to-green-600', textColor: 'text-white', diamondColor: 'bg-green-100', diamondBorder: 'border-green-300', diamondText: 'text-gray-900' },
                                    { category: CategoryEnum.THREE_WHEELER, name: 'Three Wheeler', initials: 'TH', colorClass: 'bg-gradient-to-br from-orange-500 to-orange-600', textColor: 'text-white', diamondColor: 'bg-orange-100', diamondBorder: 'border-orange-300', diamondText: 'text-gray-900' },
                                    { category: CategoryEnum.COMMERCIAL, name: 'Commercial', initials: 'CM', colorClass: 'bg-gradient-to-br from-purple-600 to-purple-700', textColor: 'text-white', diamondColor: 'bg-purple-100', diamondBorder: 'border-purple-300', diamondText: 'text-gray-900' },
                                    { category: CategoryEnum.FARM, name: 'Farm', initials: 'FM', colorClass: 'bg-gradient-to-br from-yellow-400 to-yellow-500', textColor: 'text-purple-900', diamondColor: 'bg-amber-50', diamondBorder: 'border-gray-900', diamondText: 'text-gray-900' },
                                    { category: CategoryEnum.CONSTRUCTION, name: 'Construction', initials: 'CN', colorClass: 'bg-gradient-to-br from-red-500 to-red-600', textColor: 'text-white', diamondColor: 'bg-red-100', diamondBorder: 'border-red-300', diamondText: 'text-gray-900' },
                                ].map((categoryData, index) => {
                                    const categoryVehicles = (allVehicles || []).filter(v => v.category === categoryData.category && v.status === 'published');
                                    const vehiclesCount = categoryVehicles.length;
                                    const hubsCount = Math.max(1, Math.floor(vehiclesCount / 200) + (index % 3));
                                    
                                    return (
                                        <button
                                            key={categoryData.category}
                                            onClick={() => onSelectCategory(categoryData.category)}
                                            className={`group relative flex-shrink-0 w-56 h-72 ${categoryData.colorClass} rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 hover:scale-105 overflow-hidden`}
                                            style={{animationDelay: `${index * 100}ms`}}
                                        >
                                            {/* Background Pattern */}
                                            <div className="absolute inset-0 opacity-10">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-2xl"></div>
                                                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full blur-xl"></div>
                                            </div>
                                            
                                            {/* Content */}
                                            <div className="relative z-10 h-full flex flex-col p-5">
                                                {/* Category Name */}
                                                <h3 className={`text-lg font-bold mb-4 text-center ${categoryData.textColor} group-hover:scale-105 transition-transform duration-300`}>
                                                    {categoryData.name}
                                                </h3>
                                                
                                                {/* Diamond-shaped Icon */}
                                                <div className="flex-1 flex items-center justify-center mb-4">
                                                    <div className={`relative w-24 h-24 transform rotate-45 ${categoryData.diamondColor} rounded-xl shadow-lg border-2 ${categoryData.diamondBorder} group-hover:scale-110 group-hover:rotate-[48deg] transition-all duration-500 flex items-center justify-center`}>
                                                        <div className="-rotate-45" style={{ color: '#000000' }}>
                                                            {categoryIcons[categoryData.category]}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Metrics */}
                                                <div className={`text-center ${categoryData.textColor === 'text-white' ? 'text-gray-900' : categoryData.textColor} mt-auto`}>
                                                    <p className="text-sm font-semibold mb-0.5">{hubsCount} hubs</p>
                                                    <p className="text-lg font-bold">{vehiclesCount.toLocaleString()}+ vehicles</p>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Premium Recommended Section */}
            {recommendations.length > 0 && (
                 <section className="py-20 bg-white relative overflow-hidden">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-16 animate-fadeInUp">
                             <h2 className="text-3xl md:text-4xl font-bold mb-4 premium-text-gradient">
                                 Recommended For You
                             </h2>
                             <p className="text-lg text-spinny-text-dark max-w-2xl mx-auto">
                                 Handpicked vehicles based on your preferences and market trends
                             </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                            {(recommendations || []).map((vehicle, index) => (
                                <div 
                                    key={vehicle.id}
                                    className="animate-fadeInUp"
                                    style={{animationDelay: `${index * 0.1}s`}}
                                >
                                    <FeaturedVehicleCard
                                        vehicle={vehicle} 
                                        onSelectVehicle={onSelectVehicle} 
                                        onToggleWishlist={onToggleWishlist} 
                                        wishlist={wishlist} 
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* Background decorative elements */}
                    <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 animate-float" style={{ background: 'radial-gradient(circle, rgba(30, 136, 229, 0.1), rgba(30, 136, 229, 0.1))' }}></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-spinny-white to-spinny-blue rounded-full opacity-20 animate-float" style={{animationDelay: '2s'}}></div>
                </section>
            )}

            {/* Premium Popular Cars Section */}
            <section 
                className="py-24 bg-gradient-to-br from-orange-50 via-white to-red-50 relative overflow-hidden"
                onMouseEnter={() => trackSectionView('popular_cars')}
            >
                {/* Background Elements */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-20 left-20 w-80 h-80 bg-gradient-to-br from-orange-200/30 to-red-200/30 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-20 right-20 w-96 h-96 bg-gradient-to-tr from-yellow-200/20 to-orange-200/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
                </div>
                
                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Premium Section Header */}
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-2 rounded-full text-sm font-bold mb-6 shadow-lg">
                            <span className="text-lg">⭐</span>
                            <span>TRENDING NOW</span>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black mb-6 bg-gradient-to-r from-gray-900 via-orange-800 to-red-800 bg-clip-text text-transparent">
                            Popular Vehicles
                        </h2>
                        <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                            Discover what other buyers are choosing - trending vehicles with great value
                        </p>
                    </div>
                    
                    {/* Premium Vehicle Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {(featuredVehicles || []).slice(8, 20).map((vehicle, index) => (
                            <div 
                                key={vehicle.id}
                                onClick={() => trackPopularCarsClick(vehicle.id, vehicle.make, vehicle.model)}
                                className="transform transition-all duration-500 hover:scale-105"
                                style={{animationDelay: `${index * 100}ms`}}
                            >
                                <FeaturedVehicleCard
                                    vehicle={vehicle} 
                                    onSelectVehicle={onSelectVehicle} 
                                    onToggleWishlist={onToggleWishlist} 
                                    wishlist={wishlist} 
                                />
                            </div>
                        ))}
                    </div>
                    
                    {/* Premium CTA */}
                    <div className="text-center mt-16">
                        <button 
                            onClick={() => onSearch('')} 
                            className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center gap-3 mx-auto"
                        >
                            <span>View All Vehicles</span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </button>
                    </div>
                </div>
            </section>

            {/* Premium Recently Viewed Section */}
            {recentlyViewed.length > 0 && (
                <section className="py-24 bg-gradient-to-br from-indigo-50 via-white to-purple-50 relative overflow-hidden">
                    {/* Background Elements */}
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute top-20 right-20 w-80 h-80 bg-gradient-to-br from-indigo-200/20 to-purple-200/20 rounded-full blur-3xl animate-pulse"></div>
                        <div className="absolute bottom-20 left-20 w-96 h-96 bg-gradient-to-tr from-blue-200/15 to-indigo-200/15 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
                    </div>
                    
                    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        {/* Premium Section Header */}
                        <div className="text-center mb-16">
                            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2 rounded-full text-sm font-bold mb-6 shadow-lg">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd"/>
                                </svg>
                                <span>RECENTLY VIEWED</span>
                            </div>
                            <h2 className="text-4xl md:text-5xl font-black mb-6 bg-gradient-to-r from-gray-900 via-indigo-800 to-purple-800 bg-clip-text text-transparent">
                                Continue Your Journey
                            </h2>
                            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                                Pick up where you left off with vehicles you've recently explored
                            </p>
                        </div>
                        
                        {/* Premium Vehicle Carousel */}
                        <div className="flex overflow-x-auto space-x-6 pb-6 -mx-4 px-4 scrollbar-hide">
                            {(recentlyViewed || []).map((vehicle, index) => (
                                <div key={vehicle.id} className="flex-shrink-0 w-80 transform transition-all duration-500 hover:scale-105" style={{animationDelay: `${index * 100}ms`}}>
                                    <FeaturedVehicleCard
                                        vehicle={vehicle} 
                                        onSelectVehicle={onSelectVehicle} 
                                        onToggleWishlist={onToggleWishlist} 
                                        wishlist={wishlist} 
                                    />
                                </div>
                            ))}
                        </div>
                        
                        {/* Premium CTA */}
                        <div className="text-center mt-12">
                            <button 
                                onClick={() => onNavigate(ViewEnum.WISHLIST)} 
                                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center gap-3 mx-auto"
                            >
                                <span>View All Saved</span>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </section>
            )}
            
            {/* Premium Seller CTA Section */}
            <section className="py-24 bg-gradient-to-br from-slate-900 via-gray-900 to-black relative overflow-hidden">
                {/* Background Elements */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-20 left-20 w-80 h-80 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-20 right-20 w-96 h-96 bg-gradient-to-tr from-orange-500/15 to-pink-500/15 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
                </div>
                
                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    {/* Premium Content */}
                    <div className="max-w-4xl mx-auto">
                        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-full text-sm font-bold mb-8 shadow-lg">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
                            </svg>
                            <span>FOR SELLERS</span>
                        </div>
                        
                        <h2 className="text-4xl md:text-6xl font-black mb-8 text-white leading-tight">
                            <span className="bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent">
                                Ready to Sell?
                            </span>
                        </h2>
                        
                        <p className="text-xl md:text-2xl mb-12 text-gray-300 max-w-3xl mx-auto leading-relaxed">
                            Join thousands of successful sellers on our premium marketplace. 
                            Reach qualified buyers with our advanced AI tools and marketing features.
                        </p>
                        
                        {/* Premium Features Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                            <div className="group bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                </div>
                                <h3 className="text-white font-bold text-lg mb-2">AI-Powered Listing</h3>
                                <p className="text-gray-400 text-sm">Smart optimization for maximum visibility</p>
                            </div>
                            
                            <div className="group bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300">
                                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                                    </svg>
                                </div>
                                <h3 className="text-white font-bold text-lg mb-2">Premium Pricing</h3>
                                <p className="text-gray-400 text-sm">Get the best value for your vehicle</p>
                            </div>
                            
                            <div className="group bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300">
                                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.01 1.01L6.5 9.5l.5 1.5 1.5-.5 1.5.5.5-1.5L9.5 9.5l1.5-1.5a1 1 0 01-.01-1.01L11.153 4H13a1 1 0 011 1v1a1 1 0 01-1 1H3a1 1 0 01-1-1V3z"/>
                                    </svg>
                                </div>
                                <h3 className="text-white font-bold text-lg mb-2">Marketing Tools</h3>
                                <p className="text-gray-400 text-sm">Advanced promotion and analytics</p>
                            </div>
                        </div>
                        
                        {/* Premium CTA Button */}
                        <button 
                            onClick={() => onNavigate(ViewEnum.SELLER_LOGIN)} 
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-12 py-6 rounded-2xl font-bold text-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex items-center gap-4 mx-auto"
                        >
                            <span>Start Selling Now</span>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </button>
                    </div>
                </div>
            </section>
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