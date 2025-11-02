
import mongoose from 'mongoose';
import { VehicleCategory } from '../types';

const vehicleSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true, index: true },
  category: { type: String, enum: Object.values(VehicleCategory), required: true, default: VehicleCategory.FOUR_WHEELER },
  make: { type: String, required: true, index: true },
  model: { type: String, required: true, index: true },
  variant: String,
  year: { type: Number, required: true, index: true },
  price: { type: Number, required: true, index: true },
  mileage: { type: Number, required: true },
  images: [String],
  features: [String],
  description: String,
  sellerEmail: { type: String, required: true, index: true },
  sellerName: String,
  engine: String,
  transmission: String,
  fuelType: String,
  fuelEfficiency: String,
  color: String,
  status: { type: String, enum: ['published', 'unpublished', 'sold'], default: 'published', required: true, index: true },
  isFeatured: { type: Boolean, default: false, index: true },
  views: { type: Number, default: 0 },
  inquiriesCount: { type: Number, default: 0 },
  isFlagged: Boolean,
  flagReason: String,
  flaggedAt: String,
  registrationYear: Number,
  insuranceValidity: String,
  insuranceType: String,
  rto: String,
  city: { type: String, index: true },
  state: { type: String, index: true },
  noOfOwners: Number,
  displacement: String,
  groundClearance: String,
  bootSpace: String,
  qualityReport: { type: mongoose.Schema.Types.Mixed },
  certifiedInspection: { type: mongoose.Schema.Types.Mixed, default: null },
  certificationStatus: { type: String, enum: ['none', 'requested', 'approved', 'rejected'], default: 'none' },
  certificationRequestedAt: String,
  videoUrl: String,
  featuredAt: String,
  soldAt: String,
  serviceRecords: [mongoose.Schema.Types.Mixed],
  accidentHistory: [mongoose.Schema.Types.Mixed],
  documents: [mongoose.Schema.Types.Mixed],
  
  // Location & Discovery
  exactLocation: {
    lat: Number,
    lng: Number,
  },
  hideExactLocation: { type: Boolean, default: true },
  nearbyLandmarks: [String],
  
  // Listing Lifecycle
  listingExpiresAt: { type: Date, index: true },
  listingLastRefreshed: Date,
  listingStatus: { type: String, enum: ['active', 'expired', 'sold', 'suspended', 'draft'], default: 'active' },
  listingAutoRenew: { type: Boolean, default: false },
  listingRenewalCount: { type: Number, default: 0 },
  daysActive: Number,
  
  // Visibility & Promotion
  isPremiumListing: { type: Boolean, default: false },
  activeBoosts: [mongoose.Schema.Types.Mixed],
  boostExpiresAt: Date,
  
  // Contact & Communication
  sellerPhone: String,
  sellerWhatsApp: String,
  showPhoneNumber: { type: Boolean, default: false },
  preferredContactMethod: { type: String, enum: ['chat', 'phone', 'both'], default: 'chat' },
  
  // Ratings & Reviews
  averageRating: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  sellerAverageRating: { type: Number, default: 0 },
  sellerRatingCount: { type: Number, default: 0 },
  sellerBadges: [mongoose.Schema.Types.Mixed],
}, {
  timestamps: true // Add createdAt and updatedAt fields
});

const Vehicle = mongoose.models.Vehicle || mongoose.model('Vehicle', vehicleSchema);

export default Vehicle;
