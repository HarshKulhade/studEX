'use strict';

const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter.
 * Applied to all /api routes: 100 requests per 15 minutes per IP.
 */
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  standardHeaders: true,   // Return RateLimit-* headers
  legacyHeaders: false,     // Disable X-RateLimit-* headers
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again in 15 minutes.',
  },
  skipSuccessfulRequests: false,
});

/**
 * Strict auth rate limiter.
 * Applied to authentication endpoints: 10 requests per 15 minutes per IP.
 * Prevents brute-force login and OTP attacks.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes (fixed — not env-configurable for security)
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
  skipSuccessfulRequests: false,
});

/**
 * OTP-specific limiter — even stricter.
 * 5 OTP send/verify attempts per 15 minutes per IP.
 */
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP requests. Please wait 15 minutes before trying again.',
  },
});

module.exports = { generalLimiter, authLimiter, otpLimiter };
