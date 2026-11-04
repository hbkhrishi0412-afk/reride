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
      {/* Always light card + dark ink — avoids washed-out dark:text on light bg */}
      <div className="rounded-xl border border-sky-300 bg-sky-50 p-3 text-sky-950">
        <p className="font-semibold text-sky-950">{marketHint.hint.headline}</p>
        <p className="mt-1 leading-relaxed text-sky-900">{marketHint.hint.detail}</p>
        {marketHint.analysis.competitorCount >= 2 && (
          <p className="mt-1.5 text-xs font-medium text-sky-800">
            Market range: {formatIndianPrice(marketHint.analysis.marketLow)} –{' '}
            {formatIndianPrice(marketHint.analysis.marketHigh)}
          </p>
        )}
        {marketHint.hint.suggestedPrice != null && onApplySuggestedPrice && (
          <button
            type="button"
            onClick={() => onApplySuggestedPrice(marketHint.hint!.suggestedPrice!)}
            className="mt-2 text-xs font-semibold text-orange-700 hover:underline"
          >
            Try {formatIndianPrice(marketHint.hint.suggestedPrice)}
          </button>
        )}
      </div>
    </div>
  );
};

export default PricingGuidance;
