'use strict';

const express = require('express');
const { body } = require('express-validator');

const router = express.Router();
const {
  getWallet,
  getTransactions,
  withdrawFromWallet,
  setUpiId,
  createRazorpayOrder,
  verifyRazorpayPayment,
} = require('../controllers/wallet.controller');
const validate = require('../middleware/validate');

// All routes are protected by protectStudent in server.js

// GET /api/wallet
router.get('/', getWallet);

// GET /api/wallet/transactions
router.get('/transactions', getTransactions);

// POST /api/wallet/withdraw
router.post(
  '/withdraw',
  [
    body('amount')
      .notEmpty().withMessage('amount is required')
      .isFloat({ min: 10 }).withMessage('Minimum withdrawal amount is ₹10'),

    body('upiId')
      .notEmpty().withMessage('UPI ID is required')
      .matches(/^[\w.\-]{3,}@[a-zA-Z]{3,}$/)
      .withMessage('Invalid UPI ID format. Example: yourname@upi'),
  ],
  validate,
  withdrawFromWallet
);

// POST /api/wallet/set-upi
router.post(
  '/set-upi',
  [
    body('upiId')
      .notEmpty().withMessage('UPI ID is required')
      .matches(/^[\w.\-]{3,}@[a-zA-Z]{3,}$/)
      .withMessage('Invalid UPI ID format. Example: yourname@upi'),
  ],
  validate,
  setUpiId
);
// POST /api/wallet/create-razorpay-order
router.post(
  '/create-razorpay-order',
  [
    body('amount').notEmpty().withMessage('amount is required').isFloat({ min: 10 }).withMessage('Minimum top-up is ₹10'),
  ],
  validate,
  createRazorpayOrder
);

// POST /api/wallet/verify-payment
router.post(
  '/verify-payment',
  [
    body('razorpay_order_id').notEmpty(),
    body('razorpay_payment_id').notEmpty(),
    body('razorpay_signature').notEmpty(),
    body('amount').notEmpty(),
  ],
  validate,
  verifyRazorpayPayment
);

module.exports = router;
