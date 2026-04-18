import React, { useState, useMemo, useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { User, Vehicle } from '../types.js';
import { getSellers, getServiceProviders } from '../services/userService.js';
import {
  getSellerMapCoordinates,
  areaKeyFromSeller,
  areaDisplayLabelFromSeller,
  normalizeIndianPincode,
} from '../utils/sellerLocation.js';
import { resolveSellerLogoUrl, sellerInitialsAvatarDataUri } from '../utils/imageUtils.js';
import { sellerMatchesHeaderRegion } from '../utils/dealerRegionFilter.js';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/* ============================================================
   Scoped premium styles for the Dealer Profiles page.
   All rules are prefixed with `.dp-` to avoid global bleed.
   ============================================================ */
const DP_STYLES = `
  .dp-root { --dp-ink:#0b1020; --dp-brand:#4f46e5; }

  /* ===== Top aurora strip ===== */
  .dp-topstrip {
    position: relative;
    background:
      radial-gradient(800px 300px at 5% 0%, rgba(59,130,246,0.55), transparent 60%),
      radial-gradient(700px 280px at 95% 100%, rgba(217,70,239,0.45), transparent 60%),
      linear-gradient(120deg,#0f172a 0%,#1e1b4b 45%,#1f1147 100%);
    box-shadow: 0 10px 30px -18px rgba(15,23,42,.6);
  }
  .dp-topstrip::before {
    content:""; position:absolute; inset:-40%;
    background:
      conic-gradient(from 0deg at 50% 50%,
        rgba(99,102,241,.35), rgba(236,72,153,.25),
        rgba(34,211,238,.30), rgba(99,102,241,.35));
    filter: blur(60px); opacity:.45;
    animation: dp-spin 26s linear infinite; z-index:0;
  }
  .dp-topstrip::after {
    content:""; position:absolute; inset:0;
    background-image:
      linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px);
    background-size: 38px 38px;
    mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
    opacity:.35; z-index:0;
  }
  @keyframes dp-spin { to { transform: rotate(360deg); } }

  .dp-orb { position:absolute; border-radius:9999px; filter: blur(36px); mix-blend-mode: screen; pointer-events:none; z-index:0; }
  .dp-orb-a { width:220px; height:220px; left:-60px; top:-40px; background:#60a5fa; opacity:.5; animation: dp-float 11s ease-in-out infinite; }
  .dp-orb-b { width:260px; height:260px; right:-80px; top:-60px; background:#c084fc; opacity:.45; animation: dp-float 14s ease-in-out infinite reverse; }
  .dp-orb-c { width:180px; height:180px; left:40%; bottom:-70px; background:#22d3ee; opacity:.35; animation: dp-float 16s ease-in-out infinite; }
  @keyframes dp-float {
    0%,100% { transform: translate3d(0,0,0) scale(1); }
    50%     { transform: translate3d(20px,-14px,0) scale(1.08); }
  }

  .dp-crest {
    position: relative;
    width: 44px; height: 44px;
    border-radius: 14px;
    background: linear-gradient(135deg,#6366f1,#a855f7 60%,#ec4899);
    display: inline-flex; align-items: center; justify-content: center;
    box-shadow: 0 14px 26px -8px rgba(79,70,229,.55), inset 0 1px 0 rgba(255,255,255,.45);
  }
  .dp-crest::after {
    content:""; position:absolute; inset:6% 6% 55% 6%;
    border-radius: 10px 10px 40% 40%;
    background: linear-gradient(180deg, rgba(255,255,255,.4), rgba(255,255,255,0));
  }
  .dp-title-accent {
    background: linear-gradient(90deg,#fbcfe8,#c4b5fd,#a5f3fc);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    background-size: 220% 100%;
    animation: dp-grad 8s ease-in-out infinite;
    font-weight: 800;
  }
  @keyframes dp-grad { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }

  .dp-stat-chip {
    display: inline-flex; align-items: center; gap: .4rem;
    padding: .32rem .7rem; border-radius: 9999px;
    font-size: 11.5px; color: white; font-weight: 600;
    background: rgba(255,255,255,.10);
    border: 1px solid rgba(255,255,255,.22);
    backdrop-filter: blur(10px);
  }
  .dp-stat-chip strong { font-weight: 800; }
  .dp-stat-chip-ghost { color: #a7f3d0; border-color: rgba(110,231,183,.45); }
  .dp-stat-dot { width: 7px; height: 7px; border-radius: 9999px; display: inline-block; }

  /* ===== Sidebar head ===== */
  .dp-sidebar-head {
    position: relative;
    background: linear-gradient(180deg,#ffffff 0%, #f8fafc 100%);
    border-bottom: 1px solid #eef2f7;
  }

  .dp-search, .dp-map-search {
    position: relative;
    display: flex; align-items: center;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    transition: box-shadow .25s ease, border-color .25s ease, transform .25s ease;
    box-shadow: 0 1px 0 rgba(255,255,255,.8) inset, 0 1px 2px rgba(15,23,42,.04);
  }
  .dp-search:focus-within, .dp-map-search:focus-within {
    border-color: #6366f1;
    box-shadow: 0 0 0 4px rgba(99,102,241,.15), 0 10px 24px -12px rgba(79,70,229,.35);
  }
  .dp-map-search {
    background: rgba(255,255,255,.92);
    backdrop-filter: blur(14px);
    box-shadow: 0 14px 30px -12px rgba(15,23,42,.25), 0 1px 0 rgba(255,255,255,.9) inset;
  }
  .dp-search-ic {
    margin-left: .75rem; color: #94a3b8; flex-shrink: 0;
  }
  .dp-search-input {
    flex: 1; border: 0; background: transparent; outline: none;
    padding: .65rem .75rem; font-size: 14px; color: #0f172a;
    min-width: 0;
  }
  .dp-search-input::placeholder { color: #94a3b8; }
  .dp-search-clear {
    margin-right: .4rem;
    width: 22px; height: 22px; border-radius: 9999px;
    background: #f1f5f9; color: #64748b;
    display: inline-flex; align-items: center; justify-content: center;
    transition: background .2s ease, color .2s ease;
  }
  .dp-search-clear:hover { background: #e2e8f0; color: #0f172a; }

  /* ===== Segmented pill filter ===== */
  .dp-seg {
    display: inline-flex; align-items: center;
    padding: 3px; border-radius: 12px;
    background: #f1f5f9; border: 1px solid #e2e8f0;
    width: 100%;
  }
  .dp-seg-btn {
    flex: 1; padding: .45rem .6rem; font-size: 12.5px; font-weight: 700;
    color: #475569; border-radius: 10px;
    transition: all .25s ease;
    background: transparent;
  }
  .dp-seg-btn:hover { color: #0f172a; }
  .dp-seg-active {
    color: white !important;
    background: linear-gradient(135deg,#4f46e5,#9333ea);
    box-shadow: 0 10px 20px -10px rgba(79,70,229,.55), inset 0 1px 0 rgba(255,255,255,.4);
  }

  /* ===== Dealer card ===== */
  .dp-card {
    background: linear-gradient(180deg,#ffffff,#fbfcfe);
    border: 1px solid #eef2f7;
    transition: transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s ease, border-color .25s ease;
    transform: perspective(900px) rotateX(var(--dp-rx,0deg)) rotateY(var(--dp-ry,0deg));
    box-shadow: 0 1px 0 rgba(255,255,255,.9) inset, 0 1px 2px rgba(15,23,42,.03);
    overflow: hidden;
  }
  .dp-card::before {
    content:""; position:absolute; inset:0;
    background: radial-gradient(260px circle at var(--dp-mx,50%) var(--dp-my,50%), rgba(99,102,241,.10), transparent 55%);
    opacity: 0; transition: opacity .25s ease; pointer-events: none;
    border-radius: inherit;
  }
  .dp-card:hover {
    transform: perspective(900px) rotateX(var(--dp-rx,0deg)) rotateY(var(--dp-ry,0deg)) translateY(-2px);
    border-color: rgba(99,102,241,.35);
    box-shadow: 0 24px 40px -24px rgba(15,23,42,.25), 0 0 0 1px rgba(99,102,241,.12);
  }
  .dp-card:hover::before { opacity: 1; }
  .dp-card-selected {
    border-color: #6366f1 !important;
    box-shadow: 0 24px 40px -22px rgba(79,70,229,.45), 0 0 0 2px rgba(99,102,241,.25) !important;
  }
  .dp-card-selected::after {
    content:""; position: absolute; left: 0; top: 12%; bottom: 12%;
    width: 4px; border-radius: 0 4px 4px 0;
    background: linear-gradient(180deg,#4f46e5,#9333ea);
  }
  .dp-card-inner { z-index: 1; }

  .dp-ribbon {
    position: absolute; top: 10px; right: 10px; z-index: 2;
    display: inline-flex; align-items: center; gap: .3rem;
    padding: .2rem .55rem; border-radius: 9999px;
    font-size: 10.5px; font-weight: 800; letter-spacing: .02em;
    color: #78350f;
    background: linear-gradient(135deg,#fde68a,#f59e0b);
    box-shadow: 0 8px 18px -10px rgba(245,158,11,.55), inset 0 1px 0 rgba(255,255,255,.6);
  }

  .dp-logo-wrap { position: relative; }
  .dp-logo-ring {
    position: relative;
    padding: 2px; border-radius: 14px;
    background: linear-gradient(135deg, var(--c1,#60a5fa), var(--c2,#a855f7));
    box-shadow: 0 10px 22px -10px rgba(79,70,229,.45);
  }
  .dp-logo-ring img { display: block; }
  .dp-type-showroom { --c1:#34d399; --c2:#059669; }
  .dp-type-service  { --c1:#60a5fa; --c2:#4f46e5; }

  .dp-name {
    cursor: pointer; transition: color .2s ease;
  }
  .dp-name:hover { color: #4f46e5; }
  .dp-pin-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 18px; height: 18px; border-radius: 6px;
    background: #eef2ff; color: #4f46e5; flex-shrink: 0;
  }

  .dp-type-pill {
    display: inline-flex; align-items: center;
    padding: .14rem .5rem; border-radius: 9999px;
    font-size: 10.5px; font-weight: 700; letter-spacing: .01em;
    color: white;
    background: linear-gradient(135deg, var(--c1,#60a5fa), var(--c2,#a855f7));
    box-shadow: 0 6px 14px -8px rgba(79,70,229,.45);
  }

  .dp-status-pill {
    display: inline-flex; align-items: center; gap: .35rem;
    padding: .14rem .5rem .14rem .35rem; border-radius: 9999px;
    font-size: 10.5px; font-weight: 700;
    border: 1px solid transparent;
  }
  .dp-status-pill.dp-open {
    color: #065f46; background: #d1fae5; border-color: #6ee7b7;
  }
  .dp-status-pill.dp-closed {
    color: #7f1d1d; background: #fee2e2; border-color: #fca5a5;
  }
  .dp-status-dot {
    position: relative; width: 8px; height: 8px; display: inline-flex;
  }
  .dp-status-dot-core {
    position: absolute; inset: 0; margin: auto;
    width: 8px; height: 8px; border-radius: 9999px;
  }
  .dp-status-dot-ping {
    position: absolute; inset: 0; width: 8px; height: 8px; border-radius: 9999px;
    animation: dp-ping 1.6s cubic-bezier(0,0,.2,1) infinite;
  }
  .dp-open .dp-status-dot-core { background: #10b981; }
  .dp-open .dp-status-dot-ping { background: rgba(16,185,129,.55); }
  .dp-closed .dp-status-dot-core { background: #ef4444; }
  .dp-closed .dp-status-dot-ping { background: rgba(239,68,68,.45); }
  @keyframes dp-ping {
    75%, 100% { transform: scale(2.2); opacity: 0; }
  }

  /* ===== Buttons ===== */
  .dp-btn-primary {
    position: relative; overflow: hidden;
    color: white;
    background: linear-gradient(135deg,#4f46e5,#7c3aed 60%,#db2777);
    box-shadow: 0 12px 24px -12px rgba(79,70,229,.55), inset 0 1px 0 rgba(255,255,255,.3);
    transition: transform .2s ease, box-shadow .25s ease;
  }
  .dp-btn-primary::before {
    content:""; position: absolute; inset: 0;
    background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,.45) 50%, transparent 70%);
    transform: translateX(-120%); transition: transform .6s ease;
  }
  .dp-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 18px 32px -14px rgba(79,70,229,.7); }
  .dp-btn-primary:hover::before { transform: translateX(120%); }
  .dp-btn-primary:active { transform: translateY(0); }

  .dp-btn-ghost {
    color: #334155;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    transition: all .2s ease;
  }
  .dp-btn-ghost:hover { background: #eef2ff; color: #3730a3; border-color: #c7d2fe; }

  .dp-btn-gold {
    color: #78350f;
    background: linear-gradient(135deg,#fde68a,#f59e0b);
    box-shadow: 0 12px 24px -12px rgba(245,158,11,.55), inset 0 1px 0 rgba(255,255,255,.6);
    transition: transform .2s ease, box-shadow .25s ease;
  }
  .dp-btn-gold:hover { transform: translateY(-1px); box-shadow: 0 18px 30px -12px rgba(245,158,11,.7); }

  /* ===== Scrollbar ===== */
  .dp-scroll::-webkit-scrollbar { width: 10px; }
  .dp-scroll::-webkit-scrollbar-track { background: transparent; }
  .dp-scroll::-webkit-scrollbar-thumb {
    background: linear-gradient(#c7d2fe,#a5b4fc);
    border: 2px solid #ffffff; border-radius: 9999px;
  }
  .dp-scroll::-webkit-scrollbar-thumb:hover { background: linear-gradient(#a5b4fc,#818cf8); }

  /* ===== Loader / Skeleton ===== */
  .dp-loader {
    width: 44px; height: 44px; border-radius: 9999px;
    background: conic-gradient(from 0deg, #6366f1, #a855f7, #ec4899, #6366f1);
    -webkit-mask: radial-gradient(farthest-side, transparent 58%, black 60%);
            mask: radial-gradient(farthest-side, transparent 58%, black 60%);
    animation: dp-spin 1.1s linear infinite;
  }
  .dp-skel {
    background: linear-gradient(90deg,#f1f5f9 0%,#e2e8f0 50%,#f1f5f9 100%);
    background-size: 200% 100%;
    animation: dp-shimmer 1.4s linear infinite;
  }
  @keyframes dp-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  /* ===== Stagger fade-in ===== */
  .dp-stagger > * {
    opacity: 0; transform: translateY(8px);
    animation: dp-rise .45s both cubic-bezier(.2,.8,.2,1);
  }
  .dp-stagger > *:nth-child(1) { animation-delay: .02s; }
  .dp-stagger > *:nth-child(2) { animation-delay: .06s; }
  .dp-stagger > *:nth-child(3) { animation-delay: .10s; }
  .dp-stagger > *:nth-child(4) { animation-delay: .14s; }
  .dp-stagger > *:nth-child(5) { animation-delay: .18s; }
  .dp-stagger > *:nth-child(6) { animation-delay: .22s; }
  .dp-stagger > *:nth-child(7) { animation-delay: .26s; }
  .dp-stagger > *:nth-child(8) { animation-delay: .30s; }
  .dp-stagger > *:nth-child(n+9) { animation-delay: .34s; }
  @keyframes dp-rise { to { opacity: 1; transform: translateY(0); } }

  /* ===== Map overlays ===== */
  .dp-map-wrap { background: #e5e7eb; }
  .dp-legend {
    display: inline-flex; align-items: center; gap: .6rem; flex-wrap: wrap;
    padding: .55rem .8rem; border-radius: 14px;
    background: rgba(255,255,255,.92); backdrop-filter: blur(14px);
    border: 1px solid rgba(15,23,42,.08);
    box-shadow: 0 14px 30px -12px rgba(15,23,42,.25);
    font-size: 11.5px; color: #334155; font-weight: 600;
  }
  .dp-legend-item { display: inline-flex; align-items: center; gap: .35rem; }
  .dp-legend-pin { width: 10px; height: 10px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 1px 2px rgba(0,0,0,.25); }

  .dp-map-badge {
    display: inline-flex; align-items: center; gap: .35rem;
    padding: .4rem .7rem; border-radius: 9999px;
    background: rgba(255,255,255,.95); backdrop-filter: blur(14px);
    border: 1px solid rgba(15,23,42,.08);
    box-shadow: 0 14px 30px -12px rgba(15,23,42,.25);
    font-size: 12px; color: #0f172a; font-weight: 600;
  }
  .dp-map-badge strong { font-weight: 800; color: #4f46e5; }

  .dp-empty-map {
    pointer-events: auto;
    background: rgba(255,255,255,.96);
    backdrop-filter: blur(14px);
    border: 1px solid rgba(15,23,42,.06);
    border-radius: 20px; padding: 1.1rem 1.3rem;
    box-shadow: 0 30px 60px -25px rgba(15,23,42,.35);
    text-align: center; max-width: 280px;
  }
  .dp-empty-icon {
    width: 48px; height: 48px; border-radius: 14px; margin: 0 auto .6rem;
    background: linear-gradient(135deg,#eef2ff,#e0e7ff);
    display: inline-flex; align-items: center; justify-content: center;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.7);
  }

  /* ===== Animated pulsing ring on selected Leaflet marker ===== */
  .custom-marker-selected, .custom-marker-showroom-selected {
    position: relative;
  }
  .custom-marker-selected::after,
  .custom-marker-showroom-selected::after {
    content: ""; position: absolute; left: 50%; top: 50%;
    width: 30px; height: 30px; margin: -15px 0 0 -15px;
    border-radius: 9999px;
    border: 3px solid rgba(239,68,68,.55);
    animation: dp-marker-ping 1.6s ease-out infinite;
    pointer-events: none;
  }
  .custom-marker-showroom-selected::after { border-color: rgba(234,88,12,.55); }
  @keyframes dp-marker-ping {
    0% { transform: scale(.6); opacity: 1; }
    100% { transform: scale(2.4); opacity: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .dp-topstrip::before, .dp-orb, .dp-stagger > *,
    .dp-status-dot-ping, .dp-loader, .dp-skel,
    .custom-marker-selected::after, .custom-marker-showroom-selected::after,
    .dp-title-accent { animation: none !important; }
  }

  @media (max-width: 1023px) {
    .dp-legend { font-size: 10.5px; padding: .45rem .6rem; }
    .dp-map-badge { font-size: 11px; }
  }
`;

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

export interface CompanyLocation {
  lat: number;
  lng: number;
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
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
  const typeLabel = showroom ? 'Showroom' : 'Car service';
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
      zoomControl: true,
      scrollWheelZoom: true,
    });
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }

    // Carto basemaps (OSM data) load more reliably from production sites than anonymous OSM tile servers alone.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
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
        const typeLabel = showroom ? 'Showroom' : 'Car Service';
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
        const typeLabel = clusterType === 'mixed' ? 'Car showrooms & services' : clusterType === 'showroom' ? 'Car showrooms' : 'Car services';
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

  return <div ref={containerRef} className="h-full w-full" style={{ minHeight: 300 }} />;
};

const CompanyCard: React.FC<{
  seller: User;
  onViewProfile: (sellerEmail: string) => void;
  onSelect?: (sellerEmail: string, coords: CompanyLocation | null) => void;
  onCall?: (phone: string) => void;
  isRecommended?: boolean;
  coords?: CompanyLocation | null;
  isSelected?: boolean;
  currentUser?: User | null;
  onRequireLogin?: () => void;
}> = ({ seller, onViewProfile, onSelect, onCall, isRecommended = false, coords = null, isSelected = false, currentUser, onRequireLogin }) => {
  const [dealerLogoSrc, setDealerLogoSrc] = useState(() => resolveSellerLogoUrl(seller));
  useEffect(() => {
    setDealerLogoSrc(resolveSellerLogoUrl(seller));
  }, [seller.logoUrl, seller.email, seller.dealershipName, seller.name]);

  // Determine company type from the user's role (source of truth).
  // - role === 'service_provider'  -> "Car Service"
  // - role === 'seller'            -> "Showroom" (regardless of top_seller badge; that's a separate recognition)
  const companyType: 'showroom' | 'car-service' = isCarServiceProvider(seller) ? 'car-service' : 'showroom';
  
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
  
  const pin = normalizeIndianPincode(seller.pincode);
  const base = (seller.address || seller.location || '').trim();
  const address =
    !base && !pin
      ? 'Address not available'
      : [base || null, pin ? `PIN ${pin}` : null].filter(Boolean).join(' · ');
  
  // Languages - default to Hindi and English for Indian dealers
  const languages = ['Hindi', 'English'];
  
  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      onRequireLogin?.();
      return;
    }
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

  const cardRef = useRef<HTMLDivElement | null>(null);
  const handlePointerMove = (e: React.PointerEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    el.style.setProperty('--dp-mx', `${x * 100}%`);
    el.style.setProperty('--dp-my', `${y * 100}%`);
    el.style.setProperty('--dp-rx', `${(y - 0.5) * -3}deg`);
    el.style.setProperty('--dp-ry', `${(x - 0.5) * 4}deg`);
  };
  const handlePointerLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty('--dp-rx', `0deg`);
    el.style.setProperty('--dp-ry', `0deg`);
  };

  const typeBadge = companyType === 'showroom'
    ? { label: 'Showroom', cls: 'dp-type-showroom' }
    : { label: 'Car Service', cls: 'dp-type-service' };

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`dp-card group relative mx-3 my-2 rounded-2xl ${coords ? 'cursor-pointer' : ''} ${isSelected ? 'dp-card-selected' : ''}`}
      onClick={() => {
        if (onSelect && coords) onSelect(seller.email, coords);
      }}
    >
      {shouldShowRecommendButton && (
        <div className="dp-ribbon" aria-hidden>
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.39 6.95H22l-6 4.43 2.39 6.95L12 16.9l-6.39 3.43L8 13.38l-6-4.43h7.61z" />
          </svg>
          <span>Recommended</span>
        </div>
      )}
      <div className="dp-card-inner relative p-4">
        <div className="flex gap-3">
          {/* Company Logo with gradient ring */}
          <div className={`dp-logo-wrap flex-shrink-0 ${typeBadge.cls}`}>
            <div className="dp-logo-ring">
              <img
                src={dealerLogoSrc}
                alt={seller.dealershipName || seller.name}
                className="w-14 h-14 rounded-xl object-cover bg-white"
                loading="lazy"
                decoding="async"
                onError={() => setDealerLogoSrc(sellerInitialsAvatarDataUri(seller))}
              />
            </div>
          </div>

          {/* Company Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3
                className="dp-name text-slate-900 font-extrabold text-[15px] leading-tight mb-1 inline-flex items-center gap-1.5 truncate"
                onClick={handleDealerNameClick}
                title={coords ? 'Show location on map' : undefined}
              >
                <span className="truncate">{seller.dealershipName || seller.name}</span>
                {coords && (
                  <span className="dp-pin-btn" title="Show on map" aria-hidden>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </span>
                )}
              </h3>
            </div>

            {/* Type pill */}
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <span className={`dp-type-pill ${typeBadge.cls}`}>{typeBadge.label}</span>
              <span className={`dp-status-pill ${isOpen ? 'dp-open' : 'dp-closed'}`}>
                <span className="dp-status-dot" aria-hidden>
                  <span className="dp-status-dot-ping" />
                  <span className="dp-status-dot-core" />
                </span>
                {statusText}
              </span>
            </div>

            {/* Status subtext */}
            <p className="text-[11px] text-slate-400 -mt-1 mb-2">{statusSubtext}</p>

            {/* Address */}
            <p className="dp-address text-[12.5px] text-slate-600 mb-2 line-clamp-2">
              <svg className="inline w-3.5 h-3.5 text-slate-400 mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {address === 'Address not available' ? (
                <span className="text-slate-400 italic">{address}</span>
              ) : (
                address
              )}
            </p>

            {/* Languages */}
            <p className="text-[11px] text-slate-500 mb-3 inline-flex items-center gap-1">
              <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
              {languages.join(' · ')}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCall}
                className="dp-btn-primary text-sm font-semibold px-3.5 py-2 rounded-xl inline-flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Call now
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewProfile(seller.email);
                }}
                className="dp-btn-ghost text-sm font-semibold px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5"
              >
                View profile
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {shouldShowRecommendButton && (
                <span
                  className="dp-btn-gold dp-badge-static text-sm font-bold px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5 select-none pointer-events-none"
                  aria-label="Top Rated dealer"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l2.39 6.95H22l-6 4.43 2.39 6.95L12 16.9l-6.39 3.43L8 13.38l-6-4.43h7.61z" />
                  </svg>
                  Top Rated
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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

  // Fetch dealers (sellers + service providers).
  // The Dealer page merges both roles; we differentiate by `role` below.
  useEffect(() => {
    if (!propSellers || propSellers.length === 0) {
      const fetchDealers = async () => {
        setIsLoadingSellers(true);
        setSellerLoadError(null);
        try {
          const [fetchedSellers, fetchedServices] = await Promise.all([
            getSellers().catch(() => [] as User[]),
            getServiceProviders().catch(() => [] as User[]),
          ]);
          const combined = [...fetchedSellers, ...fetchedServices].filter(
            (u) => u.role === 'seller' || u.role === 'service_provider'
          );
          setSellers(combined);

          if (combined.length === 0) {
            setSellerLoadError('No dealers found. Please check back later.');
          }
        } catch (error) {
          console.error('Error fetching dealers:', error);
          setSellerLoadError('Failed to load dealers. Please try refreshing the page.');
          setSellers([]);
        } finally {
          setIsLoadingSellers(false);
        }
      };
      fetchDealers();
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
      const sellersWithLocations: Array<{ seller: User; coords: CompanyLocation | null }> = [];
      for (const seller of sellers) {
        const coords = await getSellerMapCoordinates(seller);
        sellersWithLocations.push({ seller, coords });
      }

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
      const qDigits = query.replace(/\D/g, '');
      filtered = filtered.filter(seller => {
        const name = (seller.dealershipName || seller.name || '').toLowerCase();
        const location = (seller.location || '').toLowerCase();
        const pin = normalizeIndianPincode(seller.pincode);
        const pinMatch = qDigits.length >= 3 && pin.includes(qDigits);
        return name.includes(query) || location.includes(query) || pinMatch;
      });
    }

    if (mapSearchQuery.trim()) {
      const query = mapSearchQuery.toLowerCase();
      const qDigits = query.replace(/\D/g, '');
      filtered = filtered.filter(seller => {
        const location = (seller.location || '').toLowerCase();
        const address = (seller.address || '').toLowerCase();
        const pin = normalizeIndianPincode(seller.pincode);
        const pinMatch = qDigits.length >= 3 && pin.includes(qDigits);
        return location.includes(query) || address.includes(query) || pinMatch;
      });
    }

    if (companyTypeFilter !== 'all') {
      filtered = filtered.filter(seller => {
        if (companyTypeFilter === 'showroom') return isShowroomSeller(seller);
        return isCarServiceProvider(seller); // 'car-service'
      });
    }

    if (userLocation?.trim()) {
      filtered = filtered.filter((seller) => sellerMatchesHeaderRegion(seller, userLocation));
    }

    return filtered;
  }, [sellers, searchQuery, mapSearchQuery, companyTypeFilter, userLocation]);

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

  const dealersWithMarkers = filteredSellersWithCoords.filter(item => item.coords !== null).length;
  const showroomCount = filteredSellers.filter(isShowroomSeller).length;
  const serviceCount = filteredSellers.filter(isCarServiceProvider).length;

  return (
    <div className="dp-root h-screen flex flex-col overflow-hidden bg-slate-50">
      {/* ===== Scoped premium styles ===== */}
      <style>{DP_STYLES}</style>

      {/* ===== Premium Aurora Top Strip ===== */}
      <header className="dp-topstrip relative overflow-hidden">
        <span className="dp-orb dp-orb-a" />
        <span className="dp-orb dp-orb-b" />
        <span className="dp-orb dp-orb-c" />
        <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-4 lg:py-5 flex flex-col lg:flex-row items-start lg:items-center gap-3 lg:gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="dp-crest">
              <svg className="w-6 h-6 lg:w-7 lg:h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="dp-title text-xl lg:text-2xl font-black text-white tracking-tight leading-tight">
                Trusted Dealers {userLocation ? <span className="dp-title-accent">· {userLocation}</span> : null}
              </h1>
              <p className="text-[12px] lg:text-[13px] text-white/75 mt-0.5">
                Verified showrooms &amp; car service partners near you
              </p>
            </div>
          </div>

          <div className="lg:ml-auto flex flex-wrap items-center gap-2">
            <span className="dp-stat-chip">
              <span className="dp-stat-dot" style={{ background: '#6ee7b7' }} />
              <strong>{filteredSellers.length}</strong> dealer{filteredSellers.length === 1 ? '' : 's'}
            </span>
            <span className="dp-stat-chip">
              <span className="dp-stat-dot" style={{ background: '#60a5fa' }} />
              <strong>{serviceCount}</strong> services
            </span>
            <span className="dp-stat-chip">
              <span className="dp-stat-dot" style={{ background: '#fbbf24' }} />
              <strong>{showroomCount}</strong> showrooms
            </span>
            <span className="dp-stat-chip dp-stat-chip-ghost">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Verified partners
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area - Split Layout: stack on small screens, side-by-side on lg+ */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-full lg:w-[400px] xl:w-[440px] shrink-0 lg:border-r lg:border-slate-200 flex flex-col overflow-hidden bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          {/* Sidebar Header (glass) */}
          <div className="dp-sidebar-head p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                Dealers
              </h2>
              {!isLoadingSellers && !sellerLoadError && (
                <span className="text-[11px] text-slate-500 font-semibold">
                  {filteredSellers.length}
                  {filteredSellers.length !== sellers.length ? ` / ${sellers.length}` : ''}
                </span>
              )}
            </div>

            {/* Search Bar */}
            <div className="dp-search mb-3">
              <svg className="dp-search-ic w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="search"
                placeholder="Search by name, location or PIN"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search dealers by name or location"
                className="dp-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="dp-search-clear"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Segmented pill filter */}
            <div className="dp-seg" role="radiogroup" aria-label="Filter by dealer type">
              {([
                { v: 'all', label: 'All' },
                { v: 'car-service', label: 'Car Service' },
                { v: 'showroom', label: 'Showroom' },
              ] as { v: CompanyType; label: string }[]).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  role="radio"
                  aria-checked={companyTypeFilter === opt.v}
                  onClick={() => setCompanyTypeFilter(opt.v)}
                  className={`dp-seg-btn ${companyTypeFilter === opt.v ? 'dp-seg-active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <p className="text-[11px] text-slate-400 mt-2.5 inline-flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Tap a dealer name to locate it on the map
            </p>
          </div>

          {/* Company List */}
          <div className="flex-1 overflow-y-auto dp-scroll">
            {isLoadingSellers ? (
              <div className="flex flex-col items-center justify-center min-h-[280px] p-6">
                <div className="dp-loader mb-4" />
                <p className="text-slate-700 font-semibold">Finding trusted dealers…</p>
                <p className="text-xs text-slate-400 mt-1">Fetching verified partners in your region</p>
                <div className="w-full max-w-xs space-y-3 mt-6">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="dp-skel rounded-2xl h-24" />
                  ))}
                </div>
              </div>
            ) : sellerLoadError ? (
              <div className="flex flex-col items-center justify-center min-h-[280px] p-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-100 to-red-200 flex items-center justify-center mb-4 shadow-sm">
                  <svg className="w-7 h-7 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-slate-900 font-bold mb-1">Couldn't load dealers</p>
                <p className="text-sm text-slate-500 mb-4 max-w-xs">{sellerLoadError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="dp-btn-primary px-4 py-2 text-sm font-semibold rounded-xl"
                >
                  Retry
                </button>
              </div>
            ) : filteredSellers.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[280px] p-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-4 shadow-sm">
                  <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-slate-900 font-bold mb-1">
                  {searchQuery || companyTypeFilter !== 'all' ? 'No matching dealers' : 'No dealers yet'}
                </p>
                <p className="text-sm text-slate-500">
                  {searchQuery ? 'Try a different search or filter' : 'Check back later for dealers in this region'}
                </p>
              </div>
            ) : (
              <div ref={listRef} className="py-2 dp-stagger">
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
                        currentUser={currentUser}
                        onRequireLogin={onRequireLogin}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Map Section */}
        <div className="flex-1 relative min-h-[300px] lg:min-h-0 dp-map-wrap">
          {/* Map Search - filter by city/location */}
          <div className="absolute top-4 left-4 right-4 lg:right-auto z-[1000] lg:w-80">
            <div className="dp-map-search">
              <svg className="dp-search-ic w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <input
                type="search"
                placeholder="Filter by city or area"
                value={mapSearchQuery}
                onChange={(e) => setMapSearchQuery(e.target.value)}
                aria-label="Filter dealers by city or area"
                className="dp-search-input"
              />
              {mapSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMapSearchQuery('')}
                  aria-label="Clear filter"
                  className="dp-search-clear"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Map legend */}
          <div className="absolute bottom-4 left-4 z-[1000] dp-legend">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 mr-1">Legend</span>
            <span className="dp-legend-item"><span className="dp-legend-pin" style={{ background: '#2563eb' }} /> Car Service</span>
            <span className="dp-legend-item"><span className="dp-legend-pin" style={{ background: '#16a34a' }} /> Showroom</span>
            <span className="dp-legend-item"><span className="dp-legend-pin" style={{ background: '#7c3aed' }} /> Both</span>
          </div>

          {/* Map count badge */}
          {!isLoadingSellers && dealersWithMarkers > 0 && (
            <div className="absolute top-4 right-4 z-[1000] dp-map-badge">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="6" />
              </svg>
              <strong>{dealersWithMarkers}</strong>
              <span className="text-slate-500">on map</span>
            </div>
          )}

          {/* Empty map state when no dealer locations */}
          {dealersWithMarkers === 0 && !isLoadingSellers && (
            <div className="absolute inset-0 z-[500] flex items-center justify-center bg-slate-100/60 backdrop-blur-[2px] pointer-events-none">
              <div className="dp-empty-map">
                <div className="dp-empty-icon">
                  <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-slate-800 font-bold">No dealer locations on map</p>
                <p className="text-xs text-slate-500 mt-1">Locations appear when dealers add address data</p>
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
            onDealerSelect={handleDealerSelect}
          />
        </div>
      </div>
    </div>
  );
};

export default DealerProfiles;
