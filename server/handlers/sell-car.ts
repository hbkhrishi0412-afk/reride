/**
 * server/handlers/sell-car.ts — Sell car submission handler
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'crypto';
import { getSupabaseAdminClient } from '../../lib/supabase-admin.js';
import {
  USE_SUPABASE,
  adminRead,
  adminReadAll,
  adminCreate,
  adminUpdate,
  adminDelete,
  HandlerOptions,
  sanitizeObject,
  sanitizeString,
  requireAdmin,
} from '../handler-shared.js';

const MAX_SELL_CAR_IMAGES = 10;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

async function uploadSellCarImageFromDataUrl(
  dataUrl: string,
  submissionId: string,
  index: number,
): Promise<string | null> {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) return null;

  const mime = match[1].toLowerCase().split(';')[0].trim();
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowed.includes(mime)) return null;

  let buffer: Buffer;
  try {
    buffer = Buffer.from(match[2], 'base64');
  } catch {
    return null;
  }
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return null;

  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const filePath = `sell-car-submissions/${submissionId}/${index + 1}_${randomBytes(4).toString('hex')}.${ext}`;

  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.storage.from('Images').upload(filePath, buffer, {
      contentType: mime === 'image/jpg' ? 'image/jpeg' : mime,
      cacheControl: '3600',
      upsert: false,
    });
    if (error) return null;
    const { data } = supabase.storage.from('Images').getPublicUrl(filePath);
    return data.publicUrl || null;
  } catch {
    return null;
  }
}

async function normalizeVehicleImages(
  raw: unknown,
  submissionId: string,
): Promise<string[]> {
  if (!Array.isArray(raw)) return [];

  const urls: string[] = [];
  for (let i = 0; i < Math.min(raw.length, MAX_SELL_CAR_IMAGES); i++) {
    const item = raw[i];
    if (typeof item !== 'string' || !item.trim()) continue;

    if (/^https?:\/\//i.test(item)) {
      urls.push(item);
      continue;
    }

    if (item.startsWith('data:')) {
      const uploaded = await uploadSellCarImageFromDataUrl(item, submissionId, i);
      if (uploaded) urls.push(uploaded);
    }
  }
  return urls;
}

export async function handleSellCar(req: VercelRequest, res: VercelResponse, _options: HandlerOptions) {
  if (!USE_SUPABASE) {
    return res.status(503).json({ success: false, reason: 'Database not configured.' });
  }

  const path = 'sell_car_submissions';
  const { method } = req;

  try {
    if (method === 'GET' || method === 'PUT' || method === 'DELETE') {
      if (!(await requireAdmin(req, res, 'Sell car submissions'))) {
        return;
      }
    }

    switch (method) {
      case 'POST': {
        const data = { ...req.body, submittedAt: new Date().toISOString(), status: 'pending' };
        const required = ['registration', 'make', 'model', 'variant', 'year', 'state', 'district', 'noOfOwners', 'kilometers', 'fuelType', 'transmission', 'customerContact'];
        const missing = required.filter(f => !data[f as keyof typeof data]);
        if (missing.length) return res.status(400).json({ error: `Missing: ${missing.join(', ')}` });

        const existing = await adminReadAll<Record<string, unknown>>(path);
        if (Object.values(existing).some((s: any) => s.registration === data.registration)) {
          return res.status(409).json({ error: 'Registration already submitted' });
        }

        const id = `submission_${Date.now()}`;
        const vehicleImages = await normalizeVehicleImages(data.vehicleImages, id);

        const { vehicleImages: _rawImages, ...rest } = data;
        const payload = {
          ...rest,
          ...(vehicleImages.length > 0 ? { vehicleImages } : {}),
        };

        const sanitized = await sanitizeObject(payload);
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
          items = items.filter((s: any) => [s.registration, s.make, s.model, s.customerContact, s.state, s.district].some(v => String(v || '').toLowerCase().includes(q)));
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
