/**
 * views/product-form.js — Add / Edit Product Form
 */

import { escHtml, navigateTo } from './helpers.js';

export async function renderProductForm(container, productId) {
  const isEdit = !!productId;
  let product  = null;
  let mainImagePath   = null;
  let variantPaths    = [];

  const catsRes = await window.cms.categories.list();
  const cats    = catsRes.ok ? catsRes.data : [];

  if (isEdit) {
    const res = await window.cms.products.get(productId);
    if (res.ok) product = res.data;
    const imgRes = await window.cms.products.getImages(productId);
    if (imgRes.ok) variantPaths = imgRes.data.map(i => i.image_path);
  }

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

  container.querySelector('#form-back-btn').onclick = () => navigateTo('products');

  // Main image upload
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

  // Variant upload
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

  // Form submit
  container.querySelector('#product-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const catId  = container.querySelector('#pf-category').value;
    const catObj = cats.find(c => String(c.id) === catId);

    const saveBtn = container.querySelector('#save-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Saving...';

    const payload = {
      name:             container.querySelector('#pf-name').value.trim(),
      categoryId:       parseInt(catId),
      categorySlug:     catObj?.slug || '',
      description:      container.querySelector('#pf-desc').value.trim(),
      status:           container.querySelector('#pf-status').value,
      featured:         container.querySelector('#pf-featured').checked,
      displayOrder:     parseInt(container.querySelector('#pf-order').value) || 0,
      seoTitle:         container.querySelector('#pf-seo-title').value.trim(),
      seoDesc:          container.querySelector('#pf-seo-desc').value.trim(),
      mainImagePath:    mainImagePath,
      variantImagePaths: variantPaths.filter(p => !p.startsWith('images/')), // only new local paths
    };

    let res;
    if (isEdit) {
      res = await window.cms.products.update(productId, payload);
    } else {
      res = await window.cms.products.create(payload);
    }

    if (res.ok) {
      window.Toast.success(`Product ${isEdit ? 'updated' : 'created'} successfully!`);
      navigateTo('products');
    } else {
      window.Toast.error(`Failed: ${res.error}`);
      saveBtn.disabled = false;
      saveBtn.innerHTML = isEdit ? 'Save Changes' : 'Create Product';
    }
  });
}
