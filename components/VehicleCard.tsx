import React, { memo } from 'react';
import type { Vehicle } from '../types.js';
import StarRating from './StarRating.js';
import { getFirstValidImage } from '../utils/imageUtils.js';
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

const VehicleCard: React.FC<VehicleCardProps> = ({ 
  vehicle, 
  onSelect, 
  onToggleCompare, 
  isSelectedForCompare, 
  onToggleWishlist, 
  isInWishlist, 
  isCompareDisabled, 
  onViewSellerProfile, 
  onQuickView 
}) => {
  
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

  const handleCardClick = () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🚗 VehicleCard clicked for vehicle:', vehicle.id, vehicle.make, vehicle.model);
    }
    onSelect(vehicle);
  };

  const isFeatured = vehicle.isFeatured || vehicle.activeBoosts?.some(boost => 
    (boost.type === 'featured_badge' || boost.type === 'homepage_spotlight') && 
    boost.isActive && 
    new Date(boost.expiresAt) > new Date()
  );

  return (
    <div 
      onClick={handleCardClick}
      className="group cursor-pointer bg-white overflow-hidden flex flex-col"
      style={{
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        fontFamily: "'Poppins', sans-serif",
        transition: 'all 0.3s ease'
      }}
      data-testid="vehicle-card"
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Image Section - Top 50-60% of card */}
      <div className="relative overflow-hidden flex-shrink-0" style={{ height: '55%', minHeight: '200px' }}>
        <LazyImage
          src={getFirstValidImage(vehicle.images)}
          alt={`${vehicle.make} ${vehicle.model}`}
          className="w-full h-full object-cover"
          width={800}
          quality={80}
          data-testid="vehicle-image"
        />
        
        {/* Featured Badge - Top Left */}
        {isFeatured && (
          <div 
            className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full"
            style={{
              background: '#FF7F47',
              borderRadius: '20px',
              fontFamily: "'Poppins', sans-serif"
            }}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-3.5 w-3.5 text-white" 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span 
              className="text-white font-bold"
              style={{ fontSize: '11px' }}
            >
              Featured
            </span>
          </div>
        )}
        
        {/* Action Icons - Top Right (Compare & Favorite) */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          <button
            onClick={handleCompareClick}
            disabled={isCompareDisabled}
            className="p-2 rounded-full transition-colors flex items-center justify-center"
            style={{
              background: isCompareDisabled ? '#9E9E9E' : '#616161',
              width: '32px',
              height: '32px'
            }}
            aria-label={isSelectedForCompare ? "Remove from comparison" : "Add to comparison"}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-4 w-4 text-white" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>
          <button
            onClick={handleWishlistClick}
            className="p-2 rounded-full transition-colors flex items-center justify-center"
            style={{
              background: '#616161',
              width: '32px',
              height: '32px'
            }}
            aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-4 w-4 text-white" 
              viewBox="0 0 20 20" 
              fill={isInWishlist ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={2}
            >
              <path 
                fillRule="evenodd" 
                d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" 
                clipRule="evenodd" 
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Text Information Section - Bottom Part */}
      <div className="p-4 flex-grow flex flex-col" style={{ fontFamily: "'Poppins', sans-serif" }}>
        {/* Vehicle Name and Year Tag */}
        <div className="flex justify-between items-start mb-1">
          <h3 
            className="font-bold leading-tight flex-1 pr-2"
            style={{
              fontSize: '16px',
              color: '#1A1A1A',
              fontFamily: "'Poppins', sans-serif"
            }}
          >
            {vehicle.make} {vehicle.model}
          </h3>
          <span 
            className="px-2 py-0.5 rounded-full flex-shrink-0"
            style={{
              background: '#EEEEEE',
              color: '#616161',
              fontSize: '12px',
              fontWeight: 500,
              fontFamily: "'Poppins', sans-serif"
            }}
          >
            {vehicle.year}
          </span>
        </div>
        
        {/* Seller Information */}
        <p 
          className="mb-2"
          style={{
            fontSize: '13px',
            color: '#616161',
            fontFamily: "'Poppins', sans-serif"
          }}
        >
          By: <button 
            onClick={handleSellerClick}
            className="font-semibold hover:underline focus:outline-none transition-colors cursor-pointer"
            style={{ 
              color: '#FF7F47',
              fontFamily: "'Poppins', sans-serif"
            }}
          >
            {vehicle.sellerName || 'Seller'}
          </button>
        </p>
        
        {/* Specifications Grid - 2 columns with Blue Icons */}
        <div 
          className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          <div className="flex items-center gap-1.5">
            <svg 
              className="flex-shrink-0" 
              style={{ color: '#2196F3', width: '16px', height: '16px' }} 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 10.586V6z" clipRule="evenodd" />
            </svg>
            <span 
              style={{
                fontSize: '12px',
                color: '#616161',
                fontFamily: "'Poppins', sans-serif"
              }}
            >
              {Math.round(vehicle.mileage / 1000)}K kms
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg 
              className="flex-shrink-0" 
              style={{ color: '#2196F3', width: '16px', height: '16px' }} 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
            </svg>
            <span 
              style={{
                fontSize: '12px',
                color: '#616161',
                fontFamily: "'Poppins', sans-serif"
              }}
            >
              {vehicle.fuelType}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg 
              className="flex-shrink-0" 
              style={{ color: '#2196F3', width: '16px', height: '16px' }} 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
            </svg>
            <span 
              style={{
                fontSize: '12px',
                color: '#616161',
                fontFamily: "'Poppins', sans-serif"
              }}
            >
              {vehicle.transmission || 'Manual'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg 
              className="flex-shrink-0" 
              style={{ color: '#2196F3', width: '16px', height: '16px' }} 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
            </svg>
            <span 
              style={{
                fontSize: '12px',
                color: '#616161',
                fontFamily: "'Poppins', sans-serif"
              }}
            >
              {vehicle.city || 'N/A'}, {vehicle.state || 'N/A'}
            </span>
          </div>
          {/* RTO Details */}
          {vehicle.rto && (
            <div className="flex items-center gap-1.5">
              <svg 
                className="flex-shrink-0" 
                style={{ color: '#2196F3', width: '16px', height: '16px' }} 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              <span 
                style={{
                  fontSize: '12px',
                  color: '#616161',
                  fontFamily: "'Poppins', sans-serif"
                }}
              >
                {vehicle.rto}
              </span>
            </div>
          )}
        </div>

        {/* Price and Rating */}
        <div className="mt-auto pt-3 border-t" style={{ borderColor: '#E0E0E0' }}>
          <div className="flex items-baseline justify-between gap-2">
            <p 
              className="font-extrabold"
              style={{
                fontSize: '20px',
                color: '#FF7F47',
                fontFamily: "'Poppins', sans-serif"
              }}
            >
              ₹{vehicle.price.toLocaleString('en-IN')}
            </p>
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="#BDBDBD"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                ))}
              </div>
              <span 
                style={{
                  fontSize: '12px',
                  color: '#9E9E9E',
                  fontFamily: "'Poppins', sans-serif"
                }}
              >
                ({vehicle?.ratingCount || 0})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(VehicleCard);
