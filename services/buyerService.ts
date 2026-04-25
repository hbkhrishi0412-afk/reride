import type { SavedSearch, BuyerActivity, Vehicle } from '../types';
import { saveBuyerActivityToSupabase, getBuyerActivityFromSupabase } from './buyerActivityService';
import { saveBuyerActivityWithSync } from './syncService';
import { vehicleMatchesSearchFilters } from './savedSearchMatch';
import {
  saveSearch as engagementSaveSearch,
  getSavedSearches as engagementGetSavedSearches,
  deleteSavedSearch as engagementDeleteSavedSearch,
  updateSavedSearch as engagementUpdateSavedSearch,
  importSavedSearchIfNewForUser,
} from './buyerEngagementService';

const LEGACY_SAVED_KEY_PREFIX = 'savedSearches_';

function buyerActivityKey(userId: string): string {
  return `buyerActivity_${userId}`;
}

/** Session-scoped cache (avoids long-lived PII in localStorage; CodeQL). Migrates legacy localStorage once. */
function readBuyerActivityJson(userId: string): string | null {
  if (typeof window === 'undefined') return null;
  const key = buyerActivityKey(userId);
  try {
    if (typeof sessionStorage !== 'undefined') {
      const s = sessionStorage.getItem(key);
      if (s) return s;
    }
    if (typeof localStorage !== 'undefined') {
      const l = localStorage.getItem(key);
      if (l) {
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(key, l);
            localStorage.removeItem(key);
          }
        } catch {
          /* ignore */
        }
        return l;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeBuyerActivityJson(userId: string, json: string): void {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(buyerActivityKey(userId), json);
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(buyerActivityKey(userId));
    } catch {
      /* ignore */
    }
  } catch (e) {
    console.error('Failed to save buyer activity to sessionStorage:', e);
  }
}

function migrateLegacySavedSearchesIfNeeded(userId: string): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  const legacyKey = `${LEGACY_SAVED_KEY_PREFIX}${userId}`;
  const raw = localStorage.getItem(legacyKey);
  if (!raw) return;
  try {
    const legacy: SavedSearch[] = JSON.parse(raw);
    if (!Array.isArray(legacy) || legacy.length === 0) {
      localStorage.removeItem(legacyKey);
      return;
    }
    const existing = engagementGetSavedSearches(userId);
    const existingIds = new Set(existing.map((s) => s.id));
    for (const s of legacy) {
      if (!s?.id || existingIds.has(s.id)) continue;
      const merged: SavedSearch = { ...s, userId: s.userId || userId };
      merged.filters = { ...merged.filters, location: undefined };
      importSavedSearchIfNewForUser(merged.userId, merged);
      existingIds.add(s.id);
    }
    localStorage.removeItem(legacyKey);
  } catch {
    /* ignore corrupt legacy */
  }
}

/** Same storage as listings (`reride_saved_searches`); migrates old `savedSearches_<email>` once. */
export const getSavedSearches = (userId: string): SavedSearch[] => {
  migrateLegacySavedSearchesIfNeeded(userId);
  return engagementGetSavedSearches(userId);
};

export const saveSearch = (userId: string, search: Omit<SavedSearch, 'id' | 'createdAt'>): SavedSearch => {
  migrateLegacySavedSearchesIfNeeded(userId);
  const created = engagementSaveSearch(userId, search.name, search.filters, search.emailAlerts);
  if (search.smsAlerts !== undefined || search.notificationFrequency !== undefined) {
    engagementUpdateSavedSearch(created.id, {
      smsAlerts: search.smsAlerts ?? created.smsAlerts,
      notificationFrequency: search.notificationFrequency ?? created.notificationFrequency,
    });
  }
  return getSavedSearches(userId).find((s) => s.id === created.id) ?? created;
};

export const deleteSavedSearch = (userId: string, searchId: string): void => {
  migrateLegacySavedSearchesIfNeeded(userId);
  if (!engagementGetSavedSearches(userId).some((s) => s.id === searchId)) return;
  engagementDeleteSavedSearch(searchId);
};

export const updateSavedSearch = (userId: string, searchId: string, updates: Partial<SavedSearch>): void => {
  migrateLegacySavedSearchesIfNeeded(userId);
  if (!engagementGetSavedSearches(userId).some((s) => s.id === searchId)) return;
  engagementUpdateSavedSearch(searchId, updates);
};

// Match vehicles to saved search
export const matchVehiclesToSearch = (vehicles: Vehicle[], search: SavedSearch): Vehicle[] => {
  return vehicles.filter((vehicle) => vehicleMatchesSearchFilters(vehicle, search.filters));
};

// Find new matches for all saved searches
export const findNewMatches = (userId: string, vehicles: Vehicle[]): { searchId: string; matches: Vehicle[] }[] => {
  const searches = getSavedSearches(userId);
  return searches.map(search => ({
    searchId: search.id,
    matches: matchVehiclesToSearch(vehicles, search),
  }));
};

// Get buyer activity - loads from database first, falls back to localStorage
export const getBuyerActivity = async (userId: string): Promise<BuyerActivity> => {
  try {
    // Try to load from database first
    const dbResult = await getBuyerActivityFromSupabase(userId);
    if (dbResult.success && dbResult.data) {
      writeBuyerActivityJson(userId, JSON.stringify(dbResult.data));
      return dbResult.data;
    }
  } catch (error) {
    console.warn('Failed to load buyer activity from database, using localStorage:', error);
  }

  try {
    const activityJson = readBuyerActivityJson(userId);
    if (activityJson) {
      return JSON.parse(activityJson);
    }
  } catch (error) {
    console.error('Failed to parse buyer activity from session storage:', error);
  }

  // Create default activity
  const defaultActivity: BuyerActivity = {
    userId,
    recentlyViewed: [],
    savedSearches: getSavedSearches(userId),
    notifications: {
      priceDrops: [],
      newMatches: [],
    },
  };
  return defaultActivity;
};

// Synchronous version for immediate access (uses localStorage only)
export const getBuyerActivitySync = (userId: string): BuyerActivity => {
  try {
    const activityJson = readBuyerActivityJson(userId);
    if (activityJson) {
      return JSON.parse(activityJson);
    }
  } catch (error) {
    console.error('Failed to get buyer activity from session storage:', error);
  }

  // Create default activity
  const defaultActivity: BuyerActivity = {
    userId,
    recentlyViewed: [],
    savedSearches: getSavedSearches(userId),
    notifications: {
      priceDrops: [],
      newMatches: [],
    },
  };
  return defaultActivity;
};

// Save buyer activity - saves to localStorage immediately, syncs to database
export const saveBuyerActivity = async (activity: BuyerActivity): Promise<void> => {
  try {
    writeBuyerActivityJson(activity.userId, JSON.stringify(activity));
  } catch (error) {
    console.error('Failed to save buyer activity to session storage:', error);
  }

  // Sync to database (async, non-blocking)
  try {
    const result = await saveBuyerActivityToSupabase(activity);
    if (result.success) {
      console.log('✅ Buyer activity synced to database');
    } else {
      console.warn('⚠️ Failed to sync buyer activity to database:', result.error);
      // Add to sync queue for retry
      await saveBuyerActivityWithSync(activity);
    }
  } catch (error) {
    console.warn('⚠️ Error syncing buyer activity to database:', error);
    // Add to sync queue for retry
    try {
      await saveBuyerActivityWithSync(activity);
    } catch (syncError) {
      console.error('Failed to queue buyer activity for sync:', syncError);
    }
  }
};

export const RERIDE_PRICE_DROP_EVENT = 'reride-price-drop';

export type ReridePriceDropDetail = {
  userId: string;
  vehicleId: number;
  oldPrice: number;
  newPrice: number;
};

// Track price drops (async: load activity, update, then save)
export const trackPriceDrop = async (userId: string, vehicleId: number, oldPrice: number, newPrice: number): Promise<void> => {
  try {
    const activity = await getBuyerActivity(userId);
    if (!activity.notifications.priceDrops.includes(vehicleId)) {
      activity.notifications.priceDrops.push(vehicleId);
      await saveBuyerActivity(activity);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent<ReridePriceDropDetail>(RERIDE_PRICE_DROP_EVENT, {
            detail: { userId, vehicleId, oldPrice, newPrice },
          }),
        );
      }
    }
  } catch (error) {
    console.error('Failed to track price drop:', error);
  }
};

// Check for price drops in wishlist
export const checkPriceDrops = (
  userId: string,
  wishlist: number[],
  vehicles: Vehicle[]
): { vehicleId: number; oldPrice: number; newPrice: number }[] => {
  try {
    const priceHistory = getPriceHistory();
    const drops: { vehicleId: number; oldPrice: number; newPrice: number }[] = [];

    wishlist.forEach(vehicleId => {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (!vehicle) return;

      const historicalPrice = priceHistory[vehicleId];
      if (historicalPrice && vehicle.price < historicalPrice) {
        drops.push({
          vehicleId,
          oldPrice: historicalPrice,
          newPrice: vehicle.price,
        });
        // Track the drop
        void trackPriceDrop(userId, vehicleId, historicalPrice, vehicle.price);
      }

      // Update price history
      priceHistory[vehicleId] = vehicle.price;
    });

    savePriceHistory(priceHistory);
    return drops;
  } catch (error) {
    console.error('Failed to check price drops:', error);
    return [];
  }
};

// Price history management
const getPriceHistory = (): Record<number, number> => {
  try {
    const historyJson = localStorage.getItem('vehiclePriceHistory');
    return historyJson ? JSON.parse(historyJson) : {};
  } catch (error) {
    return {};
  }
};

const savePriceHistory = (history: Record<number, number>): void => {
  try {
    localStorage.setItem('vehiclePriceHistory', JSON.stringify(history));
  } catch (error) {
    console.error('Failed to save price history:', error);
  }
};

// Update price in history
export const updatePriceHistory = (vehicleId: number, price: number): void => {
  const history = getPriceHistory();
  history[vehicleId] = price;
  savePriceHistory(history);
};

// Clear old price drops
export const clearPriceDropNotifications = (userId: string, vehicleIds: number[]): void => {
  try {
    const activity = getBuyerActivitySync(userId);
    activity.notifications.priceDrops = activity.notifications.priceDrops.filter(
      (id: number) => !vehicleIds.includes(id)
    );
    void saveBuyerActivity(activity);
  } catch (error) {
    console.error('Failed to clear price drop notifications:', error);
  }
};

// Get recently viewed vehicle IDs (async - loads from DB first, then returns array)
export const getRecentlyViewed = async (userId: string): Promise<number[]> => {
  try {
    const activity = await getBuyerActivity(userId);
    return activity?.recentlyViewed ?? [];
  } catch (error) {
    console.error('Failed to get recently viewed:', error);
    return [];
  }
};

// Sync version for immediate localStorage-only access (e.g. when you already have activity)
export const getRecentlyViewedSync = (userId: string): number[] => {
  try {
    const activity = getBuyerActivitySync(userId);
    return activity.recentlyViewed || [];
  } catch (error) {
    return [];
  }
};

// Add to recently viewed - uses sync version for immediate access
export const addToRecentlyViewed = async (userId: string, vehicleId: number): Promise<void> => {
  try {
    // Use sync version for immediate access
    const activity = getBuyerActivitySync(userId);
    
    // Remove if already exists
    activity.recentlyViewed = activity.recentlyViewed.filter(id => id !== vehicleId);
    
    // Add to beginning
    activity.recentlyViewed.unshift(vehicleId);
    
    // Keep only last 20
    activity.recentlyViewed = activity.recentlyViewed.slice(0, 20);
    
    // Save (async, will sync to database)
    await saveBuyerActivity(activity);
  } catch (error) {
    console.error('Failed to add to recently viewed:', error);
  }
};

