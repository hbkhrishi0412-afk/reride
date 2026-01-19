import React from 'react';
import { View as ViewEnum } from '../types';

interface CarServicesProps {
  onNavigate?: (view: ViewEnum) => void;
}

const coreServices = [
  {
    title: 'Periodic Maintenance',
    description: 'OEM recommended service schedules with genuine parts, fluids and multi-point inspection.',
    icon: '🛠️',
    perks: ['Engine oil & filters', 'Brake & safety checks', 'Detailed health report'],
  },
  {
    title: 'Body Repair & Detailing',
    description: 'Dent, paint and detailing packages with color match guarantee and high-gloss finish.',
    icon: '🎨',
    perks: ['Panel repair & repaint', 'Ceramic & PPF options', 'Interior deep cleaning'],
  },
  {
    title: 'Tyres, Battery & Brakes',
    description: 'Doorstep fitment or workshop service with brand options and warranty coverage.',
    icon: '🚗',
    perks: ['Wheel balancing & alignment', 'New tyres & batteries', 'Brake pads & rotors'],
  },
  {
    title: 'Insurance & Claims',
    description: 'Cashless claim assistance with partner insurers, pickup-drop and paperwork support.',
    icon: '🛡️',
    perks: ['Cashless garages', 'Claim filing help', 'Zero-dep guidance'],
  },
  {
    title: 'Roadside Assistance',
    description: '24x7 support for breakdowns, towing, jumpstart and on-spot minor repairs.',
    icon: '🚨',
    perks: ['City-wide coverage', 'Trusted partners', 'Live status updates'],
  },
  {
    title: 'Pre-Purchase Inspection',
    description: 'Comprehensive 200+ point inspection with photos, OBD scan and fair value guidance.',
    icon: '✅',
    perks: ['Certified inspectors', 'Same-day slots', 'Shareable report'],
  },
];

const serviceSteps = [
  {
    title: 'Tell us your need',
    detail: 'Select the service and share vehicle details to get an instant slot recommendation.',
  },
  {
    title: 'Pick slot & location',
    detail: 'Choose doorstep pickup, at-home service (where available) or visit a trusted workshop.',
  },
  {
    title: 'Track & approve',
    detail: 'Get live updates, estimates, and approve work digitally before anything is done.',
  },
  {
    title: 'Pay securely',
    detail: 'Transparent pricing with digital invoices, warranty on parts & workmanship.',
  },
];

const packages = [
  {
    name: 'Essential Service',
    price: 'Starting ₹2,499',
    highlights: ['Engine oil change', 'Filter set', 'Top-up fluids', '25-point safety check'],
  },
  {
    name: 'Deep Detailing',
    price: 'Starting ₹3,999',
    highlights: ['Foam wash', 'Interior shampoo', 'Wax & polish', 'Ozone treatment'],
  },
  {
    name: 'Care Plus',
    price: 'Custom quote',
    highlights: ['Brake service', 'Alignment & balancing', 'Battery health', 'Pickup & drop'],
  },
];

const CarServices: React.FC<CarServicesProps> = ({ onNavigate }) => {
  const handleBook = () => onNavigate?.(ViewEnum.SUPPORT);

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-700 text-white">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.3),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.2),transparent_25%)]" />
        <div className="max-w-6xl mx-auto px-4 py-16 relative">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-sm font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              Car Care & Services
            </div>
            <h1 className="text-4xl md:text-5xl font-black leading-tight">
              Premium car services with transparent pricing & doorstep support
            </h1>
            <p className="text-lg text-white/80 max-w-2xl">
              Schedule maintenance, detailing, repairs or insurance help with trusted partners. Pick a slot, track progress, and pay securely.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleBook}
                className="px-6 py-3 rounded-xl bg-white text-blue-700 font-semibold shadow-lg hover:shadow-xl transition-transform hover:-translate-y-0.5"
              >
                Book a Service
              </button>
              <button
                onClick={() => onNavigate?.(ViewEnum.CAR_SERVICE_LOGIN)}
                className="px-6 py-3 rounded-xl bg-white/15 border border-white/40 text-white font-semibold hover:bg-white/10 transition-colors"
              >
                Service Provider Login
              </button>
              <button
                onClick={handleBook}
                className="px-6 py-3 rounded-xl border border-white/60 text-white font-semibold hover:bg-white/10 transition-colors"
              >
                Talk to Service Advisor
              </button>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-white/80">
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-300" />
                200+ trusted workshops
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-300" />
                Genuine parts & warranty
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-300" />
                Pickup & drop available
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Core services */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-blue-600 font-bold text-sm">SERVICES</p>
            <h2 className="text-3xl font-black text-gray-900 mt-1">Everything your car needs</h2>
            <p className="text-gray-600 mt-2">Choose a service and we’ll handle pickup, updates and quality checks.</p>
          </div>
          <button
            onClick={handleBook}
            className="hidden md:inline-flex px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow hover:bg-blue-700"
          >
            Get a quote
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {coreServices.map((service) => (
            <div key={service.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-xl flex items-center justify-center">{service.icon}</div>
                <h3 className="text-lg font-bold text-gray-900">{service.title}</h3>
              </div>
              <p className="text-gray-600 text-sm">{service.description}</p>
              <div className="flex flex-wrap gap-2 mt-auto">
                {service.perks.map((perk) => (
                  <span key={perk} className="text-xs font-semibold bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                    {perk}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Packages */}
      <section className="bg-white border-t border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-purple-600 font-bold text-sm">POPULAR PACKAGES</p>
              <h2 className="text-3xl font-black text-gray-900 mt-1">Fixed, transparent pricing</h2>
              <p className="text-gray-600 mt-2">No hidden costs. Approve estimates digitally before work starts.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {packages.map((pkg) => (
              <div key={pkg.name} className="rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all bg-gradient-to-br from-gray-50 to-white p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">{pkg.name}</h3>
                  <span className="text-sm font-semibold text-purple-700">{pkg.price}</span>
                </div>
                <ul className="space-y-2 text-sm text-gray-700">
                  {pkg.highlights.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleBook}
                  className="mt-auto inline-flex justify-center px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
                >
                  Book this package
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-emerald-600 font-bold text-sm">HOW IT WORKS</p>
            <h2 className="text-3xl font-black text-gray-900 mt-1">Hassle-free service journey</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {serviceSteps.map((step, index) => (
            <div key={step.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center">
                  {index + 1}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
              </div>
              <p className="text-sm text-gray-600">{step.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-purple-600 text-white p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <p className="text-white/80 font-semibold text-sm">NEED HELP?</p>
            <h3 className="text-2xl font-black">Talk to a service advisor</h3>
            <p className="text-white/80 mt-1">Share your car details and get a slot within minutes.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleBook}
              className="px-5 py-3 rounded-xl bg-white text-blue-700 font-semibold shadow-lg hover:shadow-xl transition-transform hover:-translate-y-0.5"
            >
              Request callback
            </button>
            <a
              href="tel:+917277277275"
              className="px-5 py-3 rounded-xl border border-white/70 text-white font-semibold hover:bg-white/10 transition-colors"
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

