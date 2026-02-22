import React, { memo } from 'react';
import type { Vehicle } from '../types';
import { getFirstValidImage } from '../utils/imageUtils';
import LazyImage from './LazyImage';
import StarRating from './StarRating';

interface VehicleTileProps {
  vehicle: Vehicle;
  onSelect: (vehicle: Vehicle) => void;
  onToggleCompare: (id: number) => void;
  isSelectedForCompare: boolean;
  onToggleWishlist: (id: number) => void;
  isInWishlist: boolean;
  isCompareDisabled: boolean;
  onViewSellerProfile: (sellerEmail: string) => void;
}

const VehicleTile: React.FC<VehicleTileProps> = ({ vehicle, onSelect, onToggleCompare, isSelectedForCompare, onToggleWishlist, isInWishlist, isCompareDisabled, onViewSellerProfile }) => {
  
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

  return (
    <div 
      onClick={() => onSelect(vehicle)}
      className="bg-white rounded-xl shadow-soft overflow-hidden transform hover:-translate-y-1 hover:shadow-soft-lg transition-all duration-300 flex cursor-pointer group hover:ring-2 ring-offset-2 dark:ring-offset-brand-gray-dark" style={{ ['--ring-color' as any]: 'var(--reride-orange)' }} onMouseEnter={(e) => e.currentTarget.style.outline = '2px solid var(--reride-orange)'} onMouseLeave={(e) => e.currentTarget.style.outline = ''}
    >
      <LazyImage
        src={getFirstValidImage(vehicle.images, vehicle.id)}
        alt={`${vehicle.make} ${vehicle.model}`}
        className="w-32 sm:w-48 h-full object-cover flex-shrink-0"
        width={400}
        quality={80}
      />
      
      <div className="p-4 flex flex-col flex-grow">
        {/* Title: Year Make Model Variant */}
        <h3 className="text-sm sm:text-base font-bold text-reride-text-dark dark:text-reride-text-dark">
            {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.variant || ''}
        </h3>
        
        {/* Specifications - 2 lines */}
        <div className="mt-2 flex-grow flex flex-col gap-y-1 text-xs text-brand-gray-600 dark:text-reride-text">
          {/* First Line: Mileage, Fuel Type, Transmission */}
          <div className="grid grid-cols-3 gap-x-2">
            <span>{`${Math.round(vehicle.mileage / 1000)}K km`}</span>
            <span>{vehicle.fuelType}</span>
            <span>{vehicle.transmission}</span>
          </div>
          {/* Second Line: Location, RTO */}
          <div className="grid grid-cols-2 gap-x-4">
            <span>{vehicle.location ? `HUB - ${vehicle.location}` : `HUB - ${vehicle.city || 'N/A'}`}</span>
            {vehicle.rto && <span>{vehicle.rto}</span>}
          </div>
        </div>

        <div className="mt-auto pt-2 border-t border-gray-200">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <p className="text-base sm:text-lg font-extrabold" style={{ color: '#FF6B35' }}>₹{(vehicle.price / 100000).toFixed(2)} Lakh</p>
          </div>
          <div className="flex justify-between items-center mt-1">
             <p className="text-xs text-gray-600 font-medium">EMI ₹{Math.round(vehicle.price / 60).toLocaleString('en-IN')}/m*</p>
             <div className="flex items-center gap-2">
                <button
                  onClick={handleWishlistClick}
                  className="p-2 rounded-full hover:bg-reride-light-gray dark:hover:bg-brand-gray-700 transition-colors"
                  aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-colors ${isInWishlist ? 'text-reride-orange' : 'text-gray-400'}`} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={handleCompareClick}
                  disabled={isCompareDisabled}
                  className={`p-2 rounded-full hover:bg-reride-light-gray dark:hover:bg-brand-gray-700 transition-colors ${isCompareDisabled ? 'opacity-50 cursor-not-allowed' : ''}`} style={isSelectedForCompare ? { backgroundColor: 'rgba(255, 107, 53, 0.1)' } : undefined}
                  aria-label={isSelectedForCompare ? "Remove from comparison" : "Add to comparison"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: isSelectedForCompare ? 'var(--reride-orange)' : undefined }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(VehicleTile);