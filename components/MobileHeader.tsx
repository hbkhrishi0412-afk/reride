import React, { useState } from 'react';
import type { User } from '../types.js';
import { View as ViewEnum } from '../types.js';
import Logo from './Logo.js';

interface MobileHeaderProps {
  onNavigate: (view: ViewEnum) => void;
  currentUser: User | null;
  onLogout: () => void;
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  currentView?: ViewEnum;
  showMenu?: boolean;
  onToggleMenu?: () => void;
}

/**
 * Mobile App Header - Compact design for installed PWA
 * Features: Small icons, minimal space, app-like feel
 */
const MobileHeader: React.FC<MobileHeaderProps> = ({
  onNavigate,
  currentUser,
  onLogout,
  title,
  showBack = false,
  onBack,
  rightAction,
  currentView,
  showMenu: showMenuProp,
  onToggleMenu
}) => {
  const [internalShowMenu, setInternalShowMenu] = useState(false);
  const showMenu = showMenuProp !== undefined ? showMenuProp : internalShowMenu;
  const setShowMenu = onToggleMenu || setInternalShowMenu;
  
  // Check if current view should have transparent header
  const isGradientView = currentView && (
    currentView === ViewEnum.HOME ||
    currentView === ViewEnum.LOGIN_PORTAL ||
    currentView === ViewEnum.CUSTOMER_LOGIN ||
    currentView === ViewEnum.SELLER_LOGIN ||
    currentView === ViewEnum.ADMIN_LOGIN
  );

  return (
    <>
      {/* Premium Mobile Header with Glassmorphism */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 safe-top" data-testid="mobile-header" style={{ 
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: isGradientView
          ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.1) 100%)'
          : 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.95) 100%)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: isGradientView
          ? '0.5px solid rgba(255, 255, 255, 0.2)'
          : '0.5px solid rgba(0, 0, 0, 0.08)',
        boxShadow: isGradientView
          ? '0 1px 3px rgba(0, 0, 0, 0.1)'
          : '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)'
      }}>
        <div className="flex items-center justify-between h-full px-4">
          {/* Left Section */}
          <div className="flex items-center gap-3">
            {showBack ? (
              <button
                onClick={onBack}
                className="p-2 -ml-2 active:opacity-50 native-transition"
                style={{ minWidth: '44px', minHeight: '44px' }}
                aria-label="Go back"
              >
                <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 -ml-2 rounded-full active:scale-95 native-transition"
                aria-label="Toggle menu"
                style={{ 
                  minWidth: '44px', 
                  minHeight: '44px',
                  background: 'rgba(0, 0, 0, 0.04)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1)'
                }}
                aria-label="Menu"
                data-testid="mobile-menu-button"
              >
                <svg 
                  className="w-6 h-6" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24" 
                  strokeWidth={2.5}
                  style={{ 
                    color: isGradientView ? '#FFFFFF' : '#1A1A1A'
                  }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            
            {/* Center Title - Premium Typography */}
            <h1 
              className="text-base font-bold absolute left-1/2 transform -translate-x-1/2 max-w-[240px] sm:max-w-[280px] truncate tracking-tight" 
              style={{ 
                letterSpacing: '-0.01em',
                color: isGradientView ? '#FFFFFF' : '#1A1A1A'
              }}
            >
              {title}
            </h1>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2">
            {rightAction || (
              <>
                {/* Search Icon */}
                <button
                  onClick={() => onNavigate(ViewEnum.USED_CARS)}
                  className="p-2 rounded-full active:scale-95 native-transition"
                  style={{ 
                    minWidth: '44px', 
                    minHeight: '44px',
                    background: 'rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1)'
                  }}
                  aria-label="Search"
                  data-testid="mobile-search-button"
                >
                  <svg 
                    className="w-6 h-6" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24" 
                    strokeWidth={2.5}
                    style={{ 
                    color: isGradientView ? '#FFFFFF' : '#1A1A1A'
                  }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>

                {/* Notifications Icon */}
                {currentUser && (
                  <button
                    className="p-2 active:opacity-50 native-transition relative"
                    style={{ minWidth: '44px', minHeight: '44px' }}
                    aria-label="Notifications"
                  >
                    <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {/* Notification badge */}
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-orange-500 rounded-full"></span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Slide-out Menu */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 animate-fade-in"
            onClick={() => setShowMenu(false)}
          />
          <div 
            className="fixed top-0 left-0 bottom-0 w-72 bg-white z-50 shadow-xl animate-slide-in-left" 
            data-testid="mobile-drawer"
          >
            <div className="h-full flex flex-col">
              {/* Menu Header */}
              <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-orange-500 to-orange-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Logo size="sm" showText={false} />
                    <div>
                      <p className="text-white font-semibold text-sm">
                        {currentUser?.name || 'Guest'}
                      </p>
                      <p className="text-orange-100 text-xs">
                        {currentUser?.email || 'Not logged in'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowMenu(false)}
                    className="p-1 hover:bg-orange-400 rounded-full transition-colors"
                    data-testid="mobile-drawer-close"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Menu Items */}
              <nav className="flex-1 overflow-y-auto py-2">
                <MenuItem
                  icon={<HomeIcon />}
                  label="Home"
                  onClick={() => { onNavigate(ViewEnum.HOME); setShowMenu(false); }}
                />
                <MenuItem
                  icon={<CarIcon />}
                  label="Buy Car"
                  onClick={() => { onNavigate(ViewEnum.USED_CARS); setShowMenu(false); }}
                />
                <MenuItem
                  icon={<SellCarIcon />}
                  label="Sell Car"
                  onClick={() => { 
                    if (currentUser?.role === 'seller') {
                      onNavigate(ViewEnum.SELLER_DASHBOARD);
                    } else {
                      onNavigate(ViewEnum.SELLER_LOGIN);
                    }
                    setShowMenu(false); 
                  }}
                />
                <MenuItem
                  icon={<NewCarIcon />}
                  label="New Cars"
                  onClick={() => { onNavigate(ViewEnum.NEW_CARS); setShowMenu(false); }}
                />
                <MenuItem
                  icon={<DealerIcon />}
                  label="Dealers"
                  onClick={() => { onNavigate(ViewEnum.DEALER_PROFILES); setShowMenu(false); }}
                />
                <MenuItem
                  icon={<ServiceIcon />}
                  label="Car Services"
                  onClick={() => { onNavigate(ViewEnum.CAR_SERVICES); setShowMenu(false); }}
                />
                
                <div className="border-t border-gray-200 my-2"></div>
                
                {currentUser && (
                  <>
                    <MenuItem
                      icon={<HeartIcon />}
                      label="My Wishlist"
                      onClick={() => { onNavigate(ViewEnum.WISHLIST); setShowMenu(false); }}
                    />
                    <MenuItem
                      icon={<MessageIcon />}
                      label="Messages"
                      onClick={() => { onNavigate(ViewEnum.INBOX); setShowMenu(false); }}
                    />
                    {currentUser.role === 'seller' && (
                      <MenuItem
                        icon={<DashboardIcon />}
                        label="Seller Dashboard"
                        onClick={() => { onNavigate(ViewEnum.SELLER_DASHBOARD); setShowMenu(false); }}
                      />
                    )}
                    {currentUser.role === 'customer' && (
                      <MenuItem
                        icon={<UserIcon />}
                        label="My Dashboard"
                        onClick={() => { onNavigate(ViewEnum.BUYER_DASHBOARD); setShowMenu(false); }}
                      />
                    )}
                  </>
                )}
                
                <div className="border-t border-gray-200 my-2"></div>
                <MenuItem
                  icon={<InfoIcon />}
                  label="Support"
                  onClick={() => { onNavigate(ViewEnum.SUPPORT); setShowMenu(false); }}
                />
                <MenuItem
                  icon={<QuestionIcon />}
                  label="FAQ"
                  onClick={() => { onNavigate(ViewEnum.FAQ); setShowMenu(false); }}
                />
                
                {/* Logout Option */}
                {currentUser && (
                  <>
                    <div className="border-t border-gray-200 my-2"></div>
                    <MenuItem
                      icon={<LogoutIcon />}
                      label="Logout"
                      onClick={() => { onLogout(); setShowMenu(false); }}
                    />
                  </>
                )}
                
                {/* Login Option for Guests */}
                {!currentUser && (
                  <>
                    <div className="border-t border-gray-200 my-2"></div>
                    <MenuItem
                      icon={<LoginIcon />}
                      label="Login"
                      onClick={() => { onNavigate(ViewEnum.LOGIN_PORTAL); setShowMenu(false); }}
                    />
                  </>
                )}
              </nav>
            </div>
          </div>
        </>
      )}
    </>
  );
};

// Menu Item Component
const MenuItem: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({
  icon,
  label,
  onClick
}) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
  >
    <div className="w-5 h-5 text-gray-600">{icon}</div>
    <span className="text-gray-800 text-sm font-medium">{label}</span>
  </button>
);

// Small Icon Components
const HomeIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const CarIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
);

const SellCarIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const NewCarIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const DealerIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const ServiceIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const HeartIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const MessageIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const DashboardIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const UserIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const InfoIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const QuestionIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const LogoutIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const LoginIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
  </svg>
);

export default MobileHeader;

