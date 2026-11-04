import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DealLead, PlanDetails, SellerCommandCenter, SubscriptionPlan, User } from '../types';
import { PLAN_DETAILS } from '../constants/plans';
import { planDetailsForSeller } from '../utils/listingPlanRules.js';
import { invalidateBrowserPlansCache, planService } from '../services/planService';
import {
  fetchSellerCommandCenter,
  fetchSellerDealCalendar,
  invalidateSellerCommandCenterCache,
} from '../services/dealService';
import { rehydrateApiCredentials } from '../utils/validatePersistedSession.js';
import { CLIENT_POLL_INTERVALS_MS } from '../utils/clientPolling.js';
import {
  fetchOwnSellerProfile,
  mergeSellerPlanFields,
  publishCurrentUserPlanUpdate,
  sellerPlanFieldsChanged,
} from '../utils/sellerPlanSync.js';

export type SellerDashboardSection =
  | 'overview'
  | 'hotLeads'
  | 'listings'
  | 'form'
  | 'messages'
  | 'analytics'
  | 'salesHistory'
  | 'reports'
  | 'settings'
  | 'profile'
  | 'addVehicle'
  | 'editVehicle'
  | 'notifications';

export function useSellerPlanDetails(seller: User | null | undefined, enabled: boolean) {
  const { t } = useTranslation();
  const subscriptionPlan = seller?.subscriptionPlan;
  const sellerEmail = seller?.email;
  const sellerRef = useRef(seller);
  sellerRef.current = seller;
  const [plan, setPlan] = useState<PlanDetails | null>(null);
  const [planLoading, setPlanLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setPlan(null);
      setPlanLoading(false);
      return;
    }

    let active = true;

    const syncSellerProfile = async () => {
      const current = sellerRef.current;
      if (!sellerEmail || !current) return;
      const fresh = await fetchOwnSellerProfile(sellerEmail);
      if (!active || !fresh) return;
      if (!sellerPlanFieldsChanged(current, fresh)) return;
      publishCurrentUserPlanUpdate(mergeSellerPlanFields(current, fresh));
    };

    const loadPlan = async (silent = false, bustCache = false) => {
      if (!silent) setPlanLoading(true);
      try {
        if (bustCache) invalidateBrowserPlansCache();
        const planId: SubscriptionPlan = subscriptionPlan ?? 'free';
        const planDetails = await planService.getPlanDetails(planId);
        if (!active) return;
        setPlan(planDetails);
      } catch {
        if (!active) return;
        setPlan({ ...PLAN_DETAILS.free, name: t('sellerDashboard.freePlanName') });
      } finally {
        if (active) setPlanLoading(false);
      }
    };

    const reloadOnVisibility = () => {
      if (document.visibilityState === 'visible') {
        void syncSellerProfile();
        void loadPlan(true, true);
      }
    };
    const reloadOnPlanConfigUpdate = () => void loadPlan(true, true);
    const reloadOnStoragePlanUpdate = (event: StorageEvent) => {
      if (event.key === 'reRidePlanConfigUpdatedAt') void loadPlan(true, true);
    };

    setPlan(planDetailsForSeller({ subscriptionPlan: subscriptionPlan ?? 'free' }));
    void syncSellerProfile();
    void loadPlan(false);
    window.addEventListener('focus', reloadOnVisibility);
    document.addEventListener('visibilitychange', reloadOnVisibility);
    window.addEventListener('planConfigUpdated', reloadOnPlanConfigUpdate as EventListener);
    window.addEventListener('storage', reloadOnStoragePlanUpdate);
    const pollId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void syncSellerProfile();
        void loadPlan(true);
      }
    }, CLIENT_POLL_INTERVALS_MS.sellerConversations);

    return () => {
      active = false;
      window.clearInterval(pollId);
      window.removeEventListener('focus', reloadOnVisibility);
      document.removeEventListener('visibilitychange', reloadOnVisibility);
      window.removeEventListener('planConfigUpdated', reloadOnPlanConfigUpdate as EventListener);
      window.removeEventListener('storage', reloadOnStoragePlanUpdate);
    };
  }, [
    enabled,
    subscriptionPlan,
    sellerEmail,
    seller?.planActivatedDate,
    seller?.planExpiryDate,
    seller?.featuredCredits,
    seller?.usedCertifications,
    t,
  ]);

  return { plan, planLoading };
}

export function useSellerCommandCenter(seller: User | null) {
  const isSeller = seller?.role === 'seller' && !!seller.email;
  const [commandCenter, setCommandCenter] = useState<SellerCommandCenter | null>(null);
  const [commandCenterLoading, setCommandCenterLoading] = useState(isSeller);
  const [commandCenterError, setCommandCenterError] = useState<string | null>(null);
  const [pendingDealCount, setPendingDealCount] = useState(0);
  const [pendingAcceptCount, setPendingAcceptCount] = useState(0);
  const [pendingTaskCount, setPendingTaskCount] = useState(0);
  const [sellerActiveDeals, setSellerActiveDeals] = useState<DealLead[]>([]);

  const refreshDealCommandStats = useCallback(
    (force = false) => {
      if (!isSeller || !seller?.email) {
        setCommandCenter(null);
        setPendingDealCount(0);
        setPendingAcceptCount(0);
        setPendingTaskCount(0);
        setSellerActiveDeals([]);
        setCommandCenterLoading(false);
        setCommandCenterError(null);
        return Promise.resolve();
      }
      setCommandCenterLoading(true);
      if (force) invalidateSellerCommandCenterCache();
      void fetchSellerDealCalendar().catch(() => {});
      return fetchSellerCommandCenter(force)
        .then((center) => {
          setCommandCenter(center);
          setPendingDealCount(center.stats.activeDealCount ?? 0);
          setPendingAcceptCount(center.stats.pendingInterestCount ?? 0);
          setPendingTaskCount(
            center.stats.tasksToday ?? center.tasks?.length ?? 0,
          );
          setSellerActiveDeals(center.activeDeals ?? []);
          setCommandCenterError(null);
        })
        .catch((err) => {
          setCommandCenterError(err instanceof Error ? err.message : 'Could not load deal stats');
        })
        .finally(() => {
          setCommandCenterLoading(false);
        });
    },
    [isSeller, seller?.email],
  );

  useEffect(() => {
    if (!isSeller) return;
    let cancelled = false;
    const load = async () => {
      await rehydrateApiCredentials();
      if (!cancelled) void refreshDealCommandStats();
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isSeller, refreshDealCommandStats]);

  const dealsByVehicleId = useMemo(() => {
    const map = new Map<string, DealLead[]>();
    for (const deal of sellerActiveDeals) {
      const key = String(deal.vehicleId);
      const list = map.get(key) || [];
      list.push(deal);
      map.set(key, list);
    }
    return map;
  }, [sellerActiveDeals]);

  return {
    commandCenter,
    commandCenterLoading,
    commandCenterError,
    pendingDealCount,
    pendingAcceptCount,
    pendingTaskCount,
    sellerActiveDeals,
    dealsByVehicleId,
    refreshDealCommandStats,
  };
}

/** Shared seller dashboard state: plan limits + deal pipeline command center. */
export function useSellerDashboardController(seller: User | null) {
  const isSeller = seller?.role === 'seller';
  const planState = useSellerPlanDetails(seller, isSeller);
  const commandState = useSellerCommandCenter(seller);

  return {
    isSeller,
    ...planState,
    ...commandState,
  };
}
