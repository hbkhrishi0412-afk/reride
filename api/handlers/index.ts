/**
 * api/handlers/index.ts — Barrel exports for all API handlers
 *
 * Extracted handlers are imported from their own files.
 * Remaining large handlers are still in main.ts and will be
 * extracted incrementally following the same pattern.
 */

// Shared utilities
export * from './shared';

// ── Extracted handlers ──────────────────────────────────────────────────────

export { handleHealth } from './health';
export { handleAI } from './ai';
export { handleAdmin, seedUsers, seedVehicles } from './admin';
export { handleSystem, handleUtils } from './system';
export { handleContent } from './content';
export { handleSellCar } from './sell-car';

// ── Remaining handlers (still in main.ts) ───────────────────────────────────
// These are the largest handlers and should be extracted next:
//
// handleUsers       (~1837 lines) → api/handlers/users.ts
// handleVehicles    (~1450 lines) → api/handlers/vehicles.ts
// handleConversations (~251 lines) → api/handlers/conversations.ts
// handleNotifications (~300 lines) → api/handlers/notifications.ts
// handleBuyerActivity (~163 lines) → api/handlers/buyer-activity.ts
// handlePayments     (~253 lines) → api/handlers/payments.ts
// handlePlans        (~152 lines) → api/handlers/plans.ts
// handleBusiness     (~33 lines)  → api/handlers/business.ts
// handleVehicleData  (~194 lines) → api/handlers/vehicle-data.ts
// handleNewCars      (~64 lines)  → api/handlers/new-cars.ts
// handleSeed         (~56 lines)  → api/handlers/seed.ts (router only)
//
// To extract: copy the function from main.ts into a new handler file,
// add `import { ... } from './shared';` for dependencies,
// and export the function.
