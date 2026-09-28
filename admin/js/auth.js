// ============================================
// Authentication + Admin guard
// - Powers login.html
// - Guards admin/index.html
// - Requires document: admins/{uid}
// ============================================
import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const isLoginPage = !!document.getElementById("login-form");
const isAdminPage = !!document.querySelector(".sidebar");

async function isAdminUser(user) {
  if (!user) return false;
  try {
    const snap = await getDoc(doc(db, "admins", user.uid));
    return snap.exists();
  } catch (e) {
    console.warn("Admin check failed:", e.message);
    return false;
  }
}

// ---------- LOGIN PAGE ----------
if (isLoginPage) {
  const form = document.getElementById("login-form");
  const emailEl = document.getElementById("login-email");
  const passEl = document.getElementById("login-password");
  const errEl = document.getElementById("login-error");
  const btn = document.getElementById("login-btn");

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    const ok = await isAdminUser(user);
    if (ok) {
      location.href = "index.html";
    } else {
      await signOut(auth);
      if (errEl) {
        errEl.textContent =
          "This account is not an admin. In Firebase Console create collection 'admins' → document ID = your UID.";
      }
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.textContent = "";
    btn.disabled = true;
    btn.textContent = "Signing in…";
    try {
      const cred = await signInWithEmailAndPassword(
        auth,
        emailEl.value.trim(),
        passEl.value
      );
      const ok = await isAdminUser(cred.user);
      if (!ok) {
        await signOut(auth);
        errEl.textContent =
          "Not an admin. Create Firestore doc: admins/" +
          cred.user.uid +
          " with field role = admin";
        btn.disabled = false;
        btn.textContent = "Sign In";
        return;
      }
      location.href = "index.html";
    } catch (err) {
      errEl.textContent = (err.message || "").replace("Firebase: ", "");
      btn.disabled = false;
      btn.textContent = "Sign In";
    }
  });
}

// ---------- ADMIN PAGE ----------
if (isAdminPage) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      location.href = "login.html";
      return;
    }

    const ok = await isAdminUser(user);
    if (!ok) {
      await signOut(auth);
      location.href = "login.html";
      return;
    }

    const emailEl = document.getElementById("user-email");
    const avatarEl = document.getElementById("user-avatar");
    const settingsEmail = document.getElementById("settings-email");
    const settingsUid = document.getElementById("settings-uid");
    if (emailEl) emailEl.textContent = user.email || "";
    if (avatarEl) avatarEl.textContent = (user.email || "A")[0].toUpperCase();
    if (settingsEmail) settingsEmail.value = user.email || "";
    if (settingsUid) settingsUid.value = user.uid;

    const logoutBtn = document.getElementById("logout-btn");
    logoutBtn?.addEventListener("click", async (e) => {
      e.preventDefault();
      await signOut(auth);
      location.href = "login.html";
    });
  });
}
