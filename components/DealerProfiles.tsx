import React from 'react';
import type { User } from '../types.js';
import StarRating from './StarRating.js';
import BadgeDisplay from './BadgeDisplay.js';
import { getFollowersCount, getFollowingCount } from '../services/buyerEngagementService.js';
import VerifiedBadge, { isUserVerified } from './VerifiedBadge.js';

interface DealerProfilesProps {
  sellers: User[];
  onViewProfile: (sellerEmail: string) => void;
}

const DealerCard: React.FC<{ seller: User; onViewProfile: (sellerEmail: string) => void; }> = ({ seller, onViewProfile }) => (
    <div
        onClick={() => onViewProfile(seller.email)}
        className="bg-white rounded-xl shadow-soft-lg p-6 flex flex-col items-center text-center cursor-pointer transform hover:-translate-y-1 hover:shadow-soft-xl transition-all duration-300"
    >
        <img
            src={seller.logoUrl || `https://i.pravatar.cc/100?u=${seller.email}`}
            alt={`${seller.dealershipName || seller.name}'s logo`}
            className="w-24 h-24 rounded-full object-cover border-4 border-gray-200-200 dark:border-gray-200-200 mb-4"
        />
        <h3 className="font-bold text-xl text-spinny-text-dark dark:text-spinny-text-dark flex items-center gap-2">
            {seller.dealershipName || seller.name}
            <VerifiedBadge show={isUserVerified(seller)} size="sm" />
        </h3>
        <div className="my-2">
             <BadgeDisplay badges={seller.badges || []} />
        </div>
        <div className="flex items-center gap-2 mt-1">
            <StarRating rating={seller.averageRating || 0} readOnly size="sm" />
            <span className="text-xs text-spinny-text dark:text-spinny-text">({seller.ratingCount || 0} reviews)</span>
        </div>
        <div className="text-xs text-brand-gray-600 dark:text-spinny-text mt-2">
            {getFollowersCount(seller.email)} Followers • {getFollowingCount(seller.email)} Following
        </div>
        <p className="text-sm text-brand-gray-600 dark:text-spinny-text mt-3 flex-grow line-clamp-3">{seller.bio}</p>
        <button className="mt-4 w-full btn-brand-primary text-white font-bold py-2 px-4 rounded-lg transition-colors">
            View Profile & Listings
        </button>
    </div>
);


const DealerProfiles: React.FC<DealerProfilesProps> = ({ sellers, onViewProfile }) => {
  return (
    <div className="dealers container mx-auto px-4 py-8 animate-fade-in">
      <h1 className="text-4xl font-extrabold text-spinny-text-dark dark:text-spinny-text-dark mb-8 text-center">
        Certified Dealer Profiles
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sellers.map(seller => (
              <DealerCard key={seller.email} seller={seller} onViewProfile={onViewProfile} />
          ))}
          {sellers.length === 0 && (
            <div className="col-span-full text-center py-16">
              <p className="text-lg text-brand-gray-600 dark:text-spinny-text">No certified dealers found at the moment.</p>
            </div>
          )}
      </div>
    </div>
  );
};

export default DealerProfiles;