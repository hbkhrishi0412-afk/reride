import { getSupabaseClient, getSupabaseAdminClient } from '../lib/supabase.js';

// Detect if we're in a server context (serverless function)
const isServerSide = typeof window === 'undefined';

export interface ServiceRequestPayload extends Record<string, unknown> {
  providerId?: string | null;
  candidateProviderIds?: string[];
  title: string;
  serviceType?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  vehicle?: string;
  city?: string;
  addressLine?: string;
  pincode?: string;
  status?: 'open' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  scheduledAt?: string;
  notes?: string;
  carDetails?: string;
  createdAt?: string;
  updatedAt?: string;
  claimedAt?: string;
  completedAt?: string;
}

// Helper to convert Supabase row to ServiceRequestPayload
function supabaseRowToServiceRequest(row: any): ServiceRequestPayload {
  const metadata = row.metadata || {};
  return {
    id: row.id,
    providerId: row.provider_id || null,
    title: metadata.title || row.service_type || '',
    serviceType: row.service_type || metadata.serviceType || 'General',
    customerName: metadata.customerName || '',
    customerPhone: metadata.customerPhone || '',
    customerEmail: metadata.customerEmail || '',
    vehicle: metadata.vehicle || '',
    city: metadata.city || '',
    addressLine: metadata.addressLine || '',
    pincode: metadata.pincode || '',
    status: (row.status || metadata.status || 'open') as ServiceRequestPayload['status'],
    scheduledAt: metadata.scheduledAt || '',
    notes: metadata.notes || '',
    carDetails: metadata.carDetails || '',
    candidateProviderIds: metadata.candidateProviderIds || [],
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    claimedAt: metadata.claimedAt || undefined,
    completedAt: metadata.completedAt || undefined,
  };
}

// Helper to convert ServiceRequestPayload to Supabase row
function serviceRequestToSupabaseRow(request: Partial<ServiceRequestPayload>): any {
  // Fields that go directly to columns
  const directFields: any = {
    id: request.id,
    provider_id: request.providerId || null,
    service_type: request.serviceType || 'General',
    status: request.status || 'open',
  };

  // All other fields go into metadata
  const metadata: any = {
    title: request.title,
    customerName: request.customerName,
    customerPhone: request.customerPhone,
    customerEmail: request.customerEmail,
    vehicle: request.vehicle,
    city: request.city,
    addressLine: request.addressLine,
    pincode: request.pincode,
    scheduledAt: request.scheduledAt,
    notes: request.notes,
    carDetails: request.carDetails,
    candidateProviderIds: request.candidateProviderIds,
    claimedAt: request.claimedAt,
    completedAt: request.completedAt,
  };

  // Remove undefined values from metadata
  Object.keys(metadata).forEach(key => {
    if (metadata[key] === undefined) {
      delete metadata[key];
    }
  });

  return {
    ...directFields,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
  };
}

// Service Request service for Supabase
export const supabaseServiceRequestService = {
  // Create a new service request
  async create(requestData: Omit<ServiceRequestPayload, 'id'> & { id?: string }): Promise<ServiceRequestPayload & { id: string }> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    // Generate ID if not provided
    const id = requestData.id || `sr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const row = serviceRequestToSupabaseRow({
      ...requestData,
      id,
      createdAt: requestData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const { data, error } = await supabase
      .from('service_requests')
      .insert(row)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create service request: ${error.message}`);
    }

    return supabaseRowToServiceRequest(data) as ServiceRequestPayload & { id: string };
  },

  // Find service request by ID
  async findById(id: string): Promise<ServiceRequestPayload & { id: string } | null> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();

    const { data, error } = await supabase
      .from('service_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return supabaseRowToServiceRequest(data) as ServiceRequestPayload & { id: string };
  },

  // Find all service requests
  async findAll(): Promise<(ServiceRequestPayload & { id: string })[]> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();

    const { data, error } = await supabase
      .from('service_requests')
      .select('*');

    if (error) {
      throw new Error(`Failed to fetch service requests: ${error.message}`);
    }

    return (data || []).map(supabaseRowToServiceRequest) as (ServiceRequestPayload & { id: string })[];
  },

  // Find service requests by status
  async findByStatus(status: string): Promise<(ServiceRequestPayload & { id: string })[]> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();

    const { data, error } = await supabase
      .from('service_requests')
      .select('*')
      .eq('status', status);

    if (error) {
      throw new Error(`Failed to fetch service requests by status: ${error.message}`);
    }

    return (data || []).map(supabaseRowToServiceRequest) as (ServiceRequestPayload & { id: string })[];
  },

  // Find service requests by provider ID
  async findByProviderId(providerId: string): Promise<(ServiceRequestPayload & { id: string })[]> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();

    const { data, error } = await supabase
      .from('service_requests')
      .select('*')
      .eq('provider_id', providerId);

    if (error) {
      throw new Error(`Failed to fetch service requests by provider: ${error.message}`);
    }

    return (data || []).map(supabaseRowToServiceRequest) as (ServiceRequestPayload & { id: string })[];
  },

  // Update service request
  async update(id: string, updates: Partial<ServiceRequestPayload>): Promise<void> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const row = serviceRequestToSupabaseRow({
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    // Remove id from updates
    delete row.id;

    const { error } = await supabase
      .from('service_requests')
      .update(row)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update service request: ${error.message}`);
    }
  },

  // Delete service request
  async delete(id: string): Promise<void> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();

    const { error } = await supabase
      .from('service_requests')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete service request: ${error.message}`);
    }
  },
};

