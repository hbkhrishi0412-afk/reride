import React, { useState, useRef } from 'react';
import { View as ViewEnum } from '../types';

interface CarServicesProps {
  onNavigate?: (view: ViewEnum) => void;
}

const detailedServices = [
  {
    title: 'Car Diagnostics',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    description: 'Advanced diagnostic scanning to find issues with your vehicle\'s engine, electronics, battery, ABS, and more.',
    services: [
      'Advanced diagnostic scanning',
      'Engine diagnostics',
      'Electronics system check',
      'Battery health analysis',
      'ABS system inspection',
      'Complete car health scanning',
    ],
  },
  {
    title: 'Engine Maintenance & Repairs',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    description: 'Keep your engine running at its highest performance with regular maintenance.',
    services: [
      'Engine oil and filter change',
      'Air filter clean',
      'Fuel filter clean',
      'Spark plug inspection',
      'Cooling system check',
    ],
  },
  {
    title: 'Car AC Servicing',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
      </svg>
    ),
    description: 'Complete AC servicing ensures reliable performance in all weather conditions.',
    services: [
      'Refrigerant refill',
      'Compressor check',
      'Blower check',
      'Cabin filter cleaning',
      'AC system diagnostics',
    ],
  },
  {
    title: 'Interior Deep Cleaning',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    description: 'Deep cleaning to keep your car interior fresh and hygienic.',
    services: [
      'Upholstery vacuuming',
      'Dashboard sanitisation',
      'Floor mat washing',
      'Complete interior sanitization',
      'Odor removal',
    ],
  },
  {
    title: 'Wheel Alignment & Balancing',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    description: 'Factory-spec wheel alignment for better stability and fuel efficiency.',
    services: [
      'Factory-spec alignment',
      'Digital tyre balancing',
      'Suspension inspection',
      'Tyre rotation',
      'Tyre pressure check',
    ],
  },
  {
    title: 'Periodic Services',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    description: 'OEM recommended service schedules with genuine parts.',
    services: [
      'Engine oil change',
      'Oil filter replacement',
      'Air filter replacement',
      '25-point safety check',
      'Battery health check',
    ],
  },
];

const serviceCategories = [
  { title: 'Periodic Service', icon: '📅', service: 'Periodic Services' },
  { title: 'AC Service', icon: '❄️', service: 'Car AC Servicing' },
  { title: 'Car Scan', icon: '🔍', service: 'Car Diagnostics' },
  { title: 'Wheel Care', icon: '⚙️', service: 'Wheel Alignment & Balancing' },
  { title: 'Interior Clean', icon: '🧹', service: 'Interior Deep Cleaning' },
  { title: 'Engine Care', icon: '🔧', service: 'Engine Maintenance & Repairs' },
];

const serviceSteps = [
  { title: 'Pick-up', detail: 'We pick your car from your location', icon: '🚗' },
  { title: 'Service', detail: 'Expert mechanics service your car', icon: '🔧' },
  { title: 'Drop', detail: 'We deliver your car back to you', icon: '✅' },
];

const faqs = [
  {
    question: 'How often should I service my car?',
    answer: 'Generally, service your car every 10 months or every 10,000 km, whichever comes first.',
  },
  {
    question: 'What does a service include?',
    answer: 'Our service includes oil & filter replacement, fluid top-ups, brake maintenance, washing, and complete car health scanning.',
  },
  {
    question: 'Do you provide pickup and drop?',
    answer: 'Yes! We offer free pickup and drop service for your convenience.',
  },
];

const CarServices: React.FC<CarServicesProps> = ({ onNavigate }) => {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const servicesSectionRef = useRef<HTMLDivElement>(null);

  const scrollToServices = () => {
    servicesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleServiceClick = (serviceTitle: string) => {
    if (!serviceTitle) {
      console.error('Service title is missing');
      return;
    }
    
    try {
      sessionStorage.setItem('selectedService', JSON.stringify({ title: serviceTitle }));
      console.log('Service selected:', serviceTitle);
      
      if (onNavigate) {
        onNavigate(ViewEnum.SERVICE_DETAIL);
      } else {
        console.error('onNavigate function is not available');
      }
    } catch (error) {
      console.error('Error handling service click:', error);
    }
  };

  const handleBookService = () => {
    if (onNavigate) {
      onNavigate(ViewEnum.SERVICE_CART);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-20 lg:pb-0">
      {/* Hero Section - Responsive */}
      <section className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white">
        <div className="px-4 sm:px-6 lg:px-8 pt-16 lg:pt-24 pb-8 lg:pb-16">
          <div className="max-w-md lg:max-w-7xl mx-auto text-center lg:text-left space-y-4 lg:space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-xs lg:text-sm font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              Professional Service
            </div>
            <h1 className="text-3xl lg:text-5xl xl:text-6xl font-black leading-tight">
              Car Service at Your Doorstep
            </h1>
            <p className="text-white/90 text-sm lg:text-lg leading-relaxed max-w-2xl lg:max-w-3xl mx-auto lg:mx-0">
              Expert mechanics, genuine parts, and transparent pricing. Get your car serviced by professionals.
            </p>
            <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 pt-2 lg:pt-4 max-w-md lg:max-w-none mx-auto lg:mx-0">
              <button
                onClick={handleBookService}
                className="w-full lg:w-auto px-6 py-3.5 lg:px-8 lg:py-4 rounded-xl bg-white text-blue-600 font-bold text-base lg:text-lg shadow-lg hover:shadow-xl active:scale-95 transition-all"
              >
                Book Service Now
              </button>
              <button
                onClick={scrollToServices}
                className="w-full lg:w-auto px-6 py-3.5 lg:px-8 lg:py-4 rounded-xl border-2 border-white/60 text-white font-semibold text-base lg:text-lg hover:bg-white/10 active:bg-white/10 transition-colors"
              >
                View Services
              </button>
            </div>
            <div className="flex flex-wrap justify-center lg:justify-start gap-4 lg:gap-6 text-xs lg:text-sm text-white/80 pt-2 lg:pt-4">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-emerald-300" />
                200+ Workshops
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-emerald-300" />
                Free Pickup & Drop
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-emerald-300" />
                3-Month Warranty
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Service Categories - Responsive Grid */}
      <section className="px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="max-w-md lg:max-w-7xl mx-auto">
          <h2 className="text-xl lg:text-3xl font-black text-gray-900 mb-4 lg:mb-8 text-center lg:text-left">Choose a Service</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 lg:gap-6">
            {serviceCategories.map((category) => {
              const service = detailedServices.find(s => s.title === category.service);
              if (!service) {
                console.warn(`Service not found for category: ${category.title}, looking for: ${category.service}`);
              }
              return (
                <button
                  key={category.title}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (service) {
                      handleServiceClick(service.title);
                    } else {
                      console.error(`Cannot navigate: Service "${category.service}" not found`);
                    }
                  }}
                  className="bg-white rounded-xl p-4 lg:p-6 shadow-sm hover:shadow-lg active:scale-95 lg:hover:scale-105 transition-all border border-gray-100 flex flex-col items-center gap-2 lg:gap-3 min-h-[100px] lg:min-h-[140px]"
                >
                  <span className="text-3xl lg:text-4xl">{category.icon}</span>
                  <span className="font-semibold text-gray-900 text-sm lg:text-base text-center">{category.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Detailed Services - Responsive */}
      <section ref={servicesSectionRef} className="px-4 sm:px-6 lg:px-8 py-8 lg:py-12 bg-white">
        <div className="max-w-md lg:max-w-7xl mx-auto">
          <h2 className="text-xl lg:text-3xl font-black text-gray-900 mb-4 lg:mb-8 text-center lg:text-left">All Services</h2>
          <div className="space-y-3 lg:space-y-4 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-6">
            {detailedServices.map((service) => (
              <button
                key={service.title}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleServiceClick(service.title);
                }}
                className="w-full bg-gray-50 lg:bg-white rounded-xl p-4 lg:p-6 text-left border border-gray-200 hover:border-blue-300 hover:shadow-lg active:bg-gray-100 lg:hover:bg-gray-50 transition-all"
              >
                <div className="flex items-start gap-3 lg:gap-4">
                  <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0">
                    {service.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-base lg:text-xl mb-1 lg:mb-2">{service.title}</h3>
                    <p className="text-gray-600 text-xs lg:text-sm mb-2 lg:mb-3 line-clamp-2">{service.description}</p>
                    <div className="flex flex-wrap gap-1.5 lg:gap-2">
                      {service.services.slice(0, 3).map((item, idx) => (
                        <span key={idx} className="text-xs lg:text-sm px-2 py-0.5 lg:px-3 lg:py-1 bg-blue-50 text-blue-700 rounded-full">
                          {item}
                        </span>
                      ))}
                      {service.services.length > 3 && (
                        <span className="text-xs lg:text-sm px-2 py-0.5 lg:px-3 lg:py-1 bg-gray-200 text-gray-600 rounded-full">
                          +{service.services.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                  <svg className="w-5 h-5 lg:w-6 lg:h-6 text-gray-400 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - Responsive */}
      <section className="px-4 sm:px-6 lg:px-8 py-8 lg:py-12 bg-gray-50">
        <div className="max-w-md lg:max-w-7xl mx-auto">
          <h2 className="text-xl lg:text-3xl font-black text-gray-900 mb-6 lg:mb-10 text-center lg:text-left">How It Works</h2>
          <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-6">
            {serviceSteps.map((step, index) => (
              <div key={step.title} className="bg-white rounded-xl p-4 lg:p-6 shadow-sm border border-gray-200 hover:shadow-lg transition-all">
                <div className="flex items-start gap-3 lg:flex-col lg:items-center lg:text-center">
                  <div className="w-10 h-10 lg:w-16 lg:h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl lg:text-2xl font-black flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 lg:flex-none">
                    <div className="flex items-center lg:flex-col gap-2 mb-1 lg:mb-3">
                      <span className="text-2xl lg:text-4xl">{step.icon}</span>
                      <h3 className="font-bold text-gray-900 text-base lg:text-xl">{step.title}</h3>
                    </div>
                    <p className="text-gray-600 text-sm lg:text-base">{step.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section - Responsive */}
      <section className="px-4 sm:px-6 lg:px-8 py-8 lg:py-12 bg-white">
        <div className="max-w-md lg:max-w-4xl mx-auto">
          <h2 className="text-xl lg:text-3xl font-black text-gray-900 mb-4 lg:mb-8 text-center lg:text-left">Common Questions</h2>
          <div className="space-y-2 lg:space-y-3">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden hover:border-blue-300 transition-colors"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full px-4 lg:px-6 py-3 lg:py-4 text-left flex items-center justify-between hover:bg-gray-100 active:bg-gray-100 transition-colors"
                >
                  <span className="font-semibold text-gray-900 text-sm lg:text-base pr-4 flex-1">{faq.question}</span>
                  <svg
                    className={`w-5 h-5 lg:w-6 lg:h-6 text-gray-500 transition-transform flex-shrink-0 ${
                      expandedFaq === index ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedFaq === index && (
                  <div className="px-4 lg:px-6 pb-3 lg:pb-4 text-gray-600 text-sm lg:text-base">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - Responsive */}
      <section className="px-4 sm:px-6 lg:px-8 py-8 lg:py-12 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
        <div className="max-w-md lg:max-w-4xl mx-auto text-center text-white">
          <h3 className="text-2xl lg:text-4xl font-black mb-2 lg:mb-4">Need Help?</h3>
          <p className="text-white/90 text-sm lg:text-lg mb-6 lg:mb-8">
            Talk to our service advisor and get a slot within minutes
          </p>
          <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 max-w-md lg:max-w-lg mx-auto">
            <button
              onClick={handleBookService}
              className="w-full lg:w-auto px-6 py-3.5 lg:px-8 lg:py-4 rounded-xl bg-white text-blue-600 font-bold text-base lg:text-lg shadow-lg hover:shadow-xl active:scale-95 transition-all"
            >
              Book Service Now
            </button>
            <a
              href="tel:+917277277275"
              className="w-full lg:w-auto px-6 py-3.5 lg:px-8 lg:py-4 rounded-xl border-2 border-white/70 text-white font-semibold text-base lg:text-lg hover:bg-white/10 active:bg-white/10 transition-colors"
            >
              Call 727-727-7275
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CarServices;
