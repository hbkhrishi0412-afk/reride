import { useState, useEffect } from 'react';

export type MobileUiDetection = { isMobileApp: boolean; isMobile: boolean };

/**
 * Synchronous mobile / PWA detection for first paint.
 * Without this, `isMobileApp` stayed false until useEffect ran, so phones briefly
 * mounted desktop Home and vehicle taps could target the wrong layout tree.
 */
export function computeMobileUiState(): MobileUiDetection {
  if (typeof window === 'undefined') {
    return { isMobileApp: false, isMobile: false };
  }
  try {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const isStandalone =
      mediaQuery.matches ||
      (window.navigator as any).standalone || // iOS
      document.referrer.includes('android-app://'); // Android

    const isCapacitorNative =
      typeof (window as any).Capacitor !== 'undefined' &&
      (window as any).Capacitor?.isNativePlatform?.() === true;

    const checkMobile =
      /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth <= 768 ||
      'ontouchstart' in window;

    const isMobileBrowser = checkMobile && !isStandalone;
    const shouldShowMobileUI = isCapacitorNative || isStandalone || isMobileBrowser;

    return { isMobileApp: shouldShowMobileUI, isMobile: checkMobile };
  } catch {
    return { isMobileApp: false, isMobile: false };
  }
}

/**
 * Hook to detect if the app is running as an installed PWA (standalone mode)
 * This helps us provide different UI/UX for mobile app vs website
 */
export const useIsMobileApp = () => {
  const initial = computeMobileUiState();
  const [isMobileApp, setIsMobileApp] = useState(initial.isMobileApp);
  const [isMobile, setIsMobile] = useState(initial.isMobile);

  useEffect(() => {
    let mediaQuery: MediaQueryList | null = null;
    let handleDisplayModeChange: ((e: MediaQueryListEvent) => void) | null = null;
    let handleResize: (() => void) | null = null;
    let capRetry: number | undefined;

    try {
      mediaQuery = window.matchMedia('(display-mode: standalone)');

      const detectMobileState = () => {
        const next = computeMobileUiState();
        setIsMobileApp(next.isMobileApp);
        setIsMobile(next.isMobile);
      };

      // Re-run after mount (Capacitor bridge may attach a tick after first paint).
      detectMobileState();
      capRetry = window.setTimeout(detectMobileState, 400);

      // React to install-mode changes and viewport/device changes.
      handleDisplayModeChange = () => detectMobileState();
      handleResize = () => detectMobileState();

      if (mediaQuery && handleDisplayModeChange) {
        mediaQuery.addEventListener('change', handleDisplayModeChange);
      }
      if (handleResize) {
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
      }
    } catch (error) {
      console.error('Error in mobile detection:', error);
      const next = computeMobileUiState();
      setIsMobileApp(next.isMobileApp);
      setIsMobile(next.isMobile);
    }

    return () => {
      if (capRetry !== undefined) {
        window.clearTimeout(capRetry);
      }
      // Proper cleanup
      if (mediaQuery && handleDisplayModeChange) {
        try {
          mediaQuery.removeEventListener('change', handleDisplayModeChange);
        } catch (error) {
          console.warn('Error removing media query listener:', error);
        }
      }
      if (handleResize) {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);
      }
    };
  }, []);

  return {
    isMobileApp,     // True if should show mobile UI (PWA or mobile browser)
    isMobile,        // True if mobile device
    isWebsite: !isMobileApp && !isMobile // Desktop browser
  };
};

export default useIsMobileApp;

