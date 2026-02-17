/**
 * contexts/NavigationContext.tsx — View navigation state management
 *
 * Manages the current view, browser history integration, and
 * URL ↔ view mapping. This is the foundation that should eventually
 * be replaced with React Router.
 *
 * Usage:
 *   const { currentView, navigate, goBack } = useNavigation();
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { View } from '../types';
import { logInfo, logDebug } from '../utils/logger';

// ── Path ↔ View mapping ────────────────────────────────────────────────────

const VIEW_TO_PATH: Record<View, string> = {
  [View.HOME]: '/',
  [View.USED_CARS]: '/used-cars',
  [View.NEW_CARS]: '/new-cars',
  [View.CAR_SERVICES]: '/car-services',
  [View.SERVICE_DETAIL]: '/car-services/detail',
  [View.CAR_SERVICE_LOGIN]: '/car-services/login',
  [View.CAR_SERVICE_DASHBOARD]: '/car-services/dashboard',
  [View.SERVICE_CART]: '/car-services/cart',
  [View.RENTAL]: '/rental',
  [View.DEALER_PROFILES]: '/dealers',
  [View.DETAIL]: '/vehicle',
  [View.SELLER_DASHBOARD]: '/seller/dashboard',
  [View.ADMIN_PANEL]: '/admin/panel',
  [View.LOGIN_PORTAL]: '/login',
  [View.CUSTOMER_LOGIN]: '/login',
  [View.SELLER_LOGIN]: '/login',
  [View.ADMIN_LOGIN]: '/admin',
  [View.COMPARISON]: '/compare',
  [View.WISHLIST]: '/wishlist',
  [View.PROFILE]: '/profile',
  [View.FORGOT_PASSWORD]: '/forgot-password',
  [View.INBOX]: '/inbox',
  [View.SELLER_PROFILE]: '/seller',
  [View.PRICING]: '/pricing',
  [View.SUPPORT]: '/support',
  [View.FAQ]: '/faq',
  [View.PRIVACY_POLICY]: '/privacy-policy',
  [View.TERMS_OF_SERVICE]: '/terms-of-service',
  [View.BUYER_DASHBOARD]: '/buyer/dashboard',
  [View.CITY_LANDING]: '/city',
  [View.SELL_CAR]: '/sell-car',
  [View.SELL_CAR_ADMIN]: '/admin/sell-car',
  [View.NEW_CARS_ADMIN_LOGIN]: '/admin/new-cars',
  [View.NEW_CARS_ADMIN_PANEL]: '/admin/new-cars/manage',
};

export function pathToView(path: string): View {
  const p = path.toLowerCase();
  if (p === '/' || p === '') return View.HOME;

  // Check exact matches first
  for (const [view, viewPath] of Object.entries(VIEW_TO_PATH)) {
    if (p === viewPath) return view as View;
  }

  // Pattern matches
  if (p.startsWith('/vehicle/')) return View.DETAIL;
  if (p.startsWith('/seller/')) return View.SELLER_PROFILE;
  if (p.startsWith('/city/')) return View.CITY_LANDING;

  return View.HOME;
}

export function viewToPath(view: View): string {
  return VIEW_TO_PATH[view] || '/';
}

// ── Context type ────────────────────────────────────────────────────────────

interface NavigationContextType {
  currentView: View;
  previousView: View;
  setCurrentView: (view: View) => void;
  setPreviousView: (view: View) => void;
  navigate: (view: View, params?: { city?: string }) => void;
  goBack: (fallbackView?: View) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

// ── Hook ────────────────────────────────────────────────────────────────────

export function useNavigation(): NavigationContextType {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within a NavigationProvider');
  return ctx;
}

// ── Provider ────────────────────────────────────────────────────────────────

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentViewRaw] = useState<View>(() => {
    // Determine initial view from URL
    try {
      const path = window.location.pathname;
      return pathToView(path);
    } catch {
      return View.HOME;
    }
  });

  const [previousView, setPreviousView] = useState<View>(View.HOME);
  const isHandlingPopStateRef = useRef(false);

  const setCurrentView = useCallback((view: View) => {
    setCurrentViewRaw((prev) => {
      setPreviousView(prev);
      return view;
    });
  }, []);

  const navigate = useCallback(
    (view: View, params?: { city?: string }) => {
      setCurrentView(view);

      // Push to browser history
      let path = viewToPath(view);
      if (params?.city && view === View.CITY_LANDING) {
        path = `/city/${params.city.toLowerCase()}`;
      }

      try {
        window.history.pushState(
          { view, previousView: currentView, timestamp: Date.now() },
          '',
          path,
        );
      } catch {
        // ignore history errors
      }

      // Scroll to top on navigation
      window.scrollTo(0, 0);
    },
    [currentView, setCurrentView],
  );

  const goBack = useCallback(
    (fallbackView: View = View.HOME) => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        navigate(fallbackView);
      }
    },
    [navigate],
  );

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (isHandlingPopStateRef.current) return;
      isHandlingPopStateRef.current = true;

      try {
        const state = event.state;
        if (state?.view) {
          setCurrentViewRaw(state.view);
          if (state.previousView) setPreviousView(state.previousView);
        } else {
          // Fallback to URL-based navigation
          const view = pathToView(window.location.pathname);
          setCurrentViewRaw(view);
        }
      } finally {
        // Reset flag after a short delay
        setTimeout(() => {
          isHandlingPopStateRef.current = false;
        }, 100);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const value: NavigationContextType = {
    currentView,
    previousView,
    setCurrentView,
    setPreviousView,
    navigate,
    goBack,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

