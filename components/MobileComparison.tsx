import React, { useMemo } from 'react';
import type { Vehicle } from '../types';
import { getFirstValidImage } from '../utils/imageUtils';

interface MobileComparisonProps {
  vehicles: Vehicle[];
  comparisonList: number[];
  onRemoveFromCompare: (vehicleId: number) => void;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onBack?: () => void;
}

/**
 * Mobile-Optimized Comparison Component
 * Features:
 * - Horizontal scroll for specs
 * - Mobile-friendly comparison cards
 * - Side-by-side comparison
 */
export const MobileComparison: React.FC<MobileComparisonProps> = ({
  vehicles,
  comparisonList,
  onRemoveFromCompare,
  onSelectVehicle,
  onBack
}) => {
  const comparisonVehicles = useMemo(() => {
    return vehicles.filter(v => comparisonList.includes(v.id));
  }, [vehicles, comparisonList]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (comparisonVehicles.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24 flex items-center justify-center">
        <div className="text-center px-4">
          <svg
            className="w-20 h-20 text-gray-300 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No vehicles to compare</h2>
          <p className="text-gray-600">Add vehicles to compare their features</p>
        </div>
      </div>
    );
  }

  const specs = [
    { label: 'Price', key: 'price', format: (v: Vehicle) => formatCurrency(v.price) },
    { label: 'Year', key: 'year', format: (v: Vehicle) => v.year.toString() },
    { label: 'Mileage', key: 'mileage', format: (v: Vehicle) => `${v.mileage.toLocaleString()} km` },
    { label: 'Fuel Type', key: 'fuelType', format: (v: Vehicle) => v.fuelType },
    { label: 'Transmission', key: 'transmission', format: (v: Vehicle) => v.transmission },
    { label: 'Engine', key: 'engine', format: (v: Vehicle) => v.engine || 'N/A' },
    { label: 'Color', key: 'color', format: (v: Vehicle) => v.color || 'N/A' },
    { label: 'No. of Owners', key: 'noOfOwners', format: (v: Vehicle) => (v.noOfOwners || 1).toString() },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      {onBack && (
        <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">Compare Vehicles</h1>
        </div>
      )}

      {/* Vehicles Header - Horizontal Scroll */}
      <div className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex min-w-max">
          {comparisonVehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className="w-64 flex-shrink-0 border-r border-gray-200 last:border-r-0 p-4"
            >
              <button
                onClick={() => onRemoveFromCompare(vehicle.id)}
                className="ml-auto block mb-2 p-1 text-gray-400 hover:text-red-500"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div
                onClick={() => onSelectVehicle(vehicle)}
                className="cursor-pointer"
              >
                <img
                  src={getFirstValidImage(vehicle.images)}
                  alt={`${vehicle.make} ${vehicle.model}`}
                  className="w-full h-32 object-cover rounded-lg mb-3"
                />
                <h3 className="font-semibold text-gray-900 mb-1">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </h3>
                {vehicle.variant && (
                  <p className="text-xs text-gray-600 mb-2">{vehicle.variant}</p>
                )}
                <p className="text-lg font-bold text-orange-500">
                  {formatCurrency(vehicle.price)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Specs Comparison - Scrollable */}
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {specs.map((spec) => (
            <div
              key={spec.key}
              className="bg-white border-b border-gray-200"
            >
              <div className="flex">
                <div className="w-32 flex-shrink-0 p-4 bg-gray-50 border-r border-gray-200">
                  <p className="text-sm font-semibold text-gray-700">{spec.label}</p>
                </div>
                {comparisonVehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="w-64 flex-shrink-0 p-4 border-r border-gray-200 last:border-r-0"
                  >
                    <p className="text-sm text-gray-900">{spec.format(vehicle)}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Features Comparison */}
      {comparisonVehicles.some(v => v.features && v.features.length > 0) && (
        <div className="bg-white border-t border-gray-200 mt-4 p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Features</h2>
          <div className="space-y-3">
            {comparisonVehicles.map((vehicle) => (
              <div key={vehicle.id}>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </h3>
                {vehicle.features && vehicle.features.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {vehicle.features.map((feature, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-sm text-gray-700"
                      >
                        <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No features listed</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileComparison;
































