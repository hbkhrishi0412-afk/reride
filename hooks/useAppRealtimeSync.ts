import { useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Conversation, Notification, Toast, User, Vehicle } from '../types';
import { useSupabaseRealtime } from './useSupabaseRealtime';
import { dataService } from '../services/dataService';
import { saveConversations } from '../services/chatService';
import { supabaseRowToConversation } from '../services/supabase-conversation-service';
import { emailToKey } from '../services/supabase-user-service';
import { getSupabaseClient } from '../lib/supabase';
import { normalizeNotificationRow } from '../utils/normalizeNotification.js';
import { shouldShowInboundMessageToast } from '../utils/toastPolicy.js';
import { participantIdMatchesAppUser } from '../utils/conversationParticipants';
import { isDevelopmentEnvironment } from '../utils/environment';
import { mergeVehicleCatalog } from '../utils/mergeVehicleCatalog';
import {
  postgrestEqQuoted,
  mergeConversationMessagesForRealtime,
} from '../components/AppProvider/helpers';
import {
  fetchOwnSellerProfile,
  mergeSellerPlanFields,
  publishCurrentUserPlanUpdate,
  sellerPlanFieldsChanged,
} from '../utils/sellerPlanSync.js';

export type UseAppRealtimeSyncArgs = {
  currentUser: User | null;
  activeChatId: string | undefined;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  setNotifications: Dispatch<SetStateAction<Notification[]>>;
  setVehicles: Dispatch<SetStateAction<Vehicle[]>>;
  setUsers: Dispatch<SetStateAction<User[]>>;
  addToast: (message: string, type: Toast['type']) => void;
};

/**
 * Supabase Realtime subscriptions for conversations, notifications, vehicles, and users
 * (extracted from AppProvider).
 */
export function useAppRealtimeSync(args: UseAppRealtimeSyncArgs) {
  const {
    currentUser,
    activeChatId,
    setConversations,
    setNotifications,
    setVehicles,
    setUsers,
    addToast,
  } = args;

  // Supabase Realtime: other party's messages (customer_id/seller_id are users.id, not raw emails — must match email + emailToKey + user.id)
  const applyConversationRealtimeRow = useCallback(
    async (row: any) => {
      const email = (currentUser?.email || '').toLowerCase().trim();
      if (!email || !row) {
        return;
      }
      const uid = String(currentUser?.id || '').toLowerCase().trim();
      const key = emailToKey(email);
      const rc = String(row.customer_id ?? '').toLowerCase().trim();
      const rs = String(row.seller_id ?? '').toLowerCase().trim();
      const involved =
        rc === email ||
        rs === email ||
        rc === key ||
        rs === key ||
        (!!uid && (rc === uid || rs === uid));
      if (!involved) {
        return;
      }

      let conv = supabaseRowToConversation(row);
      try {
        const supabase = getSupabaseClient();
        const ids = [...new Set([row.customer_id, row.seller_id].filter(Boolean).map(String))];
        if (ids.length > 0) {
          const { data: users } = await supabase.from('users').select('id,email').in('id', ids);
          const em = new Map<string, string>();
          for (const u of users || []) {
            if (u?.id && u?.email) {
              em.set(String(u.id).toLowerCase(), String(u.email).toLowerCase().trim());
            }
          }
          conv = {
            ...conv,
            customerId: em.get(String(row.customer_id).toLowerCase()) ?? conv.customerId,
            sellerId: em.get(String(row.seller_id).toLowerCase()) ?? conv.sellerId,
          };
        }
      } catch {
        /* keep conv from row ids if user lookup fails (RLS) */
      }

      setConversations((prev) => {
        const clientAlias =
          row?.metadata && typeof row.metadata === 'object'
            ? String((row.metadata as { client_conversation_id?: string }).client_conversation_id || '')
            : '';
        const idx = prev.findIndex(
          (c) =>
            c.id === conv.id ||
            (clientAlias && c.id === clientAlias) ||
            (clientAlias && String(c.id) === clientAlias),
        );
        if (idx < 0) {
          const next = [...prev, conv];
          try {
            saveConversations(next);
          } catch {
            void 0;
          }
          if (currentUser?.role === 'seller' && !conv.isReadBySeller) {
            const lastMsg = conv.messages?.[conv.messages.length - 1];
            if (
              lastMsg?.sender === 'user' &&
              shouldShowInboundMessageToast(conv.id, activeChatId)
            ) {
              addToast(
                `New message from ${conv.customerName || 'Customer'} about ${conv.vehicleName || 'your listing'}`,
                'info',
              );
            }
          }
          return next;
        }
        const existing = prev[idx];
        const mergedMsgs = mergeConversationMessagesForRealtime(existing.messages || [], conv.messages || []);
        const merged = {
          ...conv,
          id: existing.id,
          messages: mergedMsgs.length ? mergedMsgs : conv.messages,
        };
        const hadUnreadFromCustomer =
          currentUser?.role === 'seller' &&
          !existing.isReadBySeller &&
          merged.isReadBySeller === false &&
          mergedMsgs.length > (existing.messages?.length ?? 0) &&
          mergedMsgs[mergedMsgs.length - 1]?.sender === 'user';
        const next = prev.map((c, i) => (i === idx ? merged : c));
        try {
          saveConversations(next);
        } catch {
          void 0;
        }
        if (hadUnreadFromCustomer && shouldShowInboundMessageToast(merged.id, activeChatId)) {
          addToast(
            `New message from ${merged.customerName || 'Customer'} about ${merged.vehicleName || 'your listing'}`,
            'info',
          );
        }
        return next;
      });
    },
    [currentUser?.email, currentUser?.id, currentUser?.role, addToast, activeChatId],
  );

  const onConversationRealtimeEvent = useCallback(
    (row: any) => {
      void applyConversationRealtimeRow(row);
    },
    [applyConversationRealtimeRow],
  );

  useSupabaseRealtime({
    table: 'conversations',
    enabled: !!currentUser?.email,
    onInsert: onConversationRealtimeEvent,
    onUpdate: onConversationRealtimeEvent,
  });

  // Supabase Realtime: when a new notification is created for this user, add it to state and show browser notification
  const userEmailForNotif = currentUser?.email?.toLowerCase().trim() ?? '';
  const onNotificationRealtimeInsert = useCallback(
    (row: Record<string, unknown>) => {
      if (!userEmailForNotif) return;
      const recipient = (row.recipient_email || row.user_id || '').toString();
      if (!recipient || !participantIdMatchesAppUser(recipient, userEmailForNotif, currentUser?.id)) return;
      setNotifications((prev) => [normalizeNotificationRow(row), ...prev]);
    },
    [userEmailForNotif, currentUser?.id],
  );

  useSupabaseRealtime({
    table: 'notifications',
    enabled: !!userEmailForNotif,
    filter: userEmailForNotif ? `recipient_email=eq.${postgrestEqQuoted(userEmailForNotif)}` : undefined,
    onInsert: onNotificationRealtimeInsert,
  });

  // Supabase Realtime: published vehicle inserts/updates/deletes → debounced full refresh (web + Capacitor)
  const vehicleRealtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleVehicleRealtimeRefresh = useCallback(() => {
    if (vehicleRealtimeDebounceRef.current) {
      clearTimeout(vehicleRealtimeDebounceRef.current);
    }
    vehicleRealtimeDebounceRef.current = setTimeout(() => {
      vehicleRealtimeDebounceRef.current = null;
      try {
        const raw = localStorage.getItem('reRideCurrentUser');
        const admin = raw ? JSON.parse(raw)?.role === 'admin' : false;
        void dataService
          .getVehicles(!!admin, true)
          .then((fresh) => {
            if (Array.isArray(fresh)) {
              setVehicles((prev) => mergeVehicleCatalog(prev, fresh, !!admin));
            }
          })
          .catch(() => {});
      } catch {
        /* ignore */
      }
    }, 1500);
  }, []);

  useSupabaseRealtime({
    table: 'vehicles',
    enabled: typeof window !== 'undefined' && !isDevelopmentEnvironment(),
    onInsert: scheduleVehicleRealtimeRefresh,
    onUpdate: scheduleVehicleRealtimeRefresh,
    onDelete: scheduleVehicleRealtimeRefresh,
  });

  const usersRealtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const refreshOwnPlanFromRealtime = useCallback((row: Record<string, unknown> | null | undefined) => {
    const me = currentUserRef.current;
    if (!me?.email || me.role !== 'seller') return;
    const rowEmail = String(row?.email || '').toLowerCase().trim();
    const myEmail = me.email.toLowerCase().trim();
    if (rowEmail && rowEmail !== myEmail) return;

    void fetchOwnSellerProfile(myEmail).then((fresh) => {
      if (!fresh) return;
      const latest = currentUserRef.current;
      if (!latest || latest.email?.toLowerCase().trim() !== myEmail) return;
      if (!sellerPlanFieldsChanged(latest, fresh)) return;
      publishCurrentUserPlanUpdate(mergeSellerPlanFields(latest, fresh));
    });
  }, []);

  const scheduleUsersRealtimeRefresh = useCallback((row?: Record<string, unknown>) => {
    if (usersRealtimeDebounceRef.current) {
      clearTimeout(usersRealtimeDebounceRef.current);
    }
    usersRealtimeDebounceRef.current = setTimeout(() => {
      usersRealtimeDebounceRef.current = null;
      refreshOwnPlanFromRealtime(row);
      void dataService
        .getUsers(true)
        .then((fresh) => {
          if (Array.isArray(fresh)) {
            setUsers(fresh);
          }
        })
        .catch(() => {});
    }, 2000);
  }, [refreshOwnPlanFromRealtime]);

  useSupabaseRealtime({
    table: 'users',
    enabled: typeof window !== 'undefined' && !isDevelopmentEnvironment(),
    onInsert: scheduleUsersRealtimeRefresh,
    onUpdate: scheduleUsersRealtimeRefresh,
    onDelete: scheduleUsersRealtimeRefresh,
  });
}
