import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import type { Conversation, Notification, Toast, User } from '../../types';
import { View } from '../../types';
import { getSupabaseClient } from '../../lib/supabase';
import { saveConversations } from '../../services/chatService';
import { syncServiceProviderOAuth, syncWithBackend } from '../../services/supabase-auth-service';
import { resetAuthFetchStateAfterLogout } from '../../utils/authenticatedFetch';
import { clearSupabaseAuthStorage } from '../../utils/authStorage';
import { logDebug, logError, logInfo, logWarn } from '../../utils/logger';
import { clearUserContext, setUserContext } from '../../utils/monitoring';
import { persistReRideNotifications } from '../../utils/notificationLocalStorage';
import { clearRememberMeState } from '../../utils/rememberMe';
import { currentUserForLocalSessionJson } from '../../utils/userLocalStorageSnapshot';
import {
  clearPersistedUserSession,
  isPersistedSessionAuthenticated,
  readPersistedUser,
} from '../../utils/validatePersistedSession';
import { scheduleCapacitorPostLoginUi } from './helpers';

type RouterNavigate = ReturnType<typeof useNavigate>;
type TypingStatus = { conversationId: string; userRole: 'customer' | 'seller' } | null;

export type UseAppAuthRuntimeParams = {
  addToast: (message: string, type: Toast['type']) => void;
  t: TFunction;
  routerNavigate: RouterNavigate;
  currentView: View;
  setCurrentView: (v: View) => void;
  setActiveChat: Dispatch<SetStateAction<Conversation | null>>;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  setTypingStatus: Dispatch<SetStateAction<TypingStatus>>;
  setChatPeerOnlineByConversationId: Dispatch<SetStateAction<Record<string, boolean>>>;
  setComparisonList: Dispatch<SetStateAction<number[]>>;
  setWishlist: Dispatch<SetStateAction<number[]>>;
  setNotifications: Dispatch<SetStateAction<Notification[]>>;
};

type UseAppAuthRuntimeResult = {
  currentUser: User | null;
  setCurrentUser: Dispatch<SetStateAction<User | null>>;
  currentUserRef: React.MutableRefObject<User | null>;
  handleLogin: (user: User) => void;
  handleLogout: () => Promise<void>;
  handleRegister: (user: User) => void;
};

export function useAppAuthRuntime({
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
  setNotifications,
}: UseAppAuthRuntimeParams): UseAppAuthRuntimeResult {
  /** Prevents double handleLogin when both getSession + onAuthStateChange run after Google OAuth */
  const googleOAuthSyncDoneRef = useRef(false);
  /** While tryFinishGoogleOAuth is calling syncWithBackend — blocks duplicate session-restore sync */
  const oauthGoogleProfileSyncInFlightUidRef = useRef<string | null>(null);
  const handleRegisterRef = useRef<(user: User) => void>(() => {});
  /** Mutex for session-restore sync (auth events can fire in bursts) */
  const profileRestoreFromSupabaseInFlightRef = useRef(false);
  /** Blocks Supabase session-restore / OAuth handlers from re-logging in during sign-out */
  const logoutInProgressRef = useRef(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const currentUserRef = useRef<User | null>(null);
  currentUserRef.current = currentUser;

  // Restore or reject persisted sessions (no optimistic auth UI before token validation).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('reRideCurrentUser')) return;

    let cancelled = false;
    void (async () => {
      const authenticated = await isPersistedSessionAuthenticated();
      if (cancelled) return;

      if (authenticated) {
        const user = readPersistedUser();
        if (user) {
          logInfo('🔄 Restoring logged-in user after session validation:', {
            name: user.name,
            email: user.email,
            role: user.role,
            userId: user.id,
          });
          setCurrentUser(user);
        }
        return;
      }

      logWarn('⚠️ Persisted session failed token validation — signing out');
      setCurrentUser(null);
      clearPersistedUserSession();
      resetAuthFetchStateAfterLogout();
      try {
        const { logout: logoutService } = await import('../../services/userService');
        logoutService();
      } catch (logoutError) {
        logWarn('Session cleanup logout error:', logoutError);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = useCallback(async () => {
    logoutInProgressRef.current = true;
    try {
      // Local sign-out only: default global signOut() revokes on Supabase (logout?scope=global)
      // and returns 403 when the access token is already expired, which blocks logout.
      try {
        const supabase = getSupabaseClient();
        const { error: signOutErr } = await supabase.auth.signOut({ scope: 'local' });
        if (signOutErr) {
          logDebug('Supabase local sign out:', signOutErr.message);
        }
      } catch (supabaseError) {
        logDebug('Supabase sign out skipped:', supabaseError);
      }
      clearSupabaseAuthStorage();

      try {
        const { signOutGoogleNativeIfAvailable } = await import('../../utils/nativeGoogleSignIn');
        await signOutGoogleNativeIfAvailable();
      } catch (googleSignOutError) {
        logDebug('Native Google sign out skipped:', googleSignOutError);
      }

      // Clear tokens via logout service (includes Keychain / Keystore JWT pair on Capacitor)
      try {
        const { logout: logoutService } = await import('../../services/userService');
        await logoutService();
      } catch (logoutError) {
        logWarn('Logout service error:', logoutError);
      }

      // Clear user state
      setCurrentUser(null);
      clearUserContext();
      clearPersistedUserSession();

      // Clear storage
      sessionStorage.removeItem('reride_oauth_role');
      sessionStorage.removeItem('reride_oauth_mode');
      sessionStorage.removeItem('reride_last_role');
      googleOAuthSyncDoneRef.current = false;
      oauthGoogleProfileSyncInFlightUidRef.current = null;
      localStorage.removeItem('reRideAccessToken');
      localStorage.removeItem('reRideRefreshToken');
      try {
        localStorage.removeItem('reride_oauth_role');
        localStorage.removeItem('reride_oauth_mode');
        localStorage.removeItem('reride_last_role');
      } catch {
        /* ignore */
      }
      localStorage.removeItem('reRideServiceProvider');
      clearRememberMeState();
      resetAuthFetchStateAfterLogout();

      // Clear user-specific data
      setActiveChat(null);
      setConversations([]);
      try {
        saveConversations([]);
      } catch {
        /* ignore */
      }
      setTypingStatus(null);
      setChatPeerOnlineByConversationId({});
      setComparisonList([]);
      setNotifications([]);
      try {
        persistReRideNotifications([]);
      } catch {
        /* ignore */
      }
      try {
        localStorage.removeItem('reride_comparison_list');
      } catch {
        /* ignore storage errors */
      }

      // Navigate to home
      setCurrentView(View.HOME);

      // Show success message
      addToast(t('toast.loggedOut'), 'info');
    } catch (error) {
      logError('Error during logout:', error);
      try {
        const { signOutGoogleNativeIfAvailable } = await import('../../utils/nativeGoogleSignIn');
        await signOutGoogleNativeIfAvailable();
      } catch {
        /* ignore */
      }
      try {
        const { logout: logoutService } = await import('../../services/userService');
        await logoutService();
      } catch {
        /* ignore */
      }
      // Even if there's an error, clear local state
      setCurrentUser(null);
      clearPersistedUserSession();
      sessionStorage.removeItem('reride_oauth_role');
      sessionStorage.removeItem('reride_oauth_mode');
      sessionStorage.removeItem('reride_last_role');
      googleOAuthSyncDoneRef.current = false;
      oauthGoogleProfileSyncInFlightUidRef.current = null;
      localStorage.removeItem('reRideAccessToken');
      localStorage.removeItem('reRideRefreshToken');
      try {
        localStorage.removeItem('reride_oauth_role');
        localStorage.removeItem('reride_oauth_mode');
        localStorage.removeItem('reride_last_role');
      } catch {
        /* ignore */
      }
      localStorage.removeItem('reRideServiceProvider');
      clearSupabaseAuthStorage();
      try {
        localStorage.removeItem('reride_wishlist');
        localStorage.removeItem('reride_comparison_list');
      } catch {
        /* ignore */
      }
      resetAuthFetchStateAfterLogout();
      clearRememberMeState();
      setConversations([]);
      try {
        saveConversations([]);
      } catch {
        /* ignore */
      }
      setTypingStatus(null);
      setChatPeerOnlineByConversationId({});
      setNotifications([]);
      try {
        persistReRideNotifications([]);
      } catch {
        /* ignore */
      }
      setCurrentView(View.HOME);
      setActiveChat(null);
      setComparisonList([]);
      setWishlist([]);
      addToast(t('toast.loggedOut'), 'info');
    } finally {
      window.setTimeout(() => {
        logoutInProgressRef.current = false;
      }, 2000);
    }
  }, [
    addToast,
    setActiveChat,
    setChatPeerOnlineByConversationId,
    setComparisonList,
    setConversations,
    setCurrentView,
    setNotifications,
    setTypingStatus,
    setWishlist,
    t,
  ]);

  // Listen for userDataUpdated events to sync currentUser state when plan expiry changes
  useEffect(() => {
    const handleUserDataUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ user: User }>;
      if (customEvent.detail?.user) {
        const updatedUser = customEvent.detail.user;
        // Only update if this is the current user
        setCurrentUser((prev) => {
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

  const handleLogin = useCallback(
    (user: User) => {
      if (logoutInProgressRef.current) {
        logDebug('handleLogin skipped — logout in progress');
        return;
      }
      // CRITICAL: Validate user object before setting
      if (!user || !user.email || !user.role) {
        logError('❌ Invalid user object in handleLogin:', {
          hasUser: !!user,
          hasEmail: !!user?.email,
          hasRole: !!user?.role,
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
      setUserContext({ id: userForSession.id || userForSession.email, email: userForSession.email });
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
            localMatches: storedInLocal ? JSON.parse(storedInLocal).email === userForSession.email : false,
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
          let customerView = View.HOME;
          try {
            const returnView = sessionStorage.getItem('reride.postLoginView');
            sessionStorage.removeItem('reride.postLoginView');
            if (returnView === View.DETAIL || returnView === 'DETAIL') {
              customerView = View.DETAIL;
            }
          } catch {
            /* ignore */
          }
          postLoginView = customerView;
          setCurrentView(customerView);
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
    },
    [addToast, currentView, routerNavigate, setCurrentView, t],
  );

  // After Supabase Google OAuth redirect: session exists; sync profile with ReRide API and log in
  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseClient();

    const tryFinishGoogleOAuth = async (session: Session | null) => {
      if (logoutInProgressRef.current) return;
      let pendingRole = sessionStorage.getItem('reride_oauth_role') as
        | 'customer'
        | 'seller'
        | 'service_provider'
        | null;
      if (!pendingRole) {
        try {
          pendingRole = localStorage.getItem('reride_oauth_role') as typeof pendingRole;
        } catch {
          /* ignore */
        }
      }
      let pendingMode: 'login' | 'register' =
        (sessionStorage.getItem('reride_oauth_mode') as 'login' | 'register' | null) || 'login';
      if (!sessionStorage.getItem('reride_oauth_mode')) {
        try {
          const fromLocal = localStorage.getItem('reride_oauth_mode') as 'login' | 'register' | null;
          if (fromLocal) pendingMode = fromLocal;
        } catch {
          /* ignore */
        }
      }
      if (!pendingRole || !session?.user || googleOAuthSyncDoneRef.current || cancelled) {
        return;
      }
      googleOAuthSyncDoneRef.current = true;
      oauthGoogleProfileSyncInFlightUidRef.current = session.user.id;
      const accessToken = session.access_token;
      try {
        try {
          sessionStorage.removeItem('reride_oauth_role');
          sessionStorage.removeItem('reride_oauth_mode');
          localStorage.removeItem('reride_oauth_role');
          localStorage.removeItem('reride_oauth_mode');
          sessionStorage.removeItem('reride_oauth_mode');
          localStorage.removeItem('reride_oauth_mode');
        } catch {
          /* ignore */
        }

        try {
          if (pendingRole === 'service_provider') {
            const result = await syncServiceProviderOAuth(
              session.user as unknown as Record<string, unknown>,
              accessToken,
            );
            if (result.success && result.provider) {
              try {
                window.dispatchEvent(
                  new CustomEvent('reride:service-provider-oauth', { detail: result.provider }),
                );
                window.dispatchEvent(new CustomEvent('reride:oauth-complete'));
              } catch {
                /* ignore */
              }
            } else {
              googleOAuthSyncDoneRef.current = false;
              addToast(result.reason || t('toast.googleSignInFailed'), 'error');
              await supabase.auth.signOut({ scope: 'local' });
              clearSupabaseAuthStorage();
              try {
                window.dispatchEvent(
                  new CustomEvent('reride:oauth-failed', {
                    detail: { message: result.reason || t('toast.googleSignInFailed') },
                  }),
                );
              } catch {
                /* ignore */
              }
            }
            return;
          }

          const result = await syncWithBackend(
            session.user as unknown as Record<string, unknown>,
            pendingRole,
            'google',
            accessToken,
          );
          if (result.success && result.user) {
            if (pendingMode === 'register') {
              handleRegisterRef.current(result.user);
            } else {
              handleLogin(result.user);
            }
            try {
              window.dispatchEvent(new CustomEvent('reride:oauth-complete'));
            } catch {
              /* ignore */
            }
          } else {
            googleOAuthSyncDoneRef.current = false;
            addToast(result.reason || t('toast.googleSignInFailed'), 'error');
            await supabase.auth.signOut({ scope: 'local' });
            clearSupabaseAuthStorage();
            try {
              window.dispatchEvent(
                new CustomEvent('reride:oauth-failed', {
                  detail: { message: result.reason || t('toast.googleSignInFailed') },
                }),
              );
            } catch {
              /* ignore */
            }
          }
        } catch (e) {
          googleOAuthSyncDoneRef.current = false;
          logError('Google OAuth backend sync failed:', e);
          addToast(t('toast.googleSignInFailed'), 'error');
          await supabase.auth.signOut({ scope: 'local' });
          clearSupabaseAuthStorage();
          try {
            window.dispatchEvent(
              new CustomEvent('reride:oauth-failed', { detail: { message: t('toast.googleSignInFailed') } }),
            );
          } catch {
            /* ignore */
          }
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
    const onOAuthFailed = (e: Event) => {
      const msg = (e as CustomEvent<{ message?: string }>).detail?.message;
      addToast(msg || t('toast.googleSignInFailed'), 'error');
    };
    window.addEventListener('reride:oauth-failed', onOAuthFailed);
    return () => window.removeEventListener('reride:oauth-failed', onOAuthFailed);
  }, [addToast, t]);

  // Supabase session exists but ReRide profile not in memory — resync (cold start, or PKCE finished after first paint).
  // Subscribes to auth changes so we retry when the session appears (previous one-shot ref blocked this forever).
  useEffect(() => {
    if (currentUser) return;

    const supabase = getSupabaseClient();
    let cancelled = false;

    const restoreFromSupabaseSession = async (session: Session | null) => {
      if (cancelled || currentUserRef.current) return;
      if (logoutInProgressRef.current) return;
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
            const trimmedRole = mr.trim();
            if (['customer', 'seller', 'service_provider'].includes(trimmedRole)) {
              resolved = trimmedRole as 'customer' | 'seller' | 'service_provider';
            }
          }
        }
        if (!resolved) {
          resolved = 'customer';
        }

        if (resolved === 'service_provider') {
          const spResult = await syncServiceProviderOAuth(session.user as unknown as Record<string, unknown>);
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
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (logoutInProgressRef.current) return;
      if (event === 'SIGNED_OUT') return;
      void restoreFromSupabaseSession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [currentUser, handleLogin]);

  const handleRegister = useCallback(
    (user: User) => {
      // CRITICAL: Validate user object before setting
      if (!user || !user.email || !user.role) {
        logError('❌ Invalid user object in handleRegister:', {
          hasUser: !!user,
          hasEmail: !!user?.email,
          hasRole: !!user?.role,
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
        localMatches: storedInLocal ? JSON.parse(storedInLocal).email === user.email : false,
      });

      const applyPostRegisterNavigation = (): void => {
        addToast(t('toast.welcomeNewUser', { name: user.name }), 'success');

        let postRegisterView = View.HOME;
        if (user.role === 'admin') {
          postRegisterView = View.ADMIN_PANEL;
          setCurrentView(View.ADMIN_PANEL);
        } else if (user.role === 'seller') {
          logDebug('🔄 Setting seller dashboard view after registration');
          postRegisterView = View.SELLER_DASHBOARD;
          setCurrentView(View.SELLER_DASHBOARD);
        } else if (user.role === 'service_provider') {
          postRegisterView = View.CAR_SERVICE_DASHBOARD;
          setCurrentView(View.CAR_SERVICE_DASHBOARD);
          try {
            const loc = typeof user.location === 'string' && user.location.trim() ? user.location.trim() : '';
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
          postRegisterView = View.HOME;
          setCurrentView(View.HOME);
        } else {
          setCurrentView(View.HOME);
        }

        try {
          const pathByRole =
            user.role === 'admin'
              ? '/admin'
              : user.role === 'seller'
                ? '/seller/dashboard'
                : user.role === 'service_provider'
                  ? '/car-services/dashboard'
                  : '/';
          routerNavigate(pathByRole, {
            state: {
              view: postRegisterView,
              timestamp: Date.now(),
            },
          });
        } catch {
          /* ignore */
        }
      };

      scheduleCapacitorPostLoginUi(applyPostRegisterNavigation);
    },
    [addToast, routerNavigate, setCurrentView, t],
  );
  handleRegisterRef.current = handleRegister;

  return {
    currentUser,
    setCurrentUser,
    currentUserRef,
    handleLogin,
    handleLogout,
    handleRegister,
  };
}
