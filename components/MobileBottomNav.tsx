import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { User } from '../types.js';
import { View as ViewEnum } from '../types.js';

interface MobileBottomNavProps {
  currentView: ViewEnum;
  onNavigate: (view: ViewEnum) => void;
  currentUser: User | null;
  wishlistCount?: number;
  inboxCount?: number;
  onToggleMenu?: () => void;
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
  wishlistCount = 0,
  inboxCount = 0,
  onToggleMenu
}) => {
  const { t, i18n } = useTranslation();
  const navItems = useMemo(() => [
    {
      id: 'home',
      label: t('nav.home'),
      view: ViewEnum.HOME,
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 0 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      badge: wishlistCount > 0 ? wishlistCount : undefined // Show wishlist count on home icon
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
      view: ViewEnum.SELL_CAR, // Navigate to seller type selection page first
      icon: (active: boolean) => (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="4" width="16" height="16" rx="3" fill={active ? '#FF6B35' : '#FF6B35'} opacity={active ? 1 : 0.9} />
          <path d="M12 8v8M8 12h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      ),
      isSpecial: true
    },
    {
      id: 'messages',
      label: t('nav.messages'),
      view: ViewEnum.INBOX,
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 0 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      badge: inboxCount
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
  ], [t, i18n.language, inboxCount, wishlistCount]);

  return (
    <>
      {/* Bottom nav: fixed content row (56px) + safe-area inset below — avoids squashing tabs on notched devices */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-40 box-border" 
        data-testid="mobile-bottom-nav" 
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
          className="grid h-14 w-full max-w-3xl mx-auto grid-cols-6 items-stretch gap-0 px-0.5 sm:px-2" 
        >
          {navItems.map((item) => {
            const messagesTabActive =
              item.id === 'messages' && currentView === ViewEnum.INBOX;

            const isActive = item.id === 'sell'
              ? currentView === ViewEnum.SELLER_DASHBOARD ||
                currentView === ViewEnum.SELLER_LOGIN ||
                currentView === ViewEnum.SELL_CAR
              : item.id === 'menu'
                ? false
                : item.id === 'messages'
                  ? messagesTabActive
                  : currentView === item.view;

            const handleClick = () => {
              if (item.id === 'menu' && onToggleMenu) {
                onToggleMenu();
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
              if (item.view === ViewEnum.INBOX && !currentUser) {
                onNavigate(ViewEnum.LOGIN_PORTAL);
                return;
              }
              onNavigate(item.view);
            };
            
            return (
              <button
                key={item.id}
                onClick={handleClick}
                type="button"
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
                {/* Active Background Pill - Enhanced Premium Design */}
                {isActive && (
                  <>
                    <div 
                      className="absolute inset-0 rounded-2xl"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.15) 0%, rgba(255, 132, 86, 0.1) 100%)',
                        boxShadow: '0 6px 16px rgba(255, 107, 53, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.7)',
                        animation: 'fadeInScale 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        margin: '3px 4px'
                      }}
                    />
                    {/* Subtle inner glow */}
                    <div 
                      className="absolute inset-0 rounded-2xl opacity-50"
                      style={{
                        background: 'radial-gradient(circle at center, rgba(255, 107, 53, 0.1) 0%, transparent 70%)',
                        margin: '3px 4px',
                        pointerEvents: 'none'
                      }}
                    />
                  </>
                )}
                
                {/* Inactive Hover State */}
                {!isActive && (
                  <div 
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.02) 0%, rgba(0, 0, 0, 0.01) 100%)',
                      margin: '3px 4px',
                      pointerEvents: 'none'
                    }}
                  />
                )}
                
                {/* Icon — fixed box keeps every tab vertically aligned across devices */}
                <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center">
                  <div 
                    className="relative transition-transform duration-200 ease-out"
                    style={{ 
                      color: item.isSpecial ? (isActive ? '#FF6B35' : '#FF6B35') : (isActive ? '#FF6B35' : '#6B7280'),
                      transform: isActive ? 'scale(1.08)' : 'scale(1)',
                      transformOrigin: 'center center',
                      filter: isActive ? 'drop-shadow(0 2px 4px rgba(255, 107, 53, 0.35))' : (item.isSpecial ? 'drop-shadow(0 2px 4px rgba(255, 107, 53, 0.3))' : 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))')
                    }}
                  >
                    {item.icon(isActive)}
                    
                    {/* Icon glow effect when active */}
                    {isActive && (
                      <div 
                        className="absolute inset-0 rounded-full blur-lg opacity-40"
                        style={{
                          background: 'radial-gradient(circle, #FF6B35 0%, transparent 70%)',
                          transform: 'scale(1.8)',
                          animation: 'pulse 2s ease-in-out infinite'
                        }}
                      />
                    )}
                  </div>
                  
                  {/* Premium Badge - Only show when count > 0 */}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span 
                      className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center text-white text-[9px] font-black rounded-full px-1 z-20"
                      style={{
                        background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 50%, #EF4444 100%)',
                        backgroundSize: '200% 100%',
                        boxShadow: '0 2px 6px rgba(239, 68, 68, 0.5), 0 1px 2px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                        border: '1.5px solid rgba(255, 255, 255, 0.4)',
                        animation: 'badgePulse 2s ease-in-out infinite, shimmer 3s linear infinite',
                        letterSpacing: '-0.01em',
                        fontWeight: 900,
                        lineHeight: '1'
                      }}
                    >
                      {item.badge > 99 ? '99+' : item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                
                <span 
                  className="relative z-10 block max-w-full truncate text-center text-[10px] font-semibold leading-none transition-colors duration-200 sm:text-[11px]"
                  style={{ 
                    color: item.isSpecial ? (isActive ? '#D97706' : '#D97706') : (isActive ? '#FF6B35' : '#6B7280'),
                    letterSpacing: '-0.01em',
                    textShadow: isActive ? '0 1px 2px rgba(255, 107, 53, 0.2)' : 'none',
                    fontWeight: isActive ? 700 : 600,
                    opacity: isActive ? 1 : (item.isSpecial ? 0.9 : 0.85)
                  }}
                >
                  {item.label}
                </span>
                
                {/* Premium Active Indicator - Refined Dot or Line */}
                {isActive && (
                  <div 
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full"
                    style={{
                      width: item.id === 'buy' ? '24px' : '5px',
                      height: item.id === 'buy' ? '2px' : '5px',
                      background: item.id === 'buy' 
                        ? 'linear-gradient(90deg, transparent 0%, #FFD700 50%, transparent 100%)'
                        : item.id === 'sell'
                        ? 'linear-gradient(90deg, transparent 0%, #3B82F6 50%, transparent 100%)'
                        : 'linear-gradient(135deg, #FF6B35 0%, #FF8456 100%)',
                      boxShadow: item.id === 'buy' || item.id === 'sell'
                        ? 'none'
                        : '0 0 10px rgba(255, 107, 53, 0.7), 0 2px 4px rgba(255, 107, 53, 0.5)',
                      animation: item.id === 'buy' || item.id === 'sell' 
                        ? 'none' 
                        : 'badgePulse 2s ease-in-out infinite, slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      borderRadius: item.id === 'buy' || item.id === 'sell' ? '2px' : '50%'
                    }}
                  />
                )}
                
                {/* Hover Ripple Effect */}
                <div 
                  className="absolute inset-0 rounded-2xl opacity-0 group-active:opacity-100 transition-opacity duration-200"
                  style={{
                    background: 'radial-gradient(circle, rgba(255, 107, 53, 0.1) 0%, transparent 70%)',
                    transform: 'scale(0)',
                    animation: isActive ? 'none' : 'ripple 0.6s ease-out'
                  }}
                />
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

