const { db } = require('./config/firebase');

async function migrateVendors() {
  try {
    const vendorsSnap = await db.collection('vendors').get();
    let updatedCount = 0;

    const batch = db.batch();
    let currentBatchSize = 0;

    for (const doc of vendorsSnap.docs) {
      const data = doc.data();
      if (!data.vendorSecretCode) {
        // Generate a 4 digit secret code
        const vendorSecretCode = Math.floor(1000 + Math.random() * 9000).toString();
        batch.update(doc.ref, { vendorSecretCode, updatedAt: new Date() });
        updatedCount++;
        currentBatchSize++;

        // Firestore batch limits to 500 operations
        if (currentBatchSize >= 400) {
          await batch.commit();
          currentBatchSize = 0;
        }
      }
    }

    if (currentBatchSize > 0) {
      await batch.commit();
    }

    console.log(`Successfully generated vendorSecretCode for ${updatedCount} existing vendors.`);
    process.exit(0);
  } catch (error) {
    console.error('Error updating vendors:', error);
    process.exit(1);
  }
}

migrateVendors();
