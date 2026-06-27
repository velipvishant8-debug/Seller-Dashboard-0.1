const mongoose = require('mongoose');
const { Schema, model } = mongoose;
const { createHmac, randomBytes } = require('crypto');
const { creatTokenForUser } = require('../services/authentication');

const AdminSchema = new Schema({
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
    required: [true, 'Password is required']
  },
  salt: { type: String },
  profileImageURL: {
    type: String,
    default: '/imgs/default.png'
  },

  // Role & Permissions
  role: {
    type: String,
    enum: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'],
    default: 'ADMIN'
  },
  permissions: [{
    type: String,
    enum: [
      'manage_sellers',
      'manage_orders',
      'manage_products',
      'manage_delivery_boys',
      'manage_payments',
      'manage_disputes',
      'manage_admins',
      'view_analytics',
      'manage_settings'
    ]
  }],

  // Contact Info
  phone: {
    type: String,
    default: ''
  },
  department: {
    type: String,
    enum: ['operations', 'finance', 'support', 'moderation', 'tech'],
    default: 'operations'
  },

  // Access Control
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date },

  // Activity Log
  activityLog: [{
    action: String,
    description: String,
    targetType: String, // 'seller', 'order', 'product', etc.
    targetId: mongoose.Schema.Types.ObjectId,
    timestamp: { type: Date, default: Date.now }
  }],

  // Soft delete
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },

  // Approval
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  approvedAt: { type: Date },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Admin' }

}, { timestamps: true });

AdminSchema.index({ email: 1 });
AdminSchema.index({ role: 1 });
AdminSchema.index({ isActive: 1 });
AdminSchema.index({ createdAt: -1 });

// Password hashing
AdminSchema.pre('save', async function (next) {
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

// Match password
AdminSchema.static('matchPassword', async function (email, password) {
  const admin = await this.findOne({ email: email.toLowerCase(), isDeleted: false });
  if (!admin) throw new Error('Admin not found');
  if (!admin.isActive) throw new Error('Admin account is inactive');
  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    throw new Error('Account is locked. Try again later');
  }

  const adminProvidedHash = createHmac('sha256', admin.salt).update(password).digest('hex');
  if (admin.password !== adminProvidedHash) {
    admin.loginAttempts = (admin.loginAttempts || 0) + 1;
    if (admin.loginAttempts >= 5) {
      admin.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 mins
    }
    await admin.save();
    throw new Error('Incorrect Password');
  }

  admin.loginAttempts = 0;
  admin.lockedUntil = null;
  admin.lastLoginAt = new Date();
  await admin.save();

  return creatTokenForUser(admin);
});

// Log activity
AdminSchema.methods.logActivity = async function(action, description, targetType, targetId) {
  this.activityLog.push({
    action,
    description,
    targetType,
    targetId
  });
  await this.save();
};

const Admin = mongoose.models.Admin || model('Admin', AdminSchema);
module.exports = Admin;
