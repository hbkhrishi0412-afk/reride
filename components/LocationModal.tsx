import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getDisplayNameForCity, primaryLocationLabel } from '../utils/cityMapping';
import { INDIAN_STATES, CITIES_BY_STATE, CITY_COORDINATES } from '../constants/location.js';
import { supportEmail } from '../constants/legalContact';
import { calculateDistance } from '../services/locationService';
import { getCurrentPositionUnified } from '../utils/getCurrentPositionUnified';
import { isCapacitorNativeApp } from '../utils/isCapacitorNative';

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

/** When reverse-geocode fails, snap to the nearest city with known coordinates (pan-India coverage). */
function labelFromNearestCatalogCoordinate(
  lat: number,
  lon: number,
  allCities: Array<{ city: string; stateCode: string }>,
  indianStates: Array<{ name: string; code: string }>
): string {
  let bestName = 'Mumbai';
  let bestD = Infinity;
  for (const [name, c] of Object.entries(CITY_COORDINATES)) {
    const d = calculateDistance(
      { lat, lng: lon },
      { lat: c.lat, lng: c.lng }
    );
    if (d < bestD) {
      bestD = d;
      bestName = name;
    }
  }
  const display = getDisplayNameForCity(bestName);
  const row = allCities.find(
    (r) => getDisplayNameForCity(r.city).toLowerCase() === display.toLowerCase()
  );
  if (row) {
    return formatCityAndState(row.city, row.stateCode, indianStates);
  }
  return getDisplayNameForCity(bestName);
}

/** Nominatim public policy: be gentle (≈1 req/s). Spacing is enforced between outbound calls. */
let lastNominatimRequestAt = 0;
const NOMINATIM_MIN_INTERVAL_MS = 1100;

async function waitForNominatimSlot(): Promise<void> {
  const elapsed = Date.now() - lastNominatimRequestAt;
  if (elapsed < NOMINATIM_MIN_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, NOMINATIM_MIN_INTERVAL_MS - elapsed));
  }
  lastNominatimRequestAt = Date.now();
}

/** Single reverse request — fast failure so we fall back to nearest catalog city (offline-friendly). */
async function fetchNominatimReverse(latitude: number, longitude: number): Promise<Response> {
  const buildUrl = () =>
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
      String(latitude)
    )}&lon=${encodeURIComponent(String(longitude))}&zoom=14&addressdetails=1&accept-language=en&email=${encodeURIComponent(
      supportEmail
    )}`;

  await waitForNominatimSlot();
  const ac = new AbortController();
  const httpTimeout = window.setTimeout(() => ac.abort(), 6500);
  try {
    return await fetch(buildUrl(), {
      signal: ac.signal,
      headers: {
        'User-Agent': 'ReRide-App/1.0 (https://www.reride.co.in)',
        Accept: 'application/json',
        'Accept-Language': 'en,en-IN,en-GB',
      },
    });
  } finally {
    clearTimeout(httpTimeout);
  }
}

const LocationModal: React.FC<LocationModalProps> = ({ isOpen, onClose, currentLocation, onLocationChange, addToast }) => {
    const { t } = useTranslation();
    const [selectedOption, setSelectedOption] = useState<LocationOption>('detect');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedCity, setSelectedCity] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isDetecting, setIsDetecting] = useState(false);
    const detectingInFlightRef = useRef(false);
    const detectGenerationRef = useRef(0);
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

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    /** Abort stale detection when modal closes or user switches away from auto-detect. */
    useEffect(() => {
        if (!isOpen) {
            detectGenerationRef.current += 1;
            detectingInFlightRef.current = false;
            setIsDetecting(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || selectedOption === 'detect') return;
        detectGenerationRef.current += 1;
        detectingInFlightRef.current = false;
        setIsDetecting(false);
    }, [selectedOption, isOpen]);

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
        if (detectingInFlightRef.current) return;
        if (!isCapacitorNativeApp() && typeof navigator !== 'undefined' && !navigator.geolocation) {
            addToast(t('locationModal.geoNotSupported'), 'error');
            return;
        }

        const myGen = detectGenerationRef.current;
        detectingInFlightRef.current = true;
        setIsDetecting(true);

        const geoErrorTKey = (code: number) => {
            if (code === 1) {
                return isCapacitorNativeApp()
                    ? 'locationModal.error.deniedApp'
                    : 'locationModal.error.denied';
            }
            if (code === 2) return 'locationModal.error.unavailable';
            if (code === 3) return 'locationModal.error.timeout';
            return 'locationModal.error.fallback';
        };

        const finishSpinner = () => {
            if (detectGenerationRef.current !== myGen) return;
            detectingInFlightRef.current = false;
            setIsDetecting(false);
        };

        const applyDetected = (displayLocation: string) => {
            if (detectGenerationRef.current !== myGen) return;
            detectingInFlightRef.current = false;
            setIsDetecting(false);
            onLocationChange(displayLocation);
            addToast(t('locationModal.toast.detected', { place: displayLocation }), 'success');
            onClose();
        };

        void (async () => {
            try {
                const position = await getCurrentPositionUnified();
                if (detectGenerationRef.current !== myGen) return;

                const { latitude, longitude } = position.coords;
                const allCitiesList = Object.values(citiesByState).flat();
                const resolveLabel = (lat: number, lon: number) =>
                    labelFromNearestCatalogCoordinate(lat, lon, allCities, indianStates);
                const snap = resolveLabel(latitude, longitude);

                const NOMINATIM_BUDGET_MS = 9000;
                try {
                    const response = await Promise.race([
                        fetchNominatimReverse(latitude, longitude),
                        new Promise<Response>((_, rej) =>
                            window.setTimeout(() => rej(new Error('nominatim-timeout')), NOMINATIM_BUDGET_MS)
                        ),
                    ]);

                    if (!response.ok) {
                        throw new Error('Geocoding failed');
                    }

                    const contentType = response.headers.get('content-type');
                    if (!contentType || !contentType.includes('application/json')) {
                        throw new Error('Geocoding API returned non-JSON response');
                    }

                    const data = (await response.json()) as { address?: Record<string, string> };
                    const address = data.address || {};
                    const detectedCity =
                        address.city ||
                        address.town ||
                        address.municipality ||
                        address.city_district ||
                        address.district ||
                        address.village ||
                        address.suburb ||
                        address.neighbourhood ||
                        address.locality ||
                        address.state_district ||
                        address.county;

                    let matchedCity: string | null = null;
                    if (detectedCity) {
                        const dLower = String(detectedCity).toLowerCase();
                        matchedCity =
                            allCitiesList.find((city) => city.toLowerCase() === dLower) ||
                            allCitiesList.find(
                                (city) => getDisplayNameForCity(city).toLowerCase() === dLower
                            ) ||
                            allCitiesList.find(
                                (city) =>
                                    city.toLowerCase().includes(dLower) ||
                                    dLower.includes(city.toLowerCase()) ||
                                    getDisplayNameForCity(city).toLowerCase().includes(dLower)
                            ) ||
                            null;
                    }

                    const row = matchedCity
                        ? allCities.find(
                              (c) =>
                                  c.city.toLowerCase() === matchedCity!.toLowerCase() ||
                                  getDisplayNameForCity(c.city).toLowerCase() ===
                                      getDisplayNameForCity(matchedCity!).toLowerCase()
                          )
                        : null;

                    const displayLocation = row
                        ? formatCityAndState(row.city, row.stateCode, indianStates)
                        : matchedCity
                          ? getDisplayNameForCity(matchedCity)
                          : snap;

                    applyDetected(displayLocation);
                } catch {
                    applyDetected(snap);
                }
            } catch (e: unknown) {
                if (detectGenerationRef.current !== myGen) return;
                if (e && typeof e === 'object' && 'code' in e) {
                    const code = (e as GeolocationPositionError).code;
                    if (typeof code === 'number') {
                        addToast(t(geoErrorTKey(code)), 'error');
                    } else {
                        addToast(t('locationModal.error.fallback'), 'error');
                    }
                } else if (e && typeof e === 'object' && (e as Error).message === 'no-geolocation') {
                    addToast(t('locationModal.geoNotSupported'), 'error');
                } else {
                    addToast(t('locationModal.error.fallback'), 'error');
                }
            } finally {
                finishSpinner();
            }
        })();
    };
    
    const handleSave = () => {
        if (selectedOption === 'detect') {
            handleDetectLocation();
            return;
        }
        
        if (selectedOption === 'all') {
            onLocationChange('All of India');
            addToast(t('locationModal.toast.allIndiaSet'), 'success');
            onClose();
            return;
        }

        if (selectedOption === 'district' && selectedDistrict) {
            const stateName = indianStates.find(s => s.code === selectedDistrict)?.name || selectedDistrict;
            onLocationChange(stateName);
            addToast(t('locationModal.toast.setTo', { place: stateName }), 'success');
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
                addToast(t('locationModal.toast.setTo', { place: label }), 'success');
                onClose();
                return;
            }
        }

        addToast(t('locationModal.selectPrompt'), 'info');
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
                className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col absolute top-4 left-1/2 -translate-x-1/2 notranslate" 
                onClick={e => e.stopPropagation()}
                data-no-translate
                translate="no"
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
                    <h2 className="text-lg font-semibold text-gray-900">{t('locationModal.title')}</h2>
                    <button 
                        onClick={onClose} 
                        className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                        aria-label={t('locationModal.close')}
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
                            placeholder={t('locationModal.searchPlaceholder')}
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
                        {/* Auto-detect city via geolocation — row tap runs detection (same as Save) */}
                        <label
                            className="flex items-center gap-3 rounded-lg border border-gray-200/90 bg-gray-50/90 p-3 cursor-pointer transition-colors hover:bg-gray-100/90"
                            onClick={() => {
                                markUserEdited();
                                setSelectedOption('detect');
                                setSearchTerm('');
                            }}
                        >
                            <input
                                type="radio"
                                name="location"
                                value="detect"
                                checked={selectedOption === 'detect'}
                                onChange={() => {
                                    markUserEdited();
                                    setSelectedOption('detect');
                                }}
                                className="w-4 h-4 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                            />
                            <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    className="h-5 w-5 flex-shrink-0 text-gray-400"
                                    aria-hidden
                                >
                                    <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.05 11H1v2h2.05A8.994 8.994 0 0 0 11 20.95V23h2v-2.05A8.994 8.994 0 0 0 20.95 13H23v-2h-2.05zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
                                </svg>
                                <span className="text-sm text-[#3c4043]">{t('locationModal.autoDetect')}</span>
                            </div>
                            {isDetecting && selectedOption === 'detect' && (
                                <span className="flex-shrink-0 text-xs text-blue-600">{t('locationModal.detecting')}</span>
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
                            <span className="text-sm text-gray-900">{t('locationModal.allIndia')}</span>
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
                                {t('locationModal.noCities', { term: searchTerm })}
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
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                        {t('locationModal.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isDetecting && selectedOption === 'detect'}
                        className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isDetecting && selectedOption === 'detect'
                            ? t('locationModal.detecting')
                            : t('locationModal.save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LocationModal;
