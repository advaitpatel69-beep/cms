/**
 * views/dashboard.js — Dashboard View
 */

import { fmtDate, fmtRelative, navigateTo } from './helpers.js';


export async function renderDashboard(container) {
  container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div> Loading...</div>`;

  const res = await window.cms.dashboard.stats();
  if (!res.ok) { container.innerHTML = `<div class="loading-overlay text-danger">Failed to load dashboard.</div>`; return; }

  const s = res.data;

  const gitRes = await window.cms.git.check();
  const gitOk  = gitRes.ok && gitRes.data?.installed;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__title-group">
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">${new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
      </div>
      <div class="page-header__actions">
        <button id="dash-publish-btn" class="btn-gold">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
          Publish Website
        </button>
      </div>
    </div>

    <div class="page-content">
      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card stat-card--primary">
          <div class="stat-card__label">Total Products</div>
          <div class="stat-card__value">${s.totalProducts}</div>
          <div class="stat-card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/></svg></div>
        </div>
        <div class="stat-card stat-card--success">
          <div class="stat-card__label">In Stock</div>
          <div class="stat-card__value">${s.inStock}</div>
          <div class="stat-card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div>
        </div>
        <div class="stat-card stat-card--warning">
          <div class="stat-card__label">Out of Stock</div>
          <div class="stat-card__value">${s.outOfStock}</div>
          <div class="stat-card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
        </div>
        <div class="stat-card stat-card--muted">
          <div class="stat-card__label">Archived</div>
          <div class="stat-card__value">${s.archived}</div>
          <div class="stat-card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg></div>
        </div>
        <div class="stat-card stat-card--gold">
          <div class="stat-card__label">Categories</div>
          <div class="stat-card__value">${s.totalCategories}</div>
          <div class="stat-card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div>
        </div>
        <div class="stat-card stat-card--primary">
          <div class="stat-card__label">Last Published</div>
          <div class="stat-card__value" style="font-size:1rem;">${s.lastPublished ? fmtRelative(s.lastPublished) : 'Never'}</div>
          <div class="stat-card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
        </div>
      </div>

      <!-- Quick Actions + Activity -->
      <div class="two-col">
        <!-- Quick Actions -->
        <div class="card">
          <div class="card-header"><span class="card-title">Quick Actions</span></div>
          <div class="card-body" style="display:grid;gap:10px;">
            <button class="btn-secondary" data-nav="product-new">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add New Product
            </button>
            <button class="btn-secondary" data-nav="stock-manager">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/></svg>
              Open Stock Manager
            </button>
            <button class="btn-secondary" data-nav="publish">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/></svg>
              Publish Website
            </button>
            <button class="btn-secondary" id="dash-import-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Import Existing Products
            </button>
            <button class="btn-secondary" data-nav="backup">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Create Backup
            </button>
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="card">
          <div class="card-header"><span class="card-title">Recent Activity</span></div>
          <div class="card-body" style="padding:0 22px;">
            <div class="activity-feed">
              ${(s.recentActivity || []).length === 0
                ? '<div class="text-muted text-sm" style="padding:20px 0;">No activity yet.</div>'
                : (s.recentActivity || []).map(a => `
                  <div class="activity-item">
                    <div class="activity-dot"></div>
                    <div>
                      <div class="activity-text">${escHtml(a.details || a.action)}</div>
                      <div class="activity-time">${fmtRelative(a.created_at)}</div>
                    </div>
                  </div>`).join('')
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Git Status -->
      <div class="card mt-3">
        <div class="card-header">
          <span class="card-title">Git Status</span>
          <span class="${gitOk ? 'badge badge--active' : 'badge badge--archived'}">${gitOk ? 'Git Detected' : 'Git Not Found'}</span>
        </div>
        <div class="card-body">
          ${gitOk
            ? `<p class="text-sm text-muted">Git is installed and configured. Click <strong>Publish Website</strong> to push changes to GitHub Pages.</p>`
            : `<p class="text-sm text-danger">Git was not found on this system. Please install Git and configure GitHub credentials to enable publishing.</p>`
          }
        </div>
      </div>
    </div>
  `;

  // Wire up buttons
  container.querySelector('#dash-publish-btn').onclick = () => navigateTo('publish');
  container.querySelector('#dash-import-btn').onclick  = handleImport;

  container.querySelectorAll('[data-nav]').forEach(btn => {
    btn.onclick = () => navigateTo(btn.dataset.nav);
  });
}

async function handleImport() {
  const confirmed = await window.Modal.confirm(
    'This will scan your existing image folders and create database records for all products found. Products already in the database will be skipped.\n\nProceed?',
    'Import Existing Products'
  );
  if (!confirmed) return;

  window.Toast.info('Importing products, please wait...');
  const res = await window.cms.products.importExisting();
  if (res.ok) {
    const d = res.data;
    window.Toast.success(`Imported ${d.imported} products. (${d.skipped} already existed)`);
  } else {
    window.Toast.error(`Import failed: ${res.error}`);
  }
}

function escHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
