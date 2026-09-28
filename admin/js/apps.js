// ============================================
// Apps List — search / filter / sort / delete
// Uses isPublished + isFeatured (with legacy fallbacks)
// ============================================
import { db } from "./firebase.js";
import {
  doc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { esc, formatDate, toast, confirmDialog, fillCategorySelect, logActivity } from "./utils.js";

let apps = [];
let filtered = [];

const listEl = document.getElementById("apps-list");
const searchEl = document.getElementById("apps-search");
const catEl = document.getElementById("filter-category");
const statusEl = document.getElementById("filter-status");
const featuredEl = document.getElementById("filter-featured");
const sortEl = document.getElementById("sort-by");

fillCategorySelect(catEl, true).catch(console.warn);

window.addEventListener("apps-updated", (e) => {
  apps = e.detail || [];
  applyFilters();
});

[searchEl, catEl, statusEl, featuredEl, sortEl].forEach(el => {
  el?.addEventListener("input", applyFilters);
});

function isPublishedApp(a) {
  return a.isPublished === true || a.status === "published";
}

function isFeaturedApp(a) {
  return !!(a.isFeatured || a.featured);
}

function applyFilters() {
  const q = (searchEl?.value || "").toLowerCase().trim();
  const cat = catEl?.value || "";
  const status = statusEl?.value || "";
  const featured = featuredEl?.value || "";
  const sort = sortEl?.value || "newest";

  filtered = apps.filter(a => {
    if (q) {
      const hay = [a.name, a.developer, a.packageName]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (cat && a.category !== cat) return false;
    if (status === "published" && !isPublishedApp(a)) return false;
    if (status === "draft" && isPublishedApp(a)) return false;
    if (featured === "true" && !isFeaturedApp(a)) return false;
    if (featured === "false" && isFeaturedApp(a)) return false;
    return true;
  });

  const ts = (t) => t?.seconds || 0;
  switch (sort) {
    case "oldest":
      filtered.sort((a, b) => ts(a.createdAt) - ts(b.createdAt));
      break;
    case "name-asc":
      filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      break;
    case "name-desc":
      filtered.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
      break;
    case "rating":
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    default:
      filtered.sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
  }

  render();
}

function render() {
  if (!listEl) return;
  if (!filtered.length) {
    listEl.innerHTML = `<div class="empty">No apps found. Try adjusting filters.</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(a => {
    const published = isPublishedApp(a);
    const featured = isFeaturedApp(a);
    const icon = a.iconUrl || a.icon || "";
    return `
    <div class="app-row" data-id="${a.id}">
      <img src="${esc(icon)}" alt="${esc(a.name || "App")}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><rect fill=%22%23e0e3e7%22 width=%2260%22 height=%2260%22/></svg>'" />
      <div>
        <div class="cell-name">${esc(a.name || "Untitled")}</div>
        <div class="cell-sub">${esc(a.developer || "—")} · ${esc(a.type || "app")}</div>
      </div>
      <div class="cell cell-hide-sm">${esc(a.category || "—")}</div>
      <div class="cell cell-hide-sm">v${esc(a.version || "—")}</div>
      <div class="cell">
        <span class="badge badge-${published ? "published" : "draft"}">${published ? "published" : "draft"}</span>
        ${featured ? `<span class="badge badge-featured">★</span>` : ""}
      </div>
      <div class="cell cell-hide-md">${formatDate(a.updatedAt)}</div>
      <div class="row-actions">
        <button class="btn btn-ghost btn-sm" data-action="view">View</button>
        <button class="btn btn-outline btn-sm" data-action="edit">Edit</button>
        <button class="btn btn-ghost btn-sm" data-action="toggle">${published ? "Unpublish" : "Publish"}</button>
        <button class="btn btn-danger btn-sm" data-action="delete">Delete</button>
      </div>
    </div>`;
  }).join("");

  listEl.querySelectorAll(".app-row").forEach(row => {
    const id = row.dataset.id;
    row.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", () => handleAction(btn.dataset.action, id));
    });
  });
}

async function handleAction(action, id) {
  const app = apps.find(a => a.id === id);
  if (!app) return;

  if (action === "edit") {
    location.hash = `apps/edit/${id}`;
    return;
  }

  if (action === "view") {
    window.dispatchEvent(new CustomEvent("open-preview", { detail: app }));
    return;
  }

  if (action === "toggle") {
    try {
      const currentlyPublished = isPublishedApp(app);
      const newPublished = !currentlyPublished;
      await updateDoc(doc(db, "apps", id), {
        isPublished: newPublished,
        status: newPublished ? "published" : "draft",
        updatedAt: serverTimestamp()
      });
      toast(newPublished ? "App published" : "App unpublished", "success");
      logActivity("app_status_changed", {
        id,
        name: app.name,
        isPublished: newPublished
      });
    } catch (err) {
      toast("Failed: " + err.message, "error");
    }
    return;
  }

  if (action === "delete") {
    const ok = await confirmDialog(
      "Delete App",
      `Are you sure you want to delete "${app.name}"? This cannot be undone.`,
      "Delete"
    );
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "apps", id));
      toast("App deleted", "success");
      logActivity("app_deleted", { id, name: app.name });
    } catch (err) {
      toast("Failed: " + err.message, "error");
    }
  }
}
