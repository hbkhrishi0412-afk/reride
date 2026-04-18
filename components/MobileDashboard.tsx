import React, { useState, memo, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { User, Vehicle, Conversation, Notification } from '../types';
import { View as ViewEnum } from '../types';
import { planService } from '../services/planService';
import AiAssistant from './AiAssistant';
import BulkUploadModal from './BulkUploadModal';
import PricingGuidance from './PricingGuidance';
import BoostListingModal from './BoostListingModal';
import ListingLifecycleIndicator from './ListingLifecycleIndicator';
import PaymentStatusCard from './PaymentStatusCard';
import { saveQrCodePngFromUrl } from '../utils/saveQrCodeImage';
import { getPublicWebOriginForShareLinks } from '../utils/apiConfig';
import { filterMessagesForViewer, getLastVisibleMessageForViewer } from '../utils/conversationView';
import { formatRelativeTime } from '../utils/date';
import { getThreadLastMessagePreview } from '../utils/messagePreview';

// ---------- Premium inline SVG icon set (kept local to avoid new deps) ----------
type IconProps = { className?: string; size?: number; stroke?: number };
const Icon = ({
  size = 20,
  stroke = 1.75,
  className,
  children,
}: IconProps & { children: React.ReactNode }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);
const IconBell = (p: IconProps) => (<Icon {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></Icon>);
const IconSettings = (p: IconProps) => (<Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></Icon>);
const IconPlus = (p: IconProps) => (<Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>);
const IconChevronRight = (p: IconProps) => (<Icon {...p}><path d="M9 18l6-6-6-6" /></Icon>);
const IconArrowUpRight = (p: IconProps) => (<Icon {...p}><path d="M7 17L17 7M9 7h8v8" /></Icon>);
const IconCar = (p: IconProps) => (<Icon {...p}><path d="M5 17h14M6 17v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2M15 17v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2" /><path d="M3 13l2-5a2 2 0 0 1 1.85-1.25h10.3A2 2 0 0 1 19 8l2 5v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3z" /><circle cx="7.5" cy="14.5" r=".75" fill="currentColor" /><circle cx="16.5" cy="14.5" r=".75" fill="currentColor" /></Icon>);
const IconEye = (p: IconProps) => (<Icon {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></Icon>);
const IconChat = (p: IconProps) => (<Icon {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Icon>);
const IconCheck = (p: IconProps) => (<Icon {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></Icon>);
const IconSparkle = (p: IconProps) => (<Icon {...p}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></Icon>);
const IconCrown = (p: IconProps) => (<Icon {...p}><path d="M3 18h18M3 7l4 4 5-7 5 7 4-4-2 11H5z" /></Icon>);
const IconUpload = (p: IconProps) => (<Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></Icon>);
const IconList = (p: IconProps) => (<Icon {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Icon>);
const IconRocket = (p: IconProps) => (<Icon {...p}><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></Icon>);
const IconStar = (p: IconProps) => (<Icon {...p}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01z" /></Icon>);
const IconEdit = (p: IconProps) => (<Icon {...p}><path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" /></Icon>);
const IconTrash = (p: IconProps) => (<Icon {...p}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></Icon>);
const IconShield = (p: IconProps) => (<Icon {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Icon>);
const IconChart = (p: IconProps) => (<Icon {...p}><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></Icon>);

interface MobileDashboardProps {
  currentUser: User;
  userVehicles: Vehicle[];
  conversations: Conversation[];
  allVehicles?: Vehicle[]; // For pricing guidance and analytics
  reportedVehicles?: Vehicle[]; // For reports view
  onNavigate: (view: ViewEnum) => void;
  onEditVehicle: (vehicle: Vehicle) => void;
  onDeleteVehicle: (vehicleId: number) => void;
  onMarkAsSold: (vehicleId: number) => void;
  onMarkAsUnsold?: (vehicleId: number) => void;
  onFeatureListing: (vehicleId: number) => void;
  onSendMessage: (conversationId: string, message: string) => void;
  onMarkConversationAsRead: (conversationId: string) => void;
  onOfferResponse: (conversationId: string, messageId: string, response: string, counterPrice?: number) => void;
  typingStatus: { conversationId: string; userRole: 'customer' | 'seller' } | null;
  onUserTyping: (conversationId: string, userRole: 'customer' | 'seller') => void;
  onMarkMessagesAsRead: (conversationId: string, readerRole: 'customer' | 'seller') => void;
  onFlagContent: (type: 'vehicle' | 'conversation', id: string, reason: string) => void;
  onLogout?: () => void;
  // Add vehicle form handlers
  onAddVehicle?: (vehicleData: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>, isFeaturing?: boolean) => void;
  onAddMultipleVehicles?: (vehicles: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>[]) => void;
  onUpdateVehicle?: (vehicleData: Vehicle) => void;
  vehicleData?: any; // Vehicle data for form
  // Add prop for viewing vehicle details
  onViewVehicle?: (vehicle: Vehicle) => void;
  // Profile editing
  onUpdateProfile?: (profileData: Partial<User>) => Promise<void>;
  onUpdateSellerProfile?: (details: { dealershipName: string; bio: string; logoUrl: string; partnerBanks?: string[] }) => void;
  // Notifications
  notifications?: Notification[];
  onNotificationClick?: (notification: Notification) => void;
  onMarkNotificationsAsRead?: (ids: number[]) => void;
  // Toast notifications
  addToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  // Boost listing
  onBoostListing?: (vehicleId: number, packageId: string) => Promise<void>;
  // Request certification
  onRequestCertification?: (vehicleId: number) => void;
  /** Opens this buyer thread so the seller can reply (inbox + composer). */
  onSellerOpenChat?: (conversation: Conversation) => void;
  onSetConversationReadState?: (conversationId: string, isRead: boolean) => void;
  onMarkAllAsReadBySeller?: () => void;
}

type DashboardTab =
  | 'overview'
  | 'listings'
  | 'messages'
  | 'analytics'
  | 'salesHistory'
  | 'reports'
  | 'settings'
  | 'profile'
  | 'addVehicle'
  | 'editVehicle'
  | 'notifications';

const MobileDashboard: React.FC<MobileDashboardProps> = memo(({
  currentUser,
  userVehicles,
  conversations,
  allVehicles = [],
  reportedVehicles = [],
  onNavigate,
  onEditVehicle: _onEditVehicle,
  onDeleteVehicle,
  onMarkAsSold: _onMarkAsSold,
  onMarkAsUnsold,
  onFeatureListing: _onFeatureListing,
  onSendMessage: _onSendMessage,
  onMarkConversationAsRead: _onMarkConversationAsRead,
  onOfferResponse: _onOfferResponse,
  typingStatus: _typingStatus,
  onUserTyping: _onUserTyping,
  onMarkMessagesAsRead: _onMarkMessagesAsRead,
  onFlagContent: _onFlagContent,
  onLogout,
  onAddVehicle,
  onAddMultipleVehicles,
  onUpdateVehicle,
  vehicleData: _vehicleData,
  onViewVehicle,
  onUpdateProfile,
  onUpdateSellerProfile,
  notifications = [],
  onNotificationClick,
  onMarkNotificationsAsRead,
  addToast,
  onBoostListing,
  onRequestCertification,
  onSellerOpenChat,
  onSetConversationReadState,
  onMarkAllAsReadBySeller,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [messagesHubFilter, setMessagesHubFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [editFormData, setEditFormData] = useState<Vehicle | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<any>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [boostVehicle, setBoostVehicle] = useState<Vehicle | null>(null);
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [isSavingBanks, setIsSavingBanks] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Add vehicle form state
  const initialAddFormData: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'> = {
    make: '',
    model: '',
    variant: '',
    year: new Date().getFullYear(),
    price: 0,
    mileage: 0,
    description: '',
    engine: '',
    transmission: 'Automatic',
    fuelType: 'Petrol',
    fuelEfficiency: '',
    color: '',
    features: [],
    images: [],
    documents: [],
    sellerEmail: currentUser.email,
    category: 'four_wheeler' as any,
    status: 'published',
    isFeatured: false,
    registrationYear: new Date().getFullYear(),
    insuranceValidity: '',
    insuranceType: 'Comprehensive',
    rto: '',
    city: '',
    state: '',
    location: '',
    noOfOwners: 1,
    displacement: '',
    groundClearance: '',
    bootSpace: '',
    qualityReport: { fixesDone: [] },
    certifiedInspection: null,
    certificationStatus: 'none',
  };
  
  const [addFormData, setAddFormData] = useState(initialAddFormData);
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  
  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    name: currentUser.name,
    email: currentUser.email,
    mobile: currentUser.mobile || '',
    dealershipName: currentUser?.dealershipName || '',
    bio: currentUser?.bio || '',
    location: currentUser?.location || '',
    address: currentUser?.address || '',
    pincode: currentUser?.pincode || '',
  });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Update edit form data when editingVehicle changes
  React.useEffect(() => {
    if (editingVehicle) {
      setEditFormData(editingVehicle);
    } else {
      setEditFormData(null);
    }
    setEditErrors({});
  }, [editingVehicle]);
  
  // Update profile form data when currentUser changes
  React.useEffect(() => {
    setProfileFormData({
      name: currentUser.name,
      email: currentUser.email,
      mobile: currentUser.mobile || '',
      dealershipName: currentUser?.dealershipName || '',
      bio: currentUser?.bio || '',
      location: currentUser?.location || '',
      address: currentUser?.address || '',
      pincode: currentUser?.pincode || '',
    });
  }, [currentUser]);
  
  // Reset add form when switching away from addVehicle tab
  React.useEffect(() => {
    if (activeTab !== 'addVehicle') {
      setAddFormData({
        ...initialAddFormData,
        sellerEmail: currentUser.email, // Ensure sellerEmail is current
      });
      setAddErrors({});
    } else {
      // When switching to addVehicle tab, ensure sellerEmail is set
      setAddFormData(prev => ({
        ...prev,
        sellerEmail: currentUser.email,
      }));
    }
  }, [activeTab, currentUser.email]);

  // Check if user is a seller
  const isSeller = currentUser?.role === 'seller';
  const isAdmin = currentUser.role === 'admin';

  // Load plan details
  useEffect(() => {
    if (isSeller) {
      const loadPlan = async () => {
        try {
          const planDetails = await planService.getPlanDetails(currentUser.subscriptionPlan || 'free');
          setPlan(planDetails);
        } catch (error) {
          console.error('Failed to load plan details:', error);
          setPlan({ name: t('sellerDashboard.freePlanName'), listingLimit: 1, price: 0 });
        } finally {
          setPlanLoading(false);
        }
      };
      loadPlan();
    }
  }, [isSeller, currentUser.subscriptionPlan, t]);

  // Initialize bank partners
  useEffect(() => {
    const banks = currentUser?.partnerBanks;
    if (isSeller && banks != null && Array.isArray(banks)) {
      setSelectedBanks([...banks]);
    }
  }, [isSeller, currentUser]);

  // Calculate stats
  const safeUserVehicles = userVehicles || [];
  const safeConversations = conversations || [];
  const safeAllVehicles = allVehicles || [];
  const safeReportedVehicles = reportedVehicles || [];
  
  const totalListings = safeUserVehicles.length;
  const activeListings = safeUserVehicles.filter(v => v && v.status === 'published').length;
  const soldListings = safeUserVehicles.filter(v => v && v.status === 'sold').length;
  const totalViews = safeUserVehicles.reduce((sum, v) => sum + (v?.views || 0), 0);
  const totalInquiries = safeConversations.length;
  const reportedCount = safeReportedVehicles.length;
  const featuredListingsCount = safeUserVehicles.filter(v => v && v.isFeatured).length;
  const unreadSellerThreads = useMemo(
    () => safeConversations.filter((c) => c && !c.isReadBySeller).length,
    [safeConversations]
  );

  const hubConversationList = useMemo(() => {
    if (!isSeller) return [];
    const sorted = [...safeConversations].sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    );
    if (messagesHubFilter === 'unread') return sorted.filter((c) => c && !c.isReadBySeller);
    if (messagesHubFilter === 'read') return sorted.filter((c) => c && c.isReadBySeller);
    return sorted;
  }, [isSeller, safeConversations, messagesHubFilter]);

  const tabs = useMemo(() => {
    const row: { id: DashboardTab; label: string; icon: string; count: number | null }[] = [
      { id: 'overview', label: t('sellerDashboard.mobile.tab.overview'), icon: '📊', count: null },
      { id: 'listings', label: t('sellerDashboard.mobile.tab.listings'), icon: '🚗', count: totalListings },
    ];
    if (isSeller) {
      row.push({
        id: 'messages',
        label: t('sellerDashboard.mobile.tab.messages'),
        icon: '💬',
        count: unreadSellerThreads > 0 ? unreadSellerThreads : null,
      });
    }
    row.push(
      { id: 'analytics', label: t('sellerDashboard.mobile.tab.analytics'), icon: '📈', count: null },
      { id: 'salesHistory', label: t('sellerDashboard.mobile.tab.sales'), icon: '💰', count: soldListings },
      { id: 'reports', label: t('sellerDashboard.mobile.tab.reports'), icon: '🚩', count: reportedCount },
      { id: 'settings', label: t('sellerDashboard.mobile.tab.settings'), icon: '⚙️', count: null },
      { id: 'profile', label: t('sellerDashboard.mobile.tab.profile'), icon: '👤', count: null }
    );
    return row;
  }, [t, totalListings, soldListings, reportedCount, isSeller, unreadSellerThreads]);

  const renderOverview = () => {
    const conversionRate = totalListings > 0 ? Math.round((soldListings / totalListings) * 100) : 0;
    const planUsedPct = plan && plan.listingLimit !== 'unlimited'
      ? Math.min((activeListings / plan.listingLimit) * 100, 100)
      : 0;
    const featuredRemaining = plan ? Math.max((plan.featuredCredits || 0) - featuredListingsCount, 0) : 0;
    const certsRemaining = plan ? Math.max((plan.freeCertifications || 0) - (currentUser.usedCertifications || 0), 0) : 0;
    const expiringSoon = currentUser.planExpiryDate
      ? (new Date(currentUser.planExpiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24) < 14
      : false;

    return (
      <div className="space-y-4 pb-4">
        {/* ── Premium Welcome Hero ── */}
        <div
          className="relative overflow-hidden rounded-3xl text-white"
          style={{
            background:
              'radial-gradient(120% 120% at 0% 0%, #1F1F2A 0%, #0E0E14 55%, #0A0A10 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 20px 50px -22px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)'
          }}
        >
          {/* Accent stripe */}
          <div
            aria-hidden
            className="absolute left-0 top-0 h-full w-[3px]"
            style={{ background: 'linear-gradient(180deg, #FF8456, #FF6B35 60%, transparent)' }}
          />
          {/* Subtle dot grid */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
              backgroundSize: '14px 14px'
            }}
          />
          {/* Glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-16 w-72 h-72 rounded-full"
            style={{ background: 'radial-gradient(closest-side, rgba(255,107,53,0.20), transparent 70%)' }}
          />

          <div className="relative p-5">
            <div className="flex items-center gap-2 mb-3">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/80"
                style={{
                  background: 'rgba(255,107,53,0.12)',
                  border: '1px solid rgba(255,107,53,0.30)'
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF8456] shadow-[0_0_10px_rgba(255,132,86,0.8)]" />
                {isSeller ? 'Seller hub' : isAdmin ? 'Admin' : 'Buyer hub'}
              </span>
            </div>
            <h2
              className="font-semibold mb-1.5 text-white"
              style={{ fontSize: '22px', lineHeight: 1.15, letterSpacing: '-0.025em' }}
            >
              {t('sellerDashboard.mobile.welcome', { name: currentUser.name?.split(' ')[0] || '' })}
            </h2>
            <p className="text-[13.5px] text-white/60 leading-relaxed font-medium max-w-sm">
              {isSeller
                ? t('sellerDashboard.mobile.manageListings')
                : isAdmin
                  ? t('sellerDashboard.mobile.monitorPlatform')
                  : t('sellerDashboard.mobile.trackBuyerJourney')}
            </p>

            {/* Hero metrics rail */}
            {isSeller && (
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { label: 'Active', value: activeListings },
                  { label: 'Views', value: totalViews.toLocaleString('en-IN') },
                  { label: 'Inquiries', value: totalInquiries }
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-2xl px-3 py-2.5"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}
                  >
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/45 font-semibold">{m.label}</p>
                    <p className="mt-1 text-[18px] font-bold text-white tracking-tight">{m.value}</p>
                  </div>
                ))}
              </div>
            )}

            {isSeller && (
              <button
                type="button"
                onClick={() => {
                  setEditingVehicle(null);
                  setActiveTab('addVehicle');
                }}
                className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold text-white active:scale-[0.97] transition-transform"
                style={{
                  background: 'linear-gradient(135deg, #FF8456 0%, #FF6B35 100%)',
                  boxShadow: '0 10px 24px -10px rgba(255,107,53,0.6), inset 0 1px 0 rgba(255,255,255,0.25)'
                }}
              >
                <IconPlus size={16} stroke={2.4} />
                List a vehicle
                <IconArrowUpRight size={14} stroke={2.2} className="opacity-90" />
              </button>
            )}
          </div>
        </div>

        {/* ── Premium Stats Grid (2×2) ── */}
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              key: 'listings',
              label: t('sellerDashboard.mobile.tab.listings'),
              value: totalListings,
              hint: activeListings > 0 ? t('sellerDashboard.mobile.nActive', { count: activeListings }) : 'Start your first',
              icon: <IconCar size={16} stroke={1.9} />,
              accent: '#2563EB',
              accentSoft: 'rgba(37,99,235,0.10)',
              progress: totalListings > 0 ? Math.min((activeListings / Math.max(totalListings, 1)) * 100, 100) : 0,
              onClick: () => setActiveTab('listings')
            },
            {
              key: 'views',
              label: t('sellerDashboard.mobile.totalViews'),
              value: totalViews.toLocaleString('en-IN'),
              hint: totalViews > 0 ? t('sellerDashboard.mobile.viewsHint') : 'Awaiting views',
              icon: <IconEye size={16} stroke={1.9} />,
              accent: '#8B5CF6',
              accentSoft: 'rgba(139,92,246,0.10)',
              progress: Math.min(totalViews / 5, 100),
              onClick: undefined as undefined | (() => void)
            },
            ...(isSeller ? [{
              key: 'messages',
              label: t('sellerDashboard.mobile.tab.messages'),
              value: totalInquiries,
              hint: unreadSellerThreads > 0 ? `${unreadSellerThreads} unread` : 'All caught up',
              icon: <IconChat size={16} stroke={1.9} />,
              accent: '#10B981',
              accentSoft: 'rgba(16,185,129,0.10)',
              progress: totalInquiries > 0 ? Math.min((unreadSellerThreads / Math.max(totalInquiries, 1)) * 100, 100) : 0,
              onClick: () => setActiveTab('messages')
            }] : []),
            {
              key: 'sold',
              label: t('sellerDashboard.mobile.soldStat'),
              value: soldListings,
              hint:
                soldListings > 0 && totalListings > 0
                  ? t('sellerDashboard.mobile.soldSuccess', { percent: conversionRate })
                  : 'No sales yet',
              icon: <IconCheck size={16} stroke={1.9} />,
              accent: '#FF6B35',
              accentSoft: 'rgba(255,107,53,0.10)',
              progress: conversionRate,
              onClick: () => setActiveTab('salesHistory')
            }
          ].map((s) => {
            const isInteractive = !!s.onClick;
            const Comp: any = isInteractive ? 'button' : 'div';
            return (
              <Comp
                key={s.key}
                {...(isInteractive ? { type: 'button', onClick: s.onClick } : {})}
                className="relative text-left rounded-2xl p-4 active:scale-[0.98] transition-all"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid rgba(15,23,42,0.06)',
                  boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.20)'
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-9 h-9 rounded-xl grid place-items-center"
                    style={{ background: s.accentSoft, color: s.accent }}
                  >
                    {s.icon}
                  </div>
                  {isInteractive && (
                    <span className="text-slate-300">
                      <IconChevronRight size={16} stroke={2} />
                    </span>
                  )}
                </div>
                <p
                  className="text-[10.5px] uppercase font-semibold text-slate-500 mb-1"
                  style={{ letterSpacing: '0.14em' }}
                >
                  {s.label}
                </p>
                <p
                  className="text-[26px] font-bold text-slate-900 tracking-tight leading-none"
                  style={{ letterSpacing: '-0.03em' }}
                >
                  {s.value}
                </p>
                <div className="mt-3 h-1 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(s.progress, 4)}%`, background: s.accent }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-500 font-medium truncate">{s.hint}</p>
              </Comp>
            );
          })}
        </div>

        {/* ── Plan card skeleton ── */}
        {isSeller && planLoading && (
          <div
            aria-hidden
            className="rounded-3xl p-5 animate-pulse"
            style={{
              background: 'linear-gradient(135deg, #16161D, #0E0E14)',
              border: '1px solid rgba(255,255,255,0.06)',
              minHeight: 200
            }}
          >
            <div className="h-4 w-32 bg-white/10 rounded mb-3" />
            <div className="h-7 w-44 bg-white/10 rounded mb-5" />
            <div className="h-2 w-full bg-white/10 rounded mb-2" />
            <div className="h-3 w-2/3 bg-white/10 rounded mb-2" />
            <div className="h-3 w-1/2 bg-white/10 rounded" />
          </div>
        )}

        {/* ── Premium Plan Card (obsidian + amber accents) ── */}
        {isSeller && plan && !planLoading && (
          <div
            className="relative overflow-hidden rounded-3xl text-white"
            style={{
              background:
                'linear-gradient(135deg, #14141C 0%, #0B0B11 60%, #08080C 100%)',
              border: '1px solid rgba(255, 184, 102, 0.18)',
              boxShadow: '0 20px 50px -22px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)'
            }}
          >
            {/* Amber edge */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,184,102,0.55), transparent)' }}
            />
            <div
              aria-hidden
              className="absolute -right-16 -top-16 w-56 h-56 rounded-full"
              style={{ background: 'radial-gradient(closest-side, rgba(255,184,102,0.18), transparent 70%)' }}
            />

            <div className="relative p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="w-7 h-7 grid place-items-center rounded-lg"
                      style={{
                        background: 'linear-gradient(135deg, #FFD08A, #E59F4B)',
                        color: '#1B120A',
                        boxShadow: '0 6px 14px -6px rgba(229,159,75,0.55)'
                      }}
                    >
                      <IconCrown size={15} stroke={2} />
                    </span>
                    <span className="text-[10.5px] uppercase tracking-[0.20em] text-amber-200/80 font-semibold">
                      {t('sellerDashboard.yourPlanLabel')}
                    </span>
                  </div>
                  <h3
                    className="text-white font-semibold tracking-tight"
                    style={{ fontSize: '20px', letterSpacing: '-0.02em' }}
                  >
                    {plan.name}
                  </h3>
                </div>
                {(plan.id !== 'premium' || (currentUser.planExpiryDate && new Date(currentUser.planExpiryDate) < new Date())) && (
                  <button
                    type="button"
                    onClick={() => onNavigate(ViewEnum.PRICING)}
                    className="shrink-0 rounded-full px-4 py-2 text-[12.5px] font-semibold text-slate-900 active:scale-95 transition-transform"
                    style={{
                      background: 'linear-gradient(180deg, #FFFFFF, #F2F2F2)',
                      boxShadow: '0 8px 18px -8px rgba(255,255,255,0.35)'
                    }}
                  >
                    {currentUser.planExpiryDate && new Date(currentUser.planExpiryDate) < new Date()
                      ? t('sellerDashboard.renewPlan')
                      : t('sellerDashboard.upgradePlan')}
                  </button>
                )}
              </div>

              {/* Listings usage */}
              <div className="mb-4">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[12px] text-white/55 font-medium">{t('vehicle.detail.activeListings')}</span>
                  <span className="text-[13px] text-white font-semibold">
                    {activeListings}
                    <span className="text-white/40"> / {plan.listingLimit === 'unlimited' ? '∞' : plan.listingLimit}</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${plan.listingLimit === 'unlimited' ? 100 : planUsedPct}%`,
                      background: 'linear-gradient(90deg, #FFD08A, #FF8456)'
                    }}
                  />
                </div>
              </div>

              {/* Two-up: credits + certifications */}
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div
                  className="rounded-2xl px-3 py-2.5"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/45 font-semibold">Featured</p>
                  <p className="mt-1 text-[16px] font-bold text-white tracking-tight">
                    {featuredRemaining}<span className="text-white/40 text-[12px] font-medium ml-1">left</span>
                  </p>
                </div>
                <div
                  className="rounded-2xl px-3 py-2.5"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/45 font-semibold">Certifications</p>
                  <p className="mt-1 text-[16px] font-bold text-white tracking-tight">
                    {certsRemaining}<span className="text-white/40 text-[12px] font-medium ml-1">free</span>
                  </p>
                </div>
              </div>

              {currentUser.planExpiryDate && (
                <div
                  className="flex items-center justify-between rounded-xl px-3 py-2"
                  style={{
                    background: expiringSoon ? 'rgba(255,107,53,0.08)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${expiringSoon ? 'rgba(255,107,53,0.25)' : 'rgba(255,255,255,0.06)'}`
                  }}
                >
                  <span className="text-[11.5px] text-white/60 font-medium">
                    {expiringSoon ? 'Renews soon' : 'Renews on'}
                  </span>
                  <span className="text-[12px] font-semibold text-white">
                    {new Date(currentUser.planExpiryDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── AI Sales Assistant ── */}
        {isSeller && (
          <div
            className="relative overflow-hidden rounded-3xl p-5"
            style={{
              background: '#FFFFFF',
              border: '1px solid rgba(15,23,42,0.06)',
              boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.20)'
            }}
          >
            <div
              aria-hidden
              className="absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-60"
              style={{ background: 'radial-gradient(closest-side, rgba(139,92,246,0.10), transparent 70%)' }}
            />
            <div className="relative flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-9 h-9 rounded-xl grid place-items-center text-white"
                  style={{
                    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                    boxShadow: '0 8px 20px -10px rgba(139,92,246,0.55)'
                  }}
                >
                  <IconSparkle size={16} stroke={2} />
                </span>
                <div className="leading-tight">
                  <h3 className="font-semibold text-slate-900 text-[15px] tracking-tight" style={{ letterSpacing: '-0.01em' }}>
                    AI Sales Assistant
                  </h3>
                  <p className="text-[11.5px] text-slate-500 font-medium">Smart suggestions based on your listings</p>
                </div>
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-[0.14em] px-2 py-1 rounded-full"
                style={{ background: 'rgba(139,92,246,0.10)', color: '#7C3AED' }}
              >
                Beta
              </span>
            </div>
            <AiAssistant
              vehicles={safeUserVehicles}
              conversations={safeConversations}
              onNavigateToVehicle={(vehicleId) => {
                const vehicle = safeUserVehicles.find(v => v.id === vehicleId);
                if (vehicle && onViewVehicle) onViewVehicle(vehicle);
              }}
              onNavigateToInquiry={(conversationId) => {
                const conv = safeConversations.find((c) => c && c.id === conversationId);
                if (conv && onSellerOpenChat) onSellerOpenChat(conv);
              }}
            />
          </div>
        )}

        {/* ── Premium Quick Actions ── */}
        <div
          className="rounded-3xl p-5"
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(15,23,42,0.06)',
            boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.20)'
          }}
        >
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-semibold text-slate-900 text-[15px] tracking-tight" style={{ letterSpacing: '-0.01em' }}>
              Quick actions
            </h3>
            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400 font-semibold">Shortcuts</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {(() => {
              const actions: { key: string; label: string; sub: string; onClick: () => void; icon: React.ReactNode; accent: string; tint: string }[] = [];
              if (isSeller) {
                actions.push({
                  key: 'add',
                  label: 'Add vehicle',
                  sub: 'List in minutes',
                  onClick: () => { setEditingVehicle(null); setActiveTab('addVehicle'); },
                  icon: <IconPlus size={16} stroke={2.2} />,
                  accent: '#FF6B35',
                  tint: 'rgba(255,107,53,0.10)'
                });
                actions.push({
                  key: 'manage',
                  label: 'Manage',
                  sub: 'Edit listings',
                  onClick: () => setActiveTab('listings'),
                  icon: <IconList size={16} stroke={2} />,
                  accent: '#2563EB',
                  tint: 'rgba(37,99,235,0.10)'
                });
                if (onAddMultipleVehicles) {
                  actions.push({
                    key: 'bulk',
                    label: 'Bulk upload',
                    sub: 'CSV import',
                    onClick: () => setShowBulkUpload(true),
                    icon: <IconUpload size={16} stroke={2} />,
                    accent: '#8B5CF6',
                    tint: 'rgba(139,92,246,0.10)'
                  });
                }
                actions.push({
                  key: 'analytics',
                  label: 'Analytics',
                  sub: 'Performance',
                  onClick: () => setActiveTab('analytics'),
                  icon: <IconChart size={16} stroke={2} />,
                  accent: '#0EA5E9',
                  tint: 'rgba(14,165,233,0.10)'
                });
              }
              actions.push({
                key: 'inbox',
                label: 'Messages',
                sub: 'Open inbox',
                onClick: () => onNavigate(ViewEnum.INBOX),
                icon: <IconChat size={16} stroke={2} />,
                accent: '#10B981',
                tint: 'rgba(16,185,129,0.10)'
              });
              actions.push({
                key: 'settings',
                label: 'Settings',
                sub: 'Preferences',
                onClick: () => setActiveTab('settings'),
                icon: <IconShield size={16} stroke={2} />,
                accent: '#475569',
                tint: 'rgba(71,85,105,0.10)'
              });
              return actions.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={a.onClick}
                  className="group relative flex items-start gap-3 rounded-2xl p-3.5 text-left active:scale-[0.97] transition-transform"
                  style={{
                    background: 'rgba(15,23,42,0.025)',
                    border: '1px solid rgba(15,23,42,0.06)'
                  }}
                >
                  <span
                    className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
                    style={{ background: a.tint, color: a.accent }}
                  >
                    {a.icon}
                  </span>
                  <span className="flex-1 min-w-0 leading-tight pt-0.5">
                    <span className="block text-[13px] font-semibold text-slate-900 truncate" style={{ letterSpacing: '-0.01em' }}>
                      {a.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500 font-medium truncate">{a.sub}</span>
                  </span>
                  <span className="text-slate-300 mt-1.5">
                    <IconChevronRight size={14} stroke={2} />
                  </span>
                </button>
              ));
            })()}
          </div>
        </div>
      </div>
    );
  };

  const renderListings = () => (
    <div className="space-y-4 pb-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-slate-400">Inventory</p>
          <h3 className="text-[19px] font-semibold text-slate-900 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            {t('sellerListing.yourListings')}
          </h3>
          <p className="text-[11.5px] text-slate-500 mt-0.5 font-medium">
            {t('sellerListing.listingsSummary', { total: totalListings, active: activeListings })}
          </p>
        </div>
        {isSeller && (
          <button
            type="button"
            onClick={() => { setEditingVehicle(null); setActiveTab('addVehicle'); }}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[12.5px] font-semibold text-white active:scale-95 transition-transform shrink-0"
            style={{
              background: 'linear-gradient(135deg, #FF8456 0%, #FF6B35 100%)',
              boxShadow: '0 8px 18px -8px rgba(255,107,53,0.55)',
              letterSpacing: '-0.01em'
            }}
          >
            <IconPlus size={14} stroke={2.4} />
            {t('sellerListing.addVehicle')}
          </button>
        )}
      </div>

      {safeUserVehicles.length === 0 ? (
        <div
          className="relative overflow-hidden rounded-3xl px-6 py-12 text-center"
          style={{
            background: 'linear-gradient(180deg, #FFFFFF, #FAFAFC)',
            border: '1px solid rgba(15,23,42,0.06)'
          }}
        >
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,107,53,0.4), transparent)' }}
          />
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-2xl grid place-items-center"
            style={{
              background: 'linear-gradient(135deg, rgba(255,107,53,0.10), rgba(255,132,86,0.18))',
              color: '#FF6B35'
            }}
          >
            <IconCar size={28} stroke={1.7} />
          </div>
          <h4 className="text-[18px] font-semibold text-slate-900 mb-1.5 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            {t('sellerListing.noListingsTitle')}
          </h4>
          <p className="text-[13px] text-slate-500 mb-6 leading-relaxed max-w-sm mx-auto font-medium">
            {isSeller ? t('sellerListing.noListingsSeller') : t('sellerListing.noListingsBuyer')}
          </p>
          {isSeller && (
            <button
              type="button"
              onClick={() => { setEditingVehicle(null); setActiveTab('addVehicle'); }}
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold text-white text-[13.5px] active:scale-95 transition-transform"
              style={{
                background: 'linear-gradient(135deg, #FF8456 0%, #FF6B35 100%)',
                boxShadow: '0 12px 24px -10px rgba(255,107,53,0.55)'
              }}
            >
              <IconPlus size={16} stroke={2.4} />
              {t('sellerListing.addFirstVehicle')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {safeUserVehicles.map((vehicle) => {
            const heroImage = (vehicle.images && vehicle.images[0]) || '';
            const statusMeta =
              vehicle.status === 'published'
                ? { bg: 'rgba(16,185,129,0.10)', color: '#047857', label: t('sellerListing.badgeActive') }
                : vehicle.status === 'sold'
                  ? { bg: 'rgba(71,85,105,0.10)', color: '#334155', label: t('sellerListing.badgeSold') }
                  : { bg: 'rgba(245,158,11,0.12)', color: '#B45309', label: t('sellerListing.badgePending') };
            return (
              <div
                key={vehicle.id}
                role="button"
                tabIndex={0}
                onClick={() => onViewVehicle?.(vehicle)}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onViewVehicle) { e.preventDefault(); onViewVehicle(vehicle); } }}
                className="relative rounded-2xl p-3.5 active:scale-[0.99] transition-all cursor-pointer"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid rgba(15,23,42,0.06)',
                  boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.20)'
                }}
              >
                <div className="flex items-start gap-3.5">
                  {/* Cover */}
                  <div
                    className="relative w-[88px] h-[88px] rounded-xl overflow-hidden shrink-0 grid place-items-center"
                    style={{
                      background: 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)',
                      border: '1px solid rgba(15,23,42,0.05)'
                    }}
                  >
                    {heroImage ? (
                      <img src={heroImage} alt="" loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-slate-400"><IconCar size={32} stroke={1.6} /></span>
                    )}
                    {vehicle.isFeatured && (
                      <span
                        className="absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-[3px] text-[9px] font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #FFD08A, #E59F4B)', color: '#1B120A' }}
                      >
                        <IconStar size={9} stroke={2.4} /> Featured
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-slate-900 text-[14.5px] truncate tracking-tight" style={{ letterSpacing: '-0.01em' }}>
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </h4>
                      <span
                        className="shrink-0 px-2 py-[3px] rounded-full text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: statusMeta.bg, color: statusMeta.color }}
                      >
                        {statusMeta.label}
                      </span>
                    </div>
                    {vehicle.variant && (
                      <p className="text-[11.5px] text-slate-500 truncate mt-0.5 font-medium">{vehicle.variant}</p>
                    )}
                    <p className="text-[17px] font-bold text-slate-900 mt-1.5 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                      ₹{vehicle.price.toLocaleString('en-IN')}
                    </p>
                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                      {vehicle.mileage ? <span>{vehicle.mileage.toLocaleString('en-IN')} km</span> : null}
                      {vehicle.views ? (
                        <span className="inline-flex items-center gap-1">
                          <IconEye size={11} stroke={2} />
                          {t('sellerListing.views', { count: vehicle.views })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Action rail */}
                {isSeller && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 pt-3 flex items-center gap-1.5 overflow-x-auto scrollbar-hide"
                    style={{ borderTop: '1px dashed rgba(15,23,42,0.08)' }}
                  >
                    {[
                      {
                        key: 'edit',
                        label: 'Edit',
                        icon: <IconEdit size={14} stroke={2} />,
                        color: '#2563EB',
                        tint: 'rgba(37,99,235,0.08)',
                        show: true,
                        onClick: () => { setEditingVehicle(vehicle); setActiveTab('editVehicle'); }
                      },
                      {
                        key: 'sold',
                        label: 'Mark sold',
                        icon: <IconCheck size={14} stroke={2} />,
                        color: '#047857',
                        tint: 'rgba(16,185,129,0.08)',
                        show: vehicle.status === 'published',
                        onClick: () => _onMarkAsSold(vehicle.id)
                      },
                      {
                        key: 'feature',
                        label: 'Feature',
                        icon: <IconStar size={14} stroke={2} />,
                        color: '#B45309',
                        tint: 'rgba(245,158,11,0.10)',
                        show: !vehicle.isFeatured && vehicle.status === 'published',
                        onClick: () => _onFeatureListing(vehicle.id)
                      },
                      {
                        key: 'boost',
                        label: 'Boost',
                        icon: <IconRocket size={14} stroke={2} />,
                        color: '#7C3AED',
                        tint: 'rgba(139,92,246,0.10)',
                        show: vehicle.status === 'published' && !!onBoostListing,
                        onClick: () => setBoostVehicle(vehicle)
                      },
                      {
                        key: 'cert',
                        label: 'Certify',
                        icon: <IconShield size={14} stroke={2} />,
                        color: '#0EA5E9',
                        tint: 'rgba(14,165,233,0.10)',
                        show: vehicle.status === 'published' && !!onRequestCertification,
                        onClick: () => onRequestCertification?.(vehicle.id)
                      },
                      {
                        key: 'delete',
                        label: 'Delete',
                        icon: <IconTrash size={14} stroke={2} />,
                        color: '#DC2626',
                        tint: 'rgba(220,38,38,0.08)',
                        show: true,
                        onClick: () => onDeleteVehicle(vehicle.id)
                      }
                    ]
                      .filter((a) => a.show)
                      .map((a) => (
                        <button
                          key={a.key}
                          type="button"
                          onClick={a.onClick}
                          aria-label={a.label}
                          title={a.label}
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap active:scale-95 transition-transform"
                          style={{ background: a.tint, color: a.color }}
                        >
                          {a.icon}
                          {a.label}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderMessagesHub = () => {
    const filters: { key: 'all' | 'unread' | 'read'; label: string; count?: number }[] = [
      { key: 'all', label: 'All', count: safeConversations.length },
      { key: 'unread', label: 'Unread', count: unreadSellerThreads },
      { key: 'read', label: 'Read' }
    ];
    return (
      <div className="space-y-4 pb-4">
        {/* Section header */}
        <div className="flex items-end justify-between">
          <div className="min-w-0">
            <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-slate-400">Inbox</p>
            <h3 className="text-[19px] font-semibold text-slate-900 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              {t('sellerDashboard.mobile.tab.messages')}
            </h3>
            <p className="text-[11.5px] text-slate-500 mt-0.5 font-medium leading-snug max-w-[260px]">
              {t('sellerDashboard.mobile.messagesHubBody')}
            </p>
          </div>
          {onMarkAllAsReadBySeller && unreadSellerThreads > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsReadBySeller}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold active:scale-95 transition-transform"
              style={{ background: 'rgba(37,99,235,0.10)', color: '#1D4ED8' }}
            >
              <IconCheck size={13} stroke={2.2} />
              Mark all read
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {filters.map((f) => {
            const active = messagesHubFilter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setMessagesHubFilter(f.key)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all active:scale-95"
                style={{
                  background: active ? '#0B0B0F' : 'rgba(15,23,42,0.04)',
                  color: active ? '#FFFFFF' : '#475569',
                  border: active ? '1px solid #0B0B0F' : '1px solid rgba(15,23,42,0.06)'
                }}
              >
                {f.label}
                {typeof f.count === 'number' && f.count > 0 && (
                  <span
                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold"
                    style={{
                      background: active ? 'rgba(255,255,255,0.18)' : '#FF6B35',
                      color: '#FFFFFF'
                    }}
                  >
                    {f.count > 99 ? '99+' : f.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Conversation list */}
        <div
          className="rounded-3xl overflow-hidden"
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(15,23,42,0.06)',
            boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.20)'
          }}
        >
          {hubConversationList.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <div
                className="w-14 h-14 mx-auto mb-3 rounded-2xl grid place-items-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.10), rgba(5,150,105,0.18))',
                  color: '#047857'
                }}
              >
                <IconChat size={24} stroke={1.7} />
              </div>
              <h4 className="text-[15px] font-semibold text-slate-900 tracking-tight" style={{ letterSpacing: '-0.01em' }}>
                {t('sellerDashboard.messages.emptyTitle')}
              </h4>
              <p className="mt-1 text-[12px] text-slate-500 font-medium">No conversations match this filter.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[min(58vh,520px)] overflow-y-auto">
              {hubConversationList.map((conv) => {
                if (!conv) return null;
                const last = getLastVisibleMessageForViewer(conv, 'seller');
                const preview = getThreadLastMessagePreview(last, { otherLabel: conv.customerName || '', viewer: 'seller' });
                const line = `${preview.prefix}${preview.text}`;
                const isUnread = !conv.isReadBySeller;
                const initials = (conv.customerName || 'C').split(' ').map(s => s.charAt(0)).slice(0, 2).join('').toUpperCase();
                return (
                  <li
                    key={conv.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSellerOpenChat?.(conv)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSellerOpenChat?.(conv); } }}
                    className="relative px-4 py-3.5 active:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {isUnread && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-3.5 bottom-3.5 w-[3px] rounded-r-full"
                        style={{ background: 'linear-gradient(180deg, #FF8456, #FF6B35)' }}
                      />
                    )}
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        <div
                          className="w-10 h-10 rounded-xl grid place-items-center text-[13px] font-bold tracking-tight"
                          style={{
                            background: 'linear-gradient(160deg, #1F1F28 0%, #0E0E13 100%)',
                            color: '#FFFFFF',
                            border: '1px solid rgba(255,255,255,0.06)'
                          }}
                        >
                          {initials}
                        </div>
                        {isUnread && (
                          <span
                            aria-hidden
                            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                            style={{ background: '#FF6B35', boxShadow: '0 0 0 2px #FFFFFF' }}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className={`truncate text-[13.5px] tracking-tight ${isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`} style={{ letterSpacing: '-0.01em' }}>
                            {conv.customerName || 'Customer'}
                          </p>
                          <span className="text-[10.5px] text-slate-400 font-medium whitespace-nowrap shrink-0">
                            {formatRelativeTime(conv.lastMessageAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">{conv.vehicleName}</p>
                        <p className={`text-[12.5px] truncate mt-1 ${isUnread ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>{line}</p>
                        {onSetConversationReadState && (
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onSetConversationReadState(conv.id, isUnread); }}
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-semibold active:scale-95 transition-transform"
                              style={{
                                background: isUnread ? 'rgba(37,99,235,0.08)' : 'rgba(71,85,105,0.06)',
                                color: isUnread ? '#1D4ED8' : '#475569'
                              }}
                            >
                              {isUnread ? 'Mark read' : 'Mark unread'}
                            </button>
                          </div>
                        )}
                      </div>
                      <span className="text-slate-300 mt-1 shrink-0">
                        <IconChevronRight size={16} stroke={2} />
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => onNavigate(ViewEnum.INBOX)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 text-[13.5px] font-semibold text-white active:scale-[0.98] transition-transform"
          style={{
            background: 'linear-gradient(135deg, #14141C 0%, #0B0B11 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 14px 30px -14px rgba(11,11,15,0.55)'
          }}
        >
          {t('sellerDashboard.mobile.messagesHubOpenInbox')}
          <IconArrowUpRight size={16} stroke={2.2} />
        </button>
      </div>
    );
  };

  const renderAnalytics = () => {
    // Calculate additional metrics
    const averageViewsPerListing = activeListings > 0 ? Math.round(totalViews / activeListings) : 0;
    const conversionRate = totalViews > 0 ? ((totalInquiries / totalViews) * 100).toFixed(1) : '0.0';
    const responseRate =
      totalInquiries > 0
        ? (
            (safeConversations.filter((c) => filterMessagesForViewer(c, 'seller').length > 0).length /
              totalInquiries) *
            100
          ).toFixed(0)
        : '0';
    const avgPrice = safeUserVehicles.length > 0 
      ? safeUserVehicles.reduce((sum, v) => sum + (v?.price || 0), 0) / safeUserVehicles.length 
      : 0;

    // Get top performing vehicles
    const topVehicles = [...safeUserVehicles]
      .sort((a, b) => (b?.views || 0) - (a?.views || 0))
      .slice(0, 5);

    const formatPrice = (n: number) => (n >= 10000000
      ? `${(n / 10000000).toFixed(1)}Cr`
      : n >= 100000
        ? `${(n / 100000).toFixed(1)}L`
        : n.toLocaleString('en-IN'));
    const successRate = totalListings > 0 ? Math.round((soldListings / totalListings) * 100) : 0;

    const metrics = [
      {
        key: 'views',
        label: 'Total views',
        value: totalViews.toLocaleString('en-IN'),
        hint: averageViewsPerListing > 0 ? `${averageViewsPerListing} avg / listing` : 'Awaiting traffic',
        icon: <IconEye size={16} stroke={1.9} />,
        accent: '#2563EB',
        tint: 'rgba(37,99,235,0.10)'
      },
      {
        key: 'inquiries',
        label: t('sellerDashboard.mobile.analyticsMessageThreads'),
        value: totalInquiries,
        hint: totalViews > 0 ? `${conversionRate}% conversion` : 'No views yet',
        icon: <IconChat size={16} stroke={1.9} />,
        accent: '#10B981',
        tint: 'rgba(16,185,129,0.10)'
      },
      {
        key: 'response',
        label: 'Response rate',
        value: `${responseRate}%`,
        hint: 'Messages replied',
        icon: <IconChart size={16} stroke={1.9} />,
        accent: '#8B5CF6',
        tint: 'rgba(139,92,246,0.10)'
      },
      {
        key: 'price',
        label: 'Avg. price',
        value: `₹${formatPrice(avgPrice)}`,
        hint: 'Across listings',
        icon: <IconCar size={16} stroke={1.9} />,
        accent: '#FF6B35',
        tint: 'rgba(255,107,53,0.10)'
      }
    ];

    const trends: { key: string; label: string; value: number; max: number; color: string }[] = [
      { key: 'views', label: 'Views', value: totalViews, max: Math.max(totalViews, 1000), color: '#2563EB' },
      { key: 'inq', label: t('sellerDashboard.mobile.analyticsMessageThreads'), value: totalInquiries, max: Math.max(totalInquiries, 100), color: '#10B981' },
      { key: 'active', label: t('vehicle.detail.activeListings'), value: activeListings, max: Math.max(activeListings, 20), color: '#FF6B35' }
    ];

    return (
      <div className="space-y-4 pb-4">
        {/* Section header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-slate-400">Insights</p>
            <h3 className="text-[19px] font-semibold text-slate-900 tracking-tight" style={{ letterSpacing: '-0.02em' }}>Analytics</h3>
            <p className="text-[11.5px] text-slate-500 mt-0.5 font-medium">Performance across your inventory</p>
          </div>
          <div
            className="inline-flex items-center gap-1 rounded-full p-1"
            style={{ background: 'rgba(15,23,42,0.05)', border: '1px solid rgba(15,23,42,0.06)' }}
          >
            {['7D', '30D', '90D'].map((p, i) => (
              <button
                key={p}
                type="button"
                className="px-2.5 py-1 rounded-full text-[10.5px] font-semibold transition-colors"
                style={{
                  background: i === 1 ? '#0B0B0F' : 'transparent',
                  color: i === 1 ? '#FFFFFF' : '#475569'
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Metric grid */}
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m) => (
            <div
              key={m.key}
              className="rounded-2xl p-4"
              style={{
                background: '#FFFFFF',
                border: '1px solid rgba(15,23,42,0.06)',
                boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.20)'
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: m.tint, color: m.accent }}>
                  {m.icon}
                </div>
              </div>
              <p className="text-[10.5px] uppercase font-semibold text-slate-500 mb-1" style={{ letterSpacing: '0.14em' }}>
                {m.label}
              </p>
              <p className="text-[24px] font-bold text-slate-900 tracking-tight leading-none" style={{ letterSpacing: '-0.03em' }}>
                {m.value}
              </p>
              <p className="mt-2 text-[11px] text-slate-500 font-medium truncate">{m.hint}</p>
            </div>
          ))}
        </div>

        {/* Performance trends */}
        <div
          className="rounded-3xl p-5"
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(15,23,42,0.06)',
            boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.20)'
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-slate-900 text-[15px] tracking-tight" style={{ letterSpacing: '-0.01em' }}>
              Performance trends
            </h4>
            <span className="text-[10.5px] uppercase tracking-[0.16em] text-slate-400 font-semibold">Live</span>
          </div>
          <div className="space-y-3.5">
            {trends.map((t1) => {
              const pct = Math.min((t1.value / Math.max(t1.max, 1)) * 100, 100);
              return (
                <div key={t1.key}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-[12.5px] font-semibold text-slate-700">{t1.label}</span>
                    <span className="text-[12.5px] font-bold text-slate-900 tracking-tight">{t1.value.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(15,23,42,0.05)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.max(pct, 4)}%`,
                        background: `linear-gradient(90deg, ${t1.color}AA, ${t1.color})`
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top performers */}
        {topVehicles.length > 0 && (
          <div
            className="rounded-3xl p-5"
            style={{
              background: '#FFFFFF',
              border: '1px solid rgba(15,23,42,0.06)',
              boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.20)'
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-slate-900 text-[15px] tracking-tight" style={{ letterSpacing: '-0.01em' }}>
                Top performers
              </h4>
              <button
                type="button"
                onClick={() => setActiveTab('listings')}
                className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-slate-700 active:scale-95 transition-transform"
              >
                View all
                <IconChevronRight size={13} stroke={2.4} />
              </button>
            </div>
            <ul className="space-y-2">
              {topVehicles.map((vehicle, idx) => (
                <li
                  key={vehicle.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onViewVehicle?.(vehicle)}
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onViewVehicle) { e.preventDefault(); onViewVehicle(vehicle); } }}
                  className="flex items-center gap-3 rounded-2xl p-3 cursor-pointer active:scale-[0.99] transition-transform"
                  style={{ background: 'rgba(15,23,42,0.025)', border: '1px solid rgba(15,23,42,0.04)' }}
                >
                  <span
                    className="w-8 h-8 rounded-lg grid place-items-center text-[12px] font-bold tracking-tight shrink-0"
                    style={{
                      background: idx === 0
                        ? 'linear-gradient(135deg, #FFD08A, #E59F4B)'
                        : 'linear-gradient(160deg, #1F1F28 0%, #0E0E13 100%)',
                      color: idx === 0 ? '#1B120A' : '#FFFFFF'
                    }}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-[13.5px] truncate tracking-tight" style={{ letterSpacing: '-0.01em' }}>
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </p>
                    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <IconEye size={11} stroke={2} /> {vehicle.views || 0}
                      </span>
                      {(vehicle.inquiriesCount ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <IconChat size={11} stroke={2} /> {vehicle.inquiriesCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-slate-300 shrink-0"><IconChevronRight size={16} stroke={2} /></span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Success card (premium dark) */}
        <div
          className="relative overflow-hidden rounded-3xl text-white p-5"
          style={{
            background: 'linear-gradient(135deg, #14141C 0%, #0B0B11 100%)',
            border: '1px solid rgba(255,107,53,0.20)',
            boxShadow: '0 20px 50px -22px rgba(0,0,0,0.55)'
          }}
        >
          <div
            aria-hidden
            className="absolute -right-20 -top-16 w-72 h-72 rounded-full"
            style={{ background: 'radial-gradient(closest-side, rgba(255,107,53,0.20), transparent 70%)' }}
          />
          <div className="relative flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10.5px] uppercase tracking-[0.18em] text-white/55 font-semibold mb-1.5">Success rate</p>
              <p className="text-[34px] font-bold text-white tracking-tight leading-none" style={{ letterSpacing: '-0.03em' }}>
                {successRate}<span className="text-white/40 text-[22px] font-semibold ml-1">%</span>
              </p>
              <p className="mt-2 text-[12px] text-white/55 font-medium">{soldListings} sold of {totalListings} listings</p>
            </div>
            {/* Gauge ring */}
            {(() => {
              const r = 28; const c = 2 * Math.PI * r; const off = c * (1 - successRate / 100);
              return (
                <div className="shrink-0 relative w-[78px] h-[78px] grid place-items-center">
                  <svg width={78} height={78} viewBox="0 0 78 78" className="-rotate-90">
                    <circle cx={39} cy={39} r={r} stroke="rgba(255,255,255,0.10)" strokeWidth={6} fill="none" />
                    <circle
                      cx={39}
                      cy={39}
                      r={r}
                      stroke="url(#sgrad)"
                      strokeWidth={6}
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={c}
                      strokeDashoffset={off}
                    />
                    <defs>
                      <linearGradient id="sgrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#FFD08A" />
                        <stop offset="100%" stopColor="#FF6B35" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <span className="absolute text-white text-[12px] font-bold">{successRate}%</span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfileFormData(prev => ({ ...prev, [name]: value }));
    if (profileErrors[name]) {
      setProfileErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateProfileForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!profileFormData.name || profileFormData.name.trim() === '') {
      newErrors.name = 'Name is required';
    }
    if (!profileFormData.email || profileFormData.email.trim() === '') {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileFormData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!profileFormData.mobile || profileFormData.mobile.trim() === '') {
      newErrors.mobile = 'Mobile number is required';
    } else if (!/^[\d\s\-\+\(\)]{10,15}$/.test(profileFormData.mobile.replace(/\s/g, ''))) {
      newErrors.mobile = 'Please enter a valid mobile number';
    }
    if (isSeller && (!profileFormData.dealershipName || profileFormData.dealershipName.trim() === '')) {
      newErrors.dealershipName = 'Dealership name is required';
    }
    if (isSeller && profileFormData.pincode.trim()) {
      const pc = profileFormData.pincode.replace(/\D/g, '');
      if (pc.length !== 6) {
        newErrors.pincode = 'PIN code must be exactly 6 digits';
      }
    }

    setProfileErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateProfileForm()) return;

    setIsSavingProfile(true);
    try {
      if (onUpdateProfile) {
        const payload: Partial<User> = {
          name: profileFormData.name,
          email: profileFormData.email,
          mobile: profileFormData.mobile,
          dealershipName: profileFormData.dealershipName,
          bio: profileFormData.bio,
        };
        if (isSeller) {
          payload.location = profileFormData.location.trim();
          payload.address = profileFormData.address.trim() || undefined;
          payload.pincode = profileFormData.pincode.replace(/\D/g, '').slice(0, 6) || '';
        }
        await onUpdateProfile(payload);
        setIsEditingProfile(false);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      setProfileErrors({ general: 'Failed to update profile. Please try again.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDownloadQRCode = async () => {
    const origin = getPublicWebOriginForShareLinks();
    const shareUrl = `${origin}/?seller=${encodeURIComponent(currentUser.email)}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(shareUrl)}`;
    const fileName = `seller-qr-${(currentUser.dealershipName || currentUser.name || 'profile').toString().replace(/\s+/g, '-')}.png`;
    await saveQrCodePngFromUrl(qrUrl, fileName, addToast);
  };

  const userNotifications = notifications.filter(n => n.recipientEmail === currentUser.email);
  const unreadNotifications = userNotifications.filter(n => !n.isRead);

  const renderProfile = () => {
    const cardStyle: React.CSSProperties = {
      background: '#FFFFFF',
      border: '1px solid rgba(15,23,42,0.06)',
      boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.20)'
    };
    const initials = (currentUser.name || 'U').split(' ').map(s => s.charAt(0)).slice(0, 2).join('').toUpperCase();

    if (isEditingProfile) {
      const resetForm = () => {
        setIsEditingProfile(false);
        setProfileErrors({});
        setProfileFormData({
          name: currentUser.name,
          email: currentUser.email,
          mobile: currentUser.mobile || '',
          dealershipName: currentUser?.dealershipName || '',
          bio: currentUser?.bio || '',
          location: currentUser?.location || '',
          address: currentUser?.address || '',
          pincode: currentUser?.pincode || '',
        });
      };
      const Field = ({ label, name, type = 'text', placeholder, required = false, multiline = false, rows = 3, maxLength, inputMode, hint }: {
        label: string;
        name: keyof typeof profileFormData;
        type?: string;
        placeholder?: string;
        required?: boolean;
        multiline?: boolean;
        rows?: number;
        maxLength?: number;
        inputMode?: 'text' | 'numeric' | 'tel' | 'email';
        hint?: string;
      }) => {
        const err = profileErrors[name as string];
        const value = profileFormData[name] as string;
        const baseInput: React.CSSProperties = {
          width: '100%',
          padding: '12px 14px',
          background: '#FFFFFF',
          border: `1px solid ${err ? 'rgba(220,38,38,0.45)' : 'rgba(15,23,42,0.10)'}`,
          borderRadius: 12,
          fontSize: 14,
          color: '#0F172A',
          fontWeight: 500,
          outline: 'none',
          transition: 'all 0.18s ease'
        };
        return (
          <label className="block">
            <span className="block text-[11.5px] font-semibold text-slate-700 mb-1.5 tracking-tight">
              {label} {required && <span className="text-rose-500">*</span>}
            </span>
            {multiline ? (
              <textarea
                name={name as string}
                value={value}
                onChange={handleProfileChange}
                rows={rows}
                placeholder={placeholder}
                maxLength={maxLength}
                style={{ ...baseInput, resize: 'none' }}
              />
            ) : (
              <input
                type={type}
                name={name as string}
                value={value}
                onChange={handleProfileChange}
                placeholder={placeholder}
                inputMode={inputMode}
                maxLength={maxLength}
                style={baseInput}
                required={required}
              />
            )}
            {hint && !err && <p className="text-[10.5px] text-slate-400 mt-1 font-medium">{hint}</p>}
            {err && <p className="text-[11px] text-rose-600 mt-1 font-semibold">{err}</p>}
          </label>
        );
      };

      return (
        <div className="space-y-4 pb-4">
          {/* Section header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-slate-400">Profile</p>
              <h3 className="text-[19px] font-semibold text-slate-900 tracking-tight" style={{ letterSpacing: '-0.02em' }}>Edit profile</h3>
              <p className="text-[11.5px] text-slate-500 mt-0.5 font-medium">Update your account & dealership info</p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              aria-label="Cancel edit"
              className="w-9 h-9 rounded-full grid place-items-center text-slate-500 active:scale-95 transition-transform"
              style={{ background: 'rgba(15,23,42,0.05)', border: '1px solid rgba(15,23,42,0.06)' }}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleProfileSave} className="rounded-3xl p-5 space-y-4" style={cardStyle}>
            <Field label="Name" name="name" required />
            <Field label="Email" name="email" type="email" required />
            <Field label="Mobile number" name="mobile" type="tel" inputMode="tel" placeholder="+91 98765 43210" required />
            {isSeller && (
              <>
                <Field label="Dealership name" name="dealershipName" required />
                <Field
                  label="Bio"
                  name="bio"
                  multiline
                  rows={4}
                  placeholder="Tell buyers about your dealership..."
                  maxLength={500}
                  hint={`${profileFormData.bio.length}/500`}
                />
                <Field label="City or region" name="location" placeholder="e.g. Bengaluru, Karnataka" />
                <Field label="Street address" name="address" multiline rows={2} placeholder="Building, street, locality" />
                <Field label="PIN code" name="pincode" inputMode="numeric" maxLength={6} placeholder="6-digit PIN" />
              </>
            )}

            {profileErrors.general && (
              <div
                className="rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.20)' }}
              >
                <p className="text-[12.5px] text-rose-700 font-semibold">{profileErrors.general}</p>
              </div>
            )}

            <div className="flex gap-2.5 pt-4" style={{ borderTop: '1px solid rgba(15,23,42,0.06)' }}>
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 inline-flex items-center justify-center rounded-2xl py-3 text-[13px] font-semibold text-slate-700 active:scale-[0.98] transition-transform"
                style={{ background: 'rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.06)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="flex-1 inline-flex items-center justify-center rounded-2xl py-3 text-[13px] font-semibold text-white active:scale-[0.98] transition-transform disabled:opacity-70"
                style={{
                  background: 'linear-gradient(135deg, #14141C 0%, #0B0B11 100%)',
                  boxShadow: '0 14px 30px -14px rgba(11,11,15,0.55)'
                }}
              >
                {isSavingProfile ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      );
    }

    return (
      <div className="space-y-4 pb-4">
        {/* Premium identity card (obsidian) */}
        <div
          className="relative overflow-hidden rounded-3xl p-5 text-white"
          style={{
            background: 'radial-gradient(120% 120% at 0% 0%, #1F1F2A 0%, #0E0E14 55%, #0A0A10 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 20px 50px -22px rgba(0,0,0,0.55)'
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-16 w-72 h-72 rounded-full"
            style={{ background: 'radial-gradient(closest-side, rgba(255,107,53,0.20), transparent 70%)' }}
          />
          <div className="relative flex items-center gap-4">
            <div className="relative">
              <span
                className="absolute -inset-[3px] rounded-2xl"
                style={{ background: 'conic-gradient(from 140deg, #FF8456, #FF6B35, #C7411F, #FF8456)' }}
              />
              <span
                className="relative w-16 h-16 rounded-2xl grid place-items-center text-white font-bold text-[20px] tracking-tight"
                style={{
                  background: 'linear-gradient(160deg, #1F1F28 0%, #0E0E13 100%)',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                {initials}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-white font-semibold text-[18px] truncate tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                {currentUser.name}
              </h3>
              <p className="text-[12.5px] text-white/55 truncate font-medium">{currentUser.email}</p>
              <span
                className="inline-flex items-center gap-1.5 mt-2 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em]"
                style={{ background: 'rgba(255,107,53,0.14)', color: '#FFB18A', border: '1px solid rgba(255,107,53,0.30)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF8456]" />
                {currentUser.role}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsEditingProfile(true)}
              aria-label="Edit profile"
              className="w-9 h-9 rounded-full grid place-items-center text-white/85 active:scale-95 transition-transform shrink-0"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
            >
              <IconEdit size={15} stroke={2} />
            </button>
          </div>

          {isSeller && (currentUser?.dealershipName || currentUser?.location || currentUser?.address || currentUser?.pincode) && (
            <div
              className="relative mt-4 rounded-2xl p-3"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {currentUser?.dealershipName && (
                <p className="text-[13px] text-white font-semibold tracking-tight" style={{ letterSpacing: '-0.01em' }}>
                  {currentUser.dealershipName}
                </p>
              )}
              {(currentUser?.location || currentUser?.address || currentUser?.pincode) && (
                <p className="text-[11.5px] text-white/55 mt-1 leading-relaxed font-medium">
                  {[currentUser?.location, currentUser?.address].filter(Boolean).join(' · ')}
                  {currentUser?.pincode ? ` · PIN ${String(currentUser.pincode).replace(/\D/g, '').slice(0, 6)}` : ''}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Seller QR card */}
        {isSeller && (() => {
          const origin = getPublicWebOriginForShareLinks();
          const shareUrl = `${origin}/?seller=${encodeURIComponent(currentUser.email)}`;
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareUrl)}&bgcolor=ffffff&color=0B0B0F&margin=8`;
          const onCopy = async () => {
            try {
              await navigator.clipboard.writeText(shareUrl);
              addToast?.('Link copied to clipboard!', 'success');
            } catch {
              const textArea = document.createElement('textarea');
              textArea.value = shareUrl;
              textArea.style.position = 'fixed';
              textArea.style.left = '-999999px';
              document.body.appendChild(textArea);
              textArea.select();
              try { document.execCommand('copy'); addToast?.('Link copied to clipboard!', 'success'); }
              catch { addToast?.('Failed to copy link. Please copy manually.', 'error'); }
              document.body.removeChild(textArea);
            }
          };
          return (
            <div className="rounded-3xl p-5" style={cardStyle}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-slate-900 text-[15px] tracking-tight" style={{ letterSpacing: '-0.01em' }}>Share storefront</h4>
                  <p className="text-[11.5px] text-slate-500 mt-0.5 font-medium">Public link & QR for buyers</p>
                </div>
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.16em] px-2 py-1 rounded-full"
                  style={{ background: 'rgba(37,99,235,0.10)', color: '#1D4ED8' }}
                >
                  Public
                </span>
              </div>

              <div className="flex flex-col items-center mb-4">
                <div
                  className="rounded-2xl p-3"
                  style={{
                    background: 'linear-gradient(180deg, #FFFFFF, #F8FAFC)',
                    border: '1px solid rgba(15,23,42,0.06)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 18px -10px rgba(15,23,42,0.20)'
                  }}
                >
                  <img src={qrUrl} alt="Seller QR code" className="w-40 h-40 rounded-xl" />
                </div>
                <button
                  type="button"
                  onClick={handleDownloadQRCode}
                  className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-semibold text-white active:scale-95 transition-transform"
                  style={{
                    background: 'linear-gradient(135deg, #14141C 0%, #0B0B11 100%)',
                    boxShadow: '0 10px 22px -10px rgba(11,11,15,0.50)'
                  }}
                >
                  <IconUpload size={13} stroke={2.2} className="rotate-180" />
                  Download QR
                </button>
              </div>

              <div className="flex items-center gap-2 rounded-2xl p-2 pl-3" style={{ background: 'rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.06)' }}>
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-transparent text-[11.5px] text-slate-700 font-medium truncate outline-none"
                />
                <button
                  type="button"
                  onClick={onCopy}
                  className="shrink-0 rounded-xl px-3 py-1.5 text-[11.5px] font-semibold text-white active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg, #FF8456 0%, #FF6B35 100%)' }}
                >
                  Copy
                </button>
              </div>
            </div>
          );
        })()}

        {/* Account rows */}
        <div className="rounded-3xl p-2.5" style={cardStyle}>
          <div className="px-2.5 pt-2 pb-1">
            <p className="text-[10.5px] uppercase tracking-[0.16em] text-slate-400 font-semibold">Account</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {[
              { key: 'edit', label: 'Edit profile', sub: 'Personal & dealership info', icon: <IconEdit size={16} stroke={2} />, tint: 'rgba(37,99,235,0.10)', color: '#2563EB', onClick: () => setIsEditingProfile(true), badge: undefined as undefined | number },
              { key: 'notifs', label: 'Notifications', sub: 'Activity & alerts', icon: <IconBell size={16} stroke={2} />, tint: 'rgba(255,107,53,0.10)', color: '#EA580C', onClick: () => setActiveTab('notifications'), badge: unreadNotifications.length },
              { key: 'privacy', label: 'Privacy', sub: 'Account safety', icon: <IconShield size={16} stroke={2} />, tint: 'rgba(71,85,105,0.10)', color: '#475569', onClick: () => onNavigate(ViewEnum.SUPPORT) },
              { key: 'help', label: 'Help & support', sub: 'FAQ, contact us', icon: <IconChat size={16} stroke={2} />, tint: 'rgba(16,185,129,0.10)', color: '#047857', onClick: () => onNavigate(ViewEnum.SUPPORT) },
              ...(onLogout ? [{ key: 'logout', label: 'Log out', sub: 'End this session', icon: <IconArrowUpRight size={16} stroke={2} />, tint: 'rgba(220,38,38,0.10)', color: '#DC2626', onClick: () => onLogout() }] : [])
            ].map((row) => (
              <li key={row.key}>
                <button
                  type="button"
                  onClick={row.onClick}
                  className="w-full flex items-center gap-3 px-2.5 py-3.5 rounded-xl active:bg-slate-50 transition-colors"
                >
                  <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: row.tint, color: row.color }}>
                    {row.icon}
                  </span>
                  <span className="flex-1 min-w-0 text-left">
                    <span className="flex items-center gap-2">
                      <span className={`text-[13.5px] font-semibold truncate tracking-tight ${row.key === 'logout' ? 'text-rose-600' : 'text-slate-900'}`} style={{ letterSpacing: '-0.01em' }}>
                        {row.label}
                      </span>
                      {typeof row.badge === 'number' && row.badge > 0 && (
                        <span
                          className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold text-white"
                          style={{ background: '#FF6B35' }}
                        >
                          {row.badge > 9 ? '9+' : row.badge}
                        </span>
                      )}
                    </span>
                    <span className="block text-[11.5px] text-slate-500 truncate font-medium mt-0.5">{row.sub}</span>
                  </span>
                  <span className="text-slate-300 shrink-0">
                    <IconChevronRight size={16} stroke={2} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  const renderNotifications = () => {
    const filteredNotifications = userNotifications.length > 0 ? userNotifications : notifications;
    const cardStyle: React.CSSProperties = {
      background: '#FFFFFF',
      border: '1px solid rgba(15,23,42,0.06)',
      boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.20)'
    };
    const meta = (n: Notification) => {
      if (n.targetType === 'conversation') {
        return { title: 'New message', icon: <IconChat size={15} stroke={2} />, tint: 'rgba(16,185,129,0.10)', color: '#047857' };
      }
      if (n.targetType === 'vehicle') {
        return { title: 'Vehicle update', icon: <IconCar size={15} stroke={2} />, tint: 'rgba(37,99,235,0.10)', color: '#1D4ED8' };
      }
      return { title: 'Notification', icon: <IconBell size={15} stroke={2} />, tint: 'rgba(255,107,53,0.10)', color: '#EA580C' };
    };

    return (
      <div className="space-y-4 pb-4">
        {/* Section header */}
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-slate-400">Inbox</p>
            <h3 className="text-[19px] font-semibold text-slate-900 tracking-tight" style={{ letterSpacing: '-0.02em' }}>Notifications</h3>
            <p className="text-[11.5px] text-slate-500 mt-0.5 font-medium">
              {filteredNotifications.length} total · {unreadNotifications.length} unread
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate(ViewEnum.NOTIFICATIONS_CENTER)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 active:scale-95 transition-transform"
            >
              Grouped view
              <IconArrowUpRight size={11} stroke={2.4} />
            </button>
            {unreadNotifications.length > 0 && onMarkNotificationsAsRead && (
              <button
                type="button"
                onClick={() => onMarkNotificationsAsRead(unreadNotifications.map(n => n.id))}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold active:scale-95 transition-transform"
                style={{ background: 'rgba(255,107,53,0.10)', color: '#EA580C' }}
              >
                <IconCheck size={12} stroke={2.4} />
                Mark all read
              </button>
            )}
          </div>
        </div>

        {filteredNotifications.length === 0 ? (
          <div
            className="relative overflow-hidden rounded-3xl px-6 py-12 text-center"
            style={{ background: 'linear-gradient(180deg, #FFFFFF, #FAFAFC)', border: '1px solid rgba(15,23,42,0.06)' }}
          >
            <div
              className="w-14 h-14 mx-auto mb-3 rounded-2xl grid place-items-center"
              style={{ background: 'linear-gradient(135deg, rgba(255,107,53,0.10), rgba(255,132,86,0.18))', color: '#EA580C' }}
            >
              <IconBell size={24} stroke={1.7} />
            </div>
            <h4 className="text-[16px] font-semibold text-slate-900 mb-1 tracking-tight" style={{ letterSpacing: '-0.01em' }}>
              All caught up
            </h4>
            <p className="text-[12.5px] text-slate-500 leading-relaxed max-w-sm mx-auto font-medium">
              New notifications will appear here.
            </p>
          </div>
        ) : (
          <div className="rounded-3xl overflow-hidden" style={cardStyle}>
            <ul className="divide-y divide-slate-100">
              {filteredNotifications.map((notification) => {
                const m = meta(notification);
                const isUnread = !notification.isRead;
                return (
                  <li
                    key={notification.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (onNotificationClick) onNotificationClick(notification);
                      if (isUnread && onMarkNotificationsAsRead) onMarkNotificationsAsRead([notification.id]);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (onNotificationClick) onNotificationClick(notification);
                        if (isUnread && onMarkNotificationsAsRead) onMarkNotificationsAsRead([notification.id]);
                      }
                    }}
                    className="relative px-4 py-3.5 active:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {isUnread && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-3.5 bottom-3.5 w-[3px] rounded-r-full"
                        style={{ background: 'linear-gradient(180deg, #FF8456, #FF6B35)' }}
                      />
                    )}
                    <div className="flex items-start gap-3">
                      <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0 mt-0.5" style={{ background: m.tint, color: m.color }}>
                        {m.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={`text-[13px] truncate tracking-tight ${isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`} style={{ letterSpacing: '-0.01em' }}>
                            {m.title}
                          </h4>
                          {isUnread && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#FF6B35' }} />}
                        </div>
                        <p className={`text-[12.5px] mt-0.5 leading-snug ${isUnread ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                          {notification.message}
                        </p>
                        <p className="text-[10.5px] text-slate-400 mt-1 font-medium">
                          {new Date(notification.timestamp).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            ...(new Date(notification.timestamp).getFullYear() !== new Date().getFullYear() && { year: 'numeric' })
                          })}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const handleAddFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setAddFormData(prev => ({
      ...prev,
      [name]: name === 'year' || name === 'price' || name === 'mileage' || name === 'noOfOwners' || name === 'registrationYear'
        ? (value === '' ? 0 : Number(value))
        : value
    }));
    // Clear error when user starts typing
    if (addErrors[name]) {
      setAddErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateAddForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!addFormData.make || addFormData.make.trim() === '') {
      newErrors.make = t('sellerListing.error.makeRequired');
    }
    if (!addFormData.model || addFormData.model.trim() === '') {
      newErrors.model = t('sellerListing.error.modelRequired');
    }
    if (!addFormData.year || addFormData.year < 1900 || addFormData.year > new Date().getFullYear() + 1) {
      newErrors.year = t('sellerListing.error.year');
    }
    if (!addFormData.price || addFormData.price <= 0) {
      newErrors.price = t('sellerListing.error.price');
    }
    if (addFormData.mileage < 0) {
      newErrors.mileage = t('sellerListing.error.mileage');
    }

    setAddErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateAddForm()) {
      return;
    }

    setIsAddingVehicle(true);
    try {
      if (onAddVehicle) {
        await onAddVehicle(addFormData, false);
        setAddFormData(initialAddFormData);
        setActiveTab('listings');
      }
    } catch (error) {
      console.error('Failed to add vehicle:', error);
    } finally {
      setIsAddingVehicle(false);
    }
  };

  const renderAddVehicle = () => {

    return (
      <div className="space-y-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setActiveTab('listings')}
              aria-label="Back to listings"
              className="w-9 h-9 rounded-full grid place-items-center text-slate-700 active:scale-95 transition-transform shrink-0"
              style={{ background: 'rgba(15,23,42,0.05)', border: '1px solid rgba(15,23,42,0.06)' }}
            >
              <IconChevronRight size={16} stroke={2.2} className="rotate-180" />
            </button>
            <div className="min-w-0">
              <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-slate-400">New listing</p>
              <h3 className="text-[19px] font-semibold text-slate-900 tracking-tight truncate" style={{ letterSpacing: '-0.02em' }}>
                {t('sellerListing.addTitle')}
              </h3>
              <p className="text-[11.5px] text-slate-500 mt-0.5 font-medium">{t('sellerListing.addSubtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('listings')}
            className="w-9 h-9 rounded-full grid place-items-center text-slate-500 active:scale-95 transition-transform shrink-0"
            style={{ background: 'rgba(15,23,42,0.05)', border: '1px solid rgba(15,23,42,0.06)' }}
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={handleAddSubmit}
          className="rounded-3xl p-5 space-y-6"
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(15,23,42,0.06)',
            boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.20)'
          }}
        >
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="font-bold text-gray-900 text-base border-b border-gray-200 pb-3">{t('sellerListing.section.basic')}</h4>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('sellerListing.label.make')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="make"
                value={addFormData.make}
                onChange={handleAddFormChange}
                placeholder={t('sellerListing.placeholder.make')}
                className={`native-input ${addErrors.make ? 'bg-red-50' : ''}`}
                required
              />
              {addErrors.make && <p className="text-red-600 text-xs mt-1.5 font-medium">{addErrors.make}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('sellerListing.label.model')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="model"
                value={addFormData.model}
                onChange={handleAddFormChange}
                placeholder={t('sellerListing.placeholder.model')}
                className={`native-input ${addErrors.model ? 'bg-red-50' : ''}`}
                required
              />
              {addErrors.model && <p className="text-red-600 text-xs mt-1.5 font-medium">{addErrors.model}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('sellerListing.label.year')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="year"
                  value={addFormData.year}
                  onChange={handleAddFormChange}
                  placeholder={t('sellerListing.placeholder.year')}
                  min="1900"
                  max={new Date().getFullYear() + 1}
                  className={`native-input ${addErrors.year ? 'bg-red-50' : ''}`}
                  required
                />
                {addErrors.year && <p className="text-red-600 text-xs mt-1.5 font-medium">{addErrors.year}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('sellerListing.label.variant')}
                </label>
                <input
                  type="text"
                  name="variant"
                  value={addFormData.variant || ''}
                  onChange={handleAddFormChange}
                  placeholder={t('sellerListing.placeholder.variant')}
                  className="native-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('sellerListing.label.price')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="price"
                  value={addFormData.price || ''}
                  onChange={handleAddFormChange}
                  placeholder={t('sellerListing.placeholder.price')}
                  min="0"
                  className={`native-input ${addErrors.price ? 'bg-red-50' : ''}`}
                  required
                />
                {addErrors.price && <p className="text-red-600 text-xs mt-1.5 font-medium">{addErrors.price}</p>}
                {safeAllVehicles.length > 0 && (
                  <div className="mt-2">
                    <PricingGuidance vehicleDetails={addFormData} allVehicles={safeAllVehicles} />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('sellerListing.label.mileage')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="mileage"
                  value={addFormData.mileage || ''}
                  onChange={handleAddFormChange}
                  placeholder={t('sellerListing.placeholder.mileage')}
                  min="0"
                  className={`native-input ${addErrors.mileage ? 'bg-red-50' : ''}`}
                  required
                />
                {addErrors.mileage && <p className="text-red-600 text-xs mt-1.5 font-medium">{addErrors.mileage}</p>}
              </div>
            </div>
          </div>

          {/* Specifications */}
          <div className="space-y-4 pt-6 border-t border-gray-200">
            <h4 className="font-bold text-gray-900 text-base border-b border-gray-200 pb-3">{t('sellerListing.section.specs')}</h4>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('sellerListing.label.fuelType')}
              </label>
              <select
                name="fuelType"
                value={addFormData.fuelType}
                onChange={handleAddFormChange}
                className="native-input bg-white"
              >
                <option value="Petrol">{t('sellerListing.fuel.petrol')}</option>
                <option value="Diesel">{t('sellerListing.fuel.diesel')}</option>
                <option value="Electric">{t('sellerListing.fuel.electric')}</option>
                <option value="Hybrid">{t('sellerListing.fuel.hybrid')}</option>
                <option value="CNG">{t('sellerListing.fuel.cng')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('sellerListing.label.transmission')}
              </label>
              <select
                name="transmission"
                value={addFormData.transmission}
                onChange={handleAddFormChange}
                className="native-input bg-white"
              >
                <option value="Manual">{t('sellerListing.transmission.manual')}</option>
                <option value="Automatic">{t('sellerListing.transmission.automatic')}</option>
                <option value="AMT">{t('sellerListing.transmission.amt')}</option>
                <option value="CVT">{t('sellerListing.transmission.cvt')}</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('sellerListing.label.color')}
                </label>
                <input
                  type="text"
                  name="color"
                  value={addFormData.color || ''}
                  onChange={handleAddFormChange}
                  placeholder={t('sellerListing.placeholder.color')}
                  className="native-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('sellerListing.label.owners')}
                </label>
                <input
                  type="number"
                  name="noOfOwners"
                  value={addFormData.noOfOwners || 1}
                  onChange={handleAddFormChange}
                  className="native-input"
                  min="1"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4 pt-6 border-t border-gray-200">
            <h4 className="font-bold text-gray-900 text-base border-b border-gray-200 pb-3">{t('sellerListing.section.location')}</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('sellerListing.label.city')}
                </label>
                <input
                  type="text"
                  name="city"
                  value={addFormData.city || ''}
                  onChange={handleAddFormChange}
                  placeholder={t('sellerListing.placeholder.city')}
                  className="native-input"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('sellerListing.label.state')}
                </label>
                <input
                  type="text"
                  name="state"
                  value={addFormData.state || ''}
                  onChange={handleAddFormChange}
                  placeholder={t('sellerListing.placeholder.state')}
                  className="native-input"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4 pt-6 border-t border-gray-200">
            <h4 className="font-bold text-gray-900 text-base border-b border-gray-200 pb-3">{t('sellerListing.section.description')}</h4>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('sellerListing.label.description')}
              </label>
              <textarea
                name="description"
                value={addFormData.description || ''}
                onChange={handleAddFormChange}
                rows={4}
                placeholder={t('sellerListing.placeholder.description')}
                className="native-input resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setActiveTab('listings')}
              className="flex-1 native-button native-button-secondary"
            >
              {t('sellerListing.cancel')}
            </button>
            <button
              type="submit"
              disabled={isAddingVehicle}
              className="flex-1 native-button native-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAddingVehicle ? t('sellerListing.submitting') : t('sellerListing.submit')}
            </button>
          </div>
        </form>
      </div>
    );
  };

  const renderEditVehicle = () => {
    const editHeader = (
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setActiveTab('listings')}
            aria-label="Back to listings"
            className="w-9 h-9 rounded-full grid place-items-center text-slate-700 active:scale-95 transition-transform shrink-0"
            style={{ background: 'rgba(15,23,42,0.05)', border: '1px solid rgba(15,23,42,0.06)' }}
          >
            <IconChevronRight size={16} stroke={2.2} className="rotate-180" />
          </button>
          <div className="min-w-0">
            <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-slate-400">Listing</p>
            <h3 className="text-[19px] font-semibold text-slate-900 tracking-tight truncate" style={{ letterSpacing: '-0.02em' }}>
              {t('sellerListing.editTitle')}
            </h3>
            {editingVehicle && (
              <p className="text-[11.5px] text-slate-500 mt-0.5 font-medium truncate">
                {editingVehicle.year} {editingVehicle.make} {editingVehicle.model}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setActiveTab('listings')}
          className="w-9 h-9 rounded-full grid place-items-center text-slate-500 active:scale-95 transition-transform shrink-0"
          style={{ background: 'rgba(15,23,42,0.05)', border: '1px solid rgba(15,23,42,0.06)' }}
          aria-label={t('common.close')}
        >
          ✕
        </button>
      </div>
    );

    const emptyState = (
      <div
        className="rounded-3xl px-6 py-10 text-center"
        style={{
          background: 'linear-gradient(180deg, #FFFFFF, #FAFAFC)',
          border: '1px solid rgba(15,23,42,0.06)',
          boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.20)'
        }}
      >
        <div
          className="w-14 h-14 mx-auto mb-3 rounded-2xl grid place-items-center"
          style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.05), rgba(15,23,42,0.10))', color: '#475569' }}
        >
          <IconCar size={24} stroke={1.7} />
        </div>
        <p className="text-[13px] text-slate-600 font-medium">{t('sellerListing.editNoSelection')}</p>
      </div>
    );

    if (!editingVehicle) {
      return (
        <div className="space-y-4 pb-4">
          {editHeader}
          {emptyState}
        </div>
      );
    }

    const formData = editFormData || editingVehicle;
    if (!formData) {
      return (
        <div className="space-y-4 pb-4">
          {editHeader}
          {emptyState}
        </div>
      );
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setEditFormData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          [name]: name === 'year' || name === 'price' || name === 'mileage' || name === 'noOfOwners' || name === 'registrationYear'
            ? (value === '' ? 0 : Number(value))
            : value
        };
      });
      // Clear error when user starts typing
      if (editErrors[name]) {
        setEditErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }
    };

    const validateForm = (): boolean => {
      const newErrors: Record<string, string> = {};
      
      if (!formData.make || formData.make.trim() === '') {
        newErrors.make = t('sellerListing.error.makeRequired');
      }
      if (!formData.model || formData.model.trim() === '') {
        newErrors.model = t('sellerListing.error.modelRequired');
      }
      if (!formData.year || formData.year < 1900 || formData.year > new Date().getFullYear() + 1) {
        newErrors.year = t('sellerListing.error.year');
      }
      if (!formData.price || formData.price <= 0) {
        newErrors.price = t('sellerListing.error.price');
      }
      if (formData.mileage < 0) {
        newErrors.mileage = t('sellerListing.error.mileage');
      }

      setEditErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!formData || !validateForm()) {
        return;
      }

      setIsSubmitting(true);
      try {
        if (onUpdateVehicle) {
          await onUpdateVehicle(formData);
          setEditingVehicle(null);
          setActiveTab('listings');
        }
      } catch (error) {
        console.error('Failed to update vehicle:', error);
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
    <div className="space-y-4 pb-4">
      {editHeader}

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl p-5 space-y-6"
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(15,23,42,0.06)',
            boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.20)'
          }}
        >
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900 border-b pb-2">{t('sellerListing.section.basic')}</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('sellerListing.label.make')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="make"
                value={formData.make}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg ${editErrors.make ? 'border-red-500' : 'border-gray-300'}`}
                required
              />
              {editErrors.make && <p className="text-red-500 text-xs mt-1">{editErrors.make}</p>}
          </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('sellerListing.label.model')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg ${editErrors.model ? 'border-red-500' : 'border-gray-300'}`}
                required
              />
              {editErrors.model && <p className="text-red-500 text-xs mt-1">{editErrors.model}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('sellerListing.label.year')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="year"
                  value={formData.year}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg ${editErrors.year ? 'border-red-500' : 'border-gray-300'}`}
                  required
                />
                {editErrors.year && <p className="text-red-500 text-xs mt-1">{editErrors.year}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('sellerListing.label.variant')}
                </label>
                <input
                  type="text"
                  name="variant"
                  value={formData.variant || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('sellerListing.label.price')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg ${editErrors.price ? 'border-red-500' : 'border-gray-300'}`}
                  required
                />
                {editErrors.price && <p className="text-red-500 text-xs mt-1">{editErrors.price}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('sellerListing.label.mileage')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="mileage"
                  value={formData.mileage}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg ${editErrors.mileage ? 'border-red-500' : 'border-gray-300'}`}
                  required
                />
                {editErrors.mileage && <p className="text-red-500 text-xs mt-1">{editErrors.mileage}</p>}
              </div>
            </div>
          </div>

          {/* Specifications */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-semibold text-gray-900">{t('sellerListing.section.specs')}</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('sellerListing.label.fuelType')}
              </label>
              <select
                name="fuelType"
                value={formData.fuelType}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="Petrol">{t('sellerListing.fuel.petrol')}</option>
                <option value="Diesel">{t('sellerListing.fuel.diesel')}</option>
                <option value="Electric">{t('sellerListing.fuel.electric')}</option>
                <option value="Hybrid">{t('sellerListing.fuel.hybrid')}</option>
                <option value="CNG">{t('sellerListing.fuel.cng')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('sellerListing.label.transmission')}
              </label>
              <select
                name="transmission"
                value={formData.transmission}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="Manual">{t('sellerListing.transmission.manual')}</option>
                <option value="Automatic">{t('sellerListing.transmission.automatic')}</option>
                <option value="AMT">{t('sellerListing.transmission.amt')}</option>
                <option value="CVT">{t('sellerListing.transmission.cvt')}</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('sellerListing.label.color')}
                </label>
                <input
                  type="text"
                  name="color"
                  value={formData.color || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('sellerListing.label.owners')}
                </label>
                <input
                  type="number"
                  name="noOfOwners"
                  value={formData.noOfOwners || 1}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min="1"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-semibold text-gray-900">{t('sellerListing.section.location')}</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('sellerListing.label.city')}
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('sellerListing.label.state')}
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-semibold text-gray-900">{t('sellerListing.section.description')}</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('sellerListing.label.description')}
              </label>
              <textarea
                name="description"
                value={formData.description || ''}
                onChange={handleChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder={t('sellerListing.placeholder.description')}
              />
            </div>
          </div>

          {/* Listing offer */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-semibold text-gray-900">{t('sellerListing.section.offer')}</h4>
            <p className="text-xs text-gray-600">{t('sellerListing.offer.hint')}</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!formData.offerEnabled}
                onChange={(e) =>
                  setEditFormData((prev) => (prev ? { ...prev, offerEnabled: e.target.checked } : prev))
                }
                className="h-5 w-5 rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-800">{t('sellerListing.offer.enable')}</span>
            </label>
            <div className={`space-y-3 ${formData.offerEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('sellerListing.label.offerTitle')}</label>
                <input
                  type="text"
                  name="offerTitle"
                  value={formData.offerTitle ?? ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder={t('vehicle.detail.offer.specialOffer')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('sellerListing.label.offerStartDate')}</label>
                  <input
                    type="date"
                    name="offerStartDate"
                    value={formData.offerStartDate ?? ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('sellerListing.label.offerEndDate')}</label>
                  <input
                    type="date"
                    name="offerEndDate"
                    value={formData.offerEndDate ?? ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('sellerListing.label.offerDateLabel')}</label>
                <input
                  type="text"
                  name="offerDateLabel"
                  value={formData.offerDateLabel ?? ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder={t('sellerListing.placeholder.offerDateLabel')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('sellerListing.label.offerDescription')}</label>
                <input
                  type="text"
                  name="offerDescription"
                  value={formData.offerDescription ?? ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder={t('vehicle.detail.offer.loanOffersOnAllCars')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('sellerListing.label.offerHighlight')}</label>
                <input
                  type="text"
                  name="offerHighlight"
                  value={formData.offerHighlight ?? ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder={t('vehicle.detail.offer.roiStartingAt')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('sellerListing.label.offerDisclaimer')}</label>
                <input
                  type="text"
                  name="offerDisclaimer"
                  value={formData.offerDisclaimer ?? ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder={t('sellerListing.placeholder.offerDisclaimer')}
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-semibold text-gray-900">{t('sellerListing.section.listingStatus')}</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('sellerListing.label.status')}
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="published">{t('sellerListing.status.published')}</option>
                <option value="unpublished">{t('sellerListing.status.unpublished')}</option>
                <option value="sold">{t('sellerListing.status.sold')}</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
          <button 
              type="button"
              onClick={() => setActiveTab('listings')}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
            >
              {t('sellerListing.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t('sellerListing.saving') : t('sellerListing.saveChanges')}
          </button>
        </div>
        </form>
    </div>
  );
  };

  // Render Sales History View
  const renderSalesHistory = () => {
    const soldVehicles = safeUserVehicles.filter(v => v && v.status === 'sold');
    const totalSalesValue = soldVehicles.reduce((sum, v) => sum + (v?.price || 0), 0);
    const formatPriceInr = (n: number) => (n >= 10000000
      ? `${(n / 10000000).toFixed(2)} Cr`
      : n >= 100000 ? `${(n / 100000).toFixed(2)} L` : n.toLocaleString('en-IN'));
    const avgSale = soldVehicles.length > 0 ? totalSalesValue / soldVehicles.length : 0;

    return (
      <div className="space-y-4 pb-4">
        {/* Section header */}
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-slate-400">Revenue</p>
          <h3 className="text-[19px] font-semibold text-slate-900 tracking-tight" style={{ letterSpacing: '-0.02em' }}>Sales history</h3>
          <p className="text-[11.5px] text-slate-500 mt-0.5 font-medium">{soldVehicles.length} vehicles sold to date</p>
        </div>

        {/* Premium revenue card (obsidian + emerald accent) */}
        <div
          className="relative overflow-hidden rounded-3xl text-white p-5"
          style={{
            background: 'linear-gradient(135deg, #14141C 0%, #0B0B11 100%)',
            border: '1px solid rgba(16,185,129,0.22)',
            boxShadow: '0 20px 50px -22px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)'
          }}
        >
          <div
            aria-hidden
            className="absolute -right-20 -top-20 w-72 h-72 rounded-full"
            style={{ background: 'radial-gradient(closest-side, rgba(16,185,129,0.25), transparent 70%)' }}
          />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-7 h-7 grid place-items-center rounded-lg"
                style={{ background: 'linear-gradient(135deg, #6EE7B7, #10B981)', color: '#053B27', boxShadow: '0 6px 14px -6px rgba(16,185,129,0.55)' }}
              >
                <IconCheck size={15} stroke={2.2} />
              </span>
              <span className="text-[10.5px] uppercase tracking-[0.20em] text-emerald-200/85 font-semibold">Total revenue</span>
            </div>
            <p className="text-[34px] font-bold tracking-tight leading-none text-white" style={{ letterSpacing: '-0.03em' }}>
              ₹{formatPriceInr(totalSalesValue)}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/45 font-semibold">Vehicles</p>
                <p className="mt-1 text-[16px] font-bold text-white tracking-tight">{soldVehicles.length}</p>
              </div>
              <div className="rounded-2xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/45 font-semibold">Avg. price</p>
                <p className="mt-1 text-[16px] font-bold text-white tracking-tight">₹{formatPriceInr(avgSale)}</p>
              </div>
            </div>
          </div>
        </div>

        {soldVehicles.length === 0 ? (
          <div
            className="relative overflow-hidden rounded-3xl px-6 py-12 text-center"
            style={{ background: 'linear-gradient(180deg, #FFFFFF, #FAFAFC)', border: '1px solid rgba(15,23,42,0.06)' }}
          >
            <div
              className="w-14 h-14 mx-auto mb-3 rounded-2xl grid place-items-center"
              style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.10), rgba(5,150,105,0.18))', color: '#047857' }}
            >
              <IconCheck size={24} stroke={1.7} />
            </div>
            <h4 className="text-[16px] font-semibold text-slate-900 mb-1 tracking-tight" style={{ letterSpacing: '-0.01em' }}>
              No sales yet
            </h4>
            <p className="text-[12.5px] text-slate-500 leading-relaxed max-w-sm mx-auto font-medium">
              Vehicles marked as sold will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {soldVehicles.map((vehicle) => {
              const heroImage = (vehicle.images && vehicle.images[0]) || '';
              return (
                <div
                  key={vehicle.id}
                  className="relative rounded-2xl p-3.5"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid rgba(15,23,42,0.06)',
                    boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.20)'
                  }}
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className="relative w-[80px] h-[80px] rounded-xl overflow-hidden shrink-0 grid place-items-center"
                      style={{ background: 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)', border: '1px solid rgba(15,23,42,0.05)' }}
                    >
                      {heroImage ? (
                        <img src={heroImage} alt="" loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-slate-400"><IconCar size={28} stroke={1.6} /></span>
                      )}
                      <span
                        className="absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-[3px] text-[9px] font-bold uppercase tracking-wider"
                        style={{ background: 'rgba(16,185,129,0.92)', color: '#FFFFFF' }}
                      >
                        Sold
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-900 text-[14.5px] truncate tracking-tight" style={{ letterSpacing: '-0.01em' }}>
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </h4>
                      <p className="text-[17px] font-bold text-emerald-600 mt-1.5 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                        ₹{vehicle.price.toLocaleString('en-IN')}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-500 font-medium flex-wrap">
                        {vehicle.mileage ? <span>{vehicle.mileage.toLocaleString('en-IN')} km</span> : null}
                        {vehicle.soldAt && (
                          <span>
                            Sold {new Date(vehicle.soldAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                    {onMarkAsUnsold && (
                      <button
                        type="button"
                        onClick={() => onMarkAsUnsold(vehicle.id)}
                        title="Mark as unsold"
                        aria-label="Mark as unsold"
                        className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold active:scale-95 transition-transform"
                        style={{ background: 'rgba(37,99,235,0.08)', color: '#1D4ED8' }}
                      >
                        <IconArrowUpRight size={13} stroke={2.2} className="rotate-180" />
                        Unsold
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Render Reports View
  const renderReports = () => (
    <div className="space-y-4 pb-4">
      {/* Section header */}
      <div>
        <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-slate-400">Compliance</p>
        <h3 className="text-[19px] font-semibold text-slate-900 tracking-tight" style={{ letterSpacing: '-0.02em' }}>Reported listings</h3>
        <p className="text-[11.5px] text-slate-500 mt-0.5 font-medium">
          {safeReportedVehicles.length === 0 ? 'All clear' : `${safeReportedVehicles.length} flagged listings need review`}
        </p>
      </div>

      {safeReportedVehicles.length === 0 ? (
        <div
          className="relative overflow-hidden rounded-3xl px-6 py-12 text-center"
          style={{ background: 'linear-gradient(180deg, #FFFFFF, #FAFAFC)', border: '1px solid rgba(15,23,42,0.06)' }}
        >
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.45), transparent)' }}
          />
          <div
            className="w-14 h-14 mx-auto mb-3 rounded-2xl grid place-items-center"
            style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.10), rgba(5,150,105,0.18))', color: '#047857' }}
          >
            <IconShield size={24} stroke={1.8} />
          </div>
          <h4 className="text-[16px] font-semibold text-slate-900 mb-1 tracking-tight" style={{ letterSpacing: '-0.01em' }}>
            No reports
          </h4>
          <p className="text-[12.5px] text-slate-500 leading-relaxed max-w-sm mx-auto font-medium">
            All your listings are in good standing.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {safeReportedVehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className="relative rounded-2xl p-3.5 overflow-hidden"
              style={{
                background: '#FFFFFF',
                border: '1px solid rgba(220,38,38,0.18)',
                boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.20)'
              }}
            >
              <div
                aria-hidden
                className="absolute left-0 top-0 h-full w-[3px]"
                style={{ background: 'linear-gradient(180deg, #FCA5A5, #DC2626)' }}
              />
              <div className="flex items-start gap-3.5">
                <div
                  className="w-[72px] h-[72px] rounded-xl grid place-items-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, rgba(220,38,38,0.08), rgba(220,38,38,0.18))', color: '#DC2626' }}
                >
                  <IconCar size={26} stroke={1.7} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-slate-900 text-[14.5px] truncate tracking-tight" style={{ letterSpacing: '-0.01em' }}>
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </h4>
                    <span
                      className="shrink-0 px-2 py-[3px] rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: 'rgba(220,38,38,0.10)', color: '#B91C1C' }}
                    >
                      Flagged
                    </span>
                  </div>
                  {vehicle.flagReason && (
                    <p className="text-[12.5px] text-rose-700 mt-1.5 font-medium">
                      <span className="text-rose-500/80">Reason: </span>{vehicle.flagReason}
                    </p>
                  )}
                  {vehicle.flaggedAt && (
                    <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
                      Flagged on {new Date(vehicle.flaggedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render Settings View with Bank Partners
  const renderSettings = () => {
    const availableBanks = [
      'HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank',
      'Bajaj Finserv', 'Tata Capital', 'Mahindra Finance', 'Yes Bank', 'IDFC First Bank',
      'Bank of Baroda', 'Punjab National Bank', 'Union Bank of India', 'Canara Bank', 'Indian Bank'
    ];

    const handleBankToggle = (bank: string) => {
      setSelectedBanks(prev => 
        prev.includes(bank) 
          ? prev.filter(b => b !== bank)
          : [...prev, bank]
      );
    };

    const handleSaveBanks = async () => {
      if (!onUpdateSellerProfile) return;
      setIsSavingBanks(true);
      try {
        await onUpdateSellerProfile({
          dealershipName: currentUser?.dealershipName || '',
          bio: currentUser?.bio || '',
          logoUrl: currentUser?.logoUrl || '',
          partnerBanks: selectedBanks
        });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        addToast?.('Bank partners updated successfully!', 'success');
      } catch (error) {
        addToast?.('Failed to update bank partners', 'error');
      } finally {
        setIsSavingBanks(false);
      }
    };

    const cardStyle: React.CSSProperties = {
      background: '#FFFFFF',
      border: '1px solid rgba(15,23,42,0.06)',
      boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.20)'
    };

    const settingRows: { key: string; label: string; sub: string; icon: React.ReactNode; tint: string; color: string; onClick: () => void }[] = [
      {
        key: 'profile',
        label: 'Edit profile',
        sub: 'Personal & dealership details',
        icon: <IconEdit size={16} stroke={2} />,
        tint: 'rgba(37,99,235,0.10)',
        color: '#2563EB',
        onClick: () => setActiveTab('profile')
      },
      {
        key: 'privacy',
        label: 'Privacy & security',
        sub: 'Manage account safety',
        icon: <IconShield size={16} stroke={2} />,
        tint: 'rgba(71,85,105,0.10)',
        color: '#475569',
        onClick: () => onNavigate(ViewEnum.SUPPORT)
      },
      {
        key: 'help',
        label: 'Help & support',
        sub: 'FAQ, contact us',
        icon: <IconChat size={16} stroke={2} />,
        tint: 'rgba(16,185,129,0.10)',
        color: '#047857',
        onClick: () => onNavigate(ViewEnum.SUPPORT)
      },
      ...(onLogout ? [{
        key: 'logout',
        label: 'Sign out',
        sub: 'End this session',
        icon: <IconArrowUpRight size={16} stroke={2} />,
        tint: 'rgba(220,38,38,0.10)',
        color: '#DC2626',
        onClick: () => onLogout()
      }] : [])
    ];

    return (
      <div className="space-y-4 pb-4">
        {/* Section header */}
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-slate-400">Account</p>
          <h3 className="text-[19px] font-semibold text-slate-900 tracking-tight" style={{ letterSpacing: '-0.02em' }}>Settings</h3>
          <p className="text-[11.5px] text-slate-500 mt-0.5 font-medium">Manage your preferences and finance partners</p>
        </div>

        {/* Bank Partners */}
        {isSeller && (
          <div className="rounded-3xl p-5" style={cardStyle}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-semibold text-slate-900 text-[15px] tracking-tight" style={{ letterSpacing: '-0.01em' }}>
                  {t('vehicle.detail.financePartners.title')}
                </h4>
                <p className="text-[11.5px] text-slate-500 mt-0.5 font-medium leading-snug max-w-xs">
                  Banks you partner with for financing. Shown on your listings.
                </p>
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-[0.16em] px-2 py-1 rounded-full"
                style={{ background: 'rgba(139,92,246,0.10)', color: '#7C3AED' }}
              >
                {selectedBanks.length} active
              </span>
            </div>

            {selectedBanks.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {selectedBanks.map((bank) => (
                  <span
                    key={bank}
                    className="inline-flex items-center gap-1.5 rounded-full pl-3 pr-1.5 py-1 text-[11.5px] font-semibold"
                    style={{ background: 'rgba(139,92,246,0.08)', color: '#5B21B6', border: '1px solid rgba(139,92,246,0.18)' }}
                  >
                    {bank}
                    <button
                      type="button"
                      onClick={() => handleBankToggle(bank)}
                      aria-label={`Remove ${bank}`}
                      className="w-4 h-4 rounded-full grid place-items-center text-[12px] leading-none"
                      style={{ background: 'rgba(139,92,246,0.18)', color: '#5B21B6' }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mb-4 max-h-[360px] overflow-y-auto pr-1">
              {availableBanks.map((bank) => {
                const isSelected = selectedBanks.includes(bank);
                return (
                  <label
                    key={bank}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors active:scale-[0.99]"
                    style={{
                      background: isSelected ? 'rgba(139,92,246,0.08)' : 'rgba(15,23,42,0.025)',
                      border: `1px solid ${isSelected ? 'rgba(139,92,246,0.30)' : 'rgba(15,23,42,0.06)'}`
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleBankToggle(bank)}
                      className="sr-only"
                    />
                    <span
                      className="shrink-0 w-4.5 h-4.5 rounded-md grid place-items-center"
                      style={{
                        width: 18, height: 18,
                        background: isSelected ? '#7C3AED' : '#FFFFFF',
                        border: `1.5px solid ${isSelected ? '#7C3AED' : 'rgba(15,23,42,0.20)'}`
                      }}
                    >
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 20 20" fill="white">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </span>
                    <span
                      className="text-[12px] font-semibold truncate"
                      style={{ color: isSelected ? '#5B21B6' : '#334155' }}
                    >
                      {bank}
                    </span>
                  </label>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleSaveBanks}
              disabled={isSavingBanks}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl py-3 text-[13.5px] font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-70"
              style={{
                background: saveSuccess
                  ? 'linear-gradient(135deg, #34D399, #10B981)'
                  : 'linear-gradient(135deg, #14141C 0%, #0B0B11 100%)',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 14px 30px -14px rgba(11,11,15,0.55)'
              }}
            >
              {isSavingBanks ? 'Saving…' : saveSuccess ? (<><IconCheck size={15} stroke={2.4} /> Saved</>) : 'Save changes'}
            </button>
          </div>
        )}

        {/* Account rows */}
        <div className="rounded-3xl p-2.5" style={cardStyle}>
          <div className="px-2.5 pt-2 pb-1">
            <p className="text-[10.5px] uppercase tracking-[0.16em] text-slate-400 font-semibold">Account</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {settingRows.map((row) => (
              <li key={row.key}>
                <button
                  type="button"
                  onClick={row.onClick}
                  className="w-full flex items-center gap-3 px-2.5 py-3.5 rounded-xl active:bg-slate-50 transition-colors"
                >
                  <span
                    className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
                    style={{ background: row.tint, color: row.color }}
                  >
                    {row.icon}
                  </span>
                  <span className="flex-1 min-w-0 text-left">
                    <span className="block text-[13.5px] font-semibold text-slate-900 truncate tracking-tight" style={{ letterSpacing: '-0.01em' }}>
                      {row.label}
                    </span>
                    <span className="block text-[11.5px] text-slate-500 truncate font-medium mt-0.5">{row.sub}</span>
                  </span>
                  <span className="text-slate-300 shrink-0">
                    <IconChevronRight size={16} stroke={2} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* App version footer */}
        <p className="text-center text-[10.5px] text-slate-400 font-medium tracking-wide pt-2">
          Reride · Premium Seller Hub
        </p>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'listings': return renderListings();
      case 'messages': return isSeller ? renderMessagesHub() : renderOverview();
      case 'analytics': return renderAnalytics();
      case 'salesHistory': return renderSalesHistory();
      case 'reports': return renderReports();
      case 'settings': return renderSettings();
      case 'profile': return renderProfile();
      case 'notifications': return renderNotifications();
      case 'addVehicle': return renderAddVehicle();
      case 'editVehicle': return renderEditVehicle();
      default: return renderOverview();
    }
  };

  return (
    <div className="w-full bg-gradient-to-b from-gray-50 to-white min-h-screen">
      {/* Premium Dashboard Header — Obsidian luxe */}
      {(() => {
        const headerUnread = notifications.filter(n => n && n.recipientEmail === currentUser.email && !n.isRead).length;
        const todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' });
        const hr = new Date().getHours();
        const greeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
        const firstName = currentUser.name?.split(' ')[0] || 'there';
        const initials = (currentUser.name || 'U').split(' ').map(s => s.charAt(0)).slice(0, 2).join('').toUpperCase();
        return (
          <div
            className="px-5 sticky top-0 z-30 safe-top relative overflow-hidden"
            style={{
              top: '0px',
              paddingTop: 'max(1.1rem, env(safe-area-inset-top, 0px))',
              paddingBottom: '1.25rem',
              background: 'linear-gradient(180deg, #0B0B0F 0%, #16161D 70%, #1C1C24 100%)',
              boxShadow: '0 10px 30px -12px rgba(0,0,0,0.55)'
            }}
          >
            {/* Subtle radial glow accents */}
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(255,107,53,0.18), transparent 70%)' }} />
              <div className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(168,135,255,0.10), transparent 70%)' }} />
              <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)' }} />
            </div>

            {/* Top utility row */}
            <div className="relative z-10 flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg grid place-items-center"
                  style={{
                    background: 'linear-gradient(135deg, #FF8456 0%, #FF6B35 100%)',
                    boxShadow: '0 6px 14px rgba(255,107,53,0.35), inset 0 1px 0 rgba(255,255,255,0.25)'
                  }}
                >
                  <span className="text-white font-black text-[11px] tracking-[0.18em]">RR</span>
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-[10px] uppercase tracking-[0.22em] text-white/45 font-semibold">Reride</span>
                  <span className="text-[11px] text-white/70 font-medium mt-0.5">{todayLabel}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('notifications')}
                  aria-label={`Notifications${headerUnread ? `, ${headerUnread} unread` : ''}`}
                  className="relative w-10 h-10 rounded-full grid place-items-center text-white/85 active:scale-95 transition-transform"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)'
                  }}
                >
                  <IconBell size={18} stroke={1.6} />
                  {headerUnread > 0 && (
                    <span
                      className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white grid place-items-center"
                      style={{
                        background: 'linear-gradient(135deg, #FF6B35, #E5482C)',
                        boxShadow: '0 0 0 2px #0B0B0F'
                      }}
                    >
                      {headerUnread > 9 ? '9+' : headerUnread}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  aria-label="Settings"
                  className="w-10 h-10 rounded-full grid place-items-center text-white/85 active:scale-95 transition-transform"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)'
                  }}
                >
                  <IconSettings size={18} stroke={1.6} />
                </button>
              </div>
            </div>

            {/* Greeting block */}
            <div className="relative z-10 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/45 font-semibold mb-1.5">{greeting}</p>
                <h1
                  className="text-white font-semibold truncate"
                  style={{ fontSize: '26px', lineHeight: 1.1, letterSpacing: '-0.03em' }}
                >
                  {firstName}
                  <span className="text-white/40 font-light">.</span>
                </h1>
                <p className="mt-2 text-[12.5px] text-white/55 font-medium">
                  {isSeller
                    ? `${activeListings} active · ${totalViews.toLocaleString('en-IN')} views today`
                    : isAdmin ? 'Platform overview' : 'Your car journey'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                aria-label="Open profile"
                className="relative shrink-0"
              >
                <span
                  className="absolute -inset-[3px] rounded-2xl"
                  style={{ background: 'conic-gradient(from 140deg, #FF8456, #FF6B35, #C7411F, #FF8456)' }}
                />
                <span
                  className="relative w-12 h-12 rounded-2xl grid place-items-center font-bold text-white text-[15px] tracking-tight"
                  style={{
                    background: 'linear-gradient(160deg, #1F1F28 0%, #0E0E13 100%)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)'
                  }}
                >
                  {initials}
                </span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Premium Tab Navigation — Refined pills */}
      <div
        className="px-4 sticky z-20"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) + 132px)',
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'saturate(180%) blur(14px)',
          WebkitBackdropFilter: 'saturate(180%) blur(14px)',
          borderBottom: '1px solid rgba(15, 23, 42, 0.06)'
        }}
      >
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-3">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as DashboardTab)}
                className="group flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold transition-all duration-200 active:scale-95"
                style={{
                  background: active ? '#0B0B0F' : 'rgba(15, 23, 42, 0.04)',
                  color: active ? '#FFFFFF' : '#475569',
                  border: active ? '1px solid #0B0B0F' : '1px solid rgba(15, 23, 42, 0.06)',
                  boxShadow: active ? '0 6px 16px -6px rgba(11,11,15,0.45)' : 'none',
                  letterSpacing: '-0.01em'
                }}
              >
                <span className="text-[15px] leading-none">{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.count !== null && tab.count > 0 && (
                  <span
                    className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold"
                    style={{
                      background: active ? 'rgba(255,255,255,0.15)' : '#FF6B35',
                      color: '#FFFFFF',
                      border: active ? '1px solid rgba(255,255,255,0.18)' : 'none'
                    }}
                  >
                    {tab.count > 99 ? '99+' : tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content - Enhanced with better spacing */}
      <div className="px-4 pt-5 pb-24 max-w-4xl mx-auto">
        {renderContent()}
      </div>

      {/* Modals */}
      {showBulkUpload && onAddMultipleVehicles && (
        <BulkUploadModal
          onClose={() => setShowBulkUpload(false)}
          onAddMultipleVehicles={onAddMultipleVehicles}
          sellerEmail={currentUser.email}
        />
      )}

      {boostVehicle && onBoostListing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <BoostListingModal
              vehicle={boostVehicle}
              onClose={() => setBoostVehicle(null)}
              onBoost={async (vehicleId, packageId) => {
                await onBoostListing(vehicleId, packageId);
                setBoostVehicle(null);
                addToast?.('Listing boosted successfully!', 'success');
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
});

MobileDashboard.displayName = 'MobileDashboard';

export default MobileDashboard;
