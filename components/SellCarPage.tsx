import React, { useState, useEffect, useMemo } from 'react';
import { View as ViewEnum } from '../types';
import { fetchCarDataFromReride, getCarData, getModelsByMake, getVariantsByModel, getIndianStates, getDistrictsByState, getCarYears, getOwnershipOptions, ScrapedCarData, CarMake } from '../utils/rerideScraper';
import { sellCarAPI } from '../services/sellCarService';

interface SellCarPageProps {
  onNavigate: (view: ViewEnum) => void;
}

/* ---------------- Shared UI primitives ---------------- */

interface StepHeaderProps {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: 'orange' | 'purple' | 'teal' | 'blue' | 'green' | 'rose';
}

const accentMap: Record<NonNullable<StepHeaderProps['accent']>, { bg: string; ring: string; text: string }> = {
  orange: { bg: 'bg-orange-100', ring: 'ring-orange-200', text: 'text-orange-600' },
  purple: { bg: 'bg-purple-100', ring: 'ring-purple-200', text: 'text-purple-600' },
  teal:   { bg: 'bg-teal-100',   ring: 'ring-teal-200',   text: 'text-teal-600' },
  blue:   { bg: 'bg-blue-100',   ring: 'ring-blue-200',   text: 'text-blue-600' },
  green:  { bg: 'bg-green-100',  ring: 'ring-green-200',  text: 'text-green-600' },
  rose:   { bg: 'bg-rose-100',   ring: 'ring-rose-200',   text: 'text-rose-600' },
};

const StepHeader: React.FC<StepHeaderProps> = ({ eyebrow, title, subtitle, icon, accent = 'orange' }) => {
  const color = accentMap[accent];
  return (
    <div className="flex items-start gap-4">
      {icon && (
        <div className={`shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-2xl ${color.bg} ${color.text} ring-4 ${color.ring} flex items-center justify-center`}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {eyebrow && (
          <p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${color.text} mb-1`}>{eyebrow}</p>
        )}
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">{title}</h2>
        {subtitle && (
          <p className="text-sm text-gray-500 mt-1.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

const BackBar: React.FC<{ onBack: () => void; currentStep: number; totalSteps: number; summary?: React.ReactNode }>
  = ({ onBack, currentStep, totalSteps, summary }) => (
    <div className="flex items-center justify-between gap-3 mb-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        {summary}
        <span className="hidden sm:inline font-semibold text-gray-600">Step {currentStep}/{totalSteps - 1}</span>
      </div>
    </div>
  );

/* Option tile used across list-style steps (owners, fuel, transmission, km) */
const OptionTile: React.FC<{
  label: string;
  hint?: string;
  selected?: boolean;
  onClick: () => void;
  leading?: React.ReactNode;
}> = ({ label, hint, selected, onClick, leading }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all duration-200 active:scale-[0.98] text-left ${
      selected
        ? 'border-orange-500 bg-orange-50 shadow-sm'
        : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/40'
    }`}
    aria-pressed={selected}
  >
    {leading && (
      <span className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${selected ? 'bg-white text-orange-600' : 'bg-gray-50 text-gray-500'}`}>
        {leading}
      </span>
    )}
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-gray-900 truncate">{label}</p>
      {hint && <p className="text-xs text-gray-500 mt-0.5 truncate">{hint}</p>}
    </div>
    <span className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center border-2 ${selected ? 'border-orange-500 bg-orange-500' : 'border-gray-300 bg-white'}`}>
      {selected && (
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </span>
  </button>
);

const POPULAR_METRO_LOCATIONS: readonly { label: string; state: string; district: string }[] = [
  { label: 'Mumbai', state: 'Maharashtra', district: 'Mumbai City' },
  { label: 'Delhi', state: 'Delhi', district: 'New Delhi' },
  { label: 'Bengaluru', state: 'Karnataka', district: 'Bengaluru Urban' },
  { label: 'Hyderabad', state: 'Telangana', district: 'Hyderabad' },
  { label: 'Chennai', state: 'Tamil Nadu', district: 'Chennai' },
  { label: 'Pune', state: 'Maharashtra', district: 'Pune' },
  { label: 'Kolkata', state: 'West Bengal', district: 'Kolkata' },
  { label: 'Ahmedabad', state: 'Gujarat', district: 'Ahmedabad' },
];

/* ---------------- Main component ---------------- */

const SellCarPage: React.FC<SellCarPageProps> = ({ onNavigate }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [sellerType, setSellerType] = useState<'individual' | 'dealer'>('individual');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [, /* showPassword */ /* setShowPassword */] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
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
    expectedPrice: ''
  });

  const [carData, setCarData] = useState<ScrapedCarData | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [availableVariants, setAvailableVariants] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [, /* hoveredBrand */ /* setHoveredBrand */] = useState<string | null>(null);
  const [registrationError, setRegistrationError] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedOwnership, setSelectedOwnership] = useState('');
  const [selectedFuelType, setSelectedFuelType] = useState('');
  const [selectedKilometers, setSelectedKilometers] = useState('');
  const [selectedTransmission, setSelectedTransmission] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [contactError, setContactError] = useState('');
  const [manualMake, setManualMake] = useState('');
  const [manualModel, setManualModel] = useState('');
  const [manualVariant, setManualVariant] = useState('');
  const [manualDistrict, setManualDistrict] = useState('');
  const [brandSearch, setBrandSearch] = useState('');

  const totalSteps = 12;
  const indianStates = useMemo(() => getIndianStates(), []);
  const districtsForState = useMemo(
    () => (carDetails.state ? getDistrictsByState(carDetails.state) : []),
    [carDetails.state],
  );
  const years = getCarYears();
  const ownershipOptions = getOwnershipOptions();

  const fuelTypes = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'];
  const transmissionTypes = ['Manual', 'Automatic', 'CVT', 'AMT', 'DCT'];
  const kilometerRanges = [
    '0 Km - 10,000 Km',
    '10,000 Km - 20,000 Km',
    '20,000 Km - 30,000 Km',
    '30,000 Km - 40,000 Km',
    '40,000 Km - 50,000 Km',
    '50,000 Km - 60,000 Km',
    '60,000 Km - 70,000 Km',
    '70,000 Km - 80,000 Km',
    '80,000 Km - 90,000 Km',
    '90,000 Km - 1,00,000 Km',
    '1,00,000 Km - 1,25,000 Km',
    '1,25,000 Km - 1,50,000 Km',
    '1,50,000 Km - 1,75,000 Km',
    '1,75,000 Km - 2,00,000 Km',
    '2,00,000 Km - 2,25,000 Km',
    '2,25,000 Km - 2,50,000 Km',
    '2,50,000 Km or more'
  ];

  // Step meta for the progress strip (step 0 is the chooser; labels are for 1–11)
  const STEP_LABELS = [
    'Choose',     // 0
    'Reg. No.',   // 1
    'Brand',      // 2
    'Model',      // 3
    'Year',       // 4
    'Location',   // 5
    'Owners',     // 6
    'Variant',    // 7
    'Fuel',       // 8
    'Kms',        // 9
    'Gearbox',    // 10
    'Contact'     // 11
  ];

  const fuelMeta: Record<string, { icon: React.ReactNode; hint: string }> = {
    Petrol:   { hint: 'Most common fuel type', icon: <span className="text-lg">⛽</span> },
    Diesel:   { hint: 'High mileage, torquey', icon: <span className="text-lg">🛢️</span> },
    CNG:      { hint: 'Economical & cleaner',  icon: <span className="text-lg">💨</span> },
    Electric: { hint: 'Zero-emission EV',      icon: <span className="text-lg">⚡</span> },
    Hybrid:   { hint: 'Petrol + electric',     icon: <span className="text-lg">🔋</span> },
  };

  const transmissionMeta: Record<string, string> = {
    Manual:    'Traditional stick-shift',
    Automatic: 'Torque converter auto',
    CVT:       'Continuously variable',
    AMT:       'Automated manual',
    DCT:       'Dual-clutch sport auto',
  };

  const brandLogos: Record<string, string> = {
    'Maruti Suzuki': 'https://upload.wikimedia.org/wikipedia/commons/1/12/Maruti_Suzuki_logo.svg',
    Hyundai: 'https://upload.wikimedia.org/wikipedia/commons/f/fd/Hyundai_Motor_Company_logo.svg',
    Tata: 'https://upload.wikimedia.org/wikipedia/commons/7/79/Tata_logo.svg',
    Honda: 'https://upload.wikimedia.org/wikipedia/commons/7/79/Honda_Logo.svg',
    Renault: 'https://upload.wikimedia.org/wikipedia/commons/9/9b/Renault_2021_logo.svg',
    Mahindra: 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Mahindra_%26_Mahindra_Logo.svg',
    Kia: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/Kia_logo.svg',
    Toyota: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Toyota_logo.svg',
    Volkswagen: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Volkswagen_logo_2019.svg',
    Skoda: 'https://upload.wikimedia.org/wikipedia/commons/9/95/%C5%A0koda_Auto_logo.svg',
    MG: 'https://upload.wikimedia.org/wikipedia/commons/8/8b/MG_Motor_logo.svg',
    Nissan: 'https://upload.wikimedia.org/wikipedia/commons/1/11/Nissan_logo.svg',
    Ford: 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Ford_Motor_Company_Logo.svg',
    BMW: 'https://upload.wikimedia.org/wikipedia/commons/4/44/BMW.svg',
    'Mercedes-Benz': 'https://upload.wikimedia.org/wikipedia/commons/9/90/Mercedes-Logo.svg',
    Audi: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Audi_logo.svg',
    Volvo: 'https://upload.wikimedia.org/wikipedia/commons/7/7a/Volvo_Logo.svg',
    Jeep: 'https://upload.wikimedia.org/wikipedia/commons/7/7a/Jeep_logo.svg',
    'Land Rover': 'https://upload.wikimedia.org/wikipedia/commons/7/7a/Land_Rover_logo.svg',
    Porsche: 'https://upload.wikimedia.org/wikipedia/commons/f/f5/Porsche_logo.svg',
    Mini: 'https://upload.wikimedia.org/wikipedia/commons/7/7a/MINI_logo.svg',
    Mitsubishi: 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Mitsubishi_logo.svg',
    Jaguar: 'https://upload.wikimedia.org/wikipedia/en/3/3e/Jaguar_Racing_logo.svg',
    Fiat: 'https://upload.wikimedia.org/wikipedia/commons/6/64/Fiat_Auto_logo.svg',
    Citroen: 'https://upload.wikimedia.org/wikipedia/commons/6/6a/Citro%C3%ABn_2022_logo.svg',
    Lexus: 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Lexus_division_emblem.svg',
    Tesla: 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Tesla_Motors.svg',
    BYD: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/BYD_Company_logo.svg',
    Chevrolet: 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Chevrolet_logo.svg',
    GMC: 'https://upload.wikimedia.org/wikipedia/commons/9/96/GMC_logo.svg',
    Dodge: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Dodge_logo.svg',
    'Land Rover Defender': 'https://upload.wikimedia.org/wikipedia/commons/7/7a/Land_Rover_logo.svg'
  };

  const trustSignals = [
    { value: '50k+', label: 'Happy customers' },
    { value: '₹25Cr+', label: 'Worth of cars sold' },
    { value: '120+', label: 'Cities covered' }
  ];

  const heroHighlights = [
    { title: 'Instant valuation', desc: '90% cars get a price in under 2 minutes.' },
    { title: 'Doorstep inspection', desc: 'Free pickup & RC transfer included.' },
    { title: 'Trusted by sellers', desc: '50,000+ happy owners across India.' }
  ];

  const getBrandLogo = (brandName: string): string => {
    const direct = brandLogos[brandName];
    if (direct) return direct;
    const brandSlug = brandName.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
    return `https://logo.clearbit.com/${brandSlug}.com`;
  };

  /* ---------------- Effects (unchanged) ---------------- */

  useEffect(() => {
    const loadCarData = async () => {
      setIsLoading(true);
      try {
        const data = await fetchCarDataFromReride();
        setCarData(data?.makes?.length ? data : getCarData());
      } catch (error) {
        console.error('Failed to load car data:', error);
        setCarData(getCarData());
      } finally {
        setIsLoading(false);
      }
    };
    loadCarData();
  }, []);

  useEffect(() => {
    const storageKey = sellerType === 'dealer' ? 'rememberedSellerEmail' : 'rememberedCustomerEmail';
    const rememberedEmail = localStorage.getItem(storageKey);
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    } else {
      setEmail('');
      setRememberMe(false);
    }
  }, [sellerType]);

  useEffect(() => {
    if (carData && carDetails.make) {
      const models = getModelsByMake(carDetails.make, carData);
      setAvailableModels(models.map(m => m.name));
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

  /* ---------------- Navigation & submit (unchanged logic) ---------------- */

  const handleNextStep = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1));
      setIsAnimating(false);
    }, 260);
  };

  const handlePrevStep = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(prev => Math.max(prev - 1, 0));
      setIsAnimating(false);
    }, 260);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!email || !password) {
      setLoginError('Please enter both email and password');
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email.trim())) {
      setLoginError('Please enter a valid email address.');
      return;
    }
    setIsLoggingIn(true);
    try {
      const { authenticatedFetch } = await import('../utils/authenticatedFetch');
      const response = await authenticatedFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        setLoginError(data?.reason || 'Invalid email or password. Please try again.');
        return;
      }
      if (data.accessToken) { try { localStorage.setItem('accessToken', data.accessToken); } catch { /* quota */ } }
      if (data.refreshToken) { try { localStorage.setItem('refreshToken', data.refreshToken); } catch { /* quota */ } }
      if (data.user) { try { localStorage.setItem('user', JSON.stringify(data.user)); } catch { /* quota */ } }
      if (rememberMe) {
        const storageKey = sellerType === 'dealer' ? 'rememberedSellerEmail' : 'rememberedCustomerEmail';
        try { localStorage.setItem(storageKey, email); } catch { /* quota */ }
      }
      handleNextStep();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setLoginError(`Login failed: ${message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };
  // Suppress unused lint for the login helper (used in dealer flow paths)
  void handleLogin; void isLoggingIn; void loginError; void password; void setPassword;

  const validateRegistration = (reg: string): boolean => {
    const pattern = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/i;
    return pattern.test(reg);
  };

  const handleRegistrationSubmit = async () => {
    setRegistrationError('');
    const trimmed = registrationNumber.trim().toUpperCase();
    if (!trimmed) {
      setRegistrationError('Please enter a registration number');
      return;
    }
    if (!validateRegistration(trimmed)) {
      setRegistrationError('Please enter a valid registration number (e.g., MH01AB1234)');
      return;
    }
    setIsVerifying(false);
    setCarDetails(prev => ({ ...prev, registration: trimmed }));
    handleNextStep();
  };

  const handleBrandSelect = (brand: CarMake) => {
    setCarDetails(prev => ({ ...prev, make: brand.name }));
    handleNextStep();
  };

  const handleCarDetailChange = (field: string, value: string) => {
    setCarDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleYearSelect = (year: string) => {
    setSelectedYear(year);
    setCarDetails(prev => ({ ...prev, year }));
    handleNextStep();
  };

  const handleOwnershipSelect = (ownership: string) => {
    setSelectedOwnership(ownership);
    setCarDetails(prev => ({ ...prev, noOfOwners: ownership }));
    handleNextStep();
  };

  const handleFuelTypeSelect = (fuelType: string) => {
    setSelectedFuelType(fuelType);
    setCarDetails(prev => ({ ...prev, fuelType }));
    handleNextStep();
  };

  const handleKilometersSelect = (kilometers: string) => {
    setSelectedKilometers(kilometers);
    setCarDetails(prev => ({ ...prev, kilometers }));
    handleNextStep();
  };

  const handleTransmissionSelect = (transmission: string) => {
    setSelectedTransmission(transmission);
    setCarDetails(prev => ({ ...prev, transmission }));
    handleNextStep();
  };

  const handleContactSubmit = () => {
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!customerContact.trim()) {
      setContactError('Please enter your contact number');
      return;
    }
    if (!phoneRegex.test(customerContact)) {
      setContactError('Please enter a valid 10-digit mobile number');
      return;
    }
    setContactError('');
    submitCarData();
  };

  const submitCarData = async () => {
    const carSubmissionData = {
      registration: carDetails.registration,
      make: carDetails.make,
      model: carDetails.model,
      variant: carDetails.variant,
      year: carDetails.year,
      state: carDetails.state,
      district: carDetails.district,
      noOfOwners: carDetails.noOfOwners,
      kilometers: carDetails.kilometers,
      fuelType: carDetails.fuelType,
      transmission: selectedTransmission,
      customerContact
    };
    try {
      setIsLoading(true);
      const result = await sellCarAPI.submitCarData(carSubmissionData);
      if (result.success) {
        alert('Car details submitted successfully! We will contact you soon.');
        onNavigate(ViewEnum.HOME);
      } else {
        alert(result.error || 'Failed to submit car details. Please check your connection and try again.');
      }
    } catch (error) {
      console.error('Error submitting car data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to submit car details: ${errorMessage}. Please check your connection and try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  /* ---------------- Derived UI helpers ---------------- */

  const filteredBrands = useMemo(() => {
    const list = carData?.makes ?? [];
    if (!brandSearch.trim()) return list;
    const q = brandSearch.trim().toLowerCase();
    return list.filter(b => b.name.toLowerCase().includes(q));
  }, [carData, brandSearch]);

  const summaryChips = useMemo(() => {
    const chips: { label: string; value: string }[] = [];
    if (carDetails.registration) chips.push({ label: 'Reg', value: carDetails.registration });
    if (carDetails.make) chips.push({ label: 'Make', value: carDetails.make });
    if (carDetails.model) chips.push({ label: 'Model', value: carDetails.model });
    if (carDetails.variant) chips.push({ label: 'Variant', value: carDetails.variant });
    if (carDetails.year) chips.push({ label: 'Year', value: carDetails.year });
    if (carDetails.state) chips.push({ label: 'State', value: carDetails.state });
    if (carDetails.district) chips.push({ label: 'District', value: carDetails.district });
    if (carDetails.noOfOwners) chips.push({ label: 'Owners', value: carDetails.noOfOwners });
    if (carDetails.fuelType) chips.push({ label: 'Fuel', value: carDetails.fuelType });
    if (carDetails.kilometers) chips.push({ label: 'Kms', value: carDetails.kilometers });
    if (selectedTransmission) chips.push({ label: 'Gearbox', value: selectedTransmission });
    return chips;
  }, [carDetails, selectedTransmission]);

  /* ---------------- Step renderers ---------------- */

  // Step 0: Choose selling path (individual vs dealer)
  const renderStep0 = () => (
    <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 lg:gap-10 items-start">
      <div className="bg-gradient-to-br from-purple-50 via-white to-orange-50 rounded-2xl p-5 md:p-6 border border-white/60 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white text-orange-600 text-xs font-semibold shadow-sm mb-3">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Faster handoffs, happier sellers
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug">
          Sell with confidence, in under 2 minutes
        </h2>
        <p className="text-gray-600 mt-2 text-sm md:text-base">
          Step-by-step guidance, auto-fetched details, verified buyers, and instant payouts.
        </p>

        <div className="grid sm:grid-cols-3 gap-3 mt-5">
          {trustSignals.map((item) => (
            <div key={item.label} className="bg-white rounded-xl p-3 border border-orange-100 shadow-sm">
              <p className="text-xl font-bold text-gray-900">{item.value}</p>
              <p className="text-xs text-gray-600">{item.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3 mt-5">
          {heroHighlights.map((highlight) => (
            <div key={highlight.title} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{highlight.title}</p>
                <p className="text-sm text-gray-600">{highlight.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-600 mb-2">Pick one to begin</p>
          <h3 className="text-lg md:text-xl font-bold text-gray-900">Who's selling?</h3>
        </div>

        <button
          type="button"
          onClick={() => { setSellerType('individual'); setTimeout(() => handleNextStep(), 250); }}
          className={`w-full text-left rounded-2xl border-2 p-4 md:p-5 transition-all duration-300 active:scale-[0.99] ${
            sellerType === 'individual'
              ? 'border-orange-500 bg-gradient-to-r from-orange-50 to-rose-50 shadow-md'
              : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/40'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-gray-900 font-bold">Sell as Individual</p>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-100 text-green-700">Recommended</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">One-to-one guidance, instant valuation, free RC transfer.</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {['2-min flow', 'Instant price', 'Doorstep pickup'].map(tag => (
                  <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-orange-200 text-orange-700">{tag}</span>
                ))}
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        <button
          type="button"
          onClick={() => { setSellerType('dealer'); onNavigate(ViewEnum.SELLER_LOGIN); }}
          className={`w-full text-left rounded-2xl border-2 p-4 md:p-5 transition-all duration-300 active:scale-[0.99] ${
            sellerType === 'dealer'
              ? 'border-orange-500 bg-orange-50 shadow-md'
              : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/40'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
              </svg>
            </span>
            <div className="flex-1">
              <p className="text-gray-900 font-bold">Sell as Dealer</p>
              <p className="text-sm text-gray-600 mt-1">Log in to your dealer account and manage inventory.</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {['Bulk listing', 'Lead inbox', 'Priority support'].map(tag => (
                  <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-purple-200 text-purple-700">{tag}</span>
                ))}
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-600">
          <svg className="w-4 h-4 text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          Need help? Call 727-727-7275 or chat with us — we answer in under 60 seconds.
        </div>
      </div>
    </div>
  );

  // Step 1: Registration number
  const renderStep1 = () => (
    <div className="space-y-5">
      <StepHeader
        eyebrow="Let's start"
        title="What's your car's registration number?"
        subtitle="We'll auto-fetch make, model, year & variant when possible."
        accent="orange"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
      />

      <div className="bg-gradient-to-r from-gray-50 to-orange-50/40 rounded-2xl p-4 border border-gray-100">
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Vehicle Registration Number</label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <input
            type="text"
            className={`w-full pl-10 pr-4 py-3.5 text-lg font-mono tracking-wider border-2 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:outline-none transition-all ${
              inputFocused ? 'border-orange-500 shadow-md ring-4 ring-orange-100' : 'border-gray-200'
            }`}
            placeholder="MH01AB1234"
            value={registrationNumber}
            onChange={(e) => {
              setRegistrationNumber(e.target.value.toUpperCase());
              setRegistrationError('');
            }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            disabled={isVerifying}
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
          />
        </div>
        {registrationError && (
          <p className="text-red-600 text-sm mt-2 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {registrationError}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-2">Format example: <span className="font-mono font-semibold">MH01AB1234</span> (no spaces)</p>
      </div>

      <button
        onClick={handleRegistrationSubmit}
        disabled={isVerifying || !registrationNumber.trim()}
        className={`w-full py-3.5 px-6 rounded-xl font-bold text-base tracking-wide transition-all duration-300 ${
          registrationNumber.trim() && !isVerifying
            ? 'bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white shadow-lg active:scale-[0.98]'
            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
        }`}
      >
        {isVerifying ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            Verifying…
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">Get Your Car Price
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M6 12h14"/></svg>
          </span>
        )}
      </button>

      <div className="grid grid-cols-3 gap-2 pt-2">
        {[
          { t: 'Secure', d: 'We don\'t share your RC' },
          { t: '2 mins', d: 'Average time to finish' },
          { t: 'Free', d: 'No fees, ever' }
        ].map(b => (
          <div key={b.t} className="text-center p-2 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-xs font-bold text-gray-900">{b.t}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{b.d}</p>
          </div>
        ))}
      </div>
    </div>
  );

  // Step 2: Brand picker
  const renderStep2 = () => (
    <div className="space-y-5">
      <BackBar onBack={handlePrevStep} currentStep={currentStep} totalSteps={totalSteps} />
      <StepHeader
        eyebrow="Manufacturer"
        title="Pick your car's brand"
        subtitle={`We found ${filteredBrands.length} brands. Search if you don't see yours.`}
        accent="purple"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M6 7V5a2 2 0 012-2h8a2 2 0 012 2v2M5 7h14l-1 12H6L5 7z"/></svg>
        }
      />

      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
        <input
          type="text"
          value={brandSearch}
          onChange={(e) => setBrandSearch(e.target.value)}
          placeholder="Search brands (e.g. Maruti, BMW)..."
          className="w-full pl-10 pr-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:ring-4 focus:ring-orange-100 focus:outline-none"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 md:gap-3 max-h-[380px] overflow-y-auto p-1">
          {filteredBrands.map((brand) => {
            const logoUrl = getBrandLogo(brand.name);
            const active = carDetails.make === brand.name;
            return (
              <button
                key={brand.name}
                onClick={() => handleBrandSelect(brand)}
                className={`group flex flex-col items-center justify-center p-2.5 md:p-3 rounded-xl transition-all duration-200 active:scale-95 border-2 ${
                  active
                    ? 'bg-orange-50 border-orange-500 shadow-md'
                    : 'bg-white border-gray-200 hover:border-orange-300 hover:bg-orange-50/50 hover:shadow-sm'
                }`}
              >
                <div className="w-12 h-12 md:w-14 md:h-14 mb-1.5 flex items-center justify-center bg-white rounded-lg p-1.5">
                  <img
                    src={logoUrl}
                    alt={`${brand.name} logo`}
                    className="max-w-full max-h-full object-contain"
                    loading="lazy"
                    style={{ maxWidth: '40px', maxHeight: '40px' }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('.logo-fallback')) {
                        const fallback = document.createElement('span');
                        fallback.className = 'logo-fallback text-xl md:text-2xl';
                        fallback.textContent = brand.logo;
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                </div>
                <span className="text-[10px] md:text-xs text-center font-semibold text-gray-700 group-hover:text-orange-600 leading-tight px-1">
                  {brand.name}
                </span>
              </button>
            );
          })}
          {filteredBrands.length === 0 && (
            <div className="col-span-full text-center py-8 text-sm text-gray-500">
              No brands match "{brandSearch}". Use the manual option below.
            </div>
          )}
        </div>
      )}

      <div className="p-4 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/60 space-y-2.5">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
          <h3 className="text-sm font-semibold text-gray-900">Can't find your brand?</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={manualMake}
            onChange={(e) => setManualMake(e.target.value)}
            placeholder="Type brand name"
            className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-400 focus:outline-none text-sm"
          />
          <button
            type="button"
            onClick={() => {
              if (!manualMake.trim()) return;
              setCarDetails(prev => ({ ...prev, make: manualMake.trim() }));
              setAvailableModels([]);
              handleNextStep();
            }}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50"
            disabled={!manualMake.trim()}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );

  // Step 3: Model picker
  const renderStep3 = () => (
    <div className="space-y-5">
      <BackBar onBack={handlePrevStep} currentStep={currentStep} totalSteps={totalSteps} />
      <StepHeader
        eyebrow={carDetails.make}
        title={<>Which <span className="text-orange-600">{carDetails.make}</span> model?</>}
        subtitle="Pick the exact model below."
        accent="rose"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-3m-4 4v-4m0 4h4m-4 0H8"/></svg>
        }
      />

      {availableModels.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {availableModels.map((model) => {
            const active = carDetails.model === model;
            return (
              <button
                key={model}
                onClick={() => { handleCarDetailChange('model', model); handleNextStep(); }}
                className={`p-3.5 border-2 rounded-xl transition-all duration-200 active:scale-[0.97] text-left ${
                  active ? 'border-orange-500 bg-orange-50 shadow-sm' : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/40'
                }`}
              >
                <span className="block text-sm font-bold text-gray-900">{model}</span>
                <span className="block text-[11px] text-gray-500 mt-0.5">{carDetails.make}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="p-5 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/60 space-y-3">
          <p className="text-sm text-gray-700">No preset models for this brand — enter it manually.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={manualModel}
              onChange={(e) => setManualModel(e.target.value)}
              placeholder="Enter model name"
              className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-400 focus:outline-none text-sm"
            />
            <button
              type="button"
              onClick={() => { if (!manualModel.trim()) return; handleCarDetailChange('model', manualModel.trim()); handleNextStep(); }}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50"
              disabled={!manualModel.trim()}
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Step 4: Year picker (grouped by decade)
  const renderStep4 = () => {
    const byDecade: Record<string, string[]> = {};
    years.forEach(y => {
      const decade = `${String(y).slice(0, 3)}0s`;
      if (!byDecade[decade]) byDecade[decade] = [];
      byDecade[decade].push(String(y));
    });
    const orderedDecades = Object.keys(byDecade).sort((a, b) => b.localeCompare(a));

    return (
      <div className="space-y-5">
        <BackBar onBack={handlePrevStep} currentStep={currentStep} totalSteps={totalSteps} />
        <StepHeader
          eyebrow="Year of manufacture"
          title="When was it made?"
          subtitle="Tap the year your car was manufactured."
          accent="blue"
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>}
        />

        <div className="max-h-[420px] overflow-y-auto pr-1 space-y-4">
          {orderedDecades.map(decade => (
            <div key={decade}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">{decade}</p>
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                {byDecade[decade].map(year => {
                  const active = selectedYear === year;
                  return (
                    <button
                      key={year}
                      onClick={() => handleYearSelect(year)}
                      className={`py-2.5 rounded-xl border-2 text-sm font-bold transition-all active:scale-95 ${
                        active
                          ? 'border-orange-500 bg-orange-500 text-white shadow'
                          : 'border-gray-200 bg-white text-gray-800 hover:border-orange-300 hover:bg-orange-50'
                      }`}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Step 5: State, then district (search + picks for selected state)
  const renderStep5 = () => {
    const q = (carDetails.district || '').trim().toLowerCase();
    const pool = districtsForState;
    const suggestions = q
      ? pool.filter((d) => d.toLowerCase().includes(q)).slice(0, 28)
      : pool.slice(0, 28);

    const pickMetro = (loc: (typeof POPULAR_METRO_LOCATIONS)[number]) => {
      setCarDetails((prev) => ({ ...prev, state: loc.state, district: loc.district }));
      setManualDistrict('');
      handleNextStep();
    };

    return (
      <div className="space-y-5">
        <BackBar onBack={handlePrevStep} currentStep={currentStep} totalSteps={totalSteps} />
        <StepHeader
          eyebrow="Location"
          title="Where is your car?"
          subtitle="Choose your state first, then district — or use a metro shortcut below."
          accent="teal"
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
        />

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">State / UT</label>
          <select
            value={carDetails.state}
            onChange={(e) => {
              const v = e.target.value;
              setCarDetails((prev) => ({ ...prev, state: v, district: '' }));
              setManualDistrict('');
            }}
            className="w-full px-4 py-3 text-base border-2 border-gray-200 rounded-xl bg-white focus:ring-4 focus:ring-orange-100 focus:border-orange-400 focus:outline-none"
          >
            <option value="">Select state</option>
            {indianStates.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>

        <div className="relative">
          <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input
            type="text"
            value={carDetails.district}
            onChange={(e) => handleCarDetailChange('district', e.target.value)}
            placeholder={carDetails.state ? 'Search districts in this state…' : 'Select state first'}
            disabled={!carDetails.state}
            className="w-full pl-10 pr-4 py-3 text-base border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-orange-100 focus:border-orange-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
            autoComplete="off"
          />
        </div>

        {!carDetails.state && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Popular metros</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR_METRO_LOCATIONS.map((loc) => (
                <button
                  key={loc.label}
                  type="button"
                  onClick={() => pickMetro(loc)}
                  className="px-3.5 py-1.5 rounded-full border-2 border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 transition"
                >
                  {loc.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {carDetails.state && suggestions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
              {q ? 'Matching districts' : `Districts in ${carDetails.state}`}
            </p>
            <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100 max-h-64 overflow-y-auto">
              {suggestions.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => { handleCarDetailChange('district', d); handleNextStep(); }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-800 hover:bg-orange-50 active:bg-orange-100 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/></svg>
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {carDetails.state && q && suggestions.length === 0 && (
          <p className="text-sm text-gray-500">No districts match your search — try another spelling or enter manually below.</p>
        )}

        <div className="p-4 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/60 space-y-2.5">
          <h3 className="text-sm font-semibold text-gray-900">Can&apos;t find your district?</h3>
          <p className="text-xs text-gray-600">Select state above, then type the district name as on your RC.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={manualDistrict}
              onChange={(e) => setManualDistrict(e.target.value)}
              placeholder="Enter district manually"
              disabled={!carDetails.state}
              className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-400 focus:outline-none text-sm disabled:bg-gray-100"
            />
            <button
              type="button"
              onClick={() => {
                if (!manualDistrict.trim() || !carDetails.state) return;
                handleCarDetailChange('district', manualDistrict.trim());
                handleNextStep();
              }}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50"
              disabled={!manualDistrict.trim() || !carDetails.state}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Step 6: Owners
  const renderStep6 = () => (
    <div className="space-y-5">
      <BackBar onBack={handlePrevStep} currentStep={currentStep} totalSteps={totalSteps} />
      <StepHeader
        eyebrow="Ownership"
        title="How many owners so far?"
        subtitle="Fewer owners usually fetches a better price."
        accent="green"
        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
      />
      <div className="space-y-2.5">
        {ownershipOptions.map((option, idx) => (
          <OptionTile
            key={option}
            label={option}
            hint={idx === 0 ? 'Best resale value' : idx === 1 ? 'Very common, still great' : 'Make sure papers are clean'}
            selected={selectedOwnership === option}
            onClick={() => handleOwnershipSelect(option)}
            leading={<span className="text-sm font-bold">#{idx + 1}</span>}
          />
        ))}
      </div>
    </div>
  );

  // Step 7: Variant
  const renderStep7 = () => (
    <div className="space-y-5">
      <BackBar onBack={handlePrevStep} currentStep={currentStep} totalSteps={totalSteps} />
      <StepHeader
        eyebrow={`${carDetails.make} · ${carDetails.model}`}
        title="Pick the variant / trim"
        subtitle="Variant affects price — make sure it's accurate."
        accent="purple"
        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M3 3h18v4H3V3zm2 4h14v14H5V7zm4 4h6v6H9v-6z"/></svg>}
      />
      {availableVariants.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {availableVariants.map(variant => {
            const active = carDetails.variant === variant;
            return (
              <button
                key={variant}
                onClick={() => { handleCarDetailChange('variant', variant); handleNextStep(); }}
                className={`px-3 py-3 rounded-xl border-2 text-sm font-bold transition-all active:scale-[0.97] ${
                  active ? 'border-orange-500 bg-orange-50 text-orange-700 shadow' : 'border-gray-200 bg-white text-gray-800 hover:border-orange-300 hover:bg-orange-50/40'
                }`}
              >
                {variant}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="p-5 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/60 space-y-3">
          <p className="text-sm text-gray-700">No variants found. Enter it manually (e.g. <span className="font-mono">VXi, ZXi+, Sportz</span>).</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={manualVariant}
              onChange={(e) => setManualVariant(e.target.value)}
              placeholder="Enter variant name"
              className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-400 focus:outline-none text-sm"
            />
            <button
              type="button"
              onClick={() => { if (!manualVariant.trim()) return; handleCarDetailChange('variant', manualVariant.trim()); handleNextStep(); }}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-50"
              disabled={!manualVariant.trim()}
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Step 8: Fuel type
  const renderStep8 = () => (
    <div className="space-y-5">
      <BackBar onBack={handlePrevStep} currentStep={currentStep} totalSteps={totalSteps} />
      <StepHeader
        eyebrow="Fuel"
        title="What does your car run on?"
        subtitle="Choose the primary fuel type."
        accent="orange"
        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>}
      />
      <div className="grid sm:grid-cols-2 gap-2.5">
        {fuelTypes.map(f => (
          <OptionTile
            key={f}
            label={f}
            hint={fuelMeta[f]?.hint}
            selected={selectedFuelType === f}
            onClick={() => handleFuelTypeSelect(f)}
            leading={fuelMeta[f]?.icon}
          />
        ))}
      </div>
    </div>
  );

  // Step 9: Kilometers driven
  const renderStep9 = () => (
    <div className="space-y-5">
      <BackBar onBack={handlePrevStep} currentStep={currentStep} totalSteps={totalSteps} />
      <StepHeader
        eyebrow="Odometer"
        title="How many kms has it run?"
        subtitle="Pick the range closest to your odometer reading."
        accent="blue"
        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"/></svg>}
      />
      <div className="grid sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
        {kilometerRanges.map(range => (
          <OptionTile
            key={range}
            label={range}
            selected={selectedKilometers === range}
            onClick={() => handleKilometersSelect(range)}
          />
        ))}
      </div>
    </div>
  );

  // Step 10: Transmission
  const renderStep10 = () => (
    <div className="space-y-5">
      <BackBar onBack={handlePrevStep} currentStep={currentStep} totalSteps={totalSteps} />
      <StepHeader
        eyebrow="Gearbox"
        title="Manual or Automatic?"
        subtitle="Select the transmission type of your car."
        accent="rose"
        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>}
      />
      <div className="grid sm:grid-cols-2 gap-2.5">
        {transmissionTypes.map(tx => (
          <OptionTile
            key={tx}
            label={tx}
            hint={transmissionMeta[tx]}
            selected={selectedTransmission === tx}
            onClick={() => handleTransmissionSelect(tx)}
            leading={<span className="text-xs font-bold">{tx.slice(0, 1)}</span>}
          />
        ))}
      </div>
    </div>
  );

  // Step 11: Contact + summary
  const renderStep11 = () => (
    <div className="space-y-5">
      <BackBar onBack={handlePrevStep} currentStep={currentStep} totalSteps={totalSteps} />
      <StepHeader
        eyebrow="Almost there"
        title="Share your contact number"
        subtitle="We'll share your valuation & next steps on this number."
        accent="green"
        icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>}
      />

      <div className="grid md:grid-cols-[1fr_1fr] gap-4">
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">Mobile number</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">+91</span>
            <input
              type="tel"
              className={`w-full pl-12 pr-4 py-3 text-base border-2 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:outline-none transition-all ${
                contactError ? 'border-red-400 ring-4 ring-red-100' : 'border-gray-200 focus:border-orange-400 focus:ring-4 focus:ring-orange-100'
              }`}
              placeholder="Enter 10-digit mobile number"
              value={customerContact}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                setCustomerContact(value);
                setContactError('');
              }}
              autoComplete="tel"
            />
          </div>
          {contactError && (
            <p className="text-red-600 text-sm flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              {contactError}
            </p>
          )}

          <div className="rounded-xl bg-green-50 border border-green-200 p-3 flex items-start gap-2.5">
            <svg className="w-5 h-5 text-green-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <p className="text-xs text-green-800">
              By continuing, you agree to receive calls & WhatsApp messages about your car valuation. We never spam.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Your car summary</p>
          <dl className="text-sm space-y-1.5">
            {[
              ['Registration', carDetails.registration],
              ['Make', carDetails.make],
              ['Model', carDetails.model],
              ['Variant', carDetails.variant],
              ['Year', carDetails.year],
              ['State', carDetails.state],
              ['District', carDetails.district],
              ['Owners', carDetails.noOfOwners],
              ['Fuel', carDetails.fuelType],
              ['Kms', carDetails.kilometers],
              ['Gearbox', selectedTransmission],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-2">
                <dt className="text-gray-500">{k}</dt>
                <dd className={`font-semibold ${v ? 'text-gray-900' : 'text-gray-300'}`}>{v || '—'}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <button
        onClick={handleContactSubmit}
        disabled={isLoading}
        className="w-full py-3.5 px-6 rounded-xl font-bold text-base tracking-wide transition-all duration-300 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            Submitting…
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            Submit & Get My Price
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M6 12h14"/></svg>
          </span>
        )}
      </button>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: return renderStep0();
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      case 7: return renderStep7();
      case 8: return renderStep8();
      case 9: return renderStep9();
      case 10: return renderStep10();
      case 11: return renderStep11();
      default: return renderStep0();
    }
  };

  const progressPercentage = currentStep === 0 ? 0 : (currentStep / (totalSteps - 1)) * 100;
  const cardWidthClass = currentStep === 0 ? 'max-w-5xl' : 'max-w-3xl';

  return (
    <div
      className="min-h-[calc(100vh-140px)] py-6 md:py-10 relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #5B2A86 0%, #8E3BB8 45%, #D24B9F 100%)' }}
    >
      {/* Decorative blurs */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 rounded-full bg-white/10 blur-3xl"></div>
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-orange-300/20 blur-3xl"></div>

      {/* Header */}
      <div className="relative px-4 pt-2 md:pt-4 pb-5 max-w-6xl mx-auto">
        <div className="flex justify-center items-center gap-2 mb-3">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <span className="text-white font-semibold text-lg tracking-wide">SellRight</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white text-center leading-tight">
          Sell Car Online
        </h1>
        <p className="text-teal-200 italic text-center text-sm md:text-base mt-1">
          at the Best Price
        </p>

        {/* Numbered step strip (hidden on step 0) */}
        {currentStep >= 1 && (
          <div className="mt-6 max-w-4xl mx-auto">
            <div className="hidden md:flex items-center justify-between gap-1.5">
              {STEP_LABELS.slice(1).map((label, idx) => {
                const step = idx + 1;
                const done = step < currentStep;
                const active = step === currentStep;
                return (
                  <div key={label} className="flex items-center flex-1 min-w-0">
                    <div className={`flex flex-col items-center flex-1 min-w-0 ${active ? 'text-white' : done ? 'text-white/80' : 'text-white/40'}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all ${
                        active ? 'bg-white text-orange-600 border-white shadow-md scale-110' :
                        done   ? 'bg-white/90 text-orange-600 border-white/90' :
                                 'bg-transparent border-white/40'
                      }`}>
                        {done ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                        ) : step}
                      </div>
                      <span className="text-[10px] font-semibold mt-1 truncate w-full text-center">{label}</span>
                    </div>
                    {idx < STEP_LABELS.length - 2 && (
                      <div className={`h-0.5 flex-1 mx-0.5 rounded ${done ? 'bg-white/90' : 'bg-white/20'}`}></div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Compact progress bar on mobile */}
            <div className="md:hidden">
              <div className="flex items-center justify-between text-xs text-white/90 mb-2">
                <span className="font-semibold">Step {currentStep} of {totalSteps - 1} · {STEP_LABELS[currentStep]}</span>
                <span>{Math.round(progressPercentage)}%</span>
              </div>
              <div className="w-full bg-white/15 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-orange-300 to-white h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step card */}
      <div className="relative px-4">
        <div className={`bg-white rounded-3xl shadow-2xl p-5 md:p-8 mx-auto ${cardWidthClass} transition-all duration-300 ${isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
          {renderCurrentStep()}
        </div>

        {/* Summary chips (step 2+) */}
        {currentStep >= 2 && summaryChips.length > 0 && (
          <div className="max-w-3xl mx-auto mt-4 flex flex-wrap gap-1.5 justify-center">
            {summaryChips.map(chip => (
              <span key={chip.label} className="inline-flex items-center gap-1 text-[11px] font-medium bg-white/15 backdrop-blur-sm text-white rounded-full px-3 py-1 border border-white/20">
                <span className="text-white/70">{chip.label}</span>
                <span className="text-white font-semibold">{chip.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Benefits strip */}
      {currentStep >= 1 && (
        <div className="relative flex flex-col sm:flex-row justify-center items-center gap-5 md:gap-10 mt-8 md:mt-12 pb-4 max-w-4xl mx-auto px-4">
          {[
            { title: 'Instant Payment', color: 'bg-gradient-to-br from-emerald-400 to-green-600', icon: <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
            { title: 'Free Evaluation', color: 'bg-gradient-to-br from-sky-400 to-blue-600',       icon: <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg> },
            { title: 'RC Transfer',   color: 'bg-gradient-to-br from-fuchsia-400 to-purple-600',   icon: <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> }
          ].map(b => (
            <div key={b.title} className="flex items-center gap-2.5 bg-white/10 backdrop-blur-sm rounded-full pl-1 pr-4 py-1 border border-white/15">
              <span className={`w-9 h-9 rounded-full ${b.color} flex items-center justify-center shadow`}>{b.icon}</span>
              <span className="text-white text-sm font-medium">{b.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SellCarPage;
