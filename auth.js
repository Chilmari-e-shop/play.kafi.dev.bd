/**
 * Firebase Authentication helpers
 */

import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getAuthInstance } from "./firebase.js";
import { ensureUserProfile } from "./firestore.js";
import { toast } from "./utils.js";

let currentUser = null;
const listeners = new Set();

export function getCurrentUser() {
  return currentUser;
}

export function onUserChanged(cb) {
  listeners.add(cb);
  cb(currentUser);
  return () => listeners.delete(cb);
}

function notify() {
  listeners.forEach((cb) => {
    try {
      cb(currentUser);
    } catch (e) {
      console.error(e);
    }
  });
}

export function initAuth() {
  const auth = getAuthInstance();
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      try {
        await ensureUserProfile(user);
      } catch (e) {
        console.warn("ensureUserProfile:", e.message);
      }
    }
    notify();
    updateAvatarUI(user);
  });
}

function updateAvatarUI(user) {
  const avatars = document.querySelectorAll("[data-avatar]");
  avatars.forEach((el) => {
    if (user) {
      if (user.photoURL) {
        el.innerHTML = `<img src="${user.photoURL}" alt="" />`;
      } else {
        const letter = (user.displayName || user.email || "U")[0].toUpperCase();
        el.textContent = letter;
      }
      el.title = user.displayName || user.email || "Account";
    } else {
      el.textContent = "G";
      el.title = "Sign in";
      el.innerHTML = "G";
    }
  });
}

export async function signInWithGoogle() {
  const auth = getAuthInstance();
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    toast("Signed in successfully");
    return result.user;
  } catch (e) {
    console.error(e);
    if (e.code !== "auth/popup-closed-by-user") {
      toast(e.message || "Sign-in failed");
    }
    throw e;
  }
}

export async function signInEmail(email, password) {
  const auth = getAuthInstance();
  const result = await signInWithEmailAndPassword(auth, email, password);
  toast("Signed in");
  return result.user;
}

export async function registerEmail(email, password, displayName) {
  const auth = getAuthInstance();
  const result = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(result.user, { displayName });
  }
  toast("Account created");
  return result.user;
}

export async function logout() {
  const auth = getAuthInstance();
  await signOut(auth);
  toast("Signed out");
}
