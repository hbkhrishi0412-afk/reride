import React, { useState, useMemo } from 'react';
import type { User, Vehicle } from '../types';
import { getFirstValidImage, swapToPlaceholderOnError } from '../utils/imageUtils';
import VerifiedBadge, { isUserVerified } from './VerifiedBadge';
import { getSellerTrustChecklistSummary } from '../lib/sellerTrustChecklist';
import BadgeDisplay from './BadgeDisplay';
import TrustBadgeDisplay from './TrustBadgeDisplay';
import { followSeller, unfollowSeller, isFollowingSeller, getFollowersCount, getFollowingCount } from '../services/buyerEngagementService';
import { telHrefFromRawPhone } from '../utils/numberUtils';
import { getSellerCallPhone, getSellerWhatsAppNumber } from '../utils/sellerContact';
import { useApp } from './AppProvider';
import { isCompareDisabledForVehicle } from '../utils/compareList.js';
import { useTranslatedText, useTranslatedFields } from '../hooks/useTranslatedText';

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
  currentUser?: User | null;
  onRequireLogin?: () => void;
}

type SortKey = 'default' | 'price-asc' | 'price-desc' | 'year-desc';
type Tab = 'inventory' | 'about';

const Icon = ({ d, className = 'w-4 h-4', filled = false }: { d: string; className?: string; filled?: boolean }) => (
  <svg className={className} fill={filled ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);
const ICONS = {
  back: 'M15 19l-7-7 7-7',
  pin: 'M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z',
  phone: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  chat: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  share: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z',
  plus: 'M12 4v16m8-8H4',
  check: 'M5 13l4 4L19 7',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  close: 'M6 18L18 6M6 6l12 12',
  car: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
  shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  heart: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  compare: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
};

const btn = 'inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-xl text-sm font-semibold active:scale-[.98] transition-transform';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

const MobileSellerProfilePageContent: React.FC<MobileSellerProfilePageProps & { seller: User }> = ({
  seller,
  vehicles,
  onSelectVehicle,
  comparisonList,
  onToggleCompare,
  wishlist,
  onToggleWishlist,
  onBack,
  currentUser,
  onRequireLogin,
}) => {
  const { comparisonCategory } = useApp();
  const translatedBio = useTranslatedText(seller.bio);
  const translatedNames = useTranslatedFields({ dealershipName: seller.dealershipName, name: seller.name });
  const displayName = translatedNames.dealershipName || translatedNames.name;
  const [tab, setTab] = useState<Tab>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('default');
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

  const callHref = telHrefFromRawPhone(vehicles.length ? getSellerCallPhone(vehicles[0], seller) : seller.mobile || '');
  const waDigits = (vehicles.length ? getSellerWhatsAppNumber(vehicles[0], seller) : seller.mobile || '').replace(/\D/g, '');
  const waUrl = waDigits
    ? `https://wa.me/${waDigits.length === 10 ? `91${waDigits}` : waDigits}?text=${encodeURIComponent(`Hi ${displayName}, I found your showroom on ReRide.`)}`
    : null;

  const visibleVehicles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? vehicles.filter((v) => [v.make, v.model, v.variant, v.description].some((f) => (f || '').toLowerCase().includes(q)))
      : vehicles;
    if (sort === 'default') return list;
    const sorted = [...list];
    if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price);
    if (sort === 'year-desc') sorted.sort((a, b) => b.year - a.year);
    return sorted;
  }, [vehicles, searchQuery, sort]);

  const { items: checklistItems, verifiedCount, total: checklistTotal, isPlatformVerifiedOnly } = getSellerTrustChecklistSummary(seller);
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

  const stats = [
    { label: 'Cars', value: vehicles.length },
    { label: 'Rating', value: rating ? `★ ${rating.toFixed(1)}` : 'New' },
    { label: 'Followers', value: followersCount },
    { label: 'Following', value: followingCount },
  ];

  const gate = (e: React.MouseEvent) => {
    if (viewer) return;
    e.preventDefault();
    onRequireLogin?.();
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Storefront banner */}
      <div className="relative h-28 bg-gradient-to-br from-slate-900 via-slate-800 to-reride-orange-dark">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="absolute top-3 left-3 w-10 h-10 rounded-xl bg-white/20 border border-white/30 text-white flex items-center justify-center active:bg-white/30"
        >
          <Icon d={ICONS.back} className="w-5 h-5" />
        </button>
        {!isOwnerSeller && (
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share this showroom"
            className="absolute top-3 right-3 h-10 px-3 rounded-xl bg-white/20 border border-white/30 text-white flex items-center gap-1.5 text-sm font-semibold active:bg-white/30"
          >
            <Icon d={ICONS.share} />
            {shareCopied && 'Link copied'}
          </button>
        )}
      </div>

      {/* Header card */}
      <section className="mx-3 -mt-10 relative bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-4 flex gap-3 items-start">
          {seller.logoUrl ? (
            <img
              src={seller.logoUrl}
              alt={`${displayName} logo`}
              className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-md bg-white -mt-8 shrink-0"
              decoding="async"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl border-4 border-white shadow-md bg-reride-orange text-white flex items-center justify-center text-2xl font-bold -mt-8 shrink-0" aria-hidden>
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
              <span className="truncate" data-no-translate>{displayName}</span>
              <VerifiedBadge show={isVerified} size="sm" />
            </h1>
            <div className="mt-1 space-y-0.5 text-xs text-slate-600">
              {location && (
                <p className="flex items-center gap-1 truncate"><Icon d={ICONS.pin} className="w-3.5 h-3.5 shrink-0" />{location}</p>
              )}
              <p>
                {rating ? <><span className="text-amber-500">★</span> {rating.toFixed(1)} ({ratingCount}) · </> : null}
                {memberSince ? `On ReRide since ${memberSince}` : null}
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 -mt-1 flex flex-wrap gap-1.5">
          <BadgeDisplay badges={seller.badges || []} />
          <TrustBadgeDisplay user={seller} showDetails={false} />
        </div>

        {!isOwnerSeller && (
          <div className="p-4 pt-3 grid grid-cols-3 gap-2">
            {callHref ? (
              <a href={callHref} onClick={gate} className={`${btn} bg-reride-orange text-white`}>
                <Icon d={ICONS.phone} />Call
              </a>
            ) : null}
            {waUrl ? (
              <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={gate} className={`${btn} bg-emerald-600 text-white`}>
                <Icon d={ICONS.chat} />WhatsApp
              </a>
            ) : null}
            <button
              type="button"
              onClick={handleFollowToggle}
              aria-pressed={isFollowing}
              className={`${btn} border border-slate-300 ${isFollowing ? 'bg-slate-100 text-slate-700' : 'bg-white text-slate-900'} ${!callHref && !waUrl ? 'col-span-3' : !callHref || !waUrl ? 'col-span-2' : ''}`}
            >
              <Icon d={isFollowing ? ICONS.check : ICONS.plus} />
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-4 border-t border-slate-100 divide-x divide-slate-100">
          {stats.map((s) => (
            <div key={s.label} className="py-2.5 text-center">
              <span className="block text-base font-bold text-slate-900">{s.value}</span>
              <span className="block text-[11px] text-slate-500">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="flex border-t border-slate-100" role="tablist">
          {(['inventory', 'about'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-semibold border-b-2 -mb-px ${tab === t ? 'border-reride-orange text-slate-900' : 'border-transparent text-slate-500'}`}
            >
              {t === 'inventory' ? `Inventory (${vehicles.length})` : 'About'}
            </button>
          ))}
        </div>
      </section>

      {tab === 'inventory' ? (
        <section className="px-3 mt-4" aria-label="Inventory">
          <div className="flex gap-2 mb-3">
            <label className="relative flex-1">
              <span className="sr-only">Search this seller's cars</span>
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon d={ICONS.search} /></span>
              <input
                type="search"
                placeholder="Search cars…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-reride-orange"
              />
            </label>
            <label className="w-32">
              <span className="sr-only">Sort cars</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="w-full h-11 px-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-reride-orange"
              >
                <option value="default">Recommended</option>
                <option value="price-asc">Price ↑</option>
                <option value="price-desc">Price ↓</option>
                <option value="year-desc">Newest</option>
              </select>
            </label>
          </div>

          {visibleVehicles.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl py-10 px-4 text-center">
              <div className="mx-auto mb-3 w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                <Icon d={vehicles.length ? ICONS.search : ICONS.car} className="w-6 h-6" />
              </div>
              <p className="font-semibold text-slate-900">{vehicles.length ? 'No cars match your search' : 'No cars for sale right now'}</p>
              <p className="text-xs text-slate-500 mt-1">
                {vehicles.length ? 'Try a different keyword.' : 'Follow this seller to hear when new cars arrive.'}
              </p>
              {vehicles.length > 0 && (
                <button type="button" onClick={() => setSearchQuery('')} className={`${btn} mt-3 bg-slate-900 text-white px-4`}>
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <ul className="space-y-3">
              {visibleVehicles.map((vehicle) => {
                const saved = wishlist.includes(vehicle.id);
                const compared = comparisonList.includes(vehicle.id);
                return (
                  <li key={vehicle.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <button type="button" onClick={() => onSelectVehicle(vehicle)} className="w-full flex gap-3 p-3 text-left">
                      <img
                        src={getFirstValidImage(vehicle.images, vehicle.id)}
                        alt={`${vehicle.make} ${vehicle.model}`}
                        className="w-24 h-24 rounded-xl object-cover shrink-0 bg-slate-100"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => swapToPlaceholderOnError(e.currentTarget)}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 text-sm leading-tight truncate">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </h3>
                        {vehicle.variant && <p className="text-xs text-slate-500 truncate">{vehicle.variant}</p>}
                        <p className="text-lg font-bold text-reride-orange-dark mt-0.5">{formatCurrency(vehicle.price)}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {(vehicle.mileage ?? 0).toLocaleString('en-IN')} km · {vehicle.fuelType} · {vehicle.transmission}
                        </p>
                      </div>
                    </button>
                    <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={requireViewer(() => onToggleWishlist(vehicle.id))}
                        aria-pressed={saved}
                        className={`${btn} min-h-[40px] ${saved ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-700'}`}
                      >
                        <Icon d={ICONS.heart} className="w-3.5 h-3.5" filled={saved} />
                        {saved ? 'Saved' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={requireViewer(() => onToggleCompare(vehicle.id))}
                        aria-pressed={compared}
                        disabled={isCompareDisabledForVehicle(vehicle, comparisonList, comparisonCategory)}
                        className={`${btn} min-h-[40px] disabled:opacity-50 ${compared ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
                      >
                        <Icon d={ICONS.compare} className="w-3.5 h-3.5" />
                        Compare
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <section className="px-3 mt-4 space-y-3" aria-label="About">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <h2 className="font-bold text-slate-900">About {displayName}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 whitespace-pre-line" data-no-translate>
              {translatedBio || 'This seller hasn’t added a description yet.'}
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              {seller.address && (
                <div><dt className="text-xs text-slate-500">Address</dt><dd className="text-slate-800">{seller.address}{seller.pincode ? ` – ${seller.pincode}` : ''}</dd></div>
              )}
              {seller.preferredContactHours && (
                <div><dt className="text-xs text-slate-500">Contact hours</dt><dd className="text-slate-800">{seller.preferredContactHours}</dd></div>
              )}
              {seller.responseTime ? (
                <div><dt className="text-xs text-slate-500">Usually responds in</dt><dd className="text-slate-800">{seller.responseTime < 60 ? `${seller.responseTime} min` : `${Math.round(seller.responseTime / 60)} hr`}</dd></div>
              ) : null}
              {seller.partnerBanks?.length ? (
                <div><dt className="text-xs text-slate-500">Finance partners</dt><dd className="text-slate-800">{seller.partnerBanks.join(', ')}</dd></div>
              ) : null}
            </dl>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Icon d={ICONS.shield} className="w-5 h-5 text-emerald-600" />Trust &amp; verification
            </h2>
            {isPlatformVerifiedOnly ? (
              <p className="mt-2 text-sm text-emerald-700">This seller’s account was verified by the ReRide team.</p>
            ) : showVisitorTrustSummaryOnly ? (
              <p className="mt-2 text-sm text-slate-500">Phone, email, and government ID are not verified yet.</p>
            ) : (
              <>
                <p className="mt-1 text-xs text-slate-500">{verifiedCount} of {checklistTotal} checks passed</p>
                <ul className="mt-3 space-y-2">
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
  );
};

export const MobileSellerProfilePage: React.FC<MobileSellerProfilePageProps> = (props) => {
  if (!props.seller) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-reride-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading Seller Profile…</p>
        </div>
      </div>
    );
  }
  return <MobileSellerProfilePageContent key={props.seller.email} {...props} seller={props.seller} />;
};

export default MobileSellerProfilePage;
