'use strict';

/**
 * Vendor service — Firestore-backed replacement for the Mongoose Vendor model.
 * Collection: "vendors"
 */

const { db } = require('../config/firebase');

const COLLECTION = 'vendors';
const col = () => db.collection(COLLECTION);

const create = async (data) => {
  const now = new Date();
  const doc = {
    ownerName: data.ownerName || '',
    businessName: data.businessName || '',
    email: (data.email || '').toLowerCase().trim(),
    phone: data.phone || '',
    passwordHash: data.passwordHash || '',
    category: data.category || 'other',
    address: data.address || '',
    location: data.location || { type: 'Point', coordinates: [0, 0] },
    logoUrl: data.logoUrl || null,
    isApproved: data.isApproved || false,
    rating: 0,
    totalRatings: 0,
    listingTier: 'free',
    subscriptionExpiresAt: null,
    otp: null,
    otpExpiry: null,
    vendorCode: data.vendorCode || null,
    vendorSecretCode: data.vendorSecretCode || null,
    qrCodeUrl: data.qrCodeUrl || null,
    pendingPayable: 0,
    totalSales: 0,
    createdAt: now,
    updatedAt: now,
  };
  const ref = await col().add(doc);
  return { _id: ref.id, ...doc };
};

const findById = async (id) => {
  const snap = await col().doc(id).get();
  if (!snap.exists) return null;
  return { _id: snap.id, ...snap.data() };
};

const findByEmail = async (email) => {
  const snap = await col().where('email', '==', email.toLowerCase().trim()).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { _id: doc.id, ...doc.data() };
};

const findByPhone = async (phone) => {
  const snap = await col().where('phone', '==', phone).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { _id: doc.id, ...doc.data() };
};

const findByVendorCode = async (code) => {
  const snap = await col().where('vendorCode', '==', code.toUpperCase()).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { _id: doc.id, ...doc.data() };
};

const findOne = async (query) => {
  // Handle $or (email or phone check)
  if (query.$or) {
    for (const condition of query.$or) {
      const [field, value] = Object.entries(condition)[0];
      const snap = await col().where(field, '==', value).limit(1).get();
      if (!snap.empty) {
        const doc = snap.docs[0];
        return { _id: doc.id, ...doc.data() };
      }
    }
    return null;
  }
  let q = col();
  Object.entries(query).forEach(([k, v]) => { q = q.where(k, '==', v); });
  const snap = await q.limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { _id: doc.id, ...doc.data() };
};

const findByIdAndUpdate = async (id, updates) => {
  const ref = col().doc(id);
  await ref.update({ ...updates, updatedAt: new Date() });
  const snap = await ref.get();
  return { _id: snap.id, ...snap.data() };
};

const save = async (vendor) => {
  const { _id, ...data } = vendor;
  return findByIdAndUpdate(_id, { ...data, updatedAt: new Date() });
};

const find = async (query = {}) => {
  let q = col();
  Object.entries(query).forEach(([k, v]) => { q = q.where(k, '==', v); });
  const snap = await q.get();
  return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
};

module.exports = {
  create,
  findById,
  findByEmail,
  findByPhone,
  findByVendorCode,
  findOne,
  find,
  findByIdAndUpdate,
  save,
};
