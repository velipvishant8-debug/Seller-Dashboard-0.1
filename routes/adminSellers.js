const { Router } = require('express');
const { isAdminAuth } = require('../middlewares/isSellerAuth');
const Seller = require('../models/Seller');
const Admin = require('../models/Admin');
const router = Router();

// List all sellers
router.get('/', isAdminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const status = req.query.status || 'all';

    let query = { isDeleted: false };
    if (status !== 'all') {
      query.verificationStatus = status;
    }

    const sellers = await Seller.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Seller.countDocuments(query);

    res.render('admin/sellers/list', {
      title: 'Manage Sellers',
      sellers,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      status
    });
  } catch (error) {
    console.error('Error fetching sellers:', error);
    req.flash('error', error.message);
    res.redirect('/admin/dashboard');
  }
});

// View seller details
router.get('/:id', isAdminAuth, async (req, res) => {
  try {
    const seller = await Seller.findById(req.params.id);
    if (!seller) return res.status(404).render('404');

    const stats = await Promise.all([
      require('../models/Product').countDocuments({ seller: seller._id }),
      require('../models/Order').countDocuments({ seller: seller._id }),
      require('../models/Order').countDocuments({ seller: seller._id, status: 'delivered' })
    ]);

    res.render('admin/sellers/detail', {
      title: 'Seller Details',
      seller,
      stats: {
        products: stats[0],
        orders: stats[1],
        delivered: stats[2]
      }
    });
  } catch (error) {
    console.error('Error fetching seller:', error);
    req.flash('error', error.message);
    res.redirect('/admin/sellers');
  }
});

// Approve seller
router.post('/:id/approve', isAdminAuth, async (req, res) => {
  try {
    const seller = await Seller.findByIdAndUpdate(
      req.params.id,
      {
        verificationStatus: 'Approved',
        approvedAt: new Date(),
        approvedBy: req.admin._id
      },
      { new: true }
    );

    if (req.admin) {
      await req.admin.logActivity(
        'APPROVE_SELLER',
        `Approved seller ${seller.fullName}`,
        'seller',
        seller._id
      );
    }

    req.flash('success', 'Seller approved successfully');
    res.json({ success: true });
  } catch (error) {
    console.error('Error approving seller:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reject seller
router.post('/:id/reject', isAdminAuth, async (req, res) => {
  try {
    const { reason } = req.body;

    const seller = await Seller.findByIdAndUpdate(
      req.params.id,
      {
        verificationStatus: 'Rejected',
        rejectionReason: reason,
        rejectedAt: new Date()
      },
      { new: true }
    );

    if (req.admin) {
      await req.admin.logActivity(
        'REJECT_SELLER',
        `Rejected seller ${seller.fullName}: ${reason}`,
        'seller',
        seller._id
      );
    }

    req.flash('success', 'Seller rejected');
    res.json({ success: true });
  } catch (error) {
    console.error('Error rejecting seller:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Suspend seller
router.post('/:id/suspend', isAdminAuth, async (req, res) => {
  try {
    const { reason } = req.body;

    const seller = await Seller.findByIdAndUpdate(
      req.params.id,
      {
        status: 'suspended',
        isActive: false
      },
      { new: true }
    );

    if (req.admin) {
      await req.admin.logActivity(
        'SUSPEND_SELLER',
        `Suspended seller ${seller.fullName}: ${reason}`,
        'seller',
        seller._id
      );
    }

    req.flash('success', 'Seller suspended');
    res.json({ success: true });
  } catch (error) {
    console.error('Error suspending seller:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
