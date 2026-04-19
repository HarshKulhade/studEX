'use strict';

const jwt = require('jsonwebtoken');
const { admin } = require('../config/firebase');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const ApiResponse = require('../utils/ApiResponse');

/**
 * Middleware: protectStudent
 * Verifies a Firebase ID token.
 * Attaches the full User document to req.user.
 */
const protectStudent = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.error(res, 401, 'No firebase token provided. Access denied.');
    }

    const token = authHeader.split(' ')[1];

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (err) {
      if (err.code === 'auth/id-token-expired') {
        return ApiResponse.error(res, 401, 'Firebase token expired. Please log in again.');
      }
      return ApiResponse.error(res, 401, 'Invalid Firebase token. Access denied.');
    }

    const user = await User.findByFirebaseUid(decodedToken.uid);

    if (!user) {
      return ApiResponse.error(res, 401, 'User belonging to this token has no Firestore profile.');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware: protectVendor
 * Verifies a Bearer JWT whose payload contains { vendorId, role: 'vendor' }.
 * Attaches the full Vendor document to req.vendor.
 */
const protectVendor = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.error(res, 401, 'No token provided. Access denied.');
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return ApiResponse.error(res, 401, 'Token expired. Please log in again.');
      }
      return ApiResponse.error(res, 401, 'Invalid token. Access denied.');
    }

    if (decoded.role !== 'vendor') {
      return ApiResponse.error(res, 403, 'Access denied. Vendors only.');
    }

    const vendor = await Vendor.findById(decoded.vendorId);

    if (!vendor) {
      return ApiResponse.error(res, 401, 'Vendor belonging to this token no longer exists.');
    }

    if (!vendor.isApproved) {
      return ApiResponse.error(
        res,
        403,
        'Your vendor account is pending approval. Please wait for admin verification.'
      );
    }

    // Strip sensitive fields
    const { passwordHash, otp, otpExpiry, ...safeVendor } = vendor;
    req.vendor = safeVendor;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { protectStudent, protectVendor };
