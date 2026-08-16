/**
 * views/categories.js — Category Management
 */

import { escHtml } from './helpers.js';

export async function renderCategories(container) {
  async function load() {
    const res = await window.cms.categories.list();
    return res.ok ? res.data : [];
  }

  let cats = await load();

  function renderList() {
    list.innerHTML = cats.map(c => `
      <tr>
        <td>${c.display_order}</td>
        <td><div class="td-name">${escHtml(c.name)}</div><div class="td-code">${escHtml(c.slug)}</div></td>
        <td>${escHtml(c.html_file)}</td>
        <td>${c.active_products || 0} active / ${c.oos_products || 0} OOS</td>
        <td>${c.homepage_visible ? '<span class="badge badge--active">Visible</span>' : '<span class="badge badge--archived">Hidden</span>'}</td>
        <td class="col-actions">
          <div class="flex-gap">
            <button class="btn-icon" data-edit="${c.id}" title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon btn-icon--danger" data-delete="${c.id}" title="Delete"
              ${(c.total_products || 0) > 0 ? 'disabled style="opacity:0.35;cursor:not-allowed;"' : ''}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </td>
      </tr>`).join('');
  }

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Categories</h1>
      <button class="btn-primary" id="cat-create-btn">+ New Category</button>
    </div>
    <div class="page-content">
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Order</th><th>Category</th><th>HTML File</th><th>Products</th><th>Homepage</th><th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody id="cat-list"></tbody>
        </table>
      </div>
    </div>
  `;

  const list = container.querySelector('#cat-list');
  renderList();

  // ── Create Category ──────────────────────────────────────────────────────────
  container.querySelector('#cat-create-btn').onclick = () => {
    const bodyHtml = `
      <div class="form-group"><label class="form-label">Name <span style="color:var(--clr-error)">*</span></label><input id="cc-name" class="form-input" placeholder="e.g. Silk Sarees" /></div>
      <div class="form-group"><label class="form-label">Slug <span style="color:var(--clr-error)">*</span></label><input id="cc-slug" class="form-input" placeholder="e.g. silk-sarees" /></div>
      <div class="form-group"><label class="form-label">SEO Title</label><input id="cc-seo-title" class="form-input" /></div>
      <div class="form-group"><label class="form-label">SEO Description</label><textarea id="cc-seo-desc" class="form-textarea" style="min-height:60px;"></textarea></div>
      <div class="form-group"><label class="form-label">Display Order</label><input id="cc-order" class="form-input" type="number" value="99" style="max-width:100px;"/></div>
      <div class="form-group"><label class="form-toggle"><input type="checkbox" id="cc-visible" checked /><span class="toggle-track"></span><span class="toggle-label">Show in homepage collections</span></label></div>
    `;
    const footer = document.createElement('div');
    footer.className = 'flex-gap';
    footer.innerHTML = `<button class="btn-secondary" id="cc-cancel">Cancel</button><button class="btn-primary" id="cc-save">Create Category</button>`;
    const { close } = window.Modal.show({ title: 'New Category', body: bodyHtml, footer, size: 'lg' });
    footer.querySelector('#cc-cancel').onclick = close;

    // Auto-fill slug from name
    document.getElementById('cc-name').addEventListener('input', (e) => {
      const slugEl = document.getElementById('cc-slug');
      if (!slugEl.dataset.edited) {
        slugEl.value = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      }
    });
    document.getElementById('cc-slug').addEventListener('input', (e) => {
      e.target.dataset.edited = '1';
    });

    footer.querySelector('#cc-save').onclick = async () => {
      const name = document.getElementById('cc-name').value.trim();
      const slug = document.getElementById('cc-slug').value.trim();
      if (!name || !slug) { window.Toast.error('Name and Slug are required.'); return; }
      const res = await window.cms.categories.create({
        name, slug,
        seoTitle:        document.getElementById('cc-seo-title').value.trim(),
        seoDescription:  document.getElementById('cc-seo-desc').value.trim(),
        displayOrder:    parseInt(document.getElementById('cc-order').value) || 99,
        homepageVisible: document.getElementById('cc-visible').checked,
      });
      if (res.ok) {
        close(); cats = await load(); renderList();
        window.Toast.success('Category created!');
      } else {
        window.Toast.error(`Failed: ${res.error}`);
      }
    };
  };

  // ── Edit / Delete Category ───────────────────────────────────────────────────
  list.addEventListener('click', async (e) => {
    // Delete
    const delBtn = e.target.closest('[data-delete]');
    if (delBtn && !delBtn.disabled) {
      const cat = cats.find(c => c.id == delBtn.dataset.delete);
      if (!cat) return;
      if ((cat.total_products || 0) > 0) {
        window.Toast.error(`Cannot delete "${cat.name}" — it has ${cat.total_products} products. Reassign or delete them first.`);
        return;
      }
      if (!confirm(`Permanently delete category "${cat.name}"? This cannot be undone.`)) return;
      const res = await window.cms.categories.delete(cat.id);
      if (res.ok) { cats = await load(); renderList(); window.Toast.success('Category deleted.'); }
      else window.Toast.error(`Failed: ${res.error}`);
      return;
    }

    // Edit
    const btn = e.target.closest('[data-edit]');
    if (!btn) return;
    const cat = cats.find(c => c.id == btn.dataset.edit);
    if (!cat) return;

    const bodyHtml = `
      <div class="form-group"><label class="form-label">Category Name</label><input id="ce-name" class="form-input" value="${escHtml(cat.name)}" /></div>
      <div class="form-group"><label class="form-label">Description</label><textarea id="ce-desc" class="form-textarea">${escHtml(cat.description || '')}</textarea></div>
      <div class="form-group"><label class="form-label">Intro Headline</label><input id="ce-headline" class="form-input" value="${escHtml(cat.intro_headline || '')}" /></div>
      <div class="form-group"><label class="form-label">Intro Text</label><textarea id="ce-intro" class="form-textarea">${escHtml(cat.intro_text || '')}</textarea></div>
      <div class="form-group"><label class="form-label">SEO Title</label><input id="ce-seo-title" class="form-input" value="${escHtml(cat.seo_title || '')}" /></div>
      <div class="form-group"><label class="form-label">SEO Description</label><textarea id="ce-seo-desc" class="form-textarea" style="min-height:70px;">${escHtml(cat.seo_description || '')}</textarea></div>
      <div class="form-group"><label class="form-label">Display Order</label><input id="ce-order" class="form-input" type="number" value="${cat.display_order}" style="max-width:100px;" /></div>
      <div class="form-group"><label class="form-toggle">
        <input type="checkbox" id="ce-visible" ${cat.homepage_visible ? 'checked' : ''} />
        <span class="toggle-track"></span>
        <span class="toggle-label">Show in homepage collections</span>
      </label></div>
    `;

    const footer = document.createElement('div');
    footer.className = 'flex-gap';
    footer.innerHTML = `<button class="btn-secondary" id="ce-cancel">Cancel</button><button class="btn-primary" id="ce-save">Save Changes</button>`;

    const { close } = window.Modal.show({ title: `Edit: ${cat.name}`, body: bodyHtml, footer, size: 'lg' });

    footer.querySelector('#ce-cancel').onclick = close;
    footer.querySelector('#ce-save').onclick = async () => {
      const res = await window.cms.categories.update(cat.id, {
        name:            document.getElementById('ce-name').value,
        description:     document.getElementById('ce-desc').value,
        introHeadline:   document.getElementById('ce-headline').value,
        introText:       document.getElementById('ce-intro').value,
        seoTitle:        document.getElementById('ce-seo-title').value,
        seoDescription:  document.getElementById('ce-seo-desc').value,
        displayOrder:    parseInt(document.getElementById('ce-order').value) || 0,
        homepageVisible: document.getElementById('ce-visible').checked,
      });
      if (res.ok) {
        close();
        cats = await load();
        renderList();
        window.Toast.success('Category updated!');
      } else {
        window.Toast.error(`Failed: ${res.error}`);
      }
    };
  });
}
