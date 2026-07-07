/**
 * Deal pipeline handler modules.
 *
 * Structure:
 * - shared.ts          — mappers, auth, batch fetch, assistance helpers
 * - stage-validation.ts — server-side stage transition guards
 * - context.ts         — handler context types
 * - deal-complaints.ts — create/list/update deal_complaints
 * - stage-handlers.ts  — advance-stage, respond-offer
 * - assistance.ts      — surveys, payments, assistance queue
 * - lead-lifecycle.ts  — create/accept lead, lookups, link conversation
 * - inspections.ts     — mechanic inspection bookings
 * - admin-ops.ts       — seller command center, admin dashboards
 * - ../deals.ts        — thin dispatch router
 */
export { handleDealComplaints } from './deal-complaints.js';
export { handleStageHandlers } from './stage-handlers.js';
export { handleAssistance } from './assistance.js';
export { handleLeadLifecycle } from './lead-lifecycle.js';
export { handleInspections } from './inspections.js';
export { handleAdminOps } from './admin-ops.js';
export type { DealHandlerContext, DealActionHandler } from './context.js';
export { validateAdvanceStage } from './stage-validation.js';
