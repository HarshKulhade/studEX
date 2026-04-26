'use strict';

const Deal = require('../models/Deal');
const Vendor = require('../models/Vendor');
const Opportunity = require('../models/Opportunity');
const User = require('../models/User');
const ApiResponse = require('../utils/ApiResponse');
const { db } = require('../config/firebase');

// ─────────────────────────────────────────────────
//  GET /api/admin/stats
// ─────────────────────────────────────────────────
const getStats = async (req, res, next) => {
  try {
    const [usersSnap, dealsSnap, vendorsSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('deals').get(),
      db.collection('vendors').get(),
    ]);
    return ApiResponse.success(res, 200, 'Stats fetched', {
      totalUsers: usersSnap.size,
      totalDeals: dealsSnap.size,
      totalVendors: vendorsSnap.size,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  GET /api/admin/deals
// ─────────────────────────────────────────────────
const getAllDeals = async (req, res, next) => {
  try {
    const snap = await db.collection('deals').get();
    const deals = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    return ApiResponse.success(res, 200, 'All deals fetched', deals);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  POST /api/admin/deals  — Create deal directly
// ─────────────────────────────────────────────────
const adminCreateDeal = async (req, res, next) => {
  try {
    const {
      shopName, title, description, offer, rating,
      category, address, lat, lng,
      validFrom, validUntil, isActive, minOrderValue
    } = req.body;

    const now = new Date();
    const doc = {
      shopName: shopName || '',
      title: title || shopName || '',
      description: description || '',
      offer: offer || '',           // e.g. "15% off on all items"
      rating: parseFloat(rating) || 0,
      category: category || 'other',
      address: address || '',
      vendorLocation: {
        type: 'Point',
        coordinates: [parseFloat(lng) || 0, parseFloat(lat) || 0],
      },
      googleMapsUrl: req.body.googleMapsUrl || ((lat && lng)
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        : (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '')),
      discountType: req.body.discountType || 'percentage',
      discountValue: req.body.discountValue !== undefined && req.body.discountValue !== '' 
                     ? parseFloat(req.body.discountValue) 
                     : (req.body.discountType === 'bogo' ? 0 : parseFloat(offer) || 0),
      minOrderValue: minOrderValue !== undefined ? parseFloat(minOrderValue) : 99,
      cashbackAmount: 0,
      validFrom: validFrom ? new Date(validFrom) : now,
      validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: isActive !== false && isActive !== 'false',
      redeemedCount: 0,
      vendor: 'admin',
      coverImageUrl: req.file ? req.file.path : (req.body.coverImageUrl || null),
      createdAt: now,
      updatedAt: now,
    };

    const ref = await db.collection('deals').add(doc);
    return ApiResponse.success(res, 201, 'Deal created', { _id: ref.id, ...doc });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  PUT /api/admin/deals/:id
// ─────────────────────────────────────────────────
const adminUpdateDeal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      shopName, title, description, offer, rating,
      category, address, lat, lng,
      validFrom, validUntil, isActive, googleMapsUrl, minOrderValue
    } = req.body;

    const updates = {
      updatedAt: new Date(),
    };

    if (shopName !== undefined) updates.shopName = shopName;
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (offer !== undefined) updates.offer = offer;
    if (req.body.discountType !== undefined) updates.discountType = req.body.discountType;
    if (req.body.discountValue !== undefined && req.body.discountValue !== '') {
       updates.discountValue = parseFloat(req.body.discountValue);
    } else if (req.body.discountType === 'bogo') {
       updates.discountValue = 0;
    }
    if (rating !== undefined) updates.rating = parseFloat(rating);
    if (category !== undefined) updates.category = category;
    if (address !== undefined) updates.address = address;
    if (minOrderValue !== undefined) updates.minOrderValue = parseFloat(minOrderValue);
    if (isActive !== undefined) updates.isActive = isActive === 'true' || isActive === true;
    if (validFrom) updates.validFrom = new Date(validFrom);
    if (validUntil) updates.validUntil = new Date(validUntil);
    if (googleMapsUrl !== undefined) updates.googleMapsUrl = googleMapsUrl;
    if (req.body.coverImageUrl !== undefined) updates.coverImageUrl = req.body.coverImageUrl || null;

    if (req.file) {
      updates.coverImageUrl = req.file.path;
    }

    if (lat !== undefined || lng !== undefined) {
      const existingSnap = await db.collection('deals').doc(id).get();
      const existing = existingSnap.data() || {};
      const existingCoords = existing.vendorLocation?.coordinates || [0, 0];
      const newLng = lng !== undefined ? parseFloat(lng) : existingCoords[0];
      const newLat = lat !== undefined ? parseFloat(lat) : existingCoords[1];
      updates.vendorLocation = { type: 'Point', coordinates: [newLng, newLat] };
      if (!googleMapsUrl && !existing.googleMapsUrl) {
         updates.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${newLat},${newLng}`;
      } else if (!googleMapsUrl && existing.googleMapsUrl && existing.googleMapsUrl.includes('/maps/search/?api=1&query=')) {
         // Auto-update if it was an auto-generated one
         updates.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${newLat},${newLng}`;
      }
    }

    await db.collection('deals').doc(id).update(updates);
    const snap = await db.collection('deals').doc(id).get();
    return ApiResponse.success(res, 200, 'Deal updated', { _id: snap.id, ...snap.data() });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  DELETE /api/admin/deals/:id  (hard delete)
// ─────────────────────────────────────────────────
const adminDeleteDeal = async (req, res, next) => {
  try {
    await db.collection('deals').doc(req.params.id).delete();
    return ApiResponse.success(res, 200, 'Deal deleted permanently');
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  GET /api/admin/users
// ─────────────────────────────────────────────────
const getAllUsers = async (req, res, next) => {
  try {
    const snap = await db.collection('users').orderBy('createdAt', 'desc').get();
    const users = snap.docs.map(d => {
      const data = d.data();
      return {
        _id: d.id,
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        college: data.college,
        avatarUrl: data.avatarUrl || null,
        collegeIdImageUrl: data.collegeIdImageUrl || null,
        isVerified: data.isVerified || false,
        verificationStatus: data.verificationStatus || 'unverified',
        createdAt: data.createdAt,
      };
    });
    return ApiResponse.success(res, 200, 'Users fetched', users);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  GET /api/admin/opportunities
// ─────────────────────────────────────────────────
const getAllOpportunities = async (req, res, next) => {
  try {
    const snap = await db.collection('opportunities').get();
    const opps = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    return ApiResponse.success(res, 200, 'Opportunities fetched', opps);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  POST /api/admin/opportunities
// ─────────────────────────────────────────────────
const adminCreateOpportunity = async (req, res, next) => {
  try {
    const now = new Date();
    const doc = {
      title: req.body.title || '',
      company: req.body.company || '',
      type: req.body.type || 'internship',
      location: req.body.location || '',
      stipend: req.body.stipend || '',
      description: req.body.description || '',
      applyUrl: req.body.applyUrl || '',
      deadline: req.body.deadline ? new Date(req.body.deadline) : null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    const ref = await db.collection('opportunities').add(doc);
    return ApiResponse.success(res, 201, 'Opportunity created', { _id: ref.id, ...doc });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  DELETE /api/admin/opportunities/:id
// ─────────────────────────────────────────────────
const adminDeleteOpportunity = async (req, res, next) => {
  try {
    await db.collection('opportunities').doc(req.params.id).delete();
    return ApiResponse.success(res, 200, 'Opportunity deleted');
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  PUT /api/admin/users/:id/verify
// ─────────────────────────────────────────────────
const adminVerifyUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'verify' or 'reject'

    if (!['verify', 'reject'].includes(action)) {
      return ApiResponse.error(res, 400, 'Action must be "verify" or "reject".');
    }

    const userRef = db.collection('users').doc(id);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return ApiResponse.error(res, 404, 'User not found.');
    }

    const updates = {
      verificationStatus: action === 'verify' ? 'verified' : 'rejected',
      isVerified: action === 'verify',
      updatedAt: new Date(),
    };

    await userRef.update(updates);

    const updatedSnap = await userRef.get();
    const data = updatedSnap.data();

    return ApiResponse.success(res, 200, `User ${action === 'verify' ? 'verified' : 'rejected'} successfully.`, {
      _id: updatedSnap.id,
      name: data.name,
      email: data.email,
      verificationStatus: data.verificationStatus,
      isVerified: data.isVerified,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  POST /api/admin/scrape-url
// ─────────────────────────────────────────────────
const scrapeUrl = async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) return ApiResponse.error(res, 400, 'URL is required');

    // Basic regex to find og:image
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      return ApiResponse.error(res, 400, 'Failed to fetch the URL');
    }

    const html = await response.text();
    
    let ogImage = null;
    const ogMatch = html.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i);
    if (ogMatch && ogMatch[1]) {
      ogImage = ogMatch[1];
    } else {
      // Fallback to Twitter image
      const twMatch = html.match(/<meta\s+(?:property|name)="twitter:image"\s+content="([^"]+)"/i);
      if (twMatch && twMatch[1]) {
        ogImage = twMatch[1];
      }
    }

    // Google Maps specific fallback if no generic og:image
    if (!ogImage && html.includes('maps.google.com/maps/api/staticmap')) {
       // Maybe try to extract the static map or thumbnail directly
       const thumbMatch = html.match(/"([^"]+ggpht\.com[^"]+)"/i);
       if (thumbMatch && thumbMatch[1]) ogImage = thumbMatch[1];
    }

    // A lot of google maps images are locked up in JS state arrays, we can try matching unescaped URLs finding images
    if (!ogImage) {
      // Find the first googleusercontent.com or ggpht.com URL
      const fallbackMatch = html.match(/(https:\/\/[a-zA-Z0-9-]+\.(?:googleusercontent|ggpht)\.com\/p\/[a-zA-Z0-9_-]+)/i);
      if (fallbackMatch && fallbackMatch[1]) {
        ogImage = fallbackMatch[1];
      }
    }

    // If it starts with //, prepend https:
    if (ogImage && ogImage.startsWith('//')) {
      ogImage = 'https:' + ogImage;
    }

    return ApiResponse.success(res, 200, 'Scraped details', { ogImage });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  GET /api/admin/vendors
// ─────────────────────────────────────────────────
const getAllVendors = async (req, res, next) => {
  try {
    const snap = await db.collection('vendors').orderBy('createdAt', 'desc').get();
    const vendors = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    return ApiResponse.success(res, 200, 'Vendors fetched', vendors);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  POST /api/admin/vendors
// ─────────────────────────────────────────────────
const adminCreateVendor = async (req, res, next) => {
  try {
    const { businessName, email, phone, category, address } = req.body;
    
    // Generate a 6 character uppercase vendor code
    const vendorCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Generate a 4 digit secret code
    const vendorSecretCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Generate simple QR Code encoding the vendor code
    // A production scenario could use a Cloudinary upload, but a public QR chart is very solid
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${vendorCode}`;
    
    const doc = await Vendor.create({
      businessName: businessName || '',
      email: email || `${vendorCode.toLowerCase()}@studex.com`,
      phone: phone || '',
      category: category || 'other',
      address: address || '',
      vendorCode,
      vendorSecretCode,
      qrCodeUrl,
      isApproved: true,
      passwordHash: 'admin-created', // default unloginable
    });
    
    return ApiResponse.success(res, 201, 'Vendor created', doc);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  POST /api/admin/vendors/:id/pay
// ─────────────────────────────────────────────────
const adminPayVendor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const vendor = await Vendor.findById(id);
    if (!vendor) return ApiResponse.error(res, 404, 'Vendor not found.');
    
    if (!vendor.pendingPayable || vendor.pendingPayable <= 0) {
      return ApiResponse.error(res, 400, 'Vendor has no pending payable balance.');
    }
    
    const amountPaid = vendor.pendingPayable;
    vendor.pendingPayable = 0;
    // Potentially record this settlement inside a generic transactions model mapped to `adminPayout` etc.
    
    await Vendor.save(vendor);
    
    return ApiResponse.success(res, 200, `Successfully settled ₹${amountPaid.toFixed(2)} with vendor.`, vendor);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  DELETE /api/admin/vendors/:id
// ─────────────────────────────────────────────────
const adminDeleteVendor = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.collection('vendors').doc(id).delete();
    return ApiResponse.success(res, 200, 'Vendor deleted successfully');
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────
//  GET /api/admin/vendors/:id/transactions
// ─────────────────────────────────────────────────
const Transaction = require('../models/Transaction');

const getVendorTransactions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const vendor = await Vendor.findById(id);
    if (!vendor) return ApiResponse.error(res, 404, 'Vendor not found.');

    const transactions = await Transaction.find({ referenceId: id });
    
    // Enrich transactions with student info
    const enrichedTransactions = await Promise.all(transactions.map(async (tx) => {
      let studentInfo = { name: 'Unknown', email: 'Unknown' };
      if (tx.student) {
        const userDoc = await db.collection('users').doc(tx.student).get();
        if (userDoc.exists) {
          studentInfo = { name: userDoc.data().name, email: userDoc.data().email };
        }
      }
      return {
        ...tx,
        studentInfo
      };
    }));

    return ApiResponse.success(res, 200, 'Transactions fetched', enrichedTransactions);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getStats,
  getAllDeals,
  adminCreateDeal,
  adminUpdateDeal,
  adminDeleteDeal,
  getAllUsers,
  adminVerifyUser,
  getAllOpportunities,
  adminCreateOpportunity,
  adminDeleteOpportunity,
  scrapeUrl,
  getAllVendors,
  adminCreateVendor,
  adminPayVendor,
  adminDeleteVendor,
  getVendorTransactions,
};
