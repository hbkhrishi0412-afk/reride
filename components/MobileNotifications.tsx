import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { Conversation, Notification, Vehicle } from '../types';
import { formatRelativeTime } from '../utils/date';
import { buildNotificationGroups } from '../utils/notificationGroups';
import {
  getEffectiveMuteKeys,
  isStoryMuted,
  sanitizeMuteKeysForServer,
  writeMuteKeys,
} from '../utils/notificationMute';
import { notificationTimeAgo } from '../utils/notificationTimeAgo';

interface MobileNotificationsProps {
  notifications: Notification[];
  vehicles?: Vehicle[];
  conversations?: Conversation[];
  onNotificationClick?: (notification: Notification) => void;
  onAcceptDealChat?: (leadId: string, conversationId?: string) => void | Promise<void>;
  onMarkAsRead?: (ids: number[]) => void;
  onMarkAllAsRead?: () => void;
  onBack?: () => void;
  isLoading?: boolean;
  loadError?: string | null;
  onRetryLoad?: () => void;
  profileMuteKeys?: string[];
  onPersistMuteKeys?: (keys: string[]) => Promise<void>;
}

export const MobileNotifications: React.FC<MobileNotificationsProps> = ({
  notifications,
  vehicles = [],
  conversations = [],
  onNotificationClick,
  onAcceptDealChat,
  onMarkAsRead,
  onMarkAllAsRead,
  onBack,
  isLoading = false,
  loadError = null,
  onRetryLoad,
  profileMuteKeys,
  onPersistMuteKeys,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [muted, setMuted] = useState<Set<string>>(() => getEffectiveMuteKeys(profileMuteKeys));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showMutedFeed, setShowMutedFeed] = useState(false);

  const profileMuteSig =
    profileMuteKeys === undefined ? '__unset__' : JSON.stringify(profileMuteKeys);

  useEffect(() => {
    if (profileMuteKeys === undefined) return;
    const next = new Set(sanitizeMuteKeysForServer(profileMuteKeys));
    setMuted(next);
    writeMuteKeys(next);
  }, [profileMuteSig]);

  const persistMuted = useCallback(
    (next: Set<string>) => {
      setMuted(next);
      writeMuteKeys(next);
      const keys = sanitizeMuteKeysForServer([...next]);
      void onPersistMuteKeys?.(keys);
    },
    [onPersistMuteKeys],
  );

  const visibleItems = useMemo(
    () => notifications.filter((n) => !isStoryMuted(n, muted)),
    [notifications, muted],
  );
  const mutedItems = useMemo(
    () => notifications.filter((n) => isStoryMuted(n, muted)),
    [notifications, muted],
  );

  const filteredVisible = useMemo(() => {
    const sorted = [...visibleItems].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    if (filter === 'unread') {
      return sorted.filter((n) => !n.isRead);
    }
    return sorted;
  }, [visibleItems, filter]);

  const groupsActive = useMemo(
    () => buildNotificationGroups(filteredVisible, vehicles, conversations),
    [filteredVisible, vehicles, conversations],
  );
  const groupsMuted = useMemo(
    () => buildNotificationGroups(mutedItems, vehicles, conversations),
    [mutedItems, vehicles, conversations],
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  const isExpanded = (key: string) => expanded[key] !== false;

  const toggleGroup = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !isExpanded(key) }));
  };

  const muteStoryKey = (key: string) => {
    const next = new Set(muted);
    next.add(key);
    persistMuted(next);
  };

  const unmuteStoryKey = (key: string) => {
    const next = new Set(muted);
    next.delete(key);
    persistMuted(next);
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead && onMarkAsRead) {
      onMarkAsRead([notification.id]);
    }
    onNotificationClick?.(notification);
  };

  const getNotificationIcon = (targetType: Notification['targetType']) => {
    switch (targetType) {
      case 'vehicle':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'conversation':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        );
      case 'price_drop':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
        );
      case 'service_request':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case 'deal':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );
    }
  };

  const iconTint = (targetType: Notification['targetType']) => {
    switch (targetType) {
      case 'price_drop':
        return 'bg-green-100 text-green-600';
      case 'conversation':
        return 'bg-blue-100 text-blue-600';
      case 'deal':
        return 'bg-orange-100 text-orange-700';
      case 'service_request':
        return 'bg-purple-100 text-purple-600';
      default:
        return 'bg-orange-100 text-orange-600';
    }
  };

  const renderGroup = (
    g: ReturnType<typeof buildNotificationGroups>[0],
    opts: { allowMute: boolean },
  ) => {
    const open = isExpanded(g.key);
    const latest = g.items[0];
    const latestUnread = g.items.some((x) => !x.isRead);
    const unreadInGroup = g.items.filter((x) => !x.isRead).length;

    return (
      <div
        key={g.key}
        className={`overflow-hidden rounded-xl border bg-white ${
          latestUnread ? 'border-orange-200' : 'border-gray-100'
        }`}
      >
        <div className="flex items-stretch">
          <button
            type="button"
            onClick={() => toggleGroup(g.key)}
            className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left active:bg-gray-50"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-gray-900">{g.title}</p>
                {unreadInGroup > 0 ? (
                  <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white">
                    {unreadInGroup > 9 ? '9+' : unreadInGroup}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                {g.subtitle ? `${g.subtitle} · ` : ''}
                Latest {notificationTimeAgo(new Date(latest.timestamp))}
              </p>
            </div>
            <span
              className="shrink-0 text-gray-400 transition-transform"
              style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
              aria-hidden
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </span>
          </button>
          {opts.allowMute ? (
            <button
              type="button"
              onClick={() => muteStoryKey(g.key)}
              className="shrink-0 border-l border-gray-100 px-3 text-[11px] font-semibold text-gray-500"
            >
              Mute
            </button>
          ) : (
            <button
              type="button"
              onClick={() => unmuteStoryKey(g.key)}
              className="shrink-0 border-l border-gray-100 px-3 text-[11px] font-semibold text-orange-600"
            >
              Unmute
            </button>
          )}
        </div>
        {open ? (
          <ul className="divide-y divide-gray-100 border-t border-gray-100">
            {g.items.map((notification) => (
              <li key={notification.id}>
                <div
                  className={`p-4 ${!notification.isRead ? 'bg-orange-50/40' : ''}`}
                >
                  <div
                    className="flex gap-3 active:bg-gray-50"
                    onClick={() => handleNotificationClick(notification)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleNotificationClick(notification)}
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconTint(notification.targetType)}`}>
                      {getNotificationIcon(notification.targetType)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-start justify-between">
                        <p className={`text-sm ${!notification.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                          {notification.title || notification.message}
                        </p>
                        {!notification.isRead ? (
                          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                        ) : null}
                      </div>
                      {notification.title ? (
                        <p className="mb-1 text-xs text-gray-600">{notification.message}</p>
                      ) : null}
                      <p className="text-xs text-gray-500">{formatRelativeTime(notification.timestamp)}</p>
                    </div>
                  </div>
                  {notification.targetType === 'deal' &&
                    notification.dealAction === 'accept_chat' &&
                    notification.dealLeadId &&
                    onAcceptDealChat ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onAcceptDealChat(notification.dealLeadId!, notification.conversationId);
                        }}
                        className="mt-3 w-full rounded-lg bg-reride-orange py-2.5 text-sm font-bold text-white"
                      >
                        Accept Chat
                      </button>
                    ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {onBack ? (
        <div className="flex items-center justify-between border-b border-gray-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="-ml-2 p-2"
              style={{ minWidth: '44px', minHeight: '44px' }}
              aria-label="Back"
            >
              <svg className="h-6 w-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
              <p className="text-xs text-gray-500">Grouped by listing or chat</p>
            </div>
          </div>
          {unreadCount > 0 && onMarkAllAsRead ? (
            <button
              onClick={onMarkAllAsRead}
              className="text-sm font-semibold text-orange-500"
            >
              Mark all read
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="border-b border-gray-200 bg-white p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
              filter === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
              filter === 'unread' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>
        {mutedItems.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowMutedFeed((v) => !v)}
            className="mt-3 w-full rounded-full border border-gray-200 bg-gray-50 py-2 text-xs font-semibold text-gray-600"
          >
            {showMutedFeed ? 'Hide' : 'Show'} muted ({mutedItems.length})
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading notifications">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 rounded-xl border border-gray-100 bg-white p-4">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="px-6 py-12 text-center">
          <p className="mb-2 font-medium text-gray-700">Could not load notifications</p>
          <p className="mb-4 text-sm text-gray-500">{loadError}</p>
          {onRetryLoad ? (
            <button
              type="button"
              onClick={onRetryLoad}
              className="rounded-xl bg-orange-500 px-5 py-2.5 font-semibold text-white"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : notifications.length === 0 ? (
        <div className="py-12 text-center">
          <svg
            className="mx-auto mb-4 h-16 w-16 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <p className="text-gray-500">No notifications</p>
        </div>
      ) : groupsActive.length === 0 && !showMutedFeed ? (
        <div className="py-12 text-center">
          <p className="text-gray-500">No notifications match this filter</p>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          {groupsActive.map((g) => renderGroup(g, { allowMute: true }))}
          {showMutedFeed && groupsMuted.length > 0 ? (
            <div className="space-y-3 border-t border-dashed border-gray-200 pt-4">
              <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Muted</h2>
              {groupsMuted.map((g) => renderGroup(g, { allowMute: false }))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default MobileNotifications;
