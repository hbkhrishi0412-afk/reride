import React, { useState } from 'react';
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
    comparisonList,
    recommendations,
    onSearch
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [quickViewVehicle, setQuickViewVehicle] = useState<Vehicle | null>(null);

    const cities = [
        { name: 'Delhi NCR', abbr: 'DN', hubs: 1, cars: 0, color: 'bg-yellow-400' },
        { name: 'Hyderabad', abbr: 'HY', hubs: 1, cars: 0, color: 'bg-purple-400' },
        { name: 'Bangalore', abbr: 'BA', hubs: 2, cars: 0, color: 'bg-blue-400' },
        { name: 'Pune', abbr: 'PU', hubs: 1, cars: 0, color: 'bg-teal-400' },
        { name: 'Mumbai', abbr: 'MU', hubs: 1, cars: 1, color: 'bg-pink-400' },
    ];

    const categories = [
        { name: 'Four Wheeler', icon: '🚗', hubs: 1, vehicles: 5, color: 'bg-blue-500', textColor: 'text-blue-500' },
        { name: 'Two Wheeler', icon: '🏍️', hubs: 1, vehicles: 0, color: 'bg-green-500', textColor: 'text-green-500' },
        { name: 'Three Wheeler', icon: '🛺', hubs: 2, vehicles: 0, color: 'bg-orange-500', textColor: 'text-orange-500' },
        { name: 'Commercial', icon: '🚚', hubs: 1, vehicles: 0, color: 'bg-purple-500', textColor: 'text-purple-500' },
        { name: 'Farm', icon: '🚜', hubs: 1, vehicles: 0, color: 'bg-yellow-500', textColor: 'text-yellow-500' },
    ];

    const handleSearch = () => {
        if (searchQuery.trim()) {
            onSearch(searchQuery);
            onNavigate(ViewEnum.USED_CARS);
        }
    };

    return (
        <div className="min-h-screen bg-white overflow-x-hidden w-full">
            {/* Hero Section with Search - Exact Design Match */}
            <div 
                className="relative py-20 md:py-28 px-4 overflow-hidden"
                style={{
                    background: 'linear-gradient(180deg, #6A2D9D 0%, #D24B9F 100%)',
                    fontFamily: "'Poppins', sans-serif"
                }}
            >
                {/* Subtle Background Shapes */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
                </div>

                <div className="relative max-w-5xl mx-auto text-center">
                    {/* Trust Badge - Exact Match */}
                    <div 
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-8 shadow-lg"
                        style={{
                            background: 'rgba(159, 122, 234, 0.3)',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)'
                        }}
                    >
                        <div 
                            className="w-3 h-3 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: '#6DD278' }}
                        >
                            <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                        </div>
                        <span 
                            className="text-white font-medium"
                            style={{ fontSize: '14px', fontFamily: "'Poppins', sans-serif" }}
                        >
                            Trusted by 1M+ Customers
                        </span>
                    </div>

                    {/* Main Heading - Exact Match */}
                    <h1 
                        className="text-white mb-6 leading-tight"
                        style={{
                            fontSize: 'clamp(40px, 5vw, 48px)',
                            fontWeight: 700,
                            fontFamily: "'Poppins', sans-serif",
                            letterSpacing: '-0.02em'
                        }}
                    >
                        Premium Used Cars
                    </h1>
                    
                    {/* Subheading - Exact Match */}
                    <p 
                        className="text-white mb-12 max-w-3xl mx-auto"
                        style={{
                            fontSize: 'clamp(16px, 2vw, 18px)',
                            fontWeight: 400,
                            fontFamily: "'Poppins', sans-serif",
                            color: '#F0F0F0',
                            lineHeight: '1.6'
                        }}
                    >
                        Discover exceptional vehicles with our comprehensive quality assurance and premium service
                    </p>

                    {/* Search Bar - Exact Match */}
                    <div 
                        className="flex flex-col md:flex-row items-stretch md:items-center bg-white rounded-3xl shadow-lg mb-12 max-w-4xl mx-auto overflow-hidden"
                        style={{
                            borderRadius: '24px',
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
                        }}
                    >
                        <div className="flex-1 flex items-center gap-3 px-5 py-4">
                            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="Search by brand, model, budget or features..."
                                className="flex-1 outline-none text-gray-700 placeholder-gray-500"
                                style={{
                                    fontSize: '16px',
                                    fontWeight: 400,
                                    fontFamily: "'Poppins', sans-serif",
                                    color: '#888888'
                                }}
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            className="text-white px-8 py-4 font-semibold flex items-center justify-center gap-2 transition-all duration-300"
                            style={{
                                background: 'linear-gradient(135deg, #5A67D8 0%, #6B5ECF 100%)',
                                borderRadius: '24px',
                                fontSize: '16px',
                                fontWeight: 600,
                                fontFamily: "'Poppins', sans-serif"
                            }}
                        >
                            Search
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    {/* Feature Cards - Exact Match */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-5xl mx-auto">
                        {/* Card 1: 200+ Quality Checks */}
                        <div 
                            className="rounded-3xl p-6 shadow-lg"
                            style={{
                                background: 'rgba(159, 122, 234, 0.3)',
                                backdropFilter: 'blur(10px)',
                                WebkitBackdropFilter: 'blur(10px)',
                                borderRadius: '24px',
                                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
                            }}
                        >
                            <div 
                                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 mx-auto"
                                style={{ 
                                    background: '#4CAF50',
                                    borderRadius: '16px'
                                }}
                            >
                                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <h3 
                                className="text-white mb-2 text-center"
                                style={{
                                    fontSize: '16px',
                                    fontWeight: 600,
                                    fontFamily: "'Poppins', sans-serif"
                                }}
                            >
                                200+ Quality Checks
                            </h3>
                            <p 
                                className="text-center"
                                style={{
                                    fontSize: '13px',
                                    fontWeight: 400,
                                    fontFamily: "'Poppins', sans-serif",
                                    color: '#E0E0E0'
                                }}
                            >
                                Comprehensive inspection
                            </p>
                        </div>

                        {/* Card 2: Fixed Price */}
                        <div 
                            className="rounded-3xl p-6 shadow-lg"
                            style={{
                                background: 'rgba(159, 122, 234, 0.3)',
                                backdropFilter: 'blur(10px)',
                                WebkitBackdropFilter: 'blur(10px)',
                                borderRadius: '24px',
                                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
                            }}
                        >
                            <div 
                                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 mx-auto"
                                style={{ 
                                    background: '#42A5F5',
                                    borderRadius: '16px'
                                }}
                            >
                                <span 
                                    className="text-white"
                                    style={{
                                        fontSize: '24px',
                                        fontWeight: 700,
                                        fontFamily: "'Poppins', sans-serif"
                                    }}
                                >
                                    ₹
                                </span>
                            </div>
                            <h3 
                                className="text-white mb-2 text-center"
                                style={{
                                    fontSize: '16px',
                                    fontWeight: 600,
                                    fontFamily: "'Poppins', sans-serif"
                                }}
                            >
                                Fixed Price
                            </h3>
                            <p 
                                className="text-center"
                                style={{
                                    fontSize: '13px',
                                    fontWeight: 400,
                                    fontFamily: "'Poppins', sans-serif",
                                    color: '#E0E0E0'
                                }}
                            >
                                No hidden costs
                            </p>
                        </div>

                        {/* Card 3: 5-Day Money Back */}
                        <div 
                            className="rounded-3xl p-6 shadow-lg"
                            style={{
                                background: 'rgba(159, 122, 234, 0.3)',
                                backdropFilter: 'blur(10px)',
                                WebkitBackdropFilter: 'blur(10px)',
                                borderRadius: '24px',
                                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
                            }}
                        >
                            <div 
                                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 mx-auto"
                                style={{ 
                                    background: '#FF7043',
                                    borderRadius: '16px'
                                }}
                            >
                                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </div>
                            <h3 
                                className="text-white mb-2 text-center"
                                style={{
                                    fontSize: '16px',
                                    fontWeight: 600,
                                    fontFamily: "'Poppins', sans-serif"
                                }}
                            >
                                5-Day Money Back
                            </h3>
                            <p 
                                className="text-center"
                                style={{
                                    fontSize: '13px',
                                    fontWeight: 400,
                                    fontFamily: "'Poppins', sans-serif",
                                    color: '#E0E0E0'
                                }}
                            >
                                Risk-free purchase
                            </p>
                        </div>

                        {/* Card 4: Free RC Transfer */}
                        <div 
                            className="rounded-3xl p-6 shadow-lg"
                            style={{
                                background: 'rgba(159, 122, 234, 0.3)',
                                backdropFilter: 'blur(10px)',
                                WebkitBackdropFilter: 'blur(10px)',
                                borderRadius: '24px',
                                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
                            }}
                        >
                            <div 
                                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 mx-auto"
                                style={{ 
                                    background: '#AB47BC',
                                    borderRadius: '16px'
                                }}
                            >
                                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h3 
                                className="text-white mb-2 text-center"
                                style={{
                                    fontSize: '16px',
                                    fontWeight: 600,
                                    fontFamily: "'Poppins', sans-serif"
                                }}
                            >
                                Free RC Transfer
                            </h3>
                            <p 
                                className="text-center"
                                style={{
                                    fontSize: '13px',
                                    fontWeight: 400,
                                    fontFamily: "'Poppins', sans-serif",
                                    color: '#E0E0E0'
                                }}
                            >
                                Complete documentation
                            </p>
                        </div>
                    </div>

                    {/* Scroll Indicator */}
                    <div 
                        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-1 h-8 rounded-full opacity-50"
                        style={{
                            background: 'rgba(255, 255, 255, 0.5)',
                            borderRadius: '12px'
                        }}
                    ></div>
                </div>
            </div>

            {/* Featured Collection Section - Premium Style */}
            {featuredVehicles.length > 0 && (
                <div className="py-16 md:py-20 px-4 bg-gradient-to-b from-white to-gray-50">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-12">
                            <button className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 via-orange-500 to-pink-500 text-white px-6 py-2.5 rounded-full mb-6 font-black text-xs uppercase tracking-wider shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                FEATURED COLLECTION
                            </button>
                            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight">Premium Vehicles</h2>
                            <p className="text-gray-600 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">Handpicked vehicles that meet our highest standards of quality and performance</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                            {featuredVehicles.slice(0, 4).map((vehicle) => (
                                <div
                                    key={vehicle.id}
                                    onClick={() => onSelectVehicle(vehicle)}
                                    className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 hover:shadow-2xl transition-all duration-300 cursor-pointer group hover:-translate-y-2"
                                >
                                    <div className="relative h-56 overflow-hidden">
                                        <LazyImage
                                            src={getFirstValidImage(vehicle.images)}
                                            alt={`${vehicle.make} ${vehicle.model}`}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            width={400}
                                            quality={85}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                        <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-black shadow-lg">
                                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                            </svg>
                                            Verified
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleWishlist(vehicle.id);
                                            }}
                                            className="absolute top-4 right-4 w-10 h-10 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-all duration-300 shadow-lg hover:scale-110"
                                        >
                                            <svg 
                                                className={`w-5 h-5 transition-all ${wishlist.includes(vehicle.id) ? 'fill-red-500 text-red-500' : 'text-gray-600'}`}
                                                fill={wishlist.includes(vehicle.id) ? 'currentColor' : 'none'}
                                                stroke="currentColor" 
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                            </svg>
                                        </button>
                                        <div className="absolute bottom-4 right-4 bg-gray-900/90 backdrop-blur-sm text-white px-4 py-2 rounded-xl shadow-lg">
                                            <span className="font-black text-base">₹{(vehicle.price / 100000).toFixed(2)}L</span>
                                        </div>
                                    </div>
                                    <div className="p-5">
                                        <h3 className="font-black text-gray-900 mb-3 text-lg leading-tight">
                                            {vehicle.year} {vehicle.make} {vehicle.model}
                                        </h3>
                                        <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
                                            <span className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {vehicle.mileage.toLocaleString()}
                                            </span>
                                            <span>•</span>
                                            <span>{vehicle.fuelType}</span>
                                            <span>•</span>
                                            <span>{vehicle.transmission || 'Manual'}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-blue-600">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            <span className="text-sm font-bold">{vehicle.city || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Explore by Location Section - Premium Style */}
            <div className="py-16 md:py-20 px-4 bg-gradient-to-b from-gray-50 to-white">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-12">
                        <button className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-full mb-6 font-black text-xs uppercase tracking-wider shadow-lg">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            EXPLORE BY LOCATION
                        </button>
                        <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight">Find Cars Near You</h2>
                        <p className="text-gray-600 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">Discover premium vehicles available in your city with local sellers and dealers</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6 mb-8">
                        {cities.map((city, index) => (
                            <div
                                key={index}
                                onClick={() => {
                                    onSelectCity(city.name);
                                    onNavigate(ViewEnum.USED_CARS);
                                }}
                                className={`${city.color} rounded-2xl p-6 cursor-pointer hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-2xl group`}
                            >
                                <h3 className="text-white font-black mb-4 text-base">{city.name}</h3>
                                <div className="bg-white rounded-xl w-18 h-18 flex items-center justify-center mb-4 mx-auto shadow-xl group-hover:scale-110 transition-transform duration-300">
                                    <span className="text-gray-900 font-black text-2xl">{city.abbr}</span>
                                </div>
                                <div className="text-center text-white/95">
                                    <p className="text-sm mb-1 font-medium">{city.hubs} hubs</p>
                                    <p className="font-black text-base">{city.cars}+ cars</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="text-center">
                        <button 
                            onClick={() => onNavigate(ViewEnum.USED_CARS)}
                            className="border-2 border-purple-600 text-purple-600 px-8 py-3 rounded-xl font-bold hover:bg-purple-50 transition-all duration-300 hover:scale-105 hover:shadow-lg"
                        >
                            View all locations
                        </button>
                    </div>
                </div>
            </div>

            {/* Vehicle Categories Section - Premium Style */}
            <div className="py-16 md:py-20 px-4 bg-white">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-12">
                        <button className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white px-6 py-2.5 rounded-full mb-6 font-black text-xs uppercase tracking-wider shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                            VEHICLE CATEGORIES
                        </button>
                        <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight">Browse by Category</h2>
                        <p className="text-gray-600 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">Find the perfect vehicle type that matches your needs and lifestyle</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
                        {categories.map((category, index) => (
                            <div
                                key={index}
                                onClick={() => onNavigate(ViewEnum.USED_CARS)}
                                className={`${category.color} rounded-2xl p-6 cursor-pointer hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-2xl group`}
                            >
                                <h3 className="text-white font-black mb-4 text-base">{category.name}</h3>
                                <div className="bg-white rounded-xl w-18 h-18 flex items-center justify-center mb-4 mx-auto shadow-xl group-hover:scale-110 transition-transform duration-300">
                                    <span className="text-3xl">{category.icon}</span>
                                </div>
                                <div className="text-center text-white/95">
                                    <p className="text-sm mb-1 font-medium">{category.hubs} hubs</p>
                                    <p className="font-black text-base">{category.vehicles}+ vehicles</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recommended For You Section - Premium Style */}
            {recommendations.length > 0 && (
                <div className="py-16 md:py-20 px-4 bg-gradient-to-b from-white to-gray-50">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-12">
                            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight">Recommended For You</h2>
                            <p className="text-gray-600 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">Handpicked vehicles based on your preferences and market trends</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                            {recommendations.slice(0, 8).map((vehicle) => (
                                <div
                                    key={vehicle.id}
                                    onClick={() => onSelectVehicle(vehicle)}
                                    className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 hover:shadow-2xl transition-all duration-300 cursor-pointer group hover:-translate-y-2"
                                >
                                    <div className="relative h-56 overflow-hidden">
                                        <LazyImage
                                            src={getFirstValidImage(vehicle.images)}
                                            alt={`${vehicle.make} ${vehicle.model}`}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            width={400}
                                            quality={85}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                        <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-black shadow-lg">
                                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                            </svg>
                                            Verified!
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleWishlist(vehicle.id);
                                            }}
                                            className="absolute top-4 right-4 w-10 h-10 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-all duration-300 shadow-lg hover:scale-110"
                                        >
                                            <svg 
                                                className={`w-5 h-5 transition-all ${wishlist.includes(vehicle.id) ? 'fill-red-500 text-red-500' : 'text-gray-600'}`}
                                                fill={wishlist.includes(vehicle.id) ? 'currentColor' : 'none'}
                                                stroke="currentColor" 
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                            </svg>
                                        </button>
                                        <div className="absolute bottom-4 right-4 bg-gray-900/90 backdrop-blur-sm text-white px-4 py-2 rounded-xl shadow-lg">
                                            <span className="font-black text-base">₹{(vehicle.price / 100000).toFixed(2)}L</span>
                                        </div>
                                    </div>
                                    <div className="p-5">
                                        <h3 className="font-black text-gray-900 mb-3 text-lg leading-tight">
                                            {vehicle.year} {vehicle.make} {vehicle.model}
                                        </h3>
                                        <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
                                            <span className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {vehicle.mileage.toLocaleString()}
                                            </span>
                                            <span>•</span>
                                            <span>{vehicle.fuelType}</span>
                                            <span>•</span>
                                            <span>{vehicle.transmission || 'Manual'}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-gray-600">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            <span className="text-sm font-semibold">{vehicle.city || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Trending Now / Popular Vehicles - Premium Style */}
            {featuredVehicles.length > 4 && (
                <div className="py-16 md:py-20 px-4 bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-50">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-12">
                            <button className="inline-flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-full mb-6 font-black text-xs uppercase tracking-wider shadow-lg">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                </svg>
                                TRENDING NOW
                            </button>
                            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight">Popular Vehicles</h2>
                            <p className="text-gray-600 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-8">Discover what other buyers are choosing - trending vehicles with great value</p>
                            <button 
                                onClick={() => onNavigate(ViewEnum.USED_CARS)}
                                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl font-bold text-base md:text-lg flex items-center gap-2 mx-auto transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
                            >
                                View All Vehicles
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Ready to Sell Section - Premium Style */}
            <div 
                className="relative py-20 md:py-28 px-4 text-white overflow-hidden"
                style={{
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #6366f1 100%)'
                }}
            >
                {/* Animated Background Elements */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
                </div>
                <div className="relative max-w-5xl mx-auto text-center">
                    <button className="inline-flex items-center gap-2 bg-purple-500/90 backdrop-blur-sm px-5 py-2.5 rounded-full mb-8 font-black text-xs uppercase tracking-wider shadow-lg">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        FOR SELLERS
                    </button>
                    <h2 className="text-5xl md:text-6xl font-black mb-6 leading-tight">Ready to Sell?</h2>
                    <p className="text-xl md:text-2xl text-white/90 mb-12 max-w-3xl mx-auto leading-relaxed">
                        Join thousands of successful sellers on our premium marketplace. Reach qualified buyers with our advanced AI tools and marketing features.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                        <div className="bg-white/15 backdrop-blur-xl rounded-2xl p-8 border border-white/30 hover:bg-white/20 transition-all duration-300 hover:scale-105">
                            <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-xl">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <h3 className="font-black text-xl mb-3">Wide Reach</h3>
                            <p className="text-white/90 text-base">Access millions of potential buyers</p>
                        </div>
                        <div className="bg-white/15 backdrop-blur-xl rounded-2xl p-8 border border-white/30 hover:bg-white/20 transition-all duration-300 hover:scale-105">
                            <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-xl">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <h3 className="font-black text-xl mb-3">Fast Sales</h3>
                            <p className="text-white/90 text-base">Sell your vehicle quickly and efficiently</p>
                        </div>
                        <div className="bg-white/15 backdrop-blur-xl rounded-2xl p-8 border border-white/30 hover:bg-white/20 transition-all duration-300 hover:scale-105">
                            <div className="w-16 h-16 bg-pink-500 rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-xl">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="font-black text-xl mb-3">Fair Pricing</h3>
                            <p className="text-white/90 text-base">Get the best value for your vehicle</p>
                        </div>
                    </div>
                </div>
            </div>

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