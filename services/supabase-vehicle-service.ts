import { getSupabaseClient, getSupabaseAdminClient } from '../lib/supabase.js';
import type { Vehicle } from '../types.js';

// Detect if we're in a server context (serverless function)
const isServerSide = typeof window === 'undefined';

// Helper to convert Supabase row to Vehicle type
function supabaseRowToVehicle(row: any): Vehicle {
  return {
    id: Number(row.id) || 0,
    category: row.category as any,
    make: row.make || '',
    model: row.model || '',
    variant: row.variant || undefined,
    year: row.year || 0,
    price: Number(row.price) || 0,
    mileage: Number(row.mileage) || 0,
    images: row.images || [],
    features: row.features || [],
    description: row.description || '',
    sellerEmail: row.seller_email || '',
    sellerName: row.seller_name || undefined,
    engine: row.engine || '',
    transmission: row.transmission || '',
    fuelType: row.fuel_type || '',
    fuelEfficiency: row.fuel_efficiency || '',
    color: row.color || '',
    status: (row.status || 'published') as 'published' | 'unpublished' | 'sold',
    isFeatured: row.is_featured || false,
    views: row.views || 0,
    inquiriesCount: row.inquiries_count || 0,
    registrationYear: row.registration_year || undefined,
    insuranceValidity: row.insurance_validity || undefined,
    insuranceType: row.insurance_type || undefined,
    rto: row.rto || undefined,
    city: row.city || undefined,
    state: row.state || undefined,
    noOfOwners: row.no_of_owners || undefined,
    displacement: row.displacement || undefined,
    groundClearance: row.ground_clearance || undefined,
    bootSpace: row.boot_space || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    // Extract additional fields from metadata if present
    ...(row.metadata || {}),
  };
}

// Helper to convert Vehicle type to Supabase row
function vehicleToSupabaseRow(vehicle: Partial<Vehicle>): any {
  const metadata: any = {};
  
  // Extract fields that should go in metadata
  const metadataFields = [
    'certificationStatus', 'certifiedInspection', 'videoUrl', 'serviceRecords',
    'accidentHistory', 'documents', 'listingType', 'isFlagged', 'flagReason',
    'flaggedAt', 'averageRating', 'ratingCount', 'sellerAverageRating',
    'sellerRatingCount', 'sellerBadges', 'qualityReport', 'featuredAt',
    'soldAt', 'sellerPhone', 'sellerWhatsApp', 'showPhoneNumber',
    'preferredContactMethod', 'listingExpiresAt', 'listingLastRefreshed',
    'listingStatus', 'listingAutoRenew', 'listingRenewalCount', 'daysActive',
    'isPremiumListing', 'isUrgentSale', 'isBestPrice', 'boostExpiresAt',
    'viewsLast7Days', 'viewsLast30Days', 'uniqueViewers', 'phoneViews',
    'shareCount', 'keywords', 'nearbyLandmarks', 'exactLocation',
    'distanceFromUser', 'photoQuality', 'hasMinimumPhotos',
    'descriptionQuality', 'activeBoosts', 'hideExactLocation'
  ];
  
  metadataFields.forEach(field => {
    if (vehicle[field as keyof Vehicle] !== undefined) {
      metadata[field] = vehicle[field as keyof Vehicle];
    }
  });
  
  const row: any = {
    id: vehicle.id?.toString() || undefined,
    category: vehicle.category || null,
    make: vehicle.make || '',
    model: vehicle.model || '',
    variant: vehicle.variant || null,
    year: vehicle.year || null,
    price: vehicle.price || 0,
    mileage: vehicle.mileage || null,
    images: vehicle.images || [],
    features: vehicle.features || [],
    description: vehicle.description || null,
    seller_email: vehicle.sellerEmail || null,
    seller_name: vehicle.sellerName || null,
    engine: vehicle.engine || null,
    transmission: vehicle.transmission || null,
    fuel_type: vehicle.fuelType || null,
    fuel_efficiency: vehicle.fuelEfficiency || null,
    color: vehicle.color || null,
    status: vehicle.status || 'published',
    is_featured: vehicle.isFeatured || false,
    views: vehicle.views || 0,
    inquiries_count: vehicle.inquiriesCount || 0,
    registration_year: vehicle.registrationYear || null,
    insurance_validity: vehicle.insuranceValidity || null,
    insurance_type: vehicle.insuranceType || null,
    rto: vehicle.rto || null,
    city: vehicle.city || null,
    state: vehicle.state || null,
    no_of_owners: vehicle.noOfOwners || null,
    displacement: vehicle.displacement || null,
    ground_clearance: vehicle.groundClearance || null,
    boot_space: vehicle.bootSpace || null,
    created_at: vehicle.createdAt || new Date().toISOString(),
    updated_at: vehicle.updatedAt || new Date().toISOString(),
  };

  // Only include metadata if it has values (don't include null/empty metadata to avoid schema errors)
  if (Object.keys(metadata).length > 0) {
    row.metadata = metadata;
  }

  return row;
}

// Vehicle service for Supabase
export const supabaseVehicleService = {
  // Create a new vehicle
  async create(vehicleData: Omit<Vehicle, 'id'>): Promise<Vehicle> {
    const id = Date.now();
    
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    const row = vehicleToSupabaseRow({ ...vehicleData, id });
    
    const { data, error } = await supabase
      .from('vehicles')
      .insert(row)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create vehicle: ${error.message}`);
    }
    
    return supabaseRowToVehicle(data);
  },

  // Find vehicle by ID
  async findById(id: number): Promise<Vehicle | null> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', id.toString())
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return supabaseRowToVehicle(data);
  },

  // Get all vehicles
  async findAll(): Promise<Vehicle[]> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const { data, error } = await supabase
      .from('vehicles')
      .select('*');
    
    if (error) {
      throw new Error(`Failed to fetch vehicles: ${error.message}`);
    }
    
    return (data || []).map(supabaseRowToVehicle);
  },

  // Update vehicle
  async update(id: number, updates: Partial<Vehicle>): Promise<void> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    // First, get existing vehicle to merge metadata properly
    const { data: existingVehicle, error: fetchError } = await supabase
      .from('vehicles')
      .select('metadata')
      .eq('id', id.toString())
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
      throw new Error(`Failed to fetch existing vehicle: ${fetchError.message}`);
    }
    
    const row = vehicleToSupabaseRow(updates);
    
    // Remove id from updates
    delete row.id;
    
    // Remove undefined values to avoid issues
    Object.keys(row).forEach(key => {
      if (row[key] === undefined) {
        delete row[key];
      }
    });
    
    // CRITICAL: Merge metadata instead of replacing it
    // This preserves existing metadata fields when updating specific fields
    if (row.metadata && existingVehicle?.metadata) {
      // Merge new metadata with existing metadata
      row.metadata = {
        ...(existingVehicle.metadata || {}),
        ...(row.metadata || {})
      };
    } else if (row.metadata && !existingVehicle?.metadata) {
      // New metadata, no existing metadata - use as is
    } else if (!row.metadata && existingVehicle?.metadata) {
      // No new metadata, but existing metadata exists - preserve it
      row.metadata = existingVehicle.metadata;
    }
    
    // Only include metadata if it has values
    if (row.metadata === null || (typeof row.metadata === 'object' && Object.keys(row.metadata).length === 0)) {
      delete row.metadata;
    }
    
    const { error } = await supabase
      .from('vehicles')
      .update(row)
      .eq('id', id.toString());
    
    if (error) {
      // If error is about metadata column, retry without metadata
      if (error.message.includes("metadata") || error.message.includes("Could not find")) {
        delete row.metadata;
        const { error: retryError } = await supabase
          .from('vehicles')
          .update(row)
          .eq('id', id.toString());
        
        if (retryError) {
          throw new Error(`Failed to update vehicle: ${retryError.message}`);
        }
      } else {
        throw new Error(`Failed to update vehicle: ${error.message}`);
      }
    }
  },

  // Delete vehicle
  async delete(id: number): Promise<void> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', id.toString());
    
    if (error) {
      throw new Error(`Failed to delete vehicle: ${error.message}`);
    }
  },

  // Find vehicles by seller email
  async findBySellerEmail(sellerEmail: string): Promise<Vehicle[]> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('seller_email', sellerEmail.toLowerCase().trim());
    
    if (error) {
      throw new Error(`Failed to fetch vehicles by seller: ${error.message}`);
    }
    
    return (data || []).map(supabaseRowToVehicle);
  },

  // Count vehicles by status (much faster than fetching all and counting)
  async countByStatus(status: 'published' | 'unpublished' | 'sold'): Promise<number> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const { count, error } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true })
      .eq('status', status);
    
    if (error) {
      throw new Error(`Failed to count vehicles by status: ${error.message}`);
    }
    
    return count || 0;
  },

  // Find vehicles by status with optional sorting and pagination
  // OLX-STYLE: Optimized query using composite index (status, created_at DESC)
  // This index dramatically speeds up the most common query pattern
  async findByStatus(
    status: 'published' | 'unpublished' | 'sold',
    options?: { orderBy?: string; orderDirection?: 'asc' | 'desc'; limit?: number; offset?: number }
  ): Promise<Vehicle[]> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    let query = supabase
      .from('vehicles')
      .select('*')
      .eq('status', status); // Uses idx_vehicles_status_created_at index
    
    // Apply database-level sorting (much faster than in-memory sorting)
    // Uses composite index idx_vehicles_status_created_at for optimal performance
    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options.orderDirection === 'asc' });
    } else {
      // Default: sort by created_at descending (newest first)
      // This uses the composite index idx_vehicles_status_created_at
      query = query.order('created_at', { ascending: false });
    }
    
    // Apply pagination at database level if specified
    // Use .range() for pagination (it handles both offset and limit)
    if (options?.limit) {
      const offset = options.offset || 0;
      // .range() is inclusive on both ends, so we need offset to offset+limit-1
      query = query.range(offset, offset + options.limit - 1);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch vehicles by status: ${error.message}`);
    }
    
    return (data || []).map(supabaseRowToVehicle);
  },

  // Find featured vehicles
  async findFeatured(): Promise<Vehicle[]> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('is_featured', true);
    
    if (error) {
      throw new Error(`Failed to fetch featured vehicles: ${error.message}`);
    }
    
    return (data || []).map(supabaseRowToVehicle);
  },

  // Find vehicles by category
  async findByCategory(category: string): Promise<Vehicle[]> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('category', category);
    
    if (error) {
      throw new Error(`Failed to fetch vehicles by category: ${error.message}`);
    }
    
    return (data || []).map(supabaseRowToVehicle);
  },

  // Find vehicles by city
  async findByCity(city: string): Promise<Vehicle[]> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('city', city);
    
    if (error) {
      throw new Error(`Failed to fetch vehicles by city: ${error.message}`);
    }
    
    return (data || []).map(supabaseRowToVehicle);
  },

  // Find vehicles by state
  async findByState(state: string): Promise<Vehicle[]> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('state', state);
    
    if (error) {
      throw new Error(`Failed to fetch vehicles by state: ${error.message}`);
    }
    
    return (data || []).map(supabaseRowToVehicle);
  },

  // Find vehicles by city and status (optimized for city-stats endpoint)
  async findByCityAndStatus(city: string, status: 'published' | 'unpublished' | 'sold'): Promise<Vehicle[]> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('city', city)
      .eq('status', status)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch vehicles by city and status: ${error.message}`);
    }
    
    return (data || []).map(supabaseRowToVehicle);
  },
};

