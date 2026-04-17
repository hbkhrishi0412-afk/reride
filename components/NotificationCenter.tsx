import React, { useMemo } from 'react';
import type { Notification } from '../types';

function startOfLocalDay(d: Date): number {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function notificationSectionLabel(ts: string): 'Today' | 'Earlier' {
    const t = new Date(ts).getTime();
    const today = startOfLocalDay(new Date());
    return t >= today ? 'Today' : 'Earlier';
}

function activityTypeLabel(targetType: Notification['targetType']): string {
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
}

interface NotificationCenterProps {
    notifications: Notification[];
    onNotificationClick: (notification: Notification) => void;
    onMarkAllAsRead: () => void;
    onViewAll: () => void;
}

const timeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(seconds / 3600);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(seconds / 86400);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
    const years = Math.floor(days / 365);
    return `${years} year${years === 1 ? '' : 's'} ago`;
};

const NotificationIcon: React.FC<{ type: Notification['targetType'] }> = ({ type }) => {
    const baseClass = "h-6 w-6";
    switch(type) {
        case 'conversation':
            return <svg xmlns="http://www.w3.org/2000/svg" className={baseClass} style={{ color: '#1E88E5' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
        case 'price_drop':
             return <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-reride-orange`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
        case 'insurance_expiry':
        case 'general_admin':
        case 'vehicle':
             return <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-reride-text-dark`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
        default:
            return <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClass} text-reride-text-dark`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    }
}

const NotificationItem: React.FC<{ notification: Notification; onClick: () => void; }> = ({ notification, onClick }) => {
    const category = activityTypeLabel(notification.targetType);
    return (
        <li className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
            <button type="button" onClick={onClick} className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-brand-gray-800/80 transition-colors flex items-start gap-3">
                {!notification.isRead && <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: '#FF6B35' }} aria-hidden />}
                <div className={`flex-shrink-0 ${notification.isRead ? 'ml-4' : ''}`}>
                    <NotificationIcon type={notification.targetType} />
                </div>
                <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-gray-500 dark:text-brand-gray-400">{category}</span>
                        <span className="text-[10px] text-brand-gray-400 dark:text-brand-gray-500">·</span>
                        <span className="text-[10px] text-brand-gray-500 dark:text-brand-gray-400">{timeAgo(new Date(notification.timestamp))}</span>
                    </div>
                    <p className={`text-sm leading-snug ${!notification.isRead ? 'font-semibold text-reride-text-dark dark:text-white' : 'text-brand-gray-600 dark:text-brand-gray-300'}`}>
                        {notification.message}
                    </p>
                </div>
            </button>
        </li>
    );
};


const NotificationCenter: React.FC<NotificationCenterProps> = ({ notifications, onNotificationClick, onMarkAllAsRead, onViewAll }) => {
    const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

    const grouped = useMemo(() => {
        const sorted = [...notifications].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        const today: Notification[] = [];
        const earlier: Notification[] = [];
        for (const n of sorted) {
            if (notificationSectionLabel(n.timestamp) === 'Today') today.push(n);
            else earlier.push(n);
        }
        return { today, earlier };
    }, [notifications]);

    return (
        <div className="absolute top-full right-0 mt-2 w-80 md:w-96 bg-white dark:bg-brand-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 animate-fade-in flex flex-col max-h-[70vh]">
            <header className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start gap-2">
                <div>
                    <h3 className="font-bold text-lg text-reride-text-dark dark:text-white leading-tight">Notifications</h3>
                    <p className="text-xs text-brand-gray-500 dark:text-brand-gray-400 mt-0.5">Activity — not the same as Messages</p>
                </div>
                {unreadCount > 0 && (
                    <button type="button" onClick={onMarkAllAsRead} className="text-sm font-semibold hover:underline transition-colors shrink-0" style={{ color: '#FF6B35' }} onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--reride-blue)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--reride-orange)'; }}>
                        Mark all read
                    </button>
                )}
            </header>
            
            <div className="overflow-y-auto flex-1 min-h-0">
                {notifications.length > 0 ? (
                    <div>
                        {grouped.today.length > 0 && (
                            <div>
                                <div className="sticky top-0 z-[1] px-3 py-2 text-xs font-bold uppercase tracking-wider text-brand-gray-500 dark:text-brand-gray-400 bg-gray-50 dark:bg-brand-gray-800 border-b border-gray-100 dark:border-gray-700">
                                    Today
                                </div>
                                <ul>
                                    {grouped.today.map(n => (
                                        <NotificationItem key={n.id} notification={n} onClick={() => onNotificationClick(n)} />
                                    ))}
                                </ul>
                            </div>
                        )}
                        {grouped.earlier.length > 0 && (
                            <div>
                                <div className="sticky top-0 z-[1] px-3 py-2 text-xs font-bold uppercase tracking-wider text-brand-gray-500 dark:text-brand-gray-400 bg-gray-50 dark:bg-brand-gray-800 border-b border-gray-100 dark:border-gray-700">
                                    Earlier
                                </div>
                                <ul>
                                    {grouped.earlier.map(n => (
                                        <NotificationItem key={n.id} notification={n} onClick={() => onNotificationClick(n)} />
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="p-8 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-reride-text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        <h4 className="mt-2 text-sm font-semibold text-reride-text-dark dark:text-reride-text-dark">All caught up!</h4>
                        <p className="mt-1 text-xs text-reride-text-dark dark:text-reride-text-dark">You have no new notifications.</p>
                    </div>
                )}
            </div>
            
            <footer className="p-2 border-t dark:border-gray-200 text-center">
                <button
                    type="button"
                    onClick={onViewAll}
                    className="text-sm font-semibold hover:underline w-full p-1 rounded transition-colors"
                    style={{ color: '#FF6B35' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--reride-blue)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--reride-orange)'; }}
                >
                    View All
                </button>
            </footer>
        </div>
    );
};

export default NotificationCenter;