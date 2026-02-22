/**
 * Critical CSS Inlining Utility
 * Extracts and inlines critical CSS for above-the-fold content
 */

/**
 * Critical CSS for vehicle listing page above-the-fold content
 * This CSS is inlined in the <head> to prevent render-blocking
 */
export const CRITICAL_CSS = `
/* Vehicle Card Critical Styles */
.vehicle-card-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  padding: 1rem;
}

.vehicle-card {
  background: white;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.vehicle-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

.vehicle-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
  background: linear-gradient(to bottom, #f3f4f6, #e5e7eb);
}

.vehicle-info {
  padding: 1rem;
}

.vehicle-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 0.5rem;
}

.vehicle-price {
  font-size: 1.5rem;
  font-weight: 800;
  color: #ff6b35;
  margin-top: 0.75rem;
}

/* Loading Skeleton */
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Filter Bar */
.filter-bar {
  background: white;
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 10;
}

/* Search Bar */
.search-bar {
  background: white;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

/* Grid Layout */
.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

/* Responsive */
@media (max-width: 640px) {
  .vehicle-card-container {
    grid-template-columns: 1fr;
    gap: 1rem;
    padding: 0.5rem;
  }
  
  .vehicle-image {
    height: 180px;
  }
}
`;

/**
 * Injects critical CSS into the document head
 * Call this function early in the app lifecycle
 */
export const injectCriticalCSS = (): void => {
  if (typeof document === 'undefined') return;
  
  // Check if already injected
  if (document.getElementById('critical-css')) return;
  
  const style = document.createElement('style');
  style.id = 'critical-css';
  style.textContent = CRITICAL_CSS;
  
  // Insert at the beginning of <head> for highest priority
  const head = document.head || document.getElementsByTagName('head')[0];
  if (head.firstChild) {
    head.insertBefore(style, head.firstChild);
  } else {
    head.appendChild(style);
  }
};

/**
 * Preloads non-critical CSS asynchronously
 * Call this after critical CSS is loaded
 */
export const preloadNonCriticalCSS = (cssFile: string): void => {
  if (typeof document === 'undefined') return;
  
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'style';
  link.href = cssFile;
  link.onload = () => {
    link.rel = 'stylesheet';
  };
  document.head.appendChild(link);
};















