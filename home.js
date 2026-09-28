/**
 * Home / tab content rendering from Firestore
 */

import { fetchApps, fetchCategories } from "./firestore.js";
import {
  renderIcon,
  escapeHtml,
  formatCount,
  skeletonRow,
  emptyState,
  errorState,
  setPageMeta,
} from "./utils.js";
import { navigate } from "./router.js";

const TAB_CONFIG = {
  games: { type: "game", label: "Games", pills: ["For you", "Top charts", "Categories"] },
  apps: { type: "app", label: "Apps", pills: ["For you", "Top charts", "Categories"] },
  movies: { type: "movie", label: "Movies", pills: ["For you", "Top charts", "Categories"] },
  books: { type: "book", label: "Books", pills: ["For you", "Top charts", "Categories"] },
  kids: { type: "kids", label: "Kids", pills: ["For you", "Top charts", "Categories"] },
};

let activeTab = "games";
let activePill = 0;

export function getActiveTab() {
  return activeTab;
}

export function setActiveTab(tab) {
  if (TAB_CONFIG[tab]) activeTab = tab;
  activePill = 0;
}

export function renderBottomNav() {
  const nav = document.getElementById("bottomNav");
  if (!nav) return;
  const items = [
    { id: "games", icon: "stadia_controller", label: "Games" },
    { id: "apps", icon: "apps", label: "Apps" },
    { id: "movies", icon: "movie", label: "Movies" },
    { id: "books", icon: "menu_book", label: "Books" },
    { id: "kids", icon: "child_care", label: "Kids" },
  ];
  nav.innerHTML = items
    .map(
      (t) => `
    <button type="button" data-tab="${t.id}" class="${activeTab === t.id ? "on" : ""}">
      <span class="material-symbols-outlined">${t.icon}</span>
      ${t.label}
    </button>`
    )
    .join("");

  nav.onclick = (e) => {
    const btn = e.target.closest("[data-tab]");
    if (!btn) return;
    const tab = btn.dataset.tab;
    setActiveTab(tab);
    navigate("/" + (tab === "games" ? "" : tab));
  };
}

export function renderDesktopNav() {
  const el = document.getElementById("desktopNav");
  if (!el) return;
  const items = [
    { id: "games", label: "Games" },
    { id: "apps", label: "Apps" },
    { id: "movies", label: "Movies" },
    { id: "books", label: "Books" },
    { id: "kids", label: "Kids" },
  ];
  el.innerHTML = items
    .map(
      (t) =>
        `<button type="button" data-tab="${t.id}" class="${
          activeTab === t.id ? "on" : ""
        }">${t.label}</button>`
    )
    .join("");
  el.onclick = (e) => {
    const btn = e.target.closest("[data-tab]");
    if (!btn) return;
    setActiveTab(btn.dataset.tab);
    navigate("/" + (btn.dataset.tab === "games" ? "" : btn.dataset.tab));
  };
}

function renderPills() {
  const cfg = TAB_CONFIG[activeTab];
  const el = document.getElementById("pills");
  if (!el || !cfg) return;
  el.innerHTML = cfg.pills
    .map(
      (p, i) =>
        `<button type="button" class="pill ${i === activePill ? "on" : ""}" data-pill="${i}">${p}</button>`
    )
    .join("");
  el.onclick = (e) => {
    const btn = e.target.closest("[data-pill]");
    if (!btn) return;
    activePill = Number(btn.dataset.pill);
    loadHomeContent();
  };
}

function cardHtml(app) {
  return `<div class="app-card" data-app-id="${escapeHtml(app.id)}" role="button" tabindex="0">
    ${renderIcon(app)}
    <div class="app-name">${escapeHtml(app.name)}</div>
    <div class="app-meta"><span class="material-symbols-outlined">star</span> ${
      app.rating ? app.rating.toFixed(1) : "—"
    }</div>
  </div>`;
}

function listHtml(app, index) {
  return `<div class="list-item" data-app-id="${escapeHtml(app.id)}" role="button" tabindex="0">
    <span class="rank">${index + 1}</span>
    ${renderIcon(app, "sm-icon")}
    <div class="info">
      <b>${escapeHtml(app.name)}</b>
      <span>${escapeHtml(app.developer)} · ${app.rating ? app.rating.toFixed(1) : "—"} ★</span>
    </div>
    <button type="button" class="btn-install" data-download="${escapeHtml(app.id)}">Install</button>
  </div>`;
}

function bindAppClicks(root) {
  root.onclick = (e) => {
    const dl = e.target.closest("[data-download]");
    if (dl) {
      e.stopPropagation();
      // handled by global download handler in app.js
      return;
    }
    const card = e.target.closest("[data-app-id]");
    if (card) {
      navigate("/app/" + card.dataset.appId);
    }
  };
}

export async function loadHomeContent() {
  const main = document.getElementById("main");
  if (!main) return;

  const cfg = TAB_CONFIG[activeTab];
  if (!cfg) return;

  renderPills();
  renderBottomNav();
  renderDesktopNav();

  setPageMeta({
    title: cfg.label,
    description: `Discover ${cfg.label.toLowerCase()} on PlayMarket`,
  });

  const pillName = cfg.pills[activePill] || "For you";
  main.innerHTML = `
    <div id="homeFeatured">${skeletonRow(1)}</div>
    <div id="homeSections">${skeletonRow(6)}</div>
  `;

  try {
    if (pillName === "Categories") {
      await renderCategoriesView(main, cfg.type);
      return;
    }

    if (pillName === "Top charts") {
      const { items } = await fetchApps({
        type: cfg.type,
        orderField: "downloadCount",
        orderDir: "desc",
        pageSize: 30,
      });
      if (!items.length) {
        main.innerHTML = emptyState(
          "inbox",
          "No apps yet",
          "Published apps will appear here once the admin adds them."
        );
        return;
      }
      main.innerHTML = `<div class="sec" style="padding-top:12px">
        <div class="sec-h"><h2>Top charts</h2></div>
        <div class="list">${items.map((a, i) => listHtml(a, i)).join("")}</div>
      </div>`;
      bindAppClicks(main);
      return;
    }

    // For you
    const [featured, popular, newest, charts] = await Promise.all([
      fetchApps({ type: cfg.type, featured: true, pageSize: 5 }),
      fetchApps({ type: cfg.type, popular: true, pageSize: 12 }),
      fetchApps({ type: cfg.type, isNew: true, orderField: "updatedAt", orderDir: "desc", pageSize: 12 }),
      fetchApps({ type: cfg.type, orderField: "downloadCount", orderDir: "desc", pageSize: 10 }),
    ]);

    // Fallback: if no featured flags, use popular/charts
    const heroApps = featured.items.length
      ? featured.items
      : popular.items.length
      ? popular.items
      : charts.items;

    let html = "";

    if (heroApps.length) {
      const h = heroApps[0];
      const bg = h.bannerUrl
        ? ""
        : `style="background:linear-gradient(135deg,#1a237e,#3949ab)"`;
      html += `<div class="hero" data-app-id="${escapeHtml(h.id)}" ${bg}>
        ${h.bannerUrl ? `<img class="banner" src="${escapeHtml(h.bannerUrl)}" alt="" loading="lazy" />` : ""}
        <div class="hero-content">
          <div class="tag">${h.isFeatured ? "Featured" : "Recommended"}</div>
          <h2>${escapeHtml(h.name)}</h2>
          <div class="meta">${escapeHtml(h.developer)} · ${
        h.rating ? h.rating.toFixed(1) + " ★" : ""
      } · ${formatCount(h.downloadCount)} downloads</div>
        </div>
      </div>`;
    }

    const sections = [
      { title: "Recommended for you", items: popular.items.length ? popular.items : charts.items },
      { title: "New & updated", items: newest.items.length ? newest.items : charts.items.slice().reverse() },
      { title: "Popular", items: charts.items },
    ];

    sections.forEach((sec) => {
      if (!sec.items.length) return;
      html += `<div class="sec">
        <div class="sec-h"><h3>${escapeHtml(sec.title)}</h3></div>
        <div class="row">${sec.items.map(cardHtml).join("")}</div>
      </div>`;
    });

    // Top list snippet
    if (charts.items.length) {
      html += `<div class="sec">
        <div class="sec-h"><h3>Top charts</h3>
          <button type="button" class="more" data-goto-charts>See more</button>
        </div>
        <div class="list">${charts.items.slice(0, 5).map((a, i) => listHtml(a, i)).join("")}</div>
      </div>`;
    }

    if (!html) {
      main.innerHTML = emptyState(
        "apps",
        "No published apps",
        "Connect Firebase and publish apps from the admin panel."
      );
      return;
    }

    main.innerHTML = html;
    bindAppClicks(main);

    const moreBtn = main.querySelector("[data-goto-charts]");
    if (moreBtn) {
      moreBtn.onclick = () => {
        activePill = cfg.pills.indexOf("Top charts");
        loadHomeContent();
      };
    }
  } catch (err) {
    console.error(err);
    main.innerHTML = errorState(
      err.message || "Failed to load apps. Check Firebase config and indexes."
    );
    const retry = document.getElementById("retryBtn");
    if (retry) retry.onclick = () => loadHomeContent();
  }
}

async function renderCategoriesView(main, type) {
  main.innerHTML = `<div class="sec" style="padding-top:12px">
    <div class="sec-h"><h2>Categories</h2></div>
    <div class="cat-grid" id="catGrid">${skeletonRow(4)}</div>
  </div>`;

  try {
    const cats = await fetchCategories(type);
    const grid = document.getElementById("catGrid");
    if (!cats.length) {
      main.innerHTML = emptyState("category", "No categories", "Categories appear when apps are published.");
      return;
    }
    const icons = ["sports_esports", "smartphone", "movie", "menu_book", "child_care", "music_note", "photo_camera", "account_balance"];
    grid.innerHTML = cats
      .map(
        (c, i) => `
      <button type="button" class="cat-card" data-category="${escapeHtml(c.name)}">
        <span class="material-symbols-outlined">${icons[i % icons.length]}</span>
        <b>${escapeHtml(c.name)}</b>
        <span>${c.count} apps</span>
      </button>`
      )
      .join("");

    grid.onclick = async (e) => {
      const btn = e.target.closest("[data-category]");
      if (!btn) return;
      const cat = btn.dataset.category;
      navigate(`/category/${encodeURIComponent(cat)}?type=${type || ""}`);
    };
  } catch (err) {
    main.innerHTML = errorState(err.message);
    document.getElementById("retryBtn")?.addEventListener("click", () => loadHomeContent());
  }
}

export async function loadCategoryPage(category, type) {
  const main = document.getElementById("main");
  if (!main) return;
  setPageMeta({ title: category, description: `Apps in ${category}` });
  main.innerHTML = `<div class="sec" style="padding-top:12px">
    <div class="sec-h"><h2>${escapeHtml(category)}</h2></div>
    <div class="grid" id="catApps">${skeletonRow(8)}</div>
  </div>`;

  try {
    const { items } = await fetchApps({
      category,
      type: type || undefined,
      pageSize: 40,
    });
    const grid = document.getElementById("catApps");
    if (!items.length) {
      main.innerHTML = emptyState("search_off", "No apps", `No published apps in “${category}”.`);
      return;
    }
    grid.innerHTML = items.map(cardHtml).join("");
    bindAppClicks(grid);
  } catch (err) {
    main.innerHTML = errorState(err.message);
  }
}

export { TAB_CONFIG };
