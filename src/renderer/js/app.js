/**
 * app.js — CMS Application Entry Point
 * M.R. Textile CMS
 */

import { Router } from './router.js';
import { Toast }  from './components/toast.js';
import { Modal }  from './components/modal.js';

import { renderDashboard }    from './views/dashboard.js';
import { renderProducts }     from './views/products.js';
import { renderProductForm }  from './views/product-form.js';
import { renderStockManager } from './views/stock-manager.js';
import { renderCategories }   from './views/categories.js';
import { renderHomepage }     from './views/homepage.js';
import { renderGallery }      from './views/gallery.js';
import { renderBusinessInfo } from './views/business-info.js';
import { renderSEO }          from './views/seo.js';
import { renderMediaLibrary } from './views/media-library.js';
import { renderPublish }      from './views/publish.js';
import { renderSettings }     from './views/settings.js';
import { renderBackup }       from './views/backup.js';

// ─── Globals ────────────────────────────────────────────────────────────────────
window.Toast = Toast;
window.Modal = Modal;

// ─── DOM refs ───────────────────────────────────────────────────────────────────
const loginScreen  = document.getElementById('login-screen');
const cmsShell     = document.getElementById('cms-shell');
const loginForm    = document.getElementById('login-form');
const loginBtn     = document.getElementById('login-btn');
const loginError   = document.getElementById('login-error');
const logoutBtn    = document.getElementById('logout-btn');
const viewContainer = document.getElementById('view-container');
const sidebarLinks = document.querySelectorAll('.sidebar__link[data-view]');

// ─── Router ──────────────────────────────────────────────────────────────────────
const router = new Router(viewContainer, {
  'dashboard':     renderDashboard,
  'products':      renderProducts,
  'product-new':   (el) => renderProductForm(el, null),
  'product-edit':  (el, id) => renderProductForm(el, id),
  'stock-manager': renderStockManager,
  'categories':    renderCategories,
  'homepage':      renderHomepage,
  'gallery':       renderGallery,
  'business-info': renderBusinessInfo,
  'seo':           renderSEO,
  'media-library': renderMediaLibrary,
  'publish':       renderPublish,
  'settings':      renderSettings,
  'backup':        renderBackup,
});

// ─── Auth ────────────────────────────────────────────────────────────────────────
async function checkAuth() {
  const res = await window.cms.auth.check();
  if (res.data === true) {
    showCMS();
  }
}

function showCMS() {
  loginScreen.hidden = true;
  cmsShell.hidden    = false;
  router.navigate('dashboard');
}

function showLogin() {
  loginScreen.hidden = false;
  cmsShell.hidden    = true;
}

// Login form
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Guard: CMS bridge not available (opened in browser, not Electron)
  if (!window.cms) {
    loginError.textContent = 'Not running in Electron. Run: npm start';
    loginError.hidden = false;
    return;
  }

  const password = document.getElementById('login-password').value;
  loginBtn.disabled  = true;
  loginBtn.innerHTML = '<span class="spinner"></span> Signing in...';
  loginError.hidden  = true;

  try {
    const res = await window.cms.auth.login(password);

    loginBtn.disabled  = false;
    loginBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Sign In';

    if (res.ok && res.data?.success) {
      loginError.hidden = true;
      showCMS();
    } else {
      loginError.textContent = res.error ? `Error: ${res.error}` : 'Incorrect password. Please try again.';
      loginError.hidden = false;
      document.getElementById('login-password').value = '';
      document.getElementById('login-password').focus();
    }
  } catch (err) {
    loginBtn.disabled  = false;
    loginBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Sign In';
    loginError.textContent = `JS Error: ${err.message}`;
    loginError.hidden = false;
    console.error('[Login Error]', err);
  }
});


// Logout
logoutBtn.addEventListener('click', async () => {
  await window.cms.auth.logout();
  showLogin();
});

// ─── Sidebar Navigation ───────────────────────────────────────────────────────────
sidebarLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const view = link.dataset.view;
    router.navigate(view);
    // Update active state
    sidebarLinks.forEach(l => l.classList.remove('is-active'));
    link.classList.add('is-active');
  });
});

// ─── Progress events from main process ───────────────────────────────────────
if (window.cms && window.cms.onProgress) {
  window.cms.onProgress((data) => {
    window.dispatchEvent(new CustomEvent('cms-progress', { detail: data }));
  });
}

// ─── Programmatic navigation (from within views) ─────────────────────────────
window.addEventListener('cms-navigate', (e) => {
  const { view, args } = e.detail;
  router.navigate(view, ...(args || []));
  sidebarLinks.forEach(l => l.classList.remove('is-active'));
  const activeLink = document.querySelector(`.sidebar__link[data-view="${view}"]`);
  if (activeLink) activeLink.classList.add('is-active');
});

// ─── Init ────────────────────────────────────────────────────────────────────
if (window.cms) {
  checkAuth();
} else {
  // Not running inside Electron — show a helpful message
  document.getElementById('login-screen').innerHTML = `
    <div class="login-card" style="text-align:center;">
      <div class="login-brand">
        <div class="login-brand__mark">MR</div>
        <div class="login-brand__text">
          <span class="login-brand__name">M.R. Textile</span>
          <span class="login-brand__sub">Content Management System</span>
        </div>
      </div>
      <div style="margin-top:32px;padding:20px;background:rgba(255,100,100,.1);border:1px solid rgba(255,100,100,.3);border-radius:10px;">
        <p style="color:#f87171;font-size:.95rem;font-weight:600;margin-bottom:8px;">⚠ Open in Electron, not a browser</p>
        <p style="color:var(--clr-text-2);font-size:.83rem;margin-bottom:16px;">This CMS must be launched as a desktop app.</p>
        <p style="color:var(--clr-text-3);font-size:.78rem;font-family:monospace;background:var(--clr-surface-2);padding:10px;border-radius:6px;">npm start</p>
        <p style="color:var(--clr-text-3);font-size:.75rem;margin-top:10px;">Run the above command inside the <code>cms/</code> folder</p>
      </div>
    </div>
  `;
}

