/**
 * views/product-form.js — Add / Edit Product Form
 */

import { escHtml, navigateTo } from './helpers.js';

export async function renderProductForm(container, productId) {
  const isEdit = !!productId;
  let product        = null;
  let mainImagePath  = null;
  let variantPaths   = [];
  let specs          = [];  // [{key, value}, ...]
  let variants       = [];  // [{label, status}, ...]
  let loadedAt       = null; // timestamp when product was loaded (for staleness check)

  // Inject spec-editor styles once
  if (!document.getElementById('spec-editor-styles')) {
    const style = document.createElement('style');
    style.id = 'spec-editor-styles';
    style.textContent = `
      .spec-row {
        display: grid;
        grid-template-columns: 1fr 1fr auto;
        gap: 8px;
        align-items: center;
        margin-bottom: 8px;
      }
      .spec-row input { width: 100%; }
      .spec-row__remove {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--clr-error);
        font-size: 1.1rem;
        padding: 0 6px;
        line-height: 1;
        opacity: 0.7;
        transition: opacity 0.15s;
      }
      .spec-row__remove:hover { opacity: 1; }
      .spec-preview {
        background: var(--clr-surface-3);
        border-radius: 8px;
        padding: 10px 14px;
        margin-top: 4px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .spec-preview__chip {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.78rem;
        padding: 3px 10px;
        background: var(--clr-surface-2);
        border: 1px solid var(--clr-border);
        border-radius: 20px;
        color: var(--clr-text-1);
      }
      .spec-preview__chip strong { color: var(--clr-primary); }
      .spec-preview__empty { color: var(--clr-text-3); font-size: 0.78rem; }
      #spec-incomplete-warning {
        display: none;
        background: rgba(251,191,36,0.13);
        border: 1px solid rgba(251,191,36,0.4);
        color: #b45309;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 0.8rem;
        margin-top: 8px;
      }
      /* ── Variant editor ── */
      .variant-row {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 8px;
        align-items: center;
        margin-bottom: 8px;
      }
      .variant-row input { width: 100%; }
      .variant-status-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.78rem;
        white-space: nowrap;
      }
      .variant-row__remove {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--clr-error);
        font-size: 1.1rem;
        padding: 0 4px;
        opacity: 0.7;
        transition: opacity 0.15s;
      }
      .variant-row__remove:hover { opacity: 1; }
      .variant-derived-note {
        font-size: 0.75rem;
        color: var(--clr-text-3);
        margin-top: 4px;
      }
    `;
    document.head.appendChild(style);
  }

  // Load data
  const [catsRes, specKeysRes] = await Promise.all([
    window.cms.categories.list(),
    window.cms.products.specKeys(),
  ]);
  const cats     = catsRes.ok ? catsRes.data : [];
  const specKeys = specKeysRes.ok ? specKeysRes.data : [];

  if (isEdit) {
    const res = await window.cms.products.get(productId);
    if (res.ok) {
      product  = res.data;
      specs    = Array.isArray(product.specs) ? [...product.specs] : [];
      loadedAt = product.updated_at; // snapshot for staleness check
    }
    const imgRes = await window.cms.products.getImages(productId);
    if (imgRes.ok) variantPaths = imgRes.data.map(i => i.image_path);
    const varRes = await window.cms.products.getVariants(productId);
    if (varRes.ok) variants = varRes.data;
  }
  // Ensure at least one variant
  if (!variants.length) variants = [{ label: 'Default', status: 'active' }];

  // Build datalist HTML for spec key autocomplete
  const datalistHtml = `
    <datalist id="spec-keys-list">
      ${specKeys.map(k => `<option value="${escHtml(k)}">`).join('')}
    </datalist>`;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__title-group">
        <h1 class="page-title">${isEdit ? 'Edit Product' : 'Add New Product'}</h1>
        <p class="page-subtitle">${isEdit ? `Editing: ${escHtml(product?.name || '')}` : 'Fill in product details'}</p>
      </div>
      <div class="page-header__actions">
        <button class="btn-secondary" id="form-back-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Products
        </button>
      </div>
    </div>

    ${datalistHtml}

    <div class="page-content">
      <form id="product-form" class="sidebar-layout">

        <!-- Left: Main Fields -->
        <div style="display:flex;flex-direction:column;gap:20px;">

          <!-- Basic Info -->
          <div class="card">
            <div class="card-header"><span class="card-title">Product Information</span></div>
            <div class="card-body">
              <div class="form-group">
                <label class="form-label" for="pf-name">Product Name *</label>
                <input id="pf-name" class="form-input" type="text" required
                  value="${escHtml(product?.name || '')}" placeholder="e.g. Premium Silk Saree" />
              </div>
              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label" for="pf-category">Category *</label>
                  <select id="pf-category" class="form-select" required>
                    <option value="">Select category</option>
                    ${cats.map(c => `<option value="${c.id}" ${product?.category_id == c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="pf-status">Status</label>
                  <select id="pf-status" class="form-select">
                    <option value="active" ${(!product || product.status === 'active') ? 'selected' : ''}>Active</option>
                    <option value="out_of_stock" ${product?.status === 'out_of_stock' ? 'selected' : ''}>Out of Stock</option>
                    <option value="archived" ${product?.status === 'archived' ? 'selected' : ''}>Archived</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="pf-desc">Description</label>
                <textarea id="pf-desc" class="form-textarea" placeholder="Product description for the website...">${escHtml(product?.description || '')}</textarea>
              </div>
              <div class="form-group">
                <label class="form-toggle">
                  <input type="checkbox" id="pf-featured" ${product?.featured ? 'checked' : ''} />
                  <span class="toggle-track"></span>
                  <span class="toggle-label">Featured product (shown in homepage)</span>
                </label>
              </div>
              <div class="form-group">
                <label class="form-label" for="pf-order">Display Order</label>
                <input id="pf-order" class="form-input" type="number" min="0"
                  value="${product?.display_order || 0}" style="max-width:120px;" />
                <p class="form-hint">Lower numbers appear first in the category page.</p>
              </div>
            </div>
          </div>

          <!-- Product Variants -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Stock Variants</span>
              <span style="font-size:0.75rem;color:var(--clr-text-3);margin-left:8px;">e.g. Color: Red, Fabric: Silk</span>
            </div>
            <div class="card-body">
              <div id="variant-rows"></div>
              <button type="button" class="btn-secondary btn-sm" id="variant-add-btn" style="margin-top:8px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Variant
              </button>
              <p class="variant-derived-note" id="variant-status-note" style="display:none">
                ⓘ Product status is derived from variants — active if any variant is in stock.
              </p>
            </div>
          </div>

          <!-- Product Specifications -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Product Specifications</span>
              <span style="font-size:0.75rem;color:var(--clr-text-3);margin-left:8px;">e.g. Colors: 4, Set of: 6</span>
            </div>
            <div class="card-body">
              <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid var(--clr-border);">
                <span style="font-size:0.75rem;font-weight:600;color:var(--clr-text-2);">Spec Name</span>
                <span style="font-size:0.75rem;font-weight:600;color:var(--clr-text-2);">Value</span>
                <span></span>
              </div>
              <div id="spec-rows"></div>
              <div id="spec-incomplete-warning">
                ⚠ Some spec rows were skipped — both name and value must be filled in.
              </div>
              <button type="button" class="btn-secondary btn-sm" id="spec-add-btn" style="margin-top:10px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Specification
              </button>

              <!-- Live preview chips -->
              <div style="margin-top:14px;">
                <p style="font-size:0.73rem;color:var(--clr-text-3);margin-bottom:6px;">Preview on product card:</p>
                <div class="spec-preview" id="spec-preview">
                  <span class="spec-preview__empty">No specifications yet</span>
                </div>
              </div>
            </div>
          </div>

          <!-- SEO -->
          <div class="card">
            <div class="card-header"><span class="card-title">SEO Settings</span></div>
            <div class="card-body">
              <div class="form-group">
                <label class="form-label" for="pf-seo-title">SEO Title</label>
                <input id="pf-seo-title" class="form-input" type="text"
                  value="${escHtml(product?.seo_title || '')}" placeholder="Leave blank to auto-generate" />
              </div>
              <div class="form-group">
                <label class="form-label" for="pf-seo-desc">SEO Description</label>
                <textarea id="pf-seo-desc" class="form-textarea" style="min-height:70px;"
                  placeholder="Leave blank to use product description">${escHtml(product?.seo_description || '')}</textarea>
              </div>
            </div>
          </div>

        </div>

        <!-- Right: Images -->
        <div style="display:flex;flex-direction:column;gap:20px;">

          <!-- Main Image -->
          <div class="card">
            <div class="card-header"><span class="card-title">Main Image *</span></div>
            <div class="card-body">
              <div id="main-img-preview" class="${product?.main_image ? '' : 'hidden'}" style="margin-bottom:12px;">
                <div class="upload-preview-item upload-preview-item--main" style="max-width:160px;">
                  <img id="main-img-el" src="${product?.main_image || ''}" alt="Main image" />
                  <div class="upload-preview-item__remove" id="main-remove-btn">&times;</div>
                </div>
              </div>
              <div id="main-upload-zone" class="upload-zone ${product?.main_image ? 'hidden' : ''}">
                <svg class="upload-zone__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <p class="upload-zone__text">Click to select main image</p>
                <p class="upload-zone__hint">JPG, PNG — Max 10MB</p>
              </div>
            </div>
          </div>

          <!-- Variant Images -->
          <div class="card">
            <div class="card-header"><span class="card-title">Variant Images</span></div>
            <div class="card-body">
              <div id="variant-preview-grid" class="upload-preview-grid">
                ${variantPaths.map((p, i) => `
                  <div class="upload-preview-item" data-variant-idx="${i}">
                    <img src="${p}" alt="Variant ${i+1}" />
                    <div class="upload-preview-item__remove" data-rm-variant="${i}">&times;</div>
                  </div>`).join('')}
              </div>
              <div class="upload-zone mt-2" id="variant-upload-zone">
                <svg class="upload-zone__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <p class="upload-zone__text">Click to add variant images</p>
                <p class="upload-zone__hint">You can select multiple at once</p>
              </div>
            </div>
          </div>

          <!-- Save Button -->
          <div>
            <button type="submit" class="btn-primary btn-full" id="save-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              ${isEdit ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </div>

      </form>
    </div>
  `;

  // ── Spec Editor Logic ──────────────────────────────────────────────────────

  const specRowsEl   = container.querySelector('#spec-rows');
  const specPreview  = container.querySelector('#spec-preview');
  const specWarning  = container.querySelector('#spec-incomplete-warning');

  function renderSpecRows() {
    specRowsEl.innerHTML = specs.map((s, i) => `
      <div class="spec-row" data-spec-idx="${i}">
        <input type="text" class="form-input spec-key-input" list="spec-keys-list"
          placeholder="e.g. Colors" value="${escHtml(s.key || '')}" data-idx="${i}" data-field="key" />
        <input type="text" class="form-input spec-val-input"
          placeholder="e.g. 4" value="${escHtml(s.value || '')}" data-idx="${i}" data-field="value" />
        <button type="button" class="spec-row__remove" data-rm="${i}" title="Remove">×</button>
      </div>`).join('');

    // Empty state
    if (specs.length === 0) {
      specRowsEl.innerHTML = `<p style="font-size:0.8rem;color:var(--clr-text-3);margin-bottom:8px;">No specifications yet. Click "Add Specification" to get started.</p>`;
    }

    updatePreview();
    attachSpecRowEvents();
  }

  function attachSpecRowEvents() {
    specRowsEl.querySelectorAll('[data-field]').forEach(input => {
      input.addEventListener('input', () => {
        const idx   = parseInt(input.dataset.idx);
        const field = input.dataset.field;
        if (!specs[idx]) specs[idx] = { key: '', value: '' };
        specs[idx][field] = input.value;
        updatePreview();
      });
    });

    specRowsEl.querySelectorAll('[data-rm]').forEach(btn => {
      btn.addEventListener('click', () => {
        specs.splice(parseInt(btn.dataset.rm), 1);
        renderSpecRows();
      });
    });
  }

  function updatePreview() {
    const filled = specs.filter(s => s.key?.trim() && s.value?.trim());
    if (filled.length === 0) {
      specPreview.innerHTML = `<span class="spec-preview__empty">No specifications yet</span>`;
    } else {
      specPreview.innerHTML = filled.map(s =>
        `<span class="spec-preview__chip"><strong>${escHtml(s.key)}:</strong> ${escHtml(s.value)}</span>`
      ).join('');
    }
  }

  container.querySelector('#spec-add-btn').onclick = () => {
    specs.push({ key: '', value: '' });
    renderSpecRows();
    // Focus the new key input
    const rows = specRowsEl.querySelectorAll('.spec-key-input');
    if (rows.length) rows[rows.length - 1].focus();
  };

  renderSpecRows();

  // ── Image handlers ─────────────────────────────────────────────────────────

  container.querySelector('#form-back-btn').onclick = () => navigateTo('products');

  container.querySelector('#main-upload-zone').onclick = async () => {
    const paths = await window.cms.dialog.openImage();
    if (!paths.data || !paths.data.length) return;
    mainImagePath = paths.data[0];
    container.querySelector('#main-img-el').src = mainImagePath;
    container.querySelector('#main-img-preview').classList.remove('hidden');
    container.querySelector('#main-upload-zone').classList.add('hidden');
  };

  container.querySelector('#main-remove-btn').onclick = () => {
    mainImagePath = null;
    container.querySelector('#main-img-preview').classList.add('hidden');
    container.querySelector('#main-upload-zone').classList.remove('hidden');
  };

  container.querySelector('#variant-upload-zone').onclick = async () => {
    const paths = await window.cms.dialog.openImage();
    if (!paths.data || !paths.data.length) return;
    variantPaths.push(...paths.data);
    refreshVariantGrid();
  };

  function refreshVariantGrid() {
    const grid = container.querySelector('#variant-preview-grid');
    grid.innerHTML = variantPaths.map((p, i) => `
      <div class="upload-preview-item">
        <img src="${p}" alt="Variant ${i+1}" />
        <div class="upload-preview-item__remove" data-rm-variant="${i}">&times;</div>
      </div>`).join('');

    grid.querySelectorAll('[data-rm-variant]').forEach(btn => {
      btn.onclick = () => {
        variantPaths.splice(parseInt(btn.dataset.rmVariant), 1);
        refreshVariantGrid();
      };
    });
  }

  refreshVariantGrid();

  // ── Form Submit ────────────────────────────────────────────────────────────

  container.querySelector('#product-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const catId  = container.querySelector('#pf-category').value;
    const catObj = cats.find(c => String(c.id) === catId);

    // Check for incomplete spec rows and warn
    const hasIncomplete = specs.some(s =>
      (s.key?.trim() && !s.value?.trim()) || (!s.key?.trim() && s.value?.trim())
    );
    specWarning.style.display = hasIncomplete ? 'block' : 'none';

    // Filter clean specs (both key + value filled)
    const cleanSpecs = specs.filter(s => s.key?.trim() && s.value?.trim());

    const saveBtn = container.querySelector('#save-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Saving...';

    const payload = {
      name:              container.querySelector('#pf-name').value.trim(),
      categoryId:        parseInt(catId),
      categorySlug:      catObj?.slug || '',
      description:       container.querySelector('#pf-desc').value.trim(),
      status:            container.querySelector('#pf-status').value,
      featured:          container.querySelector('#pf-featured').checked,
      displayOrder:      parseInt(container.querySelector('#pf-order').value) || 0,
      seoTitle:          container.querySelector('#pf-seo-title').value.trim(),
      seoDesc:           container.querySelector('#pf-seo-desc').value.trim(),
      mainImagePath:     mainImagePath,
      variantImagePaths: variantPaths, // full ordered list: existing 'images/…' paths + new OS paths
      specs:             cleanSpecs,
    };

    let res;
    if (isEdit) {
      res = await window.cms.products.update(productId, payload);
    } else {
      res = await window.cms.products.create(payload);
    }

    if (res.ok) {
      // Save variants (for both create and edit)
      const savedId = isEdit ? productId : res.data?.id;
      if (savedId) {
        const cleanVariants = variants
          .filter(v => v.label?.trim())
          .map((v, i) => ({ label: v.label.trim(), status: v.status || 'active', sort_order: i }));
        await window.cms.products.setVariants(savedId, cleanVariants.length ? cleanVariants : [{ label: 'Default', status: 'active' }]);
      }

      // Staleness check: warn if status was changed externally since form was loaded
      if (isEdit && loadedAt && res.data?.updated_at && res.data.updated_at !== loadedAt) {
        window.Toast.info('ℹ️ Note: this product was modified by another action since you opened this form. The saved values are now current.');
      }

      const msg = hasIncomplete
        ? `Product ${isEdit ? 'updated' : 'created'} — some incomplete specs were skipped.`
        : `Product ${isEdit ? 'updated' : 'created'} successfully!`;
      window.Toast.success(msg);
      navigateTo('products');
    } else {
      window.Toast.error(`Failed: ${res.error}`);
      saveBtn.disabled = false;
      saveBtn.innerHTML = isEdit ? 'Save Changes' : 'Create Product';
    }
  });

  // ── Variant Editor Logic ────────────────────────────────────────────────────

  const variantRowsEl   = container.querySelector('#variant-rows');
  const variantStatusNote = container.querySelector('#variant-status-note');
  const statusSelect    = container.querySelector('#pf-status');

  function renderVariantRows() {
    const isDefault = variants.length === 1 && variants[0].label === 'Default';

    // Show/hide derived-status note
    if (variants.length > 1) {
      statusSelect.disabled = true;
      if (variantStatusNote) variantStatusNote.style.display = 'block';
    } else {
      statusSelect.disabled = false;
      if (variantStatusNote) variantStatusNote.style.display = 'none';
    }

    variantRowsEl.innerHTML = variants.map((v, i) => {
      const isDefaultSingle = isDefault && i === 0;
      const labelPlaceholder = isDefaultSingle ? 'Single item (no variants)' : 'e.g. Color: Red';
      return `
        <div class="variant-row" data-variant-idx="${i}">
          <input type="text" class="form-input variant-label-input"
            placeholder="${labelPlaceholder}"
            value="${escHtml(v.label === 'Default' && isDefaultSingle ? '' : (v.label || ''))}"
            data-idx="${i}" ${isDefaultSingle ? 'disabled' : ''} />
          <label class="variant-status-toggle">
            <input type="checkbox" class="variant-status-chk" data-idx="${i}"
              ${v.status === 'active' ? 'checked' : ''} />
            <span style="font-size:0.78rem;">${v.status === 'active' ? 'In Stock' : 'OOS'}</span>
          </label>
          ${!isDefaultSingle ? `<button type="button" class="variant-row__remove" data-rm-variant="${i}" title="Remove">×</button>` : '<span></span>'}
        </div>`;
    }).join('');

    attachVariantRowEvents();
  }

  function attachVariantRowEvents() {
    variantRowsEl.querySelectorAll('.variant-label-input').forEach(input => {
      input.addEventListener('input', () => {
        const idx = parseInt(input.dataset.idx);
        variants[idx].label = input.value || 'Default';
      });
    });

    variantRowsEl.querySelectorAll('.variant-status-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        const idx = parseInt(chk.dataset.idx);
        variants[idx].status = chk.checked ? 'active' : 'out_of_stock';
        // Update sibling label
        const label = chk.parentElement.querySelector('span');
        if (label) label.textContent = chk.checked ? 'In Stock' : 'OOS';
      });
    });

    variantRowsEl.querySelectorAll('[data-rm-variant]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.rmVariant);
        variants.splice(idx, 1);
        if (!variants.length) variants = [{ label: 'Default', status: 'active' }];
        renderVariantRows();
      });
    });
  }

  container.querySelector('#variant-add-btn').onclick = () => {
    // Convert single Default to a proper variant when adding a second one
    if (variants.length === 1 && variants[0].label === 'Default') {
      variants[0].label = '';
    }
    variants.push({ label: '', status: 'active' });
    renderVariantRows();
    const inputs = variantRowsEl.querySelectorAll('.variant-label-input:not([disabled])');
    if (inputs.length) inputs[inputs.length - 1].focus();
  };

  renderVariantRows();
}
