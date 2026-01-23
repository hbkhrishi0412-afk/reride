import { getSupabaseClient, getSupabaseAdminClient } from '../lib/supabase.js';

// Detect if we're in a server context (serverless function)
const isServerSide = typeof window === 'undefined';

export interface ServiceProviderPayload extends Record<string, unknown> {
  name: string;
  email: string;
  phone: string;
  city: string;
  state?: string;
  district?: string;
  workshops?: string[];
  skills?: string[];
  availability?: string;
  serviceCategories?: string[];
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
    state: metadata.state || row.state || '',
    district: metadata.district || row.district || '',
    workshops: metadata.workshops || [],
    skills: Array.isArray(row.services) ? row.services : (metadata.skills || []),
    availability: metadata.availability || 'weekdays',
    serviceCategories: metadata.serviceCategories || [],
  };
}

// Helper to convert ServiceProviderPayload to Supabase row
function serviceProviderToSupabaseRow(provider: Partial<ServiceProviderPayload>): any {
  const metadata: any = {
    workshops: provider.workshops,
    availability: provider.availability,
    state: provider.state,
    district: provider.district,
    serviceCategories: provider.serviceCategories,
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
    
    // First, get existing provider to merge metadata properly
    const { data: existingProvider, error: fetchError } = await supabase
      .from('service_providers')
      .select('metadata')
      .eq('id', id)
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
      throw new Error(`Failed to fetch existing service provider: ${fetchError.message}`);
    }
    
    // Get existing provider to merge all data
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error('Service provider not found');
    }
    
    // Merge updates with existing data
    const merged = { ...existing, ...updates };
    const row = serviceProviderToSupabaseRow(merged);

    // Remove id from updates
    delete row.id;

    // CRITICAL: Merge metadata instead of replacing it
    if (row.metadata && existingProvider?.metadata) {
      row.metadata = {
        ...(existingProvider.metadata || {}),
        ...(row.metadata || {})
      };
    } else if (row.metadata && !existingProvider?.metadata) {
      // New metadata, no existing - use as is
    } else if (!row.metadata && existingProvider?.metadata) {
      // No new metadata, preserve existing
      row.metadata = existingProvider.metadata;
    }
    
    // Only include metadata if it has values
    if (row.metadata && Object.keys(row.metadata).length === 0) {
      delete row.metadata;
    }

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

