import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from '../server/firebase-admin.js';
import { adminCreate, adminRead, adminUpdate } from '../server/firebase-admin-db.js';
import { DB_PATHS } from '../lib/firebase-db.js';

interface ProviderService {
  serviceType: string;
  price?: number;
  description?: string;
  etaMinutes?: number;
  active?: boolean;
}

const COLLECTION = DB_PATHS.PROVIDER_SERVICES;

async function verifyIdTokenFromHeader(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing bearer token');
  }
  const token = authHeader.replace('Bearer ', '').trim();
  return admin.auth().verifyIdToken(token);
}

function devFallbackProviderId(req: VercelRequest): string | null {
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev) return null;
  const headerId = (req.headers['x-mock-provider-id'] as string) || '';
  return headerId || 'dev-mock-provider';
}

async function resolveProviderId(req: VercelRequest, allowDevFallback = false): Promise<string> {
  try {
    const decoded = await verifyIdTokenFromHeader(req);
    return decoded.uid;
  } catch (err) {
    if (allowDevFallback) {
      const fallback = devFallbackProviderId(req);
      if (fallback) return fallback;
    }
    throw err;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const scope = (req.query.scope as string) || 'mine';
    let uid: string | null = null;

    // For GET public scope, token is optional
    if (!(req.method === 'GET' && scope === 'public')) {
      uid = await resolveProviderId(req, true);
    } else {
      try {
        const decoded = await verifyIdTokenFromHeader(req);
        uid = decoded.uid;
      } catch {
        uid = devFallbackProviderId(req);
      }
    }

    if (req.method === 'GET') {
      if (scope === 'mine') {
        if (!uid) return res.status(401).json({ error: 'Not authenticated' });
        const data = await adminRead<Record<string, ProviderService>>(COLLECTION, uid);
        const list = data ? Object.entries(data).map(([serviceType, payload]) => ({ serviceType, ...payload })) : [];
        return res.status(200).json(list);
      }

      // public: return all providers and their services
      const all = await adminRead<Record<string, Record<string, ProviderService>>>(COLLECTION);
      if (!all) return res.status(200).json([]);
      const result = Object.entries(all).flatMap(([providerId, services]) =>
        Object.entries(services || {}).map(([serviceType, payload]) => ({
          providerId,
          serviceType,
          ...payload,
        }))
      );
      return res.status(200).json(result);
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
      if (!uid) return res.status(401).json({ error: 'Not authenticated' });
      const { serviceType, price, description, etaMinutes, active = true } = req.body as Partial<ProviderService> & {
        serviceType?: string;
      };
      if (!serviceType) {
        return res.status(400).json({ error: 'Missing serviceType' });
      }
      const payload: ProviderService = {
        serviceType,
        price: price !== undefined ? Number(price) : undefined,
        description: description || '',
        etaMinutes: etaMinutes !== undefined ? Number(etaMinutes) : undefined,
        active,
      };
      // Upsert by serviceType under provider node
      await adminUpdate<Record<string, ProviderService>>(COLLECTION, uid, {
        [serviceType]: payload,
      });
      const updated = await adminRead<Record<string, ProviderService>>(COLLECTION, uid);
      const list = updated ? Object.entries(updated).map(([st, val]) => ({ serviceType: st, ...val })) : [];
      return res.status(200).json(list);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Provider services API error:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    const status = message.includes('Missing bearer token') ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}


