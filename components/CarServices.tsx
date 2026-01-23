import React, { useState } from 'react';
import { View as ViewEnum } from '../types';

interface CarServicesProps {
  onNavigate?: (view: ViewEnum) => void;
}

const detailedServices = [
  {
    title: 'Car Diagnostics',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
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
  {
    title: 'Engine Maintenance & Repairs',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
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
  {
    title: 'Car AC Servicing',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
      </svg>
    ),
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
  {
    title: 'Interior Deep Cleaning',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
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
  {
    title: 'Wheel Alignment & Balancing',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
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
  {
    title: 'Periodic Services',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
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
  {
    title: 'Clutch & Suspension',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
      </svg>
    ),
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
  {
    title: 'Denting & Painting',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
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
];

const serviceCategories = [
  {
    title: 'Periodic Services',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    description: 'Regular maintenance to keep your car running smoothly',
  },
  {
    title: 'AC Service',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
      </svg>
    ),
    description: 'Complete AC servicing and gas refill',
  },
  {
    title: 'Car Scan & Inspect',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    description: 'Comprehensive vehicle health check',
  },
  {
    title: 'Clutch & Suspension',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
      </svg>
    ),
    description: 'Expert repair and replacement services',
  },
  {
    title: 'Denting & Painting',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
    description: 'Professional body repair and paint jobs',
  },
  {
    title: 'Wheel Care',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    description: 'Tyre replacement, alignment & balancing',
  },
];

const carBrands = [
  {
    category: 'Popular Brands',
    brands: [
      { name: 'Maruti Suzuki', models: ['Alto', 'Swift', 'Dzire', 'Brezza', 'Ertiga', 'Wagon R', 'Baleno', 'Celerio'] },
      { name: 'Hyundai', models: ['i20', 'Grand i10', 'i10', 'Creta', 'Verna', 'Elantra', 'Venue', 'Aura'] },
      { name: 'Kia', models: ['Seltos', 'Sonet', 'Carens', 'EV6'] },
      { name: 'Tata', models: ['Nexon', 'Harrier', 'Safari', 'Tiago', 'Altroz', 'Punch', 'Tigor'] },
      { name: 'Mahindra', models: ['XUV300', 'Thar', 'Scorpio', 'Bolero', 'XUV700'] },
      { name: 'Toyota', models: ['Innova', 'Urban Cruiser', 'Fortuner', 'Camry', 'Glanza'] },
      { name: 'Honda', models: ['City', 'Amaze', 'WR-V', 'Civic', 'CR-V'] },
      { name: 'Renault', models: ['Kwid', 'Triber', 'Kiger', 'Duster'] },
      { name: 'Skoda', models: ['Slavia', 'Kushaq', 'Octavia', 'Superb'] },
      { name: 'Volkswagen', models: ['Polo', 'Virtus', 'Taigun', 'Vento'] },
    ],
  },
  {
    category: 'Luxury Brands',
    brands: [
      { name: 'Audi', models: ['Q3', 'Q5', 'A4', 'A6', 'A8', 'Q7'] },
      { name: 'Mercedes-Benz', models: ['C-Class', 'E-Class', 'S-Class', 'GLC', 'GLE'] },
      { name: 'BMW', models: ['3 Series', '5 Series', 'X1', 'X3', 'X5', '7 Series'] },
      { name: 'Jeep', models: ['Compass', 'Meridian', 'Wrangler', 'Grand Cherokee'] },
    ],
  },
];

const pricingComparison = [
  { model: 'Hyundai Elite i20', ourPrice: '₹4,599', serviceCentre: '₹9,000' },
  { model: 'Hyundai Grand i10', ourPrice: '₹4,499', serviceCentre: '₹8,000' },
  { model: 'Hyundai i10', ourPrice: '₹4,499', serviceCentre: '₹7,000' },
  { model: 'Renault Kwid', ourPrice: '₹4,299', serviceCentre: '₹6,500' },
  { model: 'Tata Nexon', ourPrice: '₹5,899', serviceCentre: '₹8,500' },
  { model: 'Volkswagen Polo', ourPrice: '₹6,099', serviceCentre: '₹12,000' },
  { model: 'Maruti Suzuki Swift', ourPrice: '₹4,499', serviceCentre: '₹7,000' },
];

const expertMechanics = [
  {
    name: 'Muniyappan B',
    role: 'Car Service Mechanic',
    carsFixed: '3200+',
    rating: 4.6,
    experience: '10 years',
  },
  {
    name: 'Thulasi D',
    role: 'Car Service Mechanic',
    carsFixed: '3500+',
    rating: 4.7,
    experience: '15 years',
  },
  {
    name: 'J Jagadishwar',
    role: 'Car Service Mechanic',
    carsFixed: '4200+',
    rating: 4.5,
    experience: '10 years',
  },
  {
    name: 'Malhari Bodare',
    role: 'Car Service Mechanic',
    carsFixed: '4000+',
    rating: 5.0,
    experience: '10 years',
  },
  {
    name: 'Sanjay Kumar',
    role: 'Car Service Mechanic',
    carsFixed: '5000+',
    rating: 4.8,
    experience: '15 years',
  },
  {
    name: 'Gurpreet Singh',
    role: 'Car Service Mechanic',
    carsFixed: '4500+',
    rating: 4.5,
    experience: '12 years',
  },
];

const customerReviews = [
  {
    rating: 4,
    title: 'Trusted & Timely Car Service',
    review: 'Overall experience is good, only feedback for improvement is to deliver the car on promised timeline.',
    author: 'Vijayendran R',
    date: '09 Sept 25',
    carMake: 'Verna',
  },
  {
    rating: 5,
    title: 'Supportive Team & Excellent Service',
    review: 'Overall good experience, Thank you for sending an amazing team. They worked tirelessly and delivered me a brand new car',
    author: 'Swaminathan',
    date: '09 Sept 25',
    carMake: 'Carnival',
  },
  {
    rating: 4,
    title: 'Prompt Response & Clean Delivery',
    review: 'Overall, it was a good experience, but there are a few points that need improvement. Since I live on the 10th floor, I had to arrange water myself, and there was also an issue with the electricity supply due to the distance.',
    author: 'Rituj',
    date: '10 Sept 25',
    carMake: 'City',
  },
];

const faqs = [
  {
    question: 'Why is regular car servicing important?',
    answer: 'Regular servicing ensures that your car runs smoothly, reduces the risk of breakdowns, improves fuel efficiency, and prolongs the lifespan of your vehicle.',
  },
  {
    question: 'What are the signs that my car needs servicing?',
    answer: 'Signs include strange noises, warning lights on the dashboard, decreased performance, unusual vibrations, and changes in fuel consumption. If you notice any of these, it\'s best to get your car checked.',
  },
  {
    question: 'How often should I service my car?',
    answer: 'The frequency of servicing depends on several factors like mileage, age, and manufacturer recommendations. Generally, it\'s advisable to service your car every 10 months or every 10,000 km, whichever comes first.',
  },
  {
    question: 'What does a comprehensive service package entail?',
    answer: 'Our package involves a thorough inspection and maintenance of various components of your vehicle which includes oil & filter replacements, various fluid top ups, brake maintenance, washing & interior vacuum, filter & spark plug checking along with complete car health scanning.',
  },
];

const serviceSteps = [
  {
    title: 'Car Pick-up',
    detail: 'Your car will be picked from your location',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    title: 'Car Service',
    detail: 'Your car will be serviced by trained car mechanics',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: 'Car Drop',
    detail: 'Your car will be dropped at your location',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
];

const CarServices: React.FC<CarServicesProps> = ({ onNavigate }) => {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const handleBook = (pkg?: { name: string; price: string; highlights?: string[]; serviceId?: string }) => {
    if (pkg?.serviceId) {
      sessionStorage.setItem('service_cart_prefill', JSON.stringify({ serviceId: pkg.serviceId }));
    } else {
      sessionStorage.removeItem('service_cart_prefill');
    }
    onNavigate?.(ViewEnum.SERVICE_CART);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <svg
        key={i}
        className={`w-4 h-4 ${i < Math.floor(rating) ? 'text-yellow-400' : 'text-gray-300'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ));
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-700 text-white">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.3),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.2),transparent_25%)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-sm font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              Spinny Professionals
            </div>
            <h1 className="text-5xl md:text-6xl font-black leading-tight">
              At your service
            </h1>
            <p className="text-xl text-white/90 max-w-2xl">
              Professional car servicing with transparent pricing, certified mechanics, and doorstep service. Get your car serviced by experts.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => handleBook()}
                className="px-8 py-4 rounded-xl bg-white text-blue-700 font-bold shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1"
              >
                Book a Service
              </button>
              <button
                onClick={() => handleBook()}
                className="px-8 py-4 rounded-xl border-2 border-white/60 text-white font-semibold hover:bg-white/10 transition-colors"
              >
                Check Price
              </button>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-white/80 pt-4">
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

      {/* Service Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-3">
            Tailored for the finest experience
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Choose from our comprehensive range of car services
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {serviceCategories.map((category) => {
            // Map category titles to detailed service titles
            const titleMapping: Record<string, string> = {
              'Periodic Services': 'Periodic Services',
              'AC Service': 'Car AC Servicing',
              'Car Scan & Inspect': 'Car Diagnostics',
              'Clutch & Suspension': 'Clutch & Suspension',
              'Denting & Painting': 'Denting & Painting',
              'Wheel Care': 'Wheel Alignment & Balancing',
            };
            
            const mappedTitle = titleMapping[category.title] || category.title;
            const detailedService = detailedServices.find(s => s.title === mappedTitle);
            
            const handleClick = () => {
              console.log('Service category clicked:', category.title);
              console.log('Mapped title:', mappedTitle);
              console.log('Found detailed service:', !!detailedService);
              console.log('onNavigate available:', !!onNavigate);
              
              const serviceTitle = detailedService?.title || mappedTitle;
              
              // Store only the service title in sessionStorage (not the icon which is a React element)
              sessionStorage.setItem('selectedService', JSON.stringify({ title: serviceTitle }));
              console.log('Stored service title:', serviceTitle);
              
              // Navigate to service detail page
              if (onNavigate) {
                console.log('Navigating to SERVICE_DETAIL');
                onNavigate(ViewEnum.SERVICE_DETAIL);
              } else {
                console.error('onNavigate is not available!');
              }
            };

            return (
              <button
                key={category.title}
                type="button"
                onClick={handleClick}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 flex flex-col items-center text-center gap-3 border border-gray-100 dark:border-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  {category.icon}
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">{category.title}</h3>
              </button>
            );
          })}
        </div>
      </section>

      {/* Detailed Services Section */}
      <section className="bg-white dark:bg-gray-800 border-t border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-3">
              Car Services Available
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Each car repair is done by experienced professionals, and documented clearly, from pickup to delivery. You get a 3-month service warranty, detailed status updates, and complete transparency.
            </p>
          </div>
          <div className="space-y-8">
            {detailedServices.map((service) => {
              const handleServiceClick = () => {
                console.log('Detailed service clicked:', service.title);
                // Store only the service title in sessionStorage (not the icon which is a React element)
                sessionStorage.setItem('selectedService', JSON.stringify({ title: service.title }));
                console.log('Stored service title:', service.title);
                // Navigate to service detail page
                if (onNavigate) {
                  console.log('Navigating to SERVICE_DETAIL');
                  onNavigate(ViewEnum.SERVICE_DETAIL);
                } else {
                  console.error('onNavigate is not available!');
                }
              };

              return (
                <div
                  key={service.title}
                  className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all cursor-pointer"
                  onClick={handleServiceClick}
                >
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                        {service.icon}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white">
                          {service.title}
                        </h3>
          <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleServiceClick();
                          }}
                          className="text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-2"
                        >
                          View Details
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
          </button>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
                        {service.description}
                      </p>
                      <div className="mb-4">
                        <h4 className="font-bold text-gray-900 dark:text-white mb-3 text-lg">
                          Services Included:
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {service.services.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-gray-700 dark:text-gray-300">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-l-4 border-blue-500">
                        <p className="text-gray-800 dark:text-gray-200 font-semibold">
                          <span className="text-blue-600 dark:text-blue-400">✓ </span>
                          {service.benefits}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      
      {/* Multi-Brand Car Servicing */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-3">
            Multi-Brand Car Servicing
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            From compact hatchbacks to large SUVs and luxury sedans, we service several brands using only OEM or brand-authorised parts to maintain performance and manufacturer warranty integrity.
          </p>
        </div>
        {carBrands.map((category) => (
          <div key={category.category} className="mb-12">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 border-b-2 border-blue-500 pb-2">
              {category.category}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {category.brands.map((brand) => (
                <div
                  key={brand.name}
                  className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all"
                >
                  <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                    {brand.name} Car Service
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    We service all {brand.name} models using {brand.name} genuine parts, with trained hands handling both mechanical and electrical work.
                  </p>
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase">
                      Popular Models:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {brand.models.map((model) => (
                        <span
                          key={model}
                          className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-semibold"
                        >
                          {model}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            Why Choose Our Multi-Brand Service?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">OEM Parts Only</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Only OEM or brand-authorised parts used</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Warranty Maintained</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Maintains manufacturer warranty integrity</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Trained Technicians</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Brand-specific trained technicians</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Comparison */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-3">
            Better care with better savings
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Compare our prices with traditional service centers
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <tr>
                  <th className="px-6 py-4 text-left font-bold">Popular Models</th>
                  <th className="px-6 py-4 text-center font-bold">Our Price</th>
                  <th className="px-6 py-4 text-center font-bold">Service Centre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {pricingComparison.map((row, index) => (
                  <tr
                    key={row.model}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'
                    }`}
                  >
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{row.model}</td>
                    <td className="px-6 py-4 text-center font-bold text-blue-600 dark:text-blue-400">{row.ourPrice}</td>
                    <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-400">{row.serviceCentre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
          Published on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </section>

      {/* Expert Mechanics */}
      <section className="bg-white dark:bg-gray-800 border-t border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-3">
              Meet our Car Service Experts
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Experienced professionals dedicated to keeping your car in perfect condition
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {expertMechanics.map((mechanic) => (
              <div
                key={mechanic.name}
                className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-4">
          <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{mechanic.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{mechanic.role}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{mechanic.carsFixed}</span>
                    <span className="text-gray-600 dark:text-gray-400">cars fixed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex">{renderStars(mechanic.rating)}</div>
                    <span className="text-gray-600 dark:text-gray-400 font-semibold">{mechanic.rating}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <span className="font-semibold">{mechanic.experience}</span>
                    <span>years of experience</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Customer Reviews */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-3">
            Hear from our users
          </h2>
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">Rated 4.8/5</span>
            <div className="flex">{renderStars(4.8)}</div>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Our average review rating on Google and on Social platforms
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {customerReviews.map((review, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-1 mb-3">
                {renderStars(review.rating)}
              </div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">{review.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{review.review}</p>
              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{review.author}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Rated on {review.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Car Serviced</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">Make: {review.carMake}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-3">
              How it works?
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Simple steps to get your car serviced
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {serviceSteps.map((step, index) => (
              <div
                key={step.title}
                className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg text-center border border-gray-200 dark:border-gray-700"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
                  {step.icon}
                </div>
                <div className="text-3xl font-black text-gray-400 dark:text-gray-500 mb-2">{index + 1}</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{step.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-3">
            Frequently Asked Questions
          </h2>
        </div>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <button
                onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="font-bold text-gray-900 dark:text-white pr-4">{faq.question}</span>
                <svg
                  className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform flex-shrink-0 ${
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
                <div className="px-6 pb-4 text-gray-600 dark:text-gray-400">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="rounded-3xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white p-12 shadow-2xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex-1">
              <p className="text-white/80 font-semibold text-sm uppercase mb-2">Need Help?</p>
              <h3 className="text-3xl font-black mb-2">Talk to a service advisor</h3>
              <p className="text-white/90 text-lg">
                Share your car details and get a slot within minutes. Our experts are here to help you.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => handleBook()}
                className="px-8 py-4 rounded-xl bg-white text-blue-700 font-bold shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1"
            >
              Request callback
            </button>
            <a
              href="tel:+917277277275"
                className="px-8 py-4 rounded-xl border-2 border-white/70 text-white font-semibold hover:bg-white/10 transition-colors"
            >
              Call 727-727-7275
            </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CarServices;
