import { getSupabaseAdminClient, supabaseUserService, supabaseVehicleService } from '../../handler-shared.js';
import { validateSellerCanPublishListing } from '../../sellerPlanLimits.js';
import type { DealActionHandler } from './context.js';
import {
  fetchLeadWithTimeline,
  getAuthEmail,
  insertDealNotification,
  insertTimelineEvent,
  normalizeEmail,
  resolveVehicleId,
} from './shared.js';

const VALID_RETURN_RESOLUTIONS = new Set(['relist', 'archive']);

/** Post-completion return: request → seller review → relist or archive. */
export const handleReturnLifecycle: DealActionHandler = async (ctx) => {
  const { req, res, subPath, method } = ctx;

  if (method === 'POST' && subPath === 'request-return') {
    const auth = await getAuthEmail(req);
    if (!auth) {
      res.status(401).json({ success: false, reason: 'Authentication required' });
      return true;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const leadId = String(body.leadId || '');
    const reason = body.reason ? String(body.reason).trim() : undefined;

    if (!leadId) {
      res.status(400).json({ success: false, reason: 'leadId is required' });
      return true;
    }

    const supabase = getSupabaseAdminClient();
    const { data: row } = await supabase.from('deal_leads').select('*').eq('id', leadId).single();
    if (!row) {
      res.status(404).json({ success: false, reason: 'Deal not found' });
      return true;
    }

    const sellerEmail = normalizeEmail(String(row.seller_email));
    const buyerEmail = normalizeEmail(String(row.buyer_email));
    const isParticipant = auth.email === sellerEmail || auth.email === buyerEmail;
    if (!isParticipant && auth.role !== 'admin') {
      res.status(403).json({ success: false, reason: 'Not authorized' });
      return true;
    }

    if (row.status !== 'completed' || row.current_stage !== 'deal_completed') {
      res.status(400).json({ success: false, reason: 'Return can only be requested on completed deals' });
      return true;
    }

    if (row.return_status) {
      res.status(400).json({ success: false, reason: 'A return has already been recorded for this deal' });
      return true;
    }

    const now = new Date().toISOString();
    await supabase.from('deal_leads').update({
      return_status: 'returned',
      returned_at: now,
      return_reason: reason || null,
      updated_at: now,
    }).eq('id', leadId);

    await insertTimelineEvent({
      leadId,
      stage: 'deal_completed',
      eventType: 'return_requested',
      actorEmail: auth.email,
      label: 'Vehicle Returned',
      payload: { reason },
    });

    await insertDealNotification({
      recipientEmail: sellerEmail,
      title: 'Return — review required',
      message: `The buyer reported a return on deal ${leadId}. Choose to relist or archive the vehicle.`,
      leadId,
      action: 'review_return',
      conversationId: row.conversation_id ? String(row.conversation_id) : undefined,
    });

    const lead = await fetchLeadWithTimeline(leadId);
    res.status(200).json({ success: true, lead });
    return true;
  }

  if (method === 'POST' && subPath === 'resolve-return') {
    const auth = await getAuthEmail(req);
    if (!auth) {
      res.status(401).json({ success: false, reason: 'Authentication required' });
      return true;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const leadId = String(body.leadId || '');
    const action = String(body.action || '');

    if (!leadId || !VALID_RETURN_RESOLUTIONS.has(action)) {
      res.status(400).json({ success: false, reason: 'leadId and action (relist|archive) are required' });
      return true;
    }

    const supabase = getSupabaseAdminClient();
    const { data: row } = await supabase.from('deal_leads').select('*').eq('id', leadId).single();
    if (!row) {
      res.status(404).json({ success: false, reason: 'Deal not found' });
      return true;
    }

    const sellerEmail = normalizeEmail(String(row.seller_email));
    if (auth.email !== sellerEmail && auth.role !== 'admin') {
      res.status(403).json({ success: false, reason: 'Only the seller can resolve a return' });
      return true;
    }

    if (row.return_status !== 'returned') {
      res.status(400).json({ success: false, reason: 'No pending return to review' });
      return true;
    }

    const resolved = await resolveVehicleId(String(row.vehicle_id));
    if (!resolved?.vehicle) {
      res.status(404).json({ success: false, reason: 'Vehicle not found' });
      return true;
    }

    const now = new Date().toISOString();
    const vehiclePk = resolved.primaryKey;

    if (action === 'relist') {
      const seller = await supabaseUserService.findByEmail(sellerEmail);
      if (!seller) {
        res.status(404).json({ success: false, reason: 'Seller not found' });
        return true;
      }

      const sellerVehicles = await supabaseVehicleService.findBySellerEmail(sellerEmail);
      const publishValidation = await validateSellerCanPublishListing(
        seller,
        resolved.vehicle,
        sellerVehicles,
        true,
      );
      if (!publishValidation.allowed) {
        res.status(403).json({
          success: false,
          reason: publishValidation.reason || 'Cannot relist — listing limit reached',
        });
        return true;
      }

      const currentCycle = Number(resolved.vehicle.listingCycle || 1);
      const nextCycle = currentCycle + 1;

      await supabaseVehicleService.update(vehiclePk, {
        status: 'published',
        listingStatus: 'active',
        soldAt: undefined,
        listingCycle: nextCycle,
        archivedAt: undefined,
      });

      await supabase.from('deal_leads').update({
        return_status: 'relisted',
        return_reviewed_at: now,
        updated_at: now,
      }).eq('id', leadId);

      await insertTimelineEvent({
        leadId,
        stage: 'deal_completed',
        eventType: 'return_relisted',
        actorEmail: auth.email,
        label: 'Vehicle Relisted',
        payload: { listingCycle: nextCycle },
      });

      await insertDealNotification({
        recipientEmail: normalizeEmail(String(row.buyer_email)),
        title: 'Vehicle relisted',
        message: `The seller relisted the vehicle from deal ${leadId}. Listing cycle ${nextCycle}.`,
        leadId,
      });
    } else {
      await supabaseVehicleService.update(vehiclePk, {
        status: 'archived',
        listingStatus: 'archived',
        archivedAt: now,
      });

      await supabase.from('deal_leads').update({
        return_status: 'archived',
        return_reviewed_at: now,
        updated_at: now,
      }).eq('id', leadId);

      await insertTimelineEvent({
        leadId,
        stage: 'deal_completed',
        eventType: 'return_archived',
        actorEmail: auth.email,
        label: 'Vehicle Archived',
      });

      await insertDealNotification({
        recipientEmail: normalizeEmail(String(row.buyer_email)),
        title: 'Vehicle archived',
        message: `The seller archived the vehicle from deal ${leadId}.`,
        leadId,
      });
    }

    const lead = await fetchLeadWithTimeline(leadId);
    res.status(200).json({ success: true, lead });
    return true;
  }

  return false;
};
