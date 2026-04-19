'use strict';

const express = require('express');
const { body } = require('express-validator');

const router = express.Router();
const {
  getProfile,
  updateProfile,
  uploadCollegeId,
  uploadAvatar,
  getDashboard,
  getReferrals,
} = require('../controllers/student.controller');
const validate = require('../middleware/validate');

// All routes in this file are already protected at the server level
// by the protectStudent middleware applied in server.js

// GET /api/student/profile
router.get('/profile', getProfile);

// PUT /api/student/profile
router.put(
  '/profile',
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 }).withMessage('Name must be 2–50 characters'),

    body('phone')
      .optional()
      .isMobilePhone('en-IN').withMessage('Must be a valid Indian mobile number')
      .isLength({ min: 10, max: 10 }).withMessage('Phone must be 10 digits'),

    body('college')
      .optional()
      .trim()
      .notEmpty().withMessage('College name cannot be empty'),

    body('lng')
      .optional()
      .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),

    body('lat')
      .optional()
      .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  ],
  validate,
  updateProfile
);

// POST /api/student/upload-college-id
// uploadCollegeId is an array [multerMiddleware, asyncHandler] — spread it
router.post('/upload-college-id', ...uploadCollegeId);

// POST /api/student/upload-avatar
router.post('/upload-avatar', ...uploadAvatar);

// GET /api/student/dashboard
router.get('/dashboard', getDashboard);

// GET /api/student/referrals
router.get('/referrals', getReferrals);

module.exports = router;
