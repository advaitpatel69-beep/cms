/**
 * views/media-library.js — Central Image Browser
 */

import { escHtml } from './helpers.js';

function fmtSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(0)}KB`;
  return `${(bytes/(1024*1024)).toFixed(1)}MB`;
}

export async function renderMediaLibrary(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Media Library</h1>
      <p class="page-subtitle" id="media-count">Loading...</p>
    </div>
    <div class="page-content">
      <div class="table-toolbar mb-3" style="background:var(--clr-surface);border:1px solid var(--clr-border);border-radius:10px;padding:12px 16px;">
        <div class="table-search" style="max-width:360px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="media-search" type="search" placeholder="Search by filename..." />
        </div>
        <div class="flex-gap">
          <select class="form-select" id="media-filter" style="width:auto;">
            <option value="">All Types</option>
            <option value="webp">WebP</option>
            <option value="avif">AVIF</option>
            <option value="jpg">JPG/JPEG</option>
            <option value="png">PNG</option>
          </select>
        </div>
      </div>
      <div class="media-grid" id="media-grid"></div>
    </div>
  `;

  const grid    = container.querySelector('#media-grid');
  const countEl = container.querySelector('#media-count');

  const res   = await window.cms.media.list();
  let   files = res.ok ? res.data : [];

  function render() {
    const search    = container.querySelector('#media-search').value.toLowerCase();
    const typeFilter = container.querySelector('#media-filter').value.toLowerCase();

    const filtered = files.filter(f => {
      if (search && !f.name.toLowerCase().includes(search)) return false;
      if (typeFilter && !f.name.toLowerCase().endsWith(typeFilter)) return false;
      return true;
    });

    countEl.textContent = `${filtered.length} of ${files.length} files`;

    grid.innerHTML = filtered.length === 0
      ? `<div class="empty-state" style="grid-column:1/-1;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg><h3>No images found</h3></div>`
      : filtered.map(f => `
        <div class="media-item" title="${escHtml(f.name)} — ${fmtSize(f.size)}">
          <img src="${escHtml(f.path)}" alt="${escHtml(f.name)}" loading="lazy"
            onerror="this.style.opacity=.3;this.alt='Error'" />
          <div class="media-item__name">${escHtml(f.name)}</div>
        </div>`).join('');
  }

  container.querySelector('#media-search').oninput = render;
  container.querySelector('#media-filter').onchange = render;
  render();
}
