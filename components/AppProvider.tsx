import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
  startTransition,
} from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../lib/i18n';
import { useNavigate as useRouterNavigate, useLocation } from 'react-router-dom';
import type { Vehicle, User, Conversation, Toast as ToastType, PlatformSettings, AuditLogEntry, VehicleData, Notification, VehicleCategory, SupportTicket, FAQItem, SubscriptionPlan, ChatMessage } from '../types';
import { View, VehicleCategory as CategoryEnum } from '../types';
import { getConversations, saveConversations } from '../services/chatService';
import { putConversationOfferResponse } from '../services/conversationService';
import {
  addMessageWithSync,
  getSyncQueueStatus,
  processSyncQueue,
} from '../services/syncService';
import { realtimeChatService, type ChatEphemeralThreadMeta } from '../services/realtimeChatService';
import { getSettings, saveSettings, fetchSettings, updateSettings } from '../services/settingsService';
import { getAuditLog, logAction, saveAuditLog, fetchAuditLog } from '../services/auditLogService';
import { getFaqs, saveFaqs } from '../services/faqService';
import {
  getSupportTickets,
  saveSupportTickets,
  fetchSupportTicketsFromSupabase,
  updateSupportTicketInSupabase,
} from '../services/supportTicketService';
import { dataService } from '../services/dataService';
import { getAuthHeaders, refreshAuthToken, resetAuthFetchStateAfterLogout } from '../utils/authenticatedFetch';
import { VEHICLE_DATA } from './vehicleData';
import { isDevelopmentEnvironment } from '../utils/environment';
import { showNotification } from '../services/notificationService';
import { formatSupabaseError } from '../utils/errorUtils';
import { logInfo, logWarn, logError, logDebug } from '../utils/logger';
import { randomAlphanumeric, randomIntBelow } from '../utils/secureRandom.js';
import { clearRememberMeState } from '../utils/rememberMe';
import { deduplicateRequest } from '../utils/requestDeduplication';
import { enrichVehicleWithSellerInfo } from '../utils/vehicleEnrichment';
import * as buyerService from '../services/buyerService';
import { createSafetyReport } from '../services/trustSafetyService';
import { addLocalRecentId } from '../utils/recentlyViewed';
import { stringifyVehicleForSession } from '../utils/vehicleSessionCache';
import { persistReRideNotifications, readPersistedReRideNotifications } from '../utils/notificationLocalStorage';
import { currentUserForLocalSessionJson } from '../utils/userLocalStorageSnapshot';
import { useSupabaseRealtime } from '../hooks/useSupabaseRealtime';
import { sanitizePersistedChatMessage, supabaseRowToConversation } from '../services/supabase-conversation-service';
import { emailToKey } from '../services/supabase-user-service';
import { isCapacitorNative } from '../utils/apiConfig';
import { normalizeUserLocationForStorage } from '../utils/cityMapping';
import {
  clearSupabaseAuthStorage,
  getBrowserAccessTokenForApi,
  useHttpOnlyRefreshCookie,
} from '../utils/authStorage';
import { getEffectiveMuteKeys, isStoryMuted } from '../utils/notificationMute';
import { getSupabaseClient } from '../lib/supabase';
import { syncServiceProviderOAuth, syncWithBackend } from '../services/supabase-auth-service';
import type { Session } from '@supabase/supabase-js';

/** PostgREST realtime filter value: quote emails so `@` and special chars parse correctly. */
function postgrestEqQuoted(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** True if we can call refresh-token (JSON refresh in storage, or HttpOnly cookie + persisted user). */
function hasLikelyRefreshSource(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem('reRideRefreshToken')) return true;
    if (useHttpOnlyRefreshCookie() && localStorage.getItem('reRideCurrentUser')) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Merge local + server messages without duplicates (realtime + optimistic UI). */
function mergeConversationMessagesForRealtime(local: ChatMessage[], remote: ChatMessage[]): ChatMessage[] {
  const byId = new Map<number, ChatMessage>();
  for (const m of remote || []) {
    if (m?.id != null) {
      byId.set(Number(m.id), sanitizePersistedChatMessage(m));
    }
  }
  for (const m of local || []) {
    if (m?.id != null) {
      const k = Number(m.id);
      if (!byId.has(k)) {
        byId.set(k, sanitizePersistedChatMessage(m));
      }
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

// PERFORMANCE: Helper function for user-friendly error messages
// Improves UX by converting technical errors to actionable messages
function getUserFriendlyErrorMessage(error: unknown, defaultMessage: string): string {
  if (error instanceof Error) {
    // Use formatSupabaseError for Supabase-specific errors
    const formatted = formatSupabaseError(error);
    if (formatted !== error.message) {
      return formatted;
    }
    // Check for common error patterns
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return i18n.t('errors.network');
    }
    if (error.message.includes('timeout')) {
      return i18n.t('errors.timeout');
    }
    if (error.message.includes('permission') || error.message.includes('unauthorized')) {
      return i18n.t('errors.permission');
    }
    return defaultMessage;
  }
  if (typeof error === 'string') {
    return formatSupabaseError(error);
  }
  return defaultMessage;
}

/**
 * Capacitor Android WebView often OOM-kills the renderer when session storage, toast, router,
 * and a heavy first paint (e.g. mobile HOME) run in the same frame right after sign-in.
 * Spread that work across animation frames + a transition update.
 */
function scheduleCapacitorPostLoginUi(fn: () => void): void {
  if (typeof window === 'undefined' || !isCapacitorNative()) {
    fn();
    return;
  }
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        startTransition(fn);
      }, 0);
    });
  });
}

/**
 * After login sync: avoid replacing a full catalog with a tiny partial response (stale dedup / bad cache).
 * Admins always take the server result so bulk deletes stay correct.
 */
function mergeVehicleCatalog(prev: Vehicle[], incoming: Vehicle[], isAdmin: boolean): Vehicle[] {
  if (!Array.isArray(incoming)) return Array.isArray(prev) ? prev : [];
  if (incoming.length === 0) return prev.length > 0 ? prev : [];
  if (prev.length === 0 || incoming.length >= prev.length) return incoming;
  if (isAdmin) return incoming;
  if (prev.length >= 5 && incoming.length <= 2) {
    console.warn(
      `⚠️ Skipping vehicle state shrink (${incoming.length} vs ${prev.length} cached) — likely partial API response.`
    );
    return prev;
  }
  return incoming;
}

interface VehicleUpdateOptions {
  successMessage?: string;
  skipToast?: boolean;
}

// PERFORMANCE: Proper typing improves tree-shaking and prevents runtime errors
interface HistoryState {
  view: View;
  previousView: View;
  timestamp: number;
  selectedVehicleId?: number;
}

/** Compare vehicle ids from URL, JSON, or API (number vs numeric string). */
function vehicleIdsEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

/** React Router pathname for packaged WebView (`/index.html`) → logical app path. */
function normalizeRouterPath(path: string): string {
  if (path == null || typeof path !== 'string') return '/';
  const p = path.trim();
  const lower = p.toLowerCase();
  if (lower === '/index.html' || lower.endsWith('/index.html')) {
    return '/';
  }
  return p;
}

/**
 * HashRouter should set pathname from the hash, but some Android WebViews briefly report "/"
 * while `location.hash` already contains the real route (#/vehicle/:id, #/seller/..., etc.).
 * Prefer the hash path for any `/...` segment — not only vehicle detail — or seller/deep links
 * mis-resolve to `/` and the location sync effect clobbers SELLER_PROFILE back to HOME/DETAIL.
 */
function getAppPathFromRouter(loc: { pathname?: string; hash?: string }): string {
  const raw = (loc?.pathname ?? '/') || '/';
  const p = normalizeRouterPath(raw);
  if (p.startsWith('/vehicle/')) return p;
  if (p !== '/' && p !== '') return p;
  const hashStr =
    loc?.hash != null && loc.hash.length > 0
      ? loc.hash
      : typeof window !== 'undefined' && window.location.hash
        ? window.location.hash
        : '';
  if (hashStr.length > 1) {
    try {
      const fromHash = hashStr.replace(/^#/, '').split('?')[0] || '/';
      if (fromHash.startsWith('/') && fromHash.length > 1) {
        return fromHash;
      }
    } catch {
      /* ignore */
    }
  }
  return p;
}

// Helper function to map URL paths to views (safe for Capacitor/WebView)
function pathToView(path: string): View {
  if (path == null || typeof path !== 'string') return View.HOME;
  const normalizedPath = normalizeRouterPath(path).toLowerCase().trim();
  
  // Exact matches first
  if (normalizedPath === '/' || normalizedPath === '') return View.HOME;
  if (normalizedPath === '/used-cars') return View.USED_CARS;
  if (normalizedPath === '/new-cars') return View.HOME;
  if (normalizedPath === '/car-services') return View.CAR_SERVICES;
  if (normalizedPath === '/car-services/detail') return View.SERVICE_DETAIL;
  if (normalizedPath === '/car-services/login') return View.CAR_SERVICE_LOGIN;
  if (normalizedPath === '/car-services/dashboard') return View.CAR_SERVICE_DASHBOARD;
  if (normalizedPath === '/car-services/cart') return View.SERVICE_CART;
  if (normalizedPath === '/rental') return View.RENTAL;
  if (normalizedPath === '/dealers') return View.DEALER_PROFILES;
  if (normalizedPath.startsWith('/vehicle/')) {
    return View.DETAIL;
  }
  if (normalizedPath === '/vehicle') return View.DETAIL;
  if (normalizedPath === '/seller/dashboard') return View.SELLER_DASHBOARD;
  // Admin login lives at /admin/login. /admin (and /admin/panel) is the signed-in dashboard URL
  // and must map to ADMIN_PANEL — otherwise location sync clobbers the panel whenever users/vehicles update.
  if (normalizedPath === '/admin/login') return View.ADMIN_LOGIN;
  if (normalizedPath === '/admin/new-cars' || normalizedPath === '/admin/new-cars/manage') {
    return View.ADMIN_PANEL;
  }
  if (normalizedPath === '/admin/sell-car') return View.SELL_CAR_ADMIN;
  if (normalizedPath === '/admin' || normalizedPath === '/admin/panel') return View.ADMIN_PANEL;
  if (normalizedPath === '/login') return View.LOGIN_PORTAL;
  if (normalizedPath === '/compare') return View.COMPARISON;
  if (normalizedPath === '/wishlist') return View.WISHLIST;
  if (normalizedPath === '/profile') return View.PROFILE;
  if (normalizedPath === '/forgot-password') return View.FORGOT_PASSWORD;
  if (normalizedPath === '/inbox') return View.INBOX;
  if (normalizedPath === '/notifications') return View.NOTIFICATIONS_CENTER;
  if (normalizedPath.startsWith('/seller/')) {
    // Path like /seller/email@example.com
    return View.SELLER_PROFILE;
  }
  if (normalizedPath === '/seller') return View.SELLER_PROFILE;
  if (normalizedPath === '/pricing') return View.PRICING;
  if (normalizedPath === '/support') return View.SUPPORT;
  if (normalizedPath === '/about-us') return View.ABOUT_US;
  if (normalizedPath === '/faq') return View.FAQ;
  if (normalizedPath === '/privacy-policy') return View.PRIVACY_POLICY;
  if (normalizedPath === '/terms-of-service') return View.TERMS_OF_SERVICE;
  if (normalizedPath === '/safety-center' || normalizedPath === '/safety') return View.SAFETY_CENTER;
  if (normalizedPath === '/customer/dashboard' || normalizedPath === '/buyer/dashboard') return View.BUYER_DASHBOARD;
  if (normalizedPath.startsWith('/city/')) {
    // Path like /city/mumbai
    return View.CITY_LANDING;
  }
  if (normalizedPath === '/city') return View.CITY_LANDING;
  if (normalizedPath === '/sell-car') return View.SELL_CAR;
  
  // Default fallback
  return View.HOME;
}

/** Email segment from /seller/:email (excludes /seller/dashboard). */
function parseSellerEmailFromPath(path: string): string | null {
  const sellerSeg = path.match(/^\/seller\/(.+)$/i);
  if (!sellerSeg || sellerSeg[1].toLowerCase() === 'dashboard') return null;
  try {
    const email = decodeURIComponent(sellerSeg[1]).toLowerCase().trim();
    return email || null;
  } catch {
    return null;
  }
}

/**
 * Prefer the URL for public seller routes: history.state.view can lag or be wrong on HashRouter/WebView
 * while the hash already shows /seller/..., which previously kept the UI on DETAIL or HOME.
 */
function resolveViewFromPathAndState(path: string, routerState: HistoryState | null | undefined): View {
  const pathView = pathToView(path);
  if (pathView === View.SELLER_PROFILE) {
    return View.SELLER_PROFILE;
  }
  if (pathView === View.NOTIFICATIONS_CENTER) {
    return View.NOTIFICATIONS_CENTER;
  }
  // HashRouter/WebView: URL can advance to /used-cars (etc.) before history.state updates — stale state.view may still be DETAIL.
  // Never let that override a non-detail path, or "Back to Listings" syncs back to detail.
  if (pathView !== View.DETAIL && routerState?.view === View.DETAIL) {
    return pathView;
  }
  // Stale location.state.view must not win over a real /admin* URL, or the app stays on HOME/another view
  // with an empty or wrong main area while the address bar shows /admin (user sees header + no dashboard).
  if (
    pathView === View.ADMIN_PANEL ||
    pathView === View.ADMIN_LOGIN ||
    pathView === View.SELL_CAR_ADMIN
  ) {
    return pathView;
  }
  return routerState?.view ?? pathView;
}

/**
 * First paint must match the real URL; defaulting to HOME until an effect runs
 * left /admin showing the marketing shell with an empty or wrong main region.
 * Bootstrap from window (pathname + hash) and ignore history.state so stale view cannot win on refresh.
 */
function readInitialAppViewFromBrowser(): View {
  if (typeof window === 'undefined') return View.HOME;
  try {
    const path = getAppPathFromRouter({
      pathname: window.location.pathname || '/',
      hash: window.location.hash || '',
    });
    return resolveViewFromPathAndState(path, null);
  } catch {
    return View.HOME;
  }
}

function isAdminUserRole(role: string | undefined | null): boolean {
  return (role || '').toLowerCase().trim() === 'admin';
}

/** Dev-only: POST NDJSON to Vite middleware → `debug-4f3bea.log` in repo root. */
function agentNavDebugLog(payload: {
  hypothesisId: string;
  message: string;
  location: string;
  runId?: string;
  [key: string]: unknown;
}) {
  if (typeof import.meta !== 'undefined' && !import.meta.env.DEV) return;
  if (typeof window === 'undefined') return;
  // #region agent log
  void fetch('/__debug_nav_log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: '4f3bea',
      timestamp: Date.now(),
      ...payload,
    }),
  }).catch(() => {});
  // #endregion
}

/** Last non-detail screen before opening a listing (HashRouter / WebView can lose `location.state`). */
const RERIDE_DETAIL_ENTRY_SOURCE_KEY = 'rerideDetailEntrySourceView';

const VIEW_ORDINALS = Object.values(View) as View[];

function viewToDetailEntryOrdinal(v: View): string {
  const i = VIEW_ORDINALS.indexOf(v);
  return i === -1 ? '0' : String(i);
}

function detailEntryOrdinalToView(ordinal: string): View | undefined {
  if (!/^\d+$/.test(ordinal)) return undefined;
  const i = parseInt(ordinal, 10);
  if (i < 0 || i >= VIEW_ORDINALS.length) return undefined;
  return VIEW_ORDINALS[i];
}

function readDetailEntrySourceView(): View | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem(RERIDE_DETAIL_ENTRY_SOURCE_KEY);
    if (!raw) return undefined;
    if (/^\d+$/.test(raw)) {
      const v = detailEntryOrdinalToView(raw);
      if (v == null || v === View.DETAIL) return undefined;
      return v;
    }
    if (!(Object.values(View) as string[]).includes(raw)) return undefined;
    const v = raw as View;
    return v === View.DETAIL ? undefined : v;
  } catch {
    return undefined;
  }
}

// API response structure for vehicle feature operations
interface FeatureApiResponse {
  success?: boolean;
  data?: unknown;
  error?: string;
  reason?: string;
  alreadyFeatured?: boolean;
  vehicle?: Vehicle;
  remainingCredits?: number;
}

interface AppContextType {
  // State
  currentView: View;
  previousView: View;
  selectedVehicle: Vehicle | null;
  vehicles: Vehicle[];
  isLoading: boolean;
  /** False until the first vehicle catalog hydration attempt finishes (cache and/or API). Avoids showing a false "Unable to load vehicles" on mobile while the network request is still in flight. */
  vehiclesCatalogReady: boolean;
  currentUser: User | null;
  comparisonList: number[];
  ratings: { [key: string]: number[] };
  sellerRatings: { [key: string]: number[] };
  wishlist: number[];
  conversations: Conversation[];
  toasts: ToastType[];
  forgotPasswordRole: 'customer' | 'seller' | null;
  typingStatus: { conversationId: string; userRole: 'customer' | 'seller' } | null;
  /** Supabase/Socket presence: counterpart online per conversation (for chat header). */
  chatPeerOnlineByConversationId: Record<string, boolean>;
  selectedCategory: VehicleCategory | 'ALL';
  publicSellerProfile: User | null;
  activeChat: Conversation | null;
  isAnnouncementVisible: boolean;
  recommendations: Vehicle[];
  initialSearchQuery: string;
  isCommandPaletteOpen: boolean;
  userLocation: string;
  selectedCity: string;
  users: User[];
  platformSettings: PlatformSettings;
  auditLog: AuditLogEntry[];
  vehicleData: VehicleData;
  faqItems: FAQItem[];
  supportTickets: SupportTicket[];
  notifications: Notification[];

  // Actions
  setCurrentView: (view: View) => void;
  setPreviousView: (view: View) => void;
  setSelectedVehicle: (vehicle: Vehicle | null) => void;
  setVehicles: (vehicles: Vehicle[] | ((prev: Vehicle[]) => Vehicle[])) => void;
  setIsLoading: (loading: boolean) => void;
  setCurrentUser: (user: User | null) => void;
  setComparisonList: (list: number[] | ((prev: number[]) => number[])) => void;
  setWishlist: (list: number[] | ((prev: number[]) => number[])) => void;
  setConversations: (conversations: Conversation[] | ((prev: Conversation[]) => Conversation[])) => void;
  setToasts: (toasts: ToastType[]) => void;
  setForgotPasswordRole: (role: 'customer' | 'seller' | null) => void;
  setTypingStatus: (status: { conversationId: string; userRole: 'customer' | 'seller' } | null) => void;
  setSelectedCategory: (category: VehicleCategory | 'ALL') => void;
  setPublicSellerProfile: (profile: User | null) => void;
  setActiveChat: (chat: Conversation | null) => void;
  setIsAnnouncementVisible: (visible: boolean) => void;
  setInitialSearchQuery: (query: string) => void;
  setIsCommandPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setUserLocation: (location: string) => void;
  setSelectedCity: (city: string) => void;
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setPlatformSettings: (settings: PlatformSettings) => void;
  setAuditLog: (log: AuditLogEntry[]) => void;
  setVehicleData: (data: VehicleData) => void;
  setFaqItems: (items: FAQItem[]) => void;
  setSupportTickets: React.Dispatch<React.SetStateAction<SupportTicket[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  setRatings: (ratings: { [key: string]: number[] }) => void;
  setSellerRatings: (ratings: { [key: string]: number[] } | ((prev: { [key: string]: number[] }) => { [key: string]: number[] })) => void;

  // Helper functions
  addToast: (message: string, type: ToastType['type']) => void;
  removeToast: (id: number) => void;
  handleLogout: () => void;
  handleLogin: (user: User) => void;
  handleRegister: (user: User) => void;
  navigate: (
    view: View,
    params?: { city?: string; sellerEmail?: string; detailVehicle?: Vehicle; unblockPopstateSync?: boolean }
  ) => void;
  goBack: (fallbackView?: View) => void;
  refreshVehicles: () => Promise<void>;
  
  // Admin functions
  onCreateUser: (userData: Omit<User, 'status'>) => Promise<{ success: boolean, reason: string }>;
  onAdminUpdateUser: (email: string, details: Partial<User>) => void;
      onUpdateUserPlan: (email: string, plan: SubscriptionPlan) => Promise<void>;
    onToggleUserStatus: (email: string) => Promise<void>;
    onToggleVehicleStatus: (vehicleId: number) => Promise<void>;
    onToggleVehicleFeature: (vehicleId: number) => Promise<void>;
  onResolveFlag: (type: 'vehicle' | 'conversation', id: number | string) => void;
  onUpdateSettings: (settings: PlatformSettings) => Promise<void> | void;
  onSendBroadcast: (message: string) => void;
  onExportUsers: () => void;
  onImportUsers: (users: Omit<User, 'id'>[]) => Promise<void>;
  onExportVehicles: () => void;
  onImportVehicles: (vehicles: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>[]) => Promise<void>;
  onExportSales: () => void;
  onUpdateVehicleData: (newData: VehicleData) => void;
  onToggleVerifiedStatus: (email: string) => void;
  onUpdateSupportTicket: (ticket: SupportTicket) => void;
  onAddFaq: (faq: Omit<FAQItem, 'id'>) => void;
  onUpdateFaq: (faq: FAQItem) => void;
  onDeleteFaq: (id: number) => void;
  onCertificationApproval: (vehicleId: number, decision: 'approved' | 'rejected') => void;
  
  // Additional functions
  addRating: (vehicleId: number, rating: number) => void;
  addSellerRating: (sellerEmail: string, rating: number) => void;
  sendMessage: (conversationId: string, message: string) => void;
  sendMessageWithType: (conversationId: string, messageText: string, type?: ChatMessage['type'], payload?: ChatMessage['payload']) => void;
  markAsRead: (
    conversationId: string,
    options?: { readerRole?: 'customer' | 'seller'; forceReadState?: boolean },
  ) => void;
  setConversationReadState: (
    conversationId: string,
    readerRole: 'customer' | 'seller',
    isRead: boolean,
  ) => void;
  clearConversationMessages: (conversationId: string) => Promise<void>;
  toggleTyping: (conversationId: string, isTyping: boolean) => void;
  flagContent: (type: 'vehicle' | 'conversation', id: number | string, reason?: string) => void;
  updateUser: (email: string, updates: Partial<User>) => Promise<void>;
  deleteUser: (email: string) => Promise<void>;
  updateVehicle: (id: number, updates: Partial<Vehicle>, options?: VehicleUpdateOptions) => Promise<void>;
  deleteVehicle: (id: number) => void;
  selectVehicle: (vehicle: Vehicle) => void;
  toggleWishlist: (vehicleId: number) => void;
  toggleCompare: (vehicleId: number) => void;
  onOfferResponse: (conversationId: string, messageId: number, response: 'accepted' | 'rejected' | 'countered', counterPrice?: number) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

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
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  // React Router hooks for proper URL management
  const routerNavigate = useRouterNavigate();
  const location = useLocation();

  // Track which notifications have already shown browser notifications
  const shownNotificationIdsRef = useRef<Set<number>>(new Set());
  // Track vehicles currently being updated to prevent duplicate updates
  const updatingVehiclesRef = useRef<Set<number>>(new Set());
  // Counter for generating unique toast IDs to prevent collisions
  // FIXED: Use simple incrementing counter to avoid precision issues with large numbers
  const toastCounterRef = useRef<number>(0);
  // FIXED: Store timestamps separately to avoid precision loss from division operations
  const toastTimestampsRef = useRef<Map<number, number>>(new Map());
  
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
  /** Prevents double handleLogin when both getSession + onAuthStateChange run after Google OAuth */
  const googleOAuthSyncDoneRef = useRef(false);
  /** While tryFinishGoogleOAuth is calling syncWithBackend — blocks duplicate session-restore sync */
  const oauthGoogleProfileSyncInFlightUidRef = useRef<string | null>(null);
  /** Mutex for session-restore sync (auth events can fire in bursts) */
  const profileRestoreFromSupabaseInFlightRef = useRef(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [vehiclesCatalogReady, setVehiclesCatalogReady] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    // Check for existing logged-in user on app startup (safe for WebView/Capacitor)
    if (typeof window === 'undefined' || typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') {
      return null;
    }
    try {
      const savedUser = localStorage.getItem('reRideCurrentUser');
      const savedSession = sessionStorage.getItem('currentUser');
      
      if (savedUser) {
        const user = JSON.parse(savedUser);
        
        // CRITICAL: Validate user object has required fields (especially role)
        // Provide defaults for missing fields if possible
        if (!user) {
          logWarn('⚠️ Invalid user object in localStorage - user is null/undefined');
          localStorage.removeItem('reRideCurrentUser');
          if (savedSession) sessionStorage.removeItem('currentUser');
          return null;
        }

        // Validate and fix missing email
        if (!user.email || typeof user.email !== 'string') {
          logWarn('⚠️ Invalid user object - missing or invalid email. Clearing user data.');
          localStorage.removeItem('reRideCurrentUser');
          if (savedSession) sessionStorage.removeItem('currentUser');
          return null;
        }

        // Validate and fix missing role - provide default if we can infer it
        if (!user.role || typeof user.role !== 'string') {
          // Try to infer role from other fields (e.g., has dealership = seller)
          if (user.dealershipName) {
            user.role = 'seller';
            logDebug('🔧 Auto-assigned role "seller" based on dealershipName');
          } else {
            user.role = 'customer'; // Safe default
            logDebug('🔧 Auto-assigned role "customer" as default');
          }
        }
        
        // Ensure role is a valid value (include service_provider — car-services accounts)
        if (!['customer', 'seller', 'admin', 'service_provider', 'finance_partner'].includes(user.role)) {
          logWarn('⚠️ Invalid role in user object:', user.role, '- defaulting to customer');
          user.role = 'customer'; // Safe default instead of clearing
          // Save corrected user back
          try {
            localStorage.setItem('reRideCurrentUser', currentUserForLocalSessionJson(user));
          } catch (e) {
            logWarn('Failed to save corrected user:', e);
          }
        }
        
        logInfo('🔄 Restoring logged-in user:', {
          name: user.name,
          email: user.email,
          role: user.role,
          userId: user.id,
          source: 'localStorage',
          isProduction: !window.location.hostname.includes('localhost')
        });
        return user;
      } else if (savedSession) {
        // Fallback to sessionStorage if localStorage doesn't have user
        const user = JSON.parse(savedSession);
        if (
          user &&
          user.email &&
          user.role &&
          ['customer', 'seller', 'admin', 'service_provider', 'finance_partner'].includes(user.role)
        ) {
          logInfo('🔄 Restoring logged-in user from sessionStorage:', {
            name: user.name,
            email: user.email,
            role: user.role,
            userId: user.id,
            source: 'sessionStorage'
          });
          // Also restore to localStorage for consistency
          localStorage.setItem('reRideCurrentUser', currentUserForLocalSessionJson(user));
          return user;
        }
      }
    } catch (error) {
      logWarn('Failed to load user from localStorage:', error);
      try {
        if (typeof localStorage !== 'undefined') localStorage.removeItem('reRideCurrentUser');
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('currentUser');
      } catch (_) {
        // Ignore clear errors
      }
    }
    return null;
  });
  const currentUserRef = useRef<User | null>(null);
  currentUserRef.current = currentUser;
  const [comparisonList, setComparisonList] = useState<number[]>(() => {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
      const stored = localStorage.getItem('reride_comparison_list');
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed.filter((n: unknown) => typeof n === 'number') : [];
    } catch { return []; }
  });
  const [ratings, setRatings] = useState<{ [key: string]: number[] }>(() => {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') return {};
      const stored = localStorage.getItem('vehicleRatings');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [sellerRatings, setSellerRatings] = useState<{ [key: string]: number[] }>(() => {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') return {};
      const stored = localStorage.getItem('sellerRatings');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [wishlist, setWishlist] = useState<number[]>(() => {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
      const stored = localStorage.getItem('reride_wishlist');
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed.filter((n: unknown) => typeof n === 'number') : [];
    } catch { return []; }
  });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [toasts, setToasts] = useState<ToastType[]>([]);
  const [forgotPasswordRole, setForgotPasswordRole] = useState<'customer' | 'seller' | null>(null);
  const [typingStatus, setTypingStatus] = useState<{ conversationId: string; userRole: 'customer' | 'seller' } | null>(null);
  const [chatPeerOnlineByConversationId, setChatPeerOnlineByConversationId] = useState<Record<string, boolean>>({});
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory | 'ALL'>(CategoryEnum.FOUR_WHEELER);
  const [publicSellerProfile, setPublicSellerProfile] = useState<User | null>(null);
  const [activeChat, setActiveChat] = useState<Conversation | null>(null);
  const [isAnnouncementVisible, setIsAnnouncementVisible] = useState(true);
  // PERFORMANCE: Memoize recommendations calculation to avoid recalculating on every render
  // Recommendations are derived from vehicles, so we compute them instead of storing in state
  const recommendations = useMemo(() => {
    if (!vehicles || vehicles.length === 0) return [];
    // Return top 6 vehicles, prioritizing recent listings
    return vehicles
      .filter(v => v.status === 'published')
      .sort((a, b) => {
        // Sort by creation date (newest first)
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      })
      .slice(0, 6);
  }, [vehicles]);
  const [initialSearchQuery, setInitialSearchQuery] = useState<string>('');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Persist wishlist / comparison / ratings to localStorage so they survive refresh.
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('reride_wishlist', JSON.stringify(wishlist || []));
      }
    } catch (error) { logWarn('Failed to persist wishlist:', error); }
  }, [wishlist]);
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('reride_comparison_list', JSON.stringify(comparisonList || []));
      }
    } catch (error) { logWarn('Failed to persist comparison list:', error); }
  }, [comparisonList]);
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('vehicleRatings', JSON.stringify(ratings || {}));
      }
    } catch (error) { logWarn('Failed to persist ratings:', error); }
  }, [ratings]);
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('sellerRatings', JSON.stringify(sellerRatings || {}));
      }
    } catch (error) { logWarn('Failed to persist seller ratings:', error); }
  }, [sellerRatings]);
  const [userLocation, setUserLocationState] = useState<string>(() => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return 'Mumbai';
    try {
      const storedLocation = localStorage.getItem('reRideUserLocation');
      if (storedLocation && storedLocation.trim().length > 0) {
        const n = normalizeUserLocationForStorage(storedLocation);
        if (n) return n;
      }
    } catch (error) {
      logWarn('Failed to load user location from localStorage:', error);
    }
    return 'Mumbai';
  });
  const [selectedCity, setSelectedCityState] = useState<string>(() => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return '';
    try {
      const storedCity = localStorage.getItem('reRideSelectedCity');
      if (storedCity && storedCity.trim().length > 0) {
        const n = normalizeUserLocationForStorage(storedCity);
        if (n) return n;
      }
      const storedLocation = localStorage.getItem('reRideUserLocation');
      if (storedLocation && storedLocation.trim().length > 0) {
        const n = normalizeUserLocationForStorage(storedLocation);
        if (n) return n;
      }
    } catch (error) {
      logWarn('Failed to load selected city from localStorage:', error);
    }
    return '';
  });
  const [users, setUsers] = useState<User[]>([]);

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
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
    try {
      const notificationsJson = readPersistedReRideNotifications();
      if (notificationsJson) return JSON.parse(notificationsJson);
      const sampleNotifications: Notification[] = [
        {
          id: 1,
          recipientEmail: 'seller@test.com',
          message: 'New message from Mock Customer: Offer: 600000',
          targetId: 'conv_1703123456789',
          targetType: 'conversation',
          isRead: false,
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 2,
          recipientEmail: 'seller@test.com',
          message: 'New message from Mock Customer: Offer: 123444',
          targetId: 'conv_1703123456789',
          targetType: 'conversation',
          isRead: false,
          timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
        }
      ];
      try {
        persistReRideNotifications(sampleNotifications);
      } catch (_) {
        // WebView/Capacitor may restrict setItem; continue without persisting
      }
      return sampleNotifications;
    } catch {
      return [];
    }
  });

  const addToast = useCallback((message: string, type: ToastType['type']) => {
    try {
      // Validate inputs
      if (!message || typeof message !== 'string' || message.trim() === '') {
        logWarn('Invalid toast message provided');
        return;
      }
      
      if (!['success', 'error', 'warning', 'info'].includes(type)) {
        logWarn('Invalid toast type provided:', type);
        return;
      }

      const trimmedMessage = message.trim();
      const now = Date.now();
      
      // FIXED: Generate unique toast ID using simple incrementing counter
      // This avoids precision issues with large numbers (now * 1000 creates ~1.7×10^15)
      // JavaScript's floating point precision can cause Math.floor(id / 1000) to fail
      const id = toastCounterRef.current;
      toastCounterRef.current += 1;
      
      // Store timestamp separately to avoid precision loss from division operations
      toastTimestampsRef.current.set(id, now);
      
      // Prevent duplicate toasts: Check if the same message and type already exists
      // and was added within the last 3 seconds
      const toastId = id;
      
      setToasts(prev => {
        const recentDuplicate = prev.find(
          toast => {
            if (toast.message !== trimmedMessage || toast.type !== type) {
              return false;
            }
            // Use stored timestamp instead of extracting from ID to avoid precision issues
            const toastTimestamp = toastTimestampsRef.current.get(toast.id);
            if (toastTimestamp === undefined) {
              return false; // Timestamp not found, assume not recent
            }
            return (now - toastTimestamp) < 3000;
          }
        );
        
        if (recentDuplicate) {
          // Toast with same message already exists and is recent, skip adding duplicate
          logDebug('Skipping duplicate toast:', trimmedMessage);
          // Clean up the timestamp we just stored since we're not using this ID
          toastTimestampsRef.current.delete(id);
          return prev;
        }
        
        const toast: ToastType = { id, message: trimmedMessage, type };
        
        // Schedule auto-remove after 5 seconds - do this inside the state update callback
        // to ensure it only runs when the toast is actually added (not a duplicate)
        // Use setTimeout to schedule after the current state update completes
        setTimeout(() => {
          setToasts(prevToasts => {
            const filtered = prevToasts.filter(t => t.id !== toastId);
            // Clean up timestamp when toast is removed
            if (filtered.length < prevToasts.length) {
              toastTimestampsRef.current.delete(toastId);
            }
            return filtered;
          });
        }, 5000);
        
        return [...prev, toast];
      });
    } catch (error) {
      logError('Error adding toast:', error);
    }
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => {
      const filtered = prev.filter(toast => toast.id !== id);
      // Clean up timestamp when toast is manually removed
      if (filtered.length < prev.length) {
        toastTimestampsRef.current.delete(id);
      }
      return filtered;
    });
  }, []);

  // CRITICAL: Emergency fail-safe to prevent infinite loading
  // Only show notification if we have no vehicles loaded at all
  useEffect(() => {
    const emergencyTimeout = setTimeout(() => {
      setIsLoading(current => {
        if (current && vehicles.length === 0) {
          // Only show notification if we truly have no data
          logWarn('⚠️ EMERGENCY: No vehicles loaded after 3s');
          addToast(t('toast.loadingVehicles'), 'info');
          return false;
        }
        return current;
      });
    }, 3000); // Reduced from 5000 to 3000 for faster response
    
    return () => clearTimeout(emergencyTimeout);
  }, [addToast, vehicles.length, t]); // Add vehicles.length dependency

  const handleLogout = useCallback(async () => {
    try {
      // Local sign-out only: default global signOut() revokes on Supabase (logout?scope=global)
      // and returns 403 when the access token is already expired, which blocks logout.
      try {
        const { getSupabaseClient } = await import('../lib/supabase');
        const supabase = getSupabaseClient();
        const { error: signOutErr } = await supabase.auth.signOut({ scope: 'local' });
        if (signOutErr) {
          logDebug('Supabase local sign out:', signOutErr.message);
        }
      } catch (supabaseError) {
        logDebug('Supabase sign out skipped:', supabaseError);
      }
      clearSupabaseAuthStorage();

      // Clear tokens via logout service
      try {
        const { logout: logoutService } = await import('../services/userService');
        logoutService();
      } catch (logoutError) {
        logWarn('Logout service error:', logoutError);
      }

      // Clear user state
      setCurrentUser(null);
      
      // Clear storage
      sessionStorage.removeItem('currentUser');
      sessionStorage.removeItem('reride_oauth_role');
      sessionStorage.removeItem('reride_last_role');
      googleOAuthSyncDoneRef.current = false;
      oauthGoogleProfileSyncInFlightUidRef.current = null;
      localStorage.removeItem('reRideCurrentUser');
      localStorage.removeItem('reRideAccessToken');
      localStorage.removeItem('reRideRefreshToken');
      try {
        localStorage.removeItem('reride_oauth_role');
        localStorage.removeItem('reride_last_role');
      } catch {
        /* ignore */
      }
      localStorage.removeItem('reRideServiceProvider');
      localStorage.removeItem('rememberedCustomerEmail');
      localStorage.removeItem('rememberedSellerEmail');
      clearRememberMeState();

      // Clear user-specific data
      setActiveChat(null);
      setComparisonList([]);
      setWishlist([]);
      try {
        localStorage.removeItem('reride_wishlist');
        localStorage.removeItem('reride_comparison_list');
      } catch { /* ignore storage errors */ }
      
      // Navigate to home
      setCurrentView(View.HOME);
      
      // Show success message
      addToast(t('toast.loggedOut'), 'info');
    } catch (error) {
      logError('Error during logout:', error);
      // Even if there's an error, clear local state
      setCurrentUser(null);
      sessionStorage.removeItem('currentUser');
      sessionStorage.removeItem('reride_oauth_role');
      sessionStorage.removeItem('reride_last_role');
      googleOAuthSyncDoneRef.current = false;
      oauthGoogleProfileSyncInFlightUidRef.current = null;
      localStorage.removeItem('reRideCurrentUser');
      localStorage.removeItem('reRideAccessToken');
      localStorage.removeItem('reRideRefreshToken');
      try {
        localStorage.removeItem('reride_oauth_role');
        localStorage.removeItem('reride_last_role');
      } catch {
        /* ignore */
      }
      localStorage.removeItem('reRideServiceProvider');
      localStorage.removeItem('rememberedCustomerEmail');
      localStorage.removeItem('rememberedSellerEmail');
      clearSupabaseAuthStorage();
      try {
        localStorage.removeItem('reride_wishlist');
        localStorage.removeItem('reride_comparison_list');
      } catch {
        /* ignore */
      }
      resetAuthFetchStateAfterLogout();
      clearRememberMeState();
      setCurrentView(View.HOME);
      setActiveChat(null);
      setComparisonList([]);
      setWishlist([]);
      addToast(t('toast.loggedOut'), 'info');
    }
  }, [addToast, setComparisonList, setWishlist, t]);

  // Listen for userDataUpdated events to sync currentUser state when plan expiry changes
  useEffect(() => {
    const handleUserDataUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ user: User }>;
      if (customEvent.detail?.user) {
        const updatedUser = customEvent.detail.user;
        // Only update if this is the current user
        setCurrentUser(prev => {
          if (prev && prev.email === updatedUser.email) {
            return updatedUser;
          }
          return prev;
        });
        logInfo('✅ User data updated from custom event:', updatedUser.email);
      }
    };

    window.addEventListener('userDataUpdated', handleUserDataUpdated);
    return () => {
      window.removeEventListener('userDataUpdated', handleUserDataUpdated);
    };
  }, []);

  const handleLogin = useCallback((user: User) => {
    // CRITICAL: Validate user object before setting
    if (!user || !user.email || !user.role) {
      logError('❌ Invalid user object in handleLogin:', { 
        hasUser: !!user, 
        hasEmail: !!user?.email, 
        hasRole: !!user?.role 
      });
      addToast(t('toast.loginInvalidUser'), 'error');
      return;
    }

    const rawRole = user.role;
    const trimmed = typeof rawRole === 'string' ? rawRole.trim() : '';
    let normalizedRole: User['role'] | null = null;
    if (['customer', 'seller', 'admin', 'service_provider', 'finance_partner'].includes(trimmed)) {
      normalizedRole = trimmed as User['role'];
    } else if (trimmed === 'service-provider' || trimmed.toLowerCase() === 'provider') {
      normalizedRole = 'service_provider';
    }

    // Ensure role is valid (API / Supabase may return service_provider for provider accounts)
    if (
      !normalizedRole ||
      !['customer', 'seller', 'admin', 'service_provider', 'finance_partner'].includes(normalizedRole)
    ) {
      logError('❌ Invalid role in handleLogin:', user.role);
      addToast(t('toast.loginInvalidRole'), 'error');
      return;
    }

    const userForSession: User = { ...user, role: normalizedRole };

    // Set user first (this is critical - navigate checks currentUser)
    setCurrentUser(userForSession);
    sessionStorage.setItem('currentUser', currentUserForLocalSessionJson(userForSession));
    localStorage.setItem('reRideCurrentUser', currentUserForLocalSessionJson(userForSession));
    try {
      if (
        userForSession.role === 'customer' ||
        userForSession.role === 'seller' ||
        userForSession.role === 'service_provider'
      ) {
        sessionStorage.setItem('reride_last_role', userForSession.role);
      }
    } catch {
      /* ignore */
    }

    // Verify user storage (for debugging production issues).
    // MUST be deferred: running two sessionStorage reads + two JSON.parse calls synchronously
    // on the same tick that fires the post-login re-render adds ~ms of blocking work to an
    // already heavy frame and, on low-RAM Android WebViews, can be enough to trigger the
    // Chromium renderer being killed (manifests as the app "auto-closing" after tapping Sign in).
    const scheduleIdle = (cb: () => void): void => {
      if (typeof window === 'undefined') {
        cb();
        return;
      }
      const ric = (window as unknown as {
        requestIdleCallback?: (fn: () => void, opts?: { timeout?: number }) => number;
      }).requestIdleCallback;
      if (typeof ric === 'function') {
        ric(cb, { timeout: 1500 });
      } else {
        window.setTimeout(cb, 0);
      }
    };
    scheduleIdle(() => {
      try {
        const storedInSession = sessionStorage.getItem('currentUser');
        const storedInLocal = localStorage.getItem('reRideCurrentUser');
        logInfo('✅ User stored after login:', {
          email: userForSession.email,
          role: userForSession.role,
          storedInSessionStorage: !!storedInSession,
          storedInLocalStorage: !!storedInLocal,
          sessionMatches: storedInSession
            ? JSON.parse(storedInSession).email === userForSession.email
            : false,
          localMatches: storedInLocal
            ? JSON.parse(storedInLocal).email === userForSession.email
            : false,
        });
      } catch {
        /* debug-only; never let verification break login */
      }
    });

    const previousViewAtLogin = currentView;

    const applyPostLoginNavigation = (): void => {
      addToast(t('toast.welcomeBack', { name: userForSession.name }), 'success');

      // Navigate based on user role
      // Directly set view since we've already validated the user
      // The navigate function will validate again, but we know the user is valid
      let postLoginView = View.HOME;
      if (userForSession.role === 'admin') {
        postLoginView = View.ADMIN_PANEL;
        setCurrentView(View.ADMIN_PANEL);
      } else if (userForSession.role === 'seller') {
        logDebug('🔄 Setting seller dashboard view after login');
        postLoginView = View.SELLER_DASHBOARD;
        setCurrentView(View.SELLER_DASHBOARD);
      } else if (userForSession.role === 'service_provider') {
        postLoginView = View.CAR_SERVICE_DASHBOARD;
        setCurrentView(View.CAR_SERVICE_DASHBOARD);
        try {
          const loc =
            typeof userForSession.location === 'string' && userForSession.location.trim()
              ? userForSession.location.trim()
              : '';
          const detail = {
            id: userForSession.id,
            name: (userForSession.name && String(userForSession.name).trim()) || 'Service provider',
            email: userForSession.email,
            phone: userForSession.mobile || '',
            city: loc || '',
          };
          window.dispatchEvent(new CustomEvent('reride:service-provider-oauth', { detail }));
        } catch {
          /* ignore */
        }
      } else if (userForSession.role === 'finance_partner') {
        postLoginView = View.HOME;
        setCurrentView(View.HOME);
      } else if (userForSession.role === 'customer') {
        postLoginView = View.HOME;
        setCurrentView(View.HOME);
      } else {
        setCurrentView(View.HOME);
      }

      // Keep React Router URL in sync; otherwise location sync maps /login → LOGIN_PORTAL and overwrites HOME.
      try {
        const pathByRole =
          userForSession.role === 'admin'
            ? '/admin'
            : userForSession.role === 'seller'
              ? '/seller/dashboard'
              : userForSession.role === 'service_provider'
                ? '/car-services/dashboard'
                : userForSession.role === 'finance_partner'
                  ? '/'
                  : '/';
        routerNavigate(pathByRole, {
          state: {
            view: postLoginView,
            previousView: previousViewAtLogin,
            timestamp: Date.now(),
          },
        });
      } catch {
        /* ignore */
      }
    };

    scheduleCapacitorPostLoginUi(applyPostLoginNavigation);
  }, [addToast, currentView, routerNavigate, t]);

  // After Supabase Google OAuth redirect: session exists; sync profile with ReRide API and log in
  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseClient();

    const tryFinishGoogleOAuth = async (session: Session | null) => {
      let pendingRole = sessionStorage.getItem('reride_oauth_role') as
        | 'customer'
        | 'seller'
        | 'service_provider'
        | null;
      if (!pendingRole) {
        try {
          pendingRole = localStorage.getItem('reride_oauth_role') as typeof pendingRole;
        } catch { /* ignore */ }
      }
      if (!pendingRole || !session?.user || googleOAuthSyncDoneRef.current || cancelled) {
        return;
      }
      googleOAuthSyncDoneRef.current = true;
      oauthGoogleProfileSyncInFlightUidRef.current = session.user.id;
      try {
        try {
          sessionStorage.removeItem('reride_oauth_role');
          localStorage.removeItem('reride_oauth_role');
        } catch {
          /* ignore */
        }

        try {
          if (pendingRole === 'service_provider') {
            const result = await syncServiceProviderOAuth(
              session.user as unknown as Record<string, unknown>,
            );
            if (result.success && result.provider) {
              try {
                window.dispatchEvent(
                  new CustomEvent('reride:service-provider-oauth', { detail: result.provider }),
                );
              } catch {
                /* ignore */
              }
            } else {
              googleOAuthSyncDoneRef.current = false;
              addToast(result.reason || t('toast.googleSignInFailed'), 'error');
              await supabase.auth.signOut({ scope: 'local' });
              clearSupabaseAuthStorage();
            }
            return;
          }

          const result = await syncWithBackend(
            session.user as unknown as Record<string, unknown>,
            pendingRole,
            'google',
          );
          if (result.success && result.user) {
            handleLogin(result.user);
          } else {
            googleOAuthSyncDoneRef.current = false;
            addToast(result.reason || t('toast.googleSignInFailed'), 'error');
            await supabase.auth.signOut({ scope: 'local' });
            clearSupabaseAuthStorage();
          }
        } catch (e) {
          googleOAuthSyncDoneRef.current = false;
          logError('Google OAuth backend sync failed:', e);
          addToast(t('toast.googleSignInFailed'), 'error');
          await supabase.auth.signOut({ scope: 'local' });
          clearSupabaseAuthStorage();
        }
      } finally {
        oauthGoogleProfileSyncInFlightUidRef.current = null;
      }
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      void tryFinishGoogleOAuth(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void tryFinishGoogleOAuth(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [handleLogin, addToast, t]);

  useEffect(() => {
    const onNativeOAuthFailed = (e: Event) => {
      const msg = (e as CustomEvent<{ message?: string }>).detail?.message;
      addToast(msg || t('toast.googleSignInFailed'), 'error');
    };
    window.addEventListener('reride:native-oauth-failed', onNativeOAuthFailed);
    return () => window.removeEventListener('reride:native-oauth-failed', onNativeOAuthFailed);
  }, [addToast, t]);

  // Supabase session exists but ReRide profile not in memory — resync (cold start, or PKCE finished after first paint).
  // Subscribes to auth changes so we retry when the session appears (previous one-shot ref blocked this forever).
  useEffect(() => {
    if (currentUser) return;

    const supabase = getSupabaseClient();
    let cancelled = false;

    const restoreFromSupabaseSession = async (session: Session | null) => {
      if (cancelled || currentUserRef.current) return;
      if (!session?.user?.email) return;

      const uid = session.user.id;
      if (oauthGoogleProfileSyncInFlightUidRef.current === uid) return;

      try {
        if (sessionStorage.getItem('reride_oauth_role') || localStorage.getItem('reride_oauth_role')) {
          return;
        }
      } catch {
        /* ignore */
      }

      if (profileRestoreFromSupabaseInFlightRef.current) return;
      profileRestoreFromSupabaseInFlightRef.current = true;
      try {
        const lastStored = sessionStorage.getItem('reride_last_role');
        const meta = session.user.user_metadata as Record<string, unknown> | undefined;
        const prov = (session.user.app_metadata as Record<string, unknown> | undefined)?.provider;
        const isGoogleProvider = prov === 'google';

        let resolved: 'customer' | 'seller' | 'service_provider' | null = null;
        if (lastStored && ['customer', 'seller', 'service_provider'].includes(lastStored)) {
          resolved = lastStored as 'customer' | 'seller' | 'service_provider';
        }
        if (!resolved) {
          const mr = meta?.role;
          if (typeof mr === 'string') {
            const t = mr.trim();
            if (['customer', 'seller', 'service_provider'].includes(t)) {
              resolved = t as 'customer' | 'seller' | 'service_provider';
            }
          }
        }
        if (!resolved) {
          resolved = 'customer';
        }

        if (resolved === 'service_provider') {
          const spResult = await syncServiceProviderOAuth(
            session.user as unknown as Record<string, unknown>,
          );
          if (cancelled || currentUserRef.current) return;
          if (spResult.success && spResult.provider) {
            const p = spResult.provider;
            const emailNorm = String(p.email || session.user.email || '')
              .toLowerCase()
              .trim();
            if (emailNorm) {
              handleLogin({
                id: String(p.id ?? p.uid ?? session.user.id),
                name: String(p.name || 'Service provider'),
                email: emailNorm,
                mobile: String(p.phone ?? (session.user.phone as string) ?? ''),
                role: 'service_provider',
                location:
                  typeof p.city === 'string' && p.city.trim() && p.city.trim().toLowerCase() !== 'pending setup'
                    ? p.city.trim()
                    : '',
                status: 'active',
                createdAt: new Date().toISOString(),
                authProvider: isGoogleProvider ? 'google' : session.user.phone ? 'phone' : 'email',
                firebaseUid: session.user.id,
              });
            }
          }
          return;
        }

        const authProvider: 'google' | 'phone' | 'email' =
          isGoogleProvider ? 'google' : session.user.phone ? 'phone' : 'email';

        const result = await syncWithBackend(
          session.user as unknown as Record<string, unknown>,
          resolved,
          authProvider,
        );
        if (result.success && result.user) {
          handleLogin(result.user);
        }
      } catch (e) {
        logDebug('Supabase session restore skipped:', e);
      } finally {
        profileRestoreFromSupabaseInFlightRef.current = false;
      }
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      void restoreFromSupabaseSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void restoreFromSupabaseSession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [currentUser, handleLogin]);

  const handleRegister = useCallback((user: User) => {
    // CRITICAL: Validate user object before setting
    if (!user || !user.email || !user.role) {
      logError('❌ Invalid user object in handleRegister:', { 
        hasUser: !!user, 
        hasEmail: !!user?.email, 
        hasRole: !!user?.role 
      });
      addToast(t('toast.registerInvalidUser'), 'error');
      return;
    }
    
    // Ensure role is valid
    if (!['customer', 'seller', 'admin', 'service_provider', 'finance_partner'].includes(user.role)) {
      logError('❌ Invalid role in handleRegister:', user.role);
      addToast(t('toast.registerInvalidRole'), 'error');
      return;
    }
    
    // Set user first (this is critical - navigate checks currentUser)
    setCurrentUser(user);
    sessionStorage.setItem('currentUser', currentUserForLocalSessionJson(user));
    localStorage.setItem('reRideCurrentUser', currentUserForLocalSessionJson(user));
    
    // Verify user storage (for debugging production issues)
    const storedInSession = sessionStorage.getItem('currentUser');
    const storedInLocal = localStorage.getItem('reRideCurrentUser');
    logInfo('✅ User stored after registration:', {
      email: user.email,
      role: user.role,
      storedInSessionStorage: !!storedInSession,
      storedInLocalStorage: !!storedInLocal,
      sessionMatches: storedInSession ? JSON.parse(storedInSession).email === user.email : false,
      localMatches: storedInLocal ? JSON.parse(storedInLocal).email === user.email : false
    });

    const applyPostRegisterNavigation = (): void => {
      addToast(t('toast.welcomeNewUser', { name: user.name }), 'success');

      // Navigate based on user role
      if (user.role === 'admin') {
        setCurrentView(View.ADMIN_PANEL);
      } else if (user.role === 'seller') {
        logDebug('🔄 Setting seller dashboard view after registration');
        setCurrentView(View.SELLER_DASHBOARD);
      } else if (user.role === 'service_provider') {
        setCurrentView(View.CAR_SERVICE_DASHBOARD);
        try {
          const loc =
            typeof user.location === 'string' && user.location.trim() ? user.location.trim() : '';
          window.dispatchEvent(
            new CustomEvent('reride:service-provider-oauth', {
              detail: {
                id: user.id,
                name: (user.name && String(user.name).trim()) || 'Service provider',
                email: user.email,
                phone: user.mobile || '',
                city: loc || '',
              },
            }),
          );
        } catch {
          /* ignore */
        }
      } else if (user.role === 'customer') {
        setCurrentView(View.HOME);
      } else {
        setCurrentView(View.HOME);
      }
    };

    scheduleCapacitorPostLoginUi(applyPostRegisterNavigation);
  }, [addToast, t]);

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
        console.warn(`⚠️ Failed to sync ${cacheKey}:`, error);
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
      console.warn('⚠️ Failed to sync full users caches:', error);
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
        console.warn(`⚠️ Failed to sync ${cacheKey}:`, error);
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
      console.warn('⚠️ Failed to sync selectedVehicle cache:', error);
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

    setUserLocationState(prev => (prev === nextLocation ? prev : nextLocation));
    setSelectedCityState(prev => (prev === nextLocation ? prev : nextLocation));

    try {
      localStorage.setItem('reRideUserLocation', nextLocation);
    } catch (error) {
      logWarn('Failed to persist location selection:', error);
    }

    try {
      localStorage.setItem('reRideSelectedCity', nextLocation);
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

  const navigate = useCallback(
    (
      view: View,
      params?: { city?: string; sellerEmail?: string; detailVehicle?: Vehicle; unblockPopstateSync?: boolean }
    ) => {
    const detailVehicleParam = params?.detailVehicle;
    if (params?.unblockPopstateSync) {
      isHandlingPopStateRef.current = false;
    }
    if (view === View.DETAIL) {
      leavingDetailUrlCatchUpRef.current = false;
    }
    // Don't navigate during popstate sync unless opening a different vehicle (Similar Vehicles on DETAIL),
    // or opening a public seller profile (must not be blocked — common right after opening a listing on mobile).
    if (isHandlingPopStateRef.current) {
      if (view === View.SELLER_PROFILE) {
        // allow
      } else if (view !== View.DETAIL) {
        // #region agent log
        agentNavDebugLog({
          hypothesisId: 'H2',
          message: 'navigate blocked: isHandlingPopState non-detail',
          location: 'AppProvider.tsx:navigate:blockPopstate',
          view,
          currentView,
          unblockPopstateSync: !!params?.unblockPopstateSync,
        });
        // #endregion
        logDebug('⏸️ Navigation skipped - handling popstate event');
        return;
      } else {
        try {
          let targetId = NaN;
          const raw = sessionStorage.getItem('selectedVehicle');
          if (raw) {
            const v = JSON.parse(raw) as { id?: number | string };
            targetId = v?.id != null ? Number(v.id) : NaN;
          }
          if (!Number.isFinite(targetId) && detailVehicleParam) {
            targetId = Number(detailVehicleParam.id);
          }
          if (!Number.isFinite(targetId)) {
            logDebug('⏸️ Navigation skipped - handling popstate event');
            return;
          }
          const pathNow = getAppPathFromRouter(
            typeof window !== 'undefined'
              ? { pathname: window.location.pathname, hash: window.location.hash }
              : { pathname: '/' },
          );
          const m = pathNow.match(/\/vehicle\/([^/?#]+)/);
          const pathId = m ? Number(m[1]) : NaN;
          if (Number.isFinite(pathId) && vehicleIdsEqual(pathId, targetId)) {
            logDebug('⏸️ Navigation skipped - handling popstate event');
            return;
          }
        } catch {
          logDebug('⏸️ Navigation skipped - handling popstate event');
          return;
        }
      }
    }
    
    // Prevent infinite redirect loops by checking if we're already on the target view
    // EXCEPTION: Allow navigation to DETAIL view even if already on DETAIL (different vehicle)
    // EXCEPTION: Allow SELLER_PROFILE when switching to a different dealer (params.sellerEmail)
    if (view === currentView && !params?.city && view !== View.DETAIL && !params?.unblockPopstateSync) {
      if (view === View.SELLER_PROFILE && params?.sellerEmail) {
        const norm = params.sellerEmail.toLowerCase().trim();
        const cur = publicSellerProfile?.email?.toLowerCase().trim();
        if (norm === cur) {
          return;
        }
      } else {
        return;
      }
    }

    if (
      view !== View.DETAIL &&
      view !== View.SELLER_PROFILE &&
      currentView === View.DETAIL
    ) {
      try {
        sessionStorage.removeItem(RERIDE_DETAIL_ENTRY_SOURCE_KEY);
      } catch {
        /* ignore */
      }
    }

    // Update previous view before changing current view
    setPreviousView(currentView);

    // Fixed: Preserve selectedVehicle when navigating TO DETAIL view or between DETAIL and SELLER_PROFILE
    // Calculate this early to avoid TypeScript type narrowing issues
    // Preserve if: navigating TO detail (covers both initial navigation and from seller profile),
    // or navigating FROM detail TO seller profile
    const preserveSelectedVehicle = view === View.DETAIL || 
      (view === View.SELLER_PROFILE && currentView === View.DETAIL);

    const isNavigatingAwayFromSellerProfile = currentView === View.SELLER_PROFILE && view !== View.SELLER_PROFILE;
    if (isNavigatingAwayFromSellerProfile) { 
      // Clear public seller profile when navigating away
      // Don't modify history here - let the normal navigation flow handle it
      setPublicSellerProfile(null); 
    }
    setInitialSearchQuery('');
    
    // CRITICAL FIX: When navigating to DETAIL, ensure vehicle is available
    // Check sessionStorage FIRST (it's synchronous and always up-to-date)
    // React state updates are async, so sessionStorage is the source of truth
    if (view === View.DETAIL) {
      let vehicleFound = false;
      let vehicleToUse: Vehicle | null = null;

      try {
        const storedVehicle = sessionStorage.getItem('selectedVehicle');
        if (storedVehicle) {
          try {
            vehicleToUse = JSON.parse(storedVehicle) as Vehicle;
            const storedIdNum = Number((vehicleToUse as Vehicle).id as unknown);
            if (vehicleToUse != null && Number.isFinite(storedIdNum)) {
              vehicleFound = true;
              setSelectedVehicle(vehicleToUse);
              if (process.env.NODE_ENV === 'development') {
                console.log(
                  '🔧 Restored vehicle from sessionStorage during navigation:',
                  vehicleToUse.id,
                  vehicleToUse.make,
                  vehicleToUse.model
                );
              }
            }
          } catch (parseError) {
            console.error('❌ Failed to parse vehicle from sessionStorage:', parseError);
            sessionStorage.removeItem('selectedVehicle');
          }
        }

        // Same-tick open from selectVehicle: sessionStorage may fail (private mode) and
        // selectedVehicle in this closure can still be stale — use explicit param.
        if (!vehicleFound && detailVehicleParam) {
          const paramId = Number(detailVehicleParam.id);
          if (Number.isFinite(paramId)) {
            vehicleToUse = detailVehicleParam;
            vehicleFound = true;
            setSelectedVehicle(detailVehicleParam);
            try {
              sessionStorage.setItem('selectedVehicle', stringifyVehicleForSession(detailVehicleParam));
              if (process.env.NODE_ENV === 'development') {
                console.log(
                  '🔧 Applied detailVehicle param during navigation:',
                  detailVehicleParam.id
                );
              }
            } catch (error) {
              console.warn('⚠️ Failed to sync detail vehicle to sessionStorage:', error);
            }
          }
        }

        if (!vehicleFound && selectedVehicle && selectedVehicle.id) {
          vehicleToUse = selectedVehicle;
          vehicleFound = true;
          try {
            sessionStorage.setItem('selectedVehicle', stringifyVehicleForSession(selectedVehicle));
            if (process.env.NODE_ENV === 'development') {
              console.log('🔧 Synced vehicle from state to sessionStorage:', selectedVehicle.id);
            }
          } catch (error) {
            console.warn('⚠️ Failed to sync vehicle to sessionStorage:', error);
          }
        }

        if (!vehicleFound && process.env.NODE_ENV === 'development') {
          console.warn(
            '⚠️ Attempted to navigate to DETAIL view without a vehicle in sessionStorage, params, or state'
          );
          console.warn('⚠️ Current selectedVehicle:', selectedVehicle);
          console.warn('⚠️ SessionStorage value:', sessionStorage.getItem('selectedVehicle'));
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Error checking for vehicle during navigation:', error);
        }
      }
    }
    
    // Only clear selectedVehicle if we're NOT preserving it
    // preserveSelectedVehicle is already true when navigating to DETAIL view
    if (view === View.DETAIL) {
      expectingVehicleDetailRouteRef.current = true;
    } else if (!preserveSelectedVehicle) {
      expectingVehicleDetailRouteRef.current = false;
      setSelectedVehicle(null);
      try {
        sessionStorage.removeItem('selectedVehicle');
      } catch {
        /* ignore */
      }
    }
    
    if (view === View.USED_CARS && currentView !== View.HOME) setSelectedCategory('ALL');
    if (view === View.CITY_LANDING && params?.city) {
      updateSelectedCity(params.city);
    }
    if (view === View.USED_CARS) {
      // Explicitly check if city parameter exists and is not empty
      if (params && params.city !== undefined && params.city !== '') {
        // Set city filter when city is provided
        if (process.env.NODE_ENV === 'development') {
          console.log('🔵 AppProvider: Setting city filter to:', params.city);
        }
        updateSelectedCity(params.city);
      } else {
        // Clear city filter when no city parameter or empty string (View all cars)
        if (process.env.NODE_ENV === 'development') {
          console.log('🔵 AppProvider: Clearing city filter');
        }
        updateSelectedCity('');
      }
    }
    
    // Prevent redirect loops: Only redirect if not already on login page
    // CRITICAL: Enhanced validation for seller dashboard access
    if (view === View.SELLER_DASHBOARD) {
      if (!currentUser) {
        console.warn('⚠️ Attempted to access seller dashboard without logged-in user');
        if (currentView !== View.LOGIN_PORTAL && currentView !== View.SELLER_LOGIN) {
          setCurrentView(View.LOGIN_PORTAL);
        }
        return;
      }
      
      // Validate user has required fields
      if (!currentUser.email || !currentUser.role) {
        console.error('❌ Invalid user object - missing email or role:', { 
          hasEmail: !!currentUser.email, 
          hasRole: !!currentUser.role 
        });
        if (currentView !== View.LOGIN_PORTAL && currentView !== View.SELLER_LOGIN) {
          setCurrentView(View.LOGIN_PORTAL);
        }
        return;
      }
      
      // Check role specifically
      if (currentUser.role !== 'seller') {
        console.warn('⚠️ Attempted to access seller dashboard with role:', currentUser.role);
        if (currentView !== View.LOGIN_PORTAL && currentView !== View.SELLER_LOGIN) {
          setCurrentView(View.LOGIN_PORTAL);
        }
        return;
      }
      
      // All validation passed - navigate to seller dashboard
      console.log('✅ Navigating to seller dashboard');
      setCurrentView(View.SELLER_DASHBOARD);
    } else if (view === View.ADMIN_PANEL && !isAdminUserRole(currentUser?.role)) {
      if (currentView !== View.ADMIN_LOGIN) {
        setCurrentView(View.ADMIN_LOGIN);
      }
    } else if ((view === View.PROFILE || view === View.INBOX) && !currentUser) {
      if (currentView !== View.LOGIN_PORTAL) {
        setCurrentView(View.LOGIN_PORTAL);
      }
    } else {
      // For all other views including DETAIL, set the current view
      // DETAIL view will handle showing error if vehicle is missing
      if (process.env.NODE_ENV === 'development' && view === View.DETAIL) {
        console.log('🎯 Setting currentView to DETAIL');
      }
      setCurrentView(view);
    }

    // Update URL via React Router (replaces manual history.pushState)
    try {
      let newPath = '/';

      // View-to-path mapping
      const viewPathMap: Record<string, string> = {
        [View.HOME]: '/',
        [View.USED_CARS]: '/used-cars',
        [View.CAR_SERVICES]: '/car-services',
        [View.SERVICE_DETAIL]: '/car-services/detail',
        [View.CAR_SERVICE_LOGIN]: '/car-services/login',
        [View.CAR_SERVICE_DASHBOARD]: '/car-services/dashboard',
        [View.SERVICE_CART]: '/car-services/cart',
        [View.RENTAL]: '/rental',
        [View.DEALER_PROFILES]: '/dealers',
        [View.SELLER_DASHBOARD]: '/seller/dashboard',
        [View.ADMIN_PANEL]: '/admin',
        [View.ADMIN_LOGIN]: '/admin/login',
        [View.LOGIN_PORTAL]: '/login',
        [View.CUSTOMER_LOGIN]: '/login',
        [View.SELLER_LOGIN]: '/login',
        [View.COMPARISON]: '/compare',
        [View.WISHLIST]: '/wishlist',
        [View.PROFILE]: '/profile',
        [View.FORGOT_PASSWORD]: '/forgot-password',
        [View.INBOX]: '/inbox',
        [View.PRICING]: '/pricing',
        [View.SUPPORT]: '/support',
        [View.ABOUT_US]: '/about-us',
        [View.FAQ]: '/faq',
        [View.PRIVACY_POLICY]: '/privacy-policy',
        [View.TERMS_OF_SERVICE]: '/terms-of-service',
        [View.SAFETY_CENTER]: '/safety-center',
        [View.BUYER_DASHBOARD]: '/customer/dashboard',
        [View.SELL_CAR]: '/sell-car',
        [View.SELL_CAR_ADMIN]: '/admin/sell-car',
        [View.NOTIFICATIONS_CENTER]: '/notifications',
      };

      // Handle dynamic paths
      if (view === View.DETAIL) {
        // Prefer sessionStorage for URL: selectVehicle() writes there synchronously then calls navigate(),
        // while selectedVehicle React state is still the previous listing (stale closure) — otherwise
        // /vehicle/:id and router state stay on the old id and Similar Vehicles clicks appear to do nothing.
        let vehicleForPath: Vehicle | null = null;
        try {
          const stored = sessionStorage.getItem('selectedVehicle');
          if (stored) {
            const parsed = JSON.parse(stored) as Vehicle;
            if (parsed && parsed.id != null && String(parsed.id).trim() !== '') vehicleForPath = parsed;
          }
        } catch {
          /* ignore */
        }
        if (!vehicleForPath?.id && detailVehicleParam) {
          const n = Number(detailVehicleParam.id);
          if (Number.isFinite(n)) vehicleForPath = detailVehicleParam;
        }
        if (!vehicleForPath?.id && selectedVehicle?.id != null) {
          vehicleForPath = selectedVehicle;
        }
        newPath = vehicleForPath?.id != null ? `/vehicle/${vehicleForPath.id}` : '/vehicle';
      } else if (view === View.SELLER_PROFILE) {
        const emailForPath = (params?.sellerEmail ?? publicSellerProfile?.email ?? '').trim();
        newPath = emailForPath
          ? `/seller/${encodeURIComponent(emailForPath)}`
          : '/seller';
      } else if (view === View.CITY_LANDING && params?.city) {
        newPath = `/city/${encodeURIComponent(params.city.toLowerCase().replace(/\s+/g, '-'))}`;
      } else {
        newPath = viewPathMap[view] || '/';
      }

      // Use React Router navigate instead of manual history.pushState
      let detailSelectedId: number | undefined = undefined;
      if (view === View.DETAIL) {
        try {
          const raw = sessionStorage.getItem('selectedVehicle');
          if (raw) {
            const v = JSON.parse(raw) as { id?: number | string };
            const n = v?.id != null ? Number(v.id) : NaN;
            if (Number.isFinite(n)) detailSelectedId = n;
          }
        } catch {
          /* ignore */
        }
        if ((detailSelectedId == null || !Number.isFinite(detailSelectedId)) && detailVehicleParam) {
          const n = Number(detailVehicleParam.id);
          if (Number.isFinite(n)) detailSelectedId = n;
        }
        if ((detailSelectedId == null || !Number.isFinite(detailSelectedId)) && selectedVehicle?.id != null) {
          const n = Number(selectedVehicle.id);
          if (Number.isFinite(n)) detailSelectedId = n;
        }
      }
      leavingDetailUrlCatchUpRef.current =
        currentView === View.DETAIL && view !== View.DETAIL && view !== View.SELLER_PROFILE;
      // #region agent log
      agentNavDebugLog({
        hypothesisId: 'H5',
        message: 'navigate routerNavigate',
        location: 'AppProvider.tsx:navigate:routerNavigate',
        view,
        fromView: currentView,
        newPath,
        leavingDetailCatchUp: leavingDetailUrlCatchUpRef.current,
        unblockPopstateSync: !!params?.unblockPopstateSync,
      });
      // #endregion
      routerNavigate(newPath, {
        state: {
          view,
          previousView: currentView,
          timestamp: Date.now(),
          selectedVehicleId: detailSelectedId,
        },
      });
    } catch {
      // Fallback: at minimum the currentView state is already updated
    }
  }, [currentView, currentUser, previousView, selectedVehicle, publicSellerProfile, updateSelectedCity, setPreviousView, setSelectedVehicle, setPublicSellerProfile, setInitialSearchQuery, setSelectedCategory, setCurrentView, routerNavigate]);

  // Go back to the screen that opened the current view: prefer session snapshot from selectVehicle (reliable on HashRouter),
  // then router state / in-memory previousView. Avoid routerNavigate(-1): history depth often makes -1 wrong.
  const goBack = useCallback(
    (fallbackView?: View) => {
      // User-initiated back must never be dropped: navigate() returns early while isHandlingPopStateRef is true (location sync).
      isHandlingPopStateRef.current = false;
      const routerState = location?.state as HistoryState | null | undefined;
      const detailEntrySource = currentView === View.DETAIL ? readDetailEntrySourceView() : undefined;
      let target: View | undefined;
      if (detailEntrySource) {
        target = detailEntrySource;
      } else if (routerState?.previousView && routerState.previousView !== currentView) {
        target = routerState.previousView;
      } else if (previousView && previousView !== currentView) {
        target = previousView;
      }
      const backOpts = { unblockPopstateSync: true } as const;
      // #region agent log
      agentNavDebugLog({
        hypothesisId: 'H1',
        message: 'goBack resolved',
        location: 'AppProvider.tsx:goBack',
        runId: 'post-fix',
        currentView,
        previousViewMem: previousView,
        routerPreviousView: routerState?.previousView,
        detailEntrySource: detailEntrySource ?? null,
        chosenTarget: target ?? null,
        fallbackView: fallbackView ?? null,
        branch: detailEntrySource
          ? 'sessionEntry'
          : target
            ? 'routerOrMem'
            : fallbackView
              ? 'fallback'
              : 'home',
      });
      // #endregion
      if (target) {
        navigate(target, backOpts);
      } else if (fallbackView) {
        navigate(fallbackView, backOpts);
      } else {
        navigate(View.HOME, backOpts);
      }
    },
    [location.state, location.key, previousView, currentView, navigate],
  );

  const refreshVehicles = useCallback(async () => {
    const isAdmin = currentUser?.role === 'admin';
    try {
      const list = await dataService.getVehicles(isAdmin, true);
      const next = Array.isArray(list) ? list : [];
      setVehicles((prev) => mergeVehicleCatalog(prev, next, !!isAdmin));
      setVehiclesCatalogReady(true);
      if (list.length > 0) {
        addToast(t('toast.loadedVehiclesCount', { count: list.length }), 'success');
      }
    } catch (err) {
      setVehiclesCatalogReady(true);
      logWarn('Refresh vehicles failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      const is503OrSupabase = (err as any)?.status === 503 || (err as any)?.code === 503 || /supabase|503|service temporarily unavailable/i.test(msg);
      const toastMsg = is503OrSupabase
        ? t('toast.serviceUnavailableAdmin')
        : (msg && msg.length < 120 ? msg : t('toast.vehiclesLoadFailedShort'));
      addToast(toastMsg, 'error');
    }
  }, [currentUser?.role, setVehicles, addToast, t]);

  // Auto-navigate to appropriate dashboard after login/registration
  // This ensures the view is set correctly even if state updates are async
  useEffect(() => {
    if (currentUser && currentUser.role) {
      // Only auto-navigate if we're on a login/register page
      const loginViews = [View.LOGIN_PORTAL, View.SELLER_LOGIN, View.CUSTOMER_LOGIN, View.ADMIN_LOGIN];
      if (loginViews.includes(currentView)) {
        if (currentUser.role === 'seller' && currentView !== View.SELLER_DASHBOARD) {
          console.log('🔄 Auto-navigating seller to dashboard from login view');
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

  // Map initial path once on mount (React Router pathname — correct for HashRouter + BrowserRouter).
  // NEVER depend on selectedVehicle: re-running reset currentView from URL while pathname lags
  // navigation sends users back to HOME instead of vehicle detail.
  useEffect(() => {
    try {
      const path = getAppPathFromRouter(location ?? { pathname: '/' });
      const routerState = location?.state as HistoryState | null;
      setCurrentView(resolveViewFromPathAndState(path, routerState));
    } catch (error) {
      logDebug('Failed initial URL → view sync:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time sync; location sync effect handles later navigations
  }, []);

  // Sync React Router location changes with app view state
  // This replaces the manual popstate handler — React Router manages browser history
  useEffect(() => {
    const path = getAppPathFromRouter(location ?? { pathname: '/' });
    const routerState = location?.state as HistoryState | null;
    if (!path.includes('/vehicle/')) {
      leavingDetailUrlCatchUpRef.current = false;
    }
    let newView: View;
    try {
      newView = resolveViewFromPathAndState(path, routerState);
    } catch (_) {
      newView = View.HOME;
    }

    // Logged-in user on /login: do not force LOGIN_PORTAL over post-login view (handleLogin may lag URL update).
    const loginOnlyViews = new Set<View>([
      View.LOGIN_PORTAL,
      View.CUSTOMER_LOGIN,
      View.SELLER_LOGIN,
    ]);
    const viewNow = currentViewRef.current;

    if (
      leavingDetailUrlCatchUpRef.current &&
      path.includes('/vehicle/') &&
      newView === View.DETAIL &&
      viewNow !== View.DETAIL
    ) {
      // #region agent log
      agentNavDebugLog({
        hypothesisId: 'H3',
        message: 'locationSync early return leavingDetail catch-up',
        location: 'AppProvider.tsx:locationSync:leavingDetailGuard',
        path,
        newView,
        viewNow,
        routerStateView: routerState?.view,
        pathToViewRaw: pathToView(path),
      });
      // #endregion
      return;
    }

    if (
      currentUser &&
      loginOnlyViews.has(newView) &&
      !loginOnlyViews.has(viewNow)
    ) {
      return;
    }

    // HashRouter / Android WebView: location can briefly stay "/" while currentView is already DETAIL
    // after selectVehicle → navigate(DETAIL). Do not clobber detail with HOME in that window.
    // Do not require sessionStorage: storage may be unavailable while selectedVehicle lives in React state only.
    if (
      expectingVehicleDetailRouteRef.current &&
      newView === View.HOME &&
      (path === '/' || path === '') &&
      viewNow === View.DETAIL
    ) {
      return;
    }

    // Already on vehicle detail but URL id changed (e.g. Similar Vehicles / deep link) — must sync state.
    // Previously we returned here, so selectedVehicle could stay on the old listing while the URL updated.
    if (newView === viewNow && newView === View.DETAIL && path.includes('/vehicle/')) {
      const idMatch = path.match(/\/vehicle\/([^/?#]+)/);
      if (idMatch) {
        const parsedId = Number(idMatch[1]);
        if (Number.isFinite(parsedId) && !vehicleIdsEqual(selectedVehicle?.id, parsedId)) {
          const found = vehicles.find((v) => vehicleIdsEqual(v.id, parsedId));
          if (found) {
            setSelectedVehicle(found);
            try {
              sessionStorage.setItem('selectedVehicle', stringifyVehicleForSession(found));
            } catch {
              /* ignore */
            }
          } else {
            try {
              const stored = sessionStorage.getItem('selectedVehicle');
              if (stored) {
                const v = JSON.parse(stored) as Vehicle;
                if (vehicleIdsEqual(v?.id, parsedId)) setSelectedVehicle(v);
              }
            } catch {
              /* ignore */
            }
          }
        }
      }
      return;
    }

    // Still on seller profile but URL switched to another dealer — view enum unchanged, so hydrate profile
    if (newView === viewNow && newView === View.SELLER_PROFILE) {
      const email = parseSellerEmailFromPath(path);
      if (email) {
        setPublicSellerProfile((prev) => {
          if (prev?.email?.toLowerCase().trim() === email) return prev;
          const match = users.find((u) => u?.email && u.email.toLowerCase().trim() === email);
          return (
            match ??
            ({
              email,
              name: 'Seller',
              mobile: '',
              role: 'seller',
              location: '',
              status: 'active',
              createdAt: new Date().toISOString(),
            } as User)
          );
        });
      }
      return;
    }

    // Prevent loops: only update if the view actually changed
    if (newView === viewNow) return;

    // #region agent log
    agentNavDebugLog({
      hypothesisId: 'H4',
      message: 'locationSync applying newView',
      location: 'AppProvider.tsx:locationSync:apply',
      path,
      pathToViewOnly: pathToView(path),
      newView,
      viewNow,
      routerStateView: routerState?.view,
      leavingCatchUp: leavingDetailUrlCatchUpRef.current,
    });
    // #endregion

    isHandlingPopStateRef.current = true;

    // Restore previous view from router state
    if (routerState?.previousView) {
      setPreviousView(routerState.previousView);
    }

    // Restore selectedVehicle for DETAIL view (catalog + sessionStorage — fixes stale router state after selectVehicle)
    if (newView === View.DETAIL) {
      // Only clear the "expecting detail route" guard once the router path actually shows /vehicle/:id.
      // Clearing too early allowed a follow-up tick with pathname "/" + newView HOME to wipe selectedVehicle
      // and bounce the UI back from DETAIL → HOME (Android WebView / HashRouter).
      if (path.includes('/vehicle/')) {
        expectingVehicleDetailRouteRef.current = false;
      }
      const trySessionStorageForPath = () => {
        try {
          const idMatch = path.match(/\/vehicle\/([^/?#]+)/);
          if (!idMatch) return;
          const parsedId = Number(idMatch[1]);
          if (!Number.isFinite(parsedId)) return;
          const stored = sessionStorage.getItem('selectedVehicle');
          if (!stored) return;
          const v = JSON.parse(stored) as { id?: number | string };
          if (vehicleIdsEqual(v?.id, parsedId)) setSelectedVehicle(v as Vehicle);
        } catch {
          /* ignore */
        }
      };

      const vehicleId = routerState?.selectedVehicleId;
      if (vehicleId != null && Number.isFinite(Number(vehicleId))) {
        const numericId = Number(vehicleId);
        const vehicleToRestore = vehicles.find((v) => vehicleIdsEqual(v.id, numericId));
        if (vehicleToRestore) setSelectedVehicle(vehicleToRestore);
        else trySessionStorageForPath();
      } else if (path.includes('/vehicle/')) {
        const idMatch = path.match(/\/vehicle\/([^/?#]+)/);
        if (idMatch) {
          const parsedId = Number(idMatch[1]);
          if (Number.isFinite(parsedId)) {
            const found = vehicles.find((v) => vehicleIdsEqual(v.id, parsedId));
            if (found) setSelectedVehicle(found);
            else trySessionStorageForPath();
          }
        }
      }
    } else {
      setSelectedVehicle(null);
    }

    // Clear seller profile when navigating away
    if (newView !== View.SELLER_PROFILE) {
      setPublicSellerProfile(null);
    } else {
      const email = parseSellerEmailFromPath(path);
      if (email) {
        setPublicSellerProfile((prev) => {
          if (prev?.email?.toLowerCase().trim() === email) return prev;
          const match = users.find((u) => u?.email && u.email.toLowerCase().trim() === email);
          return (
            match ??
            ({
              email,
              name: 'Seller',
              mobile: '',
              role: 'seller',
              location: '',
              status: 'active',
              createdAt: new Date().toISOString(),
            } as User)
          );
        });
      }
    }

    setCurrentView(newView);

    setTimeout(() => {
      isHandlingPopStateRef.current = false;
    }, 100);
    // Do not list currentView in deps: when navigate() sets view before HashRouter updates the path,
    // an effect run keyed on currentView would read the old URL and reset view (e.g. INBOX → dashboard).
  }, [
    location.pathname,
    location.hash,
    location.key,
    currentUser,
    vehicles,
    users,
    selectedVehicle?.id,
  ]);

  // When the catalog finishes loading, resolve /vehicle/:id if the list sync effect ran too early
  useEffect(() => {
    if (currentView !== View.DETAIL) return;
    const path = getAppPathFromRouter(location ?? { pathname: '/' });
    const m = path.match(/\/vehicle\/([^/?#]+)/);
    if (!m) return;
    const id = Number(m[1]);
    if (!Number.isFinite(id)) return;
    if (vehicleIdsEqual(selectedVehicle?.id, id)) return;
    const found = vehicles.find((v) => vehicleIdsEqual(v.id, id));
    if (found) {
      setSelectedVehicle(found);
      return;
    }
    try {
      const raw = sessionStorage.getItem('selectedVehicle');
      if (!raw) return;
      const v = JSON.parse(raw) as Vehicle;
      if (vehicleIdsEqual(v?.id, id)) setSelectedVehicle(v);
    } catch {
      /* ignore */
    }
  }, [currentView, location?.pathname, location?.hash, vehicles, selectedVehicle?.id]);

  // CRITICAL: Listen for force loading completion event (safety mechanism)
  useEffect(() => {
    const handleForceLoadingComplete = () => {
      console.warn('⚠️ Force loading complete event received, clearing loading state');
      setIsLoading(false);
      // Removed toast notification - no longer needed since we show cached data immediately
    };

    window.addEventListener('forceLoadingComplete', handleForceLoadingComplete);
    
    return () => {
      window.removeEventListener('forceLoadingComplete', handleForceLoadingComplete);
    };
  }, []); // Removed addToast dependency

  // CRITICAL FIX: Set loading to false immediately on mount to allow UI to render
  // Data will load in background and update the UI when ready
  useEffect(() => {
    // Set loading to false immediately so UI can render
    // This prevents the app from being stuck in loading state
    setIsLoading(false);
  }, []); // Run once on mount

  // Load initial data with instant cache display and background refresh
  useEffect(() => {
    let isMounted = true;
    const isNativeWebView = isCapacitorNative();
    const maxNativeVehicleCacheChars = 2_000_000; // Must match DataService limit so cache isn't deleted after being written
    
    const loadInitialData = async () => {
      const markVehiclesCatalogReady = () => {
        if (isMounted) setVehiclesCatalogReady(true);
      };

      try {
        let hasCachedData = false;
        
        // PERFORMANCE: Batch localStorage reads for better performance
        // STEP 1: Load all cached data IMMEDIATELY (synchronous, instant)
        const cacheKey = 'reRideVehicles_prod';
        try {
          // Batch read all localStorage items at once
          const cachedVehiclesJson = localStorage.getItem(cacheKey);
          const cachedUsersJson = localStorage.getItem('reRideUsers_prod') || localStorage.getItem('reRideUsers');
          
          // Parse vehicles cache
          if (cachedVehiclesJson) {
            if (isNativeWebView && cachedVehiclesJson.length > maxNativeVehicleCacheChars) {
              try {
                localStorage.removeItem(cacheKey);
              } catch {
                // Ignore storage failures; we'll simply skip parsing this cache entry.
              }
              logWarn(
                `⚠️ Skipped oversized native vehicle cache at startup (${cachedVehiclesJson.length} chars)`
              );
            } else {
              const cachedVehicles = JSON.parse(cachedVehiclesJson);
              if (Array.isArray(cachedVehicles) && cachedVehicles.length > 0) {
                // Show cached vehicles INSTANTLY - don't wait for API
                setVehicles(cachedVehicles);
                setVehiclesCatalogReady(true);
                // PERFORMANCE: Recommendations are now computed via useMemo, no need to set
                setIsLoading(false); // Stop loading immediately
                hasCachedData = true;
                logInfo(`✅ Instantly loaded ${cachedVehicles.length} cached vehicles`);
              }
            }
          }
          
          // Parse users cache
          if (cachedUsersJson) {
            const cachedUsers = JSON.parse(cachedUsersJson);
            if (Array.isArray(cachedUsers) && cachedUsers.length > 0) {
              setUsers(cachedUsers);
              logInfo(`✅ Instantly loaded ${cachedUsers.length} cached users`);
            } else {
              logWarn('⚠️ Cached users data exists but is empty or invalid');
            }
          } else {
            logDebug('ℹ️ No cached users found in localStorage');
          }
          
          // Load cached conversations (for admin panel)
          const cachedConversations = getConversations();
          if (cachedConversations && cachedConversations.length > 0 && isMounted) {
            setConversations(cachedConversations);
            logInfo(`✅ Instantly loaded ${cachedConversations.length} cached conversations`);
          }
        } catch (cacheError) {
          logWarn('Failed to load cached data:', cacheError);
        }
        
        // STEP 3: Fetch fresh data from API in background (non-blocking)
        // This updates the cache and UI silently
        // PERFORMANCE: Extract role from currentUser at effect start to avoid dependency on entire object
        // Read from localStorage to avoid dependency on currentUser state (which may not be set yet on mount)
        let userRole: string | undefined;
        try {
          const savedUser = localStorage.getItem('reRideCurrentUser');
          if (savedUser) {
            const user = JSON.parse(savedUser);
            userRole = user?.role;
          }
        } catch (error) {
          logDebug('Failed to read user role from localStorage (non-critical):', error);
        }
        // Fallback to currentUser if localStorage doesn't have it (shouldn't happen, but safe)
        const isAdmin = (userRole || currentUser?.role) === 'admin';
        
        // AUTH: Ensure we have an access token before starting any production API calls.
        // Without this, `dataService` may run with missing `reRideAccessToken` and fail the first requests.
        if (typeof window !== 'undefined' && !isDevelopmentEnvironment()) {
          try {
            const hasAccessToken = !!getBrowserAccessTokenForApi();

            if (!hasAccessToken && hasLikelyRefreshSource()) {
              // Hard timeout so we don't block rendering too long.
              await Promise.race([
                refreshAuthToken(),
                new Promise((resolve) => setTimeout(resolve, 2500)),
              ]);
            }
          } catch (error) {
            logWarn('⚠️ Auth rehydration failed (non-critical):', error);
          }
        }
        
        // Keep UI responsive, but do not treat slow responses as empty data.
        const loadWithTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
          return Promise.race([
            promise,
            new Promise<null>((resolve) => {
              setTimeout(() => resolve(null), timeoutMs);
            })
          ]);
        };
        
        // PERFORMANCE: Use request deduplication to prevent duplicate API calls
        // Load vehicles and users in parallel with aggressive timeout for instant response
        // CRITICAL: Don't block UI - load data in background, UI already rendered
        const vehicleRequest = deduplicateRequest(
          `vehicles-${isAdmin ? 'admin' : 'user'}-init`,
          () => dataService.getVehicles(isAdmin)
        );
        const usersRequest = deduplicateRequest(
          'users',
          () => dataService.getUsers()
        );

        // Use the SAME deadline for both requests. Previously users used 3.5s vs vehicles 4.5s on web,
        // so users often timed out first; the .then ran with vehicles populated and usersData === null,
        // and user counts appeared only when the late usersRequest settled (staggered admin stat cards).
        // Admins need the full user list for analytics — allow a bit longer than the default web budget.
        const parallelInitTimeoutMs = isCapacitorNative()
          ? 25000
          : isAdmin
            ? 12000
            : 4500;

        // On native, give enough time for the full round-trip (20s fetch timeout + overhead).
        // Swallow errors at this level so Promise.all always resolves.
        Promise.all([
          loadWithTimeout(vehicleRequest, parallelInitTimeoutMs).catch((e) => { logWarn('Failed to load vehicles:', e); return null; }),
          loadWithTimeout(usersRequest, parallelInitTimeoutMs).catch((e) => { logWarn('Failed to load users:', e); return null; })
        ]).then(([vehiclesData, usersData]) => {
          if (!isMounted) return;
          
          // Update vehicles immediately when available.
          // If timed out, keep current state and apply result when the original request completes.
          if (Array.isArray(vehiclesData)) {
            setVehicles((prev) => mergeVehicleCatalog(prev, vehiclesData, !!isAdmin));
            // PERFORMANCE: Recommendations are now computed via useMemo from vehicles
            if (vehiclesData.length > 0) {
              logInfo(`✅ Updated with ${vehiclesData.length} fresh vehicles from API`);
            } else {
              logWarn('⚠️ API returned empty vehicles array. Check database for published vehicles.');
            }
            markVehiclesCatalogReady();
          } else if (vehiclesData === null) {
            logWarn('⚠️ Vehicle API response exceeded initial timeout. Keeping current vehicles and waiting for response...');
            vehicleRequest
              .then((lateVehicles) => {
                if (!isMounted || !Array.isArray(lateVehicles)) return;
                setVehicles((prev) => mergeVehicleCatalog(prev, lateVehicles, !!isAdmin));
                if (lateVehicles.length > 0) {
                  logInfo(`✅ Late vehicle response applied: ${lateVehicles.length} vehicles`);
                }
              })
              .catch((lateError) => {
                logWarn('Late vehicle response failed:', lateError);
                if (isMounted) setVehicles(prev => (Array.isArray(prev) && prev.length > 0 ? prev : []));
              })
              .finally(markVehiclesCatalogReady);
          } else {
            logError('❌ API returned non-array vehicles data:', typeof vehiclesData);
            markVehiclesCatalogReady();
          }
          
          // Always update users state, even if empty array (for consistency)
          if (Array.isArray(usersData)) {
            if (usersData.length > 0) {
              setUsers(usersData);
              logInfo(`✅ Updated with ${usersData.length} fresh users from API`);
            } else {
              // In development mode, if API returns empty and no cached data, try fallback users
              // Capacitor WebView uses localhost — do not treat as dev (would load mock users).
              const isDevelopment = !isCapacitorNative() &&
                                    (isDevelopmentEnvironment() || 
                                    (typeof window !== 'undefined' && 
                                     (window.location.hostname === 'localhost' || 
                                      window.location.hostname === '127.0.0.1')));
              if (isDevelopment) {
                // Check if we already have users from cache
                const currentUsersJson = localStorage.getItem('reRideUsers_prod') || localStorage.getItem('reRideUsers');
                if (currentUsersJson) {
                  try {
                    const currentUsers = JSON.parse(currentUsersJson);
                    if (Array.isArray(currentUsers) && currentUsers.length > 0) {
                      logInfo(`✅ Using ${currentUsers.length} cached users (API returned empty)`);
                      setUsers(currentUsers);
                    } else {
                      // Cached data exists but is empty, try fallback
                      logWarn('⚠️ Cached users exist but are empty. Checking for fallback users in development mode...');
                      import('../services/userService').then(({ getUsersLocal }) => {
                        getUsersLocal().then(fallbackUsers => {
                          if (fallbackUsers.length > 0 && isMounted) {
                            logInfo(`✅ Using ${fallbackUsers.length} fallback users in development mode`);
                            setUsers(fallbackUsers);
                          } else {
                            logDebug('ℹ️ No users available (API returned empty, cache empty, no fallback)');
                            setUsers([]);
                          }
                        }).catch((error) => {
                          logWarn('Failed to load fallback users:', error);
                          if (isMounted) setUsers([]);
                        });
                      }).catch((error) => {
                        logWarn('Failed to import userService:', error);
                        if (isMounted) setUsers([]);
                      });
                    }
                  } catch (parseError) {
                    logWarn('Failed to parse cached users, trying fallback:', parseError);
                    // Try fallback if cache parse fails
                    import('../services/userService').then(({ getUsersLocal }) => {
                      getUsersLocal().then(fallbackUsers => {
                        if (fallbackUsers.length > 0 && isMounted) {
                          logInfo(`✅ Using ${fallbackUsers.length} fallback users in development mode`);
                          setUsers(fallbackUsers);
                        } else {
                          if (isMounted) setUsers([]);
                        }
                      }).catch((error) => {
                        logWarn('Failed to load fallback users:', error);
                        if (isMounted) setUsers([]);
                      });
                    }).catch((error) => {
                      logWarn('Failed to load fallback users:', error);
                      if (isMounted) setUsers([]);
                    });
                  }
                } else {
                  // No cached data, try fallback users
                  logWarn('⚠️ No users found in API or cache. Checking for fallback users in development mode...');
                  import('../services/userService').then(({ getUsersLocal }) => {
                    getUsersLocal().then(fallbackUsers => {
                      if (fallbackUsers.length > 0 && isMounted) {
                        logInfo(`✅ Using ${fallbackUsers.length} fallback users in development mode`);
                        setUsers(fallbackUsers);
                      } else {
                        logDebug('ℹ️ No users available (API returned empty, no cache, no fallback)');
                        setUsers([]);
                      }
                    }).catch((error) => {
                      logWarn('Failed to load fallback users:', error);
                      if (isMounted) setUsers([]);
                    });
                  }).catch((error) => {
                    logWarn('Failed to import userService:', error);
                    if (isMounted) setUsers([]);
                  });
                }
              } else {
                // Production mode: check for cached data before setting empty
                const currentUsersJson = localStorage.getItem('reRideUsers_prod') || localStorage.getItem('reRideUsers');
                if (currentUsersJson) {
                  try {
                    const currentUsers = JSON.parse(currentUsersJson);
                    if (Array.isArray(currentUsers) && currentUsers.length > 0) {
                      console.log(`✅ Using ${currentUsers.length} cached users (API returned empty in production)`);
                      setUsers(currentUsers);
                    } else {
                      console.log('ℹ️ API returned empty users array and cache is also empty (production mode)');
                      // Preserve existing in-memory users if already present to avoid admin-panel flicker to empty.
                      setUsers(prev => (Array.isArray(prev) && prev.length > 0 ? prev : []));
                    }
                  } catch (parseError) {
                    console.warn('Failed to parse cached users in production:', parseError);
                    setUsers(prev => (Array.isArray(prev) && prev.length > 0 ? prev : []));
                  }
                } else {
                  console.log('ℹ️ API returned empty users array and no cache available (production mode)');
                  setUsers(prev => (Array.isArray(prev) && prev.length > 0 ? prev : []));
                }
              }
            }
          } else if (usersData === null) {
            logWarn('⚠️ Users API response exceeded initial timeout. Keeping current users and waiting for response...');
            usersRequest.then((lateUsers) => {
              if (!isMounted || !Array.isArray(lateUsers)) return;
              setUsers(lateUsers);
              if (lateUsers.length > 0) {
                logInfo(`✅ Late users response applied: ${lateUsers.length} users`);
              }
            }).catch((lateError) => {
              logWarn('Late users response failed:', lateError);
            });
          }
          
          // If no cached data was available, stop loading now
          if (!hasCachedData) {
            setIsLoading(false);
          }
        }).catch(error => {
          console.warn('Background data refresh failed (using cache):', error);
          // If no cached data was available, stop loading even on error
          if (!hasCachedData && isMounted) {
            setIsLoading(false);
          }
          markVehiclesCatalogReady();
        });
        
        // STEP 4: Defer non-critical data loading until after initial render
        // Use requestIdleCallback or setTimeout to avoid blocking initial render
        const scheduleNonCriticalLoad = (callback: () => void) => {
          if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            (window as any).requestIdleCallback(callback, { timeout: 3000 });
          } else {
            setTimeout(callback, 100); // Small delay to let initial render complete
          }
        };

        scheduleNonCriticalLoad(() => {
          if (!isMounted) return;
          
          // Load non-critical data in parallel (deferred)
          Promise.all([
            // FAQs
            (async () => {
              try {
                const { fetchFaqsFromSupabase } = await import('../services/faqService');
                const faqsData = await deduplicateRequest(
                  'faqs',
                  () => fetchFaqsFromSupabase().catch((error) => {
                    logWarn('Failed to load FAQs:', error);
                    return [];
                  })
                );
                if (isMounted) setFaqItems(faqsData);
              } catch (error) {
                const localFaqs = getFaqs();
                if (isMounted) setFaqItems(localFaqs || []);
              }
            })(),

            // Support tickets
            (async () => {
              try {
                const savedUser = localStorage.getItem('reRideCurrentUser');
                if (!savedUser) return;

                const parsedUser = JSON.parse(savedUser);
                const email = parsedUser?.email ? String(parsedUser.email) : '';
                const role = parsedUser?.role ? String(parsedUser.role) : '';
                if (!email) return;

                const tickets = await deduplicateRequest(
                  `support-tickets-${role}-${email}`,
                  () => fetchSupportTicketsFromSupabase(role === 'admin' ? undefined : email)
                );

                if (isMounted) {
                  setSupportTickets(Array.isArray(tickets) ? tickets : []);
                }
              } catch (error) {
                logWarn('Failed to load support tickets:', error);
                const localTickets = getSupportTickets();
                if (isMounted && localTickets) {
                  setSupportTickets(localTickets);
                }
              }
            })(),
            
            // Vehicle data
            (async () => {
              try {
                const vehicleDataData = await deduplicateRequest(
                  'vehicle-data',
                  () => dataService.getVehicleData().catch((error) => {
                    logWarn('Failed to load vehicle data:', error);
                    return null;
                  })
                );
                if (isMounted && vehicleDataData) setVehicleData(vehicleDataData);
              } catch (error) {
                console.warn('Failed to load vehicle data:', error);
              }
            })(),
          
          // Conversations - load cached first, then refresh in background
          (async () => {
            try {
              // STEP 1: Load cached conversations immediately (non-blocking)
              try {
                const cachedConversations = getConversations();
                if (cachedConversations && cachedConversations.length > 0 && isMounted) {
                  setConversations(cachedConversations);
                  console.log(`✅ Instantly loaded ${cachedConversations.length} cached conversations`);
                }
              } catch (cacheError) {
                console.warn('Failed to load cached conversations:', cacheError);
              }
              
              // STEP 2: Fetch fresh conversations in background (non-blocking, with timeout)
              let userEmail: string | undefined;
              let userRole: string | undefined;
              try {
                const savedUser = localStorage.getItem('reRideCurrentUser');
                if (savedUser) {
                  const user = JSON.parse(savedUser);
                  userEmail = user?.email;
                  userRole = user?.role;
                }
              } catch (error) {
                logDebug('Failed to read user data from localStorage (non-critical):', error);
              }
              
              if (userEmail || userRole) {
                // Use timeout to prevent blocking - max 3 seconds
                const conversationPromise = (async () => {
                  const { getConversationsFromMongoDB } = await import('../services/conversationService');
                  const conversationKey = `conversations-${userRole}-${userEmail || 'all'}`;
                  return await deduplicateRequest(
                    conversationKey,
                    () => userRole === 'seller' 
                      ? getConversationsFromMongoDB(undefined, userEmail)
                      : userRole === 'customer'
                      ? getConversationsFromMongoDB(userEmail)
                      : getConversationsFromMongoDB()
                  );
                })();
                
                const timeoutPromise = new Promise<{ success: boolean; data?: Conversation[] }>((resolve) => {
                  setTimeout(() => resolve({ success: false }), 3000);
                });
                
                const result = await Promise.race([conversationPromise, timeoutPromise]);
                
                if (isMounted) {
                  if (result.success && result.data) {
                    // CRITICAL: Normalize sellerId in conversations to ensure proper matching
                    const normalizedConversations = result.data.map(conv => ({
                      ...conv,
                      sellerId: conv.sellerId ? conv.sellerId.toLowerCase().trim() : conv.sellerId,
                      customerId: conv.customerId ? conv.customerId.toLowerCase().trim() : conv.customerId
                    }));
                    
                    setConversations(normalizedConversations);
                    // Cache the fresh data
                    try {
                      localStorage.setItem('reRideConversations', JSON.stringify(normalizedConversations));
                    } catch (error) {
                      logWarn('Failed to cache conversations to localStorage:', error);
                    }
                  }
                  // If result failed but we already have cached data, keep using cache
                }
              }
            } catch (error) {
              console.warn('Failed to load conversations:', error);
              if (isMounted) {
                const localConversations = getConversations();
                if (localConversations && localConversations.length > 0) {
                  // CRITICAL: Normalize sellerId and customerId in cached conversations
                  const normalizedConversations = localConversations.map(conv => ({
                    ...conv,
                    sellerId: conv.sellerId ? conv.sellerId.toLowerCase().trim() : conv.sellerId,
                    customerId: conv.customerId ? conv.customerId.toLowerCase().trim() : conv.customerId
                  }));
                  setConversations(normalizedConversations);
                } else {
                  setConversations([]);
                }
              }
            }
          })(),
          
          // Notifications
          (async () => {
            try {
              let userEmail: string | undefined;
              try {
                const savedUser = localStorage.getItem('reRideCurrentUser');
                if (savedUser) {
                  const user = JSON.parse(savedUser);
                  userEmail = user?.email;
                }
              } catch (error) {
                logDebug('Failed to read user email from localStorage (non-critical):', error);
              }
              
              if (userEmail) {
                const { getNotificationsFromMongoDB } = await import('../services/notificationService');
                const result = await deduplicateRequest(
                  `notifications-${userEmail}`,
                  () => getNotificationsFromMongoDB(userEmail)
                );
                if (isMounted && result.success && result.data) {
                  setNotifications(result.data);
                  try {
                    persistReRideNotifications(result.data);
                  } catch (error) {
                    console.warn('Failed to save notifications:', error);
                  }
                }
              }
            } catch (error) {
              console.warn('Failed to load notifications:', error);
              if (isMounted) {
                try {
                  const notificationsJson = readPersistedReRideNotifications();
                  setNotifications(notificationsJson ? JSON.parse(notificationsJson) : []);
                } catch {
                  setNotifications([]);
                }
              }
            }
          })()
          ]).catch(error => {
            console.warn('Background data loading failed:', error);
          });
        });
        
      } catch (error) {
        console.error('AppProvider: Error loading initial data:', error);
        if (isMounted) {
          // Ensure we have at least empty arrays
          setVehicles(prev => Array.isArray(prev) ? prev : []);
          setUsers(prev => Array.isArray(prev) ? prev : []);
          setVehiclesCatalogReady(true);
          // PERFORMANCE: Recommendations are now computed via useMemo, no need to clear
          setIsLoading(false);
          if (process.env.NODE_ENV === 'development') {
            addToast(t('toast.someDataFailedLoad'), 'warning');
          }
        }
      }
    };

    loadInitialData();
    
    return () => {
      isMounted = false;
    };
    // PERFORMANCE: Only depend on user role, not entire currentUser object
    // Use optional chaining in dependency to handle null/undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addToast, currentUser?.role, t]);

  // Supabase Realtime: other party's messages (customer_id/seller_id are users.id, not raw emails — must match email + emailToKey + user.id)
  const applyConversationRealtimeRow = useCallback(
    async (row: any) => {
      const email = (currentUser?.email || '').toLowerCase().trim();
      if (!email || !row) {
        return;
      }
      const uid = String(currentUser?.id || '').toLowerCase().trim();
      const key = emailToKey(email);
      const rc = String(row.customer_id ?? '').toLowerCase().trim();
      const rs = String(row.seller_id ?? '').toLowerCase().trim();
      const involved =
        rc === email ||
        rs === email ||
        rc === key ||
        rs === key ||
        (!!uid && (rc === uid || rs === uid));
      if (!involved) {
        return;
      }

      let conv = supabaseRowToConversation(row);
      try {
        const supabase = getSupabaseClient();
        const ids = [...new Set([row.customer_id, row.seller_id].filter(Boolean).map(String))];
        if (ids.length > 0) {
          const { data: users } = await supabase.from('users').select('id,email').in('id', ids);
          const em = new Map<string, string>();
          for (const u of users || []) {
            if (u?.id && u?.email) {
              em.set(String(u.id).toLowerCase(), String(u.email).toLowerCase().trim());
            }
          }
          conv = {
            ...conv,
            customerId: em.get(String(row.customer_id).toLowerCase()) ?? conv.customerId,
            sellerId: em.get(String(row.seller_id).toLowerCase()) ?? conv.sellerId,
          };
        }
      } catch {
        /* keep conv from row ids if user lookup fails (RLS) */
      }

      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === conv.id);
        if (idx < 0) {
          const next = [...prev, conv];
          try {
            saveConversations(next);
          } catch {
            void 0;
          }
          return next;
        }
        const existing = prev[idx];
        const mergedMsgs = mergeConversationMessagesForRealtime(existing.messages || [], conv.messages || []);
        const merged = {
          ...conv,
          messages: mergedMsgs.length ? mergedMsgs : conv.messages,
        };
        const next = prev.map((c, i) => (i === idx ? merged : c));
        try {
          saveConversations(next);
        } catch {
          void 0;
        }
        return next;
      });
    },
    [currentUser?.email, currentUser?.id],
  );

  const onConversationRealtimeEvent = useCallback(
    (row: any) => {
      void applyConversationRealtimeRow(row);
    },
    [applyConversationRealtimeRow],
  );

  useSupabaseRealtime({
    table: 'conversations',
    enabled: !!currentUser?.email,
    onInsert: onConversationRealtimeEvent,
    onUpdate: onConversationRealtimeEvent,
  });

  // Supabase Realtime: when a new notification is created for this user, add it to state and show browser notification
  const userEmailForNotif = currentUser?.email?.toLowerCase().trim() ?? '';
  const onNotificationRealtimeInsert = useCallback(
    (row: any) => {
      const recipient = (row.recipient_email || row.user_id || '').toString().toLowerCase().trim();
      if (recipient !== userEmailForNotif) return;
      const notif: Notification = {
        id: row.id,
        recipientEmail: recipient,
        message: row.message || '',
        title: row.title,
        targetId: row.metadata?.targetId ?? row.id,
        targetType: (row.type === 'conversation' ? 'conversation' : row.type === 'vehicle' ? 'vehicle' : 'general') as Notification['targetType'],
        isRead: row.read ?? false,
        timestamp: row.created_at || new Date().toISOString(),
      };
      setNotifications((prev) => [notif, ...prev]);
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        showNotification(notif.title || 'New message', { body: notif.message });
      }
    },
    [userEmailForNotif],
  );

  useSupabaseRealtime({
    table: 'notifications',
    enabled: !!userEmailForNotif,
    filter: userEmailForNotif ? `recipient_email=eq.${postgrestEqQuoted(userEmailForNotif)}` : undefined,
    onInsert: onNotificationRealtimeInsert,
  });

  // Supabase Realtime: published vehicle inserts/updates/deletes → debounced full refresh (web + Capacitor)
  const vehicleRealtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleVehicleRealtimeRefresh = useCallback(() => {
    if (vehicleRealtimeDebounceRef.current) {
      clearTimeout(vehicleRealtimeDebounceRef.current);
    }
    vehicleRealtimeDebounceRef.current = setTimeout(() => {
      vehicleRealtimeDebounceRef.current = null;
      try {
        const raw = localStorage.getItem('reRideCurrentUser');
        const admin = raw ? JSON.parse(raw)?.role === 'admin' : false;
        void dataService
          .getVehicles(!!admin, true)
          .then((fresh) => {
            if (Array.isArray(fresh)) {
              setVehicles((prev) => mergeVehicleCatalog(prev, fresh, !!admin));
            }
          })
          .catch(() => {});
      } catch {
        /* ignore */
      }
    }, 1500);
  }, []);

  useSupabaseRealtime({
    table: 'vehicles',
    enabled: typeof window !== 'undefined' && !isDevelopmentEnvironment(),
    onInsert: scheduleVehicleRealtimeRefresh,
    onUpdate: scheduleVehicleRealtimeRefresh,
    onDelete: scheduleVehicleRealtimeRefresh,
  });

  const usersRealtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleUsersRealtimeRefresh = useCallback(() => {
    if (usersRealtimeDebounceRef.current) {
      clearTimeout(usersRealtimeDebounceRef.current);
    }
    usersRealtimeDebounceRef.current = setTimeout(() => {
      usersRealtimeDebounceRef.current = null;
      void dataService
        .getUsers(true)
        .then((fresh) => {
          if (Array.isArray(fresh)) {
            setUsers(fresh);
          }
        })
        .catch(() => {});
    }, 2000);
  }, []);

  useSupabaseRealtime({
    table: 'users',
    enabled: typeof window !== 'undefined' && !isDevelopmentEnvironment(),
    onInsert: scheduleUsersRealtimeRefresh,
    onUpdate: scheduleUsersRealtimeRefresh,
    onDelete: scheduleUsersRealtimeRefresh,
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
        // Don't set loading to true if we already have cached data - show it immediately
        // Only show loading if we have no cached data
        const hasCachedVehicles = localStorage.getItem('reRideVehicles_prod');
        const hasCachedUsers = localStorage.getItem('reRideUsers_prod');
        
        if (!hasCachedVehicles && !hasCachedUsers) {
          setIsLoading(true);
        }
        
        // For admin users, load all vehicles (including unpublished/sold)
        const isAdmin = currentUser?.role === 'admin';
        
        // For admin users, ensure we fetch users (critical for admin panel)
        if (isAdmin) {
          logDebug('📊 AppProvider: Admin user detected - fetching users for admin panel...');
        }

        // AUTH: Ensure we have an access token before production API calls.
        // This runs when a user is restored from localStorage on initial load.
        if (typeof window !== 'undefined' && !isDevelopmentEnvironment()) {
          try {
            const hasAccessToken = !!getBrowserAccessTokenForApi();

            if (!hasAccessToken && hasLikelyRefreshSource()) {
              await Promise.race([
                refreshAuthToken(),
                new Promise((resolve) => setTimeout(resolve, 2500)),
              ]);
            }
          } catch (error) {
            logWarn('⚠️ Auth rehydration failed in syncLatestData (non-critical):', error);
          }
        }
        
        // Load vehicles and users in PARALLEL for faster loading (no sequential delays)
        // CRITICAL FIX: For admin users, force refresh to bypass cache and get fresh data
        // Use deduplicateRequest so overlapping initial-load requests are reused, not duplicated
        const [vehiclesResult, usersResult] = await Promise.allSettled([
          deduplicateRequest(
            `vehicles-${isAdmin ? 'admin' : 'user'}-sync-fr${isAdmin ? '1' : '0'}`,
            () => dataService.getVehicles(isAdmin, isAdmin)
          ),
          deduplicateRequest(
            'users',
            () => dataService.getUsers(isAdmin)
          )
        ]);

        if (!isSubscribed) {
          return;
        }

        // Update vehicles if fetch succeeded
        if (vehiclesResult.status === 'fulfilled' && Array.isArray(vehiclesResult.value)) {
          setVehicles((prev) => mergeVehicleCatalog(prev, vehiclesResult.value, !!isAdmin));
          // PERFORMANCE: Recommendations are now computed via useMemo from vehicles
          // Do not toast on empty listings: zero published vehicles is valid (new seller, empty marketplace).
          // Misconfiguration is surfaced when the request fails (see rejected branch / 503 handling).
        } else if (vehiclesResult.status === 'rejected') {
          console.warn('Failed to sync vehicles:', vehiclesResult.reason);
          const reason = vehiclesResult.reason as any;
          const status = reason?.status ?? reason?.code;
          const message = reason instanceof Error ? reason.message : reason?.message ?? String(reason);

          if (status === 503 || /Supabase|SERVICE_ROLE_KEY|not configured/i.test(message)) {
            addToast(
              t('toast.listingsEmptyDbUnavailable'),
              'error'
            );
          } else {
            addToast(t('toast.vehiclesLoadFailed'), 'error');
          }
        }

        // Update users if fetch succeeded
        if (usersResult.status === 'fulfilled' && Array.isArray(usersResult.value)) {
          console.log(`✅ AppProvider: Setting ${usersResult.value.length} users in state`);
          setUsers(usersResult.value);
          // For admin users, log if we got 0 users (might indicate an issue)
          if (currentUser?.role === 'admin' && usersResult.value.length === 0) {
            console.warn('⚠️ AppProvider: Admin user fetched 0 users. This might indicate:');
            console.warn('   1. No users exist in the database');
            console.warn('   2. Authentication/authorization issue');
            console.warn('   3. API returned empty array');
          }
          // Do not toast on empty users: non-admins cannot list all users (GET /api/users returns 403),
          // so getUsers() legitimately resolves to []. Dealer enrichment uses currentUser + vehicles.
        } else if (usersResult.status === 'rejected') {
          console.error('❌ AppProvider: Failed to sync users:', usersResult.reason);
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
                  console.warn('⚠️ Using cached users data due to API failure');
                  setUsers(parsed);
                }
              } catch (e) {
                console.error('Failed to parse cached users:', e);
              }
            }
          }
        }
      } catch (error) {
        console.error('AppProvider: Failed to sync latest data after authentication:', error);
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
    const userNotifications = notifications.filter(n => 
      n.recipientEmail.toLowerCase().trim() === currentUser.email.toLowerCase().trim()
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
      
      // Only show browser notification if page is in background
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
            console.warn('Failed to show browser notification:', err);
          }
        });
      }
    });

    // Clean up old notification IDs from the ref (keep last 100)
    if (shownNotificationIdsRef.current.size > 100) {
      const notificationIds = new Set(notifications.map(n => n.id));
      shownNotificationIdsRef.current = new Set(
        Array.from(shownNotificationIdsRef.current).filter(id => notificationIds.has(id))
      );
    }
    // PERFORMANCE: Depend on currentUser object instead of email property for stable reference
  }, [notifications, currentUser]);

  // Periodic sync queue processor - retry failed Supabase saves
  useEffect(() => {
    const SYNC_INTERVAL = 30000; // 30 seconds

    let syncInterval: NodeJS.Timeout | null = null;
    let isProcessing = false;

    const processSync = async () => {
      // Prevent concurrent sync processing
      if (isProcessing) {
        console.log('⏳ Sync already in progress, skipping...');
        return;
      }

      try {
        isProcessing = true;
        const queueStatus = getSyncQueueStatus();
        
        if (queueStatus.pending > 0) {
          console.log(`🔄 Processing sync queue: ${queueStatus.pending} items pending`);
          
          const result = await processSyncQueue();
          
          if (result.success > 0) {
            console.log(`✅ Successfully synced ${result.success} items to Supabase`);
            if (process.env.NODE_ENV === 'development') {
              addToast(t('toast.syncedItemsCount', { count: result.success }), 'success');
            }
          }
          
          if (result.failed > 0) {
            console.warn(`⚠️ Failed to sync ${result.failed} items after retries`);
            const remainingStatus = getSyncQueueStatus();
            if (remainingStatus.pending > 0 && process.env.NODE_ENV === 'development') {
              console.log(`⏳ ${remainingStatus.pending} items still pending sync`);
            }
          }
        }
      } catch (error) {
        console.error('Error processing sync queue:', error);
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
          console.log('✅ Vehicle data synced from another tab');
        } catch (error) {
          console.error('Failed to parse vehicle data from storage event:', error);
        }
      }
    };

    // Add custom event listener for same-tab updates (fires when localStorage is updated in same tab)
    const handleVehicleDataUpdate = (e: CustomEvent) => {
      if (e.detail && e.detail.vehicleData) {
        setVehicleData(e.detail.vehicleData);
        console.log('✅ Vehicle data synced from same tab');
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
        console.log('✅ Vehicle list updated from background refresh');
      }
    };

    // When user data background refresh completes, keep UI in sync with Supabase/API
    const handleUsersCacheUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && Array.isArray(detail.users)) {
        setUsers(detail.users);
        console.log('✅ User list updated from background refresh');
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
    const vehicleRefreshMs = isNativeWebView ? 3 * 60 * 1000 : 60 * 1000;
    const vehicleListRefreshInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      dataService.getVehicles(isAdmin, false)
        .then((freshVehicles) => {
          if (Array.isArray(freshVehicles) && freshVehicles.length >= 0) {
            setVehicles((prev) => mergeVehicleCatalog(prev, freshVehicles, !!isAdmin));
            console.log('✅ Vehicle list refreshed from API');
          }
        })
        .catch((err) => {
          console.warn('Periodic vehicle list refresh failed:', err);
        });
    }, vehicleRefreshMs); // 1 minute on web, 3 minutes on native

    // Periodic refresh of vehicle data (makes/models etc) from API (every 5 minutes)
    const refreshInterval = setInterval(() => {
      dataService.getVehicleData()
        .then((freshData) => {
          if (freshData) {
            setVehicleData(freshData);
            console.log('✅ Vehicle data refreshed from API');
          }
        })
        .catch((error) => {
          console.warn('Failed to refresh vehicle data:', error);
        });
    }, 5 * 60 * 1000); // 5 minutes

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

  // Keep admin support queue in near real-time sync with backend updates
  useEffect(() => {
    if (!currentUser?.email) return;
    const role = currentUser.role;
    const email = currentUser.email;

    let isMounted = true;
    const refreshSupportTickets = async () => {
      try {
        const tickets = await fetchSupportTicketsFromSupabase(role === 'admin' ? undefined : email);
        if (isMounted) {
          setSupportTickets(Array.isArray(tickets) ? tickets : []);
        }
      } catch {
        // non-blocking background refresh
      }
    };

    refreshSupportTickets();
    const interval = setInterval(refreshSupportTickets, 20000);

    return () => {
      isMounted = false;
      clearInterval(interval);
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
          const changed =
            prev.length !== normalized.length ||
            normalized.some((n) => {
              const p = prev.find((x) => x.id === n.id);
              return !p || p.messages.length !== n.messages.length || p.isReadBySeller !== n.isReadBySeller || p.isReadByCustomer !== n.isReadByCustomer;
            });
          if (!changed) return prev;
          try {
            saveConversations(normalized);
          } catch {
            /* ignore */
          }
          return normalized;
        });
      } catch {
        /* ignore */
      }
    };

    const onOnline = () => {
      void syncConversationsNow();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void syncConversationsNow();
      }
    };

    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [currentUser?.email, currentUser?.role]);

  // Helper function to join all relevant conversation rooms
  const joinAllConversationRooms = useCallback(() => {
    if (!currentUser || !realtimeChatService.isConnected()) {
      return;
    }
    
    const currentUserEmail = currentUser.email;
    const currentUserRole = currentUser.role as 'customer' | 'seller';
    
    // Collect all conversation IDs user is part of
    const conversationIds: string[] = [];
    conversations.forEach(conv => {
      if (!conv) return;
      // Join if user is part of this conversation
      const isParticipant = 
        (currentUserRole === 'customer' && conv.customerId?.toLowerCase().trim() === currentUserEmail.toLowerCase().trim()) ||
        (currentUserRole === 'seller' && conv.sellerId?.toLowerCase().trim() === currentUserEmail.toLowerCase().trim());
      
      if (isParticipant) {
        conversationIds.push(conv.id);
      }
    });
    
    // Join all conversations at once
    if (conversationIds.length > 0) {
      console.log('🔧 Joining conversation rooms:', { count: conversationIds.length, conversationIds });
      realtimeChatService.joinAllConversations(conversationIds);
      if (process.env.NODE_ENV === 'development') {
        logDebug(`🔧 Auto-subscribed to ${conversationIds.length} conversation(s)`);
      }
    }
  }, [currentUser, conversations]);

  // Supabase broadcast + presence for typing/online when Socket.io is off (production).
  useEffect(() => {
    if (!currentUser?.email || (currentUser.role !== 'seller' && currentUser.role !== 'customer')) {
      setChatPeerOnlineByConversationId({});
      realtimeChatService.syncChatEphemeralChannels([], '', 'customer');
      return;
    }
    const email = currentUser.email.toLowerCase().trim();
    const role = currentUser.role === 'seller' ? 'seller' : 'customer';
    const metas: ChatEphemeralThreadMeta[] = conversations
      .filter((c): c is Conversation => Boolean(c?.id))
      .map((c) => {
        const cid = String(c.customerId || '')
          .toLowerCase()
          .trim();
        const sid = String(c.sellerId || '')
          .toLowerCase()
          .trim();
        if (!cid || !sid) return null;
        const counterpartEmail = role === 'customer' ? sid : cid;
        return { conversationId: String(c.id), counterpartEmail };
      })
      .filter((m): m is ChatEphemeralThreadMeta => m != null);

    realtimeChatService.syncChatEphemeralChannels(metas, email, role);
  }, [currentUser?.email, currentUser?.role, conversations]);

  // Load buyer activity from database on customer login
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'customer') {
      return;
    }

    const loadBuyerActivity = async () => {
      try {
        const activity = await buyerService.getBuyerActivity(currentUser.email);
        // Activity is automatically saved to localStorage by getBuyerActivity
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Buyer activity loaded from database:', {
            userId: activity.userId,
            recentlyViewedCount: activity.recentlyViewed.length,
            savedSearchesCount: activity.savedSearches.length
          });
        }
      } catch (error) {
        logWarn('Failed to load buyer activity from database:', error);
        // Continue with localStorage fallback (handled by getBuyerActivity)
      }
    };

    loadBuyerActivity();
  }, [currentUser]);

  // Real-time Chat Service Integration (end-to-end chat for buyers and sellers)
  useEffect(() => {
    if (!currentUser) {
      realtimeChatService.disconnect();
      return;
    }

    const userEmail = currentUser.email;
    const userRole = currentUser.role as 'customer' | 'seller';

    // Connect to real-time chat service
    console.log('🔧 AppProvider: Connecting to real-time chat service...', { userEmail, userRole });
    realtimeChatService.connect(userEmail, userRole).then((connected) => {
      if (connected) {
        console.log('✅ Real-time chat service connected successfully');
      } else {
        // Only show warning if connection actually failed (not just "not available")
        // The service now returns true even if WebSocket isn't available (messages still work)
        console.log('ℹ️ Real-time chat: Using fallback mode (messages still work via API)');
      }
    }).catch((error) => {
      // Don't show error toast - messages still work via API
      console.warn('⚠️ Real-time chat connection issue (non-critical):', error);
      // Messages will still work via Supabase API, just not real-time
    });
    
    // Setup connection status callback - only log, don't show error toasts
    // Messages still work via API even if real-time connection fails
    realtimeChatService.onConnection((connected) => {
      if (connected) {
        console.log('✅ Real-time chat connection established');
      } else {
        // Don't show error - messages still work via API
        console.log('ℹ️ Real-time chat disconnected (messages still work via API)');
      }
    });

    // Setup message received callback
    realtimeChatService.onMessage((conversationId, message, conversationData) => {
      console.log('📨 AppProvider: Received real-time message:', { 
        conversationId, 
        messageId: message.id, 
        sender: message.sender,
        hasConversationData: !!conversationData
      });
      
      // Update conversations state with new message
      setConversations(prev => {
        const existingConv = prev.find(c => c.id === conversationId);
        if (existingConv) {
          // Check if message already exists (prevent duplicates)
          const messageExists = existingConv.messages.some(m => m.id === message.id);
          if (messageExists) {
            console.log('⚠️ Message already exists, skipping duplicate:', message.id);
            return prev; // Message already exists, no update needed
          }
          
          // Update conversation with new message
          const updated = prev.map(conv => 
            conv.id === conversationId
              ? {
                  ...conv,
                  messages: [...conv.messages, message],
                  lastMessageAt: message.timestamp,
                  isReadBySeller: message.sender === 'seller' ? true : (message.sender === 'user' ? false : conv.isReadBySeller),
                  isReadByCustomer: message.sender === 'user' ? true : (message.sender === 'seller' ? false : conv.isReadByCustomer)
                }
              : conv
          );
          
          // Update activeChat if it's the same conversation
          if (activeChat?.id === conversationId) {
            const updatedConv = updated.find(c => c.id === conversationId);
            if (updatedConv) {
              setActiveChat(updatedConv);
            }
          }
          
          // Save to localStorage
          try {
            saveConversations(updated);
          } catch (error) {
            console.error('Failed to save conversations to localStorage:', error);
          }
          
          console.log('✅ Message added to conversation:', { conversationId, messageId: message.id });
          return updated;
        } else {
          // Conversation doesn't exist in state - try to add it using conversationData from WebSocket
          console.warn('⚠️ Received message for conversation not in state:', {
            conversationId,
            messageId: message.id,
            sender: message.sender,
            currentConversations: prev.length,
            hasConversationData: !!conversationData
          });
          
          // If we have conversation data from WebSocket, use it to create the conversation in state
          if (conversationData && conversationData.id) {
            // sellerName may be in conversationData but not in Conversation type
            const sellerName = (conversationData as any).sellerName;
            const newConversation: Conversation = {
              id: conversationData.id,
              customerId: conversationData.customerId ? conversationData.customerId.toLowerCase().trim() : '',
              customerName: conversationData.customerName || 'Customer',
              sellerId: conversationData.sellerId ? conversationData.sellerId.toLowerCase().trim() : '',
              vehicleId: conversationData.vehicleId || 0,
              vehicleName: conversationData.vehicleName || 'Vehicle',
              vehiclePrice: conversationData.vehiclePrice,
              messages: [message],
              lastMessageAt: message.timestamp,
              isReadBySeller: message.sender === 'seller' ? true : (message.sender === 'user' ? false : false),
              isReadByCustomer: message.sender === 'user' ? true : (message.sender === 'seller' ? false : false),
              isFlagged: false
            };
            
            console.log('✅ Adding conversation to state from WebSocket data:', {
              conversationId,
              customerName: newConversation.customerName,
              sellerName: sellerName || 'N/A',
              vehicleName: newConversation.vehicleName
            });
            
            // Update activeChat if this is the active conversation
            if (activeChat?.id === conversationId) {
              setActiveChat(newConversation);
            }
            
            // Save to localStorage
            try {
              const updated = [...prev, newConversation];
              saveConversations(updated);
            } catch (error) {
              console.error('Failed to save conversations to localStorage:', error);
            }
            
            return [...prev, newConversation];
          }
          
          // Fallback: Try to load conversation from database
          // CRITICAL: For sellers, we need to ensure they see conversations even if not in their initial load
          console.log('🔄 Attempting to load conversation from database:', conversationId);
          (async () => {
            try {
              const { getConversationsFromSupabase } = await import('../services/conversationService');
              const { supabaseConversationService } = await import('../services/supabase-conversation-service');
              const currentUserEmail = currentUser?.email;
              const currentUserRole = currentUser?.role;
              
              if (!currentUserEmail || !currentUserRole) {
                console.warn('⚠️ Cannot load conversation: missing user info');
                return;
              }
              
              // Prefer API list first: server hydrates users.id → email for seller/customer matching
              let foundConv: Conversation | null = null;
              const bulkResult = currentUserRole === 'seller'
                ? await getConversationsFromSupabase(undefined, currentUserEmail)
                : currentUserRole === 'customer'
                ? await getConversationsFromSupabase(currentUserEmail)
                : await getConversationsFromSupabase();

              if (bulkResult.success && bulkResult.data) {
                foundConv = bulkResult.data.find((c) => c.id === conversationId) || null;
              }

              if (!foundConv) {
                try {
                  foundConv = await supabaseConversationService.findById(conversationId);
                  console.log('🔍 Direct Supabase conversation lookup result:', {
                    found: !!foundConv,
                    conversationId,
                    sellerId: foundConv?.sellerId,
                    currentUserEmail,
                    role: currentUserRole,
                  });
                } catch (error) {
                  console.warn('⚠️ Direct lookup failed:', error);
                }
              }
              
              if (foundConv) {
                // CRITICAL: For sellers, verify this conversation belongs to them
                if (currentUserRole === 'seller') {
                  const normalizedSellerEmail = (currentUserEmail || '').toLowerCase().trim();
                  const normalizedConvSellerId = (foundConv.sellerId || '').toLowerCase().trim();
                  if (normalizedConvSellerId !== normalizedSellerEmail) {
                    console.warn('⚠️ Conversation sellerId mismatch:', {
                      conversationId,
                      convSellerId: foundConv.sellerId,
                      currentUserEmail,
                      normalizedConvSellerId,
                      normalizedSellerEmail
                    });
                    // Still add it - might be a case sensitivity issue
                  }
                }
                
                // Check if message already exists
                const messageExists = foundConv.messages.some(m => m.id === message.id);
                const updatedConv = {
                  ...foundConv,
                  messages: messageExists ? foundConv.messages : [...(foundConv.messages || []), message],
                  lastMessageAt: message.timestamp,
                  isReadBySeller: message.sender === 'seller' ? true : foundConv.isReadBySeller,
                  isReadByCustomer: message.sender === 'user' ? true : foundConv.isReadByCustomer
                };
                
                setConversations(prevState => {
                  // Check if it was added while we were loading
                  const alreadyExists = prevState.find(c => c.id === conversationId);
                  if (alreadyExists) {
                    // Update existing - ensure message is included
                    const existingConv = prevState.find(c => c.id === conversationId);
                    const hasMessage = existingConv?.messages.some(m => m.id === message.id);
                    if (hasMessage) {
                      console.log('✅ Message already in conversation, skipping update');
                      return prevState;
                    }
                    // Update existing conversation with new message
                    const updated = prevState.map(conv => 
                      conv.id === conversationId ? updatedConv : conv
                    );
                    try {
                      saveConversations(updated);
                    } catch (error) {
                      console.error('Failed to save conversations to localStorage:', error);
                    }
                    return updated;
                  }
                  // Add new conversation to seller's inbox
                  console.log('✅ Adding conversation to seller inbox:', {
                    conversationId,
                    sellerId: updatedConv.sellerId,
                    customerName: updatedConv.customerName,
                    vehicleName: updatedConv.vehicleName
                  });
                  const updated = [...prevState, updatedConv];
                  try {
                    saveConversations(updated);
                  } catch (error) {
                    console.error('Failed to save conversations to localStorage:', error);
                  }
                  return updated;
                });
                
                // Update activeChat if this is the active conversation
                if (activeChat?.id === conversationId) {
                  setActiveChat(updatedConv);
                }
                
                console.log('✅ Loaded and added conversation from database:', conversationId);
              } else {
                console.error('❌ Conversation not found in database:', {
                  conversationId,
                  currentUserEmail,
                  currentUserRole,
                  searchedBySeller: currentUserRole === 'seller'
                });
                // For sellers, this might mean the conversation wasn't saved properly
                // or the sellerId doesn't match - log for debugging
              }
            } catch (error) {
              console.error('❌ Failed to load conversation from database:', error);
            }
          })();
          
          // Return previous state for now - will be updated when conversation loads
          return prev;
        }
      });
    });

    // Setup typing status callback
    realtimeChatService.onTyping((typingStatus) => {
      if (typingStatus.isTyping) {
        setTypingStatus({
          conversationId: typingStatus.conversationId,
          userRole: typingStatus.userRole,
        });
      } else {
        setTypingStatus((prev) =>
          prev?.conversationId === typingStatus.conversationId &&
          prev?.userRole === typingStatus.userRole
            ? null
            : prev,
        );
      }
    });

    // Setup connection status callback (auto-subscribe on connect)
    realtimeChatService.onConnection((connected) => {
      if (process.env.NODE_ENV === 'development') {
        logDebug(connected ? '✅ Real-time chat connected' : '⚠️ Real-time chat disconnected');
      }
      
      // When connected, automatically join ALL conversation rooms
      if (connected) {
        // Add a small delay to ensure socket is fully ready
        setTimeout(() => {
          joinAllConversationRooms();
        }, 120);
      }
    });

    // Setup presence callback (track online/offline status for chat header)
    realtimeChatService.onPresence((presence) => {
      if (process.env.NODE_ENV === 'development') {
        logDebug(`👤 Presence update: ${presence.userEmail} is ${presence.isOnline ? 'online' : 'offline'}`);
      }
      if (!presence.conversationId || !presence.userEmail) return;
      setChatPeerOnlineByConversationId((prev) => ({
        ...prev,
        [presence.conversationId]: presence.isOnline,
      }));
    });

    // Setup read receipt callback (remote: mark listed message ids as read by recipient)
    realtimeChatService.onRead((conversationId, messageIds, _readBy) => {
      const idSet = new Set(messageIds.map(String));
      setConversations((prev) => {
        const next = prev.map((conv) => {
          if (String(conv.id) !== String(conversationId)) return conv;
          const updatedMessages = (conv.messages || []).map((msg) =>
            idSet.has(String(msg.id)) ? { ...msg, isRead: true } : msg,
          );
          return { ...conv, messages: updatedMessages };
        });
        try {
          saveConversations(next);
        } catch (e) {
          console.warn('saveConversations after read receipt failed', e);
        }
        return next;
      });
      setActiveChat((prev) => {
        if (!prev || String(prev.id) !== String(conversationId)) return prev;
        const updatedMessages = (prev.messages || []).map((msg) =>
          idSet.has(String(msg.id)) ? { ...msg, isRead: true } : msg,
        );
        return { ...prev, messages: updatedMessages };
      });
    });

    // Setup notification received callback for real-time notifications
    realtimeChatService.onNotification((notification) => {
      // CRITICAL FIX: Normalize recipient email for comparison
      const normalizedNotificationRecipient = (notification.recipientEmail || '').toLowerCase().trim();
      const normalizedCurrentUserEmail = (currentUser?.email || '').toLowerCase().trim();
      
      // Only add notification if it's for the current user
      if (normalizedNotificationRecipient === normalizedCurrentUserEmail) {
        console.log('📬 AppProvider: Received real-time notification:', { 
          notificationId: notification.id, 
          recipientEmail: notification.recipientEmail 
        });
        
        setNotifications(prevNotifications => {
          // Check if notification already exists (prevent duplicates)
          const exists = prevNotifications.some(n => n.id === notification.id);
          if (exists) {
            console.log('⚠️ Notification already exists, skipping duplicate:', notification.id);
            return prevNotifications;
          }
          
          const updatedNotifications = [notification, ...prevNotifications];
          
          // Save to localStorage
          try {
            persistReRideNotifications(updatedNotifications);
          } catch (error) {
            console.error('Failed to save notifications to localStorage:', error);
          }
          
          console.log('✅ Real-time notification added to state:', notification.id);
          return updatedNotifications;
        });
      } else {
        console.log('⚠️ Notification not for current user, ignoring:', {
          notificationRecipient: notification.recipientEmail,
          currentUserEmail: currentUser?.email
        });
      }
    });
  }, [currentUser, joinAllConversationRooms, activeChat]);

  // Also join rooms when conversations are loaded/updated
  useEffect(() => {
    if (realtimeChatService.isConnected() && conversations.length > 0 && currentUser) {
      const timeoutId = setTimeout(() => {
        joinAllConversationRooms();
      }, 50);
      
      return () => clearTimeout(timeoutId);
    }
  }, [conversations.length, currentUser?.email, joinAllConversationRooms]);

  // CRITICAL: Periodically refresh conversations for sellers to catch new ones
  // This ensures sellers see new conversations even if WebSocket delivery fails
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'seller' || !currentUser.email) return;
    
    const normalizedSellerEmail = currentUser.email.toLowerCase().trim();
    
    // Load conversations immediately when seller logs in
    const loadSellerConversations = async () => {
      try {
        const { getConversationsFromSupabase } = await import('../services/conversationService');
        
        // CRITICAL: Use normalized email for query, but also try original email as fallback
        const result = await getConversationsFromSupabase(undefined, normalizedSellerEmail);
        
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 Loading seller conversations:', {
            sellerEmail: currentUser.email,
            normalizedSellerEmail,
            resultSuccess: result.success,
            conversationCount: result.data?.length || 0
          });
        }
        
        if (result.success && result.data) {
          // Normalize sellerId and customerId in conversations to ensure proper matching
          const normalizedConversations = result.data.map(conv => ({
            ...conv,
            sellerId: conv.sellerId ? conv.sellerId.toLowerCase().trim() : conv.sellerId,
            customerId: conv.customerId ? conv.customerId.toLowerCase().trim() : conv.customerId
          }));
          
          if (process.env.NODE_ENV === 'development') {
            console.log('🔍 Normalized conversations:', {
              count: normalizedConversations.length,
              conversations: normalizedConversations.map(c => ({
                id: c.id,
                sellerId: c.sellerId,
                customerName: c.customerName,
                vehicleName: c.vehicleName,
                messageCount: c.messages?.length || 0
              }))
            });
          }
          
          setConversations(prev => {
            const prevIds = new Set(prev.map(c => c.id));
            
            // Check if there are new conversations or if message counts changed
            const hasNewConversations = normalizedConversations.some(c => !prevIds.has(c.id));
            const hasUpdatedMessages = normalizedConversations.some(newConv => {
              const oldConv = prev.find(c => c.id === newConv.id);
              return oldConv && oldConv.messages.length !== newConv.messages.length;
            });
            
            if (hasNewConversations || hasUpdatedMessages || prev.length === 0) {
              console.log('🔄 Refreshing seller conversations:', {
                newCount: normalizedConversations.length,
                hasNew: hasNewConversations,
                hasUpdated: hasUpdatedMessages,
                previousCount: prev.length,
                sellerEmail: normalizedSellerEmail
              });
              try {
                saveConversations(normalizedConversations);
              } catch (error) {
                console.error('Failed to save refreshed conversations:', error);
              }
              return normalizedConversations;
            }
            
            return prev;
          });
        } else if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Failed to load seller conversations:', {
            success: result.success,
            error: result.error,
            sellerEmail: normalizedSellerEmail
          });
        }
      } catch (error) {
        console.warn('⚠️ Failed to refresh seller conversations:', error);
        if (process.env.NODE_ENV === 'development') {
          console.error('Error details:', error);
        }
      }
    };
    
    // Load immediately
    loadSellerConversations();
    
    // Fallback sync if Realtime/WebSocket misses an update (keep well under perceived “10s lag”)
    const refreshInterval = setInterval(loadSellerConversations, 4000);
    
    return () => clearInterval(refreshInterval);
  }, [currentUser?.email, currentUser?.role]);

  // Customers: poll API so seller replies appear even when Realtime RLS blocks postgres_changes
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'customer' || !currentUser.email) {
      return;
    }
    const normalizedCustomerEmail = currentUser.email.toLowerCase().trim();

    const loadCustomerConversations = async () => {
      try {
        const { getConversationsFromSupabase } = await import('../services/conversationService');
        const result = await getConversationsFromSupabase(normalizedCustomerEmail);
        if (!result.success || !result.data) {
          return;
        }
        const normalizedConversations = result.data.map((conv) => ({
          ...conv,
          sellerId: conv.sellerId ? conv.sellerId.toLowerCase().trim() : conv.sellerId,
          customerId: conv.customerId ? conv.customerId.toLowerCase().trim() : conv.customerId,
        }));
        setConversations((prev) => {
          const prevIds = new Set(prev.map((c) => c.id));
          const hasNew = normalizedConversations.some((c) => !prevIds.has(c.id));
          const hasUpdated = normalizedConversations.some((newConv) => {
            const oldConv = prev.find((c) => c.id === newConv.id);
            return oldConv && oldConv.messages.length !== newConv.messages.length;
          });
          if (hasNew || hasUpdated || prev.length === 0) {
            try {
              saveConversations(normalizedConversations);
            } catch (_) {
              /* ignore */
            }
            return normalizedConversations;
          }
          return prev;
        });
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Failed to refresh customer conversations:', e);
        }
      }
    };

    loadCustomerConversations();
    const interval = setInterval(loadCustomerConversations, 4000);
    return () => clearInterval(interval);
  }, [currentUser?.email, currentUser?.role]);

  // While a thread is open, poll that conversation directly (fast path; bypasses bulk list + queue backlog).
  useEffect(() => {
    const convId = activeChat?.id;
    if (!convId || !currentUser?.email) {
      return;
    }

    let cancelled = false;
    let inFlight = false;

    const syncOpenThread = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const { getConversationByIdFromSupabase } = await import('../services/conversationService');
        const result = await getConversationByIdFromSupabase(String(convId));
        if (cancelled || !result.success || !result.data) {
          return;
        }
        const fresh = result.data;

        setConversations((prev) => {
          const idx = prev.findIndex((c) => c && String(c.id) === String(convId));
          const existing = idx >= 0 ? prev[idx] : null;
          const mergedMsgs = existing
            ? mergeConversationMessagesForRealtime(existing.messages || [], fresh.messages || [])
            : mergeConversationMessagesForRealtime([], fresh.messages || []);
          const merged: Conversation = {
            ...fresh,
            messages: mergedMsgs,
          };
          if (existing) {
            const prevLen = existing.messages?.length ?? 0;
            if (mergedMsgs.length === prevLen && merged.lastMessageAt === existing.lastMessageAt) {
              return prev;
            }
          }
          const next =
            idx >= 0 ? prev.map((c, i) => (i === idx ? merged : c)) : [...prev, merged];
          try {
            saveConversations(next);
          } catch {
            /* ignore */
          }
          return next;
        });

        setActiveChat((ac) => {
          if (!ac || String(ac.id) !== String(convId)) {
            return ac;
          }
          const mergedMsgs = mergeConversationMessagesForRealtime(ac.messages || [], fresh.messages || []);
          const prevLen = ac.messages?.length ?? 0;
          if (mergedMsgs.length === prevLen && fresh.lastMessageAt === ac.lastMessageAt) {
            return ac;
          }
          return { ...fresh, messages: mergedMsgs };
        });
      } finally {
        inFlight = false;
      }
    };

    void syncOpenThread();
    const interval = setInterval(syncOpenThread, 600);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeChat?.id, currentUser?.email]);
  
  // CRITICAL: Periodically refresh notifications for all users
  useEffect(() => {
    if (!currentUser || !currentUser.email) return;
    
    const normalizedUserEmail = currentUser.email.toLowerCase().trim();
    
    // Load notifications immediately
    const loadNotifications = async () => {
      try {
        const { getNotificationsFromSupabase } = await import('../services/notificationService');
        const result = await getNotificationsFromSupabase(normalizedUserEmail);
        
        if (result.success && result.data) {
          setNotifications(prev => {
            const prevIds = new Set(prev.map(n => n.id));
            const hasNewNotifications = result.data!.some(n => !prevIds.has(n.id));
            const hasUpdatedNotifications = result.data!.some(newNotif => {
              const oldNotif = prev.find(n => n.id === newNotif.id);
              return oldNotif && oldNotif.isRead !== newNotif.isRead;
            });
            
            if (hasNewNotifications || hasUpdatedNotifications || prev.length === 0) {
              console.log('🔄 Refreshing notifications:', {
                newCount: result.data!.length,
                hasNew: hasNewNotifications,
                hasUpdated: hasUpdatedNotifications
              });
              try {
                persistReRideNotifications(result.data!);
              } catch (error) {
                console.warn('Failed to save notifications:', error);
              }
              return result.data!;
            }
            
            return prev;
          });
        }
      } catch (error) {
        console.warn('⚠️ Failed to refresh notifications:', error);
      }
    };
    
    // Load immediately
    loadNotifications();
    
    // Then refresh periodically every 15 seconds
    const refreshInterval = setInterval(loadNotifications, 15000);
    
    return () => clearInterval(refreshInterval);
  }, [currentUser?.email]);

  // CRITICAL: Join conversation room when activeChat changes (user opens a chat)
  // This ensures real-time message delivery works
  useEffect(() => {
    if (activeChat && currentUser) {
      console.log('🔧 Active chat changed, joining conversation room:', activeChat.id);
      // Always try to join, even if not connected (will queue for when connection is ready)
      realtimeChatService.joinConversation(activeChat.id).catch(err => {
        console.warn('⚠️ Failed to join conversation room:', err);
      });
    }
  }, [activeChat?.id, currentUser?.email]); // Join when chat opens or user changes

  // Sync activeChat when conversations change
  useEffect(() => {
    if (activeChat) {
      const updatedConversation = conversations.find(conv => conv.id === activeChat.id);
      if (updatedConversation) {
        // Use shallow comparison instead of deep JSON comparison to avoid infinite loops
        const hasChanges = 
          updatedConversation.messages.length !== activeChat.messages.length ||
          updatedConversation.lastMessageAt !== activeChat.lastMessageAt ||
          updatedConversation.isReadBySeller !== activeChat.isReadBySeller ||
          updatedConversation.isReadByCustomer !== activeChat.isReadByCustomer;
        
        if (hasChanges) {
          setActiveChat(updatedConversation);
        }
      }
    }
  }, [conversations, activeChat?.id]); // Added activeChat?.id for proper reactivity

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
      console.log('🔄 App came online, syncing data...');
      dataService.syncWhenOnline().then(() => {
        console.log('✅ Data sync completed');
        addToast(t('toast.dataSyncSuccess'), 'success');
      }).catch((error) => {
        console.warn('⚠️ Data sync failed:', error);
        addToast(t('toast.dataSyncPartial'), 'warning');
      });
    };

    const handleOffline = () => {
      console.log('📴 App went offline');
      addToast(t('toast.nowOffline'), 'info');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addToast, t]);

  const updateVehicleHandler = useCallback(async (id: number, updates: Partial<Vehicle>, options: VehicleUpdateOptions = {}) => {
    // Prevent duplicate updates for the same vehicle
    if (updatingVehiclesRef.current.has(id)) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⏸️ Update already in progress for vehicle:', id);
      }
      return;
    }

    try {
      // Mark vehicle as being updated
      updatingVehiclesRef.current.add(id);

      const vehicleToUpdate = Array.isArray(vehicles) ? vehicles.find(v => v.id === id) : undefined;
      if (!vehicleToUpdate) {
        updatingVehiclesRef.current.delete(id);
        addToast(t('toast.vehicleNotFound'), 'error');
        return;
      }

      const updatedVehicle = { ...vehicleToUpdate, ...updates };
      const { updateVehicle: updateVehicleApi } = await import('../services/vehicleService');
      const result = await updateVehicleApi(updatedVehicle);

      setVehicles(prev =>
        Array.isArray(prev) ? prev.map(vehicle => (vehicle && vehicle.id === id ? result : vehicle)) : []
      );
      syncVehicleCachesById(id, () => result);

      const wasFeatured = Boolean(vehicleToUpdate.isFeatured);
      const isNowFeatured = Boolean(result?.isFeatured);
      const statusChanged = updates.status !== undefined && updates.status !== vehicleToUpdate.status;
      const { successMessage, skipToast } = options;
      let fallbackMessage = t('toast.vehicleUpdatedSuccess');
      if (statusChanged) {
        fallbackMessage = t('toast.vehicleStatusUpdated', { status: String(updates.status) });
      } else if (!wasFeatured && isNowFeatured) {
        fallbackMessage = t('toast.vehicleFeaturedSuccess');
      } else if (wasFeatured && !isNowFeatured) {
        fallbackMessage = t('toast.vehicleUnfeaturedSuccess');
      }

      // Log audit entry for vehicle update
      const actor = currentUser?.name || currentUser?.email || 'System';
      const updateFields = Object.keys(updates).join(', ');
      const vehicleInfo = `${vehicleToUpdate.make} ${vehicleToUpdate.model} (ID: ${id})`;
      const entry = logAction(actor, 'Update Vehicle', vehicleInfo, `Updated fields: ${updateFields}`);
      setAuditLog(prev => [entry, ...prev]);

      if (!skipToast) {
        addToast(successMessage ?? fallbackMessage, 'success');
      }
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Vehicle updated via API:', result);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Failed to update vehicle:', error);
      }
      addToast(t('toast.vehicleUpdateFailed'), 'error');
    } finally {
      // Always remove from updating set, even if there was an error
      updatingVehiclesRef.current.delete(id);
    }
    // PERFORMANCE: Setters (setVehicles, setAuditLog) are stable and don't need to be in deps
    // But including them is harmless and makes the intent clear
  }, [vehicles, addToast, currentUser, t, syncVehicleCachesById]);

  const contextValue: AppContextType = useMemo(() => {
    const inboxMarkRead: { fn?: AppContextType['markAsRead'] } = {};
    return {
    // State
    currentView,
    previousView,
    selectedVehicle,
    vehicles,
    isLoading,
    vehiclesCatalogReady,
    currentUser,
    comparisonList,
    ratings,
    sellerRatings,
    wishlist,
    conversations,
    toasts,
    forgotPasswordRole,
    typingStatus,
    chatPeerOnlineByConversationId,
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
    notifications,

    // Actions
    setCurrentView,
    setPreviousView,
    setSelectedVehicle,
    setVehicles: setVehicles as (vehicles: Vehicle[] | ((prev: Vehicle[]) => Vehicle[])) => void,
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
    handleLogout,
    handleLogin,
    handleRegister,
    navigate,
    goBack,
    refreshVehicles,

    // Admin functions
      onAdminUpdateUser: async (email: string, details: Partial<User>) => {
        // Separate null values (to be removed) from regular updates
        const updateFields: Partial<User> = {};
        const fieldsToRemove: (keyof User)[] = [];
        
        Object.entries(details).forEach(([key, value]) => {
          const typedKey = key as keyof User;
          if (value === null) {
            fieldsToRemove.push(typedKey);
          } else if (value !== undefined) {
            // Type-safe assignment - TypeScript will catch invalid keys
            (updateFields as Record<string, unknown>)[key] = value;
          }
        });

      setUsers(prev =>
        Array.isArray(prev) ? prev.map(user => {
          if (user && user.email === email) {
            // Deep merge verificationStatus if it exists in updateFields
            let updatedUser = { ...user };
            
            if (updateFields.verificationStatus) {
              // Merge verificationStatus whether it exists in user or not
              updatedUser = {
                ...updatedUser,
                ...updateFields,
                verificationStatus: {
                  ...(user.verificationStatus || {}),
                  ...updateFields.verificationStatus
                }
              };
            } else {
              updatedUser = { ...updatedUser, ...updateFields };
            }
            
            // Also merge individual verification fields if they exist in updateFields
            if (updateFields.phoneVerified !== undefined) {
              updatedUser.phoneVerified = updateFields.phoneVerified;
            }
            if (updateFields.emailVerified !== undefined) {
              updatedUser.emailVerified = updateFields.emailVerified;
            }
            if (updateFields.govtIdVerified !== undefined) {
              updatedUser.govtIdVerified = updateFields.govtIdVerified;
            }
            
              // Remove fields that are set to null
              fieldsToRemove.forEach(key => {
                delete (updatedUser as Record<string, unknown>)[key];
              });
            
            // Also update publicSellerProfile if this is the currently viewed seller
            if (publicSellerProfile?.email === email) {
              setPublicSellerProfile(updatedUser);
            }
            
            return updatedUser;
          }
          return user;
        }) : []
      );
      // Optimistically sync user caches so admin edits reflect immediately.
      if (Object.keys(updateFields).length > 0) {
        syncUserCachesByEmail(email, updateFields);
      }
      
      // Also update in API - pass both updates and nulls
      try {
        const { updateUser: updateUserService } = await import('../services/userService');
        
          // Ensure verificationStatus is properly structured for API
          const apiUpdateData: Partial<User> & { email: string } = { email, ...details };
        
        // If verificationStatus is being updated, ensure it's properly formatted
        if (details.verificationStatus) {
          apiUpdateData.verificationStatus = details.verificationStatus;
        }
        
        // Ensure individual verification fields are also included
        if (details.phoneVerified !== undefined) {
          apiUpdateData.phoneVerified = details.phoneVerified;
        }
        if (details.emailVerified !== undefined) {
          apiUpdateData.emailVerified = details.emailVerified;
        }
        if (details.govtIdVerified !== undefined) {
          apiUpdateData.govtIdVerified = details.govtIdVerified;
        }
        
        await updateUserService(apiUpdateData);
        
        // CRITICAL: Refresh users list from API after successful update to ensure sync
        try {
          const { getUsers: getUsersService } = await import('../services/userService');
          const refreshedUsers = await getUsersService();
          
          // Update the users state with fresh data from API
          setUsers(refreshedUsers);
          
          // Also update all user caches immediately
          syncAllUserCaches(refreshedUsers);
          
          console.log('✅ Users list refreshed from API after verification update');
        } catch (refreshError) {
          console.warn('⚠️ Failed to refresh users list after update:', refreshError);
          // Don't fail the update if refresh fails - the API update already succeeded
          // The error is logged but not thrown to prevent breaking the update flow
        }
      } catch (error) {
        console.error('❌ Failed to sync user update to API:', error);
        addToast(
          t('toast.vehicleSyncFailedDetail', {
            detail: error instanceof Error ? error.message : t('toast.unknownError'),
          }),
          'error',
        );
        // Don't throw - local state is already updated
      }
      
      // Log audit entry for user update
      const actor = currentUser?.name || currentUser?.email || 'System';
      const updateFieldsList = Object.keys(updateFields).join(', ');
      const entry = logAction(actor, 'Update User', email, `Updated fields: ${updateFieldsList}`);
      setAuditLog(prev => [entry, ...prev]);
      
      addToast(t('toast.userUpdated', { email }), 'success');
    },
    onCreateUser: async (userData: Omit<User, 'status'>): Promise<{ success: boolean, reason: string }> => {
      try {
        // Check if user already exists
        const existingUser = Array.isArray(users) ? users.find(u => u && u.email && u.email.toLowerCase() === userData.email.toLowerCase()) : undefined;
        if (existingUser) {
          return { success: false, reason: 'User with this email already exists.' };
        }

        // CRITICAL FIX: Create user in Supabase FIRST (real-time), then sync to local state only on success
        try {
          const { authenticatedFetch } = await import('../utils/authenticatedFetch');
          const { handleApiResponse } = await import('../utils/authenticatedFetch');
          
          const response = await authenticatedFetch('/api/main', {
            method: 'POST',
            skipAuth: true, // Registration doesn't require auth
            body: JSON.stringify({
              action: 'register',
              email: userData.email,
              password: userData.password,
              name: userData.name,
              mobile: userData.mobile,
              role: userData.role,
            }),
          });
          
          const apiResult = await handleApiResponse(response);
          
          if (!apiResult.success || !response.ok) {
            const errorReason = apiResult.reason || 'Unknown error';
            console.error('❌ Failed to create user in Supabase:', errorReason);
            addToast(t('toast.userCreateFailedDetail', { reason: errorReason }), 'error');
            // Don't create locally - Supabase creation failed
            throw new Error(errorReason);
          }
          
          // Supabase creation succeeded - NOW update local state
          const createdUser = apiResult.data?.user || {
            ...userData,
            status: 'active',
            subscriptionPlan: userData.subscriptionPlan || 'free',
            featuredCredits: userData.featuredCredits || 0,
            usedCertifications: userData.usedCertifications || 0,
          };

          // User row is already persisted by POST /api/users (register); do not insert again from the
          // browser (anon client would fail RLS or duplicate the row).
          
          const nextUsers = [...(Array.isArray(users) ? users : []), createdUser];
          setUsers(nextUsers);
          syncAllUserCaches(nextUsers);
          
          // Save to localStorage after Supabase success (dev browser only — not Capacitor localhost)
          const isDevelopment = !isCapacitorNative() &&
            (isDevelopmentEnvironment() || window.location.hostname === 'localhost');
          if (isDevelopment) {
            try {
              const { getUsersLocal } = await import('../services/userService');
              const users = await getUsersLocal();
              users.push(createdUser);
              localStorage.setItem('reRideUsers', JSON.stringify(users));
            } catch (localError) {
              console.warn('⚠️ Failed to save user to localStorage:', localError);
            }
          }
          
          console.log('✅ User created and saved to Supabase:', createdUser.email);
          addToast(t('toast.userCreated', { name: createdUser.name }), 'success');
          
          // Log audit entry for user creation (inside try block where createdUser is in scope)
          const actor = currentUser?.name || currentUser?.email || 'System';
          const entry = logAction(actor, 'Create User', createdUser.email, `Created user: ${createdUser.name} (${createdUser.role})`);
          setAuditLog(prev => [entry, ...prev]);
        } catch (apiError) {
          console.error('❌ Error creating user in Supabase:', apiError);
          const errorMsg = apiError instanceof Error ? apiError.message : 'Failed to create user';
          addToast(t('toast.userCreateFailedDetail', { reason: errorMsg }), 'error');
          // Don't create locally - Supabase creation failed
          throw apiError;
        }
        
        return { success: true, reason: '' };
      } catch (error) {
        console.error('Error creating user:', error);
        return { success: false, reason: error instanceof Error ? error.message : 'Failed to create user.' };
      }
    },
          onUpdateUserPlan: async (email: string, plan: SubscriptionPlan) => {
        try {
          // Use the updateUser function defined later in contextValue
          const { updateUser: updateUserService } = await import('../services/userService');
          await updateUserService({ email, subscriptionPlan: plan });
          setUsers(prev => Array.isArray(prev) ? prev.map(user => 
            user && user.email === email ? { ...user, subscriptionPlan: plan } : user
          ) : []);
          syncUserCachesByEmail(email, { subscriptionPlan: plan });
          
          // Log audit entry for plan update
          const actor = currentUser?.name || currentUser?.email || 'System';
          const user = Array.isArray(users) ? users.find(u => u && u.email === email) : undefined;
          const previousPlan = user?.subscriptionPlan || 'unknown';
          const entry = logAction(actor, 'Update User Plan', email, `Changed plan from ${previousPlan} to ${plan}`);
          setAuditLog(prev => [entry, ...prev]);
          
          addToast(t('toast.planUpdated', { email }), 'success');
        } catch (error) {
          logError('Failed to update user plan:', error);
          const message = getUserFriendlyErrorMessage(error, i18n.t('toast.planUpdateFailed'));
          addToast(message, 'error');
        }
      },
      onToggleUserStatus: async (email: string) => {
        try {
          const user = Array.isArray(users) ? users.find(u => u && u.email === email) : undefined;
          if (!user) return;
          
          const newStatus = user.status === 'active' ? 'inactive' : 'active';
          // Use the updateUser function defined later in contextValue
          const { updateUser: updateUserService } = await import('../services/userService');
          await updateUserService({ email, status: newStatus });
          setUsers(prev => Array.isArray(prev) ? prev.map(user => 
            user && user.email === email ? { ...user, status: newStatus } : user
          ) : []);
          syncUserCachesByEmail(email, { status: newStatus });
          
          // Log audit entry for user status toggle
          const actor = currentUser?.name || currentUser?.email || 'System';
          const entry = logAction(actor, 'Toggle User Status', email, `Changed status from ${user.status} to ${newStatus}`);
          setAuditLog(prev => [entry, ...prev]);
          
          addToast(t('toast.userStatusToggled', { email }), 'success');
        } catch (error) {
          console.error('Failed to toggle user status:', error);
          addToast(t('toast.userStatusToggleFailed'), 'error');
        }
      },
      onToggleVehicleStatus: async (vehicleId: number) => {
        try {
          const vehicle = Array.isArray(vehicles) ? vehicles.find(v => v && v.id === vehicleId) : undefined;
          if (!vehicle) return;
          
          const newStatus = vehicle.status === 'published' ? 'unpublished' : 'published';
          await updateVehicleHandler(vehicleId, { status: newStatus });
          
          // Log audit entry for vehicle status toggle
          const actor = currentUser?.name || currentUser?.email || 'System';
          const vehicleInfo = `${vehicle.make} ${vehicle.model} (ID: ${vehicleId})`;
          const entry = logAction(actor, 'Toggle Vehicle Status', vehicleInfo, `Changed status from ${vehicle.status} to ${newStatus}`);
          setAuditLog(prev => [entry, ...prev]);
        } catch (error) {
          logError('Failed to toggle vehicle status:', error);
          const message = getUserFriendlyErrorMessage(error, i18n.t('toast.vehicleStatusUpdateFailed'));
          addToast(message, 'error');
        }
      },
      onToggleVehicleFeature: async (vehicleId: number) => {
        try {
          const vehicle = Array.isArray(vehicles) ? vehicles.find(v => v && v.id === vehicleId) : undefined;
          if (!vehicle) {
            addToast(t('toast.vehicleNotFound'), 'error');
            return;
          }

          // Unfeature path: simple toggle off
          if (vehicle.isFeatured) {
            await updateVehicleHandler(vehicleId, { isFeatured: false });
            
            // Log audit entry for vehicle unfeature
            const actor = currentUser?.name || currentUser?.email || 'System';
            const vehicleInfo = `${vehicle.make} ${vehicle.model} (ID: ${vehicleId})`;
            const entry = logAction(actor, 'Unfeature Vehicle', vehicleInfo, 'Vehicle unfeatured');
            setAuditLog(prev => [entry, ...prev]);
            
            return;
          }

          // Feature path: use API to enforce credits
          const { authenticatedFetch } = await import('../utils/authenticatedFetch');
          const response = await authenticatedFetch('/api/vehicles?action=feature', {
            method: 'POST',
            body: JSON.stringify({ vehicleId })
          });

          const responseText = await response.text();
          let result: FeatureApiResponse = {};
          if (responseText) {
            try {
              result = JSON.parse(responseText) as FeatureApiResponse;
            } catch (parseError) {
              logWarn('⚠️ Failed to parse feature response JSON:', parseError);
            }
          }

          if (!response.ok) {
            const message =
              result?.reason ||
              result?.error ||
              `Failed to feature vehicle (HTTP ${response.status})`;
            addToast(message, response.status === 403 ? 'warning' : 'error');
            return;
          }

          if (result?.alreadyFeatured) {
            addToast(t('toast.vehicleAlreadyFeatured'), 'info');
            return;
          }

          if (result?.success && result.vehicle) {
            const updatedVehicle = result.vehicle;
            setVehicles(prev =>
              Array.isArray(prev) ? prev.map(v => (v && v.id === vehicleId ? updatedVehicle : v)).filter((v): v is Vehicle => v !== undefined && v !== null) : []
            );

            const sellerEmail = result.vehicle?.sellerEmail;
            if (typeof result.remainingCredits === 'number' && sellerEmail) {
              const remainingCredits = result.remainingCredits;

              setUsers(prev =>
                Array.isArray(prev) ? prev.map(user =>
                  user && user.email === sellerEmail
                    ? { ...user, featuredCredits: remainingCredits }
                    : user
                ) : []
              );

              setCurrentUser(prev =>
                prev && prev.email === sellerEmail
                  ? { ...prev, featuredCredits: remainingCredits }
                  : prev
              );

              // Log audit entry for vehicle feature
              const actor = currentUser?.name || currentUser?.email || 'System';
              const vehicleInfo = `${result.vehicle.make} ${result.vehicle.model} (ID: ${vehicleId})`;
              const entry = logAction(actor, 'Feature Vehicle', vehicleInfo, `Featured vehicle. Credits remaining: ${remainingCredits}`);
              setAuditLog(prev => [entry, ...prev]);

              addToast(t('toast.vehicleFeaturedWithCredits', { credits: remainingCredits }), 'success');
            } else {
              // Log audit entry for vehicle feature
              const actor = currentUser?.name || currentUser?.email || 'System';
              const vehicleInfo = vehicle ? `${vehicle.make} ${vehicle.model} (ID: ${vehicleId})` : `Vehicle #${vehicleId}`;
              const entry = logAction(actor, 'Feature Vehicle', vehicleInfo, 'Vehicle featured successfully');
              setAuditLog(prev => [entry, ...prev]);
              
              addToast(t('toast.vehicleFeaturedSuccess'), 'success');
            }
          } else {
            addToast(t('toast.featureVehicleFailed'), 'error');
          }
        } catch (error) {
          console.error('Failed to toggle vehicle feature:', error);
          addToast(t('toast.featureStatusFailed'), 'error');
        }
      },
    onResolveFlag: async (type: 'vehicle' | 'conversation', id: number | string) => {
      try {
        if (type === 'vehicle') {
          const vehicle = Array.isArray(vehicles) ? vehicles.find(v => v.id === id) : undefined;
          if (!vehicle) {
            addToast(t('toast.vehicleNotFound'), 'error');
            return;
          }

          const updatedVehicle = { ...vehicle, isFlagged: false };
          await dataService.updateVehicle(updatedVehicle);
          setVehicles(prev => Array.isArray(prev) ? prev.map(v =>
            v && v.id === id ? updatedVehicle : v
          ) : []);

          const actor = currentUser?.name || currentUser?.email || 'System';
          const targetInfo = `${vehicle.make} ${vehicle.model} (ID: ${id})`;
          const entry = logAction(actor, 'Resolve Flag', targetInfo, `Resolved flag on ${type}`);
          setAuditLog(prev => [entry, ...prev]);
        } else {
          const conversation = Array.isArray(conversations) ? conversations.find(conv => conv && conv.id === id) : undefined;
          if (!conversation) {
            addToast(t('toast.conversationNotFound'), 'error');
            return;
          }

          const updatedConversation = { ...conversation, isFlagged: false };
          const { saveConversationToSupabase } = await import('../services/conversationService');
          const result = await saveConversationToSupabase(updatedConversation);
          if (!result.success) {
            throw new Error(result.error || 'Failed to update conversation');
          }

          setConversations(prev => Array.isArray(prev) ? prev.map(conv =>
            conv && conv.id === id ? updatedConversation : conv
          ) : []);

          const actor = currentUser?.name || currentUser?.email || 'System';
          const entry = logAction(actor, 'Resolve Flag', `Conversation ${id}`, `Resolved flag on ${type}`);
          setAuditLog(prev => [entry, ...prev]);
        }
        addToast(
          type === 'vehicle' ? t('toast.flagResolvedVehicle') : t('toast.flagResolvedConversation'),
          'success',
        );
      } catch (error) {
        console.error('Failed to resolve flag:', error);
        addToast(
          type === 'vehicle' ? t('toast.flagResolveFailedVehicle') : t('toast.flagResolveFailedConversation'),
          'error',
        );
      }
    },
    onUpdateSettings: async (settings: PlatformSettings) => {
      // Optimistic local update + cache write so the current tab reflects the
      // change immediately even if the API round-trip is slow.
      setPlatformSettings(settings);
      saveSettings(settings);

      const actor = currentUser?.name || currentUser?.email || 'System';
      const changedSettings = Object.keys(settings).join(', ');

      try {
        const persisted = await updateSettings(settings);
        // Replace with the server's canonical copy (includes server-side
        // normalization like Math.max(0, Math.floor(listingFee))).
        setPlatformSettings(persisted);

        const entry = logAction(actor, 'Update Platform Settings', 'Platform', `Updated settings: ${changedSettings}`);
        setAuditLog(prev => [entry, ...prev]);
        addToast(t('toast.settingsUpdated'), 'success');
      } catch (error) {
        logError('Failed to persist platform settings to API:', error);
        // Even on API failure, keep the local change and still log it.
        const entry = logAction(
          actor,
          'Update Platform Settings',
          'Platform',
          `Updated settings locally (API sync failed): ${changedSettings}`,
        );
        setAuditLog(prev => [entry, ...prev]);
        addToast(
          t('toast.settingsUpdatedLocalOnly') || 'Settings saved locally but failed to sync with server.',
          'error',
        );
      }
    },
    onSendBroadcast: (message: string) => {
      setNotifications(prev => [...prev, {
        id: Date.now(),
        recipientEmail: 'all',
        message,
        targetId: 'broadcast',
        targetType: 'general_admin' as const,
        timestamp: new Date().toISOString(),
        isRead: false
      }]);
      
      // Log audit entry for broadcast
      const actor = currentUser?.name || currentUser?.email || 'System';
      const messagePreview = message.length > 50 ? message.substring(0, 50) + '...' : message;
      const entry = logAction(actor, 'Send Broadcast', 'All Users', `Message: ${messagePreview}`);
      setAuditLog(prev => [entry, ...prev]);
      
      addToast(t('toast.broadcastSent'), 'success');
    },
    onExportUsers: () => {
      try {
        const headers = 'Name,Email,Role,Status,Mobile,Join Date\n';
        const csv = Array.isArray(users) ? users.map(user => 
          `"${user.name}","${user.email}","${user.role}","${user.status}","${user.mobile || ''}","${user.joinedDate || ''}"`
        ).join('\n') : '';
        const fullCsv = headers + csv;
        const blob = new Blob([fullCsv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Log audit entry for export
        const actor = currentUser?.name || currentUser?.email || 'System';
        const entry = logAction(actor, 'Export Users', 'Users Data', `Exported ${users.length} users to CSV`);
        setAuditLog(prev => [entry, ...prev]);
        
        addToast(t('toast.exportUsersSuccess', { count: users.length }), 'success');
      } catch (error) {
        console.error('Export failed:', error);
        addToast(t('toast.exportFailed'), 'error');
      }
    },
    onImportUsers: async (usersToImport: Omit<User, 'id'>[]) => {
      try {
        const { dataService } = await import('../services/dataService');
        let successCount = 0;
        let errorCount = 0;
        
        for (const userData of usersToImport) {
          try {
            // Generate a default password for imported users (they can reset it)
            const defaultPassword = `TempPass${randomAlphanumeric(10)}`;
            
            // Create user via API register endpoint
            const response = await fetch('/api/users', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'register',
                email: userData.email,
                password: defaultPassword, // Temporary password
                name: userData.name,
                mobile: userData.mobile,
                role: userData.role,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch((error) => {
                logWarn('Failed to parse error response:', error);
                return { reason: 'Unknown error' };
              });
              throw new Error(errorData.reason || `Failed to create user: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (!result.success) {
              throw new Error(result.reason || 'Failed to create user');
            }

            // If user was created successfully, update additional fields if provided
            if (userData.dealershipName || userData.bio || userData.subscriptionPlan || 
                userData.isVerified !== undefined || userData.location) {
              try {
                const updateResponse = await fetch('/api/users', {
                  method: 'PUT',
                  headers: {
                    ...getAuthHeaders(),
                  },
                  body: JSON.stringify({
                    email: userData.email,
                    ...(userData.dealershipName && { dealershipName: userData.dealershipName }),
                    ...(userData.bio && { bio: userData.bio }),
                    ...(userData.subscriptionPlan && { subscriptionPlan: userData.subscriptionPlan }),
                    ...(userData.isVerified !== undefined && { isVerified: userData.isVerified }),
                    ...(userData.location && { location: userData.location }),
                    ...(userData.phoneVerified !== undefined && { phoneVerified: userData.phoneVerified }),
                    ...(userData.emailVerified !== undefined && { emailVerified: userData.emailVerified }),
                    ...(userData.featuredCredits !== undefined && { featuredCredits: userData.featuredCredits }),
                    ...(userData.usedCertifications !== undefined && { usedCertifications: userData.usedCertifications }),
                    ...(userData.avatarUrl && { avatarUrl: userData.avatarUrl }),
                    ...(userData.logoUrl && { logoUrl: userData.logoUrl }),
                    ...(userData.status && { status: userData.status }),
                  }),
                });

                if (!updateResponse.ok) {
                  console.warn(`Failed to update additional fields for ${userData.email}, but user was created`);
                }
              } catch (updateError) {
                console.warn(`Failed to update additional fields for ${userData.email}:`, updateError);
                // Don't throw - user was created successfully
              }
            }

            successCount++;
          } catch (error) {
            errorCount++;
            console.error(`Failed to import user ${userData.name} (${userData.email}):`, error);
            throw error; // Re-throw to be caught by the modal
          }
        }
        
        // Refresh users list
        const updatedUsers = await dataService.getUsers();
        setUsers(updatedUsers);
        syncAllUserCaches(updatedUsers);
        
        // Log audit entry for import
        const actor = currentUser?.name || currentUser?.email || 'System';
        const entry = logAction(actor, 'Import Users', 'Users Data', `Imported ${successCount} users from CSV`);
        setAuditLog(prev => [entry, ...prev]);
        
        if (successCount > 0) {
          addToast(t('toast.importUsersSuccess', { count: successCount }), 'success');
        }
        if (errorCount > 0) {
          addToast(t('toast.importUsersPartialWarning', { count: errorCount }), 'warning');
        }
      } catch (error) {
        console.error('Import failed:', error);
        throw error; // Re-throw to be handled by the modal
      }
    },
    onExportVehicles: () => {
      try {
        const headers = 'Make,Model,Year,Price,Seller,Status,Mileage,Location,Features\n';
        const csv = Array.isArray(vehicles) ? vehicles.map(vehicle => 
          `"${vehicle.make}","${vehicle.model}","${vehicle.year}","${vehicle.price}","${vehicle.sellerEmail}","${vehicle.status}","${vehicle.mileage || ''}","${vehicle.location || ''}","${vehicle.features?.join('; ') || ''}"`
        ).join('\n') : '';
        const fullCsv = headers + csv;
        const blob = new Blob([fullCsv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vehicles_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Log audit entry for export
        const actor = currentUser?.name || currentUser?.email || 'System';
        const entry = logAction(actor, 'Export Vehicles', 'Vehicles Data', `Exported ${vehicles.length} vehicles to CSV`);
        setAuditLog(prev => [entry, ...prev]);
        
        addToast(t('toast.exportVehiclesSuccess', { count: vehicles.length }), 'success');
      } catch (error) {
        console.error('Export failed:', error);
        addToast(t('toast.exportFailed'), 'error');
      }
    },
    onImportVehicles: async (vehiclesToImport: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>[]) => {
      try {
        const { addVehicle } = await import('../services/dataService');
        let successCount = 0;
        let errorCount = 0;
        
        for (const vehicleData of vehiclesToImport) {
          try {
            // Normalize images to array if needed
          const normalizedImages = Array.isArray(vehicleData.images) 
              ? vehicleData.images 
              : typeof vehicleData.images === 'string' 
                ? [vehicleData.images] 
                : [];
            
            const vehicleToAdd = {
              ...vehicleData,
              images: normalizedImages,
            } as Vehicle;
            
            await addVehicle(vehicleToAdd);
            successCount++;
          } catch (error) {
            errorCount++;
            console.error(`Failed to import vehicle ${vehicleData.make} ${vehicleData.model}:`, error);
            throw error; // Re-throw to be caught by the modal
          }
        }
        
        // Refresh vehicles list
        const { dataService } = await import('../services/dataService');
        const isAdmin = currentUser?.role === 'admin';
        const updatedVehicles = await dataService.getVehicles(isAdmin);
        setVehicles(updatedVehicles);
        
        // Log audit entry for import
        const actor = currentUser?.name || currentUser?.email || 'System';
        const entry = logAction(actor, 'Import Vehicles', 'Vehicles Data', `Imported ${successCount} vehicles from CSV`);
        setAuditLog(prev => [entry, ...prev]);
        
        if (successCount > 0) {
          addToast(t('toast.importVehiclesSuccess', { count: successCount }), 'success');
        }
        if (errorCount > 0) {
          addToast(t('toast.importVehiclesPartialWarning', { count: errorCount }), 'warning');
        }
      } catch (error) {
        console.error('Import failed:', error);
        throw error; // Re-throw to be handled by the modal
      }
    },
    onExportSales: () => {
      try {
        const soldVehicles = Array.isArray(vehicles) ? vehicles.filter(v => v && v.status === 'sold') : [];
        const headers = 'Make,Model,Year,Sale Price,Seller,Buyer,Sale Date\n';
        const csv = soldVehicles.map(vehicle => 
          `"${vehicle.make}","${vehicle.model}","${vehicle.year}","${vehicle.price}","${vehicle.sellerEmail}","N/A","N/A"`
        ).join('\n');
        const fullCsv = headers + csv;
        const blob = new Blob([fullCsv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sales_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Log audit entry for export
        const actor = currentUser?.name || currentUser?.email || 'System';
        const entry = logAction(actor, 'Export Sales', 'Sales Data', `Exported ${soldVehicles.length} sales records to CSV`);
        setAuditLog(prev => [entry, ...prev]);
        
        addToast(t('toast.exportSalesSuccess', { count: soldVehicles.length }), 'success');
      } catch (error) {
        console.error('Export failed:', error);
        addToast(t('toast.exportFailed'), 'error');
      }
    },
    onUpdateVehicleData: async (newData: VehicleData) => {
      try {
        // CRITICAL FIX: Update Supabase FIRST (real-time), then sync to local state only on success
        const { saveVehicleData } = await import('../services/vehicleDataService');
        const success = await saveVehicleData(newData);
        
        if (!success) {
          // Supabase update failed - don't update local state
          addToast(t('toast.vehicleDataUpdateFailed'), 'error');
          throw new Error('Failed to update vehicle data in Supabase');
        }
        
        // Supabase update succeeded - NOW update local state
        setVehicleData(newData);

        // Invalidate the VehicleList filter cache (5-min TTL) and notify any
        // listeners (public site filters, other tabs) so they pick up the new
        // makes / models / variants immediately instead of serving stale data.
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('reRideVehicleDataFilters');
            localStorage.setItem('reRideVehicleData', JSON.stringify(newData));
          }
        } catch {
          /* storage unavailable */
        }
        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('vehicleDataUpdated', { detail: { vehicleData: newData } })
            );
          }
        } catch {
          /* ignore */
        }

        // Log audit entry for vehicle data update
        const actor = currentUser?.name || currentUser?.email || 'System';
        const entry = logAction(actor, 'Update Vehicle Data', 'Vehicle Data', 'Updated vehicle data configuration');
        setAuditLog(prev => [entry, ...prev]);

        addToast(t('toast.vehicleDataUpdated'), 'success');
        console.log('✅ Vehicle data updated via API:', newData);
      } catch (error) {
        // Error already handled with specific toast message in inner catch block (line 1908)
        // Only log here to avoid duplicate error toasts
        console.error('❌ Failed to update vehicle data:', error);
        // Don't show generic toast - inner catch already showed specific error message
        // Don't update local state - Supabase update failed
        throw error;
      }
    },
    onToggleVerifiedStatus: async (email: string) => {
      // Previously this only mutated local state + in-memory caches, so the
      // verification badge would reset on refresh. Now the toggle persists to
      // Supabase through the `/api/users` endpoint (which writes to the
      // `users.is_verified` column).
      const targetUser = Array.isArray(users) ? users.find(u => u && u.email === email) : undefined;
      if (!targetUser) {
        addToast(t('toast.userNotFound', { email }) || `User not found: ${email}`, 'error');
        return;
      }
      const nextValue = !targetUser.isVerified;

      // Optimistic local update so the admin UI reacts immediately.
      setUsers(prev => Array.isArray(prev) ? prev.map(user =>
        user && user.email === email ? { ...user, isVerified: nextValue } : user
      ) : []);
      syncUserCachesByEmail(email, { isVerified: nextValue });

      try {
        const { updateUser: updateUserService } = await import('../services/userService');
        await updateUserService({ email, isVerified: nextValue });
        addToast(t('toast.verificationToggled', { email }), 'success');
      } catch (error) {
        // Roll back on failure so the admin sees the true server state.
        setUsers(prev => Array.isArray(prev) ? prev.map(user =>
          user && user.email === email ? { ...user, isVerified: targetUser.isVerified } : user
        ) : []);
        syncUserCachesByEmail(email, { isVerified: targetUser.isVerified });
        console.error('❌ Failed to persist isVerified to backend:', error);
        addToast(
          t('toast.verificationToggleFailed', { email }) ||
            `Failed to update verification status for ${email}. Please try again.`,
          'error',
        );
      }
    },
    onUpdateSupportTicket: async (ticket: SupportTicket) => {
      try {
        // Persist to API first, then sync local state
        const success = await updateSupportTicketInSupabase(ticket);
        if (!success) {
          throw new Error('Failed to update support ticket in Supabase');
        }

        setSupportTickets(prev => Array.isArray(prev) ? prev.map(t =>
          t && String(t.id) === String(ticket.id) ? ticket : t
        ) : []);
        addToast(t('toast.supportTicketUpdated'), 'success');
      } catch (error) {
        console.error('Failed to update support ticket:', error);
        addToast(t('toast.supportTicketUpdateFailed'), 'error');
        throw error;
      }
    },
    onAddFaq: async (faq: Omit<FAQItem, 'id'>) => {
      try {
        // CRITICAL FIX: Save to Supabase FIRST (real-time), then sync to local state only on success
        const { saveFaqToSupabase } = await import('../services/faqService');
        const savedFaq = await saveFaqToSupabase(faq);
        
        if (!savedFaq) {
          throw new Error('Failed to save FAQ to Supabase');
        }
        
        // Supabase save succeeded - NOW update local state
        const newFaq: FAQItem = savedFaq || { ...faq, id: Date.now() };
        
        setFaqItems(prev => {
          const updated = [...prev, newFaq];
          saveFaqs(updated);
          return updated;
        });
        
        addToast(t('toast.faqAdded'), 'success');
      } catch (error) {
        console.error('❌ Failed to add FAQ to Supabase:', error);
        addToast(t('toast.faqAddFailed'), 'error');
        // Don't add locally - Supabase creation failed
        throw error;
      }
    },
    onUpdateFaq: async (faq: FAQItem) => {
      try {
        if (!faq.id) {
          throw new Error('FAQ ID is required for update');
        }
        
        // CRITICAL FIX: Update Supabase FIRST (real-time), then sync to local state only on success
        const { updateFaqInSupabase } = await import('../services/faqService');
        const success = await updateFaqInSupabase(faq);
        
        if (!success) {
          throw new Error('Failed to update FAQ in Supabase');
        }
        
        // Supabase update succeeded - NOW update local state
        setFaqItems(prev => {
          const updated = Array.isArray(prev) ? prev.map(f => {
            if (f && f.id === faq.id) {
              return { ...faq };
            }
            return f;
          }) : [];
          saveFaqs(updated);
          return updated;
        });
        addToast(t('toast.faqUpdated'), 'success');
      } catch (error) {
        console.error('❌ Failed to update FAQ in Supabase:', error);
        addToast(t('toast.faqUpdateFailed'), 'error');
        // Don't update locally - Supabase update failed
        throw error;
      }
    },
    onDeleteFaq: async (id: number) => {
      try {
        // CRITICAL FIX: Delete from Supabase FIRST (real-time), then sync to local state only on success
        const { deleteFaqFromSupabase } = await import('../services/faqService');
        const success = await deleteFaqFromSupabase(id);
        
        if (!success) {
          throw new Error('Failed to delete FAQ from Supabase');
        }
        
        // Supabase delete succeeded - NOW delete from local state
        setFaqItems(prev => {
          const updated = Array.isArray(prev) ? prev.filter(f => f && f.id !== id) : [];
          saveFaqs(updated);
          return updated;
        });
        addToast(t('toast.faqDeleted'), 'success');
      } catch (error) {
        console.error('❌ Failed to delete FAQ from Supabase:', error);
        addToast(t('toast.faqDeleteFailed'), 'error');
        // Don't delete locally - Supabase delete failed
        throw error;
      }
    },
    onCertificationApproval: async (vehicleId: number, decision: 'approved' | 'rejected') => {
      try {
        const vehicle = Array.isArray(vehicles) ? vehicles.find(v => v && v.id === vehicleId) : undefined;
        if (!vehicle) {
          addToast(t('toast.vehicleNotFound'), 'error');
          return;
        }

        const updatedVehicle: Vehicle = {
          ...vehicle,
          certificationStatus: decision === 'approved' ? 'certified' : 'rejected'
        };

        await dataService.updateVehicle(updatedVehicle);
        setVehicles(prev => Array.isArray(prev) ? prev.map(v =>
          v && v.id === vehicleId ? updatedVehicle : v
        ) : []);

        const actor = currentUser?.name || currentUser?.email || 'System';
        const vehicleInfo = `${vehicle.make} ${vehicle.model} (ID: ${vehicleId})`;
        const entry = logAction(actor, `Certification ${decision === 'approved' ? 'Approve' : 'Reject'}`, vehicleInfo, `Certification ${decision} for vehicle`);
        setAuditLog(prev => [entry, ...prev]);

        addToast(
          decision === 'approved' ? t('toast.certificationApproved') : t('toast.certificationRejected'),
          'success',
        );
      } catch (error) {
        console.error('Failed to update certification:', error);
        addToast(t('toast.certificationUpdateFailed'), 'error');
      }
    },
    
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
    sendMessage: async (conversationId: string, message: string) => {
      console.log('🔧 sendMessage called:', { conversationId, message, currentUser: currentUser?.email });
      
      if (!currentUser) {
        console.warn('⚠️ Cannot send message: no current user');
        addToast(t('toast.loginRequiredMessages'), 'error');
        return;
      }

      try {
        // Socket.io room join is instant when a dev socket exists; production uses Supabase Realtime (no wait).
        await realtimeChatService.joinConversation(conversationId);

        // Find conversation BEFORE updating state to avoid stale state issues
        const conversation = conversations.find(conv => conv.id === conversationId);
        if (!conversation) {
          console.warn('⚠️ Conversation not found:', conversationId);
          addToast(t('toast.conversationNotFoundRefresh'), 'error');
          return;
        }

        // Generate a more unique message ID to prevent collisions
        const messageId = Date.now() * 1000 + randomIntBelow(1000);

        // CRITICAL FIX: Normalize user email before creating message
        const normalizedUserEmail = (currentUser.email || '').toLowerCase().trim();
        
        const newMessage: ChatMessage = {
          id: messageId,
          sender: (currentUser.role === 'seller' ? 'seller' : 'user') as 'seller' | 'user',
          text: message,
          timestamp: new Date().toISOString(),
          isRead: false,
          type: 'text'
        };

        // Update conversations and save to localStorage immediately for instant UI update
        setConversations(prev => {
          const updated = Array.isArray(prev) ? prev.map(conv => 
            conv && conv.id === conversationId ? {
              ...conv,
              messages: Array.isArray(conv.messages) ? [...conv.messages, newMessage] : [newMessage],
              lastMessageAt: newMessage.timestamp,
              isReadBySeller: currentUser.role === 'seller' ? true : (currentUser.role === 'customer' ? false : conv.isReadBySeller),
              isReadByCustomer: currentUser.role === 'customer' ? true : (currentUser.role === 'seller' ? false : conv.isReadByCustomer)
            } : conv
          ) : [];
          
          // Save to localStorage immediately
          try {
            saveConversations(updated);
          } catch (error) {
            console.error('Failed to save conversations to localStorage:', error);
          }
          
          // Update activeChat immediately for instant UI feedback
          const updatedConversation = updated.find(conv => conv.id === conversationId);
          if (updatedConversation && activeChat?.id === conversationId) {
            setActiveChat(updatedConversation);
          }
          
          return updated;
        });

        // Send message via real-time chat service (handles WebSocket + Supabase sync)
        // CRITICAL FIX: Use normalized email
        const userEmail = normalizedUserEmail;
        const userRole = currentUser.role as 'customer' | 'seller';
        
        console.log('🔧 AppProvider: Sending message via realtimeChatService', { 
          conversationId, 
          messageId: newMessage.id, 
          userEmail, 
          userRole,
          isConnected: realtimeChatService.isConnected()
        });
        
        const sendResult = await realtimeChatService.sendMessage(conversationId, newMessage, userEmail, userRole);

        if (!sendResult.success) {
          console.error('❌ Failed to send message via real-time service:', sendResult.error);
          addToast(t('toast.failedSendMessageConnection'), 'error');
        } else if (!sendResult.persisted) {
          const retry = await addMessageWithSync(conversationId, newMessage);
          if (!retry.synced && !retry.queued) {
            console.warn('⚠️ Message may not be persisted; queue:', conversationId);
          }
        }

        // Recipient notifications are created server-side in PUT /api/conversations (see api/main.ts).
        // POST /api/notifications only allows creating rows for the authenticated user — do not duplicate here.
      } catch (error) {
        console.error('Error in sendMessage:', error);
        addToast(t('toast.failedSendMessageGeneric'), 'error');
      }
    },
    sendMessageWithType: async (conversationId: string, messageText: string, type?: ChatMessage['type'], payload?: ChatMessage['payload']) => {
      console.log('🔧 sendMessageWithType called:', { conversationId, messageText, type, payload, currentUser: currentUser?.email });
      
      if (!currentUser) {
        console.warn('⚠️ Cannot send message: no current user');
        addToast(t('toast.loginRequiredMessages'), 'error');
        return;
      }

      try {
        await realtimeChatService.joinConversation(conversationId);

        const conversation = conversations.find(
          (conv) => conv && String(conv.id) === String(conversationId)
        );
        if (!conversation) {
          console.warn('⚠️ Conversation not found:', conversationId);
          addToast(t('toast.conversationNotFoundRefresh'), 'error');
          return;
        }

        const messageId = Date.now() * 1000 + randomIntBelow(1000);
        const resolvedType = type || 'text';
        const displayText =
          resolvedType === 'image'
            ? (messageText?.trim() || '📷 Photo')
            : resolvedType === 'voice'
              ? (messageText?.trim() || '🎤 Voice message')
              : messageText;

        const newMessage: ChatMessage = {
          id: messageId,
          sender: (currentUser.role === 'seller' ? 'seller' : 'user') as 'seller' | 'user',
          text: displayText,
          timestamp: new Date().toISOString(),
          isRead: false,
          type: resolvedType,
          ...(payload && (resolvedType === 'offer' || resolvedType === 'image' || resolvedType === 'voice')
            ? { payload }
            : {}),
        };

        const normalizedUserEmail = (currentUser.email || '').toLowerCase().trim();
        const userRole = currentUser.role as 'customer' | 'seller';

        setConversations((prev) => {
          const updated = Array.isArray(prev)
            ? prev.map((conv) =>
                conv && String(conv.id) === String(conversationId)
                  ? {
                      ...conv,
                      messages: Array.isArray(conv.messages) ? [...conv.messages, newMessage] : [newMessage],
                      lastMessageAt: newMessage.timestamp,
                      isReadBySeller:
                        currentUser.role === 'seller'
                          ? true
                          : currentUser.role === 'customer'
                            ? false
                            : conv.isReadBySeller,
                      isReadByCustomer:
                        currentUser.role === 'customer'
                          ? true
                          : currentUser.role === 'seller'
                            ? false
                            : conv.isReadByCustomer,
                    }
                  : conv,
              )
            : [];
          try {
            saveConversations(updated);
          } catch (error) {
            console.error('Failed to save conversations to localStorage:', error);
          }
          const updatedConversation = updated.find((conv) => String(conv.id) === String(conversationId));
          if (updatedConversation && activeChat && String(activeChat.id) === String(conversationId)) {
            setActiveChat(updatedConversation);
          }
          return updated;
        });

        const sendResult = await realtimeChatService.sendMessage(
          conversationId,
          newMessage,
          normalizedUserEmail,
          userRole,
        );
        if (!sendResult.success) {
          addToast(t('toast.failedSendMessageConnection'), 'error');
        } else if (!sendResult.persisted) {
          await addMessageWithSync(conversationId, newMessage);
        }

        // Recipient notifications are created server-side when the message is persisted (PUT /api/conversations).
      } catch (error) {
        console.error('Error in sendMessageWithType:', error);
        addToast(t('toast.failedSendMessageGeneric'), 'error');
      }
    },
    markAsRead: (inboxMarkRead.fn = async (
      conversationId: string,
      options?: { readerRole?: 'customer' | 'seller'; forceReadState?: boolean },
    ) => {
      if (!currentUser) return;

      const conversation = conversations.find(
        (conv) => conv && String(conv.id) === String(conversationId),
      );
      if (!conversation) return;

      const readerRole = options?.readerRole ?? (currentUser.role as 'customer' | 'seller');
      const otherSender: 'user' | 'seller' = readerRole === 'customer' ? 'seller' : 'user';
      const msgs = Array.isArray(conversation.messages) ? conversation.messages : [];
      const unreadMessageIds = msgs
        .filter((msg) => msg.sender === otherSender && !msg.isRead)
        .map((msg) => msg.id);
      const forceReadState = Boolean(options?.forceReadState);
      if (unreadMessageIds.length === 0 && !forceReadState) return;
      const previousConversation = conversation;

      setConversations((prev) =>
        Array.isArray(prev)
          ? prev.map((conv) =>
              conv && String(conv.id) === String(conversationId)
                ? {
                    ...conv,
                    messages: Array.isArray(conv.messages)
                      ? conv.messages.map((msg) =>
                          msg.sender === otherSender && !msg.isRead ? { ...msg, isRead: true } : msg,
                        )
                      : [],
                    isReadBySeller: readerRole === 'seller' ? true : conv.isReadBySeller,
                    isReadByCustomer: readerRole === 'customer' ? true : conv.isReadByCustomer,
                  }
                : conv,
            )
          : [],
      );

      if (unreadMessageIds.length > 0) {
        await realtimeChatService.markAsRead(conversationId, unreadMessageIds, readerRole);
      }

      import('../services/conversationService')
        .then(({ patchConversationMarkRead, patchConversationSetThreadReadState }) =>
          unreadMessageIds.length > 0
            ? patchConversationMarkRead(conversationId, unreadMessageIds)
            : patchConversationSetThreadReadState(conversationId, readerRole, true),
        )
        .then((res) => {
          if (!res?.success && previousConversation) {
            setConversations((prev) =>
              Array.isArray(prev)
                ? prev.map((conv) =>
                    conv && String(conv.id) === String(conversationId) ? previousConversation : conv,
                  )
                : [],
            );
            addToast(res?.error || 'Failed to update read state.', 'error');
          }
        })
        .catch((err) => {
          console.warn('Persist mark-read failed (non-fatal):', err);
          if (previousConversation) {
            setConversations((prev) =>
              Array.isArray(prev)
                ? prev.map((conv) =>
                    conv && String(conv.id) === String(conversationId) ? previousConversation : conv,
                  )
                : [],
            );
          }
          addToast('Failed to update read state.', 'error');
        });
    }),
    setConversationReadState: async (
      conversationId: string,
      readerRole: 'customer' | 'seller',
      isRead: boolean,
    ) => {
      if (!currentUser) return;
      if (isRead) {
        await inboxMarkRead.fn?.(conversationId, { readerRole, forceReadState: true });
        addToast('Conversation marked as read.', 'success');
        return;
      }

      const previousConversation = conversations.find((c) => c && String(c.id) === String(conversationId)) || null;
      setConversations((prev) =>
        Array.isArray(prev)
          ? prev.map((conv) =>
              conv && String(conv.id) === String(conversationId)
                ? {
                    ...conv,
                    isReadBySeller: readerRole === 'seller' ? false : conv.isReadBySeller,
                    isReadByCustomer: readerRole === 'customer' ? false : conv.isReadByCustomer,
                  }
                : conv,
            )
          : [],
      );

      import('../services/conversationService')
        .then(({ patchConversationSetThreadReadState }) =>
          patchConversationSetThreadReadState(conversationId, readerRole, false),
        )
        .then((res) => {
          if (!res?.success) {
            if (previousConversation) {
              setConversations((prev) =>
                Array.isArray(prev)
                  ? prev.map((conv) =>
                      conv && String(conv.id) === String(conversationId) ? previousConversation : conv,
                    )
                  : [],
              );
            }
            addToast(res?.error || 'Failed to mark conversation unread.', 'error');
            return;
          }
          addToast('Conversation marked as unread.', 'success');
        })
        .catch((err) => {
          console.warn('Persist mark-unread failed (non-fatal):', err);
          if (previousConversation) {
            setConversations((prev) =>
              Array.isArray(prev)
                ? prev.map((conv) =>
                    conv && String(conv.id) === String(conversationId) ? previousConversation : conv,
                  )
                : [],
            );
          }
          addToast('Failed to mark conversation unread.', 'error');
        });
    },
    clearConversationMessages: async (conversationId: string) => {
      if (!currentUser) return;
      try {
        const { patchConversationClearMessages } = await import('../services/conversationService');
        const res = await patchConversationClearMessages(conversationId);
        if (!res.success) {
          addToast(res.error || t('toast.failedSendMessageGeneric'), 'error');
          return;
        }
        const server = res.data;
        if (!server) {
          addToast(res.error || t('toast.failedSendMessageGeneric'), 'error');
          return;
        }
        setConversations((prev) => {
          const next = Array.isArray(prev)
            ? prev.map((c) =>
                String(c.id) === String(conversationId)
                  ? {
                      ...c,
                      ...server,
                      messages: Array.isArray(server.messages) ? server.messages : c.messages,
                      customerHistoryClearedAt: server.customerHistoryClearedAt ?? c.customerHistoryClearedAt,
                      sellerHistoryClearedAt: server.sellerHistoryClearedAt ?? c.sellerHistoryClearedAt,
                    }
                  : c,
              )
            : [];
          try {
            saveConversations(next);
          } catch (e) {
            console.error('saveConversations after clear failed', e);
          }
          return next;
        });
        setActiveChat((prev) => {
          if (!prev || String(prev.id) !== String(conversationId)) return prev;
          return {
            ...prev,
            ...server,
            messages: Array.isArray(server.messages) ? server.messages : prev.messages,
            customerHistoryClearedAt: server.customerHistoryClearedAt ?? prev.customerHistoryClearedAt,
            sellerHistoryClearedAt: server.sellerHistoryClearedAt ?? prev.sellerHistoryClearedAt,
          };
        });
        addToast(
          'Chat cleared for you. The other person still sees the full history until they clear it.',
          'success',
        );
      } catch (error) {
        console.error('clearConversationMessages:', error);
        addToast(t('toast.failedSendMessageGeneric'), 'error');
      }
    },
    toggleTyping: (conversationId: string, isTyping: boolean) => {
      if (!currentUser) return;
      if (currentUser.role !== 'seller' && currentUser.role !== 'customer') return;

      const userRole = (currentUser.role === 'seller' ? 'seller' : 'customer') as 'customer' | 'seller';

      // Remote typing state comes only from Socket.io / Supabase broadcast (see onTyping).
      realtimeChatService.sendTypingIndicator(conversationId, userRole, isTyping);
    },
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
        void fetch('/api/content-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(getAuthHeaders() || {}) },
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
    updateUser: async (email: string, updates: Partial<User>) => {
      try {
        // CRITICAL: Never allow role to be updated via this function (security)
        const safeUpdates = { ...updates };
        delete safeUpdates.role; // Prevent role changes through profile updates
        const normalizedTargetEmail = String(email || '').toLowerCase().trim();
        
        // Debug logging for partnerBanks updates
        if (safeUpdates.partnerBanks !== undefined) {
          console.log('💳 Updating partnerBanks:', { email, partnerBanks: safeUpdates.partnerBanks, count: safeUpdates.partnerBanks?.length || 0 });
        }
        
        // CRITICAL FIX: Update Supabase FIRST (real-time), then sync to local state/localStorage only on success
        // This ensures password changes are persisted to Supabase immediately, not just locally
        try {
          console.log('📡 Sending user update request to API (real-time Supabase update)...', { email, hasPassword: !!updates.password });
          
          // PROACTIVE TOKEN REFRESH: For critical operations like password updates, 
          // proactively refresh token before making the request to prevent session expiration errors
          if (updates.password) {
            try {
              const { refreshAccessToken } = await import('../services/userService');
              console.log('🔄 Proactively refreshing token before password update...');
              const refreshResult = await refreshAccessToken();
              if (refreshResult.success && refreshResult.accessToken) {
                console.log('✅ Token refreshed proactively before password update');
              } else {
                console.warn('⚠️ Proactive token refresh failed, but continuing with request (will retry on 401)');
              }
            } catch (refreshError) {
              console.warn('⚠️ Error during proactive token refresh:', refreshError);
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
            }),
          });
          
          console.log('📥 API response received:', { status: response.status, ok: response.ok });
          
          // Use the response handler for consistent error handling
          const { handleApiResponse } = await import('../utils/authenticatedFetch');
          const apiResult = await handleApiResponse(response);
          
          if (!apiResult.success) {
            console.error('❌ API error response:', { status: response.status, error: apiResult.error, reason: apiResult.reason });
            
            // Handle 401 Unauthorized - token refresh should have been attempted by authenticatedFetch
            // If we still get 401, it means token refresh failed - user needs to re-login
            if (response.status === 401) {
              console.error('❌ 401 Unauthorized - Token refresh failed. Supabase update NOT saved.');
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
              console.error('❌ 500 Server Error - Supabase update failed.');
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
          console.log('✅ User updated in Supabase successfully:', { success: result?.success, hasUser: !!result?.user });
          
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
                    console.log('✅ Updated users array with partnerBanks:', { email, partnerBanks: merged.partnerBanks });
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
                console.warn('Failed to update localStorage with API response:', error);
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
                console.warn('Failed to update localStorage with fallback update:', error);
              }
            }
          }
          
          // Also update the localStorage users array after Supabase success
          try {
            const { updateUser: updateUserService } = await import('../services/userService');
            await updateUserService({ email, ...safeUpdates });
            console.log('✅ User updated in localStorage users array (after Supabase success)');
          } catch (localError) {
            console.warn('⚠️ Failed to update user in localStorage users array:', localError);
            // Try manual update as fallback
            try {
              const usersJson = localStorage.getItem('reRideUsers');
              if (usersJson) {
                const users = JSON.parse(usersJson);
                const updatedUsers = users.map((user: User) => 
                  String(user.email || '').toLowerCase().trim() === normalizedTargetEmail
                    ? { ...user, ...safeUpdates }
                    : user
                );
                localStorage.setItem('reRideUsers', JSON.stringify(updatedUsers));
                console.log('✅ User updated in localStorage (manual fallback)');
              }
            } catch (fallbackError) {
              console.error('❌ Failed to update user in localStorage (fallback):', fallbackError);
            }
          }

          // Keep all known users caches in sync immediately.
          syncUserCachesByEmail(email, safeUpdates);
          
          // Show success message
          if (updates.password) {
            addToast(t('toast.passwordUpdatedSuccess'), 'success');
          } else {
            addToast(t('toast.profileUpdatedSuccess'), 'success');
          }
          
        } catch (apiError) {
          console.error('❌ API error during user update - Supabase update FAILED:', apiError);
          
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
              console.error('❌ Supabase connection failed:', errorMsg);
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
              console.error('❌ Network error updating user:', errorMsg);
              if (updates.password) {
                addToast(t('toast.passwordUpdateFailedNetwork'), 'error');
              } else {
                addToast(t('toast.profileUpdateFailedNetwork'), 'error');
              }
            } else if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
              // 404 errors
              console.error('❌ API endpoint not found:', errorMsg);
              if (updates.password) {
                addToast(t('toast.passwordUpdateFailedNotFound'), 'error');
              } else {
                addToast(t('toast.profileUpdateFailedNotFound'), 'error');
              }
            } else if (errorMsg.includes('400')) {
              console.error('❌ Invalid profile data:', apiError);
              addToast(
                t('toast.updateInvalidData', { detail: errorMsg.replace('400: ', '') }),
                'error',
              );
            } else if (errorMsg.includes('Authentication failed') || errorMsg.includes('Please log in again') || errorMsg.includes('session has expired')) {
              // Authentication errors - already handled above, but catch here for safety
              // Avoid duplicate messages - check if we already showed an error
              console.error('❌ Authentication error:', errorMsg);
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
              console.error('❌ Server/Database error updating user:', apiError);
              if (updates.password) {
                addToast(t('toast.passwordUpdateFailedServer'), 'error');
              } else {
                addToast(t('toast.profileUpdateFailedServer'), 'error');
              }
            } else {
              console.warn('⚠️ Failed to update profile in Supabase:', errorMsg);
              // Format Supabase error for user display
              const displayError = formatSupabaseError(errorMsg);
              if (updates.password) {
                addToast(t('toast.passwordUpdateFailedDisplay', { error: displayError }), 'error');
              } else {
                addToast(t('toast.profileUpdateFailedDisplay', { error: displayError }), 'error');
              }
            }
          } else {
            console.warn('⚠️ Failed to update profile in Supabase - unknown error type');
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
        console.error('Failed to update user:', error);
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
    deleteVehicle: async (id: number) => {
      try {
        const vehicle = Array.isArray(vehicles) ? vehicles.find(v => v.id === id) : undefined;
        
        // Call API to delete vehicle
        const { deleteVehicle: deleteVehicleApi } = await import('../services/vehicleService');
        const result = await deleteVehicleApi(id);
        
        if (result.success) {
          // Log audit entry for vehicle deletion
          const actor = currentUser?.name || currentUser?.email || 'System';
          const vehicleInfo = vehicle ? `${vehicle.make} ${vehicle.model} (ID: ${id})` : `Vehicle #${id}`;
          const entry = logAction(actor, 'Delete Vehicle', vehicleInfo, `Deleted vehicle: ${vehicleInfo}`);
          setAuditLog(prev => [entry, ...prev]);
          
          // Update local state
          setVehicles(prev => Array.isArray(prev) ? prev.filter(vehicle => vehicle && vehicle.id !== id) : []);
          syncVehicleCachesById(id, () => null);
          addToast(t('toast.vehicleDeletedSuccess'), 'success');
          console.log('✅ Vehicle deleted via API:', result);
        } else {
          addToast(t('toast.deleteVehicleFailed'), 'error');
        }
      } catch (error) {
        console.error('❌ Failed to delete vehicle:', error);
        addToast(t('toast.deleteVehicleFailedRetry'), 'error');
      }
    },
    selectVehicle: (vehicle: Vehicle) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🚗 selectVehicle called for:', vehicle.id, vehicle.make, vehicle.model);
      }
      
      // Validate vehicle object (id may arrive as string from some API paths)
      if (!vehicle || vehicle.id === undefined || vehicle.id === null) {
        console.error('❌ selectVehicle called with invalid vehicle:', vehicle);
        return;
      }
      const idNum = Number(vehicle.id);
      if (!Number.isFinite(idNum)) {
        console.error('❌ selectVehicle: vehicle.id is not a valid number:', vehicle.id);
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
          console.warn('⚠️ Vehicle sessionStorage verification mismatch; continuing with in-memory state');
        } else if (process.env.NODE_ENV === 'development') {
          console.log('🚗 Vehicle stored and verified in sessionStorage:', vehicleForDetail.id, vehicleForDetail.make, vehicleForDetail.model);
        }
      } catch (error) {
        console.error('❌ Failed to store vehicle in sessionStorage:', error);
        // Continue: in-memory selectedVehicle still powers the detail screen; refresh may not restore.
      }
      
      // Set the selected vehicle state (async, but sessionStorage is already set and verified)
      // The navigate function will check sessionStorage first, so state update timing doesn't matter
      setSelectedVehicle(vehicleForDetail);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🚗 Navigating to DETAIL view with vehicle:', vehicleNorm.id, vehicleNorm.make, vehicleNorm.model);
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
      setComparisonList(prev => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return safePrev.includes(vehicleId) 
          ? safePrev.filter(id => id !== vehicleId)
          : safePrev.length < 3 ? [...safePrev, vehicleId] : safePrev;
      });
    },
    onOfferResponse: (conversationId: string, messageId: number, response: 'accepted' | 'rejected' | 'countered', counterPrice?: number) => {
      void (async () => {
        if (!currentUser) {
          addToast(t('toast.loginRequiredMessages'), 'error');
          return;
        }

        const responseTexts: Record<typeof response, string> = {
          accepted: `✅ Offer accepted! The deal is confirmed.`,
          rejected: `❌ Offer declined. Thank you for your interest.`,
          countered: `💰 Counter-offer made: ₹${(counterPrice ?? 0).toLocaleString('en-IN')}`,
        };

        const responseMessage: ChatMessage = {
          id: Date.now() * 1000 + randomIntBelow(1000),
          sender: currentUser.role === 'seller' ? 'seller' : 'user',
          text: responseTexts[response],
          timestamp: new Date().toISOString(),
          isRead: false,
          type: 'text',
        };

        const apiResult = await putConversationOfferResponse(
          conversationId,
          messageId,
          response,
          responseMessage,
          counterPrice,
        );

        if (!apiResult.success || !apiResult.data) {
          addToast(apiResult.error || t('toast.failedSendMessageGeneric'), 'error');
          return;
        }

        const fresh = apiResult.data;
        setConversations((prev) => {
          const next = Array.isArray(prev)
            ? prev.map((c) => (c && String(c.id) === String(fresh.id) ? fresh : c))
            : [];
          try {
            saveConversations(next);
          } catch {
            /* ignore */
          }
          return next;
        });
        setActiveChat((ac) => (ac && String(ac.id) === String(fresh.id) ? fresh : ac));

        addToast(
          response === 'accepted'
            ? t('toast.offerAccepted')
            : response === 'rejected'
              ? t('toast.offerRejected')
              : t('toast.offerCountered'),
          'success',
        );
      })();
    },
  };
  }, [
    currentView, previousView, selectedVehicle, vehicles, isLoading, vehiclesCatalogReady, currentUser,
    comparisonList, ratings, sellerRatings, wishlist, conversations, toasts,
    forgotPasswordRole, typingStatus, chatPeerOnlineByConversationId, selectedCategory, publicSellerProfile,
    activeChat, isAnnouncementVisible, recommendations, initialSearchQuery,
    isCommandPaletteOpen, userLocation, selectedCity, users, platformSettings,
    auditLog, vehicleData, faqItems, supportTickets, notifications,
    setCurrentView, setPreviousView, setSelectedVehicle, setVehicles, setIsLoading,
    setCurrentUser, setComparisonList, setWishlist, setConversations, setToasts,
    setForgotPasswordRole, setTypingStatus, setSelectedCategory, setPublicSellerProfile,
    setActiveChat, setIsAnnouncementVisible, setInitialSearchQuery,
    setIsCommandPaletteOpen, updateUserLocation, updateSelectedCity, setUsers,
    setPlatformSettings, setAuditLog, setVehicleData, setFaqItems, setSupportTickets,
    setNotifications, addToast, removeToast, navigate, goBack, refreshVehicles, handleLogin, handleLogout,
    updateVehicleHandler, syncUserCachesByEmail, syncAllUserCaches, syncVehicleCachesById,
    t,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

// Add displayName for better debugging and Fast Refresh compatibility
AppProvider.displayName = 'AppProvider';

