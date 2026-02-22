import type { Vehicle, ListingStats } from '../types';

// Listing expiry configuration (60 days)
export const LISTING_EXPIRY_DAYS = 60;
export const LISTING_WARNING_DAYS = 7; // Warn 7 days before expiry

// Calculate days until expiry
export const getDaysUntilExpiry = (vehicle: Vehicle): number => {
  if (!vehicle.createdAt) return LISTING_EXPIRY_DAYS;
  
  const created = new Date(vehicle.createdAt);
  const now = new Date();
  const daysActive = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  return LISTING_EXPIRY_DAYS - daysActive;
};

// Check if listing is expired
export const isListingExpired = (vehicle: Vehicle): boolean => {
  return getDaysUntilExpiry(vehicle) <= 0;
};

// Check if listing is near expiry
export const isListingNearExpiry = (vehicle: Vehicle): boolean => {
  const daysLeft = getDaysUntilExpiry(vehicle);
  return daysLeft > 0 && daysLeft <= LISTING_WARNING_DAYS;
};

// Get expiry status
export const getExpiryStatus = (vehicle: Vehicle): 'active' | 'near_expiry' | 'expired' => {
  if (isListingExpired(vehicle)) return 'expired';
  if (isListingNearExpiry(vehicle)) return 'near_expiry';
  return 'active';
};

// Refresh listing (bump to top)
export const refreshListing = (vehicle: Vehicle): Vehicle => {
  return {
    ...vehicle,
    listingLastRefreshed: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

// Renew listing (extend expiry)
export const renewListing = (vehicle: Vehicle): Vehicle => {
  return {
    ...vehicle,
    createdAt: new Date().toISOString(),
    listingExpiresAt: new Date(Date.now() + LISTING_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    listingLastRefreshed: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    listingStatus: 'active',
  };
};

// Auto-expire listings
export const autoExpireListings = (vehicles: Vehicle[]): Vehicle[] => {
  return vehicles.map(vehicle => {
    if (vehicle.status === 'published' && isListingExpired(vehicle)) {
      return {
        ...vehicle,
        listingStatus: 'expired',
        status: 'unpublished',
      };
    }
    return vehicle;
  });
};

// Calculate days active
export const getDaysActive = (vehicle: Vehicle): number => {
  if (vehicle.daysActive !== undefined) return vehicle.daysActive;
  if (!vehicle.createdAt) return 0;
  
  const created = new Date(vehicle.createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
};

// Format listing age
export const formatListingAge = (vehicle: Vehicle): string => {
  const days = getDaysActive(vehicle);
  
  if (days === 0) return 'Posted today';
  if (days === 1) return 'Posted yesterday';
  if (days < 7) return `Posted ${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `Posted ${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  }
  const months = Math.floor(days / 30);
  return `Posted ${months} ${months === 1 ? 'month' : 'months'} ago`;
};

// Track phone view
export const trackPhoneView = (vehicleId: number): void => {
  try {
    const key = `phoneViews_${vehicleId}`;
    const currentViews = parseInt(localStorage.getItem(key) || '0', 10);
    localStorage.setItem(key, (currentViews + 1).toString());
  } catch (error) {
    console.error('Failed to track phone view:', error);
  }
};

// Get phone views count
export const getPhoneViews = (vehicleId: number): number => {
  try {
    const key = `phoneViews_${vehicleId}`;
    return parseInt(localStorage.getItem(key) || '0', 10);
  } catch (error) {
    return 0;
  }
};

// Track vehicle share
export const trackShare = (vehicleId: number, platform: 'whatsapp' | 'facebook' | 'twitter' | 'copy'): void => {
  try {
    const key = `shares_${vehicleId}`;
    const sharesJson = localStorage.getItem(key);
    const shares = sharesJson ? JSON.parse(sharesJson) : {};
    shares[platform] = (shares[platform] || 0) + 1;
    shares.total = (shares.total || 0) + 1;
    localStorage.setItem(key, JSON.stringify(shares));
  } catch (error) {
    console.error('Failed to track share:', error);
  }
};

// Get share count
export const getShareCount = (vehicleId: number): number => {
  try {
    const key = `shares_${vehicleId}`;
    const sharesJson = localStorage.getItem(key);
    if (!sharesJson) return 0;
    const shares = JSON.parse(sharesJson);
    return shares.total || 0;
  } catch (error) {
    return 0;
  }
};

// Calculate best price indicator
export const calculateBestPrice = (vehicle: Vehicle, allVehicles: Vehicle[]): boolean => {
  // Find similar vehicles (same make, model, similar year)
  const similarVehicles = allVehicles.filter(v => 
    v.id !== vehicle.id &&
    v.make === vehicle.make &&
    v.model === vehicle.model &&
    Math.abs(v.year - vehicle.year) <= 2 &&
    v.status === 'published'
  );

  if (similarVehicles.length === 0) return false;

  // Calculate average price
  const avgPrice = similarVehicles.reduce((sum, v) => sum + v.price, 0) / similarVehicles.length;

  // Best price if 10% or more below average
  return vehicle.price <= avgPrice * 0.9;
};

// Quality score calculation
export const calculateListingQuality = (vehicle: Vehicle): number => {
  let score = 0;

  // Images (30 points)
  const imageCount = vehicle.images?.length || 0;
  if (imageCount >= 8) score += 30;
  else if (imageCount >= 5) score += 25;
  else if (imageCount >= 3) score += 15;
  else if (imageCount >= 1) score += 5;

  // Description (20 points)
  const descLength = vehicle.description?.length || 0;
  if (descLength >= 200) score += 20;
  else if (descLength >= 100) score += 15;
  else if (descLength >= 50) score += 10;
  else if (descLength > 0) score += 5;

  // Features (15 points)
  const featureCount = vehicle.features?.length || 0;
  if (featureCount >= 8) score += 15;
  else if (featureCount >= 5) score += 10;
  else if (featureCount >= 3) score += 5;

  // Documents (15 points)
  const docCount = vehicle.documents?.length || 0;
  if (docCount >= 3) score += 15;
  else if (docCount >= 2) score += 10;
  else if (docCount >= 1) score += 5;

  // Service records (10 points)
  const serviceCount = vehicle.serviceRecords?.length || 0;
  if (serviceCount >= 3) score += 10;
  else if (serviceCount >= 1) score += 5;

  // Video (5 points)
  if (vehicle.videoUrl) score += 5;

  // Certification (5 points)
  if (vehicle.certificationStatus === 'approved') score += 5;

  return Math.min(score, 100);
};

// Get listing quality level
export const getListingQualityLevel = (score: number): 'low' | 'medium' | 'high' => {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
};

// Listing stats aggregation
export const aggregateListingStats = (vehicleId: number): ListingStats => {
  const today = new Date().toISOString().split('T')[0];
  
  return {
    vehicleId,
    date: today,
    views: 0, // Would be tracked by the backend
    uniqueViews: 0,
    phoneViews: getPhoneViews(vehicleId),
    chatStarts: 0, // Would be tracked from conversations
    shares: getShareCount(vehicleId),
    favorites: 0, // Would be tracked from wishlists
  };
};

// Sort vehicles by various criteria
export const sortVehicles = (
  vehicles: Vehicle[],
  sortBy: 'newest' | 'oldest' | 'price_low' | 'price_high' | 'most_viewed'
): Vehicle[] => {
  const sorted = [...vehicles];

  switch (sortBy) {
    case 'newest':
      return sorted.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.updatedAt || 0).getTime();
        const dateB = new Date(b.createdAt || b.updatedAt || 0).getTime();
        return dateB - dateA;
      });

    case 'oldest':
      return sorted.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.updatedAt || 0).getTime();
        const dateB = new Date(b.createdAt || b.updatedAt || 0).getTime();
        return dateA - dateB;
      });

    case 'price_low':
      return sorted.sort((a, b) => a.price - b.price);

    case 'price_high':
      return sorted.sort((a, b) => b.price - a.price);

    case 'most_viewed':
      return sorted.sort((a, b) => (b.views || 0) - (a.views || 0));

    default:
      return sorted;
  }
};

// Filter by budget presets
export const BUDGET_PRESETS = [
  { label: 'Under ₹3 Lakh', min: 0, max: 300000 },
  { label: '₹3-5 Lakh', min: 300000, max: 500000 },
  { label: '₹5-8 Lakh', min: 500000, max: 800000 },
  { label: '₹8-12 Lakh', min: 800000, max: 1200000 },
  { label: '₹12-20 Lakh', min: 1200000, max: 2000000 },
  { label: 'Above ₹20 Lakh', min: 2000000, max: Infinity },
];

export const filterByBudget = (vehicles: Vehicle[], budgetRange: { min: number; max: number }): Vehicle[] => {
  return vehicles.filter(v => v.price >= budgetRange.min && v.price <= budgetRange.max);
};

