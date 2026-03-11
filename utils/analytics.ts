/**
 * Client-side analytics (GA4 / Plausible).
 * Set VITE_GA_MEASUREMENT_ID for Google Analytics 4.
 */

const GA_ID = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_GA_MEASUREMENT_ID : undefined;

export function initAnalytics(): void {
  if (typeof window === 'undefined' || !GA_ID) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
  (window as any).dataLayer = (window as any).dataLayer || [];
  const gtag = function (...args: any[]) {
    ((window as any).dataLayer).push(args);
  };
  (window as any).gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID, { send_page_view: true, anonymize_ip: true });
}

export function trackPageView(path: string, title?: string): void {
  if (typeof window === 'undefined') return;
  if ((window as any).gtag) {
    (window as any).gtag('event', 'page_view', {
      page_path: path,
      page_title: title || document.title,
    });
  }
}

export function trackEvent(eventName: string, params?: Record<string, string | number | boolean>): void {
  if (typeof window === 'undefined') return;
  if ((window as any).gtag) {
    (window as any).gtag('event', eventName, params);
  }
}

export function trackVehicleView(vehicleId: string, title?: string): void {
  trackEvent('view_item', { item_id: vehicleId, item_name: title || '' });
}

export function trackSearch(searchTerm: string): void {
  trackEvent('search', { search_term: searchTerm });
}
