const { Router } = require('express');
const DeliveryAssignment = require('../models/DeliveryAssignment');
const Order = require('../models/Order');
const { verifyToken } = require('../services/authentication');
const router = Router();

const isDeliveryAuth = (req, res, next) => {
  const token = req.cookies['token'];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  try {
    const decoded = verifyToken(token);
    req.deliveryBoy = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Get my orders
router.get('/', isDeliveryAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const status = req.query.status || 'all';

    let query = { deliveryBoy: req.deliveryBoy._id };
    if (status !== 'all') {
      query.status = status;
    }

    const assignments = await DeliveryAssignment.find(query)
      .populate('order')
      .populate('seller')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await DeliveryAssignment.countDocuments(query);

    res.render('delivery/orders', {
      title: 'My Deliveries',
      assignments,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      status
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    req.flash('error', error.message);
    res.redirect('/delivery/dashboard');
  }
});

// Get order details
router.get('/:id', isDeliveryAuth, async (req, res) => {
  try {
    const assignment = await DeliveryAssignment.findOne({
      _id: req.params.id,
      deliveryBoy: req.deliveryBoy._id
    })
      .populate('order')
      .populate('seller');

    if (!assignment) return res.status(404).render('404');

    res.render('delivery/order-detail', {
      title: 'Delivery Details',
      assignment
    });
  } catch (error) {
    console.error('Error fetching assignment:', error);
    req.flash('error', error.message);
    res.redirect('/delivery/orders');
  }
});

// Update order status
router.post('/:id/status', isDeliveryAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['picked_up', 'in_transit', 'delivered', 'failed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const assignment = await DeliveryAssignment.findOneAndUpdate(
      { _id: req.params.id, deliveryBoy: req.deliveryBoy._id },
      { status },
      { new: true }
    );

    if (!assignment) return res.status(404).json({ success: false, message: 'Not found' });

    res.json({ success: true, assignment });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Submit delivery proof
router.post('/:id/proof', isDeliveryAuth, async (req, res) => {
  try {
    const { recipientName, recipientPhone, notes, signature } = req.body;
    const proofPhoto = req.files?.proof?.[0]?.path;

    const assignment = await DeliveryAssignment.findOneAndUpdate(
      { _id: req.params.id, deliveryBoy: req.deliveryBoy._id },
      {
        status: 'delivered',
        deliveredAt: new Date(),
        deliveryProof: {
          recipientName,
          recipientPhone,
          notes,
          photo: proofPhoto || '',
          signature: signature || ''
        }
      },
      { new: true }
    );

    if (!assignment) return res.status(404).json({ success: false, message: 'Not found' });

    res.json({ success: true, assignment });
  } catch (error) {
    console.error('Error submitting proof:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update location
router.post('/:id/location', isDeliveryAuth, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    const assignment = await DeliveryAssignment.findOneAndUpdate(
      { _id: req.params.id, deliveryBoy: req.deliveryBoy._id },
      {
        currentLocation: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $push: {
          locationUpdates: {
            latitude,
            longitude,
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    if (!assignment) return res.status(404).json({ success: false, message: 'Not found' });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
