// Utility function to enrich vehicle data with seller information
import { Vehicle, User } from '../types';

/**
 * Enriches vehicle data with seller information from users array
 * @param vehicles Array of vehicles
 * @param users Array of users
 * @returns Array of vehicles with populated seller names
 */
export const enrichVehiclesWithSellerInfo = (vehicles: Vehicle[], users: User[]): Vehicle[] => {
  // Defensive checks to prevent production crashes
  if (!vehicles || !Array.isArray(vehicles)) return [];
  if (!users || !Array.isArray(users)) return vehicles || [];
  
  return vehicles.map(vehicle => {
    if (!vehicle || !vehicle.sellerEmail) {
      // Return vehicle with defaults if sellerEmail is missing
      return {
        ...vehicle,
        sellerName: vehicle?.sellerName || 'Seller',
        sellerBadges: vehicle?.sellerBadges || [],
        sellerAverageRating: vehicle?.sellerAverageRating || 0,
        sellerRatingCount: vehicle?.sellerRatingCount || 0
      };
    }
    
    // Normalize emails for case-insensitive comparison (critical for production)
    const normalizedVehicleEmail = (vehicle.sellerEmail || '').toLowerCase().trim();
    
    // Find the seller user by email with normalization
    const seller = users.find(user => {
      if (!user || !user.email) return false;
      const normalizedUserEmail = (user.email || '').toLowerCase().trim();
      return normalizedUserEmail === normalizedVehicleEmail;
    });
    
    if (seller) {
      return {
        ...vehicle,
        sellerName: seller.name || seller.dealershipName || 'Seller',
        sellerBadges: seller.badges || [],
        sellerAverageRating: seller.averageRating || 0,
        sellerRatingCount: seller.ratingCount || 0
      };
    }
    
    // If seller not found, use fallback
    return {
      ...vehicle,
      sellerName: vehicle.sellerName || 'Seller',
      sellerBadges: vehicle.sellerBadges || [],
      sellerAverageRating: vehicle.sellerAverageRating || 0,
      sellerRatingCount: vehicle.sellerRatingCount || 0
    };
  });
};

/**
 * Enriches a single vehicle with seller information
 * @param vehicle Single vehicle
 * @param users Array of users
 * @returns Vehicle with populated seller information
 */
export const enrichVehicleWithSellerInfo = (vehicle: Vehicle, users: User[]): Vehicle => {
  // Defensive checks
  if (!vehicle) {
    return {
      sellerName: 'Seller',
      sellerBadges: [],
      sellerAverageRating: 0,
      sellerRatingCount: 0
    } as Vehicle;
  }
  
  if (!users || !Array.isArray(users) || !vehicle.sellerEmail) {
    return {
      ...vehicle,
      sellerName: vehicle.sellerName || 'Seller',
      sellerBadges: vehicle.sellerBadges || [],
      sellerAverageRating: vehicle.sellerAverageRating || 0,
      sellerRatingCount: vehicle.sellerRatingCount || 0
    };
  }
  
  // Normalize emails for case-insensitive comparison
  const normalizedVehicleEmail = (vehicle.sellerEmail || '').toLowerCase().trim();
  
  const seller = users.find(user => {
    if (!user || !user.email) return false;
    const normalizedUserEmail = (user.email || '').toLowerCase().trim();
    return normalizedUserEmail === normalizedVehicleEmail;
  });
  
  if (seller) {
    return {
      ...vehicle,
      sellerName: seller.name || seller.dealershipName || 'Seller',
      sellerBadges: seller.badges || [],
      sellerAverageRating: seller.averageRating || 0,
      sellerRatingCount: seller.ratingCount || 0
    };
  }
  
  return {
    ...vehicle,
    sellerName: vehicle.sellerName || 'Seller',
    sellerBadges: vehicle.sellerBadges || [],
    sellerAverageRating: vehicle.sellerAverageRating || 0,
    sellerRatingCount: vehicle.sellerRatingCount || 0
  };
};
