import React, { useState, memo, useMemo } from 'react';
import useIsMobileApp from '../hooks/useIsMobileApp';
import type { Vehicle } from '../types';

interface AdvancedFiltersProps {
  vehicles: Vehicle[];
  onFilterChange: (filteredVehicles: Vehicle[]) => void;
  vehicleData?: any;
}

interface FilterState {
  priceRange: [number, number];
  mileageRange: [number, number];
  yearRange: [number, number];
  fuelTypes: string[];
  transmissions: string[];
  makes: string[];
  models: string[];
  statuses: string[];
  featuredOnly: boolean;
}

/**
 * Advanced Filters Component - Website Only Feature
 * Provides comprehensive filtering options for vehicle listings
 */
const AdvancedFilters: React.FC<AdvancedFiltersProps> = memo(({
  vehicles,
  onFilterChange,
  vehicleData
}) => {
  const { isMobileApp } = useIsMobileApp();
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    priceRange: [0, 10000000],
    mileageRange: [0, 500000],
    yearRange: [1990, new Date().getFullYear() + 1],
    fuelTypes: [],
    transmissions: [],
    makes: [],
    models: [],
    statuses: [],
    featuredOnly: false
  });

  // Don't render on mobile app
  if (isMobileApp) return null;

  // Extract unique values for filter options
  const filterOptions = useMemo(() => {
    const makes = new Set<string>();
    const models = new Set<string>();
    const fuelTypes = new Set<string>();
    const transmissions = new Set<string>();
    const statuses = new Set<string>();

    vehicles.forEach(v => {
      if (v.make) makes.add(v.make);
      if (v.model) models.add(v.model);
      if (v.fuelType) fuelTypes.add(v.fuelType);
      if (v.transmission) transmissions.add(v.transmission);
      if (v.status) statuses.add(v.status);
    });

    // Get price and mileage ranges
    const prices = vehicles.map(v => v.price || 0).filter(p => p > 0);
    const mileages = vehicles.map(v => v.mileage || 0).filter(m => m > 0);
    const years = vehicles.map(v => v.year || 0).filter(y => y > 0);

    return {
      makes: Array.from(makes).sort(),
      models: Array.from(models).sort(),
      fuelTypes: Array.from(fuelTypes).sort(),
      transmissions: Array.from(transmissions).sort(),
      statuses: Array.from(statuses).sort(),
      minPrice: prices.length > 0 ? Math.min(...prices) : 0,
      maxPrice: prices.length > 0 ? Math.max(...prices) : 10000000,
      minMileage: mileages.length > 0 ? Math.min(...mileages) : 0,
      maxMileage: mileages.length > 0 ? Math.max(...mileages) : 500000,
      minYear: years.length > 0 ? Math.min(...years) : 1990,
      maxYear: years.length > 0 ? Math.max(...years) : new Date().getFullYear() + 1
    };
  }, [vehicles]);

  // Apply filters
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(vehicle => {
      // Price filter
      if (vehicle.price !== undefined) {
        if (vehicle.price < filters.priceRange[0] || vehicle.price > filters.priceRange[1]) {
          return false;
        }
      }

      // Mileage filter
      if (vehicle.mileage !== undefined) {
        if (vehicle.mileage < filters.mileageRange[0] || vehicle.mileage > filters.mileageRange[1]) {
          return false;
        }
      }

      // Year filter
      if (vehicle.year !== undefined) {
        if (vehicle.year < filters.yearRange[0] || vehicle.year > filters.yearRange[1]) {
          return false;
        }
      }

      // Fuel type filter
      if (filters.fuelTypes.length > 0 && vehicle.fuelType) {
        if (!filters.fuelTypes.includes(vehicle.fuelType)) {
          return false;
        }
      }

      // Transmission filter
      if (filters.transmissions.length > 0 && vehicle.transmission) {
        if (!filters.transmissions.includes(vehicle.transmission)) {
          return false;
        }
      }

      // Make filter
      if (filters.makes.length > 0 && vehicle.make) {
        if (!filters.makes.includes(vehicle.make)) {
          return false;
        }
      }

      // Model filter
      if (filters.models.length > 0 && vehicle.model) {
        if (!filters.models.includes(vehicle.model)) {
          return false;
        }
      }

      // Status filter
      if (filters.statuses.length > 0 && vehicle.status) {
        if (!filters.statuses.includes(vehicle.status)) {
          return false;
        }
      }

      // Featured filter
      if (filters.featuredOnly && !vehicle.isFeatured) {
        return false;
      }

      return true;
    });
  }, [vehicles, filters]);

  // Notify parent of filtered results
  React.useEffect(() => {
    onFilterChange(filteredVehicles);
  }, [filteredVehicles, onFilterChange]);

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      priceRange: [filterOptions.minPrice, filterOptions.maxPrice],
      mileageRange: [filterOptions.minMileage, filterOptions.maxMileage],
      yearRange: [filterOptions.minYear, filterOptions.maxYear],
      fuelTypes: [],
      transmissions: [],
      makes: [],
      models: [],
      statuses: [],
      featuredOnly: false
    });
  };

  const activeFilterCount = [
    filters.fuelTypes.length,
    filters.transmissions.length,
    filters.makes.length,
    filters.models.length,
    filters.statuses.length,
    filters.featuredOnly
  ].reduce((sum, count) => sum + count, 0);

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        <span className="font-medium text-gray-700">Advanced Filters</span>
        {activeFilterCount > 0 && (
          <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
            {activeFilterCount}
          </span>
        )}
        <svg
          className={`w-4 h-4 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="mt-4 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price Range: ₹{filters.priceRange[0].toLocaleString()} - ₹{filters.priceRange[1].toLocaleString()}
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min={filterOptions.minPrice}
                  max={filterOptions.maxPrice}
                  value={filters.priceRange[0]}
                  onChange={(e) => handleFilterChange('priceRange', [parseInt(e.target.value), filters.priceRange[1]])}
                  className="w-full"
                />
                <input
                  type="range"
                  min={filterOptions.minPrice}
                  max={filterOptions.maxPrice}
                  value={filters.priceRange[1]}
                  onChange={(e) => handleFilterChange('priceRange', [filters.priceRange[0], parseInt(e.target.value)])}
                  className="w-full"
                />
              </div>
            </div>

            {/* Mileage Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mileage Range: {filters.mileageRange[0].toLocaleString()} - {filters.mileageRange[1].toLocaleString()} km
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min={filterOptions.minMileage}
                  max={filterOptions.maxMileage}
                  value={filters.mileageRange[0]}
                  onChange={(e) => handleFilterChange('mileageRange', [parseInt(e.target.value), filters.mileageRange[1]])}
                  className="w-full"
                />
                <input
                  type="range"
                  min={filterOptions.minMileage}
                  max={filterOptions.maxMileage}
                  value={filters.mileageRange[1]}
                  onChange={(e) => handleFilterChange('mileageRange', [filters.mileageRange[0], parseInt(e.target.value)])}
                  className="w-full"
                />
              </div>
            </div>

            {/* Year Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Year Range: {filters.yearRange[0]} - {filters.yearRange[1]}
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min={filterOptions.minYear}
                  max={filterOptions.maxYear}
                  value={filters.yearRange[0]}
                  onChange={(e) => handleFilterChange('yearRange', [parseInt(e.target.value), filters.yearRange[1]])}
                  className="w-full"
                />
                <input
                  type="range"
                  min={filterOptions.minYear}
                  max={filterOptions.maxYear}
                  value={filters.yearRange[1]}
                  onChange={(e) => handleFilterChange('yearRange', [filters.yearRange[0], parseInt(e.target.value)])}
                  className="w-full"
                />
              </div>
            </div>

            {/* Fuel Types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fuel Type</label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {filterOptions.fuelTypes.map(fuel => (
                  <label key={fuel} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.fuelTypes.includes(fuel)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleFilterChange('fuelTypes', [...filters.fuelTypes, fuel]);
                        } else {
                          handleFilterChange('fuelTypes', filters.fuelTypes.filter(f => f !== fuel));
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">{fuel}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Transmissions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Transmission</label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {filterOptions.transmissions.map(trans => (
                  <label key={trans} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.transmissions.includes(trans)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleFilterChange('transmissions', [...filters.transmissions, trans]);
                        } else {
                          handleFilterChange('transmissions', filters.transmissions.filter(t => t !== trans));
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">{trans}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Makes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Make</label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {filterOptions.makes.slice(0, 10).map(make => (
                  <label key={make} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.makes.includes(make)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleFilterChange('makes', [...filters.makes, make]);
                        } else {
                          handleFilterChange('makes', filters.makes.filter(m => m !== make));
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">{make}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Featured Only */}
          <div className="mt-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.featuredOnly}
                onChange={(e) => handleFilterChange('featuredOnly', e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Featured Listings Only</span>
            </label>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Showing {filteredVehicles.length} of {vehicles.length} vehicles
            </span>
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

AdvancedFilters.displayName = 'AdvancedFilters';

export default AdvancedFilters;







