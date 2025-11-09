
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required.'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address'],
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Name is required.'],
    trim: true,
  },
  password: {
    type: String,
    required: false // Not required for OAuth/OTP users
  },
  mobile: {
    type: String,
    required: false // Not required for Google OAuth users
  },
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true, // Allows null values while maintaining uniqueness
    index: true
  },
  authProvider: {
    type: String,
    enum: ['email', 'google', 'phone'],
    default: 'email'
  },
  role: {
    type: String,
    required: [true, 'Role is required.'],
    enum: {
      values: ['customer', 'seller', 'admin'],
      message: '{VALUE} is not a supported role.'
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  avatarUrl: String,
  isVerified: {
    type: Boolean,
    default: false,
  },
  dealershipName: String,
  bio: String,
  logoUrl: String,
  subscriptionPlan: {
    type: String,
    enum: ['free', 'pro', 'premium'],
    default: 'free',
  },
  featuredCredits: {
    type: Number,
    default: 0
  },
  usedCertifications: {
    type: Number,
    default: 0
  },
  planActivatedDate: {
    type: String, // ISO String - when the current plan was activated
  },
  planExpiryDate: {
    type: String, // ISO String - when the current plan expires
  },
  
  // Trust & Verification
  phoneVerified: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  govtIdVerified: { type: Boolean, default: false },
  verificationDate: String,
  verificationStatus: {
    phoneVerified: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    govtIdVerified: { type: Boolean, default: false },
  },
  
  // Document Verification (Aadhar & PAN)
  aadharCard: {
    number: { type: String, default: '' },
    documentUrl: { type: String, default: '' },
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: String, default: '' },
    verifiedBy: { type: String, default: '' },
    uploadedAt: { type: String, default: '' },
  },
  panCard: {
    number: { type: String, default: '' },
    documentUrl: { type: String, default: '' },
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: String, default: '' },
    verifiedBy: { type: String, default: '' },
    uploadedAt: { type: String, default: '' },
  },
  
  // Activity & Reputation
  responseTime: Number, // in minutes
  responseRate: Number, // percentage 0-100
  responseTimeMinutes: Number,
  joinedDate: String,
  lastActiveAt: String,
  activeListings: { type: Number, default: 0 },
  soldListings: { type: Number, default: 0 },
  totalViews: { type: Number, default: 0 },
  
  // Trust & Safety
  reportedCount: { type: Number, default: 0 },
  isBanned: { type: Boolean, default: false },
  trustScore: { type: Number, default: 0 },
  
  // Contact Preferences
  alternatePhone: String,
  preferredContactHours: String,
  showEmailPublicly: { type: Boolean, default: false },
  
  // Ratings & Reviews
  averageRating: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  badges: [mongoose.Schema.Types.Mixed],
  
  // Payment Request System
  pendingPlanUpgrade: {
    id: String,
    sellerEmail: String,
    planId: String,
    amount: Number,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    paymentProof: String,
    paymentMethod: String,
    transactionId: String,
    requestedAt: String,
    approvedAt: String,
    approvedBy: String,
    rejectedAt: String,
    rejectedBy: String,
    rejectionReason: String,
    notes: String,
  },
}, {
  timestamps: true // Adds createdAt and updatedAt managed by Mongoose
});

// The `mongoose.models.User` check prevents Mongoose from recompiling the model during hot-reloads in development
const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
