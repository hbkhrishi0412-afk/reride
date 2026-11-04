import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as core from './shared.js';
import type { ChatMessage, Conversation } from '../../types.js';
import { randomBytes } from 'crypto';
import {
  claimRazorpayPayment,
  computeStackedPlanExpiry,
  createRazorpayOrder,
  resolveRazorpayProductPrice,
  verifyRazorpayPayment,
} from '../../lib/razorpay.js';
import { insertAppNotifications } from '../insert-app-notification.js';

function newEntityId(prefix: string): string {
  return `${prefix}_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

async function handleAI(req: VercelRequest, res: VercelResponse, _options: core.HandlerOptions) {
  return res.status(410).json({
    success: false,
    reason: 'AI features have been removed from this platform.',
  });
}

// Content handler - consolidates content.ts
async function handleContent(req: VercelRequest, res: VercelResponse, _options: core.HandlerOptions) {
  if (!core.USE_SUPABASE) {
    return res.status(503).json({
      success: false,
      reason: core.getSupabaseErrorMessage(),
    });
  }

  try {
    const { type } = req.query;
    
    switch (type) {
      case 'faqs':
        return await handleFAQs(req, res);
      case 'support-tickets':
        return await handleSupportTickets(req, res);
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid content type. Use ?type=faqs or ?type=support-tickets' 
        });
    }
  } catch (error) {
    console.error('Content API Error:', error);
    return core.respondServiceUnavailable(res, error, 'Content service is temporarily unavailable.');
  }
}

// FAQs Handler
async function handleFAQs(req: VercelRequest, res: VercelResponse) {
  const faqsPath = 'faqs';

  switch (req.method) {
    case 'GET':
      return await handleGetFAQs(req, res, faqsPath);
    case 'POST':
      return await handleCreateFAQ(req, res, faqsPath);
    case 'PUT':
      return await handleUpdateFAQ(req, res, faqsPath);
    case 'DELETE':
      return await handleDeleteFAQ(req, res, faqsPath);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetFAQs(req: VercelRequest, res: VercelResponse, faqsPath: string) {
  try {
    const { category } = req.query;
    
    const allFaqs = await core.adminReadAll<Record<string, unknown>>(faqsPath);
    // CRITICAL: Spread data first, then set id to preserve string ID from key
    let faqs = Object.entries(allFaqs).map(([id, data]) => ({ ...data, id }));
    
    if (category && category !== 'all' && typeof category === 'string') {
      // Sanitize category
      const sanitizedCategory = await core.sanitizeString(category);
      faqs = faqs.filter(faq => ((faq as Record<string, unknown>).category as string) === sanitizedCategory);
    }
    
    return res.status(200).json({
      success: true,
      faqs,
      count: faqs.length
    });
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    return core.respondServiceUnavailable(res, error, 'Unable to load FAQs.');
  }
}

async function handleCreateFAQ(req: VercelRequest, res: VercelResponse, faqsPath: string) {
  try {
    const admin = await core.requireAdmin(req, res, 'Create FAQ');
    if (!admin) {
      return;
    }

    const faqData = req.body;
    
    if (!faqData.question || !faqData.answer || !faqData.category) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: question, answer, category'
      });
    }

    const id = newEntityId('faq');
    const faq = {
      ...faqData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await core.adminCreate(faqsPath, faq, id);

    return res.status(201).json({
      success: true,
      message: 'FAQ created successfully',
      faq
    });
  } catch (error) {
    console.error('Error creating FAQ:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create FAQ'
    });
  }
}

async function handleUpdateFAQ(req: VercelRequest, res: VercelResponse, faqsPath: string) {
  try {
    const admin = await core.requireAdmin(req, res, 'Update FAQ');
    if (!admin) {
      return;
    }

    const { id } = req.query;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'FAQ ID is required'
      });
    }

    const existing = await core.adminRead<Record<string, unknown>>(faqsPath, String(id));
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'FAQ not found'
      });
    }

    await core.adminUpdate(faqsPath, String(id), {
      ...updateData,
      updatedAt: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: 'FAQ updated successfully'
    });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update FAQ'
    });
  }
}

async function handleDeleteFAQ(req: VercelRequest, res: VercelResponse, faqsPath: string) {
  try {
    const admin = await core.requireAdmin(req, res, 'Delete FAQ');
    if (!admin) {
      return;
    }

    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'FAQ ID is required'
      });
    }

    await core.adminDelete(faqsPath, String(id));

    return res.status(200).json({
      success: true,
      message: 'FAQ deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete FAQ'
    });
  }
}

// Support Tickets Handler
async function handleSupportTickets(req: VercelRequest, res: VercelResponse) {
  const ticketsPath = 'support_tickets';
  // Accept either the legacy app JWT or a Supabase access token so that admins
  // signed in via Supabase OAuth can read/manage tickets (previously the admin
  // panel showed 0 tickets because the legacy-only auth rejected Supabase tokens).
  const auth = await core.authenticateRequestDual(req);
  if (!auth.isValid) {
    core.logWarn(' Support tickets - Authentication failed:', auth.error);
    res.status(401).json({
      success: false,
      reason: auth.error || 'Authentication required.',
      error: 'Invalid or expired authentication token'
    });
    return;
  }

  switch (req.method) {
    case 'GET':
      return await handleGetSupportTickets(req, res, ticketsPath, auth);
    case 'POST':
      return await handleCreateSupportTicket(req, res, ticketsPath, auth);
    case 'PUT':
      return await handleUpdateSupportTicket(req, res, ticketsPath, auth);
    case 'DELETE':
      return await handleDeleteSupportTicket(req, res, ticketsPath, auth);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetSupportTickets(
  req: VercelRequest,
  res: VercelResponse,
  ticketsPath: string,
  auth: core.AuthResult
) {
  try {
    const { userEmail, status } = req.query;
    const normalizedAuthEmail = core.normalizeAuthActorEmail(auth);
    const isAdmin = auth.user?.role === 'admin';
    
    const allTickets = await core.adminReadAll<Record<string, unknown>>(ticketsPath);
    // CRITICAL: Spread data first, then set id to preserve string ID from key
    let tickets = Object.entries(allTickets).map(([id, data]) => ({ ...data, id }));
    
    if (userEmail && typeof userEmail === 'string') {
      // Sanitize email
      const sanitizedEmail = await core.sanitizeString(userEmail);
      if (!isAdmin && normalizedAuthEmail !== sanitizedEmail.toLowerCase().trim()) {
        return res.status(200).json({ success: true, tickets: [], count: 0 });
      }
      tickets = tickets.filter(ticket => ((ticket as Record<string, unknown>).userEmail as string)?.toLowerCase().trim() === sanitizedEmail.toLowerCase().trim());
    } else if (!isAdmin) {
      // For authenticated non-admin users, default to their own tickets when no userEmail is provided.
      // This prevents noisy 403s from dashboard polling calls that omit userEmail.
      tickets = tickets.filter(
        (ticket) =>
          ((ticket as Record<string, unknown>).userEmail as string)?.toLowerCase().trim() ===
          normalizedAuthEmail,
      );
    }
    
    if (status && typeof status === 'string') {
      // Validate status is one of allowed values
      const allowedStatuses = ['Open', 'In Progress', 'Resolved', 'Closed'];
      if (allowedStatuses.includes(status)) {
        tickets = tickets.filter(ticket => (ticket as Record<string, unknown>).status === status);
      }
    }

    // Sort by createdAt descending
    tickets = tickets.sort((a, b) => {
      const aTime = (a as Record<string, unknown>).createdAt ? new Date((a as Record<string, unknown>).createdAt as string).getTime() : 0;
      const bTime = (b as Record<string, unknown>).createdAt ? new Date((b as Record<string, unknown>).createdAt as string).getTime() : 0;
      return bTime - aTime;
    });
    
    return res.status(200).json({
      success: true,
      tickets,
      count: tickets.length
    });
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to fetch support tickets' 
    });
  }
}

async function handleCreateSupportTicket(
  req: VercelRequest,
  res: VercelResponse,
  ticketsPath: string,
  auth: core.AuthResult
) {
  try {
    const ticketData = req.body;
    const normalizedAuthEmail = core.normalizeAuthActorEmail(auth);
    const isAdmin = auth.user?.role === 'admin';
    
    if (!ticketData.userEmail || !ticketData.userName || !ticketData.subject || !ticketData.message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userEmail, userName, subject, message'
      });
    }

    const sanitizedEmail = (await core.sanitizeString(String(ticketData.userEmail))).toLowerCase().trim();
    if (!isAdmin && sanitizedEmail !== normalizedAuthEmail) {
      return res.status(403).json({ success: false, error: 'Unauthorized support ticket creation' });
    }

    const id = newEntityId('ticket');
    const ticket = {
      userEmail: isAdmin ? sanitizedEmail : normalizedAuthEmail,
      userName: String(ticketData.userName || '').slice(0, 200),
      subject: String(ticketData.subject || '').slice(0, 300),
      message: String(ticketData.message || '').slice(0, 5000),
      id,
      status: 'Open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      replies: [] as unknown[],
    };

    await core.adminCreate(ticketsPath, ticket, id);

    // Fan out a notification to every admin so the admin panel shows a real-time
    // alert when a new support ticket arrives. Failures here must not block the
    // ticket response — admins will still see the ticket in the list.
    try {
      await notifyAdminsOfSupportTicket(ticket);
    } catch (notifyErr) {
      core.logWarn('Failed to notify admins of new support ticket (non-fatal):', notifyErr);
    }

    return res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      ticket
    });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create support ticket'
    });
  }
}

// Insert one notification row per admin user when a new support ticket arrives.
// Uses the same `notifications` table/schema as user notifications so the
// existing polling + realtime pipeline in the admin UI picks them up with no
// additional wiring. Silent on failure.
async function notifyAdminsOfSupportTicket(ticket: Record<string, unknown>): Promise<void> {
  if (!core.USE_SUPABASE) return;
  try {
    const supabase = core.getSupabaseAdminClient();
    const { data: admins, error } = await supabase
      .from('users')
      .select('email')
      .eq('role', 'admin');

    if (error) {
      core.logWarn('notifyAdminsOfSupportTicket: failed to load admins', error);
      return;
    }

    const adminEmails = (admins || [])
      .map((u: { email?: string | null }) => (u.email || '').toLowerCase().trim())
      .filter((e: string) => !!e);

    if (adminEmails.length === 0) return;

    const subject = String(ticket.subject || 'New support ticket');
    const requester = String(ticket.userName || ticket.userEmail || 'A user');
    const ticketId = String(ticket.id || '');

    await insertAppNotifications(adminEmails.map((email: string) => ({
      recipientEmail: email,
      type: 'general_admin',
      title: 'New support ticket',
      message: `${requester} opened: ${subject}`,
      metadata: {
        targetType: 'general_admin',
        targetId: ticketId,
        ticketId,
        subject,
        userEmail: ticket.userEmail,
        userName: ticket.userName,
      },
    })));
  } catch (err) {
    core.logWarn('notifyAdminsOfSupportTicket: unexpected error', err);
  }
}

async function handleUpdateSupportTicket(
  req: VercelRequest,
  res: VercelResponse,
  ticketsPath: string,
  auth: core.AuthResult
) {
  try {
    const { id } = req.query;
    const updateData = req.body;
    const normalizedAuthEmail = core.normalizeAuthActorEmail(auth);
    const isAdmin = auth.user?.role === 'admin';

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Support ticket ID is required'
      });
    }

    const existing = await core.adminRead<Record<string, unknown>>(ticketsPath, String(id));
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Support ticket not found'
      });
    }

    const existingOwnerEmail = ((existing as Record<string, unknown>).userEmail as string)?.toLowerCase().trim() || '';
    if (!isAdmin && existingOwnerEmail !== normalizedAuthEmail) {
      return res.status(403).json({ success: false, error: 'Unauthorized support ticket update' });
    }

    // Customers may only append their own reply text — never status, staff replies, or ownership.
    let safeUpdate: Record<string, unknown>;
    if (isAdmin) {
      safeUpdate = { ...(updateData || {}) };
      delete safeUpdate.userEmail;
      delete safeUpdate.id;
      delete safeUpdate.createdAt;
    } else {
      const replyText =
        typeof updateData?.customerReply === 'string'
          ? updateData.customerReply.trim().slice(0, 4000)
          : typeof updateData?.message === 'string'
            ? updateData.message.trim().slice(0, 4000)
            : '';
      if (!replyText) {
        return res.status(403).json({
          success: false,
          error: 'Customers can only add a reply to their ticket.',
        });
      }
      const prevReplies = Array.isArray(existing.replies) ? existing.replies : [];
      safeUpdate = {
        replies: [
          ...prevReplies,
          {
            id: newEntityId('reply'),
            author: 'customer',
            authorEmail: normalizedAuthEmail,
            message: replyText,
            createdAt: new Date().toISOString(),
          },
        ],
      };
    }

    await core.adminUpdate(ticketsPath, String(id), {
      ...safeUpdate,
      updatedAt: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: 'Support ticket updated successfully'
    });
  } catch (error) {
    console.error('Error updating support ticket:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update support ticket'
    });
  }
}

async function handleDeleteSupportTicket(
  req: VercelRequest,
  res: VercelResponse,
  ticketsPath: string,
  auth: core.AuthResult
) {
  try {
    const { id } = req.query;
      const normalizedAuthEmail = core.normalizeAuthActorEmail(auth);
    const isAdmin = auth.user?.role === 'admin';

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Support ticket ID is required'
      });
    }

    const existing = await core.adminRead<Record<string, unknown>>(ticketsPath, String(id));
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Support ticket not found' });
    }

    const existingOwnerEmail = ((existing as Record<string, unknown>).userEmail as string)?.toLowerCase().trim() || '';
    if (!isAdmin && existingOwnerEmail !== normalizedAuthEmail) {
      return res.status(403).json({ success: false, error: 'Unauthorized support ticket deletion' });
    }

    await core.adminDelete(ticketsPath, String(id));

    return res.status(200).json({
      success: true,
      message: 'Support ticket deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting support ticket:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete support ticket'
    });
  }
}

// ============================================================================
// Platform Settings handler — reads/writes the single `platform_settings` row
// (table created by scripts/add-platform-settings-and-audit-log.sql).
// ============================================================================
const PLATFORM_SETTINGS_ID = 'singleton';
const DEFAULT_PLATFORM_SETTINGS = {
  listingFee: 25,
  siteAnnouncement: '',
} as const;

async function handlePlatformSettings(
  req: VercelRequest,
  res: VercelResponse,
  _options: core.HandlerOptions,
) {
  if (!core.USE_SUPABASE) {
    if (req.method === 'GET') {
      res.setHeader('X-Data-Fallback', 'true');
      return res.status(200).json({ success: true, settings: { ...DEFAULT_PLATFORM_SETTINGS } });
    }
    return res.status(503).json({
      success: false,
      reason: 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    });
  }

  try {
    const supabase = core.getSupabaseAdminClient();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('listingFee, siteAnnouncement, updatedAt, updatedBy')
        .eq('id', PLATFORM_SETTINGS_ID)
        .maybeSingle();

      if (error) {
        // Table missing/errors must not invent a promo announcement.
        core.logWarn('platform_settings read failed, returning empty defaults:', error.message);
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json({
          success: true,
          settings: { listingFee: DEFAULT_PLATFORM_SETTINGS.listingFee, siteAnnouncement: '' },
        });
      }

      const settings = data
        ? {
            listingFee: Number(data.listingFee ?? DEFAULT_PLATFORM_SETTINGS.listingFee),
            siteAnnouncement: typeof data.siteAnnouncement === 'string'
              ? data.siteAnnouncement
              : (DEFAULT_PLATFORM_SETTINGS.siteAnnouncement as string),
            updatedAt: data.updatedAt || null,
            updatedBy: data.updatedBy || null,
          }
        : { ...DEFAULT_PLATFORM_SETTINGS };

      return res.status(200).json({ success: true, settings });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const admin = await core.requireAdmin(req, res, 'Update platform settings');
      if (!admin) return;

      const body = (req.body || {}) as Record<string, unknown>;
      const rawFee = body.listingFee;
      const rawAnnouncement = body.siteAnnouncement;

      const feeNum = typeof rawFee === 'number'
        ? rawFee
        : typeof rawFee === 'string' && rawFee.trim() !== ''
          ? Number(rawFee)
          : undefined;

      const payload: Record<string, unknown> = {
        id: PLATFORM_SETTINGS_ID,
        updatedAt: new Date().toISOString(),
        updatedBy: admin.user?.email || null,
      };

      if (feeNum !== undefined && Number.isFinite(feeNum)) {
        payload.listingFee = Math.max(0, Math.floor(feeNum));
      }
      if (typeof rawAnnouncement === 'string') {
        const trimmed = rawAnnouncement.trim();
        if (trimmed.length > 500) {
          return res.status(400).json({
            success: false,
            reason: 'siteAnnouncement must be 500 characters or fewer.',
          });
        }
        payload.siteAnnouncement = trimmed;
      }

      if (payload.listingFee === undefined && payload.siteAnnouncement === undefined) {
        return res.status(400).json({
          success: false,
          reason: 'At least one of listingFee or siteAnnouncement is required.',
        });
      }

      const { data, error } = await supabase
        .from('platform_settings')
        .upsert(payload, { onConflict: 'id' })
        .select('listingFee, siteAnnouncement, updatedAt, updatedBy')
        .maybeSingle();

      if (error) {
        core.logError('platform_settings upsert failed:', error.message);
        return res.status(500).json({ success: false, reason: 'Failed to update platform settings.' });
      }

      return res.status(200).json({
        success: true,
        settings: data
          ? {
              listingFee: Number(data.listingFee ?? DEFAULT_PLATFORM_SETTINGS.listingFee),
              siteAnnouncement: typeof data.siteAnnouncement === 'string'
                ? data.siteAnnouncement
                : (DEFAULT_PLATFORM_SETTINGS.siteAnnouncement as string),
              updatedAt: data.updatedAt || null,
              updatedBy: data.updatedBy || null,
            }
          : { ...DEFAULT_PLATFORM_SETTINGS },
      });
    }

    return res.status(405).json({ success: false, reason: 'Method not allowed.' });
  } catch (error) {
    core.logError('handlePlatformSettings error:', error);
    if (req.method === 'GET') {
      res.setHeader('X-Data-Fallback', 'true');
      return res.status(200).json({
        success: true,
        settings: { listingFee: DEFAULT_PLATFORM_SETTINGS.listingFee, siteAnnouncement: '' },
      });
    }
    return res.status(500).json({ success: false, reason: 'Failed to update platform settings.' });
  }
}

// ============================================================================
// Audit Log handler — admin-only append-and-list over `audit_log` table
// (table created by scripts/add-platform-settings-and-audit-log.sql).
// ============================================================================
async function handleAuditLog(
  req: VercelRequest,
  res: VercelResponse,
  _options: core.HandlerOptions,
) {
  if (!core.USE_SUPABASE) {
    if (req.method === 'GET') {
      res.setHeader('X-Data-Fallback', 'true');
      return res.status(200).json({ success: true, entries: [] });
    }
    return res.status(503).json({
      success: false,
      reason: 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    });
  }

  try {
    const admin = await core.requireAdmin(req, res, 'Audit log');
    if (!admin) return;

    const supabase = core.getSupabaseAdminClient();

    if (req.method === 'GET') {
      const limitRaw = core.firstQueryParam(req.query?.limit);
      const limitNum = limitRaw ? Number(limitRaw) : 500;
      const limit = Number.isFinite(limitNum) ? Math.min(Math.max(1, limitNum), 1000) : 500;

      const { data, error } = await supabase
        .from('audit_log')
        .select('id, timestamp, actor, action, target, details')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        core.logWarn('audit_log read failed, returning empty list:', error.message);
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json({ success: true, entries: [] });
      }

      const entries = (data || []).map((row) => ({
        id: typeof row.id === 'number' ? row.id : Number(row.id),
        timestamp: row.timestamp,
        actor: row.actor,
        action: row.action,
        target: row.target,
        details: row.details || undefined,
      }));

      return res.status(200).json({ success: true, entries });
    }

    if (req.method === 'POST') {
      const body = (req.body || {}) as Record<string, unknown>;
      const rawEntries = Array.isArray(body.entries)
        ? (body.entries as Record<string, unknown>[])
        : [body];
      const actorFromToken = String(admin.user?.email || '').toLowerCase().trim();
      const nowIso = new Date().toISOString();

      // Append-only: ignore client id/actor/timestamp so history cannot be overwritten or spoofed.
      const rows = rawEntries
        .map((entry, index) => {
          const action = typeof entry.action === 'string' ? entry.action.slice(0, 255) : '';
          const target = typeof entry.target === 'string' ? entry.target.slice(0, 500) : '';
          const details = typeof entry.details === 'string' ? entry.details.slice(0, 2000) : null;
          if (!actorFromToken || !action || !target) return null;
          return {
            id: Date.now() * 1000 + index + randomBytes(2).readUInt16BE(0),
            timestamp: nowIso,
            actor: actorFromToken.slice(0, 255),
            action,
            target,
            details,
          };
        })
        .filter((row): row is {
          id: number;
          timestamp: string;
          actor: string;
          action: string;
          target: string;
          details: string | null;
        } => row !== null);

      if (rows.length === 0) {
        return res.status(400).json({
          success: false,
          reason: 'At least one valid entry with action/target is required.',
        });
      }

      const { error } = await supabase.from('audit_log').insert(rows);

      if (error) {
        core.logError('audit_log insert failed:', error.message);
        return res.status(500).json({ success: false, reason: 'Failed to write audit log.' });
      }

      return res.status(200).json({ success: true, inserted: rows.length });
    }

    return res.status(405).json({ success: false, reason: 'Method not allowed.' });
  } catch (error) {
    core.logError('handleAuditLog error:', error);
    if (req.method === 'GET') {
      res.setHeader('X-Data-Fallback', 'true');
      return res.status(200).json({ success: true, entries: [] });
    }
    return res.status(500).json({ success: false, reason: 'Failed to write audit log.' });
  }
}

// Business handler - consolidates business.ts (payments and plans)
async function handleBusiness(req: VercelRequest, res: VercelResponse, _options: core.HandlerOptions) {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const pathname = url.pathname || '';
    
    // Preferred: explicit query (?type=payments|plans)
    let type = (req.query.type as string) || '';
    
    // Backward/alternate compatibility: infer from path
    if (!type) {
      if (pathname.includes('/payments')) {
        type = 'payments';
      } else if (pathname.includes('/plans')) {
        type = 'plans';
      }
    }
    
    switch (type) {
      case 'payments':
        return await handlePayments(req, res, _options);
      case 'plans':
        return await handlePlans(req, res, _options);
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid business type. Use ?type=payments or ?type=plans' 
        });
    }
  } catch (error) {
    console.error('Business API Error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected server error occurred.';
    return res.status(500).json({ success: false, reason: message, error: message });
  }
}

// Payments Handler
async function handlePayments(req: VercelRequest, res: VercelResponse, _options: core.HandlerOptions) {
  try {
    if (!core.USE_SUPABASE) {
      return res.status(503).json({
        success: false,
        reason: 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
      });
    }

    const { action } = req.query;
    const paymentRequestsPath = 'payment_requests';

    if (action === 'create') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }

      try {
        const createAuth = await core.requireAuth(req, res, 'Create payment request');
        if (!createAuth) {
          return;
        }

        const body = (req.body || {}) as Record<string, unknown>;
        const sellerEmail = body.sellerEmail;
        const amount = body.amount;
        const planRaw = body.plan ?? body.planId;
        const packageId = body.packageId;
        const paymentProof = body.paymentProof;
        const paymentMethod = body.paymentMethod;
        const transactionId = body.transactionId;
        const plan = planRaw as string;

        if (!sellerEmail || amount == null || !plan) {
          return res.status(400).json({ 
            success: false, 
            reason: 'Seller email, amount, and plan (or planId) are required' 
          });
        }

        const authedEmail = createAuth.user?.email ? createAuth.user.email.toLowerCase().trim() : '';
        const normSeller = String(sellerEmail).toLowerCase().trim();
        if (createAuth.user?.role !== 'admin' && authedEmail !== normSeller) {
          return res.status(403).json({
            success: false,
            reason: 'You can only create payment requests for your own seller account.',
          });
        }

        const catalog = await resolveRazorpayProductPrice(String(plan));
        const clientAmount = Number(amount);
        if (!Number.isFinite(clientAmount) || clientAmount <= 0) {
          return res.status(400).json({ success: false, reason: 'Invalid payment amount.' });
        }
        if (catalog && Math.round(clientAmount) !== Math.round(catalog.priceInr)) {
          return res.status(400).json({
            success: false,
            reason: 'Payment amount does not match the selected plan price.',
          });
        }

        const now = new Date().toISOString();
        const id = newEntityId('payment');
        // Persist payment request in Supabase (planId mirrors client types; plan kept for older rows)
        const paymentRequest = {
          id,
          sellerEmail: normSeller,
          amount: clientAmount,
          plan,
          planId: plan,
          packageId,
          paymentProof: paymentProof != null ? String(paymentProof) : undefined,
          paymentMethod: paymentMethod != null ? String(paymentMethod) : undefined,
          transactionId: transactionId != null ? String(transactionId) : undefined,
          status: 'pending',
          createdAt: now,
          requestedAt: now,
          updatedAt: now
        };

        await core.adminCreate(paymentRequestsPath, paymentRequest, String(paymentRequest.id));

        return res.status(201).json({
          success: true,
          paymentRequest,
          message: 'Payment request created successfully'
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to create payment request',
        });
      }
    }

    if (action === 'create-razorpay-order') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }
      try {
        const orderAuth = await core.requireAuth(req, res, 'Create Razorpay order');
        if (!orderAuth) return;

        const b = (req.body || {}) as Record<string, unknown>;
        const planId = b.planId;
        const sellerEmail = b.sellerEmail;
        if (!planId || !sellerEmail) {
          return res.status(400).json({
            success: false,
            reason: 'planId and sellerEmail are required',
          });
        }

        const authedEmail = orderAuth.user?.email ? orderAuth.user.email.toLowerCase().trim() : '';
        const normSeller = String(sellerEmail).toLowerCase().trim();
        if (orderAuth.user?.role !== 'admin' && authedEmail !== normSeller) {
          return res.status(403).json({ success: false, reason: 'You can only create orders for your own account.' });
        }

        const order = await createRazorpayOrder(String(planId), normSeller);
        if (!order.ok) {
          return res.status(order.status).json({ success: false, reason: order.reason });
        }

        return res.status(200).json({
          success: true,
          orderId: order.orderId,
          amount: order.amount,
          currency: order.currency,
          keyId: order.keyId,
        });
      } catch {
        return res.status(500).json({
          success: false,
          reason: 'Failed to create Razorpay order',
        });
      }
    }

    if (action === 'confirm-razorpay-payment') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }
      try {
        const confirmAuth = await core.requireAuth(req, res, 'Confirm Razorpay payment');
        if (!confirmAuth) return;

        const b = (req.body || {}) as Record<string, unknown>;
        const razorpay_order_id = b.razorpay_order_id;
        const razorpay_payment_id = b.razorpay_payment_id;
        const razorpay_signature = b.razorpay_signature;
        const planId = b.planId;
        const sellerEmail = b.sellerEmail;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planId || !sellerEmail) {
          return res.status(400).json({
            success: false,
            reason: 'razorpay_order_id, razorpay_payment_id, razorpay_signature, planId, and sellerEmail are required',
          });
        }

        const authedEmail = confirmAuth.user?.email ? confirmAuth.user.email.toLowerCase().trim() : '';
        const normSeller = String(sellerEmail).toLowerCase().trim();
        if (confirmAuth.user?.role !== 'admin' && authedEmail !== normSeller) {
          return res.status(403).json({ success: false, reason: 'Forbidden' });
        }

        const planStr = String(planId);
        const verified = await verifyRazorpayPayment({
          orderId: String(razorpay_order_id),
          paymentId: String(razorpay_payment_id),
          signature: String(razorpay_signature),
          productId: planStr,
          payerEmail: normSeller,
        });
        if (!verified.ok) {
          return res.status(verified.status).json({ success: false, reason: verified.reason });
        }

        const nowDate = new Date();
        const now = nowDate.toISOString();
        const paymentId = String(razorpay_payment_id);
        const paymentRequest = {
          id: `payment_rzp_${paymentId}`,
          sellerEmail: normSeller,
          amount: verified.amountPaise / 100,
          plan: planStr,
          planId: planStr,
          status: 'approved',
          paymentMethod: 'razorpay',
          transactionId: paymentId,
          razorpayOrderId: String(razorpay_order_id),
          createdAt: now,
          requestedAt: now,
          updatedAt: now,
          reviewedAt: now,
          notes: 'Verified via Razorpay',
        };

        // Upgrade before claim so a failed upgrade can be retried (claim-first caused silent 409s).
        // Boosts / deal-assist use other confirmation paths — only record payment here.
        let updatedUser: Record<string, unknown> | null = null;
        const planLowerCandidate = planStr.toLowerCase();
        const normalizedPlanCandidate = planLowerCandidate === 'basic' ? 'free' : planLowerCandidate;
        const isBoostPlan = planLowerCandidate.startsWith('boost');
        const isDealAssistPlan = planLowerCandidate.startsWith('deal_assist');
        const ALLOWED_SUBSCRIPTION_PLANS = new Set(['free', 'pro', 'premium']);
        const isKnownPlan = ALLOWED_SUBSCRIPTION_PLANS.has(normalizedPlanCandidate);

        if (!isBoostPlan && !isDealAssistPlan && isKnownPlan) {
          const existingUser = await core.userService.findByEmail(normSeller);
          if (!existingUser) {
            return res.status(404).json({
              success: false,
              reason: 'Seller account not found. Payment was not applied.',
            });
          }
          if (String((existingUser as { lastPaymentId?: string }).lastPaymentId || '') === paymentId) {
            return res.status(200).json({
              success: true,
              paymentRequest,
              user: existingUser,
              alreadyApplied: true,
            });
          }
          try {
            const planDurationDays = verified.durationDays ?? 30;
            const expiry = computeStackedPlanExpiry(
              (existingUser as { planExpiryDate?: string }).planExpiryDate,
              planDurationDays,
              nowDate,
            );
            const userUpdate: Record<string, unknown> = {
              subscriptionPlan: normalizedPlanCandidate,
              planExpiryDate: expiry.toISOString(),
              planUpdatedAt: now,
              lastPaymentId: paymentId,
            };
            await core.userService.update(normSeller, userUpdate);
            updatedUser = { ...(existingUser as unknown as Record<string, unknown>), ...userUpdate };
          } catch (planUpgradeErr) {
            core.logWarn('Failed to auto-upgrade plan after Razorpay confirm:', planUpgradeErr);
            return res.status(500).json({
              success: false,
              reason: 'Payment verified but plan upgrade failed. Please retry or contact support.',
            });
          }
        } else if (!isBoostPlan && !isDealAssistPlan && !isKnownPlan) {
          core.logWarn('confirm-razorpay-payment: unknown plan id, skipping user upgrade:', planStr);
        }

        if (!(await claimRazorpayPayment(paymentRequest))) {
          // Concurrent confirm already claimed — upgrade above is idempotent via lastPaymentId.
          return res.status(200).json({
            success: true,
            paymentRequest,
            user: updatedUser,
            alreadyApplied: true,
          });
        }

        return res.status(201).json({
          success: true,
          paymentRequest,
          user: updatedUser,
        });
      } catch {
        return res.status(500).json({
          success: false,
          reason: 'Failed to confirm payment',
        });
      }
    }

    if (action === 'status') {
      if (req.method !== 'GET') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }

      try {
        const statusAuth = await core.requireAuth(req, res, 'Payment status');
        if (!statusAuth) {
          return;
        }

        const { sellerEmail } = req.query;
        
        if (!sellerEmail) {
          return res.status(400).json({ 
            success: false, 
            reason: 'Seller email is required' 
          });
        }

        const authedEmail = statusAuth.user?.email ? statusAuth.user.email.toLowerCase().trim() : '';
        const normSeller = String(sellerEmail).toLowerCase().trim();
        if (statusAuth.user?.role !== 'admin' && authedEmail !== normSeller) {
          return res.status(403).json({
            success: false,
            reason: 'You can only view payment status for your own account.',
          });
        }

        const allRequests = await core.adminReadAll<Record<string, unknown>>(paymentRequestsPath);
        const sellerRequests = Object.values(allRequests)
          .filter((r) => String(r.sellerEmail || '').toLowerCase().trim() === String(sellerEmail).toLowerCase().trim())
          .sort((a, b) => {
            const aTime = a.createdAt ? new Date(String(a.createdAt)).getTime() : 0;
            const bTime = b.createdAt ? new Date(String(b.createdAt)).getTime() : 0;
            return bTime - aTime;
          });

        const latest = sellerRequests[0];
        const paymentStatus = latest
          ? {
              sellerEmail: String(latest.sellerEmail || sellerEmail),
              status: String(latest.status || 'pending'),
              lastPayment: latest,
              nextDue: null
            }
          : {
              sellerEmail: sellerEmail as string,
              status: 'none',
              lastPayment: null,
              nextDue: null
            };

        return res.status(200).json({
          success: true,
          paymentRequest: latest || null,
          paymentStatus
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to get payment status',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (action === 'approve') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }

      try {
        const approveAdmin = await core.requireAdmin(req, res, 'Approve payment');
        if (!approveAdmin) {
          return;
        }

        const { paymentRequestId } = req.body;
        
        if (!paymentRequestId) {
          return res.status(400).json({ 
            success: false, 
            reason: 'Payment request ID is required' 
          });
        }

        const existing = await core.adminRead<Record<string, unknown>>(
          paymentRequestsPath,
          String(paymentRequestId)
        );
        if (!existing) {
          return res.status(404).json({
            success: false,
            reason: 'Payment request not found',
          });
        }

        const currentStatus = String(existing.status || '').toLowerCase().trim();
        if (currentStatus !== 'pending') {
          return res.status(409).json({
            success: false,
            reason: `Payment request is already ${currentStatus || 'processed'}.`,
          });
        }

        const planRaw = existing.planId ?? existing.plan;
        const sellerEmail = String(existing.sellerEmail || '').toLowerCase().trim();
        const planLower = String(planRaw || '').toLowerCase();
        const normalizedPlan = planLower === 'basic' ? 'free' : planLower;
        const ALLOWED_SUBSCRIPTION_PLANS = new Set(['free', 'pro', 'premium']);
        const catalog = planRaw ? await resolveRazorpayProductPrice(String(planRaw)) : null;
        const storedAmount = Number(existing.amount);
        if (catalog && Number.isFinite(storedAmount) && Math.round(storedAmount) !== Math.round(catalog.priceInr)) {
          return res.status(400).json({
            success: false,
            reason: 'Stored payment amount does not match the current plan price. Reject and recreate the request.',
          });
        }

        const nowDate = new Date();
        const now = nowDate.toISOString();
        const adminEmail = String(approveAdmin.user?.email || '').toLowerCase().trim() || undefined;
        let updatedUser: Record<string, unknown> | null = null;

        if (sellerEmail && ALLOWED_SUBSCRIPTION_PLANS.has(normalizedPlan)) {
          try {
            const existingUser = await core.userService.findByEmail(sellerEmail);
            if (existingUser) {
              const durationDays = catalog?.durationDays ?? 30;
              const expiry = computeStackedPlanExpiry(
                (existingUser as { planExpiryDate?: string }).planExpiryDate,
                durationDays,
                nowDate,
              );
              const userUpdate: Record<string, unknown> = {
                subscriptionPlan: normalizedPlan,
                planExpiryDate: expiry.toISOString(),
                planUpdatedAt: now,
              };
              await core.userService.update(sellerEmail, userUpdate);
              updatedUser = { ...(existingUser as unknown as Record<string, unknown>), ...userUpdate };
            }
          } catch (planUpgradeErr) {
            core.logWarn('Failed to upgrade plan after manual payment approval:', planUpgradeErr);
            return res.status(500).json({
              success: false,
              reason: 'Plan upgrade failed; payment left pending. Please retry.',
            });
          }
        }

        await core.adminUpdate(paymentRequestsPath, String(paymentRequestId), {
          status: 'approved',
          approvedAt: now,
          approvedBy: adminEmail,
          reviewedAt: now,
          updatedAt: now,
          notes: req.body?.notes != null ? String(req.body.notes).slice(0, 2000) : undefined,
          adminEmail,
        });

        return res.status(200).json({
          success: true,
          message: 'Payment request approved successfully',
          paymentRequestId,
          user: updatedUser,
        });

      } catch {
        return res.status(500).json({
          success: false,
          reason: 'Failed to approve payment request',
        });
      }
    }

    if (action === 'reject') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, reason: 'Method not allowed' });
      }

      try {
        const rejectAdmin = await core.requireAdmin(req, res, 'Reject payment');
        if (!rejectAdmin) {
          return;
        }

        const { paymentRequestId, rejectionReason } = req.body;
        
        if (!paymentRequestId) {
          return res.status(400).json({ 
            success: false, 
            reason: 'Payment request ID is required' 
          });
        }

        const existing = await core.adminRead<Record<string, unknown>>(
          paymentRequestsPath,
          String(paymentRequestId),
        );
        if (!existing) {
          return res.status(404).json({ success: false, reason: 'Payment request not found' });
        }
        const currentStatus = String(existing.status || '').toLowerCase().trim();
        if (currentStatus !== 'pending') {
          return res.status(409).json({
            success: false,
            reason:
              currentStatus === 'approved'
                ? 'Cannot reject an already-approved payment without revoking the plan first.'
                : `Payment request is already ${currentStatus || 'processed'}.`,
          });
        }

        const adminEmail = String(rejectAdmin.user?.email || '').toLowerCase().trim() || undefined;
        await core.adminUpdate(paymentRequestsPath, String(paymentRequestId), {
          status: 'rejected',
          rejectedAt: new Date().toISOString(),
          rejectedBy: adminEmail,
          reviewedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          rejectionReason: String(rejectionReason || 'No reason provided').slice(0, 2000),
          adminEmail,
        });

        return res.status(200).json({
          success: true,
          message: 'Payment request rejected',
          paymentRequestId,
          reason: rejectionReason || 'No reason provided'
        });

      } catch {
        return res.status(500).json({
          success: false,
          reason: 'Failed to reject payment request',
        });
      }
    }

    // Get all payment requests
    if (req.method === 'GET') {
      try {
        const listAdmin = await core.requireAdmin(req, res, 'List payment requests');
        if (!listAdmin) {
          return;
        }

        const { status } = req.query;
        const allRequests = await core.adminReadAll<Record<string, unknown>>(paymentRequestsPath);
        let paymentRequests = Object.values(allRequests);

        if (status && typeof status === 'string') {
          const normalizedStatus = status.toLowerCase().trim();
          paymentRequests = paymentRequests.filter((request) =>
            String(request.status || '').toLowerCase().trim() === normalizedStatus
          );
        }

        paymentRequests = paymentRequests.sort((a, b) => {
          const aTime = a.createdAt ? new Date(String(a.createdAt)).getTime() : 0;
          const bTime = b.createdAt ? new Date(String(b.createdAt)).getTime() : 0;
          return bTime - aTime;
        });
        
        return res.status(200).json({
          success: true,
          paymentRequests
        });

      } catch (error) {
        return res.status(500).json({
          success: false,
          reason: 'Failed to get payment requests',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Handle invalid or missing action parameter
    if (!action) {
      return res.status(400).json({ 
        success: false, 
        reason: 'Action parameter is required. Valid actions: create, create-razorpay-order, confirm-razorpay-payment, status, approve, reject' 
      });
    }

    // If action doesn't match any known action, return 400 instead of 500
    return res.status(400).json({ 
      success: false, 
      reason: `Invalid payment action: ${action}. Valid actions: create, create-razorpay-order, confirm-razorpay-payment, status, approve, reject` 
    });
  } catch (error) {
    console.error('Payments Handler Error:', error);
    // Ensure we always return JSON
    res.setHeader('Content-Type', 'application/json');
    
    if (
      error instanceof Error &&
      (error.message.includes('SUPABASE') ||
        error.message.includes('Supabase') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('fetch failed'))
    ) {
      return res.status(503).json({
        success: false,
        reason: 'Database is currently unavailable. Please try again later.',
        fallback: true
      });
    }
    
    return res.status(500).json({
      success: false,
      reason: 'Payments handler failed',
    });
  }
}

// Conversations Handler
async function insertConversationMessageNotification(params: {
  recipientEmail: string;
  senderName: string;
  messageText: string;
  conversationId: string;
}): Promise<void> {
  const recipientEmail = String(params.recipientEmail || '').toLowerCase().trim();
  if (!recipientEmail || !recipientEmail.includes('@')) {
    return;
  }
  const messageText = typeof params.messageText === 'string' ? params.messageText : '';
  const senderName = params.senderName || 'User';
  const notificationMessage =
    messageText.length > 50
      ? `New message from ${senderName}: ${messageText.substring(0, 50)}...`
      : `New message from ${senderName}: ${messageText}`;
  try {
    await insertAppNotifications([{
      recipientEmail,
      type: 'conversation',
      title: 'New message',
      message: notificationMessage,
      metadata: {
        conversationId: String(params.conversationId),
        targetType: 'conversation',
        targetId: String(params.conversationId),
      },
    }]);
  } catch (notifErr) {
    console.warn(' API: Failed to create message notification (non-fatal):', notifErr);
  }
}

/**
 * Non-admin POST updates may only flip read flags and respond to existing offers.
 * Participants, names, flags and message authorship stay as stored; new messages go through PUT.
 */
function restrictParticipantConversationUpdate(
  existing: Conversation,
  body: Record<string, unknown>,
): Partial<Conversation> {
  const updates: Partial<Conversation> = {};
  if (typeof body.isReadBySeller === 'boolean') updates.isReadBySeller = body.isReadBySeller;
  if (typeof body.isReadByCustomer === 'boolean') updates.isReadByCustomer = body.isReadByCustomer;
  if (Array.isArray(body.messages)) {
    const incoming = new Map(
      (body.messages as Array<Partial<ChatMessage> | null>)
        .filter((m): m is Partial<ChatMessage> => !!m && m.id != null)
        .map((m) => [String(m.id), m]),
    );
    updates.messages = (existing.messages || []).map((m) => {
      const next = incoming.get(String(m.id));
      if (!next) return m;
      const payload =
        m.type === 'offer' && next.payload
          ? {
              ...m.payload,
              ...(next.payload.status !== undefined ? { status: next.payload.status } : {}),
              ...(next.payload.offerPrice !== undefined ? { offerPrice: next.payload.offerPrice } : {}),
              ...(next.payload.counterPrice !== undefined ? { counterPrice: next.payload.counterPrice } : {}),
            }
          : m.payload;
      return { ...m, isRead: typeof next.isRead === 'boolean' ? next.isRead : m.isRead, payload };
    });
  }
  return updates;
}

async function handleConversations(req: VercelRequest, res: VercelResponse, _options: core.HandlerOptions) {
  try {
    if (!core.USE_SUPABASE) {
      return res.status(503).json({
        success: false,
        reason: 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      });
    }

    // CRITICAL FIX: Make authentication optional for GET requests
    // If no auth token, return empty array instead of 401 (user might not be logged in yet)
    let auth: core.AuthResult | null = null;
    let normalizedAuthEmail = '';
    let normalizedAuthUserId = '';
    let isAdmin = false;
    
    if (req.method === 'GET') {
      auth = await core.authenticateRequestDual(req);
      if (auth.isValid && auth.user) {
        normalizedAuthEmail = core.normalizeAuthActorEmail(auth);
        normalizedAuthUserId = auth.user.userId ? String(auth.user.userId).toLowerCase().trim() : '';
        isAdmin = auth.user.role === 'admin';
      }
    } else {
      auth = await core.authenticateRequestDual(req);
      if (!auth.isValid || !auth.user) {
        core.logWarn('Conversations - Authentication failed:', auth.error);
        return res.status(401).json({
          success: false,
          reason: auth.error || 'Authentication required.',
          error: 'Invalid or expired authentication token',
        });
      }
      normalizedAuthEmail = core.normalizeAuthActorEmail(auth);
      normalizedAuthUserId = auth.user.userId ? String(auth.user.userId).toLowerCase().trim() : '';
      isAdmin = auth.user.role === 'admin';
    }
    const isAuthParticipant = (participantId: string): boolean =>
      core.participantIdMatchesAppUser(
        participantId,
        normalizedAuthEmail,
        normalizedAuthUserId,
      );

    // GET - Retrieve conversations
    if (req.method === 'GET') {
      const { customerId, sellerId, conversationId } = req.query;
      
      if (conversationId) {
        // Get single conversation
        const conversation = await core.conversationService.findById(String(conversationId));
        if (!conversation) {
          // 200 + null avoids noisy console 404s during open-thread polling before sync completes.
          return res.status(200).json({ success: true, data: null });
        }
        const normalizedCustomerId = String(conversation.customerId || '').toLowerCase().trim();
        const normalizedSellerId = String(conversation.sellerId || '').toLowerCase().trim();
        // If not authenticated, return empty payload (don't reveal conversation exists)
        if (!auth || !auth.isValid) {
          return res.status(200).json({ success: true, data: null });
        }
        if (!isAdmin && !isAuthParticipant(normalizedCustomerId) && !isAuthParticipant(normalizedSellerId)) {
          return res.status(200).json({ success: true, data: null });
        }
        return res.status(200).json({ success: true, data: conversation });
      }
      
      let conversations;
      if (customerId) {
        const normalizedCustomerId = String(customerId).toLowerCase().trim();
        // If not authenticated, return empty array
        if (!auth || !auth.isValid) {
          return res.status(200).json({ success: true, data: [] });
        }
        if (!isAdmin && !isAuthParticipant(normalizedCustomerId)) {
          return res.status(200).json({ success: true, data: [] });
        }
        conversations = await core.conversationService.findByCustomerId(String(customerId));
      } else if (sellerId) {
        const normalizedSellerId = String(sellerId).toLowerCase().trim();
        // If not authenticated, return empty array
        if (!auth || !auth.isValid) {
          return res.status(200).json({ success: true, data: [] });
        }
        if (!isAdmin && !isAuthParticipant(normalizedSellerId)) {
          return res.status(200).json({ success: true, data: [] });
        }
        // CRITICAL: Pass normalized sellerId to service for consistent matching
        // The service will also normalize internally, but passing normalized ensures consistency
        conversations = await core.conversationService.findBySellerId(normalizedSellerId);
        
        // Log for debugging in development
        if (process.env.NODE_ENV === 'development') {
          core.logInfo(' API: Fetching conversations for seller', {
            originalSellerId: String(sellerId),
            normalizedSellerId,
            foundCount: conversations?.length || 0
          });
        }
      } else {
        // No customerId or sellerId - return empty array if not admin or not authenticated
        if (!auth || !auth.isValid || !isAdmin) {
          // Return empty array instead of 401 for unauthenticated requests
          return res.status(200).json({ success: true, data: [] });
        }
        conversations = await core.conversationService.findAll();
      }
      
      // Sort by lastMessageAt descending
      conversations = conversations.sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });

      try {
        const { enrichConversationsWithDealFlags } = await import('../handlers/conversation-lifecycle.js');
        conversations = await enrichConversationsWithDealFlags(conversations);
      } catch (enrichErr) {
        core.logWarn(' Failed to enrich conversations with deal flags (non-fatal):', enrichErr);
      }
      
      return res.status(200).json({ success: true, data: conversations });
    }

    // POST - Create or update conversation
    if (req.method === 'POST') {
      const conversationData = { ...(req.body || {}) } as Record<string, unknown>;
      
      if (!conversationData.id) {
        return res.status(400).json({ success: false, reason: 'Conversation ID is required' });
      }

      // Check if conversation exists (by client id / metadata alias, uuid, or vehicle + customer)
      let existing = await core.conversationService.findById(String(conversationData.id));
      if (!existing && conversationData.vehicleId != null && conversationData.customerId) {
        existing = await core.conversationService.findByVehicleAndCustomer(
          String(conversationData.vehicleId),
          String(conversationData.customerId).toLowerCase().trim(),
        );
      }
      if (existing) {
        // Authorize against the stored participants, never the request body.
        const storedCustomer = String(existing.customerId || '').toLowerCase().trim();
        const storedSeller = String(existing.sellerId || '').toLowerCase().trim();
        if (!isAdmin && !isAuthParticipant(storedCustomer) && !isAuthParticipant(storedSeller)) {
          return res.status(403).json({ success: false, reason: 'Unauthorized conversation update' });
        }
        const updates = isAdmin
          ? conversationData
          : restrictParticipantConversationUpdate(existing, conversationData);
        await core.conversationService.update(existing.id, updates);
        const updated = await core.conversationService.findById(existing.id);
        return res.status(200).json({ success: true, data: updated });
      } else {
        // New threads: bind customer to the authenticated buyer; seller from the listing — never trust body roles.
        if (!isAdmin) {
          if (!normalizedAuthEmail && !normalizedAuthUserId) {
            return res.status(401).json({ success: false, reason: 'Authentication required' });
          }
          const customerKey = normalizedAuthEmail || normalizedAuthUserId;
          conversationData.customerId = customerKey;

          let sellerFromListing = '';
          if (conversationData.vehicleId != null) {
            try {
              const mutation = await core.resolveVehicleForMutation({
                vehicleId: conversationData.vehicleId,
                databaseId: conversationData.vehicleDatabaseId,
              });
              if (mutation.ok) {
                sellerFromListing = String(mutation.vehicle.sellerEmail || '').toLowerCase().trim();
              }
            } catch {
              /* fall through */
            }
          }
          if (!sellerFromListing) {
            return res.status(400).json({
              success: false,
              reason: 'A valid vehicle listing is required to start a conversation.',
            });
          }
          conversationData.sellerId = sellerFromListing;
          conversationData.messages = [];
        }

        const normalizedCustomerId = String(conversationData.customerId || '').toLowerCase().trim();
        const normalizedSellerId = String(conversationData.sellerId || '').toLowerCase().trim();
        if (!isAdmin && !isAuthParticipant(normalizedCustomerId) && !isAuthParticipant(normalizedSellerId)) {
          return res.status(403).json({ success: false, reason: 'Unauthorized conversation update' });
        }

        const conversation = await core.conversationService.create(conversationData as never);

        if (conversationData.vehicleId != null) {
          try {
            const mutation = await core.resolveVehicleForMutation({
              vehicleId: conversationData.vehicleId,
              databaseId: conversationData.vehicleDatabaseId,
            });
            if (mutation.ok) {
              const currentInquiries =
                typeof mutation.vehicle.inquiriesCount === 'number' ? mutation.vehicle.inquiriesCount : 0;
              // Optimistic lock: only bump if count is unchanged (avoids lost updates under concurrency).
              const supabase = core.getSupabaseAdminClient();
              const { error: incErr } = await supabase
                .from('vehicles')
                .update({ inquiries_count: currentInquiries + 1 })
                .eq('id', mutation.primaryKey)
                .eq('inquiries_count', currentInquiries);
              if (incErr) {
                await core.vehicleService.update(mutation.primaryKey, {
                  inquiriesCount: currentInquiries + 1,
                });
              }
            }
          } catch (inquiryError) {
            core.logWarn('Failed to increment inquiry count (non-fatal):', inquiryError);
          }
        }

        return res.status(200).json({ success: true, data: conversation });
      }
    }

    // PUT - Update conversation (add message or offer response)
    if (req.method === 'PUT') {
      const body = req.body as {
        conversationId?: string;
        message?: any;
      };
      const { conversationId, message } = body;

      if (!conversationId) {
        return res.status(400).json({ success: false, reason: 'Conversation ID is required' });
      }

      const conversation = await core.conversationService.findById(String(conversationId));

      if (!conversation) {
        return res.status(404).json({ success: false, reason: 'Conversation not found' });
      }

      const normalizedCustomerId = String(conversation.customerId || '').toLowerCase().trim();
      const normalizedSellerId = String(conversation.sellerId || '').toLowerCase().trim();
      if (!isAdmin && !isAuthParticipant(normalizedCustomerId) && !isAuthParticipant(normalizedSellerId)) {
        return res.status(403).json({ success: false, reason: 'Unauthorized conversation update' });
      }

      if (!message || typeof message !== 'object') {
        return res.status(400).json({ success: false, reason: 'Conversation ID and message are required' });
      }

      // Sender/id/type/timestamp are server-authored — never trust the client for these.
      if (isAuthParticipant(normalizedCustomerId)) {
        message.sender = 'user';
      } else if (isAuthParticipant(normalizedSellerId)) {
        message.sender = 'seller';
      } else {
        message.sender = 'system';
      }
      message.id = newEntityId('msg');
      message.timestamp = new Date().toISOString();
      if (typeof message.type !== 'string' || !message.type.trim()) {
        message.type = 'text';
      } else {
        message.type = String(message.type).slice(0, 64);
      }
      if (message.payload != null && typeof message.payload !== 'object') {
        delete message.payload;
      }

      if (typeof message.text === 'string') {
        message.text = await core.sanitizeString(message.text.slice(0, 4000));
      }

      try {
        core.logInfo('API: Adding message to conversation:', { conversationId, messageId: message?.id });
        await core.conversationService.addMessage(String(conversationId), message);
        const updatedConversation = await core.conversationService.findById(String(conversationId));
        
        if (!updatedConversation) {
          console.error('API: Conversation not found after adding message:', conversationId);
          return res.status(500).json({ success: false, reason: 'Failed to retrieve updated conversation' });
        }
        
        // Create notification for the recipient (other party) so they get notified even when app is closed
        const actingAsCustomer = isAuthParticipant(normalizedCustomerId);
        const recipientEmail = actingAsCustomer
          ? String(updatedConversation.sellerId || normalizedSellerId)
          : String(updatedConversation.customerId || normalizedCustomerId);
        const senderName = actingAsCustomer
          ? (conversation.customerName || 'Customer')
          : (conversation.sellerName || 'Seller');
        const messageText = typeof message.text === 'string' ? message.text : '';
        await insertConversationMessageNotification({
          recipientEmail,
          senderName,
          messageText,
          conversationId: String(updatedConversation.id || conversationId),
        });

        // Fire-and-forget email notification to the seller for new customer inquiries.
        // We only email sellers (not customer replies) to avoid noise, and skip if the
        // sender is the seller themselves. Errors never block the API response.
        try {
          const sellerRecipientEmail = String(updatedConversation.sellerId || normalizedSellerId)
            .toLowerCase()
            .trim();
          const isSellerRecipient =
            actingAsCustomer && sellerRecipientEmail && recipientEmail.toLowerCase().trim() === sellerRecipientEmail;
          if (isSellerRecipient && sellerRecipientEmail) {
            const vehicleTitle = String(conversation.vehicleName || 'your listing');
            const preview = messageText.length > 140 ? `${messageText.substring(0, 140)}…` : messageText;
            void core.sendInquiryNotificationToSeller(
              sellerRecipientEmail,
              senderName || 'A buyer',
              vehicleTitle,
              preview || '(new message)',
            ).catch((mailErr) => {
              console.warn('API: inquiry email failed (non-fatal):', mailErr);
            });

            const msgType = typeof message.type === 'string' ? message.type : 'text';
            const payload = message.payload && typeof message.payload === 'object' ? message.payload as Record<string, unknown> : {};
            void Promise.resolve(
              core.notifySellerInquiryChannels({
                sellerEmail: recipientEmail,
                buyerName: senderName || 'A buyer',
                vehicleTitle,
                messagePreview: preview || '(new message)',
                conversationId: String(conversationId),
                isTestDrive: msgType === 'test_drive_request',
                testDriveDate: typeof payload.date === 'string' ? payload.date : undefined,
                testDriveTime: typeof payload.time === 'string' ? payload.time : undefined,
              }),
            ).catch((mailErr) => {
              console.warn('API: seller inquiry alerts failed (non-fatal):', mailErr);
            });
          }
        } catch (mailErr) {
          console.warn('API: seller inquiry alerts failed (non-fatal):', mailErr);
        }

        core.logInfo('API: Message added successfully:', { conversationId, messageId: message?.id, messageCount: updatedConversation.messages?.length });
        return res.status(200).json({ success: true, data: updatedConversation });
      } catch (error) {
        console.error('API: Error adding message:', {
          conversationId,
          messageId: message?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return res.status(500).json({ 
          success: false, 
          reason: 'Failed to add message to conversation' 
        });
      }
    }

    // PATCH — mark messages read and/or clear message history (participants only)
    if (req.method === 'PATCH') {
      let body = req.body as
        | {
            conversationId?: string;
            markReadMessageIds?: (number | string)[];
            clearMessages?: boolean;
            archive?: boolean;
            threadReadBy?: 'customer' | 'seller';
            threadReadState?: boolean;
          }
        | string
        | undefined;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body) as typeof body;
        } catch {
          return res.status(400).json({ success: false, reason: 'Invalid JSON body.' });
        }
      }
      const conversationId = body && typeof body === 'object' ? body.conversationId : undefined;
      if (!conversationId) {
        return res.status(400).json({ success: false, reason: 'conversation ID is required' });
      }

      const conversation = await core.conversationService.findById(String(conversationId));
      if (!conversation) {
        return res.status(404).json({ success: false, reason: 'Conversation not found' });
      }

      const normalizedCustomerId = String(conversation.customerId || '').toLowerCase().trim();
      const normalizedSellerId = String(conversation.sellerId || '').toLowerCase().trim();
      if (!isAdmin && !isAuthParticipant(normalizedCustomerId) && !isAuthParticipant(normalizedSellerId)) {
        return res.status(403).json({ success: false, reason: 'Unauthorized conversation update' });
      }

      const markIds =
        body && typeof body === 'object' && Array.isArray(body.markReadMessageIds)
          ? body.markReadMessageIds
          : [];
      const doClear = Boolean(body && typeof body === 'object' && body.clearMessages);
      const hasArchiveFlag = body && typeof body === 'object' && typeof body.archive === 'boolean';
      const archiveState = hasArchiveFlag ? Boolean((body as { archive?: boolean }).archive) : undefined;
      const threadReadBy =
        body &&
        typeof body === 'object' &&
        (body.threadReadBy === 'customer' || body.threadReadBy === 'seller')
          ? body.threadReadBy
          : undefined;
      const hasThreadReadState = body && typeof body === 'object' && typeof body.threadReadState === 'boolean';
      const threadReadState = hasThreadReadState ? Boolean((body as { threadReadState?: boolean }).threadReadState) : undefined;

      try {
        if (doClear) {
          const clearedAsCustomer = isAuthParticipant(normalizedCustomerId);
          const clearedAsSeller = isAuthParticipant(normalizedSellerId);
          if (!clearedAsCustomer && !clearedAsSeller && !isAdmin) {
            return res.status(403).json({ success: false, reason: 'Unauthorized conversation update' });
          }
          const role: 'customer' | 'seller' = clearedAsCustomer ? 'customer' : 'seller';
          await core.conversationService.clearHistoryForParticipant(String(conversation.id), role);
        } else if (hasArchiveFlag) {
          const archivedAsCustomer = isAuthParticipant(normalizedCustomerId);
          const archivedAsSeller = isAuthParticipant(normalizedSellerId);
          if (!archivedAsCustomer && !archivedAsSeller && !isAdmin) {
            return res.status(403).json({ success: false, reason: 'Unauthorized conversation update' });
          }
          const role: 'customer' | 'seller' = archivedAsCustomer ? 'customer' : 'seller';
          await core.conversationService.setArchivedForParticipant(
            String(conversation.id),
            role,
            archiveState!,
          );
        } else if (threadReadBy && hasThreadReadState) {
          if (!isAdmin) {
            const canUpdateCustomerReadState = isAuthParticipant(normalizedCustomerId);
            const canUpdateSellerReadState = isAuthParticipant(normalizedSellerId);
            const isAuthorizedForRequestedReadState =
              (threadReadBy === 'customer' && canUpdateCustomerReadState) ||
              (threadReadBy === 'seller' && canUpdateSellerReadState);
            if (!isAuthorizedForRequestedReadState) {
              return res.status(403).json({ success: false, reason: 'Unauthorized read-state update' });
            }
          }
          await core.conversationService.update(String(conversation.id), {
            isReadBySeller: threadReadBy === 'seller' ? threadReadState : conversation.isReadBySeller,
            isReadByCustomer: threadReadBy === 'customer' ? threadReadState : conversation.isReadByCustomer,
          });
        } else if (markIds.length > 0) {
          await core.conversationService.markMessagesRead(String(conversation.id), markIds);
        } else {
          return res.status(400).json({
            success: false,
            reason: 'Provide clearMessages, archive, markReadMessageIds, or threadReadBy/threadReadState.',
          });
        }
        const updatedConversation = await core.conversationService.findById(String(conversation.id));
        if (!updatedConversation) {
          return res.status(500).json({ success: false, reason: 'Failed to load conversation after update' });
        }
        return res.status(200).json({ success: true, data: updatedConversation });
      } catch (error) {
        console.error(' API: PATCH conversation error:', error);
        return res.status(500).json({
          success: false,
          reason: error instanceof Error ? error.message : 'Failed to update conversation',
        });
      }
    }

    // DELETE - Delete conversation
    if (req.method === 'DELETE') {
      const { conversationId } = req.query;
      
      if (!conversationId) {
        return res.status(400).json({ success: false, reason: 'Conversation ID is required' });
      }

      const conversation = await core.conversationService.findById(String(conversationId));
      if (!conversation) {
        return res.status(404).json({ success: false, reason: 'Conversation not found' });
      }

      const normalizedCustomerId = String(conversation.customerId || '').toLowerCase().trim();
      const normalizedSellerId = String(conversation.sellerId || '').toLowerCase().trim();
      if (!isAdmin && !isAuthParticipant(normalizedCustomerId) && !isAuthParticipant(normalizedSellerId)) {
        return res.status(403).json({ success: false, reason: 'Unauthorized conversation deletion' });
      }

      const { getDealForConversation } = await import('../handlers/conversation-lifecycle.js');
      const linkedDeal = await getDealForConversation(String(conversation.id));
      if (linkedDeal) {
        return res.status(403).json({
          success: false,
          reason: 'deal_exists',
          message:
            'This conversation is part of a deal record and cannot be deleted. Archive it to hide it from your inbox instead.',
          action: 'archive',
          dealStatus: linkedDeal.status,
        });
      }

      await core.conversationService.delete(conversation.id);
      return res.status(200).json({ success: true, message: 'Conversation deleted successfully' });
    }

    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  } catch (error) {
    // Enhanced error logging with context
    const errorDetails: any = {
      message: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error,
      requestMethod: req.method,
      requestUrl: req.url,
      queryParams: req.query,
    };
    
    if (error instanceof Error) {
      errorDetails.stack = error.stack;
      errorDetails.name = error.name;
    } else if (error && typeof error === 'object') {
      // Try to serialize the error object
      try {
        const errorObj = error as Record<string, any>;
        if (Object.keys(errorObj).length > 0) {
          errorDetails.errorObject = errorObj;
        } else {
          errorDetails.note = 'Error object is empty';
        }
      } catch (e) {
        errorDetails.serializationError = 'Failed to serialize error object';
      }
    } else {
      errorDetails.rawValue = String(error);
    }
    
    core.logError('Conversations Handler Error:', errorDetails);
    
    // Check if it's a database connection error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('FIREBASE') || errorMessage.includes('Firebase') || errorMessage.includes('connect')) {
      return res.status(503).json({
        success: false,
        reason: 'Database is currently unavailable. Please try again later.',
        fallback: true
      });
    }
    
    return res.status(500).json({
      success: false,
      reason: 'Failed to process conversation request',
      error: errorMessage
    });
  }
}

// Notifications Handler
async function handleNotifications(req: VercelRequest, res: VercelResponse, _options: core.HandlerOptions) {
  try {
    if (!core.USE_SUPABASE) {
      return res.status(503).json({
        success: false,
        reason: 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      });
    }

    // CRITICAL FIX: Make authentication optional for GET requests
    // If no auth token, return empty array instead of 401 (user might not be logged in yet)
    let auth: core.AuthResult | null = null;
    let normalizedAuthEmail = '';
    let normalizedAuthUserId = '';
    let isAdmin = false;
    
    if (req.method === 'GET') {
      // Try to authenticate with either legacy app JWT or a Supabase access token,
      // but don't fail if no token (preserves existing "return empty for unauthed" UX).
      auth = await core.authenticateRequestDual(req);
      if (auth.isValid && auth.user) {
        normalizedAuthEmail = core.normalizeAuthActorEmail(auth);
        normalizedAuthUserId = auth.user.userId ? String(auth.user.userId).toLowerCase().trim() : '';
        isAdmin = auth.user.role === 'admin';
      }
      // If auth fails, continue with empty auth (will return empty array for non-admin)
    } else {
      // POST/PUT/DELETE require authentication via either legacy JWT or Supabase token.
      // This keeps notification updates (e.g. mark-as-read) working for OAuth sessions.
      auth = await core.authenticateRequestDual(req);
      if (!auth.isValid || !auth.user) {
        return res.status(401).json({
          success: false,
          reason: auth.error || 'Authentication required.',
          error: 'Invalid or expired authentication token',
        });
      }
      normalizedAuthEmail = core.normalizeAuthActorEmail(auth);
      normalizedAuthUserId = auth.user.userId ? String(auth.user.userId).toLowerCase().trim() : '';
      isAdmin = auth.user.role === 'admin';
    }

    // GET - Retrieve notifications
    if (req.method === 'GET') {
      const { recipientEmail, isRead, notificationId } = req.query;
      
      if (notificationId) {
        // Get single notification from Supabase
        // If not authenticated, return 404 (don't reveal notification exists)
        if (!auth || !auth.isValid) {
          return res.status(404).json({ success: false, reason: 'Notification not found' });
        }
        
        const supabase = core.getSupabaseAdminClient();
        const { data: notification, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('id', String(notificationId))
          .single();
        
        if (error || !notification) {
          return res.status(404).json({ success: false, reason: 'Notification not found' });
        }
        
        const recipient = (notification.recipient_email || notification.user_id || '').toString().toLowerCase().trim();
        if (
          !isAdmin &&
          recipient &&
          !core.participantIdMatchesAppUser(recipient, normalizedAuthEmail, normalizedAuthUserId)
        ) {
          return res.status(403).json({ success: false, reason: 'Unauthorized access to notification' });
        }
        return res.status(200).json({ success: true, data: notification });
      }
      
      if (!auth || !auth.isValid) {
        return res.status(200).json({ success: true, data: [] });
      }

      const supabase = core.getSupabaseAdminClient();
      let query = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(200);

      if (recipientEmail) {
        const emailValue = Array.isArray(recipientEmail) ? recipientEmail[0] : recipientEmail;
        const normalizedEmail = String(emailValue).toLowerCase().trim();
        if (
          !isAdmin &&
          !core.participantIdMatchesAppUser(normalizedEmail, normalizedAuthEmail, normalizedAuthUserId)
        ) {
          return res.status(200).json({ success: true, data: [] });
        }
        query = query.eq('recipient_email', normalizedEmail);
      } else if (!isAdmin) {
        if (normalizedAuthEmail) {
          query = query.eq('recipient_email', normalizedAuthEmail);
        } else if (normalizedAuthUserId) {
          query = query.eq('user_id', normalizedAuthUserId);
        } else {
          return res.status(200).json({ success: true, data: [] });
        }
      }

      if (isRead !== undefined) {
        const isReadValue = Array.isArray(isRead) ? isRead[0] : isRead;
        const isReadBool = isReadValue === 'true';
        query = query.eq('is_read', isReadBool);
      }

      const { data: allNotifications, error: fetchError } = await query;
      if (fetchError) {
        core.logError('Failed to fetch notifications:', fetchError);
        return res.status(500).json({ success: false, reason: 'Failed to fetch notifications' });
      }

      const notifications = (allNotifications || []).map((notif: Record<string, unknown>) => ({
        ...notif,
        id: notif.id,
        recipientEmail: notif.recipient_email || notif.user_id,
        isRead: Boolean(notif.read || notif.is_read),
        read: Boolean(notif.read || notif.is_read),
      }));

      return res.status(200).json({ success: true, data: notifications });
    }

    // POST - Create notification
    if (req.method === 'POST') {
      const notificationData = req.body;
      
      if (!notificationData.id || !notificationData.recipientEmail) {
        return res.status(400).json({ success: false, reason: 'Notification ID and recipient email are required' });
      }

      // Normalize email
      const normalizedEmail = notificationData.recipientEmail.toLowerCase().trim();
      if (!isAdmin && normalizedEmail !== normalizedAuthEmail) {
        return res.status(403).json({ success: false, reason: 'Unauthorized notification creation' });
      }
      
      // Create notification in Supabase
      const supabase = core.getSupabaseAdminClient();
      const { data: userRow } = await supabase.from('users').select('id').eq('email', normalizedEmail).maybeSingle();
      const numericId = Number(notificationData.id);
      const notificationRecord: Record<string, unknown> = {
        user_id: userRow?.id ? String(userRow.id) : null,
        recipient_email: normalizedEmail,
        type: notificationData.targetType || 'general',
        title: notificationData.title || notificationData.message?.substring(0, 50) || 'Notification',
        message: notificationData.message || '',
        read: notificationData.isRead || false,
        is_read: notificationData.isRead || false,
        created_at: new Date().toISOString(),
        metadata: notificationData,
      };
      if (Number.isSafeInteger(numericId) && numericId > 0) notificationRecord.id = numericId;
      
      const { data: created, error: createError } = await supabase
        .from('notifications')
        .insert(notificationRecord)
        .select()
        .single();
      
      if (createError) {
        core.logError(' Failed to create notification:', createError);
        return res.status(500).json({ success: false, reason: 'Failed to create notification' });
      }
      
      return res.status(201).json({ success: true, data: created });
    }

    // PUT - Update notification (mark as read, etc.)
    if (req.method === 'PUT') {
      const body = (req.body || {}) as { notificationId?: unknown; updates?: Record<string, unknown> };
      const { notificationId, updates } = body;
      
      if (!notificationId) {
        return res.status(400).json({ success: false, reason: 'Notification ID is required' });
      }
      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ success: false, reason: 'updates object is required' });
      }

      // Get existing notification from Supabase
      const supabase = core.getSupabaseAdminClient();
      const { data: existing, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', String(notificationId))
        .single();
      
      if (fetchError || !existing) {
        return res.status(404).json({ success: false, reason: 'Notification not found' });
      }
      
      const recipient = (existing.recipient_email || existing.user_id || '').toString().toLowerCase().trim();
      if (
        !isAdmin &&
        (!recipient ||
          !core.participantIdMatchesAppUser(recipient, normalizedAuthEmail, normalizedAuthUserId))
      ) {
        return res.status(403).json({ success: false, reason: 'Unauthorized notification update' });
      }

      // Update notification in Supabase
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString()
      };
      
      // Keep read + is_read in sync — GET maps both columns.
      if (updates.isRead !== undefined || updates.read !== undefined) {
        const readVal = Boolean(updates.isRead ?? updates.read);
        updateData.read = readVal;
        updateData.is_read = readVal;
      }
      if (updates.message !== undefined) updateData.message = updates.message;
      if (updates.title !== undefined) updateData.title = updates.title;
      
      const { data: updated, error: updateError } = await supabase
        .from('notifications')
        .update(updateData)
        .eq('id', String(notificationId))
        .select()
        .single();
      
      if (updateError) {
        core.logError('Failed to update notification:', updateError);
        return res.status(500).json({ success: false, reason: 'Failed to update notification' });
      }
      
      return res.status(200).json({ success: true, data: updated });
    }

    // DELETE - Delete notification
    if (req.method === 'DELETE') {
      const { notificationId } = req.query;
      
      if (!notificationId) {
        return res.status(400).json({ success: false, reason: 'Notification ID is required' });
      }
      // Get existing notification from Supabase
      const supabase = core.getSupabaseAdminClient();
      const { data: existing, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', String(notificationId))
        .single();
      
      if (fetchError || !existing) {
        return res.status(404).json({ success: false, reason: 'Notification not found' });
      }
      
      const recipient = (existing.recipient_email || existing.user_id || '').toString().toLowerCase().trim();
      if (
        !isAdmin &&
        (!recipient ||
          !core.participantIdMatchesAppUser(recipient, normalizedAuthEmail, normalizedAuthUserId))
      ) {
        return res.status(403).json({ success: false, reason: 'Unauthorized notification deletion' });
      }

      // Delete notification from Supabase
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', String(notificationId));
      
      if (deleteError) {
        core.logError('Failed to delete notification:', deleteError);
        return res.status(500).json({ success: false, reason: 'Failed to delete notification' });
      }
      
      return res.status(200).json({ success: true, message: 'Notification deleted successfully' });
    }

    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  } catch (error) {
    // Enhanced error logging with context
    const errorDetails: any = {
      message: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error,
      requestMethod: req.method,
      requestUrl: req.url,
      queryParams: req.query,
    };
    
    if (error instanceof Error) {
      errorDetails.stack = error.stack;
      errorDetails.name = error.name;
    } else if (error && typeof error === 'object') {
      // Try to serialize the error object
      try {
        const errorObj = error as Record<string, any>;
        if (Object.keys(errorObj).length > 0) {
          errorDetails.errorObject = errorObj;
        } else {
          errorDetails.note = 'Error object is empty';
        }
      } catch (e) {
        errorDetails.serializationError = 'Failed to serialize error object';
      }
    } else {
      errorDetails.rawValue = String(error);
    }
    
    core.logError('Notifications Handler Error:', errorDetails);
    
    // Check if it's a database connection error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('FIREBASE') || errorMessage.includes('Firebase') || errorMessage.includes('connect')) {
      return res.status(503).json({
        success: false,
        reason: 'Database is currently unavailable. Please try again later.',
        fallback: true
      });
    }
    
    return res.status(500).json({
      success: false,
      reason: 'Failed to process notification request',
      error: errorMessage
    });
  }
}

// Buyer Activity Handler
async function handleContentReports(
  req: VercelRequest,
  res: VercelResponse,
  _options: core.HandlerOptions,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'Method not allowed' });
  }
  const auth = await core.authenticateRequestDual(req);
  if (!auth.isValid || !auth.user?.email) {
    return res.status(401).json({ success: false, reason: 'Authentication required.' });
  }
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const reportedBy = auth.user.email.toLowerCase().trim();
    const targetType =
      typeof body.targetType === 'string' ? body.targetType.slice(0, 64) : '';
    const targetId =
      body.targetId != null ? String(body.targetId).slice(0, 255) : '';
    const reason =
      typeof body.reason === 'string' ? body.reason.slice(0, 2000) : '';
    if (!targetType || !targetId) {
      return res.status(400).json({
        success: false,
        reason: 'targetType and targetId are required',
      });
    }

    core.logSecurity('content-report', {
      reportedBy,
      targetType,
      targetId,
      reason: reason || undefined,
    });

    if (core.USE_SUPABASE) {
      const supabase = core.getSupabaseAdminClient();
      const { error } = await supabase.from('audit_log').insert({
        id: Date.now() * 1000 + randomBytes(2).readUInt16BE(0),
        timestamp: new Date().toISOString(),
        actor: reportedBy,
        action: 'content-report',
        target: `${targetType}:${targetId}`,
        details: reason || null,
      });
      if (error) {
        core.logError('content-report audit_log insert failed:', error);
        return res.status(500).json({ success: false, reason: 'Failed to record content report.' });
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    core.logError('handleContentReports error:', error);
    return res.status(500).json({ success: false, reason: 'Failed to record content report.' });
  }
}

// Plans Handler
async function handlePlans(req: VercelRequest, res: VercelResponse, _options: core.HandlerOptions) {
  try {
    if (!core.USE_SUPABASE) {
      return res.status(503).json({
        success: false,
        reason: 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      });
    }
    const plansPath = 'plans';
    const basePlanOrder = ['free', 'pro', 'premium'];
    const toNumber = (value: unknown, fallback: number): number => {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    };

    const toListingLimit = (value: unknown, fallback: number | 'unlimited'): number | 'unlimited' => {
      if (value === 'unlimited' || String(value).toLowerCase() === 'unlimited') {
        return 'unlimited';
      }
      const n = Number(value);
      // Stored 0 or invalid should not override catalog defaults (fixes "1 / 0" on dashboard).
      if (Number.isFinite(n) && n > 0) return n;
      return fallback;
    };

    const toDurationDays = (value: unknown, fallback: number): number => {
      const n = Number(value);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
    };

    const toPlanDetails = (id: string, row: Record<string, unknown>) => {
      const basePlan = core.PLAN_DETAILS[id as keyof typeof core.PLAN_DETAILS];
      const metadata = (row.metadata as Record<string, unknown> | undefined) || {};
      return {
        id,
        name: String(row.name || basePlan?.name || 'Custom Plan'),
        price: toNumber(row.price, basePlan?.price ?? 0),
        durationDays: toDurationDays(
          row.duration_days ?? row.durationDays ?? metadata.durationDays,
          basePlan?.durationDays ?? 30,
        ),
        // Prefer DB features when set so admin Plan Management edits reach seller dashboards.
        features:
          Array.isArray(row.features) && row.features.length > 0
            ? row.features.map(String)
            : (basePlan?.features || []),
        listingLimit: toListingLimit(row.listingLimit ?? metadata.listingLimit, basePlan?.listingLimit ?? 0),
        featuredCredits: toNumber(row.featuredCredits ?? metadata.featuredCredits, basePlan?.featuredCredits ?? 0),
        freeCertifications: toNumber(row.freeCertifications ?? metadata.freeCertifications, basePlan?.freeCertifications ?? 0),
        isMostPopular: Boolean(row.isMostPopular ?? metadata.isMostPopular ?? basePlan?.isMostPopular ?? false),
      };
    };

    switch (req.method) {
      case 'GET': {
        const allRows = await core.adminReadAll<Record<string, unknown>>(plansPath);
        const fromDb = Object.entries(allRows).map(([id, row]) => toPlanDetails(id, row));
        const presentIds = new Set(fromDb.map((plan) => String(plan.id)));

        // Ensure base plans always exist in response
        const basePlans = Object.entries(core.PLAN_DETAILS)
          .filter(([id]) => !presentIds.has(id))
          .map(([id, plan]) => ({
            id,
            name: plan.name,
            price: plan.price,
            durationDays: plan.durationDays ?? 30,
            features: plan.features,
            listingLimit: plan.listingLimit,
            featuredCredits: plan.featuredCredits,
            freeCertifications: plan.freeCertifications,
            isMostPopular: Boolean(plan.isMostPopular),
          }));

        const plans = [...fromDb, ...basePlans].sort((a, b) => {
          const aIndex = basePlanOrder.indexOf(String(a.id));
          const bIndex = basePlanOrder.indexOf(String(b.id));
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          return String(a.name).localeCompare(String(b.name));
        });

        return res.status(200).json(plans);
      }

      case 'POST': {
        if (!(await core.requireAdmin(req, res, 'Create plan'))) {
          return;
        }
        const newPlanData = req.body || {};
        if (!newPlanData.name) {
          return res.status(400).json({ error: 'Plan name is required' });
        }

        const planId = String(newPlanData.id || newEntityId('custom'));
        const record = {
          id: planId,
          name: String(newPlanData.name),
          price: toNumber(newPlanData.price, 0),
          duration_days: toDurationDays(newPlanData.durationDays ?? newPlanData.duration_days, 30),
          features: Array.isArray(newPlanData.features) ? newPlanData.features : [],
          listingLimit: toNumber(newPlanData.listingLimit, 0),
          featuredCredits: toNumber(newPlanData.featuredCredits, 0),
          freeCertifications: toNumber(newPlanData.freeCertifications, 0),
          isMostPopular: Boolean(newPlanData.isMostPopular),
          isCustom: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await core.adminCreate(plansPath, record, planId);
        core.invalidateSellerPlanCache();
        return res.status(201).json(toPlanDetails(planId, record));
      }

      case 'PUT': {
        if (!(await core.requireAdmin(req, res, 'Update plan'))) {
          return;
        }
        const { planId: updatePlanId, ...updateData } = req.body || {};
        if (!updatePlanId || typeof updatePlanId !== 'string') {
          return res.status(400).json({ error: 'Plan ID is required' });
        }

        const existing = await core.adminRead<Record<string, unknown>>(plansPath, updatePlanId);
        const basePlan = core.PLAN_DETAILS[updatePlanId as keyof typeof core.PLAN_DETAILS];
        const nextFeatures = Array.isArray(updateData.features)
          ? updateData.features
          : (Array.isArray(existing?.features)
            ? existing.features
            : (basePlan?.features || []));
        const merged = {
          ...(existing || {}),
          id: updatePlanId,
          name: String(updateData.name ?? existing?.name ?? basePlan?.name ?? 'Plan'),
          price: toNumber(updateData.price ?? existing?.price, basePlan?.price ?? 0),
          duration_days: toDurationDays(
            updateData.durationDays ?? updateData.duration_days ?? existing?.duration_days ?? existing?.durationDays,
            basePlan?.durationDays ?? 30,
          ),
          features: nextFeatures,
          listingLimit: toListingLimit(updateData.listingLimit ?? existing?.listingLimit, basePlan?.listingLimit ?? 0),
          featuredCredits: toNumber(updateData.featuredCredits ?? existing?.featuredCredits, basePlan?.featuredCredits ?? 0),
          freeCertifications: toNumber(updateData.freeCertifications ?? existing?.freeCertifications, basePlan?.freeCertifications ?? 0),
          isMostPopular: Boolean(updateData.isMostPopular ?? existing?.isMostPopular ?? basePlan?.isMostPopular ?? false),
          isCustom: !basePlan,
          updatedAt: new Date().toISOString(),
        };

        if (existing) {
          await core.adminUpdate(plansPath, updatePlanId, merged);
        } else {
          await core.adminCreate(plansPath, { ...merged, createdAt: new Date().toISOString() }, updatePlanId);
        }

        core.invalidateSellerPlanCache();
        return res.status(200).json(toPlanDetails(updatePlanId, merged));
      }

      case 'DELETE': {
        if (!(await core.requireAdmin(req, res, 'Delete plan'))) {
          return;
        }
        const { planId: deletePlanId } = req.query;
        if (!deletePlanId || typeof deletePlanId !== 'string') {
          return res.status(400).json({ error: 'Plan ID is required' });
        }
        if (['free', 'pro', 'premium'].includes(deletePlanId)) {
          return res.status(400).json({ error: 'Cannot delete base plans' });
        }

        await core.adminDelete(plansPath, deletePlanId);
        core.invalidateSellerPlanCache();
        return res.status(200).json({ success: true, message: 'Plan deleted successfully' });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Plans Handler Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to process plans request',
    });
  }
}

// Export with error wrapper to catch any initialization or module loading errors

export {
  handleAI,
  handleContent,
  handlePlatformSettings,
  handleAuditLog,
  handleBusiness,
  handleConversations,
  handleNotifications,
  handleContentReports,
};
