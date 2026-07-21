import React, { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Vehicle } from '../types.js';
import StarRating from './StarRating.js';
import { getFirstValidImage } from '../utils/imageUtils.js';
import LazyImage from './LazyImage.js';
import { logInfo, logError } from '../utils/logger.js';
import { showVerifiedListingBadge } from '../utils/listingTrust.js';
import { ListingStockBadge } from './ListingStockBadge.js';
import { ListingTrustChips } from './ListingTrustChips.js';
import { useTranslatedFields } from '../hooks/useTranslatedText.js';

import { PriceFairnessBadge } from './PriceInsights.js';
import type { BuyerVisibleDealLabel } from '../utils/vehiclePricing.js';

interface VehicleCardProps {
  vehicle: Vehicle;
  onSelect: (vehicle: Vehicle) => void;
  onToggleCompare: (id: number) => void;
  isSelectedForCompare: boolean;
  onToggleWishlist: (id: number) => void;
  isInWishlist: boolean;
  isCompareDisabled: boolean;
  onViewSellerProfile: (sellerEmail: string) => void;
  dealLabel?: BuyerVisibleDealLabel | null;
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
  dealLabel,
}) => {
  const { t } = useTranslation();
  const tf = useTranslatedFields({
    fuelType: vehicle.fuelType,
    transmission: vehicle.transmission,
    city: vehicle.city,
    state: vehicle.state,
  });
  // Validate onSelect prop on mount
  useEffect(() => {
    if (!onSelect) {
      logError('❌ VehicleCard: onSelect prop is missing!', vehicle.id);
    }
  }, [onSelect, vehicle.id]);
  
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

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking directly on interactive elements
    const target = e.target as HTMLElement;
    
    // If clicking on a button, link, or SVG inside a button, don't navigate
    if (target.tagName === 'BUTTON' || 
        target.tagName === 'A' || 
        target.closest('button') ||
        target.closest('a')) {
      return;
    }
    
    // Log the click for debugging (development only)
    logInfo('🚗 VehicleCard clicked for vehicle:', vehicle.id, vehicle.make, vehicle.model);
    logInfo('🚗 Click target:', target.tagName, target.className);
    logInfo('🚗 onSelect function exists:', typeof onSelect === 'function');
    
    // Validate onSelect exists
    if (!onSelect) {
      logError('❌ VehicleCard: onSelect prop is not defined!', {
        vehicleId: vehicle.id,
        hasOnSelect: !!onSelect,
        onSelectType: typeof onSelect
      });
      return;
    }
    
    // Call onSelect
    try {
      logInfo('🚗 Calling onSelect with vehicle:', vehicle.id);
      onSelect(vehicle);
      logInfo('🚗 onSelect called successfully');
    } catch (error) {
      logError('❌ Error in VehicleCard handleCardClick:', error);
    }
  };

  const isFeatured = vehicle.isFeatured || vehicle.activeBoosts?.some(boost => 
    (boost.type === 'featured_badge' || boost.type === 'homepage_spotlight') && 
    boost.isActive && 
    new Date(boost.expiresAt) > new Date()
  );

  return (
    <div 
      onClick={handleCardClick}
      className="cursor-pointer bg-white dark:bg-white overflow-hidden flex flex-col rounded-xl border border-gray-100 dark:border-gray-200 shadow-sm hover:shadow-md transition-shadow"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick(e as any);
        }
      }}
      aria-label={t('vehicle.card.viewDetailsAria', { make: vehicle.make, model: vehicle.model })}
      data-vehicle-id={vehicle.id}
      style={{ fontFamily: "'Poppins', sans-serif" }}
      data-testid="vehicle-card"
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden flex-shrink-0 bg-gradient-to-br from-gray-100 to-gray-200">
        <LazyImage
          src={getFirstValidImage(vehicle.images, vehicle.id)}
          alt={`${vehicle.make} ${vehicle.model}`}
          className="w-full h-full object-cover"
          width={400}
          quality={72}
          data-testid="vehicle-image"
        />
        {/* Stock + optional verified / featured badges */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
        <ListingStockBadge vehicle={vehicle} hideInStock />
        {showVerifiedListingBadge(vehicle) && (
          <div className="flex items-center gap-1 rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            {t('common.verified')}
          </div>
        )}

        {isFeatured && (
          <div 
            className="flex items-center gap-1 px-2 py-0.5 rounded-full shadow-sm"
            style={{
              background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C42 100%)',
            }}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-3 w-3 text-white" 
              viewBox="0 0 20 20" 
              fill="currentColor"
              aria-hidden="true"
              role="img"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span 
              className="text-white font-bold text-[10px] tracking-wide"
              aria-label={t('vehicle.card.featuredBadgeAria')}
            >
              {t('vehicle.card.featured')}
            </span>
          </div>
        )}
        </div>
        
        {/* Compare & wishlist */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
          <button
            type="button"
            onClick={handleCompareClick}
            disabled={isCompareDisabled}
            className="p-1.5 rounded-full transition-colors flex items-center justify-center disabled:opacity-60"
            style={{
              background: isCompareDisabled ? '#9E9E9E' : '#616161',
              width: '28px',
              height: '28px'
            }}
            aria-label={
              isSelectedForCompare ? t('vehicle.card.compareRemove') : t('vehicle.card.compareAdd')
            }
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-3.5 w-3.5 text-white" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              aria-hidden="true"
              role="img"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleWishlistClick}
            className="p-1.5 rounded-full transition-colors flex items-center justify-center"
            style={{
              background: '#616161',
              width: '28px',
              height: '28px'
            }}
            aria-label={
              isInWishlist ? t('vehicle.card.wishlistRemove') : t('vehicle.card.wishlistAdd')
            }
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-3.5 w-3.5 text-white" 
              viewBox="0 0 20 20" 
              fill={isInWishlist ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
              role="img"
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

      {/* Details */}
      <div className="p-3 flex-grow flex flex-col min-w-0" style={{ fontFamily: "'Poppins', sans-serif" }}>
        <div className="flex justify-between items-start gap-2 mb-0.5">
          <h3 className="font-bold leading-snug flex-1 min-w-0 text-[13px] text-[#1A1A1A] truncate">
            {vehicle.make} {vehicle.model}
          </h3>
          <span className="px-1.5 py-0.5 rounded-full flex-shrink-0 bg-[#EEEEEE] text-[#616161] text-[11px] font-medium">
            {vehicle.year}
          </span>
        </div>
        
        <p className="mb-1.5 text-[11px] text-[#616161] truncate">
          {t('vehicle.card.byPrefix')}{' '}
          <button 
            type="button"
            onClick={handleSellerClick}
            className="font-semibold hover:underline focus:outline-none transition-colors cursor-pointer text-[#FF7F47]"
            aria-label={t('vehicle.card.viewSellerAria', {
              name: vehicle.sellerName || t('vehicle.card.sellerFallback'),
            })}
          >
            {vehicle.sellerName || t('vehicle.card.sellerFallback')}
          </button>
        </p>
        
        {/* Specs — compact 2-line grid */}
        <div className="flex flex-col gap-1 mb-2 text-[11px] text-[#616161]">
          <div className="grid grid-cols-3 gap-x-1">
            <div className="flex items-center gap-1 min-w-0">
              <svg className="flex-shrink-0 text-[#2196F3] w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 10.586V6z" clipRule="evenodd" />
              </svg>
              <span className="truncate">{t('vehicle.card.mileageCompact', { km: Math.round(vehicle.mileage / 1000) })}</span>
            </div>
            <div className="flex items-center gap-1 min-w-0">
              <svg className="flex-shrink-0 text-[#2196F3] w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
              </svg>
              <span className="truncate" data-no-translate>{tf.fuelType}</span>
            </div>
            <div className="flex items-center gap-1 min-w-0">
              <svg className="flex-shrink-0 text-[#2196F3] w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
              </svg>
              <span className="truncate" data-no-translate>{tf.transmission || t('common.manual')}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-2">
            <div className="flex items-center gap-1 min-w-0">
              <svg className="flex-shrink-0 text-[#2196F3] w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
              </svg>
              <span className="truncate" data-no-translate>{tf.city || 'N/A'}, {tf.state || 'N/A'}</span>
            </div>
            {vehicle.rto ? (
              <div className="flex items-center gap-1 min-w-0">
                <svg className="flex-shrink-0 text-[#2196F3] w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                <span className="truncate">{vehicle.rto}</span>
              </div>
            ) : (
              <div />
            )}
          </div>
        </div>

        <ListingTrustChips vehicle={vehicle} compact className="mb-2" />

        {/* Price */}
        <div className="mt-auto pt-2 border-t border-[#E0E0E0] dark:border-gray-200">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-extrabold text-[15px] text-[#FF7F47] leading-none">
              ₹{vehicle.price.toLocaleString('en-IN')}
            </p>
            {dealLabel && (
              <PriceFairnessBadge fairnessLabel={dealLabel} buyerFacing />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(VehicleCard);
