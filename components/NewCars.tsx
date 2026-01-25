import React, { useState, useEffect, useMemo } from 'react';
import { NEW_CARS_DATA, NewCarModel, NewCarVariant } from '../data/newCarsData';
import { newCarsService } from '../services/newCarsService';
import { getSafeImageSrc } from '../utils/imageUtils';
import CarSpecModal from './CarSpecModal';
import { useApp } from './AppProvider';
import { INDIAN_STATES, CITIES_BY_STATE } from '../constants/location';
import { getStateCodeForCity } from '../utils/cityMapping';

const formatCurrency = (value: number) => {
    if (value === Infinity || !value) return 'Price not available';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

const CarModelCardSkeleton: React.FC = () => (
    <div className="bg-white rounded-xl shadow-soft p-4 animate-pulse">
        <div className="flex gap-4">
            <div className="w-32 h-24 bg-reride-light-gray dark:bg-brand-gray-700 rounded-lg flex-shrink-0"></div>
            <div className="flex-grow space-y-3">
                <div className="h-6 bg-reride-light-gray dark:bg-brand-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-reride-light-gray dark:bg-brand-gray-700 rounded w-1/2"></div>
                <div className="h-5 bg-reride-light-gray dark:bg-brand-gray-700 rounded w-1/3 mt-4"></div>
            </div>
        </div>
    </div>
);

const SpecItem: React.FC<{ icon: React.ReactNode; text: string | number }> = ({ icon, text }) => (
    <div className="flex items-center gap-1.5">
        {icon}
        <span>{text}</span>
    </div>
);

const CarModelCard: React.FC<{ car: NewCarModel; isExpanded: boolean; onToggle: (id: number) => void; selectedState: string; onViewSpecs: (car: NewCarModel, variant: NewCarVariant) => void; }> = ({ car, isExpanded, onToggle, selectedState, onViewSpecs }) => (
    <div className="bg-white rounded-xl shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-lg">
        <button
            onClick={() => onToggle(car.id)}
            aria-expanded={isExpanded}
            className="w-full p-4 text-left flex items-center gap-4 focus:outline-none rounded-xl" onFocus={(e) => e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255, 107, 53, 0.1)'} onBlur={(e) => e.currentTarget.style.boxShadow = ''}
        >
            <div className="w-32 h-24 bg-reride-off-white dark:bg-brand-gray-700 rounded-lg flex-shrink-0 p-1">
                 <img src={getSafeImageSrc(car.image_url)} alt={`${car.brand_name} ${car.model_name}`} className="w-full h-full object-contain" />
            </div>
            <div className="flex-grow">
                <h3 className="text-xl font-bold text-reride-text-dark dark:text-reride-text-dark">{car.brand_name} {car.model_name} ({car.model_year})</h3>
                <p className="text-sm text-brand-gray-600 dark:text-reride-text">{car.body_type} &middot; {car.fuel_options.join(', ')}</p>
                
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-reride-text dark:text-reride-text">
                    <SpecItem icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.532 1.532 0 012.287-.947c1.372.836 2.942-.734-2.106-2.106a1.532 1.532 0 01-.947-2.287c1.561-.379-1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>} text={car.key_specs.engine} />
                    <SpecItem icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" /></svg>} text={car.key_specs.mileage} />
                    <SpecItem icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>} text={`${car.key_specs.seating_capacity} Seater`} />
                </div>
                
                <p className="text-lg font-semibold mt-2" style={{ color: '#FF6B35' }}>
                    Starts at {formatCurrency(Math.min(...car.variants.map(v => v.on_road_prices[selectedState] || Infinity)))}
                </p>
            </div>
            <div className="ml-auto text-gray-400">
                <svg className={`w-6 h-6 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </div>
        </button>
        {isExpanded && (
            <div className="px-4 pb-4 animate-fade-in">
                <div className="border-t border-gray-200-200 dark:border-gray-200-200 pt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-brand-gray-200 dark:divide-brand-gray-700">
                        <thead className="bg-white dark:bg-brand-gray-700">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-reride-text dark:text-reride-text-dark uppercase">Variant</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-reride-text dark:text-reride-text-dark uppercase">On-Road Price ({selectedState})</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-reride-text dark:text-reride-text-dark uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-brand-gray-200 dark:divide-brand-gray-700">
                            {car.variants.map(variant => (
                                <tr key={variant.variant_name}>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-reride-text-dark dark:text-reride-text-dark">{variant.variant_name} ({variant.transmission})</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-reride-text-dark dark:text-brand-gray-200">{formatCurrency(variant.on_road_prices[selectedState])}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                        <button onClick={() => onViewSpecs(car, variant)} className="font-semibold hover:underline transition-colors" style={{ color: '#FF6B35' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--reride-blue)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--reride-orange)'}>
                                            View Full Specs
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
    </div>
);

const FilterSelect: React.FC<{ label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode, disabled?: boolean }> = ({ label, value, onChange, children, disabled = false }) => (
    <div>
        <label className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-1">{label}</label>
        <select value={value} onChange={onChange} disabled={disabled} className="w-full p-3 border border-gray-200-300 dark:border-gray-200-300 rounded-lg focus:outline-none bg-white dark:bg-brand-gray-700 text-reride-text-dark dark:text-brand-gray-200 disabled:opacity-50 disabled:cursor-not-allowed" onFocus={(e) => !disabled && (e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255, 107, 53, 0.1)')} onBlur={(e) => e.currentTarget.style.boxShadow = ''}>
            {children}
        </select>
    </div>
);


const NewCars: React.FC = () => {
    const [carModels, setCarModels] = useState<NewCarModel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedCarId, setExpandedCarId] = useState<number | null>(null);
    const [specModalData, setSpecModalData] = useState<{ car: NewCarModel; variant: NewCarVariant } | null>(null);
    const { userLocation, selectedCity } = useApp();

    // Filters
    const [selectedState, setSelectedState] = useState('Maharashtra');
    const [searchQuery, setSearchQuery] = useState('');
    const [makeFilter, setMakeFilter] = useState('all');
    const [modelFilter, setModelFilter] = useState('all');
    const [yearFilter, setYearFilter] = useState('all');
    const [bodyTypeFilter, setBodyTypeFilter] = useState('all');
    const [fuelFilter, setFuelFilter] = useState('all');
    const [seatingFilter, setSeatingFilter] = useState('all');
    const [isStateFilterUserSet, setIsStateFilterUserSet] = useState(false);

    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [tempFilters, setTempFilters] = useState({ selectedState, makeFilter, modelFilter, yearFilter, bodyTypeFilter, fuelFilter, seatingFilter });

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setIsLoading(true);
            try {
                const fromDb = await newCarsService.getAll();
                if (!cancelled && Array.isArray(fromDb) && fromDb.length > 0) {
                    // Map DB shape to component type if needed
                    const mapped: NewCarModel[] = fromDb.map((doc: any, idx: number) => ({
                        id: doc.id || idx + 1,
                        brand_name: doc.brand_name,
                        model_name: doc.model_name,
                        model_year: doc.model_year,
                        body_type: doc.body_type,
                        key_specs: doc.key_specs,
                        fuel_options: doc.fuel_options,
                        variants: doc.variants,
                        image_url: doc.image_url
                    }));
                    setCarModels(mapped);
                } else {
                    setCarModels(NEW_CARS_DATA);
                }
            } catch {
                setCarModels(NEW_CARS_DATA);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    const allIndianStates = useMemo(() => INDIAN_STATES.map(state => state.name), []);
    const locationCity = useMemo(() => selectedCity || userLocation, [selectedCity, userLocation]);

    useEffect(() => {
        if (!locationCity || isStateFilterUserSet) return;

        const stateCode = getStateCodeForCity(locationCity, CITIES_BY_STATE);
        const stateName = stateCode
            ? INDIAN_STATES.find((s) => s.code === stateCode)?.name
            : INDIAN_STATES.find((s) => s.name.toLowerCase() === locationCity.toLowerCase())?.name;

        if (stateName && stateName !== selectedState) {
            setSelectedState(stateName);
        }
    }, [locationCity, isStateFilterUserSet, selectedState]);

    const markStateFilterUserSet = () => setIsStateFilterUserSet(true);

    const uniqueBrands = useMemo(() => [...new Set(carModels.map(car => car.brand_name))].sort(), [carModels]);
    const availableModels = useMemo(() => {
        if (makeFilter === 'all') return [];
        return [...new Set(carModels.filter(c => c.brand_name === makeFilter).map(c => c.model_name))].sort();
    }, [carModels, makeFilter]);
     const tempAvailableModels = useMemo(() => {
        if (tempFilters.makeFilter === 'all') return [];
        return [...new Set(carModels.filter(c => c.brand_name === tempFilters.makeFilter).map(c => c.model_name))].sort();
    }, [carModels, tempFilters.makeFilter]);
    const uniqueYears = useMemo(() => [...new Set(carModels.map(car => car.model_year))].sort((a, b) => Number(b) - Number(a)), [carModels]);
    const uniqueBodyTypes = useMemo(() => [...new Set(NEW_CARS_DATA.map(car => car.body_type))].sort(), []);
    const uniqueFuelTypes = useMemo(() => [...new Set(NEW_CARS_DATA.flatMap(car => car.fuel_options))].sort(), []);
    
    const filteredCars = useMemo(() => {
        return carModels.filter(car => {
            const matchesSearch = car.brand_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  car.model_name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesMake = makeFilter === 'all' || car.brand_name === makeFilter;
            const matchesModel = modelFilter === 'all' || car.model_name === modelFilter;
            const matchesYear = yearFilter === 'all' || car.model_year === Number(yearFilter);
            const matchesBodyType = bodyTypeFilter === 'all' || car.body_type === bodyTypeFilter;
            const matchesFuel = fuelFilter === 'all' || car.fuel_options.includes(fuelFilter as any);
            const matchesSeating = seatingFilter === 'all' || car.key_specs.seating_capacity === Number(seatingFilter);
            
            return matchesSearch && matchesMake && matchesModel && matchesYear && matchesBodyType && matchesFuel && matchesSeating;
        });
    }, [carModels, searchQuery, makeFilter, modelFilter, yearFilter, bodyTypeFilter, fuelFilter, seatingFilter]);
    
    const handleToggleExpand = (id: number) => {
        setExpandedCarId(prevId => prevId === id ? null : id);
    };

    const handleClearFilters = () => {
        setSearchQuery('');
        setSelectedState('Maharashtra');
        setMakeFilter('all');
        setModelFilter('all');
        setYearFilter('all');
        setBodyTypeFilter('all');
        setFuelFilter('all');
        setSeatingFilter('all');
        setIsStateFilterUserSet(false);
    };

    const handleViewSpecs = (car: NewCarModel, variant: NewCarVariant) => {
        setSpecModalData({ car, variant });
    };

    const handleOpenFilterModal = () => {
        setTempFilters({ selectedState, makeFilter, modelFilter, yearFilter, bodyTypeFilter, fuelFilter, seatingFilter });
        setIsFilterModalOpen(true);
    };

    const handleApplyFilters = () => {
        setSelectedState(tempFilters.selectedState);
        setMakeFilter(tempFilters.makeFilter);
        setModelFilter(tempFilters.modelFilter);
        setYearFilter(tempFilters.yearFilter);
        setBodyTypeFilter(tempFilters.bodyTypeFilter);
        setFuelFilter(tempFilters.fuelFilter);
        setSeatingFilter(tempFilters.seatingFilter);
        if (tempFilters.selectedState !== selectedState) {
            setIsStateFilterUserSet(true);
        }
        setIsFilterModalOpen(false);
    };

    const handleResetTempFilters = () => {
        setTempFilters({
            selectedState: 'Maharashtra',
            makeFilter: 'all', modelFilter: 'all', yearFilter: 'all',
            bodyTypeFilter: 'all', fuelFilter: 'all', seatingFilter: 'all'
        });
        setIsStateFilterUserSet(false);
    };

    const renderFilterControls = (isMobile: boolean) => {
        const state = isMobile ? tempFilters : { selectedState, makeFilter, modelFilter, yearFilter, bodyTypeFilter, fuelFilter, seatingFilter };
        const setState = (updater: (prevState: typeof state) => typeof state) => {
            if (isMobile) {
                setTempFilters(updater as any);
            } else {
                const newState = updater(state);
                if (newState.selectedState !== selectedState) setSelectedState(newState.selectedState);
                if (newState.makeFilter !== makeFilter) { setMakeFilter(newState.makeFilter); setModelFilter('all'); }
                if (newState.modelFilter !== modelFilter) setModelFilter(newState.modelFilter);
                if (newState.yearFilter !== yearFilter) setYearFilter(newState.yearFilter);
                if (newState.bodyTypeFilter !== bodyTypeFilter) setBodyTypeFilter(newState.bodyTypeFilter);
                if (newState.fuelFilter !== fuelFilter) setFuelFilter(newState.fuelFilter);
                if (newState.seatingFilter !== seatingFilter) setSeatingFilter(newState.seatingFilter);
            }
        };

        return (
            <>
                <FilterSelect label="State for On-Road Price" value={state.selectedState} onChange={e => { markStateFilterUserSet(); setState(p => ({...p, selectedState: e.target.value})); }}>
                    {allIndianStates.map(state => <option key={state} value={state}>{state}</option>)}
                </FilterSelect>
                <FilterSelect label="Make" value={state.makeFilter} onChange={e => setState(p => ({...p, makeFilter: e.target.value, modelFilter: 'all' }))}>
                    <option value="all">All Makes</option>
                    {uniqueBrands.map(brand => <option key={brand} value={brand}>{brand}</option>)}
                </FilterSelect>
                <FilterSelect label="Model" value={state.modelFilter} onChange={e => setState(p => ({...p, modelFilter: e.target.value}))} disabled={state.makeFilter === 'all'}>
                    <option value="all">All Models</option>
                    {(isMobile ? tempAvailableModels : availableModels).map(model => <option key={model} value={model}>{model}</option>)}
                </FilterSelect>
                <FilterSelect label="Year" value={state.yearFilter} onChange={e => setState(p => ({...p, yearFilter: e.target.value}))}>
                    <option value="all">All Years</option>
                    {uniqueYears.map(year => <option key={year} value={year}>{year}</option>)}
                </FilterSelect>
                <FilterSelect label="Body Type" value={state.bodyTypeFilter} onChange={e => setState(p => ({...p, bodyTypeFilter: e.target.value}))}>
                    <option value="all">All Body Types</option>
                    {uniqueBodyTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </FilterSelect>
                <FilterSelect label="Fuel Type" value={state.fuelFilter} onChange={e => setState(p => ({...p, fuelFilter: e.target.value}))}>
                    <option value="all">All Fuel Types</option>
                    {uniqueFuelTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </FilterSelect>
                <FilterSelect label="Seating Capacity" value={state.seatingFilter} onChange={e => setState(p => ({...p, seatingFilter: e.target.value}))}>
                    <option value="all">Any Seating</option>
                    {[5, 6, 7, 8].map(num => <option key={num} value={num}>{num} Seater</option>)}
                </FilterSelect>
            </>
        )
    }

    return (
        <>
        <div className="new-cars container mx-auto py-8 animate-fade-in">
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-extrabold text-reride-text-dark dark:text-reride-text-dark mb-4">
                    Discover New Cars in India
                </h1>
                <p className="text-lg text-brand-gray-600 dark:text-reride-text max-w-3xl mx-auto">
                    Browse the latest models, compare variants, and find on-road prices for your next vehicle.
                </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8">
                {/* Sidebar */}
                <aside className="hidden lg:block self-start sticky top-24">
                    <div className="bg-white p-6 rounded-xl shadow-soft-lg space-y-4">
                        <h2 className="text-xl font-bold text-reride-text-dark dark:text-reride-text-dark">Filters</h2>
                        {renderFilterControls(false)}
                        <button onClick={handleClearFilters} className="w-full mt-2 bg-reride-light-gray dark:bg-brand-gray-700 text-reride-text-dark dark:text-brand-gray-200 font-bold py-3 px-4 rounded-lg hover:bg-brand-gray-300 dark:hover:bg-brand-gray-600 transition-colors">
                            Clear All Filters
                        </button>
                    </div>
                </aside>
                
                {/* Main Content */}
                <main className="space-y-6">
                    <input
                        type="text"
                        placeholder="Search by brand or model..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full p-4 border border-gray-200-300 dark:border-gray-200-300 rounded-xl focus:outline-none bg-white dark:bg-brand-gray-700 text-reride-text-dark dark:text-brand-gray-200 text-lg" onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--reride-orange)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255, 107, 53, 0.1)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }}
                    />
                    <div className="flex justify-between items-center">
                        <button onClick={handleOpenFilterModal} className="lg:hidden flex items-center gap-2 font-semibold px-4 py-2 rounded-lg" style={{ color: '#FF6B35', background: 'rgba(30, 136, 229, 0.1)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--reride-blue)'} onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(30, 136, 229, 0.1)'}>
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" /></svg>
                            Filters
                        </button>
                        <p className="text-sm text-brand-gray-600 dark:text-reride-text">
                            Showing <span className="font-bold text-reride-text-dark dark:text-brand-gray-200">{filteredCars.length}</span> of <span className="font-bold text-reride-text-dark dark:text-brand-gray-200">{carModels.length}</span> models
                        </p>
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {isLoading ? (
                            Array.from({ length: 6 }).map((_, index) => <CarModelCardSkeleton key={index} />)
                        ) : filteredCars.length > 0 ? (
                            filteredCars.map(car => (
                                <CarModelCard 
                                    key={car.id} 
                                    car={car}
                                    isExpanded={expandedCarId === car.id}
                                    onToggle={handleToggleExpand}
                                    selectedState={selectedState}
                                    onViewSpecs={handleViewSpecs}
                                />
                            ))
                        ) : (
                            <div className="xl:col-span-2 text-center py-16 bg-white rounded-xl shadow-soft">
                                <h3 className="text-2xl font-semibold text-reride-text-dark dark:text-brand-gray-200">No Cars Found</h3>
                                <p className="text-reride-text dark:text-reride-text mt-2">
                                    Try adjusting your filters or clearing them to see all available models.
                                </p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>

        {/* Mobile Filter Modal */}
        {isFilterModalOpen && (
            <div className="lg:hidden fixed inset-0 bg-black bg-opacity-60 z-50 animate-fade-in" onClick={() => setIsFilterModalOpen(false)}>
                <div className="bg-white rounded-t-2xl h-[90vh] flex flex-col absolute bottom-0 left-0 right-0 animate-slide-in-up" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-gray-200-200 dark:border-gray-200-200 flex justify-between items-center flex-shrink-0">
                        <h2 className="text-xl font-bold text-reride-text-dark dark:text-reride-text-dark">Filters</h2>
                        <button onClick={() => setIsFilterModalOpen(false)} className="p-2 -mr-2 text-reride-text text-2xl">&times;</button>
                    </div>
                    <div className="overflow-y-auto p-6 flex-grow space-y-4">
                        {renderFilterControls(true)}
                    </div>
                    <div className="p-4 border-t border-gray-200-200 dark:border-gray-200-200 flex gap-4 bg-white flex-shrink-0">
                        <button onClick={handleResetTempFilters} className="w-full bg-reride-light-gray dark:bg-brand-gray-700 text-reride-text-dark dark:text-brand-gray-200 font-bold py-3 px-4 rounded-lg hover:bg-brand-gray-300 dark:hover:bg-brand-gray-600 transition-colors">Reset</button>
                        <button onClick={handleApplyFilters} className="w-full btn-brand-primary text-white font-bold py-3 px-4 rounded-lg transition-colors">Apply Filters</button>
                    </div>
                </div>
            </div>
        )}

        {specModalData && (
            <CarSpecModal
                car={specModalData.car}
                variant={specModalData.variant}
                onClose={() => setSpecModalData(null)}
            />
        )}
        </>
    );
};

export default NewCars;