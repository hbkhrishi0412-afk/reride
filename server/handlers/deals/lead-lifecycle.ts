import { getSupabaseAdminClient, supabaseUserService } from '../handler-shared.js';
import type { DealActionHandler } from './context.js';
import {
  assertDealParticipant,
  enrichLead,
  ensureConversationForDeal,
  fetchLeadWithTimeline,
  firstQueryParam,
  generateId,
  getAuthEmail,
  insertDealNotification,
  insertTimelineEvent,
  leadsFromRows,
  nextLeadId,
  normalizeEmail,
  participantIdVariantsAdmin,
  resolveVehicleId,
  syncKanbanStatus,
} from './shared.js';

/** Lead creation, chat acceptance, lookups, surveys, conversation linking. */
export const handleLeadLifecycle: DealActionHandler = async (ctx) => {
  const { req, res, subPath, method } = ctx;

  if (method === 'POST' && subPath === 'create-lead') {
    const auth = await getAuthEmail(req);
    if (!auth) {
      res.status(401).json({ success: false, reason: 'Authentication required' });
      return true;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const vehicleIdRaw = String(body.vehicleId || '');
    const conversationId = body.conversationId ? String(body.conversationId) : undefined;
    const buyerName = body.buyerName ? String(body.buyerName) : undefined;

    if (!vehicleIdRaw) {
      res.status(400).json({ success: false, reason: 'vehicleId is required' });
      return true;
    }

    const resolved = await resolveVehicleId(vehicleIdRaw);
    if (!resolved?.vehicle) {
      res.status(404).json({ success: false, reason: 'Vehicle not found' });
      return true;
    }

    const sellerEmail = normalizeEmail(resolved.vehicle.sellerEmail || '');
    const buyerEmail = auth.email;
    if (sellerEmail === buyerEmail) {
      res.status(400).json({ success: false, reason: 'You cannot express interest in your own listing' });
      return true;
    }

    const supabase = getSupabaseAdminClient();
    const { data: existing } = await supabase
      .from('deal_leads')
      .select('*')
      .eq('vehicle_id', resolved.primaryKey)
      .eq('buyer_email', buyerEmail)
      .maybeSingle();

    const vehicleName = `${resolved.vehicle.year} ${resolved.vehicle.make} ${resolved.vehicle.model}`;
    const persistedConversationId = await ensureConversationForDeal({
      vehiclePrimaryKey: resolved.primaryKey,
      vehicleName,
      vehiclePrice: resolved.vehicle.price,
      buyerEmail,
      buyerName,
      sellerEmail,
      clientConversationId: conversationId,
    });

    if (existing) {
      if (
        persistedConversationId &&
        String(existing.conversation_id || '') !== persistedConversationId
      ) {
        await supabase
          .from('deal_leads')
          .update({
            conversation_id: persistedConversationId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      }
      const lead = await fetchLeadWithTimeline(existing.id);
      res.status(200).json({ success: true, lead, existing: true });
      return true;
    }

    const leadId = await nextLeadId();
    const now = new Date().toISOString();

    await supabase.from('deal_leads').insert({
      id: leadId,
      vehicle_id: resolved.primaryKey,
      seller_email: sellerEmail,
      buyer_email: buyerEmail,
      buyer_name: buyerName || null,
      conversation_id: persistedConversationId || conversationId || null,
      chat_status: 'pending',
      current_stage: 'lead_created',
      status: 'active',
      metadata: { vehicleName },
      created_at: now,
      updated_at: now,
    });

    await syncKanbanStatus(leadId);

    await insertTimelineEvent({
      leadId,
      stage: 'lead_created',
      eventType: 'lead_created',
      actorEmail: buyerEmail,
      label: 'Lead Created',
      payload: { vehicleName },
    });

    const buyerUser = await supabaseUserService.findByEmail(buyerEmail);
    await insertDealNotification({
      recipientEmail: sellerEmail,
      title: 'New Lead — Buyer Interested',
      message: `${buyerUser?.name || buyerName || 'A buyer'} is interested in your ${vehicleName}. Accept chat to connect.`,
      leadId,
      action: 'accept_chat',
      conversationId: persistedConversationId || conversationId,
    });

    try {
      const { notifySellerDealLeadChannels } = await import('../../../lib/sellerDealLeadAlerts.js');
      notifySellerDealLeadChannels({
        sellerEmail,
        buyerName: buyerUser?.name || buyerName || 'A buyer',
        vehicleTitle: vehicleName,
        leadId,
        conversationId: persistedConversationId || conversationId,
      });
    } catch {
      /* non-fatal */
    }

    const lead = await fetchLeadWithTimeline(leadId);
    res.status(201).json({ success: true, lead });
    return true;
  }

  if (method === 'POST' && subPath === 'accept-chat') {
    const auth = await getAuthEmail(req);
    if (!auth) {
      res.status(401).json({ success: false, reason: 'Authentication required' });
      return true;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const leadId = String(body.leadId || '');
    if (!leadId) {
      res.status(400).json({ success: false, reason: 'leadId is required' });
      return true;
    }

    const supabase = getSupabaseAdminClient();
    const { data: row } = await supabase.from('deal_leads').select('*').eq('id', leadId).single();
    if (!row) {
      res.status(404).json({ success: false, reason: 'Lead not found' });
      return true;
    }

    if (normalizeEmail(String(row.seller_email)) !== auth.email) {
      res.status(403).json({ success: false, reason: 'Only the seller can accept chat' });
      return true;
    }

    if (row.chat_status === 'accepted') {
      const lead = await fetchLeadWithTimeline(leadId);
      res.status(200).json({ success: true, lead });
      return true;
    }

    const now = new Date().toISOString();
    await supabase.from('deal_leads').update({
      chat_status: 'accepted',
      chat_accepted_at: now,
      current_stage: 'chat_accepted',
      updated_at: now,
      conversation_id: body.conversationId ? String(body.conversationId) : row.conversation_id,
    }).eq('id', leadId);

    await syncKanbanStatus(leadId);

    await insertTimelineEvent({
      leadId,
      stage: 'chat_accepted',
      eventType: 'chat_accepted',
      actorEmail: auth.email,
      label: 'Chat Started',
    });

    await insertDealNotification({
      recipientEmail: String(row.buyer_email),
      title: 'Chat Accepted',
      message: 'The seller accepted your chat request. You can now message each other.',
      leadId,
    });

    const { data: existingSurvey } = await supabase
      .from('deal_surveys')
      .select('id')
      .eq('lead_id', leadId)
      .maybeSingle();
    if (!existingSurvey) {
      const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('deal_surveys').insert({
        id: generateId('survey'),
        lead_id: leadId,
        due_at: dueAt,
      });
    }

    const lead = await fetchLeadWithTimeline(leadId);
    res.status(200).json({ success: true, lead });
    return true;
  }

  if (method === 'GET' && subPath === 'get-lead') {
    const auth = await getAuthEmail(req);
    if (!auth) {
      res.status(401).json({ success: false, reason: 'Authentication required' });
      return true;
    }

    const leadId = firstQueryParam(req.query?.leadId);
    const vehicleId = firstQueryParam(req.query?.vehicleId);
    const conversationId = firstQueryParam(req.query?.conversationId);

    const supabase = getSupabaseAdminClient();
    let row: Record<string, unknown> | null = null;

    if (leadId) {
      const { data } = await supabase.from('deal_leads').select('*').eq('id', leadId).single();
      row = data;
    } else if (conversationId) {
      const { data } = await supabase
        .from('deal_leads')
        .select('*')
        .eq('conversation_id', conversationId)
        .maybeSingle();
      row = data;
    } else if (vehicleId) {
      const resolved = await resolveVehicleId(vehicleId);
      if (resolved) {
        const { data } = await supabase
          .from('deal_leads')
          .select('*')
          .eq('vehicle_id', resolved.primaryKey)
          .eq('buyer_email', auth.email)
          .maybeSingle();
        row = data;
      }
    }

    if (!row) {
      res.status(404).json({ success: false, reason: 'Lead not found' });
      return true;
    }

    const sellerEmail = normalizeEmail(String(row.seller_email));
    const buyerEmail = normalizeEmail(String(row.buyer_email));
    if (auth.email !== sellerEmail && auth.email !== buyerEmail && auth.role !== 'admin') {
      res.status(403).json({ success: false, reason: 'Not authorized' });
      return true;
    }

    let lead = await fetchLeadWithTimeline(String(row.id));
    if (lead) lead = await enrichLead(lead);
    res.status(200).json({ success: true, lead });
    return true;
  }

  if (method === 'GET' && subPath === 'my-leads') {
    const auth = await getAuthEmail(req);
    if (!auth) {
      res.status(401).json({ success: false, reason: 'Authentication required' });
      return true;
    }

    const supabase = getSupabaseAdminClient();
    const { data: asBuyer } = await supabase
      .from('deal_leads')
      .select('*')
      .eq('buyer_email', auth.email)
      .order('updated_at', { ascending: false });

    const { data: asSeller } = await supabase
      .from('deal_leads')
      .select('*')
      .eq('seller_email', auth.email)
      .order('updated_at', { ascending: false });

    const seen = new Set<string>();
    const rows = [...(asBuyer || []), ...(asSeller || [])].filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    const leads = await leadsFromRows(rows);
    res.status(200).json({ success: true, leads });
    return true;
  }

  if (method === 'GET' && subPath === 'pending-surveys') {
    const auth = await getAuthEmail(req);
    if (!auth) {
      res.status(401).json({ success: false, reason: 'Authentication required' });
      return true;
    }

    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();
    const { data: surveys } = await supabase
      .from('deal_surveys')
      .select('*, deal_leads!inner(*)')
      .is('responded_at', null)
      .lte('due_at', now);

    const pending = (surveys || []).filter((s) => {
      const lead = s.deal_leads as Record<string, unknown>;
      return (
        normalizeEmail(String(lead.buyer_email)) === auth.email &&
        lead.status === 'active' &&
        !['deal_completed', 'rc_completed'].includes(String(lead.current_stage))
      );
    });

    res.status(200).json({ success: true, surveys: pending });
    return true;
  }

  if (method === 'POST' && subPath === 'link-conversation') {
    const auth = await getAuthEmail(req);
    if (!auth) {
      res.status(401).json({ success: false, reason: 'Authentication required' });
      return true;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const leadId = String(body.leadId || '');
    const conversationId = String(body.conversationId || '');

    if (!leadId || !conversationId) {
      res.status(400).json({ success: false, reason: 'leadId and conversationId are required' });
      return true;
    }

    const participant = await assertDealParticipant(leadId, auth);
    if (!participant) {
      res.status(403).json({ success: false, reason: 'Not authorized' });
      return true;
    }

    const supabase = getSupabaseAdminClient();
    const { data: conv } = await supabase
      .from('conversations')
      .select('customer_id, seller_id')
      .eq('id', conversationId)
      .maybeSingle();

    if (!conv) {
      res.status(404).json({ success: false, reason: 'Conversation not found' });
      return true;
    }

    const buyerEmail = normalizeEmail(String(participant.row.buyer_email));
    const sellerEmail = normalizeEmail(String(participant.row.seller_email));
    const buyerVariants = await participantIdVariantsAdmin(supabase, buyerEmail);
    const sellerVariants = await participantIdVariantsAdmin(supabase, sellerEmail);
    const customerOk = buyerVariants.includes(String(conv.customer_id));
    const sellerOk = sellerVariants.includes(String(conv.seller_id));
    if (!customerOk || !sellerOk) {
      res.status(403).json({ success: false, reason: 'Conversation does not belong to this deal' });
      return true;
    }

    const { error } = await supabase.from('deal_leads').update({
      conversation_id: conversationId,
      updated_at: new Date().toISOString(),
    }).eq('id', leadId);

    if (error) {
      res.status(500).json({ success: false, reason: 'Failed to link conversation' });
      return true;
    }

    res.status(200).json({ success: true });
    return true;
  }

  return false;
};
