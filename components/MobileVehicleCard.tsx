import React, { useCallback, useMemo } from 'react';
import type { Vehicle } from '../types';
import { getFirstValidImage, optimizeImageUrl } from '../utils/imageUtils';
import LazyImage from './LazyImage';

interface MobileVehicleCardProps {
  vehicle: Vehicle;
  onSelect: (vehicle: Vehicle) => void;
  onToggleWishlist?: (vehicleId: number) => void;
  onToggleCompare?: (vehicleId: number) => void;
  isInWishlist?: boolean;
  isInCompare?: boolean;
  showActions?: boolean;
}

/**
 * Mobile-Optimized Vehicle Card
 * Designed specifically for mobile app with touch-friendly interactions
 * Optimized with React.memo for performance
 */
export const MobileVehicleCard: React.FC<MobileVehicleCardProps> = React.memo(({
  vehicle,
  onSelect,
  onToggleWishlist,
  onToggleCompare,
  isInWishlist = false,
  isInCompare = false,
  showActions = true
}) => {
  const handleWishlistClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleWishlist) {
      onToggleWishlist(vehicle.id);
    }
  }, [onToggleWishlist, vehicle.id]);

  const handleCompareClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleCompare) {
      onToggleCompare(vehicle.id);
    }
  }, [onToggleCompare, vehicle.id]);

  const handleSelect = useCallback(() => {
    onSelect(vehicle);
  }, [onSelect, vehicle]);

  const formattedPrice = useMemo(() => {
    const price = vehicle.price;
    if (price >= 10000000) {
      return `₹${(price / 10000000).toFixed(2)}Cr`;
    } else if (price >= 100000) {
      return `₹${(price / 100000).toFixed(2)}L`;
    } else {
      return `₹${price.toLocaleString('en-IN')}`;
    }
  }, [vehicle.price]);

  const imageSrc = useMemo(() => getFirstValidImage(vehicle.images), [vehicle.images]);

  return (
    <div
      onClick={handleSelect}
      className="cursor-pointer"
      style={{
        background: 'linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 100%)',
        borderRadius: '16px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.08)',
        border: '0.5px solid rgba(0, 0, 0, 0.04)',
        transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
        overflow: 'hidden',
        marginBottom: '16px'
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.98)';
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.08)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.08)';
      }}
    >
      {/* Image Section */}
      <div className="relative w-full" style={{ aspectRatio: '16/10' }}>
        <LazyImage
          src={imageSrc}
          alt={`${vehicle.make} ${vehicle.model}`}
          className="w-full h-full object-cover"
          width={800}
          quality={85}
        />
        
        {/* Badges Overlay */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {vehicle.isFeatured && (
            <span className="bg-orange-500 text-white px-2 py-1 rounded text-xs font-bold">
              Featured
            </span>
          )}
          {vehicle.certificationStatus === 'certified' && (
            <span className="bg-green-500 text-white px-2 py-1 rounded text-xs font-bold">
              Verified
            </span>
          )}
        </div>

        {/* Action Buttons - Top Right */}
        {showActions && (
          <div className="absolute top-2 right-2 flex flex-col gap-2">
            {onToggleWishlist && (
              <button
                onClick={handleWishlistClick}
                className="mobile-tap-target bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-md active:scale-90 transition-transform"
                aria-label={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <svg
                  className="w-5 h-5"
                  fill={isInWishlist ? '#FF6B35' : 'none'}
                  stroke={isInWishlist ? '#FF6B35' : 'currentColor'}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </button>
            )}
            {onToggleCompare && (
              <button
                onClick={handleCompareClick}
                className={`mobile-tap-target backdrop-blur-sm rounded-full p-2 shadow-md active:scale-90 transition-transform ${
                  isInCompare ? 'bg-orange-500/90' : 'bg-white/90'
                }`}
                aria-label={isInCompare ? 'Remove from compare' : 'Add to compare'}
              >
                <svg
                  className="w-5 h-5"
                  fill={isInCompare ? 'white' : 'none'}
                  stroke={isInCompare ? 'white' : 'currentColor'}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Premium Price Badge - Bottom Right */}
        <div className="absolute bottom-2 right-2">
          <div 
            className="px-3 py-1.5 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.75) 100%)',
              backdropFilter: 'blur(10px) saturate(180%)',
              WebkitBackdropFilter: 'blur(10px) saturate(180%)',
              border: '0.5px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2)'
            }}
          >
            <span className="text-sm font-bold text-white tracking-tight" style={{ letterSpacing: '-0.01em' }}>
              {formattedPrice}
            </span>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4">
        {/* Title */}
        <h3 className="native-text-title mb-1 line-clamp-1">
          {vehicle.make} {vehicle.model}
          {vehicle.variant && ` ${vehicle.variant}`}
        </h3>

        {/* Details Row */}
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className="native-text-caption">
            {vehicle.year} • {vehicle.fuelType}
          </span>
          {vehicle.mileage && (
            <span className="native-text-caption">
              • {vehicle.mileage.toLocaleString('en-IN')} km
            </span>
          )}
          {vehicle.transmission && (
            <span className="native-text-caption">
              • {vehicle.transmission}
            </span>
          )}
        </div>

        {/* Location */}
        {vehicle.location && (
          <div className="flex items-center gap-1 mb-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="native-text-caption">{vehicle.location}</span>
          </div>
        )}

        {/* Features Preview */}
        {vehicle.features && vehicle.features.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {vehicle.features.slice(0, 3).map((feature, index) => (
              <span
                key={index}
                className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs"
              >
                {feature}
              </span>
            ))}
            {vehicle.features.length > 3 && (
              <span className="text-gray-500 text-xs px-2 py-0.5">
                +{vehicle.features.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

MobileVehicleCard.displayName = 'MobileVehicleCard';

export default MobileVehicleCard;

