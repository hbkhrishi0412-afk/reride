import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from '../types';
import { useMyDealLeads } from '../hooks/useMyDealLeads';

interface ActiveDealsHomeBannerProps {
  onNavigate: (view: View) => void;
}

/** Compact home banner when the logged-in buyer has active deal leads. */
export const ActiveDealsHomeBanner: React.FC<ActiveDealsHomeBannerProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { activeCount } = useMyDealLeads();

  if (activeCount === 0) return null;

  return (
    <button
      type="button"
      onClick={() => onNavigate(View.BUYER_DASHBOARD)}
      className="w-full mb-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-left active:scale-[0.99] transition-transform"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-blue-900">
          {t('home.activeDeals.title', {
            count: activeCount,
            defaultValue: activeCount === 1 ? '1 deal in progress' : `${activeCount} deals in progress`,
          })}
        </p>
        <p className="text-xs text-blue-800/80 mt-0.5">
          {t('home.activeDeals.subtitle', { defaultValue: 'Track offers, inspection & RC transfer' })}
        </p>
      </div>
      <span className="shrink-0 text-blue-700 text-sm font-semibold">
        {t('home.activeDeals.cta', { defaultValue: 'View' })} →
      </span>
    </button>
  );
};

export default ActiveDealsHomeBanner;
