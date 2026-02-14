import { useState, useEffect } from 'react';

/**
 * Hook to detect if the app is running as an installed PWA (standalone mode)
 * This helps us provide different UI/UX for mobile app vs website
 */
export const useIsMobileApp = () => {
  const [isMobileApp, setIsMobileApp] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    let mediaQuery: MediaQueryList | null = null;
    let handleDisplayModeChange: ((e: MediaQueryListEvent) => void) | null = null;
    let handleResize: (() => void) | null = null;

    try {
      mediaQuery = window.matchMedia('(display-mode: standalone)');

      const detectMobileState = () => {
        const isStandalone = mediaQuery?.matches ||
          (window.navigator as any).standalone || // iOS
          document.referrer.includes('android-app://'); // Android

        const checkMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
          window.innerWidth <= 768 ||
          ('ontouchstart' in window);

        const isMobileBrowser = checkMobile && !isStandalone;
        const shouldShowMobileUI = isStandalone || isMobileBrowser;

        setIsMobileApp(shouldShowMobileUI);
        setIsMobile(checkMobile);
      };

      // Initial detection.
      detectMobileState();

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
      // Fallback to basic detection
      setIsMobileApp(false);
      setIsMobile(false);
    }

    return () => {
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

