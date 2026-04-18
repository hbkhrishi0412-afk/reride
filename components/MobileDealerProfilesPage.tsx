import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { User, Vehicle } from '../types';
import { getFollowersCount } from '../services/buyerEngagementService';
import { isUserVerified } from './VerifiedBadge';
import VerifiedBadge from './VerifiedBadge';
import { getSellers, getServiceProviders } from '../services/userService';
import { DealerMap, type CompanyLocation } from './DealerProfiles';
import { getSellerMapCoordinates, normalizeIndianPincode } from '../utils/sellerLocation';
import { resolveSellerLogoUrl, sellerInitialsAvatarDataUri } from '../utils/imageUtils';
import { sellerMatchesHeaderRegion } from '../utils/dealerRegionFilter';

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

/* ============================================================
   Scoped premium styles for the Mobile Dealer Profiles page.
   All rules are prefixed with `.mdp-` to avoid global bleed.
   Mirrors the desktop `.dp-*` design language, tuned for touch.
   ============================================================ */
const MDP_STYLES = `
  .mdp-root { --mdp-ink:#0b1020; }

  /* ===== Aurora top strip ===== */
  .mdp-hero {
    position: relative; overflow: hidden;
    background:
      radial-gradient(700px 220px at 0% 0%, rgba(99,102,241,.6), transparent 60%),
      radial-gradient(600px 240px at 100% 100%, rgba(236,72,153,.55), transparent 60%),
      linear-gradient(125deg,#0f172a 0%,#1e1b4b 55%,#4c1d95 100%);
    box-shadow: 0 12px 30px -18px rgba(15,23,42,.6);
  }
  .mdp-hero::before {
    content:""; position:absolute; inset:-40%;
    background: conic-gradient(from 0deg at 50% 50%,
      rgba(99,102,241,.35), rgba(236,72,153,.25),
      rgba(34,211,238,.30), rgba(99,102,241,.35));
    filter: blur(55px); opacity:.45;
    animation: mdp-spin 24s linear infinite;
  }
  .mdp-hero::after {
    content:""; position:absolute; inset:0;
    background-image:
      linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px);
    background-size: 28px 28px;
    mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
    opacity:.35;
  }
  @keyframes mdp-spin { to { transform: rotate(360deg); } }

  .mdp-orb { position:absolute; border-radius:9999px; filter: blur(32px); mix-blend-mode: screen; pointer-events:none; }
  .mdp-orb-a { width:180px; height:180px; left:-40px; top:-40px; background:#60a5fa; opacity:.55; animation: mdp-float 10s ease-in-out infinite; }
  .mdp-orb-b { width:220px; height:220px; right:-60px; top:-60px; background:#c084fc; opacity:.45; animation: mdp-float 13s ease-in-out infinite reverse; }
  @keyframes mdp-float {
    0%,100% { transform: translate3d(0,0,0) scale(1); }
    50%     { transform: translate3d(14px,-10px,0) scale(1.08); }
  }

  .mdp-crest {
    position: relative;
    width: 40px; height: 40px; border-radius: 12px;
    background: linear-gradient(135deg,#6366f1,#a855f7 60%,#ec4899);
    display: inline-flex; align-items: center; justify-content: center;
    box-shadow: 0 12px 22px -8px rgba(79,70,229,.55), inset 0 1px 0 rgba(255,255,255,.4);
    flex-shrink: 0;
  }
  .mdp-title-accent {
    background: linear-gradient(90deg,#fbcfe8,#c4b5fd,#a5f3fc);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    background-size: 220% 100%;
    animation: mdp-grad 8s ease-in-out infinite;
    font-weight: 800;
  }
  @keyframes mdp-grad { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }

  .mdp-stat-chip {
    display: inline-flex; align-items: center; gap: .3rem;
    padding: .25rem .55rem; border-radius: 9999px;
    font-size: 10.5px; color: white; font-weight: 700;
    background: rgba(255,255,255,.10);
    border: 1px solid rgba(255,255,255,.22);
    backdrop-filter: blur(10px);
  }
  .mdp-stat-chip strong { font-weight: 800; }
  .mdp-stat-dot { width: 6px; height: 6px; border-radius: 9999px; display: inline-block; }

  /* ===== Search & controls ===== */
  .mdp-search, .mdp-map-search {
    position: relative;
    display: flex; align-items: center;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    transition: box-shadow .25s ease, border-color .25s ease;
    box-shadow: 0 1px 0 rgba(255,255,255,.8) inset, 0 1px 2px rgba(15,23,42,.04);
    min-height: 48px;
  }
  .mdp-search:focus-within, .mdp-map-search:focus-within {
    border-color: #6366f1;
    box-shadow: 0 0 0 4px rgba(99,102,241,.15), 0 10px 22px -12px rgba(79,70,229,.35);
  }
  .mdp-search-ic { margin-left: .8rem; color: #94a3b8; flex-shrink: 0; }
  .mdp-search-input {
    flex: 1; border: 0; background: transparent; outline: none;
    padding: .7rem .75rem; font-size: 14.5px; color: #0f172a;
    min-width: 0;
  }
  .mdp-search-input::placeholder { color: #94a3b8; }
  .mdp-search-clear {
    margin-right: .4rem;
    width: 26px; height: 26px; border-radius: 9999px;
    background: #f1f5f9; color: #64748b;
    display: inline-flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .mdp-search-clear:active { background: #e2e8f0; }

  /* ===== Segmented pill filter ===== */
  .mdp-seg {
    display: inline-flex; align-items: center;
    padding: 3px; border-radius: 12px;
    background: #f1f5f9; border: 1px solid #e2e8f0;
    width: 100%;
  }
  .mdp-seg-btn {
    flex: 1; padding: .55rem .55rem; font-size: 12.5px; font-weight: 700;
    color: #475569; border-radius: 10px; background: transparent;
    transition: all .25s ease;
    min-height: 40px;
  }
  .mdp-seg-btn:active { color: #0f172a; }
  .mdp-seg-active {
    color: white !important;
    background: linear-gradient(135deg,#4f46e5,#9333ea);
    box-shadow: 0 10px 18px -10px rgba(79,70,229,.55), inset 0 1px 0 rgba(255,255,255,.4);
  }

  /* ===== Dealer card ===== */
  .mdp-card {
    position: relative; isolation: isolate;
    background: linear-gradient(180deg,#ffffff,#fbfcfe);
    border: 1px solid #eef2f7;
    border-radius: 18px;
    transition: transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s ease, border-color .25s ease;
    transform: perspective(900px) rotateX(var(--mdp-rx,0deg)) rotateY(var(--mdp-ry,0deg));
    box-shadow: 0 1px 0 rgba(255,255,255,.9) inset, 0 1px 2px rgba(15,23,42,.03);
    overflow: hidden;
  }
  .mdp-card:active {
    transform: perspective(900px) scale(.985);
    border-color: rgba(99,102,241,.3);
  }
  .mdp-card-selected {
    border-color: #6366f1 !important;
    box-shadow: 0 24px 40px -22px rgba(79,70,229,.45), 0 0 0 2px rgba(99,102,241,.25) !important;
  }
  .mdp-card-selected::after {
    content:""; position: absolute; left: 0; top: 12%; bottom: 12%;
    width: 3px; border-radius: 0 3px 3px 0;
    background: linear-gradient(180deg,#4f46e5,#9333ea);
  }

  .mdp-ribbon {
    position: absolute; top: 8px; right: 8px; z-index: 2;
    display: inline-flex; align-items: center; gap: .25rem;
    padding: .18rem .5rem; border-radius: 9999px;
    font-size: 10px; font-weight: 800; letter-spacing: .02em;
    color: #78350f;
    background: linear-gradient(135deg,#fde68a,#f59e0b);
    box-shadow: 0 6px 14px -8px rgba(245,158,11,.55), inset 0 1px 0 rgba(255,255,255,.6);
  }

  .mdp-logo-ring {
    position: relative;
    padding: 2px; border-radius: 14px;
    background: linear-gradient(135deg, var(--c1,#60a5fa), var(--c2,#a855f7));
    box-shadow: 0 10px 20px -10px rgba(79,70,229,.45);
    flex-shrink: 0;
  }
  .mdp-type-showroom { --c1:#34d399; --c2:#059669; }
  .mdp-type-service  { --c1:#60a5fa; --c2:#4f46e5; }
  .mdp-logo-ring img { display: block; width: 60px; height: 60px; border-radius: 12px; object-fit: cover; background: #fff; }

  .mdp-name { font-weight: 900; color: #0f172a; font-size: 15px; line-height: 1.2; }
  .mdp-pin-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 18px; height: 18px; border-radius: 6px;
    background: #eef2ff; color: #4f46e5; flex-shrink: 0;
  }

  .mdp-type-pill {
    display: inline-flex; align-items: center;
    padding: .12rem .5rem; border-radius: 9999px;
    font-size: 10px; font-weight: 700;
    color: white;
    background: linear-gradient(135deg, var(--c1,#60a5fa), var(--c2,#a855f7));
    box-shadow: 0 6px 12px -8px rgba(79,70,229,.45);
  }

  .mdp-status-pill {
    display: inline-flex; align-items: center; gap: .3rem;
    padding: .12rem .45rem .12rem .3rem; border-radius: 9999px;
    font-size: 10px; font-weight: 700;
    border: 1px solid transparent;
  }
  .mdp-status-pill.mdp-open {
    color: #065f46; background: #d1fae5; border-color: #6ee7b7;
  }
  .mdp-status-pill.mdp-closed {
    color: #7f1d1d; background: #fee2e2; border-color: #fca5a5;
  }
  .mdp-status-dot { position: relative; width: 8px; height: 8px; display: inline-flex; }
  .mdp-status-dot-core {
    position: absolute; inset: 0; margin: auto;
    width: 8px; height: 8px; border-radius: 9999px;
  }
  .mdp-status-dot-ping {
    position: absolute; inset: 0; width: 8px; height: 8px; border-radius: 9999px;
    animation: mdp-ping 1.6s cubic-bezier(0,0,.2,1) infinite;
  }
  .mdp-open .mdp-status-dot-core { background: #10b981; }
  .mdp-open .mdp-status-dot-ping { background: rgba(16,185,129,.55); }
  .mdp-closed .mdp-status-dot-core { background: #ef4444; }
  .mdp-closed .mdp-status-dot-ping { background: rgba(239,68,68,.45); }
  @keyframes mdp-ping { 75%,100% { transform: scale(2.2); opacity: 0; } }

  /* ===== Buttons ===== */
  .mdp-btn-primary {
    position: relative; overflow: hidden;
    color: white;
    background: linear-gradient(135deg,#4f46e5,#7c3aed 60%,#db2777);
    box-shadow: 0 12px 22px -12px rgba(79,70,229,.55), inset 0 1px 0 rgba(255,255,255,.3);
    min-height: 40px;
  }
  .mdp-btn-primary::before {
    content:""; position: absolute; inset: 0;
    background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,.45) 50%, transparent 70%);
    transform: translateX(-120%); transition: transform .6s ease;
  }
  .mdp-btn-primary:active { transform: translateY(1px); }
  .mdp-btn-primary:active::before { transform: translateX(120%); }

  .mdp-btn-ghost {
    color: #334155;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    min-height: 40px;
  }
  .mdp-btn-ghost:active { background: #eef2ff; color: #3730a3; border-color: #c7d2fe; }

  .mdp-btn-gold {
    color: #78350f;
    background: linear-gradient(135deg,#fde68a,#f59e0b);
    box-shadow: 0 12px 22px -12px rgba(245,158,11,.55), inset 0 1px 0 rgba(255,255,255,.6);
  }

  /* ===== Map overlays ===== */
  .mdp-legend {
    display: inline-flex; align-items: center; gap: .5rem; flex-wrap: wrap;
    padding: .45rem .65rem; border-radius: 12px;
    background: rgba(255,255,255,.92); backdrop-filter: blur(12px);
    border: 1px solid rgba(15,23,42,.08);
    box-shadow: 0 10px 22px -12px rgba(15,23,42,.25);
    font-size: 10.5px; color: #334155; font-weight: 600;
  }
  .mdp-legend-item { display: inline-flex; align-items: center; gap: .3rem; }
  .mdp-legend-pin { width: 9px; height: 9px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 1px 2px rgba(0,0,0,.25); }

  .mdp-empty-map {
    pointer-events: auto;
    background: rgba(255,255,255,.96);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(15,23,42,.06);
    border-radius: 16px; padding: .9rem 1.1rem;
    box-shadow: 0 20px 40px -20px rgba(15,23,42,.3);
    text-align: center; max-width: 260px;
  }
  .mdp-empty-ic {
    width: 40px; height: 40px; border-radius: 12px; margin: 0 auto .5rem;
    background: linear-gradient(135deg,#eef2ff,#e0e7ff);
    color: #4f46e5;
    display: inline-flex; align-items: center; justify-content: center;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.7);
  }

  /* ===== Loader / Skeleton ===== */
  .mdp-loader {
    width: 40px; height: 40px; border-radius: 9999px;
    background: conic-gradient(from 0deg, #6366f1, #a855f7, #ec4899, #6366f1);
    -webkit-mask: radial-gradient(farthest-side, transparent 58%, black 60%);
            mask: radial-gradient(farthest-side, transparent 58%, black 60%);
    animation: mdp-spin 1.1s linear infinite;
  }
  .mdp-skel {
    background: linear-gradient(90deg,#f1f5f9 0%,#e2e8f0 50%,#f1f5f9 100%);
    background-size: 200% 100%;
    animation: mdp-shimmer 1.4s linear infinite;
  }
  @keyframes mdp-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  /* ===== Stagger ===== */
  .mdp-stagger > * {
    opacity: 0; transform: translateY(8px);
    animation: mdp-rise .45s both cubic-bezier(.2,.8,.2,1);
  }
  .mdp-stagger > *:nth-child(1) { animation-delay: .02s; }
  .mdp-stagger > *:nth-child(2) { animation-delay: .06s; }
  .mdp-stagger > *:nth-child(3) { animation-delay: .10s; }
  .mdp-stagger > *:nth-child(4) { animation-delay: .14s; }
  .mdp-stagger > *:nth-child(5) { animation-delay: .18s; }
  .mdp-stagger > *:nth-child(n+6) { animation-delay: .22s; }
  @keyframes mdp-rise { to { opacity: 1; transform: translateY(0); } }

  /* Pulsing ring on selected Leaflet marker */
  .custom-marker-selected, .custom-marker-showroom-selected { position: relative; }
  .custom-marker-selected::after, .custom-marker-showroom-selected::after {
    content: ""; position: absolute; left: 50%; top: 50%;
    width: 30px; height: 30px; margin: -15px 0 0 -15px;
    border-radius: 9999px;
    border: 3px solid rgba(239,68,68,.55);
    animation: mdp-marker-ping 1.6s ease-out infinite;
    pointer-events: none;
  }
  .custom-marker-showroom-selected::after { border-color: rgba(234,88,12,.55); }
  @keyframes mdp-marker-ping {
    0% { transform: scale(.6); opacity: 1; }
    100% { transform: scale(2.4); opacity: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .mdp-hero::before, .mdp-orb, .mdp-title-accent,
    .mdp-status-dot-ping, .mdp-loader, .mdp-skel,
    .mdp-stagger > *, .custom-marker-selected::after,
    .custom-marker-showroom-selected::after { animation: none !important; }
  }
`;

interface MobileDealerProfilesPageProps {
  sellers?: User[];
  vehicles?: Vehicle[];
  onViewProfile: (sellerEmail: string) => void;
  /** When set, "Call now" is allowed; otherwise guests are prompted to log in. */
  currentUser?: User | null;
  onRequireLogin?: () => void;
  /** Header location — filters dealers to match the chosen region. */
  userLocation?: string;
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
  currentUser?: User | null;
  onRequireLogin?: () => void;
}> = React.memo(({
  seller,
  onViewProfile,
  onSelect,
  isRecommended = false,
  coords = null,
  isSelected = false,
  vehicleCount,
  followersCount,
  currentUser,
  onRequireLogin,
}) => {
  // Type is driven by user role (source of truth):
  //   role === 'service_provider'  -> "Car Service"
  //   role === 'seller'            -> "Showroom"
  const companyType: 'showroom' | 'car-service' = seller.role === 'service_provider' ? 'car-service' : 'showroom';
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
  const pin = normalizeIndianPincode(seller.pincode);
  const base = (seller.address || seller.location || '').trim();
  const address =
    !base && !pin
      ? 'Address not available'
      : [base || null, pin ? `PIN ${pin}` : null].filter(Boolean).join(' · ');
  const languages = ['Hindi', 'English'];

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      onRequireLogin?.();
      return;
    }
    if (seller.mobile) window.location.href = `tel:${seller.mobile}`;
  };

  const handleDealerNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelect && coords) onSelect(seller.email, coords);
  };

  const verified = isUserVerified(seller);
  const [dealerLogoSrc, setDealerLogoSrc] = useState(() => resolveSellerLogoUrl(seller));
  useEffect(() => {
    setDealerLogoSrc(resolveSellerLogoUrl(seller));
  }, [seller.logoUrl, seller.email, seller.dealershipName, seller.name]);

  const typeCls = companyType === 'showroom' ? 'mdp-type-showroom' : 'mdp-type-service';
  const typeLabel = companyType === 'showroom' ? 'Showroom' : 'Car Service';

  return (
    <div
      className={`mdp-card ${coords ? '' : ''} ${isSelected ? 'mdp-card-selected' : ''}`}
      onClick={() => {
        if (onSelect && coords) onSelect(seller.email, coords);
      }}
      style={{ cursor: coords ? 'pointer' : 'default' }}
    >
      {shouldShowRecommendButton && (
        <div className="mdp-ribbon" aria-hidden>
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.39 6.95H22l-6 4.43 2.39 6.95L12 16.9l-6.39 3.43L8 13.38l-6-4.43h7.61z" />
          </svg>
          <span>Recommended</span>
        </div>
      )}

      <div className="p-4 relative">
        <div className="flex gap-3">
          {/* Logo with gradient ring */}
          <div className={`mdp-logo-ring ${typeCls} relative`}>
            <img
              src={dealerLogoSrc}
              alt={seller.dealershipName || seller.name}
              loading="lazy"
              decoding="async"
              onError={() => setDealerLogoSrc(sellerInitialsAvatarDataUri(seller))}
            />
            {verified && (
              <VerifiedBadge show={true} iconOnly size="sm" className="absolute -bottom-1 -right-1" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Name */}
            <h3
              className="mdp-name truncate mb-1 inline-flex items-center gap-1.5"
              onClick={handleDealerNameClick}
              title={coords ? 'Show on map' : undefined}
            >
              <span className="truncate">{seller.dealershipName || seller.name}</span>
              {coords && (
                <span className="mdp-pin-btn" aria-hidden>
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
              )}
            </h3>

            {/* Type + status pills */}
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <span className={`mdp-type-pill ${typeCls}`}>{typeLabel}</span>
              <span className={`mdp-status-pill ${isOpen ? 'mdp-open' : 'mdp-closed'}`}>
                <span className="mdp-status-dot" aria-hidden>
                  <span className="mdp-status-dot-ping" />
                  <span className="mdp-status-dot-core" />
                </span>
                {statusText}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 -mt-0.5 mb-1.5">{statusSubtext}</p>

            {/* Address */}
            <p className="text-[12px] text-slate-600 mb-1.5 line-clamp-2">
              <svg className="inline w-3 h-3 text-slate-400 mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {address}
            </p>

            {/* Inline meta */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold flex-wrap">
              <span>{vehicleCount} {vehicleCount === 1 ? 'listing' : 'listings'}</span>
              <span className="text-slate-300">·</span>
              <span>{followersCount} followers</span>
              <span className="text-slate-300">·</span>
              <span>{languages.join(', ')}</span>
            </div>
          </div>
        </div>

        {/* Action buttons (full width row) */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <button
            type="button"
            onClick={handleCall}
            className="mdp-btn-primary text-[13px] font-bold px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5"
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
            className="mdp-btn-ghost text-[13px] font-bold px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5"
          >
            View profile
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          {shouldShowRecommendButton && (
            <span
              className="mdp-btn-gold text-[13px] font-bold px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5 select-none pointer-events-none"
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
  );
});

/**
 * Mobile Dealer Profiles Page – aligned with website: map + list, filters, find nearby dealers.
 */
export const MobileDealerProfilesPage: React.FC<MobileDealerProfilesPageProps> = ({
  sellers: propSellers,
  vehicles = [],
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
  const [sellersWithCoords, setSellersWithCoords] = useState<Array<{ seller: User; coords: CompanyLocation | null }>>([]);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([20.5937, 78.9629]);
  const [selectedDealerCenter, setSelectedDealerCenter] = useState<[number, number] | null>(null);
  const [selectedDealerEmail, setSelectedDealerEmail] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!propSellers || propSellers.length === 0) {
      const fetchDealers = async () => {
        setIsLoadingSellers(true);
        try {
          const [fetchedSellers, fetchedServices] = await Promise.all([
            getSellers().catch(() => [] as User[]),
            getServiceProviders().catch(() => [] as User[]),
          ]);
          const combined = [...fetchedSellers, ...fetchedServices].filter(
            (u) => u.role === 'seller' || u.role === 'service_provider'
          );
          setSellers(combined);
        } catch (error) {
          console.error('MobileDealerProfilesPage: Error fetching dealers:', error);
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

  useEffect(() => {
    const fetchCoords = async () => {
      const sellersWithLocations: Array<{ seller: User; coords: CompanyLocation | null }> = [];
      for (const seller of sellers) {
        const coords = await getSellerMapCoordinates(seller);
        sellersWithLocations.push({ seller, coords });
      }
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
      const qDigits = q.replace(/\D/g, '');
      filtered = filtered.filter(seller => {
        const pin = normalizeIndianPincode(seller.pincode);
        const pinMatch = qDigits.length >= 3 && pin.includes(qDigits);
        return (
          (seller.dealershipName || seller.name || '').toLowerCase().includes(q) ||
          (seller.location || '').toLowerCase().includes(q) ||
          (seller.email || '').toLowerCase().includes(q) ||
          pinMatch
        );
      });
    }
    if (mapSearchQuery.trim()) {
      const q = mapSearchQuery.toLowerCase();
      const qDigits = q.replace(/\D/g, '');
      filtered = filtered.filter(seller => {
        const pin = normalizeIndianPincode(seller.pincode);
        const pinMatch = qDigits.length >= 3 && pin.includes(qDigits);
        return (
          (seller.location || '').toLowerCase().includes(q) ||
          (seller.address || '').toLowerCase().includes(q) ||
          pinMatch
        );
      });
    }
    if (companyTypeFilter !== 'all') {
      filtered = filtered.filter(seller => {
        if (companyTypeFilter === 'showroom') return seller.role === 'seller';
        return seller.role === 'service_provider'; // 'car-service'
      });
    }
    if (userLocation?.trim()) {
      filtered = filtered.filter((seller) => sellerMatchesHeaderRegion(seller, userLocation));
    }
    return filtered;
  }, [sellers, searchQuery, mapSearchQuery, companyTypeFilter, userLocation]);

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

  const hasMapDealers = filteredSellersWithCoords.some(item => item.coords !== null);
  const showroomCount = filteredSellers.filter(s => s.role === 'seller').length;
  const serviceCount = filteredSellers.filter(s => s.role === 'service_provider').length;

  return (
    <div className="mdp-root min-h-screen bg-slate-50 pb-24 flex flex-col">
      <style>{MDP_STYLES}</style>

      {/* ===== Aurora top strip ===== */}
      <header className="mdp-hero relative shrink-0">
        <span className="mdp-orb mdp-orb-a" />
        <span className="mdp-orb mdp-orb-b" />
        <div className="relative z-10 px-4 pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="mdp-crest">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-black text-white leading-tight tracking-tight truncate">
                Trusted Dealers {userLocation ? <span className="mdp-title-accent">· {userLocation}</span> : null}
              </h1>
              <p className="text-[11.5px] text-white/75 mt-0.5 truncate">
                Verified showrooms &amp; car service partners
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            <span className="mdp-stat-chip">
              <span className="mdp-stat-dot" style={{ background: '#6ee7b7' }} />
              <strong>{filteredSellers.length}</strong> dealer{filteredSellers.length === 1 ? '' : 's'}
            </span>
            <span className="mdp-stat-chip">
              <span className="mdp-stat-dot" style={{ background: '#60a5fa' }} />
              <strong>{serviceCount}</strong> services
            </span>
            <span className="mdp-stat-chip">
              <span className="mdp-stat-dot" style={{ background: '#fbbf24' }} />
              <strong>{showroomCount}</strong> showrooms
            </span>
          </div>
        </div>
      </header>

      {/* ===== Map ===== */}
      <div className="shrink-0 w-full bg-slate-200 relative" style={{ minHeight: 280, height: 280 }}>
        <div className="absolute inset-0 flex flex-col z-0">
          <div className="flex-1 min-h-0 relative" style={{ minHeight: 220 }}>
            {!hasMapDealers && !isLoadingSellers ? (
              <div className="absolute inset-0 z-[500] flex items-center justify-center bg-slate-100/70 backdrop-blur-[2px] px-4">
                <div className="mdp-empty-map">
                  <div className="mdp-empty-ic">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-slate-800 font-bold text-sm">No dealer locations on map</p>
                  <p className="text-[11px] text-slate-500 mt-1">Locations appear when dealers add address data</p>
                </div>
              </div>
            ) : null}
            <DealerMap
              center={mapCenter}
              zoom={5}
              bounds={mapBounds}
              selectedCenter={selectedDealerCenter}
              filteredSellersWithCoords={filteredSellersWithCoords}
              selectedDealerEmail={selectedDealerEmail}
              onDealerSelect={handleDealerSelect}
            />
            {/* Glass legend */}
            <div className="absolute bottom-3 left-3 z-[1000]">
              <span className="mdp-legend">
                <span className="mdp-legend-item"><span className="mdp-legend-pin" style={{ background: '#2563eb' }} /> Car Service</span>
                <span className="mdp-legend-item"><span className="mdp-legend-pin" style={{ background: '#16a34a' }} /> Showroom</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Search + filters (glass panel) ===== */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 shrink-0 space-y-2.5">
        {/* Search by name */}
        <div className="mdp-search">
          <svg className="mdp-search-ic w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search dealers by name or PIN…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search dealers"
            className="mdp-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="mdp-search-clear"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter by city */}
        <div className="mdp-map-search">
          <svg className="mdp-search-ic w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <input
            type="search"
            placeholder="Filter by city or area"
            value={mapSearchQuery}
            onChange={(e) => setMapSearchQuery(e.target.value)}
            aria-label="Filter by city"
            className="mdp-search-input"
          />
          {mapSearchQuery && (
            <button
              type="button"
              onClick={() => setMapSearchQuery('')}
              aria-label="Clear filter"
              className="mdp-search-clear"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Segmented pill filter */}
        <div className="mdp-seg" role="radiogroup" aria-label="Filter by dealer type">
          {([
            { v: 'all' as const, label: 'All' },
            { v: 'car-service' as const, label: 'Car Service' },
            { v: 'showroom' as const, label: 'Showroom' },
          ]).map((opt) => (
            <button
              key={opt.v}
              type="button"
              role="radio"
              aria-checked={companyTypeFilter === opt.v}
              onClick={() => setCompanyTypeFilter(opt.v)}
              className={`mdp-seg-btn ${companyTypeFilter === opt.v ? 'mdp-seg-active' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <p className="text-[11px] text-slate-400 inline-flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Tap a dealer name to locate on the map
        </p>
      </div>

      {/* ===== Dealer list ===== */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {isLoadingSellers ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="mdp-loader mb-3" />
            <p className="text-slate-700 font-semibold text-sm">Finding trusted dealers…</p>
            <p className="text-[11px] text-slate-400 mt-1">Fetching verified partners in your region</p>
            <div className="w-full max-w-sm space-y-2.5 mt-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="mdp-skel rounded-xl h-24" />
              ))}
            </div>
          </div>
        ) : filteredSellers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-3 shadow-sm">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-slate-900 font-bold">
              {searchQuery || mapSearchQuery || companyTypeFilter !== 'all'
                ? 'No matching dealers'
                : 'No dealers yet'}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              {searchQuery || mapSearchQuery
                ? 'Try a different search or filter'
                : 'Check back later for dealers in this region'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 mdp-stagger">
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
  );
};

export default MobileDealerProfilesPage;
