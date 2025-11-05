import React, { useState, useEffect } from 'react';
import { View as ViewEnum } from '../types';
import { fetchCarDataFromSpinny, getModelsByMake, getVariantsByModel, getIndianDistricts, getCarYears, getOwnershipOptions, ScrapedCarData, CarMake } from '../utils/spinnyScraper';
import { sellCarAPI } from '../services/sellCarService';

interface SellCarPageProps {
  onNavigate: (view: ViewEnum) => void;
}

const SellCarPage: React.FC<SellCarPageProps> = ({ onNavigate }) => {
  const [currentStep, setCurrentStep] = useState(1);
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

  const totalSteps = 11;
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
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
      setIsAnimating(false);
    }, 300);
  };

  const handlePrevStep = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(prev => Math.max(prev - 1, 1));
      setIsAnimating(false);
    }, 300);
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
      const result = await sellCarAPI.submitCarData(carSubmissionData);
      
      if (result.success) {
        alert('Car details submitted successfully! We will contact you soon.');
        onNavigate(ViewEnum.HOME);
      } else {
        alert(result.error || 'Failed to submit car details. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting car data:', error);
      alert('Failed to submit car details. Please try again.');
    }
  };

  const renderStep1 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="text-center space-y-8">
        <div className="space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Enter Your Car's Registration Number
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Get an instant valuation for your car. We'll fetch basic details automatically.
          </p>
        </div>
        
        <div className="relative max-w-md mx-auto">
          <input
            type="text"
            className={`sell-car-input w-full p-4 pr-12 text-lg border-2 rounded-xl bg-white text-black placeholder-gray-500 focus:outline-none transition-all duration-300 ${
              inputFocused ? 'border-purple-400 shadow-lg scale-105' : 'border-gray-300'
            }`}
            placeholder="e.g., MH01AB1234"
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
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
        
        {registrationError && (
          <div className="text-red-400 text-sm animate-fade-in">
            {registrationError}
          </div>
        )}
        
        <button
          onClick={handleRegistrationSubmit}
          disabled={isVerifying || !registrationNumber.trim()}
          className={`px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 active:scale-95 ${
            registrationNumber.trim() && !isVerifying
              ? 'bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isVerifying ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Verifying...
            </span>
          ) : (
            'GET YOUR CAR PRICE'
          )}
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Select Your Car's Make
          </h2>
          <p className="text-xl text-gray-300">
            Choose the manufacturer of your vehicle
          </p>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 max-w-6xl mx-auto">
            {carData?.makes.map((brand, index) => (
              <button
                key={brand.name}
                onClick={() => handleBrandSelect(brand)}
                onMouseEnter={() => setHoveredBrand(brand.name)}
                onMouseLeave={() => setHoveredBrand(null)}
                className={`flex flex-col items-center p-4 border-2 rounded-xl transition-all duration-300 transform hover:scale-110 hover:-translate-y-2 ${
                  hoveredBrand === brand.name 
                    ? 'border-purple-400 bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-xl' 
                    : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="text-3xl mb-2 transition-transform duration-300 hover:scale-125">
                  {brand.logo}
                </div>
                <span className="text-xs text-center font-medium">
                  {brand.name}
                </span>
              </button>
            ))}
          </div>
        )}
        
        <div className="flex justify-center">
          <button
            onClick={handlePrevStep}
            className="px-6 py-3 rounded-xl font-semibold text-gray-700 bg-white hover:bg-gray-100 transition-all duration-300 hover:scale-105"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Select Your Car's Model
          </h2>
          <p className="text-xl text-gray-300">
            Choose the model of your {carDetails.make}
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {availableModels.map((model, index) => (
            <button
              key={model}
              onClick={() => {
                handleCarDetailChange('model', model);
                handleNextStep();
              }}
              className="p-4 border-2 border-gray-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <span className="text-gray-800 font-semibold">{model}</span>
            </button>
          ))}
        </div>
        
        <div className="flex justify-center">
          <button
            onClick={handlePrevStep}
            className="px-6 py-3 rounded-xl font-semibold text-gray-700 bg-white hover:bg-gray-100 transition-all duration-300 hover:scale-105"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Select Manufacturing Year
          </h2>
          <p className="text-xl text-gray-300">
            When was your car manufactured?
          </p>
        </div>
        
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-w-4xl mx-auto max-h-96 overflow-y-auto">
          {years.map((year, index) => (
            <button
              key={year}
              onClick={() => handleYearSelect(year)}
              className={`p-3 border-2 rounded-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 ${
                selectedYear === year 
                  ? 'border-purple-400 bg-gradient-to-r from-purple-50 to-pink-50 shadow-lg' 
                  : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
              }`}
              style={{ animationDelay: `${index * 20}ms` }}
            >
              <span className="text-gray-800 font-semibold">{year}</span>
            </button>
          ))}
        </div>
        
        <div className="flex justify-center">
          <button
            onClick={handlePrevStep}
            className="px-6 py-3 rounded-xl font-semibold text-gray-700 bg-white hover:bg-gray-100 transition-all duration-300 hover:scale-105"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Select Your District
          </h2>
          <p className="text-xl text-gray-300">
            Where is your car currently located?
          </p>
        </div>
        
        <div className="max-w-md mx-auto">
          <div className="relative">
            <input
              type="text"
              className="sell-car-input w-full p-4 pr-12 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
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
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          
          <div className="mt-4 max-h-60 overflow-y-auto">
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
                  className="w-full p-3 text-left border-b border-gray-200 hover:bg-purple-50 transition-colors duration-200"
                >
                  <span className="text-gray-800">{district}</span>
                </button>
              ))}
          </div>
        </div>
        
        <div className="flex justify-center">
          <button
            onClick={handlePrevStep}
            className="px-6 py-3 rounded-xl font-semibold text-gray-700 bg-white hover:bg-gray-100 transition-all duration-300 hover:scale-105"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep6 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Number of Previous Owners
          </h2>
          <p className="text-xl text-gray-300">
            How many owners has your car had?
          </p>
        </div>
        
        <div className="space-y-3 max-w-md mx-auto">
          {ownershipOptions.map((option, index) => (
            <button
              key={option}
              onClick={() => handleOwnershipSelect(option)}
              className={`w-full p-4 border-2 rounded-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 ${
                selectedOwnership === option 
                  ? 'border-purple-400 bg-gradient-to-r from-purple-50 to-pink-50 shadow-lg' 
                  : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-800 font-semibold">{option}</span>
                {selectedOwnership === option && (
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
        
        <div className="flex justify-center">
          <button
            onClick={handlePrevStep}
            className="px-6 py-3 rounded-xl font-semibold text-gray-700 bg-white hover:bg-gray-100 transition-all duration-300 hover:scale-105"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep7 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Select Your Car's Variant
          </h2>
          <p className="text-xl text-gray-300">
            Choose the variant of your {carDetails.model}
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {availableVariants.map((variant, index) => (
            <button
              key={variant}
              onClick={() => {
                handleCarDetailChange('variant', variant);
                handleNextStep();
              }}
              className="p-4 border-2 border-gray-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <span className="text-gray-800 font-semibold">{variant}</span>
            </button>
          ))}
        </div>
        
        <div className="flex justify-center">
          <button
            onClick={handlePrevStep}
            className="px-6 py-3 rounded-xl font-semibold text-gray-700 bg-white hover:bg-gray-100 transition-all duration-300 hover:scale-105"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep8 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Select the <span className="font-bold text-purple-400">fuel type</span> of your car
          </h2>
          <p className="text-xl text-gray-300">
            What type of fuel does your car use?
          </p>
        </div>
        
        <div className="space-y-3 max-w-md mx-auto">
          {fuelTypes.map((fuelType, index) => (
            <button
              key={fuelType}
              onClick={() => handleFuelTypeSelect(fuelType)}
              className={`w-full p-4 border-2 rounded-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 ${
                selectedFuelType === fuelType 
                  ? 'border-purple-400 bg-gradient-to-r from-purple-50 to-pink-50 shadow-lg' 
                  : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-800 font-semibold">{fuelType}</span>
                {selectedFuelType === fuelType && (
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
        
        <div className="flex justify-center">
          <button
            onClick={handlePrevStep}
            className="px-6 py-3 rounded-xl font-semibold text-gray-700 bg-white hover:bg-gray-100 transition-all duration-300 hover:scale-105"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep9 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Select the <span className="font-bold text-purple-400">kilometers driven</span> by your car
          </h2>
          <p className="text-xl text-gray-300">
            How many kilometers has your car been driven?
          </p>
        </div>
        
        <div className="space-y-3 max-w-md mx-auto max-h-96 overflow-y-auto">
          {kilometerRanges.map((range, index) => (
            <button
              key={range}
              onClick={() => handleKilometersSelect(range)}
              className={`w-full p-4 border-2 rounded-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 ${
                selectedKilometers === range 
                  ? 'border-purple-400 bg-gradient-to-r from-purple-50 to-pink-50 shadow-lg' 
                  : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
              }`}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-800 font-semibold">{range}</span>
                {selectedKilometers === range && (
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
        
        <div className="flex justify-center">
          <button
            onClick={handlePrevStep}
            className="px-6 py-3 rounded-xl font-semibold text-gray-700 bg-white hover:bg-gray-100 transition-all duration-300 hover:scale-105"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep10 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Select the <span className="font-bold text-purple-400">transmission type</span> of your car
          </h2>
          <p className="text-xl text-gray-300">
            What type of transmission does your car have?
          </p>
        </div>
        
        <div className="space-y-3 max-w-md mx-auto">
          {transmissionTypes.map((transmission, index) => (
            <button
              key={transmission}
              onClick={() => handleTransmissionSelect(transmission)}
              className={`w-full p-4 border-2 rounded-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 ${
                selectedTransmission === transmission 
                  ? 'border-purple-400 bg-gradient-to-r from-purple-50 to-pink-50 shadow-lg' 
                  : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-800 font-semibold">{transmission}</span>
                {selectedTransmission === transmission && (
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
        
        <div className="flex justify-center">
          <button
            onClick={handlePrevStep}
            className="px-6 py-3 rounded-xl font-semibold text-gray-700 bg-white hover:bg-gray-100 transition-all duration-300 hover:scale-105"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep11 = () => (
    <div className={`transition-all duration-500 ${isAnimating ? 'opacity-0 transform translate-x-4' : 'opacity-100 transform translate-x-0'}`}>
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Enter Your <span className="font-bold text-purple-400">Contact Number</span>
          </h2>
          <p className="text-xl text-gray-300">
            We'll use this to contact you about your car valuation
          </p>
        </div>
        
        <div className="max-w-md mx-auto space-y-4">
          <div className="relative">
            <input
              type="tel"
              className={`sell-car-input w-full p-4 pr-12 text-lg border-2 rounded-xl bg-white text-black placeholder-gray-500 focus:outline-none transition-all duration-300 ${
                contactError ? 'border-red-400' : 'border-gray-300 focus:border-purple-400 focus:shadow-lg'
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
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
          </div>
          
          {contactError && (
            <div className="text-red-400 text-sm text-center animate-pulse">
              {contactError}
            </div>
          )}
          
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 space-y-3">
            <h3 className="text-white font-semibold text-lg">Car Details Summary:</h3>
            <div className="text-gray-300 space-y-1 text-sm">
              <p><span className="font-medium">Registration:</span> {carDetails.registration}</p>
              <p><span className="font-medium">Make:</span> {carDetails.make}</p>
              <p><span className="font-medium">Model:</span> {carDetails.model}</p>
              <p><span className="font-medium">Variant:</span> {carDetails.variant}</p>
              <p><span className="font-medium">Year:</span> {carDetails.year}</p>
              <p><span className="font-medium">District:</span> {carDetails.district}</p>
              <p><span className="font-medium">Owners:</span> {carDetails.noOfOwners}</p>
              <p><span className="font-medium">Fuel Type:</span> {carDetails.fuelType}</p>
              <p><span className="font-medium">Kilometers:</span> {carDetails.kilometers}</p>
              <p><span className="font-medium">Transmission:</span> {selectedTransmission}</p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-center space-x-4">
          <button
            onClick={handlePrevStep}
            className="px-6 py-3 rounded-xl font-semibold text-gray-700 bg-white hover:bg-gray-100 transition-all duration-300 hover:scale-105"
          >
            Back
          </button>
          <button
            onClick={handleContactSubmit}
            className="px-8 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 transition-all duration-300 hover:scale-105 shadow-lg"
          >
            Submit Details
          </button>
        </div>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
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
      default: return renderStep1();
    }
  };

  const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 relative overflow-hidden">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 animate-pulse" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="flex items-center justify-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center mr-3 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <span className="text-white text-2xl font-bold">SellRight</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-2 animate-slide-up">
            Sell Car Online
          </h1>
          <p className="text-2xl md:text-3xl font-semibold text-teal-400 italic animate-slide-up" style={{ animationDelay: '200ms' }}>
            at the Best Price
          </p>
        </div>

        {/* Progress Bar */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="flex items-center justify-between text-sm text-gray-300 mb-2">
            <span>Step {currentStep} of {totalSteps}</span>
            <span>{Math.round(progressPercentage)}% Complete</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Main Card */}
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 transform hover:scale-105 transition-all duration-500">
            {renderCurrentStep()}
          </div>
        </div>

        {/* Features Section */}
        <div className="max-w-4xl mx-auto mt-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: '💰', title: 'Instant Payment', delay: '0ms' },
              { icon: '🔍', title: 'Free Car Evaluation', delay: '200ms' },
              { icon: '📄', title: 'Free & Fast RC Transfer', delay: '400ms' }
            ].map((feature, index) => (
              <div 
                key={index}
                className="text-center text-teal-400 animate-fade-in hover:scale-110 transition-transform duration-300"
                style={{ animationDelay: feature.delay }}
              >
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-teal-100 to-teal-200 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow duration-300">
                  <span className="text-2xl">{feature.icon}</span>
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};

export default SellCarPage;