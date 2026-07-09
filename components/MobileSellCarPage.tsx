import { logInfo } from '../utils/logger.js';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { View as ViewEnum } from '../types';
import { fetchCarDataFromReride, getCarData, getModelsByMake, getVariantsByModel, getIndianStates, getDistrictsByState, getCarYears, getOwnershipOptions, ScrapedCarData } from '../utils/rerideScraper';
import { sellCarAPI } from '../services/sellCarService';
import { useCamera } from '../hooks/useMobileFeatures';
import { fetchVehicleSpecs, cacheAISpecs } from '../services/vehicleSpecsService';
import { getAiVehicleSuggestions } from '../services/geminiService';
import AutoT from './AutoT';

interface MobileSellCarPageProps {
  onNavigate: (view: ViewEnum) => void;
  addToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/** Digits-only storage; display with Indian grouping (e.g. 5,00,000). */
const formatIndianPriceInput = (digits: string): string => {
  if (!digits) return '';
  return Number(digits).toLocaleString('en-IN');
};

const parsePriceDigits = (value: string): string => value.replace(/\D/g, '');

interface MobilePickerListProps {
  fieldId: string;
  label: string;
  value: string;
  emptyLabel: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** Full-screen bottom sheet (portal) — avoids WebView clipping vs fixed Continue footer + nested scroll traps. */
const MobilePickerList: React.FC<MobilePickerListProps> = ({
  fieldId,
  label,
  value,
  emptyLabel,
  options,
  onChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [portalReady, setPortalReady] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((opt) => opt.value === value);

  const showSearch = options.length >= 10;

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !listRef.current) return;

    requestAnimationFrame(() => {
      const selectedEl = listRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    });
  }, [isOpen, value, filteredOptions]);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setIsOpen(false);
  };

  const dimmed = disabled ? 'opacity-50 pointer-events-none' : '';

  const sheet =
    isOpen &&
    portalReady &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        className="fixed inset-0 z-[240] flex flex-col justify-end"
        role="presentation"
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/45 touch-manipulation"
          aria-label="Close list"
          onClick={() => setIsOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${fieldId}-sheet-title`}
          className="relative flex max-h-[92vh] min-h-0 flex-col rounded-t-2xl bg-white shadow-[0_-8px_32px_rgba(0,0,0,0.18)] pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-gray-300" aria-hidden />
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <h2 id={`${fieldId}-sheet-title`} className="text-lg font-semibold text-gray-900">
              {label}
            </h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-2 text-gray-600 active:bg-gray-100 touch-manipulation"
              aria-label="Close"
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              <svg className="mx-auto h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {showSearch && (
            <div className="shrink-0 border-b border-gray-100 px-4 py-3">
              <input
                type="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder={`Search ${label.toLowerCase()}…`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-base focus:border-orange-500 focus:outline-none"
              />
            </div>
          )}
          <div
            ref={listRef}
            id={`${fieldId}-options`}
            role="listbox"
            aria-labelledby={`${fieldId}-sheet-title`}
            className="min-h-0 flex-1 overflow-y-auto overscroll-y-auto touch-pan-y px-1 py-2"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <button
              type="button"
              role="option"
              aria-selected={!value}
              data-selected={!value ? 'true' : undefined}
              onClick={() => handleSelect('')}
              className={`w-full rounded-lg px-4 py-3.5 text-left text-base touch-manipulation flex items-center justify-between ${
                !value ? 'bg-orange-50 font-medium text-orange-900' : 'text-gray-500'
              }`}
            >
              <span>{emptyLabel}</span>
              {!value && (
                <svg className="h-4 w-4 shrink-0 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            {filteredOptions.map((opt, i) => (
              <button
                key={`${fieldId}-${i}-${opt.value}`}
                type="button"
                role="option"
                aria-selected={value === opt.value}
                data-selected={value === opt.value ? 'true' : undefined}
                onClick={() => handleSelect(opt.value)}
                className={`w-full rounded-lg px-4 py-3.5 text-left text-base touch-manipulation flex items-center justify-between active:bg-gray-50 ${
                  value === opt.value ? 'bg-orange-50 font-semibold text-orange-900' : 'text-gray-900'
                }`}
              >
                <span>{opt.label}</span>
                {value === opt.value && (
                  <svg className="h-4 w-4 shrink-0 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
            {filteredOptions.length === 0 && query.trim() !== '' && (
              <p className="px-4 py-8 text-center text-sm text-gray-500">No matches</p>
            )}
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <div className={dimmed}>
      <p id={`${fieldId}-lbl`} className="mb-2 block text-sm font-medium text-gray-700">
        {label}
      </p>
      <button
        type="button"
        aria-labelledby={`${fieldId}-lbl`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${fieldId}-options`}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(true)}
        className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3.5 text-left text-base transition-colors touch-manipulation ${
          isOpen
            ? 'border-orange-400 bg-orange-50/60'
            : value
              ? 'border-gray-300 bg-white'
              : 'border-gray-200 bg-white'
        }`}
      >
        <span className={value ? 'font-medium text-gray-900' : 'text-gray-500'}>
          {selectedOption?.label || emptyLabel}
        </span>
        <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {sheet}
    </div>
  );
};

/**
 * Mobile-Optimized Sell Car Page
 * Features:
 * - Step-by-step wizard optimized for mobile
 * - Touch-friendly form inputs
 * - Progress indicator
 * - Mobile camera integration ready
 */
export const MobileSellCarPage: React.FC<MobileSellCarPageProps> = ({ onNavigate, addToast }) => {
  /** Last full window.innerHeight before keyboard — some WebViews resize but don’t fire visualViewport. */
  const baselineInnerHeightRef = useRef(
    typeof window !== 'undefined' ? window.innerHeight : 0,
  );
  /** Manual padding when focused in a field (WebViews that report vv height = layout height). */
  const focusInsetRef = useRef(0);
  /** Merged bottom inset: max(visualViewport, window resize delta, focus fallback). */
  const [keyboardBottomInset, setKeyboardBottomInset] = useState(0);

  const updateKeyboardInset = useCallback(() => {
    if (typeof window === 'undefined') return;
    let inset = focusInsetRef.current;
    const vv = window.visualViewport;
    if (vv) {
      inset = Math.max(
        inset,
        Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)),
      );
    }
    const resizeDelta = baselineInnerHeightRef.current - window.innerHeight;
    if (resizeDelta > 48) {
      inset = Math.max(inset, Math.round(resizeDelta));
    }
    setKeyboardBottomInset(inset);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    baselineInnerHeightRef.current = window.innerHeight;
    const vv = window.visualViewport;

    const syncBaselineIfKeyboardGone = () => {
      const vvInset =
        vv != null
          ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
          : 0;
      const resizeDelta = baselineInnerHeightRef.current - window.innerHeight;
      if (vvInset < 16 && resizeDelta < 56 && focusInsetRef.current === 0) {
        baselineInnerHeightRef.current = window.innerHeight;
      }
    };

    const onLayoutChange = () => {
      syncBaselineIfKeyboardGone();
      updateKeyboardInset();
    };

    if (vv) {
      vv.addEventListener('resize', onLayoutChange);
      vv.addEventListener('scroll', onLayoutChange);
    }
    window.addEventListener('resize', onLayoutChange);
    window.addEventListener('orientationchange', onLayoutChange);
    onLayoutChange();

    return () => {
      if (vv) {
        vv.removeEventListener('resize', onLayoutChange);
        vv.removeEventListener('scroll', onLayoutChange);
      }
      window.removeEventListener('resize', onLayoutChange);
      window.removeEventListener('orientationchange', onLayoutChange);
    };
  }, [updateKeyboardInset]);

  const activateInputKeyboardPadding = useCallback(() => {
    if (typeof window === 'undefined') return;
    focusInsetRef.current = Math.min(Math.round(window.innerHeight * 0.42), 340);
    updateKeyboardInset();
  }, [updateKeyboardInset]);

  const deactivateInputKeyboardPadding = useCallback(() => {
    window.setTimeout(() => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        return;
      }
      focusInsetRef.current = 0;
      updateKeyboardInset();
    }, 240);
  }, [updateKeyboardInset]);

  /** Avoid layout jumps: mobile shell scrolls `#mobile-app-scroll-root`, not `window`. */
  const prepareWizardStepChange = useCallback(() => {
    if (typeof document !== 'undefined') {
      const ae = document.activeElement;
      if (ae instanceof HTMLElement) ae.blur();
    }
    focusInsetRef.current = 0;
    updateKeyboardInset();
  }, [updateKeyboardInset]);

  const resetSellCarScrollPositions = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const main = document.getElementById('mobile-app-scroll-root');
        if (main) main.scrollTop = 0;
        const inner = document.getElementById('mobile-sell-car-step-scroll');
        if (inner) inner.scrollTop = 0;
        if (typeof document !== 'undefined') {
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
        }
      });
    });
  }, []);

  const scrollFieldIntoComfortableView = (el: HTMLElement) => {
    requestAnimationFrame(() => {
      const inner = document.getElementById('mobile-sell-car-step-scroll');
      if (inner?.contains(el)) {
        const pad = 80;
        const elRect = el.getBoundingClientRect();
        const innerRect = inner.getBoundingClientRect();
        const deltaBottom = elRect.bottom - (innerRect.bottom - pad);
        const deltaTop = elRect.top - (innerRect.top + pad);
        if (deltaBottom > 0) {
          inner.scrollTop += deltaBottom;
        } else if (deltaTop < 0) {
          inner.scrollTop += deltaTop;
        }
        return;
      }
      el.scrollIntoView({ block: 'nearest', behavior: 'auto', inline: 'nearest' });
    });
  };

  const [currentStep, setCurrentStep] = useState(0);
  const [stepError, setStepError] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [carDetails, setCarDetails] = useState({
    registration: '',
    make: '',
    model: '',
    variant: '',
    year: '',
    state: '',
    district: '',
    noOfOwners: '',
    kilometers: '',
    fuelType: '',
    transmission: '',
    condition: '',
    expectedPrice: '',
    // Vahan verification fields
    engineNumber: '',
    chassisNumber: ''
  });
  
  const [carData, setCarData] = useState<ScrapedCarData | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [availableVariants, setAvailableVariants] = useState<string[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [contactError, setContactError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vehicleImages, setVehicleImages] = useState<string[]>([]);

  const { capture, captureMultiple, compress, isCapturing } = useCamera();

  const totalSteps = 11;
  const indianStates = getIndianStates();
  const districtsForSelectedState = carDetails.state ? getDistrictsByState(carDetails.state) : [];
  const years = getCarYears();
  const ownershipOptions = getOwnershipOptions();
  const fuelTypes = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'];
  const transmissionTypes = ['Manual', 'Automatic', 'CVT', 'AMT', 'DCT'];
  const kilometerRanges = [
    '0 - 10,000 km',
    '10,000 - 20,000 km',
    '20,000 - 30,000 km',
    '30,000 - 50,000 km',
    '50,000 - 75,000 km',
    '75,000 - 1,00,000 km',
    '1,00,000 - 1,50,000 km',
    '1,50,000+ km'
  ];

  useEffect(() => {
    const loadCarData = async () => {
      try {
        const data = await fetchCarDataFromReride();
        setCarData(data?.makes?.length ? data : getCarData());
      } catch (error) {
        console.error('Failed to load car data:', error);
        setCarData(getCarData());
      }
    };
    loadCarData();
  }, []);

  useEffect(() => {
    if (carData && carDetails.make) {
      const models = getModelsByMake(carDetails.make, carData);
      setAvailableModels((models ?? []).map(m => m.name));
      setAvailableVariants([]);
      setCarDetails(prev => ({ ...prev, model: '', variant: '' }));
    }
  }, [carDetails.make, carData]);

  useEffect(() => {
    if (carData && carDetails.make && carDetails.model) {
      const variants = getVariantsByModel(carDetails.make, carDetails.model, carData);
      setAvailableVariants(variants);
      setCarDetails(prev => ({ ...prev, variant: '' }));
    }
  }, [carDetails.model, carData]);

  // Auto-fetch vehicle specs when make, model, and year are selected
  const autoFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchedKey = useRef<string>('');
  
  useEffect(() => {
    const { make, model, year } = carDetails;
    
    if (!make || !model || !year) return;
    
    const vehicleKey = `${make}_${model}_${year}`;
    if (lastFetchedKey.current === vehicleKey) return;
    
    // Don't overwrite if user already selected values
    if (carDetails.fuelType && carDetails.transmission) {
      lastFetchedKey.current = vehicleKey;
      return;
    }
    
    if (autoFetchTimeoutRef.current) {
      clearTimeout(autoFetchTimeoutRef.current);
    }
    
    autoFetchTimeoutRef.current = setTimeout(async () => {
      logInfo('🚗 Mobile: Auto-fetching specs for:', { make, model, year });
      lastFetchedKey.current = vehicleKey;
      
      try {
        const specs = await fetchVehicleSpecs(make, model, parseInt(year, 10));
        if (specs) {
          setCarDetails(prev => ({
            ...prev,
            fuelType: prev.fuelType || specs.fuelType || '',
            transmission: prev.transmission || specs.transmission || '',
          }));
          logInfo('✅ Mobile: Auto-filled fuel/transmission:', specs.fuelType, specs.transmission);
        } else {
          const suggestions = await getAiVehicleSuggestions({ make, model, year: parseInt(year, 10) });
          if (suggestions.structuredSpecs) {
            setCarDetails(prev => ({
              ...prev,
              fuelType: prev.fuelType || suggestions.structuredSpecs?.fuelType || '',
              transmission: prev.transmission || suggestions.structuredSpecs?.transmission || '',
            }));
            cacheAISpecs(make, model, parseInt(year, 10), suggestions.structuredSpecs as Record<string, string>);
          }
        }
      } catch (error) {
        console.error('Failed to auto-fetch specs:', error);
      }
    }, 500);
    
    return () => {
      if (autoFetchTimeoutRef.current) {
        clearTimeout(autoFetchTimeoutRef.current);
      }
    };
  }, [carDetails.make, carDetails.model, carDetails.year]);

  const handleNextStep = () => {
    setStepError('');
    prepareWizardStepChange();
    setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1));
    resetSellCarScrollPositions();
  };

  const validateCurrentStep = (): string | null => {
    switch (currentStep) {
      case 3:
        if (!carDetails.make) return 'Please select the car make';
        if (!carDetails.model) return 'Please select the car model';
        if (!carDetails.year) return 'Please select the manufacturing year';
        return null;
      case 4:
        if (!carDetails.state) return 'Please select your state';
        if (!carDetails.district) return 'Please select your district';
        if (!carDetails.noOfOwners) return 'Please select number of owners';
        return null;
      case 5:
        if (!carDetails.kilometers) return 'Please select kilometers driven';
        if (!carDetails.fuelType) return 'Please select fuel type';
        if (!carDetails.transmission) return 'Please select transmission';
        return null;
      case 6:
        if (!carDetails.condition) return 'Please select vehicle condition';
        if (carDetails.expectedPrice && parseInt(carDetails.expectedPrice, 10) <= 0) {
          return 'Please enter a valid expected price';
        }
        return null;
      default:
        return null;
    }
  };

  const handleContinueStep = () => {
    const error = validateCurrentStep();
    if (error) {
      setStepError(error);
      addToast?.(error, 'warning');
      return;
    }
    handleNextStep();
  };

  const handleSelectIndividual = () => {
    handleNextStep();
  };

  const handleSelectDealer = () => {
    onNavigate(ViewEnum.SELLER_LOGIN);
  };

  const handleFillManually = () => {
    setCarDetails(prev => ({
      ...prev,
      registration: prev.registration?.trim() || `MANUAL-${Date.now()}`,
    }));
    handleNextStep();
  };

  const getRegistrationForSubmit = (): string => {
    const reg = carDetails.registration?.trim();
    if (reg) return reg;
    return `MANUAL-${Date.now()}`;
  };

  const handlePrevStep = () => {
    setStepError('');
    prepareWizardStepChange();
    setCurrentStep(prev => Math.max(prev - 1, 0));
    resetSellCarScrollPositions();
  };

  const handleContactSubmit = async () => {
    const phoneRegex = /^[6-9]\d{9}$/;
    const trimmed = customerContact.replace(/\D/g, '').slice(0, 10);
    if (!trimmed) {
      setContactError('Please enter your phone number');
      return;
    }
    if (trimmed.length !== 10) {
      setContactError('Enter all 10 digits of your mobile number');
      return;
    }
    if (!phoneRegex.test(trimmed)) {
      setContactError('Enter a valid Indian mobile number (starts with 6–9)');
      return;
    }
    const missingFields: string[] = [];
    if (!carDetails.make) missingFields.push('make');
    if (!carDetails.model) missingFields.push('model');
    if (!carDetails.year) missingFields.push('year');
    if (!carDetails.state) missingFields.push('state');
    if (!carDetails.district) missingFields.push('district');
    if (!carDetails.noOfOwners) missingFields.push('number of owners');
    if (!carDetails.kilometers) missingFields.push('kilometers');
    if (!carDetails.fuelType) missingFields.push('fuel type');
    if (!carDetails.transmission) missingFields.push('transmission');
    if (missingFields.length > 0) {
      const message = `Please complete all required details: ${missingFields.join(', ')}`;
      setSubmitError(message);
      addToast?.(message, 'error');
      return;
    }

    setContactError('');
    setSubmitError('');
    setIsSubmitting(true);
    try {
      const expectedPriceNum = carDetails.expectedPrice
        ? parseInt(carDetails.expectedPrice, 10)
        : undefined;

      let imagesForSubmit: string[] = [];
      if (vehicleImages.length > 0) {
        imagesForSubmit = await Promise.all(
          vehicleImages.map((img) => compress(img, 1200, 1200, 0.72)),
        );
        const approxBytes = imagesForSubmit.reduce((sum, img) => sum + img.length, 0);
        if (approxBytes > 12 * 1024 * 1024) {
          const message = 'Photos are too large to submit. Remove a few photos or retake at lower resolution.';
          setSubmitError(message);
          addToast?.(message, 'error');
          return;
        }
      }

      const result = await sellCarAPI.submitCarData({
        registration: getRegistrationForSubmit(),
        make: carDetails.make,
        model: carDetails.model,
        variant: carDetails.variant?.trim() || 'Not specified',
        year: carDetails.year,
        state: carDetails.state,
        district: carDetails.district,
        noOfOwners: carDetails.noOfOwners,
        kilometers: carDetails.kilometers,
        fuelType: carDetails.fuelType,
        transmission: carDetails.transmission,
        customerContact: trimmed,
        sellerType: 'individual',
        ...(carDetails.condition ? { condition: carDetails.condition } : {}),
        ...(expectedPriceNum && expectedPriceNum > 0 ? { expectedPrice: expectedPriceNum } : {}),
        ...(carDetails.engineNumber?.trim() ? { engineNumber: carDetails.engineNumber.trim() } : {}),
        ...(carDetails.chassisNumber?.trim() ? { chassisNumber: carDetails.chassisNumber.trim() } : {}),
        ...(imagesForSubmit.length > 0 ? { vehicleImages: imagesForSubmit } : {}),
      });
      if (result.success) {
        prepareWizardStepChange();
        setCurrentStep(9);
        resetSellCarScrollPositions();
      } else {
        const message = result.error || result.message || 'Could not submit. Please try again.';
        setSubmitError(message);
        addToast?.(message, 'error');
      }
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Could not submit. Please try again.';
      setSubmitError(message);
      addToast?.(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateRegistration = (reg: string): boolean => {
    const pattern = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/i;
    return pattern.test(reg);
  };

  const handleRegistrationSubmit = async () => {
    setRegistrationError('');
    
    if (!registrationNumber.trim()) {
      setRegistrationError('Please enter a registration number');
      return;
    }
    
    if (!validateRegistration(registrationNumber)) {
      setRegistrationError('Please enter a valid registration number (e.g., MH01AB1234)');
      return;
    }
    
    setIsVerifying(true);
    try {
      // Note: Registration verification API endpoint can be implemented here
      // This would validate the registration number against a government database
      // For now, we accept the registration number and proceed to manual entry
      // Future implementation: Call API endpoint to verify registration number
      setTimeout(() => {
        setCarDetails(prev => ({
          ...prev,
          registration: registrationNumber
        }));
        setIsVerifying(false);
        handleNextStep();
      }, 1000);
    } catch (error) {
      setRegistrationError('Error fetching details. Please fill manually.');
      setIsVerifying(false);
      handleNextStep();
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0: // Seller Type Selection
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              <AutoT i18nKey="sellCar.mobile.step0.title" />
            </h2>
            <button
              type="button"
              onClick={handleSelectIndividual}
              className="w-full p-6 bg-white rounded-xl border-2 border-gray-200 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900"><AutoT i18nKey="sellCar.mobile.individual.title" /></h3>
                  <p className="text-sm text-gray-600"><AutoT i18nKey="sellCar.mobile.individual.desc" as="span" /></p>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={handleSelectDealer}
              className="w-full p-6 bg-white rounded-xl border-2 border-gray-200 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900"><AutoT i18nKey="sellCar.mobile.dealer.title" /></h3>
                  <p className="text-sm text-gray-600"><AutoT i18nKey="sellCar.mobile.dealer.desc" as="span" /></p>
                </div>
              </div>
            </button>
          </div>
        );

      case 1: // Registration Number
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Enter Registration Number</h2>
            <p className="text-gray-600 mb-4">We&apos;ll fetch your car details automatically</p>
            <div>
              <input
                type="text"
                placeholder="e.g., MH01AB1234"
                value={registrationNumber}
                onChange={(e) => {
                  setRegistrationNumber(e.target.value.toUpperCase());
                  setRegistrationError('');
                }}
                onFocus={(e) => {
                  activateInputKeyboardPadding();
                  scrollFieldIntoComfortableView(e.currentTarget);
                }}
                onBlur={deactivateInputKeyboardPadding}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && registrationNumber.trim() && !isVerifying) {
                    e.preventDefault();
                    void handleRegistrationSubmit();
                  }
                }}
                enterKeyHint="next"
                className="w-full px-4 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                style={{ minHeight: '56px' }}
                autoCapitalize="characters"
              />
              {registrationError && (
                <p className="text-red-500 text-sm mt-2">{registrationError}</p>
              )}
            </div>
          </div>
        );

      case 2: // Vahan Verification Details
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Vehicle Verification Details</h2>
            <p className="text-gray-600 mb-4">Enter details from your RC book for Vahan verification</p>
            
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-blue-800 font-medium">Why we need this?</p>
                <p className="text-sm text-blue-700 mt-1">These details help buyers verify your vehicle authenticity through official Vahan records. Verified listings get more inquiries!</p>
              </div>
            </div>

            <div>
              <label htmlFor="sell-engine-number" className="block text-sm font-medium text-gray-700 mb-2">
                Engine Number <span className="text-gray-400">(from RC book)</span>
              </label>
              <input
                id="sell-engine-number"
                type="text"
                placeholder="e.g., K10B1234567"
                value={carDetails.engineNumber}
                onChange={(e) => setCarDetails(prev => ({ ...prev, engineNumber: e.target.value.toUpperCase() }))}
                onFocus={(e) => {
                  activateInputKeyboardPadding();
                  scrollFieldIntoComfortableView(e.currentTarget);
                }}
                onBlur={deactivateInputKeyboardPadding}
                className="w-full px-4 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                style={{ minHeight: '56px' }}
                autoCapitalize="characters"
              />
            </div>

            <div>
              <label htmlFor="sell-chassis-number" className="block text-sm font-medium text-gray-700 mb-2">
                Chassis Number <span className="text-gray-400">(from RC book)</span>
              </label>
              <input
                id="sell-chassis-number"
                type="text"
                placeholder="e.g., MA3EYUE1S00123456"
                value={carDetails.chassisNumber}
                onChange={(e) => setCarDetails(prev => ({ ...prev, chassisNumber: e.target.value.toUpperCase() }))}
                onFocus={(e) => {
                  activateInputKeyboardPadding();
                  scrollFieldIntoComfortableView(e.currentTarget);
                }}
                onBlur={deactivateInputKeyboardPadding}
                className="w-full px-4 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                style={{ minHeight: '56px' }}
                autoCapitalize="characters"
              />
            </div>

            {/* Skip Option */}
            <button
              type="button"
              onClick={handleNextStep}
              className="w-full text-center text-gray-500 text-sm py-2 hover:text-gray-700"
            >
              Skip for now (can add later)
            </button>
          </div>
        );

      case 3: // Car Details - Make/Model
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Car Details</h2>
            <MobilePickerList
              fieldId="sell-make"
              label="Make"
              value={carDetails.make}
              emptyLabel="Select Make"
              options={(carData?.makes ?? []).map((m) => ({ value: m.name, label: m.name }))}
              onChange={(v) => setCarDetails((prev) => ({ ...prev, make: v }))}
            />
            {availableModels.length > 0 && (
              <MobilePickerList
                fieldId="sell-model"
                label="Model"
                value={carDetails.model}
                emptyLabel="Select Model"
                options={availableModels.map((m) => ({ value: m, label: m }))}
                onChange={(v) => setCarDetails((prev) => ({ ...prev, model: v }))}
              />
            )}
            {availableVariants.length > 0 && (
              <MobilePickerList
                fieldId="sell-variant"
                label="Variant"
                value={carDetails.variant}
                emptyLabel="Select Variant"
                options={availableVariants.map((v) => ({ value: v, label: v }))}
                onChange={(v) => setCarDetails((prev) => ({ ...prev, variant: v }))}
              />
            )}
            <MobilePickerList
              fieldId="sell-year"
              label="Year"
              value={carDetails.year}
              emptyLabel="Select Year"
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
              onChange={(v) => setCarDetails((prev) => ({ ...prev, year: v }))}
            />
          </div>
        );

      case 4: // Location & Ownership
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Location & Ownership</h2>
            <MobilePickerList
              fieldId="sell-state"
              label="State / UT"
              value={carDetails.state}
              emptyLabel="Select State"
              options={indianStates.map((st) => ({ value: st, label: st }))}
              onChange={(v) => setCarDetails((prev) => ({ ...prev, state: v, district: '' }))}
            />
            <MobilePickerList
              key={carDetails.state || 'district'}
              fieldId="sell-district"
              label="District"
              value={carDetails.district}
              emptyLabel={carDetails.state ? 'Select District' : 'Select state first'}
              options={districtsForSelectedState.map((d) => ({ value: d, label: d }))}
              onChange={(v) => setCarDetails((prev) => ({ ...prev, district: v }))}
              disabled={!carDetails.state}
            />
            <MobilePickerList
              fieldId="sell-owners"
              label="Number of Owners"
              value={carDetails.noOfOwners}
              emptyLabel="Select"
              options={ownershipOptions.map((o) => ({ value: o, label: o }))}
              onChange={(v) => setCarDetails((prev) => ({ ...prev, noOfOwners: v }))}
            />
          </div>
        );

      case 5: // Kilometers & Fuel
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Usage & Fuel</h2>
            <MobilePickerList
              fieldId="sell-km"
              label="Kilometers Driven"
              value={carDetails.kilometers}
              emptyLabel="Select Range"
              options={kilometerRanges.map((r) => ({ value: r, label: r }))}
              onChange={(v) => setCarDetails((prev) => ({ ...prev, kilometers: v }))}
            />
            <MobilePickerList
              fieldId="sell-fuel"
              label="Fuel Type"
              value={carDetails.fuelType}
              emptyLabel="Select Fuel Type"
              options={fuelTypes.map((t) => ({ value: t, label: t }))}
              onChange={(v) => setCarDetails((prev) => ({ ...prev, fuelType: v }))}
            />
            <MobilePickerList
              fieldId="sell-trans"
              label="Transmission"
              value={carDetails.transmission}
              emptyLabel="Select Transmission"
              options={transmissionTypes.map((t) => ({ value: t, label: t }))}
              onChange={(v) => setCarDetails((prev) => ({ ...prev, transmission: v }))}
            />
          </div>
        );

      case 6: // Condition & Price
        return (
          <div className="space-y-4 pb-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Condition & Pricing</h2>
            <MobilePickerList
              fieldId="sell-condition"
              label="Condition"
              value={carDetails.condition}
              emptyLabel="Select Condition"
              options={[
                { value: 'Excellent', label: 'Excellent' },
                { value: 'Very Good', label: 'Very Good' },
                { value: 'Good', label: 'Good' },
                { value: 'Fair', label: 'Fair' },
                { value: 'Needs Repair', label: 'Needs Repair' },
              ]}
              onChange={(v) => setCarDetails((prev) => ({ ...prev, condition: v }))}
            />
            <div className="scroll-mt-6 pb-8">
              <label htmlFor="sell-expected-price" className="block text-sm font-medium text-gray-700 mb-2">
                Expected Price (₹)
              </label>
              <input
                id="sell-expected-price"
                type="text"
                inputMode="numeric"
                enterKeyHint="done"
                placeholder="e.g. 5,00,000"
                value={formatIndianPriceInput(carDetails.expectedPrice)}
                onChange={(e) => {
                  const digits = parsePriceDigits(e.target.value);
                  setCarDetails(prev => ({ ...prev, expectedPrice: digits }));
                  setStepError('');
                }}
                onFocus={(e) => {
                  activateInputKeyboardPadding();
                  scrollFieldIntoComfortableView(e.currentTarget);
                }}
                onBlur={deactivateInputKeyboardPadding}
                className="w-full px-4 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                style={{ minHeight: '56px' }}
              />
            </div>
          </div>
        );

      case 7: // Photos
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Add Photos</h2>
            <p className="text-gray-600 mb-4">Add up to 10 photos of your vehicle</p>
            
            {/* Photo Grid */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {vehicleImages.map((image, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img src={image} alt={`Vehicle ${index + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setVehicleImages(prev => prev.filter((_, i) => i !== index))}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                    style={{ minWidth: '24px', minHeight: '24px' }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {vehicleImages.length < 10 && (
                <button
                  onClick={async () => {
                    const photos = await captureMultiple(10 - vehicleImages.length, { sourceType: 'both' });
                    if (photos && photos.length > 0) {
                      // Compress images
                      const compressedPhotos = await Promise.all(
                        photos.map(photo => compress(photo, 1200, 1200, 0.75))
                      );
                      setVehicleImages(prev => [...prev, ...compressedPhotos]);
                    }
                  }}
                  disabled={isCapturing}
                  className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center bg-gray-50 active:scale-[0.98] transition-transform"
                  style={{ minHeight: '100px' }}
                >
                  {isCapturing ? (
                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="w-8 h-8 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="text-xs text-gray-500">Add Photo</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const photo = await capture({ sourceType: 'camera' });
                  if (photo) {
                    const compressed = await compress(photo, 1200, 1200, 0.75);
                    setVehicleImages(prev => [...prev, compressed]);
                  }
                }}
                disabled={isCapturing || vehicleImages.length >= 10}
                className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ minHeight: '56px' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Camera
              </button>
              <button
                onClick={async () => {
                  const photo = await capture({ sourceType: 'library' });
                  if (photo) {
                    const compressed = await compress(photo, 1200, 1200, 0.75);
                    setVehicleImages(prev => [...prev, compressed]);
                  }
                }}
                disabled={isCapturing || vehicleImages.length >= 10}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ minHeight: '56px' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Gallery
              </button>
            </div>
            {vehicleImages.length === 0 && (
              <p className="text-sm text-orange-600 mt-2">⚠️ At least one photo is recommended</p>
            )}
          </div>
        );

      case 8: // Contact
        return (
          <form
            id="mobile-sell-contact-form"
            className="space-y-4 pb-8"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void handleContactSubmit();
            }}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Contact Information</h2>
            <div>
              <label htmlFor="sell-contact-phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                id="sell-contact-phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                enterKeyHint="send"
                autoComplete="tel"
                placeholder="10-digit mobile (starts with 6–9)"
                value={customerContact}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setCustomerContact(v);
                  setContactError('');
                }}
                onFocus={(e) => {
                  activateInputKeyboardPadding();
                  scrollFieldIntoComfortableView(e.currentTarget);
                }}
                onBlur={deactivateInputKeyboardPadding}
                className={`w-full px-4 py-4 text-lg rounded-xl border-2 focus:outline-none ${
                  contactError ? 'border-red-400' : 'border-gray-200 focus:border-orange-500'
                }`}
                style={{ minHeight: '56px' }}
              />
              {contactError ? (
                <p className="text-red-600 text-sm mt-2">{contactError}</p>
              ) : null}
            </div>
            <p className="text-sm text-gray-600">Our team will contact you to complete the listing process.</p>
          </form>
        );

      case 9: // Success
        return (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Details Submitted!</h2>
            <p className="text-gray-600 mb-6">Our team will review and contact you shortly.</p>
            <button
              onClick={() => onNavigate(ViewEnum.HOME)}
              className="w-full py-4 bg-orange-500 text-white rounded-xl font-semibold"
              style={{ minHeight: '56px' }}
            >
              Go to Home
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  const renderStepActions = () => {
    if (currentStep <= 0 || currentStep >= 9) return null;

    if (currentStep === 1) {
      return (
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={handleRegistrationSubmit}
            disabled={isVerifying || !registrationNumber.trim()}
            className="w-full py-4 bg-orange-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] touch-manipulation"
            style={{ minHeight: '56px' }}
          >
            {isVerifying ? 'Fetching Details...' : 'Continue'}
          </button>
          <button
            type="button"
            onClick={handleFillManually}
            className="w-full py-3 text-center text-sm font-medium text-gray-600 underline decoration-gray-400 underline-offset-4 active:text-orange-600 touch-manipulation"
            style={{ minHeight: '44px' }}
          >
            Fill Details Manually
          </button>
        </div>
      );
    }

    if (currentStep === 8) {
      return (
        <div className="mt-6 space-y-3">
          {submitError ? (
            <p className="text-red-600 text-sm text-center px-1" role="alert">
              {submitError}
            </p>
          ) : null}
          <button
            type="submit"
            form="mobile-sell-contact-form"
            disabled={isSubmitting}
            className="w-full py-4 bg-orange-500 text-white rounded-xl font-semibold disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] touch-manipulation"
            style={{ minHeight: '56px' }}
          >
            {isSubmitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      );
    }

    return (
      <div className="mt-6 space-y-3">
        {stepError ? (
          <p className="text-red-600 text-sm text-center px-1" role="alert">
            {stepError}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleContinueStep}
          className="w-full py-4 bg-orange-500 text-white rounded-xl font-semibold active:scale-[0.99] touch-manipulation"
          style={{ minHeight: '56px' }}
        >
          Continue
        </button>
      </div>
    );
  };

  return (
    <div className="bg-gray-50 flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Pinned chrome — does not scroll (fixes Continue + lists hidden behind tab bar on iOS Safari) */}
      <div className="shrink-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        {currentStep > 0 && (
          <button
            type="button"
            onClick={handlePrevStep}
            className="p-2 -ml-1"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h1 className="text-lg font-bold text-gray-900 flex-1">
          <AutoT i18nKey="sellCar.mobile.title" />
        </h1>
      </div>

      {currentStep < 9 && (
        <div className="shrink-0 bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Step {currentStep + 1} of {totalSteps - 1}</span>
            <span className="text-sm font-semibold text-gray-900">{Math.round(((currentStep + 1) / (totalSteps - 1)) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-orange-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / (totalSteps - 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Step body + actions scroll together — buttons sit directly below inputs */}
      <div
        id="mobile-sell-car-step-scroll"
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-6 overscroll-y-auto touch-pan-y"
        key={`sell-step-${currentStep}`}
        style={
          keyboardBottomInset > 0
            ? { paddingBottom: `${keyboardBottomInset + 24}px` }
            : { paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }
        }
      >
        {renderStep()}
        {renderStepActions()}
      </div>
    </div>
  );
};

export default MobileSellCarPage;

