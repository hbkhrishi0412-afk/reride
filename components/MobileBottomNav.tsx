import React, { useMemo, useCallback } from 'react';
import type { User } from '../types.js';
import { View as ViewEnum } from '../types.js';

interface MobileBottomNavProps {
  currentView: ViewEnum;
  onNavigate: (view: ViewEnum) => void;
  currentUser: User | null;
  wishlistCount?: number;
  inboxCount?: number;
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
  inboxCount = 0
}) => {
  const navItems = useMemo(() => [
    {
      id: 'home',
      label: 'Home',
      view: ViewEnum.HOME,
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-600'}`} fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      id: 'browse',
      label: 'Browse',
      view: ViewEnum.USED_CARS,
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-600'}`} fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      )
    },
    {
      id: 'wishlist',
      label: 'Saved',
      view: ViewEnum.WISHLIST,
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-600'}`} fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
      badge: wishlistCount
    },
    {
      id: 'inbox',
      label: 'Messages',
      view: ViewEnum.INBOX,
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-600'}`} fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      badge: inboxCount,
      requiresAuth: true
    },
    {
      id: 'dashboard',
      label: currentUser ? 'Dashboard' : 'Account',
      view: currentUser?.role === 'seller' ? ViewEnum.SELLER_DASHBOARD : 
            currentUser?.role === 'customer' ? ViewEnum.BUYER_DASHBOARD :
            currentUser?.role === 'admin' ? ViewEnum.ADMIN_PANEL :
            ViewEnum.LOGIN_PORTAL,
      icon: (active: boolean) => (
        <svg className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-600'}`} fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 0 : 2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    }
  ], [currentUser, wishlistCount, inboxCount]);

  return (
    <>
      {/* Premium Bottom Navigation with Enhanced Glassmorphism */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 safe-bottom" data-testid="mobile-bottom-nav" style={{ 
        height: '64px', 
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.95) 100%)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '0.5px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.04), 0 -1px 3px rgba(0, 0, 0, 0.06)'
      }}>
        <div className="flex items-center justify-around h-full px-2" style={{ height: 'calc(64px - env(safe-area-inset-bottom, 0px))' }}>
          {navItems.map((item) => {
            // Skip auth-required items if not logged in
            if (item.requiresAuth && !currentUser) return null;
            
            const isActive = currentView === item.view;
            
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.view)}
                className="flex flex-col items-center justify-center flex-1 h-full relative"
                style={{ 
                  minHeight: '44px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
                  transform: isActive ? 'scale(1.05)' : 'scale(1)'
                }}
              >
                {/* Icon with Premium Styling */}
                <div className="relative mb-1">
                  <div 
                    className="transition-all duration-300"
                    style={{ 
                      color: isActive ? '#FF6B35' : '#6B7280',
                      transform: isActive ? 'scale(1.1)' : 'scale(1)'
                    }}
                  >
                    {item.icon(isActive)}
                  </div>
                  {/* Premium Badge */}
                  {item.badge && item.badge > 0 && (
                    <span 
                      className="absolute -top-1 -right-1 min-w-[18px] h-4.5 flex items-center justify-center text-white text-[10px] font-bold rounded-full px-1.5"
                      style={{
                        background: 'linear-gradient(135deg, #FF6B35 0%, #FF8456 100%)',
                        boxShadow: '0 2px 4px rgba(255, 107, 53, 0.3)',
                        animation: item.badge > 0 ? 'pulse 2s infinite' : 'none'
                      }}
                    >
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                
                {/* Label with Premium Typography */}
                <span 
                  className="text-[11px] font-semibold transition-all duration-300"
                  style={{ 
                    color: isActive ? '#FF6B35' : '#6B7280',
                    letterSpacing: '-0.01em'
                  }}
                >
                  {item.label}
                </span>
                
                {/* Premium Active Indicator */}
                {isActive && (
                  <div 
                    className="absolute bottom-0 left-1/2 transform -translate-x-1/2 rounded-full"
                    style={{
                      width: '32px',
                      height: '3px',
                      background: 'linear-gradient(90deg, #FF6B35 0%, #FF8456 100%)',
                      boxShadow: '0 2px 4px rgba(255, 107, 53, 0.4)',
                      animation: 'slideUp 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)'
                    }}
                  ></div>
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

