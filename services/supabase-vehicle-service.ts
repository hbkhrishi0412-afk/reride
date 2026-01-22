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
// isUpdate: if true, only include fields that are actually defined (for partial updates)
function vehicleToSupabaseRow(vehicle: Partial<Vehicle>, isUpdate = false): any {
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
  
  const row: any = {};
  
  // Only include fields that are actually defined when doing updates
  // For creates, include all fields with defaults
  if (isUpdate) {
    // For updates, only include fields that are explicitly provided
    if (vehicle.id !== undefined) row.id = vehicle.id.toString();
    if (vehicle.category !== undefined) row.category = vehicle.category;
    if (vehicle.make !== undefined) row.make = vehicle.make;
    if (vehicle.model !== undefined) row.model = vehicle.model;
    if (vehicle.variant !== undefined) row.variant = vehicle.variant;
    if (vehicle.year !== undefined) row.year = vehicle.year;
    if (vehicle.price !== undefined) row.price = vehicle.price;
    if (vehicle.mileage !== undefined) row.mileage = vehicle.mileage;
    if (vehicle.images !== undefined) row.images = vehicle.images;
    if (vehicle.features !== undefined) row.features = vehicle.features;
    if (vehicle.description !== undefined) row.description = vehicle.description;
    if (vehicle.sellerEmail !== undefined) row.seller_email = vehicle.sellerEmail;
    if (vehicle.sellerName !== undefined) row.seller_name = vehicle.sellerName;
    if (vehicle.engine !== undefined) row.engine = vehicle.engine;
    if (vehicle.transmission !== undefined) row.transmission = vehicle.transmission;
    if (vehicle.fuelType !== undefined) row.fuel_type = vehicle.fuelType;
    if (vehicle.fuelEfficiency !== undefined) row.fuel_efficiency = vehicle.fuelEfficiency;
    if (vehicle.color !== undefined) row.color = vehicle.color;
    if (vehicle.status !== undefined) row.status = vehicle.status;
    if (vehicle.isFeatured !== undefined) row.is_featured = vehicle.isFeatured;
    if (vehicle.views !== undefined) row.views = vehicle.views;
    if (vehicle.inquiriesCount !== undefined) row.inquiries_count = vehicle.inquiriesCount;
    if (vehicle.registrationYear !== undefined) row.registration_year = vehicle.registrationYear;
    if (vehicle.insuranceValidity !== undefined) row.insurance_validity = vehicle.insuranceValidity;
    if (vehicle.insuranceType !== undefined) row.insurance_type = vehicle.insuranceType;
    if (vehicle.rto !== undefined) row.rto = vehicle.rto;
    if (vehicle.city !== undefined) row.city = vehicle.city;
    if (vehicle.state !== undefined) row.state = vehicle.state;
    if (vehicle.noOfOwners !== undefined) row.no_of_owners = vehicle.noOfOwners;
    if (vehicle.displacement !== undefined) row.displacement = vehicle.displacement;
    if (vehicle.groundClearance !== undefined) row.ground_clearance = vehicle.groundClearance;
    if (vehicle.bootSpace !== undefined) row.boot_space = vehicle.bootSpace;
    if (vehicle.createdAt !== undefined) row.created_at = vehicle.createdAt;
    if (vehicle.updatedAt !== undefined) row.updated_at = vehicle.updatedAt;
    // Always update updated_at on updates
    row.updated_at = vehicle.updatedAt || new Date().toISOString();
  } else {
    // For creates, include all fields with defaults
    row.id = vehicle.id?.toString() || undefined;
    row.category = vehicle.category || null;
    row.make = vehicle.make || '';
    row.model = vehicle.model || '';
    row.variant = vehicle.variant || null;
    row.year = vehicle.year || null;
    row.price = vehicle.price || 0;
    row.mileage = vehicle.mileage || null;
    row.images = vehicle.images || [];
    row.features = vehicle.features || [];
    row.description = vehicle.description || null;
    row.seller_email = vehicle.sellerEmail || null;
    row.seller_name = vehicle.sellerName || null;
    row.engine = vehicle.engine || null;
    row.transmission = vehicle.transmission || null;
    row.fuel_type = vehicle.fuelType || null;
    row.fuel_efficiency = vehicle.fuelEfficiency || null;
    row.color = vehicle.color || null;
    row.status = vehicle.status || 'published';
    row.is_featured = vehicle.isFeatured || false;
    row.views = vehicle.views || 0;
    row.inquiries_count = vehicle.inquiriesCount || 0;
    row.registration_year = vehicle.registrationYear || null;
    row.insurance_validity = vehicle.insuranceValidity || null;
    row.insurance_type = vehicle.insuranceType || null;
    row.rto = vehicle.rto || null;
    row.city = vehicle.city || null;
    row.state = vehicle.state || null;
    row.no_of_owners = vehicle.noOfOwners || null;
    row.displacement = vehicle.displacement || null;
    row.ground_clearance = vehicle.groundClearance || null;
    row.boot_space = vehicle.bootSpace || null;
    row.created_at = vehicle.createdAt || new Date().toISOString();
    row.updated_at = vehicle.updatedAt || new Date().toISOString();
  }

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
    const row = vehicleToSupabaseRow(updates, true); // true = isUpdate, only include defined fields
    
    // Remove id from updates (id is used in WHERE clause, not in SET)
    delete row.id;
    
    // Remove undefined and null values for required fields to avoid constraint violations
    // Required fields: category, make, model - if they're null/undefined, exclude them
    const requiredFields = ['category', 'make', 'model'];
    requiredFields.forEach(field => {
      if (row[field] === null || row[field] === undefined) {
        delete row[field];
      }
    });
    
    // Remove undefined values to avoid issues
    Object.keys(row).forEach(key => {
      if (row[key] === undefined) {
        delete row[key];
      }
    });
    
    // If metadata column doesn't exist in schema, remove it from update
    // This prevents "Could not find the 'metadata' column" errors
    // The metadata will still be stored in other columns if they exist
    if (row.metadata === null || (typeof row.metadata === 'object' && Object.keys(row.metadata).length === 0)) {
      delete row.metadata;
    }
    
    // If no fields to update, return early
    if (Object.keys(row).length === 0) {
      return;
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

  // Find vehicles by status with optional sorting and pagination
  async findByStatus(
    status: 'published' | 'unpublished' | 'sold',
    options?: { orderBy?: string; orderDirection?: 'asc' | 'desc'; limit?: number; offset?: number }
  ): Promise<Vehicle[]> {
    const supabase = isServerSide ? getSupabaseAdminClient() : getSupabaseClient();
    
    let query = supabase
      .from('vehicles')
      .select('*')
      .eq('status', status);
    
    // Apply database-level sorting (much faster than in-memory sorting)
    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options.orderDirection === 'asc' });
    } else {
      // Default: sort by created_at descending (newest first)
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
};

