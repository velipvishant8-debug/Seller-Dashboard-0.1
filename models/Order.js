const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productTitle: { type: String, required: true },
  productImage: { type: String },
  productSlug: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  total: { type: Number, required: true },
  variant: {
    colorName: { type: String, default: '' },
    size: { type: String, default: '' }
  }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },

  // ─── CUSTOMER INFO ───
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerPhone: { type: String, required: true },

  // ─── SHIPPING ADDRESS ───
  shippingAddress: {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' },
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }
    }
  },

  // ─── SELLER INFO ───
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  sellerBusinessName: { type: String },

  // ─── ORDER ITEMS ───
  items: [orderItemSchema],

  // ─── PRICING ───
  subtotal: { type: Number, required: true },
  shippingCost: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  platformFee: { type: Number, default: 0 },
  sellerEarnings: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },

  // ─── PAYMENT ───
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'partial_refund', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cod', 'online', 'upi', 'card', 'wallet'],
    default: 'cod'
  },
  paymentDetails: {
    transactionId: { type: String, default: '' },
    gateway: { type: String, default: '' },
    paidAt: { type: Date },
    refundedAt: { type: Date },
    refundAmount: { type: Number, default: 0 },
    refundReason: { type: String, default: '' },
    refundStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed'],
      default: 'pending'
    },
    refundTransactionId: { type: String, default: '' }
  },

  // ─── RETURN POLICY & ESCROW ───
  returnPolicyDays: { type: Number, default: 7 },
  returnPolicyEndDate: { type: Date },
  isReturnPeriodActive: { type: Boolean, default: true },
  fundsReleased: { type: Boolean, default: false },
  fundsReleasedAt: { type: Date },

  // ─── ORDER STATUS ───
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'ready_for_pickup', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded'],
    default: 'pending'
  },

  // ─── DELIVERY ASSIGNMENT ───
  deliveryAssignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryAssignment'
  },
  deliveryBoy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryBoy'
  },
  deliveryType: {
    type: String,
    enum: ['standard', 'express', 'scheduled'],
    default: 'standard'
  },

  // ─── TRACKING ───
  trackingNumber: { type: String },
  trackingUrl: { type: String },
  courierName: { type: String },
  deliveryPartner: { type: String },

  // ─── TIMESTAMPS ───
  estimatedDelivery: { type: Date },
  deliveredAt: { type: Date },
  cancelledAt: { type: Date },
  cancelReason: { type: String },

  // ─── ADMIN ORDER ACTIONS ───
  adminAction: {
    rejectedAt: { type: Date },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    rejectionReason: { type: String, default: '' },
    refundedAt: { type: Date },
    refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    refundReason: { type: String, default: '' },
    notes: { type: String, default: '' }
  },

  // ─── STATUS HISTORY ───
  statusHistory: [{
    status: { type: String },
    note: { type: String },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    updatedByRole: { type: String, enum: ['ADMIN', 'SELLER', 'DELIVERY_BOY'] }
  }],

  // ─── RATINGS & REVIEWS ───
  sellerRating: { type: Number, min: 1, max: 5 },
  sellerReview: { type: String },
  deliveryRating: { type: Number, min: 1, max: 5 },
  deliveryReview: { type: String },

  // ─── INVOICE ───
  invoiceNumber: { type: String },
  invoiceUrl: { type: String },
  invoiceGeneratedAt: { type: Date }

}, { timestamps: true });

// Geospatial index
orderSchema.index({ 'shippingAddress.coordinates': '2dsphere' });

// Query indexes
orderSchema.index({ seller: 1, status: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ fundsReleased: 1, isReturnPeriodActive: 1 });
orderSchema.index({ deliveryBoy: 1, status: 1 });
orderSchema.index({ status: 1, createdAt: -1 });

// Pre-save middleware
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const date = new Date();
    const prefix = 'ORD';
    const random = Math.floor(1000 + Math.random() * 9000);
    this.orderNumber = `${prefix}${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}-${random}`;
  }

  if (this.deliveredAt && !this.returnPolicyEndDate) {
    const endDate = new Date(this.deliveredAt);
    endDate.setDate(endDate.getDate() + (this.returnPolicyDays || 7));
    this.returnPolicyEndDate = endDate;
  }

  if (this.returnPolicyEndDate) {
    this.isReturnPeriodActive = new Date() < this.returnPolicyEndDate;
  }

  next();
});

// Methods
orderSchema.methods.updateStatus = async function(newStatus, note, updatedBy, role) {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    note: note || '',
    updatedBy,
    updatedByRole: role || 'ADMIN',
    updatedAt: new Date()
  });
  await this.save();
};

orderSchema.methods.processRefund = async function(amount, reason, processedBy) {
  this.paymentStatus = 'refunded';
  this.paymentDetails.refundAmount = amount;
  this.paymentDetails.refundReason = reason;
  this.paymentDetails.refundStatus = 'completed';
  this.paymentDetails.refundedAt = new Date();
  this.adminAction.refundedBy = processedBy;
  this.adminAction.refundedAt = new Date();
  this.adminAction.refundReason = reason;
  await this.save();
};

module.exports = mongoose.model('Order', orderSchema);
