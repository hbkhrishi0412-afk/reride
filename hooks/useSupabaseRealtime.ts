import { useEffect, useRef } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface UseSupabaseRealtimeOptions {
  table: string;
  enabled?: boolean;
  filter?: string;
  onInsert?: (newRow: any) => void;
  onUpdate?: (updatedRow: any) => void;
  onDelete?: (deletedRow: any) => void;
}

/**
 * Hook for subscribing to Supabase real-time database changes
 * 
 * @example
 * ```tsx
 * useSupabaseRealtime({
 *   table: 'vehicles',
 *   enabled: !!currentUser,
 *   onInsert: (newVehicle) => {
 *     setVehicles(prev => [...prev, newVehicle]);
 *   },
 *   onUpdate: (updatedVehicle) => {
 *     setVehicles(prev => prev.map(v => v.id === updatedVehicle.id ? updatedVehicle : v));
 *   },
 *   onDelete: (deletedVehicle) => {
 *     setVehicles(prev => prev.filter(v => v.id !== deletedVehicle.id));
 *   }
 * });
 * ```
 */
export function useSupabaseRealtime({
  table,
  enabled = true,
  filter,
  onInsert,
  onUpdate,
  onDelete,
}: UseSupabaseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Cleanup if disabled
      if (channelRef.current) {
        const supabase = getSupabaseClient();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    try {
      const supabase = getSupabaseClient();
      
      // Create channel name based on table and filter
      const channelName = filter 
        ? `${table}:${filter.replace(/[^a-zA-Z0-9]/g, '_')}`
        : `${table}:all`;

      // Create and subscribe to channel
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: table,
            filter: filter,
          },
          (payload) => {
            if (process.env.NODE_ENV === 'development') {
              console.log(`[Realtime] ${table} ${payload.eventType}:`, payload);
            }
            
            try {
              switch (payload.eventType) {
                case 'INSERT':
                  if (onInsert && payload.new) {
                    onInsert(payload.new);
                  }
                  break;
                case 'UPDATE':
                  if (onUpdate && payload.new) {
                    onUpdate(payload.new);
                  }
                  break;
                case 'DELETE':
                  if (onDelete && payload.old) {
                    onDelete(payload.old);
                  }
                  break;
              }
            } catch (error) {
              console.error(`Error handling ${table} real-time event:`, error);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            if (process.env.NODE_ENV === 'development') {
              console.log(`✅ Subscribed to ${table} real-time updates`);
            }
          } else if (status === 'CHANNEL_ERROR') {
            console.error(`❌ Error subscribing to ${table} real-time updates`);
          } else if (status === 'TIMED_OUT') {
            console.warn(`⏱️ Timeout subscribing to ${table} real-time updates`);
          } else if (status === 'CLOSED') {
            if (process.env.NODE_ENV === 'development') {
              console.log(`🔌 Closed connection to ${table} real-time updates`);
            }
          }
        });

      channelRef.current = channel;
    } catch (error) {
      console.error(`Failed to set up real-time subscription for ${table}:`, error);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (channelRef.current) {
        try {
          const supabase = getSupabaseClient();
          supabase.removeChannel(channelRef.current);
          if (process.env.NODE_ENV === 'development') {
            console.log(`🔌 Unsubscribed from ${table} real-time updates`);
          }
        } catch (error) {
          console.error(`Error unsubscribing from ${table} real-time updates:`, error);
        }
        channelRef.current = null;
      }
    };
  }, [table, filter, enabled, onInsert, onUpdate, onDelete]);

  return channelRef.current;
}







