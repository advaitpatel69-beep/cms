/**
 * views/backup.js — Backup & Restore
 */

import { escHtml, fmtDate } from './helpers.js';

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/(1024*1024)).toFixed(1)} MB`;
}

export async function renderBackup(container) {
  async function loadBackups() {
    const res = await window.cms.backup.list();
    return res.ok ? res.data : [];
  }

  let backups = await loadBackups();

  function renderList() {
    list.innerHTML = backups.length === 0
      ? `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><h3>No backups yet</h3><p>Click "Create Backup" to make your first backup.</p></div>`
      : `<table class="data-table"><thead><tr><th>Filename</th><th>Size</th><th>Created</th><th style="text-align:right">Actions</th></tr></thead><tbody>
        ${backups.map(b => `<tr>
          <td><span style="font-family:monospace;font-size:.8rem;">${escHtml(b.filename)}</span></td>
          <td>${fmtSize(b.size)}</td>
          <td>${fmtDate(b.created)}</td>
          <td class="col-actions"><button class="btn-secondary btn-sm" data-restore="${escHtml(b.filename)}">Restore</button></td>
        </tr>`).join('')}
      </tbody></table>`;
  }

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Backup & Restore</h1>
    </div>
    <div class="page-content">
      <div class="card mb-3">
        <div class="card-header"><span class="card-title">Create Backup</span></div>
        <div class="card-body">
          <p class="text-sm text-muted mb-2">Creates a ZIP backup of: SQLite database, all JSON data files, and all website images.</p>
          <button class="btn-primary" id="create-backup-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Create Backup Now
          </button>
        </div>
      </div>
      <div class="table-wrapper" id="backup-list"></div>
    </div>
  `;

  const list = container.querySelector('#backup-list');
  renderList();

  container.querySelector('#create-backup-btn').onclick = async () => {
    const btn = container.querySelector('#create-backup-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Creating backup...';
    const res = await window.cms.backup.create();
    btn.disabled = false; btn.innerHTML = 'Create Backup Now';
    if (res.ok) {
      window.Toast.success(`Backup created: ${res.data.filename}`);
      backups = await loadBackups();
      renderList();
    } else {
      window.Toast.error(`Backup failed: ${res.error}`);
    }
  };

  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-restore]');
    if (!btn) return;
    const confirmed = await window.Modal.confirm(
      `Restore from "${btn.dataset.restore}"? This will overwrite current database and images.`,
      'Restore Backup'
    );
    if (!confirmed) return;
    const res = await window.cms.backup.restore(btn.dataset.restore);
    if (res.ok) window.Toast.success('Backup restored! Please restart the CMS.');
    else window.Toast.error(`Restore failed: ${res.error}`);
  });
}
