import React, { useState, useMemo, useCallback } from 'react';
import { NEW_CARS_DATA, NewCarModel } from '../data/newCarsData';
import { getSafeImageSrc } from '../utils/imageUtils';
import { View as ViewEnum } from '../types';

interface MobileNewCarsPageProps {
  onSelectCar?: (car: NewCarModel) => void;
  onNavigate?: (view: ViewEnum) => void;
}

/**
 * Mobile-Optimized New Cars Page
 * Features:
 * - Card-based car listings
 * - Touch-friendly filters
 * - Expandable variant details
 * - Enhanced accessibility
 * - Loading states and user feedback
 * - Image error handling
 */
export const MobileNewCarsPage: React.FC<MobileNewCarsPageProps> = React.memo(({ onSelectCar, onNavigate }) => {
  const [selectedState, setSelectedState] = useState('Maharashtra');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedBodyType, setSelectedBodyType] = useState<string>('');
  const [expandedCars, setExpandedCars] = useState<Set<number>>(new Set());
  const [loadingVariantId, setLoadingVariantId] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  const formatCurrency = useCallback((value: number) => {
    if (value === Infinity || !value) return 'Price not available';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }, []);

  const filteredCars = useMemo(() => {
    let filtered = NEW_CARS_DATA;
    
    if (selectedBrand) {
      filtered = filtered.filter(car => car.brand_name === selectedBrand);
    }
    
    if (selectedBodyType) {
      filtered = filtered.filter(car => car.body_type === selectedBodyType);
    }
    
    return filtered;
  }, [selectedBrand, selectedBodyType]);

  const uniqueBrands = useMemo(() => {
    return Array.from(new Set(NEW_CARS_DATA.map(car => car.brand_name))).sort();
  }, []);

  const uniqueBodyTypes = useMemo(() => {
    return Array.from(new Set(NEW_CARS_DATA.map(car => car.body_type))).sort();
  }, []);

  const toggleCarExpansion = useCallback((carId: number) => {
    setExpandedCars(prev => {
      const newSet = new Set(prev);
      if (newSet.has(carId)) {
        newSet.delete(carId);
      } else {
        newSet.add(carId);
      }
      return newSet;
    });
  }, []);

  const handleVariantClick = useCallback((car: NewCarModel, variantIndex: number) => {
    const variantId = `${car.id}-${variantIndex}`;
    setLoadingVariantId(variantId);
    
    // Simulate loading state for better UX feedback
    setTimeout(() => {
      onSelectCar?.(car);
      setLoadingVariantId(null);
    }, 300);
  }, [onSelectCar]);

  const resetFilters = useCallback(() => {
    setSelectedBrand('');
    setSelectedBodyType('');
  }, []);

  const hasActiveFilters = useMemo(() => {
    return selectedBrand !== '' || selectedBodyType !== '';
  }, [selectedBrand, selectedBodyType]);

  const handleImageError = useCallback((carId: number) => {
    setImageErrors(prev => new Set(prev).add(carId));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          {onNavigate && (
            <button
              onClick={() => onNavigate(ViewEnum.HOME)}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors touch-manipulation"
              aria-label="Go back to home"
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              <svg 
                className="w-6 h-6 text-gray-700" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h1 className="text-xl font-bold text-gray-900 flex-1">New Cars</h1>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 sticky top-[56px] z-20">
        <div className="px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              aria-label="Select state for pricing"
            >
              <option value="Maharashtra">Maharashtra</option>
              <option value="Delhi">Delhi</option>
              <option value="Karnataka">Karnataka</option>
              <option value="Tamil Nadu">Tamil Nadu</option>
              <option value="Gujarat">Gujarat</option>
            </select>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              aria-label="Filter by brand"
            >
              <option value="">All Brands</option>
              {uniqueBrands.map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
            <select
              value={selectedBodyType}
              onChange={(e) => setSelectedBodyType(e.target.value)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              aria-label="Filter by body type"
            >
              <option value="">All Body Types</option>
              {uniqueBodyTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          {hasActiveFilters && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <button
                onClick={resetFilters}
                className="flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 font-medium transition-colors touch-manipulation"
                aria-label="Reset all filters"
                style={{ minHeight: '44px' }}
              >
                <svg 
                  className="w-4 h-4" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Car List */}
      <div className="px-4 py-4">
        {filteredCars.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="max-w-sm mx-auto">
              <svg
                className="w-24 h-24 text-gray-300 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-bold text-gray-900 mb-2">No cars found</h2>
              <p className="text-gray-600 mb-6">
                {hasActiveFilters 
                  ? "Try adjusting your filters to see more results."
                  : "There are no cars available at the moment."}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors touch-manipulation"
                  aria-label="Clear filters and show all cars"
                >
                  Clear Filters
                </button>
              )}
              {onNavigate && !hasActiveFilters && (
                <button
                  onClick={() => onNavigate(ViewEnum.HOME)}
                  className="px-6 py-3 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300 transition-colors touch-manipulation"
                  aria-label="Go back to home"
                >
                  Go to Home
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCars.map((car) => {
              const isExpanded = expandedCars.has(car.id);
              const minPrice = Math.min(...car.variants.map(v => v.on_road_prices[selectedState] || Infinity));
              
              return (
                <div
                  key={car.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                >
                  <button
                    onClick={() => toggleCarExpansion(car.id)}
                    className="w-full p-4 text-left focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-inset rounded-xl"
                    aria-expanded={isExpanded}
                    aria-controls={`car-variants-${car.id}`}
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} details for ${car.brand_name} ${car.model_name}`}
                  >
                    <div className="flex gap-4">
                      <div className="w-24 h-20 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center p-2 relative">
                        {imageErrors.has(car.id) ? (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                            <svg 
                              className="w-8 h-8 mb-1" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs">No Image</span>
                          </div>
                        ) : (
                          <img
                            src={getSafeImageSrc(car.image_url)}
                            alt={`${car.brand_name} ${car.model_name}`}
                            className="w-full h-full object-contain"
                            onError={() => handleImageError(car.id)}
                            loading="lazy"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 
                          id={`car-${car.id}-title`}
                          className="font-bold text-gray-900 mb-1"
                        >
                          {car.brand_name} {car.model_name} ({car.model_year})
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">
                          {car.body_type} • {car.fuel_options.join(', ')}
                        </p>
                        <p className="text-lg font-bold text-orange-500">
                          Starts at {formatCurrency(minPrice)}
                        </p>
                      </div>
                      <svg
                        className={`w-6 h-6 text-gray-400 transition-transform flex-shrink-0 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {isExpanded && (
                    <div 
                      id={`car-variants-${car.id}`}
                      className="px-4 pb-4 border-t border-gray-200 pt-4"
                      role="region"
                      aria-labelledby={`car-${car.id}-title`}
                    >
                      <div className="space-y-3">
                        {car.variants.map((variant, idx) => {
                          const variantId = `${car.id}-${idx}`;
                          const isLoading = loadingVariantId === variantId;
                          
                          return (
                            <button
                              key={idx}
                              onClick={() => handleVariantClick(car, idx)}
                              disabled={isLoading}
                              className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 active:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-left focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-inset touch-manipulation"
                              aria-label={`Select ${variant.variant_name} variant, ${formatCurrency(variant.on_road_prices[selectedState])}`}
                            >
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900">{variant.variant_name}</p>
                                <p className="text-sm text-gray-600">{variant.transmission}</p>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                {isLoading && (
                                  <svg 
                                    className="animate-spin h-5 w-5 text-orange-500" 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    fill="none" 
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                  >
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                )}
                                <div className="text-right">
                                  <p className="font-bold text-orange-500">
                                    {formatCurrency(variant.on_road_prices[selectedState])}
                                  </p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

MobileNewCarsPage.displayName = 'MobileNewCarsPage';

export default MobileNewCarsPage;


