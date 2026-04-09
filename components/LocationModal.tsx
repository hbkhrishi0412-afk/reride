import React, { useState, useMemo, useEffect, useRef } from 'react';
import { getDisplayNameForCity, primaryLocationLabel } from '../utils/cityMapping';
import { INDIAN_STATES, CITIES_BY_STATE } from '../constants/location.js';

interface LocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentLocation: string;
    onLocationChange: (location: string) => void;
    addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

type LocationOption = 'detect' | 'all' | 'district' | 'city';

function formatCityAndState(
    cityCanonical: string,
    stateCode: string,
    states: Array<{ name: string; code: string }>
): string {
    const displayCity = getDisplayNameForCity(cityCanonical);
    const stateName = states.find((s) => s.code === stateCode)?.name;
    return stateName ? `${displayCity}, ${stateName}` : displayCity;
}

const LocationModal: React.FC<LocationModalProps> = ({ isOpen, onClose, currentLocation, onLocationChange, addToast }) => {
    const [selectedOption, setSelectedOption] = useState<LocationOption>('detect');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedCity, setSelectedCity] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isDetecting, setIsDetecting] = useState(false);
    const userEditedRef = useRef(false);
    const prevIsOpenRef = useRef(false);

    const markUserEdited = () => {
        userEditedRef.current = true;
    };

    const indianStates = INDIAN_STATES;
    const citiesByState = CITIES_BY_STATE;

    useEffect(() => {
        const body = document.body;
        if (body) body.style.overflow = isOpen ? 'hidden' : '';
        return () => {
            if (document.body) document.body.style.overflow = '';
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

    // Reflect header location when the modal opens; re-sync when lazy location data loads unless the user already changed something.
    useEffect(() => {
        if (!isOpen) {
            prevIsOpenRef.current = false;
            userEditedRef.current = false;
            return;
        }

        const opening = !prevIsOpenRef.current;
        prevIsOpenRef.current = true;
        if (opening) userEditedRef.current = false;

        if (userEditedRef.current) return;

        const loc = currentLocation.trim();
        const locPrimary = primaryLocationLabel(loc);
        if (!loc) {
            setSelectedOption('detect');
            setSelectedDistrict('');
            setSelectedCity('');
            setSearchTerm('');
            return;
        }
        if (/^all of india$/i.test(loc)) {
            setSelectedOption('all');
            setSelectedDistrict('');
            setSelectedCity('');
            setSearchTerm('');
            return;
        }

        const stateExact = indianStates.find((s) => s.name.toLowerCase() === loc.toLowerCase());
        if (stateExact) {
            setSelectedOption('district');
            setSelectedDistrict(stateExact.code);
            setSelectedCity('');
            setSearchTerm('');
            return;
        }

        const locLower = loc.toLowerCase();
        const primaryLower = locPrimary.toLowerCase();

        const cityHit = allCities.find(
            (c) =>
                c.city.toLowerCase() === locLower ||
                c.city.toLowerCase() === primaryLower ||
                formatCityAndState(c.city, c.stateCode, indianStates).toLowerCase() === locLower
        );
        if (cityHit) {
            setSelectedOption('city');
            setSelectedCity(cityHit.city);
            setSelectedDistrict(cityHit.stateCode);
            setSearchTerm('');
            return;
        }

        for (const row of allCities) {
            const disp = getDisplayNameForCity(row.city).toLowerCase();
            if (disp === locLower || disp === primaryLower) {
                setSelectedOption('city');
                setSelectedCity(row.city);
                setSelectedDistrict(row.stateCode);
                setSearchTerm('');
                return;
            }
        }

        setSelectedOption('city');
        setSelectedCity(locPrimary);
        setSelectedDistrict('');
        setSearchTerm('');
    }, [isOpen, currentLocation, indianStates, allCities]);

    // Filter cities: match canonical name, display alias (e.g. Bangalore ↔ Bengaluru), or state name
    const filteredCities = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) {
            if (selectedOption === 'district' && selectedDistrict) {
                return citiesByState[selectedDistrict]?.map((city) => ({ city, stateCode: selectedDistrict })) || [];
            }
            return [];
        }
        const cityMatchesSearch = (city: string) => {
            const c = city.toLowerCase();
            const disp = getDisplayNameForCity(city).toLowerCase();
            return c.includes(term) || disp.includes(term);
        };
        const fromCities = allCities.filter(({ city }) => cityMatchesSearch(city));
        const fromStates: Array<{ city: string; stateCode: string }> = [];
        for (const s of indianStates) {
            if (s.name.toLowerCase().includes(term)) {
                for (const city of citiesByState[s.code] || []) {
                    fromStates.push({ city, stateCode: s.code });
                }
            }
        }
        const seen = new Set<string>();
        const merged: Array<{ city: string; stateCode: string }> = [];
        for (const x of [...fromStates, ...fromCities]) {
            const k = `${x.city}-${x.stateCode}`;
            if (!seen.has(k)) {
                seen.add(k);
                merged.push(x);
            }
        }
        const rank = (row: { city: string; stateCode: string }) => {
            const c = row.city.toLowerCase();
            const d = getDisplayNameForCity(row.city).toLowerCase();
            if (c === term || d === term) return 0;
            if (c.startsWith(term) || d.startsWith(term)) return 1;
            if (c.includes(term) || d.includes(term)) return 2;
            return 3;
        };
        merged.sort((a, b) => rank(a) - rank(b));
        return merged.slice(0, 200);
    }, [searchTerm, allCities, selectedDistrict, selectedOption, citiesByState, indianStates]);

    // All states & UTs (A–Z) for pan-India browsing; search still narrows cities quickly
    const browseStates = useMemo(
        () => [...indianStates].sort((a, b) => a.name.localeCompare(b.name)),
        [indianStates],
    );

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
                    const row = allCities.find(
                        (c) => c.city.toLowerCase() === (matchedCity || finalLocation).toLowerCase()
                    );
                    const displayLocation = row
                        ? formatCityAndState(row.city, row.stateCode, indianStates)
                        : getDisplayNameForCity(finalLocation);

                    onLocationChange(displayLocation);
                    addToast(`Location detected: ${displayLocation}`, 'success');
                    setIsDetecting(false);
                    onClose();
                    
                } catch (error) {
                    console.error('Reverse geocoding error:', error);
                    const nearest = findNearestCity(latitude, longitude);
                    const row = allCities.find((c) => c.city.toLowerCase() === nearest.toLowerCase());
                    const nearestLabel = row
                        ? formatCityAndState(row.city, row.stateCode, indianStates)
                        : getDisplayNameForCity(nearest);
                    onLocationChange(nearestLabel);
                    addToast(`Location detected: ${nearestLabel}`, 'success');
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

        if (selectedOption === 'city') {
            let city = selectedCity;
            let stateCode = selectedDistrict;
            const term = searchTerm.trim();
            if (!city && term) {
                const tl = term.toLowerCase();
                const exact = allCities.filter(({ city: c }) => c.toLowerCase() === tl);
                if (exact.length === 1) {
                    city = exact[0].city;
                    stateCode = exact[0].stateCode;
                } else {
                    const byDisplay = allCities.filter(
                        ({ city: c }) => getDisplayNameForCity(c).toLowerCase() === tl
                    );
                    if (byDisplay.length === 1) {
                        city = byDisplay[0].city;
                        stateCode = byDisplay[0].stateCode;
                    } else {
                        const starts = allCities.filter(({ city: c }) => c.toLowerCase().startsWith(tl));
                        if (starts.length === 1) {
                            city = starts[0].city;
                            stateCode = starts[0].stateCode;
                        } else {
                            const dispStarts = allCities.filter(({ city: c }) =>
                                getDisplayNameForCity(c).toLowerCase().startsWith(tl)
                            );
                            if (dispStarts.length === 1) {
                                city = dispStarts[0].city;
                                stateCode = dispStarts[0].stateCode;
                            }
                        }
                    }
                }
            }
            if (city) {
                const sc = stateCode || allCities.find((c) => c.city === city)?.stateCode;
                const label = sc ? formatCityAndState(city, sc, indianStates) : getDisplayNameForCity(city);
                onLocationChange(label);
                addToast(`Location set to ${label}`, 'success');
                onClose();
                return;
            }
        }

        addToast('Please select a city from the list or choose a state / All of India', 'info');
    };

    const handleCitySelect = (cityName: string, stateCode: string) => {
        markUserEdited();
        setSelectedOption('city');
        setSelectedCity(cityName);
        setSelectedDistrict(stateCode);
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
                                markUserEdited();
                                setSearchTerm(e.target.value);
                                if (e.target.value) {
                                    setSelectedOption('city');
                                }
                            }}
                            placeholder="City or state"
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
                                    markUserEdited();
                                    setSelectedOption('detect');
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
                                onChange={() => {
                                    markUserEdited();
                                    setSelectedOption('all');
                                }}
                                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-900">All of India</span>
                        </label>

                        {/* District Options */}
                        {browseStates.map((district) => (
                            <div key={district.code}>
                                <label className="flex items-center gap-3 p-3 rounded-md hover:bg-gray-50 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="location"
                                        value={`district-${district.code}`}
                                        checked={selectedOption === 'district' && selectedDistrict === district.code}
                                        onChange={() => {
                                            markUserEdited();
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
                                                    markUserEdited();
                                                    setSelectedOption('city');
                                                    setSelectedCity(city);
                                                    setSelectedDistrict(district.code);
                                                }}
                                            >
                                                <input
                                                    type="radio"
                                                    name="location-city"
                                                    checked={selectedCity === city}
                                                    onChange={() => {
                                                        markUserEdited();
                                                        setSelectedOption('city');
                                                        setSelectedCity(city);
                                                        setSelectedDistrict(district.code);
                                                    }}
                                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">
                                                    {getDisplayNameForCity(city)}
                                                    <span className="text-gray-500"> — {district.name}</span>
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                        </div>
                        ))}

                        {/* Search Results / City List */}
                        {searchTerm && filteredCities.length > 0 && (
                            <div className="mt-2 space-y-1">
                                {filteredCities.map(({ city, stateCode }) => {
                                    const stateName = indianStates.find((s) => s.code === stateCode)?.name || stateCode;
                                    const line = `${getDisplayNameForCity(city)} — ${stateName}`;
                                    return (
                                        <label
                                            key={`${city}-${stateCode}`}
                                            className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer"
                                            onClick={() => handleCitySelect(city, stateCode)}
                                        >
                                            <input
                                                type="radio"
                                                name="location-city"
                                                checked={selectedOption === 'city' && selectedCity === city}
                                                onChange={() => handleCitySelect(city, stateCode)}
                                                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">{line}</span>
                                        </label>
                                    );
                                })}
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
