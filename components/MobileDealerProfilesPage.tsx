import React, { useState, useMemo, useEffect } from 'react';
import type { User, Vehicle } from '../types';
import { getFollowersCount } from '../services/buyerEngagementService';
import { isUserVerified } from './VerifiedBadge';
import VerifiedBadge from './VerifiedBadge';
import { getSellers } from '../services/userService';

interface MobileDealerProfilesPageProps {
  sellers?: User[]; // Made optional - will fetch if not provided
  vehicles?: Vehicle[];
  onViewProfile: (sellerEmail: string) => void;
}

/**
 * Mobile-Optimized Dealer Profiles Page
 * Features:
 * - Card-based dealer listings
 * - Touch-friendly navigation
 * - Quick stats display
 */
export const MobileDealerProfilesPage: React.FC<MobileDealerProfilesPageProps> = ({
  sellers: propSellers,
  vehicles = [],
  onViewProfile
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sellers, setSellers] = useState<User[]>(propSellers || []);
  const [isLoadingSellers, setIsLoadingSellers] = useState(!propSellers || propSellers.length === 0);

  // Fetch sellers directly from API if not provided or empty
  useEffect(() => {
    // Only fetch if sellers weren't provided or if provided array is empty
    if (!propSellers || propSellers.length === 0) {
      const fetchSellers = async () => {
        setIsLoadingSellers(true);
        try {
          console.log('🔍 MobileDealerProfilesPage: Fetching sellers from API...');
          const fetchedSellers = await getSellers();
          console.log(`✅ MobileDealerProfilesPage: Fetched ${fetchedSellers.length} sellers from API`);
          
          // Filter to ensure only sellers with role='seller' are included
          const validSellers = fetchedSellers.filter(seller => seller.role === 'seller');
          console.log(`✅ MobileDealerProfilesPage: ${validSellers.length} valid sellers after filtering`);
          
          setSellers(validSellers);
        } catch (error) {
          console.error('❌ MobileDealerProfilesPage: Error fetching sellers:', error);
          setSellers([]);
        } finally {
          setIsLoadingSellers(false);
        }
      };
      
      fetchSellers();
    } else {
      // Use provided sellers
      setSellers(propSellers);
      setIsLoadingSellers(false);
    }
  }, [propSellers]);

  const filteredSellers = useMemo(() => {
    if (!searchQuery.trim()) return sellers;
    const query = searchQuery.toLowerCase();
    return sellers.filter(seller =>
      seller.name?.toLowerCase().includes(query) ||
      seller.dealershipName?.toLowerCase().includes(query) ||
      seller.email?.toLowerCase().includes(query)
    );
  }, [sellers, searchQuery]);

  const getVehicleCount = (sellerEmail: string) => {
    const normalizedEmail = sellerEmail?.toLowerCase().trim() || '';
    return vehicles.filter(v =>
      v.sellerEmail?.toLowerCase().trim() === normalizedEmail &&
      v.status === 'published'
    ).length;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Dealer Profiles</h1>
        <p className="text-gray-600 text-sm">{filteredSellers.length} dealers</p>
      </div>

      {/* Search */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <input
          type="text"
          placeholder="Search dealers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
          style={{ minHeight: '48px' }}
        />
      </div>

      {/* Dealer List */}
      <div className="px-4 py-4">
        {isLoadingSellers ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dealers...</p>
          </div>
        ) : filteredSellers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">
              {searchQuery ? 'No dealers found matching your search' : 'No dealers available'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSellers.map((seller) => {
              const vehicleCount = getVehicleCount(seller.email);
              const followersCount = getFollowersCount(seller.email);
              const verified = isUserVerified(seller);

              return (
                <div
                  key={seller.email}
                  onClick={() => onViewProfile(seller.email)}
                  className="bg-white rounded-xl p-4 shadow-sm active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-start gap-4">
                    <div className="relative flex-shrink-0">
                      <img
                        src={seller.logoUrl || `https://i.pravatar.cc/150?u=${seller.email}`}
                        alt={seller.dealershipName || seller.name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                      />
                      {verified && (
                        <VerifiedBadge
                          show={true}
                          iconOnly
                          size="sm"
                          className="absolute -bottom-1 -right-1"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900 truncate">
                          {seller.dealershipName || seller.name}
                        </h3>
                        {verified && <VerifiedBadge show={true} size="sm" />}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                        <span>{vehicleCount} listings</span>
                        <span>•</span>
                        <span>{followersCount} followers</span>
                      </div>
                      {seller.sellerAverageRating && (
                        <div className="flex items-center gap-1">
                          <span className="text-yellow-500">★</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {seller.sellerAverageRating.toFixed(1)}
                          </span>
                          <span className="text-xs text-gray-600">
                            ({seller.sellerRatingCount || 0} reviews)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileDealerProfilesPage;





























