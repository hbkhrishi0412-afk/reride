import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DealLead, PlanDetails, SellerCommandCenter, SubscriptionPlan, User } from '../types';
import { PLAN_DETAILS } from '../constants/plans';
import { planService } from '../services/planService';
import {
  fetchSellerCommandCenter,
  invalidateSellerCommandCenterCache,
} from '../services/dealService';
import { rehydrateApiCredentials } from '../utils/validatePersistedSession.js';

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

export function useSellerPlanDetails(subscriptionPlan: SubscriptionPlan | undefined, enabled: boolean) {
  const { t } = useTranslation();
  const [plan, setPlan] = useState<PlanDetails | null>(null);
  const [planLoading, setPlanLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setPlan(null);
      setPlanLoading(false);
      return;
    }

    let active = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const loadPlan = async (silent = false) => {
      if (!silent) setPlanLoading(true);
      try {
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
      if (document.visibilityState === 'visible') void loadPlan(true);
    };
    const reloadOnPlanConfigUpdate = () => void loadPlan(true);
    const reloadOnStoragePlanUpdate = (event: StorageEvent) => {
      if (event.key === 'reRidePlanConfigUpdatedAt') void loadPlan(true);
    };

    void loadPlan(false);
    intervalId = setInterval(() => void loadPlan(true), 30000);
    window.addEventListener('focus', reloadOnVisibility);
    document.addEventListener('visibilitychange', reloadOnVisibility);
    window.addEventListener('planConfigUpdated', reloadOnPlanConfigUpdate as EventListener);
    window.addEventListener('storage', reloadOnStoragePlanUpdate);

    return () => {
      active = false;
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener('focus', reloadOnVisibility);
      document.removeEventListener('visibilitychange', reloadOnVisibility);
      window.removeEventListener('planConfigUpdated', reloadOnPlanConfigUpdate as EventListener);
      window.removeEventListener('storage', reloadOnStoragePlanUpdate);
    };
  }, [enabled, subscriptionPlan, t]);

  return { plan, planLoading };
}

export function useSellerCommandCenter(seller: User | null) {
  const isSeller = seller?.role === 'seller' && !!seller.email;
  const [commandCenter, setCommandCenter] = useState<SellerCommandCenter | null>(null);
  const [commandCenterLoading, setCommandCenterLoading] = useState(isSeller);
  const [commandCenterError, setCommandCenterError] = useState<string | null>(null);
  const [pendingDealCount, setPendingDealCount] = useState(0);
  const [pendingAcceptCount, setPendingAcceptCount] = useState(0);
  const [sellerActiveDeals, setSellerActiveDeals] = useState<DealLead[]>([]);

  const refreshDealCommandStats = useCallback(
    (force = false) => {
      if (!isSeller || !seller?.email) {
        setCommandCenter(null);
        setPendingDealCount(0);
        setPendingAcceptCount(0);
        setSellerActiveDeals([]);
        setCommandCenterLoading(false);
        setCommandCenterError(null);
        return Promise.resolve();
      }
      setCommandCenterLoading(true);
      if (force) invalidateSellerCommandCenterCache();
      return fetchSellerCommandCenter(force)
        .then((center) => {
          setCommandCenter(center);
          setPendingDealCount(center.stats.activeDealCount ?? 0);
          setPendingAcceptCount(center.stats.pendingInterestCount ?? 0);
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
    sellerActiveDeals,
    dealsByVehicleId,
    refreshDealCommandStats,
  };
}

/** Shared seller dashboard state: plan limits + deal pipeline command center. */
export function useSellerDashboardController(seller: User | null) {
  const isSeller = seller?.role === 'seller';
  const planState = useSellerPlanDetails(seller?.subscriptionPlan, isSeller);
  const commandState = useSellerCommandCenter(seller);

  return {
    isSeller,
    ...planState,
    ...commandState,
  };
}
