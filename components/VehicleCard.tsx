import React, { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Vehicle } from '../types.js';
import { getValidImages } from '../utils/imageUtils.js';
import LazyImage from './LazyImage.js';
import { logInfo, logError } from '../utils/logger.js';
import { showVerifiedListingBadge } from '../utils/listingTrust.js';
import { ListingStockBadge } from './ListingStockBadge.js';
import { useTranslatedFields } from '../hooks/useTranslatedText.js';
import { PriceFairnessBadge } from './PriceInsights.js';
import type { BuyerVisibleDealLabel } from '../utils/vehiclePricing.js';
import { isEffectivelyFeatured } from '../utils/listingPromotion.js';
import { airbagLabel } from '../utils/vehicleCardAirbags.js';

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
  onViewSellerProfile: _onViewSellerProfile,
  dealLabel,
}) => {
  const { t } = useTranslation();
  const tf = useTranslatedFields({
    fuelType: vehicle.fuelType,
    transmission: vehicle.transmission,
    city: vehicle.city,
  });
  const images = useMemo(() => getValidImages(vehicle.images, vehicle.id), [vehicle.images, vehicle.id]);
  const [imageIndex, setImageIndex] = useState(0);
  const safeIndex = images.length ? imageIndex % images.length : 0;

  useEffect(() => {
    setImageIndex(0);
  }, [vehicle.id]);

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

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'BUTTON' ||
      target.tagName === 'A' ||
      target.closest('button') ||
      target.closest('a')
    ) {
      return;
    }
    if (!onSelect) {
      logError('❌ VehicleCard: onSelect prop is not defined!', { vehicleId: vehicle.id });
      return;
    }
    try {
      logInfo('🚗 Calling onSelect with vehicle:', vehicle.id);
      onSelect(vehicle);
    } catch (error) {
      logError('❌ Error in VehicleCard handleCardClick:', error);
    }
  };

  const shiftImage = (e: React.MouseEvent, delta: number) => {
    e.stopPropagation();
    if (images.length < 2) return;
    setImageIndex((i) => (i + delta + images.length) % images.length);
  };

  const isFeatured = isEffectivelyFeatured(vehicle);

  const ownerLabel =
    typeof vehicle.noOfOwners === 'number' && !Number.isNaN(vehicle.noOfOwners)
      ? vehicle.noOfOwners === 1
        ? t('listings.mobileFilter.owner1')
        : vehicle.noOfOwners === 2
          ? t('listings.mobileFilter.owner2')
          : t('listings.mobileFilter.owner3plus')
      : t('common.notAvailable');

  const bags = airbagLabel(vehicle.features);
  const subtitle = [vehicle.variant, bags].filter(Boolean).join(' - ');
  const mileageLabel = `${Math.round(vehicle.mileage).toLocaleString('en-IN')} km`;
  const emiAmount = Math.round(vehicle.price / 60).toLocaleString('en-IN');
  const rtoCode = (vehicle.rto || vehicle.registrationNumber?.slice(0, 4) || '').toUpperCase();

  const specs = [
    {
      key: 'owner',
      label: ownerLabel,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0" />
        </svg>
      ),
    },
    {
      key: 'fuel',
      label: tf.fuelType || t('common.notAvailable'),
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.75v16.5m0-16.5h4.5a2.25 2.25 0 012.25 2.25v5.25H9.75m0 9h6.75A2.25 2.25 0 0018.75 18V9.75L15 6" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 20.25H6.75A2.25 2.25 0 014.5 18V6A2.25 2.25 0 016.75 3.75h3" />
        </svg>
      ),
    },
    {
      key: 'km',
      label: mileageLabel,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 18h18M5 18l3.5-8h7L19 18M9 10l1.5-4h3L15 10" />
        </svg>
      ),
    },
    {
      key: 'trans',
      label: tf.transmission || t('common.manual'),
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v10M12 7v10M16 7v6m0 0a2 2 0 104 0 2 2 0 00-4 0zM6 7h4M10 12h4M14 7h2" />
        </svg>
      ),
    },
  ];

  return (
    <div
      onClick={handleCardClick}
      className="cursor-pointer bg-white overflow-hidden flex flex-col rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick(e as unknown as React.MouseEvent);
        }
      }}
      aria-label={t('vehicle.card.viewDetailsAria', { make: vehicle.make, model: vehicle.model })}
      data-vehicle-id={vehicle.id}
      style={{ fontFamily: "'Poppins', sans-serif" }}
      data-testid="vehicle-card"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden flex-shrink-0 bg-gray-100">
        <LazyImage
          src={images[safeIndex]}
          alt={`${vehicle.make} ${vehicle.model}`}
          className="w-full h-full object-cover"
          width={400}
          quality={72}
          data-testid="vehicle-image"
        />

        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1 items-start">
          <ListingStockBadge vehicle={vehicle} hideInStock />
          {showVerifiedListingBadge(vehicle) && (
            <div className="flex items-center gap-1 rounded bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
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
              className="flex items-center gap-1 px-2 py-0.5 rounded shadow-sm"
              style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C42 100%)' }}
            >
              <span className="text-white font-bold text-[10px] tracking-wide">
                {t('vehicle.card.featured')}
              </span>
            </div>
          )}
        </div>

        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCompareClick}
            disabled={isCompareDisabled}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-800 shadow-md hover:bg-gray-50 disabled:opacity-50"
            aria-label={
              isSelectedForCompare ? t('vehicle.card.compareRemove') : t('vehicle.card.compareAdd')
            }
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleWishlistClick}
            className={`relative flex h-9 w-9 items-center justify-center rounded-full shadow-md transition-colors ${
              isInWishlist ? 'bg-[#FF6B35] text-white' : 'bg-white text-gray-800 hover:bg-gray-50'
            }`}
            aria-label={
              isInWishlist ? t('vehicle.card.wishlistRemove') : t('vehicle.card.wishlistAdd')
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill={isInWishlist ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                clipRule="evenodd"
              />
            </svg>
            {!isInWishlist && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-[9px] font-bold text-gray-800 ring-1 ring-gray-200">
                +
              </span>
            )}
          </button>
        </div>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => shiftImage(e, -1)}
              className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-[1px] hover:bg-black/50"
              aria-label={t('vehicle.card.prevImage', { defaultValue: 'Previous image' })}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => shiftImage(e, 1)}
              className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-[1px] hover:bg-black/50"
              aria-label={t('vehicle.card.nextImage', { defaultValue: 'Next image' })}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

      </div>

      {/* Body */}
      <div className="flex flex-grow flex-col px-3.5 pb-3.5 pt-3 min-w-0">
        <h3 className="text-[15px] font-bold leading-snug text-[#111827] line-clamp-1">
          {vehicle.year} {vehicle.make} {vehicle.model}
        </h3>

        {subtitle ? (
          <p className="mt-1 flex items-center gap-1.5 text-[12px] text-gray-500 min-w-0">
            <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <rect x="1" y="1" width="6" height="6" rx="1" />
              <rect x="9" y="1" width="6" height="6" rx="1" />
              <rect x="1" y="9" width="6" height="6" rx="1" />
              <rect x="9" y="9" width="6" height="6" rx="1" />
            </svg>
            <span className="truncate">{subtitle}</span>
          </p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {tf.city ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700">
              <svg className="h-3 w-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              <span data-no-translate>{tf.city}</span>
            </span>
          ) : null}
          {rtoCode ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700">
              <svg className="h-3 w-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <circle cx="12" cy="12" r="8" />
                <circle cx="12" cy="12" r="2.5" />
                <path strokeLinecap="round" d="M12 4v3M12 17v3M4 12h3M17 12h3" />
              </svg>
              <span data-no-translate>{rtoCode}</span>
            </span>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-4 divide-x divide-gray-200 rounded-xl border border-gray-200 bg-white">
          {specs.map((spec) => (
            <div key={spec.key} className="flex min-w-0 flex-col items-center gap-1 px-1 py-2.5 text-center">
              <span className="text-gray-600">{spec.icon}</span>
              <span className="w-full truncate text-[10px] font-semibold leading-tight text-gray-800" data-no-translate>
                {spec.label}
              </span>
            </div>
          ))}
        </div>

        {/* mt-auto + fixed badge slot keeps price/EMI on one baseline across grid cards */}
        <div className="mt-auto pt-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[18px] font-extrabold leading-none text-[#111827] whitespace-nowrap">
              {t('vehicle.tile.priceLakh', { value: (vehicle.price / 100000).toFixed(2) })}
            </p>
            <div className="mt-1 min-h-[22px]">
              {dealLabel ? <PriceFairnessBadge fairnessLabel={dealLabel} buyerFacing /> : null}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-gray-500 leading-none">
              {t('vehicle.card.emiStartsAt', { defaultValue: 'EMI Starts at' })}
            </p>
            <p className="mt-0.5 text-[12px] font-bold text-gray-800 leading-tight">
              {t('vehicle.card.emiPerMonth', {
                defaultValue: '₹ {{amount}} /Month',
                amount: emiAmount,
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(VehicleCard);
