const { Router } = require('express');
const { isAdminAuth } = require('../middlewares/isSellerAuth');
const Seller = require('../models/Seller');
const Order = require('../models/Order');
const Admin = require('../models/Admin');
const DeliveryBoy = require('../models/DeliveryBoy');
const Wallet = require('../models/Wallet');
const router = Router();

// Dashboard home
router.get('/', isAdminAuth, async (req, res) => {
  try {
    const stats = await Promise.all([
      Seller.countDocuments({ isDeleted: false }),
      Order.countDocuments({}),
      Order.countDocuments({ status: 'delivered' }),
      Order.aggregate([
        { $match: { status: 'delivered' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      DeliveryBoy.countDocuments({ verificationStatus: 'Verified' }),
      Admin.countDocuments({ isDeleted: false })
    ]);

    const recentOrders = await Order.find({})
      .populate('seller')
      .sort({ createdAt: -1 })
      .limit(10);

    const pendingSellers = await Seller.find({ verificationStatus: 'Pending' }).limit(5);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      stats: {
        totalSellers: stats[0],
        totalOrders: stats[1],
        deliveredOrders: stats[2],
        totalRevenue: stats[3][0]?.total || 0,
        activeDeliveryBoys: stats[4],
        totalAdmins: stats[5]
      },
      recentOrders,
      pendingSellers
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    req.flash('error', 'Failed to load dashboard');
    res.redirect('/admin');
  }
});

// Analytics
router.get('/analytics', isAdminAuth, async (req, res) => {
  try {
    const month = req.query.month || new Date().getMonth() + 1;
    const year = req.query.year || new Date().getFullYear();

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const dailyStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.render('admin/analytics', {
      title: 'Analytics',
      dailyStats,
      month,
      year
    });
  } catch (error) {
    console.error('Analytics error:', error);
    req.flash('error', 'Failed to load analytics');
    res.redirect('/admin/dashboard');
  }
});

module.exports = router;
