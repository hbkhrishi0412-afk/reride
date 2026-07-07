import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'server/handlers/deals.ts'), 'utf8').split(/\r?\n/);

const header = `/**
 * Deal pipeline API router: RR-LD-xxx leads, timeline, surveys, assistance.
 */
import { createHmac } from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  USE_SUPABASE,
  supabaseUserService,
  getSupabaseAdminClient,
  type HandlerOptions,
} from '../handler-shared.js';
import type {
  DealLead,
  DealLeadMetadata,
  DealStage,
  DealKanbanStatus,
  DealComplaintCategory,
  DealComplaintStatus,
  DealComplaint,
  DealInspectionBookingStatus,
  AssistanceFulfillmentStatus,
  AdminKanbanBoard,
  SellerCommandCenter,
  SellerDealCalendar,
  RcQueueItem,
  FraudSignal,
  FraudDashboard,
  DealRevenueDashboard,
  AssistanceQueueItem,
} from '../../types.js';
import {
  deriveKanbanStatus,
  DEAL_ASSISTANCE_PACKAGES,
  DEAL_COMPLAINT_CATEGORIES,
} from '../../types.js';
import { validateAdvanceStage } from './deals/stage-validation.js';
import {
  firstQueryParam,
  normalizeEmail,
  getAuthEmail,
  generateId,
  resolveVehicleId,
  nextLeadId,
  insertTimelineEvent,
  insertDealNotification,
  ensureConversationForDeal,
  participantIdVariantsAdmin,
  assertDealParticipant,
  fetchLeadWithTimeline,
  leadsFromRows,
  enrichLeadsBatch,
  enrichLead,
  mapLeadRow,
  updateLeadStage,
  syncDualWriteForStage,
  tryInsertDealOffer,
  tryUpdateDealOfferStatus,
  recordAssistanceRequest,
  mapAssistanceQueueItemFromLead,
  assistanceFulfillmentIsOpen,
  buildSellerTasks,
  buildCalendarEvents,
  backfillAllKanbanStatuses,
  rcStatusForLead,
  mapComplaintRow,
  mapInspectionBookingRow,
  INSPECTION_BOOKING_STAGES,
} from './deals/shared.js';

`;

const handlerStart = src.findIndex((l) => l.startsWith('export async function handleDeals'));
const handlerBody = src.slice(handlerStart).join('\n');

fs.writeFileSync(path.join(root, 'server/handlers/deals.ts'), header + handlerBody);
console.log('Refactored deals.ts, lines:', (header + handlerBody).split('\n').length);
