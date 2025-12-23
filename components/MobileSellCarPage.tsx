import React, { useState, useEffect } from 'react';
import { View as ViewEnum } from '../types';
import { fetchCarDataFromSpinny, getModelsByMake, getVariantsByModel, getIndianDistricts, getCarYears, getOwnershipOptions, ScrapedCarData } from '../utils/spinnyScraper';
import { sellCarAPI } from '../services/sellCarService';

interface MobileSellCarPageProps {
  onNavigate: (view: ViewEnum) => void;
}

/**
 * Mobile-Optimized Sell Car Page
 * Features:
 * - Step-by-step wizard optimized for mobile
 * - Touch-friendly form inputs
 * - Progress indicator
 * - Mobile camera integration ready
 */
export const MobileSellCarPage: React.FC<MobileSellCarPageProps> = ({ onNavigate }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [sellerType, setSellerType] = useState<'individual' | 'dealer'>('individual');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
  
  const [carData, setCarData] = useState<ScrapedCarData | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [availableVariants, setAvailableVariants] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  const [customerContact, setCustomerContact] = useState('');

  const totalSteps = 8;
  const districts = getIndianDistricts();
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

  const handleNextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1));
    window.scrollTo(0, 0);
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
    window.scrollTo(0, 0);
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
      const result = await sellCarAPI(registrationNumber);
      if (result.success && result.data) {
        setCarDetails(prev => ({
          ...prev,
          registration: registrationNumber,
          make: result.data?.make || '',
          model: result.data?.model || '',
          variant: result.data?.variant || '',
          year: result.data?.year?.toString() || ''
        }));
        handleNextStep();
      } else {
        setRegistrationError(result.message || 'Could not fetch car details. Please fill manually.');
        handleNextStep();
      }
    } catch (error) {
      setRegistrationError('Error fetching details. Please fill manually.');
      handleNextStep();
    } finally {
      setIsVerifying(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0: // Seller Type Selection
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">I am a</h2>
            <button
              onClick={() => {
                setSellerType('individual');
                handleNextStep();
              }}
              className="w-full p-6 bg-white rounded-xl border-2 border-gray-200 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Individual</h3>
                  <p className="text-sm text-gray-600">Selling my personal vehicle</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => {
                setSellerType('dealer');
                handleNextStep();
              }}
              className="w-full p-6 bg-white rounded-xl border-2 border-gray-200 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Dealer</h3>
                  <p className="text-sm text-gray-600">I have a dealership</p>
                </div>
              </div>
            </button>
          </div>
        );

      case 1: // Registration Number
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Enter Registration Number</h2>
            <p className="text-gray-600 mb-4">We'll fetch your car details automatically</p>
            <div>
              <input
                type="text"
                placeholder="e.g., MH01AB1234"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                className="w-full px-4 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                style={{ minHeight: '56px' }}
                autoCapitalize="characters"
              />
              {registrationError && (
                <p className="text-red-500 text-sm mt-2">{registrationError}</p>
              )}
            </div>
            <button
              onClick={handleRegistrationSubmit}
              disabled={isVerifying || !registrationNumber.trim()}
              className="w-full py-4 bg-orange-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '56px' }}
            >
              {isVerifying ? 'Fetching Details...' : 'Continue'}
            </button>
            <button
              onClick={handleNextStep}
              className="w-full py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold"
              style={{ minHeight: '56px' }}
            >
              Fill Details Manually
            </button>
          </div>
        );

      case 2: // Car Details - Make/Model
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Car Details</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Make</label>
              <select
                value={carDetails.make}
                onChange={(e) => setCarDetails(prev => ({ ...prev, make: e.target.value }))}
                className="w-full px-4 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                style={{ minHeight: '56px' }}
              >
                <option value="">Select Make</option>
                {carData?.makes.map(make => (
                  <option key={make} value={make}>{make}</option>
                ))}
              </select>
            </div>
            {availableModels.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                <select
                  value={carDetails.model}
                  onChange={(e) => setCarDetails(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full px-4 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                  style={{ minHeight: '56px' }}
                >
                  <option value="">Select Model</option>
                  {availableModels.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
            )}
            {availableVariants.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Variant</label>
                <select
                  value={carDetails.variant}
                  onChange={(e) => setCarDetails(prev => ({ ...prev, variant: e.target.value }))}
                  className="w-full px-4 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                  style={{ minHeight: '56px' }}
                >
                  <option value="">Select Variant</option>
                  {availableVariants.map(variant => (
                    <option key={variant} value={variant}>{variant}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
              <select
                value={carDetails.year}
                onChange={(e) => setCarDetails(prev => ({ ...prev, year: e.target.value }))}
                className="w-full px-4 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                style={{ minHeight: '56px' }}
              >
                <option value="">Select Year</option>
                {years.map(year => (
                  <option key={year} value={year.toString()}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        );

      case 3: // Location & Ownership
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Location & Ownership</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">District/City</label>
              <select
                value={carDetails.district}
                onChange={(e) => setCarDetails(prev => ({ ...prev, district: e.target.value }))}
                className="w-full px-4 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                style={{ minHeight: '56px' }}
              >
                <option value="">Select District</option>
                {districts.map(district => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Number of Owners</label>
              <select
                value={carDetails.noOfOwners}
                onChange={(e) => setCarDetails(prev => ({ ...prev, noOfOwners: e.target.value }))}
                className="w-full px-4 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                style={{ minHeight: '56px' }}
              >
                <option value="">Select</option>
                {ownershipOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
        );

      case 4: // Kilometers & Fuel
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Usage & Fuel</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Kilometers Driven</label>
              <select
                value={carDetails.kilometers}
                onChange={(e) => setCarDetails(prev => ({ ...prev, kilometers: e.target.value }))}
                className="w-full px-4 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                style={{ minHeight: '56px' }}
              >
                <option value="">Select Range</option>
                {kilometerRanges.map(range => (
                  <option key={range} value={range}>{range}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fuel Type</label>
              <select
                value={carDetails.fuelType}
                onChange={(e) => setCarDetails(prev => ({ ...prev, fuelType: e.target.value }))}
                className="w-full px-4 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                style={{ minHeight: '56px' }}
              >
                <option value="">Select Fuel Type</option>
                {fuelTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Transmission</label>
              <select
                value={carDetails.transmission}
                onChange={(e) => setCarDetails(prev => ({ ...prev, transmission: e.target.value }))}
                className="w-full px-4 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                style={{ minHeight: '56px' }}
              >
                <option value="">Select Transmission</option>
                {transmissionTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
        );

      case 5: // Condition & Price
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Condition & Pricing</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Condition</label>
              <select
                value={carDetails.condition}
                onChange={(e) => setCarDetails(prev => ({ ...prev, condition: e.target.value }))}
                className="w-full px-4 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                style={{ minHeight: '56px' }}
              >
                <option value="">Select Condition</option>
                <option value="Excellent">Excellent</option>
                <option value="Very Good">Very Good</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Needs Repair">Needs Repair</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Expected Price (₹)</label>
              <input
                type="number"
                placeholder="Enter expected price"
                value={carDetails.expectedPrice}
                onChange={(e) => setCarDetails(prev => ({ ...prev, expectedPrice: e.target.value }))}
                className="w-full px-4 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                style={{ minHeight: '56px' }}
              />
            </div>
          </div>
        );

      case 6: // Contact
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Contact Information</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              <input
                type="tel"
                placeholder="Enter your phone number"
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
                className="w-full px-4 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                style={{ minHeight: '56px' }}
              />
            </div>
            <p className="text-sm text-gray-600">Our team will contact you to complete the listing process.</p>
          </div>
        );

      case 7: // Success
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        {currentStep > 0 && (
          <button
            onClick={handlePrevStep}
            className="p-2 -ml-1"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h1 className="text-lg font-bold text-gray-900 flex-1">Sell Your Car</h1>
      </div>

      {/* Progress Bar */}
      {currentStep < 7 && (
        <div className="bg-white border-b border-gray-200 px-4 py-3">
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

      {/* Content */}
      <div className="px-4 py-6">
        {renderStep()}
      </div>

      {/* Navigation Buttons */}
      {currentStep > 0 && currentStep < 6 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 safe-bottom z-20">
          <button
            onClick={handleNextStep}
            className="w-full py-4 bg-orange-500 text-white rounded-xl font-semibold"
            style={{ minHeight: '56px' }}
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
};

export default MobileSellCarPage;

