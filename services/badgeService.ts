import type { User, Vehicle, Badge } from '../types.js';

export const getSellerBadges = (seller: User, allSellerVehicles: Vehicle[]): Badge[] => {
    const badges: Badge[] = [];

  // Low disclosure trust marker
  if (seller.reportedCount && seller.reportedCount >= 2) {
    badges.push({
      type: 'verified',
      label: 'Low trust',
      description: 'Multiple buyers reported disclosure mismatches on past listings.',
    });
  }

  // Verified Seller Badge
    if (seller.isVerified) {
        badges.push({
            type: 'verified',
            label: 'Verified Seller',
            description: 'This seller has been verified by ReRide for authenticity and reliability.',
        });
    }

    // High Rating Badge
    if (seller.averageRating && seller.averageRating >= 4.5 && seller.ratingCount && seller.ratingCount >= 5) {
        badges.push({
            type: 'high_rating',
            label: `Top Rated (${seller.averageRating.toFixed(1)} ★)`,
            description: `This seller consistently receives high ratings from customers.`,
        });
    }

    // Top Seller Badge
    const soldCount = allSellerVehicles.filter(v => v.status === 'sold').length;
    if (soldCount >= 3 && seller.averageRating && seller.averageRating >= 4.2) {
        badges.push({
            type: 'top_seller',
            label: 'Top Seller',
            description: 'Recognized for high sales volume and excellent customer service.',
        });
    }
    
    return badges;
};