/**
 * server/handlers/content.ts — FAQ & Support Ticket handlers
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  USE_SUPABASE, adminRead, adminReadAll, adminCreate, adminUpdate, adminDelete,
  HandlerOptions, requireAuth, sanitizeString, type AuthResult,
} from './shared';

export async function handleContent(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  if (!USE_SUPABASE) {
    if (req.method === 'GET') {
      res.setHeader('X-Data-Fallback', 'true');
      return res.status(200).json([]);
    }
    return res.status(503).json({ success: false, reason: 'Database not configured.' });
  }

  try {
    const { type } = req.query;
    switch (type) {
      case 'faqs': return await handleFAQs(req, res);
      case 'support-tickets': return await handleSupportTickets(req, res);
      default: return res.status(400).json({ success: false, error: 'Use ?type=faqs or ?type=support-tickets' });
    }
  } catch (error) {
    if (req.method === 'GET') {
      res.setHeader('X-Data-Fallback', 'true');
      return res.status(200).json([]);
    }
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

// ── FAQs ────────────────────────────────────────────────────────────────────

async function handleFAQs(req: VercelRequest, res: VercelResponse) {
  const path = 'faqs';
  switch (req.method) {
    case 'GET': {
      try {
        const { category } = req.query;
        const all = await adminReadAll<Record<string, unknown>>(path);
        let faqs = Object.entries(all).map(([id, data]) => ({ ...data, id }));
        if (category && category !== 'all' && typeof category === 'string') {
          const cat = await sanitizeString(category);
          faqs = faqs.filter(f => (f as Record<string, unknown>).category === cat);
        }
        return res.status(200).json({ success: true, faqs, count: faqs.length });
      } catch {
        res.setHeader('X-Data-Fallback', 'true');
        return res.status(200).json({ success: true, faqs: [], count: 0 });
      }
    }
    case 'POST': {
      const d = req.body;
      if (!d.question || !d.answer || !d.category) return res.status(400).json({ success: false, error: 'Missing required fields' });
      const id = `faq_${Date.now()}`;
      const faq = { ...d, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await adminCreate(path, faq, id);
      return res.status(201).json({ success: true, faq });
    }
    case 'PUT': {
      const { id } = req.query;
      if (!id) return res.status(400).json({ success: false, error: 'FAQ ID required' });
      const existing = await adminRead<Record<string, unknown>>(path, String(id));
      if (!existing) return res.status(404).json({ success: false, error: 'FAQ not found' });
      await adminUpdate(path, String(id), { ...req.body, updatedAt: new Date().toISOString() });
      return res.status(200).json({ success: true, message: 'FAQ updated' });
    }
    case 'DELETE': {
      const { id } = req.query;
      if (!id) return res.status(400).json({ success: false, error: 'FAQ ID required' });
      await adminDelete(path, String(id));
      return res.status(200).json({ success: true, message: 'FAQ deleted' });
    }
    default: return res.status(405).json({ error: 'Method not allowed' });
  }
}

// ── Support Tickets ─────────────────────────────────────────────────────────

async function handleSupportTickets(req: VercelRequest, res: VercelResponse) {
  const path = 'support_tickets';
  const auth = requireAuth(req, res, 'Support tickets');
  if (!auth) return;

  const email = auth.user?.email?.toLowerCase().trim() ?? '';
  const isAdmin = auth.user?.role === 'admin';

  switch (req.method) {
    case 'GET': {
      const { userEmail, status } = req.query;
      const all = await adminReadAll<Record<string, unknown>>(path);
      let tickets = Object.entries(all).map(([id, data]) => ({ ...data, id }));

      if (userEmail && typeof userEmail === 'string') {
        const se = (await sanitizeString(userEmail)).toLowerCase().trim();
        if (!isAdmin && email !== se) return res.status(403).json({ success: false, error: 'Unauthorized' });
        tickets = tickets.filter(t => ((t as Record<string, unknown>).userEmail as string)?.toLowerCase().trim() === se);
      } else if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
      }

      if (status && typeof status === 'string' && ['Open', 'In Progress', 'Resolved', 'Closed'].includes(status)) {
        tickets = tickets.filter(t => (t as Record<string, unknown>).status === status);
      }

      tickets.sort((a, b) => new Date(String((b as Record<string, unknown>).createdAt ?? 0)).getTime() - new Date(String((a as Record<string, unknown>).createdAt ?? 0)).getTime());
      return res.status(200).json({ success: true, tickets, count: tickets.length });
    }
    case 'POST': {
      const d = req.body;
      if (!d.userEmail || !d.userName || !d.subject || !d.message) return res.status(400).json({ success: false, error: 'Missing required fields' });
      const se = (await sanitizeString(String(d.userEmail))).toLowerCase().trim();
      if (!isAdmin && se !== email) return res.status(403).json({ success: false, error: 'Unauthorized' });
      const id = `ticket_${Date.now()}`;
      const ticket = { ...d, userEmail: isAdmin ? se : email, id, status: 'Open', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), replies: [] };
      await adminCreate(path, ticket, id);
      return res.status(201).json({ success: true, ticket });
    }
    case 'PUT': {
      const { id } = req.query;
      if (!id) return res.status(400).json({ success: false, error: 'Ticket ID required' });
      const existing = await adminRead<Record<string, unknown>>(path, String(id));
      if (!existing) return res.status(404).json({ success: false, error: 'Ticket not found' });
      const ownerEmail = ((existing as Record<string, unknown>).userEmail as string)?.toLowerCase().trim() ?? '';
      if (!isAdmin && ownerEmail !== email) return res.status(403).json({ success: false, error: 'Unauthorized' });
      const update = { ...req.body };
      if (!isAdmin) delete update.userEmail;
      await adminUpdate(path, String(id), { ...update, updatedAt: new Date().toISOString() });
      return res.status(200).json({ success: true, message: 'Ticket updated' });
    }
    case 'DELETE': {
      const { id } = req.query;
      if (!id) return res.status(400).json({ success: false, error: 'Ticket ID required' });
      const existing = await adminRead<Record<string, unknown>>(path, String(id));
      if (!existing) return res.status(404).json({ success: false, error: 'Ticket not found' });
      const ownerEmail = ((existing as Record<string, unknown>).userEmail as string)?.toLowerCase().trim() ?? '';
      if (!isAdmin && ownerEmail !== email) return res.status(403).json({ success: false, error: 'Unauthorized' });
      await adminDelete(path, String(id));
      return res.status(200).json({ success: true, message: 'Ticket deleted' });
    }
    default: return res.status(405).json({ error: 'Method not allowed' });
  }
}
