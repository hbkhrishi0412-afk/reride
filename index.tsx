
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
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
  });
} else {
  // Fallback if window is not available (shouldn't happen in browser)
  initializeViewportZoom();
  injectCriticalCSS();
}

// StrictMode is enabled in development to catch bugs (double-renders are intentional).
// In production, StrictMode is stripped out by React — no performance impact.
const isDev = isDevelopmentEnvironment();

if (typeof window !== 'undefined') {
  (window as any).__APP_DEV__ = isDev;
}

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);

// Service worker registration is disabled — PWA plugin is not active.
// To re-enable, configure vite-plugin-pwa in vite.config.ts and uncomment below.
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/sw.js', { scope: '/' });
//   });
// }

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

// Loading safety is handled by the ErrorBoundary component and
// the 15-second timeout in index.html. No polling needed here.

