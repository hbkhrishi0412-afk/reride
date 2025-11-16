import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  sender: { 
    type: String, 
    enum: ['user', 'seller', 'system'], 
    required: true 
  },
  text: { type: String, required: true },
  timestamp: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  type: { 
    type: String, 
    enum: ['text', 'test_drive_request', 'offer'],
    default: 'text'
  },
  payload: {
    date: String,
    time: String,
    offerPrice: Number,
    counterPrice: Number,
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'countered', 'confirmed'],
      default: 'pending'
    }
  }
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  id: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  customerId: { 
    type: String, 
    required: true, 
    index: true 
  },
  customerName: { type: String, required: true },
  sellerId: { 
    type: String, 
    required: true, 
    index: true 
  },
  vehicleId: { 
    type: Number, 
    required: true, 
    index: true 
  },
  vehicleName: { type: String, required: true },
  vehiclePrice: Number,
  messages: [chatMessageSchema],
  lastMessageAt: { 
    type: String, 
    required: true,
    index: true 
  },
  isReadBySeller: { type: Boolean, default: false },
  isReadByCustomer: { type: Boolean, default: false },
  isFlagged: { type: Boolean, default: false },
  flagReason: String,
  flaggedAt: String,
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Compound indexes for common queries
conversationSchema.index({ sellerId: 1, lastMessageAt: -1 });
conversationSchema.index({ customerId: 1, lastMessageAt: -1 });
conversationSchema.index({ vehicleId: 1, customerId: 1 });

const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);

export default Conversation;

