import React from 'react';
import { useTranslation } from 'react-i18next';
import { LISTING_TRUST_SIGNALS, type TrustFilterValue } from '../utils/listingTrust.js';

interface ListingTrustFilterBarProps {
  value: TrustFilterValue;
  onChange: (value: TrustFilterValue) => void;
  className?: string;
}

export const ListingTrustFilterBar: React.FC<ListingTrustFilterBarProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={`flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide ${className}`}
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      role="group"
      aria-label={t('listings.trustFilter.aria', { defaultValue: 'Trust filters' })}
    >
      {LISTING_TRUST_SIGNALS.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? '' : opt.id)}
            className={`flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-[0.98] ${
              active
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white text-gray-800 border-gray-300 hover:border-emerald-400 hover:text-emerald-800'
            }`}
          >
            {t(opt.labelKey, { defaultValue: opt.defaultLabel })}
          </button>
        );
      })}
    </div>
  );
};

export default ListingTrustFilterBar;
