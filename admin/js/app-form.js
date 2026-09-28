// ============================================
// Add / Edit App Form + Preview + ImgBB Upload
// ============================================
import { db } from "./firebase.js";
import {
  doc, getDoc, addDoc, updateDoc, collection, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  esc, toast, isValidUrl, fillCategorySelect, logActivity
} from "./utils.js";

// ImgBB API Key
const IMGBB_KEY = "97d4b640c4eade4d075a2ac53a11d668";

async function uploadToImgbb(file) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Please select an image file");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Image too large (max 8MB)");
  }
  const formData = new FormData();
  formData.append("image", file);
  formData.append("key", IMGBB_KEY);

  const res = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: formData
  });
  const json = await res.json();
  if (!json.success || !json.data?.url) {
    throw new Error(json.error?.message || "ImgBB upload failed");
  }
  return json.data.url; // direct image URL
}

// Elements
const form = document.getElementById("app-form");
const saveBtn = document.getElementById("save-btn");
const cancelBtn = document.getElementById("cancel-form-btn");
const previewBtn = document.getElementById("preview-btn");
const shotsList = document.getElementById("screenshots-list");
const addShotBtn = document.getElementById("add-screenshot-btn");
const iconInput = document.getElementById("f-icon");
const iconPreview = document.getElementById("icon-preview");
const iconUpload = document.getElementById("icon-upload");

// Populate categories
fillCategorySelect(document.getElementById("f-category")).catch(console.warn);

// ---------- Icon preview + upload ----------
function updateIconPreview() {
  if (!iconInput || !iconPreview) return;
  const url = iconInput.value.trim();
  if (isValidUrl(url)) {
    iconPreview.innerHTML = `<img src="${esc(url)}" alt="Icon preview" style="max-width:80px; max-height:80px; border-radius:12px;" />`;
  } else {
    iconPreview.innerHTML = `<span class="muted">Preview appears here</span>`;
  }
}

if (iconInput && iconPreview) {
  iconInput.addEventListener("input", updateIconPreview);
}

if (iconUpload) {
  iconUpload.addEventListener("change", async () => {
    const file = iconUpload.files?.[0];
    if (!file) return;
    const btn = iconUpload.closest("label");
    try {
      if (btn) btn.classList.add("uploading");
      toast("Uploading icon…", "info");
      const url = await uploadToImgbb(file);
      if (iconInput) {
        iconInput.value = url;
        updateIconPreview();
      }
      toast("Icon uploaded successfully", "success");
    } catch (err) {
      console.error(err);
      toast("Icon upload failed: " + err.message, "error");
    } finally {
      if (btn) btn.classList.remove("uploading");
      iconUpload.value = "";
    }
  });
}

// ---------- Screenshots ----------
function addScreenshotRow(value = "") {
  if (!shotsList) return;
  const row = document.createElement("div");
  row.className = "screenshot-row";
  row.innerHTML = `
    <input type="url" class="input shot-url" placeholder="Image URL or upload →" value="${esc(value)}" />
    <label class="btn btn-outline btn-sm upload-btn">
      📷
      <input type="file" class="shot-upload" accept="image/*" hidden />
    </label>
    <img class="shot-preview" alt="Screenshot preview" />
    <button type="button" class="remove-btn" title="Remove">×</button>
  `;
  const input = row.querySelector(".shot-url");
  const img = row.querySelector(".shot-preview");
  const fileInput = row.querySelector(".shot-upload");
  const uploadLabel = row.querySelector(".upload-btn");

  const updatePreview = () => {
    const url = input.value.trim();
    if (isValidUrl(url)) {
      img.src = url;
      img.style.display = "block";
    } else {
      img.removeAttribute("src");
      img.style.display = "none";
    }
  };

  input.addEventListener("input", updatePreview);
  row.querySelector(".remove-btn").addEventListener("click", () => row.remove());

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      uploadLabel.classList.add("uploading");
      toast("Uploading screenshot…", "info");
      const url = await uploadToImgbb(file);
      input.value = url;
      updatePreview();
      toast("Screenshot uploaded", "success");
    } catch (err) {
      console.error(err);
      toast("Upload failed: " + err.message, "error");
    } finally {
      uploadLabel.classList.remove("uploading");
      fileInput.value = "";
    }
  });

  shotsList.appendChild(row);
  updatePreview();
}

if (addShotBtn) {
  addShotBtn.addEventListener("click", () => addScreenshotRow());
}
if (shotsList) {
  addScreenshotRow(); // start with one
}

// ---------- Route: open form for new / edit ----------
function parseEditId() {
  const h = (location.hash || "").slice(1);
  const m = h.match(/^apps\/edit\/(.+)$/);
  return m ? m[1] : null;
}

async function loadForEdit(id) {
  try {
    const snap = await getDoc(doc(db, "apps", id));
    if (!snap.exists()) {
      toast("App not found", "error");
      return;
    }
    const data = snap.data();

    const setFieldValue = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value || "";
    };

    document.getElementById("app-id").value = id;
    setFieldValue("f-name", data.name);
    setFieldValue("f-shortDescription", data.shortDescription);
    setFieldValue("f-description", data.description);
    setFieldValue("f-icon", data.iconUrl || data.icon); // Support both names
    updateIconPreview();
    setFieldValue("f-downloadUrl", data.downloadUrl);
    setFieldValue("f-version", data.version);
    setFieldValue("f-size", data.size);
    setFieldValue("f-developer", data.developer);
    setFieldValue("f-packageName", data.packageName);
    setFieldValue("f-minAndroidVersion", data.minAndroidVersion);
    setFieldValue("f-category", data.category);

    const ratingEl = document.getElementById("f-rating");
    if (ratingEl) ratingEl.value = data.rating ?? "";

    const downloadsEl = document.getElementById("f-downloads");
    if (downloadsEl) downloadsEl.value = data.downloadCount ?? data.downloads ?? "";

    setFieldValue("f-developerWebsite", data.developerWebsite);
    setFieldValue("f-privacyUrl", data.privacyUrl);
    setFieldValue("f-releaseNotes", data.releaseNotes);
    setFieldValue("f-tags", (data.tags || []).join(", "));

    const featuredEl = document.getElementById("f-featured");
    if (featuredEl) featuredEl.checked = !!(data.isFeatured || data.featured);

    const popularEl = document.getElementById("f-popular");
    if (popularEl) popularEl.checked = !!data.isPopular;

    const newEl = document.getElementById("f-new");
    if (newEl) newEl.checked = !!data.isNew;

    setFieldValue("f-type", data.type || "app");

    const published = data.isPublished === true || data.status === "published";
    setFieldValue("f-status", published ? "published" : "draft");

    if (shotsList) {
      shotsList.innerHTML = "";
      (data.screenshots || []).forEach(url => addScreenshotRow(url));
      if (!(data.screenshots || []).length) addScreenshotRow();
    }

    const pageTitle = document.getElementById("page-title");
    if (pageTitle) pageTitle.textContent = "Edit App";
    if (saveBtn) saveBtn.textContent = "Update App";
  } catch (err) {
    console.error("Load error:", err);
    toast("Load failed: " + err.message, "error");
  }
}

function resetForNew() {
  if (form) form.reset();
  const appIdEl = document.getElementById("app-id");
  if (appIdEl) appIdEl.value = "";
  if (shotsList) {
    shotsList.innerHTML = "";
    addScreenshotRow();
  }
  if (iconPreview) iconPreview.innerHTML = `<span class="muted">Preview appears here</span>`;
  const pageTitle = document.getElementById("page-title");
  if (pageTitle) pageTitle.textContent = "Add New App";
  if (saveBtn) saveBtn.textContent = "Save App";
}

window.addEventListener("routechange", (e) => {
  if (e.detail === "app-form") {
    const id = parseEditId();
    if (id) loadForEdit(id);
    else resetForNew();
  }
});

// ---------- Cancel ----------
if (cancelBtn) {
  cancelBtn.addEventListener("click", () => {
    if (confirm("Discard changes?")) location.hash = "apps";
  });
}

// ---------- Collect form data ----------
function collectData() {
  const shots = [...document.querySelectorAll(".shot-url")]
    .map(i => i.value.trim()).filter(Boolean);

  const tagsEl = document.getElementById("f-tags");
  const tags = (tagsEl?.value || "")
    .split(",").map(s => s.trim()).filter(Boolean);

  const statusField = document.getElementById("f-status")?.value || "draft";
  const isPublished = statusField === "published";
  const name = document.getElementById("f-name")?.value?.trim() || "";
  const nameLower = name.toLowerCase();

  // Build search keywords from name + tags + package
  const pkg = document.getElementById("f-packageName")?.value?.trim() || "";
  const keywords = new Set();
  nameLower.split(/\s+/).filter(Boolean).forEach(w => keywords.add(w));
  tags.forEach(t => keywords.add(t.toLowerCase()));
  if (pkg) keywords.add(pkg.toLowerCase());

  return {
    name,
    nameLower,
    shortDescription: document.getElementById("f-shortDescription")?.value?.trim() || "",
    description: document.getElementById("f-description")?.value?.trim() || "",
    iconUrl: document.getElementById("f-icon")?.value?.trim() || "",
    icon: document.getElementById("f-icon")?.value?.trim() || "",
    screenshots: shots,
    downloadUrl: document.getElementById("f-downloadUrl")?.value?.trim() || "",
    version: document.getElementById("f-version")?.value?.trim() || "",
    size: document.getElementById("f-size")?.value?.trim() || "",
    developer: document.getElementById("f-developer")?.value?.trim() || "",
    packageName: pkg,
    minAndroidVersion: document.getElementById("f-minAndroidVersion")?.value?.trim() || "",
    category: document.getElementById("f-category")?.value || "",
    type: document.getElementById("f-type")?.value || "app",
    rating: parseFloat(document.getElementById("f-rating")?.value) || 0,
    downloadCount: parseInt(document.getElementById("f-downloads")?.value, 10) || 0,
    downloads: parseInt(document.getElementById("f-downloads")?.value, 10) || 0,
    developerWebsite: document.getElementById("f-developerWebsite")?.value?.trim() || "",
    privacyUrl: document.getElementById("f-privacyUrl")?.value?.trim() || "",
    releaseNotes: document.getElementById("f-releaseNotes")?.value?.trim() || "",
    whatsNew: document.getElementById("f-releaseNotes")?.value?.trim() || "",
    tags,
    searchKeywords: Array.from(keywords),
    isFeatured: document.getElementById("f-featured")?.checked || false,
    featured: document.getElementById("f-featured")?.checked || false,
    isPopular: document.getElementById("f-popular")?.checked || false,
    isNew: document.getElementById("f-new")?.checked || false,
    isPublished,
    status: statusField
  };
}

// ---------- Validate ----------
function validate(data) {
  if (!data.name || data.name.trim().length === 0) return "App name is required.";
  if (!data.description || data.description.trim().length === 0) return "Description is required.";
  if (!isValidUrl(data.iconUrl)) return "A valid icon URL is required (or upload an image).";
  if (!isValidUrl(data.downloadUrl)) return "A valid download URL is required.";
  if (!data.category || data.category.trim().length === 0) return "Category is required.";
  return null;
}

// ---------- Submit ----------
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = collectData();
    const err = validate(data);
    if (err) {
      toast(err, "error");
      return;
    }

    const id = document.getElementById("app-id")?.value || "";
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = id ? "Updating…" : "Saving…";
    }

    const safety = setTimeout(() => {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = id ? "Update App" : "Save App";
      }
      toast("Save is taking too long. Check internet / Firebase rules / console (F12).", "error");
    }, 15000);

    try {
      if (id) {
        await updateDoc(doc(db, "apps", id), {
          ...data,
          updatedAt: serverTimestamp()
        });
        clearTimeout(safety);
        toast("App updated successfully", "success");
        logActivity("app_updated", { id, name: data.name });
      } else {
        await addDoc(collection(db, "apps"), {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        clearTimeout(safety);
        toast("App created successfully", "success");
        logActivity("app_created", { name: data.name });
      }
      setTimeout(() => { location.hash = "apps"; }, 600);
    } catch (err) {
      clearTimeout(safety);
      console.error("Save error:", err);
      let msg = err.message || "Unknown error";
      if (msg.includes("permission") || msg.includes("PERMISSION_DENIED") || msg.includes("insufficient")) {
        msg = "Permission denied. 1) Publish new firestore.rules  2) Create doc admins/{your-UID} in Firestore";
      }
      toast("Save failed: " + msg, "error");
    } finally {
      clearTimeout(safety);
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = id ? "Update App" : "Save App";
      }
    }
  });
}

// ---------- Preview ----------
function openPreview(app) {
  const modal = document.getElementById("preview-modal");
  const content = document.getElementById("preview-content");
  if (!modal || !content) return;

  const shots = (app.screenshots || []).filter(Boolean);
  content.innerHTML = `
    <div class="preview-app">
      <img src="${esc(app.iconUrl||app.icon||"")}" alt="${esc(app.name || "App")}" onerror="this.style.opacity=.2" />
      <div>
        <h2>${esc(app.name||"Untitled")}</h2>
        <div class="dev">${esc(app.developer||"—")}</div>
        <div class="preview-stats">
          <span>⭐ ${esc(app.rating ?? "—")}</span>
          <span>⬇ ${esc(app.downloadCount ?? app.downloads ?? "—")}</span>
          <span>${esc(app.size||"—")}</span>
        </div>
      </div>
    </div>
    ${shots.length ? `
      <div class="preview-screenshots">
        ${shots.map(s => `<img src="${esc(s)}" alt="Screenshot" onerror="this.style.opacity=.2" />`).join("")}
      </div>` : ""}
    <div class="preview-meta">
      <div><div class="label">Version</div><div class="value">${esc(app.version||"—")}</div></div>
      <div><div class="label">Category</div><div class="value">${esc(app.category||"—")}</div></div>
      <div><div class="label">Min Android</div><div class="value">${esc(app.minAndroidVersion||"—")}</div></div>
      <div><div class="label">Package</div><div class="value">${esc(app.packageName||"—")}</div></div>
    </div>
    <h3 style="margin:16px 0 8px; font-size:15px;">About this app</h3>
    <p style="white-space:pre-wrap; color:var(--text-muted);">${esc(app.description||"")}</p>
    <div style="margin-top:20px;">
      <a href="${esc(app.downloadUrl||"#")}" target="_blank" rel="noopener" class="btn btn-primary">⬇ Download</a>
    </div>
  `;
  modal.hidden = false;
}

if (previewBtn) {
  previewBtn.addEventListener("click", () => {
    const data = collectData();
    if (!data.name || !data.iconUrl) {
      toast("Fill name & icon first", "error");
      return;
    }
    openPreview(data);
  });
}

window.addEventListener("open-preview", (e) => openPreview(e.detail));

document.getElementById("preview-close")?.addEventListener("click", () => {
  const modal = document.getElementById("preview-modal");
  if (modal) modal.hidden = true;
});

document.getElementById("preview-modal")?.addEventListener("click", (e) => {
  if (e.target.id === "preview-modal") {
    e.target.hidden = true;
  }
});