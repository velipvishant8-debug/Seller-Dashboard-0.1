const { Router } = require('express');
const { isAdminAuth } = require('../middlewares/isSellerAuth');
const DeliveryBoy = require('../models/DeliveryBoy');
const DeliveryAssignment = require('../models/DeliveryAssignment');
const Admin = require('../models/Admin');
const router = Router();

// List delivery boys
router.get('/boys', isAdminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const status = req.query.status || 'all';

    let query = { isDeleted: false };
    if (status !== 'all') {
      query.verificationStatus = status;
    }

    const deliveryBoys = await DeliveryBoy.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await DeliveryBoy.countDocuments(query);

    res.render('admin/delivery/boys-list', {
      title: 'Delivery Boys',
      deliveryBoys,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      status
    });
  } catch (error) {
    console.error('Error fetching delivery boys:', error);
    req.flash('error', error.message);
    res.redirect('/admin/dashboard');
  }
});

// Delivery boy details
router.get('/boys/:id', isAdminAuth, async (req, res) => {
  try {
    const deliveryBoy = await DeliveryBoy.findById(req.params.id);
    if (!deliveryBoy) return res.status(404).render('404');

    const stats = await Promise.all([
      DeliveryAssignment.countDocuments({ deliveryBoy: deliveryBoy._id, status: 'delivered' }),
      DeliveryAssignment.countDocuments({ deliveryBoy: deliveryBoy._id, status: 'failed' }),
      DeliveryAssignment.countDocuments({ deliveryBoy: deliveryBoy._id, status: { $in: ['assigned', 'picked_up', 'in_transit'] } })
    ]);

    res.render('admin/delivery/boy-detail', {
      title: 'Delivery Boy Details',
      deliveryBoy,
      stats: {
        delivered: stats[0],
        failed: stats[1],
        active: stats[2]
      }
    });
  } catch (error) {
    console.error('Error fetching delivery boy:', error);
    req.flash('error', error.message);
    res.redirect('/admin/delivery/boys');
  }
});

// Verify delivery boy
router.post('/boys/:id/verify', isAdminAuth, async (req, res) => {
  try {
    const deliveryBoy = await DeliveryBoy.findByIdAndUpdate(
      req.params.id,
      {
        verificationStatus: 'Verified',
        verifiedAt: new Date(),
        verifiedBy: req.admin._id,
        isAvailable: true
      },
      { new: true }
    );

    if (req.admin) {
      await req.admin.logActivity(
        'VERIFY_DELIVERY_BOY',
        `Verified delivery boy ${deliveryBoy.fullName}`,
        'delivery_boy',
        deliveryBoy._id
      );
    }

    req.flash('success', 'Delivery boy verified');
    res.json({ success: true });
  } catch (error) {
    console.error('Error verifying delivery boy:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reject delivery boy
router.post('/boys/:id/reject', isAdminAuth, async (req, res) => {
  try {
    const { reason } = req.body;

    const deliveryBoy = await DeliveryBoy.findByIdAndUpdate(
      req.params.id,
      {
        verificationStatus: 'Rejected'
      },
      { new: true }
    );

    if (req.admin) {
      await req.admin.logActivity(
        'REJECT_DELIVERY_BOY',
        `Rejected delivery boy ${deliveryBoy.fullName}: ${reason}`,
        'delivery_boy',
        deliveryBoy._id
      );
    }

    req.flash('success', 'Delivery boy rejected');
    res.json({ success: true });
  } catch (error) {
    console.error('Error rejecting delivery boy:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// List deliveries
router.get('/assignments', isAdminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const status = req.query.status || 'all';

    let query = {};
    if (status !== 'all') {
      query.status = status;
    }

    const assignments = await DeliveryAssignment.find(query)
      .populate('order')
      .populate('deliveryBoy')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await DeliveryAssignment.countDocuments(query);

    res.render('admin/delivery/assignments', {
      title: 'Delivery Assignments',
      assignments,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      status
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    req.flash('error', error.message);
    res.redirect('/admin/dashboard');
  }
});

module.exports = router;
