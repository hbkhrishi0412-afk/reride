import React from 'react';
import { useTranslation } from 'react-i18next';
import type { User, Vehicle } from '../types.js';
import { getListingTrustChips, type ListingTrustChip } from '../utils/listingTrust.js';

const CHIP_TONE: Record<ListingTrustChip['tone'], string> = {
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  blue: 'bg-blue-50 text-blue-800 border-blue-200',
  amber: 'bg-amber-50 text-amber-900 border-amber-200',
  purple: 'bg-purple-50 text-purple-800 border-purple-200',
};

interface ListingTrustChipsProps {
  vehicle: Vehicle;
  seller?: User | null;
  className?: string;
}

export const ListingTrustChips: React.FC<ListingTrustChipsProps> = ({
  vehicle,
  seller,
  className = '',
}) => {
  const { t } = useTranslation();
  const chips = getListingTrustChips(vehicle, seller);
  if (chips.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`} role="list" aria-label={t('trust.chips.aria', { defaultValue: 'Listing trust signals' })}>
      {chips.map((chip) => (
        <span
          key={chip.id}
          role="listitem"
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CHIP_TONE[chip.tone]}`}
        >
          {t(chip.labelKey, { defaultValue: chip.defaultLabel })}
        </span>
      ))}
    </div>
  );
};

export default ListingTrustChips;
