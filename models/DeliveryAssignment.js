const mongoose = require('mongoose');

const deliveryAssignmentSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  deliveryBoy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryBoy',
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Delivery Details
  pickupAddress: {
    fullName: String,
    phone: String,
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  deliveryAddress: {
    fullName: String,
    phone: String,
    street: String,
    city: String,
    state: String,
    pincode: String
  },

  // Status tracking
  status: {
    type: String,
    enum: ['assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned', 'cancelled'],
    default: 'assigned'
  },

  // Location tracking
  pickupLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  deliveryLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  locationUpdates: [{
    latitude: Number,
    longitude: Number,
    timestamp: { type: Date, default: Date.now }
  }],

  // Timeline
  assignedAt: { type: Date, default: Date.now },
  pickedUpAt: { type: Date },
  deliveredAt: { type: Date },
  failedAt: { type: Date },
  returnedAt: { type: Date },
  estimatedDeliveryTime: { type: Date },

  // Proof of delivery
  deliveryProof: {
    signature: { type: String, default: '' },
    photo: { type: String, default: '' },
    recipientName: { type: String, default: '' },
    recipientPhone: { type: String, default: '' },
    notes: { type: String, default: '' }
  },

  // Failure reason
  failureReason: { type: String, default: '' },
  failureProof: { type: String, default: '' },

  // Ratings
  deliveryBoyRating: { type: Number, min: 1, max: 5 },
  customerRating: { type: Number, min: 1, max: 5 },
  deliveryBoyReview: { type: String, default: '' },
  customerReview: { type: String, default: '' },

  // Charges
  deliveryCharge: { type: Number, default: 0 },
  returnCharge: { type: Number, default: 0 },
  totalCharge: { type: Number, default: 0 },

  // Payment
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  paidAt: { type: Date },

  // Attempt tracking
  attemptCount: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },

  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date }

}, { timestamps: true });

// Geospatial index
deliveryAssignmentSchema.index({ 'currentLocation': '2dsphere' });
deliveryAssignmentSchema.index({ deliveryBoy: 1, status: 1 });
deliveryAssignmentSchema.index({ order: 1 });
deliveryAssignmentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('DeliveryAssignment', deliveryAssignmentSchema);
