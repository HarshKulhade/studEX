'use strict';

const Vendor = require('../models/Vendor');
const Deal = require('../models/Deal');
const Redemption = require('../models/Redemption');
const CashbackWallet = require('../models/CashbackWallet');
const Transaction = require('../models/Transaction');
const ApiResponse = require('../utils/ApiResponse');
const { logoUploader } = require('../config/cloudinary');

// ─────────────────────────────────────────────────
//  GET /api/vendor/profile
// ─────────────────────────────────────────────────
const getProfile = async (req, res, next) => {
  try {
    return ApiResponse.success(res, 200, 'Vendor profile fetched', req.vendor);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  PUT /api/vendor/profile
// ─────────────────────────────────────────────────
const updateProfile = [
  logoUploader.single('logo'),
  async (req, res, next) => {
    try {
      const allowedUpdates = ['ownerName', 'businessName', 'category', 'address'];
      const updates = {};

      allowedUpdates.forEach((field) => {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      });

      if (req.body.lng && req.body.lat) {
        updates.location = {
          type: 'Point',
          coordinates: [parseFloat(req.body.lng), parseFloat(req.body.lat)],
        };
      }

      if (req.file) {
        updates.logoUrl = req.file.path;
      }

      if (Object.keys(updates).length === 0) {
        return ApiResponse.error(res, 400, 'No valid fields provided for update.');
      }

      const vendor = await Vendor.findByIdAndUpdate(req.vendor._id, updates);

      const { passwordHash, otp, otpExpiry, ...safeVendor } = vendor;
      return ApiResponse.success(res, 200, 'Vendor profile updated successfully', safeVendor);
    } catch (err) {
      next(err);
    }
  },
];

// ─────────────────────────────────────────────────
//  GET /api/vendor/dashboard
// ─────────────────────────────────────────────────
const getDashboard = async (req, res, next) => {
  try {
    const vendorId = req.vendor._id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [allDeals, allRedemptions, vendor] = await Promise.all([
      Deal.find({ vendor: vendorId }),
      Redemption.find({ vendor: vendorId, status: 'redeemed' }),
      Vendor.findById(vendorId),
    ]);

    const totalDeals = allDeals.filter((d) => d.isActive).length;
    const totalRedemptions = allRedemptions.length;

    const redemptionsToday = allRedemptions.filter((r) => {
      const redAt = r.redeemedAt instanceof Date ? r.redeemedAt : r.redeemedAt?.toDate?.();
      return redAt && redAt >= today && redAt < tomorrow;
    }).length;

    const totalCashbackCredited = allRedemptions
      .filter((r) => r.cashbackCredited)
      .reduce((sum, r) => sum + (r.cashbackAmount || 0), 0);

    return ApiResponse.success(res, 200, 'Vendor dashboard fetched', {
      businessName: vendor.businessName,
      listingTier: vendor.listingTier,
      rating: vendor.rating,
      totalRatings: vendor.totalRatings,
      stats: {
        totalActiveDeals: totalDeals,
        redemptionsToday,
        totalRedemptions,
        totalCashbackCredited,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  GET /api/vendor/redemptions
// ─────────────────────────────────────────────────
const getRedemptions = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

    const query = { vendor: req.vendor._id };
    if (req.query.status) query.status = req.query.status;

    const allRedemptions = await Redemption.find(query);
    const total = allRedemptions.length;
    const redemptions = allRedemptions.slice((page - 1) * limit, (page - 1) * limit + limit);

    return ApiResponse.paginated(res, 200, 'Redemptions fetched', redemptions, { page, limit, total });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  POST /api/vendor/scan-qr
// ─────────────────────────────────────────────────
const scanQR = async (req, res, next) => {
  try {
    const { qrToken } = req.body;

    if (!qrToken) {
      return ApiResponse.error(res, 400, 'qrToken is required.');
    }

    const redemption = await Redemption.findOne({ qrToken });

    if (!redemption) {
      return ApiResponse.error(res, 404, 'Invalid QR code. No redemption found.');
    }

    // Fetch deal to verify vendor ownership
    const deal = await Deal.findById(redemption.deal);
    if (!deal || deal.vendor !== req.vendor._id) {
      return ApiResponse.error(res, 403, 'This QR code belongs to a different vendor.');
    }

    if (redemption.status === 'redeemed') {
      return ApiResponse.error(res, 400, 'This QR code has already been redeemed.');
    }

    const expiresAt = redemption.expiresAt instanceof Date ? redemption.expiresAt : redemption.expiresAt?.toDate?.();
    if (redemption.status === 'expired' || new Date() > expiresAt) {
      if (redemption.status !== 'expired') {
        await Redemption.save({ ...redemption, status: 'expired' });
      }
      return ApiResponse.error(res, 400, 'This QR code has expired.');
    }

    // Mark as redeemed
    await Redemption.save({
      ...redemption,
      status: 'redeemed',
      redeemedAt: new Date(),
    });

    // Increment deal redemption count
    await Deal.findByIdAndUpdate(deal._id, { $inc: { redeemedCount: 1 } });

    // Credit cashback to student's wallet
    const cashbackAmount = redemption.cashbackAmount || 0;
    let newBalance = 0;

    if (cashbackAmount > 0) {
      let wallet = await CashbackWallet.findOne({ student: redemption.student });
      if (!wallet) {
        wallet = await CashbackWallet.create({ student: redemption.student });
      }

      wallet.balance += cashbackAmount;
      wallet.totalEarned += cashbackAmount;
      await CashbackWallet.save(wallet);
      newBalance = wallet.balance;

      await Transaction.create({
        wallet: wallet._id,
        student: redemption.student,
        type: 'credit',
        amount: cashbackAmount,
        source: 'deal_redemption',
        referenceId: redemption._id,
        description: `Cashback for redeeming deal: ${deal.title}`,
      });

      await Redemption.save({ ...redemption, status: 'redeemed', redeemedAt: new Date(), cashbackCredited: true });

      // Emit real-time notification via Socket.IO
      const io = req.app.get('io');
      if (io) {
        io.to(redemption.student).emit('cashback_credited', {
          amount: cashbackAmount,
          vendorName: req.vendor.businessName,
          newBalance,
          message: `₹${cashbackAmount} cashback credited from ${req.vendor.businessName}!`,
        });
      }
    }

    return ApiResponse.success(res, 200, 'QR code redeemed successfully!', {
      redemptionId: redemption._id,
      studentId: redemption.student,
      dealTitle: deal.title,
      cashbackCredited: cashbackAmount,
      redeemedAt: new Date(),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, updateProfile, getDashboard, getRedemptions, scanQR };
