import React from 'react';
import { useTranslation } from 'react-i18next';
import type { User, Vehicle } from '../types.js';
import { getListingTrustRail } from '../utils/listingTrust.js';

interface ListingTrustRailProps {
  vehicle: Vehicle;
  seller?: User | null;
  dealStageLabel?: string | null;
  className?: string;
}

export const ListingTrustRail: React.FC<ListingTrustRailProps> = ({
  vehicle,
  seller,
  dealStageLabel,
  className = '',
}) => {
  const { t } = useTranslation();
  const slots = getListingTrustRail(vehicle, seller, dealStageLabel);

  return (
    <div
      className={`grid grid-cols-3 gap-1 ${className}`}
      role="list"
      aria-label={t('trust.rail.aria', { defaultValue: 'Listing trust: RC, seller, deal' })}
      data-testid="listing-trust-rail"
    >
      {slots.map((slot) => (
        <span
          key={slot.id}
          role="listitem"
          data-slot={slot.id}
          data-met={slot.met ? 'true' : 'false'}
          className={`inline-flex min-w-0 items-center justify-center gap-0.5 rounded-md px-1 py-0.5 text-[9px] font-semibold leading-tight tracking-tight ${
            slot.met
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-stone-100 text-stone-500'
          }`}
        >
          <span aria-hidden="true">{slot.met ? '✓' : '·'}</span>
          <span className="truncate">
            {slot.id === 'deal' && dealStageLabel?.trim()
              ? dealStageLabel.trim()
              : t(slot.labelKey, { defaultValue: slot.defaultLabel })}
          </span>
        </span>
      ))}
    </div>
  );
};

export default ListingTrustRail;
