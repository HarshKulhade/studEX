'use strict';

const User = require('../models/User');
const CashbackWallet = require('../models/CashbackWallet');
const Redemption = require('../models/Redemption');
const PrintJob = require('../models/PrintJob');
const Deal = require('../models/Deal');
const Transaction = require('../models/Transaction');
const ApiResponse = require('../utils/ApiResponse');
const { collegeIdUploader, avatarUploader } = require('../config/cloudinary');
const { filterByRadius } = require('../utils/geoFilter');

// ─────────────────────────────────────────────────
//  GET /api/student/profile
// ─────────────────────────────────────────────────
const getProfile = async (req, res, next) => {
  try {
    const wallet = await CashbackWallet.findOne({ student: req.user._id });
    const profileWithWallet = {
      ...req.user,
      wallet: wallet ? { balance: wallet.balance, totalEarned: wallet.totalEarned } : { balance: 0, totalEarned: 0 }
    };
    return ApiResponse.success(res, 200, 'Profile fetched successfully', profileWithWallet);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  PUT /api/student/profile
// ─────────────────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const allowedUpdates = ['name', 'phone', 'college'];
    const updates = {};

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (req.body.lng && req.body.lat) {
      updates.location = {
        type: 'Point',
        coordinates: [parseFloat(req.body.lng), parseFloat(req.body.lat)],
      };
    }

    if (Object.keys(updates).length === 0) {
      return ApiResponse.error(res, 400, 'No valid fields provided for update.');
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates);

    return ApiResponse.success(res, 200, 'Profile updated successfully', user);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  POST /api/student/upload-college-id
// ─────────────────────────────────────────────────
const uploadCollegeId = [
  collegeIdUploader.single('collegeId'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return ApiResponse.error(res, 400, 'No file uploaded. Please attach a college ID image.');
      }

      const fileUrl = req.file.path;

      const user = await User.findByIdAndUpdate(req.user._id, {
        collegeIdImageUrl: fileUrl,
        verificationStatus: 'pending',
      });

      return ApiResponse.success(
        res,
        200,
        'College ID uploaded. Your account is pending admin verification.',
        {
          collegeIdImageUrl: user.collegeIdImageUrl,
          verificationStatus: user.verificationStatus,
        }
      );
    } catch (err) {
      next(err);
    }
  },
];

// ─────────────────────────────────────────────────
//  POST /api/student/upload-avatar
// ─────────────────────────────────────────────────
const uploadAvatar = [
  avatarUploader.single('avatar'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return ApiResponse.error(res, 400, 'No file uploaded. Please attach an avatar image.');
      }
      const user = await User.findByIdAndUpdate(req.user._id, {
        avatarUrl: req.file.path,
      }, { new: true });
      return ApiResponse.success(res, 200, 'Avatar uploaded successfully.', { avatarUrl: user.avatarUrl });
    } catch (err) {
      next(err);
    }
  },
];

// ─────────────────────────────────────────────────
//  GET /api/student/dashboard
// ─────────────────────────────────────────────────
const getDashboard = async (req, res, next) => {
  try {
    const studentId = req.user._id;

    const [wallet, recentRedemptions, recentPrintJobs, recentTransactions] = await Promise.all([
      CashbackWallet.findOne({ student: studentId }),
      Redemption.find({ student: studentId }, { limit: 5 }),
      PrintJob.find({ student: studentId }, { limit: 5 }),
      Transaction.find({ student: studentId }, { limit: 10 }),
    ]);

    // Enrich redemptions with deal details
    const enrichedRedemptions = await Promise.all(
      recentRedemptions.map(async (r) => {
        let dealInfo = { shopName: 'Unknown Deal', offer: '' };
        if (r.deal) {
          try {
            const deal = await Deal.findById(r.deal);
            if (deal) {
              dealInfo = { shopName: deal.shopName || deal.title || 'Deal', offer: deal.offer || '' };
            }
          } catch (e) { /* ignore */ }
        }
        return { ...r, dealInfo };
      })
    );

    // Count active deals, falling back to all active deals if location is not set
    const activeDeals = await Deal.find({ isActive: true, validUntil: { $gt: new Date() } });
    let nearbyDealsCount = activeDeals.length; // Default to all if no location

    if (
      req.user.location &&
      req.user.location.coordinates &&
      req.user.location.coordinates[0] !== 0 &&
      req.user.location.coordinates[1] !== 0
    ) {
      const [userLng, userLat] = req.user.location.coordinates;
      const nearby = filterByRadius(
        activeDeals.map((d) => ({
          ...d,
          location: d.vendorLocation || { type: 'Point', coordinates: [0, 0] },
        })),
        userLat,
        userLng,
        2000 // 2km radius
      );
      // Fallback: If strict 2km filter yields 0 but we have active deals, show all active deals count 
      // so the dashboard doesn't confusingly say '0' while the Deals page shows active deals.
      if (nearby.length > 0) {
        nearbyDealsCount = nearby.length;
      }
    }

    return ApiResponse.success(res, 200, 'Dashboard data fetched', {
      wallet: wallet
        ? {
            balance: wallet.balance,
            totalEarned: wallet.totalEarned,
            totalWithdrawn: wallet.totalWithdrawn,
          }
        : { balance: 0, totalEarned: 0, totalWithdrawn: 0 },
      recentRedemptions: enrichedRedemptions,
      recentTransactions,
      recentPrintJobs,
      nearbyDealsCount,
      profile: {
        name: req.user.name,
        college: req.user.college,
        verificationStatus: req.user.verificationStatus,
        isVerified: req.user.isVerified,
        avatarUrl: req.user.avatarUrl,
        ambassadorTier: req.user.ambassadorTier,
        totalReferrals: req.user.totalReferrals,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  GET /api/student/referrals
// ─────────────────────────────────────────────────
const getReferrals = async (req, res, next) => {
  try {
    const studentId = req.user._id;

    const [referredUsers, referralEarnings] = await Promise.all([
      User.findByReferredBy(studentId),
      Transaction.aggregate([
        { $match: { student: studentId, source: 'referral' } },
        { $group: { _id: null, totalEarned: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const earnings = referralEarnings[0] || { totalEarned: 0, count: 0 };
    const r = req.user.totalReferrals || 0;

    return ApiResponse.success(res, 200, 'Referral stats fetched', {
      referralCode: req.user.referralCode,
      ambassadorTier: req.user.ambassadorTier,
      totalReferrals: r,
      referralEarningsTotal: earnings.totalEarned,
      referralTransactionsCount: earnings.count,
      referredUsers: referredUsers.map((u) => ({
        _id: u._id,
        name: u.name,
        college: u.college,
        createdAt: u.createdAt,
        isVerified: u.isVerified,
      })),
      tierBenefits: {
        bronze: 'Unlock at 5 referrals',
        silver: 'Unlock at 15 referrals',
        gold: 'Unlock at 30 referrals',
      },
      nextTier: (() => {
        if (r < 5) return { tier: 'bronze', referralsNeeded: 5 - r };
        if (r < 15) return { tier: 'silver', referralsNeeded: 15 - r };
        if (r < 30) return { tier: 'gold', referralsNeeded: 30 - r };
        return null;
      })(),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, updateProfile, uploadCollegeId, uploadAvatar, getDashboard, getReferrals };
