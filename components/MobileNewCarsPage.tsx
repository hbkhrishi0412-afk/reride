import React, { useState, useMemo, useCallback } from 'react';
import { NEW_CARS_DATA, NewCarModel } from '../data/newCarsData';
import { getSafeImageSrc } from '../utils/imageUtils';

interface MobileNewCarsPageProps {
  onSelectCar?: (car: NewCarModel) => void;
}

/**
 * Mobile-Optimized New Cars Page
 * Features:
 * - Card-based car listings
 * - Touch-friendly filters
 * - Expandable variant details
 */
export const MobileNewCarsPage: React.FC<MobileNewCarsPageProps> = React.memo(({ onSelectCar }) => {
  const [selectedState, setSelectedState] = useState('Maharashtra');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedBodyType, setSelectedBodyType] = useState<string>('');
  const [expandedCars, setExpandedCars] = useState<Set<number>>(new Set());

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

  const handleVariantClick = useCallback((car: NewCarModel) => {
    onSelectCar?.(car);
  }, [onSelectCar]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-xl font-bold text-gray-900">New Cars</h1>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-[56px] z-20">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium flex-shrink-0"
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
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium flex-shrink-0"
          >
            <option value="">All Brands</option>
            {uniqueBrands.map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
          <select
            value={selectedBodyType}
            onChange={(e) => setSelectedBodyType(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium flex-shrink-0"
          >
            <option value="">All Body Types</option>
            {uniqueBodyTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Car List */}
      <div className="px-4 py-4">
        {filteredCars.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No cars found</p>
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
                    className="w-full p-4 text-left"
                  >
                    <div className="flex gap-4">
                      <div className="w-24 h-20 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center p-2">
                        <img
                          src={getSafeImageSrc(car.image_url)}
                          alt={`${car.brand_name} ${car.model_name}`}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 mb-1">
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
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-200 pt-4">
                      <div className="space-y-3">
                        {car.variants.map((variant, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleVariantClick(car)}
                            className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                          >
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{variant.variant_name}</p>
                              <p className="text-sm text-gray-600">{variant.transmission}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-orange-500">
                                {formatCurrency(variant.on_road_prices[selectedState])}
                              </p>
                            </div>
                          </button>
                        ))}
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


