import React, { useMemo } from 'react';
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
  const navItems = useMemo(() => [
    {
      id: 'home',
      label: 'Home',
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
      label: 'Buy',
      view: ViewEnum.USED_CARS,
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 0 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8M8 7V5a1 1 0 011-1h6a1 1 0 011 1v2M8 7v10a1 1 0 001 1h6a1 1 0 001-1V7M6 9h12M6 9v6M18 9v6" />
        </svg>
      )
    },
    {
      id: 'car-service',
      label: 'Car service',
      view: ViewEnum.CAR_SERVICES,
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 0 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 'sell',
      label: 'Sell',
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
      label: 'Messages',
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
      label: 'Menu',
      view: ViewEnum.HOME,
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 0 : 2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      )
    }
  ], [currentUser, inboxCount, wishlistCount]);

  return (
    <>
      {/* Ultra Premium Bottom Navigation with Advanced Glassmorphism */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-40 safe-bottom" 
        data-testid="mobile-bottom-nav" 
        style={{ 
          height: '70px', 
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.96) 100%)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderTop: '0.5px solid rgba(0, 0, 0, 0.08)',
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
          className="flex items-center justify-around h-full px-2" 
          style={{ height: 'calc(70px - env(safe-area-inset-bottom, 0px))' }}
        >
          {navItems.map((item) => {
            // For Sell button, check active state against all sell-related views
            // Menu button is never active (it's just a toggle)
            const isActive = item.id === 'sell' 
              ? (currentView === ViewEnum.SELLER_DASHBOARD || 
                 currentView === ViewEnum.SELLER_LOGIN || 
                 currentView === ViewEnum.SELL_CAR)
              : item.id === 'menu' 
              ? false // Menu button is never active
              : currentView === item.view;
            
            const handleClick = () => {
              // For menu button, toggle menu drawer instead of navigating
              if (item.id === 'menu' && onToggleMenu) {
                onToggleMenu();
                return;
              }
              // For other items, navigate to the view specified in the item
              onNavigate(item.view);
            };
            
            return (
              <button
                key={item.id}
                onClick={handleClick}
                className="flex flex-col items-center justify-center flex-1 h-full relative group"
                style={{ 
                  minHeight: '48px',
                  transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  WebkitTapHighlightColor: 'transparent'
                }}
                onTouchStart={(e) => {
                  e.currentTarget.style.transform = 'scale(0.92)';
                }}
                onTouchEnd={(e) => {
                  setTimeout(() => {
                    e.currentTarget.style.transform = '';
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
                        boxShadow: '0 6px 16px rgba(255, 107, 53, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.7), inset 0 -1px 0 rgba(255, 107, 53, 0.1)',
                        animation: 'fadeInScale 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        margin: '3px 4px',
                        border: '0.5px solid rgba(255, 107, 53, 0.15)'
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
                
                {/* Icon Container with Premium Effects */}
                <div className="relative mb-1 z-10">
                  <div 
                    className="relative transition-all duration-500 ease-out"
                    style={{ 
                      color: item.isSpecial ? (isActive ? '#FF6B35' : '#FF6B35') : (isActive ? '#FF6B35' : '#6B7280'),
                      transform: isActive ? 'scale(1.2) translateY(-3px)' : 'scale(1)',
                      filter: isActive ? 'drop-shadow(0 3px 6px rgba(255, 107, 53, 0.4))' : (item.isSpecial ? 'drop-shadow(0 2px 4px rgba(255, 107, 53, 0.3))' : 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))')
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
                
                {/* Label with Premium Typography & Animation */}
                <span 
                  className="text-[11px] font-semibold transition-all duration-500 relative z-10"
                  style={{ 
                    color: item.isSpecial ? (isActive ? '#D97706' : '#D97706') : (isActive ? '#FF6B35' : '#6B7280'),
                    letterSpacing: '-0.01em',
                    textShadow: isActive ? '0 1px 3px rgba(255, 107, 53, 0.25)' : 'none',
                    transform: isActive ? 'translateY(-2px)' : 'translateY(0)',
                    fontWeight: isActive ? 700 : 600,
                    opacity: isActive ? 1 : (item.isSpecial ? 0.9 : 0.85)
                  }}
                >
                  {item.label}
                </span>
                
                {/* Premium Active Indicator - Refined Dot or Line */}
                {isActive && (
                  <div 
                    className="absolute bottom-1.5 left-1/2 transform -translate-x-1/2 rounded-full"
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

