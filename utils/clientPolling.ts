/**
 * Client-side polling intervals — shared by **website and Capacitor mobile app**.
 * Intervals apply per signed-in user session, not per vehicle on the platform.
 */
export const CLIENT_POLL_INTERVALS_MS = {
  /** Seller inbox fallback when Realtime/WebSocket misses an update. */
  sellerConversations: 30_000,
  customerConversations: 30_000,
  notifications: 45_000,
  /** Active chat thread sync while a conversation is open. */
  openChatSync: 15_000,
  /** Service request status for customers (App.tsx). */
  customerServiceRequests: 45_000,
  /** Service provider catalog refresh (ServiceCart). */
  serviceProviderCatalog: 45_000,
  /** Public catalog refresh on native WebView (battery-friendly). */
  vehicleCatalogNative: 3 * 60_000,
  /** Public catalog refresh on website. */
  vehicleCatalogWeb: 60_000,
  vehicleDataCatalog: 5 * 60_000,
  supportTickets: 20_000,
  /** UI-only clocks (expiry badges) — no API traffic. */
  uiClock: 60_000,
} as const;
