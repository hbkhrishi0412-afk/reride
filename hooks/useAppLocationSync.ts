import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Location } from 'react-router-dom';
import type { User, Vehicle } from '../types';
import { View } from '../types';
import {
  getAppPathFromRouter,
  pathToView,
  parseSellerEmailFromPath,
  resolveViewFromPathAndState,
  type AppHistoryState,
} from '../utils/appNavigation.js';
import { parseCityFromPath } from '../utils/citySlug.js';
import { agentNavDebugLog } from '../utils/detailNavigationStorage';
import { findVehicleByRouteSegment, vehicleIdsEqual } from '../utils/vehicleIdentity';
import { stringifyVehicleForSession } from '../utils/vehicleSessionCache';
import { logDebug } from '../utils/logger';
import { getSellers, readCachedDealerDirectory } from '../services/userService';

let lastSellerFetchEmail = '';
const sameEmail = (u: User | null | undefined, email: string) => u?.email?.toLowerCase().trim() === email;

/** Seller for /seller/:email — app users, then cached dealer directory, then a placeholder refreshed from the public API. */
export function hydrateSellerProfile(
  email: string,
  users: User[],
  setPublicSellerProfile: Dispatch<SetStateAction<User | null>>,
) {
  const known = users.find((u) => sameEmail(u, email)) ?? readCachedDealerDirectory().find((u) => sameEmail(u, email));
  setPublicSellerProfile((prev) =>
    sameEmail(prev, email) && prev?.id
      ? prev
      : known ??
        (sameEmail(prev, email)
          ? prev
          : ({ email, name: 'Seller', mobile: '', role: 'seller', location: '', status: 'active', createdAt: new Date().toISOString() } as User)),
  );
  if (known || lastSellerFetchEmail === email) return;
  lastSellerFetchEmail = email;
  void getSellers()
    .then((list) => {
      const match = list.find((u) => sameEmail(u, email));
      if (match) setPublicSellerProfile((prev) => (sameEmail(prev, email) && !prev?.id ? match : prev));
    })
    .catch(() => {});
}

export type UseAppLocationSyncArgs = {
  location: Location;
  currentUser: User | null;
  vehicles: Vehicle[];
  users: User[];
  selectedVehicle: Vehicle | null;
  currentView: View;
  currentViewRef: MutableRefObject<View>;
  leavingDetailUrlCatchUpRef: MutableRefObject<boolean>;
  expectingVehicleDetailRouteRef: MutableRefObject<boolean>;
  isHandlingPopStateRef: MutableRefObject<boolean>;
  setCurrentView: (view: View) => void;
  setPreviousView: (view: View) => void;
  setSelectedVehicle: Dispatch<SetStateAction<Vehicle | null>>;
  setPublicSellerProfile: Dispatch<SetStateAction<User | null>>;
  updateSelectedCity: (city: string) => void;
};

/**
 * URL ↔ view sync: mount initial path, main location sync effect,
 * and catalog-late DETAIL resolve (extracted from AppProvider).
 */
export function useAppLocationSync(args: UseAppLocationSyncArgs) {
  const {
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
  } = args;

  // Map initial path once on mount (React Router pathname — correct for HashRouter + BrowserRouter).
  // NEVER depend on selectedVehicle: re-running reset currentView from URL while pathname lags
  // navigation sends users back to HOME instead of vehicle detail.
  useEffect(() => {
    try {
      const path = getAppPathFromRouter(location ?? { pathname: '/' });
      const routerState = location?.state as AppHistoryState | null;
      setCurrentView(resolveViewFromPathAndState(path, routerState, location.search));
    } catch (error) {
      logDebug('Failed initial URL → view sync:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time sync; location sync effect handles later navigations
  }, []);

  // Sync React Router location changes with app view state
  // This replaces the manual popstate handler — React Router manages browser history
  useEffect(() => {
    const path = getAppPathFromRouter(location ?? { pathname: '/' });
    const routerState = location?.state as AppHistoryState | null;
    if (!path.includes('/vehicle/')) {
      leavingDetailUrlCatchUpRef.current = false;
    }
    let newView: View;
    try {
      newView = resolveViewFromPathAndState(path, routerState, location.search);
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
        location: 'useAppLocationSync.ts:locationSync:leavingDetailGuard',
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
        const segment = idMatch[1];
        const found = findVehicleByRouteSegment(vehicles, segment);
        const routeChanged =
          !selectedVehicle || !findVehicleByRouteSegment([selectedVehicle], segment);
        if (routeChanged) {
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
                if (findVehicleByRouteSegment([v], segment)) setSelectedVehicle(v);
              }
            } catch {
              /* ignore */
            }
          }
        }
      }
      return;
    }

    // Still on city landing but URL slug changed — hydrate selectedCity from path
    if (newView === viewNow && newView === View.CITY_LANDING) {
      const cityFromPath = parseCityFromPath(path);
      if (cityFromPath) {
        updateSelectedCity(cityFromPath);
      }
      return;
    }

    // Still on seller profile but URL switched to another dealer — view enum unchanged, so hydrate profile
    if (newView === viewNow && newView === View.SELLER_PROFILE) {
      const email = parseSellerEmailFromPath(path);
      if (email) hydrateSellerProfile(email, users, setPublicSellerProfile);
      return;
    }

    // Prevent loops: only update if the view actually changed
    if (newView === viewNow) return;

    // #region agent log
    agentNavDebugLog({
      hypothesisId: 'H4',
      message: 'locationSync applying newView',
      location: 'useAppLocationSync.ts:locationSync:apply',
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
          const stored = sessionStorage.getItem('selectedVehicle');
          if (!stored) return;
          const v = JSON.parse(stored) as Vehicle;
          if (findVehicleByRouteSegment([v], idMatch[1])) setSelectedVehicle(v as Vehicle);
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
          const found = findVehicleByRouteSegment(vehicles, idMatch[1]);
          if (found) setSelectedVehicle(found);
          else trySessionStorageForPath();
        }
      }
    } else {
      setSelectedVehicle(null);
    }

    if (newView === View.CITY_LANDING) {
      const cityFromPath = parseCityFromPath(path);
      if (cityFromPath) {
        updateSelectedCity(cityFromPath);
      }
    }

    // Clear seller profile when navigating away
    if (newView !== View.SELLER_PROFILE) {
      setPublicSellerProfile(null);
    } else {
      const email = parseSellerEmailFromPath(path);
      if (email) hydrateSellerProfile(email, users, setPublicSellerProfile);
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
    updateSelectedCity,
  ]);

  // When the catalog finishes loading, resolve /vehicle/:id if the list sync effect ran too early
  useEffect(() => {
    if (currentView !== View.DETAIL) return;
    const path = getAppPathFromRouter(location ?? { pathname: '/' });
    const m = path.match(/\/vehicle\/([^/?#]+)/);
    if (!m) return;
    const segment = m[1];
    if (selectedVehicle && findVehicleByRouteSegment([selectedVehicle], segment)) return;
    const found = findVehicleByRouteSegment(vehicles, segment);
    if (found) {
      setSelectedVehicle(found);
      return;
    }
    try {
      const raw = sessionStorage.getItem('selectedVehicle');
      if (!raw) return;
      const v = JSON.parse(raw) as Vehicle;
      if (findVehicleByRouteSegment([v], segment)) setSelectedVehicle(v);
    } catch {
      /* ignore */
    }
  }, [currentView, location?.pathname, location?.hash, vehicles, selectedVehicle?.id, selectedVehicle?.databaseId]);
}
