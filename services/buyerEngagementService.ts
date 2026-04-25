import type {
  SavedSearch,
  PriceDropAlert,
  FollowedSeller,
  Vehicle,
  SearchFilters,
} from '../types';
import { vehicleMatchesSearchFilters } from './savedSearchMatch';

// ============================================
// SAVED SEARCHES
// Per-user key; each row serializes without `userId` (rehydrate on read).
// ============================================

const LEGACY_SAVED_SEARCHES_KEY = 'reride_saved_searches';
const BUCKET_PREFIX = 'reride_ssb_';

type StoredSearchRow = Omit<SavedSearch, 'userId'>;

function buildBucketKey(userId: string): string {
  return BUCKET_PREFIX + btoa(encodeURIComponent(userId)).replace(/=+$/, '');
}

function userIdFromBucketKey(key: string): string {
  if (!key.startsWith(BUCKET_PREFIX)) return '';
  const b = key.slice(BUCKET_PREFIX.length);
  try {
    // eslint-disable-next-line deprecation/deprecation
    return decodeURIComponent(escape(atob(b)));
  } catch {
    return '';
  }
}

function rehydrate(rows: StoredSearchRow[], userId: string): SavedSearch[] {
  return rows.map((r) => ({ ...r, userId }));
}

function dehydrate(list: SavedSearch[]): StoredSearchRow[] {
  return list.map(({ userId: _u, ...rest }) => rest as StoredSearchRow);
}

function writeUserBucket(userId: string, list: SavedSearch[]): void {
  if (typeof localStorage === 'undefined') return;
  const key = buildBucketKey(userId);
  if (list.length === 0) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return;
  }
  localStorage.setItem(key, JSON.stringify(dehydrate(list)));
}

let legacySavedSearchesMigrated = false;

function migrateSavedSearchesFromLegacy(): void {
  if (typeof localStorage === 'undefined' || legacySavedSearchesMigrated) {
    return;
  }
  const raw = localStorage.getItem(LEGACY_SAVED_SEARCHES_KEY);
  if (!raw) {
    legacySavedSearchesMigrated = true;
    return;
  }
  try {
    const all: SavedSearch[] = JSON.parse(raw);
    if (!Array.isArray(all) || all.length === 0) {
      localStorage.removeItem(LEGACY_SAVED_SEARCHES_KEY);
      legacySavedSearchesMigrated = true;
      return;
    }
    const byUser = new Map<string, SavedSearch[]>();
    for (const s of all) {
      const uid = s.userId ? String(s.userId) : '';
      if (!uid) continue;
      if (!byUser.has(uid)) byUser.set(uid, []);
      byUser.get(uid)!.push(s);
    }
    for (const [uid, fromLegacy] of byUser) {
      const bucket = buildBucketKey(uid);
      const rawB = localStorage.getItem(bucket);
      const existingList: SavedSearch[] = rawB
        ? rehydrate(JSON.parse(rawB) as StoredSearchRow[], uid)
        : [];
      const merged = new Map<string, SavedSearch>();
      for (const x of existingList) merged.set(x.id, x);
      for (const x of fromLegacy) merged.set(x.id, { ...x, userId: uid });
      writeUserBucket(uid, Array.from(merged.values()));
    }
    localStorage.removeItem(LEGACY_SAVED_SEARCHES_KEY);
  } catch {
    /* leave legacy for next attempt */
  }
  legacySavedSearchesMigrated = true;
}

export function importSavedSearchIfNewForUser(userId: string, search: SavedSearch): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  migrateSavedSearchesFromLegacy();
  const cur = getSavedSearches(userId);
  if (cur.some((x) => x.id === search.id)) {
    return;
  }
  writeUserBucket(userId, [...cur, { ...search, userId }]);
}

// Helper to check if localStorage is available
const isLocalStorageAvailable = (): boolean => {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
};

// Save a search
export function saveSearch(userId: string, name: string, filters: SearchFilters, emailAlerts: boolean = true): SavedSearch {
  if (!isLocalStorageAvailable()) {
    // Return a minimal search object if localStorage is not available
    return {
      id: `search_${Date.now()}`,
      userId,
      name,
      filters,
      emailAlerts,
      smsAlerts: false,
      notificationFrequency: 'instant',
      createdAt: new Date().toISOString(),
    };
  }
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      throw new Error('localStorage is not available');
    }
    migrateSavedSearchesFromLegacy();
    const newSearch: SavedSearch = {
      id: `search_${Date.now()}`,
      userId,
      name,
      filters,
      emailAlerts,
      smsAlerts: false,
      notificationFrequency: 'instant',
      createdAt: new Date().toISOString(),
    };
    const cur = getSavedSearches(userId);
    writeUserBucket(userId, [...cur, newSearch]);
    return newSearch;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error saving search:', error);
    }
    throw error;
  }
}

// Get saved searches for a user
export function getSavedSearches(userId: string): SavedSearch[] {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return [];
    }
    migrateSavedSearchesFromLegacy();
    const raw = localStorage.getItem(buildBucketKey(userId));
    if (!raw) {
      return [];
    }
    const rows: StoredSearchRow[] = JSON.parse(raw);
    return rehydrate(rows, userId);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error getting saved searches:', error);
    }
    return [];
  }
}

// Delete a saved search
export function deleteSavedSearch(searchId: string): void {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
    migrateSavedSearchesFromLegacy();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(BUCKET_PREFIX)) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const uid = userIdFromBucketKey(k);
      if (!uid) continue;
      const rows: StoredSearchRow[] = JSON.parse(raw);
      if (!rows.some((r) => r.id === searchId)) continue;
      const list = rehydrate(rows, uid).filter((s) => s.id !== searchId);
      writeUserBucket(uid, list);
      return;
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error deleting saved search:', error);
    }
    throw error;
  }
}

// Update saved search
export function updateSavedSearch(searchId: string, updates: Partial<SavedSearch>): void {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
    migrateSavedSearchesFromLegacy();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(BUCKET_PREFIX)) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const userIdB = userIdFromBucketKey(k);
      if (!userIdB) continue;
      const rows: StoredSearchRow[] = JSON.parse(raw);
      const index = rows.findIndex((r) => r.id === searchId);
      if (index === -1) continue;
      const list = rehydrate(rows, userIdB);
      list[index] = { ...list[index], ...updates, id: searchId, userId: userIdB };
      writeUserBucket(userIdB, list);
      return;
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error updating saved search:', error);
    }
    throw error;
  }
}

// Check if vehicles match saved search
export function matchesSavedSearch(vehicle: Vehicle, search: SavedSearch): boolean {
  return vehicleMatchesSearchFilters(vehicle, search.filters);
}

// Find new matches for saved searches
export function findNewMatches(vehicles: Vehicle[], search: SavedSearch): Vehicle[] {
  return vehicles.filter((v) => {
    if (v.status !== 'published') return false;
    return matchesSavedSearch(v, search);
  });
}

// ============================================
// PRICE DROP ALERTS
// ============================================

const PRICE_DROP_ALERTS_KEY = 'reride_price_drop_alerts';
const VEHICLE_PRICE_HISTORY_KEY = 'reride_price_history';

// Track price change
export function trackPriceChange(vehicleId: number, oldPrice: number, newPrice: number): void {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
    const stored = localStorage.getItem(VEHICLE_PRICE_HISTORY_KEY);
    const history: Record<string, Array<{ price: number; date: string }>> = stored ? JSON.parse(stored) : {};
    
    if (!history[vehicleId]) {
      history[vehicleId] = [];
    }
    
    history[vehicleId].push({
      price: newPrice,
      date: new Date().toISOString(),
    });
    
    // Keep only last 50 price changes per vehicle
    if (history[vehicleId].length > 50) {
      history[vehicleId] = history[vehicleId].slice(-50);
    }
    
    localStorage.setItem(VEHICLE_PRICE_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error tracking price change:', error);
    }
  }
}

// Create price drop alert
export function createPriceDropAlert(
  userId: string,
  vehicleId: number,
  originalPrice: number,
  currentPrice: number
): PriceDropAlert {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      throw new Error('localStorage is not available');
    }
    const stored = localStorage.getItem(PRICE_DROP_ALERTS_KEY);
    const alerts: PriceDropAlert[] = stored ? JSON.parse(stored) : [];
    
    const percentageDropped = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
    
    const newAlert: PriceDropAlert = {
      id: `alert_${Date.now()}`,
      userId,
      vehicleId,
      originalPrice,
      currentPrice,
      percentageDropped,
      notified: false,
      createdAt: new Date().toISOString(),
    };
    
    alerts.push(newAlert);
    localStorage.setItem(PRICE_DROP_ALERTS_KEY, JSON.stringify(alerts));
    
    return newAlert;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error creating price drop alert:', error);
    }
    throw error;
  }
}

// Get price drop alerts for user
export function getPriceDropAlerts(userId: string, onlyUnnotified: boolean = false): PriceDropAlert[] {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return [];
    }
    const stored = localStorage.getItem(PRICE_DROP_ALERTS_KEY);
    if (!stored) return [];
    
    const alerts: PriceDropAlert[] = JSON.parse(stored);
    const userAlerts = alerts.filter(a => a.userId === userId);
    
    if (onlyUnnotified) {
      return userAlerts.filter(a => !a.notified);
    }
    
    return userAlerts;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error getting price drop alerts:', error);
    }
    return [];
  }
}

// Mark alert as notified
export function markAlertNotified(alertId: string): void {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
    const stored = localStorage.getItem(PRICE_DROP_ALERTS_KEY);
    if (!stored) return;
    
    const alerts: PriceDropAlert[] = JSON.parse(stored);
    const index = alerts.findIndex(a => a.id === alertId);
    
    if (index !== -1) {
      alerts[index].notified = true;
      localStorage.setItem(PRICE_DROP_ALERTS_KEY, JSON.stringify(alerts));
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error marking alert as notified:', error);
    }
  }
}

// Check for price drops in wishlist
export function checkWishlistPriceDrops(wishlist: number[], vehicles: Vehicle[], userId: string): PriceDropAlert[] {
  const alerts: PriceDropAlert[] = [];
  
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return alerts;
    }
    const priceHistory = localStorage.getItem(VEHICLE_PRICE_HISTORY_KEY);
    if (!priceHistory) return alerts;
    
    const history: Record<string, Array<{ price: number; date: string }>> = JSON.parse(priceHistory);
    
    wishlist.forEach(vehicleId => {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (!vehicle) return;
      
      const vehicleHistory = history[vehicleId];
      if (!vehicleHistory || vehicleHistory.length < 2) return;
      
      const previousPrice = vehicleHistory[vehicleHistory.length - 2].price;
      const currentPrice = vehicle.price;
      
      if (currentPrice < previousPrice) {
        const percentDrop = ((previousPrice - currentPrice) / previousPrice) * 100;
        
        // Only alert if drop is at least 5%
        if (percentDrop >= 5) {
          const alert = createPriceDropAlert(userId, vehicleId, previousPrice, currentPrice);
          alerts.push(alert);
        }
      }
    });
    
    return alerts;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error checking wishlist price drops:', error);
    }
    return alerts;
  }
}

// ============================================
// FOLLOWED SELLERS
// ============================================

const FOLLOWED_SELLERS_KEY = 'reride_followed_sellers';

// Follow a seller
export function followSeller(userId: string, sellerEmail: string, notifyOnNewListing: boolean = true): FollowedSeller {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      throw new Error('localStorage is not available');
    }
    const stored = localStorage.getItem(FOLLOWED_SELLERS_KEY);
    const follows: FollowedSeller[] = stored ? JSON.parse(stored) : [];
    
    // Check if already following
    const existing = follows.find(f => f.userId === userId && f.sellerEmail === sellerEmail);
    if (existing) {
      return existing;
    }
    
    const newFollow: FollowedSeller = {
      id: `follow_${Date.now()}`,
      userId,
      sellerEmail,
      followedAt: new Date().toISOString(),
      notifyOnNewListing,
    };
    
    follows.push(newFollow);
    localStorage.setItem(FOLLOWED_SELLERS_KEY, JSON.stringify(follows));
    
    return newFollow;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error following seller:', error);
    }
    throw error;
  }
}

// Unfollow a seller
export function unfollowSeller(userId: string, sellerEmail: string): void {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
    const stored = localStorage.getItem(FOLLOWED_SELLERS_KEY);
    if (!stored) return;
    
    const follows: FollowedSeller[] = JSON.parse(stored);
    const filtered = follows.filter(f => !(f.userId === userId && f.sellerEmail === sellerEmail));
    
    localStorage.setItem(FOLLOWED_SELLERS_KEY, JSON.stringify(filtered));
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error unfollowing seller:', error);
    }
    throw error;
  }
}

// Get followed sellers for user
export function getFollowedSellers(userId: string): FollowedSeller[] {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return [];
    }
    const stored = localStorage.getItem(FOLLOWED_SELLERS_KEY);
    if (!stored) return [];
    
    const follows: FollowedSeller[] = JSON.parse(stored);
    return follows.filter(f => f.userId === userId);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error getting followed sellers:', error);
    }
    return [];
  }
}

// Get all followers of a seller (users who follow this seller)
export function getFollowersOfSeller(sellerEmail: string): FollowedSeller[] {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return [];
    }
    const stored = localStorage.getItem(FOLLOWED_SELLERS_KEY);
    if (!stored) return [];

    const follows: FollowedSeller[] = JSON.parse(stored);
    return follows.filter(f => f.sellerEmail === sellerEmail);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error getting followers of seller:', error);
    }
    return [];
  }
}

// Convenience: count followers for a seller
export function getFollowersCount(sellerEmail: string): number {
  return getFollowersOfSeller(sellerEmail).length;
}

// Convenience: count how many sellers a user is following
export function getFollowingCount(userId: string): number {
  return getFollowedSellers(userId).length;
}

// Check if user is following a seller
export function isFollowingSeller(userId: string, sellerEmail: string): boolean {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return false;
    }
    const stored = localStorage.getItem(FOLLOWED_SELLERS_KEY);
    if (!stored) return false;
    
    const follows: FollowedSeller[] = JSON.parse(stored);
    return follows.some(f => f.userId === userId && f.sellerEmail === sellerEmail);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error checking if following seller:', error);
    }
    return false;
  }
}

// Get new listings from followed sellers
export function getNewListingsFromFollowedSellers(
  userId: string,
  vehicles: Vehicle[],
  since?: string
): Vehicle[] {
  try {
    const followedSellers = getFollowedSellers(userId);
    const sellerEmails = followedSellers.map(f => f.sellerEmail);
    
    return vehicles.filter(v => {
      if (v.status !== 'published') return false;
      if (!sellerEmails.includes(v.sellerEmail)) return false;
      
      // If since date provided, only return vehicles created after that date
      if (since && v.createdAt) {
        return new Date(v.createdAt) > new Date(since);
      }
      
      return true;
    });
  } catch (error) {
    console.error('Error getting new listings from followed sellers:', error);
    return [];
  }
}

// ============================================
// ENGAGEMENT ANALYTICS
// ============================================

// Get engagement summary for user
export function getUserEngagementSummary(userId: string) {
  return {
    savedSearches: getSavedSearches(userId).length,
    followedSellers: getFollowedSellers(userId).length,
    priceDropAlerts: getPriceDropAlerts(userId, true).length,
  };
}

