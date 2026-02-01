
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { reportWebVitals, logPerformanceMetrics } from './utils/performance';
import { isDevelopmentEnvironment } from './utils/environment';
import { initializeViewportZoom } from './utils/viewportZoom';
import { injectCriticalCSS } from './utils/criticalCSS';
import { validateEnvironmentVariablesSafe } from './utils/envValidation';
import { logInfo, logWarn, logError } from './utils/logger';

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

// Initialize viewport zoom fix immediately on app load - applies to ALL pages
initializeViewportZoom();

// Inject critical CSS for above-the-fold content (prevents render-blocking)
injectCriticalCSS();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Disable StrictMode in development for faster loading
// StrictMode causes intentional double-renders which slows down initial load
// Re-enable for production builds or when debugging
const isDev = isDevelopmentEnvironment();

if (typeof window !== 'undefined') {
  (window as any).__APP_DEV__ = isDev;
}

root.render(
  isDev ? (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  ) : (
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  )
);

// Register service worker with advanced caching and update notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        logInfo('[SW] Service worker registered:', registration.scope);
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute
        
        // Handle updates with user notification
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available, show user notification
                logInfo('[SW] New service worker available');
                
                // Dispatch custom event for app to show notification
                if (window.dispatchEvent) {
                  window.dispatchEvent(new CustomEvent('sw-update-available', {
                    detail: {
                      message: 'A new version is available. Click to refresh.',
                      action: () => {
                        // Skip waiting and reload
                        if (newWorker.waiting) {
                          newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                        window.location.reload();
                      }
                    }
                  }));
                }
              }
            });
          }
        });
      })
      .catch((error) => {
        logError('[SW] Service worker registration failed:', error);
      });
  });

  // Listen for service worker controller changes
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    logInfo('[SW] Service worker controller changed, reloading page');
    window.location.reload();
  });
  
  // Listen for skip waiting message from service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      window.location.reload();
    }
  });
}

// Log performance metrics after page load
window.addEventListener('load', () => {
  setTimeout(() => {
    logPerformanceMetrics();
  }, 0);
});

// Report Web Vitals
reportWebVitals((metric) => {
  // Send to analytics or log (only in development)
  logInfo(metric);
  // In production, you could send to analytics service here
});

// CRITICAL: Global error handlers to prevent unhandled promise rejections
if (typeof window !== 'undefined') {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logError('⚠️ Unhandled promise rejection:', event.reason);
    
    // Prevent default browser error handling
    event.preventDefault();
    
    // Log error details (only in development)
    if (process.env.NODE_ENV === 'development') {
      logError('Error details:', {
        reason: event.reason,
        promise: event.promise,
        stack: event.reason?.stack
      });
    }
    
    // In production, silently handle to prevent dashboard crashes
    // The ErrorBoundary will catch React errors, but we need to handle
    // async errors that occur outside React's error boundary
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

// CRITICAL: Global safety mechanism to prevent infinite loading states
// This ensures the app never gets stuck in a loading state
if (typeof window !== 'undefined') {
  let loadingSafetyCheck: NodeJS.Timeout | null = null;
  
  const checkLoadingState = () => {
    // Check if there's a loading indicator visible for too long
    const loadingElements = document.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="Loading"]');
    const hasLongLoading = Array.from(loadingElements).some(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    
    // If loading elements are visible for more than 10 seconds, force hide them
    if (hasLongLoading) {
      const startTime = parseInt(sessionStorage.getItem('appLoadStartTime') || '0', 10);
      const currentTime = Date.now();
      const loadDuration = currentTime - startTime;
      
      if (loadDuration > 10000) { // 10 seconds (reduced from 20s for better UX)
        logWarn('⚠️ Loading state exceeded 10s, forcing completion');
        // Try to dispatch a custom event that components can listen to
        window.dispatchEvent(new CustomEvent('forceLoadingComplete'));
        sessionStorage.removeItem('appLoadStartTime');
      }
    }
  };
  
  // Set start time when page loads
  sessionStorage.setItem('appLoadStartTime', Date.now().toString());
  
  // Check every 5 seconds
  loadingSafetyCheck = setInterval(checkLoadingState, 5000);
  
  // Clear the check when page unloads
  window.addEventListener('beforeunload', () => {
    if (loadingSafetyCheck) {
      clearInterval(loadingSafetyCheck);
    }
    sessionStorage.removeItem('appLoadStartTime');
  });
  
  // Also clear after successful load
  window.addEventListener('load', () => {
    setTimeout(() => {
      sessionStorage.removeItem('appLoadStartTime');
    }, 1000);
  });
}

