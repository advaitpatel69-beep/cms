/**
 * views/helpers.js — Shared view helpers
 */

export function fmtDate(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

export function fmtRelative(isoStr) {
  if (!isoStr) return '—';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return fmtDate(isoStr);
}

export function escHtml(s) {
  return String(s || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

export function navigateTo(view, ...args) {
  // Fire a custom nav event that app.js will pick up
  window.dispatchEvent(new CustomEvent('cms-navigate', { detail: { view, args } }));
}

export function statusBadge(status) {
  const map = {
    active:       '<span class="badge badge--active">Active</span>',
    out_of_stock: '<span class="badge badge--oos">Out of Stock</span>',
    archived:     '<span class="badge badge--archived">Archived</span>',
  };
  return map[status] || `<span class="badge">${escHtml(status)}</span>`;
}

export function imgSrc(path) {
  if (!path) return '';
  // Convert relative web path to file protocol for Electron
  // Main process tells us the website root via ipc
  return `cms-img://${path}`;
}
