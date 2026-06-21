import { getSupabaseAdminClient } from '../lib/supabase-admin.js';
import { resolveSupabaseClient } from '../lib/resolveSupabaseClient.js';
import type { Vehicle } from '../types.js';
import { VehicleCategory } from '../vehicle-category.js';
import { CITY_MAPPING } from '../utils/cityMapping.js';
import { HOME_DISCOVERY_CITY_ORDER } from '../constants/homeDiscovery.js';
import { stringToNumericVehicleId } from '../utils/vehicleIdentity.js';

// Detect if we're in a server context (serverless function)
const isServerSide = typeof window === 'undefined';

let vehicleNumericIdFallbackSeq = 0;

// Helper to validate and convert category string to VehicleCategory enum
function validateCategory(category: unknown): VehicleCategory {
  if (typeof category !== 'string') {
    return VehicleCategory.FOUR_WHEELER; // Default fallback
  }
  
  // Check if category is a valid VehicleCategory enum value
  const validCategories = Object.values(VehicleCategory);
  if (validCategories.includes(category as VehicleCategory)) {
    return category as VehicleCategory;
  }
  
  // Fallback to default if invalid
  return VehicleCategory.FOUR_WHEELER;
}

const SUPABASE_IMAGES_BUCKET = 'Images';

/** Build public storage URL from base URL and path (no Supabase client needed) */
function buildStoragePublicUrl(filePath: string): string | null {
  const baseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  if (!baseUrl || !baseUrl.startsWith('https://') || !baseUrl.includes('.supabase.co')) return null;
  const normalized = filePath.trim().replace(/^\//, '');
  return `${baseUrl}/storage/v1/object/public/${SUPABASE_IMAGES_BUCKET}/${normalized}`;
}

/**
 * Converts image paths/URLs to public URLs
 * Handles both Supabase Storage paths and full URLs
 */
function processImageUrls(images: string[] | null | undefined, vehicleId?: number): string[] {
  if (!Array.isArray(images) || images.length === 0) {
    return [];
  }

  const resolvePath = (image: string): string => {
    if (!image || typeof image !== 'string' || image.trim() === '') return '';
    let filePath = image.trim();
    if (!filePath.includes('/')) {
      filePath = vehicleId != null ? `vehicles/${vehicleId}/${filePath}` : `vehicles/${filePath}`;
    }
    return filePath;
  };

  const toPublicUrl = (image: string): string => {
    if (image && image.startsWith('data:')) return '';
    if (image && (image.startsWith('http://') || image.startsWith('https://'))) return image;
    if (!image || typeof image !== 'string' || image.trim() === '') return '';
    const filePath = resolvePath(image);
    if (!filePath) return '';

    const publicUrl = buildStoragePublicUrl(filePath);
    return publicUrl || image;
  };

  try {
    return images.map(toPublicUrl).filter(img => img && img.trim() !== '');
  } catch (error) {
    console.error('❌ Error processing image URLs:', error);
    return images
      .filter(img => img && typeof img === 'string' && img.trim() !== '')
      .map(img => buildStoragePublicUrl(resolvePath(img)) || img)
      .filter(Boolean);
  }
}

// Helper to convert Supabase row to Vehicle type
function supabaseRowToVehicle(row: any): Vehicle {
  // Row.id is TEXT in Supabase but Vehicle.id is typed as number. Prefer the
  // numeric parse; fall back to a deterministic hash so UUID-style ids remain
  // unique and stable instead of colliding on 0.
  const rawId = row.id;
  let vehicleId: number;
  if (typeof rawId === 'number' && Number.isFinite(rawId)) {
    vehicleId = rawId;
  } else if (typeof rawId === 'string' && rawId.trim() !== '' && !Number.isNaN(Number(rawId))) {
    vehicleId = Number(rawId);
  } else if (typeof rawId === 'string' && rawId.trim() !== '') {
    vehicleId = stringToNumericVehicleId(rawId);
  } else {
    vehicleId = 0;
  }
  
  // CRITICAL FIX: Process images to convert storage paths to public URLs
  const processedImages = processImageUrls(row.images, vehicleId);

  const rawMeta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  // Strip the deprecated qualityReport.summary so it never overwrites Vehicle.description
  // when metadata is spread into the returned object below. We keep fixesDone intact.
  let meta: any = rawMeta;
  const legacyQualitySummary: string | undefined =
    rawMeta && rawMeta.qualityReport && typeof rawMeta.qualityReport === 'object'
      ? (rawMeta.qualityReport.summary as string | undefined)
      : undefined;
  if (legacyQualitySummary !== undefined) {
    const { summary: _ignored, ...restQR } = rawMeta.qualityReport as { summary?: string; fixesDone?: string[] };
    meta = { ...rawMeta, qualityReport: { fixesDone: restQR.fixesDone || [] } };
  }
  const metaSellerPhone = (meta as { sellerPhone?: string; seller_phone?: string }).sellerPhone
    ?? (meta as { seller_phone?: string }).seller_phone;
  const metaSellerWa = (meta as { sellerWhatsApp?: string; seller_whatsapp?: string }).sellerWhatsApp
    ?? (meta as { seller_whatsapp?: string }).seller_whatsapp;

  // Backfill: if description is empty but the row still has a legacy qualityReport.summary, use it.
  const mergedDescription: string =
    (row.description && String(row.description).trim()) ||
    (legacyQualitySummary && legacyQualitySummary.trim()) ||
    '';

  return {
    id: vehicleId,
    databaseId: typeof rawId === 'string' && rawId.trim() !== '' ? rawId.trim() : String(rawId ?? ''),
    category: validateCategory(row.category),
    make: row.make || '',
    model: row.model || '',
    variant: row.variant || undefined,
    year: row.year || 0,
    price: Number(row.price) || 0,
    mileage: Number(row.mileage) || 0,
    images: processedImages, // Use processed images with public URLs
    features: row.features || [],
    description: mergedDescription,
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
    // Extract additional fields from metadata; normalize snake_case contact fields for the client Vehicle type
    ...meta,
    ...(metaSellerPhone ? { sellerPhone: String(metaSellerPhone).trim() } : {}),
    ...(metaSellerWa ? { sellerWhatsApp: String(metaSellerWa).trim() } : {}),
  };
}

function getSupabaseErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

// Helper to convert Vehicle type to Supabase row
function vehicleToSupabaseRow(vehicle: Partial<Vehicle>, options?: { partial?: boolean }): any {
  const partial = options?.partial ?? false;
  const has = (key: keyof Vehicle) => Object.prototype.hasOwnProperty.call(vehicle, key);
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
    'descriptionQuality', 'activeBoosts', 'hideExactLocation',
    'offerEnabled', 'offerTitle', 'offerStartDate', 'offerEndDate', 'offerDateLabel',
    'offerDescription', 'offerHighlight', 'offerDisclaimer',
    // Vahan verification fields
    'registrationNumber', 'engineNumber', 'chassisNumber', 'vahanVerifiedAt',
    'aiInspectionReport', 'sellerDisclosureChecklist', 'vahanSnapshot',
  ];
  
  metadataFields.forEach(field => {
    if (partial ? has(field as keyof Vehicle) : vehicle[field as keyof Vehicle] !== undefined) {
      metadata[field] = vehicle[field as keyof Vehicle];
    }
  });

  // Sanitize: qualityReport.summary is deprecated (merged into the top-level description column).
  // Strip it out so we never re-introduce it into the JSONB metadata.
  if (metadata.qualityReport && typeof metadata.qualityReport === 'object') {
    const { summary: _droppedSummary, fixesDone } = metadata.qualityReport as { summary?: string; fixesDone?: string[] };
    metadata.qualityReport = { fixesDone: Array.isArray(fixesDone) ? fixesDone : [] };
  }

  const row: any = {};

  const setColumn = (vehicleKey: keyof Vehicle, rowKey: string, value: unknown) => {
    if (partial && !has(vehicleKey)) return;
    row[rowKey] = value;
  };

  if (!partial) {
    row.id = vehicle.id?.toString() || undefined;
  } else if (has('id') && vehicle.id != null) {
    row.id = String(vehicle.id);
  }

  setColumn('category', 'category', vehicle.category || null);
  setColumn('make', 'make', vehicle.make || '');
  setColumn('model', 'model', vehicle.model || '');
  setColumn('variant', 'variant', vehicle.variant || null);
  setColumn('year', 'year', vehicle.year ?? null);
  setColumn('price', 'price', vehicle.price ?? 0);
  setColumn('mileage', 'mileage', vehicle.mileage ?? null);
  setColumn('images', 'images', vehicle.images || []);
  setColumn('features', 'features', vehicle.features || []);
  setColumn('description', 'description', vehicle.description || null);
  setColumn('sellerEmail', 'seller_email', vehicle.sellerEmail || null);
  setColumn('sellerName', 'seller_name', vehicle.sellerName || null);
  setColumn('engine', 'engine', vehicle.engine || null);
  setColumn('transmission', 'transmission', vehicle.transmission || null);
  setColumn('fuelType', 'fuel_type', vehicle.fuelType || null);
  setColumn('fuelEfficiency', 'fuel_efficiency', vehicle.fuelEfficiency || null);
  setColumn('color', 'color', vehicle.color || null);
  setColumn('status', 'status', vehicle.status || 'published');
  setColumn('isFeatured', 'is_featured', vehicle.isFeatured || false);
  setColumn('views', 'views', vehicle.views ?? 0);
  setColumn('inquiriesCount', 'inquiries_count', vehicle.inquiriesCount ?? 0);
  setColumn('registrationYear', 'registration_year', vehicle.registrationYear ?? null);
  setColumn('insuranceValidity', 'insurance_validity', vehicle.insuranceValidity ?? null);
  setColumn('insuranceType', 'insurance_type', vehicle.insuranceType ?? null);
  setColumn('rto', 'rto', vehicle.rto ?? null);
  setColumn('city', 'city', vehicle.city ?? null);
  setColumn('state', 'state', vehicle.state ?? null);
  setColumn('noOfOwners', 'no_of_owners', vehicle.noOfOwners ?? null);
  setColumn('displacement', 'displacement', vehicle.displacement ?? null);
  setColumn('groundClearance', 'ground_clearance', vehicle.groundClearance ?? null);
  setColumn('bootSpace', 'boot_space', vehicle.bootSpace ?? null);
  setColumn('createdAt', 'created_at', vehicle.createdAt || new Date().toISOString());
  setColumn('updatedAt', 'updated_at', vehicle.updatedAt || new Date().toISOString());

  if (partial) {
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
    // Collision-resistant numeric ID. Plain Date.now() collides under concurrent
    // serverless invocations (two creates in the same millisecond produced the
    // same ID and the second insert overwrote the first). Multiplying by 10000
    // and adding a cryptographically-random suffix makes collisions ~1-in-10k
    // per millisecond. Result stays in Number.MAX_SAFE_INTEGER range for the
    // next ~28 years, and remains numeric for the TEXT column + Number(row.id)
    // parsing used by the app.
    let id: number;
    try {
      const buf = new Uint8Array(4);
      globalThis.crypto.getRandomValues(buf);
      const randomSuffix = ((buf[0] << 8) | buf[1]) % 10000;
      id = Date.now() * 10000 + randomSuffix;
    } catch {
      id = Date.now() * 10000 + (vehicleNumericIdFallbackSeq++ % 10000);
    }

    const supabase = await resolveSupabaseClient();
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

  /** Load by canonical TEXT primary key (matches `vehicles.id` in Supabase). */
  async findByPrimaryKey(primaryKey: string): Promise<Vehicle | null> {
    const pk = String(primaryKey || '').trim();
    if (!pk) return null;
    const supabase = await resolveSupabaseClient();

    const { data, error } = await supabase.from('vehicles').select('*').eq('id', pk).maybeSingle();

    if (error || !data) {
      return null;
    }

    return supabaseRowToVehicle(data);
  },

  // Find vehicle by ID
  async findById(id: number): Promise<Vehicle | null> {
    return this.findByPrimaryKey(id.toString());
  },

  /**
   * Resolve a listing for mutations. Prefer `databaseId` (canonical TEXT PK in Supabase);
   * fall back to numeric `id` when it matches the stored row id.
   */
  async resolveVehicleIdentity(params: {
    id?: number;
    databaseId?: string;
  }): Promise<{ vehicle: Vehicle; primaryKey: string }> {
    const dbId = params.databaseId?.trim();
    if (dbId) {
      const vehicle = await this.findByPrimaryKey(dbId);
      if (vehicle) {
        return { vehicle, primaryKey: vehicle.databaseId || dbId };
      }
    }
    const numId = params.id;
    if (numId != null && Number.isFinite(numId) && numId > 0) {
      const vehicle = await this.findById(numId);
      if (vehicle) {
        return { vehicle, primaryKey: vehicle.databaseId || String(numId) };
      }
    }
    throw new Error('Vehicle not found.');
  },

  // Get all vehicles
  async findAll(): Promise<Vehicle[]> {
    const supabase = await resolveSupabaseClient();
    
    // CRITICAL FIX: Handle pagination to fetch ALL vehicles (Supabase has 1000 row limit per query)
    // This ensures we get all vehicles even if there are more than 1000
    const allVehicles: Vehicle[] = [];
    const pageSize = 1000; // Supabase default limit
    let offset = 0;
    let hasMore = true;
    
    console.log('📊 findAll: Starting to fetch all vehicles with pagination...');
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .range(offset, offset + pageSize - 1)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Supabase findAll error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          offset
        });
        throw new Error(`Failed to fetch vehicles: ${error.message}`);
      }
      
      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }
      
      const vehicles = data.map(supabaseRowToVehicle);
      allVehicles.push(...vehicles);
      
      console.log(`📊 findAll: Fetched ${vehicles.length} vehicles (total so far: ${allVehicles.length})`);
      
      // If we got fewer than pageSize, we've reached the end
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        offset += pageSize;
      }
    }
    
    console.log(`✅ findAll: Retrieved ${allVehicles.length} total vehicles from database`);
    return allVehicles;
  },

  // Update vehicle (returns updated row; resolves UUID TEXT ids via databaseId when provided)
  async update(
    primaryKeyOrId: string | number,
    updates: Partial<Vehicle>,
    options?: { databaseId?: string },
  ): Promise<Vehicle> {
    const supabase = await resolveSupabaseClient();

    let primaryKey: string;
    if (typeof primaryKeyOrId === 'string') {
      primaryKey = primaryKeyOrId.trim();
    } else {
      const resolved = await this.resolveVehicleIdentity({
        id: primaryKeyOrId,
        databaseId: options?.databaseId,
      });
      primaryKey = resolved.primaryKey;
    }

    if (!primaryKey) {
      throw new Error('Failed to update vehicle: missing id');
    }

    // Fetch existing metadata for merge (scoped to canonical primary key)
    const { data: existingVehicle, error: fetchError } = await supabase
      .from('vehicles')
      .select('metadata')
      .eq('id', primaryKey)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`Failed to fetch existing vehicle: ${fetchError.message}`);
    }

    const row = vehicleToSupabaseRow(updates, { partial: true });

    // Never overwrite the primary key on update
    delete row.id;

    Object.keys(row).forEach(key => {
      if (row[key] === undefined) {
        delete row[key];
      }
    });

    if (row.metadata && existingVehicle?.metadata) {
      row.metadata = {
        ...(existingVehicle.metadata || {}),
        ...(row.metadata || {}),
      };
    } else if (!row.metadata && existingVehicle?.metadata) {
      row.metadata = existingVehicle.metadata;
    }

    if (row.metadata === null || (typeof row.metadata === 'object' && Object.keys(row.metadata).length === 0)) {
      delete row.metadata;
    }

    const applyUpdate = async (payload: Record<string, unknown>): Promise<Vehicle> => {
      const { data, error } = await supabase
        .from('vehicles')
        .update(payload)
        .eq('id', primaryKey)
        .select('*')
        .single();

      if (error) {
        throw error;
      }
      if (!data) {
        throw new Error('Vehicle update did not apply — listing may have been removed.');
      }
      return supabaseRowToVehicle(data);
    };

    try {
      return await applyUpdate(row);
    } catch (error: unknown) {
      const message = getSupabaseErrorMessage(error);
      if (message.includes('metadata') || message.includes('Could not find')) {
        delete row.metadata;
        try {
          return await applyUpdate(row);
        } catch (retryError: unknown) {
          throw new Error(`Failed to update vehicle: ${getSupabaseErrorMessage(retryError)}`);
        }
      }
      throw new Error(`Failed to update vehicle: ${message}`);
    }
  },

  // Delete vehicle (primary key is TEXT in Supabase — use canonical `databaseId` when the numeric `id` is a client hash)
  async delete(primaryKey: string): Promise<void> {
    const pk = String(primaryKey || '').trim();
    if (!pk) {
      throw new Error('Failed to delete vehicle: missing id');
    }
    const supabase = await resolveSupabaseClient();

    // Best-effort: remove conversations for this listing so FKs that lack ON DELETE SET NULL cannot block the delete.
    const { error: convDelErr } = await supabase.from('conversations').delete().eq('vehicle_id', pk);
    if (convDelErr && process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ Pre-delete conversation cleanup:', convDelErr.message);
    }

    const { error } = await supabase.from('vehicles').delete().eq('id', pk);

    if (error) {
      throw new Error(`Failed to delete vehicle: ${error.message}`);
    }
  },

  // Find vehicles by seller email
  async findBySellerEmail(sellerEmail: string): Promise<Vehicle[]> {
    const supabase = await resolveSupabaseClient();
    
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('seller_email', sellerEmail.toLowerCase().trim());
    
    if (error) {
      throw new Error(`Failed to fetch vehicles by seller: ${error.message}`);
    }
    
    return (data || []).map(supabaseRowToVehicle);
  },

  /**
   * Parallel COUNT queries for home “Browse by category” / “Explore by location” rails.
   * Excludes rental listings when metadata supports it; falls back if the filter errors.
   */
  async getStorefrontDiscoveryCounts(): Promise<{
    categories: Record<string, number>;
    cities: Record<string, number>;
  }> {
    const supabase = await resolveSupabaseClient();

    const categoryIds = [
      VehicleCategory.FOUR_WHEELER,
      VehicleCategory.TWO_WHEELER,
      VehicleCategory.THREE_WHEELER,
      VehicleCategory.COMMERCIAL,
      VehicleCategory.FARM,
    ];

    const applyNonRental = (q: any) =>
      q.or('metadata->>listingType.is.null,metadata->>listingType.neq.rental');

    const countForCategory = async (cat: VehicleCategory, useRentalExclusion: boolean): Promise<number> => {
      let q = supabase
        .from('vehicles')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published')
        .eq('category', cat);
      if (useRentalExclusion) {
        q = applyNonRental(q);
      }
      const { count, error } = await q;
      if (error && useRentalExclusion) {
        return countForCategory(cat, false);
      }
      if (error) {
        console.warn('⚠️ storefront category count failed:', cat, error.message);
        return 0;
      }
      return count ?? 0;
    };

    const countForCityDisplay = async (displayName: string, useRentalExclusion: boolean): Promise<number> => {
      const aliases = CITY_MAPPING[displayName] || [displayName];
      const orClause = aliases.map((a) => `city.ilike.%${a}%`).join(',');
      let q = supabase
        .from('vehicles')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published')
        .or(orClause);
      if (useRentalExclusion) {
        q = applyNonRental(q);
      }
      const { count, error } = await q;
      if (error && useRentalExclusion) {
        return countForCityDisplay(displayName, false);
      }
      if (error) {
        console.warn('⚠️ storefront city count failed:', displayName, error.message);
        return 0;
      }
      return count ?? 0;
    };

    const [categoryResults, cityResults] = await Promise.all([
      Promise.all(categoryIds.map((cat) => countForCategory(cat, true))),
      Promise.all(
        [...HOME_DISCOVERY_CITY_ORDER].map((displayName) => countForCityDisplay(displayName, true))
      ),
    ]);

    const categories: Record<string, number> = {};
    categoryIds.forEach((cat, i) => {
      categories[cat] = categoryResults[i] ?? 0;
    });

    const cities: Record<string, number> = {};
    HOME_DISCOVERY_CITY_ORDER.forEach((name, i) => {
      cities[name] = cityResults[i] ?? 0;
    });

    return { categories, cities };
  },

  // Count vehicles by status (much faster than fetching all and counting)
  async countByStatus(status: 'published' | 'unpublished' | 'sold'): Promise<number> {
    const supabase = await resolveSupabaseClient();
    
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
  // Optimized query using composite index (status, created_at DESC)
  // This index dramatically speeds up the most common query pattern
  async findByStatus(
    status: 'published' | 'unpublished' | 'sold',
    options?: { orderBy?: string; orderDirection?: 'asc' | 'desc'; limit?: number; offset?: number }
  ): Promise<Vehicle[]> {
    const supabase = await resolveSupabaseClient();
    
    // CRITICAL FIX: Add default limit to prevent timeout on large datasets
    // Default to 100 items per page if no limit specified
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;
    
    // CRITICAL FIX: Use select with specific columns instead of '*' for better performance
    // This reduces data transfer and query time
    let query = supabase
      .from('vehicles')
      .select('id, make, model, variant, year, price, mileage, category, seller_email, status, is_featured, images, description, engine, fuel_type, transmission, fuel_efficiency, color, registration_year, insurance_validity, insurance_type, rto, city, state, location, no_of_owners, displacement, ground_clearance, boot_space, features, created_at, updated_at, listing_expires_at, listing_status, views, inquiries_count, certification_status, metadata')
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
    
    // Apply pagination only when `limit` is non-zero.
    // Supabase .range() is inclusive on both ends: offset..offset+limit-1
    if (limit !== 0) {
      query = query.range(offset, offset + limit - 1);
    }
    
    // CRITICAL FIX: Add timeout handling
    let data: any[] | null = null;
    let error: any = null;
    
    try {
      // Create a timeout promise. `limit=0` queries can be larger.
      const timeoutMs = limit === 0 ? 45000 : 25000;
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout: Vehicle fetch took too long')), timeoutMs)
      );
      
      // Race between query and timeout
      const result = await Promise.race([
        query,
        timeoutPromise
      ]) as { data: any[] | null; error: any };
      
      data = result.data;
      error = result.error;
    } catch (timeoutError) {
      // If timeout occurs, return empty array instead of throwing
      console.error('❌ Vehicle query timeout:', {
        status,
        limit,
        offset,
        error: timeoutError instanceof Error ? timeoutError.message : 'Unknown timeout error'
      });
      return [];
    }
    
    if (error) {
      // Log timeout errors specifically
      if (error.message?.includes('timeout') || error.message?.includes('canceling statement')) {
        console.error('❌ Vehicle query timeout:', {
          status,
          limit,
          offset,
          error: error.message
        });
        // Return empty array instead of throwing to prevent cascading failures
        return [];
      }
      throw new Error(`Failed to fetch vehicles by status: ${error.message}`);
    }
    
    return (data || []).map(supabaseRowToVehicle);
  },

  // Find featured vehicles
  async findFeatured(): Promise<Vehicle[]> {
    const supabase = await resolveSupabaseClient();
    
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
    const supabase = await resolveSupabaseClient();
    
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
    const supabase = await resolveSupabaseClient();
    
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
    const supabase = await resolveSupabaseClient();
    
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
    const supabase = await resolveSupabaseClient();
    
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

  /**
   * PostGIS radius search via `vehicles_within_radius` RPC.
   * Requires scripts/migrations/add-support-chat-and-postgis.sql applied in Supabase.
   */
  async findWithinRadius(
    lat: number,
    lng: number,
    radiusKm: number,
    maxResults = 100,
  ): Promise<Vehicle[]> {
    const supabase = getSupabaseAdminClient();
    const cappedRadius = Math.min(Math.max(radiusKm, 0.5), 50);
    const cappedResults = Math.min(Math.max(maxResults, 1), 100);
    const { data, error } = await supabase.rpc('vehicles_within_radius', {
      center_lat: lat,
      center_lng: lng,
      radius_km: cappedRadius,
      max_results: cappedResults,
    });
    if (error) {
      throw new Error(`PostGIS radius search failed: ${error.message}`);
    }
    return (data ?? []).map(supabaseRowToVehicle);
  },
};

