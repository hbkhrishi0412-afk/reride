import { getSupabaseClient, getSupabaseAdminClient } from '../lib/supabase.js';

// Detect if we're in a server context (serverless function)
const isServerSide = typeof window === 'undefined';

export interface ServiceProviderPayload extends Record<string, unknown> {
  name: string;
  email: string;
  phone: string;
  city: string;
  workshops?: string[];
  skills?: string[];
  availability?: string;
}

// Helper to convert Supabase row to ServiceProviderPayload
function supabaseRowToServiceProvider(row: any): ServiceProviderPayload {
  const metadata = row.metadata || {};
  return {
    id: row.id,
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || '',
    city: row.location || metadata.city || '',
    workshops: metadata.workshops || [],
    skills: Array.isArray(row.services) ? row.services : (metadata.skills || []),
    availability: metadata.availability || 'weekdays',
  };
}

// Helper to convert ServiceProviderPayload to Supabase row
function serviceProviderToSupabaseRow(provider: Partial<ServiceProviderPayload>): any {
  const metadata: any = {
    workshops: provider.workshops,
    availability: provider.availability,
  };

  // Remove undefined values from metadata
  Object.keys(metadata).forEach(key => {
    if (metadata[key] === undefined) {
      delete metadata[key];
    }
  });

  return {
    id: provider.id,
    name: provider.name || '',
    email: provider.email?.toLowerCase().trim() || '',
    phone: provider.phone || '',
    location: provider.city || '',
    services: provider.skills || [],
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
  };
}

// Service Provider service for Supabase
export const supabaseServiceProviderService = {
  // Create a new service provider
  async create(providerData: Omit<ServiceProviderPayload, 'id'> & { id?: string }): Promise<ServiceProviderPayload & { id: string }> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    // Use provided ID or generate one
    const id = providerData.id || `sp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const row = serviceProviderToSupabaseRow({
      ...providerData,
      id,
    });

    const { data, error } = await supabase
      .from('service_providers')
      .insert(row)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create service provider: ${error.message}`);
    }

    return supabaseRowToServiceProvider(data) as ServiceProviderPayload & { id: string };
  },

  // Find service provider by ID
  async findById(id: string): Promise<ServiceProviderPayload & { id: string } | null> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();

    const { data, error } = await supabase
      .from('service_providers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return supabaseRowToServiceProvider(data) as ServiceProviderPayload & { id: string };
  },

  // Find service provider by email
  async findByEmail(email: string): Promise<ServiceProviderPayload & { id: string } | null> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    const normalizedEmail = email.toLowerCase().trim();

    const { data, error } = await supabase
      .from('service_providers')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    if (error || !data) {
      return null;
    }

    return supabaseRowToServiceProvider(data) as ServiceProviderPayload & { id: string };
  },

  // Get all service providers
  async findAll(): Promise<(ServiceProviderPayload & { id: string })[]> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();

    const { data, error } = await supabase
      .from('service_providers')
      .select('*');

    if (error) {
      throw new Error(`Failed to fetch service providers: ${error.message}`);
    }

    return (data || []).map(supabaseRowToServiceProvider) as (ServiceProviderPayload & { id: string })[];
  },

  // Update service provider
  async update(id: string, updates: Partial<ServiceProviderPayload>): Promise<void> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const row = serviceProviderToSupabaseRow(updates);

    // Remove id from updates
    delete row.id;

    const { error } = await supabase
      .from('service_providers')
      .update(row)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update service provider: ${error.message}`);
    }
  },

  // Delete service provider
  async delete(id: string): Promise<void> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();

    const { error } = await supabase
      .from('service_providers')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete service provider: ${error.message}`);
    }
  },
};

