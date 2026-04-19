'use strict';

/**
 * Deal service — Firestore-backed replacement for the Mongoose Deal model.
 * Collection: "deals"
 */

const { db } = require('../config/firebase');

const COLLECTION = 'deals';
const col = () => db.collection(COLLECTION);

const create = async (data) => {
  const now = new Date();
  const doc = {
    vendor: data.vendor,
    title: data.title,
    description: data.description || '',
    discountType: data.discountType,
    discountValue: data.discountValue,
    maxDiscount: data.maxDiscount || null,
    cashbackAmount: data.cashbackAmount || 0,
    validFrom: data.validFrom,
    validUntil: data.validUntil,
    totalQuantity: data.totalQuantity || null,
    redeemedCount: 0,
    category: data.category || 'other',
    termsAndConditions: data.termsAndConditions || '',
    vendorLocation: data.vendorLocation || null,
    isActive: true,
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

const findOne = async (query) => {
  let q = col();
  Object.entries(query).forEach(([k, v]) => {
    if (k !== '_id') q = q.where(k, '==', v);
  });
  if (query._id) {
    const snap = await col().doc(query._id).get();
    if (!snap.exists) return null;
    const data = { _id: snap.id, ...snap.data() };
    // Apply remaining filters
    for (const [k, v] of Object.entries(query)) {
      if (k !== '_id' && data[k] !== v) return null;
    }
    return data;
  }
  const snap = await q.limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { _id: doc.id, ...doc.data() };
};

const find = async (query = {}, options = {}) => {
  let q = col();
  if (query.vendor) q = q.where('vendor', '==', query.vendor);
  if (query.isActive !== undefined) q = q.where('isActive', '==', query.isActive);
  if (query.category) q = q.where('category', '==', query.category);
  // NOTE: removed orderBy — Firestore requires composite index for filter+orderBy.
  // Sorting in JS avoids that entirely.
  const snap = await q.get();
  let results = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));

  // Sort by createdAt desc in JS
  results.sort((a, b) => {
    const ta = a.createdAt?._seconds ?? (a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 0);
    const tb = b.createdAt?._seconds ?? (b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 0);
    return tb - ta;
  });

  // Post-filter for date comparisons
  const now = new Date();
  if (query.validUntil && query.validUntil.$gt) {
    results = results.filter((d) => {
      if (!d.validUntil) return true; // no expiry set → always show
      let v;
      if (d.validUntil instanceof Date) {
        v = d.validUntil;
      } else if (typeof d.validUntil.toDate === 'function') {
        // Firestore Timestamp
        v = d.validUntil.toDate();
      } else if (typeof d.validUntil === 'string' || typeof d.validUntil === 'number') {
        v = new Date(d.validUntil);
      } else {
        return true; // unknown format → show the deal
      }
      return v > now;
    });
  }

  // Pagination
  if (options.skip) results = results.slice(options.skip);
  if (options.limit) results = results.slice(0, options.limit);
  return results;
};

const countDocuments = async (query = {}) => {
  const all = await find(query);
  return all.length;
};

const findByIdAndUpdate = async (id, updates) => {
  const ref = col().doc(id);
  // Handle $inc
  if (updates.$inc) {
    const snap = await ref.get();
    const data = snap.data() || {};
    const incUpdates = {};
    Object.entries(updates.$inc).forEach(([k, v]) => {
      incUpdates[k] = (data[k] || 0) + v;
    });
    await ref.update({ ...incUpdates, updatedAt: new Date() });
  } else if (updates.$set) {
    await ref.update({ ...updates.$set, updatedAt: new Date() });
  } else {
    await ref.update({ ...updates, updatedAt: new Date() });
  }
  const snap = await ref.get();
  return { _id: snap.id, ...snap.data() };
};

const findOneAndUpdate = async (query, updates) => {
  const doc = await findOne(query);
  if (!doc) return null;
  return findByIdAndUpdate(doc._id, updates);
};

const save = async (deal) => {
  const { _id, ...data } = deal;
  return findByIdAndUpdate(_id, { ...data, updatedAt: new Date() });
};

module.exports = {
  create,
  findById,
  findOne,
  find,
  countDocuments,
  findByIdAndUpdate,
  findOneAndUpdate,
  save,
};
