import React, { useState, useMemo } from 'react';
import type { User, Vehicle } from '../types';
import VehicleCard from './VehicleCard';
import StarRating from './StarRating';
import QuickViewModal from './QuickViewModal';
import BadgeDisplay from './BadgeDisplay';
import TrustBadgeDisplay from './TrustBadgeDisplay';
import VerifiedBadge, { isUserVerified } from './VerifiedBadge';
import { followSeller, unfollowSeller, isFollowingSeller, getFollowersCount, getFollowingCount, getFollowersOfSeller, getFollowedSellers } from '../services/buyerEngagementService';

interface SellerProfilePageProps {
    seller: User;
    vehicles: Vehicle[];
    onSelectVehicle: (vehicle: Vehicle) => void;
    comparisonList: number[];
    onToggleCompare: (id: number) => void;
    wishlist: number[];
    onToggleWishlist: (id: number) => void;
    onBack: () => void;
    onViewSellerProfile: (sellerEmail: string) => void;
}

const SellerProfilePage: React.FC<SellerProfilePageProps> = ({ seller, vehicles, onSelectVehicle, comparisonList, onToggleCompare, wishlist, onToggleWishlist, onBack, onViewSellerProfile }) => {
    const [quickViewVehicle, setQuickViewVehicle] = useState<Vehicle | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    // NEW: Follow seller feature
    // Restore logged-in user from storage (used to gate owner-only views)
    const storedUserJson = localStorage.getItem('reRideCurrentUser');
    const storedUser: User | null = storedUserJson ? JSON.parse(storedUserJson) : null;
    const currentUserId = storedUser?.email || localStorage.getItem('currentUserEmail') || 'guest';
    const [isFollowing, setIsFollowing] = useState(() => isFollowingSeller(currentUserId as string, seller.email));

    // Derived engagement counts
    const followersCount = useMemo(() => getFollowersCount(seller.email), [seller.email, isFollowing]);
    // IMPORTANT: Show how many accounts THIS seller follows, not the viewer
    const followingCount = useMemo(() => getFollowingCount(seller.email), [seller.email, isFollowing]);

    // Owner-only visibility (seller viewing their own page)
    const isOwnerSeller = storedUser?.role === 'seller' && storedUser.email === seller.email;

    // Owner modals state
    const [showFollowers, setShowFollowers] = useState(false);
    const [showFollowing, setShowFollowing] = useState(false);

    // Lists for owner view
    const followersList = useMemo(() => getFollowersOfSeller(seller.email), [seller.email, isFollowing]);
    const followingList = useMemo(() => getFollowedSellers(seller.email), [seller.email, isFollowing]);
    
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

    return (
        <div className="animate-fade-in container mx-auto px-4 py-8">
            <button onClick={onBack} className="mb-6 bg-white text-spinny-text-dark dark:text-brand-gray-200 font-bold py-2 px-4 rounded-lg hover:bg-spinny-off-white dark:hover:bg-brand-gray-700 transition-colors shadow-soft">
                &larr; Back
            </button>
            
            <header className="bg-white p-8 rounded-xl shadow-soft-lg mb-8 flex flex-col md:flex-row items-center gap-8">
                <div className="relative">
                    <img 
                        src={seller.logoUrl || `https://i.pravatar.cc/150?u=${seller.email}`} 
                        alt={`${seller.dealershipName || seller.name} logo`} 
                        className="w-32 h-32 rounded-full object-cover border-4 shadow-lg" style={{ borderColor: '#1E88E5' }}
                    />
                    <VerifiedBadge
                        show={isUserVerified(seller)}
                        iconOnly
                        size="md"
                        className="absolute -bottom-2 -right-2 h-7 w-7 ring-4 ring-white rounded-full"
                    />
                </div>
                <div>
                    <h1 className="text-4xl font-extrabold text-spinny-text-dark dark:text-spinny-text-dark flex items-center gap-3">
                        {seller.dealershipName || seller.name}
                        <VerifiedBadge show={isUserVerified(seller)} />
                    </h1>
                    <div className="mt-2 flex items-center gap-3 flex-wrap">
                        <BadgeDisplay badges={seller.badges || []} />
                        <TrustBadgeDisplay user={seller} showDetails={true} />
                    </div>
                    {seller.bio && <p className="mt-4 text-brand-gray-600 dark:text-spinny-text-dark max-w-2xl">{seller.bio}</p>}
                    <div className="flex items-center gap-4 mt-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <StarRating rating={seller.averageRating || 0} readOnly />
                            <span className="text-brand-gray-600 dark:text-spinny-text font-semibold">
                                {seller.averageRating?.toFixed(1) || 'No Rating'} ({seller.ratingCount || 0} ratings)
                            </span>
                        </div>
                        <div className="flex items-center gap-3 text-brand-gray-600 dark:text-spinny-text font-semibold">
                            {isOwnerSeller ? (
                                <>
                                    <button className="hover:underline" onClick={() => setShowFollowers(true)}>{followersCount} Followers</button>
                                    <span className="opacity-40">•</span>
                                    <button className="hover:underline" onClick={() => setShowFollowing(true)}>{followingCount} Following</button>
                                </>
                            ) : (
                                <>
                                    <span>{followersCount} Followers</span>
                                    <span className="opacity-40">•</span>
                                    <span>{followingCount} Following</span>
                                </>
                            )}
                        </div>
                        <button
                            onClick={handleFollowToggle}
                            className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                                isFollowing 
                                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
                                    : 'bg-spinny-orange text-white hover:bg-orange-600'
                            }`}
                        >
                            {isFollowing ? (
                                <>
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                                    </svg>
                                    Following
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Follow Seller
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-3xl font-bold text-spinny-text-dark dark:text-spinny-text-dark">Listings from this Seller ({filteredVehicles.length})</h2>
                <div className="w-full md:w-1/2 lg:w-1/3">
                    <input
                        type="text"
                        placeholder="Search this seller's listings..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full p-3 border border-gray-200-300 dark:border-gray-200-300 rounded-lg focus:outline-none bg-white dark:bg-brand-gray-700" onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--spinny-orange)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255, 107, 53, 0.1)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVehicles.length > 0 ? (
                    filteredVehicles.map(vehicle => (
                        <VehicleCard 
                            key={vehicle.id} 
                            vehicle={vehicle} 
                            onSelect={onSelectVehicle} 
                            onToggleCompare={onToggleCompare} 
                            isSelectedForCompare={comparisonList.includes(vehicle.id)} 
                            onToggleWishlist={onToggleWishlist} 
                            isInWishlist={wishlist.includes(vehicle.id)} 
                            isCompareDisabled={!comparisonList.includes(vehicle.id) && comparisonList.length >= 4}
                            onViewSellerProfile={onViewSellerProfile}
                            onQuickView={setQuickViewVehicle}
                        />
                    ))
                ) : vehicles.length > 0 ? (
                    <div className="col-span-full text-center py-16 bg-white rounded-xl shadow-soft-lg">
                        <h3 className="text-xl font-semibold text-spinny-text-dark dark:text-brand-gray-200">No listings match your search</h3>
                        <p className="text-spinny-text dark:text-spinny-text mt-2">Try a different keyword.</p>
                    </div>
                ) : (
                    <div className="col-span-full text-center py-16 bg-white rounded-xl shadow-soft-lg">
                        <h3 className="text-xl font-semibold text-spinny-text-dark dark:text-brand-gray-200">No active listings</h3>
                        <p className="text-spinny-text dark:text-spinny-text mt-2">This seller currently has no vehicles for sale.</p>
                    </div>
                )}
            </div>
            <QuickViewModal
                vehicle={quickViewVehicle}
                onClose={() => setQuickViewVehicle(null)}
                onSelectVehicle={onSelectVehicle}
                onToggleCompare={onToggleCompare}
                onToggleWishlist={onToggleWishlist}
                comparisonList={comparisonList}
                wishlist={wishlist}
            />

            {/* Owner-only Modals */}
            {isOwnerSeller && showFollowers && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-soft-lg">
                        <h3 className="text-lg font-bold mb-3 text-spinny-text-dark">Your Followers</h3>
                        <ul className="max-h-64 overflow-auto space-y-2 text-sm">
                            {followersList.length === 0 ? (
                                <li className="text-gray-600">No followers yet.</li>
                            ) : (
                                followersList.map(f => (
                                    <li key={f.id} className="text-gray-800 flex items-center justify-between gap-2">
                                        <span className="truncate">{f.userId}</span>
                                        <button
                                            className="text-xs px-2 py-1 rounded bg-spinny-light-gray hover:bg-brand-gray-300"
                                            onClick={() => onViewSellerProfile(f.userId)}
                                        >
                                            View Profile
                                        </button>
                                    </li>
                                ))
                            )}
                        </ul>
                        <button className="mt-4 px-4 py-2 rounded bg-gray-200 hover:bg-gray-300" onClick={() => setShowFollowers(false)}>Close</button>
                    </div>
                </div>
            )}
            {isOwnerSeller && showFollowing && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-soft-lg">
                        <h3 className="text-lg font-bold mb-3 text-spinny-text-dark">You’re Following</h3>
                        <ul className="max-h-64 overflow-auto space-y-2 text-sm">
                            {followingList.length === 0 ? (
                                <li className="text-gray-600">Not following anyone yet.</li>
                            ) : (
                                followingList.map(f => (
                                    <li key={f.id} className="text-gray-800 flex items-center justify-between gap-2">
                                        <span className="truncate">{f.sellerEmail}</span>
                                        <button
                                            className="text-xs px-2 py-1 rounded bg-spinny-light-gray hover:bg-brand-gray-300"
                                            onClick={() => onViewSellerProfile(f.sellerEmail)}
                                        >
                                            View Profile
                                        </button>
                                    </li>
                                ))
                            )}
                        </ul>
                        <button className="mt-4 px-4 py-2 rounded bg-gray-200 hover:bg-gray-300" onClick={() => setShowFollowing(false)}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SellerProfilePage;