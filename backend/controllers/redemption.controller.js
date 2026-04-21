'use strict';

const { v4: uuidv4 } = require('uuid');
const Deal = require('../models/Deal');
const Redemption = require('../models/Redemption');
const Vendor = require('../models/Vendor');
const CashbackWallet = require('../models/CashbackWallet');
const Transaction = require('../models/Transaction');
const ApiResponse = require('../utils/ApiResponse');
const { generateQRBase64 } = require('../utils/generateQR');

// ─────────────────────────────────────────────────
//  POST /api/redemptions/generate
// ─────────────────────────────────────────────────
const generateRedemption = async (req, res, next) => {
  try {
    const { dealId } = req.body;
    const studentId = req.user._id;

    // 1. Fetch & validate deal
    const deal = await Deal.findById(dealId);

    if (!deal) {
      return ApiResponse.error(res, 404, 'Deal not found.');
    }
    if (!deal.isActive) {
      return ApiResponse.error(res, 400, 'This deal is no longer active.');
    }

    const validUntil = deal.validUntil instanceof Date ? deal.validUntil : deal.validUntil.toDate();
    const validFrom = deal.validFrom instanceof Date ? deal.validFrom : deal.validFrom.toDate();

    if (new Date() > validUntil) {
      return ApiResponse.error(res, 400, 'This deal has expired.');
    }
    if (new Date() < validFrom) {
      return ApiResponse.error(res, 400, `This deal is not yet active. It starts on ${validFrom.toDateString()}.`);
    }

    // 2. Check quantity
    if (deal.totalQuantity !== null && deal.redeemedCount >= deal.totalQuantity) {
      return ApiResponse.error(res, 400, 'Sorry, this deal has been fully redeemed and no more slots are available.');
    }

    // 3. Check for existing active redemption
    const existingRedemption = await Redemption.findOne({
      student: studentId,
      deal: dealId,
      status: 'generated',
      expiresAt: { $gt: new Date() },
    });

    if (existingRedemption) {
      const qrImageBase64 = await generateQRBase64(existingRedemption.qrToken);
      return ApiResponse.success(res, 200, 'You already have an active QR code for this deal.', {
        redemptionId: existingRedemption._id,
        qrToken: existingRedemption.qrToken,
        qrImageBase64,
        expiresAt: existingRedemption.expiresAt,
        cashbackAmount: existingRedemption.cashbackAmount,
      });
    }

    // 4. Generate unique QR token
    const qrToken = uuidv4();
    const generatedAt = new Date();
    const expiresAt = new Date(generatedAt.getTime() + 10 * 60 * 1000); // +10 minutes

    // 5. Save Redemption document
    const redemption = await Redemption.create({
      student: studentId,
      deal: dealId,
      vendor: deal.vendor,
      qrToken,
      status: 'generated',
      generatedAt,
      expiresAt,
      cashbackAmount: deal.cashbackAmount,
    });

    // 6. Generate QR code image (base64 PNG)
    const qrImageBase64 = await generateQRBase64(qrToken);

    return ApiResponse.success(res, 201, 'Redemption QR code generated. Show this to the vendor within 10 minutes.', {
      redemptionId: redemption._id,
      qrToken,
      qrImageBase64,
      expiresAt,
      cashbackAmount: deal.cashbackAmount,
      deal: {
        title: deal.title,
        discountType: deal.discountType,
        discountValue: deal.discountValue,
        vendorId: deal.vendor,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  GET /api/redemptions/my
// ─────────────────────────────────────────────────
const getMyRedemptions = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

    const query = { student: req.user._id };
    if (req.query.status) query.status = req.query.status;

    const allRedemptions = await Redemption.find(query);
    const total = allRedemptions.length;
    const redemptions = allRedemptions.slice((page - 1) * limit, (page - 1) * limit + limit);

    // Auto-expire stale 'generated' redemptions
    const now = new Date();
    const processed = redemptions.map((r) => {
      const expiresAt = r.expiresAt instanceof Date ? r.expiresAt : r.expiresAt?.toDate?.();
      return {
        ...r,
        status: r.status === 'generated' && expiresAt < now ? 'expired' : r.status,
      };
    });

    return ApiResponse.paginated(res, 200, 'Redemption history fetched', processed, { page, limit, total });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  GET /api/redemptions/:id
// ─────────────────────────────────────────────────
const getRedemptionById = async (req, res, next) => {
  try {
    const redemption = await Redemption.findById(req.params.id);

    if (!redemption || redemption.student !== req.user._id) {
      return ApiResponse.error(res, 404, 'Redemption not found.');
    }

    const now = new Date();
    const expiresAt = redemption.expiresAt instanceof Date ? redemption.expiresAt : redemption.expiresAt?.toDate?.();
    const currentStatus = redemption.status === 'generated' && expiresAt < now ? 'expired' : redemption.status;

    let qrImageBase64 = null;
    if (currentStatus === 'generated') {
      qrImageBase64 = await generateQRBase64(redemption.qrToken);
    }

    return ApiResponse.success(res, 200, 'Redemption fetched', {
      ...redemption,
      status: currentStatus,
      qrImageBase64,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  POST /api/redemptions/pay
// ─────────────────────────────────────────────────
const payVendor = async (req, res, next) => {
  try {
    const { dealId, vendorCode, amount } = req.body;
    const studentId = req.user._id;
    const payAmount = parseFloat(amount);

    if (!vendorCode || !payAmount || payAmount <= 0) {
      return ApiResponse.error(res, 400, 'Invalid payment details.');
    }

    const deal = await Deal.findById(dealId);
    if (!deal || !deal.isActive) {
      return ApiResponse.error(res, 404, 'Deal is unavailable.');
    }

    const vendor = await Vendor.findByVendorCode(vendorCode);
    if (!vendor) {
      return ApiResponse.error(res, 404, `Invalid Vendor Code: ${vendorCode}`);
    }

    if (deal.vendor !== vendor._id && deal.vendor !== 'admin') {
      // Validate the code belongs to the right vendor (allowing admin created wildcards)
      // return ApiResponse.error(res, 400, 'The vendor code does not match this deal provider.');
    }

    const wallet = await CashbackWallet.findOne({ student: studentId });
    if (!wallet || wallet.balance < payAmount) {
      return ApiResponse.error(res, 400, 'Insufficient wallet balance.');
    }

    // 1. Deduct from student
    wallet.balance -= payAmount;
    await CashbackWallet.save(wallet);

    // 2. Add to vendor (deducting 5% commission)
    const commission = payAmount * 0.05;
    const netPayable = payAmount - commission;
    vendor.totalSales = (vendor.totalSales || 0) + payAmount;
    vendor.pendingPayable = (vendor.pendingPayable || 0) + netPayable;
    await Vendor.save(vendor);

    // 3. Log transaction
    await Transaction.create({
      wallet: wallet._id,
      student: studentId,
      type: 'debit',
      amount: payAmount,
      source: 'deal_redemption',
      description: `Payment to ${vendor.businessName} (Code: ${vendor.vendorCode})`,
    });

    // 4. Create redemption instantly marked redeemed
    const qrToken = uuidv4();
    const redemption = await Redemption.create({
      student: studentId,
      deal: dealId,
      vendor: vendor._id,
      qrToken,
      status: 'redeemed',
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60000),
      redeemedAt: new Date(),
      cashbackAmount: deal.cashbackAmount || 0,
      cashbackCredited: false, // Could process later
    });

    // Increment deal redeemed count
    deal.redeemedCount = (deal.redeemedCount || 0) + 1;
    await Deal.save(deal);

    return ApiResponse.success(res, 200, `Payment of ₹${payAmount.toFixed(2)} to ${vendor.businessName} was successful!`, {
      redemptionId: redemption._id,
      cashbackAmount: redemption.cashbackAmount,
      vendorName: vendor.businessName,
      amountPaid: payAmount,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { generateRedemption, getMyRedemptions, getRedemptionById, payVendor };
