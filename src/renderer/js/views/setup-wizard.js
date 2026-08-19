/**
 * views/setup-wizard.js - First-Run Setup Wizard
 * M.R. Textile CMS
 *
 * Renders a guided 5-step setup flow directly into the #login-screen element.
 * Called from app.js when settings.get("setupComplete") is not "true".
 *
 * Storage: completion flag is written via setup:complete IPC which calls
 * SettingsModel.set("setupComplete", "true") in the SQLite database.
 * This is update-safe: electron-updater never touches the userData database.
 */

"use strict";

export async function renderSetupWizard(container, { websiteRoot, hasBusinessInfo }) {
  // State
  let step = 1;
  const TOTAL_STEPS = hasBusinessInfo ? 4 : 5; // step 4 auto-skipped if biz data exists
  let gitOk = false;

  // Shell
  container.innerHTML = `
    <div class="setup-wizard">
      <div class="setup-wizard__card">
        <div class="setup-wizard__brand">
          <div class="login-brand__mark">MR</div>
          <div class="login-brand__text">
            <span class="login-brand__name">M.R. Textile</span>
            <span class="login-brand__sub">First-Time Setup</span>
          </div>
        </div>

        <div class="setup-wizard__progress" id="sw-progress" aria-label="Setup progress">
          <div class="setup-wizard__progress-bar" id="sw-bar"></div>
        </div>
        <p class="setup-wizard__step-label" id="sw-step-label">Step 1 of ${TOTAL_STEPS}</p>

        <div class="setup-wizard__body" id="sw-body"></div>
      </div>
    </div>
  `;

  const body      = container.querySelector('#sw-body');
  const bar       = container.querySelector('#sw-bar');
  const stepLabel = container.querySelector('#sw-step-label');

  function setProgress(current, total) {
    bar.style.width = Math.round((current / total) * 100) + '%';
    stepLabel.textContent = 'Step ' + current + ' of ' + total;
  }

  // ---- Step 1: Welcome + mandatory password change --------------------------
  async function showStep1() {
    setProgress(1, TOTAL_STEPS);
    body.innerHTML = `
      <div class="setup-step" id="sw-step-1">
        <h2 class="setup-step__title">Welcome &mdash; Set Your Password</h2>
        <p class="setup-step__desc">
          Before you can use the CMS, set a secure administrator password.
          This replaces the default password and cannot be skipped.
        </p>
        <div class="form-group">
          <label class="form-label" for="sw-pw-current">Current Password <span class="text-muted text-sm">(default: 12345678)</span></label>
          <input id="sw-pw-current" class="form-input" type="password" autocomplete="current-password" placeholder="12345678" />
        </div>
        <div class="form-group">
          <label class="form-label" for="sw-pw-new">New Password</label>
          <input id="sw-pw-new" class="form-input" type="password" autocomplete="new-password" placeholder="Min. 8 characters" />
        </div>
        <div class="form-group">
          <label class="form-label" for="sw-pw-confirm">Confirm New Password</label>
          <input id="sw-pw-confirm" class="form-input" type="password" autocomplete="new-password" placeholder="Repeat new password" />
        </div>
        <div id="sw-pw-error" class="setup-step__error hidden"></div>
        <div class="setup-step__actions">
          <button class="btn-primary" id="sw-pw-next">Continue</button>
        </div>
      </div>
    `;

    body.querySelector('#sw-pw-next').onclick = async () => {
      const cur  = body.querySelector('#sw-pw-current').value;
      const nw   = body.querySelector('#sw-pw-new').value;
      const conf = body.querySelector('#sw-pw-confirm').value;
      const err  = body.querySelector('#sw-pw-error');
      const btn  = body.querySelector('#sw-pw-next');

      const showErr = (msg) => { err.textContent = msg; err.classList.remove('hidden'); };
      err.classList.add('hidden');

      if (!cur || !nw || !conf) return showErr('Please fill in all fields.');
      if (nw.length < 8)        return showErr('New password must be at least 8 characters.');
      if (nw !== conf)           return showErr('New passwords do not match.');

      btn.disabled = true; btn.textContent = 'Saving...';
      const res = await window.cms.settings.changePassword(cur, nw);
      btn.disabled = false; btn.textContent = 'Continue';

      if (res.ok) {
        showStep2();
      } else {
        showErr(res.error || 'Incorrect current password. The default is 12345678.');
      }
    };
  }

  // ---- Step 2: Website folder picker ----------------------------------------
  async function showStep2() {
    setProgress(2, TOTAL_STEPS);
    let selectedPath = websiteRoot || '';

    const renderFolderStep = () => {
      body.innerHTML = `
        <div class="setup-step" id="sw-step-2">
          <h2 class="setup-step__title">Website Folder</h2>
          <p class="setup-step__desc">
            Select the <strong>github-pages</strong> folder &mdash; the local git repository
            that gets published to your website. It must contain a <code>.git</code> subfolder.
          </p>
          <div class="form-group">
            <label class="form-label">Selected Folder</label>
            <div class="flex-gap mt-1">
              <input id="sw-folder-path" class="form-input" readonly
                placeholder="No folder selected"
                value="${escHtml(selectedPath)}" style="flex:1;" />
              <button class="btn-secondary" id="sw-browse-btn">Browse&hellip;</button>
            </div>
            <div id="sw-folder-status" class="mt-1 text-sm"></div>
          </div>
          <div id="sw-folder-error" class="setup-step__error hidden"></div>
          <div class="setup-step__actions">
            <button class="btn-primary" id="sw-folder-next" disabled>Continue</button>
          </div>
        </div>
      `;

      const pathInput = body.querySelector('#sw-folder-path');
      const statusEl  = body.querySelector('#sw-folder-status');
      const nextBtn   = body.querySelector('#sw-folder-next');
      const browseBtn = body.querySelector('#sw-browse-btn');

      async function validateAndShow(p) {
        statusEl.textContent = 'Validating...';
        statusEl.className = 'mt-1 text-sm text-muted';
        nextBtn.disabled = true;

        // Write path tentatively so git:status can resolve it
        await window.cms.settings.set('websiteRoot', p);
        const gitRes = await window.cms.git.status();

        if (!gitRes.ok || (gitRes.error && /not a git/i.test(gitRes.error))) {
          statusEl.innerHTML = '<span class="text-danger">' +
            '&#9888; This folder is not a git repository (.git not found). ' +
            'Publishing will not work. Please pick the correct folder.' +
            '</span>';
          nextBtn.disabled = true;
        } else {
          statusEl.innerHTML = '<span class="text-success">&#10003; Git repository confirmed.</span>';
          selectedPath = p;
          nextBtn.disabled = false;
        }
      }

      browseBtn.onclick = async () => {
        const chosen = await window.cms.dialog.openFolder();
        if (!chosen) return;
        pathInput.value = chosen;
        await validateAndShow(chosen);
      };

      nextBtn.onclick = () => showStep3();

      // Pre-validate if we already have a path (handoff install)
      if (selectedPath) {
        validateAndShow(selectedPath);
      }
    };

    renderFolderStep();
  }

  // ---- Step 3: Git check (skippable) ----------------------------------------
  async function showStep3() {
    setProgress(3, TOTAL_STEPS);
    body.innerHTML = `
      <div class="setup-step" id="sw-step-3">
        <h2 class="setup-step__title">Git Installation Check</h2>
        <p class="setup-step__desc">
          The CMS uses Git to publish your website to GitHub Pages.
          Checking whether Git is installed&hellip;
        </p>
        <div id="sw-git-result" class="setup-step__check-box">
          <span class="text-muted text-sm">Checking&hellip;</span>
        </div>
        <div class="setup-step__actions">
          <button class="btn-secondary" id="sw-git-skip">Skip for now</button>
          <button class="btn-primary hidden" id="sw-git-next">Continue</button>
        </div>
      </div>
    `;

    const resultEl = body.querySelector('#sw-git-result');
    const skipBtn  = body.querySelector('#sw-git-skip');
    const nextBtn  = body.querySelector('#sw-git-next');

    const advance = () => { if (hasBusinessInfo) showStep5(); else showStep4(); };
    skipBtn.onclick = advance;
    nextBtn.onclick = advance;

    const res = await window.cms.git.check();
    if (res.ok && res.data && res.data.installed) {
      gitOk = true;
      resultEl.innerHTML =
        '<div class="setup-step__check-pass">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;flex-shrink:0;">' +
            '<polyline points="20 6 9 17 4 12"/>' +
          '</svg>' +
          '<span>Git found: <strong>' + escHtml(res.data.version) + '</strong></span>' +
        '</div>';
      nextBtn.classList.remove('hidden');
      skipBtn.classList.add('hidden');
    } else {
      resultEl.innerHTML =
        '<div class="setup-step__check-fail">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:18px;height:18px;flex-shrink:0;">' +
            '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
          '</svg>' +
          '<div>' +
            '<span>Git not found &mdash; it may not be installed or not on PATH.</span>' +
            '<p class="form-hint mt-1">' +
              'Publishing won\'t work until Git is installed. ' +
              '<a href="#" id="sw-git-link" class="text-gold">Download Git &rarr;</a>' +
            '</p>' +
          '</div>' +
        '</div>' +
        '<p class="form-hint mt-2">You can continue setup now and check Git later from Settings.</p>';
      body.querySelector('#sw-git-link').onclick = (e) => {
        e.preventDefault();
        window.cms.shell.openUrl('https://git-scm.com');
      };
    }
  }

  // ---- Step 4: Business info (auto-skipped if hasBusinessInfo) ---------------
  async function showStep4() {
    setProgress(4, TOTAL_STEPS);
    body.innerHTML = `
      <div class="setup-step" id="sw-step-4">
        <h2 class="setup-step__title">Business Information</h2>
        <p class="setup-step__desc">
          This appears in your website's contact section and WhatsApp enquiry links.
          You can update it anytime from <strong>Business Info</strong> in the sidebar.
        </p>
        <div class="form-group">
          <label class="form-label" for="sw-biz-name">Business Name <span class="text-danger">*</span></label>
          <input id="sw-biz-name" class="form-input" placeholder="M.R. Textile / M.R. Sarees" />
        </div>
        <div class="form-group">
          <label class="form-label" for="sw-biz-city">City</label>
          <input id="sw-biz-city" class="form-input" placeholder="Surat" />
        </div>
        <div class="form-group">
          <label class="form-label" for="sw-biz-whatsapp">WhatsApp Number</label>
          <input id="sw-biz-whatsapp" class="form-input" type="tel" placeholder="91XXXXXXXXXX (with country code)" />
          <p class="form-hint">Used for product enquiry links on your website.</p>
        </div>
        <div id="sw-biz-error" class="setup-step__error hidden"></div>
        <div class="setup-step__actions">
          <button class="btn-secondary" id="sw-biz-skip">Skip for now</button>
          <button class="btn-primary" id="sw-biz-next">Continue</button>
        </div>
      </div>
    `;

    const errEl = body.querySelector('#sw-biz-error');
    body.querySelector('#sw-biz-skip').onclick = showStep5;
    body.querySelector('#sw-biz-next').onclick = async () => {
      const name = body.querySelector('#sw-biz-name').value.trim();
      errEl.classList.add('hidden');
      if (!name) {
        errEl.textContent = 'Business name is required.';
        errEl.classList.remove('hidden');
        return;
      }
      const btn = body.querySelector('#sw-biz-next');
      btn.disabled = true; btn.textContent = 'Saving...';
      await window.cms.businessInfo.update({
        businessName: name,
        addressCity:  body.querySelector('#sw-biz-city').value.trim(),
        whatsapp:     body.querySelector('#sw-biz-whatsapp').value.trim(),
      });
      btn.disabled = false; btn.textContent = 'Continue';
      showStep5();
    };
  }

  // ---- Step 5: Done ----------------------------------------------------------
  async function showStep5() {
    setProgress(TOTAL_STEPS, TOTAL_STEPS);
    // Mark complete in the SQLite database (update-safe flag)
    await window.cms.setup.complete();

    body.innerHTML = `
      <div class="setup-step setup-step--done" id="sw-step-5">
        <div class="setup-step__done-icon">&#10003;</div>
        <h2 class="setup-step__title">Setup Complete!</h2>
        <p class="setup-step__desc">
          Your CMS is ready. Sign in with the password you just set to get started.
        </p>
        ${!gitOk ? '<p class="form-hint mt-2">&#9888; Install Git when you get a chance &mdash; it\'s needed to publish your website.</p>' : ''}
        <div class="setup-step__actions">
          <button class="btn-primary" id="sw-done-btn">Go to Login &rarr;</button>
        </div>
      </div>
    `;

    body.querySelector('#sw-done-btn').onclick = () => {
      // Signal app.js to transition to the normal login screen
      window.dispatchEvent(new CustomEvent('cms-setup-complete'));
    };
  }

  // Kick off
  showStep1();
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
