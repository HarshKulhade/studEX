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
 * Applied to authentication endpoints.
 * Only FAILED attempts count — successful logins are not penalised.
 * Prevents brute-force without locking out real users.
 */
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 10) || 5 * 60 * 1000, // 5 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many failed login attempts. Please try again in 5 minutes.',
  },
  skipSuccessfulRequests: true, // only failed (4xx/5xx) responses count against the limit
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
