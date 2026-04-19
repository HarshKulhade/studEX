'use strict';

const express = require('express');
const { body } = require('express-validator');

const router = express.Router();
const {
  getProfile,
  updateProfile,
  getDashboard,
  getRedemptions,
  scanQR,
} = require('../controllers/vendor.controller');
const { protectVendor } = require('../middleware/auth');
const validate = require('../middleware/validate');

// All vendor routes require vendor JWT — applied per-route so the router
// can also be extended later with public-facing vendor profile routes.

// GET /api/vendor/profile
router.get('/profile', protectVendor, getProfile);

// PUT /api/vendor/profile
// updateProfile is [multerMiddleware, asyncHandler] — spread it
router.put('/profile', protectVendor, ...updateProfile);

// GET /api/vendor/dashboard
router.get('/dashboard', protectVendor, getDashboard);

// GET /api/vendor/redemptions
router.get(
  '/redemptions',
  protectVendor,
  [
    // Express-validator for query params
    // None strictly required, but we validate optional status filter
  ],
  getRedemptions
);

// POST /api/vendor/scan-qr
router.post(
  '/scan-qr',
  protectVendor,
  [
    body('qrToken')
      .notEmpty().withMessage('qrToken is required')
      .isString().withMessage('qrToken must be a string'),
  ],
  validate,
  scanQR
);

module.exports = router;
