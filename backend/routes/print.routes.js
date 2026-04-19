'use strict';

const express = require('express');
const { body, param } = require('express-validator');

const router = express.Router();
const {
  uploadDocument,
  bookPrintJob,
  getMyPrintJobs,
  getKiosks,
  updatePrintJobStatus,
} = require('../controllers/print.controller');
const { protectVendor } = require('../middleware/auth');
const validate = require('../middleware/validate');

// All routes in this file are already protected by protectStudent in server.js,
// EXCEPT /api/print/:id/status which requires vendor auth.

// POST /api/print/upload  — must come BEFORE /book and /:id/status
// uploadDocument is [multerMiddleware, asyncHandler] — spread it
router.post('/upload', ...uploadDocument);

// GET /api/print/kiosks  — must come BEFORE /:id
router.get('/kiosks', getKiosks);

// GET /api/print/my-jobs
router.get('/my-jobs', getMyPrintJobs);

// POST /api/print/book
router.post(
  '/book',
  [
    body('fileUrl').notEmpty().withMessage('fileUrl is required').isURL().withMessage('fileUrl must be a valid URL'),
    body('fileName').trim().notEmpty().withMessage('fileName is required'),
    body('pageCount').isInt({ min: 1 }).withMessage('pageCount must be a positive integer'),
    body('printType').isIn(['bw', 'color']).withMessage('printType must be "bw" or "color"'),
    body('copies').optional().isInt({ min: 1, max: 50 }).withMessage('copies must be between 1 and 50'),
    body('paperSize')
      .optional()
      .isIn(['A4', 'A5', 'Legal']).withMessage('paperSize must be A4, A5, or Legal'),
    body('kioskId').notEmpty().withMessage('kioskId is required'),
    body('slotTime').optional().isISO8601().withMessage('slotTime must be a valid ISO 8601 datetime'),
  ],
  validate,
  bookPrintJob
);

// PUT /api/print/:id/status  — Vendor/kiosk operator only
router.put(
  '/:id/status',
  protectVendor,
  [
    param('id').isMongoId().withMessage('Invalid print job ID'),
    body('status')
      .notEmpty().withMessage('status is required')
      .isIn(['pending', 'queued', 'printing', 'completed', 'failed'])
      .withMessage('Invalid status value'),
  ],
  validate,
  updatePrintJobStatus
);

module.exports = router;
