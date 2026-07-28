/**
 * views/products.js — Products Card Grid View
 */

import { escHtml, fmtDate, navigateTo } from './helpers.js';

const STATUS_CONFIG = {
  active:       { label: 'Active',        cls: 'badge--active'   },
  out_of_stock: { label: 'Out of Stock',  cls: 'badge--oos'      },
  archived:     { label: 'Archived',      cls: 'badge--archived' },
};

export async function renderProducts(container) {
  const [catsRes, prodsRes] = await Promise.all([
    window.cms.categories.list(),
    window.cms.products.list({}),
  ]);

  const categories = catsRes.ok ? catsRes.data : [];
  let   products   = prodsRes.ok ? prodsRes.data : [];

  let search         = '';
  let filterStatus   = '';
  let filterCategory = '';

  // ── Inject card-grid CSS ───────────────────────────────────────────────────
  if (!document.getElementById('prod-card-styles')) {
    const style = document.createElement('style');
    style.id = 'prod-card-styles';
    style.textContent = `
      .prod-card-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
        padding: 4px 0 24px;
      }
      .prod-card {
        background: var(--clr-surface-2);
        border: 2px solid var(--clr-border);
        border-radius: 14px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transition: border-color 0.18s, box-shadow 0.18s, transform 0.15s;
        position: relative;
      }
      .prod-card:hover {
        border-color: var(--clr-primary);
        box-shadow: 0 4px 20px rgba(0,0,0,0.18);
        transform: translateY(-2px);
      }
      .prod-card__featured-ribbon {
        position: absolute;
        top: 0; right: 0;
        background: var(--clr-gold, #c9a84c);
        color: #fff;
        font-size: 0.65rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        padding: 3px 10px;
        border-bottom-left-radius: 8px;
        z-index: 2;
      }
      .prod-card__img {
        width: 100%;
        aspect-ratio: 3/4;
        object-fit: cover;
        display: block;
        background: var(--clr-surface-3);
        border-bottom: 1px solid var(--clr-border);
      }
      .prod-card__img-placeholder {
        width: 100%;
        aspect-ratio: 3/4;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--clr-surface-3);
        border-bottom: 1px solid var(--clr-border);
        color: var(--clr-text-3);
      }
      .prod-card__img-placeholder svg { width:40px;height:40px;opacity:0.3; }
      .prod-card__body {
        padding: 12px 14px 10px;
        display: flex;
        flex-direction: column;
        gap: 5px;
        flex: 1;
      }
      .prod-card__name {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--clr-text-1);
        line-height: 1.3;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .prod-card__meta {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .prod-card__code {
        font-size: 0.7rem;
        color: var(--clr-text-3);
        font-family: monospace;
      }
      .prod-card__cat {
        font-size: 0.71rem;
        color: var(--clr-text-2);
      }
      .prod-card__status {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 0.7rem;
        font-weight: 600;
        padding: 2px 7px;
        border-radius: 20px;
        align-self: flex-start;
      }
      .prod-card__status.badge--active   { background:rgba(34,197,94,0.12); color:#22c55e; }
      .prod-card__status.badge--oos      { background:rgba(251,191,36,0.14); color:#f59e0b; }
      .prod-card__status.badge--archived { background:rgba(156,163,175,0.15); color:#9ca3af; }
      .prod-card__status::before {
        content:'';width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block;
      }
      .prod-card__date {
        font-size: 0.68rem;
        color: var(--clr-text-3);
        margin-top: 2px;
      }
      .prod-card__actions {
        display: flex;
        gap: 6px;
        padding: 0 10px 12px;
        margin-top: auto;
      }
      .prod-card__actions .btn-icon {
        flex: 1;
        justify-content: center;
        font-size: 0.75rem;
        gap: 4px;
        padding: 6px 0;
        border-radius: 8px;
      }
      .prod-card__actions .btn-icon svg { width:13px;height:13px; }
      .prod-empty {
        grid-column: 1 / -1;
        text-align: center;
        padding: 60px 20px;
        color: var(--clr-text-3);
      }
      .prod-empty svg { width:48px;height:48px;margin-bottom:12px;opacity:0.3; }
    `;
    document.head.appendChild(style);
  }

  function getFiltered() {
    return products.filter(p => {
      if (filterStatus   && p.status !== filterStatus) return false;
      if (filterCategory && String(p.category_id) !== String(filterCategory)) return false;
      if (search && !(`${p.name} ${p.product_code} ${p.description}`).toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }

  function render() {
    const list = getFiltered();
    countEl.textContent = `${list.length} product${list.length !== 1 ? 's' : ''}`;

    if (list.length === 0) {
      grid.innerHTML = `
        <div class="prod-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
          <h3 style="font-size:1rem;margin-bottom:6px;">No products found</h3>
          <p style="font-size:0.83rem;">Try adjusting your filters or <a href="#" id="add-prod-link" style="color:var(--clr-primary)">add a new product</a>.</p>
        </div>`;
      const link = grid.querySelector('#add-prod-link');
      if (link) link.onclick = e => { e.preventDefault(); navigateTo('product-new'); };
      return;
    }

    grid.innerHTML = list.map(p => {
      const cfg    = STATUS_CONFIG[p.status] || STATUS_CONFIG.active;
      const hasImg = !!p.main_image;

      const imgHtml = hasImg
        ? `<img class="prod-card__img" src="${p.main_image}" alt="${escHtml(p.name)}"
             onerror="this.parentElement.innerHTML='<div class=\\'prod-card__img-placeholder\\'><svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\'/><circle cx=\\'8.5\\' cy=\\'8.5\\' r=\\'1.5\\'/><polyline points=\\'21 15 16 10 5 21\\'/></svg></div>'" />`
        : `<div class="prod-card__img-placeholder">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
               <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
             </svg>
           </div>`;

      const featuredRibbon = p.featured
        ? `<div class="prod-card__featured-ribbon">★ Featured</div>`
        : '';

      return `
        <div class="prod-card" data-id="${p.id}">
          ${featuredRibbon}
          ${imgHtml}
          <div class="prod-card__body">
            <div class="prod-card__name">${escHtml(p.name)}</div>
            <div class="prod-card__meta">
              <span class="prod-card__code">${escHtml(p.product_code)}</span>
            </div>
            <div class="prod-card__cat">${escHtml(p.category_name || '—')}</div>
            <span class="prod-card__status ${cfg.cls}">${cfg.label}</span>
            <div class="prod-card__date">Added ${fmtDate(p.created_at)}</div>
          </div>
          <div class="prod-card__actions">
            <button class="btn-icon" title="Edit" data-edit="${p.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </button>
            <button class="btn-icon" title="Delete" data-del="${p.id}" data-name="${escHtml(p.name)}" style="color:var(--clr-error)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              Delete
            </button>
          </div>
        </div>`;
    }).join('');
  }

  // ── Build shell ────────────────────────────────────────────────────────────
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
      <!-- Filters -->
      <div class="card mb-3">
        <div class="card-body" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:14px 20px;">
          <div class="table-search" style="max-width:280px;flex:1;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input id="prod-search" type="search" placeholder="Search products..." />
          </div>
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

      <!-- Card Grid -->
      <div class="prod-card-grid" id="prod-grid"></div>
    </div>
  `;

  const grid    = container.querySelector('#prod-grid');
  const countEl = container.querySelector('#prod-count');

  render();

  // ── Events ─────────────────────────────────────────────────────────────────
  container.querySelector('#add-product-btn').onclick = () => navigateTo('product-new');
  container.querySelector('#prod-search').oninput     = e => { search = e.target.value; render(); };
  container.querySelector('#prod-filter-status').onchange = e => { filterStatus = e.target.value; render(); };
  container.querySelector('#prod-filter-cat').onchange    = e => { filterCategory = e.target.value; render(); };

  grid.addEventListener('click', async e => {
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
