'use strict';

const jwt = require('jsonwebtoken');

/**
 * Generate a signed JWT token.
 *
 * @param {Object} payload  - Data to encode (e.g. { userId, role })
 * @param {string} [expiresIn] - Override default expiry (uses JWT_EXPIRE env)
 * @returns {string} signed JWT string
 */
const generateToken = (payload, expiresIn = process.env.JWT_EXPIRE || '7d') => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

/**
 * Generate a student JWT.
 * @param {string} userId - MongoDB ObjectId as string
 * @returns {string}
 */
const generateStudentToken = (userId) =>
  generateToken({ userId: userId.toString(), role: 'student' });

/**
 * Generate a vendor JWT.
 * @param {string} vendorId - MongoDB ObjectId as string
 * @returns {string}
 */
const generateVendorToken = (vendorId) =>
  generateToken({ vendorId: vendorId.toString(), role: 'vendor' });

module.exports = { generateToken, generateStudentToken, generateVendorToken };
