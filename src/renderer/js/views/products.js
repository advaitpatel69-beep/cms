/**
 * views/products.js — Products List View
 */

import { escHtml, statusBadge, fmtDate, navigateTo } from './helpers.js';

export async function renderProducts(container) {
  // Load categories and products
  const [catsRes, prodsRes] = await Promise.all([
    window.cms.categories.list(),
    window.cms.products.list({}),
  ]);

  const categories = catsRes.ok ? catsRes.data : [];
  let   products   = prodsRes.ok ? prodsRes.data : [];

  let search = '';
  let filterStatus   = '';
  let filterCategory = '';

  function getFiltered() {
    return products.filter(p => {
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterCategory && String(p.category_id) !== String(filterCategory)) return false;
      if (search && !(`${p.name} ${p.product_code} ${p.description}`).toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }

  function render() {
    const list = getFiltered();
    tbody.innerHTML = list.length === 0
      ? `<tr><td colspan="7"><div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><h3>No products found</h3><p>Try adjusting your filters or add a new product.</p></div></td></tr>`
      : list.map(p => `
        <tr>
          <td class="col-img">
            <img class="td-img" src="${p.main_image ? 'file://' + escHtml(p.main_image) : ''}"
              onerror="this.style.display='none'" alt="" />
          </td>
          <td>
            <div class="td-name">${escHtml(p.name)}</div>
            <div class="td-code">${escHtml(p.product_code)}</div>
          </td>
          <td>${escHtml(p.category_name || '—')}</td>
          <td>${statusBadge(p.status)}</td>
          <td>${p.featured ? '<span class="badge badge--featured">★ Featured</span>' : '—'}</td>
          <td>${fmtDate(p.created_at)}</td>
          <td class="col-actions">
            <div class="flex-gap">
              <button class="btn-icon" title="Edit" data-edit="${p.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-icon" title="Delete" data-del="${p.id}" data-name="${escHtml(p.name)}" style="color:var(--clr-error)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          </td>
        </tr>`).join('');

    countEl.textContent = `${list.length} product${list.length !== 1 ? 's' : ''}`;
  }

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__title-group">
        <h1 class="page-title">Products</h1>
        <p class="page-subtitle" id="prod-count">Loading...</p>
      </div>
      <div class="page-header__actions">
        <button class="btn-primary" id="add-product-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Product
        </button>
      </div>
    </div>

    <div class="page-content">
      <div class="table-wrapper">
        <div class="table-toolbar">
          <div class="table-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input id="prod-search" type="search" placeholder="Search products..." />
          </div>
          <div class="flex-gap">
            <select class="form-select" id="prod-filter-status" style="width:auto;padding-right:32px;">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="archived">Archived</option>
            </select>
            <select class="form-select" id="prod-filter-cat" style="width:auto;padding-right:32px;">
              <option value="">All Categories</option>
              ${categories.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Product</th>
              <th>Category</th>
              <th>Status</th>
              <th>Featured</th>
              <th>Created</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody id="prod-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  const tbody   = container.querySelector('#prod-tbody');
  const countEl = container.querySelector('#prod-count');

  render();

  // Filters
  container.querySelector('#prod-search').oninput = (e) => { search = e.target.value; render(); };
  container.querySelector('#prod-filter-status').onchange = (e) => { filterStatus = e.target.value; render(); };
  container.querySelector('#prod-filter-cat').onchange = (e) => { filterCategory = e.target.value; render(); };

  // Actions
  container.querySelector('#add-product-btn').onclick = () => navigateTo('product-new');

  tbody.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-edit]');
    const delBtn  = e.target.closest('[data-del]');

    if (editBtn) {
      navigateTo('product-edit', editBtn.dataset.edit);
    }

    if (delBtn) {
      const confirmed = await window.Modal.confirm(
        `Permanently delete "${delBtn.dataset.name}"? This cannot be undone.`,
        'Delete Product'
      );
      if (!confirmed) return;
      const res = await window.cms.products.delete(delBtn.dataset.del);
      if (res.ok) {
        products = products.filter(p => String(p.id) !== delBtn.dataset.del);
        window.Toast.success('Product deleted');
        render();
      } else {
        window.Toast.error(`Failed: ${res.error}`);
      }
    }
  });
}
