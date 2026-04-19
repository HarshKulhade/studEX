'use strict';

const CashbackWallet = require('../models/CashbackWallet');
const Transaction = require('../models/Transaction');
const ApiResponse = require('../utils/ApiResponse');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─────────────────────────────────────────────────
//  GET /api/wallet
// ─────────────────────────────────────────────────
const getWallet = async (req, res, next) => {
  try {
    let wallet = await CashbackWallet.findOne({ student: req.user._id });

    if (!wallet) {
      wallet = await CashbackWallet.create({ student: req.user._id });
    }

    return ApiResponse.success(res, 200, 'Wallet fetched', {
      walletId: wallet._id,
      balance: wallet.balance,
      totalEarned: wallet.totalEarned,
      totalWithdrawn: wallet.totalWithdrawn,
      upiId: wallet.upiId,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  GET /api/wallet/transactions
// ─────────────────────────────────────────────────
const getTransactions = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

    const query = { student: req.user._id };
    if (req.query.type) query.type = req.query.type;
    if (req.query.source) query.source = req.query.source;

    const allTxns = await Transaction.find(query);
    const total = allTxns.length;
    const transactions = allTxns.slice((page - 1) * limit, (page - 1) * limit + limit);

    return ApiResponse.paginated(res, 200, 'Transaction history fetched', transactions, { page, limit, total });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  POST /api/wallet/withdraw
// ─────────────────────────────────────────────────
const withdrawFromWallet = async (req, res, next) => {
  try {
    const { amount, upiId } = req.body;

    const withdrawAmount = parseFloat(amount);

    if (!withdrawAmount || withdrawAmount < 10) {
      return ApiResponse.error(res, 400, 'Minimum withdrawal amount is ₹10.');
    }

    const wallet = await CashbackWallet.findOne({ student: req.user._id });

    if (!wallet) {
      return ApiResponse.error(res, 404, 'Wallet not found. Please earn some cashback first.');
    }

    if (wallet.balance < withdrawAmount) {
      return ApiResponse.error(
        res,
        400,
        `Insufficient wallet balance. Available: ₹${wallet.balance.toFixed(2)}, Requested: ₹${withdrawAmount.toFixed(2)}`
      );
    }

    wallet.balance -= withdrawAmount;
    wallet.totalWithdrawn += withdrawAmount;
    if (upiId) wallet.upiId = upiId;

    await CashbackWallet.save(wallet);

    await Transaction.create({
      wallet: wallet._id,
      student: req.user._id,
      type: 'debit',
      amount: withdrawAmount,
      source: 'withdrawal',
      description: `Withdrawal of ₹${withdrawAmount.toFixed(2)} to UPI: ${upiId || wallet.upiId || 'N/A'}`,
    });

    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(`[MOCK UPI TRANSFER] ₹${withdrawAmount} → ${upiId || wallet.upiId} for student ${req.user._id}`);
    }

    return ApiResponse.success(
      res,
      200,
      `Withdrawal of ₹${withdrawAmount.toFixed(2)} initiated successfully. Amount will be credited to your UPI within 2-3 business days.`,
      {
        amountWithdrawn: withdrawAmount,
        newBalance: wallet.balance,
        upiId: wallet.upiId,
      }
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  POST /api/wallet/set-upi
// ─────────────────────────────────────────────────
const setUpiId = async (req, res, next) => {
  try {
    const { upiId } = req.body;

    if (!upiId) {
      return ApiResponse.error(res, 400, 'UPI ID is required.');
    }

    const upiRegex = /^[\w.\-]{3,}@[a-zA-Z]{3,}$/;
    if (!upiRegex.test(upiId)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid UPI ID format. Example: yourname@upi or phone@okaxis'
      );
    }

    let wallet = await CashbackWallet.findOne({ student: req.user._id });
    if (!wallet) {
      wallet = await CashbackWallet.create({ student: req.user._id });
    }

    wallet.upiId = upiId;
    await CashbackWallet.save(wallet);

    return ApiResponse.success(res, 200, 'UPI ID saved successfully', { upiId: wallet.upiId });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  POST /api/wallet/create-razorpay-order
// ─────────────────────────────────────────────────
const createRazorpayOrder = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || amount < 10) {
      return ApiResponse.error(res, 400, 'Minimum top-up amount is ₹10.');
    }

    const options = {
      amount: parseInt(amount * 100), // amount in the smallest currency unit (paise)
      currency: 'INR',
      receipt: `rw_${req.user._id.toString().slice(-6)}_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    if (!order) {
      return ApiResponse.error(res, 500, 'Error creating Razorpay order');
    }

    return ApiResponse.success(res, 200, 'Razorpay order created', { order });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  POST /api/wallet/verify-payment
// ─────────────────────────────────────────────────
const verifyRazorpayPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

    const bodyText = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(bodyText.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      return ApiResponse.error(res, 400, 'Invalid payment signature.');
    }

    let wallet = await CashbackWallet.findOne({ student: req.user._id });
    if (!wallet) {
      wallet = await CashbackWallet.create({ student: req.user._id });
    }

    wallet.balance += parseFloat(amount);
    wallet.totalEarned += parseFloat(amount); // Reusing totalEarned to represent total added funds
    await CashbackWallet.save(wallet);

    await Transaction.create({
      wallet: wallet._id,
      student: req.user._id,
      type: 'credit',
      amount: parseFloat(amount),
      source: 'wallet_topup',
      description: `Wallet Top-Up via Razorpay (Payment ID: ${razorpay_payment_id})`,
    });

    return ApiResponse.success(res, 200, 'Payment verified and wallet credited successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = { getWallet, getTransactions, withdrawFromWallet, setUpiId, createRazorpayOrder, verifyRazorpayPayment };
