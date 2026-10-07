import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { User, Vehicle } from '../types.js';
import { getDealerDirectory, readCachedDealerDirectory } from '../services/userService.js';
import {
  getSellerMapCoordinatesBatch,
  areaKeyFromSeller,
  areaDisplayLabelFromSeller,
  normalizeIndianPincode,
} from '../utils/sellerLocation.js';
import { resolveSellerLogoUrl, sellerInitialsAvatarDataUri } from '../utils/imageUtils.js';
import { sellerMatchesHeaderRegion } from '../utils/dealerRegionFilter.js';
import { isRerideStaffPick } from '../utils/staffPick.js';
import { getPublicDealerRating } from '../utils/dealerRatingDisplay.js';
import { searchLocations } from '../utils/reverseGeocode.js';
import { copyTextToClipboard } from '../utils/copyToClipboard.js';
import { getLeafletBasemapConfig } from '../utils/mapTileLayer.js';

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
  currentUser?: User | null;
  onRequireLogin?: () => void;
  /** Header location (e.g. Maharashtra, Mumbai) — filters dealer list and map markers. */
  userLocation?: string;
}

type CompanyType = 'all' | 'car-service' | 'showroom';

/** Filter tabs stay “Car Service” / “Showroom”; cards and map use these entity labels. */
export const ENTITY_LABEL_SERVICE_PROVIDER = 'Service provider';
export const ENTITY_LABEL_SELLER = 'Seller';
export const ENTITY_LABEL_MIXED_CLUSTER = 'Sellers & service providers';

export interface CompanyLocation {
  lat: number;
  lng: number;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const TOOLTIP_OPTS: L.TooltipOptions = {
  sticky: true,
  direction: 'top',
  opacity: 1,
  className: 'dealer-marker-hover-tooltip',
};

/** Classify a user into the correct Dealer-page bucket based on their role. */
function isCarServiceProvider(user: User): boolean {
  return user.role === 'service_provider';
}
function isShowroomSeller(user: User): boolean {
  return user.role === 'seller';
}

function sellerHoverTooltipHtml(seller: User): string {
  const showroom = isShowroomSeller(seller);
  const typeLabel = showroom ? ENTITY_LABEL_SELLER : ENTITY_LABEL_SERVICE_PROVIDER;
  const title = escapeHtml(seller.dealershipName || seller.name || 'Dealer');
  const area = escapeHtml(areaDisplayLabelFromSeller(seller));
  const addr = (seller.address || '').trim();
  const locFirst = (seller.location || '').split(',')[0]?.trim() || '';
  const where = addr || locFirst;
  const pin = normalizeIndianPincode(seller.pincode);
  const phone = (seller.mobile || '').trim();
  let body = '';
  if (where) {
    body += `<p style="margin:4px 0 0;font-size:12px;color:#374151;line-height:1.35">${escapeHtml(where)}</p>`;
  }
  if (pin) {
    body += `<p style="margin:2px 0 0;font-size:12px;color:#6b7280">PIN ${escapeHtml(pin)}</p>`;
  }
  if (phone) {
    body += `<p style="margin:4px 0 0;font-size:12px;color:#4b5563">Phone: ${escapeHtml(phone)}</p>`;
  }
  return `<div style="min-width:180px;max-width:280px;padding:2px 0">
    <p style="margin:0;font-weight:600;font-size:14px;color:#111827">${title}</p>
    <p style="margin:2px 0 0;font-size:11px;color:#6b7280">${escapeHtml(typeLabel)} · ${area}</p>
    ${body}
  </div>`;
}

function clusterHoverTooltipHtml(groupItems: Array<{ seller: User; coords: CompanyLocation }>): string {
  const n = groupItems.length;
  const preview = groupItems
    .slice(0, 4)
    .map((i) => escapeHtml(i.seller.dealershipName || i.seller.name))
    .join(', ');
  const more = n > 4 ? ` +${n - 4} more` : '';
  return `<div style="min-width:160px;max-width:280px;padding:2px 0">
    <p style="margin:0;font-weight:600;font-size:13px;color:#111827">${n} dealers here</p>
    <p style="margin:4px 0 0;font-size:12px;color:#374151;line-height:1.4">${preview}${more}</p>
    <p style="margin:4px 0 0;font-size:11px;color:#9ca3af">Click for the full list</p>
  </div>`;
}

// Imperative Leaflet map: create/destroy in useEffect to avoid "Map container is already initialized"
export const DealerMap: React.FC<{
  center: [number, number];
  zoom: number;
  bounds: L.LatLngBounds | null;
  selectedCenter: [number, number] | null;
  filteredSellersWithCoords: Array<{ seller: User; coords: CompanyLocation | null }>;
  selectedDealerEmail: string | null;
  /** Highlight a dealer in the sidebar list (no navigation to profile). */
  onDealerSelect: (sellerEmail: string, coords: CompanyLocation) => void;
}> = ({
  center,
  zoom,
  bounds,
  selectedCenter,
  filteredSellersWithCoords,
  selectedDealerEmail,
  onDealerSelect,
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
      zoomControl: false,
      scrollWheelZoom: true,
    });
    // Top-left is taken by the map search overlay.
    L.control.zoom({ position: 'topright' }).addTo(map);
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }

    // CARTO free tiles watermark "API KEY REQUIRED" without a key — use OSM by default
    // (optional VITE_CARTO_API_KEY / VITE_MAP_TILE_URL via getLeafletBasemapConfig).
    const basemap = getLeafletBasemapConfig();
    L.tileLayer(basemap.url, basemap.options).addTo(map);

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

  // Map click (not on a pin): show popup listing all dealerships in the nearest dealer's city — no profile navigation.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      const target = e.originalEvent?.target as HTMLElement;
      if (target?.closest('.leaflet-marker-icon')) return;

      const dealersWithCoords = filteredSellersWithCoords.filter(
        (item): item is { seller: User; coords: CompanyLocation } => item.coords !== null
      );
      if (dealersWithCoords.length === 0) return;

      const clickedLat = e.latlng.lat;
      const clickedLng = e.latlng.lng;
      let nearest: { seller: User; coords: CompanyLocation } | null = null;
      let minDist = Infinity;
      const R = 6371;
      for (const item of dealersWithCoords) {
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
      if (!nearest) return;

      const areaKey = areaKeyFromSeller(nearest.seller);
      const sameArea = areaKey
        ? dealersWithCoords.filter((item) => areaKeyFromSeller(item.seller) === areaKey)
        : [nearest];

      const displayArea = areaDisplayLabelFromSeller(nearest.seller);
      const namesHtml = sameArea
        .map(
          (item) =>
            `<li class="text-sm text-gray-800 py-0.5">${escapeHtml(item.seller.dealershipName || item.seller.name)}</li>`
        )
        .join('');

      const popupHtml = `<div class="p-2">
        <p class="font-semibold text-gray-900 mb-1">${escapeHtml(displayArea)}</p>
        <p class="text-xs text-gray-500 mb-1">Dealerships in this area</p>
        <ul class="list-disc pl-4 max-h-56 overflow-y-auto m-0">${namesHtml}</ul>
      </div>`;

      L.popup({ maxWidth: 300, className: 'dealer-city-popup' })
        .setLatLng(e.latlng)
        .setContent(popupHtml)
        .openOn(map);

      const first = sameArea[0];
      if (first) onDealerSelect(first.seller.email, first.coords);
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
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

    const isShowroom = (s: User) => isShowroomSeller(s);

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
        const typeLabel = showroom ? ENTITY_LABEL_SELLER : ENTITY_LABEL_SERVICE_PROVIDER;
        const aKey = areaKeyFromSeller(item.seller);
        const inArea = aKey
          ? items.filter((i) => areaKeyFromSeller(i.seller) === aKey)
          : [item];
        const areaLabel = areaDisplayLabelFromSeller(item.seller);
        const namesList = inArea
          .map(
            (i) =>
              `<li class="text-sm text-gray-800 py-0.5">${escapeHtml(i.seller.dealershipName || i.seller.name)}</li>`
          )
          .join('');
        marker.bindTooltip(sellerHoverTooltipHtml(item.seller), TOOLTIP_OPTS);
        marker.bindPopup(
          `<div class="p-2">
            <p class="text-xs font-medium text-gray-500 mb-1">${escapeHtml(areaLabel)} · ${escapeHtml(typeLabel)}</p>
            <p class="text-xs text-gray-500 mb-1">Dealerships in this area</p>
            <ul class="list-disc pl-4 max-h-48 overflow-y-auto m-0">${namesList}</ul>
          </div>`,
          { className: 'dealer-popup' }
        );
        marker.on('click', () => {
          onDealerSelect(item.seller.email, item.coords);
        });
        layer.addLayer(marker);
      } else {
        const marker = L.marker([lat, lng], { icon: createCountIcon(count, clusterType) });
        const aKey = areaKeyFromSeller(groupItems[0].seller);
        const inArea = aKey
          ? items.filter((i) => areaKeyFromSeller(i.seller) === aKey)
          : groupItems;
        const namesList = inArea
          .map(
            (i) =>
              `<li class="text-sm text-gray-800 py-0.5">${escapeHtml(i.seller.dealershipName || i.seller.name)}</li>`
          )
          .join('');
        const typeLabel =
          clusterType === 'mixed'
            ? ENTITY_LABEL_MIXED_CLUSTER
            : clusterType === 'showroom'
              ? ENTITY_LABEL_SELLER + 's'
              : ENTITY_LABEL_SERVICE_PROVIDER + 's';
        const areaLabel = areaDisplayLabelFromSeller(groupItems[0].seller);
        marker.bindTooltip(clusterHoverTooltipHtml(groupItems), TOOLTIP_OPTS);
        marker.bindPopup(
          `<div class="p-2 dealer-cluster-popup">
            <p class="text-xs font-medium text-gray-500 mb-1">${escapeHtml(areaLabel)}</p>
            <h3 class="font-semibold text-gray-900 mb-1">${inArea.length} dealerships in this area</h3>
            <p class="text-xs text-gray-500 mb-2">${typeLabel}</p>
            <ul class="list-disc pl-4 max-h-48 overflow-y-auto m-0">${namesList}</ul>
          </div>`,
          { className: 'dealer-popup' }
        );
        marker.on('click', () => {
          const item = groupItems[0];
          if (item) onDealerSelect(item.seller.email, item.coords);
        });
        layer.addLayer(marker);
      }
    }
  }, [filteredSellersWithCoords, selectedDealerEmail, iconDefault, iconSelected, iconShowroomDefault, iconShowroomSelected, onDealerSelect]);

  return <div ref={containerRef} className="h-full w-full min-h-[200px]" />;
};

type OpenStatus = { isOpen: boolean; label: string };

/** Fixed hours for every dealer: Mon–Sat, 9:30 AM – 8 PM IST. */
export function getOpenStatus(): OpenStatus {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = ist.getDay();
  const mins = ist.getHours() * 60 + ist.getMinutes();
  const OPEN = 9 * 60 + 30;
  const CLOSE = 20 * 60;
  if (day !== 0 && mins >= OPEN && mins < CLOSE) return { isOpen: true, label: 'Open now · until 8 PM' };
  const when = day !== 0 && mins < OPEN ? 'today' : day === 6 || day === 0 ? 'Monday' : 'tomorrow';
  return { isOpen: false, label: `Closed · Opens ${when} 9:30 AM` };
}

function sellerAddress(seller: User): string {
  const pin = normalizeIndianPincode(seller.pincode);
  const city = (seller.location || '').split(',')[0]?.trim() || '';
  const addr = (seller.address || '').trim();
  const parts: string[] = [];
  if (addr) parts.push(addr);
  if (city && !addr.toLowerCase().includes(city.toLowerCase())) parts.push(city);
  if (pin) parts.push(`PIN ${pin}`);
  return parts.join(' · ');
}

const sellerKey = (s: User) => s.email || s.id || '';

const CompanyCard = React.memo<{
  seller: User;
  coords: CompanyLocation | null;
  isSelected: boolean;
  onSelect: (sellerEmail: string, coords: CompanyLocation | null) => void;
  onCall: (seller: User) => void;
  onViewProfile: (sellerEmail: string) => void;
}>(({ seller, coords, isSelected, onSelect, onCall, onViewProfile }) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const showroom = isShowroomSeller(seller);
  const name = seller.dealershipName || seller.name;
  const address = sellerAddress(seller);
  const rating = getPublicDealerRating(seller);

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
      title={coords ? 'Show on map' : undefined}
      className={`relative overflow-hidden rounded-2xl border bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-px hover:shadow-[0_12px_28px_-14px_rgba(15,23,42,0.22)] ${
        isSelected
          ? 'border-indigo-400 shadow-[0_12px_28px_-14px_rgba(79,70,229,0.45)] ring-1 ring-indigo-200'
          : 'border-slate-200/80 hover:border-slate-300'
      } ${coords ? 'cursor-pointer' : ''}`}
    >
      {isSelected && (
        <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-gradient-to-b from-indigo-500 to-violet-500" aria-hidden />
      )}
      <div className="flex gap-3">
        <img
          src={logoFailed ? sellerInitialsAvatarDataUri(seller) : resolveSellerLogoUrl(seller)}
          alt=""
          className="h-12 w-12 shrink-0 rounded-xl bg-white object-cover shadow-sm ring-1 ring-slate-200"
          loading="lazy"
          decoding="async"
          onError={() => setLogoFailed(true)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-[15px] font-semibold tracking-tight text-slate-900">{name}</h3>
            {isRerideStaffPick(seller.rerideRecommended) && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-200 to-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-900 shadow-sm">
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2l2.39 6.95H22l-6 4.43 2.39 6.95L12 16.9l-6.39 3.43L8 13.38l-6-4.43h7.61z" />
                </svg>
                Recommended
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
            <span className={`inline-flex items-center gap-1 font-medium ${showroom ? 'text-emerald-700' : 'text-blue-700'}`}>
              <span className={`h-2 w-2 rounded-full ${showroom ? 'bg-emerald-600' : 'bg-blue-600'}`} aria-hidden />
              {showroom ? ENTITY_LABEL_SELLER : ENTITY_LABEL_SERVICE_PROVIDER}
            </span>
            {rating && (
              <>
                <span className="text-slate-300" aria-hidden>•</span>
                <span
                  className="text-slate-700"
                  aria-label={`Rating ${rating.average} out of 5${rating.count != null ? `, ${rating.count} reviews` : ''}`}
                >
                  <span className="text-amber-500">★</span> {rating.average}
                  {rating.count != null && <span className="text-slate-400"> ({rating.count})</span>}
                </span>
              </>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {address ? (
              <>
                <span className="truncate" title={address}>{address}</span>
                <button
                  type="button"
                  onClick={(e) => void copyAddress(e)}
                  aria-label={copied ? 'Address copied' : 'Copy address'}
                  title={copied ? 'Copied!' : 'Copy address'}
                  className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={copied ? 'M5 13l4 4L19 7' : 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'}
                    />
                  </svg>
                </button>
              </>
            ) : (
              <span className="text-slate-400">Address not added yet</span>
            )}
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCall(seller);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_6px_14px_-6px_rgba(79,70,229,0.6)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Call
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewProfile(seller.email);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
              View profile
            </button>
            {coords && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(seller.email, coords);
                }}
                aria-label={`Show ${name} on map`}
                className={`ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium ${
                  isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-700'
                }`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Map
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
});

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];
const TYPE_TABS: { v: CompanyType; label: string }[] = [
  { v: 'all', label: 'All' },
  { v: 'showroom', label: 'Showrooms' },
  { v: 'car-service', label: 'Car service' },
];

const DealerProfiles: React.FC<DealerProfilesProps> = ({
  sellers: propSellers,
  onViewProfile,
  currentUser,
  onRequireLogin,
  userLocation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [companyTypeFilter, setCompanyTypeFilter] = useState<CompanyType>('all');
  // Paint the last-known directory instantly; the API refresh replaces it in the background.
  const [sellers, setSellers] = useState<User[]>(() => {
    const cached = readCachedDealerDirectory();
    return cached.length > 0 ? cached : propSellers ?? [];
  });
  const [isLoadingSellers, setIsLoadingSellers] = useState(true);
  const [sellerLoadError, setSellerLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [coordMap, setCoordMap] = useState<Map<string, CompanyLocation | null>>(new Map());
  const [selectedDealerCenter, setSelectedDealerCenter] = useState<[number, number] | null>(null);
  const [selectedDealerEmail, setSelectedDealerEmail] = useState<string | null>(null);
  const [mapSearchSuggestions, setMapSearchSuggestions] = useState<Array<{ displayName: string; lat: number; lon: number }>>([]);
  const [isMapSearching, setIsMapSearching] = useState(false);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const mapSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapSearchAbortRef = useRef<AbortController | null>(null);

  const handleMapSearchChange = useCallback((query: string) => {
    setMapSearchQuery(query);
    if (mapSearchTimerRef.current) clearTimeout(mapSearchTimerRef.current);
    if (mapSearchAbortRef.current) mapSearchAbortRef.current.abort();

    if (!query || query.trim().length < 2) {
      setMapSearchSuggestions([]);
      setIsMapSearching(false);
      return;
    }

    setIsMapSearching(true);
    mapSearchTimerRef.current = setTimeout(async () => {
      const ac = new AbortController();
      mapSearchAbortRef.current = ac;
      try {
        const results = await searchLocations(query.trim(), ac.signal);
        if (!ac.signal.aborted) {
          setMapSearchSuggestions(
            results
              .filter((r) => r.lat && r.lon)
              .map((r) => ({
                displayName: r.city && r.state ? `${r.city}, ${r.state}` : r.displayName.split(',').slice(0, 2).join(',').trim(),
                lat: r.lat,
                lon: r.lon,
              }))
          );
          setIsMapSearching(false);
        }
      } catch {
        if (!ac.signal.aborted) {
          setMapSearchSuggestions([]);
          setIsMapSearching(false);
        }
      }
    }, 400);
  }, []);

  const handleMapSearchSelect = useCallback((suggestion: { displayName: string; lat: number; lon: number }) => {
    setMapSearchQuery(suggestion.displayName);
    setSelectedDealerCenter([suggestion.lat, suggestion.lon]);
    setMapSearchSuggestions([]);
  }, []);

  // Always fetch the public dealer directory (location/address for map pins).
  // Do not reuse AppProvider `users` — that cache often lacks address fields and would overwrite API data.
  useEffect(() => {
    let cancelled = false;
    setIsLoadingSellers(true);
    setSellerLoadError(null);
    void getDealerDirectory().then(({ users, failed }) => {
      if (cancelled) return;
      if (users.length > 0 || !failed) setSellers(users);
      else setSellerLoadError('Failed to load dealers. Please check your connection and try again.');
      setIsLoadingSellers(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

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
    const query = searchQuery.trim().toLowerCase();
    const qDigits = query.replace(/\D/g, '');
    // Recommended first, then dealers with a usable address; otherwise keep API order (sort is stable).
    const rank = (s: User) => (isRerideStaffPick(s.rerideRecommended) ? 2 : 0) + (sellerAddress(s) ? 1 : 0);
    return sellers
      .filter((seller) => {
        if (userLocation?.trim() && !sellerMatchesHeaderRegion(seller, userLocation)) return false;
        if (!query) return true;
        const name = (seller.dealershipName || seller.name || '').toLowerCase();
        const location = (seller.location || '').toLowerCase();
        const pinMatch = qDigits.length >= 3 && normalizeIndianPincode(seller.pincode).includes(qDigits);
        return name.includes(query) || location.includes(query) || pinMatch;
      })
      .sort((a, b) => rank(b) - rank(a));
  }, [sellers, searchQuery, userLocation]);

  const typeCounts = useMemo(
    () => ({
      all: searchedSellers.length,
      showroom: searchedSellers.filter(isShowroomSeller).length,
      'car-service': searchedSellers.filter(isCarServiceProvider).length,
    }),
    [searchedSellers]
  );

  const filteredSellers = useMemo(
    () =>
      companyTypeFilter === 'all'
        ? searchedSellers
        : searchedSellers.filter(companyTypeFilter === 'showroom' ? isShowroomSeller : isCarServiceProvider),
    [searchedSellers, companyTypeFilter]
  );

  const filteredSellersWithCoords = useMemo(
    () => filteredSellers.map((seller) => ({ seller, coords: coordMap.get(sellerKey(seller)) ?? null })),
    [filteredSellers, coordMap]
  );

  const pinnedCoords = useMemo(
    () => filteredSellersWithCoords.flatMap((i) => (i.coords ? [i.coords] : [])),
    [filteredSellersWithCoords]
  );
  const mapBounds = useMemo(
    () => (pinnedCoords.length > 0 ? L.latLngBounds(pinnedCoords.map((c) => [c.lat, c.lng] as [number, number])) : null),
    [pinnedCoords]
  );

  const handleCall = useCallback(
    (seller: User) => {
      if (!currentUser) {
        onRequireLogin?.();
        return;
      }
      window.location.href = `tel:${seller.mobile || ''}`;
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
  const showSpinner = isLoadingSellers && sellers.length === 0;
  const showError = !!sellerLoadError && sellers.length === 0;

  return (
    <div className="min-h-screen lg:h-screen flex flex-col overflow-hidden bg-slate-50">
      <header className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 px-4 py-4 text-white lg:px-6">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_160px_at_0%_0%,rgba(99,102,241,0.35),transparent_70%),radial-gradient(500px_160px_at_100%_100%,rgba(168,85,247,0.25),transparent_70%)]"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_8px_20px_-8px_rgba(99,102,241,0.8)] ring-1 ring-white/20">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight text-white lg:text-xl">
                Trusted Dealers{userLocation ? <span className="font-normal text-indigo-200"> · {userLocation}</span> : null}
              </h1>
              <p className="text-xs text-slate-300 lg:text-sm">Verified showrooms and car service partners</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {isLoadingSellers && sellers.length > 0 && (
              <span className="text-slate-400" aria-live="polite">Updating…</span>
            )}
            <span className="rounded-full bg-white/10 px-3 py-1 font-medium ring-1 ring-white/15">
              <strong className="font-semibold">{typeCounts.all}</strong> dealers
            </span>
            {pinnedCoords.length > 0 && (
              <span className="hidden rounded-full bg-white/10 px-3 py-1 font-medium ring-1 ring-white/15 sm:inline">
                <strong className="font-semibold">{pinnedCoords.length}</strong> on map
              </span>
            )}
            <span className="hidden items-center gap-1 rounded-full bg-emerald-400/15 px-3 py-1 font-medium text-emerald-200 ring-1 ring-emerald-300/30 sm:inline-flex">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Verified partners
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* List — capped height when stacked below lg so the map stays visible */}
        <aside className="w-full lg:w-[380px] xl:w-[420px] shrink-0 flex flex-col overflow-hidden bg-white max-h-[50vh] min-h-[240px] lg:max-h-none lg:min-h-0 lg:border-r lg:border-slate-200">
          <div className="space-y-3 border-b border-slate-100 p-3">
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                placeholder="Search by name, city or PIN"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search dealers by name, city or PIN"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
            </div>
            <div className="flex rounded-xl bg-slate-100 p-1 ring-1 ring-inset ring-slate-200/70" role="radiogroup" aria-label="Filter by dealer type">
              {TYPE_TABS.map((opt) => {
                const active = companyTypeFilter === opt.v;
                return (
                  <button
                    key={opt.v}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setCompanyTypeFilter(opt.v)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_6px_14px_-6px_rgba(79,70,229,0.6)]'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label} <span className={active ? 'text-white/70' : 'text-slate-400'}>{typeCounts[opt.v]}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-500">
                <strong className="font-semibold text-slate-800">{filteredSellers.length}</strong>{' '}
                {filteredSellers.length === 1 ? 'dealer' : 'dealers'}
                {hasFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setCompanyTypeFilter('all');
                    }}
                    className="ml-2 font-medium text-indigo-600 hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 ${status.isOpen ? 'text-emerald-700' : 'text-slate-500'}`}
                title="Dealer hours: Mon–Sat, 9:30 AM – 8 PM"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${status.isOpen ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden />
                {status.label}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50/70">
            {showSpinner ? (
              <div className="space-y-2.5 p-3" aria-busy="true" aria-label="Loading dealers">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-[108px] animate-pulse rounded-2xl bg-white ring-1 ring-slate-200/70" />
                ))}
              </div>
            ) : showError ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <p className="font-semibold text-slate-900">Couldn't load dealers</p>
                <p className="mt-1 text-sm text-slate-500">{sellerLoadError}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="mt-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_-8px_rgba(79,70,229,0.6)] hover:brightness-110"
                >
                  Retry
                </button>
              </div>
            ) : filteredSellers.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-semibold text-slate-900">
                  {searchQuery || companyTypeFilter !== 'all' ? 'No matching dealers' : 'No dealers yet'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {searchQuery || companyTypeFilter !== 'all'
                    ? 'Try a different search, or switch to “All”.'
                    : 'Try another region or check back later.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 p-3">
                {filteredSellersWithCoords.map(({ seller, coords }) => (
                  <div key={seller.email} ref={(el) => { cardRefs.current[seller.email] = el; }}>
                    <CompanyCard
                      seller={seller}
                      coords={coords}
                      isSelected={selectedDealerEmail === seller.email}
                      onSelect={handleDealerSelect}
                      onCall={handleCall}
                      onViewProfile={onViewProfile}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="flex-1 relative isolate min-h-[45vh] lg:min-h-0 bg-slate-200" aria-label="Dealer map">
          <div className="absolute top-3 left-3 right-3 lg:right-auto z-[1000] lg:w-80">
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <input
                type="search"
                placeholder="Jump to a city or area"
                value={mapSearchQuery}
                onChange={(e) => handleMapSearchChange(e.target.value)}
                aria-label="Search city to move the map"
                className="w-full rounded-xl border border-white/60 bg-white/90 py-2.5 pl-9 pr-9 text-sm shadow-[0_12px_30px_-12px_rgba(15,23,42,0.35)] outline-none ring-1 ring-slate-900/5 backdrop-blur placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
              {isMapSearching && (
                <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
            </div>
            {mapSearchSuggestions.length > 0 && (
              <ul className="mt-1.5 max-h-60 overflow-y-auto rounded-xl bg-white py-1 shadow-[0_16px_36px_-12px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5">
                {mapSearchSuggestions.map((s, i) => (
                  <li key={`${s.lat}-${s.lon}-${i}`}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50"
                      onClick={() => handleMapSearchSelect(s)}
                    >
                      {s.displayName}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="absolute bottom-3 left-3 z-[1000] flex flex-wrap items-center gap-3 rounded-xl bg-white/90 px-3.5 py-2 text-xs font-medium text-slate-600 shadow-[0_12px_30px_-12px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5 backdrop-blur">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />{ENTITY_LABEL_SELLER}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" />{ENTITY_LABEL_SERVICE_PROVIDER}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-600" />Mixed</span>
            {pinnedCoords.length > 0 && (
              <span className="border-l border-slate-200 pl-3 text-slate-500">
                {pinnedCoords.length} of {filteredSellers.length} on map
              </span>
            )}
          </div>

          {!showSpinner && filteredSellers.length > 0 && pinnedCoords.length === 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-16 z-[500] flex justify-center">
              <p className="rounded-xl bg-white/90 px-3.5 py-2 text-xs font-medium text-slate-600 shadow-[0_12px_30px_-12px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5 backdrop-blur">
                {coordMap.size === 0 ? 'Locating dealers on the map…' : 'These dealers haven’t added a map location yet'}
              </p>
            </div>
          )}

          <DealerMap
            center={INDIA_CENTER}
            zoom={5}
            bounds={mapBounds}
            selectedCenter={selectedDealerCenter}
            filteredSellersWithCoords={filteredSellersWithCoords}
            selectedDealerEmail={selectedDealerEmail}
            onDealerSelect={handleDealerSelect}
          />
        </section>
      </div>
    </div>
  );
};

export default DealerProfiles;
