import React, { useState, useEffect } from 'react';
import type { Vehicle, BoostPackage } from '../types';
// Removed blocking import - will lazy load BOOST_PACKAGES when needed

interface BoostListingModalProps {
  vehicle: Vehicle | null;
  onClose: () => void;
  onBoost: (vehicleId: number, packageId: string) => Promise<void>;
}

const BoostListingModal: React.FC<BoostListingModalProps> = ({
  vehicle,
  onClose,
  onBoost,
}) => {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [boostPackages, setBoostPackages] = useState<BoostPackage[]>([]);

  // Load boost packages when component mounts
  useEffect(() => {
    const loadBoostPackages = async () => {
      try {
        const { BOOST_PACKAGES } = await import('../constants');
        setBoostPackages(BOOST_PACKAGES);
      } catch (error) {
        console.error('Failed to load boost packages:', error);
      }
    };
    loadBoostPackages();
  }, []);

  if (!vehicle) return null;

  const handleBoost = async () => {
    if (!selectedPackage) return;

    setIsProcessing(true);
    try {
      await onBoost(vehicle.id, selectedPackage);
      onClose();
    } catch (error) {
      console.error('Boost error:', error);
      alert('Failed to boost listing. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getPackageIcon = (type: string) => {
    switch (type) {
      case 'top_search': return '🔝';
      case 'homepage_spotlight': return '⭐';
      case 'featured_badge': return '🏆';
      case 'multi_city': return '🌍';
      default: return '🚀';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-slide-in-up">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Boost Your Listing
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {vehicle.make} {vehicle.model} • ₹{(vehicle.price / 100000).toFixed(2)} L
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Why Boost Your Listing?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">👁️</span>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">3x More Views</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Get noticed faster</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚡</span>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Sell Faster</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Reduced listing time</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">💰</span>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Better Price</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Premium visibility</p>
                </div>
              </div>
            </div>
          </div>

          {/* Packages */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Choose Your Boost Package
            </h3>
            
            {boostPackages.map((pkg) => (
              <div
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg.id)}
                className={`relative p-5 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedPackage === pkg.id
                    ? 'border-reride-orange bg-orange-50 dark:bg-orange-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <span className="text-4xl">{getPackageIcon(pkg.type)}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                          {pkg.name}
                        </h4>
                        {pkg.id.includes('_7') && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded">
                            BEST VALUE
                          </span>
                        )}
                      </div>
                      <ul className="space-y-1.5 mb-3">
                        {pkg.features.map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                            </svg>
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Duration: {pkg.durationDays} days
                      </p>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-3xl font-bold text-reride-orange">
                      ₹{pkg.price}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      one-time
                    </p>
                  </div>
                </div>

                {selectedPackage === pkg.id && (
                  <div className="absolute top-3 right-3">
                    <div className="w-6 h-6 bg-reride-orange rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p className="mb-1">✓ Secure payment processing</p>
                <p>✓ Instant activation after payment</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBoost}
                  disabled={!selectedPackage || isProcessing}
                  className="px-8 py-3 bg-reride-orange text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    '🚀 Boost Now'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoostListingModal;

