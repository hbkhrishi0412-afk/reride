import React, { useMemo } from 'react';
import type { Notification } from '../types';

interface NotificationCenterProps {
    notifications: Notification[];
    onNotificationClick: (notification: Notification) => void;
    onMarkAllAsRead: () => void;
}

const timeAgo = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return "Just now";
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
    return (
        <li className="border-b border-gray-200-200 dark:border-gray-200-200 last:border-b-0">
            <button onClick={onClick} className="w-full text-left p-3 hover:bg-reride-off-white dark:hover:bg-brand-gray-700 transition-colors flex items-start gap-3">
                {!notification.isRead && <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: '#FF6B35' }}></div>}
                <div className={`flex-shrink-0 ${notification.isRead ? 'ml-4' : ''}`}>
                    <NotificationIcon type={notification.targetType} />
                </div>
                <div className="flex-grow">
                    <p className={`text-sm ${!notification.isRead ? 'font-semibold text-reride-text-dark dark:text-reride-text-dark' : 'text-brand-gray-600 dark:text-reride-text-dark'}`}>
                        {notification.message}
                    </p>
                    <p className="text-xs text-reride-text dark:text-reride-text mt-1">
                        {timeAgo(new Date(notification.timestamp))}
                    </p>
                </div>
            </button>
        </li>
    );
};


const NotificationCenter: React.FC<NotificationCenterProps> = ({ notifications, onNotificationClick, onMarkAllAsRead }) => {
    const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

    return (
        <div className="absolute top-full right-0 mt-2 w-80 md:w-96 bg-white rounded-lg shadow-2xl border dark:border-gray-200-200 animate-fade-in flex flex-col max-h-[70vh]">
            <header className="p-3 border-b dark:border-gray-200-200 flex justify-between items-center">
                <h3 className="font-bold text-lg text-reride-text-dark dark:text-white">Notifications</h3>
                {unreadCount > 0 && (
                    <button onClick={onMarkAllAsRead} className="text-sm font-semibold hover:underline transition-colors" style={{ color: '#FF6B35' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--reride-blue)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--reride-orange)'}>
                        Mark all as read
                    </button>
                )}
            </header>
            
            <div className="overflow-y-auto">
                {notifications.length > 0 ? (
                    <ul>
                        {notifications.map(n => (
                            <NotificationItem key={n.id} notification={n} onClick={() => onNotificationClick(n)} />
                        ))}
                    </ul>
                ) : (
                    <div className="p-8 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-reride-text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        <h4 className="mt-2 text-sm font-semibold text-reride-text-dark dark:text-reride-text-dark">All caught up!</h4>
                        <p className="mt-1 text-xs text-reride-text-dark dark:text-reride-text-dark">You have no new notifications.</p>
                    </div>
                )}
            </div>
            
            <footer className="p-2 border-t dark:border-gray-200-200 text-center">
                {/* This could eventually link to a full notifications page */}
                <button className="text-sm font-semibold hover:underline w-full p-1 rounded transition-colors" style={{ color: '#FF6B35' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--reride-blue)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--reride-orange)'}>
                    View All
                </button>
            </footer>
        </div>
    );
};

export default NotificationCenter;