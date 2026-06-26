const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['credit', 'debit', 'payout_request', 'payout_approved', 'payout_rejected', 'refund', 'adjustment'],
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed'
  },
  // For payout requests
  payoutMethod: {
    type: { type: String, enum: ['bank_transfer', 'upi'], default: 'bank_transfer' },
    bankAccountNumber: { type: String, default: '' },
    bankIfsc: { type: String, default: '' },
    upiId: { type: String, default: '' }
  },
  // Admin who processed
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    default: null
  },
  processedAt: { type: Date },
  rejectionReason: { type: String, default: '' }
}, { timestamps: true });

const walletSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    unique: true
  },

  // Available balance (can withdraw)
  availableBalance: { type: Number, default: 0 },

  // Pending balance (orders in return period)
  pendingBalance: { type: Number, default: 0 },

  // Total lifetime earnings
  totalEarned: { type: Number, default: 0 },

  // Total withdrawn
  totalWithdrawn: { type: Number, default: 0 },

  // Total refunded
  totalRefunded: { type: Number, default: 0 },

  // Transaction history
  transactions: [transactionSchema],

  // Payout settings
  payoutSettings: {
    bankAccountName: { type: String, default: '' },
    bankAccountNumber: { type: String, default: '' },
    bankIfsc: { type: String, default: '' },
    bankName: { type: String, default: '' },
    upiId: { type: String, default: '' },
    preferredMethod: { type: String, enum: ['bank_transfer', 'upi'], default: 'bank_transfer' }
  }

}, { timestamps: true });

// Methods
walletSchema.methods.addTransaction = async function(type, amount, description, options = {}) {
  const transaction = {
    type,
    amount,
    description,
    order: options.order || null,
    status: options.status || 'completed',
    payoutMethod: options.payoutMethod || undefined,
    processedBy: options.processedBy || null,
    processedAt: options.processedAt || null
  };

  this.transactions.push(transaction);

  if (type === 'credit') {
    this.availableBalance += amount;
    this.totalEarned += amount;
  } else if (type === 'debit' || type === 'payout_approved') {
    this.availableBalance -= amount;
    this.totalWithdrawn += amount;
  } else if (type === 'refund') {
    this.availableBalance -= amount;
    this.totalRefunded += amount;
  }

  await this.save();
  return transaction;
};

walletSchema.methods.requestPayout = async function(amount, payoutMethod) {
  const MIN_PAYOUT = 1000;

  if (amount < MIN_PAYOUT) {
    throw new Error(`Minimum payout amount is ₹${MIN_PAYOUT}`);
  }

  if (this.availableBalance < amount) {
    throw new Error('Insufficient balance');
  }

  // Lock the amount (move from available to pending in transaction)
  this.availableBalance -= amount;

  const transaction = {
    type: 'payout_request',
    amount: amount,
    description: `Payout request of ₹${amount}`,
    status: 'pending',
    payoutMethod: {
      type: payoutMethod.type || this.payoutSettings.preferredMethod,
      bankAccountNumber: payoutMethod.bankAccountNumber || this.payoutSettings.bankAccountNumber,
      bankIfsc: payoutMethod.bankIfsc || this.payoutSettings.bankIfsc,
      upiId: payoutMethod.upiId || this.payoutSettings.upiId
    }
  };

  this.transactions.push(transaction);
  await this.save();
  return transaction;
};

walletSchema.statics.getOrCreate = async function(sellerId) {
  let wallet = await this.findOne({ seller: sellerId });
  if (!wallet) {
    wallet = await this.create({ seller: sellerId });
  }
  return wallet;
};

module.exports = mongoose.model('Wallet', walletSchema);
