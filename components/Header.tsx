import { logInfo } from '../utils/logger.js';
import React, { useState, useEffect, memo, useRef, useMemo, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import type { User, Notification, Toast as ToastType, Vehicle } from '../types';
import { View as ViewEnum } from '../types';
import NotificationCenter from './NotificationCenter';
import Logo from './Logo';
import CityDropdown from './CityDropdown';
import SellerDropdown from './SellerDropdown';
import LanguageSwitcher from './LanguageSwitcher';
import { supportTelHref } from '../utils/whatsappShare.js';
import { useIsMdUp } from '../hooks/useIsMdUp';
import { primaryLocationLabel } from '../utils/cityMapping';
import { HELP_NAV_ITEMS } from '../constants/helpLegalNav.js';

const LocationModal = lazy(() => import('./LocationModal'));

interface HeaderProps {
    onNavigate: (view: ViewEnum, params?: { city?: string }) => void;
    currentUser: User | null;
    serviceProvider?: {
        name?: string;
        email?: string;
        city?: string;
    } | null;
    onLogout: () => void;
    compareCount: number;
    wishlistCount: number;
    inboxCount: number;
    isHomePage?: boolean;
    notifications: Notification[];
    onNotificationClick: (notification: Notification) => void;
    onMarkNotificationsAsRead: (ids: number[]) => void;
    onMarkAllNotificationsAsRead: () => void;
    /** Opens the Messages hub (inbox / seller inquiries), separate from the notification bell. */
    onOpenMessages: () => void;
    onOpenCommandPalette: () => void;
    userLocation: string;
    onLocationChange: (location: string) => void;
    addToast: (message: string, type: ToastType['type']) => void;
    allVehicles: Vehicle[];
    selectedCity?: string;
    onBrowseAllIndia?: () => void;
    onUseMyLocation?: (city: string, locationLabel: string) => void;
}

const Header: React.FC<HeaderProps> = memo(({
    onNavigate,
    currentUser,
    serviceProvider = null,
    onLogout,
    compareCount,
    wishlistCount,
    inboxCount,
    notifications,
    onNotificationClick,
    onMarkNotificationsAsRead,
    onMarkAllNotificationsAsRead,
    onOpenMessages,
    onOpenCommandPalette,
    userLocation,
    onLocationChange,
    addToast,
    allVehicles,
    isHomePage = false,
    selectedCity = '',
    onBrowseAllIndia,
    onUseMyLocation,
}) => {
    const { t } = useTranslation();
    const isMdUp = useIsMdUp();
    const showHomeLocationActions = Boolean(isHomePage && onBrowseAllIndia && onUseMyLocation);
    const locationDisplay =
        selectedCity.trim() ||
        (userLocation.trim() ? primaryLocationLabel(userLocation) || userLocation.trim() : '');
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isServiceProviderMenuOpen, setIsServiceProviderMenuOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
    const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

    useEffect(() => {
        const open = () => setIsLocationModalOpen(true);
        window.addEventListener('reride:open-location-modal', open);
        return () => window.removeEventListener('reride:open-location-modal', open);
    }, []);

    const notificationsRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const serviceProviderMenuRef = useRef<HTMLDivElement>(null);
    const mobileMenuRef = useRef<HTMLDivElement>(null);
    const moreMenuRef = useRef<HTMLDivElement>(null);

    const unreadNotifications = useMemo(() => 
        notifications.filter(n => !n.isRead), [notifications]
    );

    const handleNotificationItemClick = (notification: Notification) => {
        if (!notification.isRead) {
            onMarkNotificationsAsRead([notification.id]);
        }
        onNotificationClick(notification);
        setIsNotificationsOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
                setIsNotificationsOpen(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
            if (serviceProviderMenuRef.current && !serviceProviderMenuRef.current.contains(event.target as Node)) {
                setIsServiceProviderMenuOpen(false);
            }
            if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
                setIsMobileMenuOpen(false);
            }
            if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
                setIsMoreMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isMobileMenuOpen) setIsMobileMoreOpen(false);
    }, [isMobileMenuOpen]);

    const handleNavigate = (view: ViewEnum) => {
        onNavigate(view);
        setIsMobileMenuOpen(false);
        setIsNotificationsOpen(false);
        setIsUserMenuOpen(false);
        setIsServiceProviderMenuOpen(false);
        setIsMoreMenuOpen(false);
        setIsMobileMoreOpen(false);
    };

    const openLocationPicker = () => {
        setIsLocationModalOpen(true);
        setIsMoreMenuOpen(false);
        setIsMobileMoreOpen(false);
        setIsMobileMenuOpen(false);
    };

    const renderHeaderLocationPicker = () => (
        <button
            type="button"
            onClick={openLocationPicker}
            data-testid="header-location-picker"
            className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50/90 px-2 py-1 text-[11px] sm:text-xs lg:text-sm font-semibold text-blue-700 hover:bg-blue-100 active:scale-[0.98] transition-all min-w-0 max-w-[6.5rem] sm:max-w-[10rem] lg:max-w-[11rem] notranslate"
            aria-label={t('a11y.chooseLocation')}
            title={locationDisplay || t('header.selectLocation')}
            data-no-translate
            translate="no"
        >
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">{locationDisplay || t('header.selectLocation')}</span>
            <svg className="h-3 w-3 shrink-0 opacity-70 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </button>
    );

    const handleViewAllNotifications = () => {
        setIsNotificationsOpen(false);
        if (!currentUser) return;
        handleNavigate(ViewEnum.NOTIFICATIONS_CENTER);
    };

    const supportTel = supportTelHref();

    const DropdownLink: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
        <button 
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick();
                setIsUserMenuOpen(false); // Close dropdown after navigation
            }} 
            className="block w-full text-left px-4 py-2 text-sm text-reride-text-dark dark:text-reride-text-dark hover:bg-reride-off-white dark:hover:bg-brand-gray-700 transition-colors"
        >
            {children}
        </button>
    );

    return (
        <>
            <header className="bg-white/80 backdrop-blur-xl border-b border-white/20 sticky top-0 z-[1200] shadow-lg">
                {showHomeLocationActions ? (
                    <div className="lg:hidden border-b border-gray-100 bg-white" data-testid="header-mobile-home-location">
                        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-end gap-2">
                            <button onClick={onOpenCommandPalette} className="p-2 rounded-full" aria-label={t('common.search')}>
                                <svg className="h-6 w-6 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </button>
                            <button onClick={() => handleNavigate(ViewEnum.WISHLIST)} className="relative p-2 rounded-full" aria-label={t('nav.myWishlist')}>
                                <svg className="h-6 w-6 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
                                </svg>
                                {wishlistCount > 0 && (
                                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-orange-500" aria-hidden />
                                )}
                            </button>
                            <button onClick={() => handleNavigate(ViewEnum.COMPARISON)} className="relative p-2 rounded-full" aria-label={t('nav.compare')}>
                                <svg className="h-6 w-6 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                                {compareCount > 0 && (
                                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500" aria-hidden />
                                )}
                            </button>
                            {!currentUser && !serviceProvider ? (
                                <button
                                    onClick={() => handleNavigate(ViewEnum.LOGIN_PORTAL)}
                                    className="reride-button-primary text-sm px-4 py-2"
                                >
                                    {t('nav.login')}
                                </button>
                            ) : null}
                        </div>
                    </div>
                ) : null}

                {/* Premium Main Navigation */}
                <div className="bg-white/90 backdrop-blur-sm">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center h-16 gap-2 lg:gap-3">
                            {/* Logo + location */}
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
                                <Logo 
                                    onClick={() => handleNavigate(ViewEnum.HOME)}
                                    className="cursor-pointer hover:scale-105 transition-transform duration-300 shrink-0"
                                    size="md"
                                    showText
                                />
                                {renderHeaderLocationPicker()}
                            </div>

                            {/* Premium Navigation — flows after logo; right actions use ml-auto */}
                            <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1 shrink-0">
                                <CityDropdown 
                                    allVehicles={allVehicles}
                                    onCitySelect={(city) => {
                                        // Navigate to used cars with city filter
                                        if (process.env.NODE_ENV === 'development') {
                                            logInfo('ðŸ”µ Header: City selected from dropdown:', city);
                                        }
                                        // Ensure city is passed correctly
                                        onNavigate(ViewEnum.USED_CARS, { city: city || '' });
                                    }}
                                    onViewAllCars={() => {
                                        if (process.env.NODE_ENV === 'development') {
                                            logInfo('ðŸ”µ Header: View all cars clicked - clearing city filter');
                                        }
                                        // Explicitly pass empty city to clear filter
                                        onNavigate(ViewEnum.USED_CARS, { city: '' });
                                    }}
                                />
                                <SellerDropdown 
                                    allVehicles={allVehicles}
                                    onCitySelect={(city) => {
                                        // Navigate to sell car page with city context
                                        onNavigate(ViewEnum.SELL_CAR);
                                        // You can add city-specific seller logic here
                                    }}
                                    onSellOnline={() => onNavigate(ViewEnum.SELL_CAR)}
                                    onSellScrapCar={() => {
                                        // Navigate to sell car page
                                        onNavigate(ViewEnum.SELL_CAR);
                                        // You can add scrap car specific logic here
                                    }}
                                />
                                <button 
                                    type="button"
                                    onClick={() => handleNavigate(ViewEnum.ABOUT_US)} 
                                    className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-xl px-3 xl:px-4 font-semibold text-gray-700 hover:bg-gradient-to-r hover:bg-orange-50 hover:text-reride-orange transition-all duration-300 hover:-translate-y-0.5 text-[14px] xl:text-[15px]"
                                >
                                    {t('nav.howDealsWork')}
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => handleNavigate(ViewEnum.DEALER_PROFILES)} 
                                    className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-xl px-3 xl:px-4 font-semibold text-gray-700 hover:bg-gradient-to-r hover:bg-orange-50 hover:text-reride-orange transition-all duration-300 hover:-translate-y-0.5 text-[14px] xl:text-[15px]"
                                >
                                    {t('nav.dealers')}
                                </button>
                                <div
                                    className="relative"
                                    ref={moreMenuRef}
                                    onMouseEnter={isMdUp ? () => setIsMoreMenuOpen(true) : undefined}
                                    onMouseLeave={isMdUp ? () => setIsMoreMenuOpen(false) : undefined}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setIsMoreMenuOpen((p) => !p)}
                                        className="inline-flex h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-4 font-semibold text-gray-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-gradient-to-r hover:bg-orange-50 hover:text-reride-orange text-[15px]"
                                        aria-expanded={isMoreMenuOpen}
                                        aria-haspopup="menu"
                                    >
                                        {t('nav.more')}
                                        <svg
                                            className={`h-4 w-4 transition-transform duration-200 ${isMoreMenuOpen ? 'rotate-180' : ''}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                            aria-hidden
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    {isMoreMenuOpen && (
                                        <div className="absolute left-0 top-full z-20 pt-1">
                                            <div
                                                className="min-w-[200px] rounded-lg border border-gray-100 bg-white py-1 shadow-lg dark:border-gray-200"
                                                role="menu"
                                            >
                                            <button
                                                type="button"
                                                role="menuitem"
                                                onClick={() => handleNavigate(ViewEnum.CAR_SERVICES)}
                                                className="block w-full px-4 py-2.5 text-left text-[15px] font-semibold text-gray-700 hover:bg-gradient-to-r hover:bg-orange-50 hover:text-reride-orange"
                                            >
                                                {t('nav.carServices')}
                                            </button>
                                            {HELP_NAV_ITEMS.map((item) => (
                                                <button
                                                    key={item.view}
                                                    type="button"
                                                    role="menuitem"
                                                    onClick={() => handleNavigate(item.view)}
                                                    className="block w-full px-4 py-2.5 text-left text-[15px] font-semibold text-gray-700 hover:bg-gradient-to-r hover:bg-orange-50 hover:text-reride-orange"
                                                >
                                                    {t(item.labelKey, { defaultValue: item.defaultLabel })}
                                                </button>
                                            ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </nav>

                            {/* Right Side Actions */}
                            <div className="hidden lg:flex items-center gap-2 xl:gap-3 shrink-0 ml-auto">
                                <LanguageSwitcher />
                                <button onClick={onOpenCommandPalette} className="p-2 hover:bg-white rounded-full transition-colors" aria-label={t('common.search')}>
                                    <svg className="h-6 w-6 text-reride-text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </button>
                                
                                <button onClick={() => handleNavigate(ViewEnum.WISHLIST)} className="relative p-2 rounded-full transition-colors" style={{ backgroundColor: 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(30, 136, 229, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} aria-label={t('nav.myWishlist')}>
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#1A1A1A' }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
                                    </svg>
                                    {wishlistCount > 0 && (
                                        <span className="absolute -top-1 -right-1 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center" style={{ backgroundColor: '#FF6B35' }}>
                                            {wishlistCount}
                                        </span>
                                    )}
                                </button>

                                <button onClick={() => handleNavigate(ViewEnum.COMPARISON)} className="relative p-2 rounded-full transition-colors" style={{ backgroundColor: 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(30, 136, 229, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} aria-label={t('nav.compare')}>
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#1A1A1A' }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                    {compareCount > 0 && (
                                        <span className="absolute -top-1 -right-1 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center" style={{ backgroundColor: '#1E88E5' }}>
                                            {compareCount}
                                        </span>
                                    )}
                                </button>

                                {currentUser && (
                                    <div className="relative" ref={notificationsRef}>
                                        <button type="button" onClick={() => setIsNotificationsOpen(p => !p)} className="relative p-2 rounded-full transition-colors" style={{ backgroundColor: 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(30, 136, 229, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'} aria-label={t('notifications.title', { defaultValue: 'Notifications' })} title={t('notifications.title', { defaultValue: 'Notifications' })}>
                                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#1A1A1A' }} aria-hidden>
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                            </svg>
                                            {unreadNotifications.length > 0 && (
                                                <span className="absolute -top-1 -right-1 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center" style={{ backgroundColor: '#FF6B35' }}>
                                                    {unreadNotifications.length}
                                                </span>
                                            )}
                                        </button>
                                        {isNotificationsOpen && (
                                            <NotificationCenter 
                                                notifications={notifications}
                                                onNotificationClick={handleNotificationItemClick}
                                                onMarkAllAsRead={onMarkAllNotificationsAsRead}
                                                onViewAll={handleViewAllNotifications}
                                            />
                                        )}
                                    </div>
                                )}

                                {currentUser ? (
                                    <div className="relative" ref={userMenuRef}>
                                        <button onClick={() => setIsUserMenuOpen(p => !p)} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg transition-colors">
                                            <img 
                                                src={currentUser.avatarUrl || `https://i.pravatar.cc/40?u=${currentUser.email}`} 
                                                alt="User" 
                                                className="h-8 w-8 rounded-full"
                                            />
                                        </button>
                                        {isUserMenuOpen && (
                                            <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-md shadow-lg border dark:border-gray-200 animate-fade-in z-20">
                                                <div className="p-4 border-b dark:border-gray-200">
                                                    <p className="font-semibold text-sm text-reride-text-dark dark:text-white">
                                                        {t('user.greeting', { name: currentUser.name ? currentUser.name.split(' ')[0] : '' })}
                                                    </p>
                                                </div>
                                                {currentUser.role === 'customer' && <DropdownLink onClick={() => handleNavigate(ViewEnum.BUYER_DASHBOARD)}>{t('nav.myDashboard')}</DropdownLink>}
                                                {currentUser.role === 'customer' && <DropdownLink onClick={onOpenMessages}>{t('nav.inbox')} {inboxCount > 0 && `(${inboxCount})`}</DropdownLink>}
                                                {currentUser.role === 'seller' && <DropdownLink onClick={() => handleNavigate(ViewEnum.SELLER_DASHBOARD)}>{t('nav.dashboard')}</DropdownLink>}
                                                {currentUser.role === 'seller' && <DropdownLink onClick={onOpenMessages}>{t('nav.messages')} {inboxCount > 0 && `(${inboxCount})`}</DropdownLink>}
                                                {currentUser.role === 'admin' && <DropdownLink onClick={() => handleNavigate(ViewEnum.ADMIN_PANEL)}>{t('nav.adminPanel')}</DropdownLink>}
                                                <DropdownLink onClick={() => handleNavigate(ViewEnum.PROFILE)}>{t('nav.myProfile')}</DropdownLink>
                                                <div className="border-t dark:border-gray-200">
                                                    <DropdownLink onClick={onLogout}>{t('nav.logout')}</DropdownLink>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : serviceProvider ? (
                                    <div className="relative" ref={serviceProviderMenuRef}>
                                        <button 
                                            onClick={() => setIsServiceProviderMenuOpen(p => !p)} 
                                            className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all"
                                        >
                                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                                <span className="text-white text-sm font-bold">
                                                    {serviceProvider.name ? serviceProvider.name.charAt(0).toUpperCase() : 'P'}
                                                </span>
                                            </div>
                                            <div className="text-left leading-tight">
                                                <p className="text-sm font-semibold text-gray-900">{serviceProvider.name || t('role.serviceProvider')}</p>
                                                <p className="text-xs text-gray-500">{serviceProvider.email || ''}</p>
                                            </div>
                                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                        {isServiceProviderMenuOpen && (
                                            <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 animate-fade-in z-20">
                                                <div className="p-4 border-b border-gray-200">
                                                    <p className="font-semibold text-sm text-gray-900 mb-1">
                                                        {serviceProvider.name || t('role.serviceProvider')}
                                                    </p>
                                                    <p className="text-xs text-gray-600 mb-2">{serviceProvider.email || ''}</p>
                                                    {serviceProvider.city && (
                                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                            {serviceProvider.city}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="py-1">
                                                    <button 
                                                        onClick={() => {
                                                            handleNavigate(ViewEnum.CAR_SERVICE_DASHBOARD);
                                                            setIsServiceProviderMenuOpen(false);
                                                        }}
                                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                        </svg>
                                                        {t('nav.dashboard')}
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            // Store the desired tab in sessionStorage
                                                            sessionStorage.setItem('serviceProviderActiveTab', 'profile');
                                                            // Dispatch custom event for immediate tab switch if already on dashboard
                                                            window.dispatchEvent(new CustomEvent('serviceProviderTabChange', { detail: { tab: 'profile' } }));
                                                            handleNavigate(ViewEnum.CAR_SERVICE_DASHBOARD);
                                                            setIsServiceProviderMenuOpen(false);
                                                        }}
                                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                        </svg>
                                                        {t('nav.profile')}
                                                    </button>
                                                </div>
                                                <div className="border-t border-gray-200">
                                                    <button 
                                                        onClick={() => {
                                                            onLogout();
                                                            setIsServiceProviderMenuOpen(false);
                                                        }}
                                                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                        </svg>
                                                        {t('nav.logout')}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => handleNavigate(ViewEnum.LOGIN_PORTAL)} 
                                        className="reride-button-primary text-sm"
                                    >
                                        {t('nav.login')}
                                    </button>
                                )}
                            </div>

                            {/* Mobile Menu Button */}
                            <div className="lg:hidden ml-auto shrink-0">
                                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-reride-text-dark" aria-label={t('nav.menu', { defaultValue: 'Menu' })} aria-expanded={isMobileMenuOpen}>
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>


                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div ref={mobileMenuRef} className="lg:hidden absolute top-full left-0 w-full bg-white shadow-lg animate-fade-in z-40 max-h-[min(70vh,32rem)] overflow-y-auto overscroll-contain">
                        <nav className="p-4 space-y-1">
                            <LanguageSwitcher variant="inline" onSelect={() => setIsMobileMenuOpen(false)} className="!px-0 !py-2 border-b border-gray-100 mb-2" />
                            <button onClick={() => handleNavigate(ViewEnum.USED_CARS)} className="block w-full text-left font-semibold text-reride-text-dark py-3 px-4 min-h-[44px] rounded-lg hover:bg-white">{t('nav.buyCar')}</button>
                            <button onClick={() => handleNavigate(ViewEnum.SELLER_LOGIN)} className="block w-full text-left font-semibold text-reride-text-dark py-3 px-4 min-h-[44px] rounded-lg hover:bg-white">{t('nav.sellCar')}</button>
                            <button onClick={() => handleNavigate(ViewEnum.ABOUT_US)} className="block w-full text-left font-semibold text-reride-text-dark py-3 px-4 min-h-[44px] rounded-lg hover:bg-white">{t('nav.howDealsWork')}</button>
                            <button onClick={() => handleNavigate(ViewEnum.CAR_SERVICES)} className="block w-full text-left font-semibold text-reride-text-dark py-3 px-4 min-h-[44px] rounded-lg hover:bg-white">{t('nav.carServices')}</button>
                            <button onClick={() => handleNavigate(ViewEnum.DEALER_PROFILES)} className="block w-full text-left font-semibold text-reride-text-dark py-3 px-4 min-h-[44px] rounded-lg hover:bg-white">{t('nav.dealers')}</button>
                            <div className="rounded-lg border border-gray-100 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setIsMobileMoreOpen((p) => !p)}
                                    className="flex w-full items-center justify-between text-left font-semibold text-reride-text-dark py-3 px-4 min-h-[44px] hover:bg-white"
                                    aria-expanded={isMobileMoreOpen}
                                >
                                    {t('nav.more')}
                                    <svg
                                        className={`h-5 w-5 shrink-0 transition-transform ${isMobileMoreOpen ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                        aria-hidden
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                {isMobileMoreOpen && (
                                    <div className="border-t border-gray-100 bg-gray-50/80">
                                        {HELP_NAV_ITEMS.map((item) => (
                                            <button
                                                key={item.view}
                                                onClick={() => handleNavigate(item.view)}
                                                className="block w-full text-left text-sm font-semibold text-reride-text-dark py-3 px-6 min-h-[44px] hover:bg-white"
                                            >
                                                {t(item.labelKey, { defaultValue: item.defaultLabel })}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <hr className="border-gray-200"/>
                            <button onClick={() => handleNavigate(ViewEnum.COMPARISON)} className="block w-full text-left font-semibold text-reride-text-dark py-3 px-4 min-h-[44px] rounded-lg hover:bg-white">{t('nav.compareCount', { count: compareCount })}</button>
                            <button onClick={() => handleNavigate(ViewEnum.WISHLIST)} className="block w-full text-left font-semibold text-reride-text-dark py-3 px-4 min-h-[44px] rounded-lg hover:bg-white">{t('nav.wishlistCount', { count: wishlistCount })}</button>
                            {(currentUser && currentUser.role === 'customer') && (
                                <>
                                    <button onClick={() => handleNavigate(ViewEnum.BUYER_DASHBOARD)} className="block w-full text-left font-semibold text-reride-text-dark py-3 px-4 min-h-[44px] rounded-lg hover:bg-white">{t('nav.myDashboard')}</button>
                                    <button type="button" onClick={() => { onOpenMessages(); setIsMobileMenuOpen(false); }} className="block w-full text-left font-semibold text-reride-text-dark py-3 px-4 min-h-[44px] rounded-lg hover:bg-white">{t('nav.inboxCount', { count: inboxCount })}</button>
                                </>
                            )}
                            <hr className="border-gray-200"/>
                            {currentUser ? (
                                <>
                                    {currentUser.role === 'seller' && <button onClick={() => handleNavigate(ViewEnum.SELLER_DASHBOARD)} className="block w-full text-left font-semibold text-reride-text-dark py-3 px-4 min-h-[44px] rounded-lg hover:bg-white">{t('nav.dashboard')}</button>}
                                    {currentUser.role === 'seller' && (
                                        <button type="button" onClick={() => { onOpenMessages(); setIsMobileMenuOpen(false); }} className="block w-full text-left font-semibold text-reride-text-dark py-3 px-4 min-h-[44px] rounded-lg hover:bg-white">
                                            {t('nav.messages')}{inboxCount > 0 ? ` (${inboxCount})` : ''}
                                        </button>
                                    )}
                                    {currentUser.role === 'admin' && <button onClick={() => handleNavigate(ViewEnum.ADMIN_PANEL)} className="block w-full text-left font-semibold text-reride-text-dark py-3 px-4 min-h-[44px] rounded-lg hover:bg-white">{t('nav.adminPanel')}</button>}
                                    <button onClick={() => handleNavigate(ViewEnum.PROFILE)} className="block w-full text-left font-semibold text-reride-text-dark py-3 px-4 min-h-[44px] rounded-lg hover:bg-white">{t('nav.myProfile')}</button>
                                    <button onClick={onLogout} className="block w-full text-left font-semibold text-reride-text-dark py-3 px-4 min-h-[44px] rounded-lg hover:bg-white">{t('nav.logout')}</button>
                                </>
                            ) : serviceProvider ? (
                                <>
                                    <div className="px-4 py-2 text-left">
                                        <p className="font-semibold text-reride-text-dark text-sm">{serviceProvider.name || t('role.serviceProvider')}</p>
                                        {serviceProvider.city && <p className="text-xs text-gray-500">{serviceProvider.city}</p>}
                                    </div>
                                    <button onClick={onLogout} className="block w-full text-left font-semibold text-reride-text-dark py-3 px-4 min-h-[44px] rounded-lg hover:bg-white">{t('nav.logout')}</button>
                                </>
                            ) : (
                                <button onClick={() => handleNavigate(ViewEnum.LOGIN_PORTAL)} className="block w-full text-left font-semibold text-reride-text-dark py-3 px-4 min-h-[44px] rounded-lg hover:bg-white">{t('nav.loginRegister')}</button>
                            )}
                        </nav>
                    </div>
                )}
            </header>

            {/* Location Modal — lazy chunk; only fetch when user opens the picker */}
            {isLocationModalOpen && (
                <Suspense fallback={null}>
                    <LocationModal
                        isOpen={isLocationModalOpen}
                        onClose={() => setIsLocationModalOpen(false)}
                        currentLocation={userLocation}
                        onLocationChange={onLocationChange}
                        addToast={addToast}
                    />
                </Suspense>
            )}
        </>
    );
});

Header.displayName = 'Header';

export default Header;
