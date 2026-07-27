/**
 * views/stock-manager.js — Bulk Stock Management
 */

import { escHtml, statusBadge } from './helpers.js';

export async function renderStockManager(container) {
  const catsRes = await window.cms.categories.list();
  const cats    = catsRes.ok ? catsRes.data : [];

  let products        = [];
  let selectedIds     = new Set();
  let currentCategory = '';

  async function loadProducts() {
    const res = await window.cms.stock.list(currentCategory || null);
    products    = res.ok ? res.data : [];
    selectedIds = new Set();
    renderTable();
  }

  function renderTable() {
    const searchVal = container.querySelector('#stock-search')?.value?.toLowerCase() || '';
    const filtered  = products.filter(p =>
      !searchVal || p.name.toLowerCase().includes(searchVal) || p.product_code.toLowerCase().includes(searchVal)
    );

    const allChecked = filtered.length > 0 && filtered.every(p => selectedIds.has(p.id));

    tbody.innerHTML = filtered.length === 0
      ? `<tr><td colspan="5"><div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><h3>No products found</h3><p>Select a category or adjust your search.</p></div></td></tr>`
      : filtered.map(p => `
        <tr class="${selectedIds.has(p.id) ? 'is-selected' : ''}">
          <td style="width:44px;"><input type="checkbox" class="stock-cb" data-id="${p.id}" ${selectedIds.has(p.id) ? 'checked' : ''} /></td>
          <td class="col-img"><img class="td-img" src="${p.main_image || ''}" onerror="this.style.display='none'" alt="" /></td>
          <td><div class="td-name">${escHtml(p.name)}</div><div class="td-code">${escHtml(p.product_code)}</div></td>
          <td>${escHtml(p.category_name || '—')}</td>
          <td>${statusBadge(p.status)}</td>
        </tr>`).join('');

    // Sync select-all checkbox
    const selectAll = container.querySelector('#select-all');
    if (selectAll) selectAll.checked = allChecked;

    updateBulkBar();
  }

  function updateBulkBar() {
    const bar     = container.querySelector('#bulk-bar');
    const countEl = container.querySelector('#selected-count');
    if (selectedIds.size > 0) {
      bar.classList.remove('hidden');
      countEl.textContent = `${selectedIds.size} selected`;
    } else {
      bar.classList.add('hidden');
    }
  }

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__title-group">
        <h1 class="page-title">Stock Manager</h1>
        <p class="page-subtitle">Bulk manage product availability</p>
      </div>
    </div>

    <div class="page-content">
      <!-- Filter Bar -->
      <div class="card mb-3">
        <div class="card-body" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:14px 20px;">
          <select class="form-select" id="cat-filter" style="width:220px;">
            <option value="">All Categories</option>
            ${cats.map(c => `<option value="${c.id}">${escHtml(c.name)} (${c.active_products + (c.oos_products||0)})</option>`).join('')}
          </select>
          <div class="table-search" style="max-width:280px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input id="stock-search" type="search" placeholder="Search products..." />
          </div>
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

      <!-- Products Table -->
      <div class="table-wrapper">
        <table class="data-table stock-table">
          <thead>
            <tr>
              <th style="width:44px;"><input type="checkbox" class="stock-cb" id="select-all" /></th>
              <th>Image</th>
              <th>Product</th>
              <th>Category</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="stock-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  const tbody = container.querySelector('#stock-tbody');

  await loadProducts();

  // Category filter
  container.querySelector('#cat-filter').onchange = (e) => {
    currentCategory = e.target.value;
    loadProducts();
  };

  // Search
  container.querySelector('#stock-search').oninput = () => renderTable();

  // Select-all
  container.querySelector('#select-all').onchange = (e) => {
    const searchVal = container.querySelector('#stock-search').value.toLowerCase();
    const filtered  = products.filter(p =>
      !searchVal || p.name.toLowerCase().includes(searchVal)
    );
    if (e.target.checked) {
      filtered.forEach(p => selectedIds.add(p.id));
    } else {
      filtered.forEach(p => selectedIds.delete(p.id));
    }
    renderTable();
  };

  // Individual checkboxes
  tbody.addEventListener('change', (e) => {
    if (!e.target.matches('.stock-cb')) return;
    const id = parseInt(e.target.dataset.id);
    if (e.target.checked) selectedIds.add(id);
    else selectedIds.delete(id);
    renderTable();
  });

  // Bulk actions
  async function bulkAction(status) {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    const res = await window.cms.stock.bulkUpdate(ids, status);
    if (res.ok) {
      window.Toast.success(`${ids.length} product(s) set to: ${status.replace('_',' ')}`);
      await loadProducts();
    } else {
      window.Toast.error(`Failed: ${res.error}`);
    }
  }

  container.querySelector('#btn-in-stock').onclick  = () => bulkAction('active');
  container.querySelector('#btn-out-stock').onclick = () => bulkAction('out_of_stock');
  container.querySelector('#btn-archive').onclick   = () => bulkAction('archived');
  container.querySelector('#btn-deselect').onclick  = () => { selectedIds.clear(); renderTable(); };

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
}
