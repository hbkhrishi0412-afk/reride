import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import i18n from '../lib/i18n';
import type {
  AuditLogEntry,
  Conversation,
  FAQItem,
  Notification,
  PlatformSettings,
  SubscriptionPlan,
  SupportTicket,
  Toast,
  User,
  Vehicle,
  VehicleData,
} from '../types';
import { logAction } from '../services/auditLogService';
import { dataService } from '../services/dataService';
import { saveFaqs } from '../services/faqService';
import { saveSettings, updateSettings } from '../services/settingsService';
import { updateSupportTicketInSupabase } from '../services/supportTicketService';
import { authenticatedFetch } from '../utils/authenticatedFetch';
import { isCapacitorNative } from '../utils/apiConfig';
import { isDevelopmentEnvironment } from '../utils/environment';
import { logError, logInfo, logWarn } from '../utils/logger';
import { randomAlphanumeric } from '../utils/secureRandom.js';
import {
  buildVehicleMutationBody,
} from '../utils/vehicleIdentity';
import {
  getUserFriendlyErrorMessage,
  type FeatureApiResponse,
} from '../components/AppProvider/helpers';
import type { VehicleUpdateOptions } from '../types/appContext';

export type UseAdminPlatformActionsArgs = {
  users: User[];
  vehicles: Vehicle[];
  conversations: Conversation[];
  currentUser: User | null;
  publicSellerProfile: User | null;
  setUsers: Dispatch<SetStateAction<User[]>>;
  setVehicles: Dispatch<SetStateAction<Vehicle[]>>;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  setCurrentUser: Dispatch<SetStateAction<User | null>>;
  setPublicSellerProfile: Dispatch<SetStateAction<User | null>>;
  setPlatformSettings: Dispatch<SetStateAction<PlatformSettings>>;
  setAuditLog: Dispatch<SetStateAction<AuditLogEntry[]>>;
  setVehicleData: Dispatch<SetStateAction<VehicleData>>;
  setFaqItems: Dispatch<SetStateAction<FAQItem[]>>;
  setSupportTickets: Dispatch<SetStateAction<SupportTicket[]>>;
  setNotifications: Dispatch<SetStateAction<Notification[]>>;
  syncUserCachesByEmail: (email: string, updates: Partial<User>) => void;
  syncAllUserCaches: (allUsers: User[]) => void;
  updateVehicleHandler: (
    id: number,
    updates: Partial<Vehicle>,
    options?: VehicleUpdateOptions,
  ) => Promise<void>;
  addToast: (message: string, type: Toast['type']) => void;
  t: TFunction;
};

/**
 * Admin / platform CRUD + export/import actions (extracted from AppProvider contextValue).
 */
export function useAdminPlatformActions(args: UseAdminPlatformActionsArgs) {
  const {
    users,
    vehicles,
    conversations,
    currentUser,
    publicSellerProfile,
    setUsers,
    setVehicles,
    setConversations,
    setCurrentUser,
    setPublicSellerProfile,
    setPlatformSettings,
    setAuditLog,
    setVehicleData,
    setFaqItems,
    setSupportTickets,
    setNotifications,
    syncUserCachesByEmail,
    syncAllUserCaches,
    updateVehicleHandler,
    addToast,
    t,
  } = args;

  return useMemo(() => ({
      onAdminUpdateUser: async (email: string, details: Partial<User>) => {
        // Separate null values (to be removed) from regular updates
        const updateFields: Partial<User> = {};
        const fieldsToRemove: (keyof User)[] = [];
        
        Object.entries(details).forEach(([key, value]) => {
          const typedKey = key as keyof User;
          if (value === null) {
            fieldsToRemove.push(typedKey);
          } else if (value !== undefined) {
            // Type-safe assignment - TypeScript will catch invalid keys
            (updateFields as Record<string, unknown>)[key] = value;
          }
        });

      setUsers(prev =>
        Array.isArray(prev) ? prev.map(user => {
          if (user && user.email === email) {
            // Deep merge verificationStatus if it exists in updateFields
            let updatedUser = { ...user };
            
            if (updateFields.verificationStatus) {
              // Merge verificationStatus whether it exists in user or not
              updatedUser = {
                ...updatedUser,
                ...updateFields,
                verificationStatus: {
                  ...(user.verificationStatus || {}),
                  ...updateFields.verificationStatus
                }
              };
            } else {
              updatedUser = { ...updatedUser, ...updateFields };
            }
            
            // Also merge individual verification fields if they exist in updateFields
            if (updateFields.phoneVerified !== undefined) {
              updatedUser.phoneVerified = updateFields.phoneVerified;
            }
            if (updateFields.emailVerified !== undefined) {
              updatedUser.emailVerified = updateFields.emailVerified;
            }
            if (updateFields.govtIdVerified !== undefined) {
              updatedUser.govtIdVerified = updateFields.govtIdVerified;
            }
            
              // Remove fields that are set to null
              fieldsToRemove.forEach(key => {
                delete (updatedUser as Record<string, unknown>)[key];
              });
            
            // Also update publicSellerProfile if this is the currently viewed seller
            if (publicSellerProfile?.email === email) {
              setPublicSellerProfile(updatedUser);
            }
            
            return updatedUser;
          }
          return user;
        }) : []
      );
      // Optimistically sync user caches so admin edits reflect immediately.
      if (Object.keys(updateFields).length > 0) {
        syncUserCachesByEmail(email, updateFields);
      }
      
      // Also update in API - pass both updates and nulls
      try {
        const { updateUser: updateUserService } = await import('../services/userService');
        
          // Ensure verificationStatus is properly structured for API
          const apiUpdateData: Partial<User> & { email: string } = { email, ...details };
        
        // If verificationStatus is being updated, ensure it's properly formatted
        if (details.verificationStatus) {
          apiUpdateData.verificationStatus = details.verificationStatus;
        }
        
        // Ensure individual verification fields are also included
        if (details.phoneVerified !== undefined) {
          apiUpdateData.phoneVerified = details.phoneVerified;
        }
        if (details.emailVerified !== undefined) {
          apiUpdateData.emailVerified = details.emailVerified;
        }
        if (details.govtIdVerified !== undefined) {
          apiUpdateData.govtIdVerified = details.govtIdVerified;
        }
        
        await updateUserService(apiUpdateData);
        
        // CRITICAL: Refresh users list from API after successful update to ensure sync
        try {
          const { getUsers: getUsersService } = await import('../services/userService');
          const refreshedUsers = await getUsersService();
          
          // Update the users state with fresh data from API
          setUsers(refreshedUsers);
          
          // Also update all user caches immediately
          syncAllUserCaches(refreshedUsers);
          
          logInfo('✅ Users list refreshed from API after verification update');
        } catch (refreshError) {
          logWarn('⚠️ Failed to refresh users list after update:', refreshError);
          // Don't fail the update if refresh fails - the API update already succeeded
          // The error is logged but not thrown to prevent breaking the update flow
        }
      } catch (error) {
        logError('❌ Failed to sync user update to API:', error);
        addToast(
          t('toast.vehicleSyncFailedDetail', {
            detail: error instanceof Error ? error.message : t('toast.unknownError'),
          }),
          'error',
        );
        // Don't throw - local state is already updated
      }
      
      // Log audit entry for user update
      const actor = currentUser?.name || currentUser?.email || 'System';
      const updateFieldsList = Object.keys(updateFields).join(', ');
      const entry = logAction(actor, 'Update User', email, `Updated fields: ${updateFieldsList}`);
      setAuditLog(prev => [entry, ...prev]);
      
      addToast(t('toast.userUpdated', { email }), 'success');
    },
    onCreateUser: async (userData: Omit<User, 'status'>): Promise<{ success: boolean, reason: string }> => {
      try {
        // Check if user already exists
        const existingUser = Array.isArray(users) ? users.find(u => u && u.email && u.email.toLowerCase() === userData.email.toLowerCase()) : undefined;
        if (existingUser) {
          return { success: false, reason: 'User with this email already exists.' };
        }

        // CRITICAL FIX: Create user in Supabase FIRST (real-time), then sync to local state only on success
        try {
          const { authenticatedFetch } = await import('../utils/authenticatedFetch');
          const { handleApiResponse } = await import('../utils/authenticatedFetch');
          
          const response = await authenticatedFetch('/api/users', {
            method: 'POST',
            skipAuth: true, // Registration doesn't require auth
            body: JSON.stringify({
              action: 'register',
              email: userData.email,
              password: userData.password,
              name: userData.name,
              mobile: userData.mobile,
              role: userData.role,
            }),
          });
          
          const apiResult = await handleApiResponse(response);
          
          if (!apiResult.success || !response.ok) {
            const errorReason = apiResult.reason || 'Unknown error';
            logError('❌ Failed to create user in Supabase:', errorReason);
            addToast(t('toast.userCreateFailedDetail', { reason: errorReason }), 'error');
            // Don't create locally - Supabase creation failed
            throw new Error(errorReason);
          }
          
          // Supabase creation succeeded - NOW update local state
          const createdUser = apiResult.data?.user || {
            ...userData,
            status: 'active',
            subscriptionPlan: userData.subscriptionPlan || 'free',
            featuredCredits: userData.featuredCredits || 0,
            usedCertifications: userData.usedCertifications || 0,
          };

          // User row is already persisted by POST /api/users (register); do not insert again from the
          // browser (anon client would fail RLS or duplicate the row).
          
          const nextUsers = [...(Array.isArray(users) ? users : []), createdUser];
          setUsers(nextUsers);
          syncAllUserCaches(nextUsers);
          
          // Save to localStorage after Supabase success (dev browser only — not Capacitor localhost)
          const isDevelopment = !isCapacitorNative() &&
            (isDevelopmentEnvironment() || window.location.hostname === 'localhost');
          if (isDevelopment) {
            try {
              const { getUsersLocal } = await import('../services/userService');
              const users = await getUsersLocal();
              users.push(createdUser);
              localStorage.setItem('reRideUsers', JSON.stringify(users));
            } catch (localError) {
              logWarn('⚠️ Failed to save user to localStorage:', localError);
            }
          }
          
          logInfo('✅ User created and saved to Supabase:', createdUser.email);
          addToast(t('toast.userCreated', { name: createdUser.name }), 'success');
          
          // Log audit entry for user creation (inside try block where createdUser is in scope)
          const actor = currentUser?.name || currentUser?.email || 'System';
          const entry = logAction(actor, 'Create User', createdUser.email, `Created user: ${createdUser.name} (${createdUser.role})`);
          setAuditLog(prev => [entry, ...prev]);
        } catch (apiError) {
          logError('❌ Error creating user in Supabase:', apiError);
          const errorMsg = apiError instanceof Error ? apiError.message : 'Failed to create user';
          addToast(t('toast.userCreateFailedDetail', { reason: errorMsg }), 'error');
          // Don't create locally - Supabase creation failed
          throw apiError;
        }
        
        return { success: true, reason: '' };
      } catch (error) {
        logError('Error creating user:', error);
        return { success: false, reason: error instanceof Error ? error.message : 'Failed to create user.' };
      }
    },
          onUpdateUserPlan: async (email: string, plan: SubscriptionPlan) => {
        try {
          // Use the updateUser function defined later in contextValue
          const { updateUser: updateUserService } = await import('../services/userService');
          await updateUserService({ email, subscriptionPlan: plan });
          setUsers(prev => Array.isArray(prev) ? prev.map(user => 
            user && user.email === email ? { ...user, subscriptionPlan: plan } : user
          ) : []);
          syncUserCachesByEmail(email, { subscriptionPlan: plan });
          
          // Log audit entry for plan update
          const actor = currentUser?.name || currentUser?.email || 'System';
          const user = Array.isArray(users) ? users.find(u => u && u.email === email) : undefined;
          const previousPlan = user?.subscriptionPlan || 'unknown';
          const entry = logAction(actor, 'Update User Plan', email, `Changed plan from ${previousPlan} to ${plan}`);
          setAuditLog(prev => [entry, ...prev]);
          
          addToast(t('toast.planUpdated', { email }), 'success');
        } catch (error) {
          logError('Failed to update user plan:', error);
          const message = getUserFriendlyErrorMessage(error, i18n.t('toast.planUpdateFailed'));
          addToast(message, 'error');
        }
      },
      onToggleUserStatus: async (email: string) => {
        try {
          const user = Array.isArray(users) ? users.find(u => u && u.email === email) : undefined;
          if (!user) return;
          
          const newStatus = user.status === 'active' ? 'inactive' : 'active';
          // Use the updateUser function defined later in contextValue
          const { updateUser: updateUserService } = await import('../services/userService');
          await updateUserService({ email, status: newStatus });
          setUsers(prev => Array.isArray(prev) ? prev.map(user => 
            user && user.email === email ? { ...user, status: newStatus } : user
          ) : []);
          syncUserCachesByEmail(email, { status: newStatus });
          
          // Log audit entry for user status toggle
          const actor = currentUser?.name || currentUser?.email || 'System';
          const entry = logAction(actor, 'Toggle User Status', email, `Changed status from ${user.status} to ${newStatus}`);
          setAuditLog(prev => [entry, ...prev]);
          
          addToast(t('toast.userStatusToggled', { email }), 'success');
        } catch (error) {
          logError('Failed to toggle user status:', error);
          addToast(t('toast.userStatusToggleFailed'), 'error');
        }
      },
      onToggleVehicleStatus: async (vehicleId: number) => {
        try {
          const vehicle = Array.isArray(vehicles) ? vehicles.find(v => v && v.id === vehicleId) : undefined;
          if (!vehicle) return;
          
          const newStatus = vehicle.status === 'published' ? 'unpublished' : 'published';
          if (newStatus === 'published' && currentUser?.email) {
            const { assertSellerCanPublishListing } = await import('../utils/sellerAddListing');
            const sellerEmail = currentUser.email.toLowerCase().trim();
            const sellerVehicles = Array.isArray(vehicles)
              ? vehicles.filter((v) => v?.sellerEmail?.toLowerCase?.().trim() === sellerEmail)
              : [];
            const canPublish = await assertSellerCanPublishListing({
              currentUser,
              vehicle,
              sellerVehicles,
              addToast,
            });
            if (!canPublish) return;
          }
          await updateVehicleHandler(vehicleId, { status: newStatus });
          
          // Log audit entry for vehicle status toggle
          const actor = currentUser?.name || currentUser?.email || 'System';
          const vehicleInfo = `${vehicle.make} ${vehicle.model} (ID: ${vehicleId})`;
          const entry = logAction(actor, 'Toggle Vehicle Status', vehicleInfo, `Changed status from ${vehicle.status} to ${newStatus}`);
          setAuditLog(prev => [entry, ...prev]);
        } catch (error) {
          logError('Failed to toggle vehicle status:', error);
          const message = getUserFriendlyErrorMessage(error, i18n.t('toast.vehicleStatusUpdateFailed'));
          addToast(message, 'error');
        }
      },
      onToggleVehicleFeature: async (vehicleId: number) => {
        try {
          const vehicle = Array.isArray(vehicles) ? vehicles.find(v => v && v.id === vehicleId) : undefined;
          if (!vehicle) {
            addToast(t('toast.vehicleNotFound'), 'error');
            return;
          }

          // Unfeature path: simple toggle off
          if (vehicle.isFeatured) {
            await updateVehicleHandler(vehicleId, { isFeatured: false });
            
            // Log audit entry for vehicle unfeature
            const actor = currentUser?.name || currentUser?.email || 'System';
            const vehicleInfo = `${vehicle.make} ${vehicle.model} (ID: ${vehicleId})`;
            const entry = logAction(actor, 'Unfeature Vehicle', vehicleInfo, 'Vehicle unfeatured');
            setAuditLog(prev => [entry, ...prev]);
            
            return;
          }

          // Feature path: use API to enforce credits
          const { authenticatedFetch } = await import('../utils/authenticatedFetch');
          const response = await authenticatedFetch('/api/vehicles?action=feature', {
            method: 'POST',
            body: JSON.stringify(buildVehicleMutationBody(vehicleId, vehicles)),
          });

          const responseText = await response.text();
          let result: FeatureApiResponse = {};
          if (responseText) {
            try {
              result = JSON.parse(responseText) as FeatureApiResponse;
            } catch (parseError) {
              logWarn('⚠️ Failed to parse feature response JSON:', parseError);
            }
          }

          if (!response.ok) {
            const message =
              result?.reason ||
              result?.error ||
              `Failed to feature vehicle (HTTP ${response.status})`;
            addToast(message, response.status === 403 ? 'warning' : 'error');
            return;
          }

          if (result?.alreadyFeatured) {
            addToast(t('toast.vehicleAlreadyFeatured'), 'info');
            return;
          }

          if (result?.success && result.vehicle) {
            const updatedVehicle = result.vehicle;
            setVehicles(prev =>
              Array.isArray(prev) ? prev.map(v => (v && v.id === vehicleId ? updatedVehicle : v)).filter((v): v is Vehicle => v !== undefined && v !== null) : []
            );

            const sellerEmail = result.vehicle?.sellerEmail;
            if (typeof result.remainingCredits === 'number' && sellerEmail) {
              const remainingCredits = result.remainingCredits;

              setUsers(prev =>
                Array.isArray(prev) ? prev.map(user =>
                  user && user.email === sellerEmail
                    ? { ...user, featuredCredits: remainingCredits }
                    : user
                ) : []
              );

              setCurrentUser(prev =>
                prev && prev.email === sellerEmail
                  ? { ...prev, featuredCredits: remainingCredits }
                  : prev
              );

              // Log audit entry for vehicle feature
              const actor = currentUser?.name || currentUser?.email || 'System';
              const vehicleInfo = `${result.vehicle.make} ${result.vehicle.model} (ID: ${vehicleId})`;
              const entry = logAction(actor, 'Feature Vehicle', vehicleInfo, `Featured vehicle. Credits remaining: ${remainingCredits}`);
              setAuditLog(prev => [entry, ...prev]);

              addToast(t('toast.vehicleFeaturedWithCredits', { credits: remainingCredits }), 'success');
            } else {
              // Log audit entry for vehicle feature
              const actor = currentUser?.name || currentUser?.email || 'System';
              const vehicleInfo = vehicle ? `${vehicle.make} ${vehicle.model} (ID: ${vehicleId})` : `Vehicle #${vehicleId}`;
              const entry = logAction(actor, 'Feature Vehicle', vehicleInfo, 'Vehicle featured successfully');
              setAuditLog(prev => [entry, ...prev]);
              
              addToast(t('toast.vehicleFeaturedSuccess'), 'success');
            }
          } else {
            addToast(t('toast.featureVehicleFailed'), 'error');
          }
        } catch (error) {
          logError('Failed to toggle vehicle feature:', error);
          addToast(t('toast.featureStatusFailed'), 'error');
        }
      },
    onResolveFlag: async (type: 'vehicle' | 'conversation', id: number | string) => {
      try {
        if (type === 'vehicle') {
          const vehicle = Array.isArray(vehicles) ? vehicles.find(v => v.id === id) : undefined;
          if (!vehicle) {
            addToast(t('toast.vehicleNotFound'), 'error');
            return;
          }

          const updatedVehicle = { ...vehicle, isFlagged: false };
          await dataService.updateVehicle(updatedVehicle);
          setVehicles(prev => Array.isArray(prev) ? prev.map(v =>
            v && v.id === id ? updatedVehicle : v
          ) : []);

          const actor = currentUser?.name || currentUser?.email || 'System';
          const targetInfo = `${vehicle.make} ${vehicle.model} (ID: ${id})`;
          const entry = logAction(actor, 'Resolve Flag', targetInfo, `Resolved flag on ${type}`);
          setAuditLog(prev => [entry, ...prev]);
        } else {
          const conversation = Array.isArray(conversations) ? conversations.find(conv => conv && conv.id === id) : undefined;
          if (!conversation) {
            addToast(t('toast.conversationNotFound'), 'error');
            return;
          }

          const updatedConversation = { ...conversation, isFlagged: false };
          const { saveConversationToSupabase } = await import('../services/conversationService');
          const result = await saveConversationToSupabase(updatedConversation);
          if (!result.success) {
            throw new Error(result.error || 'Failed to update conversation');
          }

          setConversations(prev => Array.isArray(prev) ? prev.map(conv =>
            conv && conv.id === id ? updatedConversation : conv
          ) : []);

          const actor = currentUser?.name || currentUser?.email || 'System';
          const entry = logAction(actor, 'Resolve Flag', `Conversation ${id}`, `Resolved flag on ${type}`);
          setAuditLog(prev => [entry, ...prev]);
        }
        addToast(
          type === 'vehicle' ? t('toast.flagResolvedVehicle') : t('toast.flagResolvedConversation'),
          'success',
        );
      } catch (error) {
        logError('Failed to resolve flag:', error);
        addToast(
          type === 'vehicle' ? t('toast.flagResolveFailedVehicle') : t('toast.flagResolveFailedConversation'),
          'error',
        );
      }
    },
    onUpdateSettings: async (settings: PlatformSettings) => {
      // Optimistic local update + cache write so the current tab reflects the
      // change immediately even if the API round-trip is slow.
      setPlatformSettings(settings);
      saveSettings(settings);

      const actor = currentUser?.name || currentUser?.email || 'System';
      const changedSettings = Object.keys(settings).join(', ');

      try {
        const persisted = await updateSettings(settings);
        // Replace with the server's canonical copy (includes server-side
        // normalization like Math.max(0, Math.floor(listingFee))).
        setPlatformSettings(persisted);

        const entry = logAction(actor, 'Update Platform Settings', 'Platform', `Updated settings: ${changedSettings}`);
        setAuditLog(prev => [entry, ...prev]);
        addToast(t('toast.settingsUpdated'), 'success');
      } catch (error) {
        logError('Failed to persist platform settings to API:', error);
        // Even on API failure, keep the local change and still log it.
        const entry = logAction(
          actor,
          'Update Platform Settings',
          'Platform',
          `Updated settings locally (API sync failed): ${changedSettings}`,
        );
        setAuditLog(prev => [entry, ...prev]);
        addToast(
          t('toast.settingsUpdatedLocalOnly') || 'Settings saved locally but failed to sync with server.',
          'error',
        );
      }
    },
    onSendBroadcast: (message: string) => {
      setNotifications(prev => [...prev, {
        id: Date.now(),
        recipientEmail: 'all',
        message,
        targetId: 'broadcast',
        targetType: 'general_admin' as const,
        timestamp: new Date().toISOString(),
        isRead: false
      }]);
      
      // Log audit entry for broadcast
      const actor = currentUser?.name || currentUser?.email || 'System';
      const messagePreview = message.length > 50 ? message.substring(0, 50) + '...' : message;
      const entry = logAction(actor, 'Send Broadcast', 'All Users', `Message: ${messagePreview}`);
      setAuditLog(prev => [entry, ...prev]);
      
      addToast(t('toast.broadcastSent'), 'success');
    },
    onExportUsers: () => {
      try {
        const headers = 'Name,Email,Role,Status,Mobile,Join Date\n';
        const csv = Array.isArray(users) ? users.map(user => 
          `"${user.name}","${user.email}","${user.role}","${user.status}","${user.mobile || ''}","${user.joinedDate || ''}"`
        ).join('\n') : '';
        const fullCsv = headers + csv;
        const blob = new Blob([fullCsv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Log audit entry for export
        const actor = currentUser?.name || currentUser?.email || 'System';
        const entry = logAction(actor, 'Export Users', 'Users Data', `Exported ${users.length} users to CSV`);
        setAuditLog(prev => [entry, ...prev]);
        
        addToast(t('toast.exportUsersSuccess', { count: users.length }), 'success');
      } catch (error) {
        logError('Export failed:', error);
        addToast(t('toast.exportFailed'), 'error');
      }
    },
    onImportUsers: async (usersToImport: Omit<User, 'id'>[]) => {
      try {
        const { dataService } = await import('../services/dataService');
        let successCount = 0;
        let errorCount = 0;
        
        for (const userData of usersToImport) {
          try {
            // Generate a default password for imported users (they can reset it)
            const defaultPassword = `TempPass${randomAlphanumeric(10)}`;
            
            // Create user via API register endpoint
            const { publicApiFetch } = await import('../utils/apiFetch');
            const response = await publicApiFetch('/api/users', {
              method: 'POST',
              body: JSON.stringify({
                action: 'register',
                email: userData.email,
                password: defaultPassword, // Temporary password
                name: userData.name,
                mobile: userData.mobile,
                role: userData.role,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch((error) => {
                logWarn('Failed to parse error response:', error);
                return { reason: 'Unknown error' };
              });
              throw new Error(errorData.reason || `Failed to create user: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (!result.success) {
              throw new Error(result.reason || 'Failed to create user');
            }

            // If user was created successfully, update additional fields if provided
            if (userData.dealershipName || userData.bio || userData.subscriptionPlan || 
                userData.isVerified !== undefined || userData.location) {
              try {
                const updateResponse = await authenticatedFetch('/api/users', {
                  method: 'PUT',
                  body: JSON.stringify({
                    email: userData.email,
                    ...(userData.dealershipName && { dealershipName: userData.dealershipName }),
                    ...(userData.bio && { bio: userData.bio }),
                    ...(userData.subscriptionPlan && { subscriptionPlan: userData.subscriptionPlan }),
                    ...(userData.isVerified !== undefined && { isVerified: userData.isVerified }),
                    ...(userData.location && { location: userData.location }),
                    ...(userData.phoneVerified !== undefined && { phoneVerified: userData.phoneVerified }),
                    ...(userData.emailVerified !== undefined && { emailVerified: userData.emailVerified }),
                    ...(userData.featuredCredits !== undefined && { featuredCredits: userData.featuredCredits }),
                    ...(userData.usedCertifications !== undefined && { usedCertifications: userData.usedCertifications }),
                    ...(userData.avatarUrl && { avatarUrl: userData.avatarUrl }),
                    ...(userData.logoUrl && { logoUrl: userData.logoUrl }),
                    ...(userData.status && { status: userData.status }),
                  }),
                });

                if (!updateResponse.ok) {
                  logWarn(`Failed to update additional fields for ${userData.email}, but user was created`);
                }
              } catch (updateError) {
                logWarn(`Failed to update additional fields for ${userData.email}:`, updateError);
                // Don't throw - user was created successfully
              }
            }

            successCount++;
          } catch (error) {
            errorCount++;
            logError(`Failed to import user ${userData.name} (${userData.email}):`, error);
            throw error; // Re-throw to be caught by the modal
          }
        }
        
        // Refresh users list
        const updatedUsers = await dataService.getUsers();
        setUsers(updatedUsers);
        syncAllUserCaches(updatedUsers);
        
        // Log audit entry for import
        const actor = currentUser?.name || currentUser?.email || 'System';
        const entry = logAction(actor, 'Import Users', 'Users Data', `Imported ${successCount} users from CSV`);
        setAuditLog(prev => [entry, ...prev]);
        
        if (successCount > 0) {
          addToast(t('toast.importUsersSuccess', { count: successCount }), 'success');
        }
        if (errorCount > 0) {
          addToast(t('toast.importUsersPartialWarning', { count: errorCount }), 'warning');
        }
      } catch (error) {
        logError('Import failed:', error);
        throw error; // Re-throw to be handled by the modal
      }
    },
    onExportVehicles: () => {
      try {
        const headers = 'Make,Model,Year,Price,Seller,Status,Mileage,Location,Features\n';
        const csv = Array.isArray(vehicles) ? vehicles.map(vehicle => 
          `"${vehicle.make}","${vehicle.model}","${vehicle.year}","${vehicle.price}","${vehicle.sellerEmail}","${vehicle.status}","${vehicle.mileage || ''}","${vehicle.location || ''}","${vehicle.features?.join('; ') || ''}"`
        ).join('\n') : '';
        const fullCsv = headers + csv;
        const blob = new Blob([fullCsv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vehicles_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Log audit entry for export
        const actor = currentUser?.name || currentUser?.email || 'System';
        const entry = logAction(actor, 'Export Vehicles', 'Vehicles Data', `Exported ${vehicles.length} vehicles to CSV`);
        setAuditLog(prev => [entry, ...prev]);
        
        addToast(t('toast.exportVehiclesSuccess', { count: vehicles.length }), 'success');
      } catch (error) {
        logError('Export failed:', error);
        addToast(t('toast.exportFailed'), 'error');
      }
    },
    onImportVehicles: async (vehiclesToImport: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>[]) => {
      try {
        const { addVehicle } = await import('../services/dataService');
        let successCount = 0;
        let errorCount = 0;
        
        for (const vehicleData of vehiclesToImport) {
          try {
            // Normalize images to array if needed
          const normalizedImages = Array.isArray(vehicleData.images) 
              ? vehicleData.images 
              : typeof vehicleData.images === 'string' 
                ? [vehicleData.images] 
                : [];
            
            const vehicleToAdd = {
              ...vehicleData,
              images: normalizedImages,
            } as Vehicle;
            
            await addVehicle(vehicleToAdd);
            successCount++;
          } catch (error) {
            errorCount++;
            logError(`Failed to import vehicle ${vehicleData.make} ${vehicleData.model}:`, error);
            throw error; // Re-throw to be caught by the modal
          }
        }
        
        // Refresh vehicles list
        const { dataService } = await import('../services/dataService');
        const isAdmin = currentUser?.role === 'admin';
        const updatedVehicles = await dataService.getVehicles(isAdmin);
        setVehicles(updatedVehicles);
        
        // Log audit entry for import
        const actor = currentUser?.name || currentUser?.email || 'System';
        const entry = logAction(actor, 'Import Vehicles', 'Vehicles Data', `Imported ${successCount} vehicles from CSV`);
        setAuditLog(prev => [entry, ...prev]);
        
        if (successCount > 0) {
          addToast(t('toast.importVehiclesSuccess', { count: successCount }), 'success');
        }
        if (errorCount > 0) {
          addToast(t('toast.importVehiclesPartialWarning', { count: errorCount }), 'warning');
        }
      } catch (error) {
        logError('Import failed:', error);
        throw error; // Re-throw to be handled by the modal
      }
    },
    onExportSales: () => {
      try {
        const soldVehicles = Array.isArray(vehicles) ? vehicles.filter(v => v && v.status === 'sold') : [];
        const headers = 'Make,Model,Year,Sale Price,Seller,Buyer,Sale Date\n';
        const csv = soldVehicles.map(vehicle => 
          `"${vehicle.make}","${vehicle.model}","${vehicle.year}","${vehicle.price}","${vehicle.sellerEmail}","N/A","N/A"`
        ).join('\n');
        const fullCsv = headers + csv;
        const blob = new Blob([fullCsv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sales_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Log audit entry for export
        const actor = currentUser?.name || currentUser?.email || 'System';
        const entry = logAction(actor, 'Export Sales', 'Sales Data', `Exported ${soldVehicles.length} sales records to CSV`);
        setAuditLog(prev => [entry, ...prev]);
        
        addToast(t('toast.exportSalesSuccess', { count: soldVehicles.length }), 'success');
      } catch (error) {
        logError('Export failed:', error);
        addToast(t('toast.exportFailed'), 'error');
      }
    },
    onUpdateVehicleData: async (newData: VehicleData) => {
      try {
        // CRITICAL FIX: Update Supabase FIRST (real-time), then sync to local state only on success
        const { saveVehicleData } = await import('../services/vehicleDataService');
        const success = await saveVehicleData(newData);
        
        if (!success) {
          // Supabase update failed - don't update local state
          addToast(t('toast.vehicleDataUpdateFailed'), 'error');
          throw new Error('Failed to update vehicle data in Supabase');
        }
        
        // Supabase update succeeded - NOW update local state
        setVehicleData(newData);

        // Invalidate the VehicleList filter cache (5-min TTL) and notify any
        // listeners (public site filters, other tabs) so they pick up the new
        // makes / models / variants immediately instead of serving stale data.
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('reRideVehicleDataFilters');
            localStorage.setItem('reRideVehicleData', JSON.stringify(newData));
          }
        } catch {
          /* storage unavailable */
        }
        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('vehicleDataUpdated', { detail: { vehicleData: newData } })
            );
          }
        } catch {
          /* ignore */
        }

        // Log audit entry for vehicle data update
        const actor = currentUser?.name || currentUser?.email || 'System';
        const entry = logAction(actor, 'Update Vehicle Data', 'Vehicle Data', 'Updated vehicle data configuration');
        setAuditLog(prev => [entry, ...prev]);

        addToast(t('toast.vehicleDataUpdated'), 'success');
        logInfo('✅ Vehicle data updated via API:', newData);
      } catch (error) {
        // Error already handled with specific toast message in inner catch block (line 1908)
        // Only log here to avoid duplicate error toasts
        logError('❌ Failed to update vehicle data:', error);
        // Don't show generic toast - inner catch already showed specific error message
        // Don't update local state - Supabase update failed
        throw error;
      }
    },
    onToggleVerifiedStatus: async (email: string) => {
      // Previously this only mutated local state + in-memory caches, so the
      // verification badge would reset on refresh. Now the toggle persists to
      // Supabase through the `/api/users` endpoint (which writes to the
      // `users.is_verified` column).
      const targetUser = Array.isArray(users) ? users.find(u => u && u.email === email) : undefined;
      if (!targetUser) {
        addToast(t('toast.userNotFound', { email }) || `User not found: ${email}`, 'error');
        return;
      }
      const nextValue = !targetUser.isVerified;

      // Optimistic local update so the admin UI reacts immediately.
      setUsers(prev => Array.isArray(prev) ? prev.map(user =>
        user && user.email === email ? { ...user, isVerified: nextValue } : user
      ) : []);
      syncUserCachesByEmail(email, { isVerified: nextValue });

      try {
        const { updateUser: updateUserService } = await import('../services/userService');
        await updateUserService({ email, isVerified: nextValue });
        addToast(t('toast.verificationToggled', { email }), 'success');
      } catch (error) {
        // Roll back on failure so the admin sees the true server state.
        setUsers(prev => Array.isArray(prev) ? prev.map(user =>
          user && user.email === email ? { ...user, isVerified: targetUser.isVerified } : user
        ) : []);
        syncUserCachesByEmail(email, { isVerified: targetUser.isVerified });
        logError('❌ Failed to persist isVerified to backend:', error);
        addToast(
          t('toast.verificationToggleFailed', { email }) ||
            `Failed to update verification status for ${email}. Please try again.`,
          'error',
        );
      }
    },
    onUpdateSupportTicket: async (ticket: SupportTicket) => {
      try {
        // Persist to API first, then sync local state
        const success = await updateSupportTicketInSupabase(ticket);
        if (!success) {
          throw new Error('Failed to update support ticket in Supabase');
        }

        setSupportTickets(prev => Array.isArray(prev) ? prev.map(t =>
          t && String(t.id) === String(ticket.id) ? ticket : t
        ) : []);
        addToast(t('toast.supportTicketUpdated'), 'success');
      } catch (error) {
        logError('Failed to update support ticket:', error);
        addToast(t('toast.supportTicketUpdateFailed'), 'error');
        throw error;
      }
    },
    onAddFaq: async (faq: Omit<FAQItem, 'id'>) => {
      try {
        // CRITICAL FIX: Save to Supabase FIRST (real-time), then sync to local state only on success
        const { saveFaqToSupabase } = await import('../services/faqService');
        const savedFaq = await saveFaqToSupabase(faq);
        
        if (!savedFaq) {
          throw new Error('Failed to save FAQ to Supabase');
        }
        
        // Supabase save succeeded - NOW update local state
        const newFaq: FAQItem = savedFaq || { ...faq, id: Date.now() };
        
        setFaqItems(prev => {
          const updated = [...prev, newFaq];
          saveFaqs(updated);
          return updated;
        });
        
        addToast(t('toast.faqAdded'), 'success');
      } catch (error) {
        logError('❌ Failed to add FAQ to Supabase:', error);
        addToast(t('toast.faqAddFailed'), 'error');
        // Don't add locally - Supabase creation failed
        throw error;
      }
    },
    onUpdateFaq: async (faq: FAQItem) => {
      try {
        if (!faq.id) {
          throw new Error('FAQ ID is required for update');
        }
        
        // CRITICAL FIX: Update Supabase FIRST (real-time), then sync to local state only on success
        const { updateFaqInSupabase } = await import('../services/faqService');
        const success = await updateFaqInSupabase(faq);
        
        if (!success) {
          throw new Error('Failed to update FAQ in Supabase');
        }
        
        // Supabase update succeeded - NOW update local state
        setFaqItems(prev => {
          const updated = Array.isArray(prev) ? prev.map(f => {
            if (f && f.id === faq.id) {
              return { ...faq };
            }
            return f;
          }) : [];
          saveFaqs(updated);
          return updated;
        });
        addToast(t('toast.faqUpdated'), 'success');
      } catch (error) {
        logError('❌ Failed to update FAQ in Supabase:', error);
        addToast(t('toast.faqUpdateFailed'), 'error');
        // Don't update locally - Supabase update failed
        throw error;
      }
    },
    onDeleteFaq: async (id: FAQItem['id']) => {
      try {
        // CRITICAL FIX: Delete from Supabase FIRST (real-time), then sync to local state only on success
        const { deleteFaqFromSupabase } = await import('../services/faqService');
        const success = await deleteFaqFromSupabase(id);
        
        if (!success) {
          throw new Error('Failed to delete FAQ from Supabase');
        }
        
        // Supabase delete succeeded - NOW delete from local state
        setFaqItems(prev => {
          const updated = Array.isArray(prev) ? prev.filter(f => f && f.id !== id) : [];
          saveFaqs(updated);
          return updated;
        });
        addToast(t('toast.faqDeleted'), 'success');
      } catch (error) {
        logError('❌ Failed to delete FAQ from Supabase:', error);
        addToast(t('toast.faqDeleteFailed'), 'error');
        // Don't delete locally - Supabase delete failed
        throw error;
      }
    },
    onCertificationApproval: async (vehicleId: number, decision: 'approved' | 'rejected') => {
      try {
        const vehicle = Array.isArray(vehicles) ? vehicles.find(v => v && v.id === vehicleId) : undefined;
        if (!vehicle) {
          addToast(t('toast.vehicleNotFound'), 'error');
          return;
        }

        const updatedVehicle: Vehicle = {
          ...vehicle,
          certificationStatus: decision === 'approved' ? 'certified' : 'rejected'
        };

        await dataService.updateVehicle(updatedVehicle);
        setVehicles(prev => Array.isArray(prev) ? prev.map(v =>
          v && v.id === vehicleId ? updatedVehicle : v
        ) : []);

        const actor = currentUser?.name || currentUser?.email || 'System';
        const vehicleInfo = `${vehicle.make} ${vehicle.model} (ID: ${vehicleId})`;
        const entry = logAction(actor, `Certification ${decision === 'approved' ? 'Approve' : 'Reject'}`, vehicleInfo, `Certification ${decision} for vehicle`);
        setAuditLog(prev => [entry, ...prev]);

        addToast(
          decision === 'approved' ? t('toast.certificationApproved') : t('toast.certificationRejected'),
          'success',
        );
      } catch (error) {
        logError('Failed to update certification:', error);
        addToast(t('toast.certificationUpdateFailed'), 'error');
      }
    },
  }), [
    users,
    vehicles,
    conversations,
    currentUser,
    publicSellerProfile,
    setUsers,
    setVehicles,
    setConversations,
    setCurrentUser,
    setPublicSellerProfile,
    setPlatformSettings,
    setAuditLog,
    setVehicleData,
    setFaqItems,
    setSupportTickets,
    setNotifications,
    syncUserCachesByEmail,
    syncAllUserCaches,
    updateVehicleHandler,
    addToast,
    t,
  ]);
}
