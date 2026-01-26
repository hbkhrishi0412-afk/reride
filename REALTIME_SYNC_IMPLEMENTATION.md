# Supabase Real-Time Sync Implementation Guide

## Overview

This guide provides step-by-step instructions to implement Supabase real-time subscriptions for all database tables that need live updates.

---

## Prerequisites

### 1. Enable Realtime in Supabase

Before implementing subscriptions, enable Realtime for your tables in Supabase:

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to **Database** → **Replication**
4. Enable replication for these tables:
   - ✅ `vehicles`
   - ✅ `conversations`
   - ✅ `notifications`
   - ✅ `users`
   - ✅ `service_requests`
   - ✅ `service_providers`
   - ✅ `faqs`

**Note:** Realtime is enabled by default for new tables, but verify it's enabled for existing tables.

### 2. Verify Supabase Client Configuration

Ensure your Supabase client is properly configured in `lib/supabase.ts`:

```typescript
// Already configured correctly
supabaseClient = createClient(config.url, config.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  // Realtime is enabled by default
});
```

---

## Implementation Strategy

### Phase 1: Create Reusable Real-Time Hook

Create a custom hook to manage Supabase real-time subscriptions:

**File:** `hooks/useSupabaseRealtime.ts`

```typescript
import { useEffect, useRef } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeOptions {
  table: string;
  filter?: string; // e.g., "seller_email=eq.user@example.com"
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  enabled?: boolean;
}

export function useSupabaseRealtime({
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

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
          console.log(`[Realtime] ${table} ${payload.eventType}:`, payload);
          
          switch (payload.eventType) {
            case 'INSERT':
              onInsert?.(payload.new);
              break;
            case 'UPDATE':
              onUpdate?.(payload.new);
              break;
            case 'DELETE':
              onDelete?.(payload.old);
              break;
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to ${table} real-time updates`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Error subscribing to ${table} real-time updates`);
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        console.log(`🔌 Unsubscribed from ${table} real-time updates`);
      }
    };
  }, [table, filter, enabled, onInsert, onUpdate, onDelete]);

  return channelRef.current;
}
```

---

## Phase 2: Implement Real-Time for Vehicles

### Step 1: Update AppProvider.tsx

**Location:** `components/AppProvider.tsx`

Add real-time subscription for vehicles:

```typescript
import { useSupabaseRealtime } from '../hooks/useSupabaseRealtime';

// Inside AppProvider component, after vehicles state
useSupabaseRealtime({
  table: 'vehicles',
  enabled: !!currentUser, // Only subscribe when user is logged in
  onInsert: (newVehicle) => {
    // Convert Supabase row to Vehicle type
    const vehicle = supabaseRowToVehicle(newVehicle);
    
    // Only add if status is published
    if (vehicle.status === 'published') {
      setVehicles(prev => {
        // Check if vehicle already exists (avoid duplicates)
        if (prev.some(v => v.id === vehicle.id)) {
          return prev;
        }
        return [vehicle, ...prev];
      });
      
      // Update recommendations if needed
      setRecommendations(prev => {
        if (prev.length < 6) {
          return [vehicle, ...prev].slice(0, 6);
        }
        return prev;
      });
      
      // Update cache
      const cacheKey = 'reRideVehicles_prod';
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const vehicles = JSON.parse(cached);
        vehicles.unshift(vehicle);
        localStorage.setItem(cacheKey, JSON.stringify(vehicles));
      }
      
      console.log('✅ New vehicle added via real-time:', vehicle.id);
    }
  },
  onUpdate: (updatedVehicle) => {
    const vehicle = supabaseRowToVehicle(updatedVehicle);
    
    setVehicles(prev => {
      const index = prev.findIndex(v => v.id === vehicle.id);
      if (index === -1) {
        // Vehicle not in list, add it if published
        if (vehicle.status === 'published') {
          return [vehicle, ...prev];
        }
        return prev;
      }
      
      // Update existing vehicle
      const newVehicles = [...prev];
      if (vehicle.status === 'published') {
        newVehicles[index] = vehicle;
      } else {
        // Remove if unpublished or sold
        newVehicles.splice(index, 1);
      }
      return newVehicles;
    });
    
    // Update recommendations
    setRecommendations(prev => {
      const index = prev.findIndex(v => v.id === vehicle.id);
      if (index === -1) return prev;
      
      const newRecs = [...prev];
      if (vehicle.status === 'published') {
        newRecs[index] = vehicle;
      } else {
        newRecs.splice(index, 1);
      }
      return newRecs;
    });
    
    // Update cache
    const cacheKey = 'reRideVehicles_prod';
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const vehicles = JSON.parse(cached);
      const index = vehicles.findIndex((v: Vehicle) => v.id === vehicle.id);
      if (index !== -1) {
        if (vehicle.status === 'published') {
          vehicles[index] = vehicle;
        } else {
          vehicles.splice(index, 1);
        }
        localStorage.setItem(cacheKey, JSON.stringify(vehicles));
      }
    }
    
    console.log('✅ Vehicle updated via real-time:', vehicle.id);
  },
  onDelete: (deletedVehicle) => {
    const vehicleId = Number(deletedVehicle.id);
    
    setVehicles(prev => prev.filter(v => v.id !== vehicleId));
    setRecommendations(prev => prev.filter(v => v.id !== vehicleId));
    
    // Update cache
    const cacheKey = 'reRideVehicles_prod';
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const vehicles = JSON.parse(cached);
      const filtered = vehicles.filter((v: Vehicle) => v.id !== vehicleId);
      localStorage.setItem(cacheKey, JSON.stringify(filtered));
    }
    
    console.log('✅ Vehicle deleted via real-time:', vehicleId);
  },
});
```

**Helper function to add:**

```typescript
// Add this helper function in AppProvider.tsx
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
    ...(row.metadata || {}),
  };
}
```

---

## Phase 3: Implement Real-Time for Conversations

### Update AppProvider.tsx or Conversation Component

```typescript
// For seller's conversations
useSupabaseRealtime({
  table: 'conversations',
  filter: currentUser?.role === 'seller' 
    ? `seller_id=eq.${currentUser.email.toLowerCase()}`
    : undefined,
  enabled: !!currentUser && currentUser.role === 'seller',
  onInsert: (newConversation) => {
    // Add new conversation to list
    setConversations(prev => {
      if (prev.some(c => c.id === newConversation.id)) {
        return prev;
      }
      return [supabaseRowToConversation(newConversation), ...prev];
    });
    console.log('✅ New conversation via real-time:', newConversation.id);
  },
  onUpdate: (updatedConversation) => {
    // Update conversation (e.g., read status, last message)
    setConversations(prev => {
      const index = prev.findIndex(c => c.id === updatedConversation.id);
      if (index === -1) return prev;
      
      const newConversations = [...prev];
      newConversations[index] = supabaseRowToConversation(updatedConversation);
      return newConversations;
    });
    console.log('✅ Conversation updated via real-time:', updatedConversation.id);
  },
});
```

---

## Phase 4: Implement Real-Time for Notifications

### Update AppProvider.tsx

```typescript
useSupabaseRealtime({
  table: 'notifications',
  filter: currentUser 
    ? `recipient_email=eq.${currentUser.email.toLowerCase()}`
    : undefined,
  enabled: !!currentUser,
  onInsert: (newNotification) => {
    const notification = supabaseRowToNotification(newNotification);
    
    setNotifications(prev => {
      if (prev.some(n => n.id === notification.id)) {
        return prev;
      }
      return [notification, ...prev];
    });
    
    // Show browser notification if enabled
    if (Notification.permission === 'granted' && !shownNotificationIdsRef.current.has(notification.id)) {
      new Notification(notification.title || 'New Notification', {
        body: notification.message || '',
        icon: '/icon-192x192.png',
      });
      shownNotificationIdsRef.current.add(notification.id);
    }
    
    console.log('✅ New notification via real-time:', notification.id);
  },
  onUpdate: (updatedNotification) => {
    setNotifications(prev => {
      const index = prev.findIndex(n => n.id === updatedNotification.id);
      if (index === -1) return prev;
      
      const newNotifications = [...prev];
      newNotifications[index] = supabaseRowToNotification(updatedNotification);
      return newNotifications;
    });
  },
});
```

---

## Phase 5: Implement Real-Time for Users (Dashboard)

### Update Dashboard.tsx

```typescript
// Replace polling with real-time subscription
useSupabaseRealtime({
  table: 'users',
  filter: seller?.email 
    ? `email=eq.${seller.email.toLowerCase()}`
    : undefined,
  enabled: !!seller?.email,
  onUpdate: (updatedUser) => {
    // Update seller data in real-time
    if (updatedUser.email?.toLowerCase() === seller.email?.toLowerCase()) {
      setSeller(supabaseRowToUser(updatedUser));
      console.log('✅ User updated via real-time:', updatedUser.email);
    }
  },
});

// Remove or reduce polling interval
// OLD: setInterval(refreshUserData, 60000);
// NEW: Only refresh on mount, real-time handles updates
```

---

## Phase 6: Implement Real-Time for Service Requests

### Update CarServiceDashboard.tsx

```typescript
useSupabaseRealtime({
  table: 'service_requests',
  filter: provider?.id 
    ? `provider_id=eq.${provider.id}`
    : undefined,
  enabled: !!provider?.id,
  onInsert: (newRequest) => {
    setRequests(prev => {
      if (prev.some(r => r.id === newRequest.id)) {
        return prev;
      }
      return [supabaseRowToServiceRequest(newRequest), ...prev];
    });
    console.log('✅ New service request via real-time:', newRequest.id);
  },
  onUpdate: (updatedRequest) => {
    setRequests(prev => {
      const index = prev.findIndex(r => r.id === updatedRequest.id);
      if (index === -1) return prev;
      
      const newRequests = [...prev];
      newRequests[index] = supabaseRowToServiceRequest(updatedRequest);
      return newRequests;
    });
    console.log('✅ Service request updated via real-time:', updatedRequest.id);
  },
});

// Remove polling interval
// OLD: setInterval(fetchRequests, 30000);
```

---

## Best Practices

### 1. Error Handling

```typescript
useSupabaseRealtime({
  table: 'vehicles',
  onInsert: (newVehicle) => {
    try {
      // Handle insert
    } catch (error) {
      console.error('Error handling real-time insert:', error);
      // Fallback to manual refresh
      loadVehicles();
    }
  },
});
```

### 2. Debouncing Updates

For high-frequency updates, debounce the state updates:

```typescript
import { useDebouncedCallback } from 'use-debounce';

const debouncedUpdate = useDebouncedCallback((vehicle: Vehicle) => {
  setVehicles(prev => {
    // Update logic
  });
}, 500);

useSupabaseRealtime({
  table: 'vehicles',
  onUpdate: debouncedUpdate,
});
```

### 3. Connection Status

Monitor connection status:

```typescript
const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

useSupabaseRealtime({
  table: 'vehicles',
  onStatusChange: (status) => {
    setIsRealtimeConnected(status === 'SUBSCRIBED');
  },
});
```

### 4. Fallback to Polling

If real-time fails, fallback to polling:

```typescript
const [realtimeEnabled, setRealtimeEnabled] = useState(true);

useSupabaseRealtime({
  table: 'vehicles',
  enabled: realtimeEnabled,
  onError: () => {
    console.warn('Real-time failed, falling back to polling');
    setRealtimeEnabled(false);
    // Start polling as fallback
  },
});

// Fallback polling
useEffect(() => {
  if (!realtimeEnabled) {
    const interval = setInterval(loadVehicles, 30000);
    return () => clearInterval(interval);
  }
}, [realtimeEnabled]);
```

---

## Testing

### 1. Test Real-Time Updates

1. Open app in two browser tabs
2. Make a change in one tab (e.g., update vehicle price)
3. Verify change appears immediately in other tab

### 2. Test Connection Recovery

1. Disable network
2. Make a change
3. Re-enable network
4. Verify change syncs when connection restored

### 3. Test Performance

Monitor:
- Number of subscriptions active
- Memory usage
- Network traffic
- Battery usage (mobile)

---

## Migration Checklist

- [ ] Enable Realtime in Supabase Dashboard for all tables
- [ ] Create `hooks/useSupabaseRealtime.ts`
- [ ] Implement vehicles real-time subscription
- [ ] Implement conversations real-time subscription
- [ ] Implement notifications real-time subscription
- [ ] Implement users real-time subscription
- [ ] Implement service_requests real-time subscription
- [ ] Remove or reduce polling intervals
- [ ] Test real-time updates
- [ ] Test connection recovery
- [ ] Monitor performance
- [ ] Update documentation

---

## Rollback Plan

If issues occur:

1. Disable real-time subscriptions (set `enabled: false`)
2. Re-enable polling intervals
3. Investigate issues
4. Fix and re-enable gradually

---

## Performance Considerations

1. **Limit Subscriptions**: Only subscribe when component is visible
2. **Filter Subscriptions**: Use filters to reduce data
3. **Batch Updates**: Debounce rapid updates
4. **Cleanup**: Always unsubscribe on unmount
5. **Monitor**: Track subscription count and performance

---

## Support

For issues:
1. Check Supabase Dashboard → Replication status
2. Verify RLS policies allow subscriptions
3. Check browser console for errors
4. Test with Supabase CLI: `supabase realtime status`



