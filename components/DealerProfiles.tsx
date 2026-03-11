import React, { useState, useMemo, useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { User, Vehicle } from '../types.js';
import { getSellers } from '../services/userService.js';
import { getCityCoordinates } from '../services/locationService.js';
import { CITY_COORDINATES } from '../constants/location.js';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface DealerProfilesProps {
  sellers?: User[];
  vehicles?: Vehicle[];
  onViewProfile: (sellerEmail: string) => void;
}

type CompanyType = 'all' | 'car-service' | 'showroom';

export interface CompanyLocation {
  lat: number;
  lng: number;
}

// Imperative Leaflet map: create/destroy in useEffect to avoid "Map container is already initialized"
export const DealerMap: React.FC<{
  center: [number, number];
  zoom: number;
  bounds: L.LatLngBounds | null;
  selectedCenter: [number, number] | null;
  filteredSellersWithCoords: Array<{ seller: User; coords: CompanyLocation | null }>;
  selectedDealerEmail: string | null;
  onDealerSelect: (sellerEmail: string, coords: CompanyLocation) => void;
  onViewProfile: (sellerEmail: string) => void;
}> = ({
  center,
  zoom,
  bounds,
  selectedCenter,
  filteredSellersWithCoords,
  selectedDealerEmail,
  onDealerSelect,
  onViewProfile,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Create map once when container is mounted
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      center,
      zoom: bounds ? undefined : zoom,
      zoomControl: true,
      scrollWheelZoom: true,
    });
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  // Update view when bounds or selected center change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (selectedCenter) {
      map.setView(selectedCenter, 13, { animate: true, duration: 0.5 });
    } else if (bounds && bounds.isValid()) {
      try {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      } catch (_) {}
    }
  }, [bounds, selectedCenter]);

  // Map click: find nearest dealer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      const target = e.originalEvent?.target as HTMLElement;
      if (target?.closest('.leaflet-marker-icon')) return;

      const dealersWithCoords = filteredSellersWithCoords.filter(item => item.coords !== null);
      if (dealersWithCoords.length === 0) return;

      const clickedLat = e.latlng.lat;
      const clickedLng = e.latlng.lng;
      let nearest: { seller: User; coords: CompanyLocation } | null = null;
      let minDist = Infinity;
      const R = 6371;
      for (const item of dealersWithCoords) {
        if (!item.coords) continue;
        const dLat = (clickedLat - item.coords.lat) * Math.PI / 180;
        const dLng = (clickedLng - item.coords.lng) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(item.coords.lat * Math.PI / 180) * Math.cos(clickedLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const dist = R * c;
        if (dist < minDist) {
          minDist = dist;
          nearest = { seller: item.seller, coords: item.coords };
        }
      }
      if (nearest) onDealerSelect(nearest.seller.email, nearest.coords);
    };

    map.on('click', handleClick);
    return () => { map.off('click', handleClick); };
  }, [filteredSellersWithCoords, onDealerSelect]);

  const iconDefault = useMemo(
    () =>
      L.divIcon({
        className: 'custom-marker',
        html: `<div style="width:25px;height:25px;background:#2563eb;border:2px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
        iconSize: [25, 25],
        iconAnchor: [12, 25],
        popupAnchor: [0, -25],
      }),
    []
  );
  const iconSelected = useMemo(
    () =>
      L.divIcon({
        className: 'custom-marker-selected',
        html: `<div style="width:30px;height:30px;background:#ef4444;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30],
      }),
    []
  );
  // Showroom: green pin (Car Service stays blue)
  const iconShowroomDefault = useMemo(
    () =>
      L.divIcon({
        className: 'custom-marker-showroom',
        html: `<div style="width:25px;height:25px;background:#16a34a;border:2px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
        iconSize: [25, 25],
        iconAnchor: [12, 25],
        popupAnchor: [0, -25],
      }),
    []
  );
  const iconShowroomSelected = useMemo(
    () =>
      L.divIcon({
        className: 'custom-marker-showroom-selected',
        html: `<div style="width:30px;height:30px;background:#ea580c;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30],
      }),
    []
  );

  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    const isShowroom = (s: User) => s.badges?.some(b => b.type === 'top_seller') ?? false;

    layer.clearLayers();
    const items = filteredSellersWithCoords.filter(item => item.coords !== null) as Array<{ seller: User; coords: CompanyLocation }>;

    const createCountIcon = (count: number, type: 'car-service' | 'showroom' | 'mixed') => {
      const bg = type === 'showroom' ? '#16a34a' : type === 'car-service' ? '#2563eb' : '#7c3aed';
      return L.divIcon({
        className: 'dealer-count-marker',
        html: `<div style="width:36px;height:36px;background:${bg};border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:white;font-family:system-ui,sans-serif">${count}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18],
      });
    };

    const groupKey = (c: CompanyLocation) => `${c.lat.toFixed(3)},${c.lng.toFixed(3)}`;
    const groups = new Map<string, Array<{ seller: User; coords: CompanyLocation }>>();
    for (const item of items) {
      const key = groupKey(item.coords);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    for (const [, groupItems] of groups) {
      const first = groupItems[0];
      const { lat, lng } = first.coords;
      const count = groupItems.length;
      const showroomCount = groupItems.filter(i => isShowroom(i.seller)).length;
      const clusterType: 'car-service' | 'showroom' | 'mixed' =
        showroomCount === 0 ? 'car-service' : showroomCount === count ? 'showroom' : 'mixed';

      if (count === 1) {
        const item = first;
        const isSelected = selectedDealerEmail === item.seller.email;
        const showroom = isShowroom(item.seller);
        const icon = isSelected
          ? (showroom ? iconShowroomSelected : iconSelected)
          : (showroom ? iconShowroomDefault : iconDefault);
        const marker = L.marker([lat, lng], { icon });
        const name = item.seller.dealershipName || item.seller.name;
        const location = item.seller.location || '';
        const typeLabel = showroom ? 'Showroom' : 'Car Service';
        marker.bindPopup(
          `<div class="p-2">
            <h3 class="font-semibold text-blue-600 mb-1">${escapeHtml(name)}</h3>
            <p class="text-sm text-gray-600">${escapeHtml(location)}</p>
            <p class="text-xs text-gray-500 mt-1">${typeLabel} · 1 dealer in this area</p>
            <button type="button" class="mt-2 text-sm text-blue-600 hover:text-blue-700 dealer-popup-view">View Profile</button>
          </div>`,
          { className: 'dealer-popup' }
        );
        marker.on('popupopen', () => {
          const el = marker.getPopup()?.getElement();
          el?.querySelector('.dealer-popup-view')?.addEventListener('click', () => {
            onDealerSelect(item.seller.email, item.coords);
            onViewProfile(item.seller.email);
          });
        });
        marker.on('click', () => {
          onViewProfile(item.seller.email);
        });
        layer.addLayer(marker);
      } else {
        const marker = L.marker([lat, lng], { icon: createCountIcon(count, clusterType) });
        const namesList = groupItems
          .map(
            (i) =>
              `<button type="button" class="dealer-popup-item block w-full text-left text-sm text-blue-600 hover:text-blue-800 py-1 px-0 border-0 bg-transparent cursor-pointer" data-email="${escapeHtml(i.seller.email)}">${escapeHtml(i.seller.dealershipName || i.seller.name)}</button>`
          )
          .join('');
        const typeLabel = clusterType === 'mixed' ? 'Car showrooms & services' : clusterType === 'showroom' ? 'Car showrooms' : 'Car services';
        marker.bindPopup(
          `<div class="p-2 dealer-cluster-popup">
            <h3 class="font-semibold text-gray-900 mb-1">${count} dealers in this area</h3>
            <p class="text-xs text-gray-500 mb-2">${typeLabel}</p>
            <div class="space-y-0.5">${namesList}</div>
          </div>`,
          { className: 'dealer-popup' }
        );
        marker.on('popupopen', () => {
          const el = marker.getPopup()?.getElement();
          el?.querySelectorAll('.dealer-popup-item').forEach((btn) => {
            btn.addEventListener('click', () => {
              const email = (btn as HTMLElement).getAttribute('data-email');
              const item = groupItems.find((i) => i.seller.email === email);
              if (item) {
                onDealerSelect(item.seller.email, item.coords);
                onViewProfile(item.seller.email);
              }
            });
          });
        });
        marker.on('click', () => {
          const item = groupItems[0];
          if (item) onViewProfile(item.seller.email);
        });
        layer.addLayer(marker);
      }
    }
  }, [filteredSellersWithCoords, selectedDealerEmail, iconDefault, iconSelected, iconShowroomDefault, iconShowroomSelected, onDealerSelect, onViewProfile]);

  return <div ref={containerRef} className="h-full w-full" style={{ minHeight: 300 }} />;
};

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

const CompanyCard: React.FC<{
  seller: User;
  onViewProfile: (sellerEmail: string) => void;
  onSelect?: (sellerEmail: string, coords: CompanyLocation | null) => void;
  onCall?: (phone: string) => void;
  isRecommended?: boolean;
  coords?: CompanyLocation | null;
  isSelected?: boolean;
}> = ({ seller, onViewProfile, onSelect, onCall, isRecommended = false, coords = null, isSelected = false }) => {
  // Determine company type - default to 'showroom' if not specified
  const companyType = (seller.badges?.some(b => b.type === 'top_seller') ? 'showroom' : 'car-service') as 'showroom' | 'car-service';
  
  // Check if seller has pro or premium plan - show yellow button for pro/premium plan sellers
  const hasProPlan = seller.subscriptionPlan === 'pro' || seller.subscriptionPlan === 'premium';
  const shouldShowRecommendButton = isRecommended || hasProPlan || !!seller.rerideRecommended;
  
  // Determine status based on current time (Indian Standard Time)
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
  
  // Get address - prefer address field, fallback to location
  const address = seller.address || seller.location || 'Address not available';
  
  // Languages - default to Hindi and English for Indian dealers
  const languages = ['Hindi', 'English'];
  
  const handleCall = () => {
    if (seller.mobile && onCall) {
      onCall(seller.mobile);
    } else {
      window.location.href = `tel:${seller.mobile || ''}`;
    }
  };

  const handleDealerNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelect && coords) {
      onSelect(seller.email, coords);
    }
  };

  return (
    <div 
      className={`bg-white border-b border-gray-200 p-4 hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''}`}
      onClick={() => onViewProfile(seller.email)}
    >
      <div className="flex gap-4">
        {/* Company Logo */}
        <div className="flex-shrink-0">
          <img
            src={seller.logoUrl || `https://i.pravatar.cc/80?u=${seller.email}`}
            alt={seller.dealershipName || seller.name}
            className="w-16 h-16 rounded object-cover border border-gray-200"
          />
        </div>
        
        {/* Company Details */}
        <div className="flex-1 min-w-0">
          {/* Company Name - Clickable to show on map when location available */}
          <h3 
            className="text-blue-600 font-semibold text-base mb-1 hover:underline cursor-pointer inline-flex items-center gap-1.5"
            onClick={handleDealerNameClick}
            title={coords ? 'Show location on map' : undefined}
          >
            {seller.dealershipName || seller.name}
            {coords && (
              <span className="text-gray-400 hover:text-blue-500" title="Show on map">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
            )}
          </h3>
          
          {/* Company Type */}
          <p className="text-sm text-gray-600 mb-2">{companyType === 'showroom' ? 'Showroom' : 'Car Service'}</p>
          
          {/* Status */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isOpen ? 'bg-green-500' : 'bg-red-500'}`} aria-hidden />
            <span className="text-sm text-gray-600">
              {statusText} <span className="text-gray-500">{statusSubtext}</span>
            </span>
          </div>
          
          {/* Address */}
          <p className="text-sm text-gray-600 mb-2">
            {address === 'Address not available' ? (
              <span className="text-gray-400 italic">{address}</span>
            ) : (
              address
            )}
          </p>
          
          {/* Languages */}
          <p className="text-sm text-gray-600 mb-3">{languages.join(', ')}</p>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCall();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded flex items-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Call now
            </button>
            {shouldShowRecommendButton && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewProfile(seller.email);
                }}
                className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-medium px-4 py-2 rounded flex items-center gap-2 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  {/* Motorcycle/Scooter Icon - Side View with filled design */}
                  {/* Front wheel */}
                  <circle cx="6" cy="19" r="3"/>
                  {/* Rear wheel */}
                  <circle cx="18" cy="19" r="3"/>
                  {/* Vehicle body/frame */}
                  <path d="M6 16 Q9 12 12 11 Q15 12 18 16 Z"/>
                  {/* Seat */}
                  <ellipse cx="12" cy="11.5" rx="4" ry="2"/>
                  {/* Handlebars - left */}
                  <rect x="8" y="9" width="1.5" height="3" rx="0.75" transform="rotate(-45 8.75 10.5)"/>
                  {/* Handlebars - right */}
                  <rect x="14.5" y="9" width="1.5" height="3" rx="0.75" transform="rotate(45 15.25 10.5)"/>
                </svg>
                Reride Recommends
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const DealerProfiles: React.FC<DealerProfilesProps> = ({ sellers: propSellers, onViewProfile }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [companyTypeFilter, setCompanyTypeFilter] = useState<CompanyType>('all');
  const [sellers, setSellers] = useState<User[]>(propSellers || []);
  const [isLoadingSellers, setIsLoadingSellers] = useState(!propSellers || propSellers.length === 0);
  const [sellerLoadError, setSellerLoadError] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([20.5937, 78.9629]); // Default to India center
  const [selectedDealerCenter, setSelectedDealerCenter] = useState<[number, number] | null>(null);
  const [selectedDealerEmail, setSelectedDealerEmail] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Fetch sellers
  useEffect(() => {
    if (!propSellers || propSellers.length === 0) {
      const fetchSellers = async () => {
        setIsLoadingSellers(true);
        setSellerLoadError(null);
        try {
          const fetchedSellers = await getSellers();
          const validSellers = fetchedSellers.filter(seller => seller.role === 'seller');
          setSellers(validSellers);
          
          if (validSellers.length === 0) {
            setSellerLoadError('No sellers found. Please check back later.');
          }
        } catch (error) {
          console.error('Error fetching sellers:', error);
          setSellerLoadError('Failed to load sellers. Please try refreshing the page.');
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

  // State for sellers with coordinates
  const [sellersWithCoords, setSellersWithCoords] = useState<Array<{ seller: User; coords: CompanyLocation | null }>>([]);

  // Get coordinates for sellers
  useEffect(() => {
    const fetchCoords = async () => {
      const sellersWithLocations = await Promise.all(
        sellers.map(async (seller) => {
          // Parse location - handle various formats like "Mumbai, Maharashtra" or just "Mumbai"
          let city = seller.location?.trim() || '';
          
          // Extract city name (first part before comma, or the whole string)
          if (city.includes(',')) {
            city = city.split(',')[0].trim();
          }
          
          // Handle common city name variations
          const cityVariations: Record<string, string> = {
            'delhi': 'New Delhi',
            'bangalore': 'Bengaluru',
            'bengaluru': 'Bengaluru',
            'calcutta': 'Kolkata',
            'madras': 'Chennai',
            'bombay': 'Mumbai',
          };
          
          const normalizedCity = cityVariations[city.toLowerCase()] || city;
          
          // Try to match city name (case-insensitive)
          let coords: CompanyLocation | null = null;
          
          // First try exact match
          if (normalizedCity && CITY_COORDINATES[normalizedCity]) {
            coords = CITY_COORDINATES[normalizedCity];
          } else if (city) {
            // Try case-insensitive match
            const cityKey = Object.keys(CITY_COORDINATES).find(
              key => key.toLowerCase() === city.toLowerCase() || key.toLowerCase() === normalizedCity.toLowerCase()
            );
            if (cityKey) {
              coords = CITY_COORDINATES[cityKey];
            } else {
              // Try to fetch coordinates from constants.ts
              const fetchedCoords = await getCityCoordinates(city);
              if (fetchedCoords) {
                coords = fetchedCoords;
              }
            }
          }
          
          return {
            seller,
            coords,
          };
        })
      );
      
      setSellersWithCoords(sellersWithLocations);
      
      // Update map bounds
      const validCoords = sellersWithLocations
        .filter(item => item.coords !== null)
        .map(item => item.coords!);
      
      if (validCoords.length > 0) {
        const bounds = L.latLngBounds(validCoords.map(c => [c.lat, c.lng]));
        setMapBounds(bounds);
        
        // Set center to center of bounds or first coordinate
        const centerLat = validCoords.reduce((sum, c) => sum + c.lat, 0) / validCoords.length;
        const centerLng = validCoords.reduce((sum, c) => sum + c.lng, 0) / validCoords.length;
        setMapCenter([centerLat, centerLng]);
      } else {
        // If no valid coordinates, use India center
        setMapCenter([20.5937, 78.9629]);
      }
    };
    
    if (sellers.length > 0) {
      fetchCoords();
    } else {
      // Reset to India center if no sellers
      setMapCenter([20.5937, 78.9629]);
    }
  }, [sellers]);

  // Filter sellers
  const filteredSellers = useMemo(() => {
    let filtered = sellers;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(seller => {
        const name = (seller.dealershipName || seller.name || '').toLowerCase();
        const location = (seller.location || '').toLowerCase();
        return name.includes(query) || location.includes(query);
      });
    }

    if (mapSearchQuery.trim()) {
      const query = mapSearchQuery.toLowerCase();
      filtered = filtered.filter(seller => {
        const location = (seller.location || '').toLowerCase();
        const address = (seller.address || '').toLowerCase();
        return location.includes(query) || address.includes(query);
      });
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

  // Get filtered sellers with coordinates
  const filteredSellersWithCoords = useMemo(() => {
    return sellersWithCoords.filter(item => 
      filteredSellers.some(s => s.email === item.seller.email)
    );
  }, [sellersWithCoords, filteredSellers]);

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  // Handle dealer selection - center map on selected dealer and scroll card into view
  const handleDealerSelect = (sellerEmail: string, coords: CompanyLocation | null) => {
    if (coords) {
      setSelectedDealerEmail(sellerEmail);
      setSelectedDealerCenter([coords.lat, coords.lng]);
      setTimeout(() => {
        const el = cardRefs.current[sellerEmail];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  };

  // Handle map click - find nearest dealer and display details
  const handleMapClickDealerSelect = (sellerEmail: string, coords: CompanyLocation) => {
    setSelectedDealerEmail(sellerEmail);
    setSelectedDealerCenter([coords.lat, coords.lng]);
    onViewProfile(sellerEmail);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Main Content Area - Split Layout: stack on small screens, side-by-side on lg+ */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 border-r border-gray-200 flex flex-col overflow-hidden bg-white shadow-sm">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              Dealers in selected region
            </h1>
            <p className="text-sm text-gray-500 mb-4">
              {!isLoadingSellers && !sellerLoadError && (
                <>
                  Showing <span className="font-medium text-gray-700">{filteredSellers.length}</span>
                  {filteredSellers.length !== sellers.length
                    ? ` of ${sellers.length}`
                    : ''}{' '}
                  dealers
                </>
              )}
            </p>
            
            {/* Search Bar */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  ref={searchInputRef}
                  type="search"
                  placeholder="Search by name or location"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search dealers by name or location"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                />
              </div>
            </div>
            
            {/* Filter Options */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-600">Type:</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="companyType"
                  value="all"
                  checked={companyTypeFilter === 'all'}
                  onChange={(e) => setCompanyTypeFilter(e.target.value as CompanyType)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">All</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="companyType"
                  value="car-service"
                  checked={companyTypeFilter === 'car-service'}
                  onChange={(e) => setCompanyTypeFilter(e.target.value as CompanyType)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Car Service</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="companyType"
                  value="showroom"
                  checked={companyTypeFilter === 'showroom'}
                  onChange={(e) => setCompanyTypeFilter(e.target.value as CompanyType)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Showroom</span>
              </label>
            </div>
            <p className="text-xs text-gray-400 mt-2">Click a dealer name to locate on map</p>
          </div>
          
          {/* Company List */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingSellers ? (
              <div className="flex flex-col items-center justify-center min-h-[280px] p-6">
                <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-600 font-medium">Loading dealers...</p>
                <p className="text-sm text-gray-400 mt-1">Finding dealers in your region</p>
              </div>
            ) : sellerLoadError ? (
              <div className="flex flex-col items-center justify-center min-h-[280px] p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-gray-900 font-medium mb-1">Couldn't load dealers</p>
                <p className="text-sm text-gray-600 mb-4 max-w-xs">{sellerLoadError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : filteredSellers.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[280px] p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-gray-900 font-medium mb-1">
                  {searchQuery || companyTypeFilter !== 'all' ? 'No matching dealers' : 'No dealers yet'}
                </p>
                <p className="text-sm text-gray-500">
                  {searchQuery ? 'Try a different search or filter' : 'Check back later for dealers in this region'}
                </p>
              </div>
            ) : (
              <div ref={listRef} className="divide-y divide-gray-100">
                {filteredSellers.map((seller, index) => {
                  const sellerWithCoords = sellersWithCoords.find(item => item.seller.email === seller.email);
                  return (
                    <div
                      key={seller.email}
                      ref={(el) => { cardRefs.current[seller.email] = el; }}
                    >
                      <CompanyCard
                        seller={seller}
                        onViewProfile={onViewProfile}
                        onSelect={handleDealerSelect}
                        onCall={handleCall}
                        isRecommended={index === 0}
                        coords={sellerWithCoords?.coords || null}
                        isSelected={selectedDealerEmail === seller.email}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        
        {/* Right Map Section */}
        <div className="flex-1 relative min-h-[300px] lg:min-h-0">
          {/* Map Search - filter by city/location */}
          <div className="absolute top-4 left-4 z-[1000] w-64">
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <input
                type="search"
                placeholder="Filter by city or area"
                value={mapSearchQuery}
                onChange={(e) => setMapSearchQuery(e.target.value)}
                aria-label="Filter dealers by city or area"
                className="w-full pl-10 pr-4 py-2.5 bg-white/95 backdrop-blur border border-gray-300 rounded-lg shadow-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-600 bg-white/90 rounded-lg px-2 py-1.5 shadow-sm">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" aria-hidden /> Car Service</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#16a34a]" aria-hidden /> Showroom</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#7c3aed]" aria-hidden /> Both</span>
            </div>
          </div>
          
          {/* Empty map state when no dealer locations */}
          {filteredSellersWithCoords.filter(item => item.coords !== null).length === 0 && !isLoadingSellers && (
            <div className="absolute inset-0 z-[500] flex items-center justify-center bg-gray-100/80 backdrop-blur-[1px] pointer-events-none">
              <div className="bg-white/90 rounded-xl shadow-lg px-6 py-4 text-center max-w-xs">
                <p className="text-gray-700 font-medium">No dealer locations on map</p>
                <p className="text-sm text-gray-500 mt-1">Locations appear when dealers have address data</p>
              </div>
            </div>
          )}
          
          {/* Map - imperative Leaflet (no react-leaflet MapContainer) to avoid "already initialized" */}
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
  );
};

export default DealerProfiles;
