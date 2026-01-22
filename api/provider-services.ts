import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyIdTokenFromHeader } from '../server/supabase-auth.js';
import { getSupabaseAdminClient } from '../lib/supabase.js';

interface ProviderService {
  serviceType: string;
  price?: number;
  description?: string;
  etaMinutes?: number;
  active?: boolean;
}

// Using Supabase service_providers table with services stored in metadata

// verifyIdTokenFromHeader is now imported from server/supabase-auth.js

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
      const supabase = getSupabaseAdminClient();
      
      if (scope === 'mine') {
        if (!uid) return res.status(401).json({ error: 'Not authenticated' });
        
        const { data: provider, error } = await supabase
          .from('service_providers')
          .select('*')
          .eq('id', uid)
          .single();
        
        if (error || !provider) {
          return res.status(200).json([]);
        }
        
        const services = (provider.metadata?.services as Record<string, ProviderService>) || {};
        const list = Object.entries(services).map(([serviceType, payload]) => ({ serviceType, ...payload }));
        return res.status(200).json(list);
      }

      // public: return all providers and their services
      const { data: allProviders, error } = await supabase
        .from('service_providers')
        .select('id, metadata');
      
      if (error || !allProviders) {
        return res.status(200).json([]);
      }
      
      const result = allProviders.flatMap((provider) => {
        const services = (provider.metadata?.services as Record<string, ProviderService>) || {};
        return Object.entries(services).map(([serviceType, payload]) => ({
          providerId: provider.id,
          serviceType,
          ...payload,
        }));
      });
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
      
      const supabase = getSupabaseAdminClient();
      
      // Get existing provider to merge services
      const { data: existing, error: fetchError } = await supabase
        .from('service_providers')
        .select('metadata')
        .eq('id', uid)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`Failed to fetch provider: ${fetchError.message}`);
      }
      
      const currentMetadata = existing?.metadata || {};
      const currentServices = (currentMetadata.services as Record<string, ProviderService>) || {};
      const updatedServices = {
        ...currentServices,
        [serviceType]: payload,
      };
      
      // Update provider with new services in metadata
      const { error: updateError } = await supabase
        .from('service_providers')
        .update({
          metadata: {
            ...currentMetadata,
            services: updatedServices,
          },
        })
        .eq('id', uid);
      
      if (updateError) {
        throw new Error(`Failed to update provider services: ${updateError.message}`);
      }
      
      // Return updated list
      const list = Object.entries(updatedServices).map(([st, val]) => ({ serviceType: st, ...val }));
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


