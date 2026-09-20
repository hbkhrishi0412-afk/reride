import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import type {
  Conversation,
  FAQItem,
  Notification,
  SupportTicket,
  Toast,
  User,
  Vehicle,
  VehicleData,
} from '../types';
import { getConversations } from '../services/chatService';
import { getFaqs } from '../services/faqService';
import { DEFAULT_PLATFORM_FAQS } from '../constants/defaultFaqs.js';
import {
  fetchSupportTicketsFromSupabase,
  getSupportTickets,
} from '../services/supportTicketService';
import { dataService } from '../services/dataService';
import { isDevelopmentEnvironment } from '../utils/environment';
import { logInfo, logWarn, logError, logDebug } from '../utils/logger';
import {
  migrateVehicleListCache,
  normalizeVehiclesList,
} from '../utils/vehicleIdentity';
import { deduplicateRequest } from '../utils/requestDeduplication';
import { persistReRideNotifications, readPersistedReRideNotifications } from '../utils/notificationLocalStorage';
import { isCapacitorNative } from '../utils/apiConfig';
import { mergeVehicleCatalog } from '../utils/mergeVehicleCatalog';
import { mergeConversationLists } from '../components/AppProvider/helpers';

export type UseAppBootstrapArgs = {
  vehiclesLength: number;
  currentUser: User | null;
  setVehicles: Dispatch<SetStateAction<Vehicle[]>>;
  setUsers: Dispatch<SetStateAction<User[]>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setVehiclesCatalogReady: Dispatch<SetStateAction<boolean>>;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  setFaqItems: Dispatch<SetStateAction<FAQItem[]>>;
  setSupportTickets: Dispatch<SetStateAction<SupportTicket[]>>;
  setVehicleData: Dispatch<SetStateAction<VehicleData>>;
  setNotifications: Dispatch<SetStateAction<Notification[]>>;
  addToast: (message: string, type: Toast['type']) => void;
  t: TFunction;
};

/**
 * Mount loading fail-safes + loadInitialData (extracted from AppProvider).
 */
export function useAppBootstrap(args: UseAppBootstrapArgs) {
  const {
    vehiclesLength,
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
  } = args;

  // CRITICAL: Emergency fail-safe to prevent infinite loading / endless skeletons
  // Catalog gate uses vehiclesCatalogReady — clearing only isLoading left skeletons up forever.
  useEffect(() => {
    const emergencyTimeout = setTimeout(() => {
      setIsLoading((current) => {
        if (current && vehiclesLength === 0) {
          logWarn('⚠️ EMERGENCY: No vehicles loaded after 3s — releasing loading gate');
          return false;
        }
        return current;
      });
      // Always release the catalog-ready gate so Home can show empty/retry UI instead of skeletons
      setVehiclesCatalogReady((ready) => {
        if (!ready && vehiclesLength === 0) {
          logWarn('⚠️ EMERGENCY: Releasing vehiclesCatalogReady after 3s');
          return true;
        }
        return ready;
      });
    }, 3000);

    return () => clearTimeout(emergencyTimeout);
  }, [vehiclesLength, setIsLoading, setVehiclesCatalogReady]);

  // CRITICAL: Listen for force loading completion event (safety mechanism)
  useEffect(() => {
    const handleForceLoadingComplete = () => {
      logWarn('⚠️ Force loading complete event received, clearing loading state');
      setIsLoading(false);
      // Removed toast notification - no longer needed since we show cached data immediately
    };

    window.addEventListener('forceLoadingComplete', handleForceLoadingComplete);

    return () => {
      window.removeEventListener('forceLoadingComplete', handleForceLoadingComplete);
    };
  }, [setIsLoading]); // Removed addToast dependency

  // CRITICAL FIX: Set loading to false immediately on mount to allow UI to render
  // Data will load in background and update the UI when ready
  useEffect(() => {
    migrateVehicleListCache();
    // Set loading to false immediately so UI can render
    // This prevents the app from being stuck in loading state
    setIsLoading(false);
  }, [setIsLoading]); // Run once on mount

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
                setVehicles(normalizeVehiclesList(cachedVehicles));
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

        // AUTH: Rehydrate tokens in parallel — published vehicles are public and must not
        // wait up to 2.5s behind refresh-token on first paint for new/returning visitors.
        void (async () => {
          if (typeof window === 'undefined') return;
          try {
            const { rehydrateApiCredentials } = await import('../utils/validatePersistedSession.js');
            await rehydrateApiCredentials();
          } catch (error) {
            logWarn('⚠️ Auth rehydration failed (non-critical):', error);
          }
        })();

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
        const usersRequest = isAdmin
          ? deduplicateRequest('users', () => dataService.getUsers())
          : null;

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
          usersRequest
            ? loadWithTimeout(usersRequest, parallelInitTimeoutMs).catch((e) => { logWarn('Failed to load users:', e); return null; })
            : Promise.resolve(null),
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
                      logInfo(`✅ Using ${currentUsers.length} cached users (API returned empty in production)`);
                      setUsers(currentUsers);
                    } else {
                      logInfo('ℹ️ API returned empty users array and cache is also empty (production mode)');
                      // Preserve existing in-memory users if already present to avoid admin-panel flicker to empty.
                      setUsers(prev => (Array.isArray(prev) && prev.length > 0 ? prev : []));
                    }
                  } catch (parseError) {
                    logWarn('Failed to parse cached users in production:', parseError);
                    setUsers(prev => (Array.isArray(prev) && prev.length > 0 ? prev : []));
                  }
                } else {
                  logInfo('ℹ️ API returned empty users array and no cache available (production mode)');
                  setUsers(prev => (Array.isArray(prev) && prev.length > 0 ? prev : []));
                }
              }
            }
          } else if (usersData === null && usersRequest) {
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
          logWarn('Background data refresh failed (using cache):', error);
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
            // Seller directory — deferred for non-admin so /users does not delay vehicle catalog
            (!isAdmin
              ? (async () => {
                  try {
                    const deferredUsers = await deduplicateRequest('users', () => dataService.getUsers());
                    if (!isMounted || !Array.isArray(deferredUsers) || deferredUsers.length === 0) return;
                    setUsers(deferredUsers);
                    logInfo(`✅ Deferred seller directory loaded: ${deferredUsers.length} users`);
                  } catch (error) {
                    logWarn('Failed to load deferred users:', error);
                  }
                })()
              : Promise.resolve()),

            // FAQs
            (async () => {
              try {
                const { fetchFaqsFromSupabase } = await import('../services/faqService');
                const faqsData = await deduplicateRequest(
                  'faqs',
                  () => fetchFaqsFromSupabase().catch((error) => {
                    logWarn('Failed to load FAQs:', error);
                    return DEFAULT_PLATFORM_FAQS;
                  })
                );
                if (isMounted) setFaqItems(faqsData);
              } catch (error) {
                const localFaqs = getFaqs();
                if (isMounted) setFaqItems(localFaqs?.length ? localFaqs : DEFAULT_PLATFORM_FAQS);
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
                logWarn('Failed to load vehicle data:', error);
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
                  logInfo(`✅ Instantly loaded ${cachedConversations.length} cached conversations`);
                }
              } catch (cacheError) {
                logWarn('Failed to load cached conversations:', cacheError);
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
                  const { rehydrateApiCredentials } = await import('../utils/validatePersistedSession.js');
                  await rehydrateApiCredentials();
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

                    setConversations((prev) => {
                      const merged = mergeConversationLists(prev, normalizedConversations);
                      try {
                        localStorage.setItem('reRideConversations', JSON.stringify(merged));
                      } catch (error) {
                        logWarn('Failed to cache conversations to localStorage:', error);
                      }
                      return merged;
                    });
                  }
                  // If result failed but we already have cached data, keep using cache
                }
              }
            } catch (error) {
              logWarn('Failed to load conversations:', error);
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
                    logWarn('Failed to save notifications:', error);
                  }
                }
              }
            } catch (error) {
              logWarn('Failed to load notifications:', error);
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
            logWarn('Background data loading failed:', error);
          });
        });

      } catch (error) {
        logError('AppProvider: Error loading initial data:', error);
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
    // Mount-once bootstrap. Role is read from localStorage above; admin/login refresh
    // is handled by the syncLatestData effect — do NOT re-run this when currentUser?.role
    // hydrates or the catalog gate resets and skeletons flash again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
