import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Vehicle } from '../types';
import { formatOfferDateRangeLabel, isSellerListingOfferVisible } from '../utils/vehicleOffer';

interface VehicleOfferBannerProps {
  vehicle: Vehicle;
  className?: string;
}

/**
 * Purple promotional strip for an active per-listing seller offer (dates + copy from the vehicle).
 */
export const VehicleOfferBanner: React.FC<VehicleOfferBannerProps> = ({ vehicle, className = '' }) => {
  const { t } = useTranslation();
  if (!isSellerListingOfferVisible(vehicle)) return null;

  const title = vehicle.offerTitle?.trim() || t('vehicle.detail.offer.specialOffer');
  const dateStr = formatOfferDateRangeLabel(vehicle);
  const desc = vehicle.offerDescription?.trim();
  const highlight = vehicle.offerHighlight?.trim();
  const disclaimer = vehicle.offerDisclaimer?.trim();

  return (
    <div
      className={`bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg p-4 text-white ${className}`}
      role="region"
      aria-label={title}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2 sm:gap-3 flex-wrap min-w-0">
          <span className="text-xl shrink-0 leading-none pt-0.5 sm:pt-0" aria-hidden>
            🎉
          </span>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
            <span className="text-sm sm:text-base font-bold">{title}</span>
            {dateStr ? (
              <>
                <span className="text-white/70 hidden sm:inline" aria-hidden>
                  •
                </span>
                <span className="text-xs sm:text-sm text-white/90 whitespace-nowrap">{dateStr}</span>
              </>
            ) : null}
          </div>
        </div>
        {desc || highlight ? (
          <div className="flex flex-col sm:items-end gap-0.5 text-xs sm:text-sm min-w-0 w-full sm:w-auto">
            {desc ? <span className="text-white/95">{desc}</span> : null}
            {highlight ? <span className="font-bold text-white">{highlight}</span> : null}
          </div>
        ) : null}
      </div>
      {disclaimer ? <p className="mt-2 text-[10px] sm:text-xs text-white/75">{disclaimer}</p> : null}
    </div>
  );
};
