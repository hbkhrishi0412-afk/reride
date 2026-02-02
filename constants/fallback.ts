import type { Vehicle, User, FAQItem, SupportTicket } from '../types';
import { VehicleCategory } from '../types';

// Helper to generate past dates
const daysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

// Minimal fallback data for immediate loading
export const FALLBACK_VEHICLES: Vehicle[] = [
  {
    id: 1,
    make: "Maruti Suzuki",
    model: "Swift",
    year: 2022,
    price: 650000,
    mileage: 18000,
    fuelType: "Petrol",
    transmission: "Manual",
    location: "Mumbai",
    sellerEmail: "demo@reride.com",
    images: ["https://picsum.photos/800/600?random=1"],
    description: "Well maintained Swift in excellent condition",
    status: "published",
    isFeatured: true,
    views: 150,
    inquiriesCount: 8,
    certificationStatus: "none",
    category: VehicleCategory.FOUR_WHEELER,
    features: ["Power Steering", "Air Conditioning"],
    engine: "1.2L Petrol",
    fuelEfficiency: "20 KMPL",
    color: "White",
    noOfOwners: 1,
    registrationYear: 2022,
    insuranceValidity: "Aug 2025",
    insuranceType: "Comprehensive",
    rto: "MH01",
    city: "Mumbai",
    state: "MH",
    displacement: "1200 cc",
    groundClearance: "170 mm",
    bootSpace: "300 litres"
  }
];

export const FALLBACK_USERS: User[] = [
  {
    name: 'Demo Seller',
    email: 'demo@reride.com',
    password: 'password',
    mobile: '555-123-4567',
    role: 'seller',
    location: 'Mumbai',
    status: 'active',
    createdAt: daysAgo(30),
    dealershipName: 'Demo Motors',
    bio: 'Your trusted vehicle partner',
    avatarUrl: 'https://i.pravatar.cc/150?u=demo@reride.com',
    isVerified: true,
    subscriptionPlan: 'pro',
    featuredCredits: 2,
    usedCertifications: 0
  }
];

export const FALLBACK_FAQS: FAQItem[] = [
  // Selling FAQs
  {
    id: 1,
    question: "How do I list my car for sale?",
    answer: "Navigate to the 'Sell' section, log in or register as a seller, and follow the on-screen instructions to create a new vehicle listing. You'll need details like make, model, year, mileage, price, photos, and vehicle description.",
    category: "Selling"
  },
  {
    id: 2,
    question: "What is AI Price Suggestion?",
    answer: "Our AI Price Suggestion tool analyzes your vehicle's details and compares them with current market listings to recommend a fair and competitive price, helping you sell faster.",
    category: "Selling"
  },
  {
    id: 3,
    question: "How much does it cost to list my vehicle?",
    answer: "Basic listings are free! We offer free, pro, and premium subscription plans. Free accounts can list vehicles with basic features. Check our Pricing page for detailed plans.",
    category: "Selling"
  },
  // Buying FAQs
  {
    id: 4,
    question: "How can I contact a seller?",
    answer: "On any vehicle detail page, you can use the 'Chat with Seller' button to start a direct conversation with the seller. You can also call or WhatsApp the seller if they've enabled these contact methods.",
    category: "Buying"
  },
  {
    id: 5,
    question: "How do I search for vehicles?",
    answer: "Use our search bar to enter keywords like make, model, or city. You can also use advanced filters to narrow down by price range, year, mileage, fuel type, transmission, location, and more.",
    category: "Buying"
  },
  {
    id: 6,
    question: "Can I compare multiple vehicles?",
    answer: "Yes! Add vehicles to your comparison list by clicking the 'Compare' button on vehicle cards. You can compare up to 4 vehicles side-by-side on features, specifications, pricing, and seller ratings.",
    category: "Buying"
  },
  {
    id: 7,
    question: "Is it safe to buy vehicles through ReRide?",
    answer: "We take safety seriously. All sellers are verified, and we have a reporting system for suspicious listings. We recommend meeting in person, verifying documents, conducting a test drive, and using secure payment methods.",
    category: "Buying"
  },
  // Account FAQs
  {
    id: 8,
    question: "How do I create an account?",
    answer: "Click 'Sign Up' or 'Register' on the homepage. You can register with your email and password, or use Google sign-in for faster registration. Choose your account type and complete your profile.",
    category: "Account & Profile"
  },
  {
    id: 9,
    question: "I forgot my password. How do I reset it?",
    answer: "Click 'Forgot Password' on the login page, enter your registered email address, and we'll send you a password reset link. Click the link in the email to create a new password.",
    category: "Account & Profile"
  },
  // General FAQs
  {
    id: 10,
    question: "Is my personal information secure?",
    answer: "Yes, we take data security very seriously. All personal information is encrypted and stored securely. We comply with data protection regulations and never share your details with third parties without your consent.",
    category: "General"
  },
  {
    id: 11,
    question: "How do I contact customer support?",
    answer: "You can contact our support team through the 'Support' page on our website or app. Fill out the support form with your query, and we'll respond within 24-48 hours. You can also email us at support@reride.com.",
    category: "General"
  },
  {
    id: 12,
    question: "Can I use ReRide on my mobile phone?",
    answer: "Yes! ReRide is fully optimized for mobile devices. You can access our website on any mobile browser, or download our Progressive Web App (PWA) for a native app-like experience.",
    category: "General"
  }
];

export const FALLBACK_SUPPORT_TICKETS: SupportTicket[] = [
  {
    id: 1,
    userEmail: 'demo@reride.com',
    userName: 'Demo User',
    subject: 'General Inquiry',
    message: 'How can I get started?',
    status: 'Open',
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    replies: []
  }
];

export const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'CNG', 'Hybrid'];
export const SAFETY_TIPS = [
  'Always meet in a public place during daylight hours',
  'Never share bank details or OTP with anyone',
  'Verify vehicle documents before making payment',
  'Test drive with seller present and valid documents'
];
