/**
 * api/handlers/sell-car.ts — Sell car submission handler
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { USE_SUPABASE, adminRead, adminReadAll, adminCreate, adminUpdate, adminDelete, HandlerOptions, sanitizeObject, sanitizeString } from './shared';

export async function handleSellCar(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  if (!USE_SUPABASE) {
    return res.status(503).json({ success: false, reason: 'Database not configured.' });
  }

  const path = 'sell_car_submissions';
  const { method } = req;

  try {
    switch (method) {
      case 'POST': {
        const data = { ...req.body, submittedAt: new Date().toISOString(), status: 'pending' };
        const required = ['registration', 'make', 'model', 'variant', 'year', 'district', 'noOfOwners', 'kilometers', 'fuelType', 'transmission', 'customerContact'];
        const missing = required.filter(f => !data[f as keyof typeof data]);
        if (missing.length) return res.status(400).json({ error: `Missing: ${missing.join(', ')}` });

        const existing = await adminReadAll<Record<string, unknown>>(path);
        if (Object.values(existing).some((s: any) => s.registration === data.registration)) {
          return res.status(409).json({ error: 'Registration already submitted' });
        }

        const sanitized = await sanitizeObject(data);
        const id = `submission_${Date.now()}`;
        await adminCreate(path, sanitized, id);
        return res.status(201).json({ success: true, id, message: 'Submission received' });
      }

      case 'GET': {
        const { page = 1, limit = 10, status: sf, search } = req.query;
        const pn = parseInt(String(page), 10) || 1;
        const ln = parseInt(String(limit), 10) || 10;

        const all = await adminReadAll<Record<string, unknown>>(path);
        let items = Object.entries(all).map(([id, d]) => ({ ...d, id }));

        if (sf && typeof sf === 'string' && ['pending', 'approved', 'rejected', 'processing'].includes(sf.toLowerCase())) {
          items = items.filter((s: any) => s.status === sf);
        }
        if (search && typeof search === 'string') {
          const q = (await sanitizeString(search)).toLowerCase();
          items = items.filter((s: any) => [s.registration, s.make, s.model, s.customerContact].some(v => String(v || '').toLowerCase().includes(q)));
        }

        items.sort((a, b) => new Date(String((b as any).submittedAt ?? 0)).getTime() - new Date(String((a as any).submittedAt ?? 0)).getTime());
        const total = items.length;
        const skip = Math.max(0, (pn - 1) * ln);
        return res.status(200).json({ success: true, data: items.slice(skip, skip + ln), pagination: { page: pn, limit: ln, total, pages: Math.ceil(total / ln) } });
      }

      case 'PUT': {
        const { id, status: us, adminNotes, estimatedPrice } = req.body;
        if (!id) return res.status(400).json({ error: 'Submission ID required' });
        const existing = await adminRead<Record<string, unknown>>(path, String(id));
        if (!existing) return res.status(404).json({ error: 'Submission not found' });

        const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
        if (us && ['pending', 'approved', 'rejected', 'processing'].includes(String(us).toLowerCase())) updates.status = us;
        if (adminNotes) updates.adminNotes = await sanitizeString(String(adminNotes));
        if (typeof estimatedPrice === 'number') updates.estimatedPrice = estimatedPrice;

        await adminUpdate(path, String(id), updates);
        return res.status(200).json({ success: true, message: 'Updated' });
      }

      case 'DELETE': {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'Submission ID required' });
        await adminDelete(path, String(id));
        return res.status(200).json({ success: true, message: 'Deleted' });
      }

      default:
        res.setHeader('Allow', 'POST, GET, PUT, DELETE');
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
}

