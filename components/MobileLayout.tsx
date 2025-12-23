import React, { useMemo } from 'react';
import MobileHeader from './MobileHeader';
import MobileBottomNav from './MobileBottomNav';
import type { User } from '../types';
import { View as ViewEnum } from '../types';

interface MobileLayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
  showBottomNav?: boolean;
  headerTitle?: string;
  headerActions?: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  currentView: ViewEnum;
  onNavigate: (view: ViewEnum) => void;
  currentUser: User | null;
  onLogout: () => void;
  wishlistCount?: number;
  inboxCount?: number;
}

/**
 * Unified Mobile Layout Wrapper
 * Provides consistent structure for all mobile app views
 * Handles safe areas, fixed headers, and bottom navigation
 * Optimized with React.memo for performance
 */
export const MobileLayout: React.FC<MobileLayoutProps> = React.memo(({
  children,
  showHeader = true,
  showBottomNav = true,
  headerTitle,
  headerActions,
  showBack = false,
  onBack,
  currentView,
  onNavigate,
  currentUser,
  onLogout,
  wishlistCount = 0,
  inboxCount = 0
}) => {
  const headerHeight = showHeader ? 56 : 0;
  const bottomNavHeight = showBottomNav ? 64 : 0;
  
  // Memoize computed styles to prevent recalculation
  const mainStyles = useMemo(() => {
    const mainMarginTop = showHeader ? `${headerHeight}px` : '0px';
    const safeAreaTop = 'env(safe-area-inset-top, 0px)';
    const safeAreaBottom = 'env(safe-area-inset-bottom, 0px)';
    
    return {
      height: `calc(100vh - ${headerHeight}px - ${bottomNavHeight}px)`,
      marginTop: mainMarginTop,
      marginBottom: `${bottomNavHeight}px`,
      paddingTop: safeAreaTop,
      paddingBottom: safeAreaBottom,
      paddingLeft: 'env(safe-area-inset-left, 0px)',
      paddingRight: 'env(safe-area-inset-right, 0px)',
      WebkitOverflowScrolling: 'touch' as const,
      overscrollBehavior: 'contain' as const,
    };
  }, [headerHeight, bottomNavHeight, showHeader]);

  // Check if this is the Home or Login view to allow gradient background
  const shouldShowGradient = useMemo(() => {
    const isHomeView = currentView === ViewEnum.HOME;
    const isLoginView = [
      ViewEnum.LOGIN_PORTAL,
      ViewEnum.CUSTOMER_LOGIN,
      ViewEnum.SELLER_LOGIN,
      ViewEnum.ADMIN_LOGIN
    ].includes(currentView);
    return isHomeView || isLoginView;
  }, [currentView]);
  
  return (
    <div 
      className="native-app fixed inset-0 overflow-hidden"
      style={shouldShowGradient ? {
        background: 'transparent'
      } : {}}
    >
      {showHeader && (
        <MobileHeader
          onNavigate={onNavigate}
          currentUser={currentUser}
          onLogout={onLogout}
          title={headerTitle || 'ReRide'}
          showBack={showBack}
          onBack={onBack}
          rightAction={headerActions}
        />
      )}
      
      <main 
        className="overflow-y-auto native-scroll w-full"
        style={{
          ...mainStyles,
          background: shouldShowGradient ? 'transparent' : 'linear-gradient(180deg, #FAFAFA 0%, #FFFFFF 100%)'
        }}
      >
        {children}
      </main>
      
      {showBottomNav && (
        <MobileBottomNav
          currentView={currentView}
          onNavigate={onNavigate}
          currentUser={currentUser}
          wishlistCount={wishlistCount}
          inboxCount={inboxCount}
        />
      )}
    </div>
  );
});

MobileLayout.displayName = 'MobileLayout';

export default MobileLayout;

