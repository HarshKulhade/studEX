'use strict';

/**
 * MongoDB has been removed. The app now uses Firebase Firestore.
 * This file is kept as a no-op stub so server.js continues to work
 * without changes to the connectDB() call pattern.
 */
const connectDB = async () => {
  // Nothing to connect — Firestore is initialized in config/firebase.js
  return Promise.resolve();
};

module.exports = connectDB;
