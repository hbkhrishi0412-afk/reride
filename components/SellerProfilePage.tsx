import React, { useState, useMemo } from 'react';
import type { User, Vehicle } from '../types.js';
import VehicleCard from './VehicleCard.js';
import StarRating from './StarRating.js';
import BadgeDisplay from './BadgeDisplay.js';
import TrustBadgeDisplay from './TrustBadgeDisplay.js';
import VerifiedBadge, { isUserVerified } from './VerifiedBadge.js';
import { getSellerTrustChecklistSummary } from '../lib/sellerTrustChecklist.js';
import { followSeller, unfollowSeller, isFollowingSeller, getFollowersCount, getFollowingCount, getFollowersOfSeller, getFollowedSellers } from '../services/buyerEngagementService.js';

/* ============================================================
   Scoped premium styles for the Seller Profile page.
   All rules are prefixed with `.sp-` to avoid global bleed.
   ============================================================ */
const SP_STYLES = `
  .sp-root { --sp-ink:#0b1020; --sp-brand:#4f46e5; }

  /* ===== Back button ===== */
  .sp-back {
    display: inline-flex; align-items: center; gap: .5rem;
    padding: .55rem 1rem; border-radius: 14px;
    background: rgba(255,255,255,.85);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(15,23,42,.08);
    color: #0f172a; font-weight: 700; font-size: 14px;
    box-shadow: 0 10px 24px -14px rgba(15,23,42,.25), 0 1px 0 rgba(255,255,255,.9) inset;
    transition: transform .25s ease, box-shadow .25s ease, background .25s ease;
  }
  .sp-back:hover {
    transform: translateX(-2px);
    background: #ffffff;
    box-shadow: 0 18px 32px -16px rgba(15,23,42,.35);
  }
  .sp-back svg { transition: transform .25s ease; }
  .sp-back:hover svg { transform: translateX(-3px); }

  /* ===== Profile Card ===== */
  .sp-card {
    position: relative; isolation: isolate;
    background: #ffffff;
    border-radius: 24px;
    border: 1px solid rgba(15,23,42,.06);
    box-shadow: 0 30px 60px -30px rgba(15,23,42,.25), 0 1px 0 rgba(255,255,255,.9) inset;
    overflow: hidden;
  }

  /* Aurora cover banner */
  .sp-cover {
    position: relative; height: 120px;
    background:
      radial-gradient(700px 280px at 10% 0%, rgba(99,102,241,.75), transparent 60%),
      radial-gradient(600px 280px at 90% 100%, rgba(236,72,153,.6), transparent 60%),
      linear-gradient(120deg,#1e1b4b 0%,#312e81 50%,#4c1d95 100%);
    overflow: hidden;
  }
  .sp-cover::before {
    content:""; position:absolute; inset:-40%;
    background:
      conic-gradient(from 0deg at 50% 50%,
        rgba(99,102,241,.35), rgba(236,72,153,.30),
        rgba(34,211,238,.30), rgba(99,102,241,.35));
    filter: blur(50px); opacity:.55;
    animation: sp-spin 24s linear infinite;
  }
  .sp-cover::after {
    content:""; position:absolute; inset:0;
    background-image:
      linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px);
    background-size: 24px 24px;
    mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
    opacity: .35;
  }
  @keyframes sp-spin { to { transform: rotate(360deg); } }

  .sp-orb { position:absolute; border-radius:9999px; filter: blur(24px); mix-blend-mode: screen; pointer-events:none; }
  .sp-orb-a { width:130px; height:130px; left:-30px; top:-30px; background:#60a5fa; opacity:.55; animation: sp-float 10s ease-in-out infinite; }
  .sp-orb-b { width:160px; height:160px; right:-40px; top:-40px; background:#c084fc; opacity:.5; animation: sp-float 13s ease-in-out infinite reverse; }
  .sp-orb-c { width:100px; height:100px; left:40%; bottom:-40px; background:#22d3ee; opacity:.4; animation: sp-float 16s ease-in-out infinite; }
  @keyframes sp-float {
    0%,100% { transform: translate3d(0,0,0) scale(1); }
    50%     { transform: translate3d(12px,-8px,0) scale(1.08); }
  }

  .sp-sparkle {
    position: absolute; width: 3px; height: 3px; border-radius: 9999px;
    background: white;
    box-shadow: 0 0 10px 2px rgba(255,255,255,.85);
    animation: sp-twinkle 3.2s ease-in-out infinite;
  }
  @keyframes sp-twinkle {
    0%,100% { opacity: 0; transform: scale(.6); }
    50%     { opacity: 1; transform: scale(1.1); }
  }

  /* Avatar ring */
  .sp-avatar-wrap {
    position: relative;
    width: 120px; height: 120px; margin-top: -60px;
    border-radius: 9999px;
    padding: 4px;
    background: conic-gradient(from 0deg, #60a5fa, #a855f7, #ec4899, #f59e0b, #60a5fa);
    box-shadow: 0 20px 40px -14px rgba(79,70,229,.45);
    animation: sp-ring-spin 10s linear infinite;
  }
  @keyframes sp-ring-spin { to { transform: rotate(360deg); } }
  .sp-avatar-inner {
    position: relative; width: 100%; height: 100%;
    border-radius: 9999px;
    background: #fff;
    padding: 3px;
    /* counter-rotate to keep image upright */
    animation: sp-ring-spin 10s linear infinite reverse;
  }
  .sp-avatar-inner img {
    width: 100%; height: 100%;
    border-radius: 9999px; object-fit: cover;
    display: block;
  }
  .sp-avatar-verified {
    position: absolute; bottom: -2px; right: -2px;
    width: 30px; height: 30px; border-radius: 9999px;
    background: linear-gradient(135deg,#10b981,#059669);
    color: white; display: inline-flex; align-items: center; justify-content: center;
    border: 3px solid #ffffff;
    box-shadow: 0 10px 18px -6px rgba(16,185,129,.5);
    z-index: 2;
  }

  /* ===== Name + badges ===== */
  .sp-name {
    background: linear-gradient(90deg,#0f172a,#1e293b 60%,#4338ca);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    letter-spacing: -.01em;
  }

  /* ===== Stat pill row ===== */
  .sp-stats {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: .5rem;
  }
  .sp-stat {
    position: relative; overflow: hidden;
    background: linear-gradient(180deg,#ffffff,#f8fafc);
    border: 1px solid #eef2f7;
    border-radius: 14px;
    padding: .6rem .7rem;
    text-align: center;
    transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
  }
  .sp-stat:hover {
    transform: translateY(-1px);
    border-color: rgba(99,102,241,.3);
    box-shadow: 0 14px 26px -16px rgba(79,70,229,.35);
  }
  .sp-stat-clickable { cursor: pointer; }
  .sp-stat-label {
    font-size: 10.5px; font-weight: 800; letter-spacing: .06em;
    color: #64748b; text-transform: uppercase;
  }
  .sp-stat-value {
    font-size: 18px; font-weight: 900; color: #0f172a;
    margin-top: 2px;
    display: inline-flex; align-items: center; gap: .3rem;
  }
  .sp-stat-value .sp-star {
    color: #f59e0b;
  }

  /* ===== Meta chip (member since) ===== */
  .sp-meta-chip {
    display: inline-flex; align-items: center; gap: .4rem;
    padding: .35rem .75rem; border-radius: 9999px;
    background: linear-gradient(90deg, rgba(99,102,241,.08), rgba(236,72,153,.08));
    border: 1px solid rgba(99,102,241,.2);
    color: #4338ca; font-size: 11.5px; font-weight: 700;
  }

  /* ===== Verification progress card ===== */
  .sp-verif {
    background: linear-gradient(180deg,#fbfcff,#f5f7ff);
    border: 1px solid #eef2ff;
    border-radius: 16px;
    padding: .85rem;
  }
  .sp-verif-head {
    display: flex; align-items: center; gap: .65rem;
    margin-bottom: .75rem;
  }
  .sp-verif-ring {
    position: relative;
    width: 42px; height: 42px; border-radius: 9999px;
    background: conic-gradient(#10b981 var(--sp-pct,0%), #e2e8f0 0);
    display: inline-flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .sp-verif-ring::after {
    content:""; position:absolute; inset:4px; border-radius:9999px; background:#ffffff;
  }
  .sp-verif-ring-pct {
    position: relative; z-index: 1;
    font-size: 11px; font-weight: 900; color: #0f172a;
  }
  .sp-verif-title {
    font-size: 10.5px; font-weight: 800; letter-spacing: .08em;
    color: #475569; text-transform: uppercase;
  }
  .sp-verif-sub {
    font-size: 12px; color: #64748b; margin-top: 1px;
  }
  .sp-verif-item {
    display: flex; align-items: center; gap: .6rem;
    padding: .5rem .6rem;
    border-radius: 10px;
    background: #ffffff;
    border: 1px solid #eef2f7;
    transition: border-color .2s ease, transform .2s ease;
  }
  .sp-verif-item + .sp-verif-item { margin-top: .4rem; }
  .sp-verif-item.sp-ok {
    background: linear-gradient(90deg, rgba(209,250,229,.6), rgba(236,253,245,.6));
    border-color: rgba(16,185,129,.35);
  }
  .sp-verif-dot {
    flex-shrink: 0; width: 18px; height: 18px; border-radius: 9999px;
    display: inline-flex; align-items: center; justify-content: center;
    background: #e2e8f0; color: #94a3b8;
  }
  .sp-verif-item.sp-ok .sp-verif-dot {
    background: linear-gradient(135deg,#10b981,#059669); color: white;
    box-shadow: 0 6px 12px -6px rgba(16,185,129,.55);
  }
  .sp-verif-label {
    flex: 1; font-size: 12.5px; font-weight: 700; color: #334155;
  }
  .sp-verif-item.sp-ok .sp-verif-label { color: #065f46; }
  .sp-verif-state {
    font-size: 10.5px; font-weight: 800;
    color: #94a3b8;
  }
  .sp-verif-item.sp-ok .sp-verif-state { color: #10b981; }
  .sp-verif-platform {
    display: flex; align-items: flex-start; gap: .75rem;
    padding: .7rem .75rem;
    border-radius: 12px;
    background: linear-gradient(90deg, rgba(209,250,229,.55), rgba(236,253,245,.55));
    border: 1px solid rgba(16,185,129,.32);
  }
  .sp-verif-platform-ic {
    flex-shrink: 0; width: 40px; height: 40px; border-radius: 12px;
    display: inline-flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg,#10b981,#059669); color: white;
    box-shadow: 0 8px 18px -10px rgba(16,185,129,.6);
  }
  .sp-verif-platform .sp-verif-title { color: #065f46; }
  .sp-verif-platform .sp-verif-sub { color: #047857; font-weight: 600; font-size: 12px; line-height: 1.45; }

  /* ===== Bio card ===== */
  .sp-bio {
    position: relative;
    padding: .75rem .85rem .75rem 1.15rem;
    background: linear-gradient(180deg,#ffffff,#f8fafc);
    border: 1px solid #eef2f7;
    border-radius: 14px;
    font-size: 13px; line-height: 1.55; color: #475569;
  }
  .sp-bio::before {
    content:""; position: absolute; left: 0; top: 10%; bottom: 10%;
    width: 3px; border-radius: 0 3px 3px 0;
    background: linear-gradient(180deg,#4f46e5,#9333ea);
  }

  /* ===== Follow button ===== */
  .sp-follow-btn {
    position: relative; overflow: hidden;
    width: 100%;
    padding: .85rem 1rem; border-radius: 14px;
    font-weight: 800; font-size: 14px;
    display: inline-flex; align-items: center; justify-content: center; gap: .5rem;
    transition: transform .2s ease, box-shadow .25s ease;
  }
  .sp-follow-btn.sp-follow-go {
    color: white;
    background: linear-gradient(135deg,#4f46e5,#7c3aed 60%,#db2777);
    box-shadow: 0 20px 34px -14px rgba(79,70,229,.6), inset 0 1px 0 rgba(255,255,255,.35);
  }
  .sp-follow-btn.sp-follow-go::before {
    content:""; position: absolute; inset: 0;
    background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,.45) 50%, transparent 70%);
    transform: translateX(-120%); transition: transform .7s ease;
  }
  .sp-follow-btn.sp-follow-go:hover {
    transform: translateY(-1px);
    box-shadow: 0 28px 46px -16px rgba(79,70,229,.75);
  }
  .sp-follow-btn.sp-follow-go:hover::before { transform: translateX(120%); }
  .sp-follow-btn.sp-following {
    color: #334155;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
  }
  .sp-follow-btn.sp-following:hover {
    background: #e2e8f0; color: #0f172a;
  }

  /* ===== Listings header ===== */
  .sp-eyebrow {
    display: inline-flex; align-items: center; gap: .4rem;
    padding: .2rem .6rem; border-radius: 9999px;
    background: linear-gradient(90deg, rgba(99,102,241,.12), rgba(236,72,153,.12));
    border: 1px solid rgba(99,102,241,.2);
    color: #4338ca;
    font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
  }
  .sp-listings-title {
    background: linear-gradient(90deg,#0f172a,#1e293b 60%,#4338ca);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    letter-spacing: -.02em;
  }
  .sp-count-chip {
    display: inline-flex; align-items: center; gap: .35rem;
    padding: .3rem .7rem; border-radius: 9999px;
    background: linear-gradient(135deg,#4f46e5,#9333ea);
    color: white; font-size: 11.5px; font-weight: 800;
    box-shadow: 0 10px 20px -10px rgba(79,70,229,.55);
  }

  .sp-search {
    position: relative;
    display: flex; align-items: center;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    transition: box-shadow .25s ease, border-color .25s ease;
    box-shadow: 0 1px 0 rgba(255,255,255,.8) inset, 0 1px 2px rgba(15,23,42,.04);
  }
  .sp-search:focus-within {
    border-color: #6366f1;
    box-shadow: 0 0 0 4px rgba(99,102,241,.15), 0 16px 30px -16px rgba(79,70,229,.4);
  }
  .sp-search input {
    flex: 1; border: 0; background: transparent; outline: none;
    padding: .85rem 1rem; font-size: 14px; color: #0f172a;
    min-width: 0;
  }
  .sp-search input::placeholder { color: #94a3b8; }
  .sp-search-ic { margin-left: 1rem; color: #94a3b8; flex-shrink: 0; }
  .sp-search-clear {
    margin-right: .5rem;
    width: 26px; height: 26px; border-radius: 9999px;
    background: #f1f5f9; color: #64748b;
    display: inline-flex; align-items: center; justify-content: center;
    transition: background .2s ease, color .2s ease;
  }
  .sp-search-clear:hover { background: #e2e8f0; color: #0f172a; }

  /* ===== Empty state ===== */
  .sp-empty {
    background: linear-gradient(180deg,#ffffff,#f8fafc);
    border: 1px solid #eef2f7;
    border-radius: 22px;
    padding: 3rem 2rem;
    text-align: center;
    box-shadow: 0 30px 50px -30px rgba(15,23,42,.2);
  }
  .sp-empty-ic {
    width: 68px; height: 68px; border-radius: 20px;
    display: inline-flex; align-items: center; justify-content: center;
    margin: 0 auto 1rem;
    background: linear-gradient(135deg,#eef2ff,#e0e7ff);
    color: #4f46e5;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 10px 20px -10px rgba(79,70,229,.25);
  }

  /* ===== Stagger ===== */
  .sp-stagger > * {
    opacity: 0; transform: translateY(8px);
    animation: sp-rise .5s both cubic-bezier(.2,.8,.2,1);
  }
  .sp-stagger > *:nth-child(1) { animation-delay: .04s; }
  .sp-stagger > *:nth-child(2) { animation-delay: .08s; }
  .sp-stagger > *:nth-child(3) { animation-delay: .12s; }
  .sp-stagger > *:nth-child(4) { animation-delay: .16s; }
  .sp-stagger > *:nth-child(5) { animation-delay: .20s; }
  .sp-stagger > *:nth-child(6) { animation-delay: .24s; }
  .sp-stagger > *:nth-child(n+7) { animation-delay: .28s; }
  @keyframes sp-rise { to { opacity: 1; transform: translateY(0); } }

  /* ===== Modals ===== */
  .sp-modal-backdrop {
    position: fixed; inset: 0; z-index: 50;
    background: radial-gradient(circle at 30% 20%, rgba(99,102,241,.35), transparent 60%),
                radial-gradient(circle at 70% 80%, rgba(236,72,153,.3), transparent 60%),
                rgba(15,23,42,.55);
    backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center; padding: 1rem;
    animation: sp-fade-in .25s ease both;
  }
  @keyframes sp-fade-in { from { opacity: 0; } to { opacity: 1; } }
  .sp-modal {
    width: 100%; max-width: 440px;
    background: #ffffff;
    border-radius: 22px;
    border: 1px solid rgba(15,23,42,.06);
    box-shadow: 0 40px 80px -20px rgba(15,23,42,.4);
    overflow: hidden;
    animation: sp-up .32s cubic-bezier(.2,.8,.2,1) both;
  }
  @keyframes sp-up { from { opacity: 0; transform: translateY(14px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .sp-modal-head {
    position: relative; overflow: hidden;
    background: linear-gradient(120deg,#1e1b4b,#4c1d95 60%,#831843);
    color: white; padding: 1.1rem 1.2rem;
  }
  .sp-modal-head::before {
    content:""; position:absolute; inset:-30%;
    background: conic-gradient(from 0deg, rgba(99,102,241,.4), rgba(236,72,153,.3), rgba(34,211,238,.4), rgba(99,102,241,.4));
    filter: blur(40px); opacity:.45;
    animation: sp-spin 22s linear infinite;
  }
  .sp-modal-close {
    width: 32px; height: 32px; border-radius: 9999px;
    background: rgba(255,255,255,.15);
    border: 1px solid rgba(255,255,255,.25);
    color: white;
    display: inline-flex; align-items: center; justify-content: center;
    transition: background .2s ease;
  }
  .sp-modal-close:hover { background: rgba(255,255,255,.28); }

  @media (prefers-reduced-motion: reduce) {
    .sp-cover::before, .sp-orb, .sp-sparkle,
    .sp-avatar-wrap, .sp-avatar-inner,
    .sp-stagger > *, .sp-modal-head::before,
    .sp-follow-btn.sp-follow-go::before { animation: none !important; }
  }
`;

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

const SellerProfilePage: React.FC<SellerProfilePageProps> = ({ seller, vehicles, onSelectVehicle, comparisonList, onToggleCompare, wishlist, onToggleWishlist, onBack, onViewSellerProfile, currentUser, onRequireLogin }) => {
    // 🔴 GUARD CLAUSE: Prevent crash when seller data hasn't loaded yet
    if (!seller) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-reride-orange"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-300">Loading Seller Profile...</span>
            </div>
        );
    }

    const [searchQuery, setSearchQuery] = useState('');
    // NEW: Follow seller feature
    // Restore logged-in user from storage (used to gate owner-only views)
    const storedUserJson = localStorage.getItem('reRideCurrentUser');
    const storedUser: User | null = storedUserJson ? JSON.parse(storedUserJson) : null;
    const viewer = currentUser ?? storedUser;
    const currentUserId = viewer?.email || localStorage.getItem('currentUserEmail') || 'guest';
    const [isFollowing, setIsFollowing] = useState(() => isFollowingSeller(currentUserId as string, seller.email));

    // Derived engagement counts
    const followersCount = useMemo(() => getFollowersCount(seller.email), [seller.email, isFollowing]);
    // IMPORTANT: Show how many accounts THIS seller follows, not the viewer
    const followingCount = useMemo(() => getFollowingCount(seller.email), [seller.email, isFollowing]);

    // Owner-only visibility (seller viewing their own page)
    const isOwnerSeller = viewer?.role === 'seller' && viewer.email === seller.email;

    // Owner modals state
    const [showFollowers, setShowFollowers] = useState(false);
    const [showFollowing, setShowFollowing] = useState(false);

    // Lists for owner view
    const followersList = useMemo(() => getFollowersOfSeller(seller.email), [seller.email, isFollowing]);
    const followingList = useMemo(() => getFollowedSellers(seller.email), [seller.email, isFollowing]);
    
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

    const guardWishlist = (id: number) => {
        if (!viewer) {
            onRequireLogin?.();
            return;
        }
        onToggleWishlist(id);
    };

    const guardCompare = (id: number) => {
        if (!viewer) {
            onRequireLogin?.();
            return;
        }
        onToggleCompare(id);
    };

    const filteredVehicles = useMemo(() => {
        if (!searchQuery.trim()) {
            return vehicles;
        }
        const lowercasedQuery = searchQuery.toLowerCase();
        return vehicles.filter(vehicle =>
            vehicle.make.toLowerCase().includes(lowercasedQuery) ||
            vehicle.model.toLowerCase().includes(lowercasedQuery) ||
            vehicle.description.toLowerCase().includes(lowercasedQuery) ||
            (vehicle.variant && vehicle.variant.toLowerCase().includes(lowercasedQuery))
        );
    }, [vehicles, searchQuery]);

    const { items: checklistItems, verifiedCount, total: checklistTotal, pct: verificationPct, isPlatformVerifiedOnly } =
        getSellerTrustChecklistSummary(seller);
    const showVerifiedBadgeOnProfile = isUserVerified(seller);
    const verificationItems = checklistItems.map((item) => ({
        ...item,
        icon:
            item.key === 'phone' ? (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
            ) : item.key === 'email' ? (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
            ) : (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                        clipRule="evenodd"
                    />
                </svg>
            ),
    }));

    const memberSinceLabel = (() => {
        const dateStr = seller.createdAt || seller.joinedDate;
        if (dateStr) {
            try {
                const date = new Date(dateStr);
                if (!isNaN(date.getTime())) {
                    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                }
            } catch (e) {
                /* fallthrough */
            }
        }
        return 'Recently';
    })();

    return (
        <div className="sp-root animate-fade-in">
            <style>{SP_STYLES}</style>

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-7xl">
                {/* Premium Back Button */}
                <button onClick={onBack} className="sp-back mb-5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Back</span>
                </button>

                {/* Two Column Layout: Seller Profile on Left, Listings on Right */}
                <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 lg:gap-8">
                    {/* ====== Left: Seller Profile Card (sticky) ====== */}
                    <aside className="lg:sticky lg:top-6 lg:h-fit lg:self-start">
                        <section className="sp-card">
                            {/* Aurora cover */}
                            <div className="sp-cover">
                                <span className="sp-orb sp-orb-a" />
                                <span className="sp-orb sp-orb-b" />
                                <span className="sp-orb sp-orb-c" />
                                <span className="sp-sparkle" style={{ top: '22%', left: '18%', animationDelay: '0s' }} />
                                <span className="sp-sparkle" style={{ top: '55%', left: '70%', animationDelay: '.9s' }} />
                                <span className="sp-sparkle" style={{ top: '35%', left: '52%', animationDelay: '1.8s' }} />
                            </div>

                            {/* Card body */}
                            <div className="relative px-5 pb-5 flex flex-col items-center text-center">
                                {/* Avatar */}
                                <div className="sp-avatar-wrap">
                                    <div className="sp-avatar-inner">
                                        <img
                                            src={seller.logoUrl || `https://i.pravatar.cc/150?u=${seller.email}`}
                                            alt={`${seller.dealershipName || seller.name} logo`}
                                            loading="lazy"
                                            decoding="async"
                                        />
                                    </div>
                                    {showVerifiedBadgeOnProfile && (
                                        <span className="sp-avatar-verified" aria-label="Verified">
                                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </span>
                                    )}
                                </div>

                                {/* Name */}
                                <h1 className="sp-name mt-3 text-xl md:text-2xl font-black inline-flex items-center gap-2 flex-wrap justify-center">
                                    <span>{seller.dealershipName || seller.name}</span>
                                    <VerifiedBadge show={showVerifiedBadgeOnProfile} size="sm" />
                                </h1>

                                {/* Member since chip */}
                                <div className="mt-2">
                                    <span className="sp-meta-chip">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        Member since {memberSinceLabel}
                                    </span>
                                </div>

                                {/* Badges row */}
                                {((seller.badges && seller.badges.length > 0) || true) && (
                                    <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                                        <BadgeDisplay badges={seller.badges || []} />
                                        <TrustBadgeDisplay user={seller} showDetails={false} />
                                    </div>
                                )}

                                {/* Stats row */}
                                <div className="sp-stats mt-4 w-full">
                                    <div className="sp-stat">
                                        <div className="sp-stat-label">Rating</div>
                                        <div className="sp-stat-value">
                                            <svg className="sp-star w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.16c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.363 1.118l1.286 3.957c.3.921-.755 1.688-1.54 1.118l-3.366-2.446a1 1 0 00-1.176 0l-3.367 2.446c-.784.57-1.838-.197-1.539-1.118l1.286-3.957a1 1 0 00-.363-1.118L2.05 9.384c-.783-.57-.38-1.81.588-1.81h4.16a1 1 0 00.95-.69l1.286-3.957z" />
                                            </svg>
                                            {seller.averageRating ? seller.averageRating.toFixed(1) : '—'}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                            {seller.ratingCount ? `${seller.ratingCount} rating${seller.ratingCount === 1 ? '' : 's'}` : 'No ratings yet'}
                                        </div>
                                    </div>

                                    <div
                                        className={`sp-stat ${isOwnerSeller ? 'sp-stat-clickable' : ''}`}
                                        onClick={isOwnerSeller ? () => setShowFollowers(true) : undefined}
                                        role={isOwnerSeller ? 'button' : undefined}
                                        tabIndex={isOwnerSeller ? 0 : undefined}
                                    >
                                        <div className="sp-stat-label">Followers</div>
                                        <div className="sp-stat-value">{followersCount}</div>
                                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                            {isOwnerSeller ? 'Tap to view' : 'People following'}
                                        </div>
                                    </div>

                                    <div
                                        className={`sp-stat ${isOwnerSeller ? 'sp-stat-clickable' : ''}`}
                                        onClick={isOwnerSeller ? () => setShowFollowing(true) : undefined}
                                        role={isOwnerSeller ? 'button' : undefined}
                                        tabIndex={isOwnerSeller ? 0 : undefined}
                                    >
                                        <div className="sp-stat-label">Following</div>
                                        <div className="sp-stat-value">{followingCount}</div>
                                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                            {isOwnerSeller ? 'Tap to view' : 'Seller follows'}
                                        </div>
                                    </div>

                                    <div className="sp-stat">
                                        <div className="sp-stat-label">Listings</div>
                                        <div className="sp-stat-value">{vehicles.length}</div>
                                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                            Total vehicles
                                        </div>
                                    </div>
                                </div>

                                {/* Trust checklist (phone / email / ID) — avoids "Verified" + 0% when only legacy isVerified */}
                                <div className="sp-verif mt-4 w-full text-left">
                                    {isPlatformVerifiedOnly ? (
                                        <div className="sp-verif-platform">
                                            <span className="sp-verif-platform-ic" aria-hidden>
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                        clipRule="evenodd"
                                                    />
                                                </svg>
                                            </span>
                                            <div className="min-w-0">
                                                <div className="sp-verif-title">Verified on Reride</div>
                                                <p className="sp-verif-sub mt-0.5">
                                                    This seller’s account was verified by our team.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="sp-verif-head">
                                                <div
                                                    className="sp-verif-ring"
                                                    style={{ ['--sp-pct' as any]: `${verificationPct}%` }}
                                                    aria-hidden
                                                >
                                                    <span className="sp-verif-ring-pct">{verificationPct}%</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="sp-verif-title">Trust checklist</div>
                                                    <div className="sp-verif-sub">
                                                        {verifiedCount === checklistTotal
                                                            ? 'All checks passed'
                                                            : `${verifiedCount} of ${checklistTotal} checks passed`}
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                {verificationItems.map((item) => (
                                                    <div
                                                        key={item.key}
                                                        className={`sp-verif-item ${item.verified ? 'sp-ok' : ''}`}
                                                    >
                                                        <span className="sp-verif-dot">
                                                            {item.verified ? (
                                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path
                                                                        fillRule="evenodd"
                                                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                                        clipRule="evenodd"
                                                                    />
                                                                </svg>
                                                            ) : (
                                                                item.icon
                                                            )}
                                                        </span>
                                                        <span className="sp-verif-label">{item.label}</span>
                                                        <span className="sp-verif-state">
                                                            {item.verified
                                                                ? 'Verified'
                                                                : isOwnerSeller
                                                                  ? 'Finish in profile'
                                                                  : 'Not verified'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Bio */}
                                {seller.bio && (
                                    <div className="sp-bio mt-4 w-full text-left">
                                        <span className="block text-[10px] font-black uppercase tracking-wider text-indigo-500 mb-1">About</span>
                                        {seller.bio}
                                    </div>
                                )}

                                {/* Follow button */}
                                {!isOwnerSeller && (
                                    <div className="mt-4 w-full">
                                        {viewer ? (
                                            <button
                                                type="button"
                                                onClick={handleFollowToggle}
                                                className={`sp-follow-btn ${isFollowing ? 'sp-following' : 'sp-follow-go'}`}
                                            >
                                                {isFollowing ? (
                                                    <>
                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                        <span>Following</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                                        </svg>
                                                        <span>Follow Seller</span>
                                                    </>
                                                )}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => onRequireLogin?.()}
                                                className="sp-follow-btn sp-follow-go"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                                </svg>
                                                <span>Log in to follow</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>
                    </aside>

                    {/* ====== Right: Listings ====== */}
                    <div className="min-w-0">
                        {/* Premium Listings Section Header */}
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5">
                            <div>
                                <span className="sp-eyebrow">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3 3h18v4H3V3zm0 7h18v4H3v-4zm0 7h18v4H3v-4z" />
                                    </svg>
                                    Listings
                                </span>
                                <h2 className="sp-listings-title mt-2 text-2xl md:text-3xl font-black flex items-center gap-3 flex-wrap">
                                    Listings from this Seller
                                    <span className="sp-count-chip">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M4 16a2 2 0 104 0 2 2 0 00-4 0zm12 0a2 2 0 104 0 2 2 0 00-4 0zM3 7l1-3h14l2 6v5h-2a3 3 0 00-6 0H9a3 3 0 00-6 0H3V7z" />
                                        </svg>
                                        {filteredVehicles.length}
                                    </span>
                                </h2>
                                <p className="text-slate-500 text-[13px] mt-1">
                                    {filteredVehicles.length === 0
                                        ? 'No vehicles match right now'
                                        : `${filteredVehicles.length} ${filteredVehicles.length === 1 ? 'vehicle' : 'vehicles'} available from ${seller.dealershipName || seller.name}`}
                                </p>
                            </div>

                            <div className="w-full md:w-96">
                                <div className="sp-search">
                                    <svg className="sp-search-ic w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
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
                                            className="sp-search-clear"
                                        >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Grid */}
                        {filteredVehicles.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 sp-stagger">
                                {filteredVehicles.map(vehicle => (
                                    <VehicleCard
                                        key={vehicle.id}
                                        vehicle={vehicle}
                                        onSelect={onSelectVehicle}
                                        onToggleCompare={guardCompare}
                                        isSelectedForCompare={comparisonList.includes(vehicle.id)}
                                        onToggleWishlist={guardWishlist}
                                        isInWishlist={wishlist.includes(vehicle.id)}
                                        isCompareDisabled={!comparisonList.includes(vehicle.id) && comparisonList.length >= 4}
                                        onViewSellerProfile={onViewSellerProfile}
                                    />
                                ))}
                            </div>
                        ) : vehicles.length > 0 ? (
                            <div className="sp-empty">
                                <div className="sp-empty-ic">
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">No listings match your search</h3>
                                <p className="text-slate-500 text-sm max-w-xs mx-auto">Try a different keyword, or clear the search to browse all listings.</p>
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="mt-4 sp-follow-btn sp-follow-go inline-flex !w-auto !px-5"
                                >
                                    Clear search
                                </button>
                            </div>
                        ) : (
                            <div className="sp-empty">
                                <div className="sp-empty-ic">
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">No active listings</h3>
                                <p className="text-slate-500 text-sm max-w-xs mx-auto">This seller currently has no vehicles for sale. Follow to get notified when they list.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Owner-only Modals */}
            {isOwnerSeller && showFollowers && (
                <div className="sp-modal-backdrop" onClick={() => setShowFollowers(false)}>
                    <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="sp-modal-head relative flex items-center justify-between">
                            <div className="relative z-10">
                                <div className="text-[10.5px] font-black uppercase tracking-widest text-white/70">Community</div>
                                <h3 className="text-xl font-black text-white">Your Followers</h3>
                                <p className="text-xs text-white/80 mt-0.5">{followersList.length} {followersList.length === 1 ? 'follower' : 'followers'}</p>
                            </div>
                            <button onClick={() => setShowFollowers(false)} className="sp-modal-close relative z-10" aria-label="Close">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <ul className="max-h-80 overflow-auto divide-y divide-slate-100">
                            {followersList.length === 0 ? (
                                <li className="text-center py-10 px-6 text-slate-500">
                                    <div className="sp-empty-ic mb-3">
                                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                    </div>
                                    <p className="font-semibold text-slate-800">No followers yet</p>
                                    <p className="text-xs text-slate-500 mt-1">People who follow you will appear here</p>
                                </li>
                            ) : (
                                followersList.map(f => (
                                    <li key={f.id} className="flex items-center justify-between gap-3 p-3 hover:bg-slate-50 transition-colors">
                                        <span className="truncate text-slate-800 font-medium text-sm">{f.userId}</span>
                                        <button
                                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:shadow-lg hover:shadow-indigo-500/30 transition-all whitespace-nowrap"
                                            onClick={() => onViewSellerProfile(f.userId)}
                                        >
                                            View Profile
                                        </button>
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                </div>
            )}

            {isOwnerSeller && showFollowing && (
                <div className="sp-modal-backdrop" onClick={() => setShowFollowing(false)}>
                    <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="sp-modal-head relative flex items-center justify-between">
                            <div className="relative z-10">
                                <div className="text-[10.5px] font-black uppercase tracking-widest text-white/70">Your network</div>
                                <h3 className="text-xl font-black text-white">You're Following</h3>
                                <p className="text-xs text-white/80 mt-0.5">{followingList.length} {followingList.length === 1 ? 'seller' : 'sellers'}</p>
                            </div>
                            <button onClick={() => setShowFollowing(false)} className="sp-modal-close relative z-10" aria-label="Close">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <ul className="max-h-80 overflow-auto divide-y divide-slate-100">
                            {followingList.length === 0 ? (
                                <li className="text-center py-10 px-6 text-slate-500">
                                    <div className="sp-empty-ic mb-3">
                                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                    </div>
                                    <p className="font-semibold text-slate-800">Not following anyone yet</p>
                                    <p className="text-xs text-slate-500 mt-1">Sellers you follow will appear here</p>
                                </li>
                            ) : (
                                followingList.map(f => (
                                    <li key={f.id} className="flex items-center justify-between gap-3 p-3 hover:bg-slate-50 transition-colors">
                                        <span className="truncate text-slate-800 font-medium text-sm">{f.sellerEmail}</span>
                                        <button
                                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:shadow-lg hover:shadow-indigo-500/30 transition-all whitespace-nowrap"
                                            onClick={() => onViewSellerProfile(f.sellerEmail)}
                                        >
                                            View Profile
                                        </button>
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SellerProfilePage;