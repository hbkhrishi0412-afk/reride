import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Vehicle } from '../types.js';
import { getListingTrustSignalStatuses } from '../utils/listingTrust.js';

interface ListingTrustProgressProps {
  vehicle: Vehicle;
  className?: string;
}

/** Seller dashboard: what is left to earn each trust badge on the listing. */
export const ListingTrustProgress: React.FC<ListingTrustProgressProps> = ({
  vehicle,
  className = '',
}) => {
  const { t } = useTranslation();
  const signals = getListingTrustSignalStatuses(vehicle);
  const metCount = signals.filter((s) => s.met).length;

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50/80 p-4 ${className}`}
      aria-label={t('trust.progress.aria', { defaultValue: 'Listing trust progress' })}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-sm font-semibold text-slate-900">
          {t('trust.progress.title', { defaultValue: 'Listing trust badges' })}
        </p>
        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
          {metCount}/{signals.length}
        </span>
      </div>
      <p className="text-xs text-slate-600 mb-3">
        {t('trust.progress.subtitle', {
          defaultValue: 'Buyers can filter by these signals. Complete each item to stand out.',
        })}
      </p>
      <ul className="space-y-2">
        {signals.map((signal) => (
          <li key={signal.id} className="flex items-start gap-2 text-sm">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                signal.met ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-300 text-slate-400'
              }`}
              aria-hidden
            >
              {signal.met ? '✓' : '·'}
            </span>
            <div className="min-w-0">
              <p className={`font-medium ${signal.met ? 'text-emerald-800' : 'text-slate-800'}`}>
                {t(signal.labelKey, { defaultValue: signal.defaultLabel })}
              </p>
              {!signal.met ? (
                <p className="text-xs text-slate-500 mt-0.5">
                  {t(signal.hintKey, { defaultValue: signal.defaultHint })}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ListingTrustProgress;
