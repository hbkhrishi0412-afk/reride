/**
 * Viewport Zoom Utility
 * Ensures proper zoom/viewport scaling across all pages
 */

import React from 'react';

/**
 * Resets browser zoom to 100% and ensures proper viewport scaling
 */
export const resetViewportZoom = (): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  try {
    // Reset CSS zoom
    document.documentElement.style.zoom = '1';
    document.body.style.zoom = '1';
    
    // Reset transform scale
    document.documentElement.style.transform = 'scale(1)';
    document.body.style.transform = 'scale(1)';
    
    // Ensure viewport meta tag is correct
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.setAttribute('name', 'viewport');
      document.head.appendChild(viewport);
    }
    
    viewport.setAttribute(
      'content',
      'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, shrink-to-fit=no'
    );
    
    // Prevent text size adjustment that causes zooming
    const htmlElement = document.documentElement;
    if ('textSizeAdjust' in htmlElement.style) {
      (htmlElement.style as any).textSizeAdjust = '100%';
    }
    
    // Set webkit text size adjust
    if ('webkitTextSizeAdjust' in htmlElement.style) {
      (htmlElement.style as any).webkitTextSizeAdjust = '100%';
    }
  } catch (error) {
    // Silently fail if there's an error
    if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to reset viewport zoom:', error);
    }
  }
};

/**
 * Initializes viewport zoom fix - should be called on app mount
 */
export const initializeViewportZoom = (): void => {
  resetViewportZoom();
  
  // Reset zoom on window resize
  if (typeof window !== 'undefined') {
    let resizeTimeout: NodeJS.Timeout | null = null;
    
    window.addEventListener('resize', () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      
      resizeTimeout = setTimeout(() => {
        resetViewportZoom();
      }, 100);
    });
    
    // Reset zoom on route changes (for React apps)
    window.addEventListener('popstate', resetViewportZoom);
  }
};

/**
 * React hook to maintain proper zoom on route changes
 */
export const useViewportZoomFix = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  React.useEffect(() => {
    // Reset zoom on mount
    resetViewportZoom();
    
    // Reset zoom after a short delay to catch any dynamic changes
    const timeoutId = setTimeout(() => {
      resetViewportZoom();
    }, 100);
    
    // Reset zoom when route changes (detected by pathname change)
    const handleRouteChange = () => {
      resetViewportZoom();
    };
    
    // Listen for popstate events (browser back/forward)
    window.addEventListener('popstate', handleRouteChange);
    
    // Listen for pushstate/replacestate (programmatic navigation)
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    
    window.history.pushState = function(...args) {
      originalPushState.apply(window.history, args);
      setTimeout(handleRouteChange, 0);
    };
    
    window.history.replaceState = function(...args) {
      originalReplaceState.apply(window.history, args);
      setTimeout(handleRouteChange, 0);
    };
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('popstate', handleRouteChange);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);
};

