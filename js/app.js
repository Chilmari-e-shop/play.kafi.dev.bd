/**
 * PlayMarket – main application entry
 */

import { initFirebase, isFirebaseConfigured } from "./firebase.js";
import { initAuth, getCurrentUser } from "./auth.js";
import { route, navigate, startRouter, closeOverlays } from "./router.js";
import {
  loadHomeContent,
  loadCategoryPage,
  setActiveTab,
  renderBottomNav,
  renderDesktopNav,
  TAB_CONFIG,
} from "./home.js";
import { initSearch, openSearch, closeSearch } from "./search.js";
import { showAppDetails, closeDetails } from "./app-details.js";
import { showFavorites } from "./favorites.js";
import { showProfile, showSettings } from "./profile.js";
import { recordDownloadAndGetUrl } from "./firestore.js";
import { toast, triggerDownload } from "./utils.js";

function showConfigBanner() {
  if (isFirebaseConfigured()) return;
  const bar = document.createElement("div");
  bar.id = "configBanner";
  bar.style.cssText =
    "background:#fce8e6;color:#c5221f;padding:10px 16px;font-size:13px;text-align:center;z-index:300;position:sticky;top:0";
  bar.innerHTML =
    "<strong>Firebase not configured.</strong> Open <code>js/firebase.js</code> and paste your project config. Until then, data cannot load.";
  document.getElementById("app")?.prepend(bar);
}

function hideChrome(hide) {
  document.getElementById("topbar")?.classList.toggle("hidden", hide);
  document.getElementById("pills")?.classList.toggle("hidden", hide);
  document.getElementById("bottomNav")?.classList.toggle("hidden", hide);
}

function setupRoutes() {
  route("/", async () => {
    closeOverlays();
    closeDetails();
    closeSearch();
    hideChrome(false);
    setActiveTab("games");
    await loadHomeContent();
  });

  route("/games", async () => {
    closeOverlays();
    closeDetails();
    hideChrome(false);
    setActiveTab("games");
    await loadHomeContent();
  });

  route("/apps", async () => {
    closeOverlays();
    closeDetails();
    hideChrome(false);
    setActiveTab("apps");
    await loadHomeContent();
  });

  route("/movies", async () => {
    closeOverlays();
    closeDetails();
    hideChrome(false);
    setActiveTab("movies");
    await loadHomeContent();
  });

  route("/books", async () => {
    closeOverlays();
    closeDetails();
    hideChrome(false);
    setActiveTab("books");
    await loadHomeContent();
  });

  route("/kids", async () => {
    closeOverlays();
    closeDetails();
    hideChrome(false);
    setActiveTab("kids");
    await loadHomeContent();
  });

  route("/app/:id", async ({ params }) => {
    hideChrome(false);
    // Keep home under; show detail overlay
    await showAppDetails(params.id);
  });

  route("/category/:name", async ({ params, query }) => {
    closeDetails();
    closeSearch();
    hideChrome(false);
    await loadCategoryPage(params.name, query.type);
  });

  route("/favorites", async () => {
    closeDetails();
    closeSearch();
    hideChrome(false);
    document.getElementById("pills")?.classList.add("hidden");
    await showFavorites();
  });

  route("/profile", async () => {
    closeDetails();
    closeSearch();
    hideChrome(false);
    document.getElementById("pills")?.classList.add("hidden");
    return showProfile();
  });

  route("/settings", async () => {
    closeDetails();
    closeSearch();
    hideChrome(false);
    document.getElementById("pills")?.classList.add("hidden");
    showSettings();
  });

  route("/search", async ({ query }) => {
    openSearch(query.q || "");
  });
}

/** Global install button handler (list rows on home) */
function bindGlobalDownload() {
  document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-download]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const appId = btn.dataset.download;
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = "…";
    try {
      const url = await recordDownloadAndGetUrl(appId);
      triggerDownload(url);
      toast("Download started");
    } catch (err) {
      toast(err.message || "Download unavailable");
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  });
}

function bindAvatar() {
  document.getElementById("avatarBtn")?.addEventListener("click", () => {
    navigate("/profile");
  });
}

export function boot() {
  try {
    initFirebase();
  } catch (e) {
    console.error(e);
  }

  showConfigBanner();
  initAuth();
  initSearch();
  setupRoutes();
  bindGlobalDownload();
  bindAvatar();
  renderBottomNav();
  renderDesktopNav();
  startRouter();
}

// Auto-start when loaded as module
boot();
