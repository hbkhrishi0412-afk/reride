import React, { useMemo, useState, useCallback, useEffect } from 'react';
import type { Conversation, Notification, Vehicle } from '../types';
import { buildNotificationGroups } from '../utils/notificationGroups';
import {
  getEffectiveMuteKeys,
  getNotificationStoryKey,
  isStoryMuted,
  sanitizeMuteKeysForServer,
  writeMuteKeys,
} from '../utils/notificationMute';
import { notificationTimeAgo } from '../utils/notificationTimeAgo';

interface NotificationsPageProps {
  notifications: Notification[];
  vehicles: Vehicle[];
  conversations?: Conversation[];
  onNotificationClick: (notification: Notification) => void;
  onMarkNotificationsAsRead: (ids: number[]) => void;
  onMarkAllNotificationsAsRead: () => void;
  onBack: () => void;
  /** Extra bottom padding when the tab bar is visible (mobile app shell). */
  contentBottomPadding?: boolean;
  /** Server-backed mute list when logged in (`undefined` = use localStorage only). */
  profileMuteKeys?: string[];
  onPersistMuteKeys?: (keys: string[]) => Promise<void>;
}

const NotificationsPage: React.FC<NotificationsPageProps> = ({
  notifications,
  vehicles,
  conversations = [],
  onNotificationClick,
  onMarkNotificationsAsRead,
  onMarkAllNotificationsAsRead,
  onBack,
  contentBottomPadding = false,
  profileMuteKeys,
  onPersistMuteKeys,
}) => {
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
    [onPersistMuteKeys]
  );

  const visibleItems = useMemo(
    () => notifications.filter((n) => !isStoryMuted(n, muted)),
    [notifications, muted]
  );
  const mutedItems = useMemo(
    () => notifications.filter((n) => isStoryMuted(n, muted)),
    [notifications, muted]
  );

  const groupsActive = useMemo(
    () => buildNotificationGroups(visibleItems, vehicles, conversations),
    [visibleItems, vehicles, conversations]
  );
  const groupsMuted = useMemo(
    () => buildNotificationGroups(mutedItems, vehicles, conversations),
    [mutedItems, vehicles, conversations]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
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

  const handleRowClick = (n: Notification) => {
    if (!n.isRead) {
      onMarkNotificationsAsRead([n.id]);
    }
    onNotificationClick(n);
  };

  const activityTypeLabel = (targetType: Notification['targetType']): string => {
    switch (targetType) {
      case 'conversation':
        return 'Messages';
      case 'price_drop':
      case 'vehicle':
        return 'Listings';
      case 'insurance_expiry':
      case 'general_admin':
        return 'Alerts';
      default:
        return 'Updates';
    }
  };

  const renderGroup = (
    g: ReturnType<typeof buildNotificationGroups>[0],
    opts: { allowMute: boolean }
  ) => {
    const open = isExpanded(g.key);
    const latest = g.items[0];
    const latestUnread = g.items.some((x) => !x.isRead);

    return (
      <div
        key={g.key}
        className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-brand-gray-900 shadow-sm"
      >
        <div className="flex items-stretch gap-0">
          <button
            type="button"
            onClick={() => toggleGroup(g.key)}
            className="flex-1 text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-brand-gray-800/80 transition-colors min-w-0"
          >
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${latestUnread ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-gray-900 dark:text-white truncate">{g.title}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                {g.subtitle && <span>{g.subtitle}</span>}
                {g.subtitle && <span>·</span>}
                <span>
                  Latest {notificationTimeAgo(new Date(latest.timestamp))}
                </span>
              </div>
            </div>
            <span className="text-gray-400 text-sm shrink-0" aria-hidden>
              {open ? '▾' : '▸'}
            </span>
          </button>
          {opts.allowMute && (
            <button
              type="button"
              onClick={() => muteStoryKey(g.key)}
              className="px-3 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-brand-gray-800 border-l border-gray-200 dark:border-gray-700 shrink-0"
              title="Mute updates from this chat or listing"
            >
              Mute
            </button>
          )}
          {!opts.allowMute && (
            <button
              type="button"
              onClick={() => unmuteStoryKey(g.key)}
              className="px-3 text-xs font-semibold text-orange-600 hover:bg-orange-50 dark:hover:bg-brand-gray-800 border-l border-gray-200 dark:border-gray-700 shrink-0"
            >
              Unmute
            </button>
          )}
        </div>
        {open && (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
            {g.items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleRowClick(n)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-brand-gray-800/60 flex gap-3"
                >
                  {!n.isRead && (
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" aria-hidden />
                  )}
                  {n.isRead && <span className="w-1.5 shrink-0" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">
                      {activityTypeLabel(n.targetType)} ·{' '}
                      {notificationTimeAgo(new Date(n.timestamp))}
                    </div>
                    <p
                      className={`text-sm leading-snug ${!n.isRead ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}
                    >
                      {n.message}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div
      className={`min-h-[calc(100vh-160px)] bg-gray-50 dark:bg-brand-gray-950 ${contentBottomPadding ? 'pb-24' : ''}`}
    >
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 flex items-center gap-1"
        >
          ← Back
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Activity</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Grouped by listing or chat. Muted items stay on this page — they do not notify here until you
            unmute.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => onMarkAllNotificationsAsRead()}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors"
            >
              Mark all as read
            </button>
          )}
          {mutedItems.length > 0 && (
            <button
              type="button"
              onClick={() => setShowMutedFeed((v) => !v)}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-brand-gray-800"
            >
              {showMutedFeed ? 'Hide' : 'Show'} muted ({mutedItems.length})
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-xl bg-white dark:bg-brand-gray-900 border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">You have no notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupsActive.map((g) => renderGroup(g, { allowMute: true }))}
            {showMutedFeed && groupsMuted.length > 0 && (
              <div className="pt-4 mt-4 border-t border-dashed border-gray-300 dark:border-gray-600">
                <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Muted
                </h2>
                <div className="space-y-4 opacity-90">
                  {groupsMuted.map((g) => renderGroup(g, { allowMute: false }))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
