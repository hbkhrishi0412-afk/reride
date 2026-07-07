/**
 * Platform complaint_cases API — formal grievances (listing, payment, deal, etc.)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  USE_SUPABASE,
  getSupabaseAdminClient,
  supabaseUserService,
  authenticateRequestDual,
  sanitizeString,
  type HandlerOptions,
} from '../handler-shared.js';
import type { ComplaintCase, ComplaintCaseCategory, ComplaintCaseStatus } from '../../types.js';
import { COMPLAINT_CASE_CATEGORIES } from '../../types.js';

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function generateId(): string {
  return `case_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function getAuthEmail(req: VercelRequest): Promise<{ email: string; role?: string } | null> {
  const auth = await authenticateRequestDual(req);
  if (!auth.isValid || !auth.user?.email) return null;
  const email = normalizeEmail(auth.user.email);
  const user = await supabaseUserService.findByEmail(email);
  return { email, role: user?.role ?? auth.user.role };
}

function mapRow(row: Record<string, unknown>): ComplaintCase {
  return {
    id: String(row.id),
    reporterEmail: String(row.reporter_email || ''),
    reporterName: row.reporter_name ? String(row.reporter_name) : undefined,
    subject: String(row.subject || ''),
    message: String(row.message || ''),
    category: (row.category as ComplaintCaseCategory) || 'other',
    dealLeadId: row.deal_lead_id ? String(row.deal_lead_id) : undefined,
    vehicleId: row.vehicle_id ? String(row.vehicle_id) : undefined,
    status: (row.status as ComplaintCaseStatus) || 'open',
    resolution: row.resolution ? String(row.resolution) : undefined,
    adminNotes: row.admin_notes ? String(row.admin_notes) : undefined,
    resolvedBy: row.resolved_by ? String(row.resolved_by) : undefined,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : undefined,
  };
}

const VALID_CATEGORIES = COMPLAINT_CASE_CATEGORIES.map((c) => c.value) as ComplaintCaseCategory[];
const VALID_STATUSES: ComplaintCaseStatus[] = ['open', 'investigating', 'resolved', 'escalated'];

export async function handleComplaints(
  req: VercelRequest,
  res: VercelResponse,
  _options: HandlerOptions,
) {
  if (!USE_SUPABASE) {
    return res.status(503).json({ success: false, reason: 'Database not configured.' });
  }

  const supabase = getSupabaseAdminClient();
  const action = typeof req.query.action === 'string' ? req.query.action : '';

  if (req.method === 'POST' && action === 'create') {
    const auth = await getAuthEmail(req);
    if (!auth?.email) {
      return res.status(401).json({ success: false, reason: 'Authentication required.' });
    }

    const body = req.body || {};
    const subject = await sanitizeString(String(body.subject || ''));
    const message = await sanitizeString(String(body.message || ''));
    const category = String(body.category || 'other') as ComplaintCaseCategory;

    if (!subject || !message) {
      return res.status(400).json({ success: false, reason: 'subject and message are required' });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, reason: 'Invalid category' });
    }

    const reporter = await supabaseUserService.findByEmail(auth.email);
    const reporterName = reporter?.name || auth.email.split('@')[0];

    const id = generateId();
    const now = new Date().toISOString();
    const row = {
      id,
      reporter_email: auth.email,
      reporter_name: reporterName,
      subject,
      message,
      category,
      deal_lead_id: body.dealLeadId ? String(body.dealLeadId) : null,
      vehicle_id: body.vehicleId ? String(body.vehicleId) : null,
      status: 'open',
      created_at: now,
      updated_at: now,
    };

    const { error } = await supabase.from('complaint_cases').insert(row);
    if (error) {
      return res.status(500).json({ success: false, reason: error.message });
    }

    return res.status(201).json({ success: true, complaint: mapRow(row) });
  }

  if (req.method === 'GET' && action === 'list') {
    const auth = await getAuthEmail(req);
    if (!auth?.email) {
      return res.status(401).json({ success: false, reason: 'Authentication required.' });
    }

    const isAdmin = auth.role === 'admin';
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined;

    let query = supabase.from('complaint_cases').select('*').order('created_at', { ascending: false });
    if (!isAdmin) {
      query = query.eq('reporter_email', auth.email);
    }
    if (statusFilter && VALID_STATUSES.includes(statusFilter as ComplaintCaseStatus)) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query.limit(200);
    if (error) {
      return res.status(500).json({ success: false, reason: error.message });
    }

    return res.status(200).json({
      success: true,
      complaints: (data || []).map((r) => mapRow(r as Record<string, unknown>)),
    });
  }

  if (req.method === 'POST' && action === 'update') {
    const auth = await getAuthEmail(req);
    if (!auth?.email || auth.role !== 'admin') {
      return res.status(403).json({ success: false, reason: 'Admin access required.' });
    }

    const body = req.body || {};
    const id = String(body.id || '');
    const status = String(body.status || '') as ComplaintCaseStatus;
    if (!id || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, reason: 'id and valid status required' });
    }

    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (body.adminNotes != null) updates.admin_notes = String(body.adminNotes);
    if (body.resolution != null) updates.resolution = String(body.resolution);
    if (status === 'resolved' || status === 'escalated') {
      updates.resolved_at = new Date().toISOString();
      updates.resolved_by = auth.email;
    }

    const { data, error } = await supabase
      .from('complaint_cases')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({ success: false, reason: error.message });
    }

    return res.status(200).json({ success: true, complaint: mapRow(data as Record<string, unknown>) });
  }

  return res.status(400).json({
    success: false,
    reason: 'Use ?action=create (POST), ?action=list (GET), or ?action=update (POST)',
  });
}
