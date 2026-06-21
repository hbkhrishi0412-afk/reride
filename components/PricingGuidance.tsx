import React, { useMemo } from 'react';
import type { Vehicle } from '../types';
import {
  analyzeVehiclePricing,
  buildSellerPricingHint,
  findSimilarVehicles,
  formatIndianPrice,
} from '../utils/vehiclePricing';

interface PricingGuidanceProps {
  vehicleDetails: Partial<Vehicle>;
  allVehicles: Vehicle[];
  onApplySuggestedPrice?: (price: number) => void;
}

const PricingGuidance: React.FC<PricingGuidanceProps> = ({
  vehicleDetails,
  allVehicles,
  onApplySuggestedPrice,
}) => {
  const marketHint = useMemo(() => {
    if (!vehicleDetails.make || !vehicleDetails.model || !vehicleDetails.year || !vehicleDetails.price) {
      return null;
    }
    const draft = vehicleDetails as Vehicle;
    const similar = findSimilarVehicles(draft, allVehicles);
    const analysis = analyzeVehiclePricing(draft, similar);
    return { analysis, hint: buildSellerPricingHint(draft, analysis) };
  }, [vehicleDetails, allVehicles]);

  if (!marketHint?.hint) {
    return null;
  }

  return (
    <div className="mt-2 text-sm">
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 p-3">
        <p className="font-semibold text-blue-900 dark:text-blue-100">{marketHint.hint.headline}</p>
        <p className="mt-1 text-blue-800/90 dark:text-blue-200/90">{marketHint.hint.detail}</p>
        {marketHint.analysis.competitorCount >= 2 && (
          <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
            Market range: {formatIndianPrice(marketHint.analysis.marketLow)} –{' '}
            {formatIndianPrice(marketHint.analysis.marketHigh)}
          </p>
        )}
        {marketHint.hint.suggestedPrice != null && onApplySuggestedPrice && (
          <button
            type="button"
            onClick={() => onApplySuggestedPrice(marketHint.hint!.suggestedPrice!)}
            className="mt-2 text-xs font-semibold text-reride-orange hover:underline"
          >
            Try {formatIndianPrice(marketHint.hint.suggestedPrice)}
          </button>
        )}
      </div>
    </div>
  );
};

export default PricingGuidance;
