import type { Dispatch, SetStateAction } from 'react';
import type { PlanDetails, SubscriptionPlan, User, Vehicle } from '../types.js';
import {
  planDetailsForSeller,
  validateNewListingCreation,
} from './listingPlanRules.js';
import { normalizeVehicleIdentity } from './vehicleIdentity.js';
import { logWarn } from './logger.js';

type AddListingDeps = {
  currentUser: User;
  vehicleData: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>;
  isFeaturing?: boolean;
  listingExpiresAt: string | null | undefined;
  setVehicles: Dispatch<SetStateAction<Vehicle[]>>;
  setSellerInventory?: Dispatch<SetStateAction<Vehicle[]>>;
  nextNumericId: () => number;
  successMessage: string;
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  logError: (...args: unknown[]) => void;
  errorMessage?: string;
  sellerVehicles?: Vehicle[];
  planDetails?: PlanDetails;
};

async function resolvePlanDetails(
  currentUser: User,
  planDetails?: PlanDetails,
): Promise<PlanDetails> {
  if (planDetails) return planDetails;
  try {
    const { planService } = await import('../services/planService');
    return await planService.getPlanDetails((currentUser.subscriptionPlan || 'free') as SubscriptionPlan);
  } catch {
    return planDetailsForSeller(currentUser);
  }
}

/** Create one seller listing via API, update local catalog, show a single outcome toast. */
export async function addSellerListing(deps: AddListingDeps): Promise<boolean> {
  const {
    currentUser,
    vehicleData,
    isFeaturing = false,
    listingExpiresAt,
    setVehicles,
    setSellerInventory,
    nextNumericId,
    successMessage,
    addToast,
    logError,
    errorMessage = 'Could not add vehicle. Please check your details and try again.',
    sellerVehicles = [],
    planDetails,
  } = deps;

  try {
    const plan = await resolvePlanDetails(currentUser, planDetails);
    const validation = validateNewListingCreation(currentUser, sellerVehicles, plan);
    if (!validation.allowed) {
      addToast(validation.reason || errorMessage, validation.limitReached ? 'warning' : 'error');
      return false;
    }

    const { addVehicle, getVehicles } = await import('../services/vehicleService');
    const vehicleToAdd = {
      ...vehicleData,
      id: nextNumericId(),
      sellerEmail: currentUser.email,
      averageRating: 0,
      ratingCount: 0,
      isFeatured: isFeaturing,
      status: 'published' as const,
      createdAt: new Date().toISOString(),
      listingExpiresAt,
    } as Vehicle;

    const newVehicle = normalizeVehicleIdentity(await addVehicle(vehicleToAdd));
    setVehicles((prev) => [...prev, newVehicle]);
    setSellerInventory?.((prev) => [...prev, newVehicle]);

    try {
      const refreshedVehicles = await getVehicles();
      setVehicles(refreshedVehicles);
    } catch (refreshError) {
      logWarn('Failed to refresh vehicles list after adding vehicle:', refreshError);
    }

    addToast(successMessage, 'success');
    return true;
  } catch (error) {
    logError('Failed to add vehicle:', error);
    const message = error instanceof Error && error.message.trim() ? error.message : errorMessage;
    addToast(message, 'error');
    return false;
  }
}

export async function assertSellerCanPublishListing(deps: {
  currentUser: User;
  vehicle: Vehicle;
  sellerVehicles: Vehicle[];
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  planDetails?: PlanDetails;
}): Promise<boolean> {
  const { validateListingRenewal } = await import('./listingPlanRules.js');
  const plan = await resolvePlanDetails(deps.currentUser, deps.planDetails);
  const validation = validateListingRenewal(deps.currentUser, deps.vehicle, deps.sellerVehicles, plan);
  if (!validation.allowed) {
    deps.addToast(validation.reason || 'Cannot publish this listing.', validation.limitReached ? 'warning' : 'error');
    return false;
  }
  return true;
}

type AddMultipleListingDeps = Omit<AddListingDeps, 'vehicleData' | 'isFeaturing' | 'successMessage' | 'errorMessage'> & {
  vehiclesData: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>[];
};

/** Bulk-create seller listings with one success/error toast. */
export async function addSellerListingsBulk(deps: AddMultipleListingDeps): Promise<boolean> {
  const {
    currentUser,
    vehiclesData,
    listingExpiresAt,
    setVehicles,
    setSellerInventory,
    nextNumericId,
    addToast,
    logError,
    sellerVehicles = [],
    planDetails,
  } = deps;

  try {
    const plan = await resolvePlanDetails(currentUser, planDetails);
    const validation = validateNewListingCreation(currentUser, sellerVehicles, plan);
    if (!validation.allowed) {
      addToast(validation.reason || 'Listing limit reached for your plan.', 'warning');
      return false;
    }

    const numericLimit = plan.listingLimit === 'unlimited' ? Infinity : Number(plan.listingLimit) || 0;
    const publishedCount = sellerVehicles.filter((v) => v?.status === 'published').length;
    const slotsLeft = plan.listingLimit === 'unlimited' ? vehiclesData.length : Math.max(0, numericLimit - publishedCount);
    if (slotsLeft < vehiclesData.length) {
      addToast(
        `Your ${plan.name} plan allows ${plan.listingLimit === 'unlimited' ? 'unlimited' : plan.listingLimit} active listing(s). You can add ${slotsLeft} more.`,
        'warning',
      );
      return false;
    }

    const { addVehicle, getVehicles } = await import('../services/vehicleService');
    const newVehicles = vehiclesData.map((vehicle) =>
      normalizeVehicleIdentity({
        ...vehicle,
        id: nextNumericId(),
        sellerEmail: currentUser.email,
        averageRating: 0,
        ratingCount: 0,
        createdAt: new Date().toISOString(),
        listingExpiresAt,
      } as Vehicle),
    );

    const results: Vehicle[] = [];
    for (const vehicle of newVehicles) {
      results.push(normalizeVehicleIdentity(await addVehicle(vehicle)));
    }

    setSellerInventory?.((prev) => [...prev, ...results]);

    try {
      const refreshedVehicles = await getVehicles();
      setVehicles(refreshedVehicles);
    } catch (refreshError) {
      logWarn('Failed to refresh vehicles list after adding vehicles:', refreshError);
      setVehicles((prev) => [...prev, ...results]);
    }

    addToast(`${results.length} vehicles added successfully`, 'success');
    return true;
  } catch (error) {
    logError('Failed to add vehicles:', error);
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : 'Could not add vehicles. Please check your connection and try again.';
    addToast(message, 'error');
    return false;
  }
}
