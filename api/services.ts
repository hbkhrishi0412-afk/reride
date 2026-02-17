import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyIdTokenFromHeader } from '../server/supabase-auth.js';
import { getSupabaseAdminClient } from '../lib/supabase.js';
import { authenticateRequest } from './auth.js';

interface Service {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  base_price: number;
  min_price: number;
  max_price: number;
  price_range?: string;
  icon_name?: string;
  active: boolean;
  display_order: number;
  metadata?: Record<string, unknown>;
}

interface AuthContext {
  isAuthenticated: boolean;
  isAdmin: boolean;
  email?: string;
  source: 'supabase' | 'legacy-jwt' | 'none';
  error?: string;
}

async function getUserRoleByEmail(email: string, supabase: ReturnType<typeof getSupabaseAdminClient>): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !data?.role) {
      return null;
    }

    return data.role;
  } catch {
    return null;
  }
}

async function getAuthContext(req: VercelRequest, supabase: ReturnType<typeof getSupabaseAdminClient>): Promise<AuthContext> {
  // Try Supabase JWT first
  try {
    const decoded = await verifyIdTokenFromHeader(req);
    const email = decoded.email?.toLowerCase().trim();
    const metadataRole =
      decoded.user?.app_metadata?.role ||
      decoded.user?.user_metadata?.role;

    const dbRole = email ? await getUserRoleByEmail(email, supabase) : null;
    const resolvedRole = metadataRole || dbRole;

    return {
      isAuthenticated: true,
      isAdmin: resolvedRole === 'admin',
      email,
      source: 'supabase',
    };
  } catch {
    // Fall through to legacy JWT auth
  }

  // Legacy application JWT (reRideAccessToken)
  const legacyAuth = authenticateRequest(req);
  if (!legacyAuth.isValid || !legacyAuth.user) {
    return {
      isAuthenticated: false,
      isAdmin: false,
      source: 'none',
      error: legacyAuth.error || 'Authentication required',
    };
  }

  const legacyEmail = legacyAuth.user.email?.toLowerCase().trim();
  const dbRole = legacyEmail ? await getUserRoleByEmail(legacyEmail, supabase) : null;
  const resolvedRole = dbRole || legacyAuth.user.role;

  return {
    isAuthenticated: true,
    isAdmin: resolvedRole === 'admin',
    email: legacyEmail,
    source: 'legacy-jwt',
  };
}

function getErrorStatusCode(message: string): number {
  const lower = message.toLowerCase();
  if (lower.includes('auth') || lower.includes('token') || lower.includes('access')) {
    return 403;
  }
  return 500;
}

export async function handleServices(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseAdminClient();
    const authContext = await getAuthContext(req, supabase);

    if (req.method === 'GET') {
      let query = supabase
        .from('services')
        .select('*');
      
      // Public users only see active services, admins see all
      if (!authContext.isAdmin) {
        query = query.eq('active', true);
      }
      
      const { data, error } = await query.order('display_order', { ascending: true });

      if (error) {
        // If table doesn't exist, return empty array (graceful degradation)
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          console.warn('Services table does not exist. Please run the SQL script to create it.');
          return res.status(200).json([]);
        }
        throw new Error(`Failed to fetch services: ${error.message}`);
      }

      return res.status(200).json(data || []);
    }

    // For write operations, require admin authentication
    if (!authContext.isAuthenticated) {
      return res.status(401).json({ error: authContext.error || 'Authentication required' });
    }

    if (!authContext.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (req.method === 'POST') {
      const service = req.body as Partial<Service>;
      
      if (!service.name || !service.display_name) {
        return res.status(400).json({ error: 'Missing required fields: name, display_name' });
      }

      const serviceData: Partial<Service> = {
        id: service.id || service.name.toLowerCase().replace(/\s+/g, '-'),
        name: service.name,
        display_name: service.display_name,
        description: service.description || '',
        base_price: service.base_price || 0,
        min_price: service.min_price || service.base_price || 0,
        max_price: service.max_price || service.base_price || 0,
        price_range: service.price_range || '',
        icon_name: service.icon_name || '',
        active: service.active !== false,
        display_order: service.display_order || 0,
        metadata: service.metadata || {},
      };

      const { data, error } = await supabase
        .from('services')
        .insert(serviceData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create service: ${error.message}`);
      }

      return res.status(201).json(data);
    }

    if (req.method === 'PATCH') {
      const { id, ...updates } = req.body as Partial<Service> & { id: string };
      
      if (!id) {
        return res.status(400).json({ error: 'Missing service id' });
      }

      const { data, error } = await supabase
        .from('services')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update service: ${error.message}`);
      }

      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query as { id: string };
      
      if (!id) {
        return res.status(400).json({ error: 'Missing service id' });
      }

      // Soft delete by setting active to false
      const { data, error } = await supabase
        .from('services')
        .update({ active: false })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to delete service: ${error.message}`);
      }

      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Services API error:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    const status = getErrorStatusCode(message);
    return res.status(status).json({ error: message });
  }
}

