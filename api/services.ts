import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyIdTokenFromHeader } from '../server/supabase-auth.js';
import { getSupabaseAdminClient } from '../lib/supabase.js';

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

// Check if user is admin (you may need to adjust this based on your auth setup)
async function isAdmin(req: VercelRequest): Promise<boolean> {
  try {
    const decoded = await verifyIdTokenFromHeader(req);
    // Check if user has admin role - adjust based on your user structure
    // For now, we'll allow authenticated users (you should add proper role checking)
    return !!decoded.uid;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getSupabaseAdminClient();

    if (req.method === 'GET') {
      // Public read access for active services
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('active', true)
        .order('display_order', { ascending: true });

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
    const admin = await isAdmin(req);
    if (!admin) {
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
    const status = message.includes('access') || message.includes('auth') ? 403 : 500;
    return res.status(status).json({ error: message });
  }
}

