'use strict';

const express = require('express');
const { body } = require('express-validator');

const router = express.Router();
const {
  generateRedemption,
  getMyRedemptions,
  getRedemptionById,
  payVendor,
} = require('../controllers/redemption.controller');
const validate = require('../middleware/validate');

// All routes in this file are already protected at server.js level
// by the protectStudent middleware.

// POST /api/redemptions/pay
router.post('/pay', payVendor);

// POST /api/redemptions/generate
router.post(
  '/generate',
  [
    body('dealId')
      .notEmpty().withMessage('dealId is required')
      .isMongoId().withMessage('dealId must be a valid MongoDB ObjectId'),
  ],
  validate,
  generateRedemption
);

// GET /api/redemptions/my  — must come BEFORE /:id
router.get('/my', getMyRedemptions);

// GET /api/redemptions/:id
router.get('/:id', getRedemptionById);

module.exports = router;
