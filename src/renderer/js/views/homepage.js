/**
 * views/homepage.js — Homepage Configuration
 */

import { escHtml } from './helpers.js';

export async function renderHomepage(container) {
  const [configRes, catsRes, prodsRes] = await Promise.all([
    window.cms.homepage.get(),
    window.cms.categories.list(),
    window.cms.products.list({ featured: true }),
  ]);

  const config = configRes.ok ? configRes.data : {};
  const cats   = catsRes.ok  ? catsRes.data  : [];
  const prods  = prodsRes.ok ? prodsRes.data : [];

  const selectedCats  = config.featuredCategories  || [];
  const selectedProds = config.featuredProducts    || [];

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Homepage Manager</h1>
      <p class="page-subtitle">Control what appears on the website's front page</p>
    </div>
    <div class="page-content" style="max-width:800px;">

      <div class="card mb-3">
        <div class="card-header"><span class="card-title">Hero Section</span></div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">Hero Image URL (relative path)</label>
            <input id="hp-hero" class="form-input" value="${escHtml(config.heroImage || 'images/hero/hero_1.jpg')}" />
            <p class="form-hint">e.g. images/hero/hero_1.jpg</p>
          </div>
          <div class="form-group">
            <label class="form-label">Hero Title</label>
            <input id="hp-hero-title" class="form-input" value="${escHtml(config.heroTitle || 'Premium Wholesale Sarees')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Hero Subtitle</label>
            <input id="hp-hero-sub" class="form-input" value="${escHtml(config.heroSubtitle || 'Direct from Surat\'s Manish Market')}" />
          </div>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header"><span class="card-title">Featured Categories</span></div>
        <div class="card-body">
          <p class="form-hint mb-2">Select categories to show in the homepage collections section:</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            ${cats.map(c => `
              <label class="form-toggle">
                <input type="checkbox" name="feat-cat" value="${c.id}" ${selectedCats.includes(c.id) || c.homepage_visible ? 'checked' : ''} />
                <span class="toggle-track"></span>
                <span class="toggle-label">${escHtml(c.name)}</span>
              </label>`).join('')}
          </div>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-header"><span class="card-title">Featured Products</span></div>
        <div class="card-body">
          <p class="form-hint mb-2">Mark products as "Featured" in the Products module to show them here.</p>
          ${prods.length === 0
            ? '<p class="text-sm text-muted">No featured products. Edit products and enable the "Featured" toggle.</p>'
            : `<div style="display:grid;gap:6px;">
                ${prods.map(p => `
                  <div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--clr-surface-2);border-radius:6px;">
                    <img src="${p.main_image||''}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;" onerror="this.style.display='none'" />
                    <span style="font-size:.83rem;">${escHtml(p.name)}</span>
                    <span class="badge badge--featured" style="margin-left:auto;">Featured</span>
                  </div>`).join('')}
              </div>`
          }
        </div>
      </div>

      <button class="btn-primary" id="hp-save">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/></svg>
        Save Homepage Configuration
      </button>
    </div>
  `;

  container.querySelector('#hp-save').onclick = async () => {
    const featCats = [...container.querySelectorAll('input[name="feat-cat"]:checked')].map(i => parseInt(i.value));
    const res = await window.cms.homepage.update({
      heroImage:           container.querySelector('#hp-hero').value.trim(),
      heroTitle:           container.querySelector('#hp-hero-title').value.trim(),
      heroSubtitle:        container.querySelector('#hp-hero-sub').value.trim(),
      featuredCategories:  featCats,
      featuredProducts:    selectedProds,
    });
    if (res.ok) window.Toast.success('Homepage configuration saved!');
    else window.Toast.error(`Failed: ${res.error}`);
  };
}
