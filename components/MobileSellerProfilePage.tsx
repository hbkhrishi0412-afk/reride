import React, { useState, useMemo } from 'react';
import type { User, Vehicle } from '../types';
import { getFirstValidImage } from '../utils/imageUtils';
import VerifiedBadge, { isUserVerified } from './VerifiedBadge';
import BadgeDisplay from './BadgeDisplay';
import TrustBadgeDisplay from './TrustBadgeDisplay';
import { followSeller, unfollowSeller, isFollowingSeller, getFollowersCount, getFollowingCount } from '../services/buyerEngagementService';
import { telHrefFromRawPhone, phoneDisplayCompact } from '../utils/numberUtils';

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

/* ============================================================
   Scoped premium styles for the Mobile Seller Profile page.
   All rules are prefixed with `.msp-` to avoid global bleed.
   Mirrors the desktop `.sp-*` design language.
   ============================================================ */
const MSP_STYLES = `
  .msp-root { --msp-ink:#0b1020; }

  /* Aurora cover */
  .msp-cover {
    position: relative; overflow: hidden;
    background:
      radial-gradient(500px 220px at 10% 0%, rgba(99,102,241,.8), transparent 60%),
      radial-gradient(500px 220px at 90% 100%, rgba(236,72,153,.65), transparent 60%),
      linear-gradient(120deg,#1e1b4b 0%,#312e81 50%,#4c1d95 100%);
  }
  .msp-cover::before {
    content:""; position:absolute; inset:-40%;
    background: conic-gradient(from 0deg at 50% 50%,
      rgba(99,102,241,.35), rgba(236,72,153,.30),
      rgba(34,211,238,.30), rgba(99,102,241,.35));
    filter: blur(45px); opacity:.55;
    animation: msp-spin 22s linear infinite;
  }
  .msp-cover::after {
    content:""; position:absolute; inset:0;
    background-image:
      linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px);
    background-size: 22px 22px;
    mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
    opacity: .35;
  }
  @keyframes msp-spin { to { transform: rotate(360deg); } }

  .msp-orb { position:absolute; border-radius:9999px; filter: blur(22px); mix-blend-mode: screen; pointer-events:none; }
  .msp-orb-a { width:110px; height:110px; left:-30px; top:-20px; background:#60a5fa; opacity:.55; animation: msp-float 10s ease-in-out infinite; }
  .msp-orb-b { width:140px; height:140px; right:-40px; top:-30px; background:#c084fc; opacity:.5; animation: msp-float 13s ease-in-out infinite reverse; }
  @keyframes msp-float {
    0%,100% { transform: translate3d(0,0,0) scale(1); }
    50%     { transform: translate3d(12px,-8px,0) scale(1.08); }
  }

  /* Back button (over aurora) */
  .msp-back {
    display: inline-flex; align-items: center; justify-content: center;
    width: 42px; height: 42px; border-radius: 14px;
    background: rgba(255,255,255,.18);
    border: 1px solid rgba(255,255,255,.3);
    color: white;
    backdrop-filter: blur(12px);
  }
  .msp-back:active { background: rgba(255,255,255,.28); }

  /* Avatar spinning ring */
  .msp-avatar-wrap {
    position: relative;
    width: 104px; height: 104px;
    border-radius: 9999px;
    padding: 4px;
    background: conic-gradient(from 0deg, #60a5fa, #a855f7, #ec4899, #f59e0b, #60a5fa);
    box-shadow: 0 20px 40px -14px rgba(79,70,229,.45);
    animation: msp-spin 10s linear infinite;
  }
  .msp-avatar-inner {
    position: relative; width: 100%; height: 100%;
    border-radius: 9999px; background: #fff; padding: 3px;
    animation: msp-spin 10s linear infinite reverse;
  }
  .msp-avatar-inner img {
    width: 100%; height: 100%; border-radius: 9999px; object-fit: cover; display: block;
  }
  .msp-avatar-verified {
    position: absolute; bottom: -2px; right: -2px;
    width: 28px; height: 28px; border-radius: 9999px;
    background: linear-gradient(135deg,#10b981,#059669);
    color: white; display: inline-flex; align-items: center; justify-content: center;
    border: 3px solid #ffffff;
    box-shadow: 0 8px 16px -6px rgba(16,185,129,.5);
    z-index: 2;
  }

  /* Name gradient */
  .msp-name {
    background: linear-gradient(90deg,#0f172a,#1e293b 60%,#4338ca);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }

  /* Meta chip */
  .msp-meta-chip {
    display: inline-flex; align-items: center; gap: .35rem;
    padding: .28rem .65rem; border-radius: 9999px;
    background: linear-gradient(90deg, rgba(99,102,241,.1), rgba(236,72,153,.1));
    border: 1px solid rgba(99,102,241,.22);
    color: #4338ca; font-size: 11px; font-weight: 700;
  }

  /* Stats grid */
  .msp-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: .5rem; }
  .msp-stat {
    background: linear-gradient(180deg,#ffffff,#f8fafc);
    border: 1px solid #eef2f7;
    border-radius: 14px;
    padding: .6rem .7rem;
    text-align: center;
    transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
  }
  .msp-stat:active { transform: translateY(1px); }
  .msp-stat-label {
    font-size: 10px; font-weight: 800; letter-spacing: .06em;
    color: #64748b; text-transform: uppercase;
  }
  .msp-stat-value {
    font-size: 17px; font-weight: 900; color: #0f172a; margin-top: 2px;
    display: inline-flex; align-items: center; gap: .25rem; justify-content: center;
  }
  .msp-star { color: #f59e0b; }

  /* Verification progress card */
  .msp-verif {
    background: linear-gradient(180deg,#fbfcff,#f5f7ff);
    border: 1px solid #eef2ff;
    border-radius: 16px;
    padding: .85rem;
  }
  .msp-verif-ring {
    position: relative;
    width: 42px; height: 42px; border-radius: 9999px;
    background: conic-gradient(#10b981 var(--msp-pct,0%), #e2e8f0 0);
    display: inline-flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .msp-verif-ring::after {
    content:""; position:absolute; inset:4px; border-radius:9999px; background:#ffffff;
  }
  .msp-verif-ring-pct {
    position: relative; z-index: 1;
    font-size: 11px; font-weight: 900; color: #0f172a;
  }
  .msp-verif-title { font-size: 10px; font-weight: 800; letter-spacing: .08em; color: #475569; text-transform: uppercase; }
  .msp-verif-sub { font-size: 11.5px; color: #64748b; margin-top: 1px; }
  .msp-verif-item {
    display: flex; align-items: center; gap: .55rem;
    padding: .45rem .55rem;
    border-radius: 10px;
    background: #ffffff;
    border: 1px solid #eef2f7;
  }
  .msp-verif-item + .msp-verif-item { margin-top: .35rem; }
  .msp-verif-item.msp-ok {
    background: linear-gradient(90deg, rgba(209,250,229,.6), rgba(236,253,245,.6));
    border-color: rgba(16,185,129,.35);
  }
  .msp-verif-dot {
    flex-shrink: 0; width: 18px; height: 18px; border-radius: 9999px;
    display: inline-flex; align-items: center; justify-content: center;
    background: #e2e8f0; color: #94a3b8;
  }
  .msp-verif-item.msp-ok .msp-verif-dot {
    background: linear-gradient(135deg,#10b981,#059669); color: white;
    box-shadow: 0 6px 12px -6px rgba(16,185,129,.55);
  }
  .msp-verif-label { flex: 1; font-size: 12px; font-weight: 700; color: #334155; }
  .msp-verif-item.msp-ok .msp-verif-label { color: #065f46; }
  .msp-verif-state { font-size: 10px; font-weight: 800; color: #94a3b8; }
  .msp-verif-item.msp-ok .msp-verif-state { color: #10b981; }

  /* Bio */
  .msp-bio {
    position: relative;
    padding: .65rem .8rem .65rem 1.05rem;
    background: linear-gradient(180deg,#ffffff,#f8fafc);
    border: 1px solid #eef2f7;
    border-radius: 14px;
    font-size: 13px; line-height: 1.55; color: #475569;
  }
  .msp-bio::before {
    content:""; position: absolute; left: 0; top: 10%; bottom: 10%;
    width: 3px; border-radius: 0 3px 3px 0;
    background: linear-gradient(180deg,#4f46e5,#9333ea);
  }

  /* Buttons */
  .msp-btn-primary {
    position: relative; overflow: hidden;
    color: white;
    background: linear-gradient(135deg,#4f46e5,#7c3aed 60%,#db2777);
    box-shadow: 0 16px 26px -14px rgba(79,70,229,.55), inset 0 1px 0 rgba(255,255,255,.3);
    min-height: 44px;
  }
  .msp-btn-primary::before {
    content:""; position: absolute; inset: 0;
    background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,.45) 50%, transparent 70%);
    transform: translateX(-120%); transition: transform .6s ease;
  }
  .msp-btn-primary:active::before { transform: translateX(120%); }
  .msp-btn-ghost {
    color: #334155; background: #f1f5f9; border: 1px solid #e2e8f0;
    min-height: 44px;
  }
  .msp-btn-ghost:active { background: #eef2ff; color: #3730a3; border-color: #c7d2fe; }
  .msp-btn-following {
    color: #334155; background: #f1f5f9; border: 1px solid #e2e8f0;
    min-height: 44px;
  }

  /* Listings header */
  .msp-eyebrow {
    display: inline-flex; align-items: center; gap: .3rem;
    padding: .15rem .55rem; border-radius: 9999px;
    background: linear-gradient(90deg, rgba(99,102,241,.12), rgba(236,72,153,.12));
    border: 1px solid rgba(99,102,241,.2);
    color: #4338ca;
    font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
  }
  .msp-listings-title {
    background: linear-gradient(90deg,#0f172a,#1e293b 60%,#4338ca);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .msp-count-chip {
    display: inline-flex; align-items: center; gap: .3rem;
    padding: .22rem .55rem; border-radius: 9999px;
    background: linear-gradient(135deg,#4f46e5,#9333ea);
    color: white; font-size: 11px; font-weight: 800;
    box-shadow: 0 10px 20px -12px rgba(79,70,229,.55);
  }

  /* Glass search */
  .msp-search {
    position: relative;
    display: flex; align-items: center;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    transition: box-shadow .25s ease, border-color .25s ease;
    box-shadow: 0 1px 0 rgba(255,255,255,.8) inset, 0 1px 2px rgba(15,23,42,.04);
    min-height: 44px;
  }
  .msp-search:focus-within {
    border-color: #6366f1;
    box-shadow: 0 0 0 4px rgba(99,102,241,.15), 0 10px 22px -14px rgba(79,70,229,.35);
  }
  .msp-search input {
    flex: 1; border: 0; background: transparent; outline: none;
    padding: .65rem .75rem; font-size: 14px; color: #0f172a; min-width: 0;
  }
  .msp-search input::placeholder { color: #94a3b8; }
  .msp-search-ic { margin-left: .8rem; color: #94a3b8; flex-shrink: 0; }
  .msp-search-clear {
    margin-right: .4rem; width: 24px; height: 24px; border-radius: 9999px;
    background: #f1f5f9; color: #64748b;
    display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .msp-search-clear:active { background: #e2e8f0; }

  /* Vehicle tile */
  .msp-veh {
    background: linear-gradient(180deg,#ffffff,#fbfcfe);
    border: 1px solid #eef2f7;
    border-radius: 18px;
    overflow: hidden;
    transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
  }
  .msp-veh:active { transform: scale(.985); }
  .msp-veh-price {
    background: linear-gradient(135deg,#4f46e5,#9333ea 60%,#db2777);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    font-weight: 900;
  }

  /* Empty state */
  .msp-empty {
    background: linear-gradient(180deg,#ffffff,#f8fafc);
    border: 1px solid #eef2f7;
    border-radius: 20px;
    padding: 2rem 1rem;
    text-align: center;
  }
  .msp-empty-ic {
    width: 56px; height: 56px; border-radius: 16px;
    display: inline-flex; align-items: center; justify-content: center;
    margin: 0 auto .75rem;
    background: linear-gradient(135deg,#eef2ff,#e0e7ff);
    color: #4f46e5;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 8px 16px -10px rgba(79,70,229,.25);
  }

  /* Stagger */
  .msp-stagger > * {
    opacity: 0; transform: translateY(8px);
    animation: msp-rise .45s both cubic-bezier(.2,.8,.2,1);
  }
  .msp-stagger > *:nth-child(1) { animation-delay: .04s; }
  .msp-stagger > *:nth-child(2) { animation-delay: .08s; }
  .msp-stagger > *:nth-child(3) { animation-delay: .12s; }
  .msp-stagger > *:nth-child(4) { animation-delay: .16s; }
  .msp-stagger > *:nth-child(5) { animation-delay: .20s; }
  .msp-stagger > *:nth-child(n+6) { animation-delay: .24s; }
  @keyframes msp-rise { to { opacity: 1; transform: translateY(0); } }

  @media (prefers-reduced-motion: reduce) {
    .msp-cover::before, .msp-orb, .msp-avatar-wrap, .msp-avatar-inner,
    .msp-stagger > *, .msp-btn-primary::before { animation: none !important; }
  }
`;

/**
 * Mobile-Optimized Seller Profile Page (premium redesign).
 */
export const MobileSellerProfilePage: React.FC<MobileSellerProfilePageProps> = ({
  seller,
  vehicles,
  onSelectVehicle,
  comparisonList,
  onToggleCompare,
  wishlist,
  onToggleWishlist,
  onBack,
  onViewSellerProfile: _onViewSellerProfile, // reserved for future follow-modal UX
  currentUser,
  onRequireLogin,
}) => {
  if (!seller) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading Seller Profile…</p>
        </div>
      </div>
    );
  }

  const [searchQuery, setSearchQuery] = useState('');
  const storedUserJson = typeof window !== 'undefined' ? localStorage.getItem('reRideCurrentUser') : null;
  const storedUser: User | null = storedUserJson ? JSON.parse(storedUserJson) : null;
  const viewer = currentUser ?? storedUser;
  const currentUserId = viewer?.email || (typeof window !== 'undefined' ? localStorage.getItem('currentUserEmail') : null) || 'guest';
  const [isFollowing, setIsFollowing] = useState(() => isFollowingSeller(currentUserId as string, seller.email));

  const followersCount = useMemo(() => getFollowersCount(seller.email), [seller.email, isFollowing]);
  const followingCount = useMemo(() => getFollowingCount(seller.email), [seller.email, isFollowing]);
  const isOwnerSeller = viewer?.role === 'seller' && viewer.email === seller.email;

  const handleFollowToggle = () => {
    if (!viewer) {
      onRequireLogin?.();
      return;
    }
    if (isFollowing) {
      unfollowSeller(currentUserId, seller.email);
      setIsFollowing(false);
    } else {
      followSeller(currentUserId, seller.email, true);
      setIsFollowing(true);
    }
  };

  const filteredVehicles = useMemo(() => {
    if (!searchQuery.trim()) return vehicles;
    const q = searchQuery.toLowerCase();
    return vehicles.filter(v =>
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      v.description.toLowerCase().includes(q) ||
      (v.variant && v.variant.toLowerCase().includes(q))
    );
  }, [vehicles, searchQuery]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);

  // Verification (data-driven)
  const verificationItems = [
    {
      key: 'phone',
      label: 'Phone',
      verified: Boolean(seller.verificationStatus?.phoneVerified || seller.phoneVerified),
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
        </svg>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      verified: Boolean(seller.verificationStatus?.emailVerified || seller.emailVerified),
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
        </svg>
      ),
    },
    {
      key: 'id',
      label: 'Government ID',
      verified: Boolean(seller.verificationStatus?.govtIdVerified || seller.govtIdVerified),
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
      ),
    },
  ];
  const verifiedCount = verificationItems.filter(v => v.verified).length;
  const verificationPct = Math.round((verifiedCount / verificationItems.length) * 100);

  const memberSinceLabel = (() => {
    const dateStr = seller.createdAt || seller.joinedDate;
    if (dateStr) {
      try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      } catch (e) { /* fallthrough */ }
    }
    return 'Recently';
  })();

  const callHref = seller.mobile?.trim() ? telHrefFromRawPhone(seller.mobile) : null;

  return (
    <div className="msp-root min-h-screen bg-slate-50 pb-24">
      <style>{MSP_STYLES}</style>

      {/* ===== Aurora cover with back button ===== */}
      <div className="msp-cover relative" style={{ height: 130 }}>
        <span className="msp-orb msp-orb-a" />
        <span className="msp-orb msp-orb-b" />
        <div className="absolute top-3 left-3 z-10">
          <button onClick={onBack} className="msp-back" aria-label="Back">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ===== Seller card ===== */}
      <div className="bg-white px-4 pb-5 -mt-12 rounded-t-[28px] relative z-10 border-x border-t border-slate-100">
        <div className="flex flex-col items-center text-center">
          <div className="msp-avatar-wrap">
            <div className="msp-avatar-inner">
              <img
                src={seller.logoUrl || `https://i.pravatar.cc/150?u=${seller.email}`}
                alt={`${seller.dealershipName || seller.name} logo`}
                loading="lazy" decoding="async"
              />
            </div>
            {isUserVerified(seller) && (
              <span className="msp-avatar-verified" aria-label="Verified">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </span>
            )}
          </div>

          <h1 className="msp-name mt-3 text-xl font-black inline-flex items-center gap-1.5 flex-wrap justify-center">
            <span className="truncate max-w-[280px]">{seller.dealershipName || seller.name}</span>
            <VerifiedBadge show={isUserVerified(seller)} size="sm" />
          </h1>

          <div className="mt-2">
            <span className="msp-meta-chip">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Member since {memberSinceLabel}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-center gap-1.5 flex-wrap">
            <BadgeDisplay badges={seller.badges || []} />
            <TrustBadgeDisplay user={seller} showDetails={false} />
          </div>

          {/* Stats */}
          <div className="msp-stats mt-4 w-full">
            <div className="msp-stat">
              <div className="msp-stat-label">Rating</div>
              <div className="msp-stat-value">
                <svg className="msp-star w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.16c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.363 1.118l1.286 3.957c.3.921-.755 1.688-1.54 1.118l-3.366-2.446a1 1 0 00-1.176 0l-3.367 2.446c-.784.57-1.838-.197-1.539-1.118l1.286-3.957a1 1 0 00-.363-1.118L2.05 9.384c-.783-.57-.38-1.81.588-1.81h4.16a1 1 0 00.95-.69l1.286-3.957z" />
                </svg>
                {seller.averageRating ? seller.averageRating.toFixed(1) : '—'}
              </div>
              <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                {seller.ratingCount ? `${seller.ratingCount} rating${seller.ratingCount === 1 ? '' : 's'}` : 'No ratings yet'}
              </div>
            </div>

            <div className="msp-stat">
              <div className="msp-stat-label">Followers</div>
              <div className="msp-stat-value">{followersCount}</div>
              <div className="text-[10px] text-slate-400 font-semibold mt-0.5">People following</div>
            </div>

            <div className="msp-stat">
              <div className="msp-stat-label">Following</div>
              <div className="msp-stat-value">{followingCount}</div>
              <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Seller follows</div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (typeof document !== 'undefined') {
                  document.getElementById('msp-listings-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="msp-stat"
            >
              <div className="msp-stat-label">Listings</div>
              <div className="msp-stat-value">{vehicles.length}</div>
              <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Tap to view</div>
            </button>
          </div>

          {/* Verification */}
          <div className="msp-verif mt-4 w-full text-left">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div
                className="msp-verif-ring"
                style={{ ['--msp-pct' as any]: `${verificationPct}%` }}
                aria-hidden
              >
                <span className="msp-verif-ring-pct">{verificationPct}%</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="msp-verif-title">Verification</div>
                <div className="msp-verif-sub">{verifiedCount} of {verificationItems.length} completed</div>
              </div>
            </div>
            {verificationItems.map((item) => (
              <div key={item.key} className={`msp-verif-item ${item.verified ? 'msp-ok' : ''}`}>
                <span className="msp-verif-dot">
                  {item.verified ? (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    item.icon
                  )}
                </span>
                <span className="msp-verif-label">{item.label}</span>
                <span className="msp-verif-state">{item.verified ? 'Verified' : 'Pending'}</span>
              </div>
            ))}
          </div>

          {/* Bio */}
          {seller.bio && (
            <div className="msp-bio mt-4 w-full text-left">
              <span className="block text-[10px] font-black uppercase tracking-wider text-indigo-500 mb-1">About</span>
              {seller.bio}
            </div>
          )}

          {/* Actions */}
          {!isOwnerSeller && (
            <div className="mt-4 w-full flex gap-2">
              {viewer ? (
                <button
                  type="button"
                  onClick={handleFollowToggle}
                  className={`flex-1 rounded-xl px-4 py-3 font-bold text-sm inline-flex items-center justify-center gap-2 ${
                    isFollowing ? 'msp-btn-following' : 'msp-btn-primary'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Following
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Follow Seller
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onRequireLogin?.()}
                  className="flex-1 rounded-xl px-4 py-3 font-bold text-sm inline-flex items-center justify-center gap-2 msp-btn-primary"
                >
                  Log in to follow
                </button>
              )}
              {callHref && (
                <a
                  href={callHref}
                  className="msp-btn-ghost rounded-xl px-4 py-3 font-bold text-sm inline-flex items-center justify-center gap-1.5"
                  style={{ minWidth: 110 }}
                  aria-label={`Call ${seller.dealershipName || seller.name}`}
                >
                  <svg className="w-4 h-4 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                  <span className="tabular-nums">Call{phoneDisplayCompact(seller.mobile) ? ` · ${phoneDisplayCompact(seller.mobile)}` : ''}</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== Listings header ===== */}
      <div className="px-4 mt-4">
        <span className="msp-eyebrow">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3 3h18v4H3V3zm0 7h18v4H3v-4zm0 7h18v4H3v-4z" />
          </svg>
          Listings
        </span>
        <h3 className="msp-listings-title mt-2 text-xl font-black flex items-center gap-2 flex-wrap">
          Listings from this Seller
          <span className="msp-count-chip">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 16a2 2 0 104 0 2 2 0 00-4 0zm12 0a2 2 0 104 0 2 2 0 00-4 0zM3 7l1-3h14l2 6v5h-2a3 3 0 00-6 0H9a3 3 0 00-6 0H3V7z" />
            </svg>
            {filteredVehicles.length}
          </span>
        </h3>
        <p className="text-[12px] text-slate-500 mt-0.5">
          {filteredVehicles.length === 0
            ? 'No vehicles match right now'
            : `${filteredVehicles.length} ${filteredVehicles.length === 1 ? 'vehicle' : 'vehicles'} available`}
        </p>

        <div className="mt-3 msp-search">
          <svg className="msp-search-ic w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search make, model, variant…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search this seller's listings"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="msp-search-clear"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ===== Vehicles list ===== */}
      <div className="px-4 mt-3">
        {filteredVehicles.length === 0 ? (
          <div className="msp-empty">
            <div className="msp-empty-ic">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-slate-900 font-bold">
              {searchQuery ? 'No listings match your search' : 'No active listings'}
            </p>
            <p className="text-[12px] text-slate-500 mt-1 max-w-xs mx-auto">
              {searchQuery
                ? 'Try a different keyword, or clear the search to browse all listings.'
                : "This seller hasn't listed any vehicles yet."}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-3 msp-btn-primary rounded-xl px-4 py-2 font-bold text-sm inline-flex items-center"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div id="msp-listings-grid" className="space-y-3 msp-stagger">
            {filteredVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                onClick={() => onSelectVehicle(vehicle)}
                className="msp-veh"
              >
                <div className="flex gap-3 p-3">
                  <img
                    src={getFirstValidImage(vehicle.images, vehicle.id)}
                    alt={`${vehicle.make} ${vehicle.model}`}
                    className="w-24 h-24 rounded-xl object-cover flex-shrink-0 bg-slate-100"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-slate-900 text-[14px] leading-tight mb-0.5 truncate">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </h4>
                    {vehicle.variant && (
                      <p className="text-[11.5px] text-slate-500 mb-1 truncate">{vehicle.variant}</p>
                    )}
                    <p className="msp-veh-price text-lg mb-1">
                      {formatCurrency(vehicle.price)}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-100 font-semibold">{vehicle.mileage.toLocaleString()} km</span>
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-100 font-semibold">{vehicle.fuelType}</span>
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-100 font-semibold">{vehicle.transmission}</span>
                    </div>
                  </div>
                </div>
                <div className="px-3 pb-3 flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!viewer) {
                        onRequireLogin?.();
                        return;
                      }
                      onToggleWishlist(vehicle.id);
                    }}
                    className={`flex-1 py-2 px-4 rounded-xl font-bold text-sm inline-flex items-center justify-center gap-1.5 ${
                      wishlist.includes(vehicle.id)
                        ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-[0_10px_20px_-10px_rgba(244,63,94,.55)]'
                        : 'msp-btn-ghost'
                    }`}
                    style={{ minHeight: 40 }}
                  >
                    <svg className="w-3.5 h-3.5" fill={wishlist.includes(vehicle.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    {wishlist.includes(vehicle.id) ? 'Saved' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!viewer) {
                        onRequireLogin?.();
                        return;
                      }
                      onToggleCompare(vehicle.id);
                    }}
                    disabled={!comparisonList.includes(vehicle.id) && comparisonList.length >= 4}
                    className={`flex-1 py-2 px-4 rounded-xl font-bold text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                      comparisonList.includes(vehicle.id)
                        ? 'msp-btn-primary'
                        : 'msp-btn-ghost'
                    }`}
                    style={{ minHeight: 40 }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Compare
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default MobileSellerProfilePage;
