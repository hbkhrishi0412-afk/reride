import React, { memo } from 'react';
import type { Vehicle } from '../types.js';
import StarRating from './StarRating.js';
import BadgeDisplay from './BadgeDisplay.js';
import { getFirstValidImage, optimizeImageUrl } from '../utils/imageUtils.js';
import LazyImage from './LazyImage.js';

interface VehicleCardProps {
  vehicle: Vehicle;
  onSelect: (vehicle: Vehicle) => void;
  onToggleCompare: (id: number) => void;
  isSelectedForCompare: boolean;
  onToggleWishlist: (id: number) => void;
  isInWishlist: boolean;
  isCompareDisabled: boolean;
  onViewSellerProfile: (sellerEmail: string) => void;
  onQuickView: (vehicle: Vehicle) => void;
}

const SpecIcon: React.FC<{ icon: React.ReactNode, text: string }> = ({ icon, text }) => (
    <div className="flex items-center gap-1.5 text-xs sm:text-sm text-brand-gray-600 dark:text-spinny-text">
        {icon}
        <span>{text}</span>
    </div>
);

const VehicleCard: React.FC<VehicleCardProps> = ({ vehicle, onSelect, onToggleCompare, isSelectedForCompare, onToggleWishlist, isInWishlist, isCompareDisabled, onViewSellerProfile, onQuickView }) => {
  
  const handleCompareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCompareDisabled) return;
    onToggleCompare(vehicle.id);
  };

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleWishlist(vehicle.id);
  };

  const handleSellerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewSellerProfile(vehicle.sellerEmail);
  };

  const handleQuickViewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('VehicleCard QuickView button clicked for vehicle:', vehicle.id, vehicle.make, vehicle.model);
    onQuickView(vehicle);
  };

  const handleCardClick = () => {
    console.log('🚗 VehicleCard clicked for vehicle:', vehicle.id, vehicle.make, vehicle.model);
    onSelect(vehicle);
  };

  return (
    <div 
      onClick={handleCardClick}
      className="group cursor-pointer bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-100 hover:border-blue-200 hover:-translate-y-2"
      data-testid="vehicle-card"
    >
      <div className="relative overflow-hidden h-56">
        <LazyImage
          src={optimizeImageUrl(getFirstValidImage(vehicle.images), 800, 80)}
          alt={`${vehicle.make} ${vehicle.model}`}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          data-testid="vehicle-image"
        />
        
        {/* Premium Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        {/* Premium Boost Indicators */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          {/* Homepage Spotlight */}
          {vehicle.activeBoosts?.some(boost => boost.type === 'homepage_spotlight' && boost.isActive && new Date(boost.expiresAt) > new Date()) && (
            <div className="text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 bg-gradient-to-r from-yellow-500 to-orange-500 shadow-lg backdrop-blur-sm">
              <span>⭐</span>
              <span>Spotlight</span>
            </div>
          )}
          
          {/* Top Search Boost */}
          {vehicle.activeBoosts?.some(boost => boost.type === 'top_search' && boost.isActive && new Date(boost.expiresAt) > new Date()) && (
            <div className="text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 bg-gradient-to-r from-blue-500 to-purple-500 shadow-lg backdrop-blur-sm">
              <span>🔝</span>
              <span>Top Search</span>
            </div>
          )}
          
          {/* Featured Badge Boost */}
          {vehicle.activeBoosts?.some(boost => boost.type === 'featured_badge' && boost.isActive && new Date(boost.expiresAt) > new Date()) && (
            <div className="text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 bg-gradient-to-r from-green-500 to-teal-500 shadow-lg backdrop-blur-sm">
              <span>🏆</span>
              <span>Featured</span>
            </div>
          )}
          
          {/* Multi-City Boost */}
          {vehicle.activeBoosts?.some(boost => boost.type === 'multi_city' && boost.isActive && new Date(boost.expiresAt) > new Date()) && (
            <div className="text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 bg-gradient-to-r from-indigo-500 to-blue-500 shadow-lg backdrop-blur-sm">
              <span>🌍</span>
              <span>Multi-City</span>
            </div>
          )}
          
          {/* Legacy Featured Badge */}
          {vehicle.isFeatured && !vehicle.activeBoosts?.some(boost => boost.type === 'featured_badge' && boost.isActive && new Date(boost.expiresAt) > new Date()) && (
            <div className="text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1" style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF8456 100%)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              Featured
            </div>
          )}
        </div>
         <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
            <button
              onClick={handleCompareClick}
              disabled={isCompareDisabled}
              className={`p-2 rounded-full backdrop-blur-sm text-white hover:bg-black/50 transition-colors ${isCompareDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{ backgroundColor: isSelectedForCompare ? 'var(--spinny-orange)' : 'rgba(0,0,0,0.3)' }}
              aria-label={isSelectedForCompare ? "Remove from comparison" : "Add to comparison"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            </button>
            <button
              onClick={handleWishlistClick}
              className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors"
              aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-colors" style={{ color: isInWishlist ? 'var(--spinny-blue)' : 'white' }} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
            </button>
        </div>
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
             <button onClick={handleQuickViewClick} className="bg-white/90 dark:bg-black/80 text-spinny-text-dark dark:text-white font-bold py-2 px-6 rounded-full transform hover:scale-105 transition-transform backdrop-blur-sm">
                Quick View
            </button>
        </div>
      </div>
      <div className="p-3 sm:p-5 flex-grow flex flex-col">
        <div className="flex justify-between items-start">
            <h3 className="text-base leading-tight sm:text-xl sm:leading-normal font-bold text-spinny-text-dark dark:text-spinny-text-dark">{vehicle.make} {vehicle.model} {vehicle.variant || ''}</h3>
            <span className="text-sm sm:text-lg font-semibold text-spinny-text dark:text-spinny-text bg-spinny-off-white dark:bg-brand-gray-700 px-2 py-0.5 rounded">{vehicle.year}</span>
        </div>
        
        <div className="mt-2 text-xs text-spinny-text dark:text-spinny-text truncate">
           By: <button onClick={handleSellerClick} className="font-semibold hover:underline focus:outline-none transition-colors" style={{ color: '#FF6B35' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--spinny-blue)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--spinny-orange)'}>{vehicle.sellerName || 'Seller'}</button>
        </div>

        {vehicle.sellerBadges && vehicle.sellerBadges.length > 0 && (
            <div className="mt-2">
                <BadgeDisplay badges={vehicle.sellerBadges} size="sm" />
            </div>
        )}
        
        <div className="mt-3 pt-3 sm:mt-4 sm:pt-4 border-t border-gray-200-100 dark:border-gray-200-200 grid grid-cols-2 gap-x-2 gap-y-1.5 sm:gap-x-4 sm:gap-y-2">
            <SpecIcon icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: '#1E88E5' }} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 10.586V6z" clipRule="evenodd" /></svg>} text={`${vehicle.mileage.toLocaleString('en-IN')} kms`} />
            <SpecIcon icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: '#1E88E5' }} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" /></svg>} text={vehicle.fuelType} />
            <SpecIcon icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: '#1E88E5' }} viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" /></svg>} text={vehicle.transmission} />
            <SpecIcon icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: '#1E88E5' }} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>} text={`${vehicle.city}, ${vehicle.state}`} />
        </div>

        <div className="mt-auto pt-3 sm:pt-4 flex justify-between items-center">
             <p className="text-xl sm:text-2xl font-extrabold" style={{ color: '#FF6B35' }}>₹{vehicle.price.toLocaleString('en-IN')}</p>
             <div className="flex items-center gap-2">
                <StarRating rating={vehicle?.averageRating || 0} readOnly size="sm"/>
                <span className="text-xs text-spinny-text dark:text-spinny-text">({vehicle?.ratingCount || 0})</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default memo(VehicleCard);