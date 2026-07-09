/**
 * server/handlers/index.ts — Barrel exports for all API handlers
 *
 * Handlers live here (outside api/) so api/ stays at ≤12 top-level route modules.
 * See .cursor/rules/api-routes-limit.mdc
 */

export * from '../handler-shared.js';

export { handleAdmin, seedUsers, seedVehicles } from './admin.js';
export { handleHealth, handleAI, handleSystem, handleUtils } from './system.js';
export { handleContent } from './content.js';
export { handleSellCar } from './sell-car.js';
export { handleVehiclePricing } from './vehicle-pricing.js';
export { handleSupportChat } from './support-chat.js';
export { handleVehicleTrust } from './vehicle-trust.js';
export { handleDeals } from './deals.js';
export { handleComplaints } from './complaints.js';
export { validateAdvanceStage } from './deals/stage-validation.js';
export { handleDealComplaints } from './deals/deal-complaints.js';
export { handleStageHandlers } from './deals/stage-handlers.js';
export { handleAssistance } from './deals/assistance.js';
export { handleLeadLifecycle } from './deals/lead-lifecycle.js';
export { handleInspections } from './deals/inspections.js';
export { handleAdminOps } from './deals/admin-ops.js';
export { handleBuyerActivity } from './buyer-activity.js';
