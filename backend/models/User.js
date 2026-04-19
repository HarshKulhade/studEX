'use strict';

/**
 * User service — Firestore-backed replacement for the Mongoose User model.
 * Collection: "users"
 * Documents are keyed by Firestore auto-ID.
 * firebaseUid is stored as a field and indexed for lookups.
 */

const { db } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

const COLLECTION = 'users';

// ── Helpers ──────────────────────────────────────────────────────────────────

const generateReferralCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

const updateAmbassadorTier = (totalReferrals) => {
  if (totalReferrals >= 30) return 'gold';
  if (totalReferrals >= 15) return 'silver';
  if (totalReferrals >= 5) return 'bronze';
  return 'none';
};

const col = () => db.collection(COLLECTION);

// ── CRUD ─────────────────────────────────────────────────────────────────────

const create = async (data) => {
  const now = new Date();
  const doc = {
    name: data.name,
    email: data.email.toLowerCase().trim(),
    phone: data.phone,
    firebaseUid: data.firebaseUid,
    college: data.college,
    collegeIdImageUrl: data.collegeIdImageUrl || null,
    isVerified: data.isVerified || false,
    verificationStatus: data.verificationStatus || 'unverified',
    location: data.location || { type: 'Point', coordinates: [0, 0] },
    avatarUrl: data.avatarUrl || null,
    referralCode: generateReferralCode(),
    referredBy: data.referredBy || null,
    totalReferrals: 0,
    ambassadorTier: 'none',
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
    if (k !== '$or') q = q.where(k, '==', v);
  });
  const snap = await q.limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { _id: doc.id, ...doc.data() };
};

const findByFirebaseUid = async (uid) => {
  const snap = await col().where('firebaseUid', '==', uid).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { _id: doc.id, ...doc.data() };
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

const findByReferralCode = async (referralCode) => {
  const snap = await col().where('referralCode', '==', referralCode.toUpperCase()).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { _id: doc.id, ...doc.data() };
};

const findByReferredBy = async (referrerId) => {
  const snap = await col().where('referredBy', '==', referrerId).orderBy('createdAt', 'desc').get();
  return snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
};

const findByIdAndUpdate = async (id, updates) => {
  const now = new Date();
  const ref = col().doc(id);
  await ref.update({ ...updates, updatedAt: now });
  const snap = await ref.get();
  return { _id: snap.id, ...snap.data() };
};

const updateById = async (id, updates) => {
  return findByIdAndUpdate(id, updates);
};

const save = async (user) => {
  const { _id, ...data } = user;
  return findByIdAndUpdate(_id, { ...data, updatedAt: new Date() });
};

module.exports = {
  create,
  findById,
  findOne,
  findByFirebaseUid,
  findByEmail,
  findByPhone,
  findByReferralCode,
  findByReferredBy,
  findByIdAndUpdate,
  updateById,
  save,
  updateAmbassadorTier,
};
