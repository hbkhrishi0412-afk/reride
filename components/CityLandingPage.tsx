import React, { useMemo } from 'react';
import type { Vehicle } from '../types';
import { getCityStats } from '../services/locationService';
import VehicleCard from './VehicleCard';

interface CityLandingPageProps {
  city: string;
  vehicles: Vehicle[];
  onSelectVehicle: (vehicle: Vehicle) => void;
  onToggleWishlist: (id: number) => void;
  onToggleCompare: (id: number) => void;
  wishlist: number[];
  comparisonList: number[];
  onViewSellerProfile: (email: string) => void;
}

const CityLandingPage: React.FC<CityLandingPageProps> = ({
  city,
  vehicles,
  onSelectVehicle,
  onToggleWishlist,
  onToggleCompare,
  wishlist,
  comparisonList,
  onViewSellerProfile,
}) => {
  const cityStats = useMemo(() => getCityStats(vehicles, city), [vehicles, city]);
  const cityVehicles = useMemo(
    () => vehicles.filter(v => v.city === city && v.status === 'published'),
    [vehicles, city]
  );

  if (!cityStats) {
    return (
      <div className="container mx-auto py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-600">No vehicles found in {city}</h2>
        <p className="text-gray-500 mt-4">Check back later for listings in this area.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-reride-orange to-orange-600 text-white rounded-2xl p-8 mb-8 animate-fade-in">
        <h1 className="text-4xl font-bold mb-4">Used Cars in {city}</h1>
        <p className="text-xl mb-6">
          Find your perfect car from {cityStats.totalListings} quality listings
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <h3 className="text-sm font-medium mb-1">Average Price</h3>
            <p className="text-2xl font-bold">₹{(cityStats.averagePrice / 100000).toFixed(2)} L</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <h3 className="text-sm font-medium mb-1">Popular Brands</h3>
            <p className="text-lg font-semibold">{cityStats.popularMakes.slice(0, 3).join(', ')}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <h3 className="text-sm font-medium mb-1">Total Listings</h3>
            <p className="text-2xl font-bold">{cityStats.totalListings}</p>
          </div>
        </div>
      </div>

      {/* Vehicles Grid */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-reride-text-dark mb-4">
          Latest Cars in {city}
        </h2>
        <p className="text-gray-600 mb-6">
          Browse through our verified listings with quality checks and transparent pricing
        </p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {cityVehicles.map((vehicle) => (
          <VehicleCard
            key={vehicle.id}
            vehicle={vehicle}
            onSelect={onSelectVehicle}
            onToggleWishlist={onToggleWishlist}
            onToggleCompare={onToggleCompare}
            isInWishlist={wishlist.includes(vehicle.id)}
            isSelectedForCompare={comparisonList.includes(vehicle.id)}
            isCompareDisabled={!comparisonList.includes(vehicle.id) && comparisonList.length >= 4}
            onViewSellerProfile={onViewSellerProfile}
          />
        ))}
      </div>

      {/* SEO Content */}
      <div className="mt-12 prose max-w-none">
        <h2 className="text-2xl font-bold text-reride-text-dark mb-4">
          Buy Used Cars in {city}
        </h2>
        <p className="text-gray-600 mb-4">
          Looking to buy a used car in {city}? ReRide lists pre-owned vehicles from sellers and dealers
          in {city}. Browse {cityStats.totalListings} listings, compare details like RC and ownership,
          and contact sellers directly by call, chat, or WhatsApp. Always inspect the vehicle and
          verify documents before you pay.
        </p>
        <h3 className="text-xl font-semibold text-reride-text-dark mb-3">
          Popular Car Brands in {city}
        </h3>
        <p className="text-gray-600 mb-4">
          Popular brands in {city} include {cityStats.popularMakes.join(', ')}.
          Filter by budget, fuel type, and body style to find hatchbacks, sedans, SUVs, and more.
          Listing details vary by seller — check photos, RC, insurance, and owner count on each page.
        </p>
        <h3 className="text-xl font-semibold text-reride-text-dark mb-3">
          Why Buy from ReRide in {city}?
        </h3>
        <ul className="list-disc list-inside text-gray-600 space-y-2">
          <li>RC, owners, insurance, and photos on listings where provided</li>
          <li>Clear asking price — negotiate directly with the seller</li>
          <li>Call, WhatsApp, or in-app chat with sellers</li>
          <li>Compare up to four vehicles side by side</li>
          <li>Report suspicious listings to our team</li>
          <li>Inspect in person and verify documents before payment</li>
        </ul>
      </div>
    </div>
  );
};

export default CityLandingPage;

