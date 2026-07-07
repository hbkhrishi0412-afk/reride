import { createHmac } from 'crypto';
import { getSupabaseAdminClient } from '../../handler-shared.js';
import type {
  AssistanceFulfillmentStatus,
  AssistanceQueueItem,
  DealLeadMetadata,
} from '../../../types.js';
import {
  DEAL_ASSISTANCE_PACKAGES,
  assistancePackageNeedsInspection,
  assistancePackageNeedsRc,
  dealAssistancePackageLabel,
} from '../../../types.js';
import type { DealActionHandler } from './context.js';
import {
  assertDealParticipant,
  assistanceFulfillmentIsOpen,
  enrichLeadsBatch,
  fetchLeadWithTimeline,
  getAuthEmail,
  insertDealNotification,
  insertTimelineEvent,
  leadsFromRows,
  mapAssistanceQueueItemFromLead,
  normalizeEmail,
  recordAssistanceRequest,
} from './shared.js';

const FULFILLMENT_STATUSES: AssistanceFulfillmentStatus[] = [
  'requested',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
];

/** Surveys, payments, and admin assistance fulfillment queue. */
export const handleAssistance: DealActionHandler = async (ctx) => {
  const { req, res, subPath, method } = ctx;

  if (method === 'POST' && subPath === 'submit-survey') {
    const auth = await getAuthEmail(req);
    if (!auth) {
      res.status(401).json({ success: false, reason: 'Authentication required' });
      return true;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const surveyId = String(body.surveyId || '');
    const response = String(body.response || '') as 'yes' | 'no' | 'negotiating';
    const servicesInterested = body.servicesInterested as string[] | undefined;

    if (!surveyId) {
      res.status(400).json({ success: false, reason: 'surveyId is required' });
      return true;
    }

    const supabase = getSupabaseAdminClient();
    const { data: surveyRow } = await supabase
      .from('deal_surveys')
      .select('lead_id')
      .eq('id', surveyId)
      .maybeSingle();

    if (!surveyRow?.lead_id) {
      res.status(404).json({ success: false, reason: 'Survey not found' });
      return true;
    }

    const { data: leadRow } = await supabase
      .from('deal_leads')
      .select('buyer_email')
      .eq('id', String(surveyRow.lead_id))
      .maybeSingle();

    const buyerEmail = leadRow?.buyer_email ? normalizeEmail(String(leadRow.buyer_email)) : '';
    if (buyerEmail && auth.email !== buyerEmail && auth.role !== 'admin') {
      res.status(403).json({ success: false, reason: 'Not authorized' });
      return true;
    }

    await supabase.from('deal_surveys').update({
      response,
      services_interested: servicesInterested || [],
      responded_at: new Date().toISOString(),
    }).eq('id', surveyId);

    if (response === 'yes' && surveyRow.lead_id && servicesInterested?.length) {
      const paidIds = new Set(DEAL_ASSISTANCE_PACKAGES.map((p) => p.id));
      const primaryPackage =
        servicesInterested.find((id) => paidIds.has(id))
        || (servicesInterested.includes('rc_transfer') ? 'rc_transfer' : undefined);

      if (primaryPackage) {
        const leadId = String(surveyRow.lead_id);
        const { data: metaRow } = await supabase
          .from('deal_leads')
          .select('metadata')
          .eq('id', leadId)
          .maybeSingle();
        const meta = (metaRow?.metadata as DealLeadMetadata) || {};
        const hasOpenAssistance = Boolean(meta.assistancePackage && assistanceFulfillmentIsOpen(meta));
        if (!hasOpenAssistance) {
          await recordAssistanceRequest({
            leadId,
            packageId: primaryPackage,
            source: 'survey',
            actorEmail: auth.email,
            surveyServicesInterested: servicesInterested,
          });
        } else if (servicesInterested.length) {
          await supabase.from('deal_leads').update({
            metadata: { ...meta, surveyServicesInterested: servicesInterested },
            updated_at: new Date().toISOString(),
          }).eq('id', leadId);
        }
      } else if (servicesInterested.length) {
        const leadId = String(surveyRow.lead_id);
        const { data: metaRow } = await supabase
          .from('deal_leads')
          .select('metadata')
          .eq('id', leadId)
          .maybeSingle();
        const meta = (metaRow?.metadata as DealLeadMetadata) || {};
        await supabase.from('deal_leads').update({
          metadata: { ...meta, surveyServicesInterested: servicesInterested },
          updated_at: new Date().toISOString(),
        }).eq('id', leadId);
      }
    }

    res.status(200).json({ success: true });
    return true;
  }

  if (method === 'POST' && subPath === 'confirm-assistance-payment') {
    const auth = await getAuthEmail(req);
    if (!auth) {
      res.status(401).json({ success: false, reason: 'Authentication required' });
      return true;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const leadId = String(body.leadId || '');
    const packageId = String(body.packageId || '');
    const razorpay_order_id = String(body.razorpay_order_id || '');
    const razorpay_payment_id = String(body.razorpay_payment_id || '');
    const razorpay_signature = String(body.razorpay_signature || '');
    const amount = Number(body.amount || 0);

    if (!leadId || !packageId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({ success: false, reason: 'Missing payment or package fields' });
      return true;
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      res.status(503).json({ success: false, reason: 'Online payments are not configured' });
      return true;
    }

    const expectedSig = createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (expectedSig !== razorpay_signature) {
      res.status(400).json({ success: false, reason: 'Invalid payment signature' });
      return true;
    }

    const supabase = getSupabaseAdminClient();
    const { data: row } = await supabase
      .from('deal_leads')
      .select('metadata, buyer_email, seller_email')
      .eq('id', leadId)
      .single();
    if (!row) {
      res.status(404).json({ success: false, reason: 'Lead not found' });
      return true;
    }

    const buyerEmail = normalizeEmail(String(row.buyer_email));
    const sellerEmail = normalizeEmail(String(row.seller_email));
    if (auth.email !== buyerEmail && auth.email !== sellerEmail && auth.role !== 'admin') {
      res.status(403).json({ success: false, reason: 'Not authorized' });
      return true;
    }

    await recordAssistanceRequest({
      leadId,
      packageId,
      source: 'purchase',
      actorEmail: auth.email,
      amount,
      payment: {
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        amount,
        paidAt: new Date().toISOString(),
      },
    });

    res.status(200).json({ success: true, packageId, leadId });
    return true;
  }

  if (method === 'POST' && subPath === 'purchase-assistance') {
    const auth = await getAuthEmail(req);
    if (!auth) {
      res.status(401).json({ success: false, reason: 'Authentication required' });
      return true;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const leadId = String(body.leadId || '');
    const packageId = String(body.packageId || '');

    if (!leadId || !packageId) {
      res.status(400).json({ success: false, reason: 'leadId and packageId are required' });
      return true;
    }

    const participant = await assertDealParticipant(leadId, auth);
    if (!participant) {
      res.status(403).json({ success: false, reason: 'Not authorized' });
      return true;
    }

    if (process.env.RAZORPAY_KEY_SECRET) {
      res.status(400).json({
        success: false,
        reason: 'Use online payment to purchase assistance',
      });
      return true;
    }

    const pkg = DEAL_ASSISTANCE_PACKAGES.find((p) => p.id === packageId);
    const amount = pkg?.price ?? 0;

    await recordAssistanceRequest({
      leadId,
      packageId,
      source: 'purchase',
      actorEmail: auth.email,
      amount,
      payment: {
        amount,
        paidAt: new Date().toISOString(),
      },
    });

    res.status(200).json({ success: true, packageId });
    return true;
  }

  if (method === 'GET' && subPath === 'admin-assistance-queue') {
    const auth = await getAuthEmail(req);
    if (!auth || auth.role !== 'admin') {
      res.status(403).json({ success: false, reason: 'Admin access required' });
      return true;
    }

    const supabase = getSupabaseAdminClient();
    const { data: rows } = await supabase
      .from('deal_leads')
      .select('*')
      .neq('status', 'cancelled')
      .not('metadata', 'is', null)
      .order('updated_at', { ascending: true })
      .limit(300);

    const candidateRows = (rows || []).filter((row) => {
      const meta = (row.metadata as DealLeadMetadata) || {};
      return Boolean(meta.assistancePackage && assistanceFulfillmentIsOpen(meta));
    });
    const enriched = await enrichLeadsBatch(await leadsFromRows(candidateRows));
    const queue: AssistanceQueueItem[] = [];
    for (let i = 0; i < candidateRows.length; i += 1) {
      const item = mapAssistanceQueueItemFromLead(
        enriched[i],
        String(candidateRows[i].updated_at),
      );
      if (item) queue.push(item);
    }

    res.status(200).json({ success: true, queue });
    return true;
  }

  if (method === 'POST' && subPath === 'update-assistance-fulfillment') {
    const auth = await getAuthEmail(req);
    if (!auth || auth.role !== 'admin') {
      res.status(403).json({ success: false, reason: 'Admin access required' });
      return true;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const leadId = String(body.leadId || '');
    const status = body.status ? String(body.status) as AssistanceFulfillmentStatus : undefined;
    const assignedAdminEmail = body.assignedAdminEmail !== undefined
      ? (body.assignedAdminEmail ? normalizeEmail(String(body.assignedAdminEmail)) : undefined)
      : undefined;
    const notes = body.notes !== undefined ? String(body.notes || '') : undefined;

    if (!leadId) {
      res.status(400).json({ success: false, reason: 'leadId is required' });
      return true;
    }

    if (status && !FULFILLMENT_STATUSES.includes(status)) {
      res.status(400).json({ success: false, reason: 'Invalid status' });
      return true;
    }

    const supabase = getSupabaseAdminClient();
    const { data: row } = await supabase.from('deal_leads').select('*').eq('id', leadId).single();
    if (!row) {
      res.status(404).json({ success: false, reason: 'Lead not found' });
      return true;
    }

    const meta = (row.metadata as DealLeadMetadata) || {};
    if (!meta.assistancePackage && !meta.assistanceFulfillment) {
      res.status(400).json({ success: false, reason: 'No assistance request on this deal' });
      return true;
    }

    const now = new Date().toISOString();
    const fulfillment = {
      ...meta.assistanceFulfillment,
      status: status || meta.assistanceFulfillment?.status || 'requested',
      source: meta.assistanceFulfillment?.source || 'purchase',
      requestedAt: meta.assistanceFulfillment?.requestedAt || meta.assistancePayment?.paidAt || now,
      requestedBy: meta.assistanceFulfillment?.requestedBy,
      needsInspectionBooking: meta.assistanceFulfillment?.needsInspectionBooking
        ?? (meta.assistancePackage ? assistancePackageNeedsInspection(meta.assistancePackage) : false),
      needsRcAssistance: meta.assistanceFulfillment?.needsRcAssistance
        ?? (meta.assistancePackage ? assistancePackageNeedsRc(meta.assistancePackage) : false),
    } as NonNullable<DealLeadMetadata['assistanceFulfillment']>;

    if (assignedAdminEmail !== undefined) {
      fulfillment.assignedAdminEmail = assignedAdminEmail || undefined;
      if (!status && fulfillment.status === 'requested') {
        fulfillment.status = 'assigned';
      }
    } else if (body.assignToMe) {
      fulfillment.assignedAdminEmail = auth.email;
      if (!status && fulfillment.status === 'requested') {
        fulfillment.status = 'assigned';
      }
    }

    if (notes !== undefined) {
      fulfillment.notes = notes || undefined;
    }

    if (status === 'completed' || status === 'cancelled') {
      fulfillment.completedAt = now;
    }

    const metadata: DealLeadMetadata = {
      ...meta,
      assistanceFulfillment: fulfillment,
    };

    await supabase.from('deal_leads').update({ metadata, updated_at: now }).eq('id', leadId);

    const pkgLabel = dealAssistancePackageLabel(meta.assistancePackage || '');
    await insertTimelineEvent({
      leadId,
      stage: String(row.current_stage),
      eventType: 'assistance_fulfillment_updated',
      actorEmail: auth.email,
      label: `Assistance ${fulfillment.status.replace(/_/g, ' ')}: ${pkgLabel}`,
      payload: { status: fulfillment.status, assignedAdminEmail: fulfillment.assignedAdminEmail },
    });

    const buyerEmail = normalizeEmail(String(row.buyer_email));
    const sellerEmail = normalizeEmail(String(row.seller_email));
    const notifyEmails = [...new Set([buyerEmail, sellerEmail].filter(Boolean))];
    const statusLabel = fulfillment.status.replace(/_/g, ' ');
    for (const email of notifyEmails) {
      await insertDealNotification({
        recipientEmail: email,
        title: 'Deal assistance update',
        message: `${pkgLabel} on ${leadId} is now ${statusLabel}.`,
        leadId,
        conversationId: row.conversation_id ? String(row.conversation_id) : undefined,
      });
    }

    const lead = await fetchLeadWithTimeline(leadId);
    res.status(200).json({ success: true, lead });
    return true;
  }

  return false;
};
