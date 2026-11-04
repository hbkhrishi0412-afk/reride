import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { User } from '../types.js';
import { View as ViewEnum } from '../types.js';
import { triggerSelectionHaptic } from '../utils/haptics';
import { homeViewForActor } from '../utils/serviceProviderAccess.js';
import { mobileSellDestination } from '../utils/mobileSellNav';

interface MobileBottomNavProps {
  currentView: ViewEnum;
  onNavigate: (view: ViewEnum) => void;
  currentUser: User | null;
  wishlistCount?: number;
  inboxCount?: number;
  onToggleMenu?: () => void;
  serviceProvider?: { name?: string; email?: string } | null;
}

/**
 * Mobile Bottom Navigation - Native app style navigation
 * Fixed at bottom, compact icons, active state indicators
 * Optimized with React.memo and useMemo for performance
 */
const MobileBottomNav: React.FC<MobileBottomNavProps> = React.memo(({
  currentView,
  onNavigate,
  currentUser,
  wishlistCount: _wishlistCount = 0,
  inboxCount = 0,
  onToggleMenu,
  serviceProvider = null,
}) => {
  const { t, i18n } = useTranslation();
  const homeView = homeViewForActor(currentUser, serviceProvider);
  const navItems = useMemo(() => {
    const isCustomer = currentUser?.role === 'customer';
    const items = [
    {
      id: 'home',
      label: t('nav.home'),
      view: homeView,
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 0 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: 'buy',
      label: t('nav.bottomBuy'),
      view: ViewEnum.USED_CARS,
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 0 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8M8 7V5a1 1 0 011-1h6a1 1 0 011 1v2M8 7v10a1 1 0 001 1h6a1 1 0 001-1V7M6 9h12M6 9v6M18 9v6" />
        </svg>
      )
    },
    {
      id: 'car-service',
      label: t('nav.bottomService'),
      view: ViewEnum.CAR_SERVICES,
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 0 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 'sell',
      label: t('nav.bottomSell'),
      view: mobileSellDestination(currentUser?.role),
      icon: (active: boolean) => (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="4" width="16" height="16" rx="3" fill="#FF6B35" opacity={active ? 1 : 0.9} />
          <path d="M12 8v8M8 12h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      ),
      isSpecial: true
    },
    {
      id: isCustomer ? 'deals' : 'messages',
      label: isCustomer ? t('nav.myDeals', { defaultValue: 'Deals' }) : t('nav.messages'),
      view: isCustomer ? ViewEnum.BUYER_DASHBOARD : ViewEnum.INBOX,
      icon: (active: boolean) => (
        isCustomer ? (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 0 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        ) : (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 0 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        )
      ),
      badge: isCustomer ? undefined : inboxCount
    },
    {
      id: 'menu',
      label: t('nav.bottomMenu'),
      view: ViewEnum.HOME,
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 0 : 2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      )
    }
  ];
    return items;
  }, [t, i18n.language, inboxCount, currentUser?.role, homeView]);

  return (
    <>
      {/* Bottom nav: fixed content row (56px) + safe-area inset below — avoids squashing tabs on notched devices */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-40 box-border" 
        data-testid="mobile-bottom-nav"
        aria-label={t('nav.bottomNavigation', { defaultValue: 'Main navigation' })}
        style={{ 
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.96) 100%)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          boxShadow: '0 -6px 24px rgba(0, 0, 0, 0.1), 0 -2px 8px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.9)'
        }}
      >
        {/* Enhanced top glow effect */}
        <div 
          className="absolute top-0 left-0 right-0 h-[1px]"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255, 107, 53, 0.15) 20%, rgba(255, 107, 53, 0.25) 50%, rgba(255, 107, 53, 0.15) 80%, transparent 100%)',
            opacity: 0.6
          }}
        />
        
        <div 
          className="grid w-full max-w-3xl mx-auto grid-cols-6 items-stretch gap-0 px-1"
          style={{ height: 'var(--mobile-tab-bar)' }} 
        >
          {navItems.map((item) => {
            const messagesTabActive =
              item.id === 'messages' && currentView === ViewEnum.INBOX;
            const dealsTabActive =
              item.id === 'deals' && currentView === ViewEnum.BUYER_DASHBOARD;

            const isActive = item.id === 'sell'
              ? currentView === ViewEnum.SELLER_DASHBOARD ||
                currentView === ViewEnum.SELLER_LOGIN ||
                currentView === ViewEnum.SELL_CAR
              : item.id === 'menu'
                ? false
                : item.id === 'messages'
                  ? messagesTabActive
                  : item.id === 'deals'
                    ? dealsTabActive
                    : currentView === item.view;

            const handleClick = () => {
              void triggerSelectionHaptic();
              if (item.id === 'menu' && onToggleMenu) {
                onToggleMenu();
                return;
              }
              if (item.id === 'deals') {
                if (!currentUser) {
                  onNavigate(ViewEnum.LOGIN_PORTAL);
                  return;
                }
                onNavigate(ViewEnum.BUYER_DASHBOARD);
                return;
              }
              if (item.id === 'messages' && !currentUser) {
                onNavigate(ViewEnum.LOGIN_PORTAL);
                return;
              }
              if (item.id === 'messages' && currentUser?.role === 'seller') {
                onNavigate(ViewEnum.INBOX);
                return;
              }
              if (item.id === 'sell') {
                onNavigate(mobileSellDestination(currentUser?.role));
                return;
              }
              if (item.view === ViewEnum.INBOX && !currentUser) {
                onNavigate(ViewEnum.LOGIN_PORTAL);
                return;
              }
              onNavigate(item.view);
            };
            
            const tabLabel =
              item.badge !== undefined && item.badge > 0
                ? `${item.label}, ${item.badge} unread`
                : item.label;

            return (
              <button
                key={item.id}
                onClick={handleClick}
                type="button"
                aria-label={tabLabel}
                aria-current={isActive ? 'page' : undefined}
                className="flex min-h-[48px] min-w-0 h-full flex-col items-center justify-center gap-0.5 relative group outline-none focus:outline-none focus-visible:outline-none touch-manipulation"
                style={{ 
                  transition: 'color 0.25s ease, transform 0.2s ease',
                  WebkitTapHighlightColor: 'transparent'
                }}
                onTouchStart={(e) => {
                  const el = e.currentTarget;
                  el.style.transform = 'scale(0.92)';
                }}
                onTouchEnd={(e) => {
                  const el = e.currentTarget;
                  setTimeout(() => {
                    if (el) el.style.transform = '';
                  }, 150);
                }}
              >
                {isActive && (
                  <div
                    className="absolute inset-0 rounded-2xl"
                    style={{
                      background: 'rgba(255, 107, 53, 0.1)',
                      margin: '3px 4px',
                    }}
                  />
                )}

                {/* Icon — fixed box keeps every tab vertically aligned across devices */}
                <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center">
                  <div
                    className="relative"
                    style={{
                      color: isActive || item.isSpecial ? '#FF6B35' : '#6B7280',
                    }}
                  >
                    {item.icon(isActive)}
                  </div>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center text-white text-[9px] font-bold rounded-full px-1 z-20 bg-red-500"
                      style={{ lineHeight: '1' }}
                    >
                      {item.badge > 99 ? '99+' : item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>

                <span
                  className="relative z-10 block max-w-full truncate text-center text-[10px] leading-tight text-gray-900"
                  style={{
                    letterSpacing: '-0.01em',
                    fontWeight: isActive ? 700 : 600,
                  }}
                >
                  {item.label}
                </span>

                {isActive && (
                  <div
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[#FF6B35]"
                    style={{ width: '16px', height: '2px' }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
});

MobileBottomNav.displayName = 'MobileBottomNav';

export default MobileBottomNav;

