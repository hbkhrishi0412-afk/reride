import React, { useState, useEffect } from 'react';
import { View as ViewEnum } from '../types';
import { fetchCarDataFromSpinny, getModelsByMake, getVariantsByModel, getIndianDistricts, getCarYears, getOwnershipOptions, ScrapedCarData, CarMake } from '../utils/spinnyScraper';
import { sellCarAPI } from '../services/sellCarService';

interface SellCarPageProps {
  onNavigate: (view: ViewEnum) => void;
}

const SellCarPage: React.FC<SellCarPageProps> = ({ onNavigate }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [sellerType, setSellerType] = useState<'individual' | 'dealer'>('individual');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    district: '',
    noOfOwners: '',
    kilometers: '',
    fuelType: '',
    transmission: '',
    condition: '',
    expectedPrice: ''
  });
  
  // State for dynamic data
  const [carData, setCarData] = useState<ScrapedCarData | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [availableVariants, setAvailableVariants] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [hoveredBrand, setHoveredBrand] = useState<string | null>(null);
  const [registrationError, setRegistrationError] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedOwnership, setSelectedOwnership] = useState('');
  const [selectedFuelType, setSelectedFuelType] = useState('');
  const [selectedKilometers, setSelectedKilometers] = useState('');
  const [selectedTransmission, setSelectedTransmission] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [contactError, setContactError] = useState('');

  const totalSteps = 12; // Step 0 is preference selection, steps 1-11 are form steps
  const districts = getIndianDistricts();
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

  // Load car data on component mount
  useEffect(() => {
    const loadCarData = async () => {
      setIsLoading(true);
      try {
        const data = await fetchCarDataFromSpinny();
        setCarData(data);
      } catch (error) {
        console.error('Failed to load car data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCarData();
  }, []);

  // Load remembered email when sellerType changes
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

  // Update models when make changes
  useEffect(() => {
    if (carData && carDetails.make) {
      const models = getModelsByMake(carDetails.make, carData);
      setAvailableModels(models.map(m => m.name));
      setAvailableVariants([]); // Reset variants
      setCarDetails(prev => ({ ...prev, model: '', variant: '' }));
    }
  }, [carDetails.make, carData]);

  // Update variants when model changes
  useEffect(() => {
    if (carData && carDetails.make && carDetails.model) {
      const variants = getVariantsByModel(carDetails.make, carDetails.model, carData);
      setAvailableVariants(variants);
      setCarDetails(prev => ({ ...prev, variant: '' }));
    }
  }, [carDetails.model, carData]);

  const handleNextStep = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1));
      setIsAnimating(false);
    }, 300);
  };

  const handlePrevStep = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(prev => Math.max(prev - 1, 0));
      setIsAnimating(false);
    }, 300);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    if (!email || !password) {
      setLoginError('Please enter both email and password');
      return;
    }
    
    setIsLoggingIn(true);
    
    try {
      // Simulate login - in real app, this would call your login API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // After successful login, proceed to step 1 (car form)
      if (sellerType === 'dealer') {
        // For dealer, you might want to redirect to seller dashboard or continue
        handleNextStep();
      } else {
        // For individual, continue to car form
        handleNextStep();
      }
      
      // Save remember me preference
      if (rememberMe) {
        const storageKey = sellerType === 'dealer' ? 'rememberedSellerEmail' : 'rememberedCustomerEmail';
        localStorage.setItem(storageKey, email);
      }
    } catch (error) {
      setLoginError('Invalid email or password. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const validateRegistration = (reg: string): boolean => {
    // Basic Indian registration number validation
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
    
    // Simulate API call for verification
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsVerifying(false);
    setCarDetails(prev => ({ ...prev, registration: registrationNumber }));
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
    // Submit all data to backend
    submitCarData();
  };

  const submitCarData = async () => {
    const carSubmissionData = {
      registration: carDetails.registration,
      make: carDetails.make,
      model: carDetails.model,
      variant: carDetails.variant,
      year: carDetails.year,
      district: carDetails.district,
      noOfOwners: carDetails.noOfOwners,
      kilometers: carDetails.kilometers,
      fuelType: carDetails.fuelType,
      transmission: selectedTransmission,
      customerContact: customerContact
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

  const renderStep0 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <form onSubmit={handleLogin} className="space-y-6">
        {/* Login Form */}
        <div className="space-y-4">
          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setLoginError('');
              }}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-orange-500 transition-all duration-300 text-base"
              placeholder="Enter your email address"
              required
              autoComplete="email"
            />
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLoginError('');
                }}
                className="w-full px-4 py-2.5 pr-12 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-orange-500 transition-all duration-300 text-base"
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {loginError && (
          <div className="text-red-500 text-sm text-center">
            {loginError}
          </div>
        )}

        {/* Remember Me and Forgot Password */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
            />
            <span className="text-sm text-gray-700">Remember me</span>
          </label>
          <button
            type="button"
            onClick={() => onNavigate(ViewEnum.FORGOT_PASSWORD)}
            className="text-sm text-orange-500 hover:text-orange-600 font-medium"
          >
            Forgot password?
          </button>
        </div>

        {/* Login Button */}
        <button
          type="submit"
          disabled={isLoggingIn || !email || !password}
          className={`w-full py-3 px-6 rounded-lg font-semibold text-base transition-all duration-300 ${
            isLoggingIn || !email || !password
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-95'
          }`}
        >
          {isLoggingIn ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Logging in...
            </span>
          ) : (
            'Login'
          )}
        </button>
      </form>
    </div>
  );

  const renderStep1 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="space-y-6">
        {/* Instructional Text */}
        <p className="text-gray-500 text-base leading-relaxed text-center">
          Get an instant valuation for your car. We'll fetch basic details automatically.
        </p>
        
        {/* Registration Input */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            className={`w-full pl-10 pr-4 py-3 text-base border-2 rounded-lg bg-white text-black placeholder-gray-400 focus:outline-none transition-all duration-300 ${
              inputFocused ? 'border-orange-500 shadow-md' : 'border-gray-300'
            }`}
            placeholder="Search by brand, model..."
            value={registrationNumber}
            onChange={(e) => {
              setRegistrationNumber(e.target.value.toUpperCase());
              setRegistrationError('');
            }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            disabled={isVerifying}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        </div>
        
        {registrationError && (
          <div className="text-red-500 text-sm text-center">
            {registrationError}
          </div>
        )}
        
        {/* Search Button */}
        <button
          onClick={handleRegistrationSubmit}
          disabled={isVerifying || !registrationNumber.trim()}
          className={`w-full py-3 px-6 rounded-lg font-semibold text-base transition-all duration-300 ${
            registrationNumber.trim() && !isVerifying
              ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-md active:scale-95'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isVerifying ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Verifying...
            </span>
          ) : (
            'Search'
          )}
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Select Your Car's Make
          </h2>
          <p className="text-sm text-gray-600">
            Choose the manufacturer of your vehicle
          </p>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {carData?.makes.map((brand, index) => (
              <button
                key={brand.name}
                onClick={() => handleBrandSelect(brand)}
                className="flex flex-col items-center p-3 border-2 rounded-lg transition-all duration-300 active:scale-95 border-gray-200 hover:border-orange-300 hover:bg-orange-50"
              >
                <div className="text-2xl mb-1">
                  {brand.logo}
                </div>
                <span className="text-xs text-center font-medium text-gray-700">
                  {brand.name}
                </span>
              </button>
            ))}
          </div>
        )}
        
        <div className="flex justify-center pt-4">
          <button
            onClick={handlePrevStep}
            className="px-6 py-2.5 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-300 active:scale-95"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Select Your Car's Model
          </h2>
          <p className="text-sm text-gray-600">
            Choose the model of your {carDetails.make}
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {availableModels.map((model, index) => (
            <button
              key={model}
              onClick={() => {
                handleCarDetailChange('model', model);
                handleNextStep();
              }}
              className="p-3 border-2 border-gray-200 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition-all duration-300 active:scale-95"
            >
              <span className="text-gray-800 font-semibold text-sm">{model}</span>
            </button>
          ))}
        </div>
        
        <div className="flex justify-center pt-4">
          <button
            onClick={handlePrevStep}
            className="px-6 py-2.5 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-300 active:scale-95"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Select Manufacturing Year
          </h2>
          <p className="text-sm text-gray-600">
            When was your car manufactured?
          </p>
        </div>
        
        <div className="grid grid-cols-3 gap-3 max-h-80 overflow-y-auto">
          {years.map((year) => (
            <button
              key={year}
              onClick={() => handleYearSelect(year)}
              className={`p-3 border-2 rounded-lg transition-all duration-300 active:scale-95 ${
                selectedYear === year 
                  ? 'border-orange-400 bg-orange-50 shadow-md' 
                  : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
              }`}
            >
              <span className="text-gray-800 font-semibold text-sm">{year}</span>
            </button>
          ))}
        </div>
        
        <div className="flex justify-center pt-4">
          <button
            onClick={handlePrevStep}
            className="px-6 py-2.5 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-300 active:scale-95"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Select Your District
          </h2>
          <p className="text-sm text-gray-600">
            Where is your car currently located?
          </p>
        </div>
        
        <div className="relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-3 text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-300"
            placeholder="Search your district..."
            value={carDetails.district}
            onChange={(e) => {
              const value = e.target.value;
              handleCarDetailChange('district', value);
            }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        </div>
        
        <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
          {districts
            .filter(district => 
              carDetails.district ? 
              district.toLowerCase().includes(carDetails.district.toLowerCase()) : 
              true
            )
            .slice(0, 20)
            .map((district) => (
              <button
                key={district}
                onClick={() => {
                  handleCarDetailChange('district', district);
                  handleNextStep();
                }}
                className="w-full p-3 text-left border-b border-gray-200 hover:bg-orange-50 transition-colors duration-200 active:bg-orange-100"
              >
                <span className="text-gray-800 text-sm">{district}</span>
              </button>
            ))}
        </div>
        
        <div className="flex justify-center pt-4">
          <button
            onClick={handlePrevStep}
            className="px-6 py-2.5 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-300 active:scale-95"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep6 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Number of Previous Owners
          </h2>
          <p className="text-sm text-gray-600">
            How many owners has your car had?
          </p>
        </div>
        
        <div className="space-y-3">
          {ownershipOptions.map((option) => (
            <button
              key={option}
              onClick={() => handleOwnershipSelect(option)}
              className={`w-full p-3 border-2 rounded-lg transition-all duration-300 active:scale-95 ${
                selectedOwnership === option 
                  ? 'border-orange-400 bg-orange-50 shadow-md' 
                  : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-800 font-semibold text-sm">{option}</span>
                {selectedOwnership === option && (
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
        
        <div className="flex justify-center pt-4">
          <button
            onClick={handlePrevStep}
            className="px-6 py-2.5 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-300 active:scale-95"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep7 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Select Your Car's Variant
          </h2>
          <p className="text-sm text-gray-600">
            Choose the variant of your {carDetails.model}
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {availableVariants.map((variant) => (
            <button
              key={variant}
              onClick={() => {
                handleCarDetailChange('variant', variant);
                handleNextStep();
              }}
              className="p-3 border-2 border-gray-200 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition-all duration-300 active:scale-95"
            >
              <span className="text-gray-800 font-semibold text-sm">{variant}</span>
            </button>
          ))}
        </div>
        
        <div className="flex justify-center pt-4">
          <button
            onClick={handlePrevStep}
            className="px-6 py-2.5 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-300 active:scale-95"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep8 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Select the <span className="text-orange-600">fuel type</span> of your car
          </h2>
          <p className="text-sm text-gray-600">
            What type of fuel does your car use?
          </p>
        </div>
        
        <div className="space-y-3">
          {fuelTypes.map((fuelType) => (
            <button
              key={fuelType}
              onClick={() => handleFuelTypeSelect(fuelType)}
              className={`w-full p-3 border-2 rounded-lg transition-all duration-300 active:scale-95 ${
                selectedFuelType === fuelType 
                  ? 'border-orange-400 bg-orange-50 shadow-md' 
                  : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-800 font-semibold text-sm">{fuelType}</span>
                {selectedFuelType === fuelType && (
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
        
        <div className="flex justify-center pt-4">
          <button
            onClick={handlePrevStep}
            className="px-6 py-2.5 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-300 active:scale-95"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep9 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Select the <span className="text-orange-600">kilometers driven</span> by your car
          </h2>
          <p className="text-sm text-gray-600">
            How many kilometers has your car been driven?
          </p>
        </div>
        
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {kilometerRanges.map((range) => (
            <button
              key={range}
              onClick={() => handleKilometersSelect(range)}
              className={`w-full p-3 border-2 rounded-lg transition-all duration-300 active:scale-95 ${
                selectedKilometers === range 
                  ? 'border-orange-400 bg-orange-50 shadow-md' 
                  : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-800 font-semibold text-sm">{range}</span>
                {selectedKilometers === range && (
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
        
        <div className="flex justify-center pt-4">
          <button
            onClick={handlePrevStep}
            className="px-6 py-2.5 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-300 active:scale-95"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep10 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Select the <span className="text-orange-600">transmission type</span> of your car
          </h2>
          <p className="text-sm text-gray-600">
            What type of transmission does your car have?
          </p>
        </div>
        
        <div className="space-y-3">
          {transmissionTypes.map((transmission) => (
            <button
              key={transmission}
              onClick={() => handleTransmissionSelect(transmission)}
              className={`w-full p-3 border-2 rounded-lg transition-all duration-300 active:scale-95 ${
                selectedTransmission === transmission 
                  ? 'border-orange-400 bg-orange-50 shadow-md' 
                  : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-800 font-semibold text-sm">{transmission}</span>
                {selectedTransmission === transmission && (
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
        
        <div className="flex justify-center pt-4">
          <button
            onClick={handlePrevStep}
            className="px-6 py-2.5 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-300 active:scale-95"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep11 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Enter Your <span className="text-orange-600">Contact Number</span>
          </h2>
          <p className="text-sm text-gray-600">
            We'll use this to contact you about your car valuation
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <input
              type="tel"
              className={`w-full pl-10 pr-4 py-3 text-base border-2 rounded-lg bg-white text-black placeholder-gray-400 focus:outline-none transition-all duration-300 ${
                contactError ? 'border-red-400' : 'border-gray-300 focus:border-orange-400 focus:shadow-md'
              }`}
              placeholder="Enter your 10-digit mobile number"
              value={customerContact}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                setCustomerContact(value);
                setContactError('');
              }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
          </div>
          
          {contactError && (
            <div className="text-red-500 text-sm text-center">
              {contactError}
            </div>
          )}
          
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 border border-gray-200">
            <h3 className="text-gray-900 font-semibold text-base mb-3">Car Details Summary:</h3>
            <div className="text-gray-700 space-y-1.5 text-sm">
              <p><span className="font-medium">Registration:</span> {carDetails.registration || 'N/A'}</p>
              <p><span className="font-medium">Make:</span> {carDetails.make || 'N/A'}</p>
              <p><span className="font-medium">Model:</span> {carDetails.model || 'N/A'}</p>
              <p><span className="font-medium">Variant:</span> {carDetails.variant || 'N/A'}</p>
              <p><span className="font-medium">Year:</span> {carDetails.year || 'N/A'}</p>
              <p><span className="font-medium">District:</span> {carDetails.district || 'N/A'}</p>
              <p><span className="font-medium">Owners:</span> {carDetails.noOfOwners || 'N/A'}</p>
              <p><span className="font-medium">Fuel Type:</span> {carDetails.fuelType || 'N/A'}</p>
              <p><span className="font-medium">Kilometers:</span> {carDetails.kilometers || 'N/A'}</p>
              <p><span className="font-medium">Transmission:</span> {selectedTransmission || 'N/A'}</p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-center gap-3 pt-4">
          <button
            onClick={handlePrevStep}
            className="px-6 py-2.5 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-300 active:scale-95"
          >
            Back
          </button>
          <button
            onClick={handleContactSubmit}
            disabled={isLoading}
            className="px-6 py-2.5 rounded-lg font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-all duration-300 active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Submitting...' : 'Submit Details'}
          </button>
        </div>
      </div>
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

  // Calculate progress: Step 0 (preference) = 0%, Step 1 = ~9%, Step 11 = 100%
  const progressPercentage = currentStep === 0 ? 0 : ((currentStep) / (totalSteps - 1)) * 100;
  const isLoginStep = currentStep === 0;

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Purple Header Section - Mobile Design */}
      <div 
        className="px-4 pt-3 pb-4"
        style={{
          background: 'linear-gradient(180deg, #6b21a8 0%, #7c3aed 50%, #9333ea 100%)'
        }}
      >
        {/* White Square Icon */}
        <div className="flex justify-center mb-1.5">
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-md">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
        </div>

        {/* Welcome Text */}
        <h1 className="text-xl font-bold text-white text-center leading-tight mb-0.5">
          Welcome Back, {sellerType === 'dealer' ? 'Seller' : 'Customer'}!
        </h1>
        <p className="text-white/90 text-sm text-center mb-2">
          Sign in to continue
        </p>

        {/* Customer/Seller Toggle Buttons */}
        <div className="flex gap-2 justify-center">
          <button
            type="button"
            onClick={() => setSellerType('individual')}
            className={`px-5 py-1.5 rounded-full font-medium text-xs transition-all duration-300 ${
              sellerType === 'individual'
                ? 'bg-purple-700 text-white shadow-md'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            Customer
          </button>
          <button
            type="button"
            onClick={() => setSellerType('dealer')}
            className={`px-5 py-1.5 rounded-full font-medium text-xs transition-all duration-300 ${
              sellerType === 'dealer'
                ? 'bg-purple-700 text-white shadow-md'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            Seller
          </button>
        </div>

        {/* Progress Indicator - Hidden for login step */}
        {!isLoginStep && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-white/90 mb-2">
              <span>Step {currentStep} of {totalSteps - 1}</span>
              <span>{Math.round(progressPercentage)}% Complete</span>
            </div>
            <div className="w-full bg-gray-700/50 rounded-full h-1.5">
              <div 
                className="bg-white h-1.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Card */}
      <div className="px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-lg p-5">
          {renderCurrentStep()}
        </div>
      </div>

    </div>
  );
};

export default SellCarPage;