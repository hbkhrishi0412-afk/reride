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

const REVERSE_GEO_DETECT_TIMEOUT_MS = 7000;

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
    const [selectedOption, setSelectedOption] = useState<LocationOption>('all');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedCity, setSelectedCity] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isDetecting, setIsDetecting] = useState(false);
    const [liveResults, setLiveResults] = useState<LocationSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedLiveResult, setSelectedLiveResult] = useState<LocationSearchResult | null>(null);
    /** State whose city sub-list is expanded (independent of city vs state-only selection). */
    const [expandedDistrict, setExpandedDistrict] = useState('');
    const [useMobileSheet, setUseMobileSheet] = useState(false);
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
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(max-width: 640px)');
        const update = () => setUseMobileSheet(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
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
            setSelectedOption('all');
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

        const finishDetecting = () => {
            detectingInFlightRef.current = false;
            if (detectGenerationRef.current === myGen) {
                setIsDetecting(false);
            }
        };

        const applyDetected = (displayLocation: string) => {
            if (detectGenerationRef.current !== myGen) return;
            finishDetecting();
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

                let displayLocation = snap;
                try {
                    const address = await Promise.race([
                        fetchReverseGeocodeAddress(latitude, longitude),
                        new Promise<never>((_, reject) => {
                            window.setTimeout(() => reject(new Error('reverse-geocode-timeout')), REVERSE_GEO_DETECT_TIMEOUT_MS);
                        }),
                    ]);
                    displayLocation = resolveDisplayLocationFromAddress(
                        address,
                        allCities,
                        indianStates,
                        latitude,
                        longitude,
                    );
                } catch {
                    /* use nearest-catalog snap */
                }

                applyDetected(displayLocation);
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
                finishDetecting();
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
        onLocationChange(label);
        addToast(t('locationModal.toast.setTo', { place: label }), 'success');
        onClose();
    };

    if (!isOpen) return null;

    const isSearchMode = searchTerm.trim().length > 0;
    const detectBusy = isDetecting && selectedOption === 'detect';
    const sectionLabel = 'px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500';
    const checkIcon = (
        <svg className="h-4 w-4 shrink-0 text-blue-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
    );
    const pinIcon = (className: string) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
        </svg>
    );

    const renderCityRow = (city: string, stateCode: string, stateName?: string) => {
        const selected = isCityRowSelected(city, stateCode);
        return (
            <button
                key={`${city}-${stateCode}`}
                type="button"
                aria-pressed={selected}
                onClick={() => handleCitySelect(city, stateCode, true)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors touch-manipulation ${
                    selected ? 'bg-blue-50 font-semibold text-blue-900' : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                }`}
            >
                <span className="min-w-0 truncate">
                    {getDisplayNameForCity(city)}
                    {stateName && <span className="font-normal text-gray-500"> Â· {stateName}</span>}
                </span>
                {selected && checkIcon}
            </button>
        );
    };

    return (
        <div
            className={`fixed inset-0 bg-black/50 z-modal ${useMobileSheet ? 'flex items-end' : ''}`}
            onClick={onClose}
            style={{
                zIndex: 9999,
                willChange: 'opacity',
                contain: 'layout style paint'
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="location-modal-title"
                className={`bg-white shadow-2xl w-full flex flex-col notranslate ${
                    useMobileSheet
                        ? 'max-h-[min(92vh,720px)] rounded-t-2xl'
                        : 'rounded-xl max-w-md max-h-[85vh] absolute top-[6vh] left-1/2 -translate-x-1/2'
                }`}
                onClick={e => e.stopPropagation()}
                data-no-translate
                translate="no"
                style={{
                    maxWidth: useMobileSheet ? '100%' : '420px',
                    minHeight: useMobileSheet ? undefined : '400px',
                    willChange: 'transform',
                    contain: 'layout style paint',
                    paddingBottom: useMobileSheet ? 'env(safe-area-inset-bottom, 0px)' : undefined,
                }}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 flex-shrink-0">
                    <div className="min-w-0">
                        <h2 id="location-modal-title" className="text-lg font-semibold text-gray-900">{t('locationModal.title')}</h2>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-gray-500">
                            {pinIcon('h-3.5 w-3.5 shrink-0 text-gray-400')}
                            {t('locationModal.current', {
                                defaultValue: 'Currently: {{place}}',
                                place: currentLocation.trim() || t('locationModal.allIndia'),
                            })}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="-mr-1 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                        aria-label={t('locationModal.close')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                {/* Search */}
                <div className="px-5 pb-3 border-b border-gray-200 flex-shrink-0">
                    <div className="relative">
                        <svg xmlns="http://www.w3.org/2000/svg" className="pointer-events-none h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                        <input
                            type="search"
                            value={searchTerm}
                            autoFocus={!useMobileSheet}
                            aria-label={t('locationModal.searchPlaceholder')}
                            onChange={(e) => {
                                markUserEdited();
                                const val = e.target.value;
                                setSearchTerm(val);
                                setSelectedLiveResult(null);
                                if (val) {
                                    // Typing replaces any earlier pick so Save uses what was typed.
                                    setSelectedOption('city');
                                    setSelectedCity('');
                                    setSelectedDistrict('');
                                }
                                debouncedSearch(val);
                            }}
                            placeholder={t('locationModal.searchPlaceholder')}
                            className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2.5 pl-10 pr-10 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [&::-webkit-search-cancel-button]:hidden"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchTerm('');
                                    setSelectedLiveResult(null);
                                    debouncedSearch('');
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                                aria-label={t('locationModal.clearSearch', { defaultValue: 'Clear search' })}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div
                    className="flex-1 overflow-y-auto px-5 py-4"
                    style={{ minHeight: '200px', contain: 'layout style' }}
                >
                    {isSearchMode ? (
                        <div className="space-y-4">
                            {filteredCities.length > 0 && (
                                <section>
                                    <p className={sectionLabel}>{t('locationModal.citiesHeading', { defaultValue: 'Cities' })}</p>
                                    <div className="space-y-0.5">
                                        {filteredCities.map(({ city, stateCode }) =>
                                            renderCityRow(city, stateCode, indianStates.find((s) => s.code === stateCode)?.name || stateCode),
                                        )}
                                    </div>
                                </section>
                            )}

                            {liveResults.length > 0 && (
                                <section>
                                    <p className={`${sectionLabel} flex items-center gap-1.5`}>
                                        {pinIcon('h-3.5 w-3.5')}
                                        {t('locationModal.liveResults', { defaultValue: 'More places' })}
                                    </p>
                                    <div className="space-y-0.5">
                                        {liveResults.map((result) => {
                                            const label = result.city && result.state
                                                ? `${result.city}, ${result.state}`
                                                : result.displayName.split(',').slice(0, 3).join(',').trim();
                                            const isSelected = selectedLiveResult?.placeId === result.placeId;
                                            return (
                                                <button
                                                    key={result.placeId}
                                                    type="button"
                                                    aria-pressed={isSelected}
                                                    onClick={() => handleLiveResultSelect(result)}
                                                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                                                        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50 active:bg-gray-100'
                                                    }`}
                                                >
                                                    {pinIcon('h-4 w-4 text-gray-400 flex-shrink-0')}
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-sm text-gray-900">{label}</span>
                                                        {result.displayName !== label && (
                                                            <span className="block truncate text-xs text-gray-400">{result.displayName}</span>
                                                        )}
                                                    </span>
                                                    {isSelected && checkIcon}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            {isSearching && (
                                <div className="flex items-center justify-center gap-2 p-3 text-sm text-gray-400" role="status">
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    {t('locationModal.searching', { defaultValue: 'Searching locations...' })}
                                </div>
                            )}

                            {filteredCities.length === 0 && liveResults.length === 0 && !isSearching && (
                                <div className="p-6 text-center text-sm text-gray-500">
                                    {t('locationModal.noCities', { term: searchTerm })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {/* Quick options */}
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    aria-pressed={selectedOption === 'detect'}
                                    disabled={detectBusy}
                                    onClick={() => {
                                        markUserEdited();
                                        setSelectedOption('detect');
                                        handleDetectLocation();
                                    }}
                                    className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors disabled:cursor-wait ${
                                        selectedOption === 'detect'
                                            ? 'border-blue-300 bg-blue-50 text-blue-900'
                                            : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    {detectBusy ? (
                                        <svg className="h-5 w-5 shrink-0 animate-spin text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0 text-blue-600" aria-hidden>
                                            <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.05 11H1v2h2.05A8.994 8.994 0 0 0 11 20.95V23h2v-2.05A8.994 8.994 0 0 0 20.95 13H23v-2h-2.05zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
                                        </svg>
                                    )}
                                    <span className="min-w-0 font-medium leading-tight">
                                        {detectBusy ? t('locationModal.detecting') : t('locationModal.autoDetect')}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={selectedOption === 'all'}
                                    onClick={() => {
                                        markUserEdited();
                                        setSelectedOption('all');
                                        setExpandedDistrict('');
                                        setSelectedDistrict('');
                                        setSelectedCity('');
                                        onLocationChange('All of India');
                                        addToast(t('locationModal.toast.allIndiaSet'), 'success');
                                        onClose();
                                    }}
                                    className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-left text-sm transition-colors ${
                                        selectedOption === 'all'
                                            ? 'border-blue-300 bg-blue-50 text-blue-900'
                                            : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    <span className="flex min-w-0 items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-blue-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                                        </svg>
                                        <span className="font-medium leading-tight">{t('locationModal.allIndia')}</span>
                                    </span>
                                    {selectedOption === 'all' && checkIcon}
                                </button>
                            </div>

                            {/* Major cities */}
                            {tier1CityQuickPicks.length > 0 && (
                                <section>
                                    <p className={sectionLabel}>{t('locationModal.majorCities', { defaultValue: 'Popular cities' })}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {tier1CityQuickPicks.map(({ displayName, city, stateCode }) => (
                                            <button
                                                key={`${displayName}-${stateCode}`}
                                                type="button"
                                                aria-pressed={isCityRowSelected(city, stateCode)}
                                                onClick={() => handleCitySelect(city, stateCode, true)}
                                                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                                                    isCityRowSelected(city, stateCode)
                                                        ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                                                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                                                }`}
                                            >
                                                {displayName}
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Browse by state */}
                            <section>
                                <p className={sectionLabel}>{t('locationModal.browseStates', { defaultValue: 'Browse by state' })}</p>
                                <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                                    {browseStates.map((district) => {
                                        const cities = citiesByState[district.code] || [];
                                        const expanded = expandedDistrict === district.code;
                                        const active = isStateRowActive(district.code);
                                        return (
                                            <div key={district.code}>
                                                <button
                                                    type="button"
                                                    aria-expanded={expanded}
                                                    onClick={() => {
                                                        if (expanded) {
                                                            setExpandedDistrict('');
                                                            return;
                                                        }
                                                        markUserEdited();
                                                        if (selectedDistrict !== district.code) {
                                                            setSelectedOption('district');
                                                            setSelectedDistrict(district.code);
                                                            setSelectedCity('');
                                                            setSelectedLiveResult(null);
                                                        }
                                                        setExpandedDistrict(district.code);
                                                    }}
                                                    className={`flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm transition-colors ${
                                                        active ? 'bg-blue-50 font-semibold text-blue-900' : 'text-gray-900 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <span className="min-w-0 truncate">{district.name}</span>
                                                    <span className="flex shrink-0 items-center gap-2 text-xs font-normal text-gray-400">
                                                        {cities.length > 0 && cities.length}
                                                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                                        </svg>
                                                    </span>
                                                </button>
                                                {expanded && cities.length > 0 && (
                                                    <div className="max-h-60 overflow-y-auto space-y-0.5 bg-gray-50/60 px-2 py-2">
                                                        {cities.map((city) => renderCityRow(city, district.code))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div
                    className="px-5 py-3 border-t border-gray-200 flex items-center gap-3 flex-shrink-0"
                    style={{ minHeight: '64px' }}
                >
                    <p className="min-w-0 flex-1 truncate text-sm text-gray-600" aria-live="polite">
                        {pendingSelectionLabel && (
                            <span className="font-semibold text-blue-900">{t('locationModal.selectedPreview', { place: pendingSelectionLabel })}</span>
                        )}
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        {t('locationModal.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={detectBusy}
                        className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {detectBusy
                            ? t('locationModal.detecting')
                            : selectedOption === 'detect'
                              ? t('locationModal.detectAction', { defaultValue: 'Detect location' })
                              : t('locationModal.save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LocationModal;
