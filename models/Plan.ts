import mongoose from 'mongoose';

const planSchema = new mongoose.Schema({
  planId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  // Base plan ID (for custom plans, this will be a custom ID)
  basePlanId: {
    type: String,
    required: false, // Only for custom plans
  },
  // Plan details
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
    default: 0,
  },
  features: {
    type: [String],
    default: [],
  },
  listingLimit: {
    type: mongoose.Schema.Types.Mixed, // Can be number or 'unlimited'
    required: true,
  },
  featuredCredits: {
    type: Number,
    required: true,
    default: 0,
  },
  freeCertifications: {
    type: Number,
    required: true,
    default: 0,
  },
  isMostPopular: {
    type: Boolean,
    default: false,
  },
  isCustom: {
    type: Boolean,
    default: false, // true for custom plans, false for base plan updates
  },
  // Timestamps
  createdAt: {
    type: String,
    default: () => new Date().toISOString(),
  },
  updatedAt: {
    type: String,
    default: () => new Date().toISOString(),
  },
}, {
  timestamps: false, // We're using custom ISO string timestamps
});

// Index for faster lookups
planSchema.index({ planId: 1 });
planSchema.index({ isCustom: 1 });

const Plan = mongoose.models.Plan || mongoose.model('Plan', planSchema);

export default Plan;

