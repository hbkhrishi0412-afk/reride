/**
 * server/handlers/index.ts — Barrel exports for all API handlers
 *
 * Handlers live here (outside api/) so api/ stays at ≤12 top-level route modules.
 * See .cursor/rules/api-routes-limit.mdc
 */

// Shared utilities
export * from './shared.js';

// ── Extracted handlers ──────────────────────────────────────────────────────

export { handleAdmin, seedUsers, seedVehicles } from './admin.js';
export { handleHealth, handleAI, handleSystem, handleUtils } from './system.js';
export { handleContent } from './content.js';
export { handleSellCar } from './sell-car.js';
export { handleSupportChat } from './support-chat.js';

// ── Remaining handlers (still in main.ts — extract here, not into new api/ files) ──
//
// handleUsers       (~1837 lines) → server/handlers/users.ts
// handleVehicles    (~1450 lines) → server/handlers/vehicles.ts
// handleConversations (~251 lines) → server/handlers/conversations.ts
// handleNotifications (~300 lines) → server/handlers/notifications.ts
// handleBuyerActivity (~163 lines) → server/handlers/buyer-activity.ts
// handlePayments     (~253 lines) → server/handlers/payments.ts
// handlePlans        (~152 lines) → server/handlers/plans.ts
// handleBusiness     (~33 lines)  → server/handlers/business.ts
// handleVehicleData  (~194 lines) → server/handlers/vehicle-data.ts
// handleSeed         (~56 lines)  → server/handlers/seed.ts (router only)
//
// To extract: copy the function from main.ts into a new handler file,
// add `import { ... } from './shared.js';` for dependencies,
// and export the function.
