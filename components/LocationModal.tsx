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

type LocationOption = 'detect' | 'all' | 'district' | 'city';

const LocationModal: React.FC<LocationModalProps> = ({ isOpen, onClose, currentLocation: _currentLocation, onLocationChange, addToast }) => {
    const [selectedOption, setSelectedOption] = useState<LocationOption>('detect');
    const [selectedDistrict, setSelectedDistrict] = useState('');
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

    // Reset to default when modal opens and prevent body scroll
    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setSelectedOption('detect');
            setSelectedDistrict('');
            setSelectedCity('');
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        } else {
            // Restore body scroll when modal closes
            document.body.style.overflow = '';
        }
        
        return () => {
            // Cleanup: restore body scroll
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Get all cities flattened
    const allCities = useMemo(
        () =>
            Object.entries(citiesByState).flatMap(([stateCode, cities]) =>
                cities.map((city) => ({ city, stateCode }))
            ),
        [citiesByState]
    );

    // Filter cities based on search term
    const filteredCities = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) {
            // If no search term and district is selected, show cities from that district
            if (selectedOption === 'district' && selectedDistrict) {
                return citiesByState[selectedDistrict]?.map(city => ({ city, stateCode: selectedDistrict })) || [];
            }
            // Otherwise show popular cities
            return [];
        }
        return allCities
            .filter(({ city }) => city.toLowerCase().includes(term))
            .slice(0, 50);
    }, [searchTerm, allCities, selectedDistrict, selectedOption, citiesByState]);

    // Get popular districts (major states)
    const popularDistricts = useMemo(() => {
        return indianStates
            .filter(state => ['MH', 'DL', 'KA', 'TN', 'GJ', 'UP', 'WB', 'RJ'].includes(state.code))
            .map(state => ({ code: state.code, name: state.name }));
    }, [indianStates]);

    // Get cities for selected district
    const districtCities = useMemo(() => {
        if (!selectedDistrict) return [];
        return citiesByState[selectedDistrict] || [];
    }, [selectedDistrict, citiesByState]);

    const handleDetectLocation = () => {
        if (!navigator.geolocation) {
            addToast('Geolocation is not supported by your browser.', 'error');
            return;
        }
        console.log('Starting geolocation detection...');
        setIsDetecting(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                
                try {
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
                    
                    const contentType = response.headers.get('content-type');
                    if (!contentType || !contentType.includes('application/json')) {
                        throw new Error('Geocoding API returned non-JSON response');
                    }
                    
                    const data = await response.json();
                    const address = data.address;
                    const detectedCity = address.city || address.town || address.village || address.suburb || address.state_district || address.locality || address.county;
                    const allCitiesList = Object.values(citiesByState).flat();

                    let matchedCity = null;
                    if (detectedCity) {
                        matchedCity = allCitiesList.find(city => 
                            city.toLowerCase() === detectedCity.toLowerCase()
                        ) || allCitiesList.find(city => 
                            city.toLowerCase().includes(detectedCity.toLowerCase()) ||
                            detectedCity.toLowerCase().includes(city.toLowerCase())
                        );
                    }
                    
                    const finalLocation = matchedCity || detectedCity || 'Mumbai';
                    const displayLocation = getDisplayNameForCity(finalLocation);
                    
                    onLocationChange(displayLocation);
                    addToast(`Location detected: ${displayLocation}`, 'success');
                    setIsDetecting(false);
                    onClose();
                    
                } catch (error) {
                    console.error('Reverse geocoding error:', error);
                    const nearestCity = getDisplayNameForCity(findNearestCity(latitude, longitude));
                    onLocationChange(nearestCity);
                    addToast(`Location detected: ${nearestCity}`, 'success');
                    setIsDetecting(false);
                    onClose();
                }
            },
            (error) => {
                console.error('Geolocation error:', error);
                let errorMessage = 'Unable to retrieve your location. ';
                if (error.code === 1) {
                    errorMessage += 'Please allow location access in your browser settings.';
                } else if (error.code === 2) {
                    errorMessage += 'Location unavailable.';
                } else if (error.code === 3) {
                    errorMessage += 'Location request timed out.';
                } else {
                    errorMessage += 'Please select manually.';
                }
                addToast(errorMessage, 'error');
                setIsDetecting(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    };
    
    const findNearestCity = (lat: number, lon: number): string => {
        const majorCities: { name: string; lat: number; lon: number }[] = [
            { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
            { name: 'Delhi', lat: 28.7041, lon: 77.1025 },
            { name: 'Bangalore', lat: 12.9716, lon: 77.5946 },
            { name: 'Hyderabad', lat: 17.3850, lon: 78.4867 },
            { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
            { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
            { name: 'Pune', lat: 18.5204, lon: 73.8567 },
            { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714 },
        ];
        
        const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };
        
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
    
    const handleSave = () => {
        if (selectedOption === 'detect') {
            // Trigger location detection
            console.log('Detect automatically selected, starting detection...');
            handleDetectLocation();
            return;
        }
        
        if (selectedOption === 'all') {
            onLocationChange('All of India');
            addToast('Location set to All of India', 'success');
            onClose();
            return;
        }

        if (selectedOption === 'district' && selectedDistrict) {
            const stateName = indianStates.find(s => s.code === selectedDistrict)?.name || selectedDistrict;
            onLocationChange(stateName);
            addToast(`Location set to ${stateName}`, 'success');
            onClose();
            return;
        }

        if (selectedOption === 'city' && selectedCity) {
        const displayName = getDisplayNameForCity(selectedCity);
        onLocationChange(displayName);
            addToast(`Location set to ${displayName}`, 'success');
        onClose();
            return;
        }
        
        addToast('Please select a location option', 'info');
    };

    const handleCitySelect = (cityName: string) => {
        setSelectedOption('city');
        setSelectedCity(cityName);
        setSearchTerm('');
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/50 z-[9999]" 
            onClick={onClose}
            style={{ 
                zIndex: 9999,
                willChange: 'opacity',
                contain: 'layout style paint'
            }}
        >
            <div 
                className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col absolute top-4 left-1/2 -translate-x-1/2" 
                onClick={e => e.stopPropagation()}
                style={{ 
                    maxWidth: '420px',
                    minHeight: '400px',
                    willChange: 'transform',
                    contain: 'layout style paint'
                }}
            >
                {/* Header */}
                <div 
                    className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0"
                    style={{ minHeight: '60px' }}
                >
                    <h2 className="text-lg font-semibold text-gray-900">My city</h2>
                    <button 
                        onClick={onClose} 
                        className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                        aria-label="Close"
                    >
                        <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className="h-5 w-5 text-gray-500" 
                            viewBox="0 0 20 20" 
                            fill="currentColor"
                        >
                            <path 
                                fillRule="evenodd" 
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" 
                                clipRule="evenodd" 
                            />
                        </svg>
                    </button>
                </div>

                {/* Search Input */}
                <div 
                    className="px-6 py-4 border-b border-gray-200 flex-shrink-0"
                    style={{ minHeight: '72px' }}
                >
                    <div className="relative">
                            <input
                                type="text"
                                value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                if (e.target.value) {
                                    setSelectedOption('city');
                                }
                            }}
                            placeholder="City or district"
                            className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className="h-5 w-5 text-gray-400 absolute right-3 top-1/2 transform -translate-y-1/2" 
                            viewBox="0 0 20 20" 
                            fill="currentColor"
                        >
                            <path 
                                fillRule="evenodd" 
                                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" 
                                clipRule="evenodd" 
                            />
                        </svg>
                    </div>
                </div>

                {/* Options List */}
                <div 
                    className="flex-1 overflow-y-auto px-6 py-4"
                    style={{ 
                        minHeight: '200px',
                        contain: 'layout style'
                    }}
                >
                    <div className="space-y-1">
                        {/* Detect automatically */}
                        <label className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-50 cursor-pointer">
                            <input
                                type="radio"
                                name="location"
                                value="detect"
                                checked={selectedOption === 'detect'}
                                onChange={() => {
                                    setSelectedOption('detect');
                                    // Optionally trigger detection immediately
                                    // handleDetectLocation();
                                }}
                                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-900">Detect automatically</span>
                            {isDetecting && selectedOption === 'detect' && (
                                <span className="ml-auto text-xs text-blue-600">Detecting...</span>
                            )}
                        </label>

                        {/* All of India */}
                        <label className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-50 cursor-pointer">
                            <input
                                type="radio"
                                name="location"
                                value="all"
                                checked={selectedOption === 'all'}
                                onChange={() => setSelectedOption('all')}
                                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-900">All of India</span>
                        </label>

                        {/* District Options */}
                        {popularDistricts.map((district) => (
                            <div key={district.code}>
                                <label className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-50 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="location"
                                        value={`district-${district.code}`}
                                        checked={selectedOption === 'district' && selectedDistrict === district.code}
                                        onChange={() => {
                                            setSelectedOption('district');
                                            setSelectedDistrict(district.code);
                                        }}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-900">{district.name}</span>
                                </label>

                                {/* District Cities List */}
                                {selectedOption === 'district' && selectedDistrict === district.code && districtCities.length > 0 && (
                                    <div className="ml-7 mt-1 max-h-60 overflow-y-auto space-y-1">
                                        {districtCities.map((city) => (
                                            <label
                                                key={city}
                                                className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer"
                                                onClick={() => {
                                                    setSelectedOption('city');
                                                    setSelectedCity(city);
                                                }}
                                            >
                                                <input
                                                    type="radio"
                                                    name="location-city"
                                                    checked={selectedCity === city}
                                                    onChange={() => {
                                                        setSelectedOption('city');
                                                        setSelectedCity(city);
                                                    }}
                                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">{city}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                        </div>
                        ))}

                        {/* Search Results / City List */}
                        {searchTerm && filteredCities.length > 0 && (
                            <div className="mt-2 space-y-1">
                                {filteredCities.map(({ city, stateCode }) => (
                                    <label
                                        key={`${city}-${stateCode}`}
                                        className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer"
                                        onClick={() => handleCitySelect(city)}
                                    >
                                        <input
                                            type="radio"
                                            name="location-city"
                                            checked={selectedOption === 'city' && selectedCity === city}
                                            onChange={() => handleCitySelect(city)}
                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">{city}</span>
                                    </label>
                                ))}
                            </div>
                        )}

                        {/* Show popular cities when search is active or city option is selected */}
                        {searchTerm && filteredCities.length === 0 && (
                            <div className="p-3 text-sm text-gray-500 text-center">
                                No cities found matching "{searchTerm}"
                                    </div>
                        )}
                        </div>
                    </div>

                {/* Footer Buttons */}
                <div 
                    className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0"
                    style={{ minHeight: '68px' }}
                >
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isDetecting}
                        className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isDetecting ? 'Detecting...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LocationModal;
