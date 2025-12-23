
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { reportWebVitals, logPerformanceMetrics } from './utils/performance';
import { isDevelopmentEnvironment } from './utils/environment';
import { initializeViewportZoom } from './utils/viewportZoom';

// Initialize viewport zoom fix immediately on app load - applies to ALL pages
initializeViewportZoom();

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

// Register service worker with advanced caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[SW] Service worker registered:', registration.scope);
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute
        
        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available, prompt user to refresh
                console.log('[SW] New service worker available');
                // Optionally show a toast notification to user
                if (window.dispatchEvent) {
                  window.dispatchEvent(new CustomEvent('sw-update-available'));
                }
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('[SW] Service worker registration failed:', error);
      });
  });

  // Listen for service worker controller changes
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[SW] Service worker controller changed, reloading page');
    window.location.reload();
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
  if (process.env.NODE_ENV === 'development') {
    console.log(metric);
  }
  // In production, you could send to analytics service here
});

// CRITICAL: Global error handlers to prevent unhandled promise rejections
if (typeof window !== 'undefined') {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('⚠️ Unhandled promise rejection:', event.reason);
    
    // Prevent default browser error handling
    event.preventDefault();
    
    // Log error details (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.error('Error details:', {
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
      console.error('⚠️ Global error:', {
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
    
    // If loading elements are visible for more than 20 seconds, force hide them
    if (hasLongLoading) {
      const startTime = parseInt(sessionStorage.getItem('appLoadStartTime') || '0', 10);
      const currentTime = Date.now();
      const loadDuration = currentTime - startTime;
      
      if (loadDuration > 20000) { // 20 seconds
        console.warn('⚠️ Loading state exceeded 20s, forcing completion');
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
