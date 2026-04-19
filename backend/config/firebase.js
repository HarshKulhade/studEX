'use strict';

const admin = require('firebase-admin');
const path = require('path');

let db;

try {
  if (!admin.apps.length) {
    let serviceAccount;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      // Env-var path: parse JSON and fix escaped newlines in private_key
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
    } else {
      // Fall back to local JSON file (for dev)
      const keyPath = path.join(__dirname, 'serviceAccountKey.json');
      try {
        serviceAccount = require(keyPath);
      } catch (_) {
        console.warn('⚠️  No Firebase credentials found. Firestore will be unavailable.');
        serviceAccount = null;
      }
    }

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      db = admin.firestore();
      console.log('✅ Firebase Admin & Firestore initialized.');
    }
  } else {
    db = admin.firestore();
  }
} catch (error) {
  console.error('Firebase Admin Initialization Error:', error.message);
}

module.exports = { admin, db };
