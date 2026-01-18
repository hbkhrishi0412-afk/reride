import React from 'react';
import type { Vehicle } from '../types';
import MobileVehicleCard from './MobileVehicleCard';

interface MobileRentalPageProps {
  vehicles: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  comparisonList: number[];
  onToggleCompare: (id: number) => void;
  wishlist: number[];
  onToggleWishlist: (id: number) => void;
  currentUser: any;
  onViewSellerProfile: (sellerEmail: string) => void;
}

/**
 * Mobile-Optimized Rental Page
 * Features:
 * - Rental vehicle listings
 * - Mobile-optimized cards
 * - Filter integration ready
 */
export const MobileRentalPage: React.FC<MobileRentalPageProps> = ({
  vehicles,
  onSelectVehicle,
  comparisonList,
  onToggleCompare,
  wishlist,
  onToggleWishlist,
  currentUser,
  onViewSellerProfile
}) => {
  const rentalVehicles = vehicles.filter(v => v.listingType === 'rental' && v.status === 'published');

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Rental Cars</h1>
        <p className="text-gray-600 text-sm">{rentalVehicles.length} vehicles available</p>
      </div>

      {/* Vehicle List */}
      <div className="px-4 py-4">
        {rentalVehicles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-2">No rental vehicles available</p>
            <p className="text-sm text-gray-500">Check back later for rental listings</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rentalVehicles.map((vehicle) => (
              <MobileVehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                onSelect={onSelectVehicle}
                isInWishlist={wishlist.includes(vehicle.id)}
                isInCompare={comparisonList.includes(vehicle.id)}
                onToggleWishlist={() => onToggleWishlist(vehicle.id)}
                onToggleCompare={() => onToggleCompare(vehicle.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileRentalPage;























