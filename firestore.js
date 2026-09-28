/**
 * Firestore data access layer
 * All app data comes from the "apps" collection.
 * Only documents with isPublished == true are returned to the user panel.
 *
 * IMPORTANT: Every list query MUST include where("isPublished", "==", true)
 * because Firestore security rules only allow reading published docs.
 * Without that filter the whole query fails with "Missing or insufficient permissions".
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  increment,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getDb } from "./firebase.js";

const APPS = "apps";
const USERS = "users";
const PAGE_SIZE = 20;

/** Normalize a Firestore doc into a plain app object (supports old + new field names) */
function mapApp(snap) {
  if (!snap || !snap.exists()) return null;
  const d = snap.data() || {};

  const isPublished =
    d.isPublished === true ||
    (d.isPublished !== false && d.status === "published");

  return {
    id: snap.id,
    name: d.name || "",
    packageName: d.packageName || "",
    developer: d.developer || "",
    description: d.description || "",
    category: d.category || "",
    type: d.type || "app", // app | game | movie | book | kids
    iconUrl: d.iconUrl || d.icon || "",
    icon: d.icon || d.iconUrl || "",
    bannerUrl: d.bannerUrl || "",
    screenshots: Array.isArray(d.screenshots) ? d.screenshots : [],
    rating: typeof d.rating === "number" ? d.rating : 0,
    reviewCount: d.reviewCount || 0,
    downloadCount: d.downloadCount || d.downloads || 0,
    downloads: d.downloads || d.downloadCount || 0,
    version: d.version || "",
    size: d.size || "",
    ageRating: d.ageRating || "Everyone",
    downloadUrl: d.downloadUrl || d.externalDownloadUrl || "",
    externalDownloadUrl: d.externalDownloadUrl || "",
    isFeatured: !!(d.isFeatured || d.featured),
    featured: !!(d.featured || d.isFeatured),
    isPopular: !!d.isPopular,
    isNew: !!d.isNew,
    isPublished,
    whatsNew: d.whatsNew || d.releaseNotes || "",
    searchKeywords: Array.isArray(d.searchKeywords) ? d.searchKeywords : [],
    nameLower: (d.nameLower || d.name || "").toLowerCase(),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

/**
 * Run a query with progressive fallbacks when composite indexes are missing.
 * Always forces isPublished == true so security rules pass.
 */
async function runAppsQuery(extraConstraints = [], pageSize = PAGE_SIZE, cursor = null) {
  const db = getDb();
  const base = [where("isPublished", "==", true), ...extraConstraints];

  const attempts = [
    // Full query as requested
    () => {
      const c = [...base];
      if (cursor) c.push(startAfter(cursor));
      c.push(limit(pageSize));
      return query(collection(db, APPS), ...c);
    },
    // Drop secondary orderBy (often the missing index)
    () => {
      const filtered = base.filter((x, i, arr) => {
        // keep first orderBy only
        if (x.type === "orderBy") {
          return arr.findIndex((y) => y.type === "orderBy") === i;
        }
        return true;
      });
      if (cursor) filtered.push(startAfter(cursor));
      filtered.push(limit(pageSize));
      return query(collection(db, APPS), ...filtered);
    },
    // Only isPublished + limit (always works if rules are correct)
    () => {
      const c = [where("isPublished", "==", true)];
      if (cursor) c.push(startAfter(cursor));
      c.push(limit(pageSize));
      return query(collection(db, APPS), ...c);
    },
  ];

  let lastError = null;
  for (const build of attempts) {
    try {
      const q = build();
      const snap = await getDocs(q);
      const items = snap.docs.map(mapApp).filter((a) => a && a.isPublished);
      const lastDoc = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
      return {
        items,
        lastDoc,
        hasMore: snap.docs.length === pageSize,
      };
    } catch (err) {
      lastError = err;
      const msg = (err && err.message) || "";
      // Only retry on index / permission style failures
      if (
        msg.includes("index") ||
        msg.includes("requires an index") ||
        msg.includes("PERMISSION_DENIED") ||
        msg.includes("Missing or insufficient permissions")
      ) {
        console.warn("[fetchApps] query failed, trying simpler query:", msg);
        continue;
      }
      throw err;
    }
  }

  console.error("[fetchApps] all query attempts failed:", lastError);
  return { items: [], lastDoc: null, hasMore: false };
}

/**
 * Fetch published apps with optional filters + pagination.
 * @param {Object} opts
 * @param {string} [opts.type] - app | game | movie | book | kids
 * @param {string} [opts.category]
 * @param {boolean} [opts.featured]
 * @param {boolean} [opts.popular]
 * @param {boolean} [opts.isNew]
 * @param {string} [opts.orderField] - downloadCount | rating | updatedAt | name
 * @param {string} [opts.orderDir] - desc | asc
 * @param {number} [opts.pageSize]
 * @param {import('firebase/firestore').QueryDocumentSnapshot} [opts.cursor]
 */
export async function fetchApps(opts = {}) {
  const pageSize = opts.pageSize || PAGE_SIZE;
  const orderField = opts.orderField || "downloadCount";
  const orderDir = opts.orderDir || "desc";

  const extra = [];
  if (opts.type) extra.push(where("type", "==", opts.type));
  if (opts.category) extra.push(where("category", "==", opts.category));
  if (opts.featured) extra.push(where("isFeatured", "==", true));
  if (opts.popular) extra.push(where("isPopular", "==", true));
  if (opts.isNew) extra.push(where("isNew", "==", true));

  extra.push(orderBy(orderField, orderDir));
  if (orderField !== "name") {
    extra.push(orderBy("name", "asc"));
  }

  return runAppsQuery(extra, pageSize, opts.cursor || null);
}

/** Single app by document ID */
export async function fetchAppById(appId) {
  if (!appId) return null;
  const db = getDb();
  try {
    const snap = await getDoc(doc(db, APPS, appId));
    const app = mapApp(snap);
    if (!app || !app.isPublished) return null;
    return app;
  } catch (err) {
    console.error("[fetchAppById]", err);
    return null;
  }
}

/**
 * Prefix / keyword search.
 * Requires composite indexes for best results; falls back gracefully.
 */
export async function searchApps(term, pageSize = 20) {
  const q = (term || "").trim().toLowerCase();
  if (!q || q.length < 1) return { items: [], lastDoc: null, hasMore: false };

  const db = getDb();
  const results = new Map();

  // 1) Prefix on nameLower + isPublished
  try {
    const end = q + "\uf8ff";
    const nameQ = query(
      collection(db, APPS),
      where("isPublished", "==", true),
      where("nameLower", ">=", q),
      where("nameLower", "<=", end),
      orderBy("nameLower"),
      limit(pageSize)
    );
    const nameSnap = await getDocs(nameQ);
    nameSnap.docs.forEach((d) => {
      const app = mapApp(d);
      if (app && app.isPublished) results.set(d.id, app);
    });
  } catch (e) {
    console.warn("[search] nameLower query failed (index missing?):", e.message);
  }

  // 2) Keyword token
  const token = q.split(/\s+/)[0];
  if (token.length >= 2) {
    try {
      const kwQ = query(
        collection(db, APPS),
        where("isPublished", "==", true),
        where("searchKeywords", "array-contains", token),
        orderBy("downloadCount", "desc"),
        limit(pageSize)
      );
      const kwSnap = await getDocs(kwQ);
      kwSnap.docs.forEach((d) => {
        const app = mapApp(d);
        if (app && app.isPublished && !results.has(d.id)) {
          results.set(d.id, app);
        }
      });
    } catch (e) {
      console.warn("[search] keywords query failed:", e.message);
    }
  }

  // 3) Fallback: load some published apps and filter client-side
  if (results.size === 0) {
    try {
      const { items } = await runAppsQuery([], 50);
      const lower = q;
      items.forEach((a) => {
        if (
          a.nameLower.includes(lower) ||
          (a.developer || "").toLowerCase().includes(lower) ||
          (a.category || "").toLowerCase().includes(lower) ||
          (a.packageName || "").toLowerCase().includes(lower) ||
          (a.searchKeywords || []).some((k) => String(k).toLowerCase().includes(lower))
        ) {
          results.set(a.id, a);
        }
      });
    } catch (e) {
      console.warn("[search] fallback failed:", e.message);
    }
  }

  let items = Array.from(results.values());
  return { items: items.slice(0, pageSize), lastDoc: null, hasMore: false };
}

/**
 * Atomically increment download count then return the download URL.
 */
export async function recordDownloadAndGetUrl(appId) {
  const db = getDb();
  const ref = doc(db, APPS, appId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("App not found");
  const data = snap.data();

  const published =
    data.isPublished === true ||
    (data.isPublished !== false && data.status === "published");
  if (!published) throw new Error("App is not available");

  const url = data.downloadUrl || data.externalDownloadUrl;
  if (!url) throw new Error("No download URL configured for this app");

  try {
    await updateDoc(ref, {
      downloadCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    // Non-fatal – still return the URL so download works
    console.warn("[download] count increment failed:", e.message);
  }

  return url;
}

/** Distinct categories from published apps */
export async function fetchCategories(type) {
  const db = getDb();
  try {
    const constraints = [where("isPublished", "==", true)];
    if (type) constraints.push(where("type", "==", type));
    constraints.push(limit(100));

    let snap;
    try {
      const q = query(collection(db, APPS), ...constraints);
      snap = await getDocs(q);
    } catch (e) {
      // Fallback without type filter
      const q2 = query(
        collection(db, APPS),
        where("isPublished", "==", true),
        limit(100)
      );
      snap = await getDocs(q2);
    }

    const map = new Map();
    snap.docs.forEach((d) => {
      const app = mapApp(d);
      if (app && app.isPublished) {
        const cat = app.category;
        if (cat) map.set(cat, (map.get(cat) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  } catch (e) {
    console.error("[fetchCategories]", e);
    return [];
  }
}

/* ───────────── User-specific data ───────────── */

export async function ensureUserProfile(user) {
  if (!user) return;
  const db = getDb();
  const ref = doc(db, USERS, user.uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || "",
        photoURL: user.photoURL || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (e) {
    console.warn("ensureUserProfile:", e.message);
  }
}

export async function getFavorites(uid) {
  if (!uid) return [];
  const db = getDb();
  try {
    const snap = await getDocs(collection(db, USERS, uid, "favorites"));
    const ids = snap.docs.map((d) => d.id);
    if (!ids.length) return [];

    const apps = [];
    for (const id of ids.slice(0, 50)) {
      const app = await fetchAppById(id);
      if (app) apps.push(app);
    }
    return apps;
  } catch (e) {
    console.error("[getFavorites]", e);
    return [];
  }
}

export async function toggleFavorite(uid, appId, currentlyFav) {
  const db = getDb();
  const ref = doc(db, USERS, uid, "favorites", appId);
  if (currentlyFav) {
    await deleteDoc(ref);
    return false;
  }
  await setDoc(ref, { appId, addedAt: serverTimestamp() });
  return true;
}

export async function isFavorite(uid, appId) {
  if (!uid || !appId) return false;
  const db = getDb();
  try {
    const snap = await getDoc(doc(db, USERS, uid, "favorites", appId));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function addToHistory(uid, appId) {
  if (!uid || !appId) return;
  const db = getDb();
  try {
    const ref = doc(db, USERS, uid, "history", appId);
    await setDoc(ref, { appId, viewedAt: serverTimestamp() }, { merge: true });
  } catch (e) {
    console.warn("addToHistory:", e.message);
  }
}

export { PAGE_SIZE, serverTimestamp, Timestamp };
