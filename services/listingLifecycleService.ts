import type { Vehicle, ListingLifecycle, ListingRefresh } from '../types';

// ============================================
// LISTING EXPIRY MANAGEMENT
// ============================================

// Calculate expiry date for a new listing
export async function calculateExpiryDate(daysFromNow?: number): Promise<string> {
  if (daysFromNow === undefined) {
    const { LISTING_EXPIRY_DAYS } = await import('../constants');
    daysFromNow = LISTING_EXPIRY_DAYS;
  }
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

// Check if listing is expired
// For Premium plans, listings don't expire if the plan hasn't expired
// Optional currentTime parameter for real-time updates (defaults to now)
export function isListingExpired(vehicle: Vehicle, sellerPlan?: { subscriptionPlan?: string; planExpiryDate?: string }, currentTime?: Date): boolean {
  // If no listing expiry date, it's not expired
  if (!vehicle.listingExpiresAt) return false;
  
  const now = currentTime || new Date();
  
  // For Premium plans: if plan hasn't expired, listing doesn't expire
  if (sellerPlan?.subscriptionPlan === 'premium' && sellerPlan?.planExpiryDate) {
    const planExpiry = new Date(sellerPlan.planExpiryDate);
    // If plan is still active, listing is not expired
    if (planExpiry > now) {
      return false;
    }
    // If plan expired, check listing expiry
  }
  
  // For Free/Pro plans or Premium plans that expired, check listing expiry
  return new Date(vehicle.listingExpiresAt) < now;
}

// Get days until expiry
// For Premium plans, returns days until plan expiry if plan is active
// Optional currentTime parameter for real-time updates (defaults to now)
export function getDaysUntilExpiry(vehicle: Vehicle, sellerPlan?: { subscriptionPlan?: string; planExpiryDate?: string }, currentTime?: Date): number {
  const now = currentTime || new Date();
  
  // For Premium plans: if plan hasn't expired, use plan expiry date
  if (sellerPlan?.subscriptionPlan === 'premium' && sellerPlan?.planExpiryDate) {
    const planExpiry = new Date(sellerPlan.planExpiryDate);
    // If plan is still active, return days until plan expiry
    if (planExpiry > now) {
      const diffTime = planExpiry.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    }
    // If plan expired, check listing expiry
  }
  
  // For Free/Pro plans or Premium plans that expired, check listing expiry
  if (!vehicle.listingExpiresAt) return -1;
  
  const expiryDate = new Date(vehicle.listingExpiresAt);
  const diffTime = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

// Filter expired listings
export function filterExpiredListings(vehicles: Vehicle[], sellerPlan?: { subscriptionPlan?: string; planExpiryDate?: string }): Vehicle[] {
  return vehicles.filter(v => isListingExpired(v, sellerPlan));
}

// Filter active listings
export function filterActiveListings(vehicles: Vehicle[], sellerPlan?: { subscriptionPlan?: string; planExpiryDate?: string }): Vehicle[] {
  return vehicles.filter(v => !isListingExpired(v, sellerPlan) && v.status === 'published');
}

// ============================================
// AUTO-REFRESH MANAGEMENT
// ============================================

// Check if listing needs refresh
export async function needsRefresh(vehicle: Vehicle): Promise<boolean> {
  if (!vehicle.listingLastRefreshed) return true;
  
  const lastRefresh = new Date(vehicle.listingLastRefreshed);
  const daysSinceRefresh = Math.floor(
    (Date.now() - lastRefresh.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  const { AUTO_REFRESH_DAYS } = await import('../constants');
  return daysSinceRefresh >= AUTO_REFRESH_DAYS;
}

// Refresh listing (updates timestamp)
export function refreshListing(vehicle: Vehicle): Vehicle {
  return {
    ...vehicle,
    listingLastRefreshed: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ============================================
// RENEWAL MANAGEMENT
// ============================================

// Renew expired listing
export async function renewListing(vehicle: Vehicle, autoRenew: boolean = false): Promise<Vehicle> {
  const renewalCount = (vehicle.listingRenewalCount || 0) + 1;
  
  return {
    ...vehicle,
    listingExpiresAt: await calculateExpiryDate(),
    listingRenewalCount: renewalCount,
    listingAutoRenew: autoRenew,
    listingLastRefreshed: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'published',
  };
}

// Auto-renew listings that have auto-renew enabled
export async function autoRenewListings(vehicles: Vehicle[], sellerPlan?: { subscriptionPlan?: string; planExpiryDate?: string }): Promise<Vehicle[]> {
  const results = await Promise.all(vehicles.map(async vehicle => {
    if (vehicle.listingAutoRenew && isListingExpired(vehicle, sellerPlan)) {
      return await renewListing(vehicle, true);
    }
    return vehicle;
  }));
  return results;
}

// ============================================
// LISTING ANALYTICS
// ============================================

// Get listing lifecycle info
export async function getListingLifecycle(vehicle: Vehicle, sellerPlan?: { subscriptionPlan?: string; planExpiryDate?: string }): Promise<ListingLifecycle> {
  // For Premium plans, use plan expiry date if plan is active
  let expiresAt = vehicle.listingExpiresAt || await calculateExpiryDate();
  if (sellerPlan?.subscriptionPlan === 'premium' && sellerPlan?.planExpiryDate) {
    const planExpiry = new Date(sellerPlan.planExpiryDate);
    const now = new Date();
    if (planExpiry > now) {
      expiresAt = sellerPlan.planExpiryDate;
    }
  }
  
  return {
    vehicleId: vehicle.id,
    createdAt: vehicle.createdAt || new Date().toISOString(),
    expiresAt: expiresAt,
    lastRefreshedAt: vehicle.listingLastRefreshed,
    autoRenew: vehicle.listingAutoRenew || false,
    renewalCount: vehicle.listingRenewalCount || 0,
    status: isListingExpired(vehicle, sellerPlan) ? 'expired' : 'active',
  };
}

// Get listings expiring soon (within X days)
export function getExpiringListings(
  vehicles: Vehicle[],
  daysThreshold: number = 7
): Vehicle[] {
  return vehicles.filter(vehicle => {
    const daysUntilExpiry = getDaysUntilExpiry(vehicle);
    return daysUntilExpiry > 0 && daysUntilExpiry <= daysThreshold;
  });
}

// ============================================
// NOTIFICATION HELPERS
// ============================================

// Check if seller should be notified about expiry
export function shouldNotifyExpiry(vehicle: Vehicle): boolean {
  const daysUntilExpiry = getDaysUntilExpiry(vehicle);
  // Notify at 7, 3, and 1 day before expiry
  return [7, 3, 1].includes(daysUntilExpiry);
}

// Get notification message for expiry
export function getExpiryNotificationMessage(vehicle: Vehicle): string {
  const daysUntilExpiry = getDaysUntilExpiry(vehicle);
  const vehicleName = `${vehicle.make} ${vehicle.model}`;
  
  if (daysUntilExpiry === 1) {
    return `⚠️ Your listing "${vehicleName}" expires tomorrow! Renew now to keep it active.`;
  } else if (daysUntilExpiry <= 7) {
    return `⏰ Your listing "${vehicleName}" expires in ${daysUntilExpiry} days. Renew to continue receiving inquiries.`;
  } else if (daysUntilExpiry === 0) {
    return `🔴 Your listing "${vehicleName}" has expired. Renew now to make it visible again.`;
  }
  
  return `Your listing "${vehicleName}" is active.`;
}

// ============================================
// STORAGE HELPERS (LocalStorage)
// ============================================

const REFRESH_LOG_KEY = 'reride_listing_refreshes';

// Log listing refresh
export function logListingRefresh(refresh: ListingRefresh): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  try {
    const stored = localStorage.getItem(REFRESH_LOG_KEY);
    const refreshes: ListingRefresh[] = stored ? JSON.parse(stored) : [];
    
    refreshes.push(refresh);
    
    // Keep only last 100 refreshes
    const recentRefreshes = refreshes.slice(-100);
    
    localStorage.setItem(REFRESH_LOG_KEY, JSON.stringify(recentRefreshes));
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error logging refresh:', error);
    }
  }
}

// Get refresh history for a vehicle
export function getRefreshHistory(vehicleId: number): ListingRefresh[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const stored = localStorage.getItem(REFRESH_LOG_KEY);
    if (!stored) return [];
    
    const refreshes: ListingRefresh[] = JSON.parse(stored);
    return refreshes.filter(r => r.vehicleId === vehicleId);
  } catch (error) {
    console.error('Error getting refresh history:', error);
    return [];
  }
}

// ============================================
// BULK OPERATIONS
// ============================================

// Refresh multiple listings
export function bulkRefreshListings(vehicles: Vehicle[]): Vehicle[] {
  const now = new Date().toISOString();
  
  return vehicles.map(vehicle => ({
    ...vehicle,
    listingLastRefreshed: now,
    updatedAt: now,
  }));
}

// Renew multiple listings
export async function bulkRenewListings(vehicles: Vehicle[]): Promise<Vehicle[]> {
  return await Promise.all(vehicles.map(vehicle => renewListing(vehicle)));
}

