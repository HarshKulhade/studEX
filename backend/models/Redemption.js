'use strict';

/**
 * Redemption service — Firestore-backed replacement for Mongoose Redemption model.
 * Collection: "redemptions"
 */

const { db } = require('../config/firebase');

const COLLECTION = 'redemptions';
const col = () => db.collection(COLLECTION);

const create = async (data) => {
  const now = new Date();
  const doc = {
    student: data.student,
    deal: data.deal,
    vendor: data.vendor,
    qrToken: data.qrToken,
    status: data.status || 'generated',
    generatedAt: data.generatedAt || now,
    expiresAt: data.expiresAt,
    redeemedAt: data.redeemedAt || null,
    cashbackAmount: data.cashbackAmount || 0,
    cashbackCredited: data.cashbackCredited || false,
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
  if (query.student) q = q.where('student', '==', query.student);
  if (query.deal) q = q.where('deal', '==', query.deal);
  if (query.vendor) q = q.where('vendor', '==', query.vendor);
  if (query.status) q = q.where('status', '==', query.status);
  if (query.qrToken) q = q.where('qrToken', '==', query.qrToken);
  const snap = await q.limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = { _id: doc.id, ...doc.data() };

  // Filter for expiresAt.$gt
  if (query.expiresAt && query.expiresAt.$gt) {
    const expiresAt = data.expiresAt instanceof Date ? data.expiresAt : data.expiresAt.toDate();
    if (expiresAt <= new Date()) return null;
  }

  return data;
};

const find = async (query = {}, options = {}) => {
  let q = col();
  if (query.student) q = q.where('student', '==', query.student);
  if (query.vendor) q = q.where('vendor', '==', query.vendor);
  if (query.deal) q = q.where('deal', '==', query.deal);
  if (query.status) q = q.where('status', '==', query.status);
  if (query.cashbackCredited !== undefined) q = q.where('cashbackCredited', '==', query.cashbackCredited);
  const snap = await q.get();
  let results = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));

  results.sort((a, b) => {
    const aTime = a.generatedAt?.toDate ? a.generatedAt.toDate() : new Date(a.generatedAt || 0);
    const bTime = b.generatedAt?.toDate ? b.generatedAt.toDate() : new Date(b.generatedAt || 0);
    return bTime - aTime;
  });

  // Post-filter for date ranges
  if (query.redeemedAt) {
    const { $gte, $lt } = query.redeemedAt;
    results = results.filter((r) => {
      if (!r.redeemedAt) return false;
      const d = r.redeemedAt instanceof Date ? r.redeemedAt : r.redeemedAt.toDate();
      return (!$gte || d >= $gte) && (!$lt || d < $lt);
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
  const payload = updates.$set || updates;
  await ref.update({ ...payload, updatedAt: new Date() });
  const snap = await ref.get();
  return { _id: snap.id, ...snap.data() };
};

const save = async (redemption) => {
  const { _id, ...data } = redemption;
  return findByIdAndUpdate(_id, { ...data, updatedAt: new Date() });
};

module.exports = {
  create,
  findById,
  findOne,
  find,
  countDocuments,
  findByIdAndUpdate,
  save,
};
