import React, { useMemo } from 'react';
import type { Vehicle } from '../types';
import { getCityStats } from '../services/locationService';
import MobileVehicleCard from './MobileVehicleCard';

interface MobileCityLandingPageProps {
  city: string;
  vehicles: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  onToggleWishlist: (id: number) => void;
  onToggleCompare: (id: number) => void;
  wishlist: number[];
  comparisonList: number[];
  onViewSellerProfile: (email: string) => void;
}

/**
 * Mobile-Optimized City Landing Page
 * Features:
 * - City-specific vehicle listings
 * - Quick stats
 * - Mobile-optimized layout
 */
export const MobileCityLandingPage: React.FC<MobileCityLandingPageProps> = ({
  city,
  vehicles,
  onSelectVehicle,
  onToggleWishlist,
  onToggleCompare,
  wishlist,
  comparisonList,
  onViewSellerProfile
}) => {
  const cityStats = useMemo(() => getCityStats(vehicles, city), [vehicles, city]);
  const cityVehicles = useMemo(
    () => vehicles.filter(v => v.city === city && v.status === 'published').slice(0, 50),
    [vehicles, city]
  );

  if (!cityStats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-600 mb-2">No vehicles found in {city}</p>
          <p className="text-sm text-gray-500">Check back later for listings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Used Cars in {city}</h1>
        <p className="text-white/90 mb-4">
          Find your perfect car from {cityStats.totalListings} quality listings
        </p>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div>
            <p className="text-2xl font-bold">{cityStats.totalListings}</p>
            <p className="text-sm text-white/80">Listings</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{cityStats.avgPrice ? `₹${Math.round(cityStats.avgPrice / 1000)}K` : 'N/A'}</p>
            <p className="text-sm text-white/80">Avg Price</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{cityStats.brands.length}</p>
            <p className="text-sm text-white/80">Brands</p>
          </div>
        </div>
      </div>

      {/* Vehicle List */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Available Vehicles</h2>
          <p className="text-sm text-gray-600">{cityVehicles.length} results</p>
        </div>

        {cityVehicles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No vehicles found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cityVehicles.map((vehicle) => (
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

export default MobileCityLandingPage;










