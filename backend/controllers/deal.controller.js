'use strict';

const Deal = require('../models/Deal');
const Vendor = require('../models/Vendor');
const Redemption = require('../models/Redemption');
const ApiResponse = require('../utils/ApiResponse');
const { filterByRadius, haversineDistance } = require('../utils/geoFilter');

// ─────────────────────────────────────────────────
//  GET /api/deals/nearby
// ─────────────────────────────────────────────────
const getNearbyDeals = async (req, res, next) => {
  try {
    const { lat, lng, category } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

    if (!lat || !lng) {
      return ApiResponse.error(res, 400, 'lat and lng query parameters are required.');
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return ApiResponse.error(res, 400, 'lat and lng must be valid numbers.');
    }

    // Fetch all active deals (no radius filter — show all, sort by distance)
    const query = { isActive: true, validUntil: { $gt: new Date() } };
    if (category) query.category = category;

    let allDeals = await Deal.find(query);

    // Compute distance for each deal that has valid coordinates, keep rest at end
    const dealsWithDistance = allDeals.map((d) => {
      // d is already a plain object from Deal.find() (Firestore-backed)
      const plain = d._doc ? { _id: d._id, ...d._doc } : { ...d };
      const coords = plain.vendorLocation?.coordinates;
      const hasLocation = coords && coords.length === 2 && !(coords[0] === 0 && coords[1] === 0);
      let distanceMetres = null;
      if (hasLocation) {
        const [dLng, dLat] = coords;
        distanceMetres = Math.round(haversineDistance(parsedLat, parsedLng, dLat, dLng));
      }
      return { ...plain, distanceMetres };
    });

    // Sort: deals with location first (nearest), then no-location deals
    dealsWithDistance.sort((a, b) => {
      if (a.distanceMetres !== null && b.distanceMetres !== null) return a.distanceMetres - b.distanceMetres;
      if (a.distanceMetres !== null) return -1;
      if (b.distanceMetres !== null) return 1;
      return 0;
    });

    const total = dealsWithDistance.length;
    const paginated = dealsWithDistance.slice((page - 1) * limit, page * limit);

    // Populate vendor info for vendor deals; admin deals already have all fields
    const dealsWithInfo = await Promise.all(
      paginated.map(async (deal) => {
        // Ensure plain object (strip any Firestore internals)
        const plain = deal._doc ? { _id: deal._id, ...deal._doc } : { ...deal };
        if (!plain.vendor || plain.vendor === 'admin') {
          return { ...plain, vendor: null };
        }
        const vendor = await Vendor.findById(plain.vendor);
        return {
          ...plain,
          vendor: vendor
            ? {
                _id: vendor._id,
                businessName: vendor.businessName,
                logoUrl: vendor.logoUrl,
                address: vendor.address,
                category: vendor.category,
                rating: vendor.rating,
              }
            : null,
        };
      })
    );

    return ApiResponse.paginated(res, 200, 'Nearby deals fetched', dealsWithInfo, { page, limit, total });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  GET /api/deals/:id
// ─────────────────────────────────────────────────
const getDealById = async (req, res, next) => {
  try {
    const deal = await Deal.findById(req.params.id);

    if (!deal || !deal.isActive) {
      return ApiResponse.error(res, 404, 'Deal not found or is no longer active.');
    }

    // Populate vendor
    const vendor = deal.vendor ? await Vendor.findById(deal.vendor) : null;

    return ApiResponse.success(res, 200, 'Deal fetched', {
      ...deal,
      vendor: vendor
        ? {
            _id: vendor._id,
            businessName: vendor.businessName,
            logoUrl: vendor.logoUrl,
            address: vendor.address,
            category: vendor.category,
            rating: vendor.rating,
            phone: vendor.phone,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  POST /api/deals   (Vendor only)
// ─────────────────────────────────────────────────
const createDeal = async (req, res, next) => {
  try {
    const {
      title,
      description,
      discountType,
      discountValue,
      maxDiscount,
      cashbackAmount,
      validFrom,
      validUntil,
      totalQuantity,
      category,
      termsAndConditions,
    } = req.body;

    const vendor = await Vendor.findById(req.vendor._id);

    const deal = await Deal.create({
      vendor: req.vendor._id,
      title,
      description,
      discountType,
      discountValue: parseFloat(discountValue),
      maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
      cashbackAmount: parseFloat(cashbackAmount) || 0,
      validFrom: new Date(validFrom),
      validUntil: new Date(validUntil),
      totalQuantity: totalQuantity ? parseInt(totalQuantity, 10) : null,
      category: category || vendor.category,
      termsAndConditions,
      vendorLocation: vendor.location,
    });

    // Emit new deal notification via Socket.IO
    const io = req.app.get('io');
    if (io && vendor.location && vendor.location.coordinates) {
      io.emit('new_deal_created', {
        dealId: deal._id,
        title: deal.title,
        vendorId: req.vendor._id,
        vendorName: req.vendor.businessName,
        vendorLocation: vendor.location,
        cashbackAmount: deal.cashbackAmount,
      });
    }

    return ApiResponse.success(res, 201, 'Deal created successfully', deal);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  PUT /api/deals/:id   (Vendor only)
// ─────────────────────────────────────────────────
const updateDeal = async (req, res, next) => {
  try {
    const deal = await Deal.findOne({ _id: req.params.id, vendor: req.vendor._id });

    if (!deal) {
      return ApiResponse.error(res, 404, 'Deal not found or does not belong to your account.');
    }

    const allowedUpdates = [
      'title', 'description', 'discountValue', 'maxDiscount', 'cashbackAmount',
      'validFrom', 'validUntil', 'totalQuantity', 'category', 'termsAndConditions', 'isActive',
    ];

    const updates = {};
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const updated = await Deal.findByIdAndUpdate(deal._id, updates);

    return ApiResponse.success(res, 200, 'Deal updated successfully', updated);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  DELETE /api/deals/:id  (Soft delete)
// ─────────────────────────────────────────────────
const deleteDeal = async (req, res, next) => {
  try {
    const deal = await Deal.findOne({ _id: req.params.id, vendor: req.vendor._id });

    if (!deal) {
      return ApiResponse.error(res, 404, 'Deal not found or does not belong to your account.');
    }

    await Deal.findByIdAndUpdate(deal._id, { isActive: false });

    return ApiResponse.success(res, 200, 'Deal deactivated (soft-deleted) successfully');
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  GET /api/deals/vendor/my-deals   (Vendor only)
// ─────────────────────────────────────────────────
const getMyDeals = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

    const query = { vendor: req.vendor._id };
    if (req.query.isActive !== undefined) {
      query.isActive = req.query.isActive === 'true';
    }

    const allDeals = await Deal.find(query);
    const total = allDeals.length;
    const deals = allDeals.slice((page - 1) * limit, (page - 1) * limit + limit);

    // Attach redemption stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dealsWithStats = await Promise.all(
      deals.map(async (deal) => {
        const [totalRedemptions, todayRedemptions] = await Promise.all([
          Redemption.countDocuments({ deal: deal._id, status: 'redeemed' }),
          Redemption.countDocuments({
            deal: deal._id,
            status: 'redeemed',
            redeemedAt: { $gte: today, $lt: tomorrow },
          }),
        ]);
        return { ...deal, stats: { totalRedemptions, todayRedemptions } };
      })
    );

    return ApiResponse.paginated(res, 200, 'Your deals fetched', dealsWithStats, { page, limit, total });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNearbyDeals,
  getDealById,
  createDeal,
  updateDeal,
  deleteDeal,
  getMyDeals,
};
