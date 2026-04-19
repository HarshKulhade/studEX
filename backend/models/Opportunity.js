'use strict';

/**
 * Opportunity service — Firestore-backed replacement for Mongoose Opportunity model.
 * Collection: "opportunities"
 */

const { db } = require('../config/firebase');

const COLLECTION = 'opportunities';
const col = () => db.collection(COLLECTION);

const create = async (data) => {
  const now = new Date();
  const doc = {
    postedBy: data.postedBy || '',
    title: data.title,
    type: data.type,   // 'internship' | 'job' | 'freelance' | 'scholarship' | 'event'
    description: data.description || '',
    location: data.location || '',
    isRemote: data.isRemote || false,
    stipend: data.stipend || null,
    stipendType: data.stipendType || 'monthly',
    applicationLink: data.applicationLink || '',
    deadline: data.deadline || null,
    targetColleges: data.targetColleges || [],
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
  if (query._id) {
    const snap = await col().doc(query._id).get();
    if (!snap.exists) return null;
    const data = { _id: snap.id, ...snap.data() };
    if (query.isActive !== undefined && data.isActive !== query.isActive) return null;
    return data;
  }
  if (query.isActive !== undefined) q = q.where('isActive', '==', query.isActive);
  const snap = await q.limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { _id: doc.id, ...doc.data() };
};

const find = async (query = {}, options = {}) => {
  let q = col();
  if (query.isActive !== undefined) q = q.where('isActive', '==', query.isActive);
  if (query.type) q = q.where('type', '==', query.type);
  q = q.orderBy('createdAt', 'desc');
  const snap = await q.get();
  let results = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));

  // Post-filter for deadline and college
  const now = new Date();
  results = results.filter((o) => {
    if (o.deadline) {
      const d = o.deadline instanceof Date ? o.deadline : o.deadline.toDate();
      if (d < now) return false;
    }
    return true;
  });

  // College filter
  if (query._collegeFilter) {
    results = results.filter(
      (o) => !o.targetColleges.length || o.targetColleges.includes(query._collegeFilter)
    );
  }

  if (options.skip) results = results.slice(options.skip);
  if (options.limit) results = results.slice(0, options.limit);
  return results;
};

const countDocuments = async (query = {}) => {
  const all = await find(query);
  return all.length;
};

module.exports = {
  create,
  findById,
  findOne,
  find,
  countDocuments,
};
