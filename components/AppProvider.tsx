import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import { CLIENT_POLL_INTERVALS_MS } from '../utils/clientPolling.js';
import { useNavigate as useRouterNavigate, useLocation } from 'react-router-dom';
import type { Vehicle, User, Conversation, Toast as ToastType, PlatformSettings, AuditLogEntry, VehicleData, Notification, VehicleCategory, SupportTicket, FAQItem } from '../types';
import { View } from '../types';
import {
  computeCompareToggle,
  getCategoryDisplayName,
  MAX_COMPARE_VEHICLES,
} from '../utils/compareList.js';
import { saveConversations } from '../services/chatService';
import {
  ensureSyncQueueOnlineListener,
  getSyncQueueStatus,
  processSyncQueue,
} from '../services/syncService';
import { getSettings, fetchSettings } from '../services/settingsService';
import { getAuditLog, logAction, saveAuditLog, fetchAuditLog } from '../services/auditLogService';
import {
  getSupportTickets,
  saveSupportTickets,
  fetchSupportTicketsFromSupabase,
} from '../services/supportTicketService';
import { dataService } from '../services/dataService';
import {
  authenticatedFetch,
  getAuthHeaders,
  refreshAuthToken,
} from '../utils/authenticatedFetch';
import { VEHICLE_DATA } from './vehicleData';
import { showNotification } from '../services/notificationService';
import { formatSupabaseError } from '../utils/errorUtils';
import { logInfo, logWarn, logError, logDebug } from '../utils/logger';
import {
  logBackgroundSyncFailure,
  hasCachedVehicleCatalog,
  shouldShowOfflineToast,
  resetOfflineToastSession,
} from '../utils/toastPolicy.js';
import {
  vehicleMissingCanonicalId,
} from '../utils/vehicleIdentity';
import { deduplicateRequest } from '../utils/requestDeduplication';
import { enrichVehicleWithSellerInfo } from '../utils/vehicleEnrichment';
import { filterVehiclesBySellerEmail } from '../utils/sellerVehicleFilter';
import * as buyerService from '../services/buyerService';
import { createSafetyReport } from '../services/trustSafetyService';
import { addLocalRecentId } from '../utils/recentlyViewed';
import { stringifyVehicleForSession } from '../utils/vehicleSessionCache';
import {
  getAppPathFromRouter,
  pathToView,
  readInitialAppViewFromBrowser,
} from '../utils/appNavigation.js';
import {
  RERIDE_DETAIL_ENTRY_SOURCE_KEY,
  viewToDetailEntryOrdinal,
} from '../utils/detailNavigationStorage';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { useAppLocationSync } from '../hooks/useAppLocationSync';
import { useAppBootstrap } from '../hooks/useAppBootstrap';
import { useConfirmDialog, ConfirmDialogHost } from '../hooks/useConfirmDialog';
import { useVehicleMutations } from '../hooks/useVehicleMutations';
import { useAdminPlatformActions } from '../hooks/useAdminPlatformActions';
import { useAppMessagingActions } from '../hooks/useAppMessagingActions';
import { useAppRealtimeSync } from '../hooks/useAppRealtimeSync';
import { useRealtimeChatRuntime } from '../hooks/useRealtimeChatRuntime';
import { useAppAuthRuntime } from './AppProvider/useAppAuthRuntime';
import { useNotificationRuntime } from '../hooks/useNotificationRuntime';
import { NotificationContextBridge } from '../contexts/NotificationContext';
import { persistReRideNotifications } from '../utils/notificationLocalStorage';
import { currentUserForLocalSessionJson } from '../utils/userLocalStorageSnapshot';
import { isCapacitorNative } from '../utils/apiConfig';
import { getNativeMemoryRefreshToken } from '../utils/nativeTokenStorage';
import { normalizeUserLocationForStorage, primaryLocationLabel } from '../utils/cityMapping';
import {
  getBrowserAccessTokenForApi,
  useHttpOnlyRefreshCookie,
} from '../utils/authStorage';
import { getEffectiveMuteKeys, isStoryMuted } from '../utils/notificationMute';
import {
  participantIdMatchesAppUser,
} from '../utils/conversationParticipants';
import {
  ToastProvider,
  useToast,
  CatalogProvider,
  useCatalog,
  ChatProvider,
  useChat,
} from '../contexts';
import { mergeVehicleCatalog } from '../utils/mergeVehicleCatalog';
import {
  mergeConversationLists,
  isAdminUserRole,
} from './AppProvider/helpers';
import type { AppContextType, UserUpdateOptions, VehicleUpdateOptions } from '../types/appContext';

export type { AppContextType, UserUpdateOptions, VehicleUpdateOptions } from '../types/appContext';
export {
  postgrestEqQuoted,
  hasLikelyRefreshSource,
  mergeConversationLists,
  getUserFriendlyErrorMessage,
  isAdminUserRole,
} from './AppProvider/helpers';

const AppContext = createContext<AppContextType | undefined>(undefined);

/** Stable sentinels — toast / typing / notifications live in dedicated contexts. */
const EMPTY_TOASTS: ToastType[] = [];
const EMPTY_PEER_ONLINE: Record<string, boolean> = {};
const EMPTY_NOTIFICATIONS: Notification[] = [];

// Hook export - Fast Refresh compatible
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    const errorMessage = 'useApp must be used within an AppProvider';
    // Log helpful debugging info in development
    logError('⚠️', errorMessage);
    logDebug('Stack trace:', new Error().stack);
    throw new Error(errorMessage);
  }
  return context;
};

// Component export - Fast Refresh compatible with displayName
// Note: Context providers should NOT be memoized as they need to re-render when state changes
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ToastProvider>
    <CatalogProvider>
      <ChatProvider>
        <AppProviderCore>{children}</AppProviderCore>
      </ChatProvider>
    </CatalogProvider>
  </ToastProvider>
);

const AppProviderCore: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const { setToasts, addToast, removeToast } = useToast();
  const {
    vehicles,
    setVehicles,
    users,
    setUsers,
    isLoading,
    setIsLoading,
    vehiclesCatalogReady,
    setVehiclesCatalogReady,
    comparisonList,
    setComparisonList,
    wishlist,
    setWishlist,
    ratings,
    setRatings,
    sellerRatings,
    setSellerRatings,
    comparisonCategory,
    recommendations,
  } = useCatalog();
  const {
    conversations,
    setConversations,
    activeChat,
    setActiveChat,
    typingStatus,
    setTypingStatus,
    chatPeerOnlineByConversationId,
    setChatPeerOnlineByConversationId,
  } = useChat();
  // React Router hooks for proper URL management
  const routerNavigate = useRouterNavigate();
  const location = useLocation();

  // Track which notifications have already shown browser notifications
  const shownNotificationIdsRef = useRef<Set<number>>(new Set());

  // All state from App.tsx moved here
  const [currentView, setCurrentView] = useState<View>(readInitialAppViewFromBrowser);
  /** Latest view for URL sync effect — avoids clobbering programmatic navigate() before the router path updates. */
  const currentViewRef = useRef<View>(View.HOME);
  currentViewRef.current = currentView;
  const [previousView, setPreviousView] = useState<View>(View.HOME);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  // Flag to prevent navigation loops when handling popstate
  const isHandlingPopStateRef = useRef(false);
  /** True after navigate(DETAIL) until the router reports /vehicle/:id (HashRouter/WebView can lag one tick). */
  const expectingVehicleDetailRouteRef = useRef(false);
  /**
   * True after we navigate away from DETAIL while the URL can still show /vehicle/:id (HashRouter / WebView lag).
   * Location sync must not resolve newView=DETAIL from that stale path and call setCurrentView(DETAIL), or "Back" appears broken.
   */
  const leavingDetailUrlCatchUpRef = useRef(false);
  /** Featured carousel fires both touchend + synthetic click — avoid double navigate. */
  const lastVehicleSelectRef = useRef<{ id: number; t: number }>({ id: -1, t: 0 });
  const setNotificationsRef = useRef<React.Dispatch<React.SetStateAction<Notification[]>>>(() => {});
  const setNotificationsProxy = useCallback((value: React.SetStateAction<Notification[]>) => {
    setNotificationsRef.current(value);
  }, []);
  const {
    currentUser,
    setCurrentUser,
    handleLogin,
    handleLogout,
    handleRegister,
  } = useAppAuthRuntime({
    addToast,
    t,
    routerNavigate,
    currentView,
    setCurrentView,
    setActiveChat,
    setConversations,
    setTypingStatus,
    setChatPeerOnlineByConversationId,
    setComparisonList,
    setWishlist,
    setNotifications: setNotificationsProxy,
  });
  const [sellerInventory, setSellerInventory] = useState<Vehicle[]>([]);
  const [sellerInventoryReady, setSellerInventoryReady] = useState(false);
  const sellerInventoryRef = useRef<Vehicle[]>([]);
  sellerInventoryRef.current = sellerInventory;

  useEffect(() => {
    ensureSyncQueueOnlineListener();
  }, []);
  const [forgotPasswordRole, setForgotPasswordRole] = useState<'customer' | 'seller' | null>(null);
  // Used Cars should start on all published categories; Home tiles pass an
  // explicit category via navigate({ category }) when the user picks one.
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory | 'ALL'>('ALL');
  const [publicSellerProfile, setPublicSellerProfile] = useState<User | null>(null);
  const [isAnnouncementVisible, setIsAnnouncementVisible] = useState(true);
  const [initialSearchQuery, setInitialSearchQuery] = useState<string>('');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [userLocation, setUserLocationState] = useState<string>(() => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return '';
    try {
      const storedLocation = localStorage.getItem('reRideUserLocation');
      if (storedLocation && storedLocation.trim().length > 0) {
        const n = normalizeUserLocationForStorage(storedLocation);
        if (n) return n;
      }
    } catch (error) {
      logWarn('Failed to load user location from localStorage:', error);
    }
    return '';
  });
  const [selectedCity, setSelectedCityState] = useState<string>(() => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return '';
    try {
      const storedCity = localStorage.getItem('reRideSelectedCity');
      if (storedCity && storedCity.trim().length > 0) {
        const n = normalizeUserLocationForStorage(storedCity);
        if (n) return n;
      }
    } catch (error) {
      logWarn('Failed to load selected city from localStorage:', error);
    }
    return '';
  });

  // Merge seller phone/name from `users` when the directory loads after opening a listing (production race).
  useEffect(() => {
    if (!Array.isArray(users) || users.length === 0) return;
    setSelectedVehicle((prev) => {
      if (!prev?.sellerEmail) return prev;
      const enriched = enrichVehicleWithSellerInfo(prev, users);
      const prevPhone = (prev.sellerPhone || '').trim();
      const nextPhone = (enriched.sellerPhone || '').trim();
      const phoneAdded = !!nextPhone && nextPhone !== prevPhone;
      const nameBetter =
        !!enriched.sellerName &&
        enriched.sellerName !== 'Seller' &&
        (!prev.sellerName || prev.sellerName === 'Seller');
      if (!phoneAdded && !nameBetter) return prev;
      try {
        sessionStorage.setItem('selectedVehicle', stringifyVehicleForSession(enriched));
      } catch {
        // ignore storage errors (private mode / WebView)
      }
      return enriched;
    });
  }, [users]);

  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(() => getSettings());
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(() => getAuditLog());
  const [vehicleData, setVehicleData] = useState<VehicleData>(() => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return VEHICLE_DATA;
    try {
      const savedVehicleData = localStorage.getItem('reRideVehicleData');
      if (savedVehicleData) return JSON.parse(savedVehicleData);
    } catch (error) {
      logWarn('Failed to load vehicle data from localStorage:', error);
    }
    return VEHICLE_DATA;
  });
  const [faqItems, setFaqItems] = useState<FAQItem[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(() => getSupportTickets() || []);
  const { notifications, setNotifications } = useNotificationRuntime(currentUser?.email);
  setNotificationsRef.current = setNotifications;

  const { confirmState, setConfirmState, askConfirm, runIfConfirmed } = useConfirmDialog();

  const syncUserCachesByEmail = useCallback((email: string, updates: Partial<User>) => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

    const normalizedEmail = email.toLowerCase().trim();
    const userCacheKeys = ['reRideUsers', 'reRideUsers_prod'];
    let eventPayloadUsers: User[] | null = null;

    for (const cacheKey of userCacheKeys) {
      try {
        const cachedUsersJson = localStorage.getItem(cacheKey);
        if (!cachedUsersJson) continue;
        const cachedUsers = JSON.parse(cachedUsersJson);
        if (!Array.isArray(cachedUsers)) continue;

        const updatedCachedUsers = cachedUsers.map((user: User) => {
          if (!user?.email || user.email.toLowerCase().trim() !== normalizedEmail) return user;
          return { ...user, ...updates };
        });

        localStorage.setItem(cacheKey, JSON.stringify(updatedCachedUsers));
        if (cacheKey === 'reRideUsers_prod' || !eventPayloadUsers) {
          eventPayloadUsers = updatedCachedUsers;
        }
      } catch (error) {
        logWarn(`⚠️ Failed to sync ${cacheKey}:`, error);
      }
    }

    if (eventPayloadUsers && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('usersCacheUpdated', { detail: { users: eventPayloadUsers } }));
      window.dispatchEvent(new Event('storage'));
    }
  }, []);

  const syncAllUserCaches = useCallback((allUsers: User[]) => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('reRideUsers', JSON.stringify(allUsers));
      localStorage.setItem('reRideUsers_prod', JSON.stringify(allUsers));
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('usersCacheUpdated', { detail: { users: allUsers } }));
        window.dispatchEvent(new Event('storage'));
      }
    } catch (error) {
      logWarn('⚠️ Failed to sync full users caches:', error);
    }
  }, []);

  const syncVehicleCachesById = useCallback((id: number, updater: (vehicle: Vehicle) => Vehicle | null) => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    const vehicleCacheKeys = ['reRideVehicles', 'reRideVehicles_prod'];

    for (const cacheKey of vehicleCacheKeys) {
      try {
        const cachedVehiclesJson = localStorage.getItem(cacheKey);
        if (!cachedVehiclesJson) continue;
        const cachedVehicles = JSON.parse(cachedVehiclesJson);
        if (!Array.isArray(cachedVehicles)) continue;

        const updatedVehicles = cachedVehicles
          .map((vehicle: Vehicle) => {
            if (!vehicle || vehicle.id !== id) return vehicle;
            return updater(vehicle);
          })
          .filter(Boolean);

        localStorage.setItem(cacheKey, JSON.stringify(updatedVehicles));
      } catch (error) {
        logWarn(`⚠️ Failed to sync ${cacheKey}:`, error);
      }
    }

    try {
      const selectedVehicleJson = sessionStorage.getItem('selectedVehicle');
      if (selectedVehicleJson) {
        const selectedVehicle = JSON.parse(selectedVehicleJson);
        if (selectedVehicle?.id === id) {
          const updatedSelected = updater(selectedVehicle);
          if (updatedSelected) {
            sessionStorage.setItem('selectedVehicle', stringifyVehicleForSession(updatedSelected));
          } else {
            sessionStorage.removeItem('selectedVehicle');
          }
        }
      }
    } catch (error) {
      logWarn('⚠️ Failed to sync selectedVehicle cache:', error);
    }
  }, []);

  const updateUserLocation = useCallback((location: string) => {
    const nextLocation = normalizeUserLocationForStorage((location ?? '').trim());
    if (nextLocation.length === 0) {
      setUserLocationState('Mumbai');
      setSelectedCityState('');
      try {
        localStorage.removeItem('reRideUserLocation');
        localStorage.removeItem('reRideSelectedCity');
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          logWarn('Failed to clear stored location:', error);
        }
      }
      return;
    }

    // Pan-India: keep the label in userLocation, but clear selectedCity so
    // PopularCitiesChips / catalog filters treat it as "no city filter"
    // (same as handleBrowseAllIndia).
    if (/^all of india$/i.test(nextLocation)) {
      setUserLocationState((prev) => (prev === 'All of India' ? prev : 'All of India'));
      setSelectedCityState((prev) => (prev === '' ? prev : ''));
      try {
        localStorage.setItem('reRideUserLocation', 'All of India');
        localStorage.removeItem('reRideSelectedCity');
      } catch (error) {
        logWarn('Failed to persist All of India location:', error);
      }
      return;
    }

    // Header/modal may store "City, State"; chips and routes key off the city.
    const cityForFilter = primaryLocationLabel(nextLocation) || nextLocation;

    setUserLocationState(prev => (prev === nextLocation ? prev : nextLocation));
    setSelectedCityState(prev => (prev === cityForFilter ? prev : cityForFilter));

    try {
      localStorage.setItem('reRideUserLocation', nextLocation);
    } catch (error) {
      logWarn('Failed to persist location selection:', error);
    }

    try {
      localStorage.setItem('reRideSelectedCity', cityForFilter);
    } catch (error) {
      logWarn('Failed to persist selected city:', error);
    }
  }, []);

  const updateSelectedCity = useCallback((city: string) => {
    const trimmedCity = normalizeUserLocationForStorage((city ?? '').trim());

    setSelectedCityState((prev) => (prev === trimmedCity ? prev : trimmedCity));

    try {
      if (trimmedCity.length > 0) {
        localStorage.setItem('reRideSelectedCity', trimmedCity);
        setUserLocationState((prev) => (prev === trimmedCity ? prev : trimmedCity));
        localStorage.setItem('reRideUserLocation', trimmedCity);
      } else {
        localStorage.removeItem('reRideSelectedCity');
      }
    } catch (error) {
      logWarn('Failed to persist selected city:', error);
    }
  }, []);

  const { navigate, goBack } = useAppNavigation({
    currentView,
    previousView,
    currentUser,
    selectedVehicle,
    publicSellerProfile,
    location,
    routerNavigate,
    isHandlingPopStateRef,
    leavingDetailUrlCatchUpRef,
    expectingVehicleDetailRouteRef,
    setPreviousView,
    setSelectedVehicle,
    setPublicSellerProfile,
    setInitialSearchQuery,
    setSelectedCategory,
    setCurrentView,
    updateSelectedCity,
  });

  const refreshVehicles = useCallback(async (options?: { userInitiated?: boolean }) => {
    const isAdmin = currentUser?.role === 'admin';
    const userInitiated = Boolean(options?.userInitiated);
    try {
      const list = await dataService.getVehicles(isAdmin, true);
      const next = Array.isArray(list) ? list : [];
      setVehicles((prev) => mergeVehicleCatalog(prev, next, !!isAdmin));
      setVehiclesCatalogReady(true);
    } catch (err) {
      setVehiclesCatalogReady(true);
      logWarn('Refresh vehicles failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (!userInitiated) {
        logBackgroundSyncFailure('Vehicle catalog refresh', msg);
        return;
      }
      const is503OrSupabase = (err as any)?.status === 503 || (err as any)?.code === 503 || /supabase|503|service temporarily unavailable/i.test(msg);
      const toastMsg = is503OrSupabase
        ? t('toast.serviceUnavailableAdmin')
        : (msg && msg.length < 120 ? msg : t('toast.vehiclesLoadFailedShort'));
      addToast(toastMsg, 'error');
    }
  }, [currentUser?.role, setVehicles, addToast, t]);

  const refreshSellerInventory = useCallback(async (options?: { userInitiated?: boolean }) => {
    const userInitiated = Boolean(options?.userInitiated);
    const sellerEmail = currentUser?.email?.toLowerCase().trim();
    if (currentUser?.role !== 'seller' || !sellerEmail) {
      setSellerInventory([]);
      setSellerInventoryReady(true);
      return;
    }
    try {
      const list = await dataService.getSellerVehicles(sellerEmail);
      setSellerInventory(filterVehiclesBySellerEmail(list, sellerEmail));
      setSellerInventoryReady(true);
    } catch (err) {
      setSellerInventory([]);
      setSellerInventoryReady(true);
      logWarn('Refresh seller inventory failed:', err);
      if (!userInitiated) {
        logBackgroundSyncFailure(
          'Seller inventory refresh',
          err instanceof Error ? err.message : String(err),
        );
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      const toastMsg = msg && msg.length < 120 ? msg : t('toast.vehiclesLoadFailedShort');
      addToast(toastMsg, 'error');
    }
  }, [currentUser?.role, currentUser?.email, addToast, t]);

  useEffect(() => {
    if (currentUser?.role === 'seller' && currentUser.email) {
      setSellerInventory([]);
      setSellerInventoryReady(false);
      void refreshSellerInventory();
      return;
    }
    setSellerInventory([]);
    setSellerInventoryReady(true);
  }, [currentUser?.role, currentUser?.email, refreshSellerInventory]);

  useEffect(() => {
    if (currentView !== View.SELLER_DASHBOARD) return;
    if (currentUser?.role !== 'seller' || !currentUser.email) return;
    void refreshSellerInventory();
  }, [currentView, currentUser?.role, currentUser?.email, refreshSellerInventory]);

  const sellerIdentityHealRef = useRef(false);
  useEffect(() => {
    if (sellerIdentityHealRef.current) return;
    if (!currentUser?.email) return;
    if (currentUser.role !== 'seller') return;
    const email = currentUser.email.toLowerCase().trim();
    const mine = sellerInventory.length > 0
      ? sellerInventory
      : vehicles.filter(
          (v) => v?.sellerEmail && v.sellerEmail.toLowerCase().trim() === email,
        );
    if (mine.length === 0) return;
    if (!mine.some(vehicleMissingCanonicalId)) return;
    sellerIdentityHealRef.current = true;
    void refreshSellerInventory();
  }, [currentUser?.email, currentUser?.role, vehicles, sellerInventory, refreshSellerInventory]);

  // Auto-navigate to appropriate dashboard after login/registration
  // This ensures the view is set correctly even if state updates are async
  useEffect(() => {
    if (currentUser && currentUser.role) {
      // Only auto-navigate if we're on a login/register page
      const loginViews = [View.LOGIN_PORTAL, View.SELLER_LOGIN, View.CUSTOMER_LOGIN, View.ADMIN_LOGIN];
      if (loginViews.includes(currentView)) {
        if (currentUser.role === 'seller' && currentView !== View.SELLER_DASHBOARD) {
          logInfo('🔄 Auto-navigating seller to dashboard from login view');
          setCurrentView(View.SELLER_DASHBOARD);
        } else if (isAdminUserRole(currentUser.role) && currentView !== View.ADMIN_PANEL) {
          setCurrentView(View.ADMIN_PANEL);
        }
        // Customer: do not set HOME here — handleLogin schedules navigation on Capacitor to avoid
        // the same-frame renderer OOM that looks like the app force-closing after sign-in.
      }
    }
  }, [currentUser, currentView]);

  // Before paint: if URL is the admin dashboard and the session is admin, force ADMIN_PANEL so App never
  // renders the marketing layout over an empty main (currentView still HOME for one frame).
  useLayoutEffect(() => {
    const path = getAppPathFromRouter(location ?? { pathname: '/' });
    if (pathToView(path) !== View.ADMIN_PANEL) return;
    if (!isAdminUserRole(currentUser?.role)) return;
    if (currentViewRef.current !== View.ADMIN_PANEL) {
      setCurrentView(View.ADMIN_PANEL);
    }
  }, [location.pathname, location.hash, currentUser?.role, location]);

  useAppLocationSync({
    location,
    currentUser,
    vehicles,
    users,
    selectedVehicle,
    currentView,
    currentViewRef,
    leavingDetailUrlCatchUpRef,
    expectingVehicleDetailRouteRef,
    isHandlingPopStateRef,
    setCurrentView,
    setPreviousView,
    setSelectedVehicle,
    setPublicSellerProfile,
    updateSelectedCity,
  });

  useAppBootstrap({
    vehiclesLength: vehicles.length,
    currentUser,
    setVehicles,
    setUsers,
    setIsLoading,
    setVehiclesCatalogReady,
    setConversations,
    setFaqItems,
    setSupportTickets,
    setVehicleData,
    setNotifications,
    addToast,
    t,
  });

  useAppRealtimeSync({
    currentUser,
    activeChatId: activeChat?.id,
    setConversations,
    setNotifications,
    setVehicles,
    setUsers,
    addToast,
  });

  // Refresh server-sourced data whenever the authenticated user changes
  // Only runs when user changes, not on initial load (to avoid duplicate fetches)
  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let isSubscribed = true;
    let hasRunOnce = false; // Prevent multiple runs

    const syncLatestData = async () => {
      // Skip if we've already run this sync (prevent duplicate fetches on rapid user changes)
      if (hasRunOnce) {
        return;
      }
      hasRunOnce = true;

      try {
        // Never flip loading back on if the catalog already painted — that re-shows skeletons.
        // Catalog bootstrap is handled by loadInitialData; this path only refreshes after auth.

        // For admin users, load all vehicles (including unpublished/sold)
        const isAdmin = currentUser?.role === 'admin';
        
        // For admin users, ensure we fetch users (critical for admin panel)
        if (isAdmin) {
          logDebug('📊 AppProvider: Admin user detected - fetching users for admin panel...');
        }

        // AUTH: Ensure we have an access token before API calls (including dev).
        if (typeof window !== 'undefined') {
          try {
            const { rehydrateApiCredentials } = await import('../utils/validatePersistedSession.js');
            await rehydrateApiCredentials();
          } catch (error) {
            logWarn('⚠️ Auth rehydration failed in syncLatestData (non-critical):', error);
          }
        }
        
        // Load vehicles and users in PARALLEL — cache-first; dataService SWR refreshes in background.
        const [vehiclesResult, usersResult] = await Promise.allSettled([
          deduplicateRequest(
            `vehicles-${isAdmin ? 'admin' : 'user'}-sync-fr0`,
            () => dataService.getVehicles(isAdmin, false)
          ),
          isAdmin
            ? deduplicateRequest('users', () => dataService.getUsers(false))
            : Promise.resolve(null),
        ]);

        if (!isSubscribed) {
          return;
        }

        // Update vehicles if fetch succeeded
        if (vehiclesResult.status === 'fulfilled' && Array.isArray(vehiclesResult.value)) {
          setVehicles((prev) => mergeVehicleCatalog(prev, vehiclesResult.value, !!isAdmin));
          setVehiclesCatalogReady(true);
          setIsLoading(false);
          // PERFORMANCE: Recommendations are now computed via useMemo from vehicles
          // Do not toast on empty listings: zero published vehicles is valid (new seller, empty marketplace).
          // Misconfiguration is surfaced when the request fails (see rejected branch / 503 handling).
        } else if (vehiclesResult.status === 'rejected') {
          logWarn('Failed to sync vehicles:', vehiclesResult.reason);
          const reason = vehiclesResult.reason as any;
          const status = reason?.status ?? reason?.code;
          const message = reason instanceof Error ? reason.message : reason?.message ?? String(reason);

          if (status === 503 || /Supabase|SERVICE_ROLE_KEY|not configured/i.test(message)) {
            if (!hasCachedVehicleCatalog() && currentUser?.role === 'admin') {
              addToast(t('toast.listingsEmptyDbUnavailable'), 'error');
            } else {
              logBackgroundSyncFailure('Vehicle catalog refresh', message);
            }
          } else if (!hasCachedVehicleCatalog() && currentUser?.role === 'admin') {
            addToast(t('toast.vehiclesLoadFailed'), 'error');
          } else {
            logBackgroundSyncFailure('Vehicle catalog refresh', message);
          }
        }

        // Update users if fetch succeeded
        if (usersResult.status === 'fulfilled' && Array.isArray(usersResult.value) && isAdmin) {
          logInfo(`✅ AppProvider: Setting ${usersResult.value.length} users in state`);
          setUsers(usersResult.value);
          // For admin users, log if we got 0 users (might indicate an issue)
          if (currentUser?.role === 'admin' && usersResult.value.length === 0) {
            logWarn('⚠️ AppProvider: Admin user fetched 0 users. This might indicate:');
            logWarn('   1. No users exist in the database');
            logWarn('   2. Authentication/authorization issue');
            logWarn('   3. API returned empty array');
          }
          // Do not toast on empty users: non-admins cannot list all users (GET /api/users returns 403),
          // so getUsers() legitimately resolves to []. Dealer enrichment uses currentUser + vehicles.
        } else if (usersResult.status === 'rejected') {
          logError('❌ AppProvider: Failed to sync users:', usersResult.reason);
          // For admin users, try to use cached data as fallback
          const reason = usersResult.reason as any;
          const status = reason?.status ?? reason?.code;
          const message = reason instanceof Error ? reason.message : reason?.message ?? String(reason);

          if (status === 503 || /Supabase|SERVICE_ROLE_KEY|not configured/i.test(message)) {
            addToast(
              t('toast.dealersEmptyDbUnavailable'),
              'error'
            );
          } else if (currentUser?.role === 'admin') {
            addToast(t('toast.usersLoadFailed'), 'error');
          }
          if (currentUser?.role === 'admin') {
            const cachedUsers = localStorage.getItem('reRideUsers_prod');
            if (cachedUsers) {
              try {
                const parsed = JSON.parse(cachedUsers);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  logWarn('⚠️ Using cached users data due to API failure');
                  setUsers(parsed);
                }
              } catch (e) {
                logError('Failed to parse cached users:', e);
              }
            }
          }
        }

        // Reload inbox threads after auth is ready (fixes empty seller/customer messages on login).
        // Credentials were already rehydrated above — do not await rehydrate again (adds seconds).
        if (
          isSubscribed &&
          currentUser?.email &&
          (currentUser.role === 'seller' || currentUser.role === 'customer')
        ) {
          try {
            const inboxEmail = currentUser.email.toLowerCase().trim();
            const { getConversationsFromSupabase } = await import('../services/conversationService');
            const convResult =
              currentUser.role === 'seller'
                ? await getConversationsFromSupabase(undefined, inboxEmail)
                : await getConversationsFromSupabase(inboxEmail);
            if (convResult.success && convResult.data) {
              const normalized = convResult.data.map((conv) => ({
                ...conv,
                sellerId: conv.sellerId ? conv.sellerId.toLowerCase().trim() : conv.sellerId,
                customerId: conv.customerId ? conv.customerId.toLowerCase().trim() : conv.customerId,
              }));
              setConversations((prev) => {
                const merged = mergeConversationLists(prev, normalized);
                saveConversations(merged);
                return merged;
              });
            }
          } catch (convErr) {
            logWarn('Failed to sync conversations after login:', convErr);
          }
        }
      } catch (error) {
        logError('AppProvider: Failed to sync latest data after authentication:', error);
        // Don't show toast on every error - only if critical
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
          setVehiclesCatalogReady(true);
        }
      }
    };

    // Defer until the browser is idle. On low-RAM Android WebViews, firing the heavy
    // vehicles + users fetch (and the state updates they trigger) in the same tick as the
    // post-login HOME re-render can push the Chromium renderer over the memory ceiling and
    // the OS kills it — users see the app "auto-close" right after tapping Sign in.
    // requestIdleCallback yields the critical frame first, then runs the sync.
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;
    const runSync = () => {
      idleHandle = null;
      timeoutHandle = null;
      syncLatestData();
    };
    if (typeof window !== 'undefined') {
      const ric = (window as unknown as {
        requestIdleCallback?: (fn: () => void, opts?: { timeout?: number }) => number;
      }).requestIdleCallback;
      if (typeof ric === 'function') {
        idleHandle = ric(runSync, { timeout: 1500 });
      } else {
        timeoutHandle = window.setTimeout(runSync, 250);
      }
    } else {
      timeoutHandle = (setTimeout(runSync, 250) as unknown) as number;
    }

    return () => {
      isSubscribed = false;
      if (idleHandle !== null && typeof window !== 'undefined') {
        const cic = (window as unknown as {
          cancelIdleCallback?: (h: number) => void;
        }).cancelIdleCallback;
        if (typeof cic === 'function') cic(idleHandle);
      }
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
    };
    // PERFORMANCE: Depend on currentUser object, but effect only runs when email/role actually changes
    // React will compare object reference, so we extract values inside the effect
  }, [currentUser]);

  // Watch for new notifications and show browser notifications
  useEffect(() => {
    if (!currentUser?.email || notifications.length === 0) {
      return;
    }

    // Get notifications for current user
    const userNotifications = notifications.filter((n) =>
      participantIdMatchesAppUser(
        n.recipientEmail,
        currentUser.email,
        currentUser.id,
      ),
    );

    if (userNotifications.length === 0) {
      return;
    }

    const muted = getEffectiveMuteKeys(currentUser.notificationMuteKeys);
    const unreadNotifications = userNotifications
      .filter(n => !n.isRead && !shownNotificationIdsRef.current.has(n.id))
      .filter(n => !isStoryMuted(n, muted))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Show browser notification for each new unread notification (when page is hidden)
    unreadNotifications.forEach(notification => {
      // Mark as shown
      shownNotificationIdsRef.current.add(notification.id);
      
      if (document.visibilityState === 'hidden') {
        const title = notification.targetType === 'conversation' 
          ? 'New Message' 
          : 'New Notification';
        
        showNotification(title, {
          body: notification.message,
          icon: '/icon-192.png',
          tag: `notification-${notification.id}`,
          requireInteraction: false
        }).catch(err => {
          if (process.env.NODE_ENV === 'development') {
            logWarn('Failed to show browser notification:', err);
          }
        });
      } else if (notification.targetType === 'deal') {
        addToast(notification.message || notification.title || 'Deal update', 'info');
      }
      // Conversation/message alerts: realtime + inbox badges only — no duplicate toasts.
    });

    // Clean up old notification IDs from the ref (keep last 100)
    if (shownNotificationIdsRef.current.size > 100) {
      const notificationIds = new Set(notifications.map(n => n.id));
      shownNotificationIdsRef.current = new Set(
        Array.from(shownNotificationIdsRef.current).filter(id => notificationIds.has(id))
      );
    }
    // PERFORMANCE: Depend on currentUser object instead of email property for stable reference
  }, [notifications, currentUser, addToast]);

  // Periodic sync queue processor - retry failed Supabase saves
  useEffect(() => {
    const SYNC_INTERVAL = 30000; // 30 seconds

    let syncInterval: NodeJS.Timeout | null = null;
    let isProcessing = false;

    const processSync = async () => {
      // Prevent concurrent sync processing
      if (isProcessing) {
        logInfo('⏳ Sync already in progress, skipping...');
        return;
      }

      try {
        isProcessing = true;
        const queueStatus = getSyncQueueStatus();
        
        if (queueStatus.pending > 0) {
          logInfo(`🔄 Processing sync queue: ${queueStatus.pending} items pending`);
          
          const result = await processSyncQueue();
          
          if (result.success > 0) {
            logInfo(`✅ Successfully synced ${result.success} items to Supabase`);
            if (process.env.NODE_ENV === 'development') {
              addToast(t('toast.syncedItemsCount', { count: result.success }), 'success');
            }
          }
          
          if (result.failed > 0) {
            logWarn(`⚠️ Failed to sync ${result.failed} items after retries`);
            const remainingStatus = getSyncQueueStatus();
            if (remainingStatus.pending > 0 && process.env.NODE_ENV === 'development') {
              logInfo(`⏳ ${remainingStatus.pending} items still pending sync`);
            }
          }
        }
      } catch (error) {
        logError('Error processing sync queue:', error);
      } finally {
        isProcessing = false;
      }
    };

    // Process sync queue immediately on mount (after a short delay)
    const initialTimeout = setTimeout(() => {
      processSync();
    }, 5000); // Wait 5 seconds after mount

    // Then process periodically
    syncInterval = setInterval(processSync, SYNC_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [addToast, t]);

  // Sync vehicle data across tabs and periodically refresh from API
  useEffect(() => {
    // Add storage event listener to sync vehicle data across tabs (fires for other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'reRideVehicleData' && e.newValue) {
        try {
          const newVehicleData = JSON.parse(e.newValue);
          setVehicleData(newVehicleData);
          logInfo('✅ Vehicle data synced from another tab');
        } catch (error) {
          logError('Failed to parse vehicle data from storage event:', error);
        }
      }
    };

    // Add custom event listener for same-tab updates (fires when localStorage is updated in same tab)
    const handleVehicleDataUpdate = (e: CustomEvent) => {
      if (e.detail && e.detail.vehicleData) {
        setVehicleData(e.detail.vehicleData);
        logInfo('✅ Vehicle data synced from same tab');
      }
    };

    // When dataService background refresh completes, update UI so new published vehicles appear without page refresh
    const handleVehiclesCacheUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && Array.isArray(detail.vehicles)) {
        let admin = false;
        try {
          const raw = localStorage.getItem('reRideCurrentUser');
          if (raw) admin = JSON.parse(raw)?.role === 'admin';
        } catch { /* ignore */ }
        setVehicles((prev) => mergeVehicleCatalog(prev, detail.vehicles, admin));
        logInfo('✅ Vehicle list updated from background refresh');
      }
    };

    // When user data background refresh completes, keep UI in sync with Supabase/API
    const handleUsersCacheUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && Array.isArray(detail.users)) {
        setUsers(detail.users);
        logInfo('✅ User list updated from background refresh');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('vehicleDataUpdated', handleVehicleDataUpdate as EventListener);
    window.addEventListener('vehiclesCacheUpdated', handleVehiclesCacheUpdated);
    window.addEventListener('usersCacheUpdated', handleUsersCacheUpdated);

    // Periodic refresh of vehicle list so newly published vehicles appear on home within ~1 min
    const isAdmin = (() => {
      try {
        const savedUser = localStorage.getItem('reRideCurrentUser');
        if (savedUser) {
          const user = JSON.parse(savedUser);
          return user?.role === 'admin';
        }
      } catch { /* ignore */ }
      return false;
    })();
    const isNativeWebView = isCapacitorNative();
    const vehicleRefreshMs = isNativeWebView
      ? CLIENT_POLL_INTERVALS_MS.vehicleCatalogNative
      : CLIENT_POLL_INTERVALS_MS.vehicleCatalogWeb;
    const vehicleListRefreshInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      dataService.getVehicles(isAdmin, false)
        .then((freshVehicles) => {
          if (Array.isArray(freshVehicles) && freshVehicles.length >= 0) {
            setVehicles((prev) => mergeVehicleCatalog(prev, freshVehicles, !!isAdmin));
            logInfo('✅ Vehicle list refreshed from API');
          }
        })
        .catch((err) => {
          logWarn('Periodic vehicle list refresh failed:', err);
        });
    }, vehicleRefreshMs); // 1 minute on web, 3 minutes on native

    // Periodic refresh of vehicle data (makes/models etc) from API (every 5 minutes)
    const refreshInterval = setInterval(() => {
      dataService.getVehicleData()
        .then((freshData) => {
          if (freshData) {
            setVehicleData(freshData);
            logInfo('✅ Vehicle data refreshed from API');
          }
        })
        .catch((error) => {
          logWarn('Failed to refresh vehicle data:', error);
        });
    }, CLIENT_POLL_INTERVALS_MS.vehicleDataCatalog);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('vehicleDataUpdated', handleVehicleDataUpdate as EventListener);
      window.removeEventListener('vehiclesCacheUpdated', handleVehiclesCacheUpdated);
      window.removeEventListener('usersCacheUpdated', handleUsersCacheUpdated);
      clearInterval(vehicleListRefreshInterval);
      clearInterval(refreshInterval);
    };
  }, []);

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    if (conversations.length > 0) {
      saveConversations(conversations);
    }
  }, [conversations]);

  // Save audit log to localStorage whenever it changes
  useEffect(() => {
    if (auditLog.length > 0) {
      saveAuditLog(auditLog);
    }
  }, [auditLog]);

  // Save support tickets to localStorage whenever they change
  useEffect(() => {
    if (supportTickets.length > 0) {
      saveSupportTickets(supportTickets);
    }
  }, [supportTickets]);

  // Keep admin support queue in near real-time sync with backend updates.
  // Defer first fetch until idle so catalog/home paint isn't competing for network.
  useEffect(() => {
    if (!currentUser?.email) return;
    const role = currentUser.role;
    const email = currentUser.email;

    let isMounted = true;
    let interval: ReturnType<typeof setInterval> | null = null;
    const refreshSupportTickets = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const tickets = await fetchSupportTicketsFromSupabase(role === 'admin' ? undefined : email);
        if (isMounted) {
          setSupportTickets(Array.isArray(tickets) ? tickets : []);
        }
      } catch {
        // non-blocking background refresh
      }
    };

    const start = () => {
      if (!isMounted) return;
      void refreshSupportTickets();
      interval = setInterval(refreshSupportTickets, CLIENT_POLL_INTERVALS_MS.supportTickets);
    };

    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(() => start(), { timeout: 8000 });
    } else {
      timeoutId = setTimeout(start, 4000);
    }

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
      if (idleId != null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [currentUser?.email, currentUser?.role]);

  // Hydrate platform settings and audit log from the Supabase-backed API once
  // the admin is authenticated. This replaces the per-browser localStorage-only
  // model so that a setting change from one admin/device is visible to every
  // other admin/device after a refresh.
  useEffect(() => {
    let cancelled = false;

    // Settings: available to all visitors (announcement is public).
    // We still fetch in the background so the current tab picks up any admin
    // update from another tab/device.
    (async () => {
      try {
        const next = await fetchSettings();
        if (!cancelled) {
          setPlatformSettings(next);
        }
      } catch {
        // fetchSettings already swallows errors and returns the cached copy.
      }
    })();

    // Audit log: admin-only endpoint. Only hydrate when the current user is
    // an admin; otherwise we leave the locally cached copy alone.
    if (currentUser?.role === 'admin') {
      (async () => {
        try {
          const entries = await fetchAuditLog(500);
          if (!cancelled && entries.length > 0) {
            setAuditLog(entries);
          }
        } catch {
          // Non-blocking: keep the local cache on failure.
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [currentUser?.email, currentUser?.role]);

  // Reliability: force a conversation sync after resume / reconnect.
  useEffect(() => {
    if (!currentUser?.email || (currentUser.role !== 'seller' && currentUser.role !== 'customer')) return;
    const email = currentUser.email.toLowerCase().trim();
    const role = currentUser.role;

    const syncConversationsNow = async () => {
      try {
        const { getConversationsFromSupabase } = await import('../services/conversationService');
        const result =
          role === 'seller'
            ? await getConversationsFromSupabase(undefined, email)
            : await getConversationsFromSupabase(email);
        if (!result.success || !result.data) return;
        const normalized = result.data.map((conv) => ({
          ...conv,
          sellerId: conv.sellerId ? conv.sellerId.toLowerCase().trim() : conv.sellerId,
          customerId: conv.customerId ? conv.customerId.toLowerCase().trim() : conv.customerId,
        }));
        setConversations((prev) => {
          const merged = mergeConversationLists(prev, normalized);
          const changed =
            prev.length !== merged.length ||
            merged.some((n) => {
              const p = prev.find((x) => x && String(x.id) === String(n.id));
              return !p || (p.messages?.length ?? 0) !== (n.messages?.length ?? 0) || p.isReadBySeller !== n.isReadBySeller || p.isReadByCustomer !== n.isReadByCustomer;
            });
          if (!changed) return prev;
          try {
            saveConversations(merged);
          } catch {
            /* ignore */
          }
          return merged;
        });
      } catch {
        /* ignore */
      }
    };

    const onOnline = () => {
      void syncConversationsNow();
      void processSyncQueue();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void syncConversationsNow();
        void processSyncQueue();
      }
    };

    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [currentUser?.email, currentUser?.role]);

  // Capacitor: flush offline message queue when app returns to foreground.
  useEffect(() => {
    if (!isCapacitorNative()) return;
    let listener: { remove: () => Promise<void> } | undefined;
    void (async () => {
      try {
        const { App } = await import('@capacitor/app');
        listener = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            void processSyncQueue();
          }
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      void listener?.remove();
    };
  }, []);

  useRealtimeChatRuntime({
    currentUser,
    conversations,
    activeChat,
    setConversations,
    setActiveChat,
    setTypingStatus,
    setChatPeerOnlineByConversationId,
    setNotifications,
  });

  // Add navigation event listener for dashboard navigation
  useEffect(() => {
    const handleNavigationEvent = (event: CustomEvent) => {
      const { view } = event.detail;
      if (view && Object.values(View).includes(view)) {
        navigate(view as View);
      }
    };

    window.addEventListener('navigate', handleNavigationEvent as EventListener);
    return () => {
      window.removeEventListener('navigate', handleNavigationEvent as EventListener);
    };
  }, [navigate]);

  // Add online/offline sync functionality
  useEffect(() => {
    const handleOnline = () => {
      resetOfflineToastSession();
      logInfo('🔄 App came online, syncing data...');
      void processSyncQueue();
      dataService.syncWhenOnline().then(() => {
        logInfo('✅ Data sync completed');
      }).catch((error) => {
        logBackgroundSyncFailure('Offline data sync', error);
      });
    };

    const handleOffline = () => {
      logInfo('📴 App went offline');
      if (shouldShowOfflineToast()) {
        addToast(t('toast.nowOffline'), 'warning');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addToast, t]);

  const { updateVehicleHandler, syncVehicleFromServer } = useVehicleMutations({
    vehicles,
    sellerInventoryRef,
    currentUser,
    setVehicles,
    setSellerInventory,
    setAuditLog,
    syncVehicleCachesById,
    addToast,
    t,
  });

  const adminPlatformActions = useAdminPlatformActions({
    users,
    vehicles,
    conversations,
    currentUser,
    publicSellerProfile,
    setUsers,
    setVehicles,
    setConversations,
    setCurrentUser,
    setPublicSellerProfile,
    setPlatformSettings,
    setAuditLog,
    setVehicleData,
    setFaqItems,
    setSupportTickets,
    setNotifications,
    syncUserCachesByEmail,
    syncAllUserCaches,
    updateVehicleHandler,
    addToast,
    t,
  });

  const messagingActions = useAppMessagingActions({
    currentUser,
    conversations,
    activeChat,
    setConversations,
    setActiveChat,
    addToast,
    t,
  });

  const contextValue: AppContextType = useMemo(() => {
    return {
    // State
    currentView,
    previousView,
    selectedVehicle,
    vehicles,
    isLoading,
    vehiclesCatalogReady,
    sellerInventory,
    sellerInventoryReady,
    currentUser,
    comparisonList,
    comparisonCategory,
    ratings,
    sellerRatings,
    wishlist,
    conversations,
    // Toast UI / typing-presence live in dedicated contexts — stable stubs here
    // so those updates do not recreate AppContext and re-render the tree.
    toasts: EMPTY_TOASTS,
    forgotPasswordRole,
    typingStatus: null,
    chatPeerOnlineByConversationId: EMPTY_PEER_ONLINE,
    selectedCategory,
    publicSellerProfile,
    activeChat,
    isAnnouncementVisible,
    recommendations,
    initialSearchQuery,
    isCommandPaletteOpen,
    userLocation,
    selectedCity,
    users,
    platformSettings,
    auditLog,
    vehicleData,
    faqItems,
    supportTickets,
    // Notification UI reads NotificationContext — keep a stable empty array here.
    notifications: EMPTY_NOTIFICATIONS,

    // Actions
    setCurrentView,
    setPreviousView,
    setSelectedVehicle,
    setVehicles: setVehicles as (vehicles: Vehicle[] | ((prev: Vehicle[]) => Vehicle[])) => void,
    setSellerInventory: setSellerInventory as (vehicles: Vehicle[] | ((prev: Vehicle[]) => Vehicle[])) => void,
    setIsLoading,
    setCurrentUser,
    setComparisonList: setComparisonList as (list: number[] | ((prev: number[]) => number[])) => void,
    setWishlist: setWishlist as (list: number[] | ((prev: number[]) => number[])) => void,
    setConversations: setConversations as (conversations: Conversation[] | ((prev: Conversation[]) => Conversation[])) => void,
    setToasts,
    setForgotPasswordRole,
    setTypingStatus,
    setSelectedCategory,
    setPublicSellerProfile,
    setActiveChat,
    setIsAnnouncementVisible,
    setInitialSearchQuery,
    setIsCommandPaletteOpen,
    setUserLocation: updateUserLocation,
    setSelectedCity: updateSelectedCity,
    setUsers,
    setPlatformSettings,
    setAuditLog,
    setVehicleData,
    setFaqItems,
    setSupportTickets,
    setNotifications,
    setRatings,
    setSellerRatings: setSellerRatings as (ratings: { [key: string]: number[] } | ((prev: { [key: string]: number[] }) => { [key: string]: number[] })) => void,

    // Helper functions
    addToast,
    removeToast,
    askConfirm,
    runIfConfirmed,
    handleLogout,
    handleLogin,
    handleRegister,
    navigate,
    goBack,
    refreshVehicles,
    refreshSellerInventory,

    // Admin / platform actions
    ...adminPlatformActions,

    // Additional functions
    addRating: (vehicleId: number, rating: number) => {
      setRatings(prev => ({
        ...prev,
        [vehicleId]: [...(prev[vehicleId] || []), rating]
      }));
      addToast(t('toast.ratingAdded'), 'success');
    },
    addSellerRating: (sellerEmail: string, rating: number) => {
      setSellerRatings(prev => ({
        ...prev,
        [sellerEmail]: [...(prev[sellerEmail] || []), rating]
      }));
      addToast(t('toast.sellerRatingAdded'), 'success');
    },
    ...messagingActions,

    flagContent: (type: 'vehicle' | 'conversation', id: number | string, reason?: string) => {
      if (type === 'vehicle') {
        setVehicles(prev => Array.isArray(prev) ? prev.map(vehicle => 
          vehicle && vehicle.id === id ? { ...vehicle, isFlagged: true, flagReason: reason } : vehicle
        ) : []);
      } else {
        setConversations(prev => Array.isArray(prev) ? prev.map(conv => 
          conv && conv.id === id ? { ...conv, isFlagged: true, flagReason: reason } : conv
        ) : []);
      }

      // Persist the report so admins/moderators can review it.
      try {
        const reportedBy = currentUser?.email || 'anonymous';
        const targetType = type === 'vehicle' ? 'vehicle' : 'conversation';
        createSafetyReport(reportedBy, targetType, id, 'other', reason || 'No reason provided');
      } catch (error) {
        logWarn('Failed to persist safety report:', error);
      }

      // Best-effort: also notify the server so the report survives cross-device.
      // Endpoint may not exist in all environments; we swallow 404/network errors.
      try {
        void authenticatedFetch('/api/content-reports', {
          method: 'POST',
          body: JSON.stringify({
            reportedBy: currentUser?.email || 'anonymous',
            targetType: type,
            targetId: id,
            reason: reason || 'No reason provided',
            createdAt: new Date().toISOString(),
          }),
        }).catch(() => { /* ignore network errors */ });
      } catch { /* ignore */ }

      // Audit log
      try {
        const actor = currentUser?.name || currentUser?.email || 'Anonymous';
        const entry = logAction(actor, 'Flag Content', String(id), `Flagged ${type}${reason ? ': ' + reason : ''}`);
        setAuditLog(prev => [entry, ...prev]);
      } catch { /* ignore */ }

      addToast(t('toast.contentFlagged', { reasonSuffix: reason ? ': ' + reason : '' }), 'warning');
    },
    updateUser: async (email: string, updates: Partial<User>, options: UserUpdateOptions = {}) => {
      try {
        // CRITICAL: Never allow role to be updated via this function (security)
        const { currentPassword, ...safeUpdates } = updates as Partial<User> & { currentPassword?: string };
        delete safeUpdates.role; // Prevent role changes through profile updates
        const normalizedTargetEmail = String(email || '').toLowerCase().trim();
        
        // Debug logging for partnerBanks updates
        if (safeUpdates.partnerBanks !== undefined) {
          logInfo('💳 Updating partnerBanks:', { email, partnerBanks: safeUpdates.partnerBanks, count: safeUpdates.partnerBanks?.length || 0 });
        }
        
        // CRITICAL FIX: Update Supabase FIRST (real-time), then sync to local state/localStorage only on success
        // This ensures password changes are persisted to Supabase immediately, not just locally
        try {
          logInfo('📡 Sending user update request to API (real-time Supabase update)...', { email, hasPassword: !!updates.password });
          
          // PROACTIVE TOKEN REFRESH: For critical operations like password updates, 
          // proactively refresh token before making the request to prevent session expiration errors
          if (updates.password) {
            try {
              const { refreshAccessToken } = await import('../services/userService');
              logInfo('🔄 Proactively refreshing token before password update...');
              const refreshResult = await refreshAccessToken();
              if (refreshResult.success && refreshResult.accessToken) {
                logInfo('✅ Token refreshed proactively before password update');
              } else {
                logWarn('⚠️ Proactive token refresh failed, but continuing with request (will retry on 401)');
              }
            } catch (refreshError) {
              logWarn('⚠️ Error during proactive token refresh:', refreshError);
              // Continue with request - authenticatedFetch will handle 401 and retry
            }
          }
          
          // Use authenticated fetch with automatic token refresh
          const { authenticatedFetch } = await import('../utils/authenticatedFetch');
          const response = await authenticatedFetch('/api/users', {
            method: 'PUT',
            body: JSON.stringify({
              email,
              ...safeUpdates,
              ...(currentPassword ? { currentPassword } : {}),
            }),
          });
          
          logInfo('📥 API response received:', { status: response.status, ok: response.ok });
          
          // Use the response handler for consistent error handling
          const { handleApiResponse } = await import('../utils/authenticatedFetch');
          const apiResult = await handleApiResponse(response);
          
          if (!apiResult.success) {
            logError('❌ API error response:', { status: response.status, error: apiResult.error, reason: apiResult.reason });
            
            // Handle 401 Unauthorized - token refresh should have been attempted by authenticatedFetch
            // If we still get 401, it means token refresh failed - user needs to re-login
            if (response.status === 401) {
              logError('❌ 401 Unauthorized - Token refresh failed. Supabase update NOT saved.');
              const errorReason = apiResult.reason || apiResult.error || 'Authentication expired';
              // Avoid duplicate "log in again" messages
              const cleanReason = errorReason.includes('log in again') 
                ? errorReason 
                : `${errorReason}. Please log in again and try again.`;
              if (updates.password) {
                addToast(t('toast.passwordUpdateFailedReason', { reason: cleanReason }), 'error');
              } else {
                addToast(t('toast.profileUpdateFailedReason', { reason: cleanReason }), 'error');
              }
              // Don't update localStorage - Supabase update failed, so we shouldn't save locally
              // Throw a specific error that we can check in catch block to avoid duplicate messages
              throw new Error('AUTH_401_ALREADY_HANDLED');
            }
            
            // Handle 500 Internal Server Error - server issue
            if (response.status === 500) {
              logError('❌ 500 Server Error - Supabase update failed.');
              if (updates.password) {
                addToast(t('toast.passwordUpdateFailedServer'), 'error');
              } else {
                addToast(t('toast.profileUpdateFailedServer'), 'error');
              }
              // Don't update localStorage - Supabase update failed
              throw new Error('Server error. Please try again.');
            }
            
            // For other errors, throw to prevent local update
            throw new Error(apiResult.reason || apiResult.error || `API call failed: ${response.status}`);
          }
          
          const result = apiResult.data || {};
          logInfo('✅ User updated in Supabase successfully:', { success: result?.success, hasUser: !!result?.user });
          // Password change signs out all sessions server-side; keep this one alive with the fresh tokens.
          if (typeof result?.accessToken === 'string') {
            const { storeTokens } = await import('../services/userService');
            await storeTokens(result.accessToken, result.refreshToken);
          }
          
          // Supabase update succeeded - NOW update local state and localStorage
          if (result?.user) {
            // CRITICAL: Preserve role if not in API response (shouldn't happen, but safety check)
            // Also ensure partnerBanks and other fields from safeUpdates are included
            const updatedUserData = {
              ...result.user,
              role: result.user.role || currentUser?.role || 'customer', // Preserve existing role
              // Explicitly include partnerBanks from updates if present (fallback if API response doesn't include it)
              ...(safeUpdates.partnerBanks !== undefined && { partnerBanks: safeUpdates.partnerBanks }),
              ...(safeUpdates.notificationMuteKeys !== undefined && {
                notificationMuteKeys: safeUpdates.notificationMuteKeys
              })
            };
            
            // Update React state - ensure partnerBanks is properly merged
            setUsers(prev => {
              const source = Array.isArray(prev) ? prev : [];
              let matched = false;
              const mapped = source.map(user => {
                if (user && String(user.email || '').toLowerCase().trim() === normalizedTargetEmail) {
                  matched = true;
                  const merged = { ...user, ...updatedUserData };
                  // Explicitly ensure partnerBanks is included if it was in the update
                  if (safeUpdates.partnerBanks !== undefined) {
                    merged.partnerBanks = safeUpdates.partnerBanks;
                    logInfo('✅ Updated users array with partnerBanks:', { email, partnerBanks: merged.partnerBanks });
                  }
                  if (safeUpdates.notificationMuteKeys !== undefined) {
                    merged.notificationMuteKeys = safeUpdates.notificationMuteKeys;
                  }
                  return merged;
                }
                return user;
              });
              // Keep seller metadata immediately visible even if the users cache did not include this row yet.
              return matched ? mapped : [...mapped, updatedUserData as User];
            });
            
            if (currentUser && String(currentUser.email || '').toLowerCase().trim() === normalizedTargetEmail) {
              // CRITICAL: Always preserve role when updating currentUser
              const mergedUser = { 
                ...currentUser, 
                ...updatedUserData,
                role: updatedUserData.role || currentUser.role || 'customer', // Ensure role is never lost
                // Explicitly ensure partnerBanks is included if it was in the update
                ...(safeUpdates.partnerBanks !== undefined && { partnerBanks: safeUpdates.partnerBanks }),
                ...(safeUpdates.notificationMuteKeys !== undefined && {
                  notificationMuteKeys: safeUpdates.notificationMuteKeys
                })
              };
              
              setCurrentUser(mergedUser);
              // Update localStorage after Supabase success
              try {
                localStorage.setItem('reRideCurrentUser', currentUserForLocalSessionJson(mergedUser));
                sessionStorage.setItem('currentUser', currentUserForLocalSessionJson(mergedUser));
              } catch (error) {
                logWarn('Failed to update localStorage with API response:', error);
              }
            }
          } else {
            // Fallback: If API doesn't return user, still update local state with safeUpdates
            // This ensures partnerBanks and other fields are saved even if API response is incomplete
            setUsers(prev => {
              const source = Array.isArray(prev) ? prev : [];
              let matched = false;
              const mapped = source.map(user => {
                if (String(user.email || '').toLowerCase().trim() === normalizedTargetEmail) {
                  matched = true;
                  return { ...user, ...safeUpdates };
                }
                return user;
              });
              if (matched) return mapped;
              const fallbackUser = currentUser
                ? ({ ...currentUser, ...safeUpdates } as User)
                : ({ email: normalizedTargetEmail, role: 'customer', ...safeUpdates } as User);
              return [...mapped, fallbackUser];
            });
            
            if (currentUser && String(currentUser.email || '').toLowerCase().trim() === normalizedTargetEmail) {
              const mergedUser = { 
                ...currentUser, 
                ...safeUpdates,
                role: currentUser.role || 'customer' // Ensure role is never lost
              };
              setCurrentUser(mergedUser);
              try {
                localStorage.setItem('reRideCurrentUser', currentUserForLocalSessionJson(mergedUser));
                sessionStorage.setItem('currentUser', currentUserForLocalSessionJson(mergedUser));
              } catch (error) {
                logWarn('Failed to update localStorage with fallback update:', error);
              }
            }
          }
          
          // Also update the localStorage users array after Supabase success.
          // Never cache the password locally (or re-send it without currentPassword).
          const { password: _password, ...localUpdates } = safeUpdates;
          try {
            if (Object.keys(localUpdates).length > 0) {
              const { updateUser: updateUserService } = await import('../services/userService');
              await updateUserService({ email, ...localUpdates });
              logInfo('✅ User updated in localStorage users array (after Supabase success)');
            }
          } catch (localError) {
            logWarn('⚠️ Failed to update user in localStorage users array:', localError);
            // Try manual update as fallback
            try {
              const usersJson = localStorage.getItem('reRideUsers');
              if (usersJson) {
                const users = JSON.parse(usersJson);
                const updatedUsers = users.map((user: User) => 
                  String(user.email || '').toLowerCase().trim() === normalizedTargetEmail
                    ? { ...user, ...localUpdates }
                    : user
                );
                localStorage.setItem('reRideUsers', JSON.stringify(updatedUsers));
                logInfo('✅ User updated in localStorage (manual fallback)');
              }
            } catch (fallbackError) {
              logError('❌ Failed to update user in localStorage (fallback):', fallbackError);
            }
          }

          // Keep all known users caches in sync immediately.
          syncUserCachesByEmail(email, localUpdates);
          
          // Show success message (skip for silent metadata sync after another primary action)
          if (!options.skipToast) {
            if (updates.password) {
              addToast(t('toast.passwordUpdatedSuccess'), 'success');
            } else {
              addToast(t('toast.profileUpdatedSuccess'), 'success');
            }
          }
          
        } catch (apiError) {
          logError('❌ API error during user update - Supabase update FAILED:', apiError);

          if (options.skipToast) {
            logBackgroundSyncFailure('User metadata sync', apiError);
            throw apiError;
          }
          
          // CRITICAL: Don't save locally when Supabase fails - user wants real-time updates
          // Only show error messages, don't update any local state
          
          if (apiError instanceof Error) {
            const errorMsg = apiError.message;
            
            // Skip if error was already handled (e.g., 401 with toast already shown)
            if (errorMsg === 'AUTH_401_ALREADY_HANDLED') {
              return; // Error already shown, don't show duplicate
            }
            
            // Check for database connection errors (503)
            if (errorMsg.includes('503') || errorMsg.includes('Database connection failed') || errorMsg.includes('SUPABASE')) {
              logError('❌ Supabase connection failed:', errorMsg);
              if (updates.password) {
                addToast(t('toast.passwordUpdateFailedSupabase'), 'error');
              } else {
                addToast(t('toast.profileUpdateFailedSupabase'), 'error');
              }
            } else if (errorMsg.includes('fetch') || 
                errorMsg.includes('network') ||
                errorMsg.includes('Failed to fetch') ||
                errorMsg.includes('CORS')) {
              // Network errors
              logError('❌ Network error updating user:', errorMsg);
              if (updates.password) {
                addToast(t('toast.passwordUpdateFailedNetwork'), 'error');
              } else {
                addToast(t('toast.profileUpdateFailedNetwork'), 'error');
              }
            } else if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
              // 404 errors
              logError('❌ API endpoint not found:', errorMsg);
              if (updates.password) {
                addToast(t('toast.passwordUpdateFailedNotFound'), 'error');
              } else {
                addToast(t('toast.profileUpdateFailedNotFound'), 'error');
              }
            } else if (errorMsg.includes('400')) {
              logError('❌ Invalid profile data:', apiError);
              addToast(
                t('toast.updateInvalidData', { detail: errorMsg.replace('400: ', '') }),
                'error',
              );
            } else if (errorMsg.includes('Authentication failed') || errorMsg.includes('Please log in again') || errorMsg.includes('session has expired')) {
              // Authentication errors - already handled above, but catch here for safety
              // Avoid duplicate messages - check if we already showed an error
              logError('❌ Authentication error:', errorMsg);
              // Only show if not already handled by the 401 handler above
              if (!errorMsg.includes('401') && !errorMsg.includes('Unauthorized')) {
                const cleanMsg = errorMsg.includes('log in again') 
                  ? errorMsg 
                  : `${errorMsg}. Please log in again and try again.`;
                if (updates.password) {
                  addToast(t('toast.passwordUpdateFailedReason', { reason: cleanMsg }), 'error');
                } else {
                  addToast(t('toast.profileUpdateFailedReason', { reason: cleanMsg }), 'error');
                }
              }
            } else if (errorMsg.includes('500') || errorMsg.includes('Database error') || errorMsg.includes('Internal server') || errorMsg.includes('Server error')) {
              logError('❌ Server/Database error updating user:', apiError);
              if (updates.password) {
                addToast(t('toast.passwordUpdateFailedServer'), 'error');
              } else {
                addToast(t('toast.profileUpdateFailedServer'), 'error');
              }
            } else {
              logWarn('⚠️ Failed to update profile in Supabase:', errorMsg);
              // Format Supabase error for user display
              const displayError = formatSupabaseError(errorMsg);
              if (updates.password) {
                addToast(t('toast.passwordUpdateFailedDisplay', { error: displayError }), 'error');
              } else {
                addToast(t('toast.profileUpdateFailedDisplay', { error: displayError }), 'error');
              }
            }
          } else {
            logWarn('⚠️ Failed to update profile in Supabase - unknown error type');
            if (updates.password) {
              addToast(t('toast.passwordUpdateFailedCheckLogs'), 'error');
            } else {
              addToast(t('toast.profileUpdateFailedTryAgain'), 'error');
            }
          }
          
          // Re-throw to prevent any local updates
          throw apiError;
        }
        
      } catch (error) {
        // Error already handled with specific toast messages in inner catch block
        // Only log here to avoid duplicate error toasts
        logError('Failed to update user:', error);
        // Don't show generic toast - inner catch already showed specific error message
      }
    },
    deleteUser: async (email: string) => {
      const user = Array.isArray(users) ? users.find(u => u.email === email) : undefined;
      const actor = currentUser?.name || currentUser?.email || 'System';
      const userInfo = user ? `${user.name} (${user.email})` : email;

      try {
        const { deleteUser: deleteUserApi } = await import('../services/userService');
        const result = await deleteUserApi(email);
        if (!result?.success) {
          addToast(t('toast.deleteUserFailed') || 'Failed to delete user', 'error');
          return;
        }

        const entry = logAction(actor, 'Delete User', email, `Deleted user: ${userInfo}`);
        setAuditLog(prev => [entry, ...prev]);

        const nextUsers = Array.isArray(users) ? users.filter(user => user && user.email !== email) : [];
        setUsers(nextUsers);
        syncAllUserCaches(nextUsers);
        addToast(t('toast.userDeletedSuccess'), 'success');
      } catch (error) {
        logError('Failed to delete user via API:', error);
        addToast(t('toast.deleteUserFailed') || 'Failed to delete user. Please try again.', 'error');
      }
    },
    updateVehicle: async (id: number, updates: Partial<Vehicle>, options?: VehicleUpdateOptions) => {
      await updateVehicleHandler(id, updates, options);
    },
    syncVehicleFromServer,
    deleteVehicle: async (id: number) => {
      try {
        const vehicle =
          (Array.isArray(vehicles) ? vehicles.find((v) => v.id === id) : undefined) ||
          sellerInventoryRef.current.find((v) => v.id === id);
        
        // Call API to delete vehicle
        const { deleteVehicle: deleteVehicleApi } = await import('../services/vehicleService');
        const result = await deleteVehicleApi(id, vehicle?.databaseId);
        
        if (result.success) {
          // Log audit entry for vehicle deletion
          const actor = currentUser?.name || currentUser?.email || 'System';
          const vehicleInfo = vehicle ? `${vehicle.make} ${vehicle.model} (ID: ${id})` : `Vehicle #${id}`;
          const entry = logAction(actor, 'Delete Vehicle', vehicleInfo, `Deleted vehicle: ${vehicleInfo}`);
          setAuditLog(prev => [entry, ...prev]);
          
          // Update local state
          setVehicles(prev => Array.isArray(prev) ? prev.filter(vehicle => vehicle && vehicle.id !== id) : []);
          setSellerInventory((prev) =>
            Array.isArray(prev) ? prev.filter((vehicle) => vehicle && vehicle.id !== id) : [],
          );
          syncVehicleCachesById(id, () => null);
          addToast(t('toast.vehicleDeletedSuccess'), 'success');
          logInfo('✅ Vehicle deleted via API:', result);
        } else {
          addToast(t('toast.deleteVehicleFailed'), 'error');
        }
      } catch (error) {
        logError('❌ Failed to delete vehicle:', error);
        addToast(t('toast.deleteVehicleFailedRetry'), 'error');
      }
    },
    selectVehicle: (vehicle: Vehicle) => {
      if (process.env.NODE_ENV === 'development') {
        logInfo('🚗 selectVehicle called for:', vehicle.id, vehicle.make, vehicle.model);
      }
      
      // Validate vehicle object (id may arrive as string from some API paths)
      if (!vehicle || vehicle.id === undefined || vehicle.id === null) {
        logError('❌ selectVehicle called with invalid vehicle:', vehicle);
        return;
      }
      const idNum = Number(vehicle.id);
      if (!Number.isFinite(idNum)) {
        logError('❌ selectVehicle: vehicle.id is not a valid number:', vehicle.id);
        return;
      }
      const now = Date.now();
      if (lastVehicleSelectRef.current.id === idNum && now - lastVehicleSelectRef.current.t < 450) {
        return;
      }
      lastVehicleSelectRef.current = { id: idNum, t: now };

      const vehicleNorm: Vehicle =
        typeof vehicle.id === 'number' && vehicle.id === idNum ? vehicle : { ...vehicle, id: idNum };

      const vehicleForDetail = enrichVehicleWithSellerInfo(
        vehicleNorm,
        Array.isArray(users) ? users : []
      );
      
      // Track recently viewed for customers (async, non-blocking)
      if (currentUser?.role === 'customer' && currentUser?.email) {
        buyerService.addToRecentlyViewed(currentUser.email, idNum).catch(error => {
          logWarn('Failed to track recently viewed vehicle:', error);
        });
      }

      // Also record in a local, anon-friendly list so the mobile home page
      // can show a "Continue browsing" strip for logged-out visitors too.
      addLocalRecentId(idNum);
      
      // CRITICAL: Store vehicle in sessionStorage FIRST (synchronous, immediate)
      // This ensures the vehicle is available even if state update is delayed
      try {
        const vehicleJson = stringifyVehicleForSession(vehicleForDetail);
        sessionStorage.setItem('selectedVehicle', vehicleJson);
        
        // Verify it was stored correctly
        const verifyStored = sessionStorage.getItem('selectedVehicle');
        if (!verifyStored || verifyStored !== vehicleJson) {
          logWarn('⚠️ Vehicle sessionStorage verification mismatch; continuing with in-memory state');
        } else if (process.env.NODE_ENV === 'development') {
          logInfo('🚗 Vehicle stored and verified in sessionStorage:', vehicleForDetail.id, vehicleForDetail.make, vehicleForDetail.model);
        }
      } catch (error) {
        logError('❌ Failed to store vehicle in sessionStorage:', error);
        // Continue: in-memory selectedVehicle still powers the detail screen; refresh may not restore.
      }
      
      // Set the selected vehicle state (async, but sessionStorage is already set and verified)
      // The navigate function will check sessionStorage first, so state update timing doesn't matter
      setSelectedVehicle(vehicleForDetail);
      
      if (process.env.NODE_ENV === 'development') {
        logInfo('🚗 Navigating to DETAIL view with vehicle:', vehicleNorm.id, vehicleNorm.make, vehicleNorm.model);
      }
      
      // User-initiated open must never be dropped: location sync sets isHandlingPopStateRef for ~100ms
      // after route changes, and navigate() used to bail out entirely during that window.
      isHandlingPopStateRef.current = false;

      try {
        if (currentView !== View.DETAIL) {
          // Store enum ordinal only (not view name string) — avoids clear-text session flags.
          sessionStorage.setItem(RERIDE_DETAIL_ENTRY_SOURCE_KEY, viewToDetailEntryOrdinal(currentView));
        }
      } catch {
        /* ignore */
      }
      
      // Navigate to DETAIL view immediately
      // The navigate function will check sessionStorage first (which we just set and verified),
      // so the vehicle will be available even if state hasn't updated yet
      navigate(View.DETAIL, { detailVehicle: vehicleForDetail });
    },
    toggleWishlist: (vehicleId: number) => {
      setWishlist(prev => 
        Array.isArray(prev) && prev.includes(vehicleId) 
          ? prev.filter(id => id !== vehicleId)
          : Array.isArray(prev) ? [...prev, vehicleId] : [vehicleId]
      );
    },
    toggleCompare: (vehicleId: number) => {
      const result = computeCompareToggle(comparisonList, vehicleId, vehicles);
      if (result.added || result.removed) {
        setComparisonList(result.nextList);
        return;
      }
      if (result.blockedReason === 'category_mismatch' && result.requiredCategory) {
        addToast(
          t('compare.sameCategoryRequired', {
            category: getCategoryDisplayName(result.requiredCategory),
          }),
          'error',
        );
        return;
      }
      if (result.blockedReason === 'max') {
        addToast(t('compare.maxReached', { max: MAX_COMPARE_VEHICLES }), 'error');
      }
    },
  };
  }, [
    currentView, previousView, selectedVehicle, vehicles, isLoading, vehiclesCatalogReady,
    sellerInventory, sellerInventoryReady, currentUser,
    comparisonList, comparisonCategory, ratings, sellerRatings, wishlist, conversations,
    forgotPasswordRole, selectedCategory, publicSellerProfile,
    activeChat, isAnnouncementVisible, recommendations, initialSearchQuery,
    isCommandPaletteOpen, userLocation, selectedCity, users, platformSettings,
    auditLog, vehicleData, faqItems, supportTickets,
    setCurrentView, setPreviousView, setSelectedVehicle, setVehicles, setSellerInventory, setIsLoading,
    setCurrentUser, setComparisonList, setWishlist, setConversations, setToasts,
    setForgotPasswordRole, setTypingStatus, setSelectedCategory, setPublicSellerProfile,
    setActiveChat, setIsAnnouncementVisible, setInitialSearchQuery,
    setIsCommandPaletteOpen, updateUserLocation, updateSelectedCity, setUsers,
    setPlatformSettings, setAuditLog, setVehicleData, setFaqItems, setSupportTickets,
    setNotifications, addToast, removeToast, askConfirm, runIfConfirmed, navigate, goBack, refreshVehicles, refreshSellerInventory, handleLogin, handleRegister, handleLogout,
    updateVehicleHandler, syncVehicleFromServer, syncUserCachesByEmail, syncAllUserCaches, syncVehicleCachesById,
    adminPlatformActions, messagingActions,
    t,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      <NotificationContextBridge value={{ notifications, setNotifications }}>
        {children}
      </NotificationContextBridge>
      <ConfirmDialogHost confirmState={confirmState} setConfirmState={setConfirmState} />
    </AppContext.Provider>
  );
};

// Add displayName for better debugging and Fast Refresh compatibility
AppProviderCore.displayName = 'AppProviderCore';
AppProvider.displayName = 'AppProvider';

