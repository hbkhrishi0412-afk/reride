import * as React from 'react';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { View as ViewEnum, Vehicle, User, Notification, Conversation, SubscriptionPlan, type SearchFilters } from '../../types';
import { useApp } from '../AppProvider';
import useIsMobileApp from '../../hooks/useIsMobileApp';
import useIsLgUp from '../../hooks/useIsLgUp';
import { enrichVehiclesWithSellerInfo } from '../../utils/vehicleEnrichment';
import { matchesLocation } from '../../utils/cityMapping';
import { buildVehicleMutationBody } from '../../utils/vehicleIdentity';
import { addSellerListing, addSellerListingsBulk, assertSellerCanPublishListing } from '../../utils/sellerAddListing.js';
import { computeListingExpiresAtForSeller } from '../../utils/listingPlanRules.js';
import { authenticatedFetch } from '../../utils/authenticatedFetch';
import { planService } from '../../services/planService';
import { logInfo, logWarn, logError } from '../../utils/logger';
import { isPublicBuyListing } from '../../services/listingLifecycleService';
import { runBackgroundSync } from '../../utils/toastPolicy.js';
import { parseDeepLink } from '../../utils/mobileFeatures';
import { randomIntBelow } from '../../utils/secureRandom.js';
import { isCapacitorNativeApp } from '../../utils/isCapacitorNative';
import { currentUserForLocalSessionJson } from '../../utils/userLocalStorageSnapshot';
import {
  conversationBelongsToCustomer,
  conversationBelongsToSeller,
  normalizeInboxRole,
} from '../../utils/conversationParticipants';
import { updateProfilePassword } from '../../utils/profilePassword';
import {
  VehicleListErrorBoundary,
  DashboardErrorBoundary,
  AdminPanelErrorBoundary,
  AuthenticationErrorBoundary,
} from '../ErrorBoundaries';
import { DashboardSkeleton, MobileDashboardSkeleton, LoadingSpinner } from './AppViewSkeletons';
import type { AppApiResponse, AppServiceProvider, AppServiceRequestPayload } from '../../types/appServiceTypes';

export interface AppViewRendererLocals {
  serviceProvider: AppServiceProvider | null;
  setServiceProvider: React.Dispatch<React.SetStateAction<AppServiceProvider | null>>;
  serviceProviderOptions: Array<AppServiceProvider & { distanceKm?: number }>;
  inboxConversationIdToOpen: string | null;
  handleInboxInitialConversationConsumed: () => void;
  filtersFromUrl: Partial<SearchFilters> | undefined;
  applyFilters: (opts: {
    filters?: Record<string, string | number>;
    query?: string;
  }) => void;
  handleBrowseAllIndia: () => void;
  handleHomeUseMyLocation: (city: string, locationLabel: string) => void;
  openSellerProfileByEmail: (email: string) => void;
  requireLoginForDealerInteraction: () => void;
  handleServiceRequestSubmit: (payload: AppServiceRequestPayload) => Promise<void>;
  handleUseMyLocation: () => Promise<void>;
  handleStartVehicleChat: (vehicle: Vehicle) => Promise<void>;
  handleRequestTestDrive: (
    vehicle: Vehicle,
    details: { date: string; time: string },
  ) => void | Promise<void>;
  handleTestDriveResponse: (
    conversationId: string,
    messageId: number,
    newStatus: 'confirmed' | 'rejected',
  ) => void | Promise<void>;
  handleSellerOpenChatFromDashboard: (conversation: Conversation) => void;
  setForgotPasswordRole: (role: 'customer' | 'seller' | null) => void;
  handleLogin: (user: User) => void;
  handleRegister: (user: User) => void;
  handleLogoutAll: () => void;
  handleNotificationClick: (notification: Notification) => void;
  handleAcceptDealChat: (leadId: string, conversationId?: string) => void | Promise<boolean>;
  handleMarkNotificationsAsRead: (ids: number[]) => void | Promise<void>;
  handleMarkAllNotificationsAsRead: () => void | Promise<void>;
  markAllVisibleAsRead: (role: 'customer' | 'seller') => void | Promise<void>;
  isLocating: boolean;
  locationError: string | null;
}

function userHasAdminRole(user: User | null | undefined): boolean {
  return (user?.role || '').toLowerCase().trim() === 'admin';
}

const MinimalLoader: React.FC = () => null;

const Home = React.lazy(() => import('../Home'));
const VehicleList = React.lazy(() => import('../VehicleList'));
const VehicleDetail = React.lazy(() => import('../VehicleDetail'));
// Enhanced lazy loading with error handling for production
const Dashboard = React.lazy(() => {
  return import('../Dashboard').then(module => {
    return module;
  }).catch((error) => {
    // Log the error for debugging in production
    const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
    if (isProduction) {
      logError('[Production] Failed to load Dashboard component:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
    } else {
      logError('Failed to load Dashboard component:', error);
    }
    // Return a fallback component module instead of throwing
    return {
      default: () => (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Failed to Load Dashboard</h2>
            <p className="text-gray-600 mb-6">There was an error loading the dashboard. Please refresh the page.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    };
  });
});
const AdminPanel = React.lazy(() => import('../AdminPanel'));
const Comparison = React.lazy(() => import('../Comparison'));
const Profile = React.lazy(() => import('../Profile'));
const CustomerInbox = React.lazy(() => import('../CustomerInbox'));
const SellerProfilePage = React.lazy(() => import('../SellerProfilePage'));
const DealerProfiles = React.lazy(() => import('../DealerProfiles'));
const CarServices = React.lazy(() => import('../CarServices'));
const ServiceDetail = React.lazy(() => import('../ServiceDetail'));
const CarServiceLogin = React.lazy(() => import('../CarServiceLogin'));
const CarServiceDashboard = React.lazy(() => import('../CarServiceDashboard'));
const MobileCarServiceDashboard = React.lazy(() => import('../MobileCarServiceDashboard'));
const PricingPage = React.lazy(() => import('../PricingPage'));
const SupportPage = React.lazy(() => import('../SupportPage'));
const AboutUsPage = React.lazy(() => import('../AboutUsPage'));
const FAQPage = React.lazy(() => import('../FAQPage'));
const BuyerDashboard = React.lazy(() => import('../BuyerDashboard'));
const CityLandingPage = React.lazy(() => import('../CityLandingPage'));
const UnifiedLogin = React.lazy(() => import('../UnifiedLogin'));
const ForgotPassword = React.lazy(() => import('../ForgotPassword'));
const SellCarPage = React.lazy(() => import('../SellCarPage'));
const SellCarAdmin = React.lazy(() => import('../SellCarAdmin'));
const AdminLogin = React.lazy(() => import('../../AdminLogin'));
// Lazy-loaded Mobile view components (only loaded when needed - reduces initial bundle size)
const MobileDashboard = React.lazy(() => import('../MobileDashboard'));
const MobileVehicleDetail = React.lazy(() => import('../MobileVehicleDetail'));
const MobileInbox = React.lazy(() => import('../MobileInbox'));
const NotificationsPage = React.lazy(() => import('../NotificationsPage'));
const MobileNotifications = React.lazy(() =>
  import('../MobileNotifications').then((m) => ({ default: m.MobileNotifications }))
);
const MobileProfile = React.lazy(() => import('../MobileProfile'));
const MobileWishlist = React.lazy(() => import('../MobileWishlist'));
const MobileComparison = React.lazy(() => import('../MobileComparison'));
const MobileSellerProfilePage = React.lazy(() => import('../MobileSellerProfilePage'));
const MobileSellCarPage = React.lazy(() => import('../MobileSellCarPage'));
const MobilePricingPage = React.lazy(() => import('../MobilePricingPage'));
const MobileSupportPage = React.lazy(() => import('../MobileSupportPage'));
const MobileFAQPage = React.lazy(() => import('../MobileFAQPage'));
const PrivacyPolicyPage = React.lazy(() => import('../PrivacyPolicyPage'));
const MobilePrivacyPolicyPage = React.lazy(() => import('../MobilePrivacyPolicyPage'));
const SafetyCenterPage = React.lazy(() => import('../SafetyCenterPage'));
const TermsOfServicePage = React.lazy(() => import('../TermsOfServicePage'));
const MobileTermsOfServicePage = React.lazy(() => import('../MobileTermsOfServicePage'));
const RefundPolicyPage = React.lazy(() => import('../RefundPolicyPage'));
const ComplaintResolutionPage = React.lazy(() => import('../ComplaintResolutionPage'));
const FraudPolicyPage = React.lazy(() => import('../FraudPolicyPage'));
const CookiePolicyPage = React.lazy(() => import('../CookiePolicyPage'));
const HelpCenterPage = React.lazy(() => import('../HelpCenterPage'));
const NotFoundPage = React.lazy(() => import('../NotFoundPage'));
const MobileBuyerDashboard = React.lazy(() => import('../MobileBuyerDashboard'));
const MobileDealerProfilesPage = React.lazy(() => import('../MobileDealerProfilesPage'));
const MobileHomePage = React.lazy(() => import('../MobileHomePage'));
const ServiceCart = React.lazy(() => import('../ServiceCart'));

// Lazy-loaded non-critical components (loaded on demand)
const CommandPalette = React.lazy(() => import('../CommandPalette'));
const KeyboardShortcutsHelp = React.lazy(() => import('../KeyboardShortcutsHelp'));
const ChatWidget = React.lazy(() => import('../ChatWidget').then(module => ({ default: module.ChatWidget })));

export const AppViewRenderer: React.FC<AppViewRendererLocals> = (locals) => {
  const { isMobileApp } = useIsMobileApp();
  const isLgUp = useIsLgUp();
  const preferCompactDashboard = isMobileApp || !isLgUp;
  const { t } = useTranslation();
  const {
    currentView,
    navigate,
    goBack,
    previousView,
    vehicles,
    users,
    currentUser,
    comparisonList,
    comparisonCategory,
    wishlist,
    conversations,
    recommendations,
    initialSearchQuery,
    selectedCategory: currentCategory,
    selectedCity,
    publicSellerProfile,
    selectedVehicle,
    isLoading,
    vehiclesCatalogReady,
    vehicleData,
    faqItems,
    platformSettings,
    auditLog,
    supportTickets,
    notifications,
    typingStatus,
    userLocation,
    addToast,
    setInitialSearchQuery,
    setSelectedCategory,
    setSelectedCity,
    selectVehicle,
    setSelectedVehicle,
    setComparisonList,
    setWishlist,
    setPublicSellerProfile: setPublicProfile,
    setVehicles,
    setUsers,
    setCurrentUser,
    setSupportTickets,
    markAsRead,
    toggleTyping,
    flagContent,
    updateUser,
    deleteUser,
    updateVehicle,
    deleteVehicle,
    toggleWishlist,
    toggleCompare,
    onAdminUpdateUser,
    onUpdateUserPlan,
    onToggleUserStatus,
    onToggleVehicleStatus,
    onToggleVehicleFeature,
    onResolveFlag,
    onUpdateSettings,
    onSendBroadcast,
    onExportUsers,
    onExportVehicles,
    onExportSales,
    onUpdateVehicleData,
    onToggleVerifiedStatus,
    onUpdateSupportTicket,
    onAddFaq,
    onUpdateFaq,
    onDeleteFaq,
    onCertificationApproval,
    onOfferResponse,
    addSellerRating,
    sendMessage,
    setActiveChat,
    setConversations,
    setUserLocation,
    refreshVehicles,
    chatPeerOnlineByConversationId,
    sendMessageWithType,
    setConversationReadState,
    clearConversationMessages,
    deleteConversation,
    onCreateUser,
    onImportUsers,
    onImportVehicles,
  } = useApp();

  const {
    serviceProvider,
    setServiceProvider,
    serviceProviderOptions,
    inboxConversationIdToOpen,
    handleInboxInitialConversationConsumed,
    filtersFromUrl,
    applyFilters,
    handleBrowseAllIndia,
    handleHomeUseMyLocation,
    openSellerProfileByEmail,
    requireLoginForDealerInteraction,
    handleServiceRequestSubmit,
    handleUseMyLocation,
    handleStartVehicleChat,
    handleRequestTestDrive,
    handleTestDriveResponse,
    handleSellerOpenChatFromDashboard,
    setForgotPasswordRole,
    handleLogin,
    handleRegister,
    handleLogoutAll,
    handleNotificationClick,
    handleAcceptDealChat,
    handleMarkNotificationsAsRead,
    handleMarkAllNotificationsAsRead,
    markAllVisibleAsRead,
    isLocating,
    locationError,
  } = locals;

switch (currentView) {
  case ViewEnum.HOME:
    if (isMobileApp) {
      // Return just the component - MobileLayout wrapper is handled by outer wrapper
      return (
        <MobileHomePage
          onSearch={(query) => {
            setInitialSearchQuery(query);
            navigate(ViewEnum.USED_CARS);
          }}
          onApplyFilters={applyFilters}
          onSelectCategory={(category) => {
            setSelectedCategory(category);
            navigate(ViewEnum.USED_CARS);
          }}
          featuredVehicles={enrichVehiclesWithSellerInfo(
            vehicles.filter(v => v.isFeatured && v.status === 'published'),
            users
          )}
          onSelectVehicle={selectVehicle}
          onToggleCompare={toggleCompare}
          comparisonList={comparisonList}
          onToggleWishlist={(id) => {
            setWishlist(prev => 
              prev.includes(id) 
                ? prev.filter(vId => vId !== id)
                : [...prev, id]
            );
          }}
          wishlist={wishlist}
          onViewSellerProfile={openSellerProfileByEmail}
          recommendations={recommendations}
          allVehicles={vehicles.filter(v => v.status === 'published')}
          onNavigate={navigate}
          onSelectCity={(city) => {
            // Pass city in navigate params â€” navigate(USED_CARS) without params clears the filter in AppProvider.
            navigate(ViewEnum.USED_CARS, { city });
          }}
          userLocation={userLocation}
          onLocationChange={setUserLocation}
          addToast={addToast}
          selectedCity={selectedCity}
          onBrowseAllIndia={handleBrowseAllIndia}
          onUseMyLocation={handleHomeUseMyLocation}
          isCatalogLoading={isLoading || (!vehiclesCatalogReady && vehicles.length === 0)}
          onRetryCatalogLoad={() => void refreshVehicles({ userInitiated: true })}
          currentUser={currentUser}
        />
      );
    }
    return (
      <Home 
        onSearch={(query) => {
          setInitialSearchQuery(query);
          navigate(ViewEnum.USED_CARS);
        }}
        onApplyFilters={applyFilters}
        onSelectCategory={(category) => {
          setSelectedCategory(category);
          navigate(ViewEnum.USED_CARS);
        }}
        featuredVehicles={enrichVehiclesWithSellerInfo(
          vehicles.filter(v => v.isFeatured && v.status === 'published'),
          users
        )}
        onSelectVehicle={selectVehicle}
        onToggleCompare={toggleCompare}
        comparisonList={comparisonList}
        onToggleWishlist={(id) => {
          setWishlist(prev => 
            prev.includes(id) 
              ? prev.filter(vId => vId !== id)
              : [...prev, id]
          );
        }}
        wishlist={wishlist}
        onViewSellerProfile={openSellerProfileByEmail}
        recommendations={recommendations}
        allVehicles={vehicles.filter(v => v.status === 'published')}
        onNavigate={navigate}
        onSelectCity={(city) => {
          // Pass city in navigate params â€” navigate(USED_CARS) without params clears the filter in AppProvider.
          navigate(ViewEnum.USED_CARS, { city });
        }}
        selectedCity={selectedCity}
        onBrowseAllIndia={handleBrowseAllIndia}
        onUseMyLocation={handleHomeUseMyLocation}
        userLocation={userLocation}
        onOpenLocationPicker={() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('reride:open-location-modal'));
          }
        }}
        addToast={addToast}
        isCatalogLoading={isLoading || (!vehiclesCatalogReady && vehicles.length === 0)}
        onRetryCatalogLoad={() => void refreshVehicles({ userInitiated: true })}
        currentUser={currentUser}
      />
    );

  case ViewEnum.USED_CARS: {
    // Filter vehicles for buy/sale (exclude rental vehicles)
    // Filter by status, listingType, and city if explicitly selected (not auto-detected)
    // Only use selectedCity, not userLocation, so users can see all vehicles by default
    const cityFilter = selectedCity || '';
    const filteredVehicles = vehicles.filter(v => {
      if (!v) return false;
      const isBuyable = isPublicBuyListing(v);
      // Exclude rental vehicles from buy/sale listings
      const isNotRental = v.listingType !== 'rental' || v.listingType === undefined;
      // Apply city filter only if a city is explicitly selected (using city mapping for accurate matching)
      const matchesCityFilter = matchesLocation(v.city, v.state, cityFilter);
      
      return isBuyable && isNotRental && matchesCityFilter;
    });
    
    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      logInfo('USED_CARS filter results:', {
        totalVehicles: vehicles.length,
        publishedVehicles: vehicles.filter(v => isPublicBuyListing(v)).length,
        rentalVehicles: vehicles.filter(v => v.listingType === 'rental').length,
        selectedCity: selectedCity || 'none',
        filteredVehicles: filteredVehicles.length,
        sampleVehicleCities: vehicles.slice(0, 5).map(v => v.city).filter(Boolean)
      });
    }
    
    return (
      <VehicleListErrorBoundary>
        <VehicleList
          vehicles={enrichVehiclesWithSellerInfo(filteredVehicles, users)}
          onSelectVehicle={selectVehicle}
          isLoading={isLoading || (!vehiclesCatalogReady && vehicles.length === 0)}
          comparisonList={comparisonList}
          comparisonCategory={comparisonCategory}
          onToggleCompare={toggleCompare}
          onClearCompare={() => setComparisonList([])}
          onOpenCompare={() => navigate(ViewEnum.COMPARISON)}
          wishlist={wishlist}
          onToggleWishlist={(id) => {
            setWishlist(prev => 
              prev.includes(id) 
                ? prev.filter(vId => vId !== id)
                : [...prev, id]
            );
          }}
          categoryTitle={selectedCity ? `Used Cars in ${selectedCity}` : "Used Cars"}
          initialCategory={currentCategory}
          initialSearchQuery={initialSearchQuery}
          initialFilters={filtersFromUrl}
          onViewSellerProfile={openSellerProfileByEmail}
          userLocation={userLocation}
          currentUser={currentUser}
          onSaveSearch={(search) => {
            addToast(`Search "${search.name}" saved successfully!`, 'success');
          }}
          selectedCity={selectedCity}
          onCityChange={(city) => {
            setSelectedCity(city);
          }}
          sourceVehicleCount={vehicles.length}
          onRetryLoadVehicles={() => void refreshVehicles({ userInitiated: true })}
        />
      </VehicleListErrorBoundary>
    );
  }

  case ViewEnum.DETAIL: {
    // Enhanced recovery: Check both state and sessionStorage
    if (process.env.NODE_ENV === 'development') {
      logInfo('ðŸŽ¯ App.tsx: Rendering DETAIL view');
      logInfo('ðŸŽ¯ Current selectedVehicle from state:', selectedVehicle?.id, selectedVehicle?.make, selectedVehicle?.model);
    }
    
    let vehicleToDisplay = selectedVehicle;
    if (!vehicleToDisplay) {
      try {
        const storedVehicle = sessionStorage.getItem('selectedVehicle');
        if (storedVehicle) {
          vehicleToDisplay = JSON.parse(storedVehicle);
          if (process.env.NODE_ENV === 'development') {
            logInfo('ðŸ”§ App.tsx: Recovered vehicle from sessionStorage for rendering:', vehicleToDisplay?.id, vehicleToDisplay?.make, vehicleToDisplay?.model);
          }
          // Update state for future renders
          setSelectedVehicle(vehicleToDisplay);
        } else {
          if (process.env.NODE_ENV === 'development') {
            logWarn('âš ï¸ App.tsx: No vehicle in sessionStorage');
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          logError('âŒ App.tsx: Failed to recover vehicle from sessionStorage:', error);
        }
      }
    }
    
    if (!vehicleToDisplay) {
      const pendingDetailId = (() => {
        try {
          const params = parseDeepLink();
          if (params.view === ViewEnum.DETAIL && params.id != null) {
            const id = typeof params.id === 'string' ? parseInt(params.id, 10) : Number(params.id);
            return Number.isFinite(id) ? id : null;
          }
        } catch {
          /* ignore */
        }
        return null;
      })();
      const catalogStillLoading = vehicles.length === 0 && (isLoading || pendingDetailId != null);
      if (catalogStillLoading) {
        return (
          <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-reride-orange mx-auto mb-4" />
              <p className="text-gray-600">Loading vehicle detailsâ€¦</p>
            </div>
          </div>
        );
      }
      if (process.env.NODE_ENV === 'development') {
        logError('âŒ App.tsx: No vehicle to display - showing error message');
      }
      return (
        <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-600 mb-4">Vehicle Not Found</h2>
            <p className="text-gray-500 mb-4">Please select a vehicle to view details.</p>
            <button 
              onClick={() => navigate(ViewEnum.USED_CARS)}
              className="btn-brand-primary"
            >
              Browse Vehicles
            </button>
          </div>
        </div>
      );
    }
    
    if (process.env.NODE_ENV === 'development') {
      logInfo('âœ… App.tsx: Vehicle found, rendering VehicleDetail component:', vehicleToDisplay.id, vehicleToDisplay.make, vehicleToDisplay.model);
    }
    
    // Use MobileVehicleDetail for mobile app, VehicleDetail for desktop
    if (isMobileApp) {
      return (
        <MobileVehicleDetail
          vehicle={vehicleToDisplay}
          onBack={() => goBack(ViewEnum.USED_CARS)}
          comparisonList={comparisonList}
          onToggleCompare={toggleCompare}
          onAddSellerRating={addSellerRating}
          wishlist={wishlist}
          onToggleWishlist={toggleWishlist}
          currentUser={currentUser}
          onFlagContent={(type, id, _reason) => flagContent(type, id)}
          users={users}
          onViewSellerProfile={openSellerProfileByEmail}
          onRequestLogin={() => {
            try {
              sessionStorage.setItem('reride.postLoginView', ViewEnum.DETAIL);
            } catch {
              /* ignore */
            }
            addToast('Please login to verify this vehicle', 'info');
            navigate(ViewEnum.CUSTOMER_LOGIN);
          }}
          onStartChat={handleStartVehicleChat}
          recommendations={recommendations}
          onSelectVehicle={selectVehicle}
        />
      );
    }
    
    return (
      <VehicleDetail
        vehicle={vehicleToDisplay}
        onBack={() => goBack(ViewEnum.USED_CARS)}
        comparisonList={comparisonList}
        onToggleCompare={toggleCompare}
        onAddSellerRating={addSellerRating}
        wishlist={wishlist}
        onToggleWishlist={toggleWishlist}
        currentUser={currentUser}
        onFlagContent={(type, id, _reason) => flagContent(type, id)}
        users={users}
        updateVehicle={updateVehicle}
        onViewSellerProfile={openSellerProfileByEmail}
        onStartChat={handleStartVehicleChat}
        recommendations={recommendations}
        onSelectVehicle={selectVehicle}
      />
    );
  }

  case ViewEnum.RENTAL: {
    // Rental vehicles feature not currently used - redirect to used cars page
    const RentalRedirect: React.FC = () => {
      React.useEffect(() => {
        navigate(ViewEnum.USED_CARS);
      }, []);
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600">Redirecting to used cars...</p>
          </div>
        </div>
      );
    };
    return <RentalRedirect />;
  }

  case ViewEnum.COMPARISON:
    if (isMobileApp) {
      return (
        <MobileComparison
          vehicles={vehicles}
          comparisonList={comparisonList}
          comparisonCategory={comparisonCategory}
          onRemoveFromCompare={(id) => {
            setComparisonList(prev => prev.filter(vId => vId !== id));
          }}
          onSelectVehicle={selectVehicle}
          onBack={() => goBack(ViewEnum.USED_CARS)}
          onClearCompare={() => setComparisonList([])}
        />
      );
    }
    return (
      <Comparison 
        vehicles={enrichVehiclesWithSellerInfo(vehicles.filter(v => comparisonList.includes(v.id)), users)}
        comparisonCategory={comparisonCategory}
        onBack={() => goBack(ViewEnum.USED_CARS)}
        onToggleCompare={toggleCompare}
        onClearCompare={() => setComparisonList([])}
      />
    );

  case ViewEnum.WISHLIST:
    if (isMobileApp) {
      return (
        <MobileWishlist
          vehicles={enrichVehiclesWithSellerInfo(vehicles.filter(v => wishlist.includes(v.id)), users)}
          wishlist={wishlist}
          onToggleWishlist={toggleWishlist}
          onSelectVehicle={selectVehicle}
          onToggleCompare={toggleCompare}
          comparisonList={comparisonList}
          currentUser={currentUser}
          onViewSellerProfile={openSellerProfileByEmail}
          onNavigate={navigate}
          isCatalogLoading={isLoading || (!vehiclesCatalogReady && vehicles.length === 0)}
        />
      );
    }
    return (
      <VehicleList
        vehicles={enrichVehiclesWithSellerInfo(vehicles.filter(v => wishlist.includes(v.id)), users)}
        onSelectVehicle={selectVehicle}
        isLoading={isLoading || (!vehiclesCatalogReady && vehicles.length === 0)}
        comparisonList={comparisonList}
        comparisonCategory={comparisonCategory}
        onToggleCompare={toggleCompare}
        onClearCompare={() => setComparisonList([])}
        onOpenCompare={() => navigate(ViewEnum.COMPARISON)}
        wishlist={wishlist}
        onToggleWishlist={(id) => {
          setWishlist(prev => 
            prev.includes(id) 
              ? prev.filter(vId => vId !== id)
              : [...prev, id]
          );
        }}
        categoryTitle="My Wishlist"
        isWishlistMode={true}
        onViewSellerProfile={openSellerProfileByEmail}
        userLocation={userLocation}
        currentUser={currentUser}
        onSaveSearch={(search) => {
          addToast(`Search "${search.name}" saved successfully!`, 'success');
        }}
      />
    );

  case ViewEnum.SELLER_DASHBOARD: {
    // CRITICAL: Enhanced validation for seller dashboard access
    logInfo('ðŸ” Seller Dashboard Access Check:', {
      hasCurrentUser: !!currentUser,
      userEmail: currentUser?.email,
      userRole: currentUser?.role,
      userObject: currentUser ? {
        id: currentUser.id,
        email: currentUser.email,
        role: currentUser.role,
        name: currentUser.name
      } : null,
      isProduction: typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
    });
    
    if (!currentUser) {
      logWarn('âš ï¸ Attempted to render seller dashboard without logged-in user');
      navigate(ViewEnum.LOGIN_PORTAL);
      return null;
    }
    
    if (!currentUser.email || !currentUser.role) {
      logError('âŒ Invalid user object - missing email or role:', { 
        hasEmail: !!currentUser.email, 
        hasRole: !!currentUser.role,
        userObject: currentUser
      });
      navigate(ViewEnum.LOGIN_PORTAL);
      return null;
    }
    
    if (currentUser.role !== 'seller') {
      logWarn('âš ï¸ Attempted to render seller dashboard with role:', currentUser.role, 'Expected: seller');
      navigate(ViewEnum.LOGIN_PORTAL);
      return null;
    }
    
    logInfo('âœ… Seller dashboard validation passed, rendering dashboard');
    
    // Safety check: Ensure vehicleData is defined
    if (!vehicleData) {
      logError('âŒ vehicleData is undefined, cannot render dashboard');
      return (
        <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-600 mb-4">Loading Dashboard...</h2>
            <p className="text-gray-500">Please wait while we load the dashboard data.</p>
          </div>
        </div>
      );
    }
    
    const sellerVehiclesFiltered = (vehicles || []).filter(v => {
      if (!v || !v.sellerEmail || !currentUser?.email) return false;
      return v.sellerEmail.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
    });

    // Use MobileDashboard for mobile / compact viewports, Dashboard for large desktop
    if (preferCompactDashboard) {
      // Return just the component - MobileLayout wrapper is handled by outer wrapper
      return (
        <DashboardErrorBoundary>
          <Suspense fallback={<MobileDashboardSkeleton />}>
          <MobileDashboard
              currentUser={currentUser}
              userVehicles={enrichVehiclesWithSellerInfo(
                sellerVehiclesFiltered,
                users || []
              )}
              reportedVehicles={(sellerVehiclesFiltered || []).filter(
                (v) => v && v.isFlagged
              )}
              conversations={(conversations || []).filter(
                (c) =>
                  c &&
                  currentUser?.email &&
                  conversationBelongsToSeller(c, currentUser.email, currentUser.id)
              )}
              onNavigate={navigate}
              onEditVehicle={(vehicle) => {
                // MobileDashboard handles editing internally
                logInfo('Edit vehicle:', vehicle);
              }}
              onDeleteVehicle={async (vehicleId) => {
                await deleteVehicle(vehicleId);
              }}
              onMarkAsSold={async (vehicleId) => {
                const vehicle = vehicles.find(v => v.id === vehicleId);
                if (vehicle) {
                  await updateVehicle(vehicleId, { status: 'sold', soldAt: new Date().toISOString(), listingStatus: 'sold' });
                }
              }}
              onMarkAsUnsold={async (vehicleId) => {
                const vehicle = vehicles.find((v) => v.id === vehicleId);
                if (!vehicle) return;
                const canPublish = await assertSellerCanPublishListing({
                  currentUser,
                  vehicle,
                  sellerVehicles: sellerVehiclesFiltered || [],
                  addToast,
                });
                if (!canPublish) return;
                await updateVehicle(vehicleId, { status: 'published', soldAt: undefined, listingStatus: 'active' });
              }}
              onAddMultipleVehicles={async (vehiclesData) => {
                if (currentUser.planExpiryDate) {
                  const expiryDate = new Date(currentUser.planExpiryDate);
                  if (expiryDate < new Date()) {
                    addToast('Your subscription has expired. Please renew to add new listings.', 'error');
                    return;
                  }
                }
                const listingExpiresAt = computeListingExpiresAtForSeller(currentUser);
                await addSellerListingsBulk({
                  currentUser,
                  vehiclesData,
                  listingExpiresAt,
                  setVehicles,
                  nextNumericId: () => Date.now() + randomIntBelow(1000),
                  addToast,
                  logError,
                  sellerVehicles: sellerVehiclesFiltered || [],
                });
              }}
              onRequestCertification={async (vehicleId) => {
                try {
                  const vehicle = vehicles.find(v => v.id === vehicleId);
                  const sellerEmail = vehicle?.sellerEmail || currentUser?.email;
                  const normalizedSellerEmail = sellerEmail ? sellerEmail.toLowerCase().trim() : '';
                  const seller = normalizedSellerEmail ? users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) : undefined;
                  if (!seller) {
                    addToast('Could not process certification request. Please try again.', 'error');
                    return;
                  }
                  const planId = (seller.subscriptionPlan || 'free') as SubscriptionPlan;
                  const planDetails = await planService.getPlanDetails(planId);
                  const totalCertifications = planDetails.freeCertifications ?? 0;
                  const usedCertifications = seller.usedCertifications ?? 0;
                  if (totalCertifications <= 0) {
                    addToast(
                      `The ${planDetails.name} plan does not include certification requests. Upgrade your plan to request certifications.`,
                      'warning'
                    );
                    return;
                  }
                  if (usedCertifications >= totalCertifications) {
                    addToast(
                      `You have used all ${totalCertifications} certification requests included in your ${planDetails.name} plan. Upgrade to request more.`,
                      'warning'
                    );
                    return;
                  }
                  const { authenticatedFetch } = await import('../../utils/authenticatedFetch');
                  const response = await authenticatedFetch('/api/vehicles?action=certify', {
                    method: 'POST',
                    body: JSON.stringify(buildVehicleMutationBody(vehicleId, vehicles)),
                  });
                  const responseText = await response.text();
                  let result: AppApiResponse = {};
                  if (responseText) {
                    try {
                      result = JSON.parse(responseText) as AppApiResponse;
                    } catch (parseError) {
                      logWarn('âš ï¸ Failed to parse certification response JSON:', parseError);
                    }
                  }
                  if (!response.ok) {
                    addToast('Could not submit certification request. Please try again.', 'error');
                    return;
                  }
                  if (result?.alreadyRequested) {
                    addToast('This vehicle is already pending certification review.', 'info');
                    return;
                  }
                  if (!result?.success || !result?.vehicle) {
                    addToast('Could not submit certification request. Please try again.', 'error');
                    return;
                  }
                  await updateVehicle(vehicleId, result.vehicle, {
                    successMessage: 'Certification request submitted for review',
                  });
                  const updatedUsedCertifications =
                    typeof result.usedCertifications === 'number'
                      ? result.usedCertifications
                      : usedCertifications + 1;
                  setUsers((prevUsers: User[]) =>
                    prevUsers.map((user: User) => {
                      if (!user || !user.email) return user;
                      return user.email.toLowerCase().trim() === normalizedSellerEmail
                        ? { ...user, usedCertifications: updatedUsedCertifications }
                        : user;
                    })
                  );
                  if (currentUser?.email && currentUser.email.toLowerCase().trim() === normalizedSellerEmail) {
                    setCurrentUser({
                      ...currentUser,
                      usedCertifications: updatedUsedCertifications,
                    });
                  }
                  await runBackgroundSync('Certification usage sync', () =>
                    updateUser(seller.email, { usedCertifications: updatedUsedCertifications }, { skipToast: true }),
                  );
                  if (typeof result.remainingCertifications === 'number') {
                    addToast(
                      `Certification requests remaining this month: ${result.remainingCertifications}`,
                      'info'
                    );
                  }
                } catch (error) {
                  logError('âŒ Failed to certify vehicle:', error);
                  addToast('Could not submit certification request. Please try again.', 'error');
                }
              }}
              onFeatureListing={async (vehicleId) => {
                try {
                  const { authenticatedFetch } = await import('../../utils/authenticatedFetch');
                  const response = await authenticatedFetch('/api/vehicles?action=feature', {
                    method: 'POST',
                    body: JSON.stringify(buildVehicleMutationBody(vehicleId, vehicles))
                  });

                  const responseText = await response.text();
                  let result: AppApiResponse<Vehicle> = {};
                  if (responseText) {
                    try {
                      result = JSON.parse(responseText) as AppApiResponse<Vehicle>;
                    } catch (parseError) {
                      logWarn('âš ï¸ Failed to parse feature response JSON:', parseError);
                      result = {};
                    }
                  }

                  if (!response.ok) {
                    const errorMessage = result?.reason || result?.error || 'Could not feature vehicle. Please try again.';
                    addToast(errorMessage, response.status === 403 ? 'warning' : 'error');
                    return;
                  }

                  if (result?.alreadyFeatured) {
                    addToast('This vehicle is already featured.', 'info');
                    return;
                  }

                  if (result?.success && result.vehicle) {
                    await updateVehicle(vehicleId, result.vehicle, { skipToast: true });

                    if (typeof result.remainingCredits === 'number') {
                      const sellerEmail = result.vehicle?.sellerEmail || currentUser?.email;
                      const remainingCredits = result.remainingCredits;

                      if (sellerEmail) {
                        if (currentUser?.email && currentUser.email.toLowerCase().trim() === sellerEmail.toLowerCase().trim()) {
                          setCurrentUser({
                            ...currentUser,
                            featuredCredits: remainingCredits
                          });
                        }
                        await runBackgroundSync('Featured credits sync', () =>
                          updateUser(sellerEmail, { featuredCredits: remainingCredits }, { skipToast: true }),
                        );
                      }

                      addToast(`Listing featured! You have ${remainingCredits} feature credits left.`, 'success');
                    } else {
                      addToast('Listing featured successfully!', 'success');
                    }
                  } else {
                    addToast('Could not feature this listing. Please try again.', 'error');
                  }
                } catch (error) {
                  logError('âŒ Failed to feature vehicle:', error);
                  addToast('Could not feature this listing. Please try again.', 'error');
                }
              }}
              onSendMessage={sendMessage}
              onMarkConversationAsRead={markAsRead}
              onOfferResponse={(conversationId, messageId, response, counterPrice) => {
                onOfferResponse(conversationId, parseInt(messageId), response as "accepted" | "rejected" | "countered", counterPrice);
              }}
              typingStatus={typingStatus}
              onUserTyping={(conversationId, _userRole) => {
                toggleTyping(conversationId, true);
              }}
              onMarkMessagesAsRead={(conversationId, _readerRole) => {
                markAsRead(conversationId, { readerRole: _readerRole, forceReadState: true });
              }}
              onFlagContent={flagContent}
              onLogout={handleLogoutAll}
              onViewVehicle={selectVehicle}
              onAddVehicle={async (vehicleData, isFeaturing = false) =>
                addSellerListing({
                  currentUser,
                  vehicleData,
                  isFeaturing,
                  listingExpiresAt: computeListingExpiresAtForSeller(currentUser),
                  setVehicles,
                  nextNumericId: () => Date.now() + randomIntBelow(1000),
                  successMessage: 'Vehicle added successfully!',
                  addToast,
                  logError,
                  sellerVehicles: sellerVehiclesFiltered || [],
                })
              }
              onUpdateVehicle={async (vehicleData) => {
                await updateVehicle(vehicleData.id, vehicleData);
              }}
              vehicleData={vehicleData}
              onUpdateProfile={async (profileData: Partial<User>) => {
                if (currentUser) {
                  await updateUser(currentUser.email, profileData);
                  setCurrentUser({ ...currentUser, ...profileData } as User);
                }
              }}
              onUpdateSellerProfile={async (details) => {
                if (currentUser?.email) {
                  await updateUser(currentUser.email, details);
                }
              }}
              notifications={notifications.filter(n => n.recipientEmail === currentUser.email)}
              onNotificationClick={handleNotificationClick}
              onMarkNotificationsAsRead={handleMarkNotificationsAsRead}
              addToast={addToast}
              onSetConversationReadState={(conversationId, isRead) =>
                setConversationReadState(conversationId, 'seller', isRead)
              }
              onMarkAllAsReadBySeller={() => void markAllVisibleAsRead('seller')}
              onSellerOpenChat={handleSellerOpenChatFromDashboard}
            />
          </Suspense>
        </DashboardErrorBoundary>
      );
    }

    // Derive flagged listings for this seller from the live vehicles list
    // (powered by Supabase `vehicles.is_flagged` â†’ normalized to `isFlagged`).
    // Previously this was hardcoded to [] which silently disconnected the
    // seller's "Reports" inbox from the database.
    const sellerReportedVehicles = (sellerVehiclesFiltered || []).filter(
      (v) => v && v.isFlagged
    );

    return (
      <DashboardErrorBoundary>
        <Suspense fallback={<DashboardSkeleton />}>
          <Dashboard
          seller={currentUser}
          sellerVehicles={enrichVehiclesWithSellerInfo(
            sellerVehiclesFiltered, 
            users || []
          )}
          reportedVehicles={sellerReportedVehicles}
          onAddVehicle={async (vehicleData, isFeaturing = false) =>
            addSellerListing({
              currentUser,
              vehicleData,
              isFeaturing,
              listingExpiresAt: computeListingExpiresAtForSeller(currentUser),
              setVehicles,
              nextNumericId: () => Date.now() + randomIntBelow(1000),
              successMessage: 'Vehicle added successfully',
              addToast,
              logError,
              errorMessage: 'Failed to add vehicle',
              sellerVehicles: sellerVehiclesFiltered || [],
            })
          }
          onAddMultipleVehicles={async (vehiclesData) => {
            if (currentUser.planExpiryDate) {
              const expiryDate = new Date(currentUser.planExpiryDate);
              if (expiryDate < new Date()) {
                addToast('Your subscription has expired. Please renew to add new listings.', 'error');
                return;
              }
            }
            const listingExpiresAt = computeListingExpiresAtForSeller(currentUser);
            await addSellerListingsBulk({
              currentUser,
              vehiclesData,
              listingExpiresAt,
              setVehicles,
              nextNumericId: () => Date.now() + randomIntBelow(1000),
              addToast,
              logError,
              sellerVehicles: sellerVehiclesFiltered || [],
            });
          }}
          onUpdateVehicle={async (vehicleData) => {
            await updateVehicle(vehicleData.id, vehicleData);
          }}
          onDeleteVehicle={async (vehicleId) => {
            await deleteVehicle(vehicleId);
          }}
          onMarkAsSold={async (vehicleId) => {
            const vehicle = vehicles.find(v => v.id === vehicleId);
            if (vehicle) {
              await updateVehicle(vehicleId, { status: 'sold', soldAt: new Date().toISOString(), listingStatus: 'sold' });
            }
          }}
          onMarkAsUnsold={async (vehicleId) => {
            const vehicle = vehicles.find((v) => v.id === vehicleId);
            if (!vehicle) return;
            const canPublish = await assertSellerCanPublishListing({
              currentUser,
              vehicle,
              sellerVehicles: sellerVehiclesFiltered || [],
              addToast,
            });
            if (!canPublish) return;
            await updateVehicle(vehicleId, { status: 'published', soldAt: undefined, listingStatus: 'active' });
          }}
          conversations={(conversations || []).filter(
                (c) =>
                  c &&
                  currentUser?.email &&
                  conversationBelongsToSeller(c, currentUser.email, currentUser.id)
              )}
          onSellerSendMessage={(conversationId, messageText, type, payload) => {
            if (type || payload) {
              sendMessageWithType(conversationId, messageText, type, payload);
            } else {
              sendMessage(conversationId, messageText);
            }
          }}
          onMarkConversationAsReadBySeller={(conversationId) =>
            markAsRead(conversationId, { readerRole: 'seller', forceReadState: true })
          }
          onSetConversationReadState={(conversationId, isRead) =>
            setConversationReadState(conversationId, 'seller', isRead)
          }
          onMarkAllAsReadBySeller={() => void markAllVisibleAsRead('seller')}
          typingStatus={typingStatus}
          onUserTyping={(conversationId, _userRole) => toggleTyping(conversationId, true)}
          onUserStoppedTyping={(conversationId) => toggleTyping(conversationId, false)}
          onMarkMessagesAsRead={(conversationId, _readerRole) =>
            markAsRead(conversationId, { readerRole: 'seller', forceReadState: true })
          }
          onClearChat={clearConversationMessages}
          onUpdateSellerProfile={async (details) => {
            if (currentUser) {
              await updateUser(currentUser.email, details);
            }
          }}
          vehicleData={vehicleData}
          onFeatureListing={async (vehicleId) => {
            try {
              const { authenticatedFetch } = await import('../../utils/authenticatedFetch');
              const response = await authenticatedFetch('/api/vehicles?action=feature', {
                method: 'POST',
                body: JSON.stringify(buildVehicleMutationBody(vehicleId, vehicles))
              });

              const responseText = await response.text();
              let result: AppApiResponse<Vehicle> = {};
              if (responseText) {
                try {
                  result = JSON.parse(responseText) as AppApiResponse<Vehicle>;
                  } catch (parseError) {
                  logWarn('âš ï¸ Failed to parse feature response JSON:', parseError);
                  result = {};
                }
              }

              if (!response.ok) {
                const errorMessage = result?.reason || result?.error || 'Could not feature vehicle. Please try again.';
                addToast(errorMessage, response.status === 403 ? 'warning' : 'error');
                return;
              }

              if (result?.alreadyFeatured) {
                addToast('This vehicle is already featured.', 'info');
                return;
              }

              if (result?.success && result.vehicle) {
                await updateVehicle(vehicleId, result.vehicle, { skipToast: true });

                if (typeof result.remainingCredits === 'number') {
                  const sellerEmail = result.vehicle?.sellerEmail || currentUser?.email;
                  const remainingCredits = result.remainingCredits;

                  if (sellerEmail) {
                    // Normalize emails for comparison (critical for production)
                    if (currentUser?.email && currentUser.email.toLowerCase().trim() === sellerEmail.toLowerCase().trim()) {
                      setCurrentUser({
                        ...currentUser,
                        featuredCredits: remainingCredits
                      });
                    }
                    await runBackgroundSync('Featured credits sync', () =>
                      updateUser(sellerEmail, { featuredCredits: remainingCredits }, { skipToast: true }),
                    );
                  }

                  addToast(`Listing featured! You have ${remainingCredits} feature credits left.`, 'success');
                } else {
                  addToast('Listing featured successfully!', 'success');
                }
              } else {
                addToast('Could not feature this listing. Please try again.', 'error');
              }
            } catch (error) {
              logError('âŒ Failed to feature vehicle:', error);
              addToast('Could not feature this listing. Please try again.', 'error');
            }
          }}
          onRequestCertification={async (vehicleId) => {
            try {
              const vehicle = vehicles.find(v => v.id === vehicleId);
              const sellerEmail = vehicle?.sellerEmail || currentUser?.email;
              // Normalize emails for comparison (critical for production)
              const normalizedSellerEmail = sellerEmail ? sellerEmail.toLowerCase().trim() : '';
              const seller = normalizedSellerEmail ? users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) : undefined;

              if (!seller) {
                addToast('Could not process certification request. Please try again.', 'error');
                return;
              }

              const planId = (seller.subscriptionPlan || 'free') as SubscriptionPlan;
              const planDetails = await planService.getPlanDetails(planId);
              const totalCertifications = planDetails.freeCertifications ?? 0;
              const usedCertifications = seller.usedCertifications ?? 0;

              if (totalCertifications <= 0) {
                addToast(
                  `The ${planDetails.name} plan does not include certification requests. Upgrade your plan to request certifications.`,
                  'warning'
                );
                return;
              }

              if (usedCertifications >= totalCertifications) {
                addToast(
                  `You have used all ${totalCertifications} certification requests included in your ${planDetails.name} plan. Upgrade to request more.`,
                  'warning'
                );
                return;
              }

              const { authenticatedFetch } = await import('../../utils/authenticatedFetch');
              const response = await authenticatedFetch('/api/vehicles?action=certify', {
                method: 'POST',
                body: JSON.stringify(buildVehicleMutationBody(vehicleId, vehicles))
              });

              const responseText = await response.text();
              let result: AppApiResponse = {};
              if (responseText) {
                try {
                  result = JSON.parse(responseText) as AppApiResponse;
                } catch (parseError) {
                  logWarn('âš ï¸ Failed to parse certification response JSON:', parseError);
                }
              }

              if (!response.ok) {
                addToast('Could not submit certification request. Please try again.', 'error');
                return;
              }

              if (result?.alreadyRequested) {
                addToast('This vehicle is already pending certification review.', 'info');
                return;
              }

              if (!result?.success || !result?.vehicle) {
                addToast('Could not submit certification request. Please try again.', 'error');
                return;
              }

              await updateVehicle(vehicleId, result.vehicle, {
                successMessage: 'Certification request submitted for review'
              });
              const updatedUsedCertifications = typeof result.usedCertifications === 'number'
                ? result.usedCertifications
                : usedCertifications + 1;

              // Reuse normalizedSellerEmail from line 834 (already normalized)
              setUsers((prevUsers: User[]) =>
                prevUsers.map((user: User) => {
                  if (!user || !user.email) return user;
                  return user.email.toLowerCase().trim() === normalizedSellerEmail
                    ? { ...user, usedCertifications: updatedUsedCertifications }
                    : user;
                })
              );

              if (currentUser?.email && currentUser.email.toLowerCase().trim() === normalizedSellerEmail) {
                setCurrentUser({
                  ...currentUser,
                  usedCertifications: updatedUsedCertifications
                });
              }

              await runBackgroundSync('Certification usage sync', () =>
                updateUser(seller.email, { usedCertifications: updatedUsedCertifications }, { skipToast: true }),
              );

              if (typeof result.remainingCertifications === 'number') {
                addToast(
                  `Certification requests remaining this month: ${result.remainingCertifications}`,
                  'info'
                );
              }
            } catch (error) {
              logError('âŒ Failed to certify vehicle:', error);
              addToast('Could not submit certification request. Please try again.', 'error');
            }
          }}
          onNavigate={navigate}
          onTestDriveResponse={handleTestDriveResponse}
          allVehicles={vehicles || []}
          onOfferResponse={onOfferResponse}
          onViewVehicle={selectVehicle}
          onSellerOpenChat={handleSellerOpenChatFromDashboard}
          chatPeerOnlineByConversationId={chatPeerOnlineByConversationId}
          onNotify={(message, type = 'info') => addToast(message, type)}
        />
        </Suspense>
      </DashboardErrorBoundary>
    );
  }

  case ViewEnum.BUYER_DASHBOARD:
    if (preferCompactDashboard && currentUser?.role === 'customer') {
      return (
        <MobileBuyerDashboard
          currentUser={currentUser}
          vehicles={vehicles.filter(v => v.status === 'published')}
          wishlist={wishlist}
          conversations={conversations.filter(c => {
            if (!c || !c.customerId || !currentUser?.email) return false;
            return c.customerId.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
          })}
          onNavigate={navigate}
          onSelectVehicle={selectVehicle}
          onToggleWishlist={(id) => {
            setWishlist(prev => 
              prev.includes(id) 
                ? prev.filter(vId => vId !== id)
                : [...prev, id]
            );
          }}
          onToggleCompare={toggleCompare}
          comparisonList={comparisonList}
          onViewSellerProfile={openSellerProfileByEmail}
          onLogout={handleLogoutAll}
        />
      );
    }
    return currentUser?.role === 'customer' ? (
      <BuyerDashboard
        currentUser={currentUser}
        vehicles={vehicles}
        wishlist={wishlist}
        conversations={(conversations || []).filter(c => {
          if (!c || !c.customerId || !currentUser?.email) return false;
          return c.customerId.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
        })}
        onNavigate={navigate}
        onSelectVehicle={selectVehicle}
        onToggleWishlist={(id) => {
          setWishlist(prev => 
            prev.includes(id) 
              ? prev.filter(vId => vId !== id)
              : [...prev, id]
          );
        }}
        onToggleCompare={toggleCompare}
        comparisonList={comparisonList}
        onViewSellerProfile={openSellerProfileByEmail}
      />
    ) : (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-600 mb-4">Access Denied</h2>
          <p className="text-gray-500 mb-4">You need to be logged in as a customer to access this page.</p>
          <button 
            onClick={() => navigate(ViewEnum.CUSTOMER_LOGIN)}
            className="btn-brand-primary"
          >
            Login as Customer
          </button>
        </div>
      </div>
    );

  case ViewEnum.ADMIN_PANEL:
    return userHasAdminRole(currentUser) && currentUser ? (
      <AdminPanelErrorBoundary>
        <AdminPanel 
          users={users}
          currentUser={currentUser}
          vehicles={vehicles}
          conversations={conversations}
          isLoading={isLoading}
          onCreateUser={onCreateUser}
          onAdminUpdateUser={onAdminUpdateUser}
          onToggleUserStatus={onToggleUserStatus}
          onDeleteUser={deleteUser}
          onUpdateUserPlan={onUpdateUserPlan}
          onUpdateVehicle={(vehicle: Vehicle) => {
            updateVehicle(vehicle.id, vehicle);
          }}
          onDeleteVehicle={deleteVehicle}
          onToggleVehicleStatus={onToggleVehicleStatus}
          onToggleVehicleFeature={onToggleVehicleFeature}
          onResolveFlag={onResolveFlag}
          platformSettings={platformSettings}
          onUpdateSettings={onUpdateSettings}
          onSendBroadcast={onSendBroadcast}
          auditLog={auditLog}
          onExportUsers={onExportUsers}
          onImportUsers={onImportUsers}
          onExportVehicles={onExportVehicles}
          onImportVehicles={onImportVehicles}
          onExportSales={onExportSales}
          onNavigate={navigate}
          onLogout={handleLogoutAll}
          vehicleData={vehicleData}
          onUpdateVehicleData={onUpdateVehicleData}
          onToggleVerifiedStatus={onToggleVerifiedStatus}
          supportTickets={supportTickets}
          onUpdateSupportTicket={onUpdateSupportTicket}
          faqItems={faqItems}
          onAddFaq={onAddFaq}
          onUpdateFaq={onUpdateFaq}
          onDeleteFaq={onDeleteFaq}
          onCertificationApproval={onCertificationApproval}
        />
      </AdminPanelErrorBoundary>
    ) : (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-600 mb-4">Access Denied</h2>
          <p className="text-gray-500 mb-4">You need to be logged in as an admin to access this page.</p>
          <button 
            onClick={() => navigate(ViewEnum.ADMIN_LOGIN)}
            className="btn-brand-primary"
          >
            Login as Admin
          </button>
        </div>
      </div>
    );

  case ViewEnum.PROFILE:
    if (isMobileApp && currentUser) {
      return (
        <MobileProfile
          currentUser={currentUser}
          onUpdateProfile={async (details) => {
            if (currentUser) {
              await updateUser(currentUser.email, details);
            }
          }}
          onUpdatePassword={async (passwords) => {
            if (!currentUser) return false;
            const { login } = await import('../../services/userService');
            return updateProfilePassword(currentUser, passwords, {
              login,
              updateUser,
              addToast,
              logError,
            });
          }}
          onBack={() => goBack(ViewEnum.HOME)}
          onLogout={handleLogoutAll}
          addToast={addToast}
          onNavigate={navigate}
        />
      );
    }
    return currentUser ? (
      <Profile 
        currentUser={currentUser}
        onUpdateProfile={async (details) => {
          if (currentUser) {
            await updateUser(currentUser.email, details);
          }
        }}
        onUpdatePassword={async (passwords) => {
          if (!currentUser) return false;
          const { login } = await import('../../services/userService');
          return updateProfilePassword(currentUser, passwords, {
            login,
            updateUser,
            addToast,
            logError,
          });
        }}
      />
    ) : (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-600 mb-4">Please Login</h2>
          <p className="text-gray-500 mb-4">You need to be logged in to view your profile.</p>
          <button 
            onClick={() => navigate(ViewEnum.LOGIN_PORTAL)}
            className="btn-brand-primary"
          >
            Login
          </button>
        </div>
      </div>
    );

  case ViewEnum.INBOX:
    if (currentUser?.role === 'seller' && !isMobileApp && !isCapacitorNativeApp()) {
      navigate(ViewEnum.SELLER_DASHBOARD);
      return (
        <div className="min-h-[40vh] flex items-center justify-center text-gray-500 text-sm">
          Redirecting to seller dashboard…
        </div>
      );
    }
    if ((isMobileApp || isCapacitorNativeApp()) && currentUser) {
      const inboxEmail = currentUser.email ? currentUser.email.toLowerCase().trim() : '';
      const inboxRoleNorm = normalizeInboxRole(currentUser.role);
      const mobileInboxThreads = conversations.filter((c) => {
        if (!c || !inboxEmail) return false;
        if (inboxRoleNorm === 'seller') {
          return conversationBelongsToSeller(c, inboxEmail, currentUser.id);
        }
        if (inboxRoleNorm === 'customer') {
          return conversationBelongsToCustomer(c, inboxEmail, currentUser.id);
        }
        return false;
      });
      return (
        <MobileInbox
          conversations={mobileInboxThreads}
          inboxRole={normalizeInboxRole(currentUser.role) === 'seller' ? 'seller' : 'customer'}
          initialOpenConversationId={inboxConversationIdToOpen}
          onConsumedInitialConversation={handleInboxInitialConversationConsumed}
          chatPeerOnlineByConversationId={chatPeerOnlineByConversationId}
          openThreadInFloatingChat={
            normalizeInboxRole(currentUser.role) === 'seller' &&
            (isMobileApp || isCapacitorNativeApp())
              ? handleSellerOpenChatFromDashboard
              : undefined
          }
          vehicles={vehicles}
          onSendMessage={(conversationId, messageText, type, payload) => {
            const conv = conversations.find((c) => c && c.id === conversationId);
            if (conv) {
              sendMessageWithType(conv.id, messageText, type, payload);
            }
          }}
          onMarkAsRead={markAsRead}
          users={users}
          typingStatus={typingStatus}
          onTypingActivity={(conversationId, isTyping) => toggleTyping(conversationId, isTyping)}
          onMarkMessagesAsRead={(conversationId, readerRole) => {
            void markAsRead(conversationId, { readerRole });
          }}
          onMarkAllAsRead={markAllVisibleAsRead}
          onSetConversationReadState={(conversationId, isRead) =>
            setConversationReadState(
              conversationId,
              normalizeInboxRole(currentUser.role) === 'seller' ? 'seller' : 'customer',
              isRead,
            )
          }
          onFlagContent={(type, id, _reason) => flagContent(type, id)}
          onOfferResponse={(conversationId, messageId, response, counterPrice) => {
            onOfferResponse(conversationId, messageId, response, counterPrice);
          }}
          onTestDriveResponse={handleTestDriveResponse}
          currentUser={currentUser}
          onNavigate={navigate}
          onClearChat={clearConversationMessages}
          onDeleteConversation={deleteConversation}
        />
      );
    }
    return currentUser ? (
      <CustomerInbox 
        conversations={conversations.filter(c => {
          if (!c || !currentUser?.email) return false;
          return conversationBelongsToCustomer(c, currentUser.email, currentUser.id);
        })}
        initialOpenConversationId={inboxConversationIdToOpen}
        onConsumedInitialConversation={handleInboxInitialConversationConsumed}
        vehicles={vehicles}
        onSendMessage={(conversationId, messageText, type, payload) => {
          const conversation = conversations.find((c) => c && String(c.id) === String(conversationId));
          if (conversation) {
            sendMessageWithType(conversation.id, messageText, type, payload);
          }
        }}
        onMarkAsRead={markAsRead}
        users={users}
        typingStatus={typingStatus}
        onUserTyping={(conversationId: string, _userRole: 'customer' | 'seller') => {
          toggleTyping(conversationId, true);
        }}
        onUserStoppedTyping={(conversationId: string) => toggleTyping(conversationId, false)}
        onMarkMessagesAsRead={(conversationId, readerRole) => {
          void markAsRead(conversationId, { readerRole });
        }}
        onMarkAllAsRead={() => void markAllVisibleAsRead('customer')}
        onSetConversationReadState={(conversationId, isRead) =>
          setConversationReadState(conversationId, 'customer', isRead)
        }
        onFlagContent={(type, id, _reason) => flagContent(type, id)}
        onOfferResponse={(conversationId, messageId, response, counterPrice) => {
          // Handle offer responses using the AppProvider function
          onOfferResponse(conversationId, messageId, response, counterPrice);
        }}
        currentUserEmail={currentUser.email}
        onClearChat={clearConversationMessages}
        onDeleteConversation={deleteConversation}
        chatPeerOnlineByConversationId={chatPeerOnlineByConversationId}
      />
    ) : (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-600 mb-4">Please Login</h2>
          <p className="text-gray-500 mb-4">You need to be logged in to view your inbox.</p>
          <button 
            onClick={() => navigate(ViewEnum.LOGIN_PORTAL)}
            className="btn-brand-primary"
          >
            Login
          </button>
        </div>
      </div>
    );

  case ViewEnum.SELLER_PROFILE:
    if (isMobileApp && publicSellerProfile) {
      const normalizedSellerEmail = publicSellerProfile.email?.toLowerCase().trim() || '';
      const latestSeller = users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) || publicSellerProfile;
      return (
        <MobileSellerProfilePage
          seller={latestSeller}
          vehicles={enrichVehiclesWithSellerInfo(
            (vehicles || []).filter(v => {
              if (!v || !v.sellerEmail || !latestSeller?.email) return false;
              return v.sellerEmail.toLowerCase().trim() === latestSeller.email.toLowerCase().trim();
            }),
            users || []
          )}
          onSelectVehicle={selectVehicle}
          comparisonList={comparisonList}
          onToggleCompare={toggleCompare}
          wishlist={wishlist}
          onToggleWishlist={toggleWishlist}
          currentUser={currentUser}
          onRequireLogin={requireLoginForDealerInteraction}
          onBack={() => goBack(ViewEnum.HOME)}
          onViewSellerProfile={openSellerProfileByEmail}
        />
      );
    }
    return publicSellerProfile ? (() => {
      // Always get the latest seller data from users array to ensure verification status is up-to-date
      const normalizedSellerEmail = publicSellerProfile.email?.toLowerCase().trim() || '';
      const latestSeller = users.find(u => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail) || publicSellerProfile;
      
      return (
        <SellerProfilePage 
          seller={latestSeller}
          vehicles={enrichVehiclesWithSellerInfo(
            (vehicles || []).filter(v => {
              if (!v || !v.sellerEmail || !latestSeller?.email) return false;
              return v.sellerEmail.toLowerCase().trim() === latestSeller.email.toLowerCase().trim();
            }), 
            users || []
          )}
        onSelectVehicle={selectVehicle}
        comparisonList={comparisonList}
        onToggleCompare={toggleCompare}
        wishlist={wishlist}
        onToggleWishlist={toggleWishlist}
        currentUser={currentUser}
        onRequireLogin={requireLoginForDealerInteraction}
        onBack={() => goBack(ViewEnum.HOME)}
        onViewSellerProfile={openSellerProfileByEmail}
      />
      );
    })() : (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-600 mb-4">Seller Not Found</h2>
          <button 
            onClick={() => navigate(ViewEnum.USED_CARS)}
            className="btn-brand-primary"
          >
            Browse Vehicles
          </button>
        </div>
      </div>
    );

  case ViewEnum.DEALER_PROFILES: {
    // Pass sellers AND service providers if available; components will fetch directly from API if not provided.
    // Car-service providers and dealer/showroom sellers both appear on the Dealer page, differentiated by role.
    const sellersFromUsers = users.filter(user => user.role === 'seller' || user.role === 'service_provider');
    if (preferCompactDashboard) {
      return (
        <MobileDealerProfilesPage
          sellers={sellersFromUsers.length > 0 ? sellersFromUsers : undefined}
          vehicles={vehicles}
          userLocation={userLocation}
          currentUser={currentUser}
          onRequireLogin={requireLoginForDealerInteraction}
          onViewProfile={openSellerProfileByEmail}
        />
      );
    }
    return (
      <DealerProfiles 
        sellers={sellersFromUsers.length > 0 ? sellersFromUsers : undefined} 
        vehicles={vehicles}
        userLocation={userLocation}
        currentUser={currentUser}
        onRequireLogin={requireLoginForDealerInteraction}
        onViewProfile={openSellerProfileByEmail}
      />
    );
  }

  case ViewEnum.CAR_SERVICE_LOGIN:
    return (
      <CarServiceLogin
        onNavigate={navigate}
        onLoginSuccess={(provider) => setServiceProvider(provider)}
      />
    );

  case ViewEnum.CAR_SERVICE_DASHBOARD:
    if (!serviceProvider) {
      return (
        <div className="min-h-[calc(100vh-140px)] flex items-center justify-center px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-reride-orange mx-auto mb-3" />
            <p className="text-gray-600 text-sm">Loading provider dashboardâ€¦</p>
          </div>
        </div>
      );
    }
    if (isMobileApp) {
      return (
        <MobileCarServiceDashboard
          provider={serviceProvider as {
            name: string;
            email: string;
            phone: string;
            city: string;
            state?: string;
            district?: string;
            workshops?: string[];
            skills?: string[];
            availability?: string;
            serviceCategories?: import('../../constants/serviceProviderCatalog').ServiceCategory[];
          } | null}
          onNavigate={navigate}
          onLogout={() => {
            handleLogoutAll();
            navigate(ViewEnum.HOME);
          }}
        />
      );
    }
    return (
      <CarServiceDashboard
        provider={serviceProvider as { name: string; email: string; phone: string; city: string }}
        onLogout={() => {
          handleLogoutAll();
          navigate(ViewEnum.HOME);
        }}
      />
    );

  case ViewEnum.CAR_SERVICES:
    return <CarServices onNavigate={navigate} />;

  case ViewEnum.SERVICE_DETAIL:
    return (
      <ServiceDetail
        onNavigate={navigate}
        onBack={() => navigate(ViewEnum.CAR_SERVICES)}
      />
    );

  case ViewEnum.SERVICE_CART:
    return (
      <ServiceCart
        isLoggedIn={!!currentUser}
        customerUserId={currentUser?.id ?? null}
        onLogin={() => navigate(ViewEnum.LOGIN_PORTAL)}
        onSubmitRequest={handleServiceRequestSubmit}
        serviceProviders={serviceProviderOptions as React.ComponentProps<typeof ServiceCart>['serviceProviders']}
        onUseMyLocation={handleUseMyLocation}
        isLocating={isLocating}
        locationError={locationError || undefined}
      />
    );

  case ViewEnum.PRICING: {
    const applySellerPlan = async (planId: SubscriptionPlan) => {
      if (!currentUser || currentUser.role !== 'seller') {
        addToast('Sign in as a seller to change plans.', 'info');
        return;
      }
      const updatedUser = { ...currentUser, subscriptionPlan: planId };
      try {
        const userService = await import('../../services/userService');
        const savedUser = await userService.updateUser(updatedUser);
        setUsers((prev) => prev.map((u) => (u.email === currentUser.email ? savedUser : u)));
        setCurrentUser(savedUser);
        const userJson = currentUserForLocalSessionJson(savedUser);
        sessionStorage.setItem('currentUser', userJson);
        localStorage.setItem('reRideCurrentUser', userJson);
        addToast(
          planId === 'free' ? 'Successfully switched to the Free plan!' : 'Plan updated successfully!',
          'success',
        );
        navigate(ViewEnum.SELLER_DASHBOARD);
      } catch (error) {
        logError('Failed to update plan:', error);
        addToast('Could not update your plan. Please try again later.', 'error');
      }
    };

    if (isMobileApp) {
      return (
        <MobilePricingPage
          currentUser={currentUser}
          addToast={addToast}
          onSelectPlan={applySellerPlan}
          onNavigate={navigate}
        />
      );
    }
    return (
      <PricingPage
        currentUser={currentUser}
        addToast={addToast}
        onSelectPlan={applySellerPlan}
      />
    );
  }

  case ViewEnum.ABOUT_US:
    return <AboutUsPage onNavigate={navigate} />;

  case ViewEnum.SUPPORT:
    if (isMobileApp) {
      return (
        <MobileSupportPage
          currentUser={currentUser}
          onSubmitTicket={async (ticket) => {
            try {
              const { createSupportTicketInSupabase } = await import('../../services/supportTicketService');
              const created = await createSupportTicketInSupabase(ticket);
              if (!created) {
                addToast('Could not send your message. Please try again.', 'error');
                return false;
              }
              setSupportTickets(prev => [created, ...(Array.isArray(prev) ? prev : [])]);
              addToast('Your message has been sent! We will get back to you soon.', 'success');
              navigate(ViewEnum.HOME);
              return true;
            } catch (error) {
              logError('Support ticket submission failed:', error);
              addToast('Could not send your message. Please try again.', 'error');
              return false;
            }
          }}
          onNavigate={navigate}
        />
      );
    }
    return (
      <SupportPage 
        currentUser={currentUser}
        onSubmitTicket={async (ticket) => {
          try {
            const { createSupportTicketInSupabase } = await import('../../services/supportTicketService');
            const created = await createSupportTicketInSupabase(ticket);
            if (!created) {
              addToast('Could not send your message. Please try again.', 'error');
              return false;
            }
            setSupportTickets(prev => [created, ...(Array.isArray(prev) ? prev : [])]);
            addToast('Your message has been sent! We will get back to you soon.', 'success');
            return true;
          } catch (error) {
            logError('Support ticket submission failed:', error);
            addToast('Could not send your message. Please try again.', 'error');
            return false;
          }
        }}
      />
    );

  case ViewEnum.FAQ:
    if (isMobileApp) {
      return (
        <MobileFAQPage faqItems={faqItems} />
      );
    }
    return (
      <FAQPage 
        faqItems={faqItems}
      />
    );

  case ViewEnum.HELP_CENTER:
    return (
      <React.Suspense fallback={<LoadingSpinner />}>
        <HelpCenterPage faqItems={faqItems} onNavigate={navigate} />
      </React.Suspense>
    );

  case ViewEnum.PRIVACY_POLICY:
    if (isMobileApp) {
      return (
        <MobilePrivacyPolicyPage />
      );
    }
    return (
      <PrivacyPolicyPage />
    );

  case ViewEnum.TERMS_OF_SERVICE:
    if (isMobileApp) {
      return (
        <MobileTermsOfServicePage />
      );
    }
    return (
      <TermsOfServicePage />
    );

  case ViewEnum.SAFETY_CENTER:
    return (
      <React.Suspense fallback={<LoadingSpinner />}>
        <SafetyCenterPage onNavigate={navigate} />
      </React.Suspense>
    );

  case ViewEnum.REFUND_POLICY:
    return (
      <React.Suspense fallback={<LoadingSpinner />}>
        <RefundPolicyPage />
      </React.Suspense>
    );

  case ViewEnum.COMPLAINT_RESOLUTION:
    return (
      <React.Suspense fallback={<LoadingSpinner />}>
        <ComplaintResolutionPage onNavigate={navigate} />
      </React.Suspense>
    );

  case ViewEnum.FRAUD_POLICY:
    return (
      <React.Suspense fallback={<LoadingSpinner />}>
        <FraudPolicyPage onNavigate={navigate} />
      </React.Suspense>
    );

  case ViewEnum.COOKIE_POLICY:
    return (
      <React.Suspense fallback={<LoadingSpinner />}>
        <CookiePolicyPage />
      </React.Suspense>
    );

  case ViewEnum.CITY_LANDING:
    return (
      <CityLandingPage
        city={selectedCity || ''}
        vehicles={vehicles}
        onSelectVehicle={selectVehicle}
        onToggleWishlist={toggleWishlist}
        onToggleCompare={toggleCompare}
        wishlist={wishlist}
        comparisonList={comparisonList}
        onViewSellerProfile={openSellerProfileByEmail}
      />
    );

  case ViewEnum.NOT_FOUND:
    return (
      <React.Suspense fallback={<LoadingSpinner />}>
        <NotFoundPage onNavigate={navigate} currentUser={currentUser} />
      </React.Suspense>
    );

  case ViewEnum.LOGIN_PORTAL:
  case ViewEnum.CUSTOMER_LOGIN:
  case ViewEnum.SELLER_LOGIN: {
    const loginForcedRole =
      currentView === ViewEnum.CUSTOMER_LOGIN
        ? ('customer' as const)
        : currentView === ViewEnum.SELLER_LOGIN
          ? ('seller' as const)
          : undefined;
    return (
      <AuthenticationErrorBoundary>
        <Suspense fallback={<LoadingSpinner />}>
          <UnifiedLogin 
            onLogin={handleLogin}
            onRegister={handleRegister}
            onNavigate={navigate}
            onServiceProviderLogin={(provider) => {
              const p = provider as unknown as AppServiceProvider;
              const name =
                typeof p.name === 'string' && p.name.trim()
                  ? p.name.trim()
                  : 'Service provider';
              setServiceProvider({
                ...p,
                name,
                city:
                  typeof p.city === 'string' && p.city.trim()
                    ? p.city.trim()
                    : '',
              });
              navigate(ViewEnum.CAR_SERVICE_DASHBOARD);
              addToast(`Welcome, ${name}!`, 'success');
            }}
            onForgotPassword={() => {
              setForgotPasswordRole('customer');
              navigate(ViewEnum.FORGOT_PASSWORD);
            }}
            allowedRoles={['customer', 'seller']}
            forcedRole={loginForcedRole}
          />
        </Suspense>
      </AuthenticationErrorBoundary>
    );
  }

  case ViewEnum.ADMIN_LOGIN:
    return (
      <AuthenticationErrorBoundary>
        <Suspense fallback={<LoadingSpinner />}>
          <AdminLogin
            onLogin={handleLogin}
            onNavigate={navigate}
          />
        </Suspense>
      </AuthenticationErrorBoundary>
    );

  case ViewEnum.FORGOT_PASSWORD:
    return (
      <AuthenticationErrorBoundary>
        <Suspense fallback={<LoadingSpinner />}>
          <ForgotPassword
            onBack={() => goBack(previousView === ViewEnum.ADMIN_LOGIN ? ViewEnum.ADMIN_LOGIN : ViewEnum.LOGIN_PORTAL)}
            onResetSent={(email) => {
              if (process.env.NODE_ENV === 'development') {
                logInfo('Password reset email requested for:', email);
              }
            }}
          />
        </Suspense>
      </AuthenticationErrorBoundary>
    );

  case ViewEnum.SELL_CAR:
    if (isMobileApp) {
      return (
        <MobileSellCarPage onNavigate={navigate} addToast={addToast} />
      );
    }
    return (
      <SellCarPage 
        onNavigate={navigate}
      />
    );

  case ViewEnum.SELL_CAR_ADMIN:
    return userHasAdminRole(currentUser) && currentUser ? (
      <SellCarAdmin
        onNavigate={navigate}
      />
    ) : (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-600 mb-4">Access Denied</h2>
          <p className="text-gray-500 mb-4">You need to be logged in as an admin to access this page.</p>
          <button
            onClick={() => navigate(ViewEnum.ADMIN_LOGIN)}
            className="btn-brand-primary"
          >
            Login as Admin
          </button>
        </div>
      </div>
    );

  case ViewEnum.NOTIFICATIONS_CENTER:
    if (!currentUser?.email) {
      return (
        <div className="min-h-[calc(100vh-140px)] flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <h2 className="text-2xl font-bold text-gray-600 mb-4">Sign in required</h2>
            <p className="text-gray-500 mb-4">Log in to see your activity and notifications.</p>
            <button
              type="button"
              onClick={() => navigate(ViewEnum.LOGIN_PORTAL)}
              className="btn-brand-primary"
            >
              Login
            </button>
          </div>
        </div>
      );
    }
    {
      const normalizedEmail = currentUser.email.toLowerCase().trim();
      const userNotifs = notifications.filter(
        (n) =>
          n.recipientEmail &&
          n.recipientEmail.toLowerCase().trim() === normalizedEmail
      );
      return (
        <Suspense fallback={<LoadingSpinner />}>
          {isMobileApp ? (
            <MobileNotifications
              notifications={userNotifs}
              onNotificationClick={handleNotificationClick}
              onAcceptDealChat={handleAcceptDealChat}
              onMarkAsRead={handleMarkNotificationsAsRead}
              onMarkAllAsRead={handleMarkAllNotificationsAsRead}
              onBack={() => goBack(ViewEnum.HOME)}
              isLoading={isLoading && userNotifs.length === 0}
            />
          ) : (
            <NotificationsPage
              notifications={userNotifs}
              vehicles={vehicles}
              conversations={conversations}
              onNotificationClick={handleNotificationClick}
              onAcceptDealChat={handleAcceptDealChat}
              onMarkNotificationsAsRead={handleMarkNotificationsAsRead}
              onMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
              onBack={() => goBack(ViewEnum.HOME)}
              contentBottomPadding={isMobileApp}
              profileMuteKeys={currentUser.notificationMuteKeys}
              onPersistMuteKeys={
                currentUser.email
                  ? async (keys) => {
                      await updateUser(currentUser.email, { notificationMuteKeys: keys });
                    }
                  : undefined
              }
            />
          )}
        </Suspense>
      );
    }

  default:
    return (
      <div className="min-h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-600 mb-4">Page Not Found</h2>
          <p className="text-gray-500 mb-4">The page you&apos;re looking for doesn&apos;t exist.</p>
          <button 
            onClick={() => navigate(ViewEnum.HOME)}
            className="btn-brand-primary"
          >
            Go Home
          </button>
        </div>
      </div>
    );
}
};

export default AppViewRenderer;
