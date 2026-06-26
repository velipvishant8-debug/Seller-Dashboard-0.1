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

  // ─── CUSTOMER INFO (ADMIN ONLY - HIDDEN FROM SELLER) ───
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerPhone: { type: String, required: true },

  // ─── SHIPPING ADDRESS (ADMIN ONLY) ───
  shippingAddress: {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' }
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
  platformFee: { type: Number, default: 0 }, // 10% of subtotal
  sellerEarnings: { type: Number, default: 0 }, // 90% of subtotal
  totalAmount: { type: Number, required: true },

  // ─── PAYMENT (ADMIN ONLY) ───
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'partial_refund'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cod', 'online', 'upi', 'card', 'wallet'],
    default: 'cod'
  },
  paymentDetails: {
    transactionId: { type: String, default: '' },
    gateway: { type: String, default: '' }, // razorpay, stripe, etc.
    paidAt: { type: Date },
    refundedAt: { type: Date },
    refundAmount: { type: Number, default: 0 },
    refundReason: { type: String, default: '' }
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
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded'],
    default: 'pending'
  },

  // ─── ADMIN ORDER ACTIONS ───
  adminAction: {
    rejectedAt: { type: Date },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
    rejectionReason: { type: String, default: '' },
    refundedAt: { type: Date },
    refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
    refundReason: { type: String, default: '' }
  },

  // ─── TRACKING ───
  trackingNumber: { type: String },
  trackingUrl: { type: String },
  courierName: { type: String },

  // ─── STATUS HISTORY ───
  statusHistory: [{
    status: { type: String },
    note: { type: String },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
    updatedByRole: { type: String, enum: ['ADMIN', 'SELLER'] }
  }],

  // ─── TIMESTAMPS ───
  estimatedDelivery: { type: Date },
  deliveredAt: { type: Date },
  cancelledAt: { type: Date },
  cancelReason: { type: String }

}, { timestamps: true });

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const date = new Date();
    const prefix = 'ORD';
    const random = Math.floor(1000 + Math.random() * 9000);
    this.orderNumber = `${prefix}${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}-${random}`;
  }

  // Calculate return policy end date
  if (this.deliveredAt && !this.returnPolicyEndDate) {
    const endDate = new Date(this.deliveredAt);
    endDate.setDate(endDate.getDate() + (this.returnPolicyDays || 7));
    this.returnPolicyEndDate = endDate;
  }

  // Check if return period is active
  if (this.returnPolicyEndDate) {
    this.isReturnPeriodActive = new Date() < this.returnPolicyEndDate;
  }

  next();
});

// Indexes
orderSchema.index({ seller: 1, status: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ fundsReleased: 1, isReturnPeriodActive: 1 });

module.exports = mongoose.model('Order', orderSchema);
