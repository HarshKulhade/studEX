'use strict';

/**
 * Admin middleware — only allows the hardcoded admin Firebase UID.
 * Verifies the Firebase ID token and checks the email matches the admin account.
 */

const { admin } = require('../config/firebase');
const ApiResponse = require('../utils/ApiResponse');

const ADMIN_EMAIL = 'harshkulhade95@gmail.com';

const protectAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.error(res, 401, 'Admin token required.');
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch {
      return ApiResponse.error(res, 401, 'Invalid or expired admin token.');
    }

    if (decoded.email !== ADMIN_EMAIL) {
      return ApiResponse.error(res, 403, 'Access denied. Not an admin.');
    }

    req.admin = { uid: decoded.uid, email: decoded.email };
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { protectAdmin };
