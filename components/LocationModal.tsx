import React, { useState, useMemo, useEffect } from 'react';
// Removed blocking import - will lazy load location data when needed
import { getDisplayNameForCity } from '../utils/cityMapping';

interface LocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentLocation: string;
    onLocationChange: (location: string) => void;
    addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const LocationModal: React.FC<LocationModalProps> = ({ isOpen, onClose, currentLocation, onLocationChange, addToast }) => {
    const [selectedState, setSelectedState] = useState('');
    const [selectedCity, setSelectedCity] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isDetecting, setIsDetecting] = useState(false);
    
    // Lazy load location data
    const [indianStates, setIndianStates] = useState<Array<{name: string, code: string}>>([]);
    const [citiesByState, setCitiesByState] = useState<Record<string, string[]>>({});

    // Load location data when component mounts
    useEffect(() => {
        const loadLocationData = async () => {
            try {
                const { loadLocationData } = await import('../utils/dataLoaders');
                const { INDIAN_STATES, CITIES_BY_STATE } = await loadLocationData();

                if (Array.isArray(INDIAN_STATES) && INDIAN_STATES.length > 0) {
                    setIndianStates(INDIAN_STATES);
                } else {
                    console.warn('Location data loader returned empty states list. Falling back to static data.');
                }

                if (CITIES_BY_STATE && Object.keys(CITIES_BY_STATE).length > 0) {
                    setCitiesByState(CITIES_BY_STATE);
                } else {
                    console.warn('Location data loader returned empty cities list. Falling back to static data.');
                }
            } catch (error) {
                console.error('Failed to load location data:', error);
            }
        };
        loadLocationData();
    }, []);

    // Sync dropdown selection with current location when modal opens or data changes
    useEffect(() => {
        if (!isOpen) return;

        if (!currentLocation) {
            setSelectedState('');
            setSelectedCity('');
            return;
        }

        const normalizedLocation = currentLocation.trim().toLowerCase();

        // Attempt to match by city first
        const matchedEntry = Object.entries(citiesByState).find(([, cities]) =>
            cities.some(city => city.toLowerCase() === normalizedLocation)
        );

        if (matchedEntry) {
            const [stateCode, cities] = matchedEntry;
            setSelectedState(stateCode);
            const matchedCity = cities.find(city => city.toLowerCase() === normalizedLocation) || cities[0];
            setSelectedCity(matchedCity);
            return;
        }

        // Fallback: try partial match against state names
        const matchedState = indianStates.find(state =>
            state.name.toLowerCase().includes(normalizedLocation) ||
            normalizedLocation.includes(state.name.toLowerCase())
        );

        if (matchedState) {
            setSelectedState(matchedState.code);
            const stateCities = citiesByState[matchedState.code] || [];
            if (stateCities.length > 0) {
                setSelectedCity(stateCities[0]);
            } else {
                setSelectedCity(currentLocation);
            }
        } else {
            // If nothing matches, just set the city field to the current location
            setSelectedState('');
            setSelectedCity(currentLocation);
        }
    }, [isOpen, currentLocation, indianStates, citiesByState]);

    const popularCities = useMemo(
        () => [
            'Mumbai',
            'Bangalore',
            'Delhi',
            'Pune',
            'Navi Mumbai',
            'Hyderabad',
            'Ahmedabad',
            'Chennai',
            'Kolkata',
            'Chandigarh'
        ],
        []
    );

    const allCities = useMemo(
        () =>
            Object.entries(citiesByState).flatMap(([stateCode, cities]) =>
                cities.map((city) => ({ city, stateCode }))
            ),
        [citiesByState]
    );

    const availableCities = useMemo(() => {
        if (!selectedState) return [];
        return citiesByState[selectedState] || [];
    }, [selectedState, citiesByState]);

    const filteredCities = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return [];
        return allCities
            .filter(({ city }) => city.toLowerCase().includes(term))
            .slice(0, 8);
    }, [searchTerm, allCities]);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
        }
    }, [isOpen]);

    const handleCitySelect = (cityName: string) => {
        const foundState = Object.entries(citiesByState).find(([, cities]) =>
            cities.some((city) => city.toLowerCase() === cityName.toLowerCase())
        );

        if (foundState) {
            setSelectedState(foundState[0]);
            setSelectedCity(cityName);
        }

        const displayName = getDisplayNameForCity(cityName);
        onLocationChange(displayName);
        addToast(`Location set to ${displayName}`, 'success');
        onClose();
    };

    const handleDetectLocation = () => {
        if (!navigator.geolocation) {
            addToast('Geolocation is not supported by your browser.', 'error');
            return;
        }
        setIsDetecting(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                console.log('Detected coordinates:', { latitude, longitude });
                
                try {
                    // Use OpenStreetMap Nominatim API for reverse geocoding
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
                        {
                            headers: {
                                'User-Agent': 'ReRide-App'
                            }
                        }
                    );
                    
                    if (!response.ok) {
                        throw new Error('Geocoding failed');
                    }
                    
                    // Check content type before parsing JSON
                    const contentType = response.headers.get('content-type');
                    if (!contentType || !contentType.includes('application/json')) {
                        throw new Error('Geocoding API returned non-JSON response');
                    }
                    
                    let data;
                    try {
                        data = await response.json();
                    } catch (jsonError) {
                        console.error('Failed to parse geocoding response:', jsonError);
                        throw new Error('Failed to parse geocoding response');
                    }
                    console.log('Geocoding response:', data);
                    
                    // Extract city and state from the response
                    const address = data.address;
                    const detectedCity = address.city || address.town || address.village || address.suburb || address.state_district || address.locality || address.county;
                    const detectedState = address.state || address.state_district || address.region;
                    
                    console.log('Detected location:', { detectedCity, detectedState });
                    
                    // Helper to resolve state code from detected state name
                    const resolveStateCode = (stateName?: string) => {
                        if (!stateName) return '';
                        const normalized = stateName.toLowerCase();
                        const found = indianStates.find(
                            (s) => s.name.toLowerCase() === normalized || normalized.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(normalized)
                        );
                        return found?.code || '';
                    };
                    const stateCode = resolveStateCode(detectedState);
                    const stateCities = stateCode ? (citiesByState[stateCode] || []) : [];

                    // Try to match with our available cities
                    const allCities = Object.values(citiesByState).flat();
                    let matchedCity = null;
                    
                    // First, try exact match
                    if (detectedCity) {
                        matchedCity = allCities.find(city => 
                            city.toLowerCase() === detectedCity.toLowerCase()
                        );
                    }
                    
                    // If no exact match, try partial match
                    if (!matchedCity && detectedCity) {
                        matchedCity = allCities.find(city => 
                            city.toLowerCase().includes(detectedCity.toLowerCase()) ||
                            detectedCity.toLowerCase().includes(city.toLowerCase())
                        );
                    }
                    
                    // If still no match, try to find major city in the detected state
                    if (!matchedCity && stateCities.length > 0) {
                        matchedCity = stateCities[0];
                    }
                    
                    // If we found a match, use it; otherwise, use detected city name
                    const finalLocation = matchedCity || detectedCity || 'Mumbai';
                    const displayLocation = getDisplayNameForCity(finalLocation);

                    // Sync dropdowns with detected state/city for user visibility
                    if (stateCode) {
                        setSelectedState(stateCode);
                        if (matchedCity) {
                            setSelectedCity(matchedCity);
                        }
                    }
                    
                    onLocationChange(displayLocation);
                    addToast(`Location detected: ${displayLocation}${detectedState ? `, ${detectedState}` : ''}`, 'success');
                    setIsDetecting(false);
                    onClose();
                    
                } catch (error) {
                    console.error('Reverse geocoding error:', error);
                    // Fallback: Use coordinates to estimate nearest major city
                    const nearestCity = getDisplayNameForCity(findNearestCity(latitude, longitude));
                    setSelectedState('');
                    setSelectedCity(nearestCity);
                    onLocationChange(nearestCity);
                    addToast(`Location detected: ${nearestCity}`, 'success');
                    setIsDetecting(false);
                    onClose();
                }
            },
            (error) => {
                console.error('Geolocation error:', error);
                addToast('Unable to retrieve your location. Please grant permission or select manually.', 'error');
                setIsDetecting(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    };
    
    // Helper function to find nearest city based on coordinates
    const findNearestCity = (lat: number, lon: number): string => {
        // Approximate coordinates of major Indian cities
        const majorCities: { name: string; lat: number; lon: number }[] = [
            { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
            { name: 'Delhi', lat: 28.7041, lon: 77.1025 },
            { name: 'Bangalore', lat: 12.9716, lon: 77.5946 },
            { name: 'Hyderabad', lat: 17.3850, lon: 78.4867 },
            { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
            { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
            { name: 'Pune', lat: 18.5204, lon: 73.8567 },
            { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714 },
            { name: 'Jaipur', lat: 26.9124, lon: 75.7873 },
            { name: 'Lucknow', lat: 26.8467, lon: 80.9462 },
            { name: 'Chandigarh', lat: 30.7333, lon: 76.7794 },
            { name: 'Indore', lat: 22.7196, lon: 75.8577 },
            { name: 'Bhopal', lat: 23.2599, lon: 77.4126 },
            { name: 'Visakhapatnam', lat: 17.6869, lon: 83.2185 },
            { name: 'Kochi', lat: 9.9312, lon: 76.2673 },
            { name: 'Surat', lat: 21.1702, lon: 72.8311 },
            { name: 'Nagpur', lat: 21.1458, lon: 79.0882 },
            { name: 'Patna', lat: 25.5941, lon: 85.1376 },
            { name: 'Vadodara', lat: 22.3072, lon: 73.1812 },
            { name: 'Ghaziabad', lat: 28.6692, lon: 77.4538 },
            { name: 'Ludhiana', lat: 30.9010, lon: 75.8573 },
            { name: 'Agra', lat: 27.1767, lon: 78.0081 },
            { name: 'Nashik', lat: 19.9975, lon: 73.7898 },
            { name: 'Faridabad', lat: 28.4089, lon: 77.3178 },
            { name: 'Meerut', lat: 28.9845, lon: 77.7064 },
            { name: 'Rajkot', lat: 22.3039, lon: 70.8022 },
            { name: 'Varanasi', lat: 25.3176, lon: 82.9739 },
            { name: 'Amritsar', lat: 31.6340, lon: 74.8723 },
            { name: 'Allahabad', lat: 25.4358, lon: 81.8463 },
            { name: 'Ranchi', lat: 23.3441, lon: 85.3096 },
            { name: 'Coimbatore', lat: 11.0168, lon: 76.9558 },
            { name: 'Jabalpur', lat: 23.1815, lon: 79.9864 },
            { name: 'Gwalior', lat: 26.2183, lon: 78.1828 }
        ];
        
        // Calculate distance using Haversine formula
        const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
            const R = 6371; // Radius of Earth in km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };
        
        // Find the nearest city
        let nearestCity = 'Mumbai';
        let minDistance = Infinity;
        
        for (const city of majorCities) {
            const distance = calculateDistance(lat, lon, city.lat, city.lon);
            if (distance < minDistance) {
                minDistance = distance;
                nearestCity = city.name;
            }
        }
        
        return nearestCity;
    };
    
    const handleManualSelect = () => {
        if (!selectedState) {
            addToast('Please select a state.', 'info');
            return;
        }

        if (!selectedCity) {
            addToast('Please select a city.', 'info');
            return;
        }

        const displayName = getDisplayNameForCity(selectedCity);
        onLocationChange(displayName);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[101] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-6 border-b dark:border-gray-200-200">
                    <div>
                        <h2 className="text-xl font-bold text-reride-text-dark dark:text-reride-text-dark">Select your city</h2>
                        <p className="text-sm text-reride-text-dark dark:text-reride-text-dark mt-1">Prices and availability may vary based on your location.</p>
                        {currentLocation && (
                            <div className="mt-3 flex items-center gap-2 text-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#1E88E5' }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="text-reride-text-dark dark:text-reride-text-dark">Current: <strong style={{ color: '#FF6B35' }}>{currentLocation}</strong></span>
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" aria-label="Close location selector">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="relative">
                        <div className="flex items-center gap-3 border border-gray-200 rounded-lg px-3 py-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Type your Pincode or City"
                                className="w-full outline-none text-sm"
                            />
                        </div>
                        {filteredCities.length > 0 && (
                            <div className="absolute mt-2 w-full bg-white shadow-lg rounded-lg border border-gray-200 z-10 max-h-60 overflow-auto">
                                {filteredCities.map(({ city, stateCode }) => (
                                    <button
                                        key={`${city}-${stateCode}`}
                                        className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between"
                                        onClick={() => handleCitySelect(city)}
                                    >
                                        <span>{city}</span>
                                        <span className="text-xs text-gray-500">{stateCode}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        <button
                            onClick={handleDetectLocation}
                            disabled={isDetecting}
                            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-reride-text-dark hover:text-blue-600 disabled:opacity-70"
                        >
                            {isDetecting ? (
                                <span className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-dashed rounded-full animate-spin border-current"></div>
                                    Detecting location...
                                </span>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                    </svg>
                                    find my location
                                </>
                            )}
                        </button>
                    </div>

                    <div>
                        <p className="text-sm font-semibold text-reride-text-dark dark:text-reride-text-dark mb-3">Popular cities</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {popularCities.map((city) => (
                                <button
                                    key={city}
                                    onClick={() => handleCitySelect(city)}
                                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-colors"
                                >
                                    <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center text-blue-500 font-semibold">
                                        {city.slice(0, 1)}
                                    </div>
                                    <span className="text-sm font-medium text-reride-text-dark">{city}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center text-xs text-reride-text-dark">
                        <span className="flex-grow border-t dark:border-gray-200-300"></span>
                        <span className="px-4">OR</span>
                        <span className="flex-grow border-t dark:border-gray-200-300"></span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="state-select" className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-1">State</label>
                            <select
                                id="state-select"
                                value={selectedState}
                                onChange={e => {
                                    const newState = e.target.value;
                                    setSelectedState(newState);
                                    const defaultCity = (citiesByState[newState] || [])[0] || '';
                                    setSelectedCity(defaultCity);
                                }}
                                className="w-full p-2 border border-gray-200 dark:border-gray-200-300 rounded-md bg-white dark:bg-brand-gray-700"
                            >
                                <option value="" disabled>Select a state</option>
                                {indianStates.map(state => <option key={state.code} value={state.code}>{state.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="city-select" className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-1">City</label>
                            <select id="city-select" value={selectedCity} onChange={e => setSelectedCity(e.target.value)} disabled={!selectedState || availableCities.length === 0} className="w-full p-2 border border-gray-200 dark:border-gray-200-300 rounded-md bg-white dark:bg-brand-gray-700 disabled:bg-white dark:disabled:bg-white">
                                <option value="" disabled>Select a city</option>
                                {availableCities.map(city => <option key={city} value={city}>{city}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
                <div className="bg-white px-6 py-4 flex justify-end gap-4 rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 bg-white-dark dark:bg-white text-reride-text-dark dark:text-reride-text-dark rounded-md hover:bg-white dark:hover:bg-white0">Cancel</button>
                    <button onClick={handleManualSelect} disabled={!selectedCity || !selectedState} className="px-4 py-2 btn-brand-primary text-white rounded-md disabled:opacity-50">Set Location</button>
                </div>
            </div>
        </div>
    );
};

export default LocationModal;
