/**
 * Profile / Auth UI
 */

import {
  getCurrentUser,
  onUserChanged,
  signInWithGoogle,
  signInEmail,
  registerEmail,
  logout,
} from "./auth.js";
import { escapeHtml, setPageMeta, toast } from "./utils.js";
import { navigate } from "./router.js";

export function showProfile() {
  const main = document.getElementById("main");
  if (!main) return;
  setPageMeta({ title: "Profile" });

  const render = (user) => {
    if (user) {
      main.innerHTML = `
        <div class="profile-header">
          <div class="big-avatar" data-avatar>
            ${
              user.photoURL
                ? `<img src="${escapeHtml(user.photoURL)}" alt="" />`
                : escapeHtml((user.displayName || user.email || "U")[0].toUpperCase())
            }
          </div>
          <h2>${escapeHtml(user.displayName || "User")}</h2>
          <p>${escapeHtml(user.email || "")}</p>
        </div>
        <div class="menu-list">
          <button type="button" class="menu-item" data-go="/favorites">
            <span class="material-symbols-outlined">favorite</span> Favorites
          </button>
          <button type="button" class="menu-item" data-go="/settings">
            <span class="material-symbols-outlined">settings</span> Settings
          </button>
          <button type="button" class="menu-item danger" id="btnLogout">
            <span class="material-symbols-outlined">logout</span> Sign out
          </button>
        </div>`;

      main.querySelectorAll("[data-go]").forEach((btn) => {
        btn.onclick = () => navigate(btn.dataset.go);
      });
      document.getElementById("btnLogout").onclick = async () => {
        await logout();
        showProfile();
      };
    } else {
      main.innerHTML = `
        <div class="auth-box">
          <h2>Sign in</h2>
          <p class="sub">Save favorites and sync across devices</p>

          <button type="button" class="btn-google" id="btnGoogle">
            <span class="material-symbols-outlined">login</span>
            Continue with Google
          </button>

          <div class="divider">or</div>

          <form id="authForm">
            <div class="field">
              <label for="authEmail">Email</label>
              <input id="authEmail" type="email" autocomplete="email" required />
            </div>
            <div class="field">
              <label for="authPass">Password</label>
              <input id="authPass" type="password" autocomplete="current-password" required minlength="6" />
            </div>
            <div class="field" id="nameField" style="display:none">
              <label for="authName">Display name</label>
              <input id="authName" type="text" autocomplete="name" />
            </div>
            <button type="submit" class="btn-block" id="btnEmail">Sign in</button>
            <button type="button" class="btn-block secondary" id="btnToggleReg">Create account</button>
          </form>
        </div>`;

      let registerMode = false;
      const form = document.getElementById("authForm");
      const toggle = document.getElementById("btnToggleReg");
      const nameField = document.getElementById("nameField");
      const submitBtn = document.getElementById("btnEmail");

      toggle.onclick = () => {
        registerMode = !registerMode;
        nameField.style.display = registerMode ? "" : "none";
        submitBtn.textContent = registerMode ? "Create account" : "Sign in";
        toggle.textContent = registerMode ? "Already have an account?" : "Create account";
      };

      document.getElementById("btnGoogle").onclick = async () => {
        try {
          await signInWithGoogle();
        } catch (_) {}
      };

      form.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById("authEmail").value.trim();
        const pass = document.getElementById("authPass").value;
        const name = document.getElementById("authName").value.trim();
        try {
          if (registerMode) {
            await registerEmail(email, pass, name);
          } else {
            await signInEmail(email, pass);
          }
        } catch (err) {
          toast(err.message || "Authentication failed");
        }
      };
    }
  };

  render(getCurrentUser());
  return onUserChanged(render);
}

export function showSettings() {
  const main = document.getElementById("main");
  if (!main) return;
  setPageMeta({ title: "Settings" });
  main.innerHTML = `
    <div class="sec" style="padding-top:12px">
      <div class="sec-h"><h2>Settings</h2></div>
      <div class="menu-list">
        <button type="button" class="menu-item" data-go="/profile">
          <span class="material-symbols-outlined">person</span> Account
        </button>
        <button type="button" class="menu-item" data-go="/favorites">
          <span class="material-symbols-outlined">favorite</span> Favorites
        </button>
        <div class="menu-item" style="cursor:default;color:var(--muted);font-size:13px">
          PlayMarket user panel · Data from Cloud Firestore
        </div>
      </div>
    </div>`;
  main.querySelectorAll("[data-go]").forEach((btn) => {
    btn.onclick = () => navigate(btn.dataset.go);
  });
}
