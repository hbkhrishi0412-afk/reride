import { getSupabaseAdminClient, supabaseUserService } from '../../handler-shared.js';
import type {
  AdminKanbanBoard,
  DealKanbanStatus,
  DealLead,
  DealLeadMetadata,
  DealRevenueDashboard,
  DealSellerNote,
  FraudDashboard,
  FraudSignal,
  RcQueueItem,
  SellerCommandCenter,
  SellerDealCalendar,
} from '../../../types.js';
import {
  DEAL_ASSISTANCE_PACKAGES,
  assistancePackageNeedsRc,
  deriveKanbanStatus,
} from '../../../types.js';
import { parseSellerNotes, serializeSellerNotes, normalizeSellerNotes } from '../../../lib/dealSellerNotes.js';
import type { DealActionHandler } from './context.js';
import {
  backfillAllKanbanStatuses,
  buildCalendarEvents,
  buildSellerTasks,
  canActAsSellerOnLead,
  enrichLead,
  enrichLeadsBatch,
  ensureConversationForDeal,
  fetchLeadWithTimeline,
  firstQueryParam,
  getAuthEmail,
  insertTimelineEvent,
  leadsFromRows,
  mapLeadRow,
  normalizeEmail,
  rcStatusForLead,
  resolveVehicleId,
} from './shared.js';

const KANBAN_STATUSES: DealKanbanStatus[] = [
  'lead_created',
  'buyer_contacted',
  'chat_started',
  'offer_sent',
  'negotiation',
  'inspection',
  'payment_pending',
  'vehicle_delivered',
  'rc_transfer',
  'completed',
  'cancelled',
];

/** Seller command center, admin kanban/RC/fraud/revenue dashboards. */
export const handleAdminOps: DealActionHandler = async (ctx) => {
  const { req, res, subPath, method } = ctx;

  if (method === 'GET' && subPath === 'seller-command-center') {
    const auth = await getAuthEmail(req);
    if (!auth) {
      res.status(401).json({ success: false, reason: 'Authentication required' });
      return true;
    }

    const supabase = getSupabaseAdminClient();
    let { data: rows } = await supabase
      .from('deal_leads')
      .select('*')
      .eq('seller_email', auth.email)
      .eq('status', 'active')
      .order('updated_at', { ascending: false });

    if (!rows?.length) {
      const { data: sellerVehicles } = await supabase
        .from('vehicles')
        .select('id')
        .eq('seller_email', auth.email);
      const vehicleIds = (sellerVehicles || []).map((v) => String(v.id)).filter(Boolean);
      if (vehicleIds.length > 0) {
        const { data: byVehicle } = await supabase
          .from('deal_leads')
          .select('*')
          .in('vehicle_id', vehicleIds)
          .eq('status', 'active')
          .order('updated_at', { ascending: false });
        rows = byVehicle || [];
      }
    }

    for (const row of rows || []) {
      const meta = (row.metadata as DealLeadMetadata) || {};
      const vehicleName =
        meta.vehicleName ||
        (typeof row.vehicle_id === 'string' || typeof row.vehicle_id === 'number'
          ? `Vehicle ${row.vehicle_id}`
          : 'Vehicle');

      const repairedConversationId = await ensureConversationForDeal({
        vehiclePrimaryKey: String(row.vehicle_id),
        vehicleName,
        buyerEmail: String(row.buyer_email),
        buyerName: row.buyer_name ? String(row.buyer_name) : undefined,
        sellerEmail: String(row.seller_email || auth.email),
        clientConversationId: row.conversation_id ? String(row.conversation_id) : undefined,
      });

      if (repairedConversationId && String(row.conversation_id || '') !== repairedConversationId) {
        await supabase
          .from('deal_leads')
          .update({
            conversation_id: repairedConversationId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        row.conversation_id = repairedConversationId;
      }

      if (!normalizeEmail(String(row.seller_email || '')) && auth.email) {
        await supabase
          .from('deal_leads')
          .update({
            seller_email: auth.email,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
      }
    }

    const leads = await enrichLeadsBatch(
      await leadsFromRows(rows || []),
      { includeOffers: false, includeDocuments: false },
    );

    const { data: returnReviewRows } = await supabase
      .from('deal_leads')
      .select('*')
      .eq('seller_email', auth.email)
      .eq('status', 'completed')
      .eq('return_status', 'returned')
      .order('returned_at', { ascending: false });

    const returnReviewLeads = await enrichLeadsBatch(
      await leadsFromRows(returnReviewRows || []),
      { includeOffers: false, includeDocuments: false },
    );

    const leadsForTasks = [...leads];
    for (const rl of returnReviewLeads) {
      if (!leadsForTasks.some((l) => l.id === rl.id)) {
        leadsForTasks.push(rl);
      }
    }

    const tasks = buildSellerTasks(leadsForTasks);
    const pendingInterestCount = leads.filter((l) => l.chatStatus === 'pending').length;
    const sellerUser = await supabaseUserService.findByEmail(auth.email);

    const commandCenter: SellerCommandCenter = {
      tasks,
      activeDeals: leads.slice(0, 8),
      stats: {
        activeDealCount: leads.length,
        pendingInterestCount,
        tasksToday: tasks.length,
        trustScore: sellerUser?.trustScore ?? 50,
        ratingAverage: sellerUser?.sellerAverageRating ?? sellerUser?.averageRating ?? 0,
        ratingCount: sellerUser?.sellerRatingCount ?? sellerUser?.ratingCount ?? 0,
      },
    };

    res.status(200).json({ success: true, commandCenter });
    return true;
  }

  if (method === 'GET' && subPath === 'admin-leads') {
    const auth = await getAuthEmail(req);
    if (!auth || auth.role !== 'admin') {
      res.status(403).json({ success: false, reason: 'Admin access required' });
      return true;
    }

    const supabase = getSupabaseAdminClient();
    const { data: rows } = await supabase
      .from('deal_leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    const leads = await enrichLeadsBatch(
      await leadsFromRows(rows || []),
      { includeOffers: false, includeDocuments: false },
    );

    res.status(200).json({ success: true, leads });
    return true;
  }

  if (method === 'GET' && subPath === 'deal-detail') {
    const auth = await getAuthEmail(req);
    if (!auth) {
      res.status(401).json({ success: false, reason: 'Authentication required' });
      return true;
    }

    const leadId = firstQueryParam(req.query?.leadId);
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

    const buyerEmail = normalizeEmail(String(row.buyer_email));
    const isSeller = await canActAsSellerOnLead(supabase, auth, row);
    if (!isSeller && auth.email !== buyerEmail && auth.role !== 'admin') {
      res.status(403).json({ success: false, reason: 'Not authorized' });
      return true;
    }

    let lead = await fetchLeadWithTimeline(leadId);
    if (!lead) {
      res.status(404).json({ success: false, reason: 'Lead not found' });
      return true;
    }
    lead = await enrichLead(lead);

    const resolved = await resolveVehicleId(lead.vehicleId);
    const detail = {
      ...lead,
      vehiclePrice: resolved?.vehicle?.price,
      vehicleYear: resolved?.vehicle?.year,
    };

    res.status(200).json({ success: true, deal: detail });
    return true;
  }

  if (method === 'GET' && subPath === 'admin-kanban') {
    const auth = await getAuthEmail(req);
    if (!auth || auth.role !== 'admin') {
      res.status(403).json({ success: false, reason: 'Admin access required' });
      return true;
    }

    const supabase = getSupabaseAdminClient();
    const { data: rows } = await supabase
      .from('deal_leads')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(300);

    const columns: AdminKanbanBoard['columns'] = {
      lead_created: [],
      buyer_contacted: [],
      chat_started: [],
      offer_sent: [],
      negotiation: [],
      inspection: [],
      payment_pending: [],
      vehicle_delivered: [],
      rc_transfer: [],
      completed: [],
      cancelled: [],
    };

    const baseLeads = (rows || []).map((row) => mapLeadRow(row, undefined));
    const enriched = await enrichLeadsBatch(baseLeads);

    for (const lead of enriched) {
      let col = lead.kanbanStatus || deriveKanbanStatus(lead);
      if (!columns[col]) col = deriveKanbanStatus(lead);
      if (columns[col]) columns[col].push(lead);
      else columns.lead_created.push(lead);
    }

    const totalCount = Object.values(columns).reduce((sum, arr) => sum + arr.length, 0);
    const board: AdminKanbanBoard = { columns, totalCount };
    res.status(200).json({ success: true, board });
    return true;
  }

  if (method === 'POST' && subPath === 'backfill-kanban-status') {
    const auth = await getAuthEmail(req);
    if (!auth || auth.role !== 'admin') {
      res.status(403).json({ success: false, reason: 'Admin access required' });
      return true;
    }

    const result = await backfillAllKanbanStatuses();
    res.status(200).json({ success: true, ...result });
    return true;
  }

  if (method === 'POST' && subPath === 'update-kanban') {
    const auth = await getAuthEmail(req);
    if (!auth || auth.role !== 'admin') {
      res.status(403).json({ success: false, reason: 'Admin access required' });
      return true;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const leadId = String(body.leadId || '');
    const kanbanStatus = String(body.kanbanStatus || '') as DealKanbanStatus;
    const assignedAdminEmail = body.assignedAdminEmail
      ? normalizeEmail(String(body.assignedAdminEmail))
      : undefined;

    if (!leadId || !KANBAN_STATUSES.includes(kanbanStatus)) {
      res.status(400).json({ success: false, reason: 'leadId and valid kanbanStatus required' });
      return true;
    }

    const supabase = getSupabaseAdminClient();
    const updates: Record<string, unknown> = {
      kanban_status: kanbanStatus,
      updated_at: new Date().toISOString(),
    };
    if (kanbanStatus === 'cancelled') updates.status = 'cancelled';
    if (kanbanStatus === 'completed') {
      updates.status = 'completed';
      updates.completed_at = new Date().toISOString();
    }
    if (assignedAdminEmail !== undefined) updates.assigned_admin_email = assignedAdminEmail || null;

    await supabase.from('deal_leads').update(updates).eq('id', leadId);

    await insertTimelineEvent({
      leadId,
      stage: kanbanStatus,
      eventType: 'kanban_moved',
      actorEmail: auth.email,
      label: `Moved to ${kanbanStatus.replace(/_/g, ' ')}`,
    });

    let lead = await fetchLeadWithTimeline(leadId);
    if (lead) lead = await enrichLead(lead);
    res.status(200).json({ success: true, lead });
    return true;
  }

  if (method === 'POST' && subPath === 'update-deal-notes') {
    const auth = await getAuthEmail(req);
    if (!auth) {
      res.status(401).json({ success: false, reason: 'Authentication required' });
      return true;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const leadId = String(body.leadId || '');
    const internalNotes = body.internalNotes != null ? String(body.internalNotes) : undefined;
    let sellerNotesList: ReturnType<typeof normalizeSellerNotes> | undefined;
    if (body.sellerNotesList !== undefined) {
      sellerNotesList = normalizeSellerNotes(
        Array.isArray(body.sellerNotesList) ? (body.sellerNotesList as DealSellerNote[]) : [],
      );
    } else if (body.sellerNotes != null) {
      sellerNotesList = normalizeSellerNotes(parseSellerNotes(String(body.sellerNotes)));
    }

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

    const isAdmin = auth.role === 'admin';
    const isSeller = await canActAsSellerOnLead(supabase, auth, row);

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (sellerNotesList !== undefined && (isSeller || isAdmin)) {
      updates.seller_notes = serializeSellerNotes(sellerNotesList);
      if (isSeller && !normalizeEmail(String(row.seller_email || ''))) {
        updates.seller_email = auth.email;
      }
    }
    if (internalNotes !== undefined && isAdmin) updates.internal_notes = internalNotes;

    if (Object.keys(updates).length <= 1) {
      res.status(403).json({ success: false, reason: 'Not authorized to update notes' });
      return true;
    }

    const { error: updateError } = await supabase.from('deal_leads').update(updates).eq('id', leadId);
    if (updateError) {
      res.status(500).json({ success: false, reason: updateError.message || 'Could not save notes' });
      return true;
    }

    let lead = await fetchLeadWithTimeline(leadId);
    if (lead) lead = await enrichLead(lead);
    res.status(200).json({ success: true, lead });
    return true;
  }

  if (method === 'GET' && subPath === 'seller-calendar') {
    const auth = await getAuthEmail(req);
    if (!auth) {
      res.status(401).json({ success: false, reason: 'Authentication required' });
      return true;
    }

    const supabase = getSupabaseAdminClient();
    const { data: rows } = await supabase
      .from('deal_leads')
      .select('*')
      .eq('seller_email', auth.email)
      .eq('status', 'active')
      .order('updated_at', { ascending: false });

    const leads: DealLead[] = [];
    for (const row of rows || []) {
      const lead = await fetchLeadWithTimeline(row.id);
      if (lead) {
        const buyer = await supabaseUserService.findByEmail(lead.buyerEmail);
        lead.buyerDisplayName = buyer?.name || lead.buyerName;
        leads.push(lead);
      }
    }

    const events = buildCalendarEvents(leads);
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);

    const calendar: SellerDealCalendar = {
      events,
      thisWeekCount: events.filter((e) => e.date >= todayStr && e.date <= weekEndStr).length,
      overdueCount: events.filter((e) => e.status === 'overdue').length,
    };

    res.status(200).json({ success: true, calendar });
    return true;
  }

  if (method === 'GET' && subPath === 'admin-rc-queue') {
    const auth = await getAuthEmail(req);
    if (!auth || auth.role !== 'admin') {
      res.status(403).json({ success: false, reason: 'Admin access required' });
      return true;
    }

    const supabase = getSupabaseAdminClient();
    const { data: rows } = await supabase
      .from('deal_leads')
      .select('*')
      .in('current_stage', [
        'delivery_completed',
        'documents_pending',
        'documents_completed',
        'rc_pending',
        'rc_completed',
      ])
      .neq('status', 'cancelled')
      .order('updated_at', { ascending: true })
      .limit(100);

    const queue: RcQueueItem[] = [];
    const now = Date.now();

    for (const row of rows || []) {
      let lead = mapLeadRow(row, undefined);
      lead = await enrichLead(lead);
      const updatedAt = new Date(lead.updatedAt).getTime();
      const daysInQueue = Math.max(0, Math.floor((now - updatedAt) / (1000 * 60 * 60 * 24)));
      queue.push({
        ...lead,
        rcDocUrl: lead.metadata.rc?.transferDocUrl,
        daysInQueue,
        rcStatus: rcStatusForLead(lead),
        hasPaidRcAssistance: Boolean(
          lead.metadata.assistancePackage
          && assistancePackageNeedsRc(lead.metadata.assistancePackage)
          && lead.metadata.assistancePayment,
        ),
      });
    }

    res.status(200).json({ success: true, queue });
    return true;
  }

  if (method === 'GET' && subPath === 'admin-fraud-signals') {
    const auth = await getAuthEmail(req);
    if (!auth || auth.role !== 'admin') {
      res.status(403).json({ success: false, reason: 'Admin access required' });
      return true;
    }

    const supabase = getSupabaseAdminClient();
    const signals: FraudSignal[] = [];

    try {
      const { data: auditRows } = await supabase
        .from('audit_log')
        .select('id, timestamp, actor, action, target, details')
        .eq('action', 'content-report')
        .order('timestamp', { ascending: false })
        .limit(50);

      for (const row of auditRows || []) {
        const target = String(row.target || '');
        const [targetType, targetId] = target.split(':');
        signals.push({
          id: `report_${row.id}`,
          severity: 'high',
          type: 'content_report',
          title: 'Content report',
          description: String(row.details || 'No details provided'),
          targetType: targetType || 'unknown',
          targetId: targetId || target,
          targetEmail: String(row.actor || ''),
          createdAt: String(row.timestamp),
        });
      }
    } catch {
      /* audit_log may not exist */
    }

    const { data: cancelledRows } = await supabase
      .from('deal_leads')
      .select('*')
      .eq('status', 'cancelled')
      .order('updated_at', { ascending: false })
      .limit(20);

    for (const row of cancelledRows || []) {
      signals.push({
        id: `cancel_${row.id}`,
        severity: 'medium',
        type: 'cancelled_deal',
        title: 'Cancelled deal',
        description: `Deal ${row.id} was cancelled at stage ${row.current_stage}`,
        dealId: String(row.id),
        targetEmail: String(row.seller_email),
        createdAt: String(row.updated_at),
      });
    }

    const { data: activeRows } = await supabase
      .from('deal_leads')
      .select('buyer_email, id, created_at')
      .eq('status', 'active');

    const buyerCounts = new Map<string, { count: number; latest: string }>();
    for (const row of activeRows || []) {
      const email = normalizeEmail(String(row.buyer_email));
      const cur = buyerCounts.get(email) || { count: 0, latest: String(row.created_at) };
      cur.count += 1;
      if (String(row.created_at) > cur.latest) cur.latest = String(row.created_at);
      buyerCounts.set(email, cur);
    }

    for (const [email, info] of buyerCounts) {
      if (info.count >= 4) {
        signals.push({
          id: `repeat_${email}`,
          severity: info.count >= 6 ? 'high' : 'medium',
          type: 'repeat_buyer',
          title: 'Repeat interest pattern',
          description: `${email} has ${info.count} active deal leads — possible spam or broker activity`,
          targetEmail: email,
          createdAt: info.latest,
        });
      }
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: staleRows } = await supabase
      .from('deal_leads')
      .select('*')
      .eq('chat_status', 'pending')
      .eq('status', 'active')
      .lt('created_at', sevenDaysAgo)
      .limit(20);

    for (const row of staleRows || []) {
      signals.push({
        id: `stale_${row.id}`,
        severity: 'low',
        type: 'stale_chat',
        title: 'Unanswered interest',
        description: `Seller ${row.seller_email} has not accepted chat for ${row.id} (7+ days)`,
        dealId: String(row.id),
        targetEmail: String(row.seller_email),
        createdAt: String(row.created_at),
      });
    }

    signals.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    let rcOverdue = 0;
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: rcRows } = await supabase
        .from('deal_leads')
        .select('id, updated_at, current_stage')
        .in('current_stage', ['delivery_completed', 'documents_pending', 'documents_completed', 'rc_pending'])
        .neq('status', 'cancelled')
        .lt('updated_at', thirtyDaysAgo);
      rcOverdue = (rcRows || []).length;
    } catch {
      /* non-fatal */
    }

    const dashboard: FraudDashboard = {
      signals,
      stats: {
        highRisk: signals.filter((s) => s.severity === 'high').length,
        mediumRisk: signals.filter((s) => s.severity === 'medium').length,
        pendingReports: signals.filter((s) => s.type === 'content_report').length,
        cancelledDeals: signals.filter((s) => s.type === 'cancelled_deal').length,
        rcOverdue,
      },
    };

    res.status(200).json({ success: true, dashboard });
    return true;
  }

  if (method === 'GET' && subPath === 'admin-deal-revenue') {
    const auth = await getAuthEmail(req);
    if (!auth || auth.role !== 'admin') {
      res.status(403).json({ success: false, reason: 'Admin access required' });
      return true;
    }

    const supabase = getSupabaseAdminClient();
    const { data: rows } = await supabase.from('deal_leads').select('*').limit(500);

    const all = rows || [];
    const totalLeads = all.length;
    const activeDeals = all.filter((r) => r.status === 'active').length;
    const completedDeals = all.filter(
      (r) => r.status === 'completed' || r.current_stage === 'deal_completed',
    ).length;
    const cancelledDeals = all.filter((r) => r.status === 'cancelled').length;
    const conversionRate = totalLeads > 0 ? Math.round((completedDeals / totalLeads) * 100) : 0;

    let assistanceRevenue = 0;
    let assistancePurchases = 0;
    const packageCounts = new Map<string, { count: number; revenue: number }>();
    const recentPayments: DealRevenueDashboard['recentPayments'] = [];
    let acceptedOfferSum = 0;
    let acceptedOfferCount = 0;

    for (const row of all) {
      const meta = (row.metadata || {}) as DealLeadMetadata & {
        assistancePayment?: { amount?: number; paidAt?: string };
      };
      if (meta.assistancePayment?.amount) {
        const amt = Number(meta.assistancePayment.amount);
        assistanceRevenue += amt;
        assistancePurchases += 1;
        const pkg = meta.assistancePackage || 'unknown';
        const cur = packageCounts.get(pkg) || { count: 0, revenue: 0 };
        cur.count += 1;
        cur.revenue += amt;
        packageCounts.set(pkg, cur);
        recentPayments.push({
          leadId: String(row.id),
          packageId: pkg,
          amount: amt,
          paidAt: meta.assistancePayment.paidAt || String(row.updated_at),
          buyerEmail: String(row.buyer_email),
          sellerEmail: String(row.seller_email),
        });
      }
      if (meta.acceptedOfferAmount) {
        acceptedOfferSum += Number(meta.acceptedOfferAmount);
        acceptedOfferCount += 1;
      }
    }

    recentPayments.sort((a, b) => b.paidAt.localeCompare(a.paidAt));

    const funnelStages = [
      'lead_created',
      'chat_accepted',
      'offer_accepted',
      'inspection_completed',
      'test_drive_completed',
      'token_confirmed',
      'delivery_completed',
      'documents_completed',
      'rc_completed',
      'deal_completed',
    ];
    const funnel = funnelStages.map((stage) => ({
      stage,
      label: stage.replace(/_/g, ' '),
      count: all.filter((r) => {
        const idx = funnelStages.indexOf(String(r.current_stage));
        return idx >= funnelStages.indexOf(stage);
      }).length,
    }));

    const packageBreakdown = [...packageCounts.entries()].map(([packageId, data]) => {
      const pkg = DEAL_ASSISTANCE_PACKAGES.find((p) => p.id === packageId);
      return {
        packageId,
        label: pkg?.name || packageId,
        count: data.count,
        revenue: data.revenue,
      };
    });

    const dashboard: DealRevenueDashboard = {
      stats: {
        totalLeads,
        activeDeals,
        completedDeals,
        cancelledDeals,
        conversionRate,
        assistanceRevenue,
        assistancePurchases,
        avgDealValue: acceptedOfferCount > 0 ? Math.round(acceptedOfferSum / acceptedOfferCount) : 0,
      },
      funnel,
      packageBreakdown,
      recentPayments: recentPayments.slice(0, 20),
    };

    res.status(200).json({ success: true, dashboard });
    return true;
  }

  return false;
};
