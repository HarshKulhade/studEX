'use strict';

/**
 * CashbackWallet service — Firestore-backed replacement for Mongoose CashbackWallet model.
 * Collection: "wallets"
 * One document per student (student field = user ID).
 */

const { db } = require('../config/firebase');

const COLLECTION = 'wallets';
const col = () => db.collection(COLLECTION);

const create = async (data) => {
  const now = new Date();
  const doc = {
    student: data.student,
    balance: 0,
    totalEarned: 0,
    totalWithdrawn: 0,
    upiId: data.upiId || null,
    createdAt: now,
    updatedAt: now,
  };
  const ref = await col().add(doc);
  return { _id: ref.id, ...doc };
};

const findOne = async (query) => {
  let q = col();
  if (query.student) q = q.where('student', '==', query.student);
  const snap = await q.limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { _id: doc.id, ...doc.data() };
};

const findById = async (id) => {
  const snap = await col().doc(id).get();
  if (!snap.exists) return null;
  return { _id: snap.id, ...snap.data() };
};

const save = async (wallet) => {
  const { _id, ...data } = wallet;
  const ref = col().doc(_id);
  await ref.update({ ...data, updatedAt: new Date() });
  const snap = await ref.get();
  return { _id: snap.id, ...snap.data() };
};

const findOneAndUpdate = async (query, updates) => {
  const wallet = await findOne(query);
  if (!wallet) return null;
  const ref = col().doc(wallet._id);
  await ref.update({ ...updates, updatedAt: new Date() });
  const snap = await ref.get();
  return { _id: snap.id, ...snap.data() };
};

module.exports = {
  create,
  findOne,
  findById,
  save,
  findOneAndUpdate,
};
