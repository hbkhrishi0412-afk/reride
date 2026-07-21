/**
 * Client-side polling intervals — shared by **website and Capacitor mobile app**.
 * Intervals apply per signed-in user session, not per vehicle on the platform.
 *
 * Tuned for fewer background wakeups when Realtime is also connected; all
 * consumers should still skip ticks while `document.hidden`.
 */
export const CLIENT_POLL_INTERVALS_MS = {
  /** Seller inbox fallback when Realtime/WebSocket misses an update. */
  sellerConversations: 60_000,
  customerConversations: 60_000,
  notifications: 90_000,
  /** Active chat thread sync while a conversation is open. */
  openChatSync: 30_000,
  /** Service request status for customers (App.tsx). */
  customerServiceRequests: 60_000,
  /** Service provider catalog refresh (ServiceCart). */
  serviceProviderCatalog: 60_000,
  /** Public catalog refresh on native WebView (battery-friendly). */
  vehicleCatalogNative: 5 * 60_000,
  /** Public catalog refresh on website. */
  vehicleCatalogWeb: 2 * 60_000,
  vehicleDataCatalog: 10 * 60_000,
  supportTickets: 60_000,
  /** UI-only clocks (expiry badges) — no API traffic. */
  uiClock: 60_000,
} as const;
