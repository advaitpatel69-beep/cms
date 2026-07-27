/**
 * views/gallery.js — Gallery Manager
 */

import { escHtml } from './helpers.js';

export async function renderGallery(container) {
  let items = [];

  async function load() {
    const res = await window.cms.gallery.list();
    items = res.ok ? res.data : [];
    renderGrid();
  }

  function renderGrid() {
    grid.innerHTML = items.length === 0
      ? `<div class="empty-state" style="grid-column:1/-1;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg><h3>No gallery items</h3><p>Upload images to build the gallery.</p></div>`
      : items.map(g => `
        <div class="media-item" data-id="${g.id}">
          <img src="${escHtml(g.imagePath || g.image_path || '')}" alt="${escHtml(g.altText || g.alt_text || '')}" onerror="this.style.opacity=.3" />
          <div class="media-item__name">${escHtml(g.caption || 'Gallery Image')}</div>
          <button class="btn-icon" data-del="${g.id}" title="Delete" style="position:absolute;top:6px;right:6px;width:26px;height:26px;background:rgba(0,0,0,.7);border:none;color:#fff;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>`).join('');
  }

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Gallery</h1>
      <div class="page-header__actions">
        <button class="btn-primary" id="add-gallery-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Images
        </button>
      </div>
    </div>
    <div class="page-content">
      <div class="media-grid" id="gallery-grid" style="position:relative;"></div>
    </div>
  `;

  const grid = container.querySelector('#gallery-grid');
  await load();

  container.querySelector('#add-gallery-btn').onclick = async () => {
    const res = await window.cms.dialog.openImage();
    if (!res.ok || !res.data?.length) return;
    for (const p of res.data) {
      await window.cms.gallery.add(p, '', '', '');
    }
    window.Toast.success(`Added ${res.data.length} image(s) to gallery`);
    await load();
  };

  grid.addEventListener('click', async (e) => {
    const delBtn = e.target.closest('[data-del]');
    if (!delBtn) return;
    const confirmed = await window.Modal.confirm('Remove this image from the gallery?', 'Delete Gallery Image');
    if (!confirmed) return;
    const res = await window.cms.gallery.delete(delBtn.dataset.del);
    if (res.ok) { await load(); window.Toast.success('Image removed'); }
    else window.Toast.error(`Failed: ${res.error}`);
  });
}
