import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { detectNearestMarketCity } from '../utils/detectMarketCity.js';

interface HomeLocationActionButtonsProps {
  selectedCity?: string;
  onUseLocation: (city: string, locationLabel: string) => void;
  onBrowseAllIndia: () => void;
  addToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  className?: string;
  /** Distinct id when header renders desktop + mobile instances (avoids Playwright strict-mode collisions). */
  testId?: string;
}

/** "Use my location" + "Browse all India" pill pair for the header top bar. */
export const HomeLocationActionButtons: React.FC<HomeLocationActionButtonsProps> = ({
  selectedCity = '',
  onUseLocation,
  onBrowseAllIndia,
  addToast,
  className = '',
  testId = 'home-location-banner',
}) => {
  const { t } = useTranslation();
  const [detecting, setDetecting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const handleUseLocation = useCallback(async () => {
    setDetecting(true);
    try {
      const detected = await detectNearestMarketCity();
      if (!detected) {
        addToast?.(
          t('home.locationBanner.detectFailed', {
            defaultValue: 'Location not available. Please select a city or browse all of India.',
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
      setDismissed(true);
    } finally {
      setDetecting(false);
    }
  }, [addToast, onUseLocation, t]);

  if (dismissed && !selectedCity.trim()) return null;

  if (selectedCity.trim()) {
    return (
      <div
        className={`flex items-center gap-2 ${className}`}
      data-testid={testId}
      role="group"
      aria-label={t('home.locationBanner.aria', { defaultValue: 'Choose how to browse cars' })}
    >
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-800">
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {selectedCity}
        </span>
        <button
          type="button"
          onClick={() => {
            onBrowseAllIndia();
            setDismissed(false);
          }}
          className="inline-flex items-center rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          {t('home.locationBanner.changeLocation', { defaultValue: 'Change location' })}
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      data-testid={testId}
      role="group"
      aria-label={t('home.locationBanner.aria', { defaultValue: 'Choose how to browse cars' })}
    >
      <button
        type="button"
        disabled={detecting}
        onClick={() => void handleUseLocation()}
        className="inline-flex items-center gap-1.5 rounded-full bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-60 transition-colors"
      >
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
          setDismissed(true);
        }}
        className="inline-flex items-center rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
      >
        {t('home.locationBanner.browseAllIndia', { defaultValue: 'Browse all India' })}
      </button>
    </div>
  );
};

export default HomeLocationActionButtons;
