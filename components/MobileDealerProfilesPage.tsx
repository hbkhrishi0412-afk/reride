import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { User, Vehicle } from '../types';
import { getFollowersCount } from '../services/buyerEngagementService';
import { isUserVerified } from './VerifiedBadge';
import VerifiedBadge from './VerifiedBadge';
import { getSellers } from '../services/userService';
import { getCityCoordinates } from '../services/locationService';
import { CITY_COORDINATES } from '../constants/location';
import { DealerMap, type CompanyLocation } from './DealerProfiles';

// Fix for default marker icons in Leaflet (when map is used)
if (typeof L !== 'undefined' && L.Icon?.Default?.prototype) {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

type CompanyType = 'all' | 'car-service' | 'showroom';

interface MobileDealerProfilesPageProps {
  sellers?: User[];
  vehicles?: Vehicle[];
  onViewProfile: (sellerEmail: string) => void;
}

/** Mobile dealer card: same info as website (address, status, Call now, Reride Recommends) */
const MobileDealerCard: React.FC<{
  seller: User;
  onViewProfile: (sellerEmail: string) => void;
  onSelect?: (sellerEmail: string, coords: CompanyLocation | null) => void;
  isRecommended?: boolean;
  coords?: CompanyLocation | null;
  isSelected?: boolean;
  vehicleCount: number;
  followersCount: number;
}> = React.memo(({
  seller,
  onViewProfile,
  onSelect,
  isRecommended = false,
  coords = null,
  isSelected = false,
  vehicleCount,
  followersCount,
}) => {
  const companyType = (seller.badges?.some(b => b.type === 'top_seller') ? 'showroom' : 'car-service') as 'showroom' | 'car-service';
  const hasProPlan = seller.subscriptionPlan === 'pro' || seller.subscriptionPlan === 'premium';
  const shouldShowRecommendButton = isRecommended || hasProPlan || !!seller.rerideRecommended;

  const getStatus = () => {
    const now = new Date();
    const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const day = istTime.getDay();
    const hour = istTime.getHours();
    const isWeekend = day === 0 || day === 6;
    const isBusinessHours = hour >= 8 && hour < 20;
    const isOpen = !isWeekend && isBusinessHours;
    const statusText = isOpen ? 'Open now' : 'Closed';
    const statusSubtext = isOpen ? '· Closes 8:00 PM' : '· Opens Monday 8:30 AM';
    return { isOpen, statusText, statusSubtext };
  };
  const { isOpen, statusText, statusSubtext } = getStatus();
  const address = seller.address || seller.location || 'Address not available';
  const languages = ['Hindi', 'English'];

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (seller.mobile) window.location.href = `tel:${seller.mobile}`;
  };

  const handleDealerNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelect && coords) onSelect(seller.email, coords);
  };

  const verified = isUserVerified(seller);

  return (
    <div
      className={`bg-white rounded-xl p-4 shadow-sm active:scale-[0.98] transition-transform border-2 ${isSelected ? 'border-orange-500' : 'border-transparent'}`}
      onClick={() => onViewProfile(seller.email)}
    >
      <div className="flex gap-4">
        <div className="relative flex-shrink-0">
          <img
            src={seller.logoUrl || `https://i.pravatar.cc/150?u=${seller.email}`}
            alt={seller.dealershipName || seller.name}
            className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
            loading="lazy"
            decoding="async"
          />
          {verified && (
            <VerifiedBadge show={true} iconOnly size="sm" className="absolute -bottom-1 -right-1" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className="font-bold text-gray-900 truncate mb-0.5 flex items-center gap-1.5"
            onClick={handleDealerNameClick}
            title={coords ? 'Show on map' : undefined}
          >
            {seller.dealershipName || seller.name}
            {coords && (
              <span className="text-gray-400" aria-hidden>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
            )}
          </h3>
          <p className="text-sm text-gray-600 mb-1">{companyType === 'showroom' ? 'Showroom' : 'Car Service'}</p>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isOpen ? 'bg-green-500' : 'bg-red-500'}`} aria-hidden />
            <span className="text-sm text-gray-600">{statusText} <span className="text-gray-500">{statusSubtext}</span></span>
          </div>
          <p className="text-sm text-gray-600 mb-2 truncate">{address}</p>
          <p className="text-xs text-gray-500 mb-2">{languages.join(', ')}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">{vehicleCount} listings · {followersCount} followers</span>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={handleCall}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Call now
            </button>
            {shouldShowRecommendButton && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onViewProfile(seller.email); }}
                className="bg-amber-400 hover:bg-amber-500 text-gray-900 text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="6" cy="19" r="3"/><circle cx="18" cy="19" r="3"/>
                  <path d="M6 16 Q9 12 12 11 Q15 12 18 16 Z"/>
                  <ellipse cx="12" cy="11.5" rx="4" ry="2"/>
                </svg>
                Reride Recommends
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

/**
 * Mobile Dealer Profiles Page – aligned with website: map + list, filters, find nearby dealers.
 */
export const MobileDealerProfilesPage: React.FC<MobileDealerProfilesPageProps> = ({
  sellers: propSellers,
  vehicles = [],
  onViewProfile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [companyTypeFilter, setCompanyTypeFilter] = useState<CompanyType>('all');
  const [sellers, setSellers] = useState<User[]>(propSellers || []);
  const [isLoadingSellers, setIsLoadingSellers] = useState(!propSellers || propSellers.length === 0);
  const [sellersWithCoords, setSellersWithCoords] = useState<Array<{ seller: User; coords: CompanyLocation | null }>>([]);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([20.5937, 78.9629]);
  const [selectedDealerCenter, setSelectedDealerCenter] = useState<[number, number] | null>(null);
  const [selectedDealerEmail, setSelectedDealerEmail] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!propSellers || propSellers.length === 0) {
      const fetchSellers = async () => {
        setIsLoadingSellers(true);
        try {
          const fetchedSellers = await getSellers();
          const validSellers = fetchedSellers.filter(seller => seller.role === 'seller');
          setSellers(validSellers);
        } catch (error) {
          console.error('MobileDealerProfilesPage: Error fetching sellers:', error);
          setSellers([]);
        } finally {
          setIsLoadingSellers(false);
        }
      };
      fetchSellers();
    } else {
      setSellers(propSellers);
      setIsLoadingSellers(false);
    }
  }, [propSellers]);

  useEffect(() => {
    const fetchCoords = async () => {
      const sellersWithLocations = await Promise.all(
        sellers.map(async (seller) => {
          let city = seller.location?.trim() || '';
          if (city.includes(',')) city = city.split(',')[0].trim();
          const cityVariations: Record<string, string> = {
            'delhi': 'New Delhi', 'bangalore': 'Bengaluru', 'bengaluru': 'Bengaluru',
            'calcutta': 'Kolkata', 'madras': 'Chennai', 'bombay': 'Mumbai',
          };
          const normalizedCity = cityVariations[city.toLowerCase()] || city;
          let coords: CompanyLocation | null = null;
          if (normalizedCity && CITY_COORDINATES[normalizedCity]) {
            coords = CITY_COORDINATES[normalizedCity];
          } else if (city) {
            const cityKey = Object.keys(CITY_COORDINATES).find(
              key => key.toLowerCase() === city.toLowerCase() || key.toLowerCase() === normalizedCity.toLowerCase()
            );
            if (cityKey) coords = CITY_COORDINATES[cityKey];
            else {
              const fetched = await getCityCoordinates(city);
              if (fetched) coords = fetched;
            }
          }
          return { seller, coords };
        })
      );
      setSellersWithCoords(sellersWithLocations);
      const validCoords = sellersWithLocations.filter(item => item.coords !== null).map(item => item.coords!);
      if (validCoords.length > 0) {
        setMapBounds(L.latLngBounds(validCoords.map(c => [c.lat, c.lng])));
        const centerLat = validCoords.reduce((sum, c) => sum + c.lat, 0) / validCoords.length;
        const centerLng = validCoords.reduce((sum, c) => sum + c.lng, 0) / validCoords.length;
        setMapCenter([centerLat, centerLng]);
      } else {
        setMapCenter([20.5937, 78.9629]);
      }
    };
    if (sellers.length > 0) fetchCoords();
    else setMapCenter([20.5937, 78.9629]);
  }, [sellers]);

  const filteredSellers = useMemo(() => {
    let filtered = sellers;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(seller =>
        (seller.dealershipName || seller.name || '').toLowerCase().includes(q) ||
        (seller.location || '').toLowerCase().includes(q) ||
        (seller.email || '').toLowerCase().includes(q)
      );
    }
    if (mapSearchQuery.trim()) {
      const q = mapSearchQuery.toLowerCase();
      filtered = filtered.filter(seller =>
        (seller.location || '').toLowerCase().includes(q) ||
        (seller.address || '').toLowerCase().includes(q)
      );
    }
    if (companyTypeFilter !== 'all') {
      filtered = filtered.filter(seller => {
        const isShowroom = seller.badges?.some(b => b.type === 'top_seller');
        if (companyTypeFilter === 'showroom') return isShowroom;
        return !isShowroom;
      });
    }
    return filtered;
  }, [sellers, searchQuery, mapSearchQuery, companyTypeFilter]);

  const filteredSellersWithCoords = useMemo(
    () => sellersWithCoords.filter(item => filteredSellers.some(s => s.email === item.seller.email)),
    [sellersWithCoords, filteredSellers]
  );

  const vehicleCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of vehicles) {
      if (v.status !== 'published' || !v.sellerEmail) continue;
      const key = v.sellerEmail.toLowerCase().trim();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [vehicles]);

  const followersCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sellers) {
      map.set(s.email, getFollowersCount(s.email));
    }
    return map;
  }, [sellers]);

  const handleDealerSelect = useCallback((sellerEmail: string, coords: CompanyLocation | null) => {
    if (coords) {
      setSelectedDealerEmail(sellerEmail);
      setSelectedDealerCenter([coords.lat, coords.lng]);
      setTimeout(() => {
        const el = cardRefs.current[sellerEmail];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, []);

  const handleMapClickDealerSelect = useCallback((sellerEmail: string, coords: CompanyLocation) => {
    setSelectedDealerEmail(sellerEmail);
    setSelectedDealerCenter([coords.lat, coords.lng]);
    onViewProfile(sellerEmail);
  }, [onViewProfile]);

  const hasMapDealers = filteredSellersWithCoords.some(item => item.coords !== null);

  return (
    <div className="min-h-screen bg-gray-50 pb-24 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 shrink-0">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Dealer Profiles</h1>
        <p className="text-gray-600 text-sm">
          Showing {filteredSellers.length}{filteredSellers.length !== sellers.length ? ` of ${sellers.length}` : ''} dealers
        </p>
      </div>

      {/* Map - find nearby dealers (always visible at top) */}
      <div className="shrink-0 w-full bg-gray-200 relative" style={{ minHeight: 280, height: 280 }}>
        <div className="absolute inset-0 flex flex-col z-0">
          <div className="px-4 py-2 bg-white/90 border-b border-gray-200 flex items-center gap-2 shrink-0">
            <span className="text-sm font-semibold text-gray-700">Map</span>
            <span className="text-xs text-gray-500">— Find nearby dealers</span>
          </div>
          <div className="flex-1 min-h-0 relative" style={{ minHeight: 220 }}>
            {!hasMapDealers && !isLoadingSellers ? (
              <div className="absolute inset-0 z-[500] flex items-center justify-center bg-gray-100/95">
                <p className="text-gray-600 text-sm text-center px-4">No dealer locations on map. Add city/address to dealer profiles to see pins.</p>
              </div>
            ) : null}
            <DealerMap
              center={mapCenter}
              zoom={5}
              bounds={mapBounds}
              selectedCenter={selectedDealerCenter}
              filteredSellersWithCoords={filteredSellersWithCoords}
              selectedDealerEmail={selectedDealerEmail}
              onDealerSelect={handleMapClickDealerSelect}
              onViewProfile={onViewProfile}
            />
          </div>
        </div>
      </div>

      {/* Search by name or location */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="search"
            placeholder="Search dealers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
            style={{ minHeight: '48px' }}
          />
        </div>
        {/* Filter by city or area (map filter) */}
        <div className="relative mt-2">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </span>
          <input
            type="search"
            placeholder="Filter by city or area"
            value={mapSearchQuery}
            onChange={(e) => setMapSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
        {/* Type filter: All | Car Service | Showroom */}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <span className="text-sm font-medium text-gray-600">Type:</span>
          {(['all', 'car-service', 'showroom'] as const).map((type) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="companyTypeMobile"
                value={type}
                checked={companyTypeFilter === type}
                onChange={() => setCompanyTypeFilter(type)}
                className="w-4 h-4 text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">
                {type === 'all' ? 'All' : type === 'car-service' ? 'Car Service' : 'Showroom'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Dealer list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoadingSellers ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading dealers...</p>
          </div>
        ) : filteredSellers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">
              {searchQuery || mapSearchQuery || companyTypeFilter !== 'all'
                ? 'No dealers found matching your search'
                : 'No dealers available'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSellers.map((seller, index) => {
              const sellerWithCoords = sellersWithCoords.find(item => item.seller.email === seller.email);
              return (
                <div key={seller.email} ref={(el) => { cardRefs.current[seller.email] = el; }}>
                  <MobileDealerCard
                    seller={seller}
                    onViewProfile={onViewProfile}
                    onSelect={handleDealerSelect}
                    isRecommended={index === 0}
                    coords={sellerWithCoords?.coords ?? null}
                    isSelected={selectedDealerEmail === seller.email}
                    vehicleCount={vehicleCountMap.get(seller.email?.toLowerCase().trim() || '') || 0}
                    followersCount={followersCountMap.get(seller.email) || 0}
                  />
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
