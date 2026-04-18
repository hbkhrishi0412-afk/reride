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

  const cardStyle: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1px solid rgba(15,23,42,0.06)',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.20)'
  };

  const typeMeta = (targetType: Notification['targetType']) => {
    switch (targetType) {
      case 'conversation':
        return { tint: 'rgba(16,185,129,0.10)', color: '#047857' };
      case 'price_drop':
      case 'vehicle':
        return { tint: 'rgba(37,99,235,0.10)', color: '#1D4ED8' };
      case 'insurance_expiry':
      case 'general_admin':
        return { tint: 'rgba(245,158,11,0.10)', color: '#B45309' };
      default:
        return { tint: 'rgba(255,107,53,0.10)', color: '#EA580C' };
    }
  };

  const renderGroup = (
    g: ReturnType<typeof buildNotificationGroups>[0],
    opts: { allowMute: boolean }
  ) => {
    const open = isExpanded(g.key);
    const latest = g.items[0];
    const latestUnread = g.items.some((x) => !x.isRead);
    const unreadInGroup = g.items.filter((x) => !x.isRead).length;

    return (
      <div key={g.key} className="rounded-2xl overflow-hidden relative" style={cardStyle}>
        {latestUnread && (
          <span
            aria-hidden
            className="absolute left-0 top-0 h-full w-[3px]"
            style={{ background: 'linear-gradient(180deg, #FF8456, #FF6B35)' }}
          />
        )}
        <div className="flex items-stretch">
          <button
            type="button"
            onClick={() => toggleGroup(g.key)}
            className="flex-1 text-left px-4 py-3 flex items-center gap-3 active:bg-slate-50 transition-colors min-w-0"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="font-semibold text-slate-900 truncate text-[13.5px] tracking-tight" style={{ letterSpacing: '-0.01em' }}>
                  {g.title}
                </div>
                {unreadInGroup > 0 && (
                  <span
                    className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold text-white"
                    style={{ background: '#FF6B35' }}
                  >
                    {unreadInGroup > 9 ? '9+' : unreadInGroup}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-1.5 gap-y-0.5 mt-0.5 font-medium">
                {g.subtitle && <span className="truncate max-w-[60vw]">{g.subtitle}</span>}
                {g.subtitle && <span className="text-slate-300">·</span>}
                <span>Latest {notificationTimeAgo(new Date(latest.timestamp))}</span>
              </div>
            </div>
            <span
              className="shrink-0 w-7 h-7 rounded-full grid place-items-center text-slate-400 transition-transform"
              style={{ background: 'rgba(15,23,42,0.04)', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
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
              className="px-3 text-[11px] font-semibold text-slate-500 active:scale-95 transition-transform shrink-0"
              style={{ borderLeft: '1px solid rgba(15,23,42,0.06)' }}
              title="Mute updates from this chat or listing"
            >
              Mute
            </button>
          ) : (
            <button
              type="button"
              onClick={() => unmuteStoryKey(g.key)}
              className="px-3 text-[11px] font-semibold active:scale-95 transition-transform shrink-0"
              style={{ borderLeft: '1px solid rgba(15,23,42,0.06)', color: '#EA580C' }}
            >
              Unmute
            </button>
          )}
        </div>
        {open && (
          <ul className="divide-y divide-slate-100" style={{ borderTop: '1px solid rgba(15,23,42,0.06)' }}>
            {g.items.map((n) => {
              const m = typeMeta(n.targetType);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleRowClick(n)}
                    className="w-full text-left px-4 py-3 active:bg-slate-50 flex items-start gap-3 transition-colors"
                  >
                    <span
                      className="w-8 h-8 rounded-xl grid place-items-center shrink-0 mt-0.5"
                      style={{ background: m.tint, color: m.color }}
                    >
                      {n.targetType === 'conversation' ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                      ) : n.targetType === 'vehicle' || n.targetType === 'price_drop' ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17h14M3 13l2-5a2 2 0 0 1 1.85-1.25h10.3A2 2 0 0 1 19 8l2 5v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3z" /></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                          {activityTypeLabel(n.targetType)} · {notificationTimeAgo(new Date(n.timestamp))}
                        </div>
                        {!n.isRead && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#FF6B35' }} aria-hidden />}
                      </div>
                      <p className={`text-[13px] leading-snug mt-0.5 ${!n.isRead ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                        {n.message}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className={`min-h-[calc(100vh-160px)] ${contentBottomPadding ? 'pb-24' : ''}`} style={{ background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-start gap-3 mb-5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="w-9 h-9 rounded-full grid place-items-center text-slate-700 active:scale-95 transition-transform shrink-0"
            style={{ background: 'rgba(15,23,42,0.05)', border: '1px solid rgba(15,23,42,0.06)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="min-w-0">
            <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-slate-400">Inbox</p>
            <h1 className="text-[22px] font-semibold text-slate-900 tracking-tight" style={{ letterSpacing: '-0.02em' }}>Activity</h1>
            <p className="text-[12px] text-slate-500 mt-0.5 font-medium leading-snug max-w-md">
              Grouped by listing or chat. Muted items stay on this page — they do not notify until you unmute.
            </p>
          </div>
        </div>

        {/* Action row */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => onMarkAllNotificationsAsRead()}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-white active:scale-95 transition-transform"
              style={{
                background: 'linear-gradient(135deg, #FF8456 0%, #FF6B35 100%)',
                boxShadow: '0 10px 22px -10px rgba(255,107,53,0.45)'
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>
              Mark all read
              <span
                className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold"
                style={{ background: 'rgba(255,255,255,0.20)', color: '#FFFFFF' }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            </button>
          )}
          {mutedItems.length > 0 && (
            <button
              type="button"
              onClick={() => setShowMutedFeed((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold active:scale-95 transition-transform"
              style={{ background: 'rgba(15,23,42,0.04)', color: '#475569', border: '1px solid rgba(15,23,42,0.06)' }}
            >
              {showMutedFeed ? 'Hide' : 'Show'} muted
              <span
                className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold text-white"
                style={{ background: '#94A3B8' }}
              >
                {mutedItems.length}
              </span>
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div
            className="relative overflow-hidden rounded-3xl px-6 py-12 text-center"
            style={{ background: 'linear-gradient(180deg, #FFFFFF, #FAFAFC)', border: '1px solid rgba(15,23,42,0.06)' }}
          >
            <div
              className="w-14 h-14 mx-auto mb-3 rounded-2xl grid place-items-center"
              style={{ background: 'linear-gradient(135deg, rgba(255,107,53,0.10), rgba(255,132,86,0.18))', color: '#EA580C' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
            </div>
            <h4 className="text-[16px] font-semibold text-slate-900 mb-1 tracking-tight" style={{ letterSpacing: '-0.01em' }}>
              All caught up
            </h4>
            <p className="text-[12.5px] text-slate-500 leading-relaxed max-w-sm mx-auto font-medium">
              You have no notifications yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {groupsActive.map((g) => renderGroup(g, { allowMute: true }))}
            {showMutedFeed && groupsMuted.length > 0 && (
              <div className="pt-5 mt-3" style={{ borderTop: '1px dashed rgba(15,23,42,0.12)' }}>
                <h2 className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.18em] mb-3">
                  Muted
                </h2>
                <div className="space-y-3 opacity-95">
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
