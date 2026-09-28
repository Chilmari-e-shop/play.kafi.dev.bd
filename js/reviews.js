/**
 * Reviews module (structure ready for full UI)
 * Collection: apps/{appId}/reviews/{reviewId}
 *
 * Fields:
 *   userId, userName, userPhoto, rating (1-5), text, createdAt, updatedAt
 */

import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getDb } from "./firebase.js";
import { getCurrentUser } from "./auth.js";
import { toast } from "./utils.js";

/**
 * Fetch latest reviews for an app
 */
export async function fetchReviews(appId, max = 20) {
  const db = getDb();
  const q = query(
    collection(db, "apps", appId, "reviews"),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Submit or update the current user's review (one review per user per app)
 */
export async function submitReview(appId, rating, text) {
  const user = getCurrentUser();
  if (!user) {
    toast("Sign in to leave a review");
    throw new Error("Not signed in");
  }
  if (rating < 1 || rating > 5) throw new Error("Rating must be 1–5");

  const db = getDb();
  const ref = doc(db, "apps", appId, "reviews", user.uid);
  const existing = await getDoc(ref);

  await setDoc(
    ref,
    {
      userId: user.uid,
      userName: user.displayName || "User",
      userPhoto: user.photoURL || "",
      rating: Number(rating),
      text: (text || "").trim().slice(0, 2000),
      updatedAt: serverTimestamp(),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true }
  );

  toast(existing.exists() ? "Review updated" : "Review submitted");
  return true;
}

/**
 * Delete own review
 */
export async function deleteReview(appId) {
  const user = getCurrentUser();
  if (!user) throw new Error("Not signed in");
  const db = getDb();
  await deleteDoc(doc(db, "apps", appId, "reviews", user.uid));
  toast("Review deleted");
}
