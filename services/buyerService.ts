import type { SavedSearch, BuyerActivity, Vehicle } from '../types';
import { saveBuyerActivityToSupabase, getBuyerActivityFromSupabase } from './buyerActivityService';

// Save search
export const saveSearch = (userId: string, search: Omit<SavedSearch, 'id' | 'createdAt'>): SavedSearch => {
  try {
    const searches = getSavedSearches(userId);
    const newSearch: SavedSearch = {
      ...search,
      id: `search_${Date.now()}`,
      createdAt: new Date().toISOString(),
      smsAlerts: false,
      notificationFrequency: 'instant',
    };
    searches.push(newSearch);
    localStorage.setItem(`savedSearches_${userId}`, JSON.stringify(searches));
    return newSearch;
  } catch (error) {
    console.error('Failed to save search:', error);
    throw error;
  }
};

// Get saved searches
export const getSavedSearches = (userId: string): SavedSearch[] => {
  try {
    const key = `savedSearches_${userId}`;
    const searchesJson = localStorage.getItem(key);
    return searchesJson ? JSON.parse(searchesJson) : [];
  } catch (error) {
    console.error('Failed to get saved searches:', error);
    return [];
  }
};

// Delete saved search
export const deleteSavedSearch = (userId: string, searchId: string): void => {
  try {
    const searches = getSavedSearches(userId);
    const filtered = searches.filter(s => s.id !== searchId);
    localStorage.setItem(`savedSearches_${userId}`, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete saved search:', error);
  }
};

// Update saved search
export const updateSavedSearch = (userId: string, searchId: string, updates: Partial<SavedSearch>): void => {
  try {
    const searches = getSavedSearches(userId);
    const updated = searches.map(s => s.id === searchId ? { ...s, ...updates } : s);
    localStorage.setItem(`savedSearches_${userId}`, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to update saved search:', error);
  }
};

// Match vehicles to saved search
export const matchVehiclesToSearch = (vehicles: Vehicle[], search: SavedSearch): Vehicle[] => {
  return vehicles.filter(vehicle => {
    const { filters } = search;

    // Check make
    if (filters.make && vehicle.make !== filters.make) return false;

    // Check model
    if (filters.model && vehicle.model !== filters.model) return false;

    // Check price range
    if (filters.minPrice && vehicle.price < filters.minPrice) return false;
    if (filters.maxPrice && vehicle.price > filters.maxPrice) return false;

    // Check year range
    if (filters.minYear && vehicle.year < filters.minYear) return false;
    if (filters.maxYear && vehicle.year > filters.maxYear) return false;

    // Check category
    if (filters.category && vehicle.category !== filters.category) return false;

    // Check fuel type
    if (filters.fuelType && vehicle.fuelType !== filters.fuelType) return false;

    // Check transmission
    if (filters.transmission && vehicle.transmission !== filters.transmission) return false;

    // Check location (basic city match for now)
    if (filters.location && vehicle.city !== filters.location) return false;

    return true;
  });
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
      // Save to localStorage for offline access
      const key = `buyerActivity_${userId}`;
      localStorage.setItem(key, JSON.stringify(dbResult.data));
      return dbResult.data;
    }
  } catch (error) {
    console.warn('Failed to load buyer activity from database, using localStorage:', error);
  }

  // Fallback to localStorage
  try {
    const key = `buyerActivity_${userId}`;
    const activityJson = localStorage.getItem(key);
    if (activityJson) {
      return JSON.parse(activityJson);
    }
  } catch (error) {
    console.error('Failed to parse buyer activity from localStorage:', error);
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
    const key = `buyerActivity_${userId}`;
    const activityJson = localStorage.getItem(key);
    if (activityJson) {
      return JSON.parse(activityJson);
    }
  } catch (error) {
    console.error('Failed to get buyer activity from localStorage:', error);
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
    // Save to localStorage immediately for instant UI update
    const key = `buyerActivity_${activity.userId}`;
    localStorage.setItem(key, JSON.stringify(activity));
  } catch (error) {
    console.error('Failed to save buyer activity to localStorage:', error);
  }

  // Sync to database (async, non-blocking)
  try {
    const result = await saveBuyerActivityToSupabase(activity);
    if (result.success) {
      console.log('✅ Buyer activity synced to database');
    } else {
      console.warn('⚠️ Failed to sync buyer activity to database:', result.error);
      // Add to sync queue for retry
      const { saveBuyerActivityWithSync } = await import('./syncService');
      await saveBuyerActivityWithSync(activity);
    }
  } catch (error) {
    console.warn('⚠️ Error syncing buyer activity to database:', error);
    // Add to sync queue for retry
    try {
      const { saveBuyerActivityWithSync } = await import('./syncService');
      await saveBuyerActivityWithSync(activity);
    } catch (syncError) {
      console.error('Failed to queue buyer activity for sync:', syncError);
    }
  }
};

// Track price drops (uses sync get so we can update and save without awaiting)
export const trackPriceDrop = (userId: string, vehicleId: number, _oldPrice: number, _newPrice: number): void => {
  try {
    const activity = getBuyerActivitySync(userId);
    if (!activity.notifications.priceDrops.includes(vehicleId)) {
      activity.notifications.priceDrops.push(vehicleId);
      void saveBuyerActivity(activity);
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
        trackPriceDrop(userId, vehicleId, historicalPrice, vehicle.price);
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

// Get recently viewed vehicles (sync - uses localStorage only for immediate return)
export const getRecentlyViewed = (userId: string): number[] => {
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

