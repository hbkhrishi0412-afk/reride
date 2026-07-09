import * as React from 'react';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useSearchParams, useNavigate as useRouterNavigate } from 'react-router-dom';
import { AppProvider, useApp } from './components/AppProvider';
import ErrorBoundary from './components/ErrorBoundary';
import TranslationProvider from './components/TranslationProvider';
import PageTransition from './components/PageTransition';
import SEO from './components/SEO';
import CookieConsentBanner from './components/CookieConsentBanner';
import { 
  VehicleListErrorBoundary, 
  ChatErrorBoundary, 
  DashboardErrorBoundary, 
  AdminPanelErrorBoundary,
  AuthenticationErrorBoundary
} from './components/ErrorBoundaries';
import Header from './components/Header';
import Footer from './components/Footer';
import ToastContainer from './components/ToastContainer';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import useIsMobileApp from './hooks/useIsMobileApp';
import { isCapacitorNativeApp } from './utils/isCapacitorNative';
import { setCapacitorAndroidBackHandler } from './utils/capacitorAndroidBack';
import { tryHardwareBack } from './utils/hardwareBackRegistry';
import ShareTargetHandler from './components/ShareTargetHandler';
import OfflineIndicator from './components/OfflineIndicator';
// Layout/utility components that are always needed - keep as eager imports
import MobileLayout from './components/MobileLayout';
import MobileSearch from './components/MobileSearch';
import MobilePushNotificationManager from './components/MobilePushNotificationManager';
import NativePushRegistration from './components/NativePushRegistration';
import WebPushRegistration from './components/WebPushRegistration';
import AppRatingPrompt from './components/AppRatingPrompt';
import { View as ViewEnum, Vehicle, User, SubscriptionPlan, Notification, Conversation, ChatMessage, LocationCoordinates, type SearchFilters } from './types';
import { persistReRideNotifications } from './utils/notificationLocalStorage';
import { countUnreadMessageThreads } from './utils/unreadCounts';
import {
  conversationBelongsToCustomer,
  conversationBelongsToSeller,
  normalizeInboxRole,
  participantIdMatchesAppUser,
} from './utils/conversationParticipants';
import { parseDeepLink } from './utils/mobileFeatures';
import {
  applyNotificationDeepLinkUrl,
  normalizeNativePushPayload,
} from './utils/nativePushPayload';
import { planService } from './services/planService';
import { enrichVehiclesWithSellerInfo } from './utils/vehicleEnrichment';
import { resetViewportZoom } from './utils/viewportZoom';
import { matchesCity } from './utils/cityMapping';
import { randomIntBelow } from './utils/secureRandom.js';
import { resolveChatCallPhone, resolveChatOtherPartyName } from './utils/chatContact';
import { calculateDistance, getCityCoordinates, getUserLocation } from './services/locationService';
import { logWarn, logDebug, logError, logInfo } from './utils/logger';
import { currentUserForLocalSessionJson } from './utils/userLocalStorageSnapshot';
import { authenticatedFetch } from './utils/authenticatedFetch';
import {
  fetchAdminServiceProviderDirectory,
  fetchPublicServiceProviderDirectory,
  type ServiceProviderDirectoryEntry,
} from './utils/serviceProviderDirectory';
import { buildVehicleMutationBody } from './utils/vehicleIdentity';
import { computePageSeoMeta } from './utils/pageSeoMeta.js';
import { openOrCreateVehicleConversation } from './utils/vehicleConversationFlow.js';
import { stringifyVehicleForSession } from './utils/vehicleSessionCache.js';
import { createDealLead, getDealLead, advanceDealStage, fetchPendingDealSurveys, acceptDealChat } from './services/dealService.js';
import { invalidateMyDealLeadsCache } from './hooks/useMyDealLeads.js';
import DealSurveyModal from './components/DealSurveyModal.js';
import { RERIDE_PRICE_DROP_EVENT, type ReridePriceDropDetail } from './services/buyerService';
import type {
  AppApiResponse,
  AppServiceProvider,
  AppServiceRequestPayload,
} from './types/appServiceTypes.js';
import { AppViewRenderer } from './components/app/AppViewRenderer';
import { LoadingSpinner } from './components/app/AppViewSkeletons';
// Firebase removed - using Supabase

interface CustomerTrackedServiceRequest {
  id: string;
  status: 'open' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  serviceType?: string;
}

// Window extension for service worker properties
interface WindowWithSW extends Window {
  __swUpdateAction?: () => void;
  __swRefreshHandler?: () => void;
}


const MinimalLoader: React.FC = () => null;

// Lazy-loaded non-critical components (loaded on demand)
const CommandPalette = React.lazy(() => import('./components/CommandPalette'));
const KeyboardShortcutsHelp = React.lazy(() => import('./components/KeyboardShortcutsHelp'));
const ChatWidget = React.lazy(() => import('./components/ChatWidget').then(module => ({ default: module.ChatWidget })));

// Preload critical components - optimized for faster loading
const preloadCriticalComponents = () => {
  // Preload components that are likely to be visited next
  if (typeof window !== 'undefined') {
    // Use requestIdleCallback for better performance, fallback to setTimeout
    const schedulePreload = (callback: () => void, delay: number) => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(callback, { timeout: delay });
      } else {
        setTimeout(callback, delay);
      }
    };
    
    // Preload critical components after initial render
    schedulePreload(() => {
      Promise.all([
        import('./components/VehicleList'),
        import('./components/VehicleDetail'),
        import('./components/Home')
      ]).catch(() => {
        // Silently fail if preloading fails
      });
    }, 500);
    
    // Preload secondary components when idle
    schedulePreload(() => {
      Promise.all([
        import('./components/Dashboard').catch((error) => {
          // Log error but don't fail - Dashboard will be loaded on-demand if needed
          if (process.env.NODE_ENV === 'development') {
            logWarn('⚠️ Dashboard preload failed (non-critical):', error);
          }
          return null; // Return null to prevent Promise.all from failing
        }),
        import('./components/Profile').catch((error) => {
          if (process.env.NODE_ENV === 'development') {
            logWarn('⚠️ Profile preload failed (non-critical):', error);
          }
          return null;
        })
      ]).catch(() => {
        // Silently fail if preloading fails - these are optimizations, not critical
      });
    }, 2000);
  }
};

/** API/session may surface role with different casing; keep admin checks consistent. */
function userHasAdminRole(user: User | null | undefined): boolean {
  return (user?.role || '').toLowerCase().trim() === 'admin';
}

const AppContent: React.FC = () => {
  const routerLocation = useLocation();
  const [routerSearchParams, setRouterSearchParams] = useSearchParams();
  const routerNavigate = useRouterNavigate();
  // Detect if running as mobile app (standalone/installed PWA)
  const { isMobileApp } = useIsMobileApp();
  const { t } = useTranslation();

  // Get all app context values in a single hook call
  const { 
    currentView, 
    setCurrentView,
    navigate,
    goBack,
    previousView, 
    currentUser, 
    setCurrentUser,
    handleLogout, 
    comparisonList, 
    wishlist, 
    notifications,
    setNotifications,
    userLocation,
    setUserLocation,
    addToast,
    setIsCommandPaletteOpen,
    vehicles,
    setVehicles,
    setSelectedVehicle,
    setSelectedCategory,
    recommendations,
    selectedVehicle,
    isLoading,
    vehiclesCatalogReady,
    conversations,
    setConversations,
    toasts,
    activeChat,
    users,
    setUsers,
    vehicleData,
    faqItems,
    platformSettings,
    auditLog,
    supportTickets,
    setSupportTickets,
    selectedCategory: currentCategory,
    initialSearchQuery,
    selectedCity,
    setSelectedCity,
    publicSellerProfile,
    typingStatus,
    chatPeerOnlineByConversationId,
    removeToast,
    setActiveChat,
    isCommandPaletteOpen,
    setWishlist,
    setComparisonList,
    setPublicSellerProfile: setPublicProfile,
    setInitialSearchQuery,
    setForgotPasswordRole,
    addSellerRating,
    sendMessage,
    sendMessageWithType,
    markAsRead,
    setConversationReadState,
    clearConversationMessages,
    deleteConversation,
    archiveConversation,
    toggleTyping,
    flagContent,
    updateUser,
    deleteUser,
    updateVehicle,
    deleteVehicle,
    selectVehicle,
    toggleWishlist,
    toggleCompare,
    handleLogin,
    handleRegister,
    onCreateUser,
    onAdminUpdateUser,
    onUpdateUserPlan,
    onToggleUserStatus,
    onToggleVehicleStatus,
    onToggleVehicleFeature,
    onResolveFlag,
    onUpdateSettings,
    onSendBroadcast,
    onExportUsers,
    onImportUsers,
    onExportVehicles,
    onImportVehicles,
    onExportSales,
    onUpdateVehicleData,
    onToggleVerifiedStatus,
    onUpdateSupportTicket,
    onAddFaq,
    onUpdateFaq,
    onDeleteFaq,
    onCertificationApproval,
    onOfferResponse,
    refreshVehicles,
  } = useApp();

  const pushNotificationsForCurrentUser = useMemo(() => {
    if (!currentUser?.email) return [];
    const e = currentUser.email.toLowerCase().trim();
    return notifications.filter(
      n => n.recipientEmail && n.recipientEmail.toLowerCase().trim() === e,
    );
  }, [notifications, currentUser?.email]);

  const [pendingSurvey, setPendingSurvey] = useState<{
    surveyId: string;
    leadId: string;
    vehicleName?: string;
  } | null>(null);

  useEffect(() => {
    if (!currentUser?.email || currentUser.role === 'admin') return;
    fetchPendingDealSurveys()
      .then((surveys) => {
        if (surveys.length > 0) {
          const s = surveys[0];
          const lead = s.deal_leads;
          setPendingSurvey({
            surveyId: s.id,
            leadId: s.lead_id,
            vehicleName: lead?.metadata?.vehicleName,
          });
        }
      })
      .catch(() => {});
  }, [currentUser?.email, currentUser?.role]);

  const savePostLoginDetailContext = useCallback((vehicle: Vehicle) => {
    try {
      sessionStorage.setItem('reride.postLoginView', ViewEnum.DETAIL);
      sessionStorage.setItem('selectedVehicle', stringifyVehicleForSession(vehicle));
    } catch {
      /* ignore */
    }
  }, []);

  const handleStartVehicleChat = useCallback(
    async (vehicle: Vehicle) => {
      if (!currentUser) {
        savePostLoginDetailContext(vehicle);
        addToast('Please login to express interest', 'info');
        navigate(ViewEnum.CUSTOMER_LOGIN);
        return;
      }
      const conversation = await openOrCreateVehicleConversation({
        vehicle,
        currentUser,
        conversations,
        setConversations,
        setActiveChat,
      });
      if (!conversation) {
        addToast('Unable to start chat. The seller may no longer be available.', 'error');
        return;
      }
      try {
        const { lead, existing } = await createDealLead({
          vehicleId: vehicle.id,
          conversationId: conversation.id,
          buyerName: currentUser.name,
        });
        if (existing) {
          addToast(`You're already interested. Lead ${lead.id}`, 'info');
        } else {
          addToast(`Interest sent! Lead ${lead.id} created.`, 'success');
        }
        invalidateMyDealLeadsCache();
      } catch (err) {
        logWarn('Deal lead creation failed (chat still opened):', err);
        addToast('Chat opened, but deal tracking could not start. Try again from your inbox.', 'warning');
      }
    },
    [currentUser, conversations, setConversations, setActiveChat, addToast, navigate, savePostLoginDetailContext],
  );

  const handleBrowseAllIndia = useCallback(() => {
    setSelectedCity('');
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('reRideSelectedCity');
      }
    } catch {
      /* ignore */
    }
    navigate(ViewEnum.USED_CARS);
  }, [navigate, setSelectedCity]);

  const handleHomeUseMyLocation = useCallback(
    (city: string, locationLabel: string) => {
      setSelectedCity(city);
      setUserLocation(locationLabel);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('reRideSelectedCity', city);
          localStorage.setItem('reRideUserLocation', locationLabel);
        }
      } catch {
        /* ignore */
      }
      navigate(ViewEnum.USED_CARS, { city });
    },
    [navigate, setSelectedCity, setUserLocation],
  );

  const handleRequestTestDrive = useCallback(
    async (vehicle: Vehicle, details: { date: string; time: string }) => {
      if (!currentUser) {
        savePostLoginDetailContext(vehicle);
        addToast(t('toast.testDrive.loginRequired'), 'info');
        navigate(ViewEnum.CUSTOMER_LOGIN);
        return;
      }
      const conversation = await openOrCreateVehicleConversation({
        vehicle,
        currentUser,
        conversations,
        setConversations,
        setActiveChat,
        openChat: false,
      });
      if (!conversation) {
        addToast(t('toast.testDrive.sellerMissing'), 'error');
        return;
      }
      const vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
      const messageText = t('chat.testDrive.messageBody', {
        vehicle: vehicleLabel,
        date: details.date,
        time: details.time,
      });
      const sent = await sendMessageWithType(conversation.id, messageText, 'test_drive_request', {
        date: details.date,
        time: details.time,
        status: 'pending',
      });
      if (!sent) {
        addToast(t('toast.failedSendMessageGeneric'), 'error');
        return;
      }
      addToast(t('toast.testDrive.sent'), 'success');
    },
    [
      currentUser,
      conversations,
      setConversations,
      setActiveChat,
      sendMessageWithType,
      addToast,
      navigate,
      savePostLoginDetailContext,
      t,
    ],
  );

  const handleTestDriveResponse = useCallback(
    async (conversationId: string, messageId: number, newStatus: 'confirmed' | 'rejected') => {
      try {
        const conversation = conversations.find((c) => c && c.id === conversationId);
        if (!conversation) {
          logWarn('Conversation not found for test drive response:', conversationId);
          return;
        }

        const message = conversation.messages?.find((m) => m && m.id === messageId);
        if (!message || message.type !== 'test_drive_request') {
          logWarn('Test drive message not found:', messageId);
          return;
        }

        const updatedMessage: ChatMessage = {
          ...message,
          payload: {
            ...message.payload,
            status: newStatus as 'pending' | 'accepted' | 'rejected' | 'countered' | 'confirmed',
          },
        };

        const vehicleLabel = conversation.vehicleName || t('chat.testDrive.vehicleFallback');
        const responseText =
          newStatus === 'confirmed'
            ? t('chat.testDrive.replyConfirmed', { vehicle: vehicleLabel })
            : t('chat.testDrive.replyDeclined', { vehicle: vehicleLabel });

        const sent = await sendMessageWithType(conversationId, responseText, 'text', {
          originalMessageId: messageId,
          status: newStatus,
        });

        if (!sent) {
          addToast(t('toast.testDrive.responseFailed'), 'error');
          return;
        }

        setConversations((prev: Conversation[]) =>
          prev.map((conv: Conversation) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  messages:
                    conv.messages?.map((msg: ChatMessage) =>
                      msg.id === messageId ? updatedMessage : msg,
                    ) || [],
                }
              : conv,
          ),
        );

        addToast(
          newStatus === 'confirmed' ? t('toast.testDrive.confirmed') : t('toast.testDrive.declined'),
          'success',
        );

        if (newStatus === 'confirmed') {
          try {
            const lead = await getDealLead({ conversationId });
            if (lead && message.payload?.date) {
              await advanceDealStage(lead.id, 'test_drive_scheduled', {
                date: message.payload.date,
                time: message.payload.time || '',
              });
            }
          } catch {
            /* non-fatal */
          }
        }
      } catch (error) {
        logError('Failed to respond to test drive request:', error);
        addToast(t('toast.testDrive.responseFailed'), 'error');
      }
    },
    [conversations, sendMessageWithType, setConversations, addToast, t],
  );
  
  // Handle service worker update notifications
  useEffect(() => {
    const handleServiceWorkerUpdate = (event: CustomEvent) => {
      const detail = event.detail as { message?: string; action?: () => void };
      addToast(
        detail.message || 'A new version is available. Click to refresh.',
        'info'
      );
      
      // Show a persistent notification with refresh button
      if (detail.action) {
        // Store the action for when user clicks refresh
        (window as WindowWithSW).__swUpdateAction = detail.action;
        
        // Add a clickable refresh button via another toast
        setTimeout(() => {
          addToast(
            'Click here to refresh and get the latest version',
            'info'
          );
          // Listen for click on the toast (simplified - in production, use a proper button)
          const refreshHandler = () => {
            const win = window as WindowWithSW;
            if (win.__swUpdateAction) {
              win.__swUpdateAction();
            } else {
              window.location.reload();
            }
          };
          (window as WindowWithSW).__swRefreshHandler = refreshHandler;
        }, 1000);
      }
    };
    
    window.addEventListener('sw-update-available', handleServiceWorkerUpdate as EventListener);
    
    return () => {
      window.removeEventListener('sw-update-available', handleServiceWorkerUpdate as EventListener);
    };
  }, [addToast]);

  /** Android: customers land on HOME after login; a single system-back there used to call exitApp() immediately. */
  const lastHomeExitBackRef = React.useRef<number>(0);
  useEffect(() => {
    if (currentView !== ViewEnum.HOME) {
      lastHomeExitBackRef.current = 0;
    }
  }, [currentView]);

  // Desktop sellers opening /inbox should land on dashboard messages, not the buyer-only inbox.
  useEffect(() => {
    if (currentView !== ViewEnum.INBOX) return;
    if (isMobileApp || isCapacitorNativeApp()) return;
    if (!currentUser?.email) return;
    if (normalizeInboxRole(currentUser.role) !== 'seller') return;
    try {
      sessionStorage.setItem('reride_seller_open_inquiries', '1');
    } catch {
      /* ignore */
    }
    navigate(ViewEnum.SELLER_DASHBOARD);
  }, [currentView, currentUser, isMobileApp, navigate]);

  useEffect(() => {
    if (!isCapacitorNativeApp()) return;
    setCapacitorAndroidBackHandler(() => {
      if (tryHardwareBack()) {
        return;
      }
      if (currentView === ViewEnum.HOME) {
        const now = Date.now();
        const prev = lastHomeExitBackRef.current;
        if (prev > 0 && now - prev < 2000) {
          void import('@capacitor/app').then(({ App }) => {
            void App.exitApp();
          });
          return;
        }
        lastHomeExitBackRef.current = now;
        addToast(t('toast.pressBackAgainToExit'), 'info');
        return;
      }
      if (currentView === ViewEnum.DETAIL) {
        goBack(ViewEnum.USED_CARS);
        return;
      }
      goBack(ViewEnum.HOME);
    });
    return () => setCapacitorAndroidBackHandler(null);
  }, [goBack, currentView, addToast, t]);
  
  // Preload critical components after initial render
  React.useEffect(() => {
    preloadCriticalComponents();
  }, []);
  
  // Fix viewport zoom on mount only — do NOT use intervals as it violates
  // WCAG 1.4.4 (users must be able to zoom to 200% without loss of content)
  React.useEffect(() => {
    resetViewportZoom();
  }, []);
  
  const SERVICE_PROVIDER_STORAGE_KEY = 'reRideServiceProvider';
  const [serviceProvider, setServiceProviderRaw] = React.useState<AppServiceProvider | null>(() => {
    try {
      const raw = localStorage.getItem(SERVICE_PROVIDER_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && typeof parsed.name === 'string') {
        return parsed as AppServiceProvider;
      }
    } catch {
      // ignore
    }
    return null;
  });
  const setServiceProvider = React.useCallback(
    (next: AppServiceProvider | null | ((prev: AppServiceProvider | null) => AppServiceProvider | null)) => {
      setServiceProviderRaw((prev) => {
        const value = typeof next === 'function' ? next(prev) : next;
        try {
          if (value) {
            localStorage.setItem(SERVICE_PROVIDER_STORAGE_KEY, JSON.stringify(value));
          } else {
            localStorage.removeItem(SERVICE_PROVIDER_STORAGE_KEY);
          }
        } catch {
          // ignore storage errors
        }
        return value;
      });
    },
    []
  );
  // Unified logout that also clears any persisted service-provider session.
  // The shared `handleLogout` only knows about the regular customer/seller
  // user, so a provider-only session would leave `serviceProvider` (and its
  // localStorage entry) intact and the mobile menu would still appear logged
  // in. Using this wrapper from layout/header logout actions keeps both
  // identities in sync.
  const handleLogoutAll = React.useCallback(() => {
    setServiceProvider(null);
    handleLogout();
  }, [handleLogout, setServiceProvider]);
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState(false);

  React.useEffect(() => {
    const onServiceProviderGoogleOAuth = (e: Event) => {
      const detail = (e as CustomEvent<Record<string, unknown>>).detail;
      if (!detail || typeof detail !== 'object') return;
      const name = typeof detail.name === 'string' ? detail.name : 'Provider';
      const city = typeof detail.city === 'string' ? detail.city : '';
      setServiceProvider({
        ...(detail as unknown as AppServiceProvider),
        name,
        city: city || '',
      });
      navigate(ViewEnum.CAR_SERVICE_DASHBOARD);
      addToast(`Welcome, ${name}!`, 'success');
    };
    window.addEventListener('reride:service-provider-oauth', onServiceProviderGoogleOAuth as EventListener);
    return () =>
      window.removeEventListener('reride:service-provider-oauth', onServiceProviderGoogleOAuth as EventListener);
  }, [navigate, addToast, setServiceProvider]);

  // Keep `reRideServiceProvider` in sync when the dashboard saves (categories, skills, etc.),
  // so a refresh and the `provider` prop do not drop fields that only exist in the API response.
  React.useEffect(() => {
    const onServiceProviderProfileUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ profile?: AppServiceProvider; providerId?: string }>).detail;
      const p = detail?.profile;
      if (!p || typeof p !== 'object') return;
      const email = typeof p.email === 'string' ? p.email.trim() : '';
      if (!email) return;
      setServiceProvider((prev) => {
        if (!prev) {
          return {
            ...p,
            name: (typeof p.name === 'string' && p.name.trim()) || 'Provider',
            email,
            city: (p as AppServiceProvider).city || '',
          } as AppServiceProvider;
        }
        if (prev.email && prev.email.toLowerCase() !== email.toLowerCase()) return prev;
        return { ...prev, ...p, name: p.name || prev.name, city: (p as AppServiceProvider).city ?? prev.city };
      });
    };
    window.addEventListener('serviceProviderProfileUpdated', onServiceProviderProfileUpdated);
    return () => window.removeEventListener('serviceProviderProfileUpdated', onServiceProviderProfileUpdated);
  }, [setServiceProvider]);

  // If we have an active Supabase session AND the last-known role is
  // `service_provider`, try to restore the provider profile from the API
  // (e.g. after a hard refresh on mobile). This avoids the "No provider data.
  // Please log in again." dead-end after the user comes back to the app.
  //
  // CRITICAL on Android (Capacitor WebView):
  //   - Do NOT run this for customers/sellers/guests. Calling /api/service-providers
  //     immediately after a customer login adds another network round-trip + JSON
  //     parse + state update to the same frame as the heavy post-login HOME paint,
  //     which on low-RAM Android emulators / devices is enough to OOM-kill the
  //     WebView renderer and force-close the activity.
  //   - Only set state when the response is a *valid* provider object (has an
  //     `email` string). A 200-with-array or stub response would otherwise
  //     spread an array into the object, corrupting the menu / provider UI.
  //   - Defer the work off the post-login frame using requestIdleCallback so it
  //     never competes with the first paint of HOME.
  React.useEffect(() => {
    if (serviceProvider) return;
    if (typeof window === 'undefined') return;

    // Cheap pre-check: only attempt if there is any signal this user is a
    // service provider (current React user state, last-known session role,
    // or persisted provider record). For customers/sellers/guests we skip
    // entirely — they will never have a /api/service-providers profile and
    // the call only burns boot/login budget.
    let lastRole: string | null = null;
    try {
      lastRole =
        sessionStorage.getItem('reride_last_role') ||
        localStorage.getItem('reride_last_role') ||
        null;
    } catch {
      lastRole = null;
    }
    const userLooksLikeProvider =
      currentUser?.role === 'service_provider' || lastRole === 'service_provider';
    if (!userLooksLikeProvider) return;

    let cancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;

    const run = async () => {
      try {
        const { authenticatedFetch } = await import('./utils/authenticatedFetch');
        const resp = await authenticatedFetch('/api/service-providers?scope=mine');
        // 404 = customer/seller account hitting the provider endpoint; ignore.
        if (!resp.ok) return;
        const provider = await resp.json().catch(() => null);
        if (
          cancelled ||
          !provider ||
          typeof provider !== 'object' ||
          Array.isArray(provider) ||
          typeof (provider as { email?: unknown }).email !== 'string'
        ) {
          return;
        }
        const p = provider as Partial<AppServiceProvider> & Record<string, unknown>;
        setServiceProvider({
          ...(p as AppServiceProvider),
          name: typeof p.name === 'string' && p.name.trim() ? p.name : 'Provider',
          city: typeof p.city === 'string' ? p.city : '',
        });
      } catch {
        // ignore - leave dashboard empty so login screen will be shown
      }
    };

    const ric = (window as unknown as {
      requestIdleCallback?: (fn: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    }).requestIdleCallback;
    if (typeof ric === 'function') {
      idleHandle = ric(() => {
        void run();
      }, { timeout: 2000 });
    } else {
      timeoutHandle = window.setTimeout(() => {
        void run();
      }, 250);
    }

    return () => {
      cancelled = true;
      try {
        const cic = (window as unknown as {
          cancelIdleCallback?: (id: number) => void;
        }).cancelIdleCallback;
        if (idleHandle != null && typeof cic === 'function') cic(idleHandle);
      } catch {
        /* ignore */
      }
      if (timeoutHandle != null) window.clearTimeout(timeoutHandle);
    };
  }, [serviceProvider, setServiceProvider, currentUser?.role]);

  // If we land on (or get logged out from) the service-provider dashboard
  // without a `serviceProvider` in state, redirect straight to the provider
  // login screen instead of showing an intermediate "sign-in required" card.
  // We give the session-restore effect above a brief window to repopulate the
  // provider after a hard refresh; if it's still missing after that, we send
  // the user to the login page.
  React.useEffect(() => {
    if (currentView !== ViewEnum.CAR_SERVICE_DASHBOARD) return;
    if (serviceProvider) return;

    let lastRole: string | null = null;
    try {
      lastRole =
        sessionStorage.getItem('reride_last_role') ||
        localStorage.getItem('reride_last_role') ||
        null;
    } catch {
      lastRole = null;
    }
    const userLooksLikeProvider =
      currentUser?.role === 'service_provider' || lastRole === 'service_provider';

    const delayMs = userLooksLikeProvider ? 2500 : 0;
    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem('reride_car_service_auth_mode', 'login');
      } catch {
        /* ignore storage errors */
      }
      navigate(ViewEnum.CAR_SERVICE_LOGIN);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [currentView, serviceProvider, currentUser?.role, navigate]);

  // Helper function to properly close chat and clear localStorage
  const handleCloseChat = React.useCallback(() => {
    // Clear localStorage first to prevent auto-restore
    try {
      localStorage.removeItem('reRideActiveChat');
    } catch (e) {
      // ignore storage errors
    }
    // Then clear the active chat state
    setActiveChat(null);
  }, [setActiveChat]);

  const [inboxConversationIdToOpen, setInboxConversationIdToOpen] = React.useState<string | null>(null);

  const unreadMessagesCount = React.useMemo(
    () =>
      countUnreadMessageThreads(
        conversations,
        currentUser?.role,
        currentUser?.email,
        currentUser?.id
      ),
    [conversations, currentUser?.role, currentUser?.email, currentUser?.id]
  );

  const unreadNotificationsCount = React.useMemo(() => {
    if (!currentUser?.email) return 0;
    return notifications.filter(
      (x) =>
        participantIdMatchesAppUser(x.recipientEmail, currentUser.email, currentUser.id) &&
        !x.isRead
    ).length;
  }, [notifications, currentUser?.email, currentUser?.id]);

  const handleOpenMessages = React.useCallback(() => {
    if (!currentUser) return;
    if (currentUser.role === 'customer') {
      navigate(ViewEnum.INBOX);
      return;
    }
    if (currentUser.role === 'seller') {
      if (isMobileApp) {
        navigate(ViewEnum.INBOX);
        return;
      }
      try {
        sessionStorage.setItem('reride_seller_open_inquiries', '1');
      } catch {
        /* ignore */
      }
      navigate(ViewEnum.SELLER_DASHBOARD);
    }
  }, [currentUser, navigate, isMobileApp]);

  const handleInboxInitialConversationConsumed = React.useCallback(() => {
    setInboxConversationIdToOpen(null);
  }, []);

  const markAllVisibleAsRead = React.useCallback(
    async (role: 'customer' | 'seller') => {
      if (!currentUser?.email) return;
      const email = currentUser.email.toLowerCase().trim();
      const unread = (conversations || []).filter((c) => {
        if (!c) return false;
        if (role === 'seller') {
          if (!conversationBelongsToSeller(c, email, currentUser.id)) return false;
          return !c.isReadBySeller;
        }
        if (!conversationBelongsToCustomer(c, email, currentUser.id)) return false;
        return !c.isReadByCustomer;
      });
      await Promise.all(
        unread.map((c) =>
          markAsRead(c.id, {
            readerRole: role,
            forceReadState: true,
          }),
        ),
      );
    },
    [conversations, markAsRead, currentUser],
  );

  /** Seller dashboard message rows: open reply UI. On native/mobile app, use global ChatWidget; elsewhere deep-link inbox. */
  const handleSellerOpenChatFromDashboard = useCallback(
    (conv: Conversation) => {
      if (!conv?.id) return;
      const id = String(conv.id);
      const latest = conversations.find((c) => c && String(c.id) === id) ?? conv;

      const useFloatingSellerChat = isMobileApp || isCapacitorNativeApp();
      if (useFloatingSellerChat && currentUser?.role === 'seller') {
        setActiveChat(latest);
        void markAsRead(id, { readerRole: 'seller', forceReadState: true });
        return;
      }

      setInboxConversationIdToOpen(id);
      if (currentView !== ViewEnum.INBOX) {
        navigate(ViewEnum.INBOX);
      }
      void markAsRead(id, { readerRole: 'seller', forceReadState: true });
    },
    [conversations, currentView, currentUser?.role, isMobileApp, markAsRead, navigate, setActiveChat]
  );

  /** Dealers & seller profiles are public to view; calling, follow, save, compare require an account. */
  const requireLoginForDealerInteraction = React.useCallback(() => {
    addToast('Please log in to access all features like calling dealers, saving listings, and more.', 'info');
    navigate(ViewEnum.LOGIN_PORTAL);
  }, [addToast, navigate]);

  /**
   * Open seller/dealer profile. Always navigates when email is present: prefer full `users` row,
   * else a minimal stub (same idea as dealer directory) so View Profile works if the seller is not
   * yet in the in-memory list.
   */
  /**
   * Deep-linked structured filters parsed from the current URL's search
   * params (e.g. `/used-cars?make=Maruti&maxPrice=300000`).
   *
   * This is the authoritative path for chip clicks on the mobile home page.
   * Passing filters here — instead of a natural-language string through
   * `initialSearchQuery` — guarantees the list actually filters even when
   * the Gemini proxy is offline.
   */
  const filtersFromUrl = useMemo<Partial<SearchFilters> | undefined>(() => {
    const filters: Partial<SearchFilters> = {};
    const make = routerSearchParams.get('make');
    const model = routerSearchParams.get('model');
    const category = routerSearchParams.get('category');
    const fuelType = routerSearchParams.get('fuelType');
    const transmission = routerSearchParams.get('transmission');
    const ownership = routerSearchParams.get('ownership');
    const minPrice = routerSearchParams.get('minPrice');
    const maxPrice = routerSearchParams.get('maxPrice');
    const minYear = routerSearchParams.get('minYear');
    const maxYear = routerSearchParams.get('maxYear');
    const year = routerSearchParams.get('year');
    const location = routerSearchParams.get('location');
    if (make) filters.make = make;
    if (model) filters.model = model;
    if (category) filters.category = category as SearchFilters['category'];
    if (fuelType) filters.fuelType = fuelType;
    if (transmission) filters.transmission = transmission;
    if (ownership && ['1', '2', '3plus'].includes(ownership)) {
      filters.ownership = ownership as SearchFilters['ownership'];
    }
    if (minPrice != null && minPrice !== '' && Number.isFinite(Number(minPrice))) filters.minPrice = Number(minPrice);
    if (maxPrice != null && maxPrice !== '' && Number.isFinite(Number(maxPrice))) filters.maxPrice = Number(maxPrice);
    if (minYear != null && minYear !== '' && Number.isFinite(Number(minYear))) filters.minYear = Number(minYear);
    if (maxYear != null && maxYear !== '' && Number.isFinite(Number(maxYear))) filters.maxYear = Number(maxYear);
    if (year != null && year !== '' && Number.isFinite(Number(year))) filters.year = Number(year);
    if (location) filters.location = location;
    return Object.keys(filters).length > 0 ? filters : undefined;
  }, [routerSearchParams]);

  /**
   * Deep-link helper: navigate to `/used-cars` and encode structured
   * filters / search query into the URL. Reading URL params on mount
   * means refreshes and shared links always reproduce the same result.
   *
   * `q` is mapped to `initialSearchQuery` so the plain-text haystack
   * filter (`vehicleMatchesSearchText`) kicks in immediately, even before
   * the AI proxy responds.
   */
  const applyFilters = React.useCallback(
    (opts: {
      filters?: Record<string, string | number>;
      query?: string;
    }) => {
      const params = new URLSearchParams();
      const callerFilters = opts.filters || {};
      // When a chip / deep link is followed from the Home hero, the in-app
      // `navigate(USED_CARS)` path that normally resets the category to
      // 'ALL' (AppProvider.tsx) is *not* hit — we go straight through
      // `routerNavigate`. That left `selectedCategory` stuck on
      // FOUR_WHEELER (its Home default), and `VehicleList` then ANDs the
      // brand chip with `categoryFilter = 'FOUR_WHEELER'`, which silently
      // drops every listing whose `vehicle.category` isn't the exact
      // string "four-wheeler" (older rows store "Sedan" / "SUV" / etc.).
      //
      // Result: clicking a brand pill like "Hyundai" navigated to
      // `/used-cars?make=Hyundai` with `Make = Hyundai` selected in the
      // sidebar but produced 0 results.
      //
      // Fix: when the caller didn't explicitly pin a category, clear it
      // here too — both in URL (so refresh/share is faithful) and in app
      // state (so the existing `setCategoryFilter(initialCategory)` sync
      // in VehicleList lands on 'ALL' instead of the leftover Home value).
      const explicitCategory =
        callerFilters.category != null && String(callerFilters.category).trim() !== '';
      Object.entries(callerFilters).forEach(([k, v]) => {
        if (v === undefined || v === null || v === '') return;
        params.set(k, String(v));
      });
      if (!explicitCategory) {
        params.set('category', 'ALL');
        setSelectedCategory('ALL');
      }
      if (opts.query && opts.query.trim()) {
        params.set('q', opts.query.trim());
        setInitialSearchQuery(opts.query.trim());
      } else {
        setInitialSearchQuery('');
      }
      const qs = params.toString();
      routerNavigate(qs ? `/used-cars?${qs}` : '/used-cars', {
        state: { view: ViewEnum.USED_CARS, timestamp: Date.now() },
      });
    },
    [routerNavigate, setInitialSearchQuery, setSelectedCategory]
  );

  // If the URL has `?q=...` on mount / refresh, seed `initialSearchQuery`
  // so the list's text-match fallback starts narrowing rows right away.
  useEffect(() => {
    const q = routerSearchParams.get('q');
    if (q && q.trim() && q.trim() !== initialSearchQuery) {
      setInitialSearchQuery(q.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routerSearchParams]);

  // Silence unused-var warning for the setter (we use routerNavigate to push
  // URLs directly; setRouterSearchParams is kept around for future use).
  void setRouterSearchParams;

  const openSellerProfileByEmail = React.useCallback(
    (sellerEmail: string | undefined) => {
      const normalized = sellerEmail?.toLowerCase().trim() ?? '';
      if (!normalized) return;
      const match = users.find((u) => u?.email && u.email.toLowerCase().trim() === normalized);
      const listingSellerName = vehicles.find(
        (v) => v.sellerEmail?.toLowerCase().trim() === normalized
      )?.sellerName;
      setPublicProfile(
        match ??
          ({
            email: normalized,
            name: listingSellerName || 'Seller',
            mobile: '',
            role: 'seller',
            location: '',
            status: 'active',
            createdAt: new Date().toISOString(),
          } as User)
      );
      // Pass email in params so the URL is correct in the same tick (navigate() used to read stale publicSellerProfile).
      navigate(ViewEnum.SELLER_PROFILE, { sellerEmail: normalized });
    },
    [users, vehicles, setPublicProfile, navigate]
  );

  // Simple handler for service cart submissions (wire to real API as needed)
  const handleServiceRequestSubmit = React.useCallback(async (payload: AppServiceRequestPayload) => {
    try {
      if (!currentUser) {
        addToast('Please log in to submit a service request.', 'error');
        throw new Error('Please log in to submit a service request.');
      }

      const firstItem = payload.items?.[0];
      const serviceName =
        payload.servicePackages?.find(s => s.id === firstItem?.serviceId)?.name ||
        payload.serviceTypes?.[0] ||
        firstItem?.serviceId ||
        'General service';
      const vehicleDesc = payload.carDetails
        ? `${(payload.carDetails as { make?: string; model?: string }).make || ''} ${(payload.carDetails as { make?: string; model?: string }).model || ''}`.trim()
        : '';
      const city = payload.address?.city || (payload.carDetails as { city?: string })?.city || selectedCity || '';

      // Map all selected services
      const services = payload.items?.map(it => {
        const svcMeta = payload.servicePackages?.find(s => s.id === it.serviceId);
        return {
          id: it.serviceId,
          name: svcMeta?.name || it.serviceId,
          quantity: it.quantity || 1,
          price: typeof svcMeta?.price === 'number' ? svcMeta.price : undefined,
        };
      });

      // Use all service types if available, otherwise fall back to first service
      const allServiceTypes = payload.serviceTypes && payload.serviceTypes.length > 0
        ? payload.serviceTypes.join(', ')
        : serviceName;
      const structuredCar =
        payload.carDetails && typeof payload.carDetails === 'object' ? payload.carDetails : null;
      const body = {
        title: payload.note?.trim() ? payload.note!.trim() : `${allServiceTypes} request`,
        serviceType: allServiceTypes,
        customerName: payload.customerName || currentUser?.name || '',
        customerPhone: payload.customerPhone || currentUser?.mobile || '',
        customerEmail: currentUser?.email || '',
        vehicle: vehicleDesc,
        city,
        addressLine: payload.address?.line1 || '',
        pincode: payload.address?.pincode || '',
        carDetails: structuredCar ?? vehicleDesc,
        status: 'open' as const,
        scheduledAt:
          payload.scheduledDate && payload.slotTimeLabel
            ? `${payload.scheduledDate} • ${payload.slotTimeLabel}`
            : payload.slotId || '',
        notes: payload.note || '',
        providerId: null,
        candidateProviderIds: payload.candidateProviderIds ?? [],
        services,
        addressId: payload.addressId,
        slotId: payload.slotId,
        scheduledDate: payload.scheduledDate,
        slotTimeLabel: payload.slotTimeLabel,
        total: payload.total,
        couponCode: payload.couponCode,
      };
      const resp = await authenticatedFetch('/api/service-requests', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const data = await resp.json().catch((error) => {
          logWarn('Failed to parse service request response:', error);
          return {};
        });
        const msg = data.error || `Failed to submit request (status ${resp.status})`;
        throw new Error(msg);
      }

      addToast('Service request submitted', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to submit service request';
      logError('Failed to submit service request', error);
      addToast(msg, 'error');
      throw error instanceof Error ? error : new Error(msg);
    }
  }, [addToast, currentUser, selectedCity]);

  const [userCoords, setUserCoords] = React.useState<LocationCoordinates | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = React.useState<string | null>(null);
  const serviceRequestStatusRef = React.useRef<Record<string, string>>({});
  const hasInitializedServiceRequestTrackingRef = React.useRef(false);
  const notificationsRef = React.useRef<Notification[]>(notifications);

  React.useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  // Load cached coords on mount
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('user_coords');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          setUserCoords(parsed);
        }
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const handleUseMyLocation = React.useCallback(async () => {
    try {
      setIsLocating(true);
      setLocationError(null);
      const coords = await getUserLocation();
      if (coords) {
        setUserCoords(coords);
        try {
          localStorage.setItem('user_coords', JSON.stringify(coords));
        } catch {
          // ignore storage errors
        }
      } else {
        const msg = 'Unable to fetch location. Please allow location access.';
        setLocationError(msg);
        addToast(msg, 'error');
      }
    } catch (err) {
      logError('Location error', err);
      const msg = 'Location access failed. Please retry and allow permission.';
      setLocationError(msg);
      addToast(msg, 'error');
    } finally {
      setIsLocating(false);
    }
  }, [addToast]);

  React.useEffect(() => {
    if (!currentUser || currentUser.role !== 'customer') {
      serviceRequestStatusRef.current = {};
      hasInitializedServiceRequestTrackingRef.current = false;
      return;
    }

    let cancelled = false;
    const statusLabel = (status: string) => status.replace('_', ' ');
    const serviceLabel = (serviceType?: string) => serviceType || 'Service request';

    const pollCustomerRequestStatuses = async () => {
      try {
        const resp = await authenticatedFetch('/api/service-requests?scope=customer');
        if (!resp.ok) return;
        const rows = await resp.json();
        if (!Array.isArray(rows) || cancelled) return;

        const nextMap: Record<string, string> = {};
        const changed: CustomerTrackedServiceRequest[] = [];
        rows.forEach((row: CustomerTrackedServiceRequest) => {
          const previous = serviceRequestStatusRef.current[row.id];
          nextMap[row.id] = row.status;
          if (hasInitializedServiceRequestTrackingRef.current && previous && previous !== row.status) {
            changed.push(row);
          }
        });

        serviceRequestStatusRef.current = nextMap;
        if (!hasInitializedServiceRequestTrackingRef.current) {
          hasInitializedServiceRequestTrackingRef.current = true;
          return;
        }

        if (changed.length === 0) return;

        const generatedNotifications: Notification[] = changed.map((row, idx) => ({
          id: Date.now() + idx,
          recipientEmail: currentUser.email,
          message: `${serviceLabel(row.serviceType)} is now ${statusLabel(row.status)}.`,
          title: 'Service Request Update',
          targetId: row.id,
          targetType: 'general_admin',
          type: 'service_request_status',
          isRead: false,
          timestamp: new Date().toISOString(),
        }));

        generatedNotifications.forEach((notif) => addToast(notif.message, 'info'));
        const updatedNotifications = [...generatedNotifications, ...notificationsRef.current];
        setNotifications(updatedNotifications);
        try {
          persistReRideNotifications(updatedNotifications);
        } catch {
          // ignore localStorage failures
        }
      } catch {
        // ignore transient polling failures
      }
    };

    pollCustomerRequestStatuses();
    const interval = setInterval(pollCustomerRequestStatuses, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [addToast, currentUser, setNotifications]);

  // Derive registered service providers for the service cart
  const [serviceProviderBase, setServiceProviderBase] = React.useState<ServiceProviderDirectoryEntry[]>([]);
  const [serviceProviderOptions, setServiceProviderOptions] = React.useState<
    Array<{
      id: string;
      name: string;
      city: string;
      distanceKm?: number;
      serviceCategories?: string[];
      rating?: number;
      reviewCount?: number;
      completedJobs?: number;
      isVerified?: boolean;
    }>
  >([]);

  React.useEffect(() => {
    let cancelled = false;
    const loadProviders = async () => {
      const isAdmin = currentUser?.role === 'admin';
      try {
        const directory = isAdmin
          ? await fetchAdminServiceProviderDirectory()
          : await fetchPublicServiceProviderDirectory();
        if (!cancelled && directory.length > 0) {
          setServiceProviderBase(directory);
          return;
        }
      } catch (error) {
        logWarn('Failed to fetch service providers, falling back to users:', error);
      }

      if (cancelled) return;
      const fallback: ServiceProviderDirectoryEntry[] = (users || [])
        .filter((u) => u.role === 'seller' || u.role === 'service_provider')
        .flatMap((u) => {
          const id = u.id || u.email || u.name;
          const name = u.dealershipName || u.name;
          if (!id || !name) return [];
          return [{ id, name, city: u.location || 'Unknown', serviceCategories: [] as string[] }];
        });
      setServiceProviderBase(fallback);
    };
    void loadProviders();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.role, users]);

  React.useEffect(() => {
    let cancelled = false;
    const enrichWithDistance = async () => {
      if (serviceProviderBase.length === 0) {
        if (!cancelled) setServiceProviderOptions([]);
        return;
      }

      const userCity = selectedCity || userLocation || currentUser?.location || '';
      const cityCoords = userCity ? await getCityCoordinates(userCity) : null;
      const baseCoords = userCoords || cityCoords;

      const enriched = await Promise.all(
        serviceProviderBase.map(async (p) => {
          const providerCoords = p.city ? await getCityCoordinates(p.city) : null;
          const distanceKm =
            baseCoords && providerCoords ? calculateDistance(baseCoords, providerCoords) : undefined;
          return { ...p, distanceKm };
        }),
      );

      if (!cancelled) {
        setServiceProviderOptions(
          enriched.map((p) => ({
            id: p.id,
            name: p.name,
            city: p.city,
            distanceKm: p.distanceKm,
            serviceCategories: p.serviceCategories,
            ...(p.rating != null && Number.isFinite(p.rating) ? { rating: p.rating } : {}),
            ...(p.reviewCount != null ? { reviewCount: p.reviewCount } : {}),
            ...(p.completedJobs != null ? { completedJobs: p.completedJobs } : {}),
            ...(p.isVerified ? { isVerified: true } : {}),
          })),
        );
      }
    };
    void enrichWithDistance();
    return () => {
      cancelled = true;
    };
  }, [serviceProviderBase, selectedCity, userLocation, currentUser?.location, userCoords]);

  React.useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<ReridePriceDropDetail>).detail;
      if (!detail || !currentUser?.email || detail.userId !== currentUser.email) {
        return;
      }
      const v = vehicles.find((x) => x.id === detail.vehicleId);
      const oldStr = `₹${Number(detail.oldPrice).toLocaleString('en-IN')}`;
      const newStr = `₹${Number(detail.newPrice).toLocaleString('en-IN')}`;
      const message = v
        ? `${v.year} ${v.make} ${v.model}: price dropped from ${oldStr} to ${newStr}.`
        : `A wishlist vehicle’s price dropped from ${oldStr} to ${newStr}.`;

      const notif: Notification = {
        id: Date.now() + randomIntBelow(1000),
        recipientEmail: currentUser.email,
        title: 'Price drop',
        message,
        targetId: detail.vehicleId,
        vehicleId: detail.vehicleId,
        targetType: 'price_drop',
        type: 'price_drop',
        isRead: false,
        timestamp: new Date().toISOString(),
      };

      setNotifications((prev) => {
        const next = [notif, ...prev];
        try {
          persistReRideNotifications(next);
        } catch {
          /* ignore */
        }
        return next;
      });
      addToast(message, 'info');
    };

    window.addEventListener(RERIDE_PRICE_DROP_EVENT, handler);
    return () => window.removeEventListener(RERIDE_PRICE_DROP_EVENT, handler);
  }, [addToast, currentUser?.email, setNotifications, vehicles]);

  // Persist active chat id so the dock can reopen the last thread
  React.useEffect(() => {
    if (!currentUser) {
      try { localStorage.removeItem('reRideActiveChat'); } catch (error) {
        logDebug('Failed to clear active chat from localStorage (non-critical):', error);
      }
      return;
    }
    if (activeChat?.id) {
      try {
        localStorage.setItem('reRideActiveChat', JSON.stringify({
          id: activeChat.id,
          updatedAt: Date.now(),
        }));
      } catch (error) {
        logWarn('Failed to save active chat to localStorage:', error);
      }
    } else {
      // Clear localStorage when chat is closed
      try {
        localStorage.removeItem('reRideActiveChat');
      } catch (error) {
        logDebug('Failed to clear active chat from localStorage (non-critical):', error);
      }
    }
  }, [activeChat?.id, currentUser]);

  // Restore last active chat if present and belongs to the logged-in user
  // Use a ref to track if we've already attempted restoration to prevent re-opening closed chats
  const hasRestoredChatRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    // Only restore once per user session, not every time conversations change
    const userKey = currentUser?.email || 'anonymous';
    if (!currentUser || activeChat || hasRestoredChatRef.current === userKey) return;
    
    // Only restore if conversations are loaded
    if (!conversations || conversations.length === 0) return;
    
    try {
      const stored = localStorage.getItem('reRideActiveChat');
      if (!stored) {
        hasRestoredChatRef.current = userKey;
        return;
      }
      const parsed = JSON.parse(stored);
      const storedId = parsed?.id;
      if (!storedId) {
        hasRestoredChatRef.current = userKey;
        return;
      }
      const normalizedEmail = currentUser.email?.toLowerCase().trim();
      const isCustomer = currentUser.role === 'customer';
      const candidate = conversations.find(c => {
        if (!c) return false;
        const custMatch = c.customerId?.toLowerCase().trim() === normalizedEmail;
        const sellerMatch = c.sellerId?.toLowerCase().trim() === normalizedEmail;
        return isCustomer ? custMatch : sellerMatch;
      });
      if (candidate && candidate.id === storedId) {
        setActiveChat(candidate);
      }
      hasRestoredChatRef.current = userKey;
    } catch {
      hasRestoredChatRef.current = userKey;
    }
    // Intentionally omit conversations/activeChat/setActiveChat — full deps would re-run restore and fight "close chat"
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
  }, [currentUser?.email, currentUser?.role]);

  // Reset restoration flag when user changes
  React.useEffect(() => {
    hasRestoredChatRef.current = null;
  }, [currentUser?.email]);

  // Query-string deep links (?view=detail&id=) once catalog can resolve id — never override /vehicle/:id SPA routes.
  useEffect(() => {
    const handleDeepLink = () => {
      const path = routerLocation.pathname || '';
      if (path.includes('/vehicle/')) {
        return;
      }
      if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('/vehicle/')) {
        return;
      }
      const st = window.history.state as { usr?: { view?: unknown }; view?: unknown } | null;
      const embedded = st?.usr ?? st;
      if (embedded && typeof embedded === 'object' && embedded !== null && 'view' in embedded) {
        return;
      }

      const params = parseDeepLink();
      if (params.view) {
        const viewEnum = Object.values(ViewEnum).find(v => v === params.view) as ViewEnum | undefined;
        if (viewEnum) {
          setCurrentView(viewEnum);
          if (params.id && viewEnum === ViewEnum.DETAIL) {
            const vehicleId = typeof params.id === 'string' ? parseInt(params.id, 10) : Number(params.id);
            if (Number.isFinite(vehicleId)) {
              const vehicle = vehicles.find(v => Number(v.id) === vehicleId);
              if (vehicle) {
                selectVehicle(vehicle);
              }
            }
          }
        }
      }
    };

    handleDeepLink();
  }, [vehicles, setCurrentView, selectVehicle, routerLocation.pathname]);

  // Session restore is owned by AppProvider (validatePersistedSession). Only redirect off login screens.
  useEffect(() => {
    if (!currentUser) return;

    const loginViews: ViewEnum[] = [
      ViewEnum.LOGIN_PORTAL,
      ViewEnum.CUSTOMER_LOGIN,
      ViewEnum.SELLER_LOGIN,
      ViewEnum.ADMIN_LOGIN,
    ];

    if (!loginViews.includes(currentView)) return;

    switch (currentUser.role) {
      case 'seller':
        setCurrentView(ViewEnum.SELLER_DASHBOARD);
        break;
      case 'admin':
        setCurrentView(ViewEnum.ADMIN_PANEL);
        break;
      case 'service_provider':
        setCurrentView(ViewEnum.CAR_SERVICE_DASHBOARD);
        break;
      case 'finance_partner':
        setCurrentView(ViewEnum.HOME);
        break;
      default: {
        try {
          const returnView = sessionStorage.getItem('reride.postLoginView');
          sessionStorage.removeItem('reride.postLoginView');
          if (returnView === ViewEnum.DETAIL || returnView === 'DETAIL') {
            setCurrentView(ViewEnum.DETAIL);
            break;
          }
        } catch {
          /* ignore */
        }
        setCurrentView(ViewEnum.HOME);
        break;
      }
    }
  }, [currentUser, currentView, setCurrentView]);

  // Redirect logged-in users to their appropriate dashboard
  useEffect(() => {
    if (currentUser && currentView === ViewEnum.HOME) {
      switch (currentUser.role) {
        case 'customer':
          // Customers can access home page - no redirect
          break;
        case 'seller':
          // In mobile app, sellers can access home page
          if (!isMobileApp) {
            navigate(ViewEnum.SELLER_DASHBOARD);
          }
          break;
        case 'admin':
          navigate(ViewEnum.ADMIN_PANEL);
          break;
        default:
          // Keep on home page for other roles
          break;
      }
    }
  }, [currentUser, currentView, navigate, isMobileApp]);

  // Website-only keyboard shortcuts (Ctrl/Cmd+K for Command Palette)
  // Only enabled on website, not mobile app
  useEffect(() => {
    // Don't add keyboard shortcuts on mobile app
    if (isMobileApp) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea, or contenteditable
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl+K or Cmd+K to open Command Palette
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
      
      // ? or Ctrl+? to open Keyboard Shortcuts Help
      if (event.key === '?' && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setIsKeyboardShortcutsOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === '/') {
        event.preventDefault();
        setIsKeyboardShortcutsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileApp, setIsCommandPaletteOpen]);

  // Recover vehicle from sessionStorage on mount
  useEffect(() => {
    if (!selectedVehicle && currentView === ViewEnum.DETAIL) {
      try {
        const storedVehicle = sessionStorage.getItem('selectedVehicle');
        if (storedVehicle) {
          const vehicleToShow = JSON.parse(storedVehicle);
          if (process.env.NODE_ENV === 'development') {
            logInfo('🔧 Recovered vehicle from sessionStorage:', vehicleToShow?.id, vehicleToShow?.make, vehicleToShow?.model);
          }
          setSelectedVehicle(vehicleToShow);
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          logWarn('🔧 Failed to recover vehicle from sessionStorage:', error);
        }
      }
    }
  }, [currentView, selectedVehicle, setSelectedVehicle]);

  // Handle deep links: open seller profile via ?seller=email
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sellerParam = params.get('seller');
      if (sellerParam) {
        openSellerProfileByEmail(sellerParam);
      }
    } catch (e) {
      logWarn('Failed to process deep link params', e);
    }
  }, [openSellerProfileByEmail]);



  const handleAcceptDealChat = React.useCallback(
    async (leadId: string, conversationId?: string) => {
      if (!currentUser || currentUser.role !== 'seller') {
        addToast('Only the seller can accept chat', 'error');
        return;
      }
      try {
        await acceptDealChat(leadId, conversationId);
        addToast('Chat accepted! Buyer can now message you.', 'success');
        if (conversationId) {
          const conversation = conversations.find((c) => String(c.id) === String(conversationId));
          if (conversation) {
            if (isMobileApp) {
              setInboxConversationIdToOpen(String(conversation.id));
              navigate(ViewEnum.INBOX);
            } else {
              setActiveChat(conversation);
              navigate(ViewEnum.SELLER_DASHBOARD);
            }
          }
        }
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Failed to accept chat', 'error');
      }
    },
    [currentUser, conversations, addToast, isMobileApp, navigate, setActiveChat, setInboxConversationIdToOpen],
  );

  const handleNotificationClick = React.useCallback(
    (notification: Notification) => {
      if (process.env.NODE_ENV === 'development') {
        logInfo('Notification clicked:', notification);
      }

      const patchConversationRead = (conversation: Conversation) => {
        setConversations((prev: Conversation[]) =>
          prev.map((conv: Conversation) =>
            conv.id === conversation.id
              ? {
                  ...conv,
                  isReadBySeller: currentUser?.role === 'seller' ? true : conv.isReadBySeller,
                  isReadByCustomer: currentUser?.role === 'customer' ? true : conv.isReadByCustomer,
                }
              : conv
          )
        );
      };

      if (notification.targetType === 'deal' && notification.dealLeadId) {
        if (
          notification.dealAction === 'view_assistance' &&
          currentUser?.role === 'admin'
        ) {
          try {
            sessionStorage.setItem('reride_admin_tab', 'assistanceQueue');
            sessionStorage.setItem('reride_admin_assistance_lead', notification.dealLeadId);
          } catch {
            /* ignore */
          }
          navigate(ViewEnum.ADMIN_PANEL);
          return;
        }

        if (
          notification.dealAction === 'view_complaint' &&
          currentUser?.role === 'admin'
        ) {
          try {
            sessionStorage.setItem('reride_admin_tab', 'dealComplaints');
          } catch {
            /* ignore */
          }
          navigate(ViewEnum.ADMIN_PANEL);
          return;
        }

        const convId = notification.conversationId;
        const conversation = convId
          ? conversations.find((c) => String(c.id) === String(convId))
          : undefined;

        if (conversation) {
          patchConversationRead(conversation);
        }

        if (notification.dealAction === 'accept_chat' && currentUser?.role === 'seller') {
          void handleAcceptDealChat(notification.dealLeadId, convId);
          return;
        }

        if (conversation && currentUser) {
          if (currentUser.role === 'customer') {
            handleCloseChat();
            setInboxConversationIdToOpen(String(conversation.id));
            navigate(ViewEnum.INBOX);
          } else if (currentUser.role === 'seller') {
            if (isMobileApp) {
              setInboxConversationIdToOpen(String(conversation.id));
              navigate(ViewEnum.INBOX);
            } else {
              setActiveChat(conversation);
              navigate(ViewEnum.SELLER_DASHBOARD);
            }
          }
        } else {
          navigate(currentUser?.role === 'seller' ? ViewEnum.SELLER_DASHBOARD : ViewEnum.INBOX);
        }
        return;
      }

      if (notification.targetType === 'conversation') {
        const conversation = conversations.find(
          (conv) => String(conv.id) === String(notification.targetId)
        );
        if (!conversation || !currentUser) {
          return;
        }
        patchConversationRead(conversation);

        if (currentUser.role === 'customer') {
          handleCloseChat();
          setInboxConversationIdToOpen(String(conversation.id));
          navigate(ViewEnum.INBOX);
          return;
        }
        if (currentUser.role === 'seller') {
          if (isMobileApp) {
            setInboxConversationIdToOpen(String(conversation.id));
            navigate(ViewEnum.INBOX);
          } else {
            setActiveChat(conversation);
            try {
              sessionStorage.setItem('reride_seller_open_inquiries', '1');
            } catch {
              /* ignore */
            }
            navigate(ViewEnum.SELLER_DASHBOARD);
          }
        }
        return;
      }

      const rawVid =
        notification.vehicleId ??
        (typeof notification.targetId === 'number'
          ? notification.targetId
          : Number(notification.targetId));
      const vehicleMatch =
        rawVid !== undefined && rawVid !== null && !Number.isNaN(Number(rawVid))
          ? vehicles.find((v) => v.id === Number(rawVid))
          : undefined;

      if (
        (notification.targetType === 'vehicle' || notification.targetType === 'price_drop') &&
        vehicleMatch
      ) {
        selectVehicle(vehicleMatch);
        return;
      }

      if (notification.targetType === 'price_drop' || notification.targetType === 'vehicle') {
        navigate(ViewEnum.USED_CARS);
        return;
      }

      if (notification.type === 'wishlist') {
        navigate(ViewEnum.WISHLIST);
        return;
      }

      if (notification.targetType === 'insurance_expiry') {
        navigate(ViewEnum.PROFILE);
        return;
      }

      if (notification.targetType === 'general_admin') {
        if (currentUser?.role === 'seller') {
          navigate(ViewEnum.SELLER_DASHBOARD);
        } else if (currentUser?.role === 'customer') {
          navigate(ViewEnum.BUYER_DASHBOARD);
        } else {
          navigate(ViewEnum.HOME);
        }
        return;
      }

      navigate(ViewEnum.HOME);
    },
    [
      conversations,
      currentUser,
      handleCloseChat,
      isMobileApp,
      navigate,
      selectVehicle,
      setActiveChat,
      setConversations,
      setInboxConversationIdToOpen,
      vehicles,
      handleAcceptDealChat,
    ]
  );

  useEffect(() => {
    const onNativePushTap = (event: Event) => {
      const data = normalizeNativePushPayload(
        (event as CustomEvent<Record<string, unknown>>).detail,
      );

      if (data.notificationId != null) {
        const notification = notifications.find((n) => n.id === data.notificationId);
        if (notification) {
          handleNotificationClick(notification);
          return;
        }
      }

      if (data.type === 'deal' && data.leadId && data.action === 'accept_chat') {
        void handleAcceptDealChat(data.leadId, data.conversationId);
        return;
      }

      if (data.type === 'deal' && data.leadId && data.action === 'view_assistance') {
        try {
          sessionStorage.setItem('reride_admin_tab', 'assistanceQueue');
          sessionStorage.setItem('reride_admin_assistance_lead', data.leadId);
        } catch {
          /* ignore */
        }
        navigate(ViewEnum.ADMIN_PANEL);
        return;
      }

      if (data.url) {
        applyNotificationDeepLinkUrl(data.url);
        return;
      }

      if (data.vehicleId != null) {
        const vehicle = vehicles.find((v) => Number(v.id) === data.vehicleId);
        if (vehicle) {
          selectVehicle(vehicle);
          return;
        }
      }

      if (data.view) {
        const viewEnum = Object.values(ViewEnum).find((v) => v === data.view) as
          | ViewEnum
          | undefined;
        if (viewEnum) {
          navigate(viewEnum);
        }
      }
    };

    window.addEventListener('reride:native-push-tap', onNativePushTap);
    return () => window.removeEventListener('reride:native-push-tap', onNativePushTap);
  }, [
    handleNotificationClick,
    handleAcceptDealChat,
    isMobileApp,
    navigate,
    notifications,
    selectVehicle,
    vehicles,
  ]);

  const persistNotifications = React.useCallback((updated: Notification[]) => {
    try {
      persistReRideNotifications(updated);
    } catch (error) {
      logWarn('Failed to persist notifications:', error);
    }
  }, []);

  const handleMarkNotificationsAsRead = React.useCallback(async (ids: number[]) => {
    if (!ids.length) {
      return;
    }

    const updated = notifications.map(notification =>
      ids.includes(notification.id)
        ? { ...notification, isRead: true }
        : notification
    );

    setNotifications(updated);
    persistNotifications(updated);
    
    // Update in MongoDB (async, don't block)
    try {
      const { updateNotificationInMongoDB } = await import('./services/notificationService');
      ids.forEach(id => {
        updateNotificationInMongoDB(id, { isRead: true }).catch(err => {
          logWarn('Failed to update notification in MongoDB:', err);
        });
      });
    } catch (error) {
      logWarn('Failed to import notification service:', error);
    }
  }, [notifications, persistNotifications, setNotifications]);

  const handleMarkAllNotificationsAsRead = React.useCallback(async () => {
    if (!notifications.length) {
      return;
    }

    const updated = notifications.map(notification => ({
      ...notification,
      isRead: true,
    }));

    setNotifications(updated);
    persistNotifications(updated);
    
    // Update all in MongoDB (async, don't block)
    const { updateNotificationInMongoDB } = await import('./services/notificationService');
    notifications.forEach(notification => {
      if (!notification.isRead) {
        updateNotificationInMongoDB(notification.id, { isRead: true }).catch(err => {
          logWarn('Failed to update notification in MongoDB:', err);
        });
      }
    });
  }, [notifications, persistNotifications, setNotifications]);

  const handleOpenCommandPalette = React.useCallback(() => {
    setIsCommandPaletteOpen(true);
  }, [setIsCommandPaletteOpen]);

  const getPageTitle = React.useCallback(() => {
    switch (currentView) {
      case ViewEnum.HOME:
        return 'Home';
      case ViewEnum.USED_CARS:
        return 'Browse Cars';
      case ViewEnum.RENTAL:
        return 'Browse Cars';
      case ViewEnum.DETAIL:
        return selectedVehicle ? selectedVehicle.make + ' ' + selectedVehicle.model : 'Vehicle Details';
      case ViewEnum.SELLER_DASHBOARD:
        return 'My Dashboard';
      case ViewEnum.BUYER_DASHBOARD:
        return 'My Account';
      case ViewEnum.PROFILE:
        return 'My Profile';
      case ViewEnum.INBOX:
        return 'Messages';
      case ViewEnum.WISHLIST:
        return 'Wishlist';
      case ViewEnum.COMPARISON:
        return 'Compare Vehicles';
      case ViewEnum.ADMIN_PANEL:
        return 'Admin Panel';
      case ViewEnum.LOGIN_PORTAL:
        return 'Login';
      case ViewEnum.CUSTOMER_LOGIN:
        return 'Login';
      case ViewEnum.SELLER_LOGIN:
        return 'Seller Login';
      case ViewEnum.ADMIN_LOGIN:
        return 'Admin Login';
      case ViewEnum.FORGOT_PASSWORD:
        return 'Reset Password';
      case ViewEnum.CAR_SERVICES:
        return 'Car Services';
      case ViewEnum.DEALER_PROFILES:
        return 'Dealer Profiles';
      case ViewEnum.CAR_SERVICE_LOGIN:
        return 'Car Service Login';
      case ViewEnum.CAR_SERVICE_DASHBOARD:
        return 'Car Service Dashboard';
      case ViewEnum.SERVICE_CART:
        return 'Service Cart';
      case ViewEnum.SUPPORT:
        return 'Support';
      case ViewEnum.ABOUT_US:
        return 'About';
      case ViewEnum.FAQ:
        return 'FAQ';
      case ViewEnum.SAFETY_CENTER:
        return 'Safety';
      case ViewEnum.CITY_LANDING:
        return selectedCity || 'City';
      case ViewEnum.SELLER_PROFILE:
        return publicSellerProfile?.name || 'Seller Profile';
      case ViewEnum.NOTIFICATIONS_CENTER:
        return 'Activity';
      default:
        return 'ReRide';
    }
  }, [currentView, selectedVehicle, selectedCity, publicSellerProfile]);

  const seoMeta = useMemo(
    () =>
      computePageSeoMeta({
        view: currentView,
        pathname: routerLocation.pathname,
        selectedVehicle,
        selectedCity,
        sellerDisplayName: publicSellerProfile?.name ?? null,
      }),
    [currentView, routerLocation.pathname, selectedVehicle, selectedCity, publicSellerProfile?.name],
  );

  const appViewRenderer = (
    <AppViewRenderer
      serviceProvider={serviceProvider}
      setServiceProvider={setServiceProvider}
      serviceProviderOptions={serviceProviderOptions}
      inboxConversationIdToOpen={inboxConversationIdToOpen}
      handleInboxInitialConversationConsumed={handleInboxInitialConversationConsumed}
      filtersFromUrl={filtersFromUrl}
      applyFilters={applyFilters}
      handleBrowseAllIndia={handleBrowseAllIndia}
      handleHomeUseMyLocation={handleHomeUseMyLocation}
      openSellerProfileByEmail={openSellerProfileByEmail}
      requireLoginForDealerInteraction={requireLoginForDealerInteraction}
      handleServiceRequestSubmit={handleServiceRequestSubmit}
      handleUseMyLocation={handleUseMyLocation}
      handleStartVehicleChat={handleStartVehicleChat}
      handleRequestTestDrive={handleRequestTestDrive}
      handleTestDriveResponse={handleTestDriveResponse}
      handleSellerOpenChatFromDashboard={handleSellerOpenChatFromDashboard}
      setForgotPasswordRole={setForgotPasswordRole}
      handleLogin={handleLogin}
      handleRegister={handleRegister}
      handleLogoutAll={handleLogoutAll}
      handleNotificationClick={handleNotificationClick}
      handleAcceptDealChat={handleAcceptDealChat}
      handleMarkNotificationsAsRead={handleMarkNotificationsAsRead}
      handleMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
      markAllVisibleAsRead={markAllVisibleAsRead}
      isLocating={isLocating}
      locationError={locationError}
    />
  );

  /** On vehicle detail, only auto-expand chat when it belongs to the listing being viewed. */
  const chatInlineLaunch = React.useMemo(() => {
    if (currentView !== ViewEnum.DETAIL || !selectedVehicle || !activeChat) return true;
    return Number(activeChat.vehicleId) === Number(selectedVehicle.id);
  }, [currentView, selectedVehicle?.id, activeChat?.vehicleId, activeChat?.id]);

  // Render Mobile App Layout
  if (isMobileApp) {
    if (process.env.NODE_ENV === 'development') {
      logInfo('📱 Rendering Mobile App UI for view:', currentView);
    }
    
    // For ALL other views (Home, Browse, Detail, etc.), show mobile UI using MobileLayout
    // Hide header for HOME view since it has its own hero section
    const mobileAuthViews: ViewEnum[] = [
      ViewEnum.LOGIN_PORTAL,
      ViewEnum.CUSTOMER_LOGIN,
      ViewEnum.SELLER_LOGIN,
      ViewEnum.ADMIN_LOGIN,
      ViewEnum.FORGOT_PASSWORD,
      ViewEnum.CAR_SERVICE_LOGIN,
    ];
    const isMobileAuthView = mobileAuthViews.includes(currentView);
    // Title bar removed — brand top bar + bottom nav cover navigation; pages own back/search UI.
    const hideBottomNavOnDetail =
      currentView === ViewEnum.DETAIL ||
      currentView === ViewEnum.NOTIFICATIONS_CENTER ||
      isMobileAuthView;
    return (
      <>
        <SEO {...seoMeta} />
        <NativePushRegistration userEmail={currentUser?.email} />
        <WebPushRegistration
          userEmail={currentUser?.email}
          enabled={currentUser?.role === 'seller'}
        />
        <AppRatingPrompt />
        {/* Mobile Feature Managers */}
        <MobilePushNotificationManager
          notifications={pushNotificationsForCurrentUser}
          onNotificationClick={handleNotificationClick}
          profileMuteKeys={currentUser?.notificationMuteKeys}
        />
        <ShareTargetHandler
          onNavigate={navigate}
        />
        <OfflineIndicator />
        
        <MobileLayout
          showHeader={false}
          showBottomNav={!hideBottomNavOnDetail}
          showBrandBar={!isMobileAuthView}
          headerTitle={getPageTitle()}
          showBack={
            currentView === ViewEnum.DETAIL || currentView === ViewEnum.NOTIFICATIONS_CENTER
          }
          onBack={() =>
            currentView === ViewEnum.NOTIFICATIONS_CENTER
              ? goBack(ViewEnum.HOME)
              : goBack(ViewEnum.USED_CARS)
          }
          currentView={currentView}
          onNavigate={navigate}
          currentUser={currentUser}
          onLogout={handleLogoutAll}
          wishlistCount={wishlist.length}
          compareCount={comparisonList.length}
          inboxCount={unreadMessagesCount}
          unreadNotificationCount={unreadNotificationsCount}
          serviceProvider={serviceProvider}
        >
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <PageTransition currentView={currentView}>
                {appViewRenderer}
              </PageTransition>
            </Suspense>
          </ErrorBoundary>
        </MobileLayout>

        <MobileSearch
          onNavigate={navigate}
          onSearch={(query) => {
            setInitialSearchQuery(query);
            navigate(ViewEnum.USED_CARS);
          }}
        />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        {pendingSurvey && (
          <DealSurveyModal
            surveyId={pendingSurvey.surveyId}
            leadId={pendingSurvey.leadId}
            vehicleName={pendingSurvey.vehicleName}
            onClose={() => setPendingSurvey(null)}
            onSubmitted={() => setPendingSurvey(null)}
          />
        )}
        {currentUser && activeChat && (
          <ChatErrorBoundary>
            <Suspense fallback={<MinimalLoader />}>
              <ChatWidget
                conversation={activeChat}
                currentUserRole={currentUser.role === 'seller' ? 'seller' : 'customer'}
                currentUserEmail={currentUser.email}
                otherUserName={resolveChatOtherPartyName(users, activeChat, currentUser.role === 'seller' ? 'seller' : 'customer')}
                otherUserOnline={chatPeerOnlineByConversationId[String(activeChat.id)]}
                callTargetPhone={resolveChatCallPhone(users, vehicles, activeChat, currentUser.role === 'seller' ? 'seller' : 'customer')}
                callTargetName={resolveChatOtherPartyName(users, activeChat, currentUser.role === 'seller' ? 'seller' : 'customer')}
                isInlineLaunch={chatInlineLaunch}
                onStartCall={(phone) => {
                  if (!phone) return;
                  window.open(`tel:${phone}`);
                }}
                onClose={handleCloseChat}
                onSendMessage={(messageText, type, payload) => {
                  if (type || payload) {
                    sendMessageWithType(activeChat.id, messageText, type, payload);
                  } else {
                    sendMessage(activeChat.id, messageText);
                  }
                }}
                typingStatus={typingStatus}
                onUserTyping={(conversationId, _userRole) => {
                  toggleTyping(conversationId, true);
                }}
                onUserStoppedTyping={(conversationId) => toggleTyping(conversationId, false)}
                uploaderEmail={currentUser?.email}
                onMarkMessagesAsRead={(conversationId, _readerRole) => {
                  markAsRead(conversationId, { readerRole: _readerRole, forceReadState: true });
                }}
                onFlagContent={(type, id, _reason) => {
                  flagContent(type, id);
                }}
                onOfferResponse={(conversationId, messageId, response, counterPrice) => {
                  onOfferResponse(conversationId, messageId, response, counterPrice);
                }}
                onTestDriveResponse={handleTestDriveResponse}
                onClearChat={clearConversationMessages}
                onArchiveConversation={archiveConversation}
                onDeleteConversation={deleteConversation}
                onSetConversationReadState={(conversationId, isRead) =>
                  setConversationReadState(
                    conversationId,
                    currentUser.role === 'seller' ? 'seller' : 'customer',
                    isRead,
                  )
                }
              />
            </Suspense>
          </ChatErrorBoundary>
        )}
      </>
    );
  }
  
  // Render Desktop/Website Layout
  /** When true, hide site footer (admin ops area); header is always shown on desktop, including on /admin. */
  const isDesktopAdminNoFooter = currentView === ViewEnum.ADMIN_PANEL && userHasAdminRole(currentUser);

  return (
    <>
      <SEO {...seoMeta} />
      <NativePushRegistration userEmail={currentUser?.email} />
      <WebPushRegistration
        userEmail={currentUser?.email}
        enabled={currentUser?.role === 'seller'}
      />
      <AppRatingPrompt />
      {/* Mobile Feature Managers (also work on desktop) */}
      <MobilePushNotificationManager
        notifications={pushNotificationsForCurrentUser}
        onNotificationClick={handleNotificationClick}
        profileMuteKeys={currentUser?.notificationMuteKeys}
      />
      <ShareTargetHandler
        onNavigate={navigate}
      />
      <OfflineIndicator />
      <div className={`min-h-screen ${isDesktopAdminNoFooter ? 'bg-slate-100' : 'bg-gray-50'}`}>
        <Header 
          onNavigate={navigate}
          currentUser={currentUser}
          serviceProvider={serviceProvider}
          onLogout={handleLogoutAll}
          compareCount={comparisonList.length}
          wishlistCount={wishlist.length}
          inboxCount={unreadMessagesCount}
          isHomePage={currentView === ViewEnum.HOME}
          onOpenMessages={handleOpenMessages}
          notifications={notifications.filter(n => {
            if (!n.recipientEmail || !currentUser?.email) return false;
            return n.recipientEmail.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
          })}
          onNotificationClick={handleNotificationClick}
          onMarkNotificationsAsRead={handleMarkNotificationsAsRead}
          onMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
          onOpenCommandPalette={handleOpenCommandPalette}
          userLocation={userLocation}
          onLocationChange={setUserLocation}
          addToast={addToast}
          allVehicles={vehicles}
          selectedCity={selectedCity}
          onBrowseAllIndia={handleBrowseAllIndia}
          onUseMyLocation={handleHomeUseMyLocation}
        />
        <main id="main-content" className="min-h-[calc(100vh-140px)]" tabIndex={-1}>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <PageTransition currentView={currentView}>
                {appViewRenderer}
              </PageTransition>
            </Suspense>
          </ErrorBoundary>
        </main>
        {!isDesktopAdminNoFooter && <Footer onNavigate={navigate} />}
        
        {/* Desktop Global Components */}
        <PWAInstallPrompt />
        <ToastContainer 
          toasts={toasts} 
          onRemove={removeToast} 
        />
        {pendingSurvey && (
          <DealSurveyModal
            surveyId={pendingSurvey.surveyId}
            leadId={pendingSurvey.leadId}
            vehicleName={pendingSurvey.vehicleName}
            onClose={() => setPendingSurvey(null)}
            onSubmitted={() => setPendingSurvey(null)}
          />
        )}
        <Suspense fallback={<MinimalLoader />}>
          <CommandPalette 
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
            onNavigate={navigate}
            currentUser={currentUser}
            onLogout={handleLogoutAll}
          />
        </Suspense>
        <Suspense fallback={<MinimalLoader />}>
          <KeyboardShortcutsHelp
            isOpen={isKeyboardShortcutsOpen}
            onClose={() => setIsKeyboardShortcutsOpen(false)}
          />
        </Suspense>
        {currentUser && activeChat && (
          <ChatErrorBoundary>
            <Suspense fallback={<MinimalLoader />}>
              <ChatWidget
                conversation={activeChat}
                currentUserRole={currentUser.role === 'seller' ? 'seller' : 'customer'}
                currentUserEmail={currentUser.email}
                otherUserName={resolveChatOtherPartyName(users, activeChat, currentUser.role === 'seller' ? 'seller' : 'customer')}
                otherUserOnline={chatPeerOnlineByConversationId[String(activeChat.id)]}
                callTargetPhone={resolveChatCallPhone(users, vehicles, activeChat, currentUser.role === 'seller' ? 'seller' : 'customer')}
                callTargetName={resolveChatOtherPartyName(users, activeChat, currentUser.role === 'seller' ? 'seller' : 'customer')}
                isInlineLaunch={chatInlineLaunch}
                onStartCall={(phone) => {
                  if (!phone) return;
                  window.open(`tel:${phone}`);
                }}
                onClose={handleCloseChat}
                onSendMessage={(messageText, type, payload) => {
                  if (type || payload) {
                    sendMessageWithType(activeChat.id, messageText, type, payload);
                  } else {
                    sendMessage(activeChat.id, messageText);
                  }
                }}
                typingStatus={typingStatus}
                onUserTyping={(conversationId, _userRole) => {
                  toggleTyping(conversationId, true);
                }}
                onUserStoppedTyping={(conversationId) => toggleTyping(conversationId, false)}
                uploaderEmail={currentUser?.email}
                onMarkMessagesAsRead={(conversationId, _readerRole) => {
                  markAsRead(conversationId, { readerRole: _readerRole, forceReadState: true });
                }}
                onFlagContent={(type, id, _reason) => {
                  flagContent(type, id);
                }}
                onOfferResponse={(conversationId, messageId, response, counterPrice) => {
                  onOfferResponse(conversationId, messageId, response, counterPrice);
                }}
                onTestDriveResponse={handleTestDriveResponse}
                onClearChat={clearConversationMessages}
                onArchiveConversation={archiveConversation}
                onDeleteConversation={deleteConversation}
                onSetConversationReadState={(conversationId, isRead) =>
                  setConversationReadState(
                    conversationId,
                    currentUser.role === 'seller' ? 'seller' : 'customer',
                    isRead,
                  )
                }
              />
            </Suspense>
          </ChatErrorBoundary>
        )}
      </div>
    </>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppProvider>
        <TranslationProvider>
          <AppContent />
          <CookieConsentBanner />
        </TranslationProvider>
      </AppProvider>
    </ErrorBoundary>
  );
};

export default App;
