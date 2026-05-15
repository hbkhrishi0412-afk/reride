import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { detectNearestMarketCity } from '../utils/detectMarketCity.js';

const DISMISS_KEY = 'reRide_homeGeoBannerDismissed';

interface HomeLocationBannerProps {
  /** Hide when user already picked a city filter. */
  selectedCity?: string;
  onUseLocation: (city: string, locationLabel: string) => void;
  onBrowseAllIndia: () => void;
  addToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  className?: string;
}

/**
 * Soft pan-India nudge: optional geolocation, never auto-applies a city filter.
 */
export const HomeLocationBanner: React.FC<HomeLocationBannerProps> = ({
  selectedCity = '',
  onUseLocation,
  onBrowseAllIndia,
  addToast,
  className = '',
}) => {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof sessionStorage === 'undefined') return false;
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  });
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    if (selectedCity.trim()) {
      setDismissed(true);
    }
  }, [selectedCity]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  const handleUseLocation = useCallback(async () => {
    setDetecting(true);
    try {
      const detected = await detectNearestMarketCity();
      if (!detected) {
        addToast?.(
          t('home.locationBanner.detectFailed', {
            defaultValue: 'Could not detect your location. Pick a city or browse all India.',
          }),
          'error',
        );
        return;
      }
      onUseLocation(detected.city, detected.locationLabel);
      addToast?.(
        t('home.locationBanner.detected', {
          city: detected.city,
          defaultValue: `Showing cars in ${detected.city}`,
        }),
        'success',
      );
      dismiss();
    } finally {
      setDetecting(false);
    }
  }, [addToast, dismiss, onUseLocation, t]);

  if (dismissed || selectedCity.trim()) return null;

  return (
    <div
      className={`relative rounded-2xl border border-purple-100 bg-gradient-to-r from-purple-50 via-white to-orange-50 px-4 py-3 shadow-sm ${className}`}
      role="region"
      aria-label={t('home.locationBanner.aria', { defaultValue: 'Choose how to browse cars' })}
      data-testid="home-location-banner"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-2 right-2 rounded-lg p-1.5 text-gray-400 hover:bg-white/80 hover:text-gray-600"
        aria-label={t('common.close', { defaultValue: 'Close' })}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <p className="text-sm font-semibold text-gray-900 pr-8">
        {t('home.locationBanner.title', { defaultValue: 'Browse used cars across India' })}
      </p>
      <p className="text-xs text-gray-600 mt-0.5 mb-3 pr-6">
        {t('home.locationBanner.subtitle', {
          defaultValue: 'Use your location to see nearby listings, or explore every city — no city locked in.',
        })}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={detecting}
          onClick={() => void handleUseLocation()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-60"
        >
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {detecting
            ? t('home.locationBanner.detecting', { defaultValue: 'Detecting…' })
            : t('home.locationBanner.useLocation', { defaultValue: 'Use my location' })}
        </button>
        <button
          type="button"
          onClick={() => {
            onBrowseAllIndia();
            dismiss();
          }}
          className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
        >
          {t('home.locationBanner.browseAllIndia', { defaultValue: 'Browse all India' })}
        </button>
      </div>
    </div>
  );
};

export default HomeLocationBanner;
