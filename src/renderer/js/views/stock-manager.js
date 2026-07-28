/**
 * views/stock-manager.js — Bulk Stock Management (Card Grid)
 */

import { escHtml } from './helpers.js';

const STATUS_CONFIG = {
  active:       { label: 'In Stock',      cls: 'badge--active'   },
  out_of_stock: { label: 'Out of Stock',  cls: 'badge--oos'      },
  archived:     { label: 'Archived',      cls: 'badge--archived' },
};

export async function renderStockManager(container) {
  const catsRes = await window.cms.categories.list();
  const cats    = catsRes.ok ? catsRes.data : [];

  let products        = [];
  let selectedIds     = new Set();
  let currentCategory = '';
  let searchVal       = '';

  // ── Inject card-grid CSS (scoped) ──────────────────────────────────────────
  if (!document.getElementById('stock-card-styles')) {
    const style = document.createElement('style');
    style.id = 'stock-card-styles';
    style.textContent = `
      .stock-card-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
        padding: 4px 0 24px;
      }
      .stock-card {
        background: var(--clr-surface-2);
        border: 2px solid var(--clr-border);
        border-radius: 14px;
        overflow: hidden;
        cursor: pointer;
        transition: border-color 0.18s, box-shadow 0.18s, transform 0.15s;
        position: relative;
        display: flex;
        flex-direction: column;
      }
      .stock-card:hover {
        border-color: var(--clr-primary);
        box-shadow: 0 4px 20px rgba(0,0,0,0.18);
        transform: translateY(-2px);
      }
      .stock-card.is-selected {
        border-color: var(--clr-primary);
        box-shadow: 0 0 0 3px rgba(var(--clr-primary-rgb,107,78,255),0.25);
      }
      .stock-card__check {
        position: absolute;
        top: 10px;
        left: 10px;
        z-index: 2;
        width: 22px;
        height: 22px;
        accent-color: var(--clr-primary);
        cursor: pointer;
      }
      .stock-card__img {
        width: 100%;
        aspect-ratio: 3/4;
        object-fit: cover;
        display: block;
        background: var(--clr-surface-3);
        border-bottom: 1px solid var(--clr-border);
        transition: opacity 0.2s;
      }
      .stock-card__img-placeholder {
        width: 100%;
        aspect-ratio: 3/4;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--clr-surface-3);
        border-bottom: 1px solid var(--clr-border);
        color: var(--clr-text-3);
      }
      .stock-card__img-placeholder svg { width:40px;height:40px;opacity:0.35; }
      .stock-card__body {
        padding: 12px 14px 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex: 1;
      }
      .stock-card__name {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--clr-text-1);
        line-height: 1.3;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .stock-card__code {
        font-size: 0.72rem;
        color: var(--clr-text-3);
        font-family: monospace;
        letter-spacing: 0.02em;
      }
      .stock-card__cat {
        font-size: 0.73rem;
        color: var(--clr-text-2);
      }
      .stock-card__status {
        margin-top: 4px;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 0.73rem;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 20px;
        align-self: flex-start;
      }
      .stock-card__status.badge--active   { background: rgba(34,197,94,0.12); color:#22c55e; }
      .stock-card__status.badge--oos      { background: rgba(251,191,36,0.14); color:#f59e0b; }
      .stock-card__status.badge--archived { background: rgba(156,163,175,0.15); color:#9ca3af; }
      .stock-card__status::before {
        content: '';
        width: 6px; height: 6px;
        border-radius: 50%;
        background: currentColor;
        display: inline-block;
      }
      .stock-empty {
        grid-column: 1 / -1;
        text-align: center;
        padding: 60px 20px;
        color: var(--clr-text-3);
      }
      .stock-empty svg { width:48px;height:48px;margin-bottom:12px;opacity:0.35; }
    `;
    document.head.appendChild(style);
  }

  // ── Build shell ────────────────────────────────────────────────────────────
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__title-group">
        <h1 class="page-title">Stock Manager</h1>
        <p class="page-subtitle" id="stock-count">Loading...</p>
      </div>
    </div>

    <div class="page-content">
      <!-- Filter Bar -->
      <div class="card mb-3">
        <div class="card-body" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:14px 20px;">
          <select class="form-select" id="cat-filter" style="width:220px;">
            <option value="">All Categories</option>
            ${cats.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('')}
          </select>
          <div class="table-search" style="max-width:280px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input id="stock-search" type="search" placeholder="Search products..." />
          </div>
          <button class="btn-secondary btn-sm" id="btn-select-all" style="margin-left:auto;">Select All</button>
          <button class="btn-secondary btn-sm" id="btn-deselect-all" style="display:none;">Deselect All</button>
        </div>
      </div>

      <!-- Bulk Action Bar -->
      <div id="bulk-bar" class="bulk-action-bar hidden">
        <span id="selected-count">0 selected</span>
        <button class="btn-secondary btn-sm" id="btn-in-stock">✓ Mark In Stock</button>
        <button class="btn-secondary btn-sm" id="btn-out-stock" style="color:var(--clr-warning)">⊘ Mark Out of Stock</button>
        <button class="btn-secondary btn-sm" id="btn-archive" style="color:var(--clr-text-3)">↓ Archive</button>
        <button class="btn-danger btn-sm" id="btn-delete">🗑 Delete Permanently</button>
        <button class="btn-secondary btn-sm" id="btn-deselect" style="margin-left:auto;">✕ Deselect All</button>
      </div>

      <!-- Card Grid -->
      <div class="stock-card-grid" id="stock-grid"></div>
    </div>
  `;

  const grid     = container.querySelector('#stock-grid');
  const countEl  = container.querySelector('#stock-count');

  // ── Load products ──────────────────────────────────────────────────────────
  async function loadProducts() {
    const res = await window.cms.stock.list(currentCategory || null);
    products    = res.ok ? res.data : [];
    selectedIds = new Set();
    renderGrid();
  }

  // ── Render card grid ───────────────────────────────────────────────────────
  function renderGrid() {
    const q = searchVal.toLowerCase();
    const filtered = products.filter(p =>
      !q || p.name.toLowerCase().includes(q) || p.product_code.toLowerCase().includes(q)
    );

    countEl.textContent = `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`;

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="stock-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
          <h3 style="font-size:1rem;margin-bottom:6px;">No products found</h3>
          <p style="font-size:0.83rem;">Select a category or adjust your search.</p>
        </div>`;
      updateBulkBar();
      return;
    }

    grid.innerHTML = filtered.map(p => {
      const cfg     = STATUS_CONFIG[p.status] || STATUS_CONFIG.active;
      const checked = selectedIds.has(p.id);
      const hasImg  = !!p.main_image;

      const imgHtml = hasImg
        ? `<img class="stock-card__img" src="${p.main_image}" alt="${escHtml(p.name)}"
             onerror="this.parentElement.innerHTML='<div class=\\'stock-card__img-placeholder\\'><svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\'/><circle cx=\\'8.5\\' cy=\\'8.5\\' r=\\'1.5\\'/><polyline points=\\'21 15 16 10 5 21\\'/></svg></div>'" />`
        : `<div class="stock-card__img-placeholder">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
               <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
             </svg>
           </div>`;

      return `
        <div class="stock-card ${checked ? 'is-selected' : ''}" data-id="${p.id}">
          <input type="checkbox" class="stock-card__check" data-cb="${p.id}" ${checked ? 'checked' : ''} title="Select" />
          ${imgHtml}
          <div class="stock-card__body">
            <div class="stock-card__name">${escHtml(p.name)}</div>
            <div class="stock-card__code">${escHtml(p.product_code)}</div>
            <div class="stock-card__cat">${escHtml(p.category_name || '—')}</div>
            <span class="stock-card__status ${cfg.cls}">${cfg.label}</span>
          </div>
        </div>`;
    }).join('');

    // Attach checkbox events
    grid.querySelectorAll('[data-cb]').forEach(cb => {
      cb.addEventListener('change', e => {
        e.stopPropagation();
        const id = parseInt(cb.dataset.cb);
        if (cb.checked) selectedIds.add(id);
        else selectedIds.delete(id);
        const card = cb.closest('.stock-card');
        card.classList.toggle('is-selected', cb.checked);
        updateBulkBar();
      });
    });

    // Card click (toggle select)
    grid.querySelectorAll('.stock-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.matches('input[type="checkbox"]')) return;
        const id = parseInt(card.dataset.id);
        const cb = card.querySelector('[data-cb]');
        if (selectedIds.has(id)) {
          selectedIds.delete(id);
          card.classList.remove('is-selected');
          cb.checked = false;
        } else {
          selectedIds.add(id);
          card.classList.add('is-selected');
          cb.checked = true;
        }
        updateBulkBar();
      });
    });

    updateBulkBar();
    updateSelectAllBtn();
  }

  function updateBulkBar() {
    const bar     = container.querySelector('#bulk-bar');
    const countSpan = container.querySelector('#selected-count');
    if (selectedIds.size > 0) {
      bar.classList.remove('hidden');
      countSpan.textContent = `${selectedIds.size} selected`;
    } else {
      bar.classList.add('hidden');
    }
  }

  function updateSelectAllBtn() {
    const q = searchVal.toLowerCase();
    const filtered = products.filter(p =>
      !q || p.name.toLowerCase().includes(q) || p.product_code.toLowerCase().includes(q)
    );
    const allSel = filtered.length > 0 && filtered.every(p => selectedIds.has(p.id));
    container.querySelector('#btn-select-all').style.display  = allSel ? 'none' : '';
    container.querySelector('#btn-deselect-all').style.display = allSel ? '' : 'none';
  }

  // ── Event listeners ────────────────────────────────────────────────────────
  container.querySelector('#cat-filter').onchange = e => {
    currentCategory = e.target.value;
    loadProducts();
  };

  container.querySelector('#stock-search').oninput = e => {
    searchVal = e.target.value;
    renderGrid();
  };

  container.querySelector('#btn-select-all').onclick = () => {
    const q = searchVal.toLowerCase();
    products
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.product_code.toLowerCase().includes(q))
      .forEach(p => selectedIds.add(p.id));
    renderGrid();
  };

  container.querySelector('#btn-deselect-all').onclick = () => {
    selectedIds.clear();
    renderGrid();
  };

  // Bulk action bar deselect
  container.querySelector('#btn-deselect').onclick = () => {
    selectedIds.clear();
    renderGrid();
  };

  async function bulkAction(status) {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    const res = await window.cms.stock.bulkUpdate(ids, status);
    if (res.ok) {
      window.Toast.success(`${ids.length} product(s) set to: ${status.replace('_', ' ')}`);
      await loadProducts();
    } else {
      window.Toast.error(`Failed: ${res.error}`);
    }
  }

  container.querySelector('#btn-in-stock').onclick  = () => bulkAction('active');
  container.querySelector('#btn-out-stock').onclick = () => bulkAction('out_of_stock');
  container.querySelector('#btn-archive').onclick   = () => bulkAction('archived');

  container.querySelector('#btn-delete').onclick = async () => {
    const confirmed = await window.Modal.confirm(
      `Permanently delete ${selectedIds.size} product(s)? This CANNOT be undone.`,
      'Delete Products'
    );
    if (!confirmed) return;
    for (const id of selectedIds) {
      await window.cms.products.delete(id);
    }
    window.Toast.success(`${selectedIds.size} product(s) deleted`);
    await loadProducts();
  };

  // ── Initial load ───────────────────────────────────────────────────────────
  await loadProducts();
}
