import { getSupabaseAdminClient, supabaseUserService } from '../handler-shared.js';
import type {
  DealComplaint,
  DealComplaintCategory,
  DealComplaintStatus,
  DealLeadMetadata,
} from '../../types.js';
import { DEAL_COMPLAINT_CATEGORIES } from '../../types.js';
import type { DealActionHandler } from './context.js';
import {
  assertDealParticipant,
  firstQueryParam,
  generateId,
  getAuthEmail,
  insertDealNotification,
  insertTimelineEvent,
  mapComplaintRow,
} from './shared.js';

const VALID_CATEGORIES = DEAL_COMPLAINT_CATEGORIES.map((c) => c.value) as DealComplaintCategory[];
const VALID_STATUSES: DealComplaintStatus[] = ['open', 'investigating', 'resolved', 'dismissed'];

/** Deal-linked complaints (deal_complaints table). */
export const handleDealComplaints: DealActionHandler = async (ctx) => {
  const { req, res, subPath, method } = ctx;

  if (method === 'POST' && subPath === 'create-deal-complaint') {
    const auth = await getAuthEmail(req);
    if (!auth) {
      res.status(401).json({ success: false, reason: 'Authentication required' });
      return true;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const leadId = String(body.leadId || '');
    const category = String(body.category || '') as DealComplaintCategory;
    const message = String(body.message || '').trim();

    if (!leadId || !VALID_CATEGORIES.includes(category) || !message) {
      res.status(400).json({ success: false, reason: 'leadId, category, and message are required' });
      return true;
    }

    const participant = await assertDealParticipant(leadId, auth);
    if (!participant) {
      res.status(403).json({ success: false, reason: 'Not authorized or lead not found' });
      return true;
    }

    const complaintId = generateId('complaint');
    const now = new Date().toISOString();
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase.from('deal_complaints').insert({
      id: complaintId,
      lead_id: leadId,
      reporter_email: auth.email,
      category,
      message,
      status: 'open',
      created_at: now,
      updated_at: now,
    });
    if (error) {
      res.status(500).json({ success: false, reason: error.message });
      return true;
    }

    await insertTimelineEvent({
      leadId,
      stage: String(participant.row.current_stage),
      eventType: 'complaint_filed',
      actorEmail: auth.email,
      label: `Complaint filed: ${category.replace(/_/g, ' ')}`,
      payload: { complaintId, category },
    });

    try {
      const admins = await supabaseUserService.findByRole('admin');
      for (const admin of admins.slice(0, 5)) {
        if (admin.email) {
          await insertDealNotification({
            recipientEmail: admin.email,
            title: 'Deal complaint',
            message: `Complaint on ${leadId}: ${category.replace(/_/g, ' ')}`,
            leadId,
            action: 'view_complaint',
          });
        }
      }
    } catch {
      /* non-fatal */
    }

    const complaint = mapComplaintRow({
      id: complaintId,
      lead_id: leadId,
      reporter_email: auth.email,
      category,
      message,
      status: 'open',
      created_at: now,
      updated_at: now,
    });

    res.status(201).json({ success: true, complaint });
    return true;
  }

  if (method === 'GET' && subPath === 'deal-complaints') {
    const auth = await getAuthEmail(req);
    if (!auth) {
      res.status(401).json({ success: false, reason: 'Authentication required' });
      return true;
    }

    const leadId = firstQueryParam(req.query?.leadId);
    const statusFilter = firstQueryParam(req.query?.status);
    const supabase = getSupabaseAdminClient();
    const isAdmin = auth.role === 'admin';

    let query = supabase.from('deal_complaints').select('*').order('created_at', { ascending: false });

    if (leadId) {
      const participant = await assertDealParticipant(leadId, auth);
      if (!participant) {
        res.status(403).json({ success: false, reason: 'Not authorized' });
        return true;
      }
      query = query.eq('lead_id', leadId);
    } else if (!isAdmin) {
      res.status(403).json({ success: false, reason: 'Admin access required' });
      return true;
    }

    if (statusFilter && VALID_STATUSES.includes(statusFilter as DealComplaintStatus)) {
      query = query.eq('status', statusFilter);
    }

    const { data: rows, error } = await query.limit(isAdmin && !leadId ? 200 : 50);
    if (error) {
      res.status(500).json({ success: false, reason: error.message });
      return true;
    }

    const complaints: DealComplaint[] = [];
    for (const row of rows || []) {
      const c = mapComplaintRow(row);
      const { data: leadRow } = await supabase
        .from('deal_leads')
        .select('buyer_email, seller_email, metadata')
        .eq('id', c.leadId)
        .single();
      if (leadRow) {
        c.buyerEmail = String(leadRow.buyer_email);
        c.sellerEmail = String(leadRow.seller_email);
        c.dealVehicleName = (leadRow.metadata as DealLeadMetadata)?.vehicleName;
      }
      complaints.push(c);
    }

    res.status(200).json({ success: true, complaints });
    return true;
  }

  if (method === 'POST' && subPath === 'update-deal-complaint') {
    const auth = await getAuthEmail(req);
    if (!auth || auth.role !== 'admin') {
      res.status(403).json({ success: false, reason: 'Admin access required' });
      return true;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const complaintId = String(body.complaintId || '');
    const status = String(body.status || '') as DealComplaintStatus;
    const adminNotes = body.adminNotes != null ? String(body.adminNotes) : undefined;

    if (!complaintId || !VALID_STATUSES.includes(status)) {
      res.status(400).json({ success: false, reason: 'complaintId and valid status required' });
      return true;
    }

    const supabase = getSupabaseAdminClient();
    const { data: existing } = await supabase.from('deal_complaints').select('*').eq('id', complaintId).single();
    if (!existing) {
      res.status(404).json({ success: false, reason: 'Complaint not found' });
      return true;
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status,
      updated_at: now,
    };
    if (adminNotes !== undefined) updates.admin_notes = adminNotes;
    if (status === 'resolved' || status === 'dismissed') {
      updates.resolved_at = now;
      updates.resolved_by = auth.email;
    }

    const { error } = await supabase.from('deal_complaints').update(updates).eq('id', complaintId);
    if (error) {
      res.status(500).json({ success: false, reason: error.message });
      return true;
    }

    await insertTimelineEvent({
      leadId: String(existing.lead_id),
      stage: 'deal_completed',
      eventType: 'complaint_updated',
      actorEmail: auth.email,
      label: `Complaint ${status}`,
      payload: { complaintId, status },
    });

    const complaint = mapComplaintRow({ ...existing, ...updates });
    res.status(200).json({ success: true, complaint });
    return true;
  }

  return false;
};
