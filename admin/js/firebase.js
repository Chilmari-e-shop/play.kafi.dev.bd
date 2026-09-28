// ============================================
// Firebase Configuration
// Replace with your own project credentials.
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA4MWnDPbPieispJspCvFRO-gzhOuFnjgk",
  authDomain: "playatore-f1446.firebaseapp.com",
  projectId: "playatore-f1446",
  storageBucket: "playatore-f1446.firebasestorage.app",
  messagingSenderId: "321521805779",
  appId: "1:321521805779:web:7406c29785037eb8b62726",
  measurementId: "G-TPWKYK9XGX"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);