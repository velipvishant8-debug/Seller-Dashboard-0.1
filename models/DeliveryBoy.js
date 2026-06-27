const mongoose = require('mongoose');
const { Schema, model } = mongoose;
const { createHmac, randomBytes } = require('crypto');
const { creatTokenForUser } = require('../services/authentication');

const DeliveryBoySchema = new Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: false
  },
  salt: { type: String },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true
  },
  profileImageURL: {
    type: String,
    default: '/imgs/default.png'
  },

  // Location & Service
  city: { type: String, required: true },
  state: { type: String, required: true },
  currentLocation: {
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
  serviceAreas: [String], // Pincode areas
  isAvailable: { type: Boolean, default: true },
  lastActiveAt: { type: Date },

  // Documents & Verification
  documentUrls: {
    aadhar: { type: String, default: '' },
    license: { type: String, default: '' },
    bankProof: { type: String, default: '' }
  },
  verificationStatus: {
    type: String,
    enum: ['Pending', 'Verified', 'Rejected', 'Suspended'],
    default: 'Pending'
  },
  verifiedAt: { type: Date },
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },

  // Stats
  totalDeliveries: { type: Number, default: 0 },
  successfulDeliveries: { type: Number, default: 0 },
  failedDeliveries: { type: Number, default: 0 },
  rating: { type: Number, default: 5, min: 0, max: 5 },
  totalEarnings: { type: Number, default: 0 },

  // Bank Details
  bankDetails: {
    accountName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    ifscCode: { type: String, default: '' },
    bankName: { type: String, default: '' },
    upiId: { type: String, default: '' }
  },

  // Device Info
  deviceId: { type: String, default: '' },
  pushToken: { type: String, default: '' },

  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'blocked'],
    default: 'active'
  },

  // Soft delete
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  approvedAt: { type: Date },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Admin' }

}, { timestamps: true });

// Geospatial index
DeliveryBoySchema.index({ 'currentLocation': '2dsphere' });
DeliveryBoySchema.index({ email: 1 });
DeliveryBoySchema.index({ phone: 1 });
DeliveryBoySchema.index({ verificationStatus: 1 });
DeliveryBoySchema.index({ isAvailable: 1 });
DeliveryBoySchema.index({ createdAt: -1 });

// Password hashing
DeliveryBoySchema.pre('save', async function (next) {
  if (!this.password || !this.isModified('password')) return next();
  try {
    const salt = randomBytes(16).toString('hex');
    this.salt = salt;
    this.password = createHmac('sha256', salt).update(this.password).digest('hex');
    next();
  } catch (error) {
    next(error);
  }
});

// Match password and generate token
DeliveryBoySchema.static('matchPassword', async function (email, password) {
  const deliveryBoy = await this.findOne({ email: email.toLowerCase() });
  if (!deliveryBoy) throw new Error('Delivery boy not found');
  if (!deliveryBoy.password) throw new Error('Invalid account');

  const providedHash = createHmac('sha256', deliveryBoy.salt).update(password).digest('hex');
  if (deliveryBoy.password !== providedHash) throw new Error('Incorrect Password');

  return creatTokenForUser(deliveryBoy);
});

const DeliveryBoy = mongoose.models.DeliveryBoy || model('DeliveryBoy', DeliveryBoySchema);
module.exports = DeliveryBoy;
