import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyIdTokenFromHeader } from '../server/supabase-auth.js';
import { authenticateRequest } from './auth.js';
import { getSupabaseAdminClient } from '../lib/supabase.js';
import { applyCors } from '../lib/api-route-cors.js';
import { isValidServiceType } from '../constants/serviceProviderCatalog.js';

interface ProviderService {
  serviceType: string;
  price?: number;
  description?: string;
  etaMinutes?: number;
  active?: boolean;
  updatedAt?: string;
  includedServices?: IncludedService[];
}

interface IncludedService {
  id: string;
  name: string;
  price?: number;
  etaMinutes?: number;
  active?: boolean;
}

function normalizeIncludedServices(input: unknown): IncludedService[] {
  if (!Array.isArray(input)) return [];
  const result: IncludedService[] = [];
  input.forEach((entry, idx) => {
    const raw = entry as Record<string, unknown>;
    const id = String(raw.id || '').trim() || `line-${idx + 1}`;
    const name = String(raw.name || '').trim();
    if (!name) return;
    const priceNum = raw.price != null ? Number(raw.price) : undefined;
    const etaNum = raw.etaMinutes != null ? Number(raw.etaMinutes) : undefined;
    const normalized: IncludedService = {
      id,
      name,
      active: raw.active !== false,
    };
    if (priceNum != null && Number.isFinite(priceNum)) normalized.price = priceNum;
    if (etaNum != null && Number.isFinite(etaNum)) normalized.etaMinutes = etaNum;
    result.push(normalized);
  });
  return result;
}

function normalizeProviderService(serviceType: string, payload: ProviderService): ProviderService {
  const includedServices = normalizeIncludedServices(payload.includedServices);
  const resolvedPrice =
    payload.price != null && Number.isFinite(payload.price)
      ? payload.price
      : includedServices
          .filter((line) => line.active !== false && line.price != null && Number.isFinite(line.price))
          .reduce((sum, line) => sum + (line.price || 0), 0) || undefined;
  return {
    ...payload,
    serviceType,
    price: resolvedPrice,
    includedServices,
  };
}

function toPublicProviderService(serviceType: string, payload: ProviderService) {
  const normalized = normalizeProviderService(serviceType, payload);
  return {
    serviceType,
    price: normalized.price,
    description: normalized.description,
    etaMinutes: normalized.etaMinutes,
    active: normalized.active,
    updatedAt: normalized.updatedAt,
    includedServices: normalized.includedServices,
  };
}

// Using Supabase service_providers table with services stored in metadata

// verifyIdTokenFromHeader is now imported from server/supabase-auth.js

function devFallbackProviderId(req: VercelRequest): string | null {
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev) return null;
  const headerId = (req.headers['x-mock-provider-id'] as string) || '';
  return headerId || 'dev-mock-provider';
}

/**
 * Same order as service-requests / getBrowserAccessTokenForApi: legacy app JWT first,
 * then Supabase session JWT. Provider routes previously only called verifyIdTokenFromHeader,
 * so users with a valid reRide access token always got "Invalid or expired token" from getUser().
 */
async function resolveProviderId(req: VercelRequest, allowDevFallback = false): Promise<string> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ') || authHeader.substring(7).trim() === '') {
      throw new Error('Missing bearer token');
    }

    const legacy = authenticateRequest(req);
    if (legacy.isValid && legacy.user?.userId) {
      return legacy.user.userId;
    }

    try {
      const decoded = await verifyIdTokenFromHeader(req);
      return decoded.uid;
    } catch (supabaseErr) {
      const supMsg = supabaseErr instanceof Error ? supabaseErr.message : String(supabaseErr);
      const legMsg = legacy.error;
      const legacyFormatMismatch = !legacy.isValid && legMsg === 'Invalid token format';
      if (legMsg && supMsg && legMsg !== supMsg && !legacyFormatMismatch) {
        throw new Error(`Authentication failed: ${legMsg} | ${supMsg}`);
      }
      throw new Error(supMsg || legMsg || 'Authentication required');
    }
  } catch (err) {
    if (allowDevFallback) {
      const fallback = devFallbackProviderId(req);
      if (fallback) return fallback;
    }
    throw err;
  }
}

export async function handleProviderServices(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  try {
    const scope = (req.query.scope as string) || 'mine';
    let uid: string | null = null;

    // For GET public scope, token is optional
    if (!(req.method === 'GET' && scope === 'public')) {
      uid = await resolveProviderId(req, true);
    } else {
      try {
        uid = await resolveProviderId(req, false);
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
        const list = Object.entries(services).map(([serviceType, payload]) => toPublicProviderService(serviceType, payload));
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
        return Object.entries(services).map(([serviceType, payload]) => {
          return {
            providerId: provider.id,
            ...toPublicProviderService(serviceType, payload),
          };
        });
      });
      return res.status(200).json(result);
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
      if (!uid) return res.status(401).json({ error: 'Not authenticated' });
      const { serviceType, price, description, etaMinutes, active = true, includedServices } = req.body as Partial<ProviderService> & {
        serviceType?: string;
      };
      if (!serviceType) {
        return res.status(400).json({ error: 'Missing serviceType' });
      }
      if (!isValidServiceType(serviceType)) {
        return res.status(400).json({ error: 'Invalid serviceType' });
      }
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
      const existingService = (currentServices[serviceType] || {}) as ProviderService;
      const parsedIncludedServices =
        includedServices !== undefined
          ? normalizeIncludedServices(includedServices)
          : normalizeIncludedServices(existingService.includedServices);
      const payload: ProviderService = {
        ...existingService,
        serviceType: serviceType.trim(),
        price: price !== undefined ? Number(price) : existingService.price,
        description: description !== undefined ? String(description || '') : existingService.description || '',
        etaMinutes: etaMinutes !== undefined ? Number(etaMinutes) : existingService.etaMinutes,
        active,
        updatedAt: new Date().toISOString(),
        includedServices: parsedIncludedServices,
      };
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
      const list = Object.entries(updatedServices).map(([st, val]) => toPublicProviderService(st, val as ProviderService));
      return res.status(200).json(list);
    }

    if (req.method === 'DELETE') {
      if (!uid) return res.status(401).json({ error: 'Not authenticated' });
      const serviceType = String((req.query.serviceType as string) || '').trim();
      if (!serviceType) {
        return res.status(400).json({ error: 'Missing serviceType' });
      }

      const supabase = getSupabaseAdminClient();
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
      if (!(serviceType in currentServices)) {
        const list = Object.entries(currentServices).map(([st, val]) => toPublicProviderService(st, val as ProviderService));
        return res.status(200).json(list);
      }

      const { [serviceType]: _removed, ...restServices } = currentServices;
      const { error: updateError } = await supabase
        .from('service_providers')
        .update({
          metadata: {
            ...currentMetadata,
            services: restServices,
          },
        })
        .eq('id', uid);

      if (updateError) {
        throw new Error(`Failed to delete provider service: ${updateError.message}`);
      }

      const list = Object.entries(restServices).map(([st, val]) => toPublicProviderService(st, val as ProviderService));
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

// Vercel serverless expects a default export when the module is loaded directly
export default handleProviderServices;


