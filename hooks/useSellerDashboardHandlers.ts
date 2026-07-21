import { useMemo, useCallback } from 'react';
import type { Vehicle, User, Conversation, Notification } from '../types';
import { View as ViewEnum } from '../types';
import { useApp } from '../components/AppProvider';
import { useChat } from '../contexts/ChatContext';
import { useNotifications } from '../contexts/NotificationContext';
import { enrichVehiclesWithSellerInfo } from '../utils/vehicleEnrichment';
import { filterVehiclesBySellerEmail } from '../utils/sellerVehicleFilter';
import { findVehicleByIdentity, buildVehicleMutationBody } from '../utils/vehicleIdentity';
import {
  addSellerListing,
  addSellerListingsBulk,
  assertSellerCanPublishListing,
  prepareSellerVehiclePublishUpdate,
} from '../utils/sellerAddListing.js';
import { computeListingExpiresAtForSeller } from '../utils/listingPlanRules.js';
import { planService } from '../services/planService';
import type { SubscriptionPlan } from '../types';
import type { AppApiResponse } from '../types/appServiceTypes';
import { logInfo, logWarn, logError } from '../utils/logger';
import { runBackgroundSync } from '../utils/toastPolicy.js';
import { randomIntBelow } from '../utils/secureRandom.js';
import { conversationBelongsToSeller } from '../utils/conversationParticipants';

export type SellerDashboardLocals = {
  handleLogoutAll: () => void | Promise<void>;
  handleNotificationClick: (notification: Notification) => void;
  handleMarkNotificationsAsRead: (ids: number[]) => void | Promise<void>;
  handleTestDriveResponse: (
    conversationId: string,
    messageId: number,
    newStatus: 'confirmed' | 'rejected',
  ) => void | Promise<void>;
  handleSellerOpenChatFromDashboard: (conversation: Conversation) => void;
  markAllVisibleAsRead: (role: 'customer' | 'seller') => void | Promise<void>;
};

type AppApi = ReturnType<typeof useApp>;

export type UseSellerDashboardHandlersArgs = {
  app: AppApi;
  currentUser: User;
  locals: SellerDashboardLocals;
};

export function useSellerDashboardHandlers({ app, currentUser, locals }: UseSellerDashboardHandlersArgs) {
  const {
    users,
    vehicles,
    sellerInventory,
    sellerInventoryReady,
    conversations,
    vehicleData,
    navigate,
    selectVehicle,
    addToast,
    setVehicles,
    setSellerInventory,
    setUsers,
    setCurrentUser,
    updateVehicle,
    deleteVehicle,
    syncVehicleFromServer,
    updateUser,
    sendMessage,
    sendMessageWithType,
    markAsRead,
    toggleTyping,
    flagContent,
    onOfferResponse,
    setConversationReadState,
    clearConversationMessages,
    deleteConversation,
    archiveConversation,
    runIfConfirmed,
  } = app;

  const { typingStatus, chatPeerOnlineByConversationId } = useChat();
  const { notifications } = useNotifications();

  const sellerEmailNorm = currentUser.email.toLowerCase().trim();

  const sellerVehiclesFiltered = useMemo(
    () => filterVehiclesBySellerEmail(sellerInventoryReady ? sellerInventory : [], sellerEmailNorm),
    [sellerInventory, sellerInventoryReady, sellerEmailNorm],
  );

  const findSellerVehicle = useCallback(
    (vehicleId: number, databaseId?: string) =>
      findVehicleByIdentity(sellerVehiclesFiltered, vehicleId, databaseId),
    [sellerVehiclesFiltered],
  );

  const enrichedSellerVehicles = useMemo(
    () => enrichVehiclesWithSellerInfo(sellerVehiclesFiltered, users || []),
    [sellerVehiclesFiltered, users],
  );

  const sellerReportedVehicles = useMemo(
    () => (sellerVehiclesFiltered || []).filter((v) => v && v.isFlagged),
    [sellerVehiclesFiltered],
  );

  const sellerConversations = useMemo(
    () =>
      (conversations || []).filter(
        (c) =>
          c &&
          currentUser?.email &&
          conversationBelongsToSeller(c, currentUser.email, currentUser.id),
      ),
    [conversations, currentUser?.email, currentUser?.id],
  );

  const sellerNotifications = useMemo(
    () => notifications.filter((n) => n.recipientEmail === currentUser.email),
    [notifications, currentUser.email],
  );

  const onDeleteVehicle = useCallback(
    async (vehicleId: number) => {
      const vehicle = findSellerVehicle(vehicleId);
      const label = vehicle
        ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        : 'this listing';
      await runIfConfirmed(
        `Delete ${label}? This cannot be undone.`,
        async () => {
          await deleteVehicle(vehicleId);
        },
        { variant: 'danger' },
      );
    },
    [findSellerVehicle, deleteVehicle, runIfConfirmed],
  );

  const onMarkAsSold = useCallback(
    async (vehicleId: number) => {
      const vehicle = findSellerVehicle(vehicleId);
      if (!vehicle) return;
      addToast('Vehicle marked as sold.', 'success');
      try {
        const { markVehicleAsSold } = await import('../services/vehicleService');
        const updated = await markVehicleAsSold(vehicleId, sellerVehiclesFiltered, {
          databaseId: vehicle.databaseId,
          sellerEmail: currentUser.email,
        });
        syncVehicleFromServer(updated);
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Failed to mark vehicle as sold.', 'error');
      }
    },
    [findSellerVehicle, sellerVehiclesFiltered, syncVehicleFromServer, addToast, currentUser.email],
  );

  const onMarkAsUnsold = useCallback(
    async (vehicleId: number) => {
      const vehicle = findSellerVehicle(vehicleId);
      if (!vehicle) {
        addToast('Listing not found. Please refresh and try again.', 'error');
        return;
      }
      const canPublish = await assertSellerCanPublishListing({
        currentUser,
        vehicle,
        sellerVehicles: sellerVehiclesFiltered || [],
        addToast,
      });
      if (!canPublish) return;
      try {
        const { markVehicleAsUnsold } = await import('../services/vehicleService');
        // Sold vehicles live in seller inventory, not the public catalog — use seller list for identity lookup.
        const updated = await markVehicleAsUnsold(vehicleId, sellerVehiclesFiltered, {
          databaseId: vehicle.databaseId,
          sellerEmail: currentUser.email,
        });
        syncVehicleFromServer(updated);
        addToast('Listing is active again.', 'success');
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Failed to update vehicle. Please try again.', 'error');
      }
    },
    [findSellerVehicle, currentUser, sellerVehiclesFiltered, syncVehicleFromServer, addToast],
  );

  const onAddMultipleVehicles = useCallback(
    async (vehiclesData: Parameters<typeof addSellerListingsBulk>[0]['vehiclesData']) => {
      if (currentUser.planExpiryDate) {
        const expiryDate = new Date(currentUser.planExpiryDate);
        if (expiryDate < new Date()) {
          addToast('Your subscription has expired. Please renew to add new listings.', 'error');
          return;
        }
      }
      const listingExpiresAt = computeListingExpiresAtForSeller(currentUser);
      await addSellerListingsBulk({
        currentUser,
        vehiclesData,
        listingExpiresAt,
        setVehicles,
        setSellerInventory,
        nextNumericId: () => Date.now() + randomIntBelow(1000),
        addToast,
        logError,
        sellerVehicles: sellerVehiclesFiltered || [],
      });
    },
    [currentUser, addToast, setVehicles, setSellerInventory, sellerVehiclesFiltered],
  );

  const onAddVehicle = useCallback(
    (
      vehicleData: Parameters<typeof addSellerListing>[0]['vehicleData'],
      isFeaturing = false,
      successMessage?: string,
    ) =>
      addSellerListing({
        currentUser,
        vehicleData,
        isFeaturing,
        listingExpiresAt: computeListingExpiresAtForSeller(currentUser),
        setVehicles,
        setSellerInventory,
        nextNumericId: () => Date.now() + randomIntBelow(1000),
        successMessage: successMessage ?? (isFeaturing ? 'Vehicle added successfully!' : 'Vehicle added successfully'),
        addToast,
        logError,
        errorMessage: 'Failed to add vehicle',
        sellerVehicles: sellerVehiclesFiltered || [],
      }),
    [currentUser, addToast, setVehicles, setSellerInventory, sellerVehiclesFiltered],
  );

  const onBoostListing = useCallback(
    async (vehicleId: number, packageId: string) => {
      try {
        const { executeSellerBoostListing } = await import('../utils/sellerBoostListing.js');
        const updated = await executeSellerBoostListing({
          vehicleId,
          packageId,
          seller: currentUser,
          sellerVehicles: sellerVehiclesFiltered || [],
        });
        await updateVehicle(vehicleId, updated, { skipToast: true });
        addToast('Your listing has been boosted! It will get more visibility.', 'success');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to boost listing.';
        addToast(message, 'error');
        throw err;
      }
    },
    [currentUser, sellerVehiclesFiltered, updateVehicle, addToast],
  );

  const onUpdateVehicle = useCallback(
    async (vehicleData: Vehicle) => {
      const existing = findSellerVehicle(vehicleData.id, vehicleData.databaseId);
      if (vehicleData.status === 'published' && existing?.status !== 'published') {
        const canPublish = await assertSellerCanPublishListing({
          currentUser,
          vehicle: existing || vehicleData,
          sellerVehicles: sellerVehiclesFiltered || [],
          addToast,
        });
        if (!canPublish) {
          throw new Error('Cannot publish this listing.');
        }
      }

      const payload = prepareSellerVehiclePublishUpdate(vehicleData, existing, currentUser);
      await updateVehicle(payload.id, payload, { databaseId: payload.databaseId });
    },
    [
      findSellerVehicle,
      currentUser,
      sellerVehiclesFiltered,
      addToast,
      updateVehicle,
    ],
  );

  const onFeatureListing = useCallback(
    async (vehicleId: number) => {
      try {
        const { authenticatedFetch } = await import('../utils/authenticatedFetch');
        const response = await authenticatedFetch('/api/vehicles?action=feature', {
          method: 'POST',
          body: JSON.stringify(buildVehicleMutationBody(vehicleId, vehicles)),
        });

        const responseText = await response.text();
        let result: AppApiResponse<Vehicle> = {};
        if (responseText) {
          try {
            result = JSON.parse(responseText) as AppApiResponse<Vehicle>;
          } catch (parseError) {
            logWarn('Failed to parse feature response JSON:', parseError);
            result = {};
          }
        }

        if (!response.ok) {
          const errorMessage = result?.reason || result?.error || 'Could not feature vehicle. Please try again.';
          addToast(errorMessage, response.status === 403 ? 'warning' : 'error');
          return;
        }

        if (result?.alreadyFeatured) {
          addToast('This vehicle is already featured.', 'info');
          return;
        }

        if (result?.success && result.vehicle) {
          await updateVehicle(vehicleId, result.vehicle, { skipToast: true });

          if (typeof result.remainingCredits === 'number') {
            const sellerEmail = result.vehicle?.sellerEmail || currentUser?.email;
            const remainingCredits = result.remainingCredits;

            if (sellerEmail) {
              if (
                currentUser?.email &&
                currentUser.email.toLowerCase().trim() === sellerEmail.toLowerCase().trim()
              ) {
                setCurrentUser({
                  ...currentUser,
                  featuredCredits: remainingCredits,
                });
              }
              await runBackgroundSync('Featured credits sync', () =>
                updateUser(sellerEmail, { featuredCredits: remainingCredits }, { skipToast: true }),
              );
            }

            addToast(`Listing featured! You have ${remainingCredits} feature credits left.`, 'success');
          } else {
            addToast('Listing featured successfully!', 'success');
          }
        } else {
          addToast('Could not feature this listing. Please try again.', 'error');
        }
      } catch (error) {
        logError('Failed to feature vehicle:', error);
        addToast('Could not feature this listing. Please try again.', 'error');
      }
    },
    [vehicles, updateVehicle, currentUser, setCurrentUser, updateUser, addToast],
  );

  const onRequestCertification = useCallback(
    async (vehicleId: number) => {
      try {
        const vehicle = findSellerVehicle(vehicleId);
        const sellerEmail = vehicle?.sellerEmail || currentUser?.email;
        const normalizedSellerEmail = sellerEmail ? sellerEmail.toLowerCase().trim() : '';
        const seller = normalizedSellerEmail
          ? users.find((u) => u && u.email && u.email.toLowerCase().trim() === normalizedSellerEmail)
          : undefined;

        if (!seller) {
          addToast('Could not process certification request. Please try again.', 'error');
          return;
        }

        const planId = (seller.subscriptionPlan || 'free') as SubscriptionPlan;
        const planDetails = await planService.getPlanDetails(planId);
        const totalCertifications = planDetails.freeCertifications ?? 0;
        const usedCertifications = seller.usedCertifications ?? 0;

        if (totalCertifications <= 0) {
          addToast(
            `The ${planDetails.name} plan does not include certification requests. Upgrade your plan to request certifications.`,
            'warning',
          );
          return;
        }

        if (usedCertifications >= totalCertifications) {
          addToast(
            `You have used all ${totalCertifications} certification requests included in your ${planDetails.name} plan. Upgrade to request more.`,
            'warning',
          );
          return;
        }

        const { authenticatedFetch } = await import('../utils/authenticatedFetch');
        const response = await authenticatedFetch('/api/vehicles?action=certify', {
          method: 'POST',
          body: JSON.stringify(buildVehicleMutationBody(vehicleId, vehicles)),
        });

        const responseText = await response.text();
        let result: AppApiResponse = {};
        if (responseText) {
          try {
            result = JSON.parse(responseText) as AppApiResponse;
          } catch (parseError) {
            logWarn('Failed to parse certification response JSON:', parseError);
          }
        }

        if (!response.ok) {
          addToast('Could not submit certification request. Please try again.', 'error');
          return;
        }

        if (result?.alreadyRequested) {
          addToast('This vehicle is already pending certification review.', 'info');
          return;
        }

        if (!result?.success || !result?.vehicle) {
          addToast('Could not submit certification request. Please try again.', 'error');
          return;
        }

        await updateVehicle(vehicleId, result.vehicle, {
          successMessage: 'Certification request submitted for review',
        });
        const updatedUsedCertifications =
          typeof result.usedCertifications === 'number' ? result.usedCertifications : usedCertifications + 1;

        setUsers((prevUsers: User[]) =>
          prevUsers.map((user: User) => {
            if (!user || !user.email) return user;
            return user.email.toLowerCase().trim() === normalizedSellerEmail
              ? { ...user, usedCertifications: updatedUsedCertifications }
              : user;
          }),
        );

        if (currentUser?.email && currentUser.email.toLowerCase().trim() === normalizedSellerEmail) {
          setCurrentUser({
            ...currentUser,
            usedCertifications: updatedUsedCertifications,
          });
        }

        await runBackgroundSync('Certification usage sync', () =>
          updateUser(seller.email, { usedCertifications: updatedUsedCertifications }, { skipToast: true }),
        );

        if (typeof result.remainingCertifications === 'number' && process.env.NODE_ENV === 'development') {
          logInfo(`Certification requests remaining: ${result.remainingCertifications}`);
        }
      } catch (error) {
        logError('Failed to certify vehicle:', error);
        addToast('Could not submit certification request. Please try again.', 'error');
      }
    },
    [findSellerVehicle, currentUser, users, vehicles, updateVehicle, setUsers, setCurrentUser, updateUser, addToast],
  );

  const onUpdateSellerProfile = useCallback(
    async (details: Partial<User>) => {
      if (currentUser?.email) {
        await updateUser(currentUser.email, details);
      }
    },
    [currentUser?.email, updateUser],
  );

  const onUpdateProfile = useCallback(
    async (profileData: Partial<User>) => {
      if (currentUser) {
        await updateUser(currentUser.email, profileData);
        setCurrentUser({ ...currentUser, ...profileData } as User);
      }
    },
    [currentUser, updateUser, setCurrentUser],
  );

  return {
    enrichedSellerVehicles,
    sellerReportedVehicles,
    sellerConversations,
    sellerNotifications,
    vehicleData,
    typingStatus,
    chatPeerOnlineByConversationId,
    navigate,
    selectVehicle,
    addToast,
    onDeleteVehicle,
    onMarkAsSold,
    onMarkAsUnsold,
    onAddMultipleVehicles,
    onAddVehicle,
    onUpdateVehicle,
    onBoostListing,
    onFeatureListing,
    onRequestCertification,
    onUpdateSellerProfile,
    onUpdateProfile,
    sendMessage,
    sendMessageWithType,
    markAsRead,
    toggleTyping,
    flagContent,
    onOfferResponse,
    setConversationReadState,
    clearConversationMessages,
    deleteConversation,
    archiveConversation,
    ...locals,
  };
}

export function getSellerDashboardAccessState(
  currentUser: User | null,
): 'ok' | 'login-required' | 'seller-required' | 'invalid-user' {
  if (!currentUser) {
    return 'login-required';
  }
  if (!currentUser.email || !currentUser.role) {
    return 'invalid-user';
  }
  if (currentUser.role !== 'seller') {
    return 'seller-required';
  }
  return 'ok';
}

/** @deprecated Prefer getSellerDashboardAccessState + AccessDenied UI */
export function validateSellerDashboardAccess(
  currentUser: User | null,
  navigate: (view: ViewEnum) => void,
): currentUser is User {
  const state = getSellerDashboardAccessState(currentUser);
  if (state === 'ok') {
    logInfo('Seller dashboard validation passed, rendering dashboard');
    return true;
  }
  if (state === 'login-required' || state === 'invalid-user') {
    logWarn('Attempted to render seller dashboard without valid logged-in user');
    navigate(ViewEnum.LOGIN_PORTAL);
    return false;
  }
  logWarn(`Attempted to render seller dashboard with role: ${currentUser?.role} (expected seller)`);
  navigate(ViewEnum.LOGIN_PORTAL);
  return false;
}
