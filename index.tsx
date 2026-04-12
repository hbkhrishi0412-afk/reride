import './utils/capacitorInit';

import { completeWebSupabaseOAuthCallbackIfNeeded } from './utils/consumeWebSupabaseOAuthCallback';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { reportWebVitals, logPerformanceMetrics } from './utils/performance';
import { initializeViewportZoom } from './utils/viewportZoom';
import { injectCriticalCSS } from './utils/criticalCSS';
import { validateEnvironmentVariablesSafe } from './utils/envValidation';
import { logInfo, logWarn, logError } from './utils/logger';
import { ensureCsrfToken } from './utils/authenticatedFetch';
import { isCapacitorNative } from './utils/apiConfig';
import { initAnalytics, trackPageView } from './utils/analytics';

// i18n - must run before any component that uses useTranslation
import './lib/i18n';

// Error monitoring (Sentry) - init in production when DSN is set
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  import('./utils/monitoring').then(({ initErrorTracking, initWebVitals }) => {
    initErrorTracking();
    initWebVitals((metric) => {
      if ((window as any).gtag) {
        (window as any).gtag('event', metric.name, { value: metric.value, event_category: 'Web Vitals' });
      }
    });
  }).catch(() => {});
}

// PERFORMANCE: Defer environment validation to avoid blocking initial render
// Validate asynchronously after app starts rendering
if (typeof window !== 'undefined') {
  // Use requestIdleCallback for non-critical validation (falls back to setTimeout)
  const scheduleValidation = (callback: () => void) => {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(callback, { timeout: 2000 });
    } else {
      setTimeout(callback, 0);
    }
  };

  scheduleValidation(() => {
    try {
      const envValidation = validateEnvironmentVariablesSafe();
      if (!envValidation.isValid) {
        logError('❌ Environment variable validation failed:');
        envValidation.errors.forEach(error => logError(`   - ${error}`));
        if (envValidation.warnings.length > 0) {
          logWarn('⚠️ Warnings:');
          envValidation.warnings.forEach(warning => logWarn(`   - ${warning}`));
        }
        // In production, show error but don't block app (let ErrorBoundary handle it)
        if (process.env.NODE_ENV === 'production') {
          console.error('Environment variables are missing or invalid. Please check your configuration.');
        }
      }
    } catch (error) {
      logError('❌ Failed to validate environment variables:', error);
      // Don't throw - let app continue
    }
  });
}

// CRITICAL: Mount React FIRST, then initialize non-critical features
// This ensures React mounts immediately and UI can render
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Defer non-critical initialization to after React mounts
// Use requestIdleCallback or setTimeout to avoid blocking React mount
if (typeof window !== 'undefined') {
  const scheduleInit = (callback: () => void) => {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(callback, { timeout: 100 });
    } else {
      setTimeout(callback, 0);
    }
  };
  
  scheduleInit(() => {
    // Initialize viewport zoom fix - non-blocking
    initializeViewportZoom();
    // Inject critical CSS - non-blocking
    injectCriticalCSS();
    // Prefetch CSRF token for state-changing requests
    ensureCsrfToken();
    // Analytics (GA4) when measurement ID is set
    initAnalytics();
    trackPageView(
      isCapacitorNative()
        ? `${window.location.pathname}${window.location.hash || ''}`
        : window.location.pathname
    );
  });
} else {
  // Fallback if window is not available (shouldn't happen in browser)
  initializeViewportZoom();
  injectCriticalCSS();
}

// React Query client with sensible defaults for caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

// StrictMode is enabled in development to catch bugs (double-renders are intentional).
// In production, StrictMode is stripped out by React — no performance impact.
// Browser history has no server fallback for deep links in Android WebViewAssetLoader
// (paths like /used-cars 404). Hash routes work for the packaged app; web keeps clean URLs.
const AppRouter = isCapacitorNative() ? HashRouter : BrowserRouter;

void (async () => {
  if (typeof window !== 'undefined') {
    try {
      await completeWebSupabaseOAuthCallbackIfNeeded();
    } catch (e) {
      console.warn('[ReRide] OAuth bootstrap:', e);
    }
  }

  try {
    root.render(
      <React.StrictMode>
        <HelmetProvider>
          <QueryClientProvider client={queryClient}>
            <AppRouter>
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            </AppRouter>
          </QueryClientProvider>
        </HelmetProvider>
      </React.StrictMode>
    );
    // Signal to index.html timeout script that React has mounted (clears loading timeout)
    if (typeof window !== 'undefined') {
      (window as any).__RERIDE_MOUNTED__ = true;
    }
  } catch (mountError) {
    if (rootElement && typeof window !== 'undefined') {
      const msg = mountError instanceof Error ? mountError.message : String(mountError);
      const stack = mountError instanceof Error ? mountError.stack || '' : '';
      (window as any).__RERIDE_ERRORS__ = (window as any).__RERIDE_ERRORS__ || [];
      (window as any).__RERIDE_ERRORS__.push('Mount: ' + msg + '\n' + stack);
      if (typeof (window as any).showLoadError === 'function') {
        (window as any).showLoadError('React mount failed: ' + msg);
      } else {
        rootElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#FFFFFF;padding:20px;"><div style="text-align:center;max-width:600px;"><h1 style="color:#2C2C2C;font-size:24px;font-weight:700;margin-bottom:16px;">Unable to load ReRide</h1><p style="color:#666;font-size:14px;margin-bottom:24px;line-height:1.6;word-break:break-all;">' + msg + '</p><button onclick="window.location.reload()" style="background:#FF6B35;color:white;border:none;padding:12px 24px;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">Refresh</button></div></div>';
      }
    } else {
      throw mountError;
    }
  }
})();

// Service worker registration is disabled — PWA plugin is not active.
// To re-enable, configure vite-plugin-pwa in vite.config.ts and uncomment below.
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/sw.js', { scope: '/' });
//   });
// }

if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(() => {
      logPerformanceMetrics();
    }, 0);
  });
}

// Report Web Vitals
reportWebVitals((metric) => {
  // Send to analytics or log (only in development)
  logInfo(metric);
  // In production, you could send to analytics service here
});

// CRITICAL: Global error handlers to prevent unhandled promise rejections
if (typeof window !== 'undefined') {
  // Show user-friendly error UI when app or chunk fails to load (common on mobile/slow networks)
  const showLoadErrorUI = () => {
    if ((window as any).__APP_SCRIPT_LOAD_FAILED__) return;
    (window as any).__APP_SCRIPT_LOAD_FAILED__ = true;
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#FFFFFF;padding:20px;"><div style="text-align:center;max-width:600px;"><h1 style="color:#2C2C2C;font-size:24px;font-weight:700;margin-bottom:16px;">Unable to Load ReRide</h1><p style="color:#666;font-size:16px;margin-bottom:24px;line-height:1.6;">The app could not load. This can happen on slow or unstable connections. Please tap Refresh to try again.</p><button onclick="window.location.reload()" style="background:#FF6B35;color:white;border:none;padding:12px 24px;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">Refresh</button></div></div>';
    }
  };

  // Handle unhandled promise rejections (e.g. chunk load failures on mobile)
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);
    const isChunkLoadError =
      typeof msg === 'string' &&
      (msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('Loading chunk') ||
        msg.includes('Loading CSS chunk') ||
        msg.includes('error loading dynamically imported module') ||
        /ChunkLoadError|Loading chunk \d+ failed/i.test(msg));
    if (isChunkLoadError) {
      event.preventDefault();
      showLoadErrorUI();
      return;
    }
    logError('⚠️ Unhandled promise rejection:', event.reason);
    event.preventDefault();
    if (process.env.NODE_ENV === 'development') {
      logError('Error details:', {
        reason: event.reason,
        promise: event.promise,
        stack: reason instanceof Error ? reason.stack : undefined
      });
    }
  });
  
  // Handle general errors
  window.addEventListener('error', (event) => {
    // Only log in development to avoid console noise
    if (process.env.NODE_ENV === 'development') {
      logError('⚠️ Global error:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });
    }
    // Don't prevent default - let ErrorBoundary handle it
  });
}

// Loading safety is handled by the ErrorBoundary component and
// the 30-second timeout in index.html. No polling needed here.

