import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Vehicle } from '../types';
import { getDisplayNameForCity, CITY_MAPPING } from '../utils/cityMapping';
import { useIsMdUp } from '../hooks/useIsMdUp';

interface CityDropdownProps {
  allVehicles: Vehicle[];
  onCitySelect: (city: string) => void;
  onViewAllCars: () => void;
}

const CityDropdown: React.FC<CityDropdownProps> = ({ allVehicles, onCitySelect, onViewAllCars }) => {
  const { t } = useTranslation();
  const isMdUp = useIsMdUp();
  const [isOpen, setIsOpen] = useState(false);
  const [cities, setCities] = useState<string[]>([]);

  // Extract unique cities from vehicles data and normalize to display names
  useEffect(() => {
    // Get all unique city names from vehicles
    const uniqueCityNames = Array.from(
      new Set(
        allVehicles
          .filter(vehicle => vehicle.status === 'published' && vehicle.city)
          .map(vehicle => vehicle.city!)
      )
    );

    // Convert to display names and deduplicate
    const displayNames = uniqueCityNames.map(city => getDisplayNameForCity(city));
    const uniqueDisplayNames = Array.from(new Set(displayNames)).sort();

    // Prioritize cities from CITY_MAPPING (main cities) and show them first
    const mainCities = Object.keys(CITY_MAPPING).filter(city => 
      uniqueDisplayNames.includes(city)
    );
    const otherCities = uniqueDisplayNames.filter(city => !mainCities.includes(city));
    
    setCities([...mainCities, ...otherCities]);
  }, [allVehicles]);

  const handleCityClick = (e: React.MouseEvent, city: string) => {
    e.preventDefault();
    e.stopPropagation();
    onCitySelect(city);
    setIsOpen(false);
  };

  const handleViewAllClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (process.env.NODE_ENV === 'development') {
      console.log('🔵 CityDropdown: View all cars clicked');
    }
    // Close dropdown immediately to prevent backdrop interference
    setIsOpen(false);
    // Call navigation immediately - it's synchronous so this should work
    onViewAllCars();
  };

  // Split cities into two columns
  const midPoint = Math.ceil(cities.length / 2);
  const leftColumnCities = cities.slice(0, midPoint);
  const rightColumnCities = cities.slice(midPoint);

  return (
    <div
      className="relative"
      onMouseEnter={isMdUp ? () => setIsOpen(true) : undefined}
      onMouseLeave={isMdUp ? () => setIsOpen(false) : undefined}
    >
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="inline-flex h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-4 text-[15px] font-semibold text-gray-700 transition-all duration-300 hover:-translate-y-0.5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:text-blue-600"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {t('nav.buyCar')}
        <svg 
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Full-screen dismiss layer — desktop nav uses hover, so we skip the backdrop to allow moving the pointer into the menu */}
          {!isMdUp && (
            <div 
              className="fixed inset-0 z-10" 
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setIsOpen(false);
                }
              }}
            />
          )}
          
          <div
            className="absolute top-full left-0 z-20 pt-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-96 bg-gradient-to-br from-purple-900 to-purple-800 rounded-xl shadow-2xl border border-purple-700 overflow-hidden">
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="space-y-2">
                  <button
                    onClick={handleViewAllClick}
                    onMouseDown={(e) => {
                      // Prevent backdrop from interfering with button click
                      e.stopPropagation();
                    }}
                    className="w-full text-left px-3 py-2 text-white font-semibold hover:bg-purple-700 rounded-lg transition-colors duration-200 flex items-center justify-between"
                    type="button"
                  >
                    {t('nav.buyDropdown.viewAllCars')}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  
                  {leftColumnCities.map((city) => (
                    <button
                      key={city}
                      onClick={(e) => handleCityClick(e, city)}
                      className="w-full text-left px-3 py-2 text-white hover:bg-purple-700 rounded-lg transition-colors duration-200 flex items-center justify-between"
                      type="button"
                    >
                      {t('nav.buyDropdown.usedCarsInCity', { city })}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>

                {/* Right Column */}
                <div className="space-y-2">
                  {rightColumnCities.map((city) => (
                    <button
                      key={city}
                      onClick={(e) => handleCityClick(e, city)}
                      className="w-full text-left px-3 py-2 text-white hover:bg-purple-700 rounded-lg transition-colors duration-200 flex items-center justify-between"
                      type="button"
                    >
                      {t('nav.buyDropdown.usedCarsInCity', { city })}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CityDropdown;
