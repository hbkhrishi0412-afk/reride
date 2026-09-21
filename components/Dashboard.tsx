import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Vehicle, User, Conversation, VehicleData, ChatMessage, PlanDetails, SubscriptionPlan, Notification } from '../types';
import { View } from '../types';
import { currentUserForLocalSessionJson } from '../utils/userLocalStorageSnapshot';
import { findUserByParticipantId } from '../utils/chatContact';
// FIX: ChatWidget is a named export, not a default. Corrected the import syntax.
import { ChatWidget } from './ChatWidget';
// Removed blocking import - will lazy load location data when needed
import { planService } from '../services/planService';
import BulkUploadModal from './BulkUploadModal';
import MarkSoldDealModal from './MarkSoldDealModal';
import SellerCommandHome from './command-center/SellerCommandHome';
import DealDetailPage from './command-center/DealDetailPage';
import { useSellerDashboardController } from '../hooks/useSellerDashboardController';
import { countActionableSellerTasks } from '../utils/sellerViewedTasks';
import { findVehicleByIdentity, getCanonicalPrimaryKey, buildVehicleMutationBody } from '../utils/vehicleIdentity';
import { logInfo } from '../utils/logger.js';
import BoostListingModal from './BoostListingModal';
import { isListingExpired } from '../services/listingLifecycleService';
import { isEffectivelyFeatured } from '../utils/listingPromotion';
import { InquiriesView } from './seller-dashboard/InquiriesView';
import { SettingsView } from './seller-dashboard/SettingsView';
import { ReportsView } from './seller-dashboard/ReportsView';
import { SellerAnalyticsView } from './seller-dashboard/SellerAnalyticsView';
import { SellerListingsView } from './seller-dashboard/SellerListingsView';
import { SellerSalesHistoryView } from './seller-dashboard/SellerSalesHistoryView';
import { SellerNotificationsView } from './seller-dashboard/SellerNotificationsView';
import SellerPremiumPanel, {
  sellerPremiumGhostBtnStyle,
} from './seller-dashboard/SellerPremiumShell';
import Logo from './Logo';
import {
  validateListingRenewal,
  isListingLimitReached,
  type ListingRenewalValidation,
} from '../utils/listingPlanRules';
import { authenticatedFetch } from '../utils/authenticatedFetch';
import {
  conversationBelongsToSeller,
  countInquiriesForVehicles,
} from '../utils/conversationParticipants';
import { aggregateListingStats } from '../services/listingService';
import { dashboardNotify, type DashboardNotifyFn } from './dashboard/notify';
import { VehicleForm } from './dashboard/VehicleForm';

export type { DashboardNotifyFn } from './dashboard/notify';

// Firebase status utilities removed - using Supabase


interface DashboardProps {
  seller: User;
  sellerVehicles: Vehicle[];
  allVehicles: Vehicle[];
  reportedVehicles: Vehicle[];
  onAddVehicle: (vehicle: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>, isFeaturing: boolean) => void | Promise<void>;
  onAddMultipleVehicles: (vehicles: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>[]) => void;
  onUpdateVehicle: (vehicle: Vehicle) => void;
  onDeleteVehicle: (vehicleId: number) => void;
  onMarkAsSold: (vehicleId: number) => void;
  onMarkAsUnsold?: (vehicleId: number) => void;
  conversations: Conversation[];
  onSellerSendMessage: (conversationId: string, messageText: string, type?: ChatMessage['type'], payload?: any) => void;
  onMarkConversationAsReadBySeller: (conversationId: string) => void;
  onSetConversationReadState?: (conversationId: string, isRead: boolean) => void;
  onMarkAllAsReadBySeller?: () => void;
  typingStatus: { conversationId: string; userRole: 'customer' | 'seller' } | null;
  onUserTyping: (conversationId: string, userRole: 'customer' | 'seller') => void;
  onUserStoppedTyping?: (conversationId: string) => void;
  onMarkMessagesAsRead: (conversationId: string, readerRole: 'customer' | 'seller') => void;
  onClearChat?: (conversationId: string) => void | Promise<void>;
  onDeleteConversation?: (conversationId: string) => void | Promise<void>;
  onArchiveConversation?: (conversationId: string, archived?: boolean) => void | Promise<void>;
  onUpdateSellerProfile: (details: { dealershipName: string; bio: string; logoUrl: string; partnerBanks?: string[] }) => void;
  vehicleData: VehicleData;
  onFeatureListing: (vehicleId: number) => Promise<void>;
  onBoostListing?: (vehicleId: number, packageId: string) => Promise<void>;
  onRequestCertification: (vehicleId: number) => void;
  onNavigate: (view: View) => void;
  onTestDriveResponse?: (conversationId: string, messageId: number, newStatus: 'confirmed' | 'rejected') => void;
  onOfferResponse: (conversationId: string, messageId: number, response: 'accepted' | 'rejected' | 'countered', counterPrice?: number) => void;
  onViewVehicle?: (vehicle: Vehicle) => void;
  chatPeerOnlineByConversationId?: Record<string, boolean>;
  /** Mobile seller dashboard uses this; desktop dashboard may ignore. */
  onSellerOpenChat?: (conversation: Conversation) => void;
  /** Toast / snackbar feedback (replaces blocking alert dialogs). */
  onNotify?: DashboardNotifyFn;
  notifications?: Notification[];
  onNotificationClick?: (notification: Notification) => void;
  onMarkNotificationsAsRead?: (ids: number[]) => void;
  /** Clears seller session (workspace chrome — site header is hidden on this view). */
  onLogout?: () => void;
}

type DashboardView = 'overview' | 'listings' | 'form' | 'messages' | 'analytics' | 'salesHistory' | 'reports' | 'settings' | 'notifications';

// Main Dashboard Component
const Dashboard: React.FC<DashboardProps> = ({ seller, sellerVehicles, reportedVehicles, onAddVehicle, onAddMultipleVehicles, onUpdateVehicle, onDeleteVehicle, onMarkAsSold, onMarkAsUnsold, conversations, onSellerSendMessage, onMarkConversationAsReadBySeller, onSetConversationReadState, onMarkAllAsReadBySeller, typingStatus, onUserTyping, onUserStoppedTyping, onMarkMessagesAsRead, onClearChat, onDeleteConversation, onArchiveConversation, onUpdateSellerProfile, vehicleData, onFeatureListing, onBoostListing, onRequestCertification, onNavigate, onTestDriveResponse, allVehicles, onOfferResponse, onViewVehicle, chatPeerOnlineByConversationId, onSellerOpenChat, onNotify, notifications = [], onNotificationClick, onMarkNotificationsAsRead, onLogout }) => {
  const notify = useCallback(
    (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') =>
      dashboardNotify(onNotify, message, type),
    [onNotify],
  );
  void onRequestCertification;
  void onSellerOpenChat;
  void onFeatureListing;

  const { t } = useTranslation();
  
  // CRITICAL: All hooks must be called before any conditional returns (React Rules of Hooks)
  // Initialize all state hooks first
  const [activeView, setActiveView] = useState<DashboardView>('overview');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const {
    commandCenter,
    commandCenterLoading,
    commandCenterError: dealStatsError,
    pendingAcceptCount,
    sellerActiveDeals,
    dealsByVehicleId,
    refreshDealCommandStats,
  } = useSellerDashboardController(seller);
  const [viewedTasksVersion, setViewedTasksVersion] = useState(0);
  const hotLeadsBadgeCount = useMemo(
    () =>
      countActionableSellerTasks(
        commandCenter?.tasks,
        commandCenter?.stats?.pendingInterestCount ?? pendingAcceptCount,
      ),
    // Recompute when seller dismisses a view-only task in-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- viewedTasksVersion bumps after markSellerTaskViewed
    [commandCenter?.tasks, commandCenter?.stats?.pendingInterestCount, pendingAcceptCount, viewedTasksVersion],
  );

  useEffect(() => {
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('reride_seller_open_inquiries') === '1') {
        sessionStorage.removeItem('reride_seller_open_inquiries');
        setActiveView('messages');
      }
    } catch {
      /* ignore */
    }
  }, []);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  // NEW: Boost listing feature
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [vehicleToBoost, setVehicleToBoost] = useState<Vehicle | null>(null);
  const [markSoldVehicle, setMarkSoldVehicle] = useState<Vehicle | null>(null);
  // Pagination state for Active Listings
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [soldPage, setSoldPage] = useState(1);
  // Month selector state for analytics
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  // Users state for contact lookup
  const [allUsers, setAllUsers] = useState<User[]>([]);
  
  // Production error logging helper (must be after hooks)
  const logProductionError = useCallback((error: Error | unknown, context: string) => {
    const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
    if (isProduction) {
      console.error(`[Dashboard Error] ${context}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        sellerEmail: seller?.email,
        timestamp: new Date().toISOString()
      });
    } else if (process.env.NODE_ENV === 'development') {
      console.warn(`⚠️ ${context}:`, error);
    }
  }, [seller?.email]);

  // Safety checks: Ensure arrays are initialized and validate all props (must be after hooks)
  const safeSellerVehicles = useMemo(() => Array.isArray(sellerVehicles) ? sellerVehicles : [], [sellerVehicles]);

  /** Include canonical Supabase `databaseId` so API mutations work for UUID primary keys. */
  const buildVehicleActionBody = useCallback(
    (vehicleId: number, extra: Record<string, unknown> = {}) => {
      try {
        return buildVehicleMutationBody(vehicleId, safeSellerVehicles, extra);
      } catch {
        const vehicle = findVehicleByIdentity(safeSellerVehicles, vehicleId);
        const databaseId = vehicle ? getCanonicalPrimaryKey(vehicle) : undefined;
        return {
          vehicleId,
          ...(databaseId ? { databaseId } : {}),
          ...extra,
        };
      }
    },
    [safeSellerVehicles],
  );
  const safeConversations = useMemo(() => Array.isArray(conversations) ? conversations : [], [conversations]);
  const safeReportedVehicles = useMemo(() => Array.isArray(reportedVehicles) ? reportedVehicles : [], [reportedVehicles]);
  const safeVehicleData = useMemo(() => {
    const result = vehicleData && typeof vehicleData === 'object' && Object.keys(vehicleData).length > 0 
      ? vehicleData 
      : {
          'four-wheeler': [],
          'two-wheeler': [],
          'three-wheeler': []
        };
    return result;
  }, [vehicleData]);

  // Check Firebase connection status (only in browser, not SSR)
  const [databaseStatus, setDatabaseStatus] = useState<{ available: boolean; error?: string; details?: string } | null>(null);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // Safely get Firebase status - wrap in try-catch to prevent crashes
        // Firebase removed - using Supabase
        const status = { available: true };
        setDatabaseStatus(status);
      } catch (error) {
        // If Firebase status check fails, set a safe default
        // Don't throw - just log and continue
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.warn('⚠️ Dashboard: Failed to check Firebase status:', errorMessage);
        setDatabaseStatus({ 
          available: false, 
          error: 'Unable to check Firebase status',
          details: errorMessage
        });
      }
    }
  }, []);

  // Refresh user data from API to get updated plan expiry date
  // FIXED: Removed window.location.reload() to prevent crashes - now uses localStorage update only
  useEffect(() => {
    // Only refresh if seller is authenticated
    if (!seller || !seller.email) {
      return;
    }
    
    let isMounted = true;

    const refreshUserData = async () => {
      // Prevent refresh if component is unmounted
      if (!isMounted) {
        return;
      }
      
      try {
        // Validate seller object before making API call
        if (!seller || !seller.email || typeof seller.email !== 'string') {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Invalid seller object, skipping user data refresh');
          }
          return;
        }
        
        // Wrap authenticatedFetch in additional error handling to catch network errors
        let response: Response;
        try {
          // Use authenticatedFetch to include JWT token for production API
          // Include token if available (user is logged in, so token should exist)
          // This prevents 401 errors from middleware/proxy layers in production
          // GET /api/users doesn't validate the token, but including it prevents proxy rejection
          response = await authenticatedFetch(`/api/users?email=${encodeURIComponent(seller.email)}`);
          
          // Handle 401 gracefully - don't show error, just skip refresh
          if (response.status === 401) {
            if (process.env.NODE_ENV === 'development' && isMounted) {
              console.warn('⚠️ User data refresh skipped: Authentication required');
            }
            return; // Exit early on 401
          }
        } catch (fetchError) {
          // Catch network errors, CORS errors, or any other fetch-related errors
          // Don't throw - just silently fail to prevent ErrorBoundary from catching
          if (process.env.NODE_ENV === 'development' && isMounted) {
            console.warn('⚠️ Network error during user data refresh:', fetchError);
          }
          return; // Exit early on fetch errors
        }
        
        // Check if component is still mounted after async operation
        if (!isMounted) {
          return;
        }
        
        // Validate response object exists
        if (!response || typeof response !== 'object') {
          if (process.env.NODE_ENV === 'development' && isMounted) {
            console.warn('⚠️ Invalid response object from authenticatedFetch');
          }
          return;
        }
        
        if (response.ok) {
          // Check content type before parsing
          const contentType = response.headers?.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ API returned non-JSON response, skipping user refresh');
            }
            return;
          }
          
          let users: User[];
          try {
            const payload = await response.json();
            users = Array.isArray(payload) ? payload : (payload && payload.email ? [payload as User] : []);
          } catch (jsonError) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ Failed to parse JSON response:', jsonError);
            }
            return;
          }
          
          // Check if component is still mounted after async operation
          if (!isMounted) {
            return;
          }
          
          // Store users in state for use in JSX
          if (users.length > 0) {
            setAllUsers(users);
          }
          
          if (users.length > 0 && seller?.email) {
            // Normalize emails for comparison (critical for production)
            const normalizedSellerEmail = seller.email.toLowerCase().trim();
            const updatedSeller = users.find((u: User) => {
              if (!u || !u.email) return false;
              return u.email.toLowerCase().trim() === normalizedSellerEmail;
            });
            if (updatedSeller) {
              // Check if plan expiry date has changed
              const currentExpiry = seller.planExpiryDate;
              const newExpiry = updatedSeller.planExpiryDate;
              
              // Only update if expiry date actually changed
              if (currentExpiry !== newExpiry || 
                  updatedSeller.planActivatedDate !== seller.planActivatedDate ||
                  updatedSeller.subscriptionPlan !== seller.subscriptionPlan) {
                try {
                  // Update localStorage with fresh user data
                  // FIXED: Removed window.location.reload() - localStorage update is sufficient
                  // The App component will pick up the change through its own refresh mechanism
                  localStorage.setItem('reRideCurrentUser', currentUserForLocalSessionJson(updatedSeller));
                  
                  // Dispatch a custom event to notify other components of the update
                  // This allows the app to update without a full page reload
                  window.dispatchEvent(new CustomEvent('userDataUpdated', { 
                    detail: { user: updatedSeller } 
                  }));
                  
                  if (process.env.NODE_ENV === 'development') {
                    logInfo('✅ User data updated in localStorage (plan expiry changed)');
                  }
                } catch (storageError) {
                  if (process.env.NODE_ENV === 'development') {
                    console.warn('⚠️ Failed to update localStorage:', storageError);
                  }
                }
              }
            }
          }
        } else {
          // Log non-OK responses but don't throw errors (except 401 which is handled above)
          if (response.status !== 401 && process.env.NODE_ENV === 'development') {
            console.warn(`⚠️ User refresh API returned ${response.status}: ${response.statusText}`);
          }
        }
      } catch (error) {
        // Log errors in production for debugging
        if (isMounted) {
          logProductionError(error, 'Failed to refresh user data');
        }
        // Don't throw - silently fail to prevent dashboard crash
      }
    };

    // Refresh user data when component mounts and every 60 seconds (increased from 30 to reduce load)
    // FIXED: Only refresh on mount, not on every dependency change to prevent loops
    refreshUserData();
    const onUserDataEvent = () => {
      if (isMounted) void refreshUserData();
    };
    window.addEventListener('userDataUpdated', onUserDataEvent);
    const onVisibility = () => {
      if (isMounted && document.visibilityState === 'visible') {
        void refreshUserData();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    
    return () => {
      isMounted = false;
      window.removeEventListener('userDataUpdated', onUserDataEvent);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [seller?.email, seller?.planExpiryDate, seller?.planActivatedDate, seller?.subscriptionPlan]); // FIXED: Include all plan-related fields to prevent stale closures
  
  // Location data is now handled by individual components that need it
  
  // Helper function to filter vehicles by month
  const filterVehiclesByMonth = useCallback((vehicles: Vehicle[], month: string): Vehicle[] => {
    if (month === 'all') return vehicles;
    
    const [year, monthNum] = month.split('-');
    const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(monthNum), 0, 23, 59, 59, 999);
    
    return vehicles.filter(v => {
      const vehicleDate = v.createdAt ? new Date(v.createdAt) : null;
      if (!vehicleDate) return false;
      return vehicleDate >= startDate && vehicleDate <= endDate;
    });
  }, []);
  
  // Generate month options for the last 12 months — memoized to a stable array so
  // the <select>'s option list doesn't allocate a fresh array on every render.
  const monthOptions = useMemo(() => {
    const months: { value: string; label: string }[] = [{ value: 'all', label: 'All Time' }];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      months.push({ value: monthValue, label: monthLabel });
    }
    return months;
  }, []);

  // Refresh vehicle data from API when form view is opened or when editing a vehicle
  useEffect(() => {
    if (activeView === 'form' || editingVehicle) {
      const refreshVehicleData = async () => {
        try {
          // Validate that we have a valid seller before fetching data
          if (!seller || !seller.email) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ Cannot refresh vehicle data: seller information missing');
            }
            return;
          }

          const { getVehicleData } = await import('../services/vehicleDataService');
          const freshData = await getVehicleData();
          
          // Validate the data before using it
          if (freshData && typeof freshData === 'object' && Object.keys(freshData).length > 0) {
            try {
              // Update localStorage to trigger storage event for other tabs
              localStorage.setItem('reRideVehicleData', JSON.stringify(freshData));
              // Dispatch custom event for same-tab sync
              window.dispatchEvent(new CustomEvent('vehicleDataUpdated', { detail: { vehicleData: freshData } }));
              if (process.env.NODE_ENV === 'development') {
                logInfo('✅ Vehicle data refreshed when opening form');
              }
            } catch (storageError) {
              // Log storage errors but don't crash
              logProductionError(storageError, 'Failed to save vehicle data to localStorage');
            }
          } else {
            logProductionError(new Error('Invalid vehicle data structure'), 'Vehicle data refresh returned invalid data');
          }
        } catch (error) {
          // Log errors but don't crash the dashboard
          logProductionError(error, 'Failed to refresh vehicle data when opening form');
        }
      };
      refreshVehicleData();
    }
  }, [activeView, editingVehicle, seller]);

  useEffect(() => {
    // FIXED: Added safety checks to prevent crashes
    if (selectedConv && safeConversations && Array.isArray(safeConversations)) {
        try {
            const updatedConversation = safeConversations.find(c => c && c.id && c.id === selectedConv.id);
            if (updatedConversation) {
                // Using stringify is a simple way to deep-compare for changes.
                // Added try-catch to handle circular references or serialization errors
                try {
                    if (JSON.stringify(updatedConversation) !== JSON.stringify(selectedConv)) {
                        setSelectedConv(updatedConversation);
                    }
                } catch (stringifyError) {
                    // If stringify fails, do a shallow comparison instead
                    if (updatedConversation.messages?.length !== selectedConv.messages?.length ||
                        updatedConversation.isReadBySeller !== selectedConv.isReadBySeller) {
                        setSelectedConv(updatedConversation);
                    }
                }
            } else {
                // The selected conversation is no longer in the list, so deselect it.
                setSelectedConv(null);
            }
        } catch (error) {
            // Silently handle errors to prevent crashes
            if (process.env.NODE_ENV === 'development') {
                console.warn('⚠️ Error updating selected conversation:', error);
            }
        }
    }
  }, [safeConversations, selectedConv]);

  const unreadCount = useMemo(() => {
    if (!seller?.email) return 0;
    return safeConversations.filter((c) => {
      if (!c || c.isReadBySeller === true || !c.sellerId) return false;
      return conversationBelongsToSeller(c, seller.email, seller.id);
    }).length;
  }, [safeConversations, seller?.email, seller?.id]);
  const sellerNotifications = useMemo(
    () => (notifications || []).filter((n) => n.recipientEmail === seller?.email),
    [notifications, seller?.email],
  );
  const unreadNotificationCount = useMemo(
    () => sellerNotifications.filter((n) => !n.isRead).length,
    [sellerNotifications],
  );
  const activeListings = useMemo(() => safeSellerVehicles.filter(v => v && v.status !== 'sold'), [safeSellerVehicles]);
  const publishedListings = useMemo(() => safeSellerVehicles.filter(v => v && v.status === 'published'), [safeSellerVehicles]);
  const soldListings = useMemo(() => safeSellerVehicles.filter(v => v && v.status === 'sold'), [safeSellerVehicles]);
  const reportedCount = useMemo(() => safeReportedVehicles.length, [safeReportedVehicles]);
  
  // Pagination for sold listings (Sales History)
  const SOLD_PAGE_SIZE = 10;
  const totalSoldPages = Math.max(1, Math.ceil(soldListings.length / SOLD_PAGE_SIZE));
  const paginatedSoldListings = useMemo(() => {
    const start = (soldPage - 1) * SOLD_PAGE_SIZE;
    return soldListings.slice(start, start + SOLD_PAGE_SIZE);
  }, [soldListings, soldPage]);
  useEffect(() => {
    // Reset to first page whenever the underlying list changes
    setSoldPage(1);
  }, [soldListings]);
  
  // Filter listings by selected month for analytics (published only)
  const filteredPublishedListings = useMemo(() => 
    filterVehiclesByMonth(publishedListings, selectedMonth), 
    [publishedListings, selectedMonth, filterVehiclesByMonth]
  );
  const filteredSoldListings = useMemo(() => 
    filterVehiclesByMonth(soldListings, selectedMonth), 
    [soldListings, selectedMonth, filterVehiclesByMonth]
  );
  
  // Pagination calculations for Active Listings
  const totalPages = useMemo(() => Math.ceil(activeListings.length / itemsPerPage), [activeListings.length, itemsPerPage]);
  const paginatedListings = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return activeListings.slice(startIndex, endIndex);
  }, [activeListings, currentPage, itemsPerPage]);
  
  // Reset to page 1 when listings change or view changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeListings.length, activeView]);
  
  const analyticsData = useMemo(() => {
    // FIXED: Added safety checks to prevent crashes from null/undefined data
    try {
      const safeFilteredSoldListings = Array.isArray(filteredSoldListings) ? filteredSoldListings : [];
      const safeFilteredPublishedListings = Array.isArray(filteredPublishedListings) ? filteredPublishedListings : [];
      
      const totalSalesValue = safeFilteredSoldListings.reduce((sum: number, v) => {
        if (!v || typeof v.price !== 'number') return sum;
        return sum + v.price;
      }, 0);
      
      const totalViews = safeFilteredPublishedListings.reduce((sum, v) => {
        if (!v || typeof v.views !== 'number') return sum;
        return sum + v.views;
      }, 0);
      
      const totalInquiries = countInquiriesForVehicles(
        safeFilteredPublishedListings,
        safeConversations,
        seller?.email,
        seller?.id,
      );
      
      const chartLabels = safeFilteredPublishedListings.map(v => {
        if (!v) return '';
        const year = v.year || '';
        const model = v.model || '';
        const variant = v.variant || '';
        return `${year} ${model} ${variant}`.trim().slice(0, 25);
      }).filter(label => label.length > 0);
      
      const chartData = {
        labels: chartLabels,
        datasets: [
          {
            label: 'Views',
            data: safeFilteredPublishedListings.map(v => (v && typeof v.views === 'number') ? v.views : 0),
            backgroundColor: 'rgba(255, 107, 53, 0.5)',
            borderColor: 'rgba(255, 107, 53, 1)',
            borderWidth: 1,
            yAxisID: 'y',
          },
          {
            label: 'Inquiries',
            data: safeFilteredPublishedListings.map((v) =>
              v ? aggregateListingStats(v, safeConversations).chatStarts : 0,
            ),
            backgroundColor: 'rgba(30, 136, 229, 0.5)',
            borderColor: 'rgba(30, 136, 229, 1)',
            borderWidth: 1,
            yAxisID: 'y1',
          },
        ],
      };
      return { totalSalesValue, totalViews, totalInquiries, chartData };
    } catch (error) {
      // Return safe defaults if computation fails
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Error computing analytics data:', error);
      }
      return {
        totalSalesValue: 0,
        totalViews: 0,
        totalInquiries: 0,
        chartData: {
          labels: [],
          datasets: [
            { label: 'Views', data: [], backgroundColor: 'rgba(255, 107, 53, 0.5)', borderColor: 'rgba(255, 107, 53, 1)', borderWidth: 1, yAxisID: 'y' },
            { label: 'Inquiries', data: [], backgroundColor: 'rgba(30, 136, 229, 0.5)', borderColor: 'rgba(30, 136, 229, 1)', borderWidth: 1, yAxisID: 'y1' }
          ]
        }
      };
    }
  }, [filteredPublishedListings, filteredSoldListings, safeConversations, seller?.email, seller?.id]);

  const handleNavigate = (view: DashboardView) => {
    if (view !== 'messages') {
        setSelectedConv(null);
    }
    setActiveView(view);
  };

  const openHotLeadConversation = useCallback(
    (conv: Conversation) => {
      setSelectedConv(conv);
      onMarkConversationAsReadBySeller(conv.id);
      onMarkMessagesAsRead(conv.id, 'seller');
      handleNavigate('messages');
    },
    [onMarkConversationAsReadBySeller, onMarkMessagesAsRead],
  );

  const sellerPlan = useMemo(
    () => ({
      subscriptionPlan: seller?.subscriptionPlan,
      planExpiryDate: seller?.planExpiryDate,
    }),
    [seller?.subscriptionPlan, seller?.planExpiryDate],
  );

  const [sellerPlanDetails, setSellerPlanDetails] = useState<PlanDetails | null>(null);

  useEffect(() => {
    let active = true;
    const loadPlan = async () => {
      try {
        const details = await planService.getPlanDetails((seller?.subscriptionPlan || 'free') as SubscriptionPlan);
        if (active) setSellerPlanDetails(details);
      } catch {
        if (active) setSellerPlanDetails(null);
      }
    };
    void loadPlan();
    return () => {
      active = false;
    };
  }, [seller?.subscriptionPlan]);

  const listingAtLimit = useMemo(
    () => isListingLimitReached(sellerPlan, safeSellerVehicles, sellerPlanDetails),
    [sellerPlan, safeSellerVehicles, sellerPlanDetails],
  );

  const isVehicleListingExpired = useCallback(
    (vehicle: Vehicle) => isListingExpired(vehicle, sellerPlan),
    [sellerPlan],
  );

  const getListingRenewalValidation = useCallback(
    (vehicle: Vehicle): ListingRenewalValidation =>
      validateListingRenewal(sellerPlan, vehicle, safeSellerVehicles),
    [sellerPlan, safeSellerVehicles],
  );

  const handleRefreshVehicle = async (vehicleId: number) => {
    try {
      const response = await authenticatedFetch('/api/vehicles?action=refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildVehicleActionBody(vehicleId, {
          action: 'refresh',
          refreshAction: 'refresh',
          sellerEmail: seller?.email,
        }))
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const result = await response.json();
            if (result && result.success && result.vehicle) {
              // Update local state instead of reloading page
              onUpdateVehicle(result.vehicle);
              if (process.env.NODE_ENV === 'development') {
                logInfo('✅ Vehicle refreshed successfully');
              }
            }
          } catch (jsonError) {
            console.warn('⚠️ Failed to parse refresh response:', jsonError);
          }
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️ Failed to refresh vehicle: ${response.status} ${response.statusText}`);
        }
      }
    } catch (error) {
      // Silently handle errors to prevent dashboard crashes
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error refreshing vehicle:', error);
      }
    }
  };

  const handleRenewVehicle = async (vehicleId: number) => {
    const vehicle = safeSellerVehicles.find((v) => v && v.id === vehicleId);
    if (!vehicle) {
      dashboardNotify(onNotify, 'Listing not found. Please refresh and try again.', 'error');
      return;
    }

    const validation = validateListingRenewal(sellerPlan, vehicle, safeSellerVehicles);
    if (!validation.allowed) {
      dashboardNotify(onNotify, validation.reason || 'Cannot renew this listing.', 'error');
      return;
    }

    try {
      const response = await authenticatedFetch('/api/vehicles?action=refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildVehicleActionBody(vehicleId, {
          action: 'refresh',
          refreshAction: 'renew',
          sellerEmail: seller?.email,
        }))
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const result = await response.json();
            if (result && result.success && result.vehicle) {
              onUpdateVehicle(result.vehicle);
              dashboardNotify(
                onNotify,
                'Listing renewed successfully. It is visible to buyers again.',
                'success',
              );
            } else {
              dashboardNotify(onNotify, result?.reason || 'Failed to renew listing. Please try again.', 'error');
            }
          } catch (jsonError) {
            console.warn('⚠️ Failed to parse renew response:', jsonError);
            dashboardNotify(onNotify, 'Failed to renew listing. Please try again.', 'error');
          }
        }
      } else {
        try {
          const err = await response.json();
          dashboardNotify(onNotify, err?.reason || 'Failed to renew listing. Please try again.', 'error');
        } catch {
          dashboardNotify(onNotify, 'Failed to renew listing. Please try again.', 'error');
        }
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️ Failed to renew vehicle: ${response.status} ${response.statusText}`);
        }
      }
    } catch (error) {
      dashboardNotify(onNotify, 'Failed to renew listing. Please try again.', 'error');
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error renewing vehicle:', error);
      }
    }
  };

  const handleCertifyVehicle = async (vehicleId: number) => {
    try {
      // Prefer app-level callback (handles centralized auth/state/toast logic)
      if (onRequestCertification) {
        await onRequestCertification(vehicleId);
        return;
      }

      const response = await authenticatedFetch('/api/vehicles?action=certify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildVehicleActionBody(vehicleId))
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const result = await response.json();
            if (result && result.success && result.vehicle) {
              // Update local state
              onUpdateVehicle(result.vehicle);
              if (process.env.NODE_ENV === 'development') {
                logInfo('✅ Certification request submitted');
              }
            }
          } catch (jsonError) {
            console.warn('⚠️ Failed to parse certification response:', jsonError);
          }
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`⚠️ Failed to submit certification request: ${response.status} ${response.statusText}`);
        }
      }
    } catch (error) {
      // Silently handle errors to prevent dashboard crashes
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error submitting certification request:', error);
      }
    }
  };

  const handleMarkAsSold = async (vehicleId: number) => {
    const vehicle = safeSellerVehicles.find((v) => v?.id === vehicleId);
    if (vehicle) {
      setMarkSoldVehicle(vehicle);
      return;
    }
    try {
      // Prefer app-level callback so state/toasts stay consistent across environments
      if (onMarkAsSold) {
        await onMarkAsSold(vehicleId);
        return;
      }

      const response = await authenticatedFetch('/api/vehicles?action=sold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildVehicleActionBody(vehicleId))
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const result = await response.json();
            if (result && result.success && result.vehicle) {
              // Update local state
              onUpdateVehicle(result.vehicle);
              if (process.env.NODE_ENV === 'development') {
                logInfo('✅ Vehicle marked as sold');
              }
            } else if (result && result.reason) {
              if (process.env.NODE_ENV === 'development') {
                console.warn('⚠️ Failed to mark vehicle as sold:', result.reason);
              }
            }
          } catch (jsonError) {
            console.warn('⚠️ Failed to parse sold response:', jsonError);
          }
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          try {
            const errorText = await response.text();
            console.warn(`⚠️ Failed to mark vehicle as sold: ${response.status} ${errorText}`);
          } catch (textError) {
            console.warn(`⚠️ Failed to mark vehicle as sold: ${response.status}`);
          }
        }
      }
    } catch (error) {
      // Silently handle errors to prevent dashboard crashes
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error marking vehicle as sold:', error);
      }
    }
  };

  const handleMarkAsUnsold = async (vehicleId: number) => {
    try {
      // Use the onMarkAsUnsold prop if available (handles through App.tsx with proper state updates and toast notifications)
      if (onMarkAsUnsold) {
        await onMarkAsUnsold(vehicleId);
        return;
      }

      // Fallback: shared service path (heals stale listing identity before POST)
      const { markVehicleAsUnsold } = await import('../services/vehicleService.js');
      const updated = await markVehicleAsUnsold(vehicleId, safeSellerVehicles);
      onUpdateVehicle(updated);
    } catch (error) {
      // Silently handle errors to prevent dashboard crashes
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error marking vehicle as unsold:', error);
      }
      // Error is logged, but UI feedback should come from App.tsx via onMarkAsUnsold prop
      if (!onMarkAsUnsold) {
        // Only show alert if prop is not available (shouldn't happen in normal flow)
        notify(error instanceof Error ? error.message : 'Failed to mark vehicle as unsold. Please try again.');
      }
    }
  };

  const handleEditClick = (vehicle: Vehicle) => {
    // FIXED: Added safety check to prevent crashes
    if (!vehicle || !vehicle.id) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Attempted to edit invalid vehicle');
      }
      return;
    }
    try {
      setEditingVehicle(vehicle);
      handleNavigate('form');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error in handleEditClick:', error);
      }
    }
  };
  
  const notifyListingLimitReached = useCallback(() => {
    dashboardNotify(
      onNotify,
      `You've reached your plan's active listing limit. Unpublish or sell a listing, or upgrade your plan.`,
      'warning',
    );
  }, [onNotify]);

  const handleAddNewClick = () => {
    try {
      if (listingAtLimit) {
        notifyListingLimitReached();
        return;
      }
      setEditingVehicle(null);
      handleNavigate('form');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error in handleAddNewClick:', error);
      }
    }
  }

  const handleFormCancel = () => {
    try {
      setEditingVehicle(null);
      handleNavigate('listings');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error in handleFormCancel:', error);
      }
    }
  }

  const handleNavigateToVehicle = (vehicleId: number) => {
    // FIXED: Added safety checks
    if (!vehicleId || !Number.isInteger(vehicleId)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Invalid vehicleId provided:', vehicleId);
      }
      return;
    }
    try {
      const vehicle = safeSellerVehicles.find(v => v && v.id === vehicleId);
      if (vehicle) {
        handleEditClick(vehicle);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error in handleNavigateToVehicle:', error);
      }
    }
  };

  const handleNavigateToInquiry = (conversationId: string) => {
    // FIXED: Added safety checks
    if (!conversationId || typeof conversationId !== 'string') {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Invalid conversationId provided:', conversationId);
      }
      return;
    }
    try {
      const conv = safeConversations.find(c => c && c.id === conversationId);
      if (conv) {
        openHotLeadConversation(conv);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error in handleNavigateToInquiry:', error);
      }
    }
  };

  // Guard against missing seller / callbacks (after all hooks — Rules of Hooks)
  if (!seller || !seller.email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('sellerDashboard.infoMissing')}</h2>
          <p className="text-gray-600 mb-6">{t('sellerDashboard.loadFailed')}</p>
          <button
            onClick={() => onNavigate(View.SELLER_LOGIN)}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            {t('sellerDashboard.goToLogin')}
          </button>
        </div>
      </div>
    );
  }

  if (!onAddVehicle || !onUpdateVehicle || !onDeleteVehicle || !onMarkAsSold) {
    console.error('❌ Dashboard: Missing required callback functions');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('sellerDashboard.configError')}</h2>
          <p className="text-gray-600 mb-6">{t('sellerDashboard.configErrorBody')}</p>
          <button
            type="button"
            onClick={() => {
              try {
                window.location.assign(window.location.pathname + window.location.search);
              } catch {
                window.location.reload();
              }
            }}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            {t('sellerDashboard.reloadPage')}
          </button>
        </div>
      </div>
    );
  }

  const renderPendingDealsBanner = () => {
    if (dealStatsError && activeView !== 'overview') {
      return (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-red-800">Could not load buyer leads</p>
            <p className="text-xs text-red-700 mt-0.5">{dealStatsError}</p>
          </div>
          <button
            type="button"
            onClick={() => refreshDealCommandStats()}
            className="shrink-0 px-4 py-2 text-sm font-bold rounded-lg bg-red-700 text-white hover:bg-red-800"
          >
            Retry
          </button>
        </div>
      );
    }
    if (pendingAcceptCount <= 0 || activeView === 'overview') return null;
    return (
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-900">
            {pendingAcceptCount === 1
              ? '1 buyer is waiting for you to accept chat'
              : `${pendingAcceptCount} buyers are waiting for you to accept chat`}
          </p>
          <p className="text-xs text-amber-800 mt-0.5">
            {t('sellerDashboard.hotLeads.openBanner')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleNavigate('messages')}
          className="shrink-0 px-4 py-2 text-sm font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700"
        >
          {t('sellerDashboard.hotLeads.openButton')}
        </button>
      </div>
    );
  };

  const renderContent = () => {
    switch(activeView) {
      case 'overview':
        if (selectedDealId) {
          return (
            <SellerPremiumPanel
              eyebrow="Deal"
              title="Lead detail"
              description="Review the buyer conversation and next steps."
              actions={
                <button
                  type="button"
                  onClick={() => setSelectedDealId(null)}
                  className="rounded-xl px-3.5 py-2 text-sm font-semibold text-stone-700"
                  style={sellerPremiumGhostBtnStyle}
                >
                  Back to leads
                </button>
              }
            >
              <DealDetailPage
                leadId={selectedDealId}
                currentUser={seller}
                role="seller"
                conversations={safeConversations.filter((c) =>
                  c && seller?.email ? conversationBelongsToSeller(c, seller.email, seller.id) : false,
                )}
                onBack={() => setSelectedDealId(null)}
                onOpenConversation={openHotLeadConversation}
                onNotify={(message, type) => onNotify?.(message, type ?? 'info')}
              />
            </SellerPremiumPanel>
          );
        }
        return (
          <div className="space-y-6">
            <SellerPremiumPanel
              eyebrow="Command"
              title="Hot leads"
              description="Accept chats, move deals forward, and keep buyers warm."
            >
              <SellerCommandHome
                seller={seller}
                commandCenter={commandCenter}
                commandCenterLoading={commandCenterLoading}
                commandCenterError={dealStatsError}
                onRefreshCommandCenter={(force) => refreshDealCommandStats(force)}
                conversations={safeConversations.filter((c) =>
                  c && seller?.email ? conversationBelongsToSeller(c, seller.email, seller.id) : false,
                )}
                onOpenDeal={(leadId) => setSelectedDealId(leadId)}
                onOpenConversation={openHotLeadConversation}
                onNavigateToMessages={() => handleNavigate('messages')}
                onNavigateToListings={() => handleNavigate('listings')}
                onNotify={(message, type) => {
                  onNotify?.(message, type ?? 'info');
                  void refreshDealCommandStats(true);
                }}
                onTaskViewed={() => setViewedTasksVersion((v) => v + 1)}
                onSignInAgain={() => {
                  void (async () => {
                    const { clearPersistedUserSession } = await import('../utils/validatePersistedSession.js');
                    const { logout } = await import('../services/userService.js');
                    clearPersistedUserSession();
                    logout();
                    onNavigate(View.SELLER_LOGIN);
                    window.location.reload();
                  })();
                }}
              />
            </SellerPremiumPanel>
          </div>
        );
      case 'analytics':
        return (
          <SellerAnalyticsView
            selectedMonth={selectedMonth}
            onSelectedMonthChange={setSelectedMonth}
            monthOptions={monthOptions}
            filteredPublishedListings={filteredPublishedListings}
            analyticsData={analyticsData}
            sellerVehicles={safeSellerVehicles}
          />
        );
      case 'listings':
        return (
          <SellerListingsView
            pendingDealsBanner={renderPendingDealsBanner()}
            activeListings={activeListings}
            paginatedListings={paginatedListings}
            seller={seller}
            dealsByVehicleId={dealsByVehicleId}
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            onCurrentPageChange={setCurrentPage}
            onViewVehicle={onViewVehicle}
            onBulkUpload={() => setIsBulkUploadOpen(true)}
            onAddNew={handleAddNewClick}
            getListingRenewalValidation={getListingRenewalValidation}
            isVehicleListingExpired={isVehicleListingExpired}
            onRefreshVehicle={handleRefreshVehicle}
            onRenewVehicle={handleRenewVehicle}
            onOpenDeal={(leadId) => setSelectedDealId(leadId)}
            onNavigateToOverview={() => handleNavigate('overview')}
            onBoost={(v) => {
              setVehicleToBoost(v);
              setShowBoostModal(true);
            }}
            onRenewBlocked={(reason) => dashboardNotify(onNotify, reason, 'error')}
            onEdit={handleEditClick}
            onSold={handleMarkAsSold}
            onDelete={onDeleteVehicle}
            onCertify={handleCertifyVehicle}
          />
        );
      case 'salesHistory':
        return (
          <SellerSalesHistoryView
            soldListings={soldListings}
            paginatedSoldListings={paginatedSoldListings}
            soldPage={soldPage}
            totalSoldPages={totalSoldPages}
            soldPageSize={SOLD_PAGE_SIZE}
            onSoldPageChange={setSoldPage}
            onViewVehicle={onViewVehicle}
            onMarkAsUnsold={handleMarkAsUnsold}
          />
        );
      case 'form':
        return (
          <SellerPremiumPanel
            eyebrow="Listing"
            title={editingVehicle ? 'Edit vehicle' : 'Add vehicle'}
            description={
              editingVehicle
                ? 'Update details, photos, and listing status.'
                : 'Create a listing, then boost it from My listings.'
            }
          >
            <VehicleForm 
              seller={seller}
              editingVehicle={editingVehicle} 
              onAddVehicle={onAddVehicle} 
              onUpdateVehicle={onUpdateVehicle} 
              onCancel={handleFormCancel} 
              vehicleData={safeVehicleData} 
              onFeatureListing={onFeatureListing}
              allVehicles={allVehicles}
              onNotify={onNotify}
            />
          </SellerPremiumPanel>
        );
      case 'messages':
        return (
          <SellerPremiumPanel
            eyebrow="Inbox"
            title={t('sellerDashboard.nav.messages')}
            description="Buyer chats and listing inquiries."
          >
            <InquiriesView 
              conversations={safeConversations} 
              sellerEmail={seller.email}
              sellerUserId={seller.id}
              onMarkConversationAsReadBySeller={onMarkConversationAsReadBySeller} 
              onMarkMessagesAsRead={onMarkMessagesAsRead}
              onSelectConv={setSelectedConv}
              onSetConversationReadState={onSetConversationReadState}
              onMarkAllAsReadBySeller={onMarkAllAsReadBySeller}
            />
          </SellerPremiumPanel>
        );
      case 'settings':
        if (!seller) {
          return (
            <SellerPremiumPanel eyebrow="Account" title="Settings" description="Loading seller profile…">
              <p className="text-sm text-stone-500">{t('sellerDashboard.loadingSellerInfo')}</p>
            </SellerPremiumPanel>
          );
        }
        return (
          <SellerPremiumPanel
            eyebrow="Account"
            title={t('sellerDashboard.nav.settings')}
            description="Plan, profile, and dealership preferences."
          >
            <SettingsView
              seller={seller}
              onUpdateSeller={onUpdateSellerProfile}
              onNotify={onNotify}
              activeListingsCount={publishedListings.length}
              featuredListingsCount={safeSellerVehicles.filter(v => v && isEffectivelyFeatured(v)).length}
              onNavigate={onNavigate}
            />
          </SellerPremiumPanel>
        );
      case 'reports':
        return (
          <SellerPremiumPanel
            eyebrow="Trust & safety"
            title={t('sellerDashboard.nav.reports')}
            description="Listings flagged by buyers or moderation."
          >
            <ReportsView
              reportedVehicles={safeReportedVehicles}
              onEditVehicle={handleEditClick}
              onDeleteVehicle={onDeleteVehicle}
            />
          </SellerPremiumPanel>
        );
      case 'notifications':
        return (
          <SellerNotificationsView
            sellerNotifications={sellerNotifications}
            unreadNotificationCount={unreadNotificationCount}
            onNavigate={onNavigate}
            onNotificationClick={onNotificationClick}
            onMarkNotificationsAsRead={onMarkNotificationsAsRead}
          />
        );
      default:
        return (
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold text-reride-text-dark mb-4">
              {t('sellerDashboard.pageNotFound')}
            </h2>
            <p className="text-gray-600">{t('sellerDashboard.sectionNotFound')}</p>
          </div>
        );
    }
  }

  const NavItem: React.FC<{ view: DashboardView, children: React.ReactNode, count?: number, disabled?: boolean }> = ({ view, children, count, disabled = false }) => {
    const isActive = activeView === view;
    return (
      <button
        type="button"
        data-testid={view === 'form' ? 'seller-add-vehicle-nav' : undefined}
        onClick={() => {
          if (disabled) {
            if (view === 'form') notifyListingLimitReached();
            return;
          }
          handleNavigate(view);
        }}
        disabled={disabled}
        aria-disabled={disabled}
        aria-current={isActive ? 'page' : undefined}
        className={`group flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${
          disabled
            ? 'cursor-not-allowed text-stone-400 opacity-55'
            : isActive
            ? 'bg-stone-900 text-white shadow-lg shadow-stone-900/20'
            : 'text-stone-600 hover:bg-orange-50 hover:text-orange-800'
        }`}
      >
        <span className="font-medium tracking-tight">{children}</span>
        {typeof count === 'number' && count > 0 ? (
          <span
            aria-label={`${count} items`}
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
              isActive ? 'bg-white/20 text-white' : 'bg-orange-500 text-white'
            }`}
          >
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>
    );
  };

  // Removed unused AppNavItem component

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(165deg, #F7F4F0 0%, #FBF8F5 42%, #FFF7F2 100%)' }}>
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 right-0 w-[28rem] h-[28rem] rounded-full blur-3xl" style={{ background: 'radial-gradient(closest-side, rgba(255,107,53,0.16), transparent)' }} />
        <div className="absolute bottom-0 left-0 w-[32rem] h-[32rem] rounded-full blur-3xl" style={{ background: 'radial-gradient(closest-side, rgba(28,25,23,0.06), transparent)' }} />
      </div>
      
      {/* Firebase Connection Status Banner */}
      {databaseStatus && !databaseStatus.available && (
        <div className="relative z-20 bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-yellow-800">
                {t('sellerDashboard.databaseIssue')}
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  {(() => {
                    try {
                      return (
                        databaseStatus?.error || t('sellerDashboard.databaseErrorSupabase')
                      );
                    } catch (error) {
                      console.warn('⚠️ Error getting database error message:', error);
                      return t('sellerDashboard.databaseErrorGeneric');
                    }
                  })()}
                </p>
                {databaseStatus?.details && (
                  <p className="mt-1 text-xs">{databaseStatus.details}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="relative z-10 container mx-auto py-6 sm:py-8 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 lg:gap-8">
          {/* Premium Sidebar */}
          <aside className="lg:col-span-1">
            <nav
              aria-label={t('nav.dashboard') || 'Seller dashboard'}
              className="rounded-3xl p-4 sm:p-5 space-y-2 lg:sticky lg:top-6"
              style={{
                background: 'rgba(255,255,255,0.78)',
                border: '1px solid rgba(28,25,23,0.08)',
                boxShadow: '0 20px 40px -28px rgba(28,25,23,0.35)',
                backdropFilter: 'blur(16px)',
              }}
            >
              <div className="mb-4 space-y-3">
                <Logo
                  size="sm"
                  showText
                  className="shrink-0"
                  onClick={() => onNavigate(View.HOME)}
                />
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">Seller</p>
                    <h3
                      className="text-lg font-bold text-stone-900 truncate"
                      style={{ fontFamily: "'Nunito Sans', Poppins, sans-serif", letterSpacing: '-0.02em' }}
                    >
                      {t('nav.dashboard')}
                    </h3>
                    {(seller.dealershipName || seller.name) ? (
                      <p className="text-xs text-stone-500 truncate mt-0.5">
                        {seller.dealershipName || seller.name}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">Workspace</p>
              <NavItem view="overview" count={hotLeadsBadgeCount > 0 ? hotLeadsBadgeCount : undefined}>
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z"/>
                  </svg>
                  <span>{t('sellerDashboard.nav.overview')}</span>
                </div>
              </NavItem>
              
              <NavItem view="listings">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                  </svg>
                  <span>{t('sellerDashboard.nav.myListings')}</span>
                </div>
              </NavItem>
              
              <NavItem view="form" disabled={listingAtLimit}>
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                  </svg>
                  <span>{t('sellerDashboard.nav.addVehicle')}</span>
                </div>
              </NavItem>
              
              <p className="mb-2 mt-5 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">Communication</p>
              <NavItem view="messages" count={unreadCount}>
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                  </svg>
                  <span>{t('sellerDashboard.nav.messages')}</span>
                </div>
              </NavItem>

              <details
                className="pt-3"
                {...( ['analytics', 'reports', 'salesHistory', 'notifications', 'settings'].includes(activeView)
                  ? { open: true }
                  : {})}
              >
                <summary className="cursor-pointer list-none px-3.5 py-2.5 rounded-xl text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400 hover:bg-orange-50 hover:text-orange-800">
                  {t('nav.more')}
                </summary>
                <div className="mt-1 space-y-1">
              <NavItem view="analytics">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                  <span>{t('sellerDashboard.nav.analytics')}</span>
                </div>
              </NavItem>
              <NavItem view="reports" count={reportedCount}>
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <span>{t('sellerDashboard.nav.reports')}</span>
                </div>
              </NavItem>
              <NavItem view="salesHistory">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
                  </svg>
                  <span>{t('sellerDashboard.nav.salesHistory')}</span>
                </div>
              </NavItem>
              <NavItem view="notifications" count={unreadNotificationCount}>
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                  </svg>
                  <span>Notifications</span>
                </div>
              </NavItem>
              <NavItem view="settings">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  <span>{t('sellerDashboard.nav.settings')}</span>
                </div>
              </NavItem>
                </div>
              </details>

              {onLogout ? (
                <div className="mt-4 pt-3 border-t border-stone-200/80">
                  <button
                    type="button"
                    onClick={onLogout}
                    className="w-full px-3.5 py-2.5 rounded-xl text-left text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
                  >
                    {t('nav.logout')}
                  </button>
                </div>
              ) : null}
            </nav>
          </aside>
          
          {/* Premium Main Content */}
          <main className="lg:col-span-1 min-w-0">
            <div
              className="rounded-3xl p-4 sm:p-6 lg:p-7 min-h-[500px]"
              style={{
                background: 'rgba(255,255,255,0.55)',
                border: '1px solid rgba(28,25,23,0.06)',
                boxShadow: '0 20px 40px -28px rgba(28,25,23,0.25)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {(() => {
                try {
                  return renderContent();
                } catch (error) {
                  // Log error for debugging but don't crash the entire dashboard
                  if (process.env.NODE_ENV === 'development') {
                    console.error('❌ Error rendering dashboard content:', error);
                  }
                  logProductionError(error, 'Dashboard content render error');
                  
                  // Return a fallback UI instead of crashing
                  return (
                    <div className="text-center py-16 px-6">
                      <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {t('sellerDashboard.loadContentFailed')}
                      </h3>
                      <p className="text-gray-600 mb-4">{t('sellerDashboard.loadContentBody')}</p>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            window.location.assign(window.location.pathname + window.location.search);
                          } catch {
                            window.location.reload();
                          }
                        }}
                        className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
                      >
                        {t('sellerDashboard.refreshPage')}
                      </button>
                    </div>
                  );
                }
              })()}
            </div>
          </main>
        </div>
        
        {/* Premium Modals */}
        {selectedConv && seller && (
          <ChatWidget
            conversation={selectedConv}
            currentUserRole="seller"
            currentUserEmail={seller.email}
            otherUserName={selectedConv.customerName}
            otherUserOnline={chatPeerOnlineByConversationId?.[String(selectedConv.id)]}
            callTargetPhone={(() => {
              const contact = findUserByParticipantId(allUsers || [], selectedConv.customerId);
              return contact?.mobile || (contact as any)?.phone || '';
            })()}
            callTargetName={selectedConv.customerName}
            isInlineLaunch={true}
            onStartCall={(phone) => { if (phone) window.open(`tel:${phone}`); }}
            onSendMessage={(messageText, type, payload) => onSellerSendMessage(selectedConv.id, messageText, type, payload)}
            onClose={() => setSelectedConv(null)}
            onUserTyping={onUserTyping}
            onUserStoppedTyping={onUserStoppedTyping}
            uploaderEmail={seller.email}
            onMarkMessagesAsRead={onMarkMessagesAsRead}
            onFlagContent={(type, id, reason) => {
              // Persist the report so admins/moderators can review it.
              void import('../services/trustSafetyService').then(({ createSafetyReport }) => {
                try {
                  createSafetyReport(
                    seller.email || 'anonymous',
                    type === 'vehicle' ? 'vehicle' : 'conversation',
                    id,
                    'other',
                    reason || 'No reason provided',
                  );
                } catch (e) {
                  console.warn('Failed to save safety report:', e);
                }
              });
              // Best-effort server notify (endpoint may be absent in some envs).
              try {
                void authenticatedFetch('/api/content-reports', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    reportedBy: seller.email,
                    targetType: type,
                    targetId: id,
                    reason: reason || 'No reason provided',
                    createdAt: new Date().toISOString(),
                  }),
                }).catch(() => { /* ignore */ });
              } catch { /* ignore */ }
            }}
            typingStatus={typingStatus}
            onOfferResponse={onOfferResponse}
            onTestDriveResponse={onTestDriveResponse}
            onClearChat={onClearChat}
            onArchiveConversation={onArchiveConversation}
            onDeleteConversation={onDeleteConversation}
          />
        )}
        
        {isBulkUploadOpen && (
          <BulkUploadModal
            onClose={() => setIsBulkUploadOpen(false)}
            onAddMultipleVehicles={onAddMultipleVehicles}
            sellerEmail={seller.email}
          />
        )}
        
        {showBoostModal && vehicleToBoost && (
          <BoostListingModal
            vehicle={vehicleToBoost}
            featuredCredits={seller.featuredCredits ?? 0}
            onClose={() => { setShowBoostModal(false); setVehicleToBoost(null); }}
            onBoost={async (vehicleId, packageId) => {
              try {
                if (onBoostListing) {
                  await onBoostListing(vehicleId, packageId);
                } else {
                  const { executeSellerBoostListing } = await import('../utils/sellerBoostListing');
                  const result = await executeSellerBoostListing({
                    vehicleId,
                    packageId,
                    seller,
                    sellerVehicles: safeSellerVehicles,
                  });
                  await onUpdateVehicle(result.vehicle);
                  notify(
                    typeof result.remainingCredits === 'number'
                      ? `Listing boosted for 7 days! You have ${result.remainingCredits} boost credit${result.remainingCredits === 1 ? '' : 's'} left.`
                      : 'Your listing has been boosted! It will get more visibility.',
                    'success',
                  );
                }
                setShowBoostModal(false);
                setVehicleToBoost(null);
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
                if (!onBoostListing) {
                  notify(`Error boosting vehicle: ${errorMsg}`, 'error');
                }
                // Keep modal open so user can retry (handler already toasts when onBoostListing is set)
              }
            }}
          />
        )}
        {markSoldVehicle && (
          <MarkSoldDealModal
            vehicleId={markSoldVehicle.databaseId || markSoldVehicle.id}
            vehicleTitle={`${markSoldVehicle.make} ${markSoldVehicle.model}`}
            conversations={conversations}
            sellerEmail={seller.email}
            onClose={() => setMarkSoldVehicle(null)}
            onSuccess={async () => {
              notify('Sale recorded — buyer will confirm to unlock ratings', 'success');
              try {
                if (onMarkAsSold) {
                  await onMarkAsSold(markSoldVehicle.id);
                } else {
                  await onUpdateVehicle({
                    ...markSoldVehicle,
                    status: 'sold',
                    soldAt: new Date().toISOString(),
                    listingStatus: 'sold',
                  });
                }
              } catch (err) {
                notify(
                  err instanceof Error ? err.message : 'Failed to update listing status.',
                  'error',
                );
              } finally {
                setMarkSoldVehicle(null);
              }
            }}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
