import type { PlanDetails, SubscriptionPlan } from '../types';

export const PLAN_DETAILS: Record<SubscriptionPlan, PlanDetails> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    listingLimit: 1,
    featuredCredits: 0,
    freeCertifications: 0,
    features: [
      '1 Active Listing',
      'Basic Seller Profile',
      'Standard Support',
    ],
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    price: 0,
    listingLimit: 1,
    featuredCredits: 0,
    freeCertifications: 0,
    features: [
      '1 Active Listing',
      'Basic Seller Profile',
      'Standard Support',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 1999,
    listingLimit: 10,
    featuredCredits: 2,
    freeCertifications: 1,
    isMostPopular: true,
    features: [
      '10 Active Listings',
      '2 Featured Credits/month',
      '1 Free Certified Inspection/month',
      'Enhanced Seller Profile',
      'Performance Analytics',
      'Priority Support',
    ],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 4999,
    listingLimit: 'unlimited',
    featuredCredits: 5,
    freeCertifications: 3,
    features: [
      'Unlimited Active Listings',
      '5 Featured Credits/month',
      '3 Free Certified Inspections/month',
      'AI Listing Assistant',
      'Advanced Analytics',
      'Dedicated Support',
    ],
  },
};

export const INSPECTION_SERVICE_FEE = 2500;
export const LISTING_EXPIRY_DAYS = 30;
export const AUTO_REFRESH_DAYS = 7;
export const MAX_FREE_LISTINGS = 1;
export const MAX_PRO_LISTINGS = 10;
