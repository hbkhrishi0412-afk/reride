import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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

interface CompanyLocation {
  lat: number;
  lng: number;
}

// Component to handle map bounds updates
const MapBoundsUpdater: React.FC<{ bounds: L.LatLngBounds | null }> = ({ bounds }) => {
  const map = useMap();
  
  useEffect(() => {
    if (bounds && bounds.isValid()) {
      try {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      } catch (error) {
        console.warn('Error fitting map bounds:', error);
      }
    }
  }, [bounds, map]);
  
  return null;
};

// Component to center map on selected dealer
const MapCenterUpdater: React.FC<{ center: [number, number] | null; zoom?: number }> = ({ center, zoom = 13 }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom, {
        animate: true,
        duration: 0.5
      });
    }
  }, [center, zoom, map]);
  
  return null;
};

// Component to handle map clicks and find nearest dealer
const MapClickHandler: React.FC<{
  sellersWithCoords: Array<{ seller: User; coords: CompanyLocation | null }>;
  onDealerSelect: (sellerEmail: string, coords: CompanyLocation) => void;
}> = ({ sellersWithCoords, onDealerSelect }) => {
  const map = useMap();
  
  useEffect(() => {
    const handleMapClick = (e: L.LeafletMouseEvent) => {
      // Don't process if clicking on a marker (markers handle their own clicks)
      const target = e.originalEvent?.target as HTMLElement;
      if (target?.closest('.leaflet-marker-icon')) {
        return;
      }
      
      const clickedLat = e.latlng.lat;
      const clickedLng = e.latlng.lng;
      
      // Only proceed if we have dealers with coordinates
      const dealersWithCoords = sellersWithCoords.filter(item => item.coords !== null);
      if (dealersWithCoords.length === 0) {
        return;
      }
      
      // Find the nearest dealer to the clicked location
      let nearestDealer: { seller: User; coords: CompanyLocation } | null = null;
      let minDistance = Infinity;
      
      for (const item of dealersWithCoords) {
        if (item.coords) {
          // Calculate distance using Haversine formula
          const R = 6371; // Earth's radius in km
          const dLat = (clickedLat - item.coords.lat) * Math.PI / 180;
          const dLng = (clickedLng - item.coords.lng) * Math.PI / 180;
          const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(item.coords.lat * Math.PI / 180) * Math.cos(clickedLat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;
          
          if (distance < minDistance) {
            minDistance = distance;
            nearestDealer = { seller: item.seller, coords: item.coords };
          }
        }
      }
      
      // Always show the nearest dealer's details when clicking on the map
      if (nearestDealer !== null) {
        const dealer = nearestDealer;
        onDealerSelect(dealer.seller.email, dealer.coords);
      }
    };
    
    map.on('click', handleMapClick);
    
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, sellersWithCoords, onDealerSelect]);
  
  return null;
};

// Company Card Component matching the image design
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
  const shouldShowRecommendButton = isRecommended || hasProPlan;
  
  // Determine status based on current time (Indian Standard Time)
  const getStatus = () => {
    const now = new Date();
    const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const day = istTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hour = istTime.getHours();
    
    // Assume business hours: Monday-Saturday, 8:30 AM - 8:00 PM
    const isWeekend = day === 0 || day === 6; // Sunday or Saturday
    const isBusinessHours = hour >= 8 && hour < 20;
    
    const isOpen = !isWeekend && isBusinessHours;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const statusText = isOpen ? 'Open' : 'Closed';
    const statusTime = `${dayNames[day]} at ${hour.toString().padStart(2, '0')}:${istTime.getMinutes().toString().padStart(2, '0')}`;
    
    return { isOpen, statusText, statusTime };
  };
  
  const { isOpen, statusText, statusTime } = getStatus();
  
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
          {/* Company Name - Clickable to show on map */}
          <h3 
            className="text-blue-600 font-semibold text-base mb-1 hover:underline cursor-pointer"
            onClick={handleDealerNameClick}
            title="Click to show location on map"
          >
            {seller.dealershipName || seller.name}
          </h3>
          
          {/* Company Type */}
          <p className="text-sm text-gray-600 mb-2">{companyType === 'showroom' ? 'Showroom' : 'Car Service'}</p>
          
          {/* Status */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-sm text-gray-600">
              {statusText} {statusTime}
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
  const [companyTypeFilter, setCompanyTypeFilter] = useState<CompanyType>('all');
  const [sellers, setSellers] = useState<User[]>(propSellers || []);
  const [isLoadingSellers, setIsLoadingSellers] = useState(!propSellers || propSellers.length === 0);
  const [sellerLoadError, setSellerLoadError] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([20.5937, 78.9629]); // Default to India center
  const [selectedDealerCenter, setSelectedDealerCenter] = useState<[number, number] | null>(null);
  const [selectedDealerEmail, setSelectedDealerEmail] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(seller => {
        const name = (seller.dealershipName || seller.name || '').toLowerCase();
        const location = (seller.location || '').toLowerCase();
        return name.includes(query) || location.includes(query);
      });
    }

    // Apply company type filter
    if (companyTypeFilter !== 'all') {
      filtered = filtered.filter(seller => {
        const isShowroom = seller.badges?.some(b => b.type === 'top_seller');
        if (companyTypeFilter === 'showroom') {
          return isShowroom;
        } else {
          return !isShowroom;
        }
      });
    }

    return filtered;
  }, [sellers, searchQuery, companyTypeFilter]);

  // Get filtered sellers with coordinates
  const filteredSellersWithCoords = useMemo(() => {
    return sellersWithCoords.filter(item => 
      filteredSellers.some(s => s.email === item.seller.email)
    );
  }, [sellersWithCoords, filteredSellers]);

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  // Handle dealer selection - center map on selected dealer
  const handleDealerSelect = (sellerEmail: string, coords: CompanyLocation | null) => {
    if (coords) {
      setSelectedDealerEmail(sellerEmail);
      setSelectedDealerCenter([coords.lat, coords.lng]);
    }
  };

  // Handle map click - find nearest dealer and display details
  const handleMapClickDealerSelect = (sellerEmail: string, coords: CompanyLocation) => {
    setSelectedDealerEmail(sellerEmail);
    setSelectedDealerCenter([coords.lat, coords.lng]);
    onViewProfile(sellerEmail);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Main Content Area - Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-1/3 border-r border-gray-300 flex flex-col overflow-hidden bg-white">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-300">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Dealers in Selected Region
            </h1>
            
            {/* Search Bar */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search by name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Parameters
              </button>
            </div>
            
            {/* Filter Options */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="companyType"
                  value="all"
                  checked={companyTypeFilter === 'all'}
                  onChange={(e) => setCompanyTypeFilter(e.target.value as CompanyType)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">All</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="companyType"
                  value="car-service"
                  checked={companyTypeFilter === 'car-service'}
                  onChange={(e) => setCompanyTypeFilter(e.target.value as CompanyType)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">Car Service</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="companyType"
                  value="showroom"
                  checked={companyTypeFilter === 'showroom'}
                  onChange={(e) => setCompanyTypeFilter(e.target.value as CompanyType)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">Showroom</span>
              </label>
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium ml-auto">
                More
              </button>
            </div>
          </div>
          
          {/* Company List */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingSellers ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading companies...</p>
                </div>
              </div>
            ) : sellerLoadError ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-4">
                  <p className="text-red-600 mb-4">{sellerLoadError}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : filteredSellers.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-4">
                  <p className="text-gray-600">
                    {searchQuery ? 'No companies found matching your search' : 'No companies available'}
                  </p>
                </div>
              </div>
            ) : (
              filteredSellers.map((seller, index) => {
                const sellerWithCoords = sellersWithCoords.find(item => item.seller.email === seller.email);
                return (
                  <CompanyCard
                    key={seller.email}
                    seller={seller}
                    onViewProfile={onViewProfile}
                    onSelect={handleDealerSelect}
                    onCall={handleCall}
                    isRecommended={index === 0} // First company is recommended
                    coords={sellerWithCoords?.coords || null}
                    isSelected={selectedDealerEmail === seller.email}
                  />
                );
              })
            )}
          </div>
        </div>
        
        {/* Right Map Section */}
        <div className="flex-1 relative">
          {/* Map Search */}
          <div className="absolute top-4 left-4 z-[1000] w-64">
            <div className="relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="City or district"
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg shadow-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* Map */}
          <MapContainer
            center={mapCenter}
            zoom={mapBounds ? undefined : 5}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
            key={`map-${mapCenter[0]}-${mapCenter[1]}`}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapBoundsUpdater bounds={mapBounds} />
            <MapCenterUpdater center={selectedDealerCenter} />
            <MapClickHandler 
              sellersWithCoords={filteredSellersWithCoords}
              onDealerSelect={handleMapClickDealerSelect}
            />
            {/* Markers for each company */}
            {filteredSellersWithCoords
              .filter(item => item.coords !== null)
              .map((item) => {
                const isSelected = selectedDealerEmail === item.seller.email;
                // Create custom icon for selected marker (red) vs default (blue)
                const customIcon = isSelected 
                  ? L.divIcon({
                      className: 'custom-marker-selected',
                      html: `<div style="
                        width: 30px;
                        height: 30px;
                        background-color: #ef4444;
                        border: 3px solid white;
                        border-radius: 50% 50% 50% 0;
                        transform: rotate(-45deg);
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                      "></div>`,
                      iconSize: [30, 30],
                      iconAnchor: [15, 30],
                      popupAnchor: [0, -30]
                    })
                  : L.divIcon({
                      className: 'custom-marker',
                      html: `<div style="
                        width: 25px;
                        height: 25px;
                        background-color: #2563eb;
                        border: 2px solid white;
                        border-radius: 50% 50% 50% 0;
                        transform: rotate(-45deg);
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                      "></div>`,
                      iconSize: [25, 25],
                      iconAnchor: [12, 25],
                      popupAnchor: [0, -25]
                    });
                
                return (
                  <Marker
                    key={item.seller.email}
                    position={[item.coords!.lat, item.coords!.lng]}
                    icon={customIcon}
                    eventHandlers={{
                      click: () => {
                        setSelectedDealerEmail(item.seller.email);
                        setSelectedDealerCenter([item.coords!.lat, item.coords!.lng]);
                        onViewProfile(item.seller.email);
                      },
                    }}
                  >
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-semibold text-blue-600 mb-1">
                          {item.seller.dealershipName || item.seller.name}
                        </h3>
                        <p className="text-sm text-gray-600">{item.seller.location}</p>
                        <button
                          onClick={() => {
                            setSelectedDealerEmail(item.seller.email);
                            setSelectedDealerCenter([item.coords!.lat, item.coords!.lng]);
                            onViewProfile(item.seller.email);
                          }}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                        >
                          View Profile
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default DealerProfiles;
