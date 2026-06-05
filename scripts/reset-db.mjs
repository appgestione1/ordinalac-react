// Pulizia completa del database Firestore di OrdinaLac
// Uso: node scripts/reset-db.mjs

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDMRWXipp7VCMQiezOZSSZAhSQo8MWVgKs",
  authDomain: "ordinalac.firebaseapp.com",
  projectId: "ordinalac",
  storageBucket: "ordinalac.firebasestorage.app",
  messagingSenderId: "642877461161",
  appId: "1:642877461161:web:6a4d979e7a7ddd56140fb8"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

async function deleteCollection(path) {
  const snap = await getDocs(collection(db, path));
  if (snap.empty) { console.log(`  ${path}: vuota`); return 0; }
  for (const d of snap.docs) await deleteDoc(d.ref);
  console.log(`  ✓ ${path}: ${snap.size} documenti eliminati`);
  return snap.size;
}

async function deleteOpticiansSubcollections() {
  // Elimina optician_config/{id}/lenses/main e documenti padre
  const snap = await getDocs(collection(db, 'optician_config'));
  for (const d of snap.docs) {
    await deleteCollection(`optician_config/${d.id}/lenses`);
    await deleteDoc(d.ref);
  }
  if (!snap.empty) console.log(`  ✓ optician_config: ${snap.size} ottici eliminati`);
}

// Vecchio path usato dall'app HTML originale
async function deleteOldOrders() {
  try {
    await deleteCollection('artifacts/ordinalac-app/public/data/orders');
  } catch (_) {}
}

console.log('\n🗑  Reset database OrdinaLac...\n');
await deleteCollection('orders');
await deleteOldOrders();
await deleteOpticiansSubcollections();
console.log('\n✅ Database pulito.\n');
process.exit(0);
