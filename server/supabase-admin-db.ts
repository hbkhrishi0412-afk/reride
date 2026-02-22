// Supabase Admin Database Utilities
// Provides Firebase-like admin functions for Supabase operations
// These functions use the admin client (service_role key) to bypass RLS policies

import { getSupabaseAdminClient } from '../lib/supabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';

// Database path mappings (Supabase uses tables, not paths)
// These map to Supabase table names
export const DB_PATHS = {
  USERS: 'users',
  VEHICLES: 'vehicles',
  VEHICLE_DATA: 'vehicle_data', // For vehicle brands/models/variants data
  NEW_CARS: 'new_cars',
  CONVERSATIONS: 'conversations',
  NOTIFICATIONS: 'notifications',
} as const;

// Helper to get Supabase admin client
function getAdminClient(): SupabaseClient {
  return getSupabaseAdminClient();
}

// Read a single record from a Supabase table
export async function adminRead<T extends Record<string, unknown>>(
  table: string,
  id: string
): Promise<T | null> {
  const supabase = getAdminClient();
  
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    // If record doesn't exist, return null (not an error)
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to read from ${table}: ${error.message}`);
  }
  
  return data as T | null;
}

// Read all records from a Supabase table
export async function adminReadAll<T extends Record<string, unknown>>(
  table: string
): Promise<Record<string, T>> {
  const supabase = getAdminClient();
  
  const { data, error } = await supabase
    .from(table)
    .select('*');
  
  if (error) {
    throw new Error(`Failed to read all from ${table}: ${error.message}`);
  }
  
  // Convert array to object keyed by id (similar to Firebase structure)
  const result: Record<string, T> = {};
  if (data) {
    for (const item of data) {
      const id = (item as any).id?.toString() || String(Date.now());
      result[id] = item as T;
    }
  }
  
  return result;
}

// Create a record in a Supabase table
export async function adminCreate<T extends Record<string, unknown>>(
  table: string,
  data: T,
  id?: string
): Promise<void> {
  const supabase = getAdminClient();
  
  const record = id ? { ...data, id } : data;
  
  const { error } = await supabase
    .from(table)
    .insert(record);
  
  if (error) {
    throw new Error(`Failed to create in ${table}: ${error.message}`);
  }
}

// Update a record in a Supabase table
export async function adminUpdate<T extends Record<string, unknown>>(
  table: string,
  id: string,
  updates: Partial<T>
): Promise<void> {
  const supabase = getAdminClient();
  
  const { error } = await supabase
    .from(table)
    .update(updates)
    .eq('id', id);
  
  if (error) {
    throw new Error(`Failed to update in ${table}: ${error.message}`);
  }
}

// Delete a record from a Supabase table
export async function adminDelete(
  table: string,
  id: string
): Promise<void> {
  const supabase = getAdminClient();
  
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id);
  
  if (error) {
    throw new Error(`Failed to delete from ${table}: ${error.message}`);
  }
}
















