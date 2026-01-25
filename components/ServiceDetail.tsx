import React, { useState, useEffect } from 'react';
import { View as ViewEnum } from '../types';

interface ServiceDetailProps {
  onNavigate?: (view: ViewEnum) => void;
  onBack?: () => void;
}

interface Service {
  title: string;
  description: string;
  services: string[];
  benefits: string;
  icon: React.ReactNode;
  pricing?: {
    basePrice: number;
    priceRange?: string;
    customQuote?: boolean;
  };
}

// Service definitions with icons - shared between components
const getServiceIcon = (title: string): React.ReactNode => {
  const icons: Record<string, React.ReactNode> = {
    'Car Diagnostics': (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    'Engine Maintenance & Repairs': (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    'Car AC Servicing': (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
      </svg>
    ),
    'Interior Deep Cleaning': (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    'Wheel Alignment & Balancing': (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    'Periodic Services': (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    'Clutch & Suspension': (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
      </svg>
    ),
    'Denting & Painting': (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
  };
  return icons[title] || null;
};

// Service data definitions
const serviceDefinitions: Record<string, Omit<Service, 'icon'>> = {
  'Car Diagnostics': {
    title: 'Car Diagnostics',
    description: 'Advanced diagnostic scanning to find issues with your vehicle\'s engine, electronics, battery, ABS, and more. Particularly valuable for regular city driving with heavy traffic and speed breakers.',
    services: [
      'Advanced diagnostic scanning',
      'Engine diagnostics',
      'Electronics system check',
      'Battery health analysis',
      'ABS system inspection',
      'Complete car health scanning',
      'Detailed diagnostic report',
      'Early issue identification',
    ],
    benefits: 'Find issues early before they turn into major problems. Information from the scan is accompanied by a detailed report to help you rectify issues identified early on.',
  },
  'Engine Maintenance & Repairs': {
    title: 'Engine Maintenance & Repairs',
    description: 'Engine wear is unavoidable, especially with frequent city driving. Over time, heat, traffic, and dirt intake can affect your car\'s performance. Keep your engine running at its highest performance.',
    services: [
      'Engine oil and filter change',
      'Air filter clean',
      'Fuel filter clean',
      'Spark plug inspection',
      'Cooling system check',
      'Engine performance optimization',
      'Genuine parts replacement',
      'Complete engine health check',
    ],
    benefits: 'Not just a standard procedure, but part of the necessary effort to get your car operating smoothly and efficiently given city driving conditions.',
  },
  'Car AC Servicing': {
    title: 'Car AC Servicing',
    description: 'With rising humidity and prolonged idling in traffic, especially near tech parks, many drivers notice their ACs taking longer to cool or emit unpleasant smells. Complete AC servicing ensures reliable performance.',
    services: [
      'Refrigerant refill',
      'Compressor check',
      'Blower check',
      'Cabin filter cleaning',
      'Condenser inspection',
      'Condenser flushing',
      'AC system diagnostics',
      'Cooling efficiency test',
    ],
    benefits: 'We don\'t just refill gas and call it AC repair. We conduct thorough AC maintenance and check the entire cooling system so your AC performs reliably, whether you\'re driving in peak heat or heavy monsoon humidity.',
  },
  'Interior Deep Cleaning': {
    title: 'Interior Deep Cleaning',
    description: 'Construction dust, wet shoes during monsoon, takeout meals during late-night drives - car interiors get dirty quickly. Over time, this leads to more than just a dusty dashboard; it affects hygiene and comfort too.',
    services: [
      'Upholstery vacuuming and shampooing',
      'Dashboard and console sanitisation',
      'Floor mat and carpet washing',
      'Roof lining cleaning',
      'Side panel cleaning',
      'Complete interior sanitization',
      'Odor removal',
      'Leather conditioning (if applicable)',
    ],
    benefits: 'Whether you\'re a daily commuter, a cab driver, or a weekend explorer, clean interiors help you enjoy your time on the road while preserving your car\'s value.',
  },
  'Wheel Alignment & Balancing': {
    title: 'Wheel Alignment & Balancing',
    description: 'Speed bumps, uneven layouts, and potholes can throw your wheel alignment off without you noticing, until your steering starts pulling or your tyres wear unevenly.',
    services: [
      'Factory-spec wheel alignment',
      'Digital tyre balancing',
      'Suspension inspection',
      'Steering inspection',
      'Tyre rotation',
      'Tyre pressure check',
      'Wheel bearing check',
      'Complete wheel health assessment',
    ],
    benefits: 'You\'ll notice the difference in stability, fuel efficiency, and driving comfort almost immediately, especially if you drive longer routes often.',
  },
  'Periodic Services': {
    title: 'Periodic Services',
    description: 'OEM recommended service schedules with genuine parts, fluids and multi-point inspection to keep your car running smoothly and efficiently.',
    services: [
      'Engine oil change',
      'Oil filter replacement',
      'Air filter replacement',
      'Fuel filter replacement',
      'Coolant top-up',
      'Brake fluid check',
      'Power steering fluid check',
      '25-point safety check',
      'Battery health check',
      'Tyre inspection',
    ],
    benefits: 'Regular servicing ensures that your car runs smoothly, reduces the risk of breakdowns, improves fuel efficiency, and prolongs the lifespan of your vehicle.',
  },
  'Clutch & Suspension': {
    title: 'Clutch & Suspension',
    description: 'Expert repair and replacement services for clutch and suspension systems to ensure smooth driving experience and vehicle stability.',
    services: [
      'Clutch plate replacement',
      'Clutch cable adjustment',
      'Suspension shock absorber replacement',
      'Suspension spring check',
      'Strut replacement',
      'Bush replacement',
      'Complete suspension overhaul',
      'Ride quality optimization',
    ],
    benefits: 'Proper clutch and suspension maintenance ensures smooth gear shifting, better ride comfort, and improved vehicle handling.',
  },
  'Denting & Painting': {
    title: 'Denting & Painting',
    description: 'Professional body repair and paint jobs with color match guarantee and high-gloss finish. Panel repair & repaint with ceramic & PPF options.',
    services: [
      'Dent removal',
      'Panel repair',
      'Color matching',
      'Complete repaint',
      'Scratch removal',
      'Rust treatment',
      'Ceramic coating',
      'PPF (Paint Protection Film)',
      'High-gloss finish',
    ],
    benefits: 'Restore your car\'s appearance with professional body repair and paint jobs. Color match guarantee ensures your car looks as good as new.',
  },
};

const servicePricing: Record<string, Service['pricing']> = {
  'Car Diagnostics': {
    basePrice: 999,
    priceRange: '₹999 - ₹2,499',
  },
  'Engine Maintenance & Repairs': {
    basePrice: 2499,
    priceRange: '₹2,499 - ₹4,999',
  },
  'Car AC Servicing': {
    basePrice: 1999,
    priceRange: '₹1,999 - ₹3,499',
  },
  'Interior Deep Cleaning': {
    basePrice: 3999,
    priceRange: '₹3,999 - ₹5,999',
  },
  'Wheel Alignment & Balancing': {
    basePrice: 1499,
    priceRange: '₹1,499 - ₹2,999',
  },
  'Periodic Services': {
    basePrice: 2499,
    priceRange: '₹2,499 - ₹4,999',
  },
  'Clutch & Suspension': {
    basePrice: 3499,
    priceRange: '₹3,499 - ₹7,999',
    customQuote: true,
  },
  'Denting & Painting': {
    basePrice: 0,
    customQuote: true,
  },
};

const ServiceDetail: React.FC<ServiceDetailProps> = ({ onNavigate, onBack }) => {
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  useEffect(() => {
    // Get service title from sessionStorage
    const serviceData = sessionStorage.getItem('selectedService');
    if (serviceData) {
      try {
        const { title } = JSON.parse(serviceData);
        // Look up the service definition and add the icon
        const serviceDef = serviceDefinitions[title];
        if (serviceDef) {
          setSelectedService({
            ...serviceDef,
            icon: getServiceIcon(title),
          });
        } else {
          console.error('Service not found:', title);
          onBack?.();
        }
      } catch (error) {
        console.error('Failed to parse service data:', error);
        // Fallback: navigate back if data is invalid
        onBack?.();
      }
    } else {
      // No service selected, go back
      onBack?.();
    }
  }, [onBack]);

  const handleAddToCart = () => {
    if (!selectedService) return;

    // Store service in cart prefill
    const serviceId = `service-${selectedService.title.toLowerCase().replace(/\s+/g, '-')}`;
    sessionStorage.setItem('service_cart_prefill', JSON.stringify({
      serviceId,
      serviceName: selectedService.title,
      price: servicePricing[selectedService.title]?.basePrice || 0,
      customQuote: servicePricing[selectedService.title]?.customQuote || false,
    }));

    // Navigate to cart
    onNavigate?.(ViewEnum.SERVICE_CART);
  };

  const handleBookNow = () => {
    handleAddToCart();
  };

  if (!selectedService) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading service details...</p>
        </div>
      </div>
    );
  }

  const pricing = servicePricing[selectedService.title] || { basePrice: 0, customQuote: true };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen pb-safe">
      {/* Back Button */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-4 sm:mb-6 touch-manipulation min-h-[44px]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-semibold text-sm sm:text-base">Back to Services</span>
        </button>
      </div>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-700 text-white py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white flex-shrink-0">
              {selectedService.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black mb-2 break-words">{selectedService.title}</h1>
              <p className="text-base sm:text-xl text-white/90 max-w-3xl break-words">{selectedService.description}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Left Column - Service Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Services Included */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-8 shadow-lg border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mb-4 sm:mb-6">
                Services Included
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {selectedService.services.map((service, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{service}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Benefits */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-4 sm:p-8 shadow-lg border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mb-3 sm:mb-4">
                Why Choose This Service?
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-base sm:text-lg">
                {selectedService.benefits}
              </p>
            </div>

            {/* Service Quality Features */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-8 shadow-lg border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mb-4 sm:mb-6">
                Service Quality Assured
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">OEM Parts Only</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Only OEM or brand-authorised parts used</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">3-Month Warranty</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Service warranty on parts & workmanship</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">Real-Time Updates</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Track your service progress live</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">Pre & Post Photos</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Complete documentation of service</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Pricing & Booking */}
          <div className="lg:col-span-1 order-first lg:order-last">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-8 shadow-xl border-2 border-gray-200 dark:border-gray-700 lg:sticky lg:top-8">
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mb-4 sm:mb-6">
                Pricing & Booking
              </h2>

              {/* Pricing Display */}
              <div className="mb-6">
                {pricing.customQuote ? (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Starting from</p>
                    <p className="text-3xl font-black text-blue-600 dark:text-blue-400 mb-2">
                      Custom Quote
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Price varies based on vehicle model and service requirements
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Starting from</p>
                    <p className="text-3xl font-black text-blue-600 dark:text-blue-400 mb-2">
                      ₹{pricing.basePrice.toLocaleString('en-IN')}
                    </p>
                    {pricing.priceRange && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Price range: {pricing.priceRange}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      *Final price depends on vehicle model
                    </p>
                  </div>
                )}
              </div>

              {/* Features */}
              <div className="mb-6 space-y-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Transparent pricing</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700 dark:text-gray-300">3-month warranty</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Pickup & drop available</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Real-time updates</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleBookNow}
                  className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 active:scale-95 touch-manipulation min-h-[48px] text-base sm:text-lg"
                >
                  Book Now
                </button>
                <button
                  onClick={handleAddToCart}
                  className="w-full px-6 py-4 rounded-xl border-2 border-blue-600 text-blue-600 dark:text-blue-400 font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors active:scale-95 touch-manipulation min-h-[48px] text-base sm:text-lg"
                >
                  Add to Cart
                </button>
                <a
                  href="tel:+917277277275"
                  className="block w-full px-6 py-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 text-center transition-colors active:scale-95 touch-manipulation min-h-[48px] text-base sm:text-lg"
                >
                  Call for Quote
                </a>
              </div>

              {/* Trust Badges */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Secure</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Verified</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceDetail;

