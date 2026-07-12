import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View as ViewEnum } from '../types';
import LanguageSwitcher from './LanguageSwitcher';
import Logo from './Logo';
import { primaryLocationLabel } from '../utils/cityMapping';

interface MobileBrandTopBarProps {
  onNavigate: (view: ViewEnum) => void;
  wishlistCount?: number;
  compareCount?: number;
  unreadNotificationCount?: number;
  showNotifications?: boolean;
  onLogin?: () => void;
  showLogin?: boolean;
  userLocation?: string;
  selectedCity?: string;
}

/**
 * Always-visible top strip: language, location, tappable brand (home), wishlist.
 */
const MobileBrandTopBar: React.FC<MobileBrandTopBarProps> = ({
  onNavigate,
  wishlistCount = 0,
  compareCount = 0,
  unreadNotificationCount = 0,
  showNotifications = false,
  onLogin,
  showLogin = false,
  userLocation = '',
  selectedCity = '',
}) => {
  const { t } = useTranslation();

  const locationDisplay =
    selectedCity.trim() ||
    (userLocation.trim() ? primaryLocationLabel(userLocation) || userLocation.trim() : '');

  const openLocationPicker = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('reride:open-location-modal'));
    }
  }, []);

  const iconButtonClass =
    'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-800 shadow-sm transition-colors hover:bg-gray-50 active:scale-95';

  return (
    <header
      className="fixed top-0 left-0 right-0 z-[52] border-b border-gray-200/90 bg-white/95 backdrop-blur-md"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      data-testid="mobile-brand-top-bar"
    >
      <div className="grid h-12 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-2">
        {/* Left: language + location */}
        <div className="flex min-w-0 items-center gap-1 justify-self-start">
          <LanguageSwitcher compact />
          <button
            type="button"
            onClick={openLocationPicker}
            data-testid="header-location-picker"
            className="inline-flex min-w-0 max-w-[5.75rem] items-center gap-0.5 rounded-full border border-blue-100 bg-blue-50/90 px-2 py-1 text-[10px] font-semibold leading-tight text-blue-700 active:scale-[0.98] transition-transform notranslate"
            aria-label={t('a11y.chooseLocation')}
            title={locationDisplay || t('header.selectLocation')}
            data-no-translate
            translate="no"
          >
            <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">{locationDisplay || t('header.selectLocation')}</span>
            <svg className="h-2.5 w-2.5 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Center: brand lockup (icon + wordmark) */}
        <div className="justify-self-center shrink-0 px-0.5">
          <Logo
            size="sm"
            showText
            onClick={() => onNavigate(ViewEnum.HOME)}
            className="shrink-0 transition-transform active:scale-[0.98] [&_span]:whitespace-nowrap"
            aria-label={t('nav.home')}
          />
        </div>

        {/* Right: compare, notifications, wishlist */}
        <div className="flex min-w-0 items-center justify-end gap-1 justify-self-end">
          {showLogin && onLogin ? (
            <button
              type="button"
              onClick={onLogin}
              className="shrink-0 rounded-lg bg-orange-500 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm active:scale-95"
            >
              {t('nav.login')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onNavigate(ViewEnum.COMPARISON)}
            className={iconButtonClass}
            aria-label={
              compareCount > 0
                ? t('nav.compareCount', { count: compareCount })
                : t('compare.pageTitle')
            }
            data-testid="mobile-brand-compare-button"
          >
            <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
              />
            </svg>
            {compareCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
                {compareCount}
              </span>
            )}
          </button>
          {showNotifications ? (
            <button
              type="button"
              onClick={() => onNavigate(ViewEnum.NOTIFICATIONS_CENTER)}
              className={iconButtonClass}
              aria-label={
                unreadNotificationCount > 0
                  ? `Notifications, ${unreadNotificationCount} unread`
                  : 'Notifications'
              }
              data-testid="mobile-brand-notification-button"
            >
              <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              {unreadNotificationCount > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white" />
              )}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onNavigate(ViewEnum.WISHLIST)}
            className={iconButtonClass}
            aria-label={t('nav.myWishlist')}
          >
            <svg
              className="h-[18px] w-[18px]"
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
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default MobileBrandTopBar;
