
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { reportWebVitals, logPerformanceMetrics } from './utils/performance';
import { isDevelopmentEnvironment } from './utils/environment';

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

// Service worker disabled to prevent caching issues
// Uncomment when caching strategy is fully tested
/*
if ('serviceWorker' in navigator && !isDev) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration);
        // Force update
        registration.update();
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}
*/

// Unregister any existing service workers to clear cache (also in development)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for (let registration of registrations) {
      registration.unregister();
      console.log('Unregistered service worker');
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
  if (process.env.NODE_ENV === 'development') {
    console.log(metric);
  }
  // In production, you could send to analytics service here
});
