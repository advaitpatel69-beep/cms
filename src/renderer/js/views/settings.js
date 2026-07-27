/**
 * views/settings.js — CMS Settings
 */

import { escHtml } from './helpers.js';

export async function renderSettings(container) {
  const [settingsRes, pathsRes] = await Promise.all([
    window.cms.settings.getAll(),
    window.cms.app.getPaths(),
  ]);

  const s     = settingsRes.ok ? settingsRes.data : {};
  const paths = pathsRes.ok   ? pathsRes.data    : {};

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Settings</h1>
    </div>
    <div class="page-content" style="max-width:700px;">

      <!-- Website Config -->
      <div class="card mb-3">
        <div class="card-header"><span class="card-title">Website Configuration</span></div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">Website Root (github-pages folder)</label>
            <input id="s-website-root" class="form-input" value="${escHtml(s.websiteRoot || paths.websiteRoot || '')}" />
            <p class="form-hint">Absolute path to the github-pages directory. Changing this requires restarting the CMS.</p>
          </div>
          <div class="form-group">
            <label class="form-label">Site URL</label>
            <input id="s-site-url" class="form-input" value="${escHtml(s.siteUrl || 'https://mrtextile.online')}" />
          </div>
          <button class="btn-primary" id="save-website-cfg">Save Website Config</button>
        </div>
      </div>

      <!-- Change Password -->
      <div class="card mb-3">
        <div class="card-header"><span class="card-title">Change Password</span></div>
        <div class="card-body">
          <div class="form-group"><label class="form-label">Current Password</label>
            <input id="pw-current" class="form-input" type="password" /></div>
          <div class="form-group"><label class="form-label">New Password</label>
            <input id="pw-new" class="form-input" type="password" /></div>
          <div class="form-group"><label class="form-label">Confirm New Password</label>
            <input id="pw-confirm" class="form-input" type="password" /></div>
          <button class="btn-primary" id="change-pw-btn">Update Password</button>
        </div>
      </div>

      <!-- Auto-archive -->
      <div class="card mb-3">
        <div class="card-header"><span class="card-title">Auto-archive Settings</span></div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">Days until auto-archive (after Out of Stock)</label>
            <input id="s-archive-days" class="form-input" type="number" min="1" max="365" value="${escHtml(s.autoArchiveDays || '7')}" style="max-width:100px;" />
          </div>
          <button class="btn-primary" id="save-archive-cfg">Save</button>
        </div>
      </div>

      <!-- Paths Info -->
      <div class="card">
        <div class="card-header"><span class="card-title">System Paths</span></div>
        <div class="card-body">
          <table style="width:100%;font-size:.82rem;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:var(--clr-text-3);width:160px;">Website Root</td><td style="color:var(--clr-text-2);word-break:break-all;">${escHtml(paths.websiteRoot || '—')}</td></tr>
            <tr><td style="padding:6px 0;color:var(--clr-text-3);">CMS Data Dir</td><td style="color:var(--clr-text-2);word-break:break-all;">${escHtml(paths.dataDir || '—')}</td></tr>
          </table>
        </div>
      </div>
    </div>
  `;

  // Save website config
  container.querySelector('#save-website-cfg').onclick = async () => {
    await window.cms.settings.set('websiteRoot', container.querySelector('#s-website-root').value.trim());
    await window.cms.settings.set('siteUrl',     container.querySelector('#s-site-url').value.trim());
    window.Toast.success('Settings saved! Restart the CMS to apply the new website root.');
  };

  // Change password
  container.querySelector('#change-pw-btn').onclick = async () => {
    const cur  = container.querySelector('#pw-current').value;
    const nw   = container.querySelector('#pw-new').value;
    const conf = container.querySelector('#pw-confirm').value;
    if (!cur || !nw) { window.Toast.warning('Please fill all fields'); return; }
    if (nw !== conf) { window.Toast.error('New passwords do not match'); return; }
    if (nw.length < 6) { window.Toast.warning('Password must be at least 6 characters'); return; }

    const res = await window.cms.settings.changePassword(cur, nw);
    if (res.ok) {
      window.Toast.success('Password changed!');
      container.querySelectorAll('#pw-current,#pw-new,#pw-confirm').forEach(i => i.value = '');
    } else {
      window.Toast.error(`Failed: ${res.error}`);
    }
  };

  // Auto-archive days
  container.querySelector('#save-archive-cfg').onclick = async () => {
    const days = parseInt(container.querySelector('#s-archive-days').value);
    if (!days || days < 1) { window.Toast.warning('Enter a valid number of days'); return; }
    await window.cms.settings.set('autoArchiveDays', days.toString());
    window.Toast.success('Auto-archive setting saved!');
  };
}
