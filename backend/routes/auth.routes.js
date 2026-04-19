'use strict';

const express = require('express');
const { body } = require('express-validator');

const router = express.Router();
const {
  registerStudent,
  loginStudent,
  registerVendor,
  loginVendor,
  forgotPassword,
  resetPassword,
} = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');

// ── Validation chains ──────────────────────────────

const studentRegisterValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),

  body('phone')
    .optional({ values: 'falsy' })
    .isMobilePhone('en-IN').withMessage('Please enter a valid Indian mobile number')
    .isLength({ min: 10, max: 10 }).withMessage('Phone must be exactly 10 digits'),

  body('college')
    .trim()
    .notEmpty().withMessage('College name is required'),

  body('referralCode')
    .optional()
    .trim()
    .isLength({ min: 8, max: 8 }).withMessage('Referral code must be exactly 8 characters')
    .toUpperCase(),
];

const vendorRegisterValidator = [
  body('ownerName').trim().notEmpty().withMessage('Owner name is required'),
  body('businessName').trim().notEmpty().withMessage('Business name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phone')
    .isMobilePhone('en-IN').withMessage('Must be a valid Indian phone number')
    .isLength({ min: 10, max: 10 }).withMessage('Phone must be exactly 10 digits'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a digit'),
  body('address').trim().notEmpty().withMessage('Business address is required'),
  body('lng')
    .notEmpty().withMessage('Longitude is required')
    .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  body('lat')
    .notEmpty().withMessage('Latitude is required')
    .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
];

const forgotPasswordValidator = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('role')
    .optional()
    .isIn(['student', 'vendor']).withMessage('Role must be "student" or "vendor"'),
];

const resetPasswordValidator = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('otp')
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
    .isNumeric().withMessage('OTP must be numeric'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a digit'),
  body('role').optional().isIn(['student', 'vendor']),
];

const loginVendorValidator = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// ── Routes ─────────────────────────────────────────

// Student auth (Firebase handles email/password, we just register profile)
router.post('/register', authLimiter, studentRegisterValidator, validate, registerStudent);
router.post('/login', authLimiter, loginStudent);

// Vendor auth (JWT-based)
router.post('/vendor/register', authLimiter, vendorRegisterValidator, validate, registerVendor);
router.post('/vendor/login', authLimiter, loginVendorValidator, validate, loginVendor);

// Password reset (vendor only; students use Firebase password reset)
router.post('/forgot-password', otpLimiter, forgotPasswordValidator, validate, forgotPassword);
router.post('/reset-password', authLimiter, resetPasswordValidator, validate, resetPassword);

module.exports = router;
