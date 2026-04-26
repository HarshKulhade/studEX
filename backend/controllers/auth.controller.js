'use strict';

const bcrypt = require('bcryptjs');
const { admin } = require('../config/firebase');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const CashbackWallet = require('../models/CashbackWallet');
const Transaction = require('../models/Transaction');
const ApiResponse = require('../utils/ApiResponse');
const { generateVendorToken } = require('../utils/generateToken');
const { sendVendorRegistrationAlert, sendOTPEmail, generateOTP } = require('../utils/sendEmail');

// ── Helpers ────────────────────────────────────────

/** Credit cashback to a student's wallet and record the transaction. */
const creditReferralCashback = async (referrerId, amount, referenceId) => {
  let wallet = await CashbackWallet.findOne({ student: referrerId });
  if (!wallet) {
    wallet = await CashbackWallet.create({ student: referrerId });
  }
  wallet.balance += amount;
  wallet.totalEarned += amount;
  await CashbackWallet.save(wallet);

  await Transaction.create({
    wallet: wallet._id,
    student: referrerId,
    type: 'credit',
    amount,
    source: 'referral',
    referenceId,
    description: `Referral bonus of ₹${amount} credited`,
  });
};

// ─────────────────────────────────────────────────
//  STUDENT AUTH
// ─────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Register a new student by verifying Firebase ID Token and creating a Firestore profile.
 */
const registerStudent = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.error(res, 401, 'No Firebase token provided.');
    }
    const token = authHeader.split(' ')[1];

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (err) {
      return ApiResponse.error(res, 401, 'Invalid Firebase token.');
    }

    const { name, phone, college, referralCode } = req.body;

    // Check for existing user by Firebase UID
    let user = await User.findByFirebaseUid(decodedToken.uid);
    if (user) {
      return ApiResponse.success(res, 200, 'User already registered. Logging in.', {
        userId: user._id,
        email: user.email,
        isVerified: user.isVerified,
      });
    }

    // Check if email or phone already taken
    const existingByEmail = await User.findByEmail(decodedToken.email);
    const existingByPhone = phone ? await User.findByPhone(phone) : null;
    if (existingByEmail || existingByPhone) {
      return ApiResponse.error(res, 409, 'An account with this email/phone already exists in the system.');
    }

    let referrer = null;
    if (referralCode) {
      referrer = await User.findByReferralCode(referralCode);
    }

    user = await User.create({
      firebaseUid: decodedToken.uid,
      name,
      email: decodedToken.email,
      phone,
      college,
      referredBy: referrer ? referrer._id : null,
      isVerified: decodedToken.email_verified || false,
      emailVerified: false,
    });

    return ApiResponse.success(res, 201, 'Registration successful.', {
      userId: user._id,
      email: user.email,
      isVerified: user.isVerified,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 * Student login. Uses Firebase token.
 */
const loginStudent = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.error(res, 401, 'No Firebase token provided.');
    }
    const token = authHeader.split(' ')[1];

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (err) {
      return ApiResponse.error(res, 401, 'Invalid Firebase token.');
    }

    const user = await User.findByFirebaseUid(decodedToken.uid);
    if (!user) {
      return ApiResponse.error(res, 404, 'No account found. Please register.');
    }

    // Sync isVerified from Firebase
    if (decodedToken.email_verified && !user.isVerified) {
      await User.findByIdAndUpdate(user._id, { isVerified: true });
      user.isVerified = true;
    }

    // Auto-migrate existing users: if emailVerified field doesn't exist yet,
    // treat them as verified so they aren't locked out after this feature is added
    if (user.emailVerified === undefined || user.emailVerified === null) {
      await User.findByIdAndUpdate(user._id, { emailVerified: true });
      user.emailVerified = true;
    }

    return ApiResponse.success(res, 200, 'Login successful', {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        college: user.college,
        phone: user.phone,
        isVerified: user.isVerified,
        emailVerified: user.emailVerified || false,
        verificationStatus: user.verificationStatus,
        referralCode: user.referralCode,
        ambassadorTier: user.ambassadorTier,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  VENDOR AUTH
// ─────────────────────────────────────────────────

/**
 * POST /api/auth/vendor/register
 */
const registerVendor = async (req, res, next) => {
  try {
    const { ownerName, businessName, email, phone, password, category, address, lng, lat } = req.body;

    const existingByEmail = await Vendor.findByEmail(email);
    const existingByPhone = await Vendor.findByPhone(phone);
    if (existingByEmail || existingByPhone) {
      return ApiResponse.error(
        res,
        409,
        existingByEmail
          ? 'A vendor account with this email already exists.'
          : 'A vendor account with this phone number already exists.'
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const coordinates = [parseFloat(lng) || 0, parseFloat(lat) || 0];

    const vendor = await Vendor.create({
      ownerName,
      businessName,
      email,
      phone,
      passwordHash,
      category,
      address,
      location: { type: 'Point', coordinates },
    });

    // Notify admin (non-blocking)
    const adminEmail = process.env.EMAIL_USER;
    if (adminEmail) {
      try {
        await sendVendorRegistrationAlert(adminEmail, { businessName, ownerName, email, phone });
      } catch (_err) {
        // Non-critical
      }
    }

    return ApiResponse.success(
      res,
      201,
      'Vendor registration submitted. Your account will be reviewed and approved within 24-48 hours.',
      { vendorId: vendor._id, businessName: vendor.businessName }
    );
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/vendor/login
 */
const loginVendor = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const vendor = await Vendor.findByEmail(email);
    if (!vendor) {
      return ApiResponse.error(res, 401, 'Invalid email or password.');
    }

    const isMatch = await bcrypt.compare(password, vendor.passwordHash);
    if (!isMatch) {
      return ApiResponse.error(res, 401, 'Invalid email or password.');
    }

    if (!vendor.isApproved) {
      return ApiResponse.error(res, 403, 'Your account is pending admin approval. Please wait 24-48 hours.');
    }

    const token = generateVendorToken(vendor._id);

    return ApiResponse.success(res, 200, 'Vendor login successful', {
      token,
      vendor: {
        _id: vendor._id,
        businessName: vendor.businessName,
        ownerName: vendor.ownerName,
        email: vendor.email,
        category: vendor.category,
        isApproved: vendor.isApproved,
        listingTier: vendor.listingTier,
        rating: vendor.rating,
        logoUrl: vendor.logoUrl,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  PASSWORD RESET (students via Firebase Admin + OTP, vendors via bcrypt)
// ─────────────────────────────────────────────────

const forgotPassword = async (req, res, next) => {
  try {
    const { email, role } = req.body;

    if (role === 'vendor') {
      const account = await Vendor.findByEmail(email);
      if (!account) {
        // Don't reveal whether account exists
        return ApiResponse.success(res, 200, 'If an account with this email exists, a reset OTP has been sent.');
      }

      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await Vendor.findByIdAndUpdate(account._id, { otp, otpExpiry });
      await sendOTPEmail(email, otp, account.ownerName || 'Vendor');

      return ApiResponse.success(res, 200, 'If an account with this email exists, a reset OTP has been sent.');
    }

    // ── Student password reset ──
    const user = await User.findByEmail(email);
    if (!user) {
      return ApiResponse.error(res, 404, 'No account found with this email address.');
    }

    // Rate-limit: don't allow another OTP within 60 seconds
    if (user.resetOtpSentAt) {
      const sentAt = user.resetOtpSentAt instanceof Date
        ? user.resetOtpSentAt
        : user.resetOtpSentAt.toDate
          ? user.resetOtpSentAt.toDate()
          : new Date(user.resetOtpSentAt);
      const secondsSinceLast = (Date.now() - sentAt.getTime()) / 1000;
      if (secondsSinceLast < 60) {
        return ApiResponse.error(res, 429, `Please wait ${Math.ceil(60 - secondsSinceLast)} seconds before requesting a new OTP.`);
      }
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await User.findByIdAndUpdate(user._id, {
      resetOtp: otp,
      resetOtpExpiry: otpExpiry,
      resetOtpSentAt: new Date(),
    });

    await sendOTPEmail(email, otp, user.name || 'Student');

    return ApiResponse.success(res, 200, 'If an account with this email exists, a reset OTP has been sent.', {
      email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
    });
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword, role } = req.body;

    if (role === 'vendor') {
      const account = await Vendor.findByEmail(email);
      if (!account) {
        return ApiResponse.error(res, 404, 'No account found with this email address.');
      }

      if (!account.otp || account.otp !== otp) {
        return ApiResponse.error(res, 400, 'Invalid OTP.');
      }

      const otpExpiry = account.otpExpiry instanceof Date ? account.otpExpiry : account.otpExpiry.toDate();
      if (new Date() > otpExpiry) {
        return ApiResponse.error(res, 400, 'OTP has expired. Please request a new one.');
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await Vendor.findByIdAndUpdate(account._id, { passwordHash, otp: null, otpExpiry: null });

      return ApiResponse.success(res, 200, 'Password reset successful. Please log in with your new password.');
    }

    // ── Student password reset ──
    const user = await User.findByEmail(email);
    if (!user) {
      return ApiResponse.error(res, 404, 'No account found with this email address.');
    }

    if (!user.resetOtp || user.resetOtp !== otp.trim()) {
      return ApiResponse.error(res, 400, 'Invalid OTP. Please check and try again.');
    }

    // Check expiry
    const expiry = user.resetOtpExpiry instanceof Date
      ? user.resetOtpExpiry
      : user.resetOtpExpiry.toDate
        ? user.resetOtpExpiry.toDate()
        : new Date(user.resetOtpExpiry);

    if (new Date() > expiry) {
      return ApiResponse.error(res, 400, 'OTP has expired. Please request a new one.');
    }

    // Update password in Firebase Auth
    await admin.auth().updateUser(user.firebaseUid, { password: newPassword });

    // Clear OTP fields
    await User.findByIdAndUpdate(user._id, {
      resetOtp: null,
      resetOtpExpiry: null,
      resetOtpSentAt: null,
    });

    return ApiResponse.success(res, 200, 'Password reset successful. Please log in with your new password.');
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  STUDENT EMAIL OTP VERIFICATION
// ─────────────────────────────────────────────────

/**
 * POST /api/auth/send-otp
 * Send a 6-digit OTP to the authenticated student's email.
 */
const sendEmailOTP = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.error(res, 401, 'No Firebase token provided.');
    }
    const token = authHeader.split(' ')[1];

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (err) {
      return ApiResponse.error(res, 401, 'Invalid Firebase token.');
    }

    const user = await User.findByFirebaseUid(decodedToken.uid);
    if (!user) {
      return ApiResponse.error(res, 404, 'No account found. Please register first.');
    }

    if (user.emailVerified) {
      return ApiResponse.success(res, 200, 'Email already verified.');
    }

    // Rate-limit: don't allow sending another OTP within 60 seconds
    if (user.emailOtpSentAt) {
      const sentAt = user.emailOtpSentAt instanceof Date
        ? user.emailOtpSentAt
        : user.emailOtpSentAt.toDate
          ? user.emailOtpSentAt.toDate()
          : new Date(user.emailOtpSentAt);
      const secondsSinceLast = (Date.now() - sentAt.getTime()) / 1000;
      if (secondsSinceLast < 60) {
        return ApiResponse.error(res, 429, `Please wait ${Math.ceil(60 - secondsSinceLast)} seconds before requesting a new OTP.`);
      }
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await User.findByIdAndUpdate(user._id, {
      emailOtp: otp,
      emailOtpExpiry: otpExpiry,
      emailOtpSentAt: new Date(),
    });

    await sendOTPEmail(user.email, otp, user.name || 'Student');

    return ApiResponse.success(res, 200, 'OTP sent to your email address.', {
      email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // mask email
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/verify-otp
 * Verify the 6-digit OTP and mark email as verified.
 */
const verifyEmailOTP = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.error(res, 401, 'No Firebase token provided.');
    }
    const token = authHeader.split(' ')[1];

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (err) {
      return ApiResponse.error(res, 401, 'Invalid Firebase token.');
    }

    const { otp } = req.body;
    if (!otp) {
      return ApiResponse.error(res, 400, 'OTP is required.');
    }

    const user = await User.findByFirebaseUid(decodedToken.uid);
    if (!user) {
      return ApiResponse.error(res, 404, 'No account found.');
    }

    if (user.emailVerified) {
      return ApiResponse.success(res, 200, 'Email already verified.');
    }

    if (!user.emailOtp || user.emailOtp !== otp.trim()) {
      return ApiResponse.error(res, 400, 'Invalid OTP. Please check and try again.');
    }

    // Check expiry
    const expiry = user.emailOtpExpiry instanceof Date
      ? user.emailOtpExpiry
      : user.emailOtpExpiry.toDate
        ? user.emailOtpExpiry.toDate()
        : new Date(user.emailOtpExpiry);

    if (new Date() > expiry) {
      return ApiResponse.error(res, 400, 'OTP has expired. Please request a new one.');
    }

    // Mark email as verified and clear OTP fields
    await User.findByIdAndUpdate(user._id, {
      emailVerified: true,
      emailOtp: null,
      emailOtpExpiry: null,
      emailOtpSentAt: null,
    });

    return ApiResponse.success(res, 200, 'Email verified successfully!');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/verify-reset-otp
 * Verify the reset OTP is correct without actually resetting the password.
 */
const verifyResetOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findByEmail(email);
    if (!user) {
      return ApiResponse.error(res, 404, 'No account found with this email address.');
    }

    if (!user.resetOtp || user.resetOtp !== otp.trim()) {
      return ApiResponse.error(res, 400, 'Invalid OTP. Please check and try again.');
    }

    // Check expiry
    const expiry = user.resetOtpExpiry instanceof Date
      ? user.resetOtpExpiry
      : user.resetOtpExpiry.toDate
        ? user.resetOtpExpiry.toDate()
        : new Date(user.resetOtpExpiry);

    if (new Date() > expiry) {
      return ApiResponse.error(res, 400, 'OTP has expired. Please request a new one.');
    }

    return ApiResponse.success(res, 200, 'OTP verified successfully.');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  registerStudent,
  loginStudent,
  registerVendor,
  loginVendor,
  forgotPassword,
  resetPassword,
  verifyResetOTP,
  sendEmailOTP,
  verifyEmailOTP,
};
