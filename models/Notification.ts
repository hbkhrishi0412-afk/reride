import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  id: { 
    type: Number, 
    required: true, 
    unique: true, 
    index: true 
  },
  recipientEmail: { 
    type: String, 
    required: true, 
    index: true 
  },
  message: { type: String, required: true },
  targetId: { 
    type: mongoose.Schema.Types.Mixed, // Can be string or number
    required: true 
  },
  targetType: { 
    type: String, 
    enum: ['vehicle', 'conversation', 'price_drop', 'insurance_expiry', 'general_admin'],
    required: true 
  },
  isRead: { type: Boolean, default: false, index: true },
  timestamp: { 
    type: String, 
    required: true,
    index: true 
  },
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Compound indexes for common queries
notificationSchema.index({ recipientEmail: 1, isRead: 1, timestamp: -1 });
notificationSchema.index({ recipientEmail: 1, timestamp: -1 });

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

export default Notification;

