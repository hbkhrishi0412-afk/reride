import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Vehicle } from '../types.js';
import { getListingTrustSignalStatuses } from '../utils/listingTrust.js';

interface ListingTrustStatusBarProps {
  vehicle: Vehicle;
  className?: string;
  /** When true, only show badges that are met (card previews). */
  metOnly?: boolean;
}

/**
 * Shows the four standard ReRide trust signals for a listing.
 * Met signals use a solid green pill; unmet use an outlined pill (VDP / seller progress).
 */
export const ListingTrustStatusBar: React.FC<ListingTrustStatusBarProps> = ({
  vehicle,
  className = '',
  metOnly = false,
}) => {
  const { t } = useTranslation();
  const signals = getListingTrustSignalStatuses(vehicle).filter((s) => !metOnly || s.met);
  if (signals.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap gap-2 ${className}`}
      role="list"
      aria-label={t('trust.chips.aria', { defaultValue: 'Listing trust signals' })}
    >
      {signals.map((signal) => (
        <span
          key={signal.id}
          role="listitem"
          title={
            signal.met
              ? t('trust.signal.met', { defaultValue: 'Complete' })
              : t(signal.hintKey, { defaultValue: signal.defaultHint })
          }
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
            signal.met
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
              : 'bg-white text-gray-800 border-gray-300'
          }`}
        >
          {t(signal.labelKey, { defaultValue: signal.defaultLabel })}
        </span>
      ))}
    </div>
  );
};

export default ListingTrustStatusBar;
