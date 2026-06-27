const { Router } = require('express');
const Order = require('../models/Order');
const DeliveryAssignment = require('../models/DeliveryAssignment');
const { isSellerAuth } = require('../middlewares/isSellerAuth');
const router = Router();

// Get seller's orders
router.get('/', isSellerAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ seller: req.seller._id })
      .populate('customer')
      .populate('products.product')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments({ seller: req.seller._id });

    res.render('seller/orders/list', {
      title: 'Orders',
      orders,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    req.flash('error', error.message);
    res.redirect('/seller/dashboard');
  }
});

// View order details
router.get('/:id', isSellerAuth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      seller: req.seller._id
    })
      .populate('customer')
      .populate('products.product')
      .populate('delivery');

    if (!order) return res.status(404).render('404');

    const delivery = await DeliveryAssignment.findOne({ order: order._id })
      .populate('deliveryBoy');

    res.render('seller/orders/detail', {
      title: 'Order Details',
      order,
      delivery
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    req.flash('error', error.message);
    res.redirect('/seller/orders');
  }
});

// Update order status
router.post('/:id/status', isSellerAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, seller: req.seller._id },
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    req.flash('success', 'Order status updated');
    res.json({ success: true, order });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cancel order
router.post('/:id/cancel', isSellerAuth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      seller: req.seller._id
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status === 'shipped' || order.status === 'delivered') {
      return res.status(400).json({ success: false, message: 'Cannot cancel shipped/delivered order' });
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    await order.save();

    req.flash('success', 'Order cancelled successfully');
    res.json({ success: true });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Export invoice
router.get('/:id/invoice', isSellerAuth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      seller: req.seller._id
    })
      .populate('customer')
      .populate('products.product');

    if (!order) return res.status(404).render('404');

    res.render('seller/orders/invoice', {
      title: 'Invoice',
      order,
      layout: false
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    req.flash('error', error.message);
    res.redirect('/seller/orders');
  }
});

module.exports = router;
