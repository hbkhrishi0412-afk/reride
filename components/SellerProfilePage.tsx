import React, { useState, useMemo } from 'react';
import type { User, Vehicle } from '../types.js';
import VehicleCard from './VehicleCard.js';
import StarRating from './StarRating.js';
import QuickViewModal from './QuickViewModal.js';
import BadgeDisplay from './BadgeDisplay.js';
import TrustBadgeDisplay from './TrustBadgeDisplay.js';
import VerifiedBadge, { isUserVerified } from './VerifiedBadge.js';
import { followSeller, unfollowSeller, isFollowingSeller, getFollowersCount, getFollowingCount, getFollowersOfSeller, getFollowedSellers } from '../services/buyerEngagementService.js';

interface SellerProfilePageProps {
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

const SellerProfilePage: React.FC<SellerProfilePageProps> = ({ seller, vehicles, onSelectVehicle, comparisonList, onToggleCompare, wishlist, onToggleWishlist, onBack, onViewSellerProfile }) => {
    // 🔴 GUARD CLAUSE: Prevent crash when seller data hasn't loaded yet
    if (!seller) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-spinny-orange"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-300">Loading Seller Profile...</span>
            </div>
        );
    }

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
        <div className="animate-fade-in container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
            {/* Premium Back Button */}
            <button 
                onClick={onBack} 
                className="mb-6 group flex items-center gap-2 bg-white text-spinny-text-dark dark:text-brand-gray-200 font-semibold py-2.5 px-5 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:bg-brand-gray-700 transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5"
            >
                <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back</span>
            </button>
            
            {/* Two Column Layout: Seller Profile on Left, Listings on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 lg:gap-8">
                {/* Left Side: Seller Profile Card - Sticky */}
                <aside className="lg:sticky lg:top-8 lg:h-fit lg:self-start">
                    <header className="relative bg-gradient-to-br from-white via-blue-50/30 to-purple-50/20 p-4 md:p-5 rounded-xl shadow-lg border border-gray-100/50 backdrop-blur-sm overflow-hidden">
                        {/* Decorative Background Elements */}
                        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-blue-200/20 to-purple-200/20 rounded-full blur-3xl -z-0"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-orange-200/20 to-pink-200/20 rounded-full blur-3xl -z-0"></div>
                        
                        <div className="relative z-10 flex flex-col items-center gap-3">
                            {/* Premium Profile Picture - Centered */}
                            <div className="relative group flex-shrink-0">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
                                <img 
                                    src={seller.logoUrl || `https://i.pravatar.cc/150?u=${seller.email}`} 
                                    alt={`${seller.dealershipName || seller.name} logo`} 
                                    className="relative w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-2 shadow-lg ring-2 ring-white/50 transition-transform group-hover:scale-105" 
                                    style={{ borderColor: '#1E88E5' }}
                                />
                                <VerifiedBadge
                                    show={isUserVerified(seller)}
                                    iconOnly
                                    size="sm"
                                    className="absolute -bottom-0.5 -right-0.5 h-5 w-5 ring-2 ring-white rounded-full shadow-md"
                                />
                            </div>
                            
                            {/* Seller Information - Centered */}
                            <div className="w-full text-center">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        {seller.dealershipName || seller.name}
                                        <VerifiedBadge show={isUserVerified(seller)} size="sm" />
                                    </h1>
                                </div>
                                
                                {/* Badges - Centered */}
                                <div className="mb-3 flex items-center justify-center gap-2 flex-wrap">
                                    <BadgeDisplay badges={seller.badges || []} />
                                    <TrustBadgeDisplay user={seller} showDetails={false} />
                                </div>
                                
                                {/* Verification Status - Visible */}
                                <div className="mb-3 px-2">
                                    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2.5 border border-gray-200">
                                        <p className="text-xs font-semibold text-gray-700 mb-2 text-center">Verification Status</p>
                                        <div className="flex flex-col gap-1.5">
                                            {(() => {
                                                const phoneVerified = seller.verificationStatus?.phoneVerified || seller.phoneVerified || false;
                                                return phoneVerified ? (
                                                    <div className="flex items-center gap-2 px-2 py-1 bg-green-50 text-green-700 rounded text-xs border border-green-200">
                                                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                                        </svg>
                                                        <span className="font-medium">Phone Verified</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 text-gray-500 rounded text-xs border border-gray-200">
                                                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                                        </svg>
                                                        <span className="font-medium">Phone Not Verified</span>
                                                    </div>
                                                );
                                            })()}
                                            {(() => {
                                                const emailVerified = seller.verificationStatus?.emailVerified || seller.emailVerified || false;
                                                return emailVerified ? (
                                                    <div className="flex items-center gap-2 px-2 py-1 bg-green-50 text-green-700 rounded text-xs border border-green-200">
                                                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                                            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                                        </svg>
                                                        <span className="font-medium">Email Verified</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 text-gray-500 rounded text-xs border border-gray-200">
                                                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                                            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                                        </svg>
                                                        <span className="font-medium">Email Not Verified</span>
                                                    </div>
                                                );
                                            })()}
                                            {(() => {
                                                const govtIdVerified = seller.verificationStatus?.govtIdVerified || seller.govtIdVerified || false;
                                                return govtIdVerified ? (
                                                    <div className="flex items-center gap-2 px-2 py-1 bg-green-50 text-green-700 rounded text-xs border border-green-200">
                                                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                                        </svg>
                                                        <span className="font-medium">ID Verified</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 text-gray-500 rounded text-xs border border-gray-200">
                                                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                                        </svg>
                                                        <span className="font-medium">ID Not Verified</span>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Bio - Collapsed */}
                                {seller.bio && (
                                    <p className="mb-3 text-gray-600 dark:text-gray-300 leading-snug text-xs md:text-sm line-clamp-2">
                                        {seller.bio}
                                    </p>
                                )}
                                
                                {/* Stats and Actions - Stacked */}
                                <div className="space-y-2.5">
                                    {/* Rating */}
                                    <div className="flex items-center justify-center gap-1.5 bg-white/60 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm">
                                        <StarRating rating={seller.averageRating || 0} size="sm" readOnly />
                                        <span className="text-gray-700 dark:text-gray-200 font-medium text-xs">
                                            {seller.averageRating?.toFixed(1) || 'No Rating'} 
                                            <span className="text-gray-500 ml-0.5">({seller.ratingCount || 0} ratings)</span>
                                        </span>
                                    </div>
                                    
                                    {/* Followers/Following - Centered */}
                                    <div className="flex items-center justify-center gap-1.5 text-gray-600 dark:text-gray-300 font-medium text-xs">
                                        {isOwnerSeller ? (
                                            <>
                                                <button 
                                                    className="hover:text-blue-600 transition-colors px-2 py-0.5 rounded hover:bg-white/60"
                                                    onClick={() => setShowFollowers(true)}
                                                >
                                                    {followersCount} Followers
                                                </button>
                                                <span className="opacity-30">•</span>
                                                <button 
                                                    className="hover:text-blue-600 transition-colors px-2 py-0.5 rounded hover:bg-white/60"
                                                    onClick={() => setShowFollowing(true)}
                                                >
                                                    {followingCount} Following
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <span>{followersCount} Followers</span>
                                                <span className="opacity-30">•</span>
                                                <span>{followingCount} Following</span>
                                            </>
                                        )}
                                    </div>
                                    
                                    {/* Member Since - Always Visible */}
                                    <div className="flex items-center justify-center gap-1.5 text-gray-600 dark:text-gray-300 text-xs py-1">
                                        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span className="font-medium">
                                            {(() => {
                                                const dateStr = seller.createdAt || seller.joinedDate;
                                                if (dateStr) {
                                                    try {
                                                        const date = new Date(dateStr);
                                                        if (!isNaN(date.getTime())) {
                                                            return `Member since ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
                                                        }
                                                    } catch (e) {
                                                        // Invalid date, fall through to default
                                                    }
                                                }
                                                return 'Member since Recently';
                                            })()}
                                        </span>
                                    </div>
                                    
                                    {/* Follow Button - Full Width */}
                                    <button
                                        onClick={handleFollowToggle}
                                        className={`w-full px-3 py-2 rounded-lg font-semibold text-xs transition-all duration-300 flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 ${
                                            isFollowing 
                                                ? 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 hover:from-gray-200 hover:to-gray-300' 
                                                : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
                                        }`}
                                    >
                                        {isFollowing ? (
                                            <>
                                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                                                </svg>
                                                <span>Following</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                </svg>
                                                <span>Follow Seller</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </header>
                </aside>

                {/* Right Side: Vehicle Listings */}
                <div className="min-w-0">
                    {/* Premium Listings Section Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div>
                            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">
                                Listings from this Seller
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                                {filteredVehicles.length} {filteredVehicles.length === 1 ? 'vehicle' : 'vehicles'} available
                            </p>
                        </div>
                        
                        {/* Premium Search Bar */}
                        <div className="w-full md:w-96 relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                placeholder="Search this seller's listings..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 transition-all duration-300 shadow-sm hover:shadow-md focus:shadow-lg"
                            />
                        </div>
                    </div>

                    {/* Premium Grid Layout */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
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
                    <div className="col-span-full text-center py-20 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
                        <div className="max-w-md mx-auto">
                            <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                                <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No listings match your search</h3>
                            <p className="text-gray-500 dark:text-gray-400">Try a different keyword or browse all listings.</p>
                        </div>
                    </div>
                ) : (
                    <div className="col-span-full text-center py-20 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
                        <div className="max-w-md mx-auto">
                            <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                                <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No active listings</h3>
                            <p className="text-gray-500 dark:text-gray-400">This seller currently has no vehicles for sale.</p>
                        </div>
                    </div>
                )}
                    </div>
                </div>
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

            {/* Premium Owner-only Modals */}
            {isOwnerSeller && showFollowers && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-700 animate-slide-up">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Your Followers</h3>
                            <button 
                                onClick={() => setShowFollowers(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <ul className="max-h-80 overflow-auto space-y-2 text-sm">
                            {followersList.length === 0 ? (
                                <li className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                                        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                    </div>
                                    <p>No followers yet.</p>
                                </li>
                            ) : (
                                followersList.map(f => (
                                    <li key={f.id} className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        <span className="truncate text-gray-800 dark:text-gray-200 font-medium">{f.userId}</span>
                                        <button
                                            className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 transition-all shadow-sm hover:shadow-md whitespace-nowrap"
                                            onClick={() => onViewSellerProfile(f.userId)}
                                        >
                                            View Profile
                                        </button>
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                </div>
            )}
            {isOwnerSeller && showFollowing && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-700 animate-slide-up">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">You're Following</h3>
                            <button 
                                onClick={() => setShowFollowing(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <ul className="max-h-80 overflow-auto space-y-2 text-sm">
                            {followingList.length === 0 ? (
                                <li className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                                        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                    </div>
                                    <p>Not following anyone yet.</p>
                                </li>
                            ) : (
                                followingList.map(f => (
                                    <li key={f.id} className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        <span className="truncate text-gray-800 dark:text-gray-200 font-medium">{f.sellerEmail}</span>
                                        <button
                                            className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 transition-all shadow-sm hover:shadow-md whitespace-nowrap"
                                            onClick={() => onViewSellerProfile(f.sellerEmail)}
                                        >
                                            View Profile
                                        </button>
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SellerProfilePage;