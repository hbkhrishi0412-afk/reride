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
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 0 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      id: 'browse',
      label: 'Browse',
      view: ViewEnum.USED_CARS,
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 0 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      )
    },
    {
      id: 'wishlist',
      label: 'Saved',
      view: ViewEnum.WISHLIST,
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 0 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
      badge: wishlistCount
    },
    {
      id: 'inbox',
      label: 'Messages',
      view: ViewEnum.INBOX,
      icon: (active: boolean) => (
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 0 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
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
        <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 0 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    }
  ], [currentUser, wishlistCount, inboxCount]);

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
            // Skip auth-required items if not logged in
            if (item.requiresAuth && !currentUser) return null;
            
            const isActive = currentView === item.view;
            
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.view)}
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
                      color: isActive ? '#FF6B35' : '#6B7280',
                      transform: isActive ? 'scale(1.2) translateY(-3px)' : 'scale(1)',
                      filter: isActive ? 'drop-shadow(0 3px 6px rgba(255, 107, 53, 0.4))' : 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))'
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
                    color: isActive ? '#FF6B35' : '#6B7280',
                    letterSpacing: '-0.01em',
                    textShadow: isActive ? '0 1px 3px rgba(255, 107, 53, 0.25)' : 'none',
                    transform: isActive ? 'translateY(-2px)' : 'translateY(0)',
                    fontWeight: isActive ? 700 : 600,
                    opacity: isActive ? 1 : 0.85
                  }}
                >
                  {item.label}
                </span>
                
                {/* Premium Active Indicator - Refined Dot */}
                {isActive && (
                  <div 
                    className="absolute bottom-1.5 left-1/2 transform -translate-x-1/2 rounded-full"
                    style={{
                      width: '5px',
                      height: '5px',
                      background: 'linear-gradient(135deg, #FF6B35 0%, #FF8456 100%)',
                      boxShadow: '0 0 10px rgba(255, 107, 53, 0.7), 0 2px 4px rgba(255, 107, 53, 0.5)',
                      animation: 'badgePulse 2s ease-in-out infinite, slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
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

