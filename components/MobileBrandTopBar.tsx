import React from 'react';
import { useTranslation } from 'react-i18next';
import { View as ViewEnum } from '../types';
import LanguageSwitcher from './LanguageSwitcher';

interface MobileBrandTopBarProps {
  onNavigate: (view: ViewEnum) => void;
  wishlistCount?: number;
  compareCount?: number;
  unreadNotificationCount?: number;
  showNotifications?: boolean;
  onLogin?: () => void;
  showLogin?: boolean;
}

/**
 * Always-visible top strip: language, tappable brand (home), wishlist.
 */
const MobileBrandTopBar: React.FC<MobileBrandTopBarProps> = ({
  onNavigate,
  wishlistCount = 0,
  compareCount = 0,
  unreadNotificationCount = 0,
  showNotifications = false,
  onLogin,
  showLogin = false,
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
          className="max-w-[58%] truncate rounded-full border border-gray-200 bg-gray-50 px-5 py-2 text-center text-base font-extrabold uppercase tracking-wide text-slate-900 shadow-sm transition-transform active:scale-[0.98] hover:border-gray-300 hover:bg-white"
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
            onClick={() => onNavigate(ViewEnum.COMPARISON)}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-800 shadow-sm transition-colors hover:bg-gray-50 active:scale-95"
            aria-label={
              compareCount > 0
                ? t('nav.compareCount', { count: compareCount })
                : t('compare.pageTitle')
            }
            data-testid="mobile-brand-compare-button"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
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
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-800 shadow-sm transition-colors hover:bg-gray-50 active:scale-95"
              aria-label={
                unreadNotificationCount > 0
                  ? `Notifications, ${unreadNotificationCount} unread`
                  : 'Notifications'
              }
              data-testid="mobile-brand-notification-button"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              {unreadNotificationCount > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white" />
              )}
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
