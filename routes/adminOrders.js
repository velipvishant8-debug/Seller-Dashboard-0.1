const { Router } = require('express');
const { isAdminAuth } = require('../middlewares/isSellerAuth');
const Order = require('../models/Order');
const DeliveryAssignment = require('../models/DeliveryAssignment');
const router = Router();

// List all orders
router.get('/', isAdminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const status = req.query.status || 'all';

    let query = {};
    if (status !== 'all') {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('seller')
      .populate('customer')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments(query);

    res.render('admin/orders/list', {
      title: 'Manage Orders',
      orders,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      status
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    req.flash('error', error.message);
    res.redirect('/admin/dashboard');
  }
});

// Order details
router.get('/:id', isAdminAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('seller')
      .populate('customer')
      .populate('products.product');

    if (!order) return res.status(404).render('404');

    const delivery = await DeliveryAssignment.findOne({ order: order._id })
      .populate('deliveryBoy');

    res.render('admin/orders/detail', {
      title: 'Order Details',
      order,
      delivery
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    req.flash('error', error.message);
    res.redirect('/admin/orders');
  }
});

// Assign delivery
router.post('/:id/assign-delivery', isAdminAuth, async (req, res) => {
  try {
    const { deliveryBoyId } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const delivery = await DeliveryAssignment.findOneAndUpdate(
      { order: order._id },
      { deliveryBoy: deliveryBoyId, status: 'assigned' },
      { new: true, upsert: true }
    );

    res.json({ success: true, delivery });
  } catch (error) {
    console.error('Error assigning delivery:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
