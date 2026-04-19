'use strict';

const express = require('express');
const { body, query } = require('express-validator');

const router = express.Router();
const {
  getNearbyDeals,
  getDealById,
  createDeal,
  updateDeal,
  deleteDeal,
  getMyDeals,
} = require('../controllers/deal.controller');
const { protectStudent, protectVendor } = require('../middleware/auth');
const validate = require('../middleware/validate');

// ── Student deal routes ────────────────────────────

// GET /api/deals/nearby   — must come BEFORE /:id to avoid conflict
router.get(
  '/nearby',
  protectStudent,
  [
    query('lat').notEmpty().withMessage('lat is required').isFloat().withMessage('lat must be a number'),
    query('lng').notEmpty().withMessage('lng is required').isFloat().withMessage('lng must be a number'),
    query('radius').optional().isInt({ min: 100, max: 50000 }).withMessage('radius must be between 100 and 50000 metres'),
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be between 1 and 50'),
  ],
  validate,
  getNearbyDeals
);

// GET /api/deals/vendor/my-deals  — must come BEFORE /:id
router.get('/vendor/my-deals', protectVendor, getMyDeals);

// GET /api/deals/:id
router.get('/:id', protectStudent, getDealById);

// ── Vendor deal routes ─────────────────────────────

const createDealValidator = [
  body('title')
    .trim()
    .notEmpty().withMessage('Deal title is required')
    .isLength({ max: 100 }).withMessage('Title cannot exceed 100 characters'),

  body('discountType')
    .isIn(['percentage', 'flat']).withMessage('discountType must be "percentage" or "flat"'),

  body('discountValue')
    .isFloat({ min: 1 }).withMessage('discountValue must be at least 1')
    .custom((value, { req }) => {
      if (req.body.discountType === 'percentage' && parseFloat(value) > 100) {
        throw new Error('Percentage discount cannot exceed 100');
      }
      return true;
    }),

  body('cashbackAmount')
    .isFloat({ min: 0 }).withMessage('cashbackAmount must be zero or positive'),

  body('validFrom')
    .isISO8601().withMessage('validFrom must be a valid ISO 8601 date'),

  body('validUntil')
    .isISO8601().withMessage('validUntil must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.validFrom)) {
        throw new Error('validUntil must be after validFrom');
      }
      return true;
    }),

  body('totalQuantity')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('totalQuantity must be a positive integer'),
];

// POST /api/deals
router.post('/', protectVendor, createDealValidator, validate, createDeal);

// PUT /api/deals/:id
router.put('/:id', protectVendor, createDealValidator, validate, updateDeal);

// DELETE /api/deals/:id
router.delete('/:id', protectVendor, deleteDeal);

module.exports = router;
