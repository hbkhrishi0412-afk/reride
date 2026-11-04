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
      className={`rounded-xl border border-stone-200 bg-stone-50/80 p-3 ${className}`}
      aria-label={t('trust.progress.aria', { defaultValue: 'Listing trust progress' })}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-stone-900">
          {t('trust.progress.title', { defaultValue: 'Listing trust badges' })}
        </p>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">
          {metCount}/{signals.length}
        </span>
      </div>
      <p className="mb-2 text-xs font-medium text-stone-700">
        {t('trust.progress.subtitle', {
          defaultValue: 'Buyers can filter by these signals. Complete each item to stand out.',
        })}
      </p>
      <ul className="space-y-1.5">
        {signals.map((signal) => (
          <li key={signal.id} className="flex items-start gap-2 text-sm">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                signal.met ? 'bg-emerald-600 text-white' : 'border border-stone-300 bg-white text-stone-500'
              }`}
              aria-hidden
            >
              {signal.met ? '✓' : '·'}
            </span>
            <div className="min-w-0">
              <p className={`font-semibold ${signal.met ? 'text-emerald-800' : 'text-stone-800'}`}>
                {t(signal.labelKey, { defaultValue: signal.defaultLabel })}
              </p>
              {!signal.met ? (
                <p className="mt-0.5 text-xs font-medium text-stone-600">
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
