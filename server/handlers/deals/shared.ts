/**
 * Shared deal-pipeline utilities (mappers, auth, batch fetch, assistance helpers).
 */
import { randomUUID } from 'crypto';
import { parseSellerNotes } from '../../../lib/dealSellerNotes.js';
import type { VercelRequest } from '@vercel/node';
import {
  supabaseUserService,
  supabaseVehicleService,
  getSupabaseAdminClient,
  authenticateRequestDual,
} from '../../handler-shared.js';
import type {
  DealLead,
  DealLeadMetadata,
  DealStage,
  DealTimelineEvent,
  SellerTask,
  DealKanbanStatus,
  DealDocumentRecord,
  DealCalendarEvent,
  DealCalendarEventStatus,
  RcQueueItem,
  DealComplaint,
  DealComplaintCategory,
  DealComplaintStatus,
  DealInspectionBooking,
  DealInspectionBookingStatus,
  AssistanceQueueItem,
  AssistanceRequestSource,
} from '../../../types.js';
import {
  deriveKanbanStatus,
  dealAssistancePackageLabel,
  assistancePackageNeedsInspection,
  assistancePackageNeedsRc,
} from '../../../types.js';

export function firstQueryParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function isConversationUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function resolveUserTableIdAdmin(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  email: string,
): Promise<string | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const { data } = await supabase.from('users').select('id').eq('email', normalized).maybeSingle();
  return data?.id ? String(data.id) : null;
}

export async function participantIdVariantsAdmin(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  email: string,
): Promise<string[]> {
  const normalized = normalizeEmail(email);
  if (!normalized) return [];
  const resolved = await resolveUserTableIdAdmin(supabase, normalized);
  const { emailToKey } = await import('../../../services/supabase-user-service.js');
  const key = emailToKey(normalized);
  return [...new Set([resolved, normalized, key].filter(Boolean) as string[])];
}

export function conversationVehicleIdColumn(vehiclePrimaryKey: string): number | null {
  const trimmed = vehiclePrimaryKey.trim();
  if (!trimmed) return null;
  const asNumber = Number(trimmed);
  if (!Number.isFinite(asNumber) || asNumber <= 0) return null;
  return asNumber;
}

/** Ensure a persisted conversation row exists and return its UUID for deal_leads.conversation_id. */
export async function ensureConversationForDeal(params: {
  vehiclePrimaryKey: string;
  vehicleName: string;
  vehiclePrice?: number;
  buyerEmail: string;
  buyerName?: string;
  sellerEmail: string;
  clientConversationId?: string;
}): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  const {
    vehiclePrimaryKey,
    vehicleName,
    vehiclePrice,
    buyerEmail,
    buyerName,
    sellerEmail,
    clientConversationId,
  } = params;

  if (clientConversationId) {
    if (isConversationUuid(clientConversationId)) {
      const { data } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', clientConversationId)
        .maybeSingle();
      if (data?.id) return String(data.id);
    } else {
      const { data: aliasRows } = await supabase
        .from('conversations')
        .select('id')
        .contains('metadata', { client_conversation_id: clientConversationId })
        .limit(1);
      if (aliasRows?.[0]?.id) return String(aliasRows[0].id);
    }
  }

  const customerVariants = await participantIdVariantsAdmin(supabase, buyerEmail);
  const vehicleIdColumn = conversationVehicleIdColumn(vehiclePrimaryKey);
  if (customerVariants.length > 0 && vehicleIdColumn != null) {
    const { data: byVehicle } = await supabase
      .from('conversations')
      .select('id')
      .eq('vehicle_id', vehicleIdColumn)
      .in('customer_id', customerVariants)
      .limit(1);
    if (byVehicle?.[0]?.id) return String(byVehicle[0].id);
  }

  const sellerFk = await resolveUserTableIdAdmin(supabase, sellerEmail);
  const customerFk = await resolveUserTableIdAdmin(supabase, buyerEmail);
  if (!sellerFk || !customerFk || vehicleIdColumn == null) return null;

  const dbId = randomUUID();
  const now = new Date().toISOString();
  const metadata: Record<string, unknown> = { messages: [] };
  if (clientConversationId) {
    metadata.client_conversation_id = clientConversationId;
  }

  const { error } = await supabase.from('conversations').insert({
    id: dbId,
    customer_id: customerFk,
    seller_id: sellerFk,
    vehicle_id: vehicleIdColumn,
    customer_name: buyerName || 'Buyer',
    vehicle_name: vehicleName,
    vehicle_price: vehiclePrice ?? null,
    last_message_at: now,
    is_read_by_seller: false,
    is_read_by_customer: true,
    is_flagged: false,
    created_at: now,
    updated_at: now,
    metadata,
  });

  if (error) {
    if (error.code === '23505') {
      return dbId;
    }
    console.warn('ensureConversationForDeal insert failed (non-fatal):', error.message);
    return null;
  }
  return dbId;
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function getAuthEmail(req: VercelRequest): Promise<{ email: string; role?: string } | null> {
  const auth = await authenticateRequestDual(req);
  if (!auth.isValid || !auth.user?.email) return null;
  const email = normalizeEmail(auth.user.email);
  const user = await supabaseUserService.findByEmail(email);
  return { email, role: user?.role ?? auth.user.role };
}

export async function resolveVehicleId(vehicleIdRaw: string) {
  try {
    const trimmed = vehicleIdRaw.trim();
    const num = Number(trimmed);
    const isPlainNumericId = Number.isFinite(num) && num > 0 && String(num) === trimmed;
    return await supabaseVehicleService.resolveVehicleIdentity(
      isPlainNumericId ? { id: num, databaseId: trimmed } : { databaseId: trimmed },
    );
  } catch {
    return null;
  }
}

export async function nextLeadId(): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const { data: seq } = await supabase.from('deal_lead_sequence').select('next_val').eq('id', 1).single();
  const num = seq?.next_val ?? 101;
  await supabase.from('deal_lead_sequence').update({ next_val: num + 1 }).eq('id', 1);
  return `RR-LD-${num}`;
}

export async function insertTimelineEvent(params: {
  leadId: string;
  stage: string;
  eventType: string;
  actorEmail?: string;
  label?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase.from('deal_timeline_events').insert({
    id: generateId('evt'),
    lead_id: params.leadId,
    stage: params.stage,
    event_type: params.eventType,
    actor_email: params.actorEmail || null,
    label: params.label || null,
    payload: params.payload || {},
  });
}

export async function insertDealNotification(params: {
  recipientEmail: string;
  title: string;
  message: string;
  leadId: string;
  action?: string;
  conversationId?: string;
}): Promise<void> {
  const recipientEmail = normalizeEmail(params.recipientEmail);
  if (!recipientEmail.includes('@')) return;
  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from('notifications').insert({
      user_id: recipientEmail,
      recipient_email: recipientEmail,
      type: 'deal',
      title: params.title,
      message: params.message,
      read: false,
      is_read: false,
      created_at: new Date().toISOString(),
      metadata: {
        leadId: params.leadId,
        targetType: 'deal',
        targetId: params.leadId,
        action: params.action,
        conversationId: params.conversationId || null,
      },
    });
  } catch (err) {
    console.warn('deal notification insert failed (non-fatal):', err);
  }
}

export function assistanceFulfillmentIsOpen(meta: DealLeadMetadata): boolean {
  const status = meta.assistanceFulfillment?.status;
  if (!status) return Boolean(meta.assistancePackage || meta.assistancePayment);
  return status !== 'completed' && status !== 'cancelled';
}

export function buildAssistanceFulfillment(
  packageId: string,
  source: AssistanceRequestSource,
  actorEmail: string,
): DealLeadMetadata['assistanceFulfillment'] {
  return {
    status: 'requested',
    source,
    requestedAt: new Date().toISOString(),
    requestedBy: actorEmail,
    needsInspectionBooking: assistancePackageNeedsInspection(packageId),
    needsRcAssistance: assistancePackageNeedsRc(packageId),
  };
}

export async function notifyAdminsAssistanceRequest(params: {
  leadId: string;
  packageId: string;
  source: AssistanceRequestSource;
  amount?: number;
}): Promise<void> {
  try {
    const admins = await supabaseUserService.findByRole('admin');
    const pkgLabel = dealAssistancePackageLabel(params.packageId);
    const amountText = params.amount ? ` (₹${params.amount})` : '';
    const adminEmails: string[] = [];

    for (const admin of admins.slice(0, 10)) {
      if (admin.email) {
        adminEmails.push(admin.email);
        await insertDealNotification({
          recipientEmail: admin.email,
          title: 'Deal assistance request',
          message: `${pkgLabel} requested for ${params.leadId}${amountText}`,
          leadId: params.leadId,
          action: 'view_assistance',
        });
      }
    }

    if (adminEmails.length) {
      const { notifyAdminsDealAssistanceEmail, notifyAdminDealAssistancePush } = await import(
        '../../../lib/dealAssistanceAlerts.js'
      );
      notifyAdminsDealAssistanceEmail({
        adminEmails,
        leadId: params.leadId,
        packageLabel: pkgLabel,
        source: params.source,
        amount: params.amount,
      });
      for (const email of adminEmails) {
        notifyAdminDealAssistancePush({
          adminEmail: email,
          leadId: params.leadId,
          packageLabel: pkgLabel,
        });
      }
    }
  } catch {
    /* non-fatal */
  }
}

export async function recordAssistanceRequest(params: {
  leadId: string;
  packageId: string;
  source: AssistanceRequestSource;
  actorEmail: string;
  amount?: number;
  payment?: DealLeadMetadata['assistancePayment'];
  surveyServicesInterested?: string[];
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data: row } = await supabase
    .from('deal_leads')
    .select('metadata, buyer_email, seller_email, conversation_id')
    .eq('id', params.leadId)
    .single();
  if (!row) return;

  const existingMeta = (row.metadata as DealLeadMetadata) || {};
  const now = new Date().toISOString();
  const metadata: DealLeadMetadata = {
    ...existingMeta,
    assistancePackage: params.packageId,
    assistanceFulfillment: buildAssistanceFulfillment(params.packageId, params.source, params.actorEmail),
  };

  if (params.payment) {
    metadata.assistancePayment = params.payment;
  } else if (params.source === 'purchase' && params.amount) {
    metadata.assistancePayment = {
      amount: params.amount,
      paidAt: now,
    };
  }

  if (params.surveyServicesInterested?.length) {
    metadata.surveyServicesInterested = params.surveyServicesInterested;
  }

  await supabase.from('deal_leads').update({ metadata, updated_at: now }).eq('id', params.leadId);

  const pkgLabel = dealAssistancePackageLabel(params.packageId);
  await insertTimelineEvent({
    leadId: params.leadId,
    stage: 'deal_completed',
    eventType: 'assistance_purchased',
    actorEmail: params.actorEmail,
    label: params.source === 'purchase'
      ? `Assistance Package Paid: ${pkgLabel}`
      : `Assistance requested (survey): ${pkgLabel}`,
    payload: {
      packageId: params.packageId,
      amount: params.amount,
      source: params.source,
    },
  });

  await notifyAdminsAssistanceRequest({
    leadId: params.leadId,
    packageId: params.packageId,
    source: params.source,
    amount: params.amount,
  });

  const buyerEmail = normalizeEmail(String(row.buyer_email));
  const sellerEmail = normalizeEmail(String(row.seller_email));
  const requesterEmail = params.actorEmail;
  const otherParty = requesterEmail === buyerEmail ? sellerEmail : buyerEmail;

  await insertDealNotification({
    recipientEmail: requesterEmail,
    title: 'Assistance request received',
    message: `Your ${pkgLabel} request for ${params.leadId} is with our team. We'll contact you shortly.`,
    leadId: params.leadId,
    conversationId: row.conversation_id ? String(row.conversation_id) : undefined,
  });

  if (otherParty && otherParty !== requesterEmail) {
    await insertDealNotification({
      recipientEmail: otherParty,
      title: 'Deal assistance requested',
      message: `${pkgLabel} was requested on deal ${params.leadId}.`,
      leadId: params.leadId,
      conversationId: row.conversation_id ? String(row.conversation_id) : undefined,
    });
  }
}

export function mapAssistanceQueueItemFromLead(
  lead: DealLead,
  rowUpdatedAt: string,
): AssistanceQueueItem | null {
  const meta = lead.metadata;
  const packageId = meta.assistancePackage;
  if (!packageId || !assistanceFulfillmentIsOpen(meta)) return null;

  const requestedAt = meta.assistanceFulfillment?.requestedAt
    || meta.assistancePayment?.paidAt
    || rowUpdatedAt;
  const daysOpen = Math.max(
    0,
    Math.floor((Date.now() - new Date(requestedAt).getTime()) / (1000 * 60 * 60 * 24)),
  );

  return {
    ...lead,
    packageId,
    packageLabel: dealAssistancePackageLabel(packageId),
    fulfillmentStatus: meta.assistanceFulfillment?.status || 'requested',
    source: meta.assistanceFulfillment?.source || (meta.assistancePayment ? 'purchase' : 'survey'),
    paidAmount: meta.assistancePayment?.amount,
    paidAt: meta.assistancePayment?.paidAt,
    daysOpen,
    needsInspectionBooking: meta.assistanceFulfillment?.needsInspectionBooking,
    needsRcAssistance: meta.assistanceFulfillment?.needsRcAssistance,
  };
}

export function mapLeadRow(row: Record<string, unknown>, timeline?: DealTimelineEvent[]): DealLead {
  const lead: DealLead = {
    id: String(row.id),
    vehicleId: String(row.vehicle_id),
    sellerEmail: String(row.seller_email),
    buyerEmail: String(row.buyer_email),
    buyerName: row.buyer_name ? String(row.buyer_name) : undefined,
    conversationId: row.conversation_id ? String(row.conversation_id) : undefined,
    chatStatus: row.chat_status as DealLead['chatStatus'],
    currentStage: row.current_stage as DealStage,
    status: row.status as DealLead['status'],
    metadata: (row.metadata as DealLeadMetadata) || {},
    trustDealId: row.trust_deal_id ? String(row.trust_deal_id) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    chatAcceptedAt: row.chat_accepted_at ? String(row.chat_accepted_at) : undefined,
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
    returnStatus: row.return_status ? (String(row.return_status) as DealLead['returnStatus']) : undefined,
    returnedAt: row.returned_at ? String(row.returned_at) : undefined,
    returnReason: row.return_reason ? String(row.return_reason) : undefined,
    returnReviewedAt: row.return_reviewed_at ? String(row.return_reviewed_at) : undefined,
    timeline,
    kanbanStatus: row.kanban_status ? (String(row.kanban_status) as DealKanbanStatus) : undefined,
    assignedAdminEmail: row.assigned_admin_email ? String(row.assigned_admin_email) : undefined,
    sellerNotesList: parseSellerNotes(row.seller_notes),
    sellerNotes: parseSellerNotes(row.seller_notes).map((n) => n.text).join('\n') || undefined,
    internalNotes: row.internal_notes != null ? String(row.internal_notes) : undefined,
  };
  if (!lead.kanbanStatus) {
    lead.kanbanStatus = deriveKanbanStatus(lead);
  }
  return lead;
}

export async function fetchOffersForLead(leadId: string, metadata: DealLeadMetadata) {
  try {
    const supabase = getSupabaseAdminClient();
    const { data: rows } = await supabase
      .from('deal_offers')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });
    if (rows && rows.length > 0) {
      return rows.map((o) => ({
        id: o.id,
        amount: Number(o.amount),
        offeredBy: o.offered_by as 'buyer' | 'seller',
        status: o.status as 'pending' | 'accepted' | 'rejected' | 'countered',
        parentOfferId: o.parent_offer_id || undefined,
        createdAt: o.created_at,
      }));
    }
  } catch {
    /* table may not exist yet */
  }
  return metadata.offers || [];
}

export async function fetchDocumentsForLead(leadId: string): Promise<DealDocumentRecord[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data: rows } = await supabase
      .from('deal_documents')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });
    return (rows || []).map((d) => ({
      id: d.id,
      leadId: d.lead_id,
      docType: d.doc_type,
      url: d.url,
      uploadedBy: d.uploaded_by || undefined,
      createdAt: d.created_at,
    }));
  } catch {
    return [];
  }
}

export async function enrichLead(lead: DealLead): Promise<DealLead> {
  const buyer = await supabaseUserService.findByEmail(lead.buyerEmail);
  const seller = await supabaseUserService.findByEmail(lead.sellerEmail);
  lead.buyerDisplayName = buyer?.name || lead.buyerName;
  lead.sellerDisplayName = seller?.name;
  const resolved = await resolveVehicleId(lead.vehicleId);
  if (resolved?.vehicle) {
    lead.vehicleName = `${resolved.vehicle.year} ${resolved.vehicle.make} ${resolved.vehicle.model}`;
    lead.vehicleMake = resolved.vehicle.make;
    lead.vehicleModel = resolved.vehicle.model;
  }
  lead.offers = await fetchOffersForLead(lead.id, lead.metadata);
  lead.documents = await fetchDocumentsForLead(lead.id);
  if (!lead.kanbanStatus) {
    lead.kanbanStatus = deriveKanbanStatus(lead);
  }
  return lead;
}

export async function syncKanbanStatus(leadId: string): Promise<void> {
  const lead = await fetchLeadWithTimeline(leadId);
  if (!lead) return;
  const kanban = deriveKanbanStatus(lead);
  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from('deal_leads').update({ kanban_status: kanban }).eq('id', leadId);
  } catch {
    /* column may not exist yet */
  }
}

export async function backfillAllKanbanStatuses(): Promise<{
  total: number;
  updated: number;
  unchanged: number;
}> {
  const supabase = getSupabaseAdminClient();
  const { data: rows } = await supabase
    .from('deal_leads')
    .select('id, status, current_stage, chat_status, metadata, kanban_status');

  const list = rows || [];
  let updated = 0;
  let unchanged = 0;

  for (const row of list) {
    const computed = deriveKanbanStatus({
      status: String(row.status) as DealLead['status'],
      currentStage: String(row.current_stage) as DealStage,
      chatStatus: String(row.chat_status) as DealLead['chatStatus'],
      metadata: ((row.metadata as DealLeadMetadata) || {}) as DealLeadMetadata,
    });

    const existing = row.kanban_status ? String(row.kanban_status) : '';
    if (existing === computed) {
      unchanged += 1;
      continue;
    }

    await supabase
      .from('deal_leads')
      .update({ kanban_status: computed, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    updated += 1;
  }

  return { total: list.length, updated, unchanged };
}

/** Calendar grid keys use local YYYY-MM-DD (not UTC ISO slice). */
export function toCalendarDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function calendarDateStatus(eventDate: Date, today: Date): DealCalendarEventStatus {
  const d = new Date(eventDate);
  d.setHours(0, 0, 0, 0);
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  if (d.getTime() === t.getTime()) return 'today';
  if (d.getTime() < t.getTime()) return 'overdue';
  return 'upcoming';
}

export function buildCalendarEvents(leads: DealLead[]): DealCalendarEvent[] {
  const events: DealCalendarEvent[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const lead of leads) {
    if (lead.status !== 'active') continue;
    const vehicle = lead.metadata.vehicleName || 'Vehicle';
    const buyer = lead.buyerName || lead.buyerDisplayName || 'Buyer';

    const td = lead.metadata.testDrive;
    if (td?.date && td.status !== 'completed' && lead.currentStage !== 'test_drive_completed') {
      const eventDate = new Date(td.date);
      if (!Number.isNaN(eventDate.getTime())) {
        events.push({
          id: `${lead.id}_test_drive`,
          dealId: lead.id,
          type: 'test_drive',
          title: 'Test drive',
          subtitle: `${buyer} · ${vehicle}`,
          date: td.date,
          time: td.time,
          status: calendarDateStatus(eventDate, today),
        });
      }
    }

    if (
      lead.metadata.token?.confirmedAt &&
      !lead.metadata.delivery?.sellerConfirmedAt &&
      lead.currentStage !== 'delivery_completed'
    ) {
      const eventDate = new Date(lead.metadata.token.confirmedAt);
      eventDate.setDate(eventDate.getDate() + 3);
      events.push({
        id: `${lead.id}_delivery`,
        dealId: lead.id,
        type: 'delivery',
        title: 'Delivery follow-up',
        subtitle: `${buyer} · ${vehicle}`,
        date: toCalendarDateKey(eventDate),
        status: calendarDateStatus(eventDate, today),
      });
    }

    if (
      ['delivery_completed', 'documents_completed', 'documents_pending', 'rc_pending'].includes(
        lead.currentStage,
      ) &&
      lead.currentStage !== 'rc_completed' &&
      lead.currentStage !== 'deal_completed'
    ) {
      const base = new Date(lead.updatedAt);
      const deadline = new Date(base);
      deadline.setDate(deadline.getDate() + 30);
      events.push({
        id: `${lead.id}_rc`,
        dealId: lead.id,
        type: 'rc_deadline',
        title: 'RC transfer target',
        subtitle: vehicle,
        date: toCalendarDateKey(deadline),
        status: calendarDateStatus(deadline, today),
      });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

export function rcStatusForLead(lead: DealLead): RcQueueItem['rcStatus'] {
  if (lead.currentStage === 'rc_completed' || lead.currentStage === 'deal_completed') return 'completed';
  if (lead.metadata.rc?.buyerConfirmedAt) return 'buyer_confirmed';
  if (lead.metadata.rc?.transferDocUrl) return 'submitted';
  return 'pending_upload';
}

export function mapComplaintRow(row: Record<string, unknown>): DealComplaint {
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    reporterEmail: String(row.reporter_email),
    category: row.category as DealComplaintCategory,
    message: String(row.message),
    status: row.status as DealComplaintStatus,
    adminNotes: row.admin_notes ? String(row.admin_notes) : undefined,
    resolvedBy: row.resolved_by ? String(row.resolved_by) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : undefined,
  };
}

export function mapInspectionBookingRow(row: Record<string, unknown>): DealInspectionBooking {
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    bookedBy: String(row.booked_by),
    scheduledDate: String(row.scheduled_date),
    scheduledTime: String(row.scheduled_time),
    address: String(row.address),
    notes: row.notes ? String(row.notes) : undefined,
    mechanicName: row.mechanic_name ? String(row.mechanic_name) : undefined,
    status: row.status as DealInspectionBookingStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function canActAsSellerOnLead(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  auth: { email: string; role?: string },
  row: Record<string, unknown>,
): Promise<boolean> {
  if (auth.role === 'admin') return true;

  const sellerEmail = normalizeEmail(String(row.seller_email || ''));
  if (sellerEmail && auth.email === sellerEmail) return true;

  const vehicleId = String(row.vehicle_id || '');
  if (!vehicleId) return false;

  const numericId = Number(vehicleId);
  if (Number.isFinite(numericId) && numericId > 0) {
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('seller_email')
      .eq('id', numericId)
      .maybeSingle();
    if (vehicle && normalizeEmail(String(vehicle.seller_email || '')) === auth.email) {
      return true;
    }
  }

  const resolved = await resolveVehicleId(vehicleId);
  return normalizeEmail(resolved?.vehicle?.sellerEmail || '') === auth.email;
}

export async function assertDealParticipant(
  leadId: string,
  auth: { email: string; role?: string },
): Promise<{ row: Record<string, unknown> } | null> {
  const supabase = getSupabaseAdminClient();
  const { data: row } = await supabase.from('deal_leads').select('*').eq('id', leadId).single();
  if (!row) return null;
  const sellerEmail = normalizeEmail(String(row.seller_email));
  const buyerEmail = normalizeEmail(String(row.buyer_email));
  const isSeller = await canActAsSellerOnLead(supabase, auth, row);
  if (!isSeller && auth.email !== buyerEmail && auth.role !== 'admin') {
    return null;
  }
  return { row };
}

export const INSPECTION_BOOKING_STAGES = new Set([
  'test_drive_completed',
  'inspection_requested',
  'inspection_completed',
]);

export async function tryInsertDealOffer(params: {
  id: string;
  leadId: string;
  amount: number;
  offeredBy: 'buyer' | 'seller';
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  parentOfferId?: string;
}): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from('deal_offers').insert({
      id: params.id,
      lead_id: params.leadId,
      amount: params.amount,
      offered_by: params.offeredBy,
      status: params.status,
      parent_offer_id: params.parentOfferId || null,
    });
  } catch {
    /* deal_offers table may not exist yet */
  }
}

export async function tryUpdateDealOfferStatus(
  offerId: string,
  status: 'pending' | 'accepted' | 'rejected' | 'countered',
): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from('deal_offers').update({ status }).eq('id', offerId);
  } catch {
    /* non-fatal */
  }
}

export async function tryInsertDealDocument(params: {
  leadId: string;
  docType: 'token_receipt' | 'sale_agreement' | 'delivery_note' | 'rc_transfer' | 'inspection_report';
  url: string;
  uploadedBy?: string;
}): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from('deal_documents').insert({
      id: generateId('doc'),
      lead_id: params.leadId,
      doc_type: params.docType,
      url: params.url,
      uploaded_by: params.uploadedBy || null,
    });
  } catch {
    /* deal_documents table may not exist yet */
  }
}

export async function syncDualWriteForStage(
  leadId: string,
  stage: DealStage,
  metadata: DealLeadMetadata,
  actorEmail: string,
): Promise<void> {
  if (stage === 'offer_made' && metadata.currentOfferId) {
    const offer = metadata.offers?.find((o) => o.id === metadata.currentOfferId);
    if (offer) {
      await tryInsertDealOffer({
        id: offer.id,
        leadId,
        amount: offer.amount,
        offeredBy: offer.offeredBy,
        status: offer.status,
        parentOfferId: offer.parentOfferId,
      });
    }
  }
  if (stage === 'token_uploaded' && metadata.token?.receiptUrl) {
    await tryInsertDealDocument({
      leadId,
      docType: 'token_receipt',
      url: metadata.token.receiptUrl,
      uploadedBy: actorEmail,
    });
  }
  if (stage === 'documents_pending') {
    if (metadata.documents?.saleAgreementUrl) {
      await tryInsertDealDocument({
        leadId,
        docType: 'sale_agreement',
        url: metadata.documents.saleAgreementUrl,
        uploadedBy: actorEmail,
      });
    }
    if (metadata.documents?.deliveryNoteUrl) {
      await tryInsertDealDocument({
        leadId,
        docType: 'delivery_note',
        url: metadata.documents.deliveryNoteUrl,
        uploadedBy: actorEmail,
      });
    }
  }
  if (stage === 'rc_pending' && metadata.rc?.transferDocUrl) {
    await tryInsertDealDocument({
      leadId,
      docType: 'rc_transfer',
      url: metadata.rc.transferDocUrl,
      uploadedBy: actorEmail,
    });
  }
  if (stage === 'inspection_completed' && metadata.inspection?.reportUrl) {
    await tryInsertDealDocument({
      leadId,
      docType: 'inspection_report',
      url: metadata.inspection.reportUrl,
      uploadedBy: actorEmail,
    });
  }
}

export async function fetchLeadWithTimeline(leadId: string): Promise<DealLead | null> {
  const supabase = getSupabaseAdminClient();
  const { data: row } = await supabase.from('deal_leads').select('*').eq('id', leadId).single();
  if (!row) return null;

  const { data: events } = await supabase
    .from('deal_timeline_events')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true });

  const timeline: DealTimelineEvent[] = (events || []).map((e) => ({
    id: e.id,
    leadId: e.lead_id,
    stage: e.stage,
    eventType: e.event_type,
    actorEmail: e.actor_email,
    label: e.label,
    payload: e.payload as Record<string, unknown>,
    createdAt: e.created_at,
  }));

  return mapLeadRow(row, timeline);
}

export async function fetchTimelinesByLeadIds(leadIds: string[]): Promise<Map<string, DealTimelineEvent[]>> {
  const map = new Map<string, DealTimelineEvent[]>();
  if (!leadIds.length) return map;

  const supabase = getSupabaseAdminClient();
  const { data: events } = await supabase
    .from('deal_timeline_events')
    .select('*')
    .in('lead_id', leadIds)
    .order('created_at', { ascending: true });

  for (const e of events || []) {
    const leadId = String(e.lead_id);
    const list = map.get(leadId) || [];
    list.push({
      id: e.id,
      leadId: e.lead_id,
      stage: e.stage,
      eventType: e.event_type,
      actorEmail: e.actor_email,
      label: e.label,
      payload: e.payload as Record<string, unknown>,
      createdAt: e.created_at,
    });
    map.set(leadId, list);
  }
  return map;
}

export async function fetchOffersByLeadIds(
  leadIds: string[],
  metadataByLeadId: Map<string, DealLeadMetadata>,
): Promise<Map<string, NonNullable<DealLeadMetadata['offers']>>> {
  const map = new Map<string, NonNullable<DealLeadMetadata['offers']>>();
  if (!leadIds.length) return map;

  try {
    const supabase = getSupabaseAdminClient();
    const { data: rows } = await supabase
      .from('deal_offers')
      .select('*')
      .in('lead_id', leadIds)
      .order('created_at', { ascending: true });
    for (const o of rows || []) {
      const leadId = String(o.lead_id);
      const list = map.get(leadId) || [];
      list.push({
        id: String(o.id),
        amount: Number(o.amount),
        offeredBy: o.offered_by as 'buyer' | 'seller',
        status: o.status as 'pending' | 'accepted' | 'rejected' | 'countered',
        parentOfferId: o.parent_offer_id ? String(o.parent_offer_id) : undefined,
        createdAt: String(o.created_at),
      });
      map.set(leadId, list);
    }
  } catch {
    /* deal_offers table may not exist yet */
  }

  for (const id of leadIds) {
    if (!map.has(id)) {
      const meta = metadataByLeadId.get(id);
      if (meta?.offers?.length) map.set(id, meta.offers);
    }
  }
  return map;
}

export async function fetchDocumentsByLeadIds(
  leadIds: string[],
): Promise<Map<string, DealDocumentRecord[]>> {
  const map = new Map<string, DealDocumentRecord[]>();
  if (!leadIds.length) return map;

  try {
    const supabase = getSupabaseAdminClient();
    const { data: rows } = await supabase
      .from('deal_documents')
      .select('*')
      .in('lead_id', leadIds)
      .order('created_at', { ascending: true });
    for (const d of rows || []) {
      const leadId = String(d.lead_id);
      const list = map.get(leadId) || [];
      list.push({
        id: d.id,
        leadId: d.lead_id,
        docType: d.doc_type,
        url: d.url,
        uploadedBy: d.uploaded_by || undefined,
        createdAt: d.created_at,
      });
      map.set(leadId, list);
    }
  } catch {
    /* deal_documents table may not exist yet */
  }
  return map;
}

export async function leadsFromRows(rows: Record<string, unknown>[]): Promise<DealLead[]> {
  if (!rows.length) return [];
  const leadIds = rows.map((r) => String(r.id));
  const timelines = await fetchTimelinesByLeadIds(leadIds);
  return rows.map((row) => mapLeadRow(row, timelines.get(String(row.id))));
}

export async function enrichLeadsBatch(
  leads: DealLead[],
  options?: { includeOffers?: boolean; includeDocuments?: boolean },
): Promise<DealLead[]> {
  if (!leads.length) return leads;

  const includeOffers = options?.includeOffers ?? true;
  const includeDocuments = options?.includeDocuments ?? true;

  const emails = new Set<string>();
  for (const lead of leads) {
    emails.add(normalizeEmail(lead.buyerEmail));
    emails.add(normalizeEmail(lead.sellerEmail));
  }

  const supabase = getSupabaseAdminClient();
  const { data: users } = await supabase
    .from('users')
    .select('email, name')
    .in('email', [...emails]);

  const nameByEmail = new Map<string, string>();
  for (const user of users || []) {
    nameByEmail.set(normalizeEmail(String(user.email)), String(user.name || ''));
  }

  const leadIds = leads.map((l) => l.id);
  const metadataByLeadId = new Map(leads.map((l) => [l.id, l.metadata]));
  const offersByLead = includeOffers
    ? await fetchOffersByLeadIds(leadIds, metadataByLeadId)
    : new Map();
  const docsByLead = includeDocuments ? await fetchDocumentsByLeadIds(leadIds) : new Map();

  const vehicleIds = [...new Set(leads.map((l) => l.vehicleId))];
  const vehicleById = new Map<string, { year: number; make: string; model: string }>();
  for (const vehicleId of vehicleIds) {
    const resolved = await resolveVehicleId(vehicleId);
    if (resolved?.vehicle) {
      vehicleById.set(vehicleId, resolved.vehicle);
    }
  }

  return leads.map((lead) => {
    lead.buyerDisplayName = nameByEmail.get(normalizeEmail(lead.buyerEmail)) || lead.buyerName;
    lead.sellerDisplayName = nameByEmail.get(normalizeEmail(lead.sellerEmail));
    const vehicle = vehicleById.get(lead.vehicleId);
    if (vehicle) {
      lead.vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
      lead.vehicleMake = vehicle.make;
      lead.vehicleModel = vehicle.model;
    }
    if (includeOffers) {
      lead.offers = offersByLead.get(lead.id) || lead.metadata.offers || [];
    }
    if (includeDocuments) {
      lead.documents = docsByLead.get(lead.id) || [];
    }
    if (!lead.kanbanStatus) {
      lead.kanbanStatus = deriveKanbanStatus(lead);
    }
    return lead;
  });
}

/** Mark the linked vehicle sold when a deal pipeline completes. */
export async function markVehicleSoldForCompletedDeal(vehicleIdRaw: string): Promise<void> {
  const resolved = await resolveVehicleId(vehicleIdRaw);
  if (!resolved?.vehicle) return;

  const now = new Date().toISOString();
  try {
    await supabaseVehicleService.update(resolved.primaryKey, {
      status: 'sold',
      listingStatus: 'sold',
      soldAt: now,
    });
  } catch (err) {
    console.warn('markVehicleSoldForCompletedDeal failed:', err);
  }
}

export function buildSellerTasks(leads: DealLead[]): SellerTask[] {
  const tasks: SellerTask[] = [];

  for (const lead of leads) {
    if (lead.status !== 'active') continue;
    const vehicleName = lead.metadata.vehicleName || 'your listing';
    const buyer = lead.buyerName || lead.buyerDisplayName || 'Buyer';

    if (lead.chatStatus === 'pending') {
      tasks.push({
        id: `${lead.id}_accept_chat`,
        dealId: lead.id,
        type: 'accept_chat',
        priority: 100,
        title: 'Accept chat',
        subtitle: `${buyer} · ${vehicleName}`,
        conversationId: lead.conversationId,
      });
    }

    const currentOffer = lead.metadata.offers?.find((o) => o.id === lead.metadata.currentOfferId);
    if (currentOffer?.status === 'pending' && currentOffer.offeredBy === 'buyer') {
      tasks.push({
        id: `${lead.id}_respond_offer`,
        dealId: lead.id,
        type: 'respond_offer',
        priority: 90,
        title: `Respond to offer · ₹${currentOffer.amount.toLocaleString('en-IN')}`,
        subtitle: `${buyer} · ${vehicleName}`,
        conversationId: lead.conversationId,
        payload: { amount: currentOffer.amount, offerId: currentOffer.id },
      });
    }

    const td = lead.metadata.testDrive;
    if (td?.status === 'confirmed' && lead.currentStage === 'test_drive_scheduled') {
      tasks.push({
        id: `${lead.id}_test_drive`,
        dealId: lead.id,
        type: 'confirm_test_drive',
        priority: 80,
        title: 'Test drive scheduled',
        subtitle: `${td.date} ${td.time} · ${buyer}`,
        conversationId: lead.conversationId,
        dueAt: td.date,
      });
    }

    if (lead.metadata.token?.receiptUrl && !lead.metadata.token?.confirmedAt) {
      tasks.push({
        id: `${lead.id}_confirm_token`,
        dealId: lead.id,
        type: 'confirm_token',
        priority: 70,
        title: 'Confirm token received',
        subtitle: `${buyer} · ${vehicleName}`,
        conversationId: lead.conversationId,
      });
    }

    const delivery = lead.metadata.delivery;
    if (
      delivery?.buyerConfirmedAt &&
      !delivery?.sellerConfirmedAt &&
      lead.currentStage !== 'delivery_completed'
    ) {
      tasks.push({
        id: `${lead.id}_confirm_delivery`,
        dealId: lead.id,
        type: 'confirm_delivery',
        priority: 65,
        title: 'Confirm vehicle delivered',
        subtitle: `${buyer} · ${vehicleName}`,
        conversationId: lead.conversationId,
      });
    }
  }

  for (const lead of leads) {
    if (lead.status === 'completed' && lead.returnStatus === 'returned') {
      const vehicleName = lead.metadata.vehicleName || lead.vehicleName || 'your listing';
      const buyer = lead.buyerName || lead.buyerDisplayName || 'Buyer';
      tasks.push({
        id: `${lead.id}_review_return`,
        dealId: lead.id,
        type: 'review_return',
        priority: 95,
        title: 'Review vehicle return',
        subtitle: `${buyer} · ${vehicleName}`,
        conversationId: lead.conversationId,
      });
    }
  }

  return tasks.sort((a, b) => b.priority - a.priority);
}

export async function updateLeadStage(
  leadId: string,
  stage: DealStage,
  extra?: { metadata?: Partial<DealLeadMetadata>; status?: string; completedAt?: string },
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const updates: Record<string, unknown> = {
    current_stage: stage,
    updated_at: new Date().toISOString(),
  };
  if (extra?.status) updates.status = extra.status;
  if (extra?.completedAt) updates.completed_at = extra.completedAt;
  if (extra?.metadata) {
    const { data: existing } = await supabase.from('deal_leads').select('metadata').eq('id', leadId).single();
    updates.metadata = { ...(existing?.metadata as object || {}), ...extra.metadata };
  }
  await supabase.from('deal_leads').update(updates).eq('id', leadId);
  await syncKanbanStatus(leadId);
}