import React, { useState, useEffect, memo, useRef, useMemo } from 'react';
import type { User, Notification, Toast as ToastType, Vehicle } from '../types';
import { View as ViewEnum } from '../types';
import NotificationCenter from './NotificationCenter';
import LocationModal from './LocationModal';
import Logo from './Logo';
import CityDropdown from './CityDropdown';
import SellerDropdown from './SellerDropdown';

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
    onOpenCommandPalette: () => void;
    userLocation: string;
    onLocationChange: (location: string) => void;
    addToast: (message: string, type: ToastType['type']) => void;
    allVehicles: Vehicle[];
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
    onOpenCommandPalette,
    userLocation,
    onLocationChange,
    addToast,
    allVehicles
}) => {
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isServiceProviderMenuOpen, setIsServiceProviderMenuOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const notificationsRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const serviceProviderMenuRef = useRef<HTMLDivElement>(null);
    const mobileMenuRef = useRef<HTMLDivElement>(null);

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
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNavigate = (view: ViewEnum) => {
        onNavigate(view);
        setIsMobileMenuOpen(false);
        setIsNotificationsOpen(false);
        setIsUserMenuOpen(false);
        setIsServiceProviderMenuOpen(false);
    };

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
            <header className="bg-white/80 backdrop-blur-xl border-b border-white/20 sticky top-0 z-50 shadow-lg">
                {/* Premium Top Bar */}
                <div className="bg-gradient-to-r from-blue-50/50 to-purple-50/50 border-b border-gray-100/50">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center py-1.5">
                        <div className="flex items-center gap-6">
                            <span className="flex items-center gap-2">
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" style={{ color: '#1E88E5' }}>
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                                </svg>
                                <span className="font-medium text-sm">Trusted by 50,000+ Happy Customers</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <a 
                                href="tel:+917277277275" 
                                className="flex items-center gap-1.5 font-semibold text-blue-600 hover:text-blue-700 transition-colors text-sm"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                <span>Call us at 727-727-7275</span>
                            </a>
                            <button 
                                type="button"
                                onClick={() => setIsLocationModalOpen(true)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setIsLocationModalOpen(true);
                                    }
                                }}
                                className="flex items-center gap-1.5 transition-colors font-medium text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300 rounded-md" 
                                style={{ color: '#1E88E5' }}
                                aria-label="Choose location"
                                title="Choose location"
                            >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {userLocation || 'Select location'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Premium Main Navigation */}
                <div className="bg-white/90 backdrop-blur-sm">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center h-16">
                            {/* Premium Logo */}
                            <Logo 
                                onClick={() => handleNavigate(ViewEnum.HOME)}
                                className="cursor-pointer hover:scale-105 transition-transform duration-300"
                                showText={false}
                            />

                            {/* Premium Navigation */}
                            <nav className="hidden md:flex items-center gap-1">
                                <CityDropdown 
                                    allVehicles={allVehicles}
                                    onCitySelect={(city) => {
                                        // Navigate to used cars with city filter
                                        if (process.env.NODE_ENV === 'development') {
                                            console.log('🔵 Header: City selected from dropdown:', city);
                                        }
                                        // Ensure city is passed correctly
                                        onNavigate(ViewEnum.USED_CARS, { city: city || '' });
                                    }}
                                    onViewAllCars={() => {
                                        if (process.env.NODE_ENV === 'development') {
                                            console.log('🔵 Header: View all cars clicked - clearing city filter');
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
                                    onClick={() => handleNavigate(ViewEnum.NEW_CARS)} 
                                    className="px-4 py-2 rounded-xl font-semibold text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:text-blue-600 transition-all duration-300 hover:-translate-y-0.5 text-[15px]"
                                >
                                    New Cars
                                </button>
                                <button 
                                    onClick={() => handleNavigate(ViewEnum.CAR_SERVICES)} 
                                    className="px-4 py-2 rounded-xl font-semibold text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:text-blue-600 transition-all duration-300 hover:-translate-y-0.5 text-[15px]"
                                >
                                    Car Services
                                </button>
                                <button 
                                    onClick={() => handleNavigate(ViewEnum.DEALER_PROFILES)} 
                                    className="px-4 py-2 rounded-xl font-semibold text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:text-blue-600 transition-all duration-300 hover:-translate-y-0.5 text-[15px]"
                                >
                                    Dealers
                                </button>
                                <button 
                                    onClick={() => handleNavigate(ViewEnum.SUPPORT)} 
                                    className="px-4 py-2 rounded-xl font-semibold text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:text-blue-600 transition-all duration-300 hover:-translate-y-0.5 text-[15px]"
                                >
                                    Support
                                </button>
                            </nav>

                            {/* Right Side Actions */}
                            <div className="hidden md:flex items-center gap-3">
                                <button onClick={onOpenCommandPalette} className="p-2 hover:bg-white rounded-full transition-colors">
                                    <svg className="h-6 w-6 text-reride-text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </button>
                                
                                <button onClick={() => handleNavigate(ViewEnum.WISHLIST)} className="relative p-2 rounded-full transition-colors" style={{ backgroundColor: 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(30, 136, 229, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#1A1A1A' }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
                                    </svg>
                                    {wishlistCount > 0 && (
                                        <span className="absolute -top-1 -right-1 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center" style={{ backgroundColor: '#FF6B35' }}>
                                            {wishlistCount}
                                        </span>
                                    )}
                                </button>

                                <button onClick={() => handleNavigate(ViewEnum.COMPARISON)} className="relative p-2 rounded-full transition-colors" style={{ backgroundColor: 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(30, 136, 229, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
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
                                        <button onClick={() => setIsNotificationsOpen(p => !p)} className="relative p-2 rounded-full transition-colors" style={{ backgroundColor: 'transparent' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(30, 136, 229, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#1A1A1A' }}>
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
                                            <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-md shadow-lg border dark:border-gray-200-200 animate-fade-in z-20">
                                                <div className="p-4 border-b dark:border-gray-200-200">
                                                    <p className="font-semibold text-sm text-reride-text-dark dark:text-white">
                                                        Hi, {currentUser.name ? currentUser.name.split(' ')[0] : ''}
                                                    </p>
                                                </div>
                                                {currentUser.role === 'customer' && <DropdownLink onClick={() => handleNavigate(ViewEnum.BUYER_DASHBOARD)}>My Dashboard</DropdownLink>}
                                                {currentUser.role === 'customer' && <DropdownLink onClick={() => handleNavigate(ViewEnum.INBOX)}>Inbox {inboxCount > 0 && `(${inboxCount})`}</DropdownLink>}
                                                {currentUser.role === 'seller' && <DropdownLink onClick={() => handleNavigate(ViewEnum.SELLER_DASHBOARD)}>Dashboard</DropdownLink>}
                                                {currentUser.role === 'admin' && <DropdownLink onClick={() => handleNavigate(ViewEnum.ADMIN_PANEL)}>Admin Panel</DropdownLink>}
                                                <DropdownLink onClick={() => handleNavigate(ViewEnum.PROFILE)}>My Profile</DropdownLink>
                                                <div className="border-t dark:border-gray-200-200">
                                                    <DropdownLink onClick={onLogout}>Logout</DropdownLink>
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
                                                <p className="text-sm font-semibold text-gray-900">{serviceProvider.name || 'Service Provider'}</p>
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
                                                        {serviceProvider.name || 'Service Provider'}
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
                                                        Dashboard
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
                                                        Profile
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
                                                        Logout
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
                                        Login
                                    </button>
                                )}
                            </div>

                            {/* Mobile Menu Button */}
                            <div className="md:hidden">
                                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-reride-text-dark">
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
                    <div ref={mobileMenuRef} className="md:hidden absolute top-full left-0 w-full bg-white shadow-lg animate-fade-in z-40">
                        <nav className="p-4 space-y-2">
                            <button onClick={() => handleNavigate(ViewEnum.USED_CARS)} className="block w-full text-left font-semibold text-reride-text-dark py-2 px-4 rounded-lg hover:bg-white">Buy Car</button>
                            <button onClick={() => handleNavigate(ViewEnum.SELLER_LOGIN)} className="block w-full text-left font-semibold text-reride-text-dark py-2 px-4 rounded-lg hover:bg-white">Sell Car</button>
                            <button onClick={() => handleNavigate(ViewEnum.NEW_CARS)} className="block w-full text-left font-semibold text-reride-text-dark py-2 px-4 rounded-lg hover:bg-white">New Cars</button>
                            <button onClick={() => handleNavigate(ViewEnum.CAR_SERVICES)} className="block w-full text-left font-semibold text-reride-text-dark py-2 px-4 rounded-lg hover:bg-white">Car Services</button>
                            <button onClick={() => handleNavigate(ViewEnum.DEALER_PROFILES)} className="block w-full text-left font-semibold text-reride-text-dark py-2 px-4 rounded-lg hover:bg-white">Dealers</button>
                            <hr className="border-gray-200"/>
                            <button onClick={() => handleNavigate(ViewEnum.COMPARISON)} className="block w-full text-left font-semibold text-reride-text-dark py-2 px-4 rounded-lg hover:bg-white">Compare ({compareCount})</button>
                            <button onClick={() => handleNavigate(ViewEnum.WISHLIST)} className="block w-full text-left font-semibold text-reride-text-dark py-2 px-4 rounded-lg hover:bg-white">Wishlist ({wishlistCount})</button>
                            {(currentUser && currentUser.role === 'customer') && (
                                <>
                                    <button onClick={() => handleNavigate(ViewEnum.BUYER_DASHBOARD)} className="block w-full text-left font-semibold text-reride-text-dark py-2 px-4 rounded-lg hover:bg-white">My Dashboard</button>
                                    <button onClick={() => handleNavigate(ViewEnum.INBOX)} className="block w-full text-left font-semibold text-reride-text-dark py-2 px-4 rounded-lg hover:bg-white">Inbox ({inboxCount})</button>
                                </>
                            )}
                            <hr className="border-gray-200"/>
                            {currentUser ? (
                                <>
                                    {currentUser.role === 'seller' && <button onClick={() => handleNavigate(ViewEnum.SELLER_DASHBOARD)} className="block w-full text-left font-semibold text-reride-text-dark py-2 px-4 rounded-lg hover:bg-white">Dashboard</button>}
                                    {currentUser.role === 'admin' && <button onClick={() => handleNavigate(ViewEnum.ADMIN_PANEL)} className="block w-full text-left font-semibold text-reride-text-dark py-2 px-4 rounded-lg hover:bg-white">Admin Panel</button>}
                                    <button onClick={() => handleNavigate(ViewEnum.PROFILE)} className="block w-full text-left font-semibold text-reride-text-dark py-2 px-4 rounded-lg hover:bg-white">My Profile</button>
                                    <button onClick={onLogout} className="block w-full text-left font-semibold text-reride-text-dark py-2 px-4 rounded-lg hover:bg-white">Logout</button>
                                </>
                            ) : serviceProvider ? (
                                <>
                                    <div className="px-4 py-2 text-left">
                                        <p className="font-semibold text-reride-text-dark text-sm">{serviceProvider.name || 'Service Provider'}</p>
                                        {serviceProvider.city && <p className="text-xs text-gray-500">{serviceProvider.city}</p>}
                                    </div>
                                    <button onClick={onLogout} className="block w-full text-left font-semibold text-reride-text-dark py-2 px-4 rounded-lg hover:bg-white">Logout</button>
                                </>
                            ) : (
                                <button onClick={() => handleNavigate(ViewEnum.LOGIN_PORTAL)} className="block w-full text-left font-semibold text-reride-text-dark py-2 px-4 rounded-lg hover:bg-white">Login / Register</button>
                            )}
                        </nav>
                    </div>
                )}
            </header>

            {/* Location Modal */}
            <LocationModal
                isOpen={isLocationModalOpen}
                onClose={() => setIsLocationModalOpen(false)}
                currentLocation={userLocation}
                onLocationChange={onLocationChange}
                addToast={addToast}
            />
        </>
    );
});

Header.displayName = 'Header';

export default Header;
