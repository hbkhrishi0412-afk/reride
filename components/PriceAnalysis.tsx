import React, { useState, useCallback } from 'react';
import type { Vehicle } from '../types';
import { getSellerPriceSuggestion } from '../services/geminiService';

interface PriceAnalysisProps {
  vehicle: Vehicle;
  similarVehicles: Pick<Vehicle, 'price' | 'year' | 'mileage'>[];
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

const PriceAnalysis: React.FC<PriceAnalysisProps> = ({ vehicle, similarVehicles }) => {
  const [analysis, setAnalysis] = useState<{ summary: string; min: number; max: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyzePrice = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const result = await getSellerPriceSuggestion(vehicle, similarVehicles);
      if (result.suggestedMinPrice === 0 && result.suggestedMaxPrice === 0) {
        setError(result.summary);
      } else {
        setAnalysis({ summary: result.summary, min: result.suggestedMinPrice, max: result.suggestedMaxPrice });
      }
    } catch (e) {
      setError('An unexpected error occurred during analysis.');
    } finally {
      setIsLoading(false);
    }
  }, [vehicle, similarVehicles]);

  return (
    <div className="bg-white rounded-xl shadow-soft-lg p-6">
      <h3 className="text-lg font-semibold text-reride-text-dark dark:text-reride-text-dark mb-4">AI Price Analysis</h3>
      
      {!analysis && !isLoading && !error && (
        <>
          <p className="text-sm text-brand-gray-600 dark:text-reride-text mb-4">
            Get a fair market value estimation for this vehicle based on its condition and similar listings.
          </p>
          <button
            onClick={handleAnalyzePrice}
            className="w-full bg-reride-orange text-white font-bold py-3 px-6 rounded-lg text-lg hover:bg-reride-orange transition-all transform hover:scale-105 flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
            Analyze Price
          </button>
        </>
      )}

      {isLoading && (
        <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin mx-auto" style={{ borderColor: '#FF6B35' }}></div>
            <p className="mt-3 text-sm font-semibold text-brand-gray-600 dark:text-reride-text">Analyzing market data...</p>
        </div>
      )}

      {error && (
        <div className="text-center p-4 bg-reride-orange-light dark:bg-reride-orange/20 text-reride-orange dark:text-reride-orange rounded-lg">
            <p className="font-semibold">Analysis Failed</p>
            <p className="text-sm">{error}</p>
            <button onClick={handleAnalyzePrice} className="mt-2 text-sm font-bold text-reride-orange hover:underline">Try Again</button>
        </div>
      )}

      {analysis && (
        <div className="animate-fade-in space-y-4">
            <div>
                <p className="text-sm text-brand-gray-600 dark:text-reride-text">Fair Market Value (est.)</p>
                <p className="text-2xl font-extrabold text-reride-orange dark:text-reride-orange">
                    {formatCurrency(analysis.min)} - {formatCurrency(analysis.max)}
                </p>
            </div>
            <div>
                <p className="text-sm font-semibold text-reride-text-dark dark:text-reride-text-dark">AI Summary:</p>
                <p className="text-sm text-brand-gray-600 dark:text-reride-text italic">
                    "{analysis.summary}"
                </p>
            </div>
            <button onClick={handleAnalyzePrice} className="text-xs font-bold hover:underline transition-colors" style={{ color: '#FF6B35' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--reride-blue)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--reride-orange)'}>Re-analyze</button>
        </div>
      )}
    </div>
  );
};

export default PriceAnalysis;