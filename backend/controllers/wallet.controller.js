'use strict';

const CashbackWallet = require('../models/CashbackWallet');
const Transaction = require('../models/Transaction');
const ApiResponse = require('../utils/ApiResponse');
const { Cashfree, CFEnvironment } = require('cashfree-pg');
const crypto = require('crypto');

// ── Cashfree PG Initialization ──────────────────────────────────────────
let cashfree = null;
if (process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY) {
  const cfEnv = process.env.CASHFREE_ENV === 'PRODUCTION'
    ? CFEnvironment.PRODUCTION
    : CFEnvironment.SANDBOX;
  cashfree = new Cashfree(cfEnv, process.env.CASHFREE_APP_ID, process.env.CASHFREE_SECRET_KEY);
  console.log(`[Cashfree] Initialized in ${process.env.CASHFREE_ENV} mode`);
} else {
  console.warn('[WARNING] Cashfree keys (CASHFREE_APP_ID, CASHFREE_SECRET_KEY) are missing. Payment features will be disabled.');
}

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
//  POST /api/wallet/create-cashfree-order
// ─────────────────────────────────────────────────
const createCashfreeOrder = async (req, res, next) => {
  try {
    if (!cashfree) {
      return ApiResponse.error(res, 503, 'Payment gateway is currently unavailable.');
    }

    const { amount } = req.body;
    if (!amount || amount < 10) {
      return ApiResponse.error(res, 400, 'Minimum top-up amount is ₹10.');
    }

    // Cashfree requires customer_id to be alphanumeric (plus underscores/hyphens).
    // Firestore doc IDs can be user names with spaces, so we sanitize here.
    const rawId = req.user._id.toString();
    const sanitizedId = rawId.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);

    // Cashfree requires a valid 10-digit Indian phone number
    const rawPhone = (req.user.phone || '').replace(/\D/g, '');
    const customerPhone = rawPhone.length === 10 ? rawPhone
      : rawPhone.length === 12 && rawPhone.startsWith('91') ? rawPhone.slice(2)
      : '9999999999';

    const orderId = `studex_${sanitizedId.slice(-6)}_${Date.now()}`;

    const orderRequest = {
      order_amount: parseFloat(amount),
      order_currency: 'INR',
      order_id: orderId,
      customer_details: {
        customer_id: sanitizedId,
        customer_name: (req.user.name || 'Student').substring(0, 100),
        customer_email: req.user.email || 'student@studex.app',
        customer_phone: customerPhone,
      },
      order_meta: {
        return_url: (() => {
          const urls = (process.env.CLIENT_URL || '').split(',').map(u => u.trim()).filter(Boolean);
          // Cashfree production requires HTTPS — pick the first https URL
          const httpsUrl = urls.find(u => u.startsWith('https://')) || urls[0] || 'https://studexedu.vercel.app';
          return `${httpsUrl}/wallet?order_id=${orderId}`;
        })(),
      },
    };

    console.log('[Cashfree] Creating order:', JSON.stringify(orderRequest, null, 2));

    const response = await cashfree.PGCreateOrder(orderRequest);

    if (!response || !response.data) {
      return ApiResponse.error(res, 500, 'Error creating Cashfree order');
    }

    return ApiResponse.success(res, 200, 'Cashfree order created', {
      order: {
        order_id: response.data.order_id,
        payment_session_id: response.data.payment_session_id,
        order_amount: response.data.order_amount,
        order_currency: response.data.order_currency,
      },
    });
  } catch (err) {
    // Log detailed Cashfree error for debugging
    if (err.response) {
      console.error('[Cashfree] API Error:', JSON.stringify(err.response.data, null, 2));
      console.error('[Cashfree] Status:', err.response.status);
      const cfMessage = err.response.data?.message || err.response.data?.error?.message || err.message;
      return ApiResponse.error(res, err.response.status || 400, `Payment gateway error: ${cfMessage}`);
    }
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  POST /api/wallet/verify-payment
// ─────────────────────────────────────────────────
const verifyCashfreePayment = async (req, res, next) => {
  try {
    if (!cashfree) {
      return ApiResponse.error(res, 503, 'Payment gateway is currently unavailable.');
    }

    const { order_id } = req.body;

    if (!order_id) {
      return ApiResponse.error(res, 400, 'order_id is required.');
    }

    // Fetch the order status from Cashfree
    const response = await cashfree.PGOrderFetchPayments(order_id);

    if (!response || !response.data || response.data.length === 0) {
      return ApiResponse.error(res, 400, 'No payments found for this order.');
    }

    // Find a successful payment
    const successfulPayment = response.data.find(
      (p) => p.payment_status === 'SUCCESS'
    );

    if (!successfulPayment) {
      return ApiResponse.error(res, 400, 'Payment not completed or failed.');
    }

    const paidAmount = parseFloat(successfulPayment.payment_amount);
    const paymentId = successfulPayment.cf_payment_id;

    // Check if this payment was already credited (idempotency)
    // Transaction model uses Firestore — use find() and filter in JS
    const existingTxns = await Transaction.find({
      student: req.user._id,
      source: 'wallet_topup',
    });
    const alreadyCredited = existingTxns.some(
      (t) => t.description && t.description.includes(paymentId.toString())
    );

    if (alreadyCredited) {
      return ApiResponse.success(res, 200, 'Payment already verified and credited.');
    }

    let wallet = await CashbackWallet.findOne({ student: req.user._id });
    if (!wallet) {
      wallet = await CashbackWallet.create({ student: req.user._id });
    }

    wallet.balance += paidAmount;
    wallet.totalEarned += paidAmount;
    await CashbackWallet.save(wallet);

    await Transaction.create({
      wallet: wallet._id,
      student: req.user._id,
      type: 'credit',
      amount: paidAmount,
      source: 'wallet_topup',
      description: `Wallet Top-Up via Cashfree (Payment ID: ${paymentId})`,
    });

    return ApiResponse.success(res, 200, 'Payment verified and wallet credited successfully');
  } catch (err) {
    // Log detailed Cashfree error for debugging
    if (err.response) {
      console.error('[Cashfree] Verify Error:', JSON.stringify(err.response.data, null, 2));
      console.error('[Cashfree] Status:', err.response.status);
      const cfMessage = err.response.data?.message || err.response.data?.error?.message || err.message;
      return ApiResponse.error(res, err.response.status || 400, `Payment verification error: ${cfMessage}`);
    }
    next(err);
  }
};

module.exports = { getWallet, getTransactions, withdrawFromWallet, setUpiId, createCashfreeOrder, verifyCashfreePayment };
