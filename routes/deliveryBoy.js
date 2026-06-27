const { Router } = require('express');
const DeliveryBoy = require('../models/DeliveryBoy');
const { loginLimiter } = require('../middlewares/rateLimiting');
const { validateEmail, validatePassword, sanitizeInput } = require('../middlewares/validation');
const router = Router();

const isDeliveryBoyAuth = (req, res, next) => {
  const { verifyToken } = require('../services/authentication');
  const token = req.cookies['token'];

  if (!token) {
    req.flash('error', 'Please login as delivery boy');
    return res.redirect('/delivery/signin');
  }

  try {
    const decoded = verifyToken(token);
    if (!decoded || !decoded._id) {
      throw new Error('Invalid token');
    }
    req.deliveryBoy = decoded;
    next();
  } catch (error) {
    res.clearCookie('token', { path: '/' });
    req.flash('error', 'Session expired. Please login again');
    res.redirect('/delivery/signin');
  }
};

// Signin page
router.get('/signin', (req, res) => {
  if (req.cookies['token']) {
    return res.redirect('/delivery/dashboard');
  }
  res.render('delivery/signin', { title: 'Delivery Boy Login' });
});

// Signin
router.post('/signin', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!validateEmail(email)) {
      req.flash('error', 'Invalid email');
      return res.redirect('/delivery/signin');
    }

    const token = await DeliveryBoy.matchPassword(email, password);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    req.flash('success', 'Login successful');
    res.redirect('/delivery/dashboard');
  } catch (error) {
    req.flash('error', error.message);
    res.redirect('/delivery/signin');
  }
});

// Signup page
router.get('/signup', (req, res) => {
  res.render('delivery/signup', { title: 'Delivery Boy Registration' });
});

// Signup
router.post('/signup', async (req, res) => {
  try {
    const { fullName, email, phone, password, confirmPassword, city, state } = req.body;

    if (!validateEmail(email)) {
      req.flash('error', 'Invalid email');
      return res.redirect('/delivery/signup');
    }

    if (!validatePassword(password)) {
      req.flash('error', 'Password must be at least 6 characters');
      return res.redirect('/delivery/signup');
    }

    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match');
      return res.redirect('/delivery/signup');
    }

    const existing = await DeliveryBoy.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      req.flash('error', 'Email or phone already registered');
      return res.redirect('/delivery/signup');
    }

    const deliveryBoy = await DeliveryBoy.create({
      fullName: sanitizeInput(fullName),
      email: email.toLowerCase(),
      phone: sanitizeInput(phone),
      password,
      city: sanitizeInput(city),
      state: sanitizeInput(state),
      verificationStatus: 'Pending'
    });

    const token = await DeliveryBoy.matchPassword(email, password);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    req.flash('success', 'Registered successfully. Please complete verification.');
    res.redirect('/delivery/pending-verification');
  } catch (error) {
    console.error('Signup error:', error);
    req.flash('error', error.message);
    res.redirect('/delivery/signup');
  }
});

// Dashboard
router.get('/dashboard', isDeliveryBoyAuth, async (req, res) => {
  try {
    const deliveryBoy = await DeliveryBoy.findById(req.deliveryBoy._id);

    res.render('delivery/dashboard', {
      title: 'Dashboard',
      deliveryBoy
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    req.flash('error', error.message);
    res.redirect('/delivery/signin');
  }
});

// Logout
router.get('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  req.flash('success', 'Logged out successfully');
  res.redirect('/delivery/signin');
});

module.exports = router;
