import type { Dispatch, SetStateAction } from 'react';
import type { User, Vehicle } from '../types.js';
import { normalizeVehicleIdentity } from './vehicleIdentity.js';
import { logWarn } from './logger.js';

type AddListingDeps = {
  currentUser: User;
  vehicleData: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>;
  isFeaturing?: boolean;
  listingExpiresAt: string | null | undefined;
  setVehicles: Dispatch<SetStateAction<Vehicle[]>>;
  nextNumericId: () => number;
  successMessage: string;
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  logError: (...args: unknown[]) => void;
  errorMessage?: string;
};

/** Create one seller listing via API, update local catalog, show a single outcome toast. */
export async function addSellerListing(deps: AddListingDeps): Promise<boolean> {
  const {
    currentUser,
    vehicleData,
    isFeaturing = false,
    listingExpiresAt,
    setVehicles,
    nextNumericId,
    successMessage,
    addToast,
    logError,
    errorMessage = 'Could not add vehicle. Please check your details and try again.',
  } = deps;

  try {
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
    addToast(errorMessage, 'error');
    return false;
  }
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
    nextNumericId,
    addToast,
    logError,
  } = deps;

  try {
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

    const results = await Promise.all(newVehicles.map((vehicle) => addVehicle(vehicle)));

    try {
      const refreshedVehicles = await getVehicles();
      setVehicles(refreshedVehicles);
    } catch (refreshError) {
      logWarn('Failed to refresh vehicles list after adding vehicles:', refreshError);
      setVehicles((prev) => [...prev, ...results.map((v) => normalizeVehicleIdentity(v))]);
    }

    addToast(`${results.length} vehicles added successfully`, 'success');
    return true;
  } catch (error) {
    logError('Failed to add vehicles:', error);
    addToast('Could not add vehicles. Please check your connection and try again.', 'error');
    return false;
  }
}
