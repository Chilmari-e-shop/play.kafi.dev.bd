/**
 * Firebase initialization
 * ---------------------------------------------------------
 * Replace the placeholder values below with your own
 * Firebase project configuration from the Firebase Console:
 * Project settings → Your apps → Web app → Config
 *
 * Never commit real production secrets to public repos
 * if your rules are not locked down.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
// import { getStorage } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

// ═══════════════════════════════════════════════════════════
//  PASTE YOUR FIREBASE CONFIG HERE
// ═══════════════════════════════════════════════════════════
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
// ═══════════════════════════════════════════════════════════

let app = null;
let auth = null;
let db = null;
let initialized = false;

/**
 * Initialize Firebase. Call once at app startup.
 * Returns { app, auth, db } or throws if config is still placeholder.
 */
export function initFirebase() {
  if (initialized) {
    return { app, auth, db };
  }

  const isPlaceholder =
    !firebaseConfig.apiKey ||
    firebaseConfig.apiKey === "YOUR_API_KEY" ||
    firebaseConfig.projectId === "YOUR_PROJECT_ID";

  if (isPlaceholder) {
    console.warn(
      "[PlayMarket] Firebase config is still using placeholders. " +
        "Open js/firebase.js and paste your real config."
    );
  }

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  initialized = true;

  return { app, auth, db };
}

export function getDb() {
  if (!db) initFirebase();
  return db;
}

export function getAuthInstance() {
  if (!auth) initFirebase();
  return auth;
}

export function isFirebaseConfigured() {
  return (
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== "YOUR_API_KEY" &&
    firebaseConfig.projectId !== "YOUR_PROJECT_ID"
  );
}