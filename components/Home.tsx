import React, { useState, useEffect, useRef } from 'react';
import type { Vehicle, VehicleCategory, View } from '../types';
import { View as ViewEnum } from '../types';
import { getFirstValidImage } from '../utils/imageUtils';
import LazyImage from './LazyImage';
import QuickViewModal from './QuickViewModal';

interface HomeProps {
    onSearch: (query: string) => void;
    onSelectCategory: (category: VehicleCategory) => void;
    featuredVehicles: Vehicle[];
    onSelectVehicle: (vehicle: Vehicle) => void;
    onToggleCompare: (id: number) => void;
    comparisonList: number[];
    onToggleWishlist: (id: number) => void;
    wishlist: number[];
    onViewSellerProfile: (sellerEmail: string) => void;
    recommendations: Vehicle[];
    allVehicles: Vehicle[];
    onNavigate: (view: View) => void;
    onSelectCity: (city: string) => void;
}

const Home: React.FC<HomeProps> = ({ 
    featuredVehicles, 
    onSelectVehicle, 
    onToggleCompare,
    onToggleWishlist, 
    wishlist,
    allVehicles,
    onNavigate,
    onSelectCity,
    comparisonList
}) => {
    const [selectedLocation, setSelectedLocation] = useState('Delhi NCR');
    const [showLocationDropdown, setShowLocationDropdown] = useState(false);
    const [quickViewVehicle, setQuickViewVehicle] = useState<Vehicle | null>(null);
    const locationRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (locationRef.current && !locationRef.current.contains(event.target as Node)) {
                setShowLocationDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Calculate statistics - filter by rental listingType and published status for consistency
    const rentalVehicles = allVehicles.filter(v => v.status === 'published' && v.listingType === 'rental').length;
    const rentalProviders = new Set(allVehicles.filter(v => v.status === 'published' && v.listingType === 'rental').map(v => v.sellerEmail)).size;
    const serviceableCities = new Set(allVehicles.filter(v => v.status === 'published' && v.listingType === 'rental' && v.city).map(v => v.city)).size;

    const locations = [
        'Delhi NCR', 'Mumbai', 'Bangalore', 'Hyderabad', 'Chennai', 
        'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Surat'
    ];

    return (
        <div className="min-h-screen bg-white pb-20 overflow-x-hidden w-full max-w-full">
            {/* Top Header Bar - Droom Style */}
            <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
                <div className="flex items-center justify-between px-4 py-3">
                    {/* Logo */}
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">r</span>
                </div>
                        <span className="font-bold text-gray-900 text-lg">reRide</span>
                    </div>
                    
                    {/* Location Dropdown */}
                    <div className="relative flex-1 mx-4" ref={locationRef}>
                        <button
                            onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                            className="flex items-center gap-1 text-gray-700 font-medium text-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>{selectedLocation}</span>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        
                        {/* Dropdown Menu */}
                        {showLocationDropdown && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
                                {locations.map((location) => (
                                    <button 
                                        key={location}
                                        onClick={() => {
                                            setSelectedLocation(location);
                                            setShowLocationDropdown(false);
                                            onSelectCity(location);
                                        }}
                                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm font-medium text-gray-700"
                                    >
                                        {location}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {/* Action Icons */}
                    <div className="flex items-center gap-3">
                        <button onClick={() => onNavigate(ViewEnum.USED_CARS)} className="p-2">
                            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </button>
                        <button className="p-2">
                            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                        </button>
                        <button className="p-2">
                            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                    </svg>
                        </button>
                        <button onClick={() => onNavigate(ViewEnum.WISHLIST)} className="p-2 relative">
                            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                            {wishlist.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                                    {wishlist.length > 9 ? '9+' : wishlist.length}
                                </span>
                            )}
                        </button>
                        <button onClick={() => onNavigate(ViewEnum.LOGIN_PORTAL)} className="p-2">
                            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                        </button>
                    </div>
                </div>
                                </div>
                                
            {/* Primary Service Navigation Bar - Droom Style */}
            <div className="bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between overflow-x-auto scrollbar-hide gap-4">
                                                <button
                        onClick={() => onNavigate(ViewEnum.RENTAL)}
                        className="flex flex-col items-center gap-1.5 min-w-[60px]"
                    >
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                            </svg>
                        </div>
                        <span className="text-xs font-medium text-gray-700">Rental</span>
                    </button>

                        <button 
                            onClick={() => onNavigate(ViewEnum.USED_CARS)}
                        className="flex flex-col items-center gap-1.5 min-w-[60px]"
                    >
                        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                            </svg>
                        </div>
                        <span className="text-xs font-medium text-gray-700">Buy</span>
                        </button>

                    <button 
                        onClick={() => onNavigate(ViewEnum.SELL_CAR)}
                        className="flex flex-col items-center gap-1.5 min-w-[60px]"
                    >
                        <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        <span className="text-xs font-medium text-gray-700">Sell</span>
                    </button>

                        <button
                        onClick={() => onNavigate(ViewEnum.PRICING)}
                        className="flex flex-col items-center gap-1.5 min-w-[60px]"
                    >
                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <span className="text-xs font-medium text-gray-700">Loan</span>
                        </button>

                        <button
                        onClick={() => onNavigate(ViewEnum.PRICING)}
                        className="flex flex-col items-center gap-1.5 min-w-[60px]"
                    >
                        <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <span className="text-xs font-medium text-gray-700">Insurance</span>
                        </button>
                        
                                        <button
                        onClick={() => onNavigate(ViewEnum.USED_CARS)}
                        className="flex flex-col items-center gap-1.5 min-w-[60px]"
                    >
                        <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                        </div>
                        <span className="text-xs font-medium text-gray-700">Check Price</span>
                    </button>
                </div>
                                            </div>
                                            
            {/* Horizontal Scrolling Container */}
            <div 
                className="overflow-x-auto flex gap-4 px-4 py-6 snap-x snap-mandatory w-full" 
                style={{ 
                    scrollbarWidth: 'none', 
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch',
                    overflowY: 'hidden',
                    maxWidth: '100%'
                }}
            >
                <style>{`
                    .overflow-x-auto::-webkit-scrollbar {
                        display: none;
                    }
                `}</style>
                {/* SECTION 1: Dream Vehicle Hero Section */}
                <div className="relative bg-gradient-to-b from-gray-900 via-black to-gray-900 px-6 py-8 overflow-hidden flex-shrink-0 snap-start rounded-xl" style={{ width: 'calc(100vw - 2rem)', minWidth: 'calc(100vw - 2rem)', maxWidth: 'calc(100vw - 2rem)' }}>
                {/* Background car illustration effect */}
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md h-32">
                        <div className="w-full h-full bg-gradient-to-t from-blue-500/30 to-transparent rounded-t-full blur-3xl"></div>
                                                    </div>
                                                </div>
                                                
                <div className="relative z-10 text-center">
                    {/* Main Headline */}
                    <h1 className="text-3xl md:text-4xl font-black text-white mb-1 uppercase tracking-tight leading-tight">
                        YOUR DREAM VEHICLE
                    </h1>
                    <p className="text-lg md:text-xl text-white/90 mb-6 font-medium">
                        Is Just A Few Clicks Away
                    </p>

                    {/* Requirement Button */}
                    <button
                        onClick={() => onNavigate(ViewEnum.USED_CARS)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg mb-8 flex items-center gap-2 mx-auto transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 text-sm"
                    >
                        <span>Requirement</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>

                    {/* Features Row */}
                    <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                                </div>
                            <p className="text-xs text-white/80 font-medium">Vast Selection</p>
                                            </div>

                        <div className="flex flex-col items-center gap-1.5">
                            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm">
                                <span className="text-xl font-bold text-white">₹</span>
                            </div>
                            <p className="text-xs text-white/80 font-medium">Low Prices</p>
                        </div>
                        
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-xs text-white/80 font-medium text-center">1100+ Points Inspected</p>
                        </div>
                    </div>
                </div>
                </div>
                
                {/* SECTION 2: Vehicle History Check Section */}
                <div className="bg-gradient-to-b from-blue-600 via-blue-700 to-blue-800 px-6 py-8 text-white flex-shrink-0 snap-start rounded-xl" style={{ width: 'calc(100vw - 2rem)', minWidth: 'calc(100vw - 2rem)', maxWidth: 'calc(100vw - 2rem)' }}>
                <div className="max-w-4xl mx-auto">
                    {/* Logo/Icon */}
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-bold">Vehicle History</h2>
                    </div>
                    
                    {/* Hindi and English Text */}
                    <p className="text-center text-base md:text-lg mb-1 font-semibold">
                        Gaadi lene Se Pehle Puri Kundli Nikalo
                    </p>
                    <p className="text-center text-white/90 mb-5 font-medium text-sm">
                        Before buying a car, get its complete horoscope
                    </p>

                    <div className="text-center mb-5">
                        <button
                            onClick={() => onNavigate(ViewEnum.USED_CARS)}
                            className="bg-white text-blue-700 font-bold px-5 py-2 rounded-lg hover:bg-white/90 transition-all duration-300 shadow-lg text-sm"
                        >
                            Get History Report
                        </button>
                                            </div>
                                            
                    {/* Split Car Visualization */}
                    <div className="relative max-w-xs mx-auto mb-5">
                        <div className="grid grid-cols-2 gap-0 rounded-lg overflow-hidden">
                            {/* Left - Pristine Car */}
                            <div className="bg-blue-500 p-4 flex items-center justify-center">
                                <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
                                </svg>
                                                </div>
                                                
                            {/* Right - Damaged Car with Magnifying Glass */}
                            <div className="bg-gray-700 p-4 flex items-center justify-center relative">
                                <svg className="w-16 h-16 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
                                </svg>
                                <div className="absolute top-1 right-1">
                                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border-2 border-white/30">
                                        <span className="text-[10px] font-bold text-white">DAMAGE</span>
                                                </div>
                                            </div>
                            </div>
                        </div>
                    </div>

                    {/* History Report Preview Card */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 max-w-xs mx-auto">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-12 h-8 bg-blue-400 rounded"></div>
                            <div>
                                <p className="text-white font-semibold text-xs">History Report</p>
                                <p className="text-white/80 text-[10px]">2020 Honda City</p>
                </div>
                        </div>
                        <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                                <span className="text-white/80">Warranty</span>
                                <span className="text-white font-semibold">Valid</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/80">Insurance</span>
                                <span className="text-white font-semibold">Active</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/80">Loan</span>
                                <span className="text-white font-semibold">Cleared</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/80">Damage</span>
                                <span className="text-red-300 font-semibold">Detected</span>
                                </div>
                        </div>
                    </div>
                </div>
                    </div>
                    
                {/* SECTION 3: Rental Hero Section */}
                <div 
                    className="relative px-6 py-8 overflow-hidden flex-shrink-0 snap-start rounded-xl"
                    style={{
                        background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%)',
                        width: 'calc(100vw - 2rem)', 
                        minWidth: 'calc(100vw - 2rem)',
                        maxWidth: 'calc(100vw - 2rem)'
                    }}
                >
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full blur-2xl"></div>
                    </div>
                    
                <div className="relative z-10">
                    {/* Brand and Service */}
                    <div className="flex items-center gap-2 mb-3">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                            </svg>
                        <span className="text-white font-bold text-base">reRide Rental</span>
                    </div>

                    {/* Headline */}
                    <h1 className="text-3xl md:text-4xl font-black text-yellow-400 mb-1 leading-tight">
                        Your Perfect Ride
                    </h1>
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-6 h-0.5 bg-yellow-400"></div>
                        <p className="text-yellow-400 text-base font-semibold">— for Every Occasion —</p>
                        <div className="w-6 h-0.5 bg-yellow-400"></div>
                    </div>
                    
                    {/* Statistics */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-white mb-0.5">{rentalVehicles.toLocaleString()}+</p>
                            <p className="text-[10px] text-white/90 uppercase tracking-wide">Rental Vehicles</p>
                        </div>
                        
                        <div className="text-center">
                            <p className="text-2xl font-bold text-white mb-0.5">{rentalProviders}+</p>
                            <p className="text-[10px] text-white/90 uppercase tracking-wide">Rental Providers</p>
                        </div>
                        
                        <div className="text-center">
                            <p className="text-2xl font-bold text-white mb-0.5">{serviceableCities}+</p>
                            <p className="text-[10px] text-white/90 uppercase tracking-wide">Serviceable Cities</p>
                        </div>
                    </div>

                    {/* Vehicle Showcase Icons */}
                    <div className="flex items-center justify-center gap-3">
                        <div className="w-12 h-12 bg-yellow-400 rounded-xl flex items-center justify-center shadow-lg">
                            <svg className="w-6 h-6 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
                            </svg>
                        </div>
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl"></div>
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl"></div>
                            </div>
                                </div>
                            </div>
                        </div>
                        
            {/* Featured Vehicles Section */}
            {featuredVehicles.length > 0 && (
                <div className="px-4 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-900">Featured Vehicles</h2>
                        <button 
                            onClick={() => onNavigate(ViewEnum.USED_CARS)}
                            className="text-orange-600 font-medium text-sm"
                        >
                            View All
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {featuredVehicles.slice(0, 4).map((vehicle) => (
                            <div
                                key={vehicle.id}
                                onClick={() => onSelectVehicle(vehicle)}
                                className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 active:scale-95 transition-transform cursor-pointer"
                            >
                                <div className="relative h-32">
                                    <LazyImage
                                        src={getFirstValidImage(vehicle.images)}
                                        alt={`${vehicle.make} ${vehicle.model}`}
                                        className="w-full h-full object-cover"
                                        width={400}
                                        quality={80}
                                    />
                                    <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded-lg">
                                        <span className="text-xs font-bold text-gray-900">
                                            ₹{(vehicle.price / 100000).toFixed(2)}L
                                        </span>
                                    </div>
                                </div>
                                <div className="p-3">
                                    <h3 className="text-sm font-bold text-gray-900 mb-1 line-clamp-1">
                                        {vehicle.year} {vehicle.make} {vehicle.model}
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                        <span>{vehicle.mileage.toLocaleString()} km</span>
                                        <span>•</span>
                                        <span>{vehicle.fuelType}</span>
                                    </div>
                                    <p className="text-xs text-orange-600 font-semibold mt-1">
                                        {vehicle.city || 'N/A'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Floating Chat Button */}
            <button 
                onClick={() => onNavigate(ViewEnum.INBOX)}
                className="fixed bottom-24 right-4 w-14 h-14 bg-blue-500 rounded-full shadow-lg flex items-center justify-center z-20 hover:scale-110 transition-transform"
            >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
            </button>

            {/* Quick View Modal */}
            <QuickViewModal
                vehicle={quickViewVehicle}
                onClose={() => setQuickViewVehicle(null)}
                onSelectVehicle={onSelectVehicle}
                onToggleCompare={onToggleCompare}
                onToggleWishlist={onToggleWishlist}
                comparisonList={comparisonList}
                wishlist={wishlist}
            />
        </div>
    );
};

export default Home;
