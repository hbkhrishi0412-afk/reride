import React, { useState, useMemo } from 'react';
import type { User, Vehicle } from '../types.js';
import VehicleCard from './VehicleCard.js';
import BadgeDisplay from './BadgeDisplay.js';
import TrustBadgeDisplay from './TrustBadgeDisplay.js';
import VerifiedBadge, { isUserVerified } from './VerifiedBadge.js';
import { getSellerTrustChecklistSummary } from '../lib/sellerTrustChecklist.js';
import { useApp } from './AppProvider.js';
import { isCompareDisabledForVehicle } from '../utils/compareList.js';
import { getSellerCallPhone, getSellerWhatsAppNumber } from '../utils/sellerContact.js';
import { telHrefFromRawPhone } from '../utils/numberUtils.js';
import { followSeller, unfollowSeller, isFollowingSeller, getFollowersCount, getFollowingCount, getFollowersOfSeller, getFollowedSellers } from '../services/buyerEngagementService.js';
import { useTranslatedText, useTranslatedFields } from '../hooks/useTranslatedText';
import { ModalBackdrop } from './primitives/Pressable';

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
    currentUser?: User | null;
    onRequireLogin?: () => void;
}

type SortKey = 'default' | 'price-asc' | 'price-desc' | 'year-desc';
type Tab = 'inventory' | 'about';

const Icon = ({ d, className = 'w-4 h-4' }: { d: string; className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
);
const ICONS = {
    back: 'M15 19l-7-7 7-7',
    pin: 'M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z',
    calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    phone: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
    chat: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    share: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z',
    plus: 'M12 4v16m8-8H4',
    check: 'M5 13l4 4L19 7',
    search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    close: 'M6 18L18 6M6 6l12 12',
    car: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
    shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
};

const btn = 'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-reride-orange focus-visible:ring-offset-2';

const SellerProfilePageContent: React.FC<SellerProfilePageProps & { seller: User }> = ({ seller, vehicles, onSelectVehicle, comparisonList, onToggleCompare, wishlist, onToggleWishlist, onBack, onViewSellerProfile, currentUser, onRequireLogin }) => {
    const { comparisonCategory } = useApp();
    const translatedBio = useTranslatedText(seller.bio);
    const translatedNames = useTranslatedFields({ dealershipName: seller.dealershipName, name: seller.name });
    const displayName = translatedNames.dealershipName || translatedNames.name;
    const [tab, setTab] = useState<Tab>('inventory');
    const [searchQuery, setSearchQuery] = useState('');
    const [sort, setSort] = useState<SortKey>('default');
    const [modal, setModal] = useState<'followers' | 'following' | null>(null);
    const [shareCopied, setShareCopied] = useState(false);

    const viewer = useMemo<User | null>(() => {
        if (currentUser) return currentUser;
        try {
            return JSON.parse(localStorage.getItem('reRideCurrentUser') || 'null');
        } catch {
            return null;
        }
    }, [currentUser]);
    const currentUserId = viewer?.email || localStorage.getItem('currentUserEmail') || 'guest';
    const [isFollowing, setIsFollowing] = useState(() => isFollowingSeller(currentUserId, seller.email));
    const isOwnerSeller = viewer?.role === 'seller' && viewer.email === seller.email;

    const followersCount = useMemo(() => getFollowersCount(seller.email), [seller.email, isFollowing]);
    const followingCount = useMemo(() => getFollowingCount(seller.email), [seller.email, isFollowing]);
    const modalEmails = useMemo(() => {
        if (modal === 'followers') return getFollowersOfSeller(seller.email).map((f) => f.userId);
        if (modal === 'following') return getFollowedSellers(seller.email).map((f) => f.sellerEmail);
        return [];
    }, [modal, seller.email, isFollowing]);

    const requireViewer = (fn: () => void) => () => (viewer ? fn() : onRequireLogin?.());

    const handleFollowToggle = requireViewer(() => {
        if (isFollowing) unfollowSeller(currentUserId, seller.email);
        else followSeller(currentUserId, seller.email, true);
        setIsFollowing(!isFollowing);
    });

    const handleShare = async () => {
        const url = window.location.href;
        try {
            if (navigator.share) {
                await navigator.share({ title: displayName, url });
                return;
            }
            await navigator.clipboard.writeText(url);
            setShareCopied(true);
            setTimeout(() => setShareCopied(false), 2000);
        } catch {
            /* user cancelled share sheet */
        }
    };

    const callPhone = telHrefFromRawPhone(vehicles.length ? getSellerCallPhone(vehicles[0], seller) : seller.mobile);
    const waDigits = (vehicles.length ? getSellerWhatsAppNumber(vehicles[0], seller) : seller.mobile || '').replace(/\D/g, '');
    const waUrl = waDigits
        ? `https://wa.me/${waDigits.length === 10 ? `91${waDigits}` : waDigits}?text=${encodeURIComponent(`Hi ${displayName}, I found your showroom on ReRide.`)}`
        : null;

    const visibleVehicles = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const list = q
            ? vehicles.filter((v) =>
                  [v.make, v.model, v.variant, v.description].some((f) => (f || '').toLowerCase().includes(q)),
              )
            : vehicles;
        if (sort === 'default') return list;
        const sorted = [...list];
        if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price);
        if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price);
        if (sort === 'year-desc') sorted.sort((a, b) => b.year - a.year);
        return sorted;
    }, [vehicles, searchQuery, sort]);

    const { items: checklistItems, verifiedCount, total: checklistTotal, isPlatformVerifiedOnly } =
        getSellerTrustChecklistSummary(seller);
    const isVerified = isUserVerified(seller);
    const showVisitorTrustSummaryOnly = !isOwnerSeller && verifiedCount === 0 && !isPlatformVerifiedOnly;

    const memberSince = (() => {
        const d = new Date(seller.createdAt || seller.joinedDate || '');
        return isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    })();
    const location = seller.location || seller.address;
    const rating = seller.averageRating || seller.sellerAverageRating;
    const ratingCount = seller.ratingCount || seller.sellerRatingCount || 0;
    const initials = (displayName || seller.email).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

    const stats: { label: string; value: React.ReactNode; onClick?: () => void }[] = [
        { label: 'Cars for sale', value: vehicles.length },
        { label: 'Rating', value: rating ? `★ ${rating.toFixed(1)}` : 'New' },
        { label: 'Followers', value: followersCount, onClick: isOwnerSeller ? () => setModal('followers') : undefined },
        { label: 'Following', value: followingCount, onClick: isOwnerSeller ? () => setModal('following') : undefined },
    ];

    return (
        <div className="bg-slate-50 min-h-screen pb-12">
            {/* Storefront banner */}
            <div className="h-36 sm:h-48 bg-gradient-to-br from-slate-900 via-slate-800 to-reride-orange-dark" />

            <div className="max-w-6xl mx-auto px-4 sm:px-6">
                {/* Header card */}
                <section className="-mt-20 sm:-mt-24 bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-end gap-5">
                        <div className="relative shrink-0 self-center md:self-auto">
                            {seller.logoUrl ? (
                                <img
                                    src={seller.logoUrl}
                                    alt={`${displayName} logo`}
                                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-4 border-white shadow-md bg-white"
                                    decoding="async"
                                />
                            ) : (
                                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-4 border-white shadow-md bg-reride-orange text-white flex items-center justify-center text-3xl font-bold" aria-hidden>
                                    {initials}
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-w-0 text-center md:text-left">
                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 inline-flex items-center gap-2 flex-wrap justify-center md:justify-start">
                                <span data-no-translate>{displayName}</span>
                                <VerifiedBadge show={isVerified} size="sm" />
                            </h1>
                            <div className="mt-2 flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1 text-sm text-slate-600">
                                {location && (
                                    <span className="inline-flex items-center gap-1"><Icon d={ICONS.pin} />{location}</span>
                                )}
                                {memberSince && (
                                    <span className="inline-flex items-center gap-1"><Icon d={ICONS.calendar} />On ReRide since {memberSince}</span>
                                )}
                                {rating ? (
                                    <span className="inline-flex items-center gap-1">
                                        <span className="text-amber-500">★</span>
                                        {rating.toFixed(1)} ({ratingCount} {ratingCount === 1 ? 'review' : 'reviews'})
                                    </span>
                                ) : null}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center justify-center md:justify-start gap-2">
                                <BadgeDisplay badges={seller.badges || []} />
                                <TrustBadgeDisplay user={seller} showDetails={false} />
                            </div>
                        </div>

                        {!isOwnerSeller && (
                            <div className="flex flex-wrap justify-center md:justify-end gap-2 shrink-0">
                                {callPhone && (
                                    <a
                                        href={viewer ? callPhone : undefined}
                                        onClick={viewer ? undefined : (e) => { e.preventDefault(); onRequireLogin?.(); }}
                                        role={viewer ? undefined : 'button'}
                                        className={`${btn} bg-reride-orange text-white hover:bg-reride-orange-dark`}
                                    >
                                        <Icon d={ICONS.phone} />Call
                                    </a>
                                )}
                                {waUrl && (
                                    <a
                                        href={viewer ? waUrl : undefined}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={viewer ? undefined : (e) => { e.preventDefault(); onRequireLogin?.(); }}
                                        role={viewer ? undefined : 'button'}
                                        className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}
                                    >
                                        <Icon d={ICONS.chat} />WhatsApp
                                    </a>
                                )}
                                <button
                                    type="button"
                                    onClick={handleFollowToggle}
                                    aria-pressed={isFollowing}
                                    className={`${btn} border ${isFollowing ? 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200' : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50'}`}
                                >
                                    <Icon d={isFollowing ? ICONS.check : ICONS.plus} />
                                    {isFollowing ? 'Following' : 'Follow'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleShare}
                                    aria-label="Share this showroom"
                                    className={`${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 !px-3`}
                                >
                                    <Icon d={ICONS.share} />
                                    {shareCopied && <span>Link copied</span>}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Stats strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-slate-100 divide-x divide-slate-100">
                        {stats.map((s) => {
                            const Tag = s.onClick ? 'button' : 'div';
                            return (
                                <Tag key={s.label} {...(s.onClick ? { type: 'button' as const, onClick: s.onClick } : {})} className={`py-3 text-center ${s.onClick ? 'hover:bg-slate-50' : ''}`}>
                                    <span className="block text-lg font-bold text-slate-900">{s.value}</span>
                                    <span className="block text-xs text-slate-500">{s.label}</span>
                                </Tag>
                            );
                        })}
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-1 px-3 sm:px-4 border-t border-slate-100" role="tablist">
                        <button type="button" onClick={onBack} className="mr-2 p-2 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Back">
                            <Icon d={ICONS.back} />
                        </button>
                        {(['inventory', 'about'] as Tab[]).map((t) => (
                            <button
                                key={t}
                                type="button"
                                role="tab"
                                aria-selected={tab === t}
                                onClick={() => setTab(t)}
                                className={`px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === t ? 'border-reride-orange text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                            >
                                {t === 'inventory' ? `Inventory (${vehicles.length})` : 'About'}
                            </button>
                        ))}
                    </div>
                </section>

                {tab === 'inventory' ? (
                    <section className="mt-6" aria-label="Inventory">
                        <div className="flex flex-col sm:flex-row gap-3 mb-5">
                            <label className="relative flex-1">
                                <span className="sr-only">Search this seller's cars</span>
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon d={ICONS.search} /></span>
                                <input
                                    type="search"
                                    placeholder="Search make, model, variant…"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-reride-orange focus:ring-2 focus:ring-reride-orange/20"
                                />
                            </label>
                            <label className="sm:w-56">
                                <span className="sr-only">Sort cars</span>
                                <select
                                    value={sort}
                                    onChange={(e) => setSort(e.target.value as SortKey)}
                                    className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-reride-orange"
                                >
                                    <option value="default">Recommended</option>
                                    <option value="price-asc">Price: low to high</option>
                                    <option value="price-desc">Price: high to low</option>
                                    <option value="year-desc">Newest model year</option>
                                </select>
                            </label>
                        </div>

                        {visibleVehicles.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                {visibleVehicles.map((vehicle) => (
                                    <VehicleCard
                                        key={vehicle.id}
                                        vehicle={vehicle}
                                        onSelect={onSelectVehicle}
                                        onToggleCompare={(id) => requireViewer(() => onToggleCompare(id))()}
                                        isSelectedForCompare={comparisonList.includes(vehicle.id)}
                                        onToggleWishlist={(id) => requireViewer(() => onToggleWishlist(id))()}
                                        isInWishlist={wishlist.includes(vehicle.id)}
                                        isCompareDisabled={isCompareDisabledForVehicle(vehicle, comparisonList, comparisonCategory)}
                                        onViewSellerProfile={onViewSellerProfile}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white border border-slate-200 rounded-2xl py-14 px-6 text-center">
                                <div className="mx-auto mb-3 w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center">
                                    <Icon d={vehicles.length ? ICONS.search : ICONS.car} className="w-7 h-7" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900">
                                    {vehicles.length ? 'No cars match your search' : 'No cars for sale right now'}
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    {vehicles.length ? 'Try a different keyword.' : 'Follow this seller to hear when new cars arrive.'}
                                </p>
                                {vehicles.length > 0 && (
                                    <button type="button" onClick={() => setSearchQuery('')} className={`${btn} mt-4 bg-slate-900 text-white hover:bg-slate-800`}>
                                        Clear search
                                    </button>
                                )}
                            </div>
                        )}
                    </section>
                ) : (
                    <section className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5" aria-label="About">
                        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6">
                            <h2 className="text-lg font-bold text-slate-900">About {displayName}</h2>
                            <p className="mt-3 text-sm leading-relaxed text-slate-600 whitespace-pre-line" data-no-translate>
                                {translatedBio || 'This seller hasn’t added a description yet.'}
                            </p>
                            <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                {seller.address && (
                                    <div><dt className="text-slate-500">Address</dt><dd className="font-medium text-slate-800">{seller.address}{seller.pincode ? ` – ${seller.pincode}` : ''}</dd></div>
                                )}
                                {seller.preferredContactHours && (
                                    <div><dt className="text-slate-500">Contact hours</dt><dd className="font-medium text-slate-800">{seller.preferredContactHours}</dd></div>
                                )}
                                {seller.responseTime ? (
                                    <div><dt className="text-slate-500">Usually responds in</dt><dd className="font-medium text-slate-800">{seller.responseTime < 60 ? `${seller.responseTime} min` : `${Math.round(seller.responseTime / 60)} hr`}</dd></div>
                                ) : null}
                                {seller.partnerBanks?.length ? (
                                    <div><dt className="text-slate-500">Finance partners</dt><dd className="font-medium text-slate-800">{seller.partnerBanks.join(', ')}</dd></div>
                                ) : null}
                            </dl>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl p-6">
                            <h2 className="text-lg font-bold text-slate-900 inline-flex items-center gap-2">
                                <Icon d={ICONS.shield} className="w-5 h-5 text-emerald-600" />Trust &amp; verification
                            </h2>
                            {isPlatformVerifiedOnly ? (
                                <p className="mt-3 text-sm text-emerald-700">This seller’s account was verified by the ReRide team.</p>
                            ) : showVisitorTrustSummaryOnly ? (
                                <p className="mt-3 text-sm text-slate-500">Phone, email, and government ID are not verified yet.</p>
                            ) : (
                                <>
                                    <p className="mt-1 text-sm text-slate-500">{verifiedCount} of {checklistTotal} checks passed</p>
                                    <ul className="mt-4 space-y-2">
                                        {checklistItems.map((item) => (
                                            <li key={item.key} className="flex items-center gap-3 text-sm">
                                                <span className={`w-5 h-5 rounded-full flex items-center justify-center ${item.verified ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                                    <Icon d={item.verified ? ICONS.check : ICONS.close} className="w-3 h-3" />
                                                </span>
                                                <span className="flex-1 text-slate-700">{item.label}</span>
                                                <span className={`text-xs font-medium ${item.verified ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                    {item.verified ? 'Verified' : isOwnerSeller ? 'Finish in profile' : 'Not verified'}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    </section>
                )}
            </div>

            {isOwnerSeller && modal && (
                <ModalBackdrop
                    onClose={() => setModal(null)}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    aria-label={`Close ${modal} dialog`}
                >
                    <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-900">
                                {modal === 'followers' ? 'Your followers' : "You're following"} ({modalEmails.length})
                            </h3>
                            <button type="button" onClick={() => setModal(null)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Close">
                                <Icon d={ICONS.close} />
                            </button>
                        </div>
                        <ul className="max-h-80 overflow-auto divide-y divide-slate-100">
                            {modalEmails.length === 0 ? (
                                <li className="py-10 px-6 text-center text-sm text-slate-500">
                                    {modal === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                                </li>
                            ) : (
                                modalEmails.map((email) => (
                                    <li key={email} className="flex items-center justify-between gap-3 px-5 py-3">
                                        <span className="truncate text-sm text-slate-800">{email}</span>
                                        <button type="button" onClick={() => onViewSellerProfile(email)} className="text-xs font-semibold text-reride-orange hover:underline whitespace-nowrap">
                                            View profile
                                        </button>
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                </ModalBackdrop>
            )}
        </div>
    );
};

const SellerProfilePage: React.FC<SellerProfilePageProps> = (props) => {
    if (!props.seller) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-reride-orange"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-300">Loading Seller Profile...</span>
            </div>
        );
    }
    return <SellerProfilePageContent key={props.seller.email} {...props} seller={props.seller} />;
};

export default SellerProfilePage;
