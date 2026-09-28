/**
 * Search overlay – live Firestore search
 */

import { searchApps } from "./firestore.js";
import { debounce, escapeHtml, renderIcon, emptyState } from "./utils.js";
import { navigate } from "./router.js";

let open = false;

export function initSearch() {
  const trigger = document.getElementById("searchTrigger");
  const overlay = document.getElementById("searchOverlay");
  const input = document.getElementById("searchInput");
  const closeBtn = document.getElementById("searchClose");
  const results = document.getElementById("searchResults");

  if (!trigger || !overlay || !input) return;

  trigger.addEventListener("click", () => openSearch());
  closeBtn?.addEventListener("click", () => closeSearch());

  input.addEventListener(
    "input",
    debounce(async () => {
      await runSearch(input.value);
    }, 280)
  );

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSearch();
  });

  async function runSearch(term) {
    const q = (term || "").trim();
    if (!q) {
      results.innerHTML = `<div class="state-box"><p style="color:var(--muted)">Type to search apps, games & more</p></div>`;
      return;
    }

    results.innerHTML = `<div class="state-box"><p>Searching…</p></div>`;

    try {
      const { items } = await searchApps(q, 25);
      if (!items.length) {
        results.innerHTML = emptyState(
          "search_off",
          "No results",
          `Nothing found for “${q}”. Try another keyword.`
        );
        return;
      }

      results.innerHTML = items
        .map(
          (a) => `
        <button type="button" class="suggest-item" data-app-id="${escapeHtml(a.id)}">
          ${renderIcon(a, "sm-icon")}
          <span>
            <b style="display:block;font-weight:500;color:var(--ink)">${escapeHtml(a.name)}</b>
            <small style="color:var(--muted)">${escapeHtml(a.developer)} · ${escapeHtml(
            a.category || a.type
          )}</small>
          </span>
        </button>`
        )
        .join("");

      results.onclick = (e) => {
        const btn = e.target.closest("[data-app-id]");
        if (!btn) return;
        closeSearch();
        navigate("/app/" + btn.dataset.appId);
      };
    } catch (err) {
      console.error(err);
      results.innerHTML = emptyState(
        "error",
        "Search failed",
        err.message || "Check Firebase indexes for nameLower / searchKeywords."
      );
    }
  }
}

export function openSearch(prefill = "") {
  const overlay = document.getElementById("searchOverlay");
  const input = document.getElementById("searchInput");
  const results = document.getElementById("searchResults");
  if (!overlay) return;
  overlay.classList.add("show");
  open = true;
  if (input) {
    input.value = prefill;
    input.focus();
  }
  if (results && !prefill) {
    results.innerHTML = `<div class="state-box"><p style="color:var(--muted)">Type to search apps, games & more</p></div>`;
  }
}

export function closeSearch() {
  const overlay = document.getElementById("searchOverlay");
  if (overlay) overlay.classList.remove("show");
  open = false;
}

export function isSearchOpen() {
  return open;
}
