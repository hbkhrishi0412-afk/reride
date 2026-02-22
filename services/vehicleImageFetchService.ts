/**
 * Fetches a car image by make, model, and year, then uploads it to Supabase Storage.
 * Uses Unsplash API when UNSPLASH_ACCESS_KEY is set; otherwise a placeholder.
 * Server-side only (uses getSupabaseAdminClient).
 */

const IMAGES_BUCKET = 'Images';

/**
 * Get an image URL for a vehicle (make, model, year).
 * Tries Unsplash first; falls back to a deterministic placeholder.
 */
export async function getImageUrlForVehicle(
  make: string,
  model: string,
  year: number | string
): Promise<string> {
  const query = [make, model, String(year), 'car'].filter(Boolean).join(' ');
  const accessKey = process.env.UNSPLASH_ACCESS_KEY || process.env.VITE_UNSPLASH_ACCESS_KEY;

  if (accessKey && accessKey.trim() && !accessKey.includes('your_')) {
    try {
      const url = new URL('https://api.unsplash.com/search/photos');
      url.searchParams.set('query', query);
      url.searchParams.set('per_page', '1');
      url.searchParams.set('orientation', 'landscape');
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Client-ID ${accessKey}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { results?: Array<{ urls?: { regular?: string } }> };
        const regular = data?.results?.[0]?.urls?.regular;
        if (regular) return regular;
      }
    } catch (e) {
      console.warn('Unsplash fetch failed, using placeholder:', e);
    }
  }

  // Placeholder: deterministic image per make/model/year (no API key needed)
  const text = encodeURIComponent(`${year} ${make} ${model}`);
  return `https://placehold.co/800x600/e2e8f0/64748b?text=${text}`;
}

/**
 * Download image from URL and upload to Supabase Storage (Images bucket).
 * Path: vehicles/{vehicleId}/fetched_1.jpg
 * Must be called from server (uses getSupabaseAdminClient).
 */
export async function fetchAndUploadVehicleImage(
  vehicleId: number,
  make: string,
  model: string,
  year: number | string
): Promise<{ success: boolean; path?: string; error?: string }> {
  if (typeof window !== 'undefined') {
    return { success: false, error: 'Must run on server' };
  }

  try {
    const imageUrl = await getImageUrlForVehicle(make, model, year);
    const response = await fetch(imageUrl, { headers: { Accept: 'image/*' } });
    if (!response.ok) {
      return { success: false, error: `Failed to fetch image: ${response.status}` };
    }
    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const fileName = `fetched_1.${ext}`;
    const filePath = `vehicles/${vehicleId}/${fileName}`;

    const { getSupabaseAdminClient } = await import('../lib/supabase.js');
    const supabase = getSupabaseAdminClient();
    const buffer = Buffer.from(arrayBuffer);

    const { error } = await supabase.storage
      .from(IMAGES_BUCKET)
      .upload(filePath, buffer, {
        contentType,
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return { success: false, error: error.message };
    }
    return { success: true, path: filePath };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('fetchAndUploadVehicleImage error:', message);
    return { success: false, error: message };
  }
}

/**
 * Fetch image for a vehicle and update its record in the database.
 * Returns the updated images array path (e.g. ["vehicles/123/fetched_1.jpg"]).
 */
export async function fetchImageAndUpdateVehicle(vehicle: {
  id: number;
  make: string;
  model: string;
  year: number;
  images?: string[];
}): Promise<{ success: boolean; path?: string; error?: string }> {
  const result = await fetchAndUploadVehicleImage(
    vehicle.id,
    vehicle.make,
    vehicle.model,
    vehicle.year
  );
  if (!result.success || !result.path) return result;

  try {
    const { supabaseVehicleService } = await import('./supabase-vehicle-service.js');
    const existing = Array.isArray(vehicle.images) ? vehicle.images : [];
    const newImages = existing.some((p) => p === result.path || p?.includes(`vehicles/${vehicle.id}/`))
      ? existing
      : [result.path, ...existing].slice(0, 10);
    await supabaseVehicleService.update(vehicle.id, { images: newImages });
    return { success: true, path: result.path };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Upload ok, update failed: ${message}` };
  }
}
