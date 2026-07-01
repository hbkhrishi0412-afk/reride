import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CITY_MAPPING,
    getCityNamesForDisplay,
    getDisplayNameForCity,
    primaryLocationLabel,
} from '../utils/cityMapping';
import { INDIAN_STATES, CITIES_BY_STATE } from '../constants/location.js';
import { getCurrentPositionUnified } from '../utils/getCurrentPositionUnified';
import { isCapacitorNativeApp } from '../utils/isCapacitorNative';
import {
    fetchReverseGeocodeAddress,
    labelFromNearestCatalogCoordinate,
    resolveDisplayLocationFromAddress,
    searchLocations,
} from '../utils/reverseGeocode';
import type { LocationSearchResult } from '../utils/reverseGeocode';

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
    const { t } = useTranslation();
    const [selectedOption, setSelectedOption] = useState<LocationOption>('detect');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedCity, setSelectedCity] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isDetecting, setIsDetecting] = useState(false);
    const [liveResults, setLiveResults] = useState<LocationSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedLiveResult, setSelectedLiveResult] = useState<LocationSearchResult | null>(null);
    /** State whose city sub-list is expanded (independent of city vs state-only selection). */
    const [expandedDistrict, setExpandedDistrict] = useState('');
    const detectingInFlightRef = useRef(false);
    const detectGenerationRef = useRef(0);
    const userEditedRef = useRef(false);
    const prevIsOpenRef = useRef(false);
    const searchAbortRef = useRef<AbortController | null>(null);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const markUserEdited = () => {
        userEditedRef.current = true;
    };

    const indianStates = INDIAN_STATES;
    const citiesByState = CITIES_BY_STATE;

    const debouncedSearch = useCallback((query: string) => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (searchAbortRef.current) searchAbortRef.current.abort();

        if (!query || query.trim().length < 2) {
            setLiveResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        searchTimerRef.current = setTimeout(async () => {
            const ac = new AbortController();
            searchAbortRef.current = ac;
            try {
                const results = await searchLocations(query.trim(), ac.signal);
                if (!ac.signal.aborted) {
                    setLiveResults(results);
                    setIsSearching(false);
                }
            } catch {
                if (!ac.signal.aborted) {
                    setLiveResults([]);
                    setIsSearching(false);
                }
            }
        }, 400);
    }, []);

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

    /** Abort stale detection and live search when modal closes. */
    useEffect(() => {
        if (!isOpen) {
            detectGenerationRef.current += 1;
            detectingInFlightRef.current = false;
            setIsDetecting(false);
            setLiveResults([]);
            setSelectedLiveResult(null);
            setIsSearching(false);
            setExpandedDistrict('');
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
            if (searchAbortRef.current) searchAbortRef.current.abort();
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
            setExpandedDistrict('');
            return;
        }
        if (/^all of india$/i.test(loc)) {
            setSelectedOption('all');
            setSelectedDistrict('');
            setSelectedCity('');
            setSearchTerm('');
            setExpandedDistrict('');
            return;
        }

        const stateExact = indianStates.find((s) => s.name.toLowerCase() === loc.toLowerCase());
        if (stateExact) {
            setSelectedOption('district');
            setSelectedDistrict(stateExact.code);
            setSelectedCity('');
            setSearchTerm('');
            setExpandedDistrict(stateExact.code);
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
            setExpandedDistrict(cityHit.stateCode);
            return;
        }

        for (const row of allCities) {
            const disp = getDisplayNameForCity(row.city).toLowerCase();
            if (disp === locLower || disp === primaryLower) {
                setSelectedOption('city');
                setSelectedCity(row.city);
                setSelectedDistrict(row.stateCode);
                setSearchTerm('');
                setExpandedDistrict(row.stateCode);
                return;
            }
        }

        setSelectedOption('city');
        setSelectedCity(locPrimary);
        setSelectedDistrict('');
        setSearchTerm('');
        setExpandedDistrict('');
    }, [isOpen, currentLocation, indianStates, allCities]);

    // When a state is expanded, city search / browse is limited to that state.
    const scopedCityPool = useMemo(() => {
        if (selectedDistrict) {
            return (citiesByState[selectedDistrict] || []).map((city) => ({
                city,
                stateCode: selectedDistrict,
            }));
        }
        return allCities;
    }, [selectedDistrict, allCities, citiesByState]);

    // Filter cities: match canonical name, display alias (e.g. Bangalore ↔ Bengaluru), or state name
    const filteredCities = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) {
            if (selectedOption === 'district' && selectedDistrict) {
                return scopedCityPool;
            }
            return [];
        }
        const cityMatchesSearch = (city: string) => {
            const c = city.toLowerCase();
            const disp = getDisplayNameForCity(city).toLowerCase();
            return c.includes(term) || disp.includes(term);
        };
        const fromCities = scopedCityPool.filter(({ city }) => cityMatchesSearch(city));
        const fromStates: Array<{ city: string; stateCode: string }> = [];
        if (!selectedDistrict) {
            for (const s of indianStates) {
                if (s.name.toLowerCase().includes(term)) {
                    for (const city of citiesByState[s.code] || []) {
                        fromStates.push({ city, stateCode: s.code });
                    }
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
    }, [searchTerm, scopedCityPool, selectedDistrict, selectedOption, citiesByState, indianStates]);

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

    const tier1CityQuickPicks = useMemo(() => {
        const canonicalRows = allCities.map((row) => ({
            ...row,
            canonical: primaryLocationLabel(row.city).toLowerCase(),
        }));

        return Object.keys(CITY_MAPPING)
            .map((displayName) => {
                const aliases = getCityNamesForDisplay(displayName).map((name) =>
                    primaryLocationLabel(name).toLowerCase()
                );
                const match = canonicalRows.find((row) => aliases.includes(row.canonical));
                if (!match) return null;
                return {
                    displayName,
                    city: match.city,
                    stateCode: match.stateCode,
                };
            })
            .filter((row): row is { displayName: string; city: string; stateCode: string } => Boolean(row));
    }, [allCities]);

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
                const snap = labelFromNearestCatalogCoordinate(latitude, longitude, allCities, indianStates);

                try {
                    const address = await fetchReverseGeocodeAddress(latitude, longitude);
                    const displayLocation = resolveDisplayLocationFromAddress(
                        address,
                        allCities,
                        indianStates,
                        latitude,
                        longitude,
                    );
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
    
    const handleCitySelect = (cityName: string, stateCode: string, applyNow = false) => {
        markUserEdited();
        setSelectedOption('city');
        setSelectedCity(cityName);
        setSelectedDistrict(stateCode);
        setExpandedDistrict(stateCode);
        setSelectedLiveResult(null);
        setSearchTerm('');
        setLiveResults([]);

        if (applyNow) {
            const label = formatCityAndState(cityName, stateCode, indianStates);
            onLocationChange(label);
            addToast(t('locationModal.toast.setTo', { place: label }), 'success');
            onClose();
        }
    };

    /** Resolve city + state from search text when user typed but did not tap a row. */
    const resolveCityFromSearchTerm = (term: string): { city: string; stateCode: string } | null => {
        const tl = term.trim().toLowerCase();
        if (!tl) return null;

        const pool = selectedDistrict
            ? (citiesByState[selectedDistrict] || []).map((city) => ({ city, stateCode: selectedDistrict }))
            : allCities;

        const exact = pool.filter(({ city: c }) => c.toLowerCase() === tl);
        if (exact.length === 1) {
            return { city: exact[0].city, stateCode: exact[0].stateCode };
        }

        const byDisplay = pool.filter(
            ({ city: c }) => getDisplayNameForCity(c).toLowerCase() === tl,
        );
        if (byDisplay.length === 1) {
            return { city: byDisplay[0].city, stateCode: byDisplay[0].stateCode };
        }

        const starts = pool.filter(({ city: c }) => c.toLowerCase().startsWith(tl));
        if (starts.length === 1) {
            return { city: starts[0].city, stateCode: starts[0].stateCode };
        }

        const dispStarts = pool.filter(({ city: c }) =>
            getDisplayNameForCity(c).toLowerCase().startsWith(tl),
        );
        if (dispStarts.length === 1) {
            return { city: dispStarts[0].city, stateCode: dispStarts[0].stateCode };
        }

        return null;
    };

    const resolveManualLocationLabel = (): string | null => {
        if (selectedLiveResult) {
            const lr = selectedLiveResult;
            return lr.city && lr.state
                ? `${lr.city}, ${lr.state}`
                : lr.city || lr.displayName.split(',').slice(0, 2).join(',').trim();
        }

        let city = selectedCity;
        let stateCode = selectedDistrict;

        if (!city) {
            const fromSearch = resolveCityFromSearchTerm(searchTerm);
            if (fromSearch) {
                city = fromSearch.city;
                stateCode = fromSearch.stateCode;
            }
        }

        if (city) {
            const sc = stateCode || allCities.find((c) => c.city === city)?.stateCode;
            return sc ? formatCityAndState(city, sc, indianStates) : getDisplayNameForCity(city);
        }

        if (selectedOption === 'district' && selectedDistrict) {
            return indianStates.find((s) => s.code === selectedDistrict)?.name || selectedDistrict;
        }

        return null;
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

        const label = resolveManualLocationLabel();
        if (label) {
            onLocationChange(label);
            addToast(t('locationModal.toast.setTo', { place: label }), 'success');
            onClose();
            return;
        }

        addToast(t('locationModal.selectPrompt'), 'info');
    };

    const isStateRowActive = (stateCode: string) =>
        selectedDistrict === stateCode &&
        (selectedOption === 'district' || selectedOption === 'city');

    const isCityRowSelected = (city: string, stateCode: string) =>
        selectedOption === 'city' && selectedCity === city && selectedDistrict === stateCode;

    const pendingSelectionLabel = useMemo(
        () => resolveManualLocationLabel(),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- resolveManualLocationLabel reads selection state
        [selectedOption, selectedCity, selectedDistrict, selectedLiveResult, searchTerm, indianStates],
    );

    const handleLiveResultSelect = (result: LocationSearchResult) => {
        markUserEdited();
        setSelectedLiveResult(result);
        setSelectedOption('city');
        setSelectedCity('');
        setSelectedDistrict('');
        const label = result.city && result.state
            ? `${result.city}, ${result.state}`
            : result.city || result.displayName.split(',').slice(0, 2).join(',').trim();
        setSearchTerm(label);
        setLiveResults([]);
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
                                const val = e.target.value;
                                setSearchTerm(val);
                                setSelectedLiveResult(null);
                                if (val) {
                                    setSelectedOption('city');
                                }
                                debouncedSearch(val);
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
                        {/* Auto-detect city via geolocation — tap runs detection immediately */}
                        <div
                            role="button"
                            tabIndex={0}
                            className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                                selectedOption === 'detect'
                                    ? 'border-blue-300 bg-blue-50/80'
                                    : 'border-gray-200/90 bg-gray-50/90 hover:bg-gray-100/90'
                            }`}
                            onClick={() => {
                                markUserEdited();
                                setSelectedOption('detect');
                                setSearchTerm('');
                                handleDetectLocation();
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    markUserEdited();
                                    setSelectedOption('detect');
                                    setSearchTerm('');
                                    handleDetectLocation();
                                }
                            }}
                        >
                            <input
                                type="radio"
                                name="location"
                                value="detect"
                                checked={selectedOption === 'detect'}
                                readOnly
                                tabIndex={-1}
                                className="w-4 h-4 text-blue-600 focus:ring-blue-500 flex-shrink-0 pointer-events-none"
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
                        </div>

                        {/* All of India */}
                        <label
                            className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors ${
                                selectedOption === 'all'
                                    ? 'bg-blue-50 ring-1 ring-inset ring-blue-200'
                                    : 'hover:bg-gray-50'
                            }`}
                        >
                            <input
                                type="radio"
                                name="location"
                                value="all"
                                checked={selectedOption === 'all'}
                                onChange={() => {
                                    markUserEdited();
                                    setSelectedOption('all');
                                    setExpandedDistrict('');
                                    setSelectedDistrict('');
                                    setSelectedCity('');
                                }}
                                className="w-4 h-4 text-blue-600 focus:ring-blue-500 accent-blue-600"
                            />
                            <span className={`text-sm ${selectedOption === 'all' ? 'font-semibold text-blue-900' : 'text-gray-900'}`}>
                                {t('locationModal.allIndia')}
                            </span>
                        </label>

                        {/* Tier-1 quick picks (major cities only). Full search/states stay available below. */}
                        {tier1CityQuickPicks.length > 0 && (
                            <div className="px-1 py-2">
                                <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Major Cities
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {tier1CityQuickPicks.map(({ displayName, city, stateCode }) => (
                                        <button
                                            key={`${displayName}-${stateCode}`}
                                            type="button"
                                            onClick={() => handleCitySelect(city, stateCode, false)}
                                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                                isCityRowSelected(city, stateCode)
                                                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                                                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                                            }`}
                                        >
                                            {displayName}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* District Options */}
                        {browseStates.map((district) => (
                            <div key={district.code}>
                                <label
                                    className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors ${
                                        isStateRowActive(district.code)
                                            ? 'bg-blue-50 ring-1 ring-inset ring-blue-200'
                                            : 'hover:bg-gray-50'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="location"
                                        value={`district-${district.code}`}
                                        checked={selectedOption === 'district' && selectedDistrict === district.code}
                                        onChange={() => {
                                            markUserEdited();
                                            setSelectedOption('district');
                                            setSelectedDistrict(district.code);
                                            setSelectedCity('');
                                            setSelectedLiveResult(null);
                                            setExpandedDistrict(district.code);
                                        }}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 accent-blue-600"
                                    />
                                    <span className={`text-sm ${isStateRowActive(district.code) ? 'font-semibold text-blue-900' : 'text-gray-900'}`}>
                                        {district.name}
                                    </span>
                                </label>

                                {/* District Cities List — stays open while picking a city */}
                                {expandedDistrict === district.code && districtCities.length > 0 && (
                                    <div className="ml-7 mt-1 max-h-60 overflow-y-auto space-y-1">
                                        {districtCities.map((city) => (
                                            <button
                                                key={city}
                                                type="button"
                                                onClick={() => handleCitySelect(city, district.code, false)}
                                                className={`flex w-full items-center gap-3 p-2 rounded-md text-left transition-colors touch-manipulation ${
                                                    isCityRowSelected(city, district.code)
                                                        ? 'bg-blue-100 ring-2 ring-blue-500 shadow-sm'
                                                        : 'hover:bg-gray-50 active:bg-gray-100'
                                                }`}
                                            >
                                                <span
                                                    className={`w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                                                        isCityRowSelected(city, district.code)
                                                            ? 'border-blue-600 bg-blue-600'
                                                            : 'border-gray-300 bg-white'
                                                    }`}
                                                    aria-hidden
                                                >
                                                    {isCityRowSelected(city, district.code) ? (
                                                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    ) : null}
                                                </span>
                                                <span className={`text-sm ${isCityRowSelected(city, district.code) ? 'font-semibold text-blue-900' : 'text-gray-700'}`}>
                                                    {getDisplayNameForCity(city)}
                                                    <span className="text-gray-500"> — {district.name}</span>
                                                </span>
                                            </button>
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
                                        <button
                                            key={`${city}-${stateCode}`}
                                            type="button"
                                            onClick={() => handleCitySelect(city, stateCode, false)}
                                            className={`flex w-full items-center gap-3 p-2 rounded-md text-left transition-colors touch-manipulation ${
                                                isCityRowSelected(city, stateCode)
                                                    ? 'bg-blue-100 ring-2 ring-blue-500 shadow-sm'
                                                    : 'hover:bg-gray-50 active:bg-gray-100'
                                            }`}
                                        >
                                            <span
                                                className={`w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                                                    isCityRowSelected(city, stateCode)
                                                        ? 'border-blue-600 bg-blue-600'
                                                        : 'border-gray-300 bg-white'
                                                }`}
                                                aria-hidden
                                            >
                                                {isCityRowSelected(city, stateCode) ? (
                                                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                ) : null}
                                            </span>
                                            <span className={`text-sm ${isCityRowSelected(city, stateCode) ? 'font-semibold text-blue-900' : 'text-gray-700'}`}>{line}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Live search results from geocoding API */}
                        {searchTerm && liveResults.length > 0 && (
                            <div className="mt-3 space-y-1">
                                <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                    </svg>
                                    Live Results
                                </p>
                                {liveResults.map((result) => {
                                    const label = result.city && result.state
                                        ? `${result.city}, ${result.state}`
                                        : result.displayName.split(',').slice(0, 3).join(',').trim();
                                    const isSelected = selectedLiveResult?.placeId === result.placeId;
                                    return (
                                        <div
                                            key={result.placeId}
                                            role="button"
                                            tabIndex={0}
                                            className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                                                isSelected ? 'bg-blue-50 border border-blue-300' : 'hover:bg-gray-50'
                                            }`}
                                            onClick={() => handleLiveResultSelect(result)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    handleLiveResultSelect(result);
                                                }
                                            }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                            </svg>
                                            <div className="min-w-0 flex-1">
                                                <span className="text-sm text-gray-900 block truncate">{label}</span>
                                                {result.displayName !== label && (
                                                    <span className="text-xs text-gray-400 block truncate">{result.displayName}</span>
                                                )}
                                            </div>
                                            {isSelected && (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Searching indicator */}
                        {searchTerm && isSearching && (
                            <div className="p-3 text-sm text-gray-400 text-center flex items-center justify-center gap-2">
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Searching locations...
                            </div>
                        )}

                        {searchTerm && filteredCities.length === 0 && liveResults.length === 0 && !isSearching && (
                            <div className="p-3 text-sm text-gray-500 text-center">
                                {t('locationModal.noCities', { term: searchTerm })}
                            </div>
                        )}
                        </div>
                    </div>

                {/* Footer Buttons */}
                {pendingSelectionLabel && (
                    <div className="px-6 py-2.5 border-t border-blue-100 bg-blue-50 flex-shrink-0">
                        <p className="text-sm text-blue-900">
                            <span className="font-semibold">{t('locationModal.selectedPreview', { place: pendingSelectionLabel })}</span>
                        </p>
                    </div>
                )}
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
