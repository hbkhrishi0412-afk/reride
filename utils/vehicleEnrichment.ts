// Utility function to enrich vehicle data with seller information
import { Vehicle, User } from '../types';

/**
 * Enriches vehicle data with seller information from users array
 * @param vehicles Array of vehicles
 * @param users Array of users
 * @returns Array of vehicles with populated seller names
 */
export const enrichVehiclesWithSellerInfo = (vehicles: Vehicle[], users: User[]): Vehicle[] => {
  // Safety checks: ensure arrays are defined
  if (!Array.isArray(vehicles)) {
    console.warn('⚠️ enrichVehiclesWithSellerInfo: vehicles is not an array', vehicles);
    return [];
  }
  if (!Array.isArray(users)) {
    console.warn('⚠️ enrichVehiclesWithSellerInfo: users is not an array', users);
    return vehicles; // Return vehicles as-is if users array is invalid
  }
  
  return vehicles.map(vehicle => {
    if (!vehicle) return vehicle; // Skip null/undefined vehicles
    
    // Find the seller user by email
    const seller = users.find(user => user && user.email === vehicle.sellerEmail);
    
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
  const seller = users.find(user => user.email === vehicle.sellerEmail);
  
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
