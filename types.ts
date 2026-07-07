

import React from 'react';
import type { VehicleCategoryData } from './vehicleDataTypes';
import { VehicleCategory } from './vehicle-category.js';
import type {
  SellerDisclosureChecklist,
  VahanSnapshot,
  DisclosureItemKey,
  DisclosureChecklistItem,
  BuyerInspectionItem,
  BuyerInspectionReport,
} from './lib/vehicleDisclosureChecklist.js';
export type {
  UniversalSellerChecklist,
  ListingChecklistTier,
  ChecklistItemStatus,
} from './lib/universalChecklist/types.js';
export type { SellerDisclosureChecklist, VahanSnapshot, BuyerInspectionItem, BuyerInspectionReport, DisclosureItemKey, DisclosureChecklistItem };

export { VehicleCategory };

/** Lightweight counts for home discovery (from GET /api/vehicles?aggregate=storefront). */
export interface StorefrontDiscoveryAggregates {
  categories: Partial<Record<VehicleCategory, number>>;
  cities: Record<string, number>;
}

export type BadgeType = 'verified' | 'top_seller' | 'high_rating';

export interface Badge {
    type: BadgeType;
    label: string;
    description: string;
}

export interface CertifiedInspection {
    reportId: string;
    summary: string;
    date: string; // ISO String
    inspector: string;
    scores: Record<string, number>; // e.g., { Engine: 85, Exterior: 92, ... }
    details: Record<string, string>; // e.g., { Engine: "No leaks found...", ... }
}

// ============================================
// AI-POWERED PHOTO INSPECTION SYSTEM
// ============================================

export type AIInspectionGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface AIInspectionFinding {
  type: 'scratch' | 'dent' | 'rust' | 'paint_damage' | 'crack' | 'wear' | 'tear' | 'stain' | 'missing_part' | 'modification';
  location: string; // e.g., "front bumper", "rear door left", "dashboard"
  severity: 'minor' | 'moderate' | 'major';
  description: string;
  imageIndex: number; // Which uploaded image shows this issue
  confidence: number; // 0-100 confidence score
}

export interface AIExteriorAnalysis {
  grade: AIInspectionGrade;
  score: number; // 0-100
  findings: AIInspectionFinding[];
  summary: string;
  paintCondition: 'excellent' | 'good' | 'fair' | 'poor';
  bodyCondition: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AIInteriorAnalysis {
  grade: AIInspectionGrade;
  score: number; // 0-100
  findings: AIInspectionFinding[];
  summary: string;
  seatCondition: 'excellent' | 'good' | 'fair' | 'poor';
  dashboardCondition: 'excellent' | 'good' | 'fair' | 'poor';
  cleanlinessLevel: 'spotless' | 'clean' | 'average' | 'needs_cleaning';
}

export interface AITyreAnalysis {
  grade: AIInspectionGrade;
  score: number; // 0-100
  estimatedTreadDepth: 'new' | 'good' | 'fair' | 'replace_soon' | 'unsafe';
  mismatchedTyres: boolean;
  brandVisible: string | null;
  summary: string;
}

export interface AIPhotoQualityAssessment {
  overallScore: number; // 0-100
  issues: ('blur' | 'low_light' | 'obstructed' | 'reflection' | 'too_far' | 'wrong_angle')[];
  missingViews: ('front' | 'rear' | 'left_side' | 'right_side' | 'interior_front' | 'interior_rear' | 'engine_bay' | 'boot' | 'odometer' | 'tyres')[];
  recommendations: string[];
}

export interface AIDocumentAnalysis {
  rcDetected: boolean;
  rcReadable: boolean;
  registrationMatchesListing: boolean | null; // null if can't verify
  insuranceDocDetected: boolean;
  insuranceValid: boolean | null;
  detectedRegistrationNumber: string | null;
  detectedOwnerName: string | null;
}

export interface AIInspectionReport {
  reportId: string;
  vehicleId: number;
  generatedAt: string; // ISO timestamp
  modelVersion: string;
  processingTimeMs: number;
  
  // Overall Assessment
  overallGrade: AIInspectionGrade;
  overallScore: number; // 0-100
  confidenceScore: number; // 0-100, how confident the AI is in its assessment
  
  // Component Analysis
  exterior: AIExteriorAnalysis;
  interior: AIInteriorAnalysis;
  tyres: AITyreAnalysis;
  
  // Photo Quality
  photoQuality: AIPhotoQualityAssessment;
  
  // Document Analysis (if documents uploaded)
  documentAnalysis?: AIDocumentAnalysis;
  
  // Buyer Advisory
  highlights: string[]; // Positive points
  concerns: string[]; // Issues to check
  buyerAdvisory: string[]; // Recommendations for buyer
  
  // Estimated Value Impact
  conditionImpact: {
    estimatedValueReduction: number; // Percentage reduction from ideal condition
    majorIssuesCount: number;
    moderateIssuesCount: number;
    minorIssuesCount: number;
  };
  
  // Raw data for detailed view
  allFindings: AIInspectionFinding[];
  imageAnalysis: {
    imageIndex: number;
    imageUrl: string;
    detectedElements: string[];
    issuesFound: number;
  }[];
}

export interface AIInspectionRequest {
  vehicleId?: number;
  imageUrls: string[];
  vehicleDetails: {
    make: string;
    model: string;
    year: number;
    mileage?: number;
    fuelType?: string;
    color?: string;
  };
  includeDocumentAnalysis?: boolean;
  documentUrls?: string[];
}

export interface AIInspectionStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep: string;
  estimatedTimeRemaining?: number; // seconds
  error?: string;
}

export interface ServiceRecord {
  date: string; // ISO string
  service: string;
  mileage: number;
  location: string;
}

export interface AccidentRecord {
  date: string; // ISO string
  description: string;
  severity: 'Minor' | 'Moderate' | 'Major';
}

export interface VehicleDocument {
    name: 'Registration Certificate (RC)' | 'Insurance' | 'Pollution Under Control (PUC)' | 'Service Record' | 'Other';
    /** Public or signed Supabase Storage URL — never inline base64. */
    url: string;
    fileName: string;
}

export interface Vehicle {
  id: number;
  /** Supabase `vehicles.id` (TEXT). Send on DELETE/PUT when `id` is a client-side hash of a non-numeric row id. */
  databaseId?: string;
  category: VehicleCategory;
  make: string;
  model: string;
  variant?: string;
  year: number;
  price: number;
  mileage: number;
  images: string[];
  features: string[];
  description: string;
  sellerEmail: string;
  sellerName?: string;
  engine: string;
  transmission: string;
  fuelType: string;
  fuelEfficiency: string;
  color: string;
  status: 'published' | 'unpublished' | 'sold';
  listingType?: 'buy' | 'rental'; // 'buy' for regular sale, 'rental' for rental vehicles
  isFeatured: boolean;
  views?: number;
  inquiriesCount?: number;
  isFlagged?: boolean;
  flagReason?: string;
  flaggedAt?: string;
  averageRating?: number;
  ratingCount?: number;
  sellerAverageRating?: number;
  sellerRatingCount?: number;
  sellerBadges?: Badge[];
  // New detailed fields
  registrationYear: number;
  insuranceValidity: string;
  insuranceType: string;
  rto: string;
  city: string;
  state: string; // 2-letter state code
  location: string; // Full location string
  noOfOwners: number;
  displacement: string; // e.g., "1086 cc"
  groundClearance: string; // e.g., "165 mm"
  bootSpace: string; // e.g., "235 litres"
  
  // Vahan Verification Fields
  registrationNumber?: string; // Full vehicle registration number (e.g., MH12AB1234)
  engineNumber?: string; // Engine number from RC book
  chassisNumber?: string; // Chassis number from RC book
  vahanVerifiedAt?: string; // ISO timestamp when verified with Vahan API
  qualityReport?: {
    fixesDone: string[];
  };
  certifiedInspection?: CertifiedInspection | null;
  certificationStatus?: 'none' | 'requested' | 'approved' | 'rejected' | 'certified';
  certificationRequestedAt?: string;
  // New features
  videoUrl?: string;
  featuredAt?: string;
  soldAt?: string;
  serviceRecords?: ServiceRecord[];
  accidentHistory?: AccidentRecord[];
  documents?: VehicleDocument[];
  
  // NEW: Contact & Communication for Listing Platform
  sellerPhone?: string;
  sellerWhatsApp?: string;
  showPhoneNumber?: boolean;
  preferredContactMethod?: 'chat' | 'phone' | 'both';
  
  // NEW: Listing Lifecycle Management
  createdAt?: string; // ISO String
  updatedAt?: string; // ISO String
  listingExpiresAt?: string; // ISO String
  listingLastRefreshed?: string; // ISO String
  listingStatus?: 'active' | 'expired' | 'sold' | 'suspended' | 'draft';
  listingAutoRenew?: boolean;
  listingRenewalCount?: number;
  daysActive?: number;
  
  // NEW: Visibility & Promotion
  isPremiumListing?: boolean;
  isUrgentSale?: boolean;
  isBestPrice?: boolean;
  boostExpiresAt?: string;
  
  // NEW: Performance Tracking
  viewsLast7Days?: number;
  viewsLast30Days?: number;
  uniqueViewers?: number;
  phoneViews?: number;
  shareCount?: number;
  
  // NEW: Search & Discovery
  keywords?: string[];
  nearbyLandmarks?: string[];
  exactLocation?: {
    lat: number;
    lng: number;
    showExact: boolean;
  };
  distanceFromUser?: number;
  
  // NEW: Quality Indicators
  photoQuality?: 'low' | 'medium' | 'high';
  hasMinimumPhotos?: boolean;
  descriptionQuality?: number; // 0-100 score
  
  // ENHANCED: Additional Fields (from new features)
  activeBoosts?: ActiveBoost[];
  hideExactLocation?: boolean;

  /** Per-listing promotional offer (stored in Supabase `metadata` when using Postgres). */
  offerEnabled?: boolean;
  offerTitle?: string;
  /** Inclusive start date for visibility (YYYY-MM-DD). */
  offerStartDate?: string;
  /** Inclusive end date for visibility (YYYY-MM-DD). */
  offerEndDate?: string;
  /** Optional display string instead of formatted dates (e.g. "8 - 31 DEC"). */
  offerDateLabel?: string;
  offerDescription?: string;
  offerHighlight?: string;
  offerDisclaimer?: string;
  
  /** AI-powered photo inspection report */
  aiInspectionReport?: AIInspectionReport;

  /** Seller self-disclosure checklist (structured condition + photo per item) */
  sellerDisclosureChecklist?: SellerDisclosureChecklist;
  /** Government RC snapshot when verified */
  vahanSnapshot?: VahanSnapshot;
}

export interface VehicleTrustDeal {
  id: string;
  vehicleId: string;
  sellerEmail: string;
  buyerEmail: string;
  status: 'pending_buyer_confirm' | 'completed' | 'cancelled';
  createdAt: string;
  sellerConfirmedAt?: string;
  buyerConfirmedAt?: string;
  completedAt?: string;
}

export interface PeerRatingRecord {
  id: string;
  dealId: string;
  raterEmail: string;
  ratedEmail: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface RatingEligibility {
  canRateSeller: boolean;
  canRateBuyer: boolean;
  dealId?: string;
  reason?: string;
}

export type SubscriptionPlan = 'free' | 'pro' | 'premium';

export interface PlanDetails {
    id: SubscriptionPlan;
    name: string;
    price: number; // per month
    durationDays?: number; // plan validity in days (default 30)
    features: string[];
    listingLimit: number | 'unlimited';
    featuredCredits: number;
    freeCertifications: number;
    isMostPopular?: boolean;
}

export interface User {
  id?: string; // Supabase primary key (email-based)
  name: string;
  email: string;
  password?: string; // Optional for API responses, required for registration/login
  mobile: string;
  role: 'seller' | 'customer' | 'admin' | 'service_provider' | 'finance_partner';
  location: string;
  address?: string; // Full address (street, city, state, etc.)
  /** Indian postal PIN (6 digits) — used with address for map pin and area grouping */
  pincode?: string;
  status: 'active' | 'inactive';
  createdAt: string; // ISO String
  updatedAt?: string; // ISO String - when the user was last updated
  avatarUrl?: string;
  isVerified?: boolean;
  // Authentication fields
  firebaseUid?: string;
  authProvider?: 'email' | 'google' | 'phone';
  /** True when the account has a password stored (OAuth users may not until they set one). */
  hasPassword?: boolean;
  // Seller-specific profile info
  dealershipName?: string;
  bio?: string;
  logoUrl?: string;
  averageRating?: number;
  ratingCount?: number;
  /** Seller profile display (alias for averageRating when in seller context) */
  sellerAverageRating?: number;
  sellerRatingCount?: number;
  badges?: Badge[];
  // New monetization fields for sellers
  subscriptionPlan?: SubscriptionPlan;
  featuredCredits?: number;
  usedCertifications?: number;
  planActivatedDate?: string; // ISO String - when the current plan was activated
  planExpiryDate?: string; // ISO String - when the current plan expires
  
  /** If true, show "Reride Recommends" on dealer page (admin-controlled) */
  rerideRecommended?: boolean;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  govtIdVerified?: boolean;
  verificationDate?: string; // ISO String
  
  // NEW: Payment Request System
  pendingPlanUpgrade?: PaymentRequest;
  
  // NEW: Activity & Reputation
  responseTime?: number; // in minutes
  responseRate?: number; // percentage 0-100
  joinedDate?: string; // ISO String
  lastActiveAt?: string; // ISO String
  activeListings?: number;
  soldListings?: number;
  totalViews?: number;
  
  // NEW: Safety
  reportedCount?: number;
  isBanned?: boolean;
  trustScore?: number; // 0-100
  
  // NEW: Contact Preferences
  alternatePhone?: string;
  preferredContactHours?: string;
  showEmailPublicly?: boolean;
  
  // NEW: Finance Partner Banks
  partnerBanks?: string[]; // Array of bank names the seller is partnered with for finance
  
  // ENHANCED: Trust & Safety
  verificationStatus?: VerificationStatus;
  
  // Document Verification (Aadhar & PAN)
  aadharCard?: {
    number: string;
    documentUrl: string;
    isVerified: boolean;
    verifiedAt?: string;
    verifiedBy?: string;
    uploadedAt?: string;
  };
  panCard?: {
    number: string;
    documentUrl: string;
    isVerified: boolean;
    verifiedAt?: string;
    verifiedBy?: string;
    uploadedAt?: string;
  };

  /** Story keys muted for Activity / push / browser notifications; stored in Supabase user metadata when logged in. */
  notificationMuteKeys?: string[];
}

export interface ChatMessage {
  id: number;
  sender: 'user' | 'seller' | 'system';
  text: string;
  timestamp: string;
  isRead: boolean;
  type?: 'text' | 'test_drive_request' | 'offer' | 'image' | 'voice';
  // Real-time message status tracking
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  payload?: {
    // for test drive
    date?: string;
    time?: string;
    // for offer
    offerPrice?: number;
    price?: number;
    message?: string;
    originalMessageId?: number | string;
    /** If this message is a counter-offer, this field holds the price of the offer it is countering. */
    counterPrice?: number;
    status?: 'pending' | 'accepted' | 'rejected' | 'countered' | 'confirmed';
    /** Public URL for image messages (e.g. Supabase Storage). */
    imageUrl?: string;
    /** Public URL for voice note (e.g. WebM in Supabase Storage). */
    audioUrl?: string;
    /** Approximate duration in seconds (client-measured). */
    durationSeconds?: number;
  };
}

export interface Conversation {
  id: string;
  customerId: string;
  customerName: string;
  sellerId: string;
  vehicleId: number;
  vehicleName: string;
  vehiclePrice?: number;
  messages: ChatMessage[];
  lastMessageAt: string;
  isReadBySeller: boolean;
  isReadByCustomer: boolean;
  isFlagged?: boolean;
  flagReason?: string;
  flaggedAt?: string;
  /** ISO time: customer chose "clear history" — they no longer see messages at or before this (others unaffected). */
  customerHistoryClearedAt?: string;
  /** ISO time: seller chose "clear history" — they no longer see messages at or before this (others unaffected). */
  sellerHistoryClearedAt?: string;
}

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export enum View {
  HOME = 'HOME',
  USED_CARS = 'USED_CARS',
  CAR_SERVICES = 'CAR_SERVICES',
  SERVICE_DETAIL = 'SERVICE_DETAIL',
  CAR_SERVICE_LOGIN = 'CAR_SERVICE_LOGIN',
  CAR_SERVICE_DASHBOARD = 'CAR_SERVICE_DASHBOARD',
  SERVICE_CART = 'SERVICE_CART',
  RENTAL = 'RENTAL',
  DEALER_PROFILES = 'DEALER_PROFILES',
  DETAIL = 'DETAIL',
  SELLER_DASHBOARD = 'SELLER_DASHBOARD',
  ADMIN_PANEL = 'ADMIN_PANEL',
  LOGIN_PORTAL = 'LOGIN_PORTAL',
  CUSTOMER_LOGIN = 'CUSTOMER_LOGIN',
  SELLER_LOGIN = 'SELLER_LOGIN',
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  COMPARISON = 'COMPARISON',
  WISHLIST = 'WISHLIST',
  PROFILE = 'PROFILE',
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
  INBOX = 'INBOX',
  SELLER_PROFILE = 'SELLER_PROFILE',
  PRICING = 'PRICING',
  SUPPORT = 'SUPPORT',
  ABOUT_US = 'ABOUT_US',
  /** Safety tips, fraud awareness, meeting sellers securely */
  SAFETY_CENTER = 'SAFETY_CENTER',
  FAQ = 'FAQ',
  PRIVACY_POLICY = 'PRIVACY_POLICY',
  TERMS_OF_SERVICE = 'TERMS_OF_SERVICE',
  REFUND_POLICY = 'REFUND_POLICY',
  COMPLAINT_RESOLUTION = 'COMPLAINT_RESOLUTION',
  FRAUD_POLICY = 'FRAUD_POLICY',
  COOKIE_POLICY = 'COOKIE_POLICY',
  HELP_CENTER = 'HELP_CENTER',
  BUYER_DASHBOARD = 'BUYER_DASHBOARD',
  CITY_LANDING = 'CITY_LANDING',
  SELL_CAR = 'SELL_CAR',
  SELL_CAR_ADMIN = 'SELL_CAR_ADMIN',
  /** Full-screen activity feed (grouped notifications, mute) — not Messages. */
  NOTIFICATIONS_CENTER = 'NOTIFICATIONS_CENTER',
  /** Unknown or invalid URL — show a friendly 404 instead of silently landing on Home. */
  NOT_FOUND = 'NOT_FOUND',
}

export interface ProsAndCons {
    pros: string[];
    cons: string[];
}

export interface SearchFilters {
    make?: string;
    model?: string;
    minPrice?: number;
    maxPrice?: number;
    features?: string[];
    minYear?: number;
    maxYear?: number;
    year?: number;
    minMileage?: number;
    maxMileage?: number;
    category?: VehicleCategory;
    fuelType?: string;
    transmission?: string;
    /** 1 = first owner, 2 = second, 3plus = third or more */
    ownership?: '1' | '2' | '3plus';
    location?: string;
    selectedFeatures?: string[];
}

export interface PlatformSettings {
    listingFee: number;
    siteAnnouncement: string;
}

export interface AuditLogEntry {
    id: number;
    timestamp: string; // ISO String
    actor: string; // email of the admin
    action: string;
    target: string; // e.g., user email or vehicle ID
    details?: string;
}

export type VehicleData = Record<string, VehicleCategoryData>;

export interface Suggestion {
  type: 'pricing' | 'listing_quality' | 'urgent_inquiry';
  title: string;
  description: string;
  targetId: number | string;
  priority: 'high' | 'medium' | 'low';
}

export interface Notification {
  id: number;
  recipientEmail: string;
  message: string;
  /** Optional title for display */
  title?: string;
  targetId: string | number;
  /** Vehicle ID when targetType is vehicle or price_drop */
  vehicleId?: number;
  targetType: 'vehicle' | 'conversation' | 'price_drop' | 'insurance_expiry' | 'general_admin' | 'service_request' | 'deal';
  type?: string;
  isRead: boolean;
  timestamp: string; // ISO String
  /** Deal pipeline: RR-LD-xxx lead id */
  dealLeadId?: string;
  /** Deal notification action (e.g. seller Accept Chat, admin view complaint) */
  dealAction?: 'accept_chat' | 'open_deal' | 'view_complaint' | 'view_assistance';
  /** Linked conversation for deal / chat notifications */
  conversationId?: string;
}

/** Service provider / workshop (used by service dashboards and APIs) */
export interface Provider {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  location?: string;
  state?: string;
  district?: string;
  serviceCategories?: string[];
  availability?: string;
  skills?: string[];
  workshops?: string[];
}

/** Generic API response shape (certification and feature endpoints) */
export interface ApiResponse<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  reason?: string;
  alreadyRequested?: boolean;
  usedCertifications?: number;
  remainingCertifications?: number;
}

export interface Command {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
  section: 'Navigation' | 'Actions' | 'Theme';
}

export interface TicketReply {
  author: string; // 'user' or admin email
  message: string;
  timestamp: string;
}

export interface SupportTicket {
  /** Server row id (often a string like `ticket_<timestamp>`); may be numeric in mock data. */
  id: string | number;
  userEmail: string;
  userName: string;
  subject: string;
  message: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  createdAt: string;
  updatedAt: string;
  replies: TicketReply[];
}

export interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: string;
}

// NEW: Listing Platform Specific Interfaces

export interface ListingBoost {
  id: string;
  vehicleId: number;
  type: 'top_search' | 'homepage_spotlight' | 'featured_badge';
  startDate: string;
  expiresAt: string;
  price: number;
  isActive: boolean;
}


export interface BuyerActivity {
  userId: string;
  recentlyViewed: number[]; // vehicle IDs
  savedSearches: SavedSearch[];
  notifications: {
    priceDrops: number[];
    newMatches: number[];
  };
}

export interface ListingStats {
  vehicleId: number;
  date: string;
  views: number;
  uniqueViews: number;
  phoneViews: number;
  chatStarts: number;
  shares: number;
  favorites: number;
}

export interface SafetyWarning {
  id: number;
  title: string;
  message: string;
  icon: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface SortOption {
  label: string;
  value: 'newest' | 'oldest' | 'price_low' | 'price_high' | 'most_viewed';
}

// ============================================
// PAYMENT REQUEST SYSTEM
// ============================================
export interface PaymentRequest {
  id: string;
  sellerEmail: string;
  sellerName?: string;
  planId: SubscriptionPlan;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  paymentProof?: string; // Screenshot URL, UPI reference, etc.
  paymentMethod?: 'upi' | 'bank_transfer' | 'card' | 'other';
  transactionId?: string; // UPI reference, transaction ID, etc.
  requestedAt: string;
  approvedAt?: string;
  approvedBy?: string; // Admin email
  rejectedAt?: string;
  rejectedBy?: string; // Admin email
  rejectionReason?: string;
  notes?: string;
}

// ============================================
// LOCATION & DISCOVERY FEATURES
// ============================================
export interface LocationCoordinates {
  lat: number;
  lng: number;
}

export interface PopularSearch {
  id: number;
  query: string;
  count: number;
  city?: string;
  state?: string;
  category?: VehicleCategory;
  createdAt: string;
}

export interface NearbyLandmark {
  id: number;
  name: string;
  type: 'metro' | 'railway' | 'airport' | 'mall' | 'landmark';
  location: LocationCoordinates;
  city: string;
  state: string;
}

export interface CityStats {
  cityName: string;
  stateCode: string;
  totalListings: number;
  averagePrice: number;
  /** @deprecated use averagePrice */
  avgPrice?: number;
  popularMakes: string[];
  /** Optional list of brand names (alias or extended) */
  brands?: string[];
  popularCategories: VehicleCategory[];
}

export interface RadiusSearchParams {
  center: LocationCoordinates;
  radiusKm: number;
  filters?: SearchFilters;
}

// ============================================
// LISTING LIFECYCLE MANAGEMENT
// ============================================
export interface ListingLifecycle {
  vehicleId: number;
  createdAt: string;
  expiresAt: string;
  lastRefreshedAt?: string;
  autoRenew: boolean;
  renewalCount: number;
  status: 'active' | 'expired' | 'suspended';
}

export interface ListingRefresh {
  vehicleId: number;
  refreshedAt: string;
  refreshType: 'manual' | 'auto' | 'boost';
  cost?: number;
}

// ============================================
// BUYER ENGAGEMENT TOOLS
// ============================================
export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  filters: SearchFilters;
  emailAlerts: boolean;
  smsAlerts: boolean;
  notificationFrequency: 'instant' | 'daily' | 'weekly';
  createdAt: string;
  lastNotifiedAt?: string;
}

export interface PriceDropAlert {
  id: string;
  userId: string;
  vehicleId: number;
  originalPrice: number;
  currentPrice: number;
  percentageDropped: number;
  notified: boolean;
  createdAt: string;
}

export interface FollowedSeller {
  id: string;
  userId: string;
  sellerEmail: string;
  followedAt: string;
  notifyOnNewListing: boolean;
}

export interface VehicleView {
  vehicleId: number;
  userId?: string;
  viewedAt: string;
  sessionId: string;
  source?: string;
}

// ============================================
// TRUST & SAFETY
// ============================================
export interface VerificationStatus {
  phoneVerified?: boolean;
  phoneVerifiedAt?: string;
  emailVerified?: boolean;
  emailVerifiedAt?: string;
  govtIdVerified?: boolean;
  govtIdVerifiedAt?: string;
  govtIdType?: 'aadhaar' | 'pan' | 'driving_license';
  govtIdNumber?: string; // Encrypted/hashed
}

export interface TrustScore {
  userId: string;
  score: number; // 0-100
  factors: {
    verificationsComplete: number;
    responseRate: number;
    positiveReviews: number;
    accountAge: number;
    successfulDeals: number;
  };
  lastCalculated: string;
}

export interface SafetyReport {
  id: string;
  reportedBy: string;
  targetType: 'vehicle' | 'user' | 'conversation';
  targetId: string | number;
  reason: 'scam' | 'fake_listing' | 'inappropriate' | 'spam' | 'other';
  description: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt?: string;
  action?: string;
}

export interface ResponseTimeStats {
  userId: string;
  averageResponseMinutes: number;
  responseRate: number; // percentage 0-100
  totalQueries: number;
  respondedQueries: number;
  lastCalculated: string;
}

// ============================================
// ENHANCED SELLER FEATURES
// ============================================
export interface ListingAnalytics {
  vehicleId: number;
  views: number;
  uniqueViews: number;
  phoneReveals: number;
  chatStarts: number;
  testDriveRequests: number;
  offers: number;
  shares: number;
  favorites: number;
  viewsByHour: Record<string, number>;
  viewsByDay: Record<string, number>;
  viewsBySource: Record<string, number>;
}

export interface CompetitorPricing {
  vehicleId: number;
  yourPrice: number;
  marketAverage: number;
  lowestPrice: number;
  highestPrice: number;
  competitorCount: number;
  pricePosition: 'low' | 'average' | 'high';
  suggestedPrice?: number;
}

export interface ListingQualityScore {
  vehicleId: number;
  overallScore: number; // 0-100
  photoQuality: number;
  photoCount: number;
  descriptionLength: number;
  descriptionQuality: number;
  responseTime: number;
  priceCompetitiveness: number;
  suggestions: string[];
}

// ============================================
// MONETIZATION FEATURES
// ============================================
export interface BoostPackage {
  id: string;
  name: string;
  type: 'top_search' | 'homepage_spotlight' | 'featured_badge' | 'multi_city';
  durationDays: number;
  price: number;
  features: string[];
}

export interface ActiveBoost {
  id: string;
  vehicleId: number;
  packageId: string;
  type: 'top_search' | 'homepage_spotlight' | 'featured_badge' | 'multi_city';
  startDate: string;
  expiresAt: string;
  isActive: boolean;
  impressions?: number;
  clicks?: number;
}

export interface ListingPromotion {
  vehicleId: number;
  isPremium: boolean;
  isUrgentSale: boolean;
  isBestPrice: boolean;
  promotionExpiresAt?: string;
}

// ============================================
// MOBILE FEATURES
// ============================================
export interface CallMaskingSession {
  id: string;
  buyerId: string;
  sellerId: string;
  vehicleId: number;
  maskedNumber: string;
  actualNumber: string;
  createdAt: string;
  expiresAt: string;
  callCount: number;
}

export interface SMSAlert {
  id: string;
  userId: string;
  type: 'price_drop' | 'new_match' | 'message' | 'offer';
  message: string;
  vehicleId?: number;
  sent: boolean;
  sentAt?: string;
  createdAt: string;
}

// Type guard functions
export const isVehicle = (obj: any): obj is Vehicle => {
  return obj && 
    typeof obj.id === 'number' &&
    typeof obj.make === 'string' &&
    typeof obj.model === 'string' &&
    typeof obj.year === 'number' &&
    typeof obj.price === 'number' &&
    typeof obj.mileage === 'number' &&
    typeof obj.sellerEmail === 'string' &&
    Array.isArray(obj.images) &&
    Array.isArray(obj.features);
};

// Enhanced type guards for User
export const isUserWithPassword = (user: any): user is User & { password: string } => {
  return isUser(user) && typeof user.password === 'string';
};

export const isUserWithoutPassword = (user: any): user is Omit<User, 'password'> => {
  return isUser(user) && user.password === undefined;
};

// ============================================
// DEAL PIPELINE (RR-LD-xxx leads + timeline)
// ============================================

export type DealChatStatus = 'pending' | 'accepted' | 'declined';

export type DealStage =
  | 'lead_created'
  | 'chat_accepted'
  | 'test_drive_scheduled'
  | 'test_drive_completed'
  | 'offer_made'
  | 'offer_accepted'
  | 'inspection_requested'
  | 'inspection_completed'
  | 'token_uploaded'
  | 'token_confirmed'
  | 'delivery_pending'
  | 'delivery_completed'
  | 'documents_pending'
  | 'documents_completed'
  | 'rc_pending'
  | 'rc_completed'
  | 'deal_completed';

export type DealLeadStatus = 'active' | 'completed' | 'cancelled';

export interface DealOfferRecord {
  id: string;
  amount: number;
  offeredBy: 'buyer' | 'seller';
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  parentOfferId?: string;
  createdAt: string;
}

export interface DealLeadMetadata {
  testDrive?: { date: string; time: string; status: 'pending' | 'confirmed' | 'completed' };
  offers?: DealOfferRecord[];
  currentOfferId?: string;
  acceptedOfferAmount?: number;
  token?: { receiptUrl?: string; amount?: number; uploadedAt?: string; confirmedAt?: string };
  delivery?: { buyerConfirmedAt?: string; sellerConfirmedAt?: string };
  documents?: { saleAgreementUrl?: string; deliveryNoteUrl?: string; buyerUploadedAt?: string; sellerUploadedAt?: string };
  rc?: { transferDocUrl?: string; sellerUploadedAt?: string; buyerConfirmedAt?: string };
  inspection?: {
    requestedAt?: string;
    reportUrl?: string;
    completedAt?: string;
    mechanicName?: string;
    bookingId?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    address?: string;
  };
  assistancePackage?: string;
  assistancePayment?: {
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    amount?: number;
    paidAt?: string;
  };
  assistanceFulfillment?: AssistanceFulfillment;
  /** Free-form survey interests (RC, insurance, etc.) */
  surveyServicesInterested?: string[];
  vehicleName?: string;
}

export type AssistanceFulfillmentStatus =
  | 'requested'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type AssistanceRequestSource = 'purchase' | 'survey';

export interface AssistanceFulfillment {
  status: AssistanceFulfillmentStatus;
  source: AssistanceRequestSource;
  requestedAt: string;
  requestedBy?: string;
  assignedAdminEmail?: string;
  completedAt?: string;
  notes?: string;
  needsInspectionBooking?: boolean;
  needsRcAssistance?: boolean;
}

export interface DealTimelineEvent {
  id: string;
  leadId: string;
  stage: DealStage | string;
  eventType: string;
  actorEmail?: string;
  label?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export type DealKanbanStatus =
  | 'lead_created'
  | 'buyer_contacted'
  | 'chat_started'
  | 'offer_sent'
  | 'negotiation'
  | 'inspection'
  | 'payment_pending'
  | 'vehicle_delivered'
  | 'rc_transfer'
  | 'completed'
  | 'cancelled';

export const DEAL_KANBAN_COLUMNS: { status: DealKanbanStatus; label: string; color: string }[] = [
  { status: 'lead_created', label: 'Lead Created', color: 'bg-slate-100 text-slate-700' },
  { status: 'buyer_contacted', label: 'Buyer Contacted', color: 'bg-blue-100 text-blue-800' },
  { status: 'chat_started', label: 'Chat Started', color: 'bg-indigo-100 text-indigo-800' },
  { status: 'offer_sent', label: 'Offer Sent', color: 'bg-violet-100 text-violet-800' },
  { status: 'negotiation', label: 'Negotiation', color: 'bg-purple-100 text-purple-800' },
  { status: 'inspection', label: 'Inspection', color: 'bg-cyan-100 text-cyan-800' },
  { status: 'payment_pending', label: 'Payment Pending', color: 'bg-amber-100 text-amber-800' },
  { status: 'vehicle_delivered', label: 'Vehicle Delivered', color: 'bg-emerald-100 text-emerald-800' },
  { status: 'rc_transfer', label: 'RC Transfer', color: 'bg-teal-100 text-teal-800' },
  { status: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
  { status: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
];

export interface DealDocumentRecord {
  id: string;
  leadId: string;
  docType: 'token_receipt' | 'sale_agreement' | 'delivery_note' | 'rc_transfer' | 'inspection_report';
  url: string;
  uploadedBy?: string;
  createdAt: string;
}

export interface DealLead {
  id: string;
  vehicleId: string;
  sellerEmail: string;
  buyerEmail: string;
  buyerName?: string;
  conversationId?: string;
  chatStatus: DealChatStatus;
  currentStage: DealStage;
  status: DealLeadStatus;
  metadata: DealLeadMetadata;
  trustDealId?: string;
  createdAt: string;
  updatedAt: string;
  chatAcceptedAt?: string;
  completedAt?: string;
  timeline?: DealTimelineEvent[];
  vehicleName?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  buyerDisplayName?: string;
  sellerDisplayName?: string;
  kanbanStatus?: DealKanbanStatus;
  assignedAdminEmail?: string;
  sellerNotes?: string;
  internalNotes?: string;
  offers?: DealOfferRecord[];
  documents?: DealDocumentRecord[];
}

export interface DealDetail extends DealLead {
  vehiclePrice?: number;
  vehicleYear?: number;
}

export interface AdminKanbanBoard {
  columns: Record<DealKanbanStatus, DealLead[]>;
  totalCount: number;
}

export type DealCalendarEventType = 'test_drive' | 'token_followup' | 'delivery' | 'rc_deadline';

export type DealCalendarEventStatus = 'upcoming' | 'today' | 'overdue' | 'completed';

export interface DealCalendarEvent {
  id: string;
  dealId: string;
  type: DealCalendarEventType;
  title: string;
  subtitle: string;
  date: string;
  time?: string;
  status: DealCalendarEventStatus;
}

export interface SellerDealCalendar {
  events: DealCalendarEvent[];
  thisWeekCount: number;
  overdueCount: number;
}

export interface RcQueueItem extends DealLead {
  rcDocUrl?: string;
  daysInQueue: number;
  rcStatus: 'pending_upload' | 'submitted' | 'buyer_confirmed' | 'completed';
  hasPaidRcAssistance?: boolean;
}

export interface AssistanceQueueItem extends DealLead {
  packageId: string;
  packageLabel: string;
  fulfillmentStatus: AssistanceFulfillmentStatus;
  source: AssistanceRequestSource;
  paidAmount?: number;
  paidAt?: string;
  daysOpen: number;
  needsInspectionBooking?: boolean;
  needsRcAssistance?: boolean;
}

export type FraudSignalSeverity = 'high' | 'medium' | 'low';
export type FraudSignalType =
  | 'content_report'
  | 'cancelled_deal'
  | 'repeat_buyer'
  | 'stale_chat'
  | 'low_trust_seller';

export interface FraudSignal {
  id: string;
  severity: FraudSignalSeverity;
  type: FraudSignalType;
  title: string;
  description: string;
  targetType?: string;
  targetId?: string;
  targetEmail?: string;
  dealId?: string;
  createdAt: string;
}

export interface FraudDashboard {
  signals: FraudSignal[];
  stats: {
    highRisk: number;
    mediumRisk: number;
    pendingReports: number;
    cancelledDeals: number;
    rcOverdue: number;
  };
}

export type DealComplaintCategory =
  | 'payment_issue'
  | 'vehicle_mismatch'
  | 'seller_behavior'
  | 'buyer_behavior'
  | 'documentation'
  | 'other';

export type DealComplaintStatus = 'open' | 'investigating' | 'resolved' | 'dismissed';

export interface DealComplaint {
  id: string;
  leadId: string;
  reporterEmail: string;
  category: DealComplaintCategory;
  message: string;
  status: DealComplaintStatus;
  adminNotes?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  dealVehicleName?: string;
  buyerEmail?: string;
  sellerEmail?: string;
}

export type DealInspectionBookingStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled';

export interface DealInspectionBooking {
  id: string;
  leadId: string;
  bookedBy: string;
  scheduledDate: string;
  scheduledTime: string;
  address: string;
  notes?: string;
  mechanicName?: string;
  status: DealInspectionBookingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DealRevenueDashboard {
  stats: {
    totalLeads: number;
    activeDeals: number;
    completedDeals: number;
    cancelledDeals: number;
    conversionRate: number;
    assistanceRevenue: number;
    assistancePurchases: number;
    avgDealValue: number;
  };
  funnel: Array<{ stage: string; label: string; count: number }>;
  packageBreakdown: Array<{ packageId: string; label: string; count: number; revenue: number }>;
  recentPayments: Array<{
    leadId: string;
    packageId: string;
    amount: number;
    paidAt: string;
    buyerEmail: string;
    sellerEmail: string;
  }>;
}

export type ComplaintCaseCategory = 'listing' | 'user' | 'payment' | 'deal' | 'other';
export type ComplaintCaseStatus = 'open' | 'investigating' | 'resolved' | 'escalated';

export interface ComplaintCase {
  id: string;
  reporterEmail: string;
  reporterName?: string;
  subject: string;
  message: string;
  category: ComplaintCaseCategory;
  dealLeadId?: string;
  vehicleId?: string;
  status: ComplaintCaseStatus;
  resolution?: string;
  adminNotes?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
}

export const COMPLAINT_CASE_CATEGORIES: { value: ComplaintCaseCategory; label: string }[] = [
  { value: 'listing', label: 'Listing / fraud' },
  { value: 'user', label: 'User behavior' },
  { value: 'payment', label: 'Payment issue' },
  { value: 'deal', label: 'Deal dispute' },
  { value: 'other', label: 'Other' },
];

export const DEAL_COMPLAINT_CATEGORIES: { value: DealComplaintCategory; label: string }[] = [
  { value: 'payment_issue', label: 'Payment issue' },
  { value: 'vehicle_mismatch', label: 'Vehicle mismatch' },
  { value: 'seller_behavior', label: 'Seller behavior' },
  { value: 'buyer_behavior', label: 'Buyer behavior' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'other', label: 'Other' },
];

export type DealAssistancePackage = {
  id: string;
  name: string;
  price: number;
  description: string;
};

export const DEAL_ASSISTANCE_PACKAGES: DealAssistancePackage[] = [
  { id: 'doc_review', name: 'Document Review', price: 299, description: 'Expert review of sale documents' },
  { id: 'inspection_coord', name: 'Inspection Coordination', price: 499, description: 'We coordinate a mechanic visit' },
  { id: 'rc_transfer', name: 'RC Transfer Assistance', price: 699, description: 'End-to-end RC transfer help' },
  { id: 'complete_deal', name: 'Complete Deal Assistance', price: 999, description: 'Full deal support from offer to RC' },
];

export const ASSISTANCE_FULFILLMENT_STATUSES: { value: AssistanceFulfillmentStatus; label: string }[] = [
  { value: 'requested', label: 'Requested' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function dealAssistancePackageLabel(packageId: string): string {
  return DEAL_ASSISTANCE_PACKAGES.find((p) => p.id === packageId)?.name
    || packageId.replace(/_/g, ' ');
}

export function assistancePackageNeedsInspection(packageId: string): boolean {
  return packageId === 'inspection_coord' || packageId === 'complete_deal';
}

export function assistancePackageNeedsRc(packageId: string): boolean {
  return packageId === 'rc_transfer' || packageId === 'complete_deal';
}

/** Full pipeline order — used for progress bars, stage validation, and timeline indexing. */
export const DEAL_PIPELINE_STAGES: readonly DealStage[] = [
  'lead_created',
  'chat_accepted',
  'test_drive_scheduled',
  'test_drive_completed',
  'offer_made',
  'offer_accepted',
  'inspection_requested',
  'inspection_completed',
  'token_uploaded',
  'token_confirmed',
  'delivery_pending',
  'delivery_completed',
  'documents_pending',
  'documents_completed',
  'rc_pending',
  'rc_completed',
  'deal_completed',
] as const;

export function pipelineStageIndex(stage: DealStage | string): number {
  return DEAL_PIPELINE_STAGES.indexOf(stage as DealStage);
}

export function pipelineStageProgressPercent(stage: DealStage | string): number {
  const idx = pipelineStageIndex(stage);
  if (idx < 0) return 10;
  return Math.round(((idx + 1) / DEAL_PIPELINE_STAGES.length) * 100);
}

export const DEAL_TIMELINE_STAGES: { stage: DealStage; label: string }[] = [
  { stage: 'lead_created', label: 'Lead Created' },
  { stage: 'chat_accepted', label: 'Chat Started' },
  { stage: 'test_drive_scheduled', label: 'Test Drive Scheduled' },
  { stage: 'test_drive_completed', label: 'Test Drive Completed' },
  { stage: 'offer_accepted', label: 'Offer Accepted' },
  { stage: 'inspection_completed', label: 'Inspection Completed' },
  { stage: 'token_confirmed', label: 'Token Confirmed' },
  { stage: 'delivery_completed', label: 'Delivery Completed' },
  { stage: 'documents_completed', label: 'Documents Completed' },
  { stage: 'rc_completed', label: 'RC Completed' },
  { stage: 'deal_completed', label: 'Deal Completed' },
];

export type SellerTaskType =
  | 'accept_chat'
  | 'respond_offer'
  | 'confirm_test_drive'
  | 'confirm_token'
  | 'confirm_delivery';

export interface SellerTask {
  id: string;
  dealId: string;
  type: SellerTaskType;
  priority: number;
  title: string;
  subtitle: string;
  conversationId?: string;
  payload?: Record<string, unknown>;
  dueAt?: string;
}

export interface SellerCommandCenter {
  tasks: SellerTask[];
  activeDeals: DealLead[];
  stats: {
    activeDealCount: number;
    pendingInterestCount: number;
    tasksToday: number;
    trustScore: number;
    ratingAverage: number;
    ratingCount: number;
  };
}

export function dealStageLabel(stage: DealStage | string): string {
  return DEAL_TIMELINE_STAGES.find((s) => s.stage === stage)?.label || String(stage).replace(/_/g, ' ');
}

export function dealKanbanLabel(status: DealKanbanStatus | string): string {
  return DEAL_KANBAN_COLUMNS.find((c) => c.status === status)?.label || String(status).replace(/_/g, ' ');
}

export function deriveKanbanStatus(lead: Pick<DealLead, 'status' | 'currentStage' | 'chatStatus' | 'metadata'>): DealKanbanStatus {
  if (lead.status === 'cancelled') return 'cancelled';
  if (lead.status === 'completed' || lead.currentStage === 'deal_completed') return 'completed';
  if (['rc_pending', 'rc_completed'].includes(lead.currentStage)) return 'rc_transfer';
  if (['delivery_completed', 'documents_pending', 'documents_completed'].includes(lead.currentStage)) {
    return 'vehicle_delivered';
  }
  if (['token_uploaded', 'token_confirmed', 'delivery_pending'].includes(lead.currentStage)) {
    return 'payment_pending';
  }
  if (['inspection_requested', 'inspection_completed'].includes(lead.currentStage)) return 'inspection';
  if (lead.currentStage === 'offer_accepted') return 'inspection';

  const currentOffer = lead.metadata.offers?.find((o) => o.id === lead.metadata.currentOfferId);
  // Keep "Negotiation" only when the current active offer is actively countered.
  // Historical countered offers should not keep the lead stuck in Negotiation.
  if (currentOffer?.status === 'countered') {
    return 'negotiation';
  }
  if (
    lead.currentStage === 'offer_made' ||
    (currentOffer?.status === 'pending' && currentOffer.offeredBy === 'buyer')
  ) {
    return 'offer_sent';
  }
  if (['test_drive_scheduled', 'test_drive_completed', 'chat_accepted'].includes(lead.currentStage)) {
    return 'chat_started';
  }
  if (lead.chatStatus === 'pending') return 'buyer_contacted';
  return 'lead_created';
}

// Discriminated union for authentication states
export type AuthState = 
  | { type: 'loading' }
  | { type: 'authenticated'; user: User }
  | { type: 'unauthenticated' }
  | { type: 'error'; error: string };

export const isUser = (obj: any): obj is User => {
  return obj &&
    typeof obj.email === 'string' &&
    typeof obj.name === 'string' &&
    (obj.password === undefined || typeof obj.password === 'string') &&
    (obj.mobile === undefined || typeof obj.mobile === 'string') &&
    ['customer', 'seller', 'admin', 'service_provider', 'finance_partner'].includes(obj.role);
};

export const isConversation = (obj: any): obj is Conversation => {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.customerId === 'string' &&
    typeof obj.sellerId === 'string' &&
    typeof obj.vehicleId === 'number' &&
    Array.isArray(obj.messages);
};

export const isApiResponse = <T>(obj: any): obj is { data: T; success: boolean } => {
  return obj && typeof obj === 'object' && 'success' in obj;
};

export const isChatMessage = (obj: any): obj is ChatMessage => {
  return obj &&
    typeof obj.id === 'number' &&
    typeof obj.sender === 'string' &&
    typeof obj.text === 'string' &&
    typeof obj.timestamp === 'string' &&
    typeof obj.isRead === 'boolean';
};

export const isNotification = (obj: any): obj is Notification => {
  return obj &&
    typeof obj.id === 'number' &&
    typeof obj.message === 'string' &&
    typeof obj.recipientEmail === 'string' &&
    typeof obj.targetType === 'string' &&
    typeof obj.isRead === 'boolean' &&
    typeof obj.timestamp === 'string';
};
