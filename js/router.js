/**
 * Lightweight client-side router
 */

const routes = [];
let currentCleanup = null;

/**
 * Register a route
 * pattern: string like "/", "/app/:id", "/search"
 */
export function route(pattern, handler) {
  const keys = [];
  const regex = new RegExp(
    "^" +
      pattern
        .replace(/\//g, "\\/")
        .replace(/:([a-zA-Z]+)/g, (_, key) => {
          keys.push(key);
          return "([^/]+)";
        }) +
      "$"
  );
  routes.push({ regex, keys, handler });
}

export function navigate(path, replace = false) {
  if (replace) {
    history.replaceState(null, "", path);
  } else {
    history.pushState(null, "", path);
  }
  handleRoute();
}

export function startRouter() {
  window.addEventListener("popstate", handleRoute);
  handleRoute();
}

async function handleRoute() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const search = window.location.search;

  if (currentCleanup) {
    try {
      currentCleanup();
    } catch (_) {}
    currentCleanup = null;
  }

  for (const r of routes) {
    const m = path.match(r.regex);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => {
        params[k] = decodeURIComponent(m[i + 1]);
      });
      const query = Object.fromEntries(new URLSearchParams(search));
      const result = await r.handler({ path, params, query });
      if (typeof result === "function") currentCleanup = result;
      return;
    }
  }

  // Fallback home
  navigate("/", true);
}

/** Helper: close any open overlays */
export function closeOverlays() {
  document.querySelectorAll(".overlay.show").forEach((el) => {
    el.classList.remove("show");
  });
}
