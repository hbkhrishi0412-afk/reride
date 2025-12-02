import React, { useState, useMemo } from 'react';
import type { User } from '../types.js';
import StarRating from './StarRating.js';
import BadgeDisplay from './BadgeDisplay.js';
import { getFollowersCount, getFollowingCount } from '../services/buyerEngagementService.js';
import VerifiedBadge, { isUserVerified } from './VerifiedBadge.js';

interface DealerProfilesProps {
  sellers: User[];
  onViewProfile: (sellerEmail: string) => void;
}

type SortOption = 'name' | 'rating' | 'reviews' | 'followers' | 'newest';

const DealerCard: React.FC<{ 
  seller: User; 
  onViewProfile: (sellerEmail: string) => void;
  index: number;
}> = ({ seller, onViewProfile, index }) => {
  const followersCount = getFollowersCount(seller.email);
  const followingCount = getFollowingCount(seller.email);
  const isVerified = isUserVerified(seller);
  const rating = seller.averageRating || 0;
  const reviewCount = seller.ratingCount || 0;

  return (
    <div
      onClick={() => onViewProfile(seller.email)}
      className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-100 hover:border-blue-200 hover:-translate-y-2 cursor-pointer animate-stagger-fade-in"
      style={{
        animationDelay: `${index * 50}ms`,
      }}
    >
      {/* Gradient Background Overlay on Hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 via-purple-50/0 to-orange-50/0 group-hover:from-blue-50/50 group-hover:via-purple-50/30 group-hover:to-orange-50/50 transition-all duration-500"></div>
      
      {/* Verified Ribbon */}
      {isVerified && (
        <div className="absolute top-0 right-0 z-10">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-bl-lg shadow-lg flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Verified</span>
          </div>
        </div>
      )}

      <div className="relative p-6 flex flex-col items-center text-center">
        {/* Profile Picture with Enhanced Border */}
        <div className="relative mb-4">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500 rounded-full blur-md opacity-0 group-hover:opacity-30 transition-opacity duration-500"></div>
          <img
            src={seller.logoUrl || `https://i.pravatar.cc/120?u=${seller.email}`}
            alt={`${seller.dealershipName || seller.name}'s logo`}
            className="relative w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg group-hover:scale-110 transition-transform duration-500"
          />
          {isVerified && (
            <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1.5 shadow-lg">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>

        {/* Dealer Name */}
        <h3 className="font-extrabold text-xl text-gray-900 mb-2 flex items-center justify-center gap-2 line-clamp-1">
          {seller.dealershipName || seller.name}
        </h3>

        {/* Badges */}
        {seller.badges && seller.badges.length > 0 && (
          <div className="mb-3 flex flex-wrap justify-center gap-1.5">
            <BadgeDisplay badges={seller.badges || []} />
          </div>
        )}

        {/* Rating */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <StarRating rating={rating} readOnly size="sm" />
          <span className="text-sm font-semibold text-gray-700">{rating > 0 ? rating.toFixed(1) : 'N/A'}</span>
          <span className="text-xs text-gray-500">({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})</span>
        </div>

        {/* Social Stats */}
        <div className="flex items-center justify-center gap-4 mb-4 text-sm">
          <div className="flex items-center gap-1.5 text-gray-600">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="font-medium">{followersCount}</span>
            <span className="text-gray-400">Followers</span>
          </div>
          <div className="w-px h-4 bg-gray-300"></div>
          <div className="flex items-center gap-1.5 text-gray-600">
            <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span className="font-medium">{followingCount}</span>
            <span className="text-gray-400">Following</span>
          </div>
        </div>

        {/* Bio */}
        <p className="text-sm text-gray-600 mb-5 flex-grow line-clamp-3 min-h-[3.75rem]">
          {seller.bio || 'No description available'}
        </p>

        {/* CTA Button */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onViewProfile(seller.email);
          }}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
        >
          View Profile & Listings
        </button>
      </div>
    </div>
  );
};

const DealerProfiles: React.FC<DealerProfilesProps> = ({ sellers, onViewProfile }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [showFilters, setShowFilters] = useState(false);
  const [verifiedFilter, setVerifiedFilter] = useState<boolean | null>(null);

  // Filter and sort dealers
  const filteredAndSortedSellers = useMemo(() => {
    let filtered = sellers;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(seller => {
        const name = (seller.dealershipName || seller.name || '').toLowerCase();
        const bio = (seller.bio || '').toLowerCase();
        const email = (seller.email || '').toLowerCase();
        return name.includes(query) || bio.includes(query) || email.includes(query);
      });
    }

    // Apply verified filter
    if (verifiedFilter !== null) {
      filtered = filtered.filter(seller => {
        const isVerified = isUserVerified(seller);
        return verifiedFilter ? isVerified : !isVerified;
      });
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.dealershipName || a.name || '').localeCompare(b.dealershipName || b.name || '');
        case 'rating':
          return (b.averageRating || 0) - (a.averageRating || 0);
        case 'reviews':
          return (b.ratingCount || 0) - (a.ratingCount || 0);
        case 'followers':
          return getFollowersCount(b.email) - getFollowersCount(a.email);
        case 'newest':
          return (new Date(b.createdAt || 0).getTime()) - (new Date(a.createdAt || 0).getTime());
        default:
          return 0;
      }
    });

    return sorted;
  }, [sellers, searchQuery, sortBy, verifiedFilter]);

  return (
    <div className="dealers container mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fade-in min-h-screen">
      {/* Header Section with Gradient */}
      <div className="relative mb-10 overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-purple-600 to-orange-500 p-6 md:p-10 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-2.5">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold mb-1.5">
                Certified Dealer Profiles
              </h1>
              <p className="text-blue-100 text-base md:text-lg">
                Connect with trusted automotive dealers
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-2xl shadow-lg p-4 md:p-5 mb-6 border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1 relative">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search dealers by name, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="appearance-none bg-white border border-gray-300 rounded-xl px-6 py-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer transition-all font-medium"
            >
              <option value="name">Sort by Name</option>
              <option value="rating">Sort by Rating</option>
              <option value="reviews">Sort by Reviews</option>
              <option value="followers">Sort by Followers</option>
              <option value="newest">Sort by Newest</option>
            </select>
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
              verifiedFilter !== null
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {verifiedFilter !== null && (
              <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                1
              </span>
            )}
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 animate-fade-in">
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={verifiedFilter === true}
                  onChange={(e) => setVerifiedFilter(e.target.checked ? true : null)}
                  className="w-5 h-5 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer checked:bg-blue-600 checked:border-blue-600 transition-colors"
                  style={{
                    accentColor: '#2563EB'
                  }}
                />
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Verified Only</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={verifiedFilter === false}
                  onChange={(e) => setVerifiedFilter(e.target.checked ? false : null)}
                  className="w-5 h-5 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer checked:bg-blue-600 checked:border-blue-600 transition-colors"
                  style={{
                    accentColor: '#2563EB'
                  }}
                />
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Unverified Only</span>
              </label>
              {verifiedFilter !== null && (
                <button
                  onClick={() => setVerifiedFilter(null)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium ml-auto"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      {filteredAndSortedSellers.length > 0 && (
        <div className="mb-5 text-gray-600 text-sm">
          Showing <span className="font-bold text-gray-900">{filteredAndSortedSellers.length}</span> dealer{filteredAndSortedSellers.length !== 1 ? 's' : ''}
          {searchQuery && (
            <span> for &quot;<span className="font-semibold">{searchQuery}</span>&quot;</span>
          )}
        </div>
      )}

      {/* Dealer Grid */}
      {filteredAndSortedSellers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 lg:gap-6">
          {filteredAndSortedSellers.map((seller, index) => (
            <DealerCard 
              key={seller.email} 
              seller={seller} 
              onViewProfile={onViewProfile}
              index={index}
            />
          ))}
        </div>
      ) : (
        <div className="col-span-full text-center py-20">
          <div className="max-w-md mx-auto">
            <div className="bg-gray-100 rounded-full p-6 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {searchQuery ? 'No dealers found' : 'No dealers available'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery
                ? `We couldn't find any dealers matching "${searchQuery}". Try adjusting your search.`
                : 'There are no certified dealers available at the moment. Please check back later.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setVerifiedFilter(null);
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                Clear Search
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DealerProfiles;
