'use strict';

/**
 * PrintJob service — Firestore-backed replacement for Mongoose PrintJob model.
 * Collection: "printJobs"
 */

const { db } = require('../config/firebase');

const COLLECTION = 'printJobs';
const col = () => db.collection(COLLECTION);

const create = async (data) => {
  const now = new Date();
  const doc = {
    student: data.student,
    fileUrl: data.fileUrl,
    fileName: data.fileName,
    pageCount: data.pageCount || 1,
    printType: data.printType,   // 'bw' | 'color'
    copies: data.copies || 1,
    paperSize: data.paperSize || 'A4',
    kiosk: data.kiosk || null,
    status: data.status || 'queued',
    totalCost: data.totalCost || 0,
    cashbackEarned: data.cashbackEarned || 0,
    slotTime: data.slotTime || null,
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

const find = async (query = {}, options = {}) => {
  let q = col();
  if (query.student) q = q.where('student', '==', query.student);
  if (query.status) q = q.where('status', '==', query.status);
  const snap = await q.get();
  let results = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));

  results.sort((a, b) => {
    const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
    const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
    return bTime - aTime;
  });

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

module.exports = {
  create,
  findById,
  find,
  countDocuments,
  findByIdAndUpdate,
};
