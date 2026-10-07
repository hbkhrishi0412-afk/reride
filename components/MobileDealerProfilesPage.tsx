import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { User, Vehicle } from '../types';
import { getFollowersCount } from '../services/buyerEngagementService';
import VerifiedBadge, { isUserVerified } from './VerifiedBadge';
import { getDealerDirectory, readCachedDealerDirectory } from '../services/userService';
import {
  DealerMap,
  getOpenStatus,
  type CompanyLocation,
  ENTITY_LABEL_SELLER,
  ENTITY_LABEL_SERVICE_PROVIDER,
} from './DealerProfiles';
import { getSellerMapCoordinatesBatch, normalizeIndianPincode } from '../utils/sellerLocation';
import { resolveSellerLogoUrl, sellerInitialsAvatarDataUri } from '../utils/imageUtils';
import { sellerMatchesHeaderRegion } from '../utils/dealerRegionFilter';
import { isRerideStaffPick } from '../utils/staffPick';
import { getPublicDealerRating } from '../utils/dealerRatingDisplay';
import { copyTextToClipboard } from '../utils/copyToClipboard';
import { useIsMobileApp } from '../hooks/useIsMobileApp';

type CompanyType = 'all' | 'car-service' | 'showroom';

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];
const TYPE_TABS: { v: CompanyType; label: string }[] = [
  { v: 'all', label: 'All' },
  { v: 'showroom', label: 'Showrooms' },
  { v: 'car-service', label: 'Car service' },
];

const isShowroom = (s: User) => s.role === 'seller';
const isService = (s: User) => s.role === 'service_provider';

const PinIcon = ({ className = 'h-3.5 w-3.5' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

interface MobileDealerProfilesPageProps {
  sellers?: User[];
  vehicles?: Vehicle[];
  onViewProfile: (sellerEmail: string) => void;
  /** When set, "Call" is allowed; otherwise guests are prompted to log in. */
  currentUser?: User | null;
  onRequireLogin?: () => void;
  /** Header location — filters dealers to match the chosen region. */
  userLocation?: string;
}

const MobileDealerCard = React.memo<{
  seller: User;
  coords: CompanyLocation | null;
  isSelected: boolean;
  vehicleCount: number;
  followersCount: number;
  onSelect: (sellerEmail: string, coords: CompanyLocation | null) => void;
  onCall: (seller: User) => void;
  onViewProfile: (sellerEmail: string) => void;
}>(({ seller, coords, isSelected, vehicleCount, followersCount, onSelect, onCall, onViewProfile }) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const showroom = isShowroom(seller);
  const name = seller.dealershipName || seller.name;
  const rating = getPublicDealerRating(seller);
  const pin = normalizeIndianPincode(seller.pincode);
  const address = [(seller.address || seller.location || '').trim(), pin ? `PIN ${pin}` : '']
    .filter(Boolean)
    .join(' · ');
  const meta = [
    vehicleCount > 0 && `${vehicleCount} ${vehicleCount === 1 ? 'listing' : 'listings'}`,
    followersCount > 0 && `${followersCount} ${followersCount === 1 ? 'follower' : 'followers'}`,
  ].filter(Boolean);

  const copyAddress = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (await copyTextToClipboard(address)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <article
      onClick={() => coords && onSelect(seller.email, coords)}
      className={`rounded-2xl border bg-white p-3.5 shadow-sm transition-colors ${
        isSelected ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'
      }`}
    >
      <div className="flex gap-3">
        <div className="relative shrink-0">
          <img
            src={logoFailed ? sellerInitialsAvatarDataUri(seller) : resolveSellerLogoUrl(seller)}
            alt=""
            className="h-12 w-12 rounded-xl bg-white object-cover ring-1 ring-slate-200"
            loading="lazy"
            decoding="async"
            onError={() => setLogoFailed(true)}
          />
          {isUserVerified(seller) && (
            <VerifiedBadge show iconOnly size="sm" className="absolute -bottom-1 -right-1" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-900">{name}</h3>
            {isRerideStaffPick(seller.rerideRecommended) && (
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                ★ Recommended
              </span>
            )}
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
            <span className={`inline-flex items-center gap-1 font-medium ${showroom ? 'text-emerald-700' : 'text-blue-700'}`}>
              <span className={`h-2 w-2 rounded-full ${showroom ? 'bg-emerald-600' : 'bg-blue-600'}`} aria-hidden />
              {showroom ? ENTITY_LABEL_SELLER : ENTITY_LABEL_SERVICE_PROVIDER}
            </span>
            {rating && (
              <span className="text-slate-700" aria-label={`Rating ${rating.average} out of 5`}>
                <span className="text-slate-300">· </span>
                <span className="text-amber-500">★</span> {rating.average}
                {rating.count != null && <span className="text-slate-400"> ({rating.count})</span>}
              </span>
            )}
            {meta.length > 0 && <span className="text-slate-500"><span className="text-slate-300">· </span>{meta.join(' · ')}</span>}
          </div>

          <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            <PinIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            {address ? (
              <>
                <span className="truncate">{address}</span>
                <button
                  type="button"
                  onClick={(e) => void copyAddress(e)}
                  aria-label={copied ? 'Address copied' : 'Copy address'}
                  className="shrink-0 rounded px-1 text-[11px] font-medium text-indigo-600"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </>
            ) : (
              <span className="text-slate-400">Address not added yet</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCall(seller);
          }}
          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-indigo-600 text-[13px] font-semibold text-white active:bg-indigo-700"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          Call
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewProfile(seller.email);
          }}
          className="min-h-[40px] rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-700 active:bg-slate-50"
        >
          View profile
        </button>
      </div>
    </article>
  );
});

export const MobileDealerProfilesPage: React.FC<MobileDealerProfilesPageProps> = ({
  sellers: propSellers,
  vehicles = [],
  onViewProfile,
  currentUser,
  onRequireLogin,
  userLocation,
}) => {
  const { isMobileApp } = useIsMobileApp();
  const bottomPad = isMobileApp ? 'calc(56px + env(safe-area-inset-bottom, 0px) + 0.75rem)' : '1.5rem';

  const [searchQuery, setSearchQuery] = useState('');
  const [companyTypeFilter, setCompanyTypeFilter] = useState<CompanyType>('all');
  const [sellers, setSellers] = useState<User[]>(() => {
    const cached = readCachedDealerDirectory();
    return cached.length > 0 ? cached : propSellers ?? [];
  });
  const [isLoadingSellers, setIsLoadingSellers] = useState(sellers.length === 0);
  const [sellersLoadError, setSellersLoadError] = useState<string | null>(null);
  const [coordMap, setCoordMap] = useState<Map<string, CompanyLocation | null>>(new Map());
  const [selectedDealerCenter, setSelectedDealerCenter] = useState<[number, number] | null>(null);
  const [selectedDealerEmail, setSelectedDealerEmail] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const fetchDealers = useCallback(async () => {
    setSellersLoadError(null);
    const { users, failed } = await getDealerDirectory();
    if (users.length > 0 || !failed) setSellers(users);
    else setSellersLoadError('Could not load dealers. Check your connection and try again.');
    setIsLoadingSellers(false);
  }, []);

  // Always fetch public directory — AppProvider `users` cache may lack map location fields.
  useEffect(() => {
    void fetchDealers();
  }, [fetchDealers]);

  useEffect(() => {
    if (sellers.length === 0) return;
    let cancelled = false;
    const apply = (m: Map<string, CompanyLocation | null>) => {
      if (!cancelled) setCoordMap(m);
    };
    void getSellerMapCoordinatesBatch(sellers, apply).then(apply);
    return () => {
      cancelled = true;
    };
  }, [sellers]);

  // Search + header region; type tab is applied after so tabs can show their counts.
  const searchedSellers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    return sellers.filter((seller) => {
      if (userLocation?.trim() && !sellerMatchesHeaderRegion(seller, userLocation)) return false;
      if (!q) return true;
      const pinMatch = qDigits.length >= 3 && normalizeIndianPincode(seller.pincode).includes(qDigits);
      return (
        (seller.dealershipName || seller.name || '').toLowerCase().includes(q) ||
        (seller.location || '').toLowerCase().includes(q) ||
        (seller.address || '').toLowerCase().includes(q) ||
        pinMatch
      );
    });
  }, [sellers, searchQuery, userLocation]);

  const typeCounts = useMemo(
    () => ({
      all: searchedSellers.length,
      showroom: searchedSellers.filter(isShowroom).length,
      'car-service': searchedSellers.filter(isService).length,
    }),
    [searchedSellers]
  );

  const filteredSellersWithCoords = useMemo(
    () =>
      searchedSellers
        .filter(companyTypeFilter === 'all' ? () => true : companyTypeFilter === 'showroom' ? isShowroom : isService)
        .map((seller) => ({ seller, coords: coordMap.get(seller.email || seller.id || '') ?? null })),
    [searchedSellers, companyTypeFilter, coordMap]
  );

  const mapBounds = useMemo(() => {
    const pts = filteredSellersWithCoords.flatMap((i) => (i.coords ? [[i.coords.lat, i.coords.lng] as [number, number]] : []));
    return pts.length > 0 ? L.latLngBounds(pts) : null;
  }, [filteredSellersWithCoords]);

  const vehicleCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of vehicles) {
      if (v.status !== 'published' || !v.sellerEmail) continue;
      const key = v.sellerEmail.toLowerCase().trim();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [vehicles]);

  const followersCountMap = useMemo(() => new Map(sellers.map((s) => [s.email, getFollowersCount(s.email)])), [sellers]);

  const handleCall = useCallback(
    (seller: User) => {
      if (!currentUser) {
        onRequireLogin?.();
        return;
      }
      if (seller.mobile) window.location.href = `tel:${seller.mobile}`;
    },
    [currentUser, onRequireLogin]
  );

  const handleDealerSelect = useCallback((sellerEmail: string, coords: CompanyLocation | null) => {
    if (!coords) return;
    setSelectedDealerEmail(sellerEmail);
    setSelectedDealerCenter([coords.lat, coords.lng]);
    setTimeout(() => {
      cardRefs.current[sellerEmail]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }, []);

  const status = getOpenStatus();
  const hasFilters = !!searchQuery.trim() || companyTypeFilter !== 'all';
  const hasMapDealers = mapBounds !== null;

  return (
    <div className="w-full bg-slate-50" style={{ paddingBottom: bottomPad }}>
      <header className="bg-white px-4 pb-3 pt-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Trusted dealers</h1>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
          <PinIcon className="h-3.5 w-3.5 text-indigo-500" />
          {userLocation || 'All of India'}
          <span className="text-slate-300">·</span>
          <span className={`inline-flex items-center gap-1 ${status.isOpen ? 'text-emerald-700' : ''}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.isOpen ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden />
            {status.label}
          </span>
        </p>

        <div className="relative mt-3">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search name, city or PIN"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search dealers by name, city or PIN"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-[15px] outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          />
        </div>

        <div className="mt-2.5 flex rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Filter by dealer type">
          {TYPE_TABS.map((opt) => {
            const active = companyTypeFilter === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setCompanyTypeFilter(opt.v)}
                className={`min-h-[36px] flex-1 rounded-lg text-xs font-semibold transition-colors ${
                  active ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
                }`}
              >
                {opt.label} <span className={active ? 'text-indigo-400' : 'text-slate-400'}>{typeCounts[opt.v]}</span>
              </button>
            );
          })}
        </div>
      </header>

      <section className="relative isolate h-[200px] w-full overflow-hidden border-y border-slate-200 bg-slate-200" aria-label="Dealer map">
        <DealerMap
          center={INDIA_CENTER}
          zoom={5}
          bounds={mapBounds}
          selectedCenter={selectedDealerCenter}
          filteredSellersWithCoords={filteredSellersWithCoords}
          selectedDealerEmail={selectedDealerEmail}
          onDealerSelect={handleDealerSelect}
        />
        {!hasMapDealers && !isLoadingSellers && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 z-[500] mx-auto w-fit -translate-y-1/2 rounded-xl bg-white/95 px-3 py-2 text-xs font-medium text-slate-600 shadow">
            {coordMap.size === 0 ? 'Locating dealers on the map…' : 'No dealer locations to show yet'}
          </p>
        )}
        <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] flex gap-2.5 rounded-lg bg-white/90 px-2.5 py-1 text-[10.5px] font-medium text-slate-600 shadow-sm">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-600" />{ENTITY_LABEL_SELLER}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-600" />Service</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-600" />Mixed</span>
        </div>
      </section>

      <div className="px-3 pt-3">
        <div className="mb-2 flex items-center justify-between px-1 text-xs text-slate-500">
          <span>
            <strong className="font-semibold text-slate-800">{filteredSellersWithCoords.length}</strong>{' '}
            {filteredSellersWithCoords.length === 1 ? 'dealer' : 'dealers'}
            {hasMapDealers && ' · tap a card to see it on the map'}
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCompanyTypeFilter('all');
              }}
              className="font-medium text-indigo-600"
            >
              Clear
            </button>
          )}
        </div>

        {isLoadingSellers ? (
          <div className="space-y-2.5" aria-busy="true" aria-label="Loading dealers">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[132px] animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />
            ))}
          </div>
        ) : sellersLoadError && filteredSellersWithCoords.length === 0 ? (
          <div className="py-10 text-center">
            <p className="font-semibold text-slate-900">Couldn't load dealers</p>
            <p className="mt-1 text-xs text-slate-500">{sellersLoadError}</p>
            <button
              type="button"
              onClick={() => {
                setIsLoadingSellers(true);
                void fetchDealers();
              }}
              className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : filteredSellersWithCoords.length === 0 ? (
          <div className="py-10 text-center">
            <p className="font-semibold text-slate-900">{hasFilters ? 'No matching dealers' : 'No dealers yet'}</p>
            <p className="mt-1 text-xs text-slate-500">
              {hasFilters ? 'Try a different search, or switch to “All”.' : 'Try another region or check back later.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredSellersWithCoords.map(({ seller, coords }) => (
              <div key={seller.email} ref={(el) => { cardRefs.current[seller.email] = el; }}>
                <MobileDealerCard
                  seller={seller}
                  coords={coords}
                  isSelected={selectedDealerEmail === seller.email}
                  vehicleCount={vehicleCountMap.get(seller.email?.toLowerCase().trim() || '') || 0}
                  followersCount={followersCountMap.get(seller.email) || 0}
                  onSelect={handleDealerSelect}
                  onCall={handleCall}
                  onViewProfile={onViewProfile}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileDealerProfilesPage;
