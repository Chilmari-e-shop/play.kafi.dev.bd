/**
 * Shared utilities
 */

/** Debounce a function */
export function debounce(fn, wait = 300) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

/** Simple toast notification */
export function toast(message, duration = 2200) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("on");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("on"), duration);
}

/** Format large numbers (1.2K, 3.4M, 1.1B) */
export function formatCount(n) {
  if (n == null || isNaN(n)) return "—";
  const num = Number(n);
  if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(num);
}

/** Escape HTML to prevent XSS when injecting user/app data */
export function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Placeholder letter/color when iconUrl is missing */
export function fallbackIconStyle(name = "?") {
  const colors = [
    "#4285F4",
    "#EA4335",
    "#FBBC05",
    "#34A853",
    "#01875f",
    "#7B1FA2",
    "#E91E63",
    "#FF6D00",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = colors[Math.abs(hash) % colors.length];
  const letter = (name.trim()[0] || "?").toUpperCase();
  return { color, letter };
}

/** Render app icon HTML (image or letter fallback) */
export function renderIcon(app, className = "app-icon") {
  const name = app.name || "?";
  if (app.iconUrl) {
    return `<div class="${className}"><img src="${escapeHtml(
      app.iconUrl
    )}" alt="${escapeHtml(name)}" loading="lazy" width="104" height="104" /></div>`;
  }
  const { color, letter } = fallbackIconStyle(name);
  return `<div class="${className}" style="background:${color}">${escapeHtml(
    letter
  )}</div>`;
}

/** Loading skeleton for a horizontal row */
export function skeletonRow(count = 6) {
  let html = '<div class="row">';
  for (let i = 0; i < count; i++) {
    html += `<div class="sk-card">
      <div class="skeleton sk-icon"></div>
      <div class="skeleton sk-line"></div>
      <div class="skeleton sk-line short"></div>
    </div>`;
  }
  html += "</div>";
  return html;
}

/** Empty state */
export function emptyState(icon, title, message) {
  return `<div class="state-box">
    <span class="material-symbols-outlined">${icon}</span>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(message)}</p>
  </div>`;
}

/** Error state with retry */
export function errorState(message, retryId = "retryBtn") {
  return `<div class="state-box">
    <span class="material-symbols-outlined">error</span>
    <h3>Something went wrong</h3>
    <p>${escapeHtml(message || "Please try again.")}</p>
    <button class="btn-retry" id="${retryId}">Retry</button>
  </div>`;
}

/** Update document title & meta for SEO */
export function setPageMeta({ title, description, url, image }) {
  document.title = title ? `${title} · PlayMarket` : "PlayMarket";

  const setMeta = (selector, attr, value) => {
    let el = document.querySelector(selector);
    if (!el && attr === "content") {
      el = document.createElement("meta");
      if (selector.includes("property=")) {
        el.setAttribute("property", selector.match(/property="([^"]+)"/)[1]);
      } else if (selector.includes("name=")) {
        el.setAttribute("name", selector.match(/name="([^"]+)"/)[1]);
      }
      document.head.appendChild(el);
    }
    if (el && value) el.setAttribute("content", value);
  };

  if (description) {
    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:description"]', "content", description);
  }
  if (title) {
    setMeta('meta[property="og:title"]', "content", title);
  }
  if (url) {
    setMeta('meta[property="og:url"]', "content", url);
  }
  if (image) {
    setMeta('meta[property="og:image"]', "content", image);
  }
}

/** Safe external navigation for downloads */
export function triggerDownload(url, filename) {
  if (!url || typeof url !== "string") {
    toast("Download link is not available.");
    return false;
  }
  try {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    if (filename) a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch (e) {
    console.error(e);
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  }
}

/** Parse route from location */
export function parsePath() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const params = new URLSearchParams(window.location.search);
  return { path, params };
}
