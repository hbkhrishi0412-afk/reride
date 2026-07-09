/**
 * Client API for deal pipeline: leads, timeline, surveys, assistance.
 */
import { authenticatedFetch } from '../utils/authenticatedFetch.js';
import type {
  AdminKanbanBoard,
  DealDetail,
  DealKanbanStatus,
  DealLead,
  DealSellerNote,
  DealStage,
  FraudDashboard,
  RcQueueItem,
  SellerCommandCenter,
  SellerDealCalendar,
  DealComplaint,
  DealComplaintCategory,
  DealComplaintStatus,
  DealInspectionBooking,
  DealInspectionBookingStatus,
  DealRevenueDashboard,
  AssistanceQueueItem,
  AssistanceFulfillmentStatus,
} from '../types.js';

const BASE = '/api/deals';

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    const reason = (data as { reason?: unknown }).reason;
    const message = typeof reason === 'string' ? reason : 'Request failed';
    throw new Error(message);
  }
  if ((data as { success?: boolean }).success === false) {
    const reason = (data as { reason?: unknown }).reason;
    throw new Error(typeof reason === 'string' ? reason : 'Request failed');
  }
  return data as T;
}

export async function createDealLead(params: {
  vehicleId: number | string;
  conversationId?: string;
  buyerName?: string;
}): Promise<{ lead: DealLead; existing?: boolean }> {
  const response = await authenticatedFetch(`${BASE}?action=create-lead`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await parseJson<{ success: boolean; lead: DealLead; existing?: boolean }>(response);
  return { lead: data.lead, existing: data.existing };
}

export async function acceptDealChat(leadId: string, conversationId?: string): Promise<DealLead> {
  const response = await authenticatedFetch(`${BASE}?action=accept-chat`, {
    method: 'POST',
    body: JSON.stringify({ leadId, conversationId }),
  });
  const data = await parseJson<{ success: boolean; lead: DealLead }>(response);
  return data.lead;
}

export async function advanceDealStage(
  leadId: string,
  stage: DealStage,
  payload?: Record<string, unknown>,
  label?: string,
): Promise<DealLead> {
  const response = await authenticatedFetch(`${BASE}?action=advance-stage`, {
    method: 'POST',
    body: JSON.stringify({ leadId, stage, payload, label }),
  });
  const data = await parseJson<{ success: boolean; lead: DealLead }>(response);
  return data.lead;
}

export async function respondToDealOffer(
  leadId: string,
  response: 'accepted' | 'rejected' | 'countered',
  counterAmount?: number,
): Promise<DealLead> {
  const res = await authenticatedFetch(`${BASE}?action=respond-offer`, {
    method: 'POST',
    body: JSON.stringify({ leadId, response, counterAmount }),
  });
  const data = await parseJson<{ success: boolean; lead: DealLead }>(res);
  return data.lead;
}

export async function getDealLead(params: {
  leadId?: string;
  vehicleId?: number | string;
  conversationId?: string;
}): Promise<DealLead | null> {
  const qs = new URLSearchParams({ action: 'get-lead' });
  if (params.leadId) qs.set('leadId', params.leadId);
  if (params.vehicleId != null) qs.set('vehicleId', String(params.vehicleId));
  if (params.conversationId) qs.set('conversationId', params.conversationId);

  const response = await authenticatedFetch(`${BASE}?${qs.toString()}`);
  if (response.status === 404) return null;
  const data = await parseJson<{ success: boolean; lead: DealLead }>(response);
  return data.lead;
}

/** Resolve deal lead for a chat thread (conversation id, then vehicle fallback, with optional retries). */
export async function resolveDealLeadForConversation(
  conversation: { id: string; vehicleId?: number },
  options?: { retryCount?: number; retryMs?: number },
): Promise<DealLead | null> {
  const load = async (): Promise<DealLead | null> => {
    const byConversation = await getDealLead({ conversationId: conversation.id });
    if (byConversation) return byConversation;
    if (conversation.vehicleId != null) {
      return getDealLead({ vehicleId: conversation.vehicleId });
    }
    return null;
  };

  let lead = await load().catch(() => null);
  if (lead) return lead;

  const retryCount = options?.retryCount ?? 4;
  const retryMs = options?.retryMs ?? 400;
  for (let attempt = 0; attempt < retryCount; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, retryMs));
    lead = await load().catch(() => null);
    if (lead) return lead;
  }
  return null;
}

export async function fetchMyDealLeads(): Promise<DealLead[]> {
  const response = await authenticatedFetch(`${BASE}?action=my-leads`);
  const data = await parseJson<{ success: boolean; leads: DealLead[] }>(response);
  return data.leads || [];
}

export async function fetchAdminDealLeads(): Promise<DealLead[]> {
  const response = await authenticatedFetch(`${BASE}?action=admin-leads`);
  const data = await parseJson<{ success: boolean; leads: DealLead[] }>(response);
  return data.leads || [];
}

export async function confirmDealAssistancePayment(params: {
  leadId: string;
  packageId: string;
  amount: number;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<void> {
  await authenticatedFetch(`${BASE}?action=confirm-assistance-payment`, {
    method: 'POST',
    body: JSON.stringify(params),
  }).then(async (res) => {
    if (!res.ok) {
      const data = await res.json();
      throw new Error((data as { reason?: string }).reason || 'Payment confirmation failed');
    }
  });
}

export async function purchaseDealAssistance(leadId: string, packageId: string): Promise<void> {
  await authenticatedFetch(`${BASE}?action=purchase-assistance`, {
    method: 'POST',
    body: JSON.stringify({ leadId, packageId }),
  });
}

export async function submitDealSurvey(
  surveyId: string,
  response: 'yes' | 'no' | 'negotiating',
  servicesInterested?: string[],
): Promise<void> {
  await authenticatedFetch(`${BASE}?action=submit-survey`, {
    method: 'POST',
    body: JSON.stringify({ surveyId, response, servicesInterested }),
  });
}

export async function fetchPendingDealSurveys(): Promise<
  Array<{ id: string; lead_id: string; due_at: string; deal_leads: DealLead }>
> {
  const response = await authenticatedFetch(`${BASE}?action=pending-surveys`);
  const data = await parseJson<{ success: boolean; surveys: Array<{ id: string; lead_id: string; due_at: string; deal_leads: DealLead }> }>(response);
  return data.surveys || [];
}

async function ensureDealApiAuth(): Promise<void> {
  const { rehydrateApiCredentials } = await import('../utils/validatePersistedSession.js');
  const { getBrowserAccessTokenForApi } = await import('../utils/authStorage.js');

  const ok = await rehydrateApiCredentials();
  if (!ok && !getBrowserAccessTokenForApi()) {
    throw new Error('Authentication required');
  }
}

const SELLER_COMMAND_CENTER_TTL_MS = 30_000;
let sellerCommandCenterCache: { data: SellerCommandCenter; ts: number } | null = null;
let sellerCommandCenterInflight: Promise<SellerCommandCenter> | null = null;

export function invalidateSellerCommandCenterCache(): void {
  sellerCommandCenterCache = null;
}

export async function fetchSellerCommandCenter(forceRefresh = false): Promise<SellerCommandCenter> {
  const now = Date.now();
  if (
    !forceRefresh &&
    sellerCommandCenterCache &&
    now - sellerCommandCenterCache.ts < SELLER_COMMAND_CENTER_TTL_MS
  ) {
    return sellerCommandCenterCache.data;
  }
  if (!forceRefresh && sellerCommandCenterInflight) {
    return sellerCommandCenterInflight;
  }

  const run = (async () => {
    await ensureDealApiAuth();

    const fetchOnce = async () => {
      const response = await authenticatedFetch(`${BASE}?action=seller-command-center`);
      return parseJson<{ success: boolean; commandCenter: SellerCommandCenter }>(response);
    };

    try {
      const data = await fetchOnce();
      return data.commandCenter;
    } catch {
      await ensureDealApiAuth();
      const data = await fetchOnce();
      return data.commandCenter;
    }
  })();

  sellerCommandCenterInflight = run;
  try {
    const center = await run;
    sellerCommandCenterCache = { data: center, ts: Date.now() };
    return center;
  } finally {
    if (sellerCommandCenterInflight === run) {
      sellerCommandCenterInflight = null;
    }
  }
}

export async function fetchDealDetail(leadId: string): Promise<DealDetail> {
  const qs = new URLSearchParams({ action: 'deal-detail', leadId });
  const response = await authenticatedFetch(`${BASE}?${qs.toString()}`);
  const data = await parseJson<{ success: boolean; deal: DealDetail }>(response);
  return data.deal;
}

export async function fetchAdminKanban(): Promise<AdminKanbanBoard> {
  const response = await authenticatedFetch(`${BASE}?action=admin-kanban`);
  const data = await parseJson<{ success: boolean; board: AdminKanbanBoard }>(response);
  return data.board;
}

export async function updateDealKanbanStatus(
  leadId: string,
  kanbanStatus: DealKanbanStatus,
  assignedAdminEmail?: string,
): Promise<DealLead> {
  const response = await authenticatedFetch(`${BASE}?action=update-kanban`, {
    method: 'POST',
    body: JSON.stringify({ leadId, kanbanStatus, assignedAdminEmail }),
  });
  const data = await parseJson<{ success: boolean; lead: DealLead }>(response);
  return data.lead;
}

export async function updateDealNotes(params: {
  leadId: string;
  sellerNotesList?: DealSellerNote[];
  sellerNotes?: string;
  internalNotes?: string;
}): Promise<DealLead> {
  const response = await authenticatedFetch(`${BASE}?action=update-deal-notes`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await parseJson<{ success: boolean; lead: DealLead }>(response);
  return data.lead;
}

export async function fetchSellerDealCalendar(): Promise<SellerDealCalendar> {
  const response = await authenticatedFetch(`${BASE}?action=seller-calendar`);
  const data = await parseJson<{ success: boolean; calendar: SellerDealCalendar }>(response);
  return data.calendar;
}

export async function fetchAdminRcQueue(): Promise<RcQueueItem[]> {
  const response = await authenticatedFetch(`${BASE}?action=admin-rc-queue`);
  const data = await parseJson<{ success: boolean; queue: RcQueueItem[] }>(response);
  return data.queue || [];
}

export async function fetchAdminFraudDashboard(): Promise<FraudDashboard> {
  const response = await authenticatedFetch(`${BASE}?action=admin-fraud-signals`);
  const data = await parseJson<{ success: boolean; dashboard: FraudDashboard }>(response);
  return data.dashboard;
}

export async function createDealComplaint(params: {
  leadId: string;
  category: DealComplaintCategory;
  message: string;
}): Promise<DealComplaint> {
  const response = await authenticatedFetch(`${BASE}?action=create-deal-complaint`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await parseJson<{ success: boolean; complaint: DealComplaint }>(response);
  return data.complaint;
}

export async function fetchDealComplaints(params?: {
  leadId?: string;
  status?: DealComplaintStatus;
}): Promise<DealComplaint[]> {
  const qs = new URLSearchParams({ action: 'deal-complaints' });
  if (params?.leadId) qs.set('leadId', params.leadId);
  if (params?.status) qs.set('status', params.status);
  const response = await authenticatedFetch(`${BASE}?${qs.toString()}`);
  const data = await parseJson<{ success: boolean; complaints: DealComplaint[] }>(response);
  return data.complaints || [];
}

export async function updateDealComplaint(params: {
  complaintId: string;
  status: DealComplaintStatus;
  adminNotes?: string;
}): Promise<DealComplaint> {
  const response = await authenticatedFetch(`${BASE}?action=update-deal-complaint`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await parseJson<{ success: boolean; complaint: DealComplaint }>(response);
  return data.complaint;
}

export async function bookDealInspection(params: {
  leadId: string;
  scheduledDate: string;
  scheduledTime: string;
  address: string;
  notes?: string;
  mechanicName?: string;
}): Promise<{ booking: DealInspectionBooking; lead: DealLead }> {
  const response = await authenticatedFetch(`${BASE}?action=book-inspection`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await parseJson<{ success: boolean; booking: DealInspectionBooking; lead: DealLead }>(response);
  return { booking: data.booking, lead: data.lead };
}

export async function fetchInspectionBookings(leadId?: string): Promise<DealInspectionBooking[]> {
  const qs = new URLSearchParams({ action: 'inspection-bookings' });
  if (leadId) qs.set('leadId', leadId);
  const response = await authenticatedFetch(`${BASE}?${qs.toString()}`);
  const data = await parseJson<{ success: boolean; bookings: DealInspectionBooking[] }>(response);
  return data.bookings || [];
}

export async function updateInspectionBooking(params: {
  bookingId: string;
  status: DealInspectionBookingStatus;
  mechanicName?: string;
}): Promise<DealInspectionBooking> {
  const response = await authenticatedFetch(`${BASE}?action=update-inspection-booking`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await parseJson<{ success: boolean; booking: DealInspectionBooking }>(response);
  return data.booking;
}

export async function fetchAdminDealRevenue(): Promise<DealRevenueDashboard> {
  const response = await authenticatedFetch(`${BASE}?action=admin-deal-revenue`);
  const data = await parseJson<{ success: boolean; dashboard: DealRevenueDashboard }>(response);
  return data.dashboard;
}

export async function fetchAdminAssistanceQueue(): Promise<AssistanceQueueItem[]> {
  const response = await authenticatedFetch(`${BASE}?action=admin-assistance-queue`);
  const data = await parseJson<{ success: boolean; queue: AssistanceQueueItem[] }>(response);
  return data.queue || [];
}

export async function updateAssistanceFulfillment(params: {
  leadId: string;
  status?: AssistanceFulfillmentStatus;
  assignedAdminEmail?: string;
  assignToMe?: boolean;
  notes?: string;
}): Promise<DealLead> {
  const response = await authenticatedFetch(`${BASE}?action=update-assistance-fulfillment`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await parseJson<{ success: boolean; lead: DealLead }>(response);
  return data.lead;
}

export async function requestDealReturn(leadId: string, reason?: string): Promise<DealLead> {
  const response = await authenticatedFetch(`${BASE}?action=request-return`, {
    method: 'POST',
    body: JSON.stringify({ leadId, reason }),
  });
  const data = await parseJson<{ success: boolean; lead: DealLead }>(response);
  return data.lead;
}

export async function resolveDealReturn(
  leadId: string,
  action: 'relist' | 'archive',
): Promise<DealLead> {
  const response = await authenticatedFetch(`${BASE}?action=resolve-return`, {
    method: 'POST',
    body: JSON.stringify({ leadId, action }),
  });
  const data = await parseJson<{ success: boolean; lead: DealLead }>(response);
  return data.lead;
}
