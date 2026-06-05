import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDMRWXipp7VCMQiezOZSSZAhSQo8MWVgKs",
  authDomain: "ordinalac.firebaseapp.com",
  projectId: "ordinalac",
  storageBucket: "ordinalac.firebasestorage.app",
  messagingSenderId: "642877461161",
  appId: "1:642877461161:web:6a4d979e7a7ddd56140fb8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
