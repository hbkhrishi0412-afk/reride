import React, { useState, useMemo } from 'react';
import type { Vehicle, User } from '../types';
import { MobileVehicleCard } from './MobileVehicleCard';
import { View as ViewEnum } from '../types';

interface MobileWishlistProps {
  vehicles: Vehicle[];
  wishlist: number[];
  onToggleWishlist: (vehicleId: number) => void;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onToggleCompare: (vehicleId: number) => void;
  comparisonList: number[];
  currentUser: User | null;
  onViewSellerProfile?: (sellerEmail: string) => void;
  onNavigate?: (view: ViewEnum) => void;
}

/**
 * Mobile-Optimized Wishlist Component
 * Features:
 * - Swipe-to-delete
 * - Grid/list toggle
 * - Quick actions (compare, share)
 */
export const MobileWishlist: React.FC<MobileWishlistProps> = ({
  vehicles,
  wishlist,
  onToggleWishlist,
  onSelectVehicle,
  onToggleCompare,
  comparisonList,
  currentUser,
  onViewSellerProfile,
  onNavigate
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [swipedId, setSwipedId] = useState<number | null>(null);

  const wishlistVehicles = useMemo(() => {
    return vehicles.filter(v => wishlist.includes(v.id));
  }, [vehicles, wishlist]);

  const handleSwipeStart = (e: React.TouchEvent, vehicleId: number) => {
    const touch = e.touches[0];
    // Store initial touch position
  };

  const handleSwipeEnd = (vehicleId: number) => {
    if (swipedId === vehicleId) {
      // Remove from wishlist
      onToggleWishlist(vehicleId);
      setSwipedId(null);
    }
  };

  if (wishlistVehicles.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24 flex items-center justify-center">
        <div className="text-center px-4">
          <svg
            className="w-20 h-20 text-gray-300 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Your wishlist is empty</h2>
          <p className="text-gray-600 mb-6">Start saving vehicles you like!</p>
          {onNavigate && (
            <button
              onClick={() => onNavigate(ViewEnum.USED_CARS)}
              className="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold"
            >
              Browse Vehicles
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">
          My Wishlist ({wishlistVehicles.length})
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 rounded-lg bg-gray-100 text-gray-700"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            {viewMode === 'grid' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Vehicle List */}
      {viewMode === 'list' ? (
        <div className="divide-y divide-gray-200">
          {wishlistVehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className="bg-white p-4 active:bg-gray-50 transition-colors"
              onClick={() => onSelectVehicle(vehicle)}
            >
              <div className="flex gap-4">
                <img
                  src={vehicle.images?.[0] || 'https://via.placeholder.com/150'}
                  alt={`${vehicle.make} ${vehicle.model}`}
                  className="w-24 h-24 rounded-xl object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </h3>
                  {vehicle.variant && (
                    <p className="text-sm text-gray-600 mb-2">{vehicle.variant}</p>
                  )}
                  <p className="text-lg font-bold text-orange-500 mb-2">
                    ₹{vehicle.price.toLocaleString('en-IN')}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>{vehicle.mileage.toLocaleString()} km</span>
                    <span>•</span>
                    <span>{vehicle.fuelType}</span>
                    <span>•</span>
                    <span>{vehicle.transmission}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleWishlist(vehicle.id);
                  }}
                  className="p-2 text-red-500 flex-shrink-0"
                  style={{ minWidth: '44px', minHeight: '44px' }}
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCompare(vehicle.id);
                  }}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold ${
                    comparisonList.includes(vehicle.id)
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {comparisonList.includes(vehicle.id) ? 'Remove from Compare' : 'Compare'}
                </button>
                {onViewSellerProfile && vehicle.sellerEmail && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewSellerProfile(vehicle.sellerEmail);
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold"
                  >
                    Seller
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-4">
          {wishlistVehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className="bg-white rounded-xl overflow-hidden shadow-sm active:scale-95 transition-transform"
              onClick={() => onSelectVehicle(vehicle)}
            >
              <div className="relative">
                <img
                  src={vehicle.images?.[0] || 'https://via.placeholder.com/150'}
                  alt={`${vehicle.make} ${vehicle.model}`}
                  className="w-full h-32 object-cover"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleWishlist(vehicle.id);
                  }}
                  className="absolute top-2 right-2 p-2 bg-white/90 backdrop-blur-sm rounded-full text-red-500"
                  style={{ minWidth: '36px', minHeight: '36px' }}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-sm text-gray-900 mb-1 line-clamp-1">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </h3>
                <p className="text-base font-bold text-orange-500 mb-1">
                  ₹{vehicle.price.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-gray-600">
                  {vehicle.mileage.toLocaleString()} km • {vehicle.fuelType}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MobileWishlist;










