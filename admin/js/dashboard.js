// ============================================
// Dashboard + Router + Layout
// ============================================
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, onSnapshot, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { esc, formatDate, getCategories, saveCategories, toast, logActivity } from "./utils.js";

let allApps = [];

// ---------- Router ----------
const ROUTES = ["dashboard", "apps", "app-form", "categories", "settings"];

function setRoute(route) {
  ROUTES.forEach(r => {
    const el = document.getElementById("route-" + r);
    if (el) el.hidden = r !== route;
  });
  document.querySelectorAll(".nav-link").forEach(n => {
    n.classList.toggle("active", n.dataset.route === route);
  });
  const titles = {
    dashboard: "Dashboard",
    apps: "Apps",
    "app-form": "App Form",
    categories: "Categories",
    settings: "Settings"
  };
  const pageTitleEl = document.getElementById("page-title");
  if (pageTitleEl) pageTitleEl.textContent = titles[route] || "Dashboard";
  // close mobile sidebar
  document.getElementById("sidebar")?.classList.remove("open");
  document.querySelector(".sidebar-backdrop")?.classList.remove("show");
}

function parseHash() {
  const raw = (location.hash || "#dashboard").slice(1);
  const [path] = raw.split("/");
  if (path === "apps" && raw.startsWith("apps/new")) return "app-form";
  if (path === "apps" && raw.startsWith("apps/edit")) return "app-form";
  if (ROUTES.includes(path)) return path;
  return "dashboard";
}

window.addEventListener("hashchange", () => {
  setRoute(parseHash());
  // Notify form module
  window.dispatchEvent(new CustomEvent("routechange", { detail: parseHash() }));
});

// Quick links
document.getElementById("quick-add-btn")?.addEventListener("click", () => {
  location.hash = "apps/new";
});
document.getElementById("add-app-btn")?.addEventListener("click", () => {
  location.hash = "apps/new";
});

// ---------- Mobile sidebar ----------
const sidebar = document.getElementById("sidebar");
const backdrop = document.createElement("div");
backdrop.className = "sidebar-backdrop";
document.body.appendChild(backdrop);

const hamburger = document.getElementById("hamburger");
if (hamburger && sidebar) {
  hamburger.addEventListener("click", (e) => {
    e.stopPropagation();
    sidebar.classList.toggle("open");
    backdrop.classList.toggle("show");
  });
}

if (sidebar && backdrop) {
  backdrop.addEventListener("click", () => {
    sidebar.classList.remove("open");
    backdrop.classList.remove("show");
  });
}

// Close menu when nav link clicked
document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", () => {
    if (sidebar) sidebar.classList.remove("open");
    backdrop.classList.remove("show");
  });
});

// ---------- Theme toggle ----------
const themeBtn = document.getElementById("theme-toggle");
const savedTheme = localStorage.getItem("ps_theme") || "light";
if (savedTheme === "dark") document.body.classList.add("dark");
if (themeBtn) themeBtn.textContent = savedTheme === "dark" ? "☀️" : "🌙";

themeBtn?.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const dark = document.body.classList.contains("dark");
  localStorage.setItem("ps_theme", dark ? "dark" : "light");
  themeBtn.textContent = dark ? "☀️" : "🌙";
});

// ---------- Categories editor ----------
document.getElementById("save-categories")?.addEventListener("click", async () => {
  const ta = document.getElementById("categories-editor");
  if (!ta) return;
  const lines = ta.value.split("\n").map(s => s.trim()).filter(Boolean);
  if (!lines.length) {
    toast("Please add at least one category", "error");
    return;
  }
  try {
    await saveCategories(lines);
    toast("Categories saved (shared for all admins)", "success");
    logActivity("categories_updated", { count: lines.length });
  } catch (e) {
    toast("Save failed: " + e.message, "error");
  }
});

document.getElementById("reset-categories")?.addEventListener("click", async () => {
  localStorage.removeItem("ps_categories");
  await loadCategoriesEditor();
  toast("Categories reset to default", "success");
});

async function loadCategoriesEditor() {
  const ta = document.getElementById("categories-editor");
  if (ta) {
    const cats = await getCategories();
    ta.value = cats.join("\n");
  }
}

// ---------- Firestore real-time listener ----------
let unsub = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) return; // auth.js redirects

  setRoute(parseHash());
  await loadCategoriesEditor();

  if (unsub) unsub();

  const handleSnap = (snap) => {
    allApps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    allApps.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderStats();
    renderRecent();
    window.dispatchEvent(new CustomEvent("apps-updated", { detail: allApps }));
  };

  const handleErr = (err) => {
    console.error("Firestore error:", err);
    const msg = err.message || "";
    if (msg.includes("permission") || msg.includes("PERMISSION_DENIED") || msg.includes("insufficient")) {
      toast("Permission denied loading apps. Create Firestore doc admins/YOUR_UID then publish the new firestore.rules", "error");
    }
    const appsList = document.getElementById("apps-list");
    if (appsList) {
      appsList.innerHTML = `<div class="empty">Error loading apps: ${esc(msg)}</div>`;
    }
  };

  // First try with orderBy, on failure fall back to unordered
  try {
    const q = query(collection(db, "apps"), orderBy("createdAt", "desc"));
    unsub = onSnapshot(q, handleSnap, (err) => {
      handleErr(err);
      // fallback
      console.warn("Falling back to unordered query");
      unsub = onSnapshot(collection(db, "apps"), handleSnap, handleErr);
    });
  } catch (e) {
    unsub = onSnapshot(collection(db, "apps"), handleSnap, handleErr);
  }
});

// ---------- Stats ----------
function renderStats() {
  const total = allApps.length;
  const published = allApps.filter(a => a.isPublished === true || a.status === "published").length;
  const draft = allApps.filter(a => !(a.isPublished === true || a.status === "published")).length;
  const categories = new Set(allApps.map(a => a.category).filter(Boolean)).size;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set("stat-total", total);
  set("stat-published", published);
  set("stat-draft", draft);
  set("stat-categories", categories);
}

// ---------- Recent ----------
function renderRecent() {
  const byCreated = [...allApps].sort((a, b) => {
    const ta = a.createdAt?.seconds || 0;
    const tb = b.createdAt?.seconds || 0;
    return tb - ta;
  }).slice(0, 5);

  const byUpdated = [...allApps].sort((a, b) => {
    const ta = a.updatedAt?.seconds || 0;
    const tb = b.updatedAt?.seconds || 0;
    return tb - ta;
  }).slice(0, 5);

  const renderList = (list, containerId) => {
    const c = document.getElementById(containerId);
    if (!c) return;
    if (!list.length) { c.innerHTML = `<div class="empty">No apps yet</div>`; return; }
    c.innerHTML = list.map(a => `
      <div class="recent-item">
        <img src="${esc(a.icon || "")}" alt="${esc(a.name || "")}" onerror="this.style.opacity=.2" />
        <div class="info">
          <div class="name">${esc(a.name || "Untitled")}</div>
          <div class="meta">${esc(a.category || "Uncategorized")} · ${formatDate(a.createdAt)}</div>
        </div>
      </div>
    `).join("");
  };

  renderList(byCreated, "recent-added");
  renderList(byUpdated, "recent-updated");
}
