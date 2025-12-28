import React, { useState, useMemo } from 'react';
import type { User, Vehicle } from '../types';
import { getFirstValidImage } from '../utils/imageUtils';
import MobileVehicleCard from './MobileVehicleCard';
import StarRating from './StarRating';
import VerifiedBadge, { isUserVerified } from './VerifiedBadge';
import BadgeDisplay from './BadgeDisplay';
import TrustBadgeDisplay from './TrustBadgeDisplay';
import { followSeller, unfollowSeller, isFollowingSeller, getFollowersCount, getFollowingCount } from '../services/buyerEngagementService';

interface MobileSellerProfilePageProps {
  seller: User | null;
  vehicles: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  comparisonList: number[];
  onToggleCompare: (id: number) => void;
  wishlist: number[];
  onToggleWishlist: (id: number) => void;
  onBack: () => void;
  onViewSellerProfile: (sellerEmail: string) => void;
}

/**
 * Mobile-Optimized Seller Profile Page
 * Features:
 * - Compact seller info header
 * - Swipeable vehicle cards
 * - Touch-friendly follow button
 * - Mobile-optimized layout
 */
export const MobileSellerProfilePage: React.FC<MobileSellerProfilePageProps> = ({
  seller,
  vehicles,
  onSelectVehicle,
  comparisonList,
  onToggleCompare,
  wishlist,
  onToggleWishlist,
  onBack,
  onViewSellerProfile
}) => {
  if (!seller) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Seller Profile...</p>
        </div>
      </div>
    );
  }

  const [searchQuery, setSearchQuery] = useState('');
  const storedUserJson = localStorage.getItem('reRideCurrentUser');
  const storedUser: User | null = storedUserJson ? JSON.parse(storedUserJson) : null;
  const currentUserId = storedUser?.email || localStorage.getItem('currentUserEmail') || 'guest';
  const [isFollowing, setIsFollowing] = useState(() => isFollowingSeller(currentUserId as string, seller.email));

  const followersCount = useMemo(() => getFollowersCount(seller.email), [seller.email, isFollowing]);
  const followingCount = useMemo(() => getFollowingCount(seller.email), [seller.email, isFollowing]);
  const isOwnerSeller = storedUser?.role === 'seller' && storedUser.email === seller.email;

  const handleFollowToggle = () => {
    if (isFollowing) {
      unfollowSeller(currentUserId, seller.email);
      setIsFollowing(false);
    } else {
      followSeller(currentUserId, seller.email, true);
      setIsFollowing(true);
    }
  };

  const filteredVehicles = useMemo(() => {
    if (!searchQuery.trim()) {
      return vehicles;
    }
    const lowercasedQuery = searchQuery.toLowerCase();
    return vehicles.filter(vehicle =>
      vehicle.make.toLowerCase().includes(lowercasedQuery) ||
      vehicle.model.toLowerCase().includes(lowercasedQuery) ||
      vehicle.description.toLowerCase().includes(lowercasedQuery) ||
      (vehicle.variant && vehicle.variant.toLowerCase().includes(lowercasedQuery))
    );
  }, [vehicles, searchQuery]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header with Back Button */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 -ml-1"
          style={{ minWidth: '44px', minHeight: '44px' }}
        >
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Seller Profile</h1>
      </div>

      {/* Seller Info Card */}
      <div className="bg-white border-b border-gray-200 px-4 py-6">
        <div className="flex items-start gap-4">
          {/* Profile Image */}
          <div className="relative flex-shrink-0">
            <img
              src={seller.logoUrl || `https://i.pravatar.cc/150?u=${seller.email}`}
              alt={`${seller.dealershipName || seller.name} logo`}
              className="w-20 h-20 rounded-full object-cover border-2 border-orange-500"
            />
            <VerifiedBadge
              show={isUserVerified(seller)}
              iconOnly
              size="sm"
              className="absolute -bottom-1 -right-1 h-6 w-6 ring-2 ring-white rounded-full"
            />
          </div>

          {/* Seller Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-gray-900 truncate">
                {seller.dealershipName || seller.name}
              </h2>
              <VerifiedBadge show={isUserVerified(seller)} size="sm" />
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <BadgeDisplay badges={seller.badges || []} />
              <TrustBadgeDisplay user={seller} showDetails={false} />
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 mb-3">
              <button
                onClick={() => {}}
                className="text-sm text-gray-600"
              >
                <span className="font-semibold text-gray-900">{followersCount}</span> Followers
              </button>
              <span className="text-gray-300">•</span>
              <button
                onClick={() => {}}
                className="text-sm text-gray-600"
              >
                <span className="font-semibold text-gray-900">{vehicles.length}</span> Listings
              </button>
              {seller.sellerAverageRating && seller.sellerRatingCount ? (
                <>
                  <span className="text-gray-300">•</span>
                  <div className="flex items-center gap-1">
                    <StarRating rating={seller.sellerAverageRating} size="sm" />
                    <span className="text-sm text-gray-600">({seller.sellerRatingCount})</span>
                  </div>
                </>
              ) : null}
            </div>

            {/* Follow Button */}
            {!isOwnerSeller && storedUser && (
              <button
                onClick={handleFollowToggle}
                className={`w-full py-2.5 px-4 rounded-xl font-semibold ${
                  isFollowing
                    ? 'bg-gray-100 text-gray-700'
                    : 'bg-orange-500 text-white'
                }`}
                style={{ minHeight: '44px' }}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
        </div>

        {/* Seller Bio */}
        {seller.bio && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-700 leading-relaxed">{seller.bio}</p>
          </div>
        )}

        {/* Verification Status */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-600 mb-2">Verification Status</p>
          <div className="flex flex-wrap gap-2">
            {seller.phoneVerified ? (
              <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs border border-green-200">
                ✓ Phone Verified
              </span>
            ) : null}
            {seller.emailVerified ? (
              <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs border border-green-200">
                ✓ Email Verified
              </span>
            ) : null}
            {seller.govtIdVerified ? (
              <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs border border-green-200">
                ✓ ID Verified
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white px-4 py-3 border-b border-gray-200 sticky top-[73px] z-20">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search listings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            style={{ minHeight: '44px' }}
          />
        </div>
      </div>

      {/* Vehicles List */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            {filteredVehicles.length} {filteredVehicles.length === 1 ? 'Listing' : 'Listings'}
          </h3>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-sm text-orange-500 font-semibold"
            >
              Clear
            </button>
          )}
        </div>

        {filteredVehicles.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-gray-600 font-medium mb-1">No listings found</p>
            <p className="text-sm text-gray-500">
              {searchQuery ? 'Try adjusting your search' : 'This seller hasn\'t listed any vehicles yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                onClick={() => onSelectVehicle(vehicle)}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden active:scale-[0.98] transition-transform"
              >
                <div className="flex gap-4 p-4">
                  <img
                    src={getFirstValidImage(vehicle.images)}
                    alt={`${vehicle.make} ${vehicle.model}`}
                    className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 mb-1">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </h4>
                    {vehicle.variant && (
                      <p className="text-sm text-gray-600 mb-2">{vehicle.variant}</p>
                    )}
                    <p className="text-lg font-bold text-orange-500 mb-2">
                      {formatCurrency(vehicle.price)}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      <span>{vehicle.mileage.toLocaleString()} km</span>
                      <span>•</span>
                      <span>{vehicle.fuelType}</span>
                      <span>•</span>
                      <span>{vehicle.transmission}</span>
                    </div>
                  </div>
                </div>
                <div className="px-4 pb-4 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleWishlist(vehicle.id);
                    }}
                    className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm ${
                      wishlist.includes(vehicle.id)
                        ? 'bg-red-50 text-red-600'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                    style={{ minHeight: '40px' }}
                  >
                    {wishlist.includes(vehicle.id) ? 'Saved' : 'Save'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleCompare(vehicle.id);
                    }}
                    disabled={!comparisonList.includes(vehicle.id) && comparisonList.length >= 4}
                    className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm ${
                      comparisonList.includes(vehicle.id)
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-700'
                    } disabled:opacity-50`}
                    style={{ minHeight: '40px' }}
                  >
                    Compare
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileSellerProfilePage;








