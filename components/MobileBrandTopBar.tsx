import React from 'react';
import { useTranslation } from 'react-i18next';
import { View as ViewEnum } from '../types';
import LanguageSwitcher from './LanguageSwitcher';

interface MobileBrandTopBarProps {
  onNavigate: (view: ViewEnum) => void;
  wishlistCount?: number;
}

/**
 * Always-visible top strip: language, tappable brand (home), wishlist.
 * Sits under the notch; MobileHeader is offset below this bar.
 */
const MobileBrandTopBar: React.FC<MobileBrandTopBarProps> = ({
  onNavigate,
  wishlistCount = 0,
}) => {
  const { t } = useTranslation();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-[52] border-b border-gray-200/90 bg-white/95 backdrop-blur-md"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      data-testid="mobile-brand-top-bar"
    >
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

        <div className="absolute right-2 top-1/2 z-10 -translate-y-1/2">
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
