import React from 'react';
import { useTranslation } from 'react-i18next';
import { View as ViewEnum } from '../types';
import LanguageSwitcher from './LanguageSwitcher';
import { HomeLocationActionButtons } from './HomeLocationActionButtons';
import { primaryLocationLabel } from '../utils/cityMapping';

interface MobileBrandTopBarProps {
  onNavigate: (view: ViewEnum) => void;
  wishlistCount?: number;
  /** When set, show home location actions above the icon row (native home). */
  isHome?: boolean;
  userLocation?: string;
  selectedCity?: string;
  onOpenLocationPicker?: () => void;
  onBrowseAllIndia?: () => void;
  onUseMyLocation?: (city: string, locationLabel: string) => void;
  addToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  onLogin?: () => void;
  showLogin?: boolean;
}

/**
 * Always-visible top strip: language, tappable brand (home), wishlist.
 * On home, also shows location actions above login-style actions.
 */
const MobileBrandTopBar: React.FC<MobileBrandTopBarProps> = ({
  onNavigate,
  wishlistCount = 0,
  isHome = false,
  userLocation = '',
  selectedCity = '',
  onOpenLocationPicker,
  onBrowseAllIndia,
  onUseMyLocation,
  addToast,
  onLogin,
  showLogin = false,
}) => {
  const { t } = useTranslation();
  const showHomeLocation =
    isHome && Boolean(onBrowseAllIndia && onUseMyLocation && onOpenLocationPicker);
  const locationDisplay =
    selectedCity.trim() ||
    (userLocation.trim() ? primaryLocationLabel(userLocation) || userLocation.trim() : '');

  return (
    <header
      className="fixed top-0 left-0 right-0 z-[52] border-b border-gray-200/90 bg-white/95 backdrop-blur-md"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      data-testid="mobile-brand-top-bar"
    >
      {showHomeLocation ? (
        <div className="border-b border-gray-100 bg-gray-50 px-3 py-2">
          <div className="flex flex-col items-end gap-1.5">
            {locationDisplay ? (
              <button
                type="button"
                onClick={onOpenLocationPicker}
                className="flex items-center gap-1 text-sm font-medium notranslate"
                style={{ color: '#1E88E5' }}
                data-no-translate
                translate="no"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {locationDisplay}
              </button>
            ) : null}
            <HomeLocationActionButtons
              selectedCity={selectedCity}
              onBrowseAllIndia={onBrowseAllIndia!}
              onUseLocation={onUseMyLocation!}
              addToast={addToast}
            />
          </div>
        </div>
      ) : null}

      <div className="relative flex h-12 items-center justify-center px-3">
        <div className="absolute left-2 top-1/2 z-10 -translate-y-1/2">
          <LanguageSwitcher compact />
        </div>

        <button
          type="button"
          onClick={() => onNavigate(ViewEnum.HOME)}
          className="max-w-[58%] truncate rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-center text-sm font-extrabold uppercase tracking-wide text-slate-900 shadow-sm transition-transform active:scale-[0.98] hover:border-gray-300 hover:bg-white"
          style={{ fontFamily: 'Nunito Sans, sans-serif' }}
          aria-label={t('nav.home')}
        >
          {t('app.name')}
        </button>

        <div className="absolute right-2 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1.5">
          {showLogin && onLogin ? (
            <button
              type="button"
              onClick={onLogin}
              className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm active:scale-95"
            >
              {t('nav.login')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onNavigate(ViewEnum.WISHLIST)}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-800 shadow-sm transition-colors hover:bg-gray-50 active:scale-95"
            aria-label={t('nav.myWishlist')}
          >
            <svg
              className="h-5 w-5"
              fill={wishlistCount > 0 ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            {wishlistCount > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default MobileBrandTopBar;
