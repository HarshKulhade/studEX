const admin = require('firebase-admin');
require('dotenv').config();

const { db } = require('./config/firebase');

async function migrate() {
  console.log('Starting migration...');
  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();
  
  if (snapshot.empty) {
    console.log('No users found.');
    return;
  }

  const existingIds = new Set(snapshot.docs.map(doc => doc.id));

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const oldId = doc.id;
    const baseName = (data.name || 'user').trim();
    
    // If the ID already matches the baseName or baseName + space + number, we skip
    // A simple check: does the ID start with baseName?
    if (oldId === baseName || oldId.startsWith(baseName + ' ')) {
      console.log(`Skipping ${oldId}, already uses name format.`);
      continue;
    }

    console.log(`Migrating user: ${oldId} -> based on name: ${baseName}`);

    // Generate new ID
    let newId = baseName;
    let counter = 1;
    while (existingIds.has(newId)) {
      newId = `${baseName} ${counter}`;
      counter++;
    }
    
    existingIds.add(newId);

    // 1. Create new User doc
    await db.collection('users').doc(newId).set(data);
    console.log(`  Created new user doc: ${newId}`);

    // 2. Update references in other collections
    const collectionsToUpdate = ['wallets', 'transactions', 'redemptions', 'print_jobs'];
    for (const coll of collectionsToUpdate) {
      const snap = await db.collection(coll).where('student', '==', oldId).get();
      if (!snap.empty) {
        const batch = db.batch();
        snap.docs.forEach(d => {
          batch.update(d.ref, { student: newId });
        });
        await batch.commit();
        console.log(`  Updated ${snap.size} docs in ${coll}`);
      }
    }

    // 3. Delete old user doc
    await db.collection('users').doc(oldId).delete();
    console.log(`  Deleted old user doc: ${oldId}`);
  }

  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch(console.error);
