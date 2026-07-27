/**
 * views/seo.js — Per-Page SEO Manager
 */

import { escHtml } from './helpers.js';

export async function renderSEO(container) {
  const [seoRes, catsRes] = await Promise.all([
    window.cms.seo.list(),
    window.cms.categories.list(),
  ]);

  const seoList = seoRes.ok ? seoRes.data : [];
  const cats    = catsRes.ok ? catsRes.data : [];

  // Build page list: static pages + category pages
  const pages = [
    { key: 'home',    label: 'Homepage',      url: '/' },
    { key: 'contact', label: 'Contact Page',   url: '/contact.html' },
    ...cats.map(c => ({ key: c.slug, label: c.name, url: `/${c.html_file}` })),
  ];

  let activePage = pages[0].key;

  function getSeoFor(key) {
    return seoList.find(s => s.page_key === key) || {};
  }

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">SEO Manager</h1>
      <p class="page-subtitle">Manage meta titles, descriptions, and canonical URLs per page</p>
    </div>
    <div class="page-content">
      <div style="display:grid;grid-template-columns:220px 1fr;gap:20px;">
        <!-- Page List -->
        <div class="card" style="align-self:start;">
          <div class="card-header"><span class="card-title">Pages</span></div>
          <div style="padding:8px 0;">
            ${pages.map(p => `
              <button class="seo-page-btn" data-key="${p.key}"
                style="width:100%;text-align:left;padding:10px 18px;font-size:.83rem;border:none;background:none;cursor:pointer;color:var(--clr-text-2);border-left:2px solid transparent;transition:all .15s;">
                ${escHtml(p.label)}
              </button>`).join('')}
          </div>
        </div>
        <!-- SEO Editor -->
        <div id="seo-editor"></div>
      </div>
    </div>
  `;

  function renderEditor(key) {
    const page = pages.find(p => p.key === key);
    const seo  = getSeoFor(key);
    const editor = container.querySelector('#seo-editor');

    editor.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">SEO: ${escHtml(page?.label || key)}</span>
          <span style="font-size:.75rem;color:var(--clr-text-3);">${page?.url || ''}</span>
        </div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">Title Tag <span class="text-muted text-sm" id="title-count">(${(seo.title||'').length}/60)</span></label>
            <input id="seo-title" class="form-input" value="${escHtml(seo.title || '')}" maxlength="80" placeholder="Page title (60 chars ideal)" />
          </div>
          <div class="form-group">
            <label class="form-label">Meta Description <span class="text-muted text-sm" id="desc-count">(${(seo.description||'').length}/160)</span></label>
            <textarea id="seo-desc" class="form-textarea" maxlength="200" placeholder="Meta description (160 chars ideal)">${escHtml(seo.description || '')}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Canonical URL</label>
            <input id="seo-canonical" class="form-input" type="url" value="${escHtml(seo.canonical || '')}" placeholder="https://mrtextile.online${page?.url || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Open Graph Image URL</label>
            <input id="seo-og-img" class="form-input" type="url" value="${escHtml(seo.og_image || '')}" placeholder="https://mrtextile.online/..." />
          </div>
          <button class="btn-primary" id="seo-save">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/></svg>
            Save SEO Settings
          </button>
        </div>
      </div>
    `;

    // Character counters
    editor.querySelector('#seo-title').oninput = (e) => {
      editor.querySelector('#title-count').textContent = `(${e.target.value.length}/60)`;
    };
    editor.querySelector('#seo-desc').oninput = (e) => {
      editor.querySelector('#desc-count').textContent = `(${e.target.value.length}/160)`;
    };

    editor.querySelector('#seo-save').onclick = async () => {
      const res = await window.cms.seo.update(key, {
        title:       editor.querySelector('#seo-title').value,
        description: editor.querySelector('#seo-desc').value,
        canonical:   editor.querySelector('#seo-canonical').value,
        ogImage:     editor.querySelector('#seo-og-img').value,
      });
      if (res.ok) {
        // Update local cache
        const existing = seoList.find(s => s.page_key === key);
        if (existing) {
          existing.title       = editor.querySelector('#seo-title').value;
          existing.description = editor.querySelector('#seo-desc').value;
        } else {
          seoList.push({ page_key: key, title: editor.querySelector('#seo-title').value, description: editor.querySelector('#seo-desc').value });
        }
        window.Toast.success(`SEO saved for ${page?.label}`);
      } else {
        window.Toast.error(`Failed: ${res.error}`);
      }
    };
  }

  // Sidebar buttons
  container.querySelectorAll('.seo-page-btn').forEach(btn => {
    btn.onclick = () => {
      container.querySelectorAll('.seo-page-btn').forEach(b => b.style.borderLeftColor = 'transparent');
      btn.style.borderLeftColor = 'var(--clr-burgundy-lt)';
      btn.style.color = 'var(--clr-text)';
      activePage = btn.dataset.key;
      renderEditor(activePage);
    };
  });

  // Default: show first
  container.querySelector(`[data-key="${activePage}"]`).click();
}
