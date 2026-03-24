/**
 * Persists the admin "vehicle dropdown" JSON (makes/models/variants) in Supabase.
 * This is separate from the `vehicles` listing table used for marketplace ads.
 */
import { getSupabaseAdminClient } from '../lib/supabase.js';

export const VEHICLE_CATALOG_CONFIG_KEY = 'vehicle_data';

function isServiceRoleMissingError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes('SUPABASE_SERVICE_ROLE_KEY');
}

export async function readVehicleCatalogFromSupabase(): Promise<Record<string, unknown> | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', VEHICLE_CATALOG_CONFIG_KEY)
      .maybeSingle();

    if (error) {
      console.warn('[vehicleCatalog] Supabase read error:', error.message);
      return null;
    }
    const value = data?.value;
    if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length > 0) {
      return value as Record<string, unknown>;
    }
    return null;
  } catch (e) {
    if (isServiceRoleMissingError(e)) {
      return null;
    }
    console.warn('[vehicleCatalog] Supabase read failed:', e);
    return null;
  }
}

export async function writeVehicleCatalogToSupabase(
  payload: unknown
): Promise<{ ok: boolean; skipped: boolean; error?: string }> {
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from('app_config').upsert(
      {
        key: VEHICLE_CATALOG_CONFIG_KEY,
        value: payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    if (error) {
      console.error('[vehicleCatalog] Supabase upsert error:', error.message);
      return { ok: false, skipped: false, error: error.message };
    }
    return { ok: true, skipped: false };
  } catch (e) {
    if (isServiceRoleMissingError(e)) {
      return { ok: false, skipped: true };
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[vehicleCatalog] Supabase upsert failed:', msg);
    return { ok: false, skipped: false, error: msg };
  }
}
