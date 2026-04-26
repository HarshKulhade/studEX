'use strict';

/**
 * Transaction service — Firestore-backed replacement for Mongoose Transaction model.
 * Collection: "transactions"
 */

const { db } = require('../config/firebase');

const COLLECTION = 'transactions';
const col = () => db.collection(COLLECTION);

const create = async (data) => {
  const now = new Date();
  const doc = {
    wallet: data.wallet || null,
    student: data.student,
    type: data.type,        // 'credit' | 'debit'
    amount: data.amount,
    source: data.source,   // 'deal_redemption' | 'referral' | 'print_job' | 'withdrawal'
    referenceId: data.referenceId || null,
    description: data.description || '',
    createdAt: now,
    updatedAt: now,
  };
  const ref = await col().add(doc);
  return { _id: ref.id, ...doc };
};

const find = async (query = {}, options = {}) => {
  let q = col();
  if (query.student) q = q.where('student', '==', query.student);
  if (query.type) q = q.where('type', '==', query.type);
  if (query.source) q = q.where('source', '==', query.source);
  if (query.referenceId) q = q.where('referenceId', '==', query.referenceId);
  // NOTE: orderBy on a filtered field requires a Firestore composite index.
  // Sorting in JS avoids that requirement entirely.
  const snap = await q.get();
  let results = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
  // Sort descending by createdAt in JS
  results.sort((a, b) => {
    const ta = a.createdAt?._seconds ?? (a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 0);
    const tb = b.createdAt?._seconds ?? (b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 0);
    return tb - ta;
  });
  if (options.skip) results = results.slice(options.skip);
  if (options.limit) results = results.slice(0, options.limit);
  return results;
};

const countDocuments = async (query = {}) => {
  const all = await find(query);
  return all.length;
};

/**
 * Simple aggregation: sum of amounts grouped by student & source.
 * Returns [{ _id: null, totalEarned, count }] to mimic Mongoose aggregate.
 */
const aggregate = async (pipeline) => {
  // Extract $match stage
  const matchStage = pipeline.find((s) => s.$match);
  const query = matchStage ? matchStage.$match : {};

  const transactions = await find(query);

  // Calculate totals
  const totalEarned = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const count = transactions.length;

  return [{ _id: null, totalEarned, count }];
};

module.exports = {
  create,
  find,
  countDocuments,
  aggregate,
};
