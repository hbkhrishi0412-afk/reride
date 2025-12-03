import mongoose from 'mongoose';

const rateLimitSchema = new mongoose.Schema({
  identifier: {
    type: String,
    required: true,
    index: true,
  },
  count: {
    type: Number,
    required: true,
    default: 1,
  },
  resetTime: {
    type: Number,
    required: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600, // Auto-delete after 1 hour (TTL index)
  },
}, {
  timestamps: false,
});

// TTL index to auto-delete expired entries
rateLimitSchema.index({ resetTime: 1 }, { expireAfterSeconds: 0 });
rateLimitSchema.index({ identifier: 1, resetTime: 1 });

const RateLimit = mongoose.models.RateLimit || mongoose.model('RateLimit', rateLimitSchema);

export default RateLimit;







