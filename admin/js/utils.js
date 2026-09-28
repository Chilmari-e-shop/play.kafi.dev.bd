// ============================================
// Shared utilities - Final Powerful Version
// ============================================
import { db } from "./firebase.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ---- Toast ----
let toastTimer;
export function toast(message, type = "info") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.className = "toast show " + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.className = "toast " + type;
  }, 2800);
}

// ---- Confirm dialog ----
export function confirmDialog(title, message, okLabel = "Delete") {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal");
    const t = document.getElementById("confirm-title");
    const m = document.getElementById("confirm-message");
    const ok = document.getElementById("confirm-ok");
    const cancel = document.getElementById("confirm-cancel");

    if (!modal || !t || !m || !ok || !cancel) {
      resolve(window.confirm(message));
      return;
    }

    t.textContent = title;
    m.textContent = message;
    ok.textContent = okLabel;
    modal.hidden = false;

    const cleanup = () => {
      modal.hidden = true;
      ok.removeEventListener("click", onOk);
      cancel.removeEventListener("click", onCancel);
      modal.removeEventListener("click", onBackdrop);
    };
    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    const onBackdrop = (e) => { if (e.target === modal) onCancel(); };

    ok.addEventListener("click", onOk);
    cancel.addEventListener("click", onCancel);
    modal.addEventListener("click", onBackdrop);
  });
}

// ---- Date formatting ----
export function formatDate(ts) {
  if (!ts) return "—";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric"
  });
}

export function formatDateTime(ts) {
  if (!ts) return "—";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

// ---- Escape HTML ----
export function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---- URL validation ----
export function isValidUrl(str) {
  if (!str) return false;
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch { return false; }
}

// ---- Categories (Firestore + localStorage fallback) ----
const DEFAULT_CATEGORIES = [
  "Apps", "Games", "Entertainment", "Education", "Tools",
  "Photography", "Music & Audio", "Video Players", "Social",
  "Productivity", "Lifestyle", "Other"
];

export async function getCategories() {
  try {
    const snap = await getDoc(doc(db, "settings", "categories"));
    if (snap.exists() && Array.isArray(snap.data().list) && snap.data().list.length) {
      const list = snap.data().list;
      localStorage.setItem("ps_categories", JSON.stringify(list));
      return list;
    }
  } catch (e) {
    console.warn("Firestore categories read failed, using local", e);
  }
  try {
    const stored = JSON.parse(localStorage.getItem("ps_categories") || "null");
    if (Array.isArray(stored) && stored.length) return stored;
  } catch {}
  return [...DEFAULT_CATEGORIES];
}

export async function saveCategories(list) {
  const clean = list.map(s => s.trim()).filter(Boolean);
  localStorage.setItem("ps_categories", JSON.stringify(clean));
  try {
    await setDoc(doc(db, "settings", "categories"), {
      list: clean,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.warn("Could not save categories to Firestore", e);
    // still saved locally
  }
}

// ---- Populate a <select> with categories ----
export async function fillCategorySelect(selectEl, includeAll = false) {
  if (!selectEl) return;
  const cats = await getCategories();
  selectEl.innerHTML =
    (includeAll ? `<option value="">All Categories</option>` : "") +
    cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
}

// ---- Simple activity log helper ----
export async function logActivity(action, details = {}) {
  try {
    const { addDoc, collection, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const { auth } = await import("./firebase.js");
    await addDoc(collection(db, "logs"), {
      action,
      details,
      by: auth.currentUser?.email || "unknown",
      uid: auth.currentUser?.uid || null,
      at: serverTimestamp()
    });
  } catch (e) {
    // silent fail - logs are optional
  }
}
