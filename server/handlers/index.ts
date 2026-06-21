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
export {
  scheduleAutoAIInspection,
  scheduleBackfillAIInspectionOnView,
  runAutoAIInspection,
  shouldRegenerateAIInspection,
  shouldBackfillAIInspectionOnView,
} from './vehicle-ai-inspection.js';
export { handleVehicleTrust } from './vehicle-trust.js';
export { handleBuyerActivity } from './buyer-activity.js';
