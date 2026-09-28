/**
 * Favorites list page
 */

import { getFavorites } from "./firestore.js";
import { getCurrentUser } from "./auth.js";
import {
  escapeHtml,
  renderIcon,
  emptyState,
  errorState,
  setPageMeta,
  skeletonRow,
} from "./utils.js";
import { navigate } from "./router.js";

export async function showFavorites() {
  const main = document.getElementById("main");
  if (!main) return;

  setPageMeta({ title: "Favorites", description: "Your saved apps" });

  const user = getCurrentUser();
  if (!user) {
    main.innerHTML = emptyState(
      "favorite",
      "Sign in required",
      "Sign in to view and manage your favorite apps."
    );
    const box = main.querySelector(".state-box");
    if (box) {
      const btn = document.createElement("button");
      btn.className = "btn-retry";
      btn.textContent = "Go to profile";
      btn.onclick = () => navigate("/profile");
      box.appendChild(btn);
    }
    return;
  }

  main.innerHTML = `<div class="sec" style="padding-top:12px">
    <div class="sec-h"><h2>Favorites</h2></div>
    <div class="grid" id="favGrid">${skeletonRow(6)}</div>
  </div>`;

  try {
    const apps = await getFavorites(user.uid);
    const grid = document.getElementById("favGrid");
    if (!apps.length) {
      main.innerHTML = emptyState(
        "favorite",
        "No favorites yet",
        "Tap the heart icon on any app to save it here."
      );
      return;
    }
    grid.innerHTML = apps
      .map(
        (a) => `<div class="app-card" data-app-id="${escapeHtml(a.id)}">
          ${renderIcon(a)}
          <div class="app-name">${escapeHtml(a.name)}</div>
          <div class="app-meta"><span class="material-symbols-outlined">star</span> ${
            a.rating ? a.rating.toFixed(1) : "—"
          }</div>
        </div>`
      )
      .join("");
    grid.onclick = (e) => {
      const card = e.target.closest("[data-app-id]");
      if (card) navigate("/app/" + card.dataset.appId);
    };
  } catch (err) {
    main.innerHTML = errorState(err.message);
    document.getElementById("retryBtn")?.addEventListener("click", () => showFavorites());
  }
}
