import React, { useState, useCallback } from 'react';
import type { Vehicle } from '../types';
import { getSellerPriceSuggestion } from '../services/geminiService';

interface PricingGuidanceProps {
  vehicleDetails: Partial<Vehicle>;
  allVehicles: Vehicle[];
}

const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(value);

const PricingGuidance: React.FC<PricingGuidanceProps> = ({ vehicleDetails, allVehicles }) => {
    const [result, setResult] = useState<{ summary: string; min: number; max: number } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAnalysis = useCallback(async () => {
        if (!vehicleDetails.make || !vehicleDetails.model || !vehicleDetails.year || !vehicleDetails.mileage) {
            alert('Please fill in Make, Model, Year, and Mileage to get a price suggestion.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult(null);

        const marketContext = allVehicles
            .filter(v => v.make === vehicleDetails.make)
            .map(v => ({ price: v.price, year: v.year, mileage: v.mileage, status: v.status }));
        
        try {
            const analysis = await getSellerPriceSuggestion(vehicleDetails as any, marketContext);
            if (analysis.suggestedMinPrice === 0 && analysis.suggestedMaxPrice === 0) {
                setError(analysis.summary);
            } else {
                setResult({ summary: analysis.summary, min: analysis.suggestedMinPrice, max: analysis.suggestedMaxPrice });
            }
        } catch (e) {
            setError('An unexpected error occurred during analysis.');
        } finally {
            setIsLoading(false);
        }
    }, [vehicleDetails, allVehicles]);
    
    return (
        <div className="mt-2 text-sm">
            <button
                type="button"
                onClick={handleAnalysis}
                disabled={isLoading}
                className="font-semibold text-reride-orange disabled:opacity-50 flex items-center gap-1 hover:text-reride-orange"
            >
                {isLoading ? (
                    <><div className="w-4 h-4 border-2 border-dashed rounded-full animate-spin border-current"></div><span>Analyzing...</span></>
                ) : (
                    <>✨ Get AI Price</>
                )}
            </button>
            {error && <div className="mt-2 p-3 bg-reride-orange-light dark:bg-reride-orange/20 text-reride-orange dark:text-reride-orange rounded-lg">{error}</div>}
            {result && (
                <div className="mt-2 p-3 rounded-lg animate-fade-in" style={{ backgroundColor: 'rgba(30, 136, 229, 0.1)', color: '#1A1A1A' }}>
                    <p className="font-bold">Suggested Range: {formatCurrency(result.min)} - {formatCurrency(result.max)}</p>
                    <p className="text-xs italic mt-1">"{result.summary}"</p>
                </div>
            )}
        </div>
    );
};

export default PricingGuidance;