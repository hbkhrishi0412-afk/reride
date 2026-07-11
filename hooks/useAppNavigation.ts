import { useCallback } from 'react';
import type { NavigateFunction, Location } from 'react-router-dom';
import type { MutableRefObject } from 'react';
import { View, type Vehicle, type User } from '../types';
import type { VehicleCategory } from '../vehicle-category.js';
import type { AppHistoryState } from '../utils/appNavigation.js';
import {
  getAppPathFromRouter,
  viewToStaticPath,
} from '../utils/appNavigation.js';
import { getVehicleRouteId, vehicleIdsEqual } from '../utils/vehicleIdentity';
import { stringifyVehicleForSession } from '../utils/vehicleSessionCache';
import { logDebug, logInfo, logWarn, logError } from '../utils/logger';
import {
  agentNavDebugLog,
  readDetailEntrySourceView,
  RERIDE_DETAIL_ENTRY_SOURCE_KEY,
} from '../utils/detailNavigationStorage';

export type NavigateParams = {
  city?: string;
  sellerEmail?: string;
  detailVehicle?: Vehicle;
  unblockPopstateSync?: boolean;
};

export type UseAppNavigationArgs = {
  currentView: View;
  previousView: View;
  currentUser: User | null;
  selectedVehicle: Vehicle | null;
  publicSellerProfile: User | null;
  location: Location;
  routerNavigate: NavigateFunction;
  isHandlingPopStateRef: MutableRefObject<boolean>;
  leavingDetailUrlCatchUpRef: MutableRefObject<boolean>;
  expectingVehicleDetailRouteRef: MutableRefObject<boolean>;
  setPreviousView: (view: View) => void;
  setSelectedVehicle: (vehicle: Vehicle | null) => void;
  setPublicSellerProfile: (profile: User | null) => void;
  setInitialSearchQuery: (query: string) => void;
  setSelectedCategory: (category: VehicleCategory | 'ALL') => void;
  setCurrentView: (view: View) => void;
  updateSelectedCity: (city: string) => void;
};

function isAdminUserRole(role: string | undefined | null): boolean {
  return (role || '').toLowerCase().trim() === 'admin';
}

export function useAppNavigation(args: UseAppNavigationArgs) {
  const {
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
  } = args;

  const navigate = useCallback(
    (view: View, params?: NavigateParams) => {
      const detailVehicleParam = params?.detailVehicle;
      if (params?.unblockPopstateSync) {
        isHandlingPopStateRef.current = false;
      }
      if (view === View.DETAIL) {
        leavingDetailUrlCatchUpRef.current = false;
      }
      if (isHandlingPopStateRef.current) {
        if (view === View.SELLER_PROFILE) {
          // allow
        } else if (view !== View.DETAIL) {
          agentNavDebugLog({
            hypothesisId: 'H2',
            message: 'navigate blocked: isHandlingPopState non-detail',
            location: 'useAppNavigation.ts:navigate:blockPopstate',
            view,
            currentView,
            unblockPopstateSync: !!params?.unblockPopstateSync,
          });
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

      if (view !== View.DETAIL && view !== View.SELLER_PROFILE && currentView === View.DETAIL) {
        try {
          sessionStorage.removeItem(RERIDE_DETAIL_ENTRY_SOURCE_KEY);
        } catch {
          /* ignore */
        }
      }

      setPreviousView(currentView);

      const preserveSelectedVehicle =
        view === View.DETAIL || (view === View.SELLER_PROFILE && currentView === View.DETAIL);

      const isNavigatingAwayFromSellerProfile =
        currentView === View.SELLER_PROFILE && view !== View.SELLER_PROFILE;
      if (isNavigatingAwayFromSellerProfile) {
        setPublicSellerProfile(null);
      }
      setInitialSearchQuery('');

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
                  logInfo(
                    '🔧 Restored vehicle from sessionStorage during navigation:',
                    vehicleToUse.id,
                    vehicleToUse.make,
                    vehicleToUse.model,
                  );
                }
              }
            } catch (parseError) {
              logError('❌ Failed to parse vehicle from sessionStorage:', parseError);
              sessionStorage.removeItem('selectedVehicle');
            }
          }

          if (!vehicleFound && detailVehicleParam) {
            const paramId = Number(detailVehicleParam.id);
            if (Number.isFinite(paramId)) {
              vehicleToUse = detailVehicleParam;
              vehicleFound = true;
              setSelectedVehicle(detailVehicleParam);
              try {
                sessionStorage.setItem('selectedVehicle', stringifyVehicleForSession(detailVehicleParam));
                if (process.env.NODE_ENV === 'development') {
                  logInfo('🔧 Applied detailVehicle param during navigation:', detailVehicleParam.id);
                }
              } catch (error) {
                logWarn('⚠️ Failed to sync detail vehicle to sessionStorage:', error);
              }
            }
          }

          if (!vehicleFound && selectedVehicle && selectedVehicle.id) {
            vehicleToUse = selectedVehicle;
            vehicleFound = true;
            try {
              sessionStorage.setItem('selectedVehicle', stringifyVehicleForSession(selectedVehicle));
              if (process.env.NODE_ENV === 'development') {
                logInfo('🔧 Synced vehicle from state to sessionStorage:', selectedVehicle.id);
              }
            } catch (error) {
              logWarn('⚠️ Failed to sync vehicle to sessionStorage:', error);
            }
          }

          if (!vehicleFound && process.env.NODE_ENV === 'development') {
            logWarn(
              '⚠️ Attempted to navigate to DETAIL view without a vehicle in sessionStorage, params, or state',
            );
            logWarn('⚠️ Current selectedVehicle:', selectedVehicle);
            logWarn('⚠️ SessionStorage value:', sessionStorage.getItem('selectedVehicle'));
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            logError('❌ Error checking for vehicle during navigation:', error);
          }
        }
      }

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
        if (params && params.city !== undefined && params.city !== '') {
          if (process.env.NODE_ENV === 'development') {
            logInfo('🔵 AppProvider: Setting city filter to:', params.city);
          }
          updateSelectedCity(params.city);
        } else {
          if (process.env.NODE_ENV === 'development') {
            logInfo('🔵 AppProvider: Clearing city filter');
          }
          updateSelectedCity('');
        }
      }

      if (view === View.SELLER_DASHBOARD) {
        if (!currentUser) {
          logWarn('⚠️ Attempted to access seller dashboard without logged-in user');
          if (currentView !== View.LOGIN_PORTAL && currentView !== View.SELLER_LOGIN) {
            setCurrentView(View.LOGIN_PORTAL);
          }
          return;
        }
        if (!currentUser.email || !currentUser.role) {
          logError('❌ Invalid user object - missing email or role:', {
            hasEmail: !!currentUser.email,
            hasRole: !!currentUser.role,
          });
          if (currentView !== View.LOGIN_PORTAL && currentView !== View.SELLER_LOGIN) {
            setCurrentView(View.LOGIN_PORTAL);
          }
          return;
        }
        if (currentUser.role !== 'seller') {
          logWarn('⚠️ Attempted to access seller dashboard with role:', currentUser.role);
          if (currentView !== View.LOGIN_PORTAL && currentView !== View.SELLER_LOGIN) {
            setCurrentView(View.LOGIN_PORTAL);
          }
          return;
        }
        logInfo('✅ Navigating to seller dashboard');
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
        if (process.env.NODE_ENV === 'development' && view === View.DETAIL) {
          logInfo('🎯 Setting currentView to DETAIL');
        }
        setCurrentView(view);
      }

      try {
        let newPath = '/';

        if (view === View.DETAIL) {
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
          newPath = vehicleForPath?.id != null ? `/vehicle/${getVehicleRouteId(vehicleForPath)}` : '/vehicle';
        } else if (view === View.SELLER_PROFILE) {
          const emailForPath = (params?.sellerEmail ?? publicSellerProfile?.email ?? '').trim();
          newPath = emailForPath ? `/seller/${encodeURIComponent(emailForPath)}` : '/seller';
        } else if (view === View.CITY_LANDING && params?.city) {
          newPath = `/city/${encodeURIComponent(params.city.toLowerCase().replace(/\s+/g, '-'))}`;
        } else {
          newPath = viewToStaticPath(view);
        }

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
        agentNavDebugLog({
          hypothesisId: 'H5',
          message: 'navigate routerNavigate',
          location: 'useAppNavigation.ts:navigate:routerNavigate',
          view,
          fromView: currentView,
          newPath,
          leavingDetailCatchUp: leavingDetailUrlCatchUpRef.current,
          unblockPopstateSync: !!params?.unblockPopstateSync,
        });
        routerNavigate(newPath, {
          state: {
            view,
            previousView: currentView,
            timestamp: Date.now(),
            selectedVehicleId: detailSelectedId,
          },
        });
      } catch {
        /* currentView state already updated */
      }
    },
    [
      currentView,
      currentUser,
      previousView,
      selectedVehicle,
      publicSellerProfile,
      updateSelectedCity,
      setPreviousView,
      setSelectedVehicle,
      setPublicSellerProfile,
      setInitialSearchQuery,
      setSelectedCategory,
      setCurrentView,
      routerNavigate,
      isHandlingPopStateRef,
      leavingDetailUrlCatchUpRef,
      expectingVehicleDetailRouteRef,
    ],
  );

  const goBack = useCallback(
    (fallbackView?: View) => {
      isHandlingPopStateRef.current = false;
      const routerState = location?.state as AppHistoryState | null | undefined;
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
      agentNavDebugLog({
        hypothesisId: 'H1',
        message: 'goBack resolved',
        location: 'useAppNavigation.ts:goBack',
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
      if (target) {
        navigate(target, backOpts);
      } else if (fallbackView) {
        navigate(fallbackView, backOpts);
      } else {
        navigate(View.HOME, backOpts);
      }
    },
    [location.state, location.key, previousView, currentView, navigate, isHandlingPopStateRef],
  );

  return { navigate, goBack };
}
