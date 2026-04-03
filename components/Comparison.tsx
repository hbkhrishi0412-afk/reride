import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Vehicle } from '../types';
import { getFirstValidImage } from '../utils/imageUtils';
import PageHeader from './PageHeader';

interface ComparisonProps {
  vehicles: Vehicle[];
  onBack: () => void;
  onToggleCompare: (id: number) => void;
}

const specFields: (keyof Vehicle)[] = ['price', 'year', 'mileage', 'engine', 'transmission', 'fuelType', 'fuelEfficiency', 'color', 'sellerName', 'city', 'averageRating', 'sellerAverageRating', 'registrationYear', 'noOfOwners', 'displacement'];

const CheckIcon: React.FC = () => (
    <svg className="w-6 h-6 text-reride-orange mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
);

const XIcon: React.FC = () => (
    <svg className="w-6 h-6 text-reride-orange mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
);


const Comparison: React.FC<ComparisonProps> = ({ vehicles, onBack: onBackToHome, onToggleCompare }) => {
  const { t, i18n } = useTranslation();
  const [highlightDiffs, setHighlightDiffs] = useState(true);

  const specLabels = useMemo(
    (): Partial<Record<keyof Vehicle, string>> => ({
      price: t('compare.field.price'),
      year: t('compare.field.year'),
      mileage: t('compare.field.mileage'),
      engine: t('compare.field.engine'),
      transmission: t('compare.field.transmission'),
      fuelType: t('compare.field.fuelType'),
      fuelEfficiency: t('compare.field.fuelEfficiency'),
      color: t('compare.field.color'),
      sellerName: t('compare.field.sellerName'),
      city: t('compare.field.city'),
      averageRating: t('compare.field.averageRating'),
      sellerAverageRating: t('compare.field.sellerAverageRating'),
      registrationYear: t('compare.field.registrationYear'),
      noOfOwners: t('compare.field.noOfOwners'),
      displacement: t('compare.field.displacement'),
    }),
    [t, i18n.language]
  );

  if (vehicles.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-xl shadow-soft-lg">
        <h2 className="text-2xl font-bold text-reride-text-dark dark:text-reride-text-dark">{t('compare.title')}</h2>
        <p className="mt-4 text-brand-gray-600 dark:text-reride-text-dark">{t('compare.emptyLine1')}</p>
        <p className="text-reride-text dark:text-reride-text">{t('compare.emptyLine2')}</p>
        <button type="button" onClick={onBackToHome} className="mt-6 btn-brand-primary text-white font-bold py-2 px-6 rounded-lg transition-colors">
          &larr; {t('compare.backToListings')}
        </button>
      </div>
    );
  }

  // Find best values
  const minPrice = Math.min(...vehicles.map(v => v.price));
  const minMileage = Math.min(...vehicles.map(v => v.mileage));
  const maxYear = Math.max(...vehicles.map(v => v.year));
  const maxAverageRating = Math.max(...vehicles.map(v => v.averageRating || 0));
  const maxSellerAverageRating = Math.max(...vehicles.map(v => v.sellerAverageRating || 0));

  const isBestValue = (key: keyof Vehicle, value: number) => {
    if (key === 'price' && value === minPrice) return true;
    if (key === 'mileage' && value === minMileage) return true;
    if (key === 'year' && value === maxYear) return true;
    if (key === 'averageRating' && value > 0 && value === maxAverageRating) return true;
    if (key === 'sellerAverageRating' && value > 0 && value === maxSellerAverageRating) return true;
    return false;
  }
  
  const allFeatures = useMemo(() => {
    const featureSet = new Set<string>();
    vehicles.forEach(v => {
        v.features.forEach(feature => featureSet.add(feature));
    });
    return Array.from(featureSet).sort();
  }, [vehicles]);

  const areValuesDifferent = (key: keyof Vehicle) => {
      if (vehicles.length <= 1) return false;
      const firstValue = JSON.stringify(vehicles[0][key]);
      return vehicles.slice(1).some(v => JSON.stringify(v[key]) !== firstValue);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-soft-lg animate-fade-in">
      <PageHeader
        title={t('compare.pageTitle')}
        backLabel={t('compare.backToListings')}
        onBack={onBackToHome}
        rightSlot={
          <div className="flex items-center space-x-3 bg-reride-off-white dark:bg-brand-gray-700 p-2 rounded-lg">
            <label htmlFor="highlight-toggle" className="text-sm font-medium text-reride-text-dark dark:text-brand-gray-200">{t('compare.highlightDiffs')}</label>
            <button onClick={() => setHighlightDiffs(!highlightDiffs)} id="highlight-toggle" className={`${highlightDiffs ? '' : 'bg-brand-gray-300 dark:bg-brand-gray-600'} relative inline-flex items-center h-6 rounded-full w-11 transition-colors`} style={highlightDiffs ? { background: '#FF6B35' } : undefined}>
                <span className={`${highlightDiffs ? 'translate-x-6' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white rounded-full transition-transform`} />
            </button>
          </div>
        }
      />
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-200-300 dark:border-gray-200-300">
              <th className="text-left font-bold text-lg text-reride-text-dark p-4 sticky left-0 bg-white z-10">{t('compare.featureColumn')}</th>
              {vehicles.map(vehicle => (
                <th key={vehicle.id} className="p-4 min-w-[220px]">
                  <img src={getFirstValidImage(vehicle.images, vehicle.id)} alt={`${vehicle.make} ${vehicle.model}`} className="w-full h-40 object-cover rounded-lg mb-2" />
                  <h3 className="font-bold text-lg dark:text-reride-text-dark">{vehicle.year} {vehicle.make} {vehicle.model} {vehicle.variant || ''}</h3>
                  <button type="button" onClick={() => onToggleCompare(vehicle.id)} className="mt-2 text-sm text-reride-orange hover:text-reride-orange">{t('compare.remove')}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {specFields.map((key) => {
              const hasDifference = areValuesDifferent(key);
              return (
                <tr key={String(key)} className="border-b border-gray-200-200 dark:border-gray-200-200">
                  <td className="font-semibold text-brand-gray-600 dark:text-reride-text-dark p-4 sticky left-0 bg-white z-10">{specLabels[key] ?? String(key)}</td>
                  {vehicles.map(vehicle => {
                    let value = vehicle[key];
                    if (key === 'city') {
                        value = `${vehicle.city}, ${vehicle.state}`;
                    }

                    const isBest = typeof value === 'number' && isBestValue(key, value);
                    const cellClass = highlightDiffs && hasDifference ? '' : '';
                    // Removed unused cellStyle variable
                    return (
                      <td key={`${vehicle.id}-${String(key)}`} className={`p-4 text-center dark:text-brand-gray-200 transition-colors ${cellClass} ${isBest ? 'bg-reride-orange-light dark:bg-reride-orange/20' : ''}`}>
                         <span className={`inline-flex items-center gap-2 ${isBest ? 'font-bold text-reride-orange dark:text-reride-orange' : ''}`}>
                            {(() => {
                                if (value === undefined || value === null) return '-';
                                if (key === 'averageRating' || key === 'sellerAverageRating') {
                                    const countKey = key === 'averageRating' ? 'ratingCount' : 'sellerRatingCount';
                                    const count = vehicle[countKey] || 0;
                                    const rating = typeof value === 'number' ? value : 0;
                                    if (rating === 0) return t('compare.notAvailable');
                                    return `${rating.toFixed(1)} (${count})`;
                                }
                                if (typeof value === 'number') {
                                    if (key === 'price') return `₹${value.toLocaleString('en-IN')}`;
                                    return value.toLocaleString('en-IN');
                                }
                                return String(value);
                            })()}
                            {isBest && <span className="text-xs font-semibold bg-reride-orange text-reride-orange px-2 py-0.5 rounded-full">{t('compare.bestBadge')}</span>}
                         </span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            <tr className="h-4"></tr>
            <tr>
              <td colSpan={vehicles.length + 1} className="pt-6 pb-2">
                 <h2 className="text-2xl font-bold text-reride-text-dark dark:text-reride-text-dark border-b-2 border-gray-200-300 dark:border-gray-200-300 pb-2">{t('compare.featuresSection')}</h2>
              </td>
            </tr>
            {allFeatures.map((feature) => {
              const hasDifference = areValuesDifferent('features');
              return (
                 <tr key={feature} className="border-b border-gray-200-200 dark:border-gray-200-200">
                     <td className="font-semibold text-brand-gray-600 dark:text-reride-text-dark p-4 sticky left-0 bg-white z-10">{feature}</td>
                     {vehicles.map(vehicle => (
                        <td key={`${vehicle.id}-${feature}`} className="p-4 transition-colors" style={highlightDiffs && hasDifference ? { backgroundColor: 'rgba(30, 136, 229, 0.1)' } : undefined}>
                            {vehicle.features.includes(feature) ? <CheckIcon /> : <XIcon />}
                        </td>
                     ))}
                 </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Comparison;